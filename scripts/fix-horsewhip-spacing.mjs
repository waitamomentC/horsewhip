#!/usr/bin/env node
/** Add space after horsewhip when directly followed by CJK (readability after brand rename). */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SKIP_DIRS = new Set(['node_modules', '.git', 'out', 'dist', '.cursor']);
const SKIP_FILES = new Set(['fix-horsewhip-spacing.mjs', 'rename-brand.mjs']);
const EXT = new Set(['.md', '.js', '.mjs', '.ts', '.html', '.json']);
const RE = /horsewhip/g;
function padHorsewhip(match, offset, str) {
  const prev = offset > 0 ? str[offset - 1] : '';
  const nextCh = str[offset + match.length] ?? '';
  let out = 'horsewhip';
  if (/[\u4e00-\u9fff]/.test(prev)) out = ` ${out}`;
  if (/[\u4e00-\u9fff]/.test(nextCh)) out = `${out} `;
  return out;
}

function walk(dir, out = []) {
  for (const name of fs.readdirSync(dir)) {
    if (SKIP_DIRS.has(name)) continue;
    const full = path.join(dir, name);
    const st = fs.statSync(full);
    if (st.isDirectory()) walk(full, out);
    else if (EXT.has(path.extname(name)) && !SKIP_FILES.has(name)) out.push(full);
  }
  return out;
}

let n = 0;
for (const file of walk(ROOT)) {
  const raw = fs.readFileSync(file, 'utf8');
  if (!raw.includes('horsewhip')) continue;
  const next = raw.replace(RE, padHorsewhip);
  if (next !== raw) {
    fs.writeFileSync(file, next, 'utf8');
    n += 1;
  }
}
console.log(`[fix-horsewhip-spacing] ${n} files`);
