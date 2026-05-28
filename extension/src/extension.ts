import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';
import { syncHorsewhipBoundaryNotes } from './boundaryNotes';
import { setBoundaryAllowlistWorkspaceRoot, setGuardActive } from './boundaryAllowlist';
import { refreshEditorsForBoundary } from './boundaryEditGuard';
import { registerBoundaryGuard } from './boundaryGuardHost';
import { registerBoundaryMcpBridge } from './boundaryMcpBridge';
import {
  installHorsewhipPreCommitHook,
  isHorsewhipPreCommitHookInstalled,
} from './boundaryGitHook';
import { bootstrapAgentSetupChecks } from './agentSetup';
import { registerAgentSetupUi, refreshAgentSetupStatus } from './agentSetupUi';
import { HorsewhipLauncherProvider } from './horsewhipLauncher';
import { HorsewhipPanel } from './horsewhipPanel';
import { ensureWorkspaceReady } from './workspaceGate';

function gitWorkspaceRoots(): string[] {
  return (vscode.workspace.workspaceFolders ?? [])
    .map((f) => f.uri.fsPath)
    .filter((root) => fs.existsSync(path.join(root, '.git', 'HEAD')));
}

async function bootstrapGuardForWorkspace(
  context: vscode.ExtensionContext,
  workspaceRoot: string,
): Promise<void> {
  setBoundaryAllowlistWorkspaceRoot(workspaceRoot);
  await setGuardActive(true);
  await syncHorsewhipBoundaryNotes(workspaceRoot);
  const cfg = vscode.workspace.getConfiguration('horsewhip.guard');
  if (cfg.get<boolean>('installHookOnOpen', true)) {
    try {
      const ok = await isHorsewhipPreCommitHookInstalled(workspaceRoot);
      if (!ok) await installHorsewhipPreCommitHook(context.extensionUri, workspaceRoot);
    } catch {
      /* non-fatal */
    }
  }
  if (cfg.get<string>('blockEdit', 'lock') !== 'off') {
    await refreshEditorsForBoundary(workspaceRoot);
  }
}

export function activate(context: vscode.ExtensionContext): void {
  registerBoundaryGuard(context);
  registerBoundaryMcpBridge(context);
  registerAgentSetupUi(context);
  void bootstrapAgentSetupChecks(context).then(async () => {
    for (const root of gitWorkspaceRoots()) {
      const { evaluateMcpTrust } = await import('./mcpTrustGate');
      await evaluateMcpTrust(context, root);
    }
    refreshAgentSetupStatus(context);
  });

  for (const root of gitWorkspaceRoots()) {
    void bootstrapGuardForWorkspace(context, root);
  }

  context.subscriptions.push(
    vscode.workspace.onDidChangeWorkspaceFolders(() => {
      for (const root of gitWorkspaceRoots()) {
        void bootstrapGuardForWorkspace(context, root);
      }
      void bootstrapAgentSetupChecks(context);
    }),
  );

  const launcher = new HorsewhipLauncherProvider(context.extensionUri, context.globalStorageUri);

  context.subscriptions.push(
    vscode.commands.registerCommand('horsewhip.open', async () => {
      await HorsewhipPanel.open(context.extensionUri, context.globalStorageUri);
    }),

    vscode.commands.registerCommand('horsewhip.showTimeline', async () => {
      await HorsewhipPanel.open(context.extensionUri, context.globalStorageUri);
    }),

    vscode.commands.registerCommand('horsewhip.refresh', async () => {
      const panel = await openHorsewhip(context);
      const root = await ensureWorkspaceReady();
      if (!root) return;
      await panel.refresh();
    }),

    vscode.commands.registerCommand('horsewhip.loadDemo', async () => {
      const panel = await openHorsewhip(context);
      panel.loadDemo();
    }),

    vscode.commands.registerCommand('horsewhip.publishGithub', async () => {
      const panel = await openHorsewhip(context);
      const root = await ensureWorkspaceReady();
      if (!root) return;
      await panel.openRemoteWizard();
    }),

    vscode.commands.registerCommand('horsewhip.commit', async () => {
      const panel = await openHorsewhip(context);
      const root = await ensureWorkspaceReady();
      if (!root) return;
      await panel.openCommitDialog();
    }),

    vscode.workspace.onDidChangeWorkspaceFolders(async () => {
      await HorsewhipPanel.get()?.refresh();
    }),

    vscode.workspace.onDidGrantWorkspaceTrust(async () => {
      await HorsewhipPanel.get()?.refresh();
    }),
  );

  const treeView = vscode.window.createTreeView(HorsewhipLauncherProvider.viewId, {
    treeDataProvider: launcher,
    showCollapseAll: false,
  });
  launcher.bindTreeView(treeView);
  context.subscriptions.push(treeView);
}

export function deactivate(): void {
  HorsewhipPanel.get()?.dispose();
}

async function openHorsewhip(context: vscode.ExtensionContext): Promise<HorsewhipPanel> {
  return HorsewhipPanel.open(context.extensionUri, context.globalStorageUri);
}
