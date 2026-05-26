/** Session-scoped allowlist for Phase 2/3 boundary checks. */
import { persistAllowlistToDisk, readAllowlistFromDisk } from './boundaryPersist';

let allowlist: string[] = [];
let workspaceRootForPersist: string | undefined;

export function setBoundaryAllowlistWorkspaceRoot(root: string | undefined): void {
  workspaceRootForPersist = root;
  if (!root) {
    allowlist = [];
    return;
  }
  void readAllowlistFromDisk(root).then((disk) => {
    if (workspaceRootForPersist === root && !allowlist.length && disk.length) {
      allowlist = disk;
    }
  });
}

export async function setBoundaryAllowlist(files: string[]): Promise<void> {
  allowlist = [...new Set(files.filter(Boolean))].sort((a, b) => a.localeCompare(b));
  if (workspaceRootForPersist) {
    await persistAllowlistToDisk(workspaceRootForPersist, allowlist);
  }
}

export function getBoundaryAllowlist(): string[] {
  return [...allowlist];
}

/** In-memory selection, or last persisted .git/horsewhip/allowlist.json (for hooks / reload). */
export async function getEffectiveAllowlist(workspaceRoot?: string): Promise<string[]> {
  if (allowlist.length) return [...allowlist];
  if (workspaceRoot) return readAllowlistFromDisk(workspaceRoot);
  return [];
}

export async function clearBoundaryAllowlist(): Promise<void> {
  allowlist = [];
  if (workspaceRootForPersist) {
    await persistAllowlistToDisk(workspaceRootForPersist, []);
  }
}
