import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';

type JsonRecord = Record<string, unknown>;

export type AgentSetupIssue =
  | 'not_configured'
  | 'partial_config'
  | 'missing_entry'
  | 'stale_version'
  | 'stale_path'
  | 'stale_hash'
  | 'config_mismatch'
  | 'missing_bundled';

export type AgentSetupFileCheck = {
  label: string;
  file: string;
  ok: boolean;
  issues: AgentSetupIssue[];
  configuredEntry?: string;
  configuredVersion?: string;
  configuredHash?: string;
};

export type AgentSetupCheck = {
  ok: boolean;
  issues: AgentSetupIssue[];
  files: AgentSetupFileCheck[];
  expectedEntry: string;
  expectedVersion: string;
  expectedHash?: string;
  configuredEntry?: string;
  configuredHash?: string;
  stamp?: AgentSetupStamp | null;
};

export type AgentSetupStamp = {
  extensionVersion: string;
  mcpHash?: string;
  mcpEntry: string;
  configuredAt: string;
  by: 'horsewhip-extension';
};

type BundledMcpManifest = {
  horsewhipExtensionVersion: string;
  mcpPackageVersion: string;
  mcpDistSha256?: string;
};

const DISMISSALS_KEY = 'horsewhip.agentSetupDismissals';
const EXTENSION_VERSION_KEY = 'horsewhip.extensionVersion';
const CURSOR_MCP = '.cursor/mcp.json';
const CLAUDE_MCP = '.mcp.json';
const STAMP_NAME = 'agent-setup.json';

function readJsonSafe(file: string): JsonRecord {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8')) as JsonRecord;
  } catch {
    return {};
  }
}

function normalizePath(p: string): string {
  return path.normalize(p).replace(/\\/g, '/').toLowerCase();
}

export function gitWorkspaceRoots(): string[] {
  return (vscode.workspace.workspaceFolders ?? [])
    .map((f) => f.uri.fsPath)
    .filter((root) => fs.existsSync(path.join(root, '.git', 'HEAD')));
}

function horsewhipServerFromConfig(cfg: JsonRecord): JsonRecord | null {
  const mcpServers =
    cfg.mcpServers && typeof cfg.mcpServers === 'object' ? (cfg.mcpServers as JsonRecord) : null;
  const server = mcpServers?.horsewhip;
  return server && typeof server === 'object' ? (server as JsonRecord) : null;
}

function mcpEntryFromConfig(config: JsonRecord): string | undefined {
  const args = config.args;
  if (!Array.isArray(args) || typeof args[0] !== 'string') return undefined;
  return args[0];
}

function envFromConfig(config: JsonRecord): JsonRecord {
  const env = config.env;
  return env && typeof env === 'object' ? (env as JsonRecord) : {};
}

function writeMcpConfig(targetFile: string, serverConfig: JsonRecord): void {
  const dir = path.dirname(targetFile);
  fs.mkdirSync(dir, { recursive: true });
  const existing = readJsonSafe(targetFile);
  const mcpServers =
    existing.mcpServers && typeof existing.mcpServers === 'object'
      ? (existing.mcpServers as JsonRecord)
      : {};
  mcpServers.horsewhip = serverConfig;
  fs.writeFileSync(targetFile, `${JSON.stringify({ ...existing, mcpServers }, null, 2)}\n`, 'utf8');
}

function horsewhipServerConfig(
  mcpEntry: string,
  workspaceEnv: string,
  extensionVersion: string,
  mcpHash: string | undefined,
  alwaysLoad = false,
): JsonRecord {
  const env: JsonRecord = {
    HORSEWHIP_WORKSPACE: workspaceEnv,
    HORSEWHIP_MCP_VERSION: extensionVersion,
  };
  if (mcpHash) env.HORSEWHIP_MCP_HASH = mcpHash;

  const base: JsonRecord = {
    command: 'node',
    args: [mcpEntry],
    env,
  };
  if (alwaysLoad) base.alwaysLoad = true;
  return base;
}

async function copyDirRecursive(src: string, dest: string): Promise<void> {
  await fs.promises.mkdir(dest, { recursive: true });
  const entries = await fs.promises.readdir(src, { withFileTypes: true });
  for (const ent of entries) {
    const from = path.join(src, ent.name);
    const to = path.join(dest, ent.name);
    if (ent.isDirectory()) {
      await copyDirRecursive(from, to);
    } else {
      await fs.promises.copyFile(from, to);
    }
  }
}

