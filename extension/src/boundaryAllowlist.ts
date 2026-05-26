/** Session-scoped allowlist for Phase 2/3 boundary checks. */
let allowlist: string[] = [];

export function setBoundaryAllowlist(files: string[]): void {
  allowlist = [...new Set(files.filter(Boolean))].sort((a, b) => a.localeCompare(b));
}

export function getBoundaryAllowlist(): string[] {
  return [...allowlist];
}

export function clearBoundaryAllowlist(): void {
  allowlist = [];
}
