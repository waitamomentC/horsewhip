#!/usr/bin/env node
/**
 * Bump extension patch version (valid semver for VS Code / vsce).
 * 0.9.0 → 0.9.1 → 0.9.2 …
 * Run via: npm run bump:build (before package)
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const pkgPath = path.resolve(__dirname, '../package.json');
const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
const current = String(pkg.version || '0.9.0');

/** @returns {{ major: number, minor: number, patch: number } | null} */
function parseSemver(v) {
  const m = /^(\d+)\.(\d+)\.(\d+)(?:-[\w.-]+)?(?:\+[\w.-]+)?$/.exec(v.trim());
  if (!m) return null;
  return { major: +m[1], minor: +m[2], patch: +m[3] };
}

let parsed = parseSemver(current);

// Legacy invalid four-part versions (e.g. 0.9.0.1 from an earlier script)
if (!parsed) {
  const legacy = /^(\d+)\.(\d+)\.(\d+)\.(\d+)$/.exec(current);
  if (legacy) {
    parsed = { major: +legacy[1], minor: +legacy[2], patch: +legacy[3] + 1 };
    console.warn(`[bump-build] "${current}" is not valid semver; normalizing to ${parsed.major}.${parsed.minor}.${parsed.patch}`);
  }
}

if (!parsed) {
  console.warn(`[bump-build] cannot parse "${current}", using 0.9.1`);
  parsed = { major: 0, minor: 9, patch: 1 };
} else {
  parsed.patch += 1;
}

const next = `${parsed.major}.${parsed.minor}.${parsed.patch}`;
pkg.version = next;
fs.writeFileSync(pkgPath, `${JSON.stringify(pkg, null, 2)}\n`, 'utf8');
console.log(`[bump-build] ${current} → ${next}`);
