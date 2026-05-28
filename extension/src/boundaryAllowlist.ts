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
    // 不以磁盘为准自动「上锁」——必须本次会话在泳道点选节点（避免 UI 未圈定却放行）
    boundaryLocked = false;
    guardActive = true;
    allowlist = [];
    lockTargets = [];
    if (rec?.locked || rec?.guardActive) {
      void persistAllowlistToDisk(root, [], false, [], '', true);
    }
  });
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

/** 仅以本次 webview 挥鞭为准；不读磁盘 locked（防残留误放行）。 */
export async function getEffectiveBoundaryLocked(_workspaceRoot?: string): Promise<boolean> {
  return isBoundaryLocked();
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