export function bundledMcpEntry(extensionUri: vscode.Uri): string {
  return path.join(extensionUri.fsPath, 'media', 'mcp', 'dist', 'index.js');
}

export function bundledSkillDir(extensionUri: vscode.Uri): string {
  return path.join(extensionUri.fsPath, 'media', 'skills', 'horsewhip');
}

export function bundledSlashCommandPath(extensionUri: vscode.Uri): string {
  return path.join(extensionUri.fsPath, 'media', 'commands', 'horsewhip.md');
}

async function copyAgentSlashCommand(
  extensionUri: vscode.Uri,
  workspaceRoot: string,
): Promise<boolean> {
  const src = bundledSlashCommandPath(extensionUri);
  if (!fs.existsSync(src)) return false;
  const destDir = path.join(workspaceRoot, '.cursor', 'commands');
  await fs.promises.mkdir(destDir, { recursive: true });
  await fs.promises.copyFile(src, path.join(destDir, 'horsewhip.md'));
  return true;
}

export function bundledMcpManifestPath(extensionUri: vscode.Uri): string {
  return path.join(extensionUri.fsPath, 'media', 'mcp', 'manifest.json');
}

export function agentSetupStampPath(workspaceRoot: string): string {
  return path.join(workspaceRoot, '.git', 'horsewhip', STAMP_NAME);
}

export function readBundledMcpManifest(extensionUri: vscode.Uri): BundledMcpManifest | null {
  const manifestPath = bundledMcpManifestPath(extensionUri);
  if (!fs.existsSync(manifestPath)) return null;
  try {
    return JSON.parse(fs.readFileSync(manifestPath, 'utf8')) as BundledMcpManifest;
  } catch {
    return null;
  }
}

function hashFileSync(filePath: string): string | undefined {
  try {
    return crypto.createHash('sha256').update(fs.readFileSync(filePath)).digest('hex');
  } catch {
    return undefined;
  }
}

export function readAgentSetupStamp(workspaceRoot: string): AgentSetupStamp | null {
  const stampPath = agentSetupStampPath(workspaceRoot);
  if (!fs.existsSync(stampPath)) return null;
  try {
    return JSON.parse(fs.readFileSync(stampPath, 'utf8')) as AgentSetupStamp;
  } catch {
    return null;
  }
}

async function writeAgentSetupStamp(
  workspaceRoot: string,
  extensionVersion: string,
  mcpEntry: string,
  mcpHash: string | undefined,
): Promise<void> {
  const stampPath = agentSetupStampPath(workspaceRoot);
  await fs.promises.mkdir(path.dirname(stampPath), { recursive: true });
  const stamp: AgentSetupStamp = {
    extensionVersion,
    mcpHash,
    mcpEntry,
    configuredAt: new Date().toISOString(),
    by: 'horsewhip-extension',
  };
  await fs.promises.writeFile(stampPath, `${JSON.stringify(stamp, null, 2)}\n`, 'utf8');
}

function issuesForServer(
  server: JsonRecord | null,
  expectedEntry: string,
  extensionVersion: string,
  expectedHash: string | undefined,
): AgentSetupIssue[] {
  if (!server) return ['not_configured'];

  const configuredEntry = mcpEntryFromConfig(server);
  const env = envFromConfig(server);
  const configuredVersion =
    typeof env.HORSEWHIP_MCP_VERSION === 'string' ? env.HORSEWHIP_MCP_VERSION : undefined;
  const configuredHash =
    typeof env.HORSEWHIP_MCP_HASH === 'string' ? env.HORSEWHIP_MCP_HASH : undefined;

  const issues: AgentSetupIssue[] = [];

  if (!configuredEntry) {
    issues.push('missing_entry');
  } else if (!fs.existsSync(configuredEntry)) {
    issues.push('missing_entry');
  } else if (normalizePath(configuredEntry) !== normalizePath(expectedEntry)) {
    issues.push('stale_path');
  }

  if (!configuredVersion || configuredVersion !== extensionVersion) {
    issues.push('stale_version');
  }

  if (expectedHash) {
    if (configuredHash && configuredHash !== expectedHash) {
      issues.push('stale_hash');
    } else if (!configuredHash && configuredEntry && fs.existsSync(configuredEntry)) {
      const onDiskHash = hashFileSync(configuredEntry);
      if (onDiskHash && onDiskHash !== expectedHash) {
        issues.push('stale_hash');
      }
    }
  }

  return issues;
}

