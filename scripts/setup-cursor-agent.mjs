#!/usr/bin/env node
/**
 * One-shot Agent setup: build horsewhip MCP, link skills, write Cursor + Claude Code MCP configs
 *
 * Usage (from horsewhip repo):
 *   npm run setup:agent -- --project /path/to/your-git-app
 *
 * Usage (from your app repo):
 *   node /path/to/horsewhip/scripts/setup-cursor-agent.mjs --project .
 */
import { spawnSync } from 'node:child_process';
import crypto from 'node:crypto';
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
Horsewhip Agent setup (Cursor / Vibecode + Claude Code)

  node scripts/setup-cursor-agent.mjs [options]

Options:
  --project <dir>   Target git project (default: cwd)
  --repo <dir>      Horsewhip clone root (default: parent of scripts/)
  --rebuild         Force npm install + build in agent/mcp
  --copy-skill      Copy skill instead of symlink (Windows-friendly)
  --use-npx         Use "npx -y @horsewhip/mcp-server" (requires npm publish)
  --from-extension <dir>  Use MCP bundled in VS Code extension (extension/ root)
  --global-mcp      Merge into ~/.cursor/mcp.json (Cursor / Vibecode)
  --global-claude   Merge into ~/.claude.json (Claude Code user scope)
  -h, --help        This help

Writes:
  .cursor/mcp.json     — Cursor / Vibecode (${workspaceFolder})
  .mcp.json            — Claude Code (${CLAUDE_PROJECT_DIR}, alwaysLoad)
  .cursor/skills/…     — Cursor skills
  .claude/skills/…     — Claude Code skills
