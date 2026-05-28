import * as fs from 'node:fs/promises';
import * as path from 'node:path';

const GIT_META_DIR = path.join('.git', 'horsewhip');
const ALLOWLIST_NAME = 'allowlist.json';
const MCP_SIGNAL_NAME = 'mcp-signal.json';

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
  locked?: boolean;
  targets?: PersistedLockTarget[];
  currentBranch?: string;
  guardActive?: boolean;
  lockSource?: 'mcp' | 'webview';
};

export type McpSignalType = 'lock' | 'unlock' | 'expand' | 'task_complete' | 'whip_ceremony';

export type McpSignalRecord = {
  version: 1;
  at: string;
  type: McpSignalType;
  playWhip?: boolean;
  summary?: string;
  phase?: 'lock' | 'expand';
  addedPaths?: string[];
  previousAllowed?: string[];
};

export function allowlistFilePath(workspaceRoot: string): string {
  return path.join(workspaceRoot, GIT_META_DIR, ALLOWLIST_NAME);
}

export function mcpSignalFilePath(workspaceRoot: string): string {
  return path.join(workspaceRoot, GIT_META_DIR, MCP_SIGNAL_NAME);
}

export function editBlockedFilePath(workspaceRoot: string): string {
  return path.join(workspaceRoot, GIT_META_DIR, 'edit-blocked.json');
}

export async function readAllowlistRecord(workspaceRoot: string): Promise<PersistedAllowlist | null> {
  try {
    const raw = await fs.readFile(allowlistFilePath(workspaceRoot), 'utf8');
    const data = JSON.parse(raw) as PersistedAllowlist;
    if (!Array.isArray(data.allowed)) return null;
    return data;
  } catch {
    return null;
  }
}

export async function persistAllowlist(
  workspaceRoot: string,
  allowed: string[],
  locked: boolean,
  guardActive = true,
): Promise<PersistedAllowlist> {
  const file = allowlistFilePath(workspaceRoot);
  await fs.mkdir(path.dirname(file), { recursive: true });
  const sortedAllowed = [...new Set(allowed.filter(Boolean))].sort((a, b) => a.localeCompare(b));
  const isLocked = locked && sortedAllowed.length > 0;
  const payload: PersistedAllowlist = {
    version: 2,
    updatedAt: new Date().toISOString(),
    allowed: sortedAllowed,
    locked: isLocked ? true : undefined,
    guardActive: guardActive ? true : undefined,
    lockSource: isLocked ? 'mcp' : undefined,
  };
  await fs.writeFile(file, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
  return payload;
}

export async function writeMcpSignal(
  workspaceRoot: string,
  payload: Omit<McpSignalRecord, 'version' | 'at'>,
): Promise<void> {
  const file = mcpSignalFilePath(workspaceRoot);
  await fs.mkdir(path.dirname(file), { recursive: true });
  const body: McpSignalRecord = {
    version: 1,
    at: new Date().toISOString(),
    ...payload,
  };
  await fs.writeFile(file, `${JSON.stringify(body, null, 2)}\n`, 'utf8');
}

export async function readEditBlocked(workspaceRoot: string): Promise<Record<string, unknown> | null> {
  try {
    const raw = await fs.readFile(editBlockedFilePath(workspaceRoot), 'utf8');
    return JSON.parse(raw) as Record<string, unknown>;
  } catch {
    return null;
  }
}