function checkOneMcpFile(
  label: string,
  filePath: string,
  expectedEntry: string,
  extensionVersion: string,
  expectedHash: string | undefined,
): AgentSetupFileCheck {
  const cfg = readJsonSafe(filePath);
  const server = horsewhipServerFromConfig(cfg);
  const issues = issuesForServer(server, expectedEntry, extensionVersion, expectedHash);
  const env = server ? envFromConfig(server) : {};
  return {
    label,
    file: filePath,
    ok: issues.length === 0,
    issues,
    configuredEntry: server ? mcpEntryFromConfig(server) : undefined,
    configuredVersion:
      typeof env.HORSEWHIP_MCP_VERSION === 'string' ? env.HORSEWHIP_MCP_VERSION : undefined,
    configuredHash:
      typeof env.HORSEWHIP_MCP_HASH === 'string' ? env.HORSEWHIP_MCP_HASH : undefined,
  };
}

function mergeUniqueIssues(files: AgentSetupFileCheck[]): AgentSetupIssue[] {
  const set = new Set<AgentSetupIssue>();
  for (const f of files) {
    for (const issue of f.issues) set.add(issue);
  }
  const list = [...set];
  const allNotConfigured = files.length > 0 && files.every((f) => f.issues.includes('not_configured'));
  if (allNotConfigured) return ['not_configured'];
  const someNotConfigured = files.some((f) => f.issues.includes('not_configured'));
  if (someNotConfigured && !allNotConfigured) {
    return list.filter((i) => i !== 'not_configured').concat('partial_config');
  }
  return list;
}

function detectConfigMismatch(files: AgentSetupFileCheck[]): boolean {
  const entries = files
    .map((f) => f.configuredEntry)
    .filter((e): e is string => Boolean(e))
    .map(normalizePath);
  const versions = files.map((f) => f.configuredVersion).filter((v): v is string => Boolean(v));
  const uniqueEntries = new Set(entries);
  const uniqueVersions = new Set(versions);
  return uniqueEntries.size > 1 || uniqueVersions.size > 1;
}

export function checkAgentSetup(
  extensionUri: vscode.Uri,
  workspaceRoot: string,
  extensionVersion: string,
): AgentSetupCheck {
  const expectedEntry = bundledMcpEntry(extensionUri);
  if (!fs.existsSync(expectedEntry)) {
    return {
      ok: false,
      issues: ['missing_bundled'],
      files: [],
      expectedEntry,
      expectedVersion: extensionVersion,
    };
  }

  const manifest = readBundledMcpManifest(extensionUri);
  const expectedHash = manifest?.mcpDistSha256 ?? hashFileSync(expectedEntry);

  const files = [
    checkOneMcpFile(
      'Cursor / Vibecode',
      path.join(workspaceRoot, CURSOR_MCP),
      expectedEntry,
      extensionVersion,
      expectedHash,
    ),
    checkOneMcpFile(
      'Claude Code',
      path.join(workspaceRoot, CLAUDE_MCP),
      expectedEntry,
      extensionVersion,
      expectedHash,
    ),
  ];

  let issues = mergeUniqueIssues(files);
  if (detectConfigMismatch(files)) {
    issues = [...new Set<AgentSetupIssue>([...issues, 'config_mismatch'])];
  }

  const stamp = readAgentSetupStamp(workspaceRoot);
  if (stamp && stamp.extensionVersion !== extensionVersion && !issues.includes('stale_version')) {
    issues = [...new Set<AgentSetupIssue>([...issues, 'stale_version'])];
  }

  return {
    ok: issues.length === 0,
    issues,
    files,
    expectedEntry,
    expectedVersion: extensionVersion,
    expectedHash,
    configuredEntry: files.find((f) => f.configuredEntry)?.configuredEntry,
    configuredHash: files.find((f) => f.configuredHash)?.configuredHash,
    stamp,
  };
}

