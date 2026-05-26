#!/usr/bin/env node
/** Replace 小马鞭 / 马鞭 with horsewhip in text sources. */
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..');
const SKIP_DIRS = new Set([
  'node_modules',
  '.git',
  'out',
  'dist',
  '.cursor',
]);
const SKIP_FILES = new Set(['script.js.monolith.bak', 'rename-brand.mjs']);
const EXT = new Set(['.md', '.js', '.mjs', '.ts', '.html', '.json']);

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

function transform(text) {
  return text.replaceAll('小马鞭', 'horsewhip').replaceAll('马鞭', 'horsewhip');
}

let changed = 0;
for (const file of walk(ROOT)) {
  const raw = fs.readFileSync(file, 'utf8');
  if (!raw.includes('马鞭') && !raw.includes('小马鞭')) continue;
  const next = transform(raw);
  if (next !== raw) {
    fs.writeFileSync(file, next, 'utf8');
    changed += 1;
    console.log(path.relative(ROOT, file));
  }
}
console.log(`[rename-brand] updated ${changed} files`);
