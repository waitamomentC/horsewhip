import * as vscode from 'vscode';
import {
  buildCorrectionPrompt,
  buildNoBoundaryHint,
  computeBoundaryGuard,
  type BoundaryGuardResult,
} from './boundaryGuard';
import {
  getEffectiveAllowlist,
  getEffectiveBoundaryLocked,
  getEffectiveLockTargets,
  isGuardActive,
} from './boundaryAllowlist';
import { evaluateBranchLock } from './boundaryLock';
import {
  onBoundaryLockChanged,
  refreshEditorsForBoundary,
  registerBoundaryEditGuard,
} from './boundaryEditGuard';
import { isHorsewhipPreCommitHookInstalled } from './boundaryGitHook';
import {
  clearCommitBlockedMarker,
  readCommitBlockedMarker,
  writeCommitBlockedMarker,
} from './boundaryPersist';
import { fetchWorkingTreeChangedFiles, gitRestorePaths } from './gitRunner';
import { insertTextIntoChat } from './chatInsert';

let statusBar: vscode.StatusBarItem | undefined;
let lastResult: BoundaryGuardResult | null = null;
let saveDebounce: ReturnType<typeof setTimeout> | undefined;
let notifyWebview: ((payload: object) => void) | undefined;
let lastBlockedPromptAt = 0;
const BLOCK_PROMPT_DEBOUNCE_MS = 4000;

export function setGuardWebviewNotifier(fn: ((payload: object) => void) | undefined): void {
  notifyWebview = fn;
}

export function getLastGuardResult(): BoundaryGuardResult | null {
  return lastResult;
}

export type CommitGuardVerdict = {
  allowed: boolean;
  result: BoundaryGuardResult;
  reason?: string;
};

export type RevertOnCommitBlockMode = 'prompt' | 'always' | 'never';

function guardConfig(): {
  onSave: boolean;
  mode: 'warn' | 'strict';
  blockCommit: boolean;
  blockCommitWithoutBoundary: boolean;
  revertOnCommitBlock: RevertOnCommitBlockMode;
  offerCorrectionAfterRevert: boolean;
  notifyOnCommitBlock: boolean;
} {
  const cfg = vscode.workspace.getConfiguration('horsewhip.guard');
  const mode = cfg.get<'warn' | 'strict'>('mode', 'warn');
  const revertRaw = cfg.get<string>('revertOnCommitBlock', 'always');
  const revertOnCommitBlock: RevertOnCommitBlockMode =
    revertRaw === 'prompt' || revertRaw === 'never' ? revertRaw : 'always';
  return {
    onSave: cfg.get<boolean>('onSave', true),
    mode: mode === 'strict' ? 'strict' : 'warn',
    blockCommit: cfg.get<boolean>('blockCommit', true),
    blockCommitWithoutBoundary: cfg.get<boolean>('blockCommitWithoutBoundary', true),
    revertOnCommitBlock,
    offerCorrectionAfterRevert: cfg.get<boolean>('offerCorrectionAfterRevert', true),
    notifyOnCommitBlock: cfg.get<boolean>('notifyOnCommitBlock', false),
  };
}

/** Run guard and decide if a commit may proceed (plugin UI + shared with pre-commit). */
export async function notifyBoundaryArmed(workspaceRoot: string, files: string[]): Promise<void> {
  if (!files.length) {
    pushGuardStatus({
      hasBoundary: false,
      allowed: [],
      actual: [],
      overreach: [],
      ok: true,
    });
    return;
  }
  const hookOk = await isHorsewhipPreCommitHookInstalled(workspaceRoot);
  notifyWebview?.({
    type: 'guardStatus',
    hasBoundary: true,
    allowed: files,
    hookInstalled: hookOk,
    ok: true,
    overreach: [],
    actualCount: 0,
  });
  if (!hookOk) {
    vscode.window.showWarningMessage(
      'horsewhip：边界已划定，但 git pre-commit 钩子未安装。终端里 git commit 不会拦截越界，请运行「Horsewhip: Install Git Pre-Commit Guard Hook」。',
    );
  }
}

