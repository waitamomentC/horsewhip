#!/usr/bin/env node
/**
 * Git pre-commit guard — blocks commit when working-tree changes exceed
 * .git/horsewhip/allowlist.json (written by Horsewhip when you select nodes).
 * Keep path rules in sync with extension/src/boundaryGuard.ts
 */
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.argv[2] || process.cwd();
const ROOT_BUCKET = '__root__';

function normalizeRelPath(raw) {
  return String(raw || '').replace(/\\/g, '/').replace(/^\.\/+/, '').trim();
}

function isGuardIgnoredPath(file) {
  const f = normalizeRelPath(file);
  return f.startsWith('.horsewhip/') || f.startsWith('.git/');
}

function isFolderAllowPath(p) {
  return p === ROOT_BUCKET || p.endsWith('/');
}

function pathIsUnderAllowlist(file, allowlist) {
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

function readAllowlist() {
  const file = path.join(ROOT, '.git', 'horsewhip', 'allowlist.json');
  try {
    const data = JSON.parse(fs.readFileSync(file, 'utf8'));
    return Array.isArray(data.allowed) ? data.allowed : [];
  } catch {
    return [];
  }
}

function gitLines(args) {
  try {
    return execFileSync('git', args, { cwd: ROOT, encoding: 'utf8' }).trim();
  } catch {
    return '';
  }
}

function changedFiles() {
  const files = new Set();
  const diff = gitLines(['diff', 'HEAD', '--name-only', '--diff-filter=ACDMRTUXB']);
  diff.split('\n').map((l) => l.trim()).filter(Boolean).forEach((f) => files.add(f));
  const untracked = gitLines(['ls-files', '--others', '--exclude-standard']);
  untracked.split('\n').map((l) => l.trim()).filter(Boolean).forEach((f) => files.add(f));
  if (!files.size) {
    const status = gitLines(['status', '--porcelain']);
    for (const line of status.split('\n')) {
      if (!line || line.length < 4) continue;
      let p = line.slice(3).trim().replace(/^"|"$/g, '');
      if (p.includes(' -> ')) p = p.split(' -> ').pop().trim();
      if (p) files.add(p);
    }
  }
  return [...files].filter((f) => !isGuardIgnoredPath(f)).sort();
}

function commitBlockedPath() {
  return path.join(ROOT, '.git', 'horsewhip', 'commit-blocked.json');
}

function clearCommitBlockedMarker() {
  try {
    fs.unlinkSync(commitBlockedPath());
  } catch {
    /* absent */
  }
}

function writeCommitBlockedMarker(allowed, overreach) {
  const dir = path.dirname(commitBlockedPath());
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(
    commitBlockedPath(),
    `${JSON.stringify(
      {
        version: 1,
        at: new Date().toISOString(),
        source: 'pre-commit',
        allowed,
        overreach,
      },
      null,
      2,
    )}\n`,
    'utf8',
  );
}

function main() {
  const allowed = readAllowlist();
  if (!allowed.length) {
    clearCommitBlockedMarker();
    process.exit(0);
  }
  const actual = changedFiles();
  const overreach = actual.filter((f) => !pathIsUnderAllowlist(f, allowed));
  if (!overreach.length) {
    clearCommitBlockedMarker();
    process.exit(0);
  }
  writeCommitBlockedMarker(allowed, overreach);
  const allowText = allowed.join(', ');
  const overText = overreach.join(', ');
  console.error('');
  console.error('【horsewhip · commit 已拦截】');
  console.error(`允许修改：${allowText}`);
  console.error(`越界改动：${overText}`);
  console.error('');
  console.error('越界文件仍留在工作区 — 请先 git checkout HEAD -- <越界路径> 复原，再在边界内重想方案。');
  console.error('horsewhip：检查越界 → 还原越界文件 / 插入纠正到 Chat；勿保留越界改动后误提交。');
  console.error('临时跳过：git commit --no-verify（不推荐，需用户明确同意）');
  console.error('');
  process.exit(1);
}

main();
