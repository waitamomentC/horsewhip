import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';
import { applyBoundaryFromExternalSource, syncBoundaryMemoryFromDisk } from './boundaryHostSync';
import { getBoundaryAllowlist, getEffectiveBoundaryLocked, reloadBoundaryFromDisk } from './boundaryAllowlist';
import { HorsewhipPanel } from './horsewhipPanel';
import {
  allowlistFilePath,
  clearMcpSignal,
  mcpSignalFilePath,
  readMcpSignal,
  type McpSignalRecord,
} from './boundaryPersist';

function gitWorkspaceRoots(): string[] {
  return (vscode.workspace.workspaceFolders ?? [])
    .map((f) => f.uri.fsPath)
    .filter((root) => fs.existsSync(path.join(root, '.git', 'HEAD')));
}

function debounceKey(root: string, kind: string): string {
  return `${root}:${kind}`;
}

const debounceTimers = new Map<string, ReturnType<typeof setTimeout>>();

function scheduleDebounced(key: string, fn: () => void, ms = 120): void {
  const prev = debounceTimers.get(key);
  if (prev) clearTimeout(prev);
  debounceTimers.set(
    key,
    setTimeout(() => {
      debounceTimers.delete(key);
      fn();
    }, ms),
  );
}

function ceremonyToast(signal: McpSignalRecord): string | undefined {
  if (signal.type === 'task_complete') {
    return signal.summary
      ? `Horsewhip：任务收束 — ${signal.summary}`
      : 'Horsewhip：本任务已在边界内收束';
  }
  if (signal.type === 'whip_ceremony') {
    return signal.phase === 'expand' ? 'Horsewhip：边界已扩大' : 'Horsewhip：边界已圈定';
  }
  if (signal.type === 'lock') return 'Horsewhip：MCP 已锁定跑马范围';
  if (signal.type === 'unlock') return 'Horsewhip：MCP 已解除圈定';
  if (signal.type === 'expand') return 'Horsewhip：MCP 已扩大跑马范围';
  return undefined;
}

async function handleAllowlistChange(workspaceRoot: string): Promise<void> {
  await syncBoundaryMemoryFromDisk(workspaceRoot);
}

async function handleMcpSignal(
  context: vscode.ExtensionContext,
  workspaceRoot: string,
): Promise<void> {
  const signal = await readMcpSignal(workspaceRoot);
  if (!signal) return;

  const playWhip = signal.playWhip !== false;
  const toast = ceremonyToast(signal);

  if (signal.type === 'whip_ceremony' || signal.type === 'task_complete') {
    await reloadBoundaryFromDisk(workspaceRoot);
    const files = getBoundaryAllowlist();
    const locked = await getEffectiveBoundaryLocked(workspaceRoot);
    HorsewhipPanel.get()?.timeline.postBoundarySync({
      files,
      locked,
      playWhip,
      toast,
      ceremony: signal.type === 'task_complete' ? 'task_complete' : undefined,
      ceremonyOnly: true,
    });
    if (toast) vscode.window.showInformationMessage(toast);
    await clearMcpSignal(workspaceRoot);
    return;
  }

  await applyBoundaryFromExternalSource(context, workspaceRoot, {
    playWhip,
    toast,
    syncWebview: true,
  });
  await clearMcpSignal(workspaceRoot);
}

function watchHorsewhipMeta(
  context: vscode.ExtensionContext,
  workspaceRoot: string,
): void {
  const allowlistPattern = new vscode.RelativePattern(
    vscode.Uri.file(workspaceRoot),
    '.git/horsewhip/allowlist.json',
  );
  const signalPattern = new vscode.RelativePattern(
    vscode.Uri.file(workspaceRoot),
    '.git/horsewhip/mcp-signal.json',
  );

  const allowlistWatcher = vscode.workspace.createFileSystemWatcher(allowlistPattern);
  allowlistWatcher.onDidChange(() => {
    scheduleDebounced(debounceKey(workspaceRoot, 'allowlist'), () => {
      void handleAllowlistChange(workspaceRoot);
    });
  });
  allowlistWatcher.onDidCreate(() => {
    scheduleDebounced(debounceKey(workspaceRoot, 'allowlist'), () => {
      void handleAllowlistChange(workspaceRoot);
    });
  });

  const signalWatcher = vscode.workspace.createFileSystemWatcher(signalPattern);
  const onSignal = () => {
    scheduleDebounced(debounceKey(workspaceRoot, 'signal'), () => {
      void handleMcpSignal(context, workspaceRoot);
    });
  };
  signalWatcher.onDidChange(onSignal);
  signalWatcher.onDidCreate(onSignal);

  context.subscriptions.push(allowlistWatcher, signalWatcher);
}

const watchedRoots = new Set<string>();

/** Watch `.git/horsewhip/` for MCP-driven allowlist + ceremony signals. */
export function registerBoundaryMcpBridge(context: vscode.ExtensionContext): void {
  const attach = (root: string) => {
    if (watchedRoots.has(root)) return;
    watchedRoots.add(root);
    void allowlistFilePath(root);
    void mcpSignalFilePath(root);
    watchHorsewhipMeta(context, root);
  };

  for (const root of gitWorkspaceRoots()) {
    attach(root);
  }

  context.subscriptions.push(
    vscode.workspace.onDidChangeWorkspaceFolders(() => {
      for (const root of gitWorkspaceRoots()) {
        attach(root);
      }
    }),
  );
}