`);
}

function parseArgs(argv) {
  const opts = {
    project: process.cwd(),
    repo: HORSEWHIP_ROOT,
    rebuild: false,
    copySkill: false,
    useNpx: false,
    fromExtension: null,
    globalMcp: false,
    globalClaude: false,
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
    else if (a === '--from-extension') opts.fromExtension = path.resolve(argv[++i] || '');
    else if (a === '--global-mcp') opts.globalMcp = true;
    else if (a === '--global-claude') opts.globalClaude = true;
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

function linkSkillAt(skillDest, skillSrc, copySkill) {
  fs.mkdirSync(path.dirname(skillDest), { recursive: true });
  if (fs.existsSync(skillDest)) {
    const st = fs.lstatSync(skillDest);
    if (st.isSymbolicLink() || st.isDirectory()) {
      fs.rmSync(skillDest, { recursive: true, force: true });
    }
  }
  if (copySkill) {
    fs.cpSync(skillSrc, skillDest, { recursive: true });
    console.log('→ Copied skill to', skillDest);
  } else {
    const type = process.platform === 'win32' ? 'junction' : 'dir';
    try {
      fs.symlinkSync(skillSrc, skillDest, type);
      console.log('→ Linked skill to', skillDest);
    } catch (err) {
      console.warn('Symlink failed, copying skill instead:', err.message);
      fs.cpSync(skillSrc, skillDest, { recursive: true });
      console.log('→ Copied skill to', skillDest);
    }
  }
}

function linkSkills(project, skillSrc, copySkill) {
  linkSkillAt(path.join(project, '.cursor', 'skills', 'horsewhip'), skillSrc, copySkill);
  linkSkillAt(path.join(project, '.claude', 'skills', 'horsewhip'), skillSrc, copySkill);
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

function readBundledManifest(extensionRoot) {
  const manifestPath = path.join(extensionRoot, 'media', 'mcp', 'manifest.json');
  if (!fs.existsSync(manifestPath)) return null;
  try {
    return JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  } catch {
    return null;
  }
}

function mcpPinEnv(mcpEntry, { extensionRoot, repo }) {
  const env = {};
  if (extensionRoot) {
    const extPkg = JSON.parse(fs.readFileSync(path.join(extensionRoot, 'package.json'), 'utf8'));
    env.HORSEWHIP_MCP_VERSION = extPkg.version;
    const manifest = readBundledManifest(extensionRoot);
    if (manifest?.mcpDistSha256) env.HORSEWHIP_MCP_HASH = manifest.mcpDistSha256;
  } else if (mcpEntry && fs.existsSync(mcpEntry)) {
    const mcpPkg = JSON.parse(fs.readFileSync(path.join(repo, 'agent', 'mcp', 'package.json'), 'utf8'));
    env.HORSEWHIP_MCP_VERSION = mcpPkg.version;
    env.HORSEWHIP_MCP_HASH = crypto.createHash('sha256').update(fs.readFileSync(mcpEntry)).digest('hex');
  }
  return env;
}

function horsewhipServerConfig(opts, mcpEntry, { workspaceEnv, alwaysLoad = false, extensionRoot, repo }) {
  const pin = opts.useNpx ? {} : mcpPinEnv(mcpEntry, { extensionRoot, repo });
  const base = opts.useNpx
    ? {
        command: 'npx',
        args: ['-y', '@horsewhip/mcp-server'],
        env: { HORSEWHIP_WORKSPACE: workspaceEnv, ...pin },
      }
    : {
        command: 'node',
        args: [mcpEntry],
        env: { HORSEWHIP_WORKSPACE: workspaceEnv, ...pin },
      };
  if (alwaysLoad) return { ...base, alwaysLoad: true };
  return base;
}

function main() {
  const opts = parseArgs(process.argv.slice(2));
  const project = path.resolve(opts.project);
  const repo = path.resolve(opts.repo);
  const extensionRoot = opts.fromExtension ? path.resolve(opts.fromExtension) : null;

  if (!fs.existsSync(path.join(project, '.git'))) {
    console.warn('Warning: --project has no .git/ — MCP expects a git workspace.');
  }

  let mcpEntry = null;
  let skillSrc = SKILL_SRC;

  if (extensionRoot) {
    mcpEntry = path.join(extensionRoot, 'media', 'mcp', 'dist', 'index.js');
    skillSrc = path.join(extensionRoot, 'media', 'skills', 'horsewhip');
    if (!fs.existsSync(mcpEntry)) {
      console.error('Bundled MCP missing. Run: npm run build:extension');
      console.error('Expected:', mcpEntry);
      process.exit(1);
    }
    if (!fs.existsSync(skillSrc)) {
      console.error('Bundled skill missing:', skillSrc);
      process.exit(1);
    }
  } else {
    if (!fs.existsSync(path.join(repo, 'agent', 'mcp', 'package.json'))) {
      console.error('Invalid --repo (no agent/mcp):', repo);
      process.exit(1);
    }
  }

  console.log('Horsewhip Agent setup');
  if (extensionRoot) console.log('  extension:', extensionRoot);
  else console.log('  repo:   ', repo);
  console.log('  project:', project);

  if (!opts.useNpx && !extensionRoot) {
    mcpEntry = ensureMcpBuilt(repo, opts.rebuild);
  }
  linkSkills(project, skillSrc, opts.copySkill || Boolean(extensionRoot));

  const cursorServer = horsewhipServerConfig(opts, mcpEntry, {
    workspaceEnv: '${workspaceFolder}',
    extensionRoot,
    repo,
  });
  const claudeServer = horsewhipServerConfig(opts, mcpEntry, {
    workspaceEnv: '${CLAUDE_PROJECT_DIR}',
    alwaysLoad: true,
    extensionRoot,
    repo,
  });

  const home = process.env.HOME || process.env.USERPROFILE;
  if (!home && (opts.globalMcp || opts.globalClaude)) {
    console.error('Cannot resolve home directory for --global-mcp / --global-claude');
    process.exit(1);
  }

  if (opts.globalMcp) {
    writeMcpConfig(path.join(home, '.cursor', 'mcp.json'), cursorServer);
  } else {
    writeMcpConfig(path.join(project, '.cursor', 'mcp.json'), cursorServer);
  }

  if (opts.globalClaude) {
    writeMcpConfig(path.join(home, '.claude.json'), claudeServer);
  } else {
    writeMcpConfig(path.join(project, '.mcp.json'), claudeServer);
  }

  console.log(`
Done. Next steps:

  Cursor / Vibecode:
  1. Install "Horsewhip" VS Code extension
  2. MCP 设置里确认 horsewhip 已启用 → 重载窗口
  3. 打开项目: ${project}

  Claude Code:
  1. 配置在项目根 .mcp.json（不是 .claude/mcp.json）
  2. 退出并重新进入项目目录的 claude 会话
  3. 运行 /mcp — 批准 horsewhip；确认工具已连接
  4. 若工具仍不可见: claude mcp reset-project-choices
  5. 对话: "调用 horsewhip_lock_paths 锁定 README.md"

  详见 docs/claude-code.md

Plugin only (no Agent): skip MCP; use the timeline whip in the sidebar.
`);
}

main();