export async function evaluateCommitGuard(workspaceRoot: string): Promise<CommitGuardVerdict> {
  if (!isGuardActive()) {
    const actual = await fetchWorkingTreeChangedFiles(workspaceRoot);
    const result = computeBoundaryGuard([], actual);
    lastResult = result;
    updateStatusBar(result);
    pushGuardStatus({ ...result, guardActive: false });
    return { allowed: true, result };
  }

  const locked = await getEffectiveBoundaryLocked(workspaceRoot);
  const allowlist = locked ? await getEffectiveAllowlist(workspaceRoot) : [];
  const actual = await fetchWorkingTreeChangedFiles(workspaceRoot);
  const result = computeBoundaryGuard(allowlist, actual);
  lastResult = result;
  updateStatusBar(result);
  pushGuardStatus(result);

  const { blockCommit } = guardConfig();
  if (!blockCommit) {
    return { allowed: true, result };
  }
  if (!result.hasBoundary) {
    return { allowed: true, result };
  }
  if (!result.ok) {
    return {
      allowed: false,
      result,
      reason: `圈外改动 ${result.overreach.length} 个文件，commit 已拦截（仅允许修改已圈定路径）。`,
    };
  }

  const targets = await getEffectiveLockTargets(workspaceRoot);
  const branchVerdict = await evaluateBranchLock(workspaceRoot, targets);
  if (!branchVerdict.ok) {
    return {
      allowed: false,
      result,
      reason: branchVerdict.reason ?? '分支与瞄准不一致，commit 已拦截。',
    };
  }

  return { allowed: true, result };
}

function overreachPreview(paths: string[], max = 6): string {
  return paths.slice(0, max).join(', ') + (paths.length > max ? ` …+${paths.length - max}` : '');
}

function notifyCommitBlockedUi(
  result: BoundaryGuardResult,
  reason: string,
  source: 'panel' | 'pre-commit',
): void {
  notifyWebview?.({
    type: 'commitBlocked',
    source,
    reason,
    hasBoundary: result.hasBoundary,
    allowed: result.allowed,
    overreach: result.overreach,
    prompt: result.overreach.length
      ? buildCorrectionPrompt(result.allowed, result.overreach)
      : '',
  });
  pushGuardStatus(result);
}

/** After revert: re-check guard; optionally insert correction for AI. */
async function finishRevertFlow(
  workspaceRoot: string,
  before: BoundaryGuardResult,
  options: { quiet?: boolean } = {},
): Promise<boolean> {
  const quiet =
    options.quiet ??
    (guardConfig().revertOnCommitBlock === 'always' && !guardConfig().notifyOnCommitBlock);
  const again = await evaluateCommitGuard(workspaceRoot);
  if (again.allowed) {
    await clearCommitBlockedMarker(workspaceRoot);
    if (!quiet) {
      vscode.window.showInformationMessage(
        '越界文件已复原，工作区仅剩边界内改动。请重新提交，并让 AI 在边界内重想方案。',
      );
    }
    return true;
  }
  if (quiet) return false;
  if (before.overreach.length && again.result.overreach.length) {
    vscode.window.showWarningMessage(
      `仍有越界：${overreachPreview(again.result.overreach)}。可再次还原或检查守门。`,
    );
  } else if (!again.result.hasBoundary) {
    vscode.window.showWarningMessage('未选中节点，当前可自由改码。选中节点后将仅圈内可改。');
  }
  return false;
}

/**
 * Commit blocked (panel or hook). Revert overreach files when configured; never leave dirty overreach behind.
 * Returns true only if guard passes after optional revert (caller may retry commit).
 */
export async function handleCommitBlocked(
  workspaceRoot: string,
  verdict: CommitGuardVerdict,
  options: { source?: 'panel' | 'pre-commit'; quiet?: boolean } = {},
): Promise<boolean> {
  const source = options.source ?? 'panel';
  const r = verdict.result;
  await writeCommitBlockedMarker(workspaceRoot, {
    source,
    allowed: r.allowed,
    overreach: r.overreach,
  });
  notifyCommitBlockedUi(r, verdict.reason ?? 'commit 已拦截', source);

  const { revertOnCommitBlock, offerCorrectionAfterRevert } = guardConfig();

  if (r.overreach.length && revertOnCommitBlock === 'always') {
    await revertOverreachFiles(workspaceRoot, r, { skipConfirm: true });
    if (offerCorrectionAfterRevert) await insertCorrectionPrompt(r);
    return finishRevertFlow(workspaceRoot, r, { quiet: !guardConfig().notifyOnCommitBlock });
  }

  if (options.quiet) return false;

  const detail =
    r.overreach.length > 0
      ? `拦截只阻止了 commit，以下越界文件仍留在工作区，必须复原后再提交：\n${r.overreach.join('\n')}`
      : verdict.reason ?? '请先挥鞭上锁或清除越界改动。';

  const actions: string[] = [];
  if (r.overreach.length) {
    actions.push('还原越界文件（推荐）', '插入纠正到 Chat');
  } else {
    actions.push('去泳道划边界');
  }
  actions.push('检查越界');

  const pick = await vscode.window.showErrorMessage(
    `horsewhip：${verdict.reason ?? 'commit 已拦截'}\n\n${detail}`,
    { modal: true },
    ...actions,
  );

  if (pick === '还原越界文件（推荐）' && r.overreach.length) {
    await revertOverreachFiles(workspaceRoot, r);
    if (offerCorrectionAfterRevert) await insertCorrectionPrompt(r);
    return finishRevertFlow(workspaceRoot, r);
  }
  if (pick === '插入纠正到 Chat') await insertCorrectionPrompt(r);
  if (pick === '检查越界') await runBoundaryGuardCheck(workspaceRoot);
  if (pick === '去泳道划边界') {
    void vscode.commands.executeCommand('horsewhip.showTimeline');
  }
  return false;
}