export function formatAgentSetupReport(check: AgentSetupCheck): string {
  const lines: string[] = [
    'Horsewhip Agent 配置诊断',
    '────────────────────────',
    `插件版本: ${check.expectedVersion}`,
    `内嵌 MCP: ${check.expectedEntry}`,
  ];
  if (check.expectedHash) lines.push(`MCP SHA256: ${check.expectedHash.slice(0, 16)}…`);
  lines.push('');

  if (check.stamp) {
    lines.push(
      `上次配置: ${check.stamp.configuredAt} (@ ${check.stamp.extensionVersion})`,
      '',
    );
  }

  for (const file of check.files) {
    lines.push(`[${file.label}] ${file.file}`);
    if (file.ok) {
      lines.push('  ✓ 正常');
    } else {
      lines.push(`  ✗ ${file.issues.join(', ')}`);
      if (file.configuredEntry) lines.push(`    entry: ${file.configuredEntry}`);
      if (file.configuredVersion) lines.push(`    version: ${file.configuredVersion}`);
    }
    lines.push('');
  }

  if (check.ok) {
    lines.push('结论: Agent 配置与当前插件一致。');
  } else {
    lines.push(`结论: ${issueSummary(check.issues, check.expectedVersion)}`);
    lines.push('修复: 运行「Horsewhip: 配置 Agent（MCP + Skill）」并重载窗口。');
  }
  return lines.join('\n');
}

export function issueSummary(issues: AgentSetupIssue[], extensionVersion: string): string {
  if (issues.includes('not_configured')) {
    return '尚未配置 Horsewhip Agent（MCP + Skill）。';
  }
  if (issues.includes('missing_bundled')) {
    return '扩展包内缺少 MCP，请重新安装 Horsewhip 插件。';
  }
  const parts: string[] = [];
  if (issues.includes('partial_config')) {
    parts.push('仅部分 MCP 配置文件存在（需同时有 .cursor/mcp.json 与 .mcp.json）');
  }
  if (issues.includes('config_mismatch')) {
    parts.push('Cursor 与 Claude 的 horsewhip MCP 配置不一致');
  }
  if (issues.includes('stale_version')) {
    parts.push(`MCP 配置版本与插件 ${extensionVersion} 不一致`);
  }
  if (issues.includes('stale_path')) {
    parts.push('MCP 路径未指向当前插件内嵌目录');
  }
  if (issues.includes('missing_entry')) {
    parts.push('MCP 入口文件不存在或配置无效');
  }
  if (issues.includes('stale_hash')) {
    parts.push('MCP 产物哈希与插件内嵌版本不匹配');
  }
  return `${parts.join('；')}。请重新运行「配置 Agent」并 reload 窗口。`;
}

function dismissalKey(workspaceRoot: string, issue: AgentSetupIssue): string {
  return `${workspaceRoot}::${issue}`;
}

function isIssueDismissed(
  context: vscode.ExtensionContext,
  workspaceRoot: string,
  issue: AgentSetupIssue,
  extensionVersion: string,
): boolean {
  const dismissals = context.globalState.get<Record<string, string>>(DISMISSALS_KEY) ?? {};
  return dismissals[dismissalKey(workspaceRoot, issue)] === extensionVersion;
}

async function dismissIssue(
  context: vscode.ExtensionContext,
  workspaceRoot: string,
  issue: AgentSetupIssue,
  extensionVersion: string,
): Promise<void> {
  const dismissals = {
    ...(context.globalState.get<Record<string, string>>(DISMISSALS_KEY) ?? {}),
    [dismissalKey(workspaceRoot, issue)]: extensionVersion,
  };
  await context.globalState.update(DISMISSALS_KEY, dismissals);
}

async function clearAgentSetupDismissals(context: vscode.ExtensionContext): Promise<void> {
  await context.globalState.update(DISMISSALS_KEY, undefined);
}

export async function noteExtensionVersion(context: vscode.ExtensionContext): Promise<boolean> {
  const current = context.extension.packageJSON.version as string;
  const prev = context.globalState.get<string>(EXTENSION_VERSION_KEY);
  if (prev && prev !== current) {
    await context.globalState.update(EXTENSION_VERSION_KEY, current);
    await clearAgentSetupDismissals(context);
    return true;
  }
  if (!prev) {
    await context.globalState.update(EXTENSION_VERSION_KEY, current);
  }
  return false;
}

export async function pickGitWorkspaceRoot(
  placeHolder = '选择要配置 Agent 的 Git 项目',
): Promise<string | undefined> {
  const roots = gitWorkspaceRoots();
  if (roots.length === 0) return undefined;
  if (roots.length === 1) return roots[0];
  const pick = await vscode.window.showQuickPick(
    roots.map((r) => ({ label: path.basename(r), description: r, root: r })),
    { placeHolder },
  );
  return pick?.root;
}

