import * as fs from 'fs';
import * as path from 'path';

const GIT_META_DIR = path.join('.git', 'horsewhip');
const ALLOWLIST_NAME = 'allowlist.json';
const COMMIT_BLOCKED_NAME = 'commit-blocked.json';

export type PersistedAllowlist = {
  version: 1;
  updatedAt: string;
  allowed: string[];
};

export function allowlistFilePath(workspaceRoot: string): string {
  return path.join(workspaceRoot, GIT_META_DIR, ALLOWLIST_NAME);
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
): Promise<void> {
  const file = allowlistFilePath(workspaceRoot);
  const dir = path.dirname(file);
  await fs.promises.mkdir(dir, { recursive: true });
  const payload: PersistedAllowlist = {
    version: 1,
    updatedAt: new Date().toISOString(),
    allowed: [...new Set(allowed.filter(Boolean))].sort((a, b) => a.localeCompare(b)),
  };
  await fs.promises.writeFile(file, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
}

export async function readAllowlistFromDisk(workspaceRoot: string): Promise<string[]> {
  try {
    const raw = await fs.promises.readFile(allowlistFilePath(workspaceRoot), 'utf8');
    const data = JSON.parse(raw) as PersistedAllowlist;
    return Array.isArray(data.allowed) ? data.allowed : [];
  } catch {
    return [];
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
