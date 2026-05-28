import * as fs from 'fs';
import * as vscode from 'vscode';
import {
  getBoundaryAllowlist,
  getEffectiveBoundaryLocked,
  reloadBoundaryFromDisk,
} from './boundaryAllowlist';
import { readAllowlistRecord } from './boundaryPersist';
import { HorsewhipPanel } from './horsewhipPanel';

export type BoundaryWebviewPayload = {
  files: string[];
  locked: boolean;
  playWhip?: boolean;
  toast?: string;
  ceremony?: 'task_complete';
  ceremonyOnly?: boolean;
  panelReadOnly?: boolean;
};

const pendingByRoot = new Map<string, BoundaryWebviewPayload>();

/** Push boundary state to the timeline webview, or queue until the panel opens. */
export function postBoundaryToWebview(workspaceRoot: string, payload: BoundaryWebviewPayload): void {
  const panel = HorsewhipPanel.get();
  if (panel) {
    panel.timeline.postBoundarySync(payload);
    pendingByRoot.delete(workspaceRoot);
    return;
  }
  pendingByRoot.set(workspaceRoot, payload);
}

/** Apply queued boundary sync after Horsewhip panel / webview is ready. */
export function flushPendingBoundaryWebview(workspaceRoot: string): void {
  const pending = pendingByRoot.get(workspaceRoot);
  if (!pending) return;
  const panel = HorsewhipPanel.get();
  if (!panel) return;
  panel.timeline.postBoundarySync(pending);
  pendingByRoot.delete(workspaceRoot);
}

/** Reload MCP lock from disk and sync UI (used on panel open / webview ready). */
export async function syncMcpBoundaryFromDiskToWebview(
  workspaceRoot: string,
  options: Partial<BoundaryWebviewPayload> = {},
): Promise<void> {
  await reloadBoundaryFromDisk(workspaceRoot);
  const rec = await readAllowlistRecord(workspaceRoot);
  const locked = await getEffectiveBoundaryLocked(workspaceRoot);
  const files = getBoundaryAllowlist();
  const viaMcp = rec?.lockSource === 'mcp';

  if (!viaMcp && !locked) {
    postBoundaryToWebview(workspaceRoot, {
      files: [],
      locked: false,
      playWhip: false,
      ...options,
    });
    return;
  }

  if (!viaMcp) return;

  postBoundaryToWebview(workspaceRoot, {
    files,
    locked,
    playWhip: Boolean(options.playWhip),
    toast: options.toast,
    ceremony: options.ceremony,
    ceremonyOnly: Boolean(options.ceremonyOnly),
    panelReadOnly: locked && files.length > 0,
    ...options,
  });
}

/** Node fs.watch fallback when VS Code excludes `.git/**` from file watchers. */
export function watchHorsewhipMetaWithNodeFs(
  workspaceRoot: string,
  onAllowlist: () => void,
  onSignal: () => void,
): () => void {
  const dir = `${workspaceRoot}/.git/horsewhip`;
  const allowlist = `${dir}/allowlist.json`;
  const signal = `${dir}/mcp-signal.json`;
  const watchers: fs.FSWatcher[] = [];

  const attach = (file: string, fn: () => void) => {
    if (!fs.existsSync(file)) return;
    try {
      watchers.push(fs.watch(file, () => fn()));
    } catch {
      /* non-fatal */
    }
  };

  attach(allowlist, onAllowlist);
  attach(signal, onSignal);

  let dirWatcher: fs.FSWatcher | undefined;
  try {
    if (fs.existsSync(dir)) {
      dirWatcher = fs.watch(dir, (_event, name) => {
        if (name === 'allowlist.json') onAllowlist();
        if (name === 'mcp-signal.json') onSignal();
      });
    }
  } catch {
    /* non-fatal */
  }

  return () => {
    for (const w of watchers) w.close();
    dirWatcher?.close();
  };
}

export function onHorsewhipPanelOpened(workspaceRoot: string): void {
  flushPendingBoundaryWebview(workspaceRoot);
  void syncMcpBoundaryFromDiskToWebview(workspaceRoot);
}
