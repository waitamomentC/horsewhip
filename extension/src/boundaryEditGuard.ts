import * as path from 'path';
import * as vscode from 'vscode';
import {
  appendToBoundaryAllowlist,
  getEffectiveAllowlist,
  getEffectiveBoundaryLocked,
  isBoundaryLocked,
  isGuardActive,
  setBoundaryLocked,
} from './boundaryAllowlist';
import {
  buildEditBlockedPrompt,
  buildWriteBlockedPrompt,
  normalizeRelPath,
  pathIsUnderAllowlist,
} from './boundaryGuard';
import { clearEditBlockedMarker, writeEditBlockedMarker } from './boundaryPersist';
import { insertTextIntoChat } from './chatInsert';
import { gitRestorePaths } from './gitRunner';
import { isGuardIgnoredPath } from './boundaryGuard';

const DIAG_SOURCE = 'horsewhip';
const WARN_DEBOUNCE_MS = 8000;
const AI_NOTIFY_DEBOUNCE_MS = 12000;

let diagnostics: vscode.DiagnosticCollection | undefined;
let sessionEditBypass = false;
const perFileBypass = new Set<string>();
const lastWarnAt = new Map<string, number>();
let lastAiNotifyAt = 0;
const revertingPaths = new Set<string>();

function editGuardConfig(): {
  mode: 'off' | 'warn' | 'lock';
  offerToChat: boolean;
  revertOnWrite: boolean;
  notifyAiOnWrite: boolean;
} {
  const cfg = vscode.workspace.getConfiguration('horsewhip.guard');
  const raw = cfg.get<string>('blockEdit', 'lock');
  const mode = raw === 'off' || raw === 'warn' ? raw : 'lock';
  return {
    mode,
    offerToChat: cfg.get<boolean>('offerEditBlockToChat', true),
    revertOnWrite: cfg.get<boolean>('revertOnWrite', true),
    notifyAiOnWrite: cfg.get<boolean>('notifyAiOnWrite', true),
  };
}

function relPathFromUri(uri: vscode.Uri, workspaceRoot: string): string | undefined {
  if (uri.scheme !== 'file') return undefined;
  const folder = vscode.workspace.getWorkspaceFolder(uri);
  if (!folder || folder.uri.fsPath !== workspaceRoot) return undefined;
  return normalizeRelPath(path.relative(workspaceRoot, uri.fsPath));
}

function relPathForDoc(doc: vscode.TextDocument, workspaceRoot: string): string | undefined {
  const folder = vscode.workspace.getWorkspaceFolder(doc.uri);
  if (!folder || folder.uri.fsPath !== workspaceRoot) return undefined;
  if (doc.uri.scheme !== 'file') return undefined;
  return normalizeRelPath(path.relative(workspaceRoot, doc.uri.fsPath));
}

export function isEditBypassed(rel: string): boolean {
  if (sessionEditBypass) return true;
  return perFileBypass.has(rel);
}

export async function shouldBlockEdit(
  workspaceRoot: string,
  rel: string,
): Promise<{ block: boolean; allowed: string[]; reason?: 'no-pasture' | 'outside-pasture' }> {
  const { mode } = editGuardConfig();
  if (mode === 'off' || !isGuardActive()) return { block: false, allowed: [] };

  const locked = await getEffectiveBoundaryLocked(workspaceRoot);
  const allowed = locked ? await getEffectiveAllowlist(workspaceRoot) : [];

  if (!locked || !allowed.length) {
    return { block: false, allowed: [] };
  }

  if (isEditBypassed(rel)) return { block: false, allowed };
  const under = pathIsUnderAllowlist(rel, allowed);
  return { block: !under, allowed, reason: under ? undefined : 'outside-pasture' };
}

type EditorOptsWithReadonly = vscode.TextEditorOptions & { readOnly?: boolean };

function applyReadonlyToEditor(editor: vscode.TextEditor, readonly: boolean): void {
  const opts = editor.options as EditorOptsWithReadonly;
  if (opts.readOnly === readonly) return;
  editor.options = { ...opts, readOnly: readonly } as vscode.TextEditorOptions;
}

export async function refreshEditorsForBoundary(workspaceRoot: string): Promise<void> {
  const { mode } = editGuardConfig();
  for (const editor of vscode.window.visibleTextEditors) {
    const rel = relPathForDoc(editor.document, workspaceRoot);
    if (!rel) {
      applyReadonlyToEditor(editor, false);
      continue;
    }
    if (mode === 'off') {
      applyReadonlyToEditor(editor, false);
      diagnostics?.delete(editor.document.uri);
      continue;
    }
    const { block, reason } = await shouldBlockEdit(workspaceRoot, rel);
    const readonly = mode === 'lock' && block;
    applyReadonlyToEditor(editor, readonly);
    if (block) {
      setEditDiagnostic(editor.document.uri, rel, reason === 'no-pasture');
    } else {
      diagnostics?.delete(editor.document.uri);
    }
  }
}

