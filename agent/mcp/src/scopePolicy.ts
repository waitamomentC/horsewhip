/** Minimum-scope rules for agent-driven boundary lock (initial lock only). */

export const MAX_INITIAL_LOCK_PATHS = 8;

const KNOWN_ROOT_FILES = new Set([
  'Dockerfile',
  'Makefile',
  'LICENSE',
  'LICENSE.md',
  'README',
  'README.md',
  'CHANGELOG.md',
  'package.json',
  'pnpm-lock.yaml',
  'yarn.lock',
  'package-lock.json',
]);

export type ScopeValidationResult =
  | { ok: true; paths: string[] }
  | { ok: false; code: string; message: string; hints: string[]; rejected: string[] };

export function normalizeScopePath(raw: string): string {
  return String(raw || '')
    .replace(/\\/g, '/')
    .replace(/^\.\/+/, '')
    .trim();
}

export function isFolderScopePath(path: string): boolean {
  const p = normalizeScopePath(path);
  return p === '__root__' || p.endsWith('/');
}

function basename(path: string): string {
  const p = normalizeScopePath(path).replace(/\/$/, '');
  return p.split('/').filter(Boolean).pop() ?? '';
}

function folderDepth(path: string): number {
  const p = normalizeScopePath(path).replace(/\/$/, '');
  if (p === '__root__') return 0;
  return p.split('/').filter(Boolean).length;
}

/** File-like path: has extension, dotfile, or known root filename. */
export function looksLikeFilePath(path: string): boolean {
  if (isFolderScopePath(path)) return false;
  const base = basename(path);
  if (!base) return false;
  if (KNOWN_ROOT_FILES.has(base)) return true;
  if (base.startsWith('.') && base.length > 1) return true;
  return base.includes('.');
}

function rejectOne(path: string): { ok: false; reason: string; hint: string } | { ok: true } {
  const p = normalizeScopePath(path);
  if (!p) {
    return { ok: false, reason: '空路径', hint: '提供 workspace 相对路径，例如 src/auth/login.ts' };
  }
  if (p === '__root__') {
    return {
      ok: false,
      reason: '禁止初次锁定整个仓库',
      hint: '先锁定具体文件；若用户明确授权全库，先 expand_boundary 前征得同意并用 expand 扩大',
    };
  }
  if (isFolderScopePath(p)) {
    const depth = folderDepth(p);
    if (depth < 2) {
      return {
        ok: false,
        reason: `目录过宽（${p}）`,
        hint: '初次锁定禁止顶层目录（如 src/、tests/）；改为具体文件（src/foo.ts）或更深子目录（src/auth/）',
      };
    }
    return { ok: true };
  }
  if (looksLikeFilePath(p)) {
    return { ok: true };
  }
  const depth = folderDepth(p);
  if (depth === 1) {
    return {
      ok: false,
      reason: `路径过宽或含糊（${p}）`,
      hint: '禁止锁定单段目录名（如 src）；改为 src/module/file.ts 或 src/module/（至少两层目录）',
    };
  }
  return {
    ok: false,
    reason: `非具体文件（${p}）`,
    hint: '无扩展名的路径视为目录；目录锁需以 / 结尾且至少两层，例如 src/auth/',
  };
}

/** Strict rules for horsewhip_lock_paths — minimum pasture only. */
export function validateInitialLockPaths(paths: string[]): ScopeValidationResult {
  const normalized = [...new Set(paths.map(normalizeScopePath).filter(Boolean))].sort((a, b) =>
    a.localeCompare(b),
  );
  if (!normalized.length) {
    return {
      ok: false,
      code: 'empty_paths',
      message: 'lock_paths 至少需要一个路径',
      hints: ['列出任务会改动的具体文件，例如 ["src/auth/login.ts", "src/auth/login.test.ts"]'],
      rejected: [],
    };
  }
  if (normalized.length > MAX_INITIAL_LOCK_PATHS) {
    return {
      ok: false,
      code: 'too_many_paths',
      message: `初次锁定最多 ${MAX_INITIAL_LOCK_PATHS} 条路径（当前 ${normalized.length} 条）`,
      hints: [
        '只锁本任务最小文件集；确需更多路径时先锁核心文件，用户同意后再 expand_boundary',
      ],
      rejected: normalized,
    };
  }

  const rejected: string[] = [];
  const hints = new Set<string>();
  const reasons: string[] = [];

  for (const p of normalized) {
    const verdict = rejectOne(p);
    if (!verdict.ok) {
      rejected.push(p);
      reasons.push(`${p}: ${verdict.reason}`);
      hints.add(verdict.hint);
    }
  }

  if (rejected.length) {
    return {
      ok: false,
      code: 'scope_too_broad',
      message: `初次锁定必须最小范围；${rejected.length} 条路径被拒绝：${reasons.join('；')}`,
      hints: [
        ...hints,
        '分析任务后只锁会改动的具体文件；模块级改动用至少两层的子目录（src/feature/），禁止 src/、lib/ 等顶层目录',
        '需要更大范围时：向用户说明 → 用户同意 → horsewhip_expand_boundary',
      ],
      rejected,
    };
  }

  return { ok: true, paths: normalized };
}

/** expand_boundary: user already approved; only basic sanity checks. */
export function validateExpandPaths(paths: string[]): ScopeValidationResult {
  const normalized = [...new Set(paths.map(normalizeScopePath).filter(Boolean))].sort((a, b) =>
    a.localeCompare(b),
  );
  if (!normalized.length) {
    return {
      ok: false,
      code: 'empty_paths',
      message: 'expand_boundary 至少需要一个路径',
      hints: [],
      rejected: [],
    };
  }
  return { ok: true, paths: normalized };
}
