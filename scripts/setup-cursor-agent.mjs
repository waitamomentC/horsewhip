#!/usr/bin/env node
/**
 * One-shot Cursor Agent setup: build horsewhip MCP, link skill, write .cursor/mcp.json
 *
 * Usage (from horsewhip repo):
 *   npm run setup:agent -- --project /path/to/your-git-app
 *
 * Usage (from your app repo):
 *   node /path/to/horsewhip/scripts/setup-cursor-agent.mjs --project .
 */
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const HORSEWHIP_ROOT = path.resolve(__dirname, '..');
const MCP_DIR = path.join(HORSEWHIP_ROOT, 'agent', 'mcp');
const MCP_ENTRY = path.join(MCP_DIR, 'dist', 'index.js');
const SKILL_SRC = path.join(HORSEWHIP_ROOT, 'agent', 'skills', 'horsewhip');

function usage() {
  console.log(`
Horsewhip Cursor Agent setup

  node scripts/setup-cursor-agent.mjs [options]

Options:
  --project <dir>   Target git project (default: cwd)
  --repo <dir>      Horsewhip clone root (default: parent of scripts/)
  --rebuild         Force npm install + build in agent/mcp
  --copy-skill      Copy skill instead of symlink (Windows-friendly)
  --use-npx         Use "npx -y @horsewhip/mcp-server" (requires npm publish)
  --global-mcp      Merge into ~/.cursor/mcp.json instead of project .cursor/
  -h, --help        This help
`);
}

function parseArgs(argv) {
  const opts = {
    project: process.cwd(),
    repo: HORSEWHIP_ROOT,
    rebuild: false,
    copySkill: false,
    useNpx: false,
    globalMcp: false,
  };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '-h' || a === '--help') {
      usage();
      process.exit(0);
    }
    if (a === '--rebuild') opts.rebuild = true;
    else if (a === '--copy-skill') opts.copySkill = true;
    else if (a === '--use-npx') opts.useNpx = true;
    else if (a === '--global-mcp') opts.globalMcp = true;
    else if (a === '--project') opts.project = path.resolve(argv[++i] || '');
    else if (a === '--repo') opts.repo = path.resolve(argv[++i] || '');
    else {
      console.error(`Unknown option: ${a}`);
      usage();
      process.exit(1);
    }
  }
  return opts;
}

function run(cmd, args, cwd) {
  const r = spawnSync(cmd, args, { cwd, stdio: 'inherit', shell: process.platform === 'win32' });
  if (r.status !== 0) {
    process.exit(r.status ?? 1);
  }
}

function ensureMcpBuilt(repo, rebuild) {
  const mcpDir = path.join(repo, 'agent', 'mcp');
  const entry = path.join(mcpDir, 'dist', 'index.js');
  if (!rebuild && fs.existsSync(entry)) return entry;
  console.log('→ Building agent/mcp …');
  run('npm', ['install'], mcpDir);
  run('npm', ['run', 'build'], mcpDir);
  if (!fs.existsSync(entry)) {
    console.error('MCP build failed: missing', entry);
    process.exit(1);
  }
  return entry;
}

function linkSkill(project, copySkill) {
  const skillDest = path.join(project, '.cursor', 'skills', 'horsewhip');
  fs.mkdirSync(path.dirname(skillDest), { recursive: true });
  if (fs.existsSync(skillDest)) {
    const st = fs.lstatSync(skillDest);
    if (st.isSymbolicLink() || st.isDirectory()) {
      fs.rmSync(skillDest, { recursive: true, force: true });
    }
  }
  if (copySkill) {
    fs.cpSync(SKILL_SRC, skillDest, { recursive: true });
    console.log('→ Copied skill to', skillDest);
  } else {
    const type = process.platform === 'win32' ? 'junction' : 'dir';
    try {
      fs.symlinkSync(SKILL_SRC, skillDest, type);
      console.log('→ Linked skill to', skillDest);
    } catch (err) {
      console.warn('Symlink failed, copying skill instead:', err.message);
      fs.cpSync(SKILL_SRC, skillDest, { recursive: true });
      console.log('→ Copied skill to', skillDest);
    }
  }
}

function readJsonSafe(file) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    return {};
  }
}

function writeMcpConfig(targetFile, serverConfig) {
  const dir = path.dirname(targetFile);
  fs.mkdirSync(dir, { recursive: true });
  const existing = readJsonSafe(targetFile);
  const mcpServers = existing.mcpServers && typeof existing.mcpServers === 'object'
    ? existing.mcpServers
    : {};
  mcpServers.horsewhip = serverConfig;
  const out = { ...existing, mcpServers };
  fs.writeFileSync(targetFile, `${JSON.stringify(out, null, 2)}\n`, 'utf8');
  console.log('→ Wrote', targetFile);
}

function horsewhipServerConfig(opts, mcpEntry) {
  if (opts.useNpx) {
    return {
      command: 'npx',
      args: ['-y', '@horsewhip/mcp-server'],
      env: { HORSEWHIP_WORKSPACE: '${workspaceFolder}' },
    };
  }
  return {
    command: 'node',
    args: [mcpEntry],
    env: { HORSEWHIP_WORKSPACE: '${workspaceFolder}' },
  };
}

function main() {
  const opts = parseArgs(process.argv.slice(2));
  const project = path.resolve(opts.project);
  const repo = path.resolve(opts.repo);

  if (!fs.existsSync(path.join(project, '.git'))) {
    console.warn('Warning: --project has no .git/ — MCP expects a git workspace.');
  }
  if (!fs.existsSync(path.join(repo, 'agent', 'mcp', 'package.json'))) {
    console.error('Invalid --repo (no agent/mcp):', repo);
    process.exit(1);
  }

  console.log('Horsewhip Agent setup');
  console.log('  repo:   ', repo);
  console.log('  project:', project);

  const mcpEntry = opts.useNpx
    ? null
    : ensureMcpBuilt(repo, opts.rebuild);
  linkSkill(project, opts.copySkill);

  const server = horsewhipServerConfig(opts, mcpEntry);
  if (opts.globalMcp) {
    const home = process.env.HOME || process.env.USERPROFILE;
    if (!home) {
      console.error('Cannot resolve home directory for --global-mcp');
      process.exit(1);
    }
    writeMcpConfig(path.join(home, '.cursor', 'mcp.json'), server);
  } else {
    writeMcpConfig(path.join(project, '.cursor', 'mcp.json'), server);
  }

  console.log(`
Done. Next steps:
  1. Install "Horsewhip" extension (VS Code / Cursor marketplace)
  2. Cursor: Settings → MCP — confirm "horsewhip" is enabled
  3. Reload Window
  4. Open this folder in Cursor: ${project}
  5. In Chat: "Use horsewhip: lock paths before editing."

Plugin only (no Agent): skip MCP; use the timeline whip in the sidebar.
`);
}

main();
