import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';
import {
  checkAgentSetup,
  formatAgentSetupReport,
  type AgentSetupCheck,
} from './agentSetup';

const TRUST_BLOCK_FILE = 'mcp-trust-blocked.json';
const alertedKeys = new Set<string>();

export function hasMcpIntegrityFailure(check: AgentSetupCheck): boolean {
  return check.issues.includes('stale_hash');
}

export function isMcpTrustBlocked(
  context: vscode.ExtensionContext,
  workspaceRoot: string,
): boolean {
  return hasMcpIntegrityFailure(
    checkAgentSetup(
      context.extensionUri,
      workspaceRoot,
      context.extension.packageJSON.version as string,
    ),
  );
}

function trustBlockPath(workspaceRoot: string): string {
  return path.join(workspaceRoot, '.git', 'horsewhip', TRUST_BLOCK_FILE);
}

async function writeTrustBlockRecord(workspaceRoot: string, check: AgentSetupCheck): Promise<void> {
  const file = trustBlockPath(workspaceRoot);
  await fs.promises.mkdir(path.dirname(file), { recursive: true });
  await fs.promises.writeFile(
    file,
    `${JSON.stringify(
      {
        blockedAt: new Date().toISOString(),
        reason: 'stale_hash',
        expectedHash: check.expectedHash ?? null,
        configuredHash: check.configuredHash ?? null,
        configuredEntry: check.configuredEntry ?? null,
      },
      null,
      2,
    )}\n`,
  );
}

async function clearTrustBlockRecord(workspaceRoot: string): Promise<void> {
  try {
    await fs.promises.unlink(trustBlockPath(workspaceRoot));
  } catch {
    /* absent */
  }
}

export async function clearMcpTrustBlock(workspaceRoot: string): Promise<void> {
  await clearTrustBlockRecord(workspaceRoot);
  for (const key of [...alertedKeys]) {
    if (key.startsWith(`${workspaceRoot}::`)) alertedKeys.delete(key);
  }
}

function alertKey(workspaceRoot: string, check: AgentSetupCheck): string {
  return `${workspaceRoot}::${check.expectedHash ?? 'none'}::${check.configuredHash ?? 'none'}`;
}

/** Modal alert — stale_hash is treated as tampering; never auto-fix silently. */
export async function showMcpTamperBlockedAlert(
  context: vscode.ExtensionContext,
  workspaceRoot: string,
  check: AgentSetupCheck,
  options: { force?: boolean } = {},
): Promise<void> {
  if (!hasMcpIntegrityFailure(check)) return;

  const key = alertKey(workspaceRoot, check);
  if (!options.force && alertedKeys.has(key)) return;
  alertedKeys.add(key);

  await writeTrustBlockRecord(workspaceRoot, check);

  const detail =
    'MCP 配置或内嵌二进制哈希与插件官方版本不一致。Horsewhip 已阻断来自 MCP 的边界写入与仪式信号。' +
    '请运行「配置 Agent」并重载窗口；若你未修改过 MCP，请重装 Horsewhip 插件。';

  const pick = await vscode.window.showErrorMessage(
    `Horsewhip MCP 完整性校验失败（stale_hash）\n${detail}`,
    { modal: true },
    '立即配置',
    '诊断详情',
  );

  if (pick === '立即配置') {
    await vscode.commands.executeCommand('horsewhip.setupAgent', workspaceRoot);
  } else if (pick === '诊断详情') {
    await vscode.commands.executeCommand('horsewhip.checkAgentSetup', workspaceRoot);
  }
}

export async function evaluateMcpTrust(
  context: vscode.ExtensionContext,
  workspaceRoot: string,
  options: { forceAlert?: boolean } = {},
): Promise<AgentSetupCheck> {
  const check = checkAgentSetup(
    context.extensionUri,
    workspaceRoot,
    context.extension.packageJSON.version as string,
  );

  if (check.ok) {
    await clearMcpTrustBlock(workspaceRoot);
    return check;
  }

  if (hasMcpIntegrityFailure(check)) {
    await showMcpTamperBlockedAlert(context, workspaceRoot, check, {
      force: options.forceAlert,
    });
  }

  return check;
}

/** Returns true when MCP-driven disk changes may be applied. */
export async function assertMcpTrustForBridge(
  context: vscode.ExtensionContext,
  workspaceRoot: string,
  source: 'allowlist' | 'signal',
): Promise<boolean> {
  const check = checkAgentSetup(
    context.extensionUri,
    workspaceRoot,
    context.extension.packageJSON.version as string,
  );

  if (check.ok) {
    await clearMcpTrustBlock(workspaceRoot);
    return true;
  }

  if (hasMcpIntegrityFailure(check)) {
    await showMcpTamperBlockedAlert(context, workspaceRoot, check);
    return false;
  }

  if (source === 'signal') {
    void vscode.window
      .showWarningMessage(
        'horsewhip：收到 MCP 信号，但 Agent 配置与插件不一致。已忽略该信号。请运行「配置 Agent」并重载窗口。',
        '立即配置',
      )
      .then((pick) => {
        if (pick === '立即配置') {
          void vscode.commands.executeCommand('horsewhip.setupAgent', workspaceRoot);
        }
      });
  }

  return false;
}

export function mcpTrustBlockSummary(check: AgentSetupCheck): string {
  return [
    'MCP 完整性校验失败 — 已阻断',
    formatAgentSetupReport(check),
    '',
    '修复：Horsewhip: 配置 Agent（MCP + Skill）→ 重载窗口',
  ].join('\n');
}
