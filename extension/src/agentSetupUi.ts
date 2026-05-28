import * as path from 'path';
import * as vscode from 'vscode';
import {
  checkAgentSetup,
  formatAgentSetupReport,
  gitWorkspaceRoots,
  runAgentSetupCheck,
  runSetupAgent,
  type AgentSetupCheck,
} from './agentSetup';
import {
  evaluateMcpTrust,
  hasMcpIntegrityFailure,
  mcpTrustBlockSummary,
  clearMcpTrustBlock,
} from './mcpTrustGate';

const OUTPUT_CHANNEL = 'Horsewhip Agent';

let statusBar: vscode.StatusBarItem | undefined;
let outputChannel: vscode.OutputChannel | undefined;
let lastCheck: AgentSetupCheck | null = null;
let lastRoot: string | undefined;
const watchedMcpRoots = new Set<string>();

function channel(): vscode.OutputChannel {
  if (!outputChannel) {
    outputChannel = vscode.window.createOutputChannel(OUTPUT_CHANNEL);
  }
  return outputChannel;
}

function statusLabel(check: AgentSetupCheck): { text: string; tooltip: string; color?: vscode.ThemeColor } {
  if (check.issues.includes('stale_hash')) {
    return {
      text: '$(lock) MCP 已阻断',
      tooltip: mcpTrustBlockSummary(check),
      color: new vscode.ThemeColor('statusBarItem.errorBackground'),
    };
  }
  if (check.issues.includes('missing_bundled')) {
    return {
      text: '$(error) Agent MCP 缺失',
      tooltip: '扩展包内无 MCP，请重装 Horsewhip 插件',
      color: new vscode.ThemeColor('statusBarItem.errorBackground'),
    };
  }
  if (check.issues.includes('not_configured')) {
    return {
      text: '$(plug) 未配置 Agent',
      tooltip: '点击配置 MCP + Skill（完整版 Agent 纪律）',
      color: new vscode.ThemeColor('statusBarItem.warningBackground'),
    };
  }
  if (!check.ok) {
    return {
      text: '$(warning) Agent 需更新',
      tooltip: formatAgentSetupReport(check),
      color: new vscode.ThemeColor('statusBarItem.warningBackground'),
    };
  }
  return {
    text: '$(check) Agent 就绪',
    tooltip: `MCP 与插件 ${check.expectedVersion} 一致\n${check.expectedEntry}`,
  };
}

export function refreshAgentSetupStatus(
  context: vscode.ExtensionContext,
  workspaceRoot?: string,
): void {
  if (!statusBar) return;
  const root = workspaceRoot ?? gitWorkspaceRoots()[0];
  if (!root) {
    statusBar.hide();
    return;
  }

  const check = checkAgentSetup(
    context.extensionUri,
    root,
    context.extension.packageJSON.version as string,
  );
  lastCheck = check;
  lastRoot = root;

  const { text, tooltip, color } = statusLabel(check);
  statusBar.text = text;
  statusBar.tooltip = tooltip;
  statusBar.backgroundColor = color;
  statusBar.command = check.issues.includes('stale_hash')
    ? 'horsewhip.checkAgentSetup'
    : check.ok
      ? 'horsewhip.checkAgentSetup'
      : 'horsewhip.setupAgent';
  statusBar.show();
}

function watchMcpConfigs(context: vscode.ExtensionContext, workspaceRoot: string): void {
  if (watchedMcpRoots.has(workspaceRoot)) return;
  watchedMcpRoots.add(workspaceRoot);

  const patterns = ['.cursor/mcp.json', '.mcp.json', '.git/horsewhip/agent-setup.json'];
  for (const rel of patterns) {
    const watcher = vscode.workspace.createFileSystemWatcher(
      new vscode.RelativePattern(vscode.Uri.file(workspaceRoot), rel),
    );
    const refresh = () => {
      void evaluateMcpTrust(context, workspaceRoot).then(() => {
        refreshAgentSetupStatus(context, workspaceRoot);
      });
    };
    watcher.onDidChange(refresh);
    watcher.onDidCreate(refresh);
    watcher.onDidDelete(refresh);
    context.subscriptions.push(watcher);
  }
}

export function registerAgentSetupUi(context: vscode.ExtensionContext): void {
  statusBar = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 49);
  context.subscriptions.push(statusBar);

  context.subscriptions.push(
    vscode.commands.registerCommand('horsewhip.setupAgent', async (workspaceRoot?: string) => {
      const ok = await runSetupAgent(context, workspaceRoot);
      if (ok) {
        const root = workspaceRoot ?? lastRoot ?? gitWorkspaceRoots()[0];
        if (root) await clearMcpTrustBlock(root);
        refreshAgentSetupStatus(context, root);
      }
    }),

    vscode.commands.registerCommand('horsewhip.checkAgentSetup', async (workspaceRoot?: string) => {
      const check = await runAgentSetupCheck(context, workspaceRoot);
      if (!check) return;
      const report = formatAgentSetupReport(check);
      channel().appendLine(report);
      channel().appendLine('');
      channel().show(true);
      refreshAgentSetupStatus(context, workspaceRoot ?? lastRoot);

      if (check.ok) {
        vscode.window.showInformationMessage('Horsewhip Agent 配置正常。详情见输出面板。');
      } else if (hasMcpIntegrityFailure(check)) {
        channel().appendLine(mcpTrustBlockSummary(check));
        await vscode.window.showErrorMessage(
          'Horsewhip MCP 完整性校验失败 — 已阻断 MCP 连接。详见输出面板。',
          { modal: true },
          '立即配置',
        ).then((pick) => {
          if (pick === '立即配置') {
            void vscode.commands.executeCommand('horsewhip.setupAgent', workspaceRoot ?? lastRoot);
          }
        });
      } else {
        const fix = await vscode.window.showWarningMessage(
          'Horsewhip Agent 配置需更新。详见输出面板「Horsewhip Agent」。',
          '立即配置',
          '关闭',
        );
        if (fix === '立即配置') {
          await vscode.commands.executeCommand('horsewhip.setupAgent', workspaceRoot ?? lastRoot);
        }
      }
    }),
  );

  const attach = (root: string) => {
    watchMcpConfigs(context, root);
    refreshAgentSetupStatus(context, root);
  };

  for (const root of gitWorkspaceRoots()) attach(root);

  context.subscriptions.push(
    vscode.workspace.onDidChangeWorkspaceFolders(() => {
      for (const root of gitWorkspaceRoots()) attach(root);
      refreshAgentSetupStatus(context);
    }),
  );

  context.subscriptions.push(
    vscode.workspace.onDidChangeConfiguration((e) => {
      if (e.affectsConfiguration('horsewhip.agent')) {
        refreshAgentSetupStatus(context);
      }
    }),
  );

  refreshAgentSetupStatus(context);
}

export function getLastAgentSetupCheck(): AgentSetupCheck | null {
  return lastCheck;
}

/** Non-UI helper for tests / bridge warnings */
export function isAgentSetupHealthy(
  context: vscode.ExtensionContext,
  workspaceRoot: string,
): boolean {
  const check = checkAgentSetup(
    context.extensionUri,
    workspaceRoot,
    context.extension.packageJSON.version as string,
  );
  return check.ok && !hasMcpIntegrityFailure(check);
}