/** Block commit when overreach; shows actions. Returns true if commit may continue (after revert). */
export async function assertCommitAllowed(workspaceRoot: string): Promise<boolean> {
  const verdict = await evaluateCommitGuard(workspaceRoot);
  if (verdict.allowed) {
    await clearCommitBlockedMarker(workspaceRoot);
    return true;
  }
  return handleCommitBlocked(workspaceRoot, verdict, { source: 'panel' });
}

/**
 * React to `.git/horsewhip/commit-blocked.json` (written by pre-commit hook or panel).
 * Call after git activity or when opening the workspace.
 */
export async function processCommitBlockedMarker(workspaceRoot: string): Promise<void> {
  const marker = await readCommitBlockedMarker(workspaceRoot);
  if (!marker) return;

  const now = Date.now();
  if (now - lastBlockedPromptAt < BLOCK_PROMPT_DEBOUNCE_MS) return;
  lastBlockedPromptAt = now;

  const allowlist = await getEffectiveAllowlist(workspaceRoot);
  const actual = await fetchWorkingTreeChangedFiles(workspaceRoot);
  const result = computeBoundaryGuard(allowlist, actual);
  lastResult = result;
  updateStatusBar(result);

  if (result.ok) {
    await clearCommitBlockedMarker(workspaceRoot);
    return;
  }

  const verdict: CommitGuardVerdict = {
    allowed: false,
    result,
    reason:
      marker.overreach.length > 0
        ? `上次 commit 被拦截，越界文件仍在工作区：${overreachPreview(marker.overreach)}`
        : '上次 commit 被拦截，请先挥鞭上锁。',
  };

  notifyCommitBlockedUi(result, verdict.reason!, marker.source);

  const { revertOnCommitBlock } = guardConfig();
  if (marker.overreach.length && revertOnCommitBlock === 'always') {
    await revertOverreachFiles(workspaceRoot, result, { skipConfirm: true });
    if (guardConfig().offerCorrectionAfterRevert) await insertCorrectionPrompt(result);
    await finishRevertFlow(workspaceRoot, result, {
      quiet: !guardConfig().notifyOnCommitBlock,
    });
    return;
  }

  const pick = await vscode.window.showWarningMessage(
    `horsewhip：${verdict.reason}\n\n请还原越界文件，仅在边界内继续（见 .git/horsewhip/boundary-notes.md）。`,
    { modal: false },
    '还原越界文件',
    '插入纠正到 Chat',
    '稍后处理',
  );
  if (pick === '还原越界文件') {
    await revertOverreachFiles(workspaceRoot, result);
    if (guardConfig().offerCorrectionAfterRevert) await insertCorrectionPrompt(result);
    await finishRevertFlow(workspaceRoot, result);
  } else if (pick === '插入纠正到 Chat') {
    await insertCorrectionPrompt(result);
  }
}

function pushGuardStatus(payload: BoundaryGuardResult | Record<string, unknown>): void {
  const result = payload as BoundaryGuardResult;
  const prompt = result.overreach?.length
    ? buildCorrectionPrompt(result.allowed, result.overreach)
    : '';
  notifyWebview?.({
    type: 'guardStatus',
    guardActive: isGuardActive(),
    hasBoundary: result.hasBoundary,
    ok: result.ok,
    allowed: result.allowed,
    overreach: result.overreach,
    actualCount: result.actual?.length ?? 0,
    prompt,
    ...('hookInstalled' in payload ? { hookInstalled: payload.hookInstalled } : {}),
  });
}

