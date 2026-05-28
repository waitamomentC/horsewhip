/** Session-scoped allowlist for Phase 2/3 boundary checks. */
import {
  persistAllowlistToDisk,
  readAllowlistFromDisk,
  readAllowlistRecord,
  type PersistedLockTarget,
} from './boundaryPersist';

export type { PersistedLockTarget as LockTarget };

let allowlist: string[] = [];
let lockTargets: PersistedLockTarget[] = [];
let boundaryLocked = false;
let guardActive = true;
let workspaceRootForPersist: string | undefined;

export function setBoundaryAllowlistWorkspaceRoot(root: string | undefined): void {
  workspaceRootForPersist = root;
  if (!root) {
    allowlist = [];
    lockTargets = [];
    boundaryLocked = false;
    return;
  }
  void readAllowlistRecord(root).then((rec) => {
    if (workspaceRootForPersist !== root) return;
    guardActive = rec?.guardActive !== false;
    if (rec?.locked && rec.allowed?.length) {
      allowlist = [...new Set(rec.allowed.filter(Boolean))].sort((a, b) => a.localeCompare(b));
      lockTargets = Array.isArray(rec.targets) ? rec.targets : [];
      boundaryLocked = true;
      return;
    }
    boundaryLocked = false;
    allowlist = [];
    lockTargets = [];
  });
}

/** Reload in-memory boundary from `.git/horsewhip/allowlist.json` (e.g. MCP wrote disk). */
export async function reloadBoundaryFromDisk(workspaceRoot: string): Promise<boolean> {
  const rec = await readAllowlistRecord(workspaceRoot);
  if (workspaceRootForPersist && workspaceRootForPersist !== workspaceRoot) {
    workspaceRootForPersist = workspaceRoot;
  }
  if (!rec) {
    allowlist = [];
    lockTargets = [];
    boundaryLocked = false;
    return false;
  }
  allowlist = [...new Set(rec.allowed.filter(Boolean))].sort((a, b) => a.localeCompare(b));
  lockTargets = Array.isArray(rec.targets) ? rec.targets : [];
  boundaryLocked = Boolean(rec.locked) && allowlist.length > 0;
  guardActive = rec.guardActive !== false;
  return boundaryLocked;
}

export async function setBoundaryAllowlist(
  files: string[],
  locked?: boolean,
  targets: PersistedLockTarget[] = [],
  currentBranch = '',
): Promise<void> {
  allowlist = [...new Set(files.filter(Boolean))].sort((a, b) => a.localeCompare(b));
  lockTargets = targets.filter((t) => t && (t.files?.length || allowlist.length));
  if (locked !== undefined) {
    boundaryLocked = locked && allowlist.length > 0;
  } else if (!allowlist.length) {
    boundaryLocked = false;
    lockTargets = [];
  }
  if (workspaceRootForPersist) {
    await persistAllowlistToDisk(
      workspaceRootForPersist,
      allowlist,
      boundaryLocked,
      lockTargets,
      currentBranch,
      guardActive,
    );
  }
}

export function setBoundaryLocked(locked: boolean): void {
  boundaryLocked = locked && allowlist.length > 0;
  if (!boundaryLocked) lockTargets = [];
  if (workspaceRootForPersist) {
    void persistAllowlistToDisk(
      workspaceRootForPersist,
      allowlist,
      boundaryLocked,
      lockTargets,
      '',
      guardActive,
    );
  }
}

export function isGuardActive(): boolean {
  return guardActive;
}

export async function setGuardActive(active: boolean): Promise<void> {
  guardActive = Boolean(active);
  if (workspaceRootForPersist) {
    await persistAllowlistToDisk(
      workspaceRootForPersist,
      allowlist,
      boundaryLocked,
      lockTargets,
      '',
      guardActive,
    );
  }
}

export function isBoundaryLocked(): boolean {
  return boundaryLocked && allowlist.length > 0;
}

export function getBoundaryAllowlist(): string[] {
  return [...allowlist];
}

export function getLockTargets(): PersistedLockTarget[] {
  return [...lockTargets];
}

/** In-memory selection, or last persisted .git/horsewhip/allowlist.json (for hooks / reload). */
export async function getEffectiveAllowlist(workspaceRoot?: string): Promise<string[]> {
  if (allowlist.length) return [...allowlist];
  if (workspaceRoot) return readAllowlistFromDisk(workspaceRoot);
  return [];
}

export async function getEffectiveLockTargets(workspaceRoot?: string): Promise<PersistedLockTarget[]> {
  if (lockTargets.length) return [...lockTargets];
  if (!workspaceRoot) return [];
  const rec = await readAllowlistRecord(workspaceRoot);
  return Array.isArray(rec?.targets) ? rec!.targets! : [];
}

/** Session memory first; fall back to disk when hooks run before webview reload. */
export async function getEffectiveBoundaryLocked(workspaceRoot?: string): Promise<boolean> {
  if (isBoundaryLocked()) return true;
  if (!workspaceRoot) return false;
  const rec = await readAllowlistRecord(workspaceRoot);
  return Boolean(rec?.locked) && (rec?.allowed?.length ?? 0) > 0;
}

export async function appendToBoundaryAllowlist(paths: string[]): Promise<void> {
  const merged = [...allowlist, ...paths.filter(Boolean)];
  await setBoundaryAllowlist(merged, isBoundaryLocked(), lockTargets);
}

export async function clearBoundaryAllowlist(): Promise<void> {
  allowlist = [];
  lockTargets = [];
  boundaryLocked = false;
  if (workspaceRootForPersist) {
    await persistAllowlistToDisk(workspaceRootForPersist, [], false, [], '', guardActive);
  }
}
