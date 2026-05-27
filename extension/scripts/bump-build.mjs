#!/usr/bin/env node
/**
 * Bump extension patch version (valid semver for VS Code / vsce).
 * 1.0.0 → 1.0.1 → 1.0.2 … (never below 1.0.0)
 * Run via: npm run bump:build (before package)
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const MIN_MAJOR = 1;
const MIN_MINOR = 0;
const MIN_PATCH = 0;

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const pkgPath = path.resolve(__dirname, '../package.json');
const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
const current = String(pkg.version || '1.0.0');

/** @returns {{ major: number, minor: number, patch: number } | null} */
function parseSemver(v) {
  const m = /^(\d+)\.(\d+)\.(\d+)(?:-[\w.-]+)?(?:\+[\w.-]+)?$/.exec(v.trim());
  if (!m) return null;
  return { major: +m[1], minor: +m[2], patch: +m[3] };
}

function belowMin(v) {
  if (v.major < MIN_MAJOR) return true;
  if (v.major > MIN_MAJOR) return false;
  if (v.minor < MIN_MINOR) return true;
  if (v.minor > MIN_MINOR) return false;
  return v.patch < MIN_PATCH;
}

function clampMin(v) {
  if (belowMin(v)) return { major: MIN_MAJOR, minor: MIN_MINOR, patch: MIN_PATCH };
  return v;
}

let parsed = parseSemver(current);

if (!parsed) {
  const legacy = /^(\d+)\.(\d+)\.(\d+)\.(\d+)$/.exec(current);
  if (legacy) {
    parsed = { major: +legacy[1], minor: +legacy[2], patch: +legacy[3] + 1 };
    console.warn(`[bump-build] "${current}" is not valid semver; normalizing`);
  }
}

if (!parsed) {
  console.warn(`[bump-build] cannot parse "${current}", using 1.0.0`);
  parsed = { major: 1, minor: 0, patch: 0 };
} else {
  parsed.patch += 1;
}

parsed = clampMin(parsed);

const next = `${parsed.major}.${parsed.minor}.${parsed.patch}`;
pkg.version = next;
fs.writeFileSync(pkgPath, `${JSON.stringify(pkg, null, 2)}\n`, 'utf8');
console.log(`[bump-build] ${current} → ${next}`);