function skillExists(workspaceRoot: string, agent: 'cursor' | 'claude'): boolean {
  const sub = agent === 'cursor' ? '.cursor/skills/horsewhip/SKILL.md' : '.claude/skills/horsewhip/SKILL.md';
  return fs.existsSync(path.join(workspaceRoot, sub));
}

export async function setupAgentInWorkspace(
  extensionUri: vscode.Uri,
  workspaceRoot: string,
  extensionVersion: string,
  options: { confirmNonGit?: boolean } = {},
): Promise<{ ok: boolean; message: string }> {
  const mcpEntry = bundledMcpEntry(extensionUri);
  if (!fs.existsSync(mcpEntry)) {
    return {
      ok: false,
      message:
        '扩展包内未找到 MCP（请更新 Horsewhip 插件；开发者请在本仓库执行 npm run build:extension）。',
    };
  }

  const skillSrc = bundledSkillDir(extensionUri);
  if (!fs.existsSync(skillSrc)) {
    return {
      ok: false,
      message: '扩展包内未找到 Skill（请更新 Horsewhip 插件）。',
    };
  }

  if (!fs.existsSync(path.join(workspaceRoot, '.git')) && options.confirmNonGit !== false) {
    return { ok: false, message: '已取消：当前文件夹不是 Git 仓库。' };
  }

  const manifest = readBundledMcpManifest(extensionUri);
  const mcpHash = manifest?.mcpDistSha256 ?? hashFileSync(mcpEntry);

  const cursorServer = horsewhipServerConfig(
    mcpEntry,
    '${workspaceFolder}',
    extensionVersion,
    mcpHash,
  );
  const claudeServer = horsewhipServerConfig(
    mcpEntry,
    '${CLAUDE_PROJECT_DIR}',
    extensionVersion,
    mcpHash,
    true,
  );

  writeMcpConfig(path.join(workspaceRoot, CURSOR_MCP), cursorServer);
  writeMcpConfig(path.join(workspaceRoot, CLAUDE_MCP), claudeServer);

  await copyDirRecursive(skillSrc, path.join(workspaceRoot, '.cursor', 'skills', 'horsewhip'));
  await copyDirRecursive(skillSrc, path.join(workspaceRoot, '.claude', 'skills', 'horsewhip'));
  const hasSlashCommand = await copyAgentSlashCommand(extensionUri, workspaceRoot);
  await writeAgentSetupStamp(workspaceRoot, extensionVersion, mcpEntry, mcpHash);

  const skillNote =
    skillExists(workspaceRoot, 'cursor') && skillExists(workspaceRoot, 'claude')
      ? 'Skill 已复制到 .cursor/skills 与 .claude/skills。'
      : 'Skill 复制可能不完整，请检查 skills 目录。';
  const slashNote = hasSlashCommand
    ? 'Cursor 斜杠命令已写入 .cursor/commands/horsewhip.md — 对话输入 /horsewhip 强制走边界流程。'
    : '';

  return {
    ok: true,
    message: [
      '已写入 .cursor/mcp.json、.mcp.json，并记录 .git/horsewhip/agent-setup.json。',
      skillNote,
      slashNote,
      '',
      'Cursor / Vibecode：重载窗口，在 MCP 设置中确认 horsewhip 已启用；改代码前输入 /horsewhip <任务>。',
      'Claude Code：退出并重新进入项目目录的 claude 会话，运行 /mcp 批准 horsewhip；改代码前输入 /horsewhip <任务>。',
    ]
      .filter(Boolean)
      .join('\n'),
  };
}

export async function runSetupAgent(
  context: vscode.ExtensionContext,
  workspaceRoot?: string,
): Promise<boolean> {
  const root = workspaceRoot ?? (await pickGitWorkspaceRoot());
  if (!root) {
    vscode.window.showWarningMessage('请先打开 Git 项目文件夹。');
    return false;
  }

  if (!fs.existsSync(path.join(root, '.git'))) {
    const pick = await vscode.window.showWarningMessage(
      '当前文件夹不是 Git 仓库，MCP 需要 Git 工作区才能正常工作。是否仍继续写入配置？',
      '继续',
      '取消',
    );
    if (pick !== '继续') return false;
  }

  const result = await setupAgentInWorkspace(
    context.extensionUri,
    root,
    context.extension.packageJSON.version as string,
    { confirmNonGit: false },
  );

  if (result.ok) {
    await clearAgentSetupDismissals(context);
    const reload = await vscode.window.showInformationMessage(
      `Horsewhip：Agent 已配置（${path.basename(root)}）。`,
      '重载窗口',
      '知道了',
    );
    if (reload === '重载窗口') {
      await vscode.commands.executeCommand('workbench.action.reloadWindow');
    }
    return true;
  }

  vscode.window.showErrorMessage(`Horsewhip Agent 配置失败：${result.message}`);
  return false;
}