function setEditDiagnostic(uri: vscode.Uri, rel: string, noPasture = false): void {
  if (!diagnostics) return;
  const msg = noPasture
    ? `尚未挥鞭圈定跑马范围，禁止修改任何文件。路径：${rel}`
    : `未在挥鞭圈定范围内，禁止修改。路径：${rel}`; // overridden in notify
  diagnostics.set(uri, [
    new vscode.Diagnostic(
      new vscode.Range(0, 0, 0, 0),
      msg,
      vscode.DiagnosticSeverity.Error,
    ),
  ]);
}

async function notifyEditBlocked(
  workspaceRoot: string,
  rel: string,
  allowed: string[],
): Promise<void> {
  const now = Date.now();
  const last = lastWarnAt.get(rel) ?? 0;
  if (now - last < WARN_DEBOUNCE_MS) return;
  lastWarnAt.set(rel, now);

  const message = buildEditBlockedPrompt(rel, allowed);
  await writeEditBlockedMarker(workspaceRoot, { file: rel, allowed, message });

  const noPasture = !allowed.length;
  const pick = await vscode.window.showWarningMessage(
    noPasture
      ? `horsewhip：尚未挥鞭圈定，禁止修改任何文件（${rel}）。`
      : `horsewhip：${rel} 不在圈定范围内，禁止修改（仅圈定路径可改）。`,
    { modal: false },
    '在泳道扩大边界',
    '本次允许此文件',
    '本会话跳过编辑锁',
    '插入说明到 Chat',
  );

  if (pick === '在泳道扩大边界') {
    void vscode.commands.executeCommand('horsewhip.showTimeline');
    return;
  }
  if (pick === '本次允许此文件') {
    perFileBypass.add(rel);
    await appendToBoundaryAllowlist([rel]);
    await refreshEditorsForBoundary(workspaceRoot);
    vscode.window.showInformationMessage(`horsewhip：已临时允许编辑 ${rel}`);
    return;
  }
  if (pick === '本会话跳过编辑锁') {
    sessionEditBypass = true;
    await refreshEditorsForBoundary(workspaceRoot);
    vscode.window.showWarningMessage(
      'horsewhip：已跳过编辑锁（本会话）。commit 守门仍生效。',
    );
    return;
  }
  if (pick === '插入说明到 Chat') {
    const { offerToChat } = editGuardConfig();
    if (offerToChat) await insertTextIntoChat(message);
  }
}

async function onActiveEditorChanged(workspaceRoot: string): Promise<void> {
  const editor = vscode.window.activeTextEditor;
  if (!editor) return;
  const rel = relPathForDoc(editor.document, workspaceRoot);
  if (!rel) return;

  await refreshEditorsForBoundary(workspaceRoot);

  const { block, allowed, reason } = await shouldBlockEdit(workspaceRoot, rel);
  if (!block) return;

  const { mode } = editGuardConfig();
  if (mode === 'warn') {
    await notifyEditBlocked(workspaceRoot, rel, allowed);
  } else if (mode === 'lock') {
    const last = lastWarnAt.get(rel) ?? 0;
    if (Date.now() - last >= WARN_DEBOUNCE_MS) {
      lastWarnAt.set(rel, Date.now());
      await writeEditBlockedMarker(workspaceRoot, {
        file: rel,
        allowed,
        message: buildEditBlockedPrompt(rel, allowed),
      });
      const noPasture = reason === 'no-pasture';
      void vscode.window
        .showWarningMessage(
          noPasture
            ? `horsewhip：尚未挥鞭圈定，${rel} 已设为只读。`
            : `horsewhip：${rel} 不在圈定范围内，已设为只读。`,
          '扩大边界',
          '允许本文件',
        )
        .then((pick) => {
          if (pick === '扩大边界') void vscode.commands.executeCommand('horsewhip.showTimeline');
          if (pick === '允许本文件') {
            perFileBypass.add(rel);
            void appendToBoundaryAllowlist([rel]).then(() =>
              refreshEditorsForBoundary(workspaceRoot),
            );
          }
        });
    }
  }
}

/**
 * 写盘守门：Agent/终端直写文件时立即还原（不等到 commit/save）。
 */
export async function enforceWriteGuard(
  uri: vscode.Uri,
  workspaceRoot: string,
): Promise<boolean> {
  const { mode, revertOnWrite, notifyAiOnWrite, offerToChat } = editGuardConfig();
  if (mode === 'off') return false;

  const rel = relPathFromUri(uri, workspaceRoot);
  if (!rel || isGuardIgnoredPath(rel)) return false;

  const { block, allowed, reason } = await shouldBlockEdit(workspaceRoot, rel);
  if (!block || !reason) return false;

  if (revertOnWrite && !revertingPaths.has(rel)) {
    revertingPaths.add(rel);
    try {
      await gitRestorePaths(workspaceRoot, [rel]);
    } catch {
      /* ignore */
    } finally {
      setTimeout(() => revertingPaths.delete(rel), 400);
    }
  }

  await refreshEditorsForBoundary(workspaceRoot);

  const prompt = buildWriteBlockedPrompt(rel, allowed, reason);
  await writeEditBlockedMarker(workspaceRoot, { file: rel, allowed, message: prompt });

  const now = Date.now();
  if (notifyAiOnWrite && offerToChat && now - lastAiNotifyAt >= AI_NOTIFY_DEBOUNCE_MS) {
    lastAiNotifyAt = now;
    void insertTextIntoChat(prompt);
  }

  const last = lastWarnAt.get(rel) ?? 0;
  if (now - last >= WARN_DEBOUNCE_MS) {
    lastWarnAt.set(rel, now);
    const noPasture = reason === 'no-pasture';
    void vscode.window.showErrorMessage(
      noPasture
        ? `horsewhip：未圈定，已还原 ${rel}。请让用户先在泳道挥鞭圈定。`
        : `horsewhip：${rel} 在圈外，已自动还原。请让用户扩大圈定或授权。`,
      '打开泳道',
    ).then((pick) => {
      if (pick === '打开泳道') void vscode.commands.executeCommand('horsewhip.showTimeline');
    });
  }

  return true;
}