function updateStatusBar(result: BoundaryGuardResult | null): void {
  if (!statusBar) return;
  if (!result) {
    statusBar.text = '$(shield) horsewhip 守门';
    statusBar.tooltip = '在泳道选节点并挥鞭上锁后，可检查 AI 是否改飞';
    statusBar.backgroundColor = undefined;
    statusBar.command = 'horsewhip.checkBoundary';
    return;
  }
  if (!result.hasBoundary) {
    statusBar.text = '$(unlock) 可自由改码';
    statusBar.tooltip = '未选中节点：AI 可修改仓库内任何文件。选中节点后仅圈内可改。';
    statusBar.backgroundColor = undefined;
    statusBar.command = 'horsewhip.checkBoundary';
    return;
  }
  if (result.ok) {
    statusBar.text = '$(check) 圈定内可改';
    statusBar.tooltip = `仅此可改：${result.allowed.map((p) => p).join(', ') || '—'}`;
    statusBar.backgroundColor = undefined;
    statusBar.command = 'horsewhip.checkBoundary';
    return;
  }
    statusBar.text = `$(warning) 圈外 ${result.overreach.length}`;
    statusBar.tooltip = `圈外改动（禁止）：\n${result.overreach.join('\n')}\n\n点击：检查 / 纠正`;
  statusBar.backgroundColor = new vscode.ThemeColor('statusBarItem.warningBackground');
  statusBar.command = 'horsewhip.checkBoundary';
}

export async function runBoundaryGuardCheck(
  workspaceRoot: string,
  options: { silent?: boolean; fromSave?: boolean } = {},
): Promise<BoundaryGuardResult> {
  const allowlist = await getEffectiveAllowlist(workspaceRoot);
  const actual = await fetchWorkingTreeChangedFiles(workspaceRoot);
  const result = computeBoundaryGuard(allowlist, actual);
  lastResult = result;
  updateStatusBar(result);
  pushGuardStatus(result);

  if (!options.silent) {
    if (!result.hasBoundary) {
      vscode.window.showInformationMessage(buildNoBoundaryHint());
      return result;
    }
    if (result.ok) {
      const msg = result.actual.length
        ? `边界内：${result.actual.length} 个文件有改动，均在允许范围内。`
        : '工作区相对 HEAD 无改动。';
      vscode.window.showInformationMessage(`horsewhip 守门：${msg}`);
      return result;
    }
    await showOverreachActions(workspaceRoot, result, options.fromSave);
  } else if (options.fromSave && !result.ok && result.hasBoundary) {
    const { mode } = guardConfig();
    if (mode === 'strict') {
      await showOverreachActions(workspaceRoot, result, true);
    } else {
      vscode.window.showWarningMessage(
        `horsewhip：检测到 ${result.overreach.length} 个越界文件`,
        '查看',
        '插入纠正',
      ).then((pick) => {
        if (pick === '查看') void showOverreachActions(workspaceRoot, result, true);
        if (pick === '插入纠正') void insertCorrectionPrompt(result);
      });
    }
  }

  return result;
}

async function showOverreachActions(
  workspaceRoot: string,
  result: BoundaryGuardResult,
  quiet = false,
): Promise<void> {
  const preview = result.overreach.slice(0, 8).join(', ')
    + (result.overreach.length > 8 ? ` …+${result.overreach.length - 8}` : '');
  const pick = await vscode.window.showWarningMessage(
    `越界 ${result.overreach.length} 个文件：${preview}`,
    { modal: quiet },
    '插入纠正到 Chat',
    '还原越界文件',
    '仅复制纠正文案',
  );
  if (pick === '插入纠正到 Chat') await insertCorrectionPrompt(result);
  else if (pick === '仅复制纠正文案') await copyCorrectionPrompt(result);
  else if (pick === '还原越界文件') await revertOverreachFiles(workspaceRoot, result);
}

export async function insertCorrectionPrompt(result?: BoundaryGuardResult): Promise<void> {
  const r = result ?? lastResult;
  if (!r?.overreach.length) {
    vscode.window.showInformationMessage('当前无越界项；请先运行「检查越界」。');
    return;
  }
  const text = buildCorrectionPrompt(r.allowed, r.overreach);
  const out = await insertTextIntoChat(text);
  if (out === 'chat') {
    vscode.window.showInformationMessage('horsewhip：越界纠正已插入 Chat');
  } else {
    vscode.window.showInformationMessage('horsewhip：越界纠正已复制到剪贴板');
  }
}

export async function copyCorrectionPrompt(result?: BoundaryGuardResult): Promise<void> {
  const r = result ?? lastResult;
  if (!r?.overreach.length) {
    vscode.window.showInformationMessage('当前无越界项。');
    return;
  }
  const text = buildCorrectionPrompt(r.allowed, r.overreach);
  await vscode.env.clipboard.writeText(text);
  vscode.window.showInformationMessage('horsewhip：越界纠正文案已复制');
}

