import * as vscode from 'vscode';
import { registerBoundaryGuard } from './boundaryGuardHost';
import { HorsewhipLauncherProvider } from './horsewhipLauncher';
import { HorsewhipPanel } from './horsewhipPanel';
import { ensureWorkspaceReady } from './workspaceGate';

export function activate(context: vscode.ExtensionContext): void {
  registerBoundaryGuard(context);
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
