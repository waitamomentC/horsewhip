import * as vscode from 'vscode';
import {
  getBoundaryAllowlist,
  getEffectiveBoundaryLocked,
  reloadBoundaryFromDisk,
} from './boundaryAllowlist';
import { refreshEditorsForBoundary } from './boundaryEditGuard';
import {
  notifyBoundaryArmed,
  runBoundaryGuardCheck,
  syncBoundaryLockFromWebview,
} from './boundaryGuardHost';
import { isHorsewhipPreCommitHookInstalled, installHorsewhipPreCommitHook } from './boundaryGitHook';
import { readAllowlistRecord } from './boundaryPersist';
import { HorsewhipPanel } from './horsewhipPanel';
import { gitBranchDisplay } from './gitRunner';

export type BoundaryHostSyncOptions = {
  playWhip?: boolean;
  toast?: string;
  ceremony?: 'task_complete';
  /** When true, push MCP-style lock UI to webview (not graph whip). */
  syncWebview?: boolean;
};

/** Reload allowlist from disk into extension memory; refresh editors + guard (no webview). */
export async function syncBoundaryMemoryFromDisk(workspaceRoot: string): Promise<boolean> {
  const locked = await reloadBoundaryFromDisk(workspaceRoot);
  const files = getBoundaryAllowlist();
  await syncBoundaryLockFromWebview(workspaceRoot, files, locked);
  const blockEdit = vscode.workspace.getConfiguration('horsewhip.guard').get<string>('blockEdit', 'lock');
  if (blockEdit !== 'off') {
    await refreshEditorsForBoundary(workspaceRoot);
  }
  await runBoundaryGuardCheck(workspaceRoot, { silent: true });
  return locked;
}

/** After MCP / disk allowlist change: sync memory, optional webview, editors, guard. */
export async function applyBoundaryFromExternalSource(
  context: vscode.ExtensionContext,
  workspaceRoot: string,
  options: BoundaryHostSyncOptions = {},
): Promise<void> {
  const locked = await syncBoundaryMemoryFromDisk(workspaceRoot);
  const files = getBoundaryAllowlist();
  const rec = await readAllowlistRecord(workspaceRoot);
  const viaMcp = rec?.lockSource === 'mcp';

  if (options.syncWebview !== false && viaMcp) {
    HorsewhipPanel.get()?.timeline.postBoundarySync({
      files,
      locked,
      playWhip: Boolean(options.playWhip),
      toast: options.toast,
      ceremony: options.ceremony,
      panelReadOnly: locked && files.length > 0,
    });
  }

  if (locked && files.length) {
    const hookOk = await isHorsewhipPreCommitHookInstalled(workspaceRoot);
    if (!hookOk) {
      await installHorsewhipPreCommitHook(context.extensionUri, workspaceRoot);
    }
    await notifyBoundaryArmed(workspaceRoot, files);
    void gitBranchDisplay(workspaceRoot);
  }

  if (options.toast) {
    vscode.window.showInformationMessage(options.toast);
  }
}
