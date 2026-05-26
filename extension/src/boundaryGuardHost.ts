import * as vscode from 'vscode';
import {
  buildCorrectionPrompt,
  buildNoBoundaryHint,
  computeBoundaryGuard,
  type BoundaryGuardResult,
} from './boundaryGuard';
import { getEffectiveAllowlist } from './boundaryAllowlist';
import { isHorsewhipPreCommitHookInstalled } from './boundaryGitHook';
import { fetchWorkingTreeChangedFiles, gitRestorePaths } from './gitRunner';
import { insertTextIntoChat } from './chatInsert';

let statusBar: vscode.StatusBarItem | undefined;
let lastResult: BoundaryGuardResult | null = null;
let saveDebounce: ReturnType<typeof setTimeout> | undefined;
let notifyWebview: ((payload: object) => void) | undefined;

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

function guardConfig(): {
  onSave: boolean;
  mode: 'warn' | 'strict';
  blockCommit: boolean;
  blockCommitWithoutBoundary: boolean;
} {
  const cfg = vscode.workspace.getConfiguration('horsewhip.guard');
  const mode = cfg.get<'warn' | 'strict'>('mode', 'warn');
  return {
    onSave: cfg.get<boolean>('onSave', true),
    mode: mode === 'strict' ? 'strict' : 'warn',
    blockCommit: cfg.get<boolean>('blockCommit', true),
    blockCommitWithoutBoundary: cfg.get<boolean>('blockCommitWithoutBoundary', true),
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
  const allowlist = await getEffectiveAllowlist(workspaceRoot);
  const actual = await fetchWorkingTreeChangedFiles(workspaceRoot);
  const result = computeBoundaryGuard(allowlist, actual);
  lastResult = result;
  updateStatusBar(result);
  pushGuardStatus(result);

  const { blockCommit, blockCommitWithoutBoundary } = guardConfig();
  if (!blockCommit) {
    return { allowed: true, result };
  }
  if (!result.hasBoundary) {
    if (blockCommitWithoutBoundary) {
      return {
        allowed: false,
        result,
        reason: '未在泳道划定边界，commit 已拦截。请先点选节点再提交。',
      };
    }
    return { allowed: true, result };
  }
  if (!result.ok) {
    return {
      allowed: false,
      result,
      reason: `越界 ${result.overreach.length} 个文件，commit 已拦截。`,
    };
  }
  return { allowed: true, result };
}

/** Block commit when overreach; shows actions. Returns true if commit may continue. */
export async function assertCommitAllowed(workspaceRoot: string): Promise<boolean> {
  const verdict = await evaluateCommitGuard(workspaceRoot);
  if (verdict.allowed) return true;

  const r = verdict.result;
  const preview = r.overreach.slice(0, 6).join(', ')
    + (r.overreach.length > 6 ? ` …+${r.overreach.length - 6}` : '');
  const actions: string[] = [];
  if (r.overreach.length) {
    actions.push('还原越界文件', '插入纠正到 Chat');
  }
  actions.push('检查越界');
  const pick = await vscode.window.showErrorMessage(
    verdict.reason || 'horsewhip 守门：commit 已拦截',
    { modal: true },
    ...actions,
  );

  if (pick === '还原越界文件' && r.overreach.length) {
    await revertOverreachFiles(workspaceRoot, r);
    const again = await evaluateCommitGuard(workspaceRoot);
    if (again.allowed) {
      vscode.window.showInformationMessage('越界已清除，可以重新提交。');
      return true;
    }
    vscode.window.showWarningMessage('仍有越界或未划定边界，commit 继续拦截。');
    return false;
  }
  if (pick === '插入纠正到 Chat') await insertCorrectionPrompt(r);
  if (pick === '检查越界') await runBoundaryGuardCheck(workspaceRoot);
  return false;
}

function pushGuardStatus(payload: BoundaryGuardResult | Record<string, unknown>): void {
  const result = payload as BoundaryGuardResult;
  const prompt = result.overreach?.length
    ? buildCorrectionPrompt(result.allowed, result.overreach)
    : '';
  notifyWebview?.({
    type: 'guardStatus',
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
    statusBar.tooltip = '在泳道选节点划定边界后，可检查 AI 是否改飞';
    statusBar.backgroundColor = undefined;
    statusBar.command = 'horsewhip.checkBoundary';
    return;
  }
  if (!result.hasBoundary) {
    statusBar.text = '$(shield) 未划定边界';
    statusBar.tooltip = buildNoBoundaryHint();
    statusBar.backgroundColor = undefined;
    statusBar.command = 'horsewhip.checkBoundary';
    return;
  }
  if (result.ok) {
    statusBar.text = '$(check) 边界内';
    statusBar.tooltip = `允许：${result.allowed.map((p) => p).join(', ') || '—'}`;
    statusBar.backgroundColor = undefined;
    statusBar.command = 'horsewhip.checkBoundary';
    return;
  }
  statusBar.text = `$(warning) 越界 ${result.overreach.length}`;
  statusBar.tooltip = `额外改动：\n${result.overreach.join('\n')}\n\n点击：检查 / 纠正`;
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
): Promise<void> {
  const r = result ?? lastResult;
  if (!r?.overreach.length) {
    vscode.window.showInformationMessage('当前无越界文件可还原。');
    return;
  }
  const confirm = await vscode.window.showWarningMessage(
    `将还原以下越界路径（tracked → checkout HEAD，未跟踪 → 删除）：\n${r.overreach.join('\n')}`,
    { modal: true },
    '确认还原',
  );
  if (confirm !== '确认还原') return;
  try {
    await gitRestorePaths(workspaceRoot, r.overreach);
    vscode.window.showInformationMessage(`已还原 ${r.overreach.length} 个越界路径`);
    await runBoundaryGuardCheck(workspaceRoot, { silent: true });
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
    void getEffectiveAllowlist(workspaceRoot).then((allowlist) => {
      if (!allowlist.length) return;
      void runBoundaryGuardCheck(workspaceRoot, { silent: true, fromSave: true });
    });
  }, 600);
}

export function registerBoundaryGuard(context: vscode.ExtensionContext): void {
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
}