function isAutoFixable(issues: AgentSetupIssue[]): boolean {
  if (issues.includes('stale_hash')) return false;
  return (
    issues.length > 0 &&
    !issues.includes('not_configured') &&
    !issues.includes('missing_bundled') &&
    issues.every((i) =>
      ['stale_version', 'stale_path', 'partial_config', 'config_mismatch', 'missing_entry'].includes(
        i,
      ),
    )
  );
}

export async function promptAgentSetupIfNeeded(
  context: vscode.ExtensionContext,
  workspaceRoot: string,
  options?: { afterUpgrade?: boolean },
): Promise<void> {
  const cfg = vscode.workspace.getConfiguration('horsewhip.agent');
  if (!cfg.get<boolean>('validateOnOpen', true)) return;

  const extensionVersion = context.extension.packageJSON.version as string;
  const check = checkAgentSetup(context.extensionUri, workspaceRoot, extensionVersion);
  if (check.ok) return;

  if (check.issues.includes('stale_hash')) {
    const { showMcpTamperBlockedAlert } = await import('./mcpTrustGate');
    await showMcpTamperBlockedAlert(context, workspaceRoot, check, {
      force: options?.afterUpgrade,
    });
    return;
  }

  const autoFix =
    cfg.get<boolean>('autoFixOnUpgrade', true) &&
    options?.afterUpgrade &&
    isAutoFixable(check.issues);

  if (autoFix) {
    const ok = await setupAgentInWorkspace(
      context.extensionUri,
      workspaceRoot,
      extensionVersion,
      { confirmNonGit: false },
    );
    if (ok) {
      await clearAgentSetupDismissals(context);
      const reload = await vscode.window.showInformationMessage(
        `Horsewhip 已升级到 ${extensionVersion}，Agent MCP 配置已自动更新。`,
        '重载窗口',
        '稍后',
      );
      if (reload === '重载窗口') {
        await vscode.commands.executeCommand('workbench.action.reloadWindow');
      }
      return;
    }
  }

  if (
    check.issues.length > 0 &&
    check.issues.every((issue) =>
      isIssueDismissed(context, workspaceRoot, issue, extensionVersion),
    ) &&
    !options?.afterUpgrade
  ) {
    return;
  }

  const summary = issueSummary(check.issues, extensionVersion);
  const title = options?.afterUpgrade
    ? `Horsewhip 已升级到 ${extensionVersion}`
    : 'Horsewhip Agent 配置需更新';

  const pick = await vscode.window.showWarningMessage(
    `${title}：${summary}`,
    '立即配置',
    '诊断详情',
    '稍后',
  );

  if (pick === '立即配置') {
    await runSetupAgent(context, workspaceRoot);
    return;
  }

  if (pick === '诊断详情') {
    await vscode.commands.executeCommand('horsewhip.checkAgentSetup', workspaceRoot);
    return;
  }

  for (const issue of check.issues) {
    await dismissIssue(context, workspaceRoot, issue, extensionVersion);
  }
}

export async function runAgentSetupCheck(
  context: vscode.ExtensionContext,
  workspaceRoot?: string,
): Promise<AgentSetupCheck | null> {
  const root = workspaceRoot ?? (await pickGitWorkspaceRoot('选择要诊断 Agent 配置的项目'));
  if (!root) {
    vscode.window.showWarningMessage('请先打开 Git 项目文件夹。');
    return null;
  }
  return checkAgentSetup(
    context.extensionUri,
    root,
    context.extension.packageJSON.version as string,
  );
}

export async function bootstrapAgentSetupChecks(context: vscode.ExtensionContext): Promise<void> {
  const upgraded = await noteExtensionVersion(context);
  for (const root of gitWorkspaceRoots()) {
    await promptAgentSetupIfNeeded(context, root, { afterUpgrade: upgraded });
  }
}