function registerWorkspaceWriteWatchers(context: vscode.ExtensionContext): void {
  const attach = (folder: vscode.WorkspaceFolder) => {
    const root = folder.uri.fsPath;
    const pattern = new vscode.RelativePattern(folder, '**/*');
    const watcher = vscode.workspace.createFileSystemWatcher(pattern, false, false, false);
    const onFs = (uri: vscode.Uri) => {
      void enforceWriteGuard(uri, root);
    };
    watcher.onDidChange(onFs);
    watcher.onDidCreate(onFs);
    context.subscriptions.push(watcher);
  };

  for (const folder of vscode.workspace.workspaceFolders ?? []) {
    attach(folder);
  }

  context.subscriptions.push(
    vscode.workspace.onDidChangeWorkspaceFolders((e) => {
      e.added.forEach(attach);
    }),
  );
}

/** Call when webview arms or clears boundary lock. */
export async function onBoundaryLockChanged(
  workspaceRoot: string,
  locked: boolean,
  files: string[],
): Promise<void> {
  if (!locked || !files.length) {
    sessionEditBypass = false;
    perFileBypass.clear();
    lastWarnAt.clear();
    if (workspaceRoot) await clearEditBlockedMarker(workspaceRoot);
  }
  if (workspaceRoot) await refreshEditorsForBoundary(workspaceRoot);
}

export function registerBoundaryEditGuard(context: vscode.ExtensionContext): void {
  diagnostics = vscode.languages.createDiagnosticCollection(DIAG_SOURCE);
  context.subscriptions.push(diagnostics);

  const scheduleRefresh = (root: string | undefined) => {
    if (!root) return;
    void refreshEditorsForBoundary(root);
  };

  context.subscriptions.push(
    vscode.window.onDidChangeActiveTextEditor((editor) => {
      const root = vscode.workspace.getWorkspaceFolder(editor?.document.uri ?? vscode.Uri.file(''))
        ?.uri.fsPath;
      if (!root) return;
      void onActiveEditorChanged(root);
    }),

    vscode.workspace.onDidOpenTextDocument((doc) => {
      const root = vscode.workspace.getWorkspaceFolder(doc.uri)?.uri.fsPath;
      scheduleRefresh(root);
    }),

    vscode.workspace.onDidCloseTextDocument(() => {
      const root = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
      scheduleRefresh(root);
    }),

    vscode.workspace.onDidChangeConfiguration((e) => {
      if (e.affectsConfiguration('horsewhip.guard.blockEdit')) {
        const root = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
        scheduleRefresh(root);
      }
    }),

    vscode.commands.registerCommand('horsewhip.skipEditLockSession', () => {
      sessionEditBypass = true;
      const root = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
      if (root) void refreshEditorsForBoundary(root);
      vscode.window.showWarningMessage('horsewhip：本会话已跳过编辑锁。commit 仍受守门约束。');
    }),

    vscode.commands.registerCommand('horsewhip.clearEditLockBypass', () => {
      sessionEditBypass = false;
      perFileBypass.clear();
      const root = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
      if (root) void refreshEditorsForBoundary(root);
      vscode.window.showInformationMessage('horsewhip：已恢复编辑锁。');
    }),
  );

  const folder = vscode.workspace.workspaceFolders?.[0];
  if (folder && editGuardConfig().mode !== 'off') {
    void refreshEditorsForBoundary(folder.uri.fsPath);
  }

  registerWorkspaceWriteWatchers(context);

  context.subscriptions.push(
    vscode.workspace.onDidSaveTextDocument((doc) => {
      const root = vscode.workspace.getWorkspaceFolder(doc.uri)?.uri.fsPath;
      if (root) void enforceWriteGuard(doc.uri, root);
    }),

    vscode.workspace.onDidChangeTextDocument((e) => {
      const root = vscode.workspace.getWorkspaceFolder(e.document.uri)?.uri.fsPath;
      if (!root || e.document.uri.scheme !== 'file') return;
      if (e.contentChanges.length === 0) return;
      void enforceWriteGuard(e.document.uri, root);
    }),
  );
}
