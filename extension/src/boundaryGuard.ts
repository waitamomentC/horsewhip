/** Phase 3 — compare git working-tree changes against session allowlist. */

export const ROOT_BUCKET = '__root__';

export type BoundaryGuardResult = {
  hasBoundary: boolean;
  allowed: string[];
  actual: string[];
  overreach: string[];
  ok: boolean;
};

export function normalizeRelPath(raw: string): string {
  return String(raw || '').replace(/\\/g, '/').replace(/^\.\/+/, '').trim();
}

/** Paths managed by Horsewhip itself — never count as user overreach. */
export function isGuardIgnoredPath(file: string): boolean {
  const f = normalizeRelPath(file);
  return f.startsWith('.horsewhip/') || f.startsWith('.git/');
}

export function isFolderAllowPath(path: string): boolean {
  return path === ROOT_BUCKET || path.endsWith('/');
}

export function formatAllowLabel(path: string): string {
  if (path === ROOT_BUCKET) return '仓库根目录/';
  return path;
}

/** Whether a changed file is covered by one allowlist entry (file or folder prefix). */
export function pathIsUnderAllowlist(file: string, allowlist: string[]): boolean {
  const f = normalizeRelPath(file);
  if (!f) return false;
  for (const raw of allowlist) {
    const a = normalizeRelPath(raw);
    if (!a) continue;
    if (isFolderAllowPath(a)) {
      if (a === ROOT_BUCKET) {
        if (!f.includes('/')) return true;
        continue;
      }
      const prefix = a.endsWith('/') ? a : `${a}/`;
      if (f === prefix.slice(0, -1) || f.startsWith(prefix)) return true;
      continue;
    }
    if (f === a) return true;
  }
  return false;
}

export function computeBoundaryGuard(allowlist: string[], actual: string[]): BoundaryGuardResult {
  const allowed = [...new Set(allowlist.map(normalizeRelPath).filter(Boolean))].sort((a, b) =>
    a.localeCompare(b),
  );
  const changed = [...new Set(actual.map(normalizeRelPath).filter(Boolean))]
    .filter((f) => !isGuardIgnoredPath(f))
    .sort((a, b) => a.localeCompare(b));
  const hasBoundary = allowed.length > 0;
  const overreach = hasBoundary
    ? changed.filter((f) => !pathIsUnderAllowlist(f, allowed))
    : [];
  return {
    hasBoundary,
    allowed,
    actual: changed,
    overreach,
    ok: !hasBoundary || overreach.length === 0,
  };
}

export function buildCorrectionPrompt(allowed: string[], overreach: string[]): string {
  const allowText = allowed.map(formatAllowLabel).join(', ');
  const overText = overreach.join(', ');
  const revertHint = overreach.length === 1
    ? `请立即 revert ${overText} 的变更`
    : `请立即 revert ${overText} 的变更`;
  return `【horsewhip · 越界纠正】
用户明确要求只修改：${allowText}
检测到额外改动：${overText}
${revertHint}，仅保留允许范围内的修改。

若这些额外文件确属必要，请先停下并向用户说明理由，待确认后再继续。`;
}

export function buildNoBoundaryHint(): string {
  return '请先在 horsewhip 泳道点选节点并复制边界，再运行「检查越界」。';
}
