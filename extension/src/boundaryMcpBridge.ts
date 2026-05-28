import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';
import { applyBoundaryFromExternalSource, syncBoundaryMemoryFromDisk } from './boundaryHostSync';
import { getBoundaryAllowlist, getEffectiveBoundaryLocked, reloadBoundaryFromDisk } from './boundaryAllowlist';
import {
  flushPendingBoundaryWebview,
  postBoundaryToWebview,
  syncMcpBoundaryFromDiskToWebview,
  watchHorsewhipMetaWithNodeFs,
} from './boundaryWebviewSync';
import { playWhipSoundFromHost } from './whipSoundHost';
import { recordGuardExpand } from './guardStats';
import {
  allowlistFilePath,
  clearMcpSignal,
  mcpSignalFilePath,
  readAllowlistRecord,
  readMcpSignal,
  type McpSignalRecord,
} from './boundaryPersist';
import { assertMcpTrustForBridge } from './mcpTrustGate';

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
      ? `horsewhip：任务收束 — ${signal.summary}`
      : 'horsewhip：本任务已在边界内收束';
  }
  if (signal.type === 'whip_ceremony') {
    return signal.phase === 'expand' ? 'horsewhip：边界已扩大' : 'horsewhip：边界已圈定';
  }
  if (signal.type === 'lock') return 'horsewhip：MCP 已锁定跑马范围';
  if (signal.type === 'unlock') return 'horsewhip：MCP 已解除圈定';
  if (signal.type === 'expand') return 'horsewhip：MCP 已扩大跑马范围';
  return undefined;
}

async function handleAllowlistChange(
  context: vscode.ExtensionContext,
  workspaceRoot: string,
): Promise<void> {
  const rec = await readAllowlistRecord(workspaceRoot);
  if (rec?.lockSource === 'mcp') {
    const trusted = await assertMcpTrustForBridge(context, workspaceRoot, 'allowlist');
    if (!trusted) return;
  }
  await syncBoundaryMemoryFromDisk(workspaceRoot);
  if (rec?.lockSource === 'mcp') {
    await syncMcpBoundaryFromDiskToWebview(workspaceRoot);
  }
}

async function handleMcpSignal(
  context: vscode.ExtensionContext,
  workspaceRoot: string,
): Promise<void> {
  const signal = await readMcpSignal(workspaceRoot);
  if (!signal) return;

  const trusted = await assertMcpTrustForBridge(context, workspaceRoot, 'signal');
  if (!trusted) {
    await clearMcpSignal(workspaceRoot);
    return;
  }

  const playWhip = signal.playWhip !== false;
  const toast = ceremonyToast(signal);

  if (signal.type === 'whip_ceremony' || signal.type === 'task_complete') {
    await reloadBoundaryFromDisk(workspaceRoot);
    const files = getBoundaryAllowlist();
    const locked = await getEffectiveBoundaryLocked(workspaceRoot);
    if (playWhip) {
      playWhipSoundFromHost(context.extensionUri);
    }
    postBoundaryToWebview(workspaceRoot, {
      files,
      locked,
      playWhip: false,
      toast,
      ceremony: signal.type === 'task_complete' ? 'task_complete' : undefined,
      ceremonyOnly: true,
    });
    if (toast) vscode.window.showInformationMessage(toast);
    await clearMcpSignal(workspaceRoot);
    return;
  }

  const allowedBefore = [...getBoundaryAllowlist()];
  const recBefore = await readAllowlistRecord(workspaceRoot);
  const beforeDisk = signal.previousAllowed ?? recBefore?.allowed ?? allowedBefore;

  await applyBoundaryFromExternalSource(context, workspaceRoot, {
    playWhip,
    toast,
    syncWebview: true,
  });

  if (signal.type === 'expand') {
    const after = [...getBoundaryAllowlist()];
    const added =
      signal.addedPaths?.length
        ? [...signal.addedPaths]
        : after.filter((p) => !new Set(beforeDisk).has(p));
    if (added.length) {
      void recordGuardExpand(workspaceRoot, {
        addedPaths: added,
        allowedBefore: beforeDisk,
        allowedAfter: after,
        source: 'mcp',
      });
    }
  }

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
      void handleAllowlistChange(context, workspaceRoot);
    });
  });
  allowlistWatcher.onDidCreate(() => {
    scheduleDebounced(debounceKey(workspaceRoot, 'allowlist'), () => {
      void handleAllowlistChange(context, workspaceRoot);
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

  const disposeNodeWatch = watchHorsewhipMetaWithNodeFs(
    workspaceRoot,
    () => {
      scheduleDebounced(debounceKey(workspaceRoot, 'allowlist-fs'), () => {
        void handleAllowlistChange(context, workspaceRoot);
      });
    },
    () => {
      scheduleDebounced(debounceKey(workspaceRoot, 'signal-fs'), () => {
        void handleMcpSignal(context, workspaceRoot);
      });
    },
  );
  context.subscriptions.push({ dispose: disposeNodeWatch });
}

async function bootstrapMcpBridgeState(
  context: vscode.ExtensionContext,
  workspaceRoot: string,
): Promise<void> {
  await handleAllowlistChange(context, workspaceRoot);
  await handleMcpSignal(context, workspaceRoot);
  flushPendingBoundaryWebview(workspaceRoot);
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
    void bootstrapMcpBridgeState(context, root);
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
