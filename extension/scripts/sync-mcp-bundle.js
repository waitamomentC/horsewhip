#!/usr/bin/env node
/**
 * Bundle agent/mcp + skill into extension/media for VSIX and one-click Agent setup.
 */
const { spawnSync } = require('node:child_process');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

const extRoot = path.resolve(__dirname, '..');
const repoRoot = path.resolve(extRoot, '..');
const mcpSrc = path.join(repoRoot, 'agent', 'mcp');
const mcpDest = path.join(extRoot, 'media', 'mcp');
const skillSrc = path.join(repoRoot, 'agent', 'skills', 'horsewhip');
const skillDest = path.join(extRoot, 'media', 'skills', 'horsewhip');

function run(cmd, args, cwd) {
  const r = spawnSync(cmd, args, { cwd, stdio: 'inherit', shell: process.platform === 'win32' });
  if (r.status !== 0) {
    process.exit(r.status ?? 1);
  }
}

if (!fs.existsSync(path.join(mcpSrc, 'package.json'))) {
  console.error('sync-mcp-bundle: missing agent/mcp — run from horsewhip repo');
  process.exit(1);
}

console.log('→ Building agent/mcp …');
run('npm', ['install'], mcpSrc);
run('npm', ['run', 'build'], mcpSrc);

const distSrc = path.join(mcpSrc, 'dist', 'index.js');
if (!fs.existsSync(distSrc)) {
  console.error('sync-mcp-bundle: MCP build failed — missing', distSrc);
  process.exit(1);
}

fs.rmSync(mcpDest, { recursive: true, force: true });
fs.mkdirSync(path.join(mcpDest, 'dist'), { recursive: true });
fs.cpSync(path.join(mcpSrc, 'dist'), path.join(mcpDest, 'dist'), { recursive: true });
fs.copyFileSync(path.join(mcpSrc, 'package.json'), path.join(mcpDest, 'package.json'));

console.log('→ Installing MCP production deps into extension/media/mcp …');
run('npm', ['install', '--omit=dev', '--no-package-lock'], mcpDest);

const extPkg = JSON.parse(fs.readFileSync(path.join(extRoot, 'package.json'), 'utf8'));
const mcpPkg = JSON.parse(fs.readFileSync(path.join(mcpSrc, 'package.json'), 'utf8'));
const mcpDistSha256 = crypto
  .createHash('sha256')
  .update(fs.readFileSync(distSrc))
  .digest('hex');
fs.writeFileSync(
  path.join(mcpDest, 'manifest.json'),
  `${JSON.stringify(
    {
      horsewhipExtensionVersion: extPkg.version,
      mcpPackageVersion: mcpPkg.version,
      mcpDistSha256,
      bundledAt: new Date().toISOString(),
    },
    null,
    2,
  )}\n`,
);

fs.rmSync(skillDest, { recursive: true, force: true });
fs.cpSync(skillSrc, skillDest, { recursive: true });

console.log('synced agent/mcp → extension/media/mcp');
console.log('synced agent/skills/horsewhip → extension/media/skills/horsewhip');
