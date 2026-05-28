import * as fs from 'fs';
import * as path from 'path';

const GIT_META_DIR = path.join('.git', 'horsewhip');
const ALLOWLIST_NAME = 'allowlist.json';
const MCP_SIGNAL_NAME = 'mcp-signal.json';
const COMMIT_BLOCKED_NAME = 'commit-blocked.json';

export type PersistedLockTarget = {
  nodeId: string;
  commit: string;
  branch: string;
  lanePath?: string;
  files: string[];
};

export type PersistedAllowlist = {
  version: 1 | 2;
  updatedAt: string;
  allowed: string[];
  /** true after whip-lock; false/absent = preview-only selection */
  locked?: boolean;
  /** commit + branch aim (v2) */
  targets?: PersistedLockTarget[];
  /** git branch --show-current when lock was armed */
  currentBranch?: string;
  /** 用户点击「激活」后守门才生效（默认不激活） */
  guardActive?: boolean;
  /** `mcp` = Agent MCP wrote this lock; absent = graph whip / webview */
  lockSource?: 'mcp' | 'webview';
};

export function allowlistFilePath(workspaceRoot: string): string {
  return path.join(workspaceRoot, GIT_META_DIR, ALLOWLIST_NAME);
}

export function mcpSignalFilePath(workspaceRoot: string): string {
  return path.join(workspaceRoot, GIT_META_DIR, MCP_SIGNAL_NAME);
}

export type McpSignalType = 'lock' | 'unlock' | 'expand' | 'task_complete' | 'whip_ceremony';

export type McpSignalRecord = {
  version: 1;
  at: string;
  type: McpSignalType;
  playWhip?: boolean;
  summary?: string;
  phase?: 'lock' | 'expand';
};

export async function writeMcpSignal(
  workspaceRoot: string,
  payload: Omit<McpSignalRecord, 'version' | 'at'>,
): Promise<void> {
  const file = mcpSignalFilePath(workspaceRoot);
  await fs.promises.mkdir(path.dirname(file), { recursive: true });
  const body: McpSignalRecord = {
    version: 1,
    at: new Date().toISOString(),
    ...payload,
  };
  await fs.promises.writeFile(file, `${JSON.stringify(body, null, 2)}\n`, 'utf8');
}

export async function readMcpSignal(workspaceRoot: string): Promise<McpSignalRecord | null> {
  try {
    const raw = await fs.promises.readFile(mcpSignalFilePath(workspaceRoot), 'utf8');
    const data = JSON.parse(raw) as McpSignalRecord;
    if (data.version !== 1 || !data.type) return null;
    return data;
  } catch {
    return null;
  }
}

export async function clearMcpSignal(workspaceRoot: string): Promise<void> {
  try {
    await fs.promises.unlink(mcpSignalFilePath(workspaceRoot));
  } catch {
    /* absent */
  }
}

export function hooksDirPath(workspaceRoot: string): string {
  return path.join(workspaceRoot, '.horsewhip', 'hooks');
}

export function preCommitGuardScriptPath(workspaceRoot: string): string {
  return path.join(hooksDirPath(workspaceRoot), 'pre-commit-guard.mjs');
}

export async function persistAllowlistToDisk(
  workspaceRoot: string,
  allowed: string[],
  locked = false,
  targets: PersistedLockTarget[] = [],
  currentBranch = '',
  guardActive = false,
  lockSource?: 'mcp' | 'webview',
): Promise<void> {
  const file = allowlistFilePath(workspaceRoot);
  const dir = path.dirname(file);
  await fs.promises.mkdir(dir, { recursive: true });
  const sortedAllowed = [...new Set(allowed.filter(Boolean))].sort((a, b) => a.localeCompare(b));
  const isLocked = locked && sortedAllowed.length > 0;
  const payload: PersistedAllowlist = {
    version: 2,
    updatedAt: new Date().toISOString(),
    allowed: sortedAllowed,
    locked: isLocked ? true : undefined,
    targets: isLocked && targets.length ? targets : undefined,
    currentBranch: isLocked && currentBranch ? currentBranch : undefined,
    guardActive: guardActive ? true : undefined,
    lockSource: isLocked && lockSource ? lockSource : undefined,
  };
  await fs.promises.writeFile(file, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
}

export async function readAllowlistFromDisk(workspaceRoot: string): Promise<string[]> {
  const rec = await readAllowlistRecord(workspaceRoot);
  return rec?.allowed ?? [];
}

export async function readAllowlistRecord(
  workspaceRoot: string,
): Promise<PersistedAllowlist | null> {
  try {
    const raw = await fs.promises.readFile(allowlistFilePath(workspaceRoot), 'utf8');
    const data = JSON.parse(raw) as PersistedAllowlist;
    if (!Array.isArray(data.allowed)) return null;
    return data;
  } catch {
    return null;
  }
}

const EDIT_BLOCKED_NAME = 'edit-blocked.json';

export type EditBlockedRecord = {
  version: 1;
  at: string;
  file: string;
  allowed: string[];
  message: string;
};

export function editBlockedFilePath(workspaceRoot: string): string {
  return path.join(workspaceRoot, GIT_META_DIR, EDIT_BLOCKED_NAME);
}

export async function writeEditBlockedMarker(
  workspaceRoot: string,
  payload: Omit<EditBlockedRecord, 'version' | 'at'> & { at?: string },
): Promise<void> {
  const file = editBlockedFilePath(workspaceRoot);
  await fs.promises.mkdir(path.dirname(file), { recursive: true });
  const body: EditBlockedRecord = {
    version: 1,
    at: payload.at ?? new Date().toISOString(),
    file: payload.file,
    allowed: payload.allowed,
    message: payload.message,
  };
  await fs.promises.writeFile(file, `${JSON.stringify(body, null, 2)}\n`, 'utf8');
}

export async function clearEditBlockedMarker(workspaceRoot: string): Promise<void> {
  try {
    await fs.promises.unlink(editBlockedFilePath(workspaceRoot));
  } catch {
    /* absent */
  }
}

export type CommitBlockedRecord = {
  version: 1;
  at: string;
  source: 'pre-commit' | 'panel';
  allowed: string[];
  overreach: string[];
};

export function commitBlockedFilePath(workspaceRoot: string): string {
  return path.join(workspaceRoot, GIT_META_DIR, COMMIT_BLOCKED_NAME);
}

export async function writeCommitBlockedMarker(
  workspaceRoot: string,
  payload: Omit<CommitBlockedRecord, 'version' | 'at'> & { at?: string },
): Promise<void> {
  const file = commitBlockedFilePath(workspaceRoot);
  await fs.promises.mkdir(path.dirname(file), { recursive: true });
  const body: CommitBlockedRecord = {
    version: 1,
    at: payload.at ?? new Date().toISOString(),
    source: payload.source,
    allowed: payload.allowed,
    overreach: payload.overreach,
  };
  await fs.promises.writeFile(file, `${JSON.stringify(body, null, 2)}\n`, 'utf8');
}

export async function readCommitBlockedMarker(
  workspaceRoot: string,
): Promise<CommitBlockedRecord | null> {
  try {
    const raw = await fs.promises.readFile(commitBlockedFilePath(workspaceRoot), 'utf8');
    const data = JSON.parse(raw) as CommitBlockedRecord;
    if (data.version !== 1 || !Array.isArray(data.overreach)) return null;
    return data;
  } catch {
    return null;
  }
}

export async function clearCommitBlockedMarker(workspaceRoot: string): Promise<void> {
  try {
    await fs.promises.unlink(commitBlockedFilePath(workspaceRoot));
  } catch {
    /* absent */
  }
}