export async function revertOverreachFiles(
  workspaceRoot: string,
  result?: BoundaryGuardResult,
  options: { skipConfirm?: boolean } = {},
): Promise<void> {
  const r = result ?? lastResult;
  if (!r?.overreach.length) {
    vscode.window.showInformationMessage('当前无越界文件可还原。');
    return;
  }
  if (!options.skipConfirm) {
    const confirm = await vscode.window.showWarningMessage(
      `将还原以下越界路径（tracked → checkout HEAD，未跟踪 → 删除）：\n${r.overreach.join('\n')}`,
      { modal: true },
      '确认还原',
    );
    if (confirm !== '确认还原') return;
  }
  try {
    await gitRestorePaths(workspaceRoot, r.overreach);
    if (!options.skipConfirm) {
      vscode.window.showInformationMessage(`已还原 ${r.overreach.length} 个越界路径`);
    }
    await runBoundaryGuardCheck(workspaceRoot, { silent: true });
    const again = await evaluateCommitGuard(workspaceRoot);
    if (again.allowed) await clearCommitBlockedMarker(workspaceRoot);
  } catch (err) {
    const text = err instanceof Error ? err.message : String(err);
    vscode.window.showErrorMessage(`还原失败：${text}`);
  }
}

function scheduleSaveCheck(workspaceRoot: string): void {
  const { onSave } = guardConfig();
  if (!onSave) return;
  if (saveDebounce) clearTimeout(saveDebounce);
  saveDebounce = setTimeout(() => {
    saveDebounce = undefined;
    void (async () => {
      const locked = await getEffectiveBoundaryLocked(workspaceRoot);
      if (!locked) {
        await runBoundaryGuardCheck(workspaceRoot, { silent: true, fromSave: true });
        return;
      }
      const allowlist = await getEffectiveAllowlist(workspaceRoot);
      if (!allowlist.length) return;
      void runBoundaryGuardCheck(workspaceRoot, { silent: true, fromSave: true });
    })();
  }, 600);
}

export async function syncBoundaryLockFromWebview(
  workspaceRoot: string,
  files: string[],
  locked: boolean,
): Promise<void> {
  const blockEdit = vscode.workspace.getConfiguration('horsewhip.guard').get<string>('blockEdit', 'lock');
  if (blockEdit !== 'off') {
    await onBoundaryLockChanged(workspaceRoot, locked, files);
    await refreshEditorsForBoundary(workspaceRoot);
  }
}

export function registerBoundaryGuard(context: vscode.ExtensionContext): void {
  registerBoundaryEditGuard(context);
  statusBar = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 50);
  statusBar.command = 'horsewhip.checkBoundary';
  statusBar.show();
  updateStatusBar(null);
  context.subscriptions.push(statusBar);

  context.subscriptions.push(
    vscode.commands.registerCommand('horsewhip.checkBoundary', async () => {
      const root = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
      if (!root) {
        vscode.window.showWarningMessage('请先打开带 Git 的工作区文件夹。');
        return;
      }
      await runBoundaryGuardCheck(root);
    }),

    vscode.commands.registerCommand('horsewhip.insertCorrection', async () => {
      await insertCorrectionPrompt();
    }),

    vscode.commands.registerCommand('horsewhip.revertOverreach', async () => {
      const root = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
      if (!root) return;
      await revertOverreachFiles(root);
    }),

    vscode.commands.registerCommand('horsewhip.installCommitHook', async () => {
      const root = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
      if (!root) {
        vscode.window.showWarningMessage('请先打开工作区文件夹。');
        return;
      }
      const { installHorsewhipPreCommitHook, isHorsewhipPreCommitHookInstalled } = await import(
        './boundaryGitHook'
      );
      await installHorsewhipPreCommitHook(context.extensionUri, root);
      const ok = await isHorsewhipPreCommitHookInstalled(root);
      if (ok) {
        vscode.window.showInformationMessage(
          'horsewhip：已安装 git pre-commit 守门钩子（终端 git commit 也会拦截越界）',
        );
      }
    }),

    vscode.workspace.onDidSaveTextDocument((doc) => {
      const root = vscode.workspace.getWorkspaceFolder(doc.uri)?.uri.fsPath;
      if (!root) return;
      scheduleSaveCheck(root);
    }),
  );

  const folder = vscode.workspace.workspaceFolders?.[0];
  if (folder) {
    void processCommitBlockedMarker(folder.uri.fsPath);
  }
}
