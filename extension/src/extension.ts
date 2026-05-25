import * as vscode from 'vscode';
import { HorsewhipLauncherProvider } from './horsewhipLauncher';
import { HorsewhipPanel } from './horsewhipPanel';
import { ensureWorkspaceReady } from './workspaceGate';

export function activate(context: vscode.ExtensionContext): void {
  const launcher = new HorsewhipLauncherProvider(context.extensionUri);

  context.subscriptions.push(
    vscode.commands.registerCommand('horsewhip.open', async () => {
      await HorsewhipPanel.open(context.extensionUri);
    }),

    vscode.commands.registerCommand('horsewhip.showTimeline', async () => {
      await HorsewhipPanel.open(context.extensionUri);
    }),

    vscode.commands.registerCommand('horsewhip.refresh', async () => {
      const panel = await openHorsewhip(context.extensionUri);
      const root = await ensureWorkspaceReady();
      if (!root) return;
      await panel.refresh();
      await panel.loadFromGit();
    }),

    vscode.commands.registerCommand('horsewhip.loadDemo', async () => {
      const panel = await openHorsewhip(context.extensionUri);
      panel.loadDemo();
    }),

    vscode.commands.registerCommand('horsewhip.publishGithub', async () => {
      const panel = await openHorsewhip(context.extensionUri);
      const root = await ensureWorkspaceReady();
      if (!root) return;
      await panel.openRemoteWizard();
    }),

    vscode.commands.registerCommand('horsewhip.commit', async () => {
      const panel = await openHorsewhip(context.extensionUri);
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

async function openHorsewhip(extensionUri: vscode.Uri): Promise<HorsewhipPanel> {
  return HorsewhipPanel.open(extensionUri);
}
