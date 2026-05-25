import * as vscode from 'vscode';
import { HorsewhipSidebarProvider } from './horsewhipSidebar';
import { ensureWorkspaceReady } from './workspaceGate';

let sidebarProvider: HorsewhipSidebarProvider | undefined;

export function activate(context: vscode.ExtensionContext): void {
  const provider = new HorsewhipSidebarProvider(context.extensionUri);
  sidebarProvider = provider;

  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider(HorsewhipSidebarProvider.viewId, provider, {
      webviewOptions: { retainContextWhenHidden: true },
    }),

    vscode.commands.registerCommand('horsewhip.open', () => focusHorsewhip()),

    vscode.commands.registerCommand('horsewhip.showTimeline', () => focusHorsewhip()),

    vscode.commands.registerCommand('horsewhip.refresh', async () => {
      await focusHorsewhip();
      const root = await ensureWorkspaceReady();
      if (!root) return;
      await provider.refresh();
      await provider.loadFromGit();
    }),

    vscode.commands.registerCommand('horsewhip.loadDemo', async () => {
      await focusHorsewhip();
      provider.loadDemo();
    }),

    vscode.workspace.onDidChangeWorkspaceFolders(() => provider.refresh()),

    vscode.workspace.onDidGrantWorkspaceTrust(() => provider.refresh()),
  );
}

export function deactivate(): void {
  sidebarProvider?.dispose();
}

async function focusHorsewhip(): Promise<void> {
  await vscode.commands.executeCommand('workbench.view.extension.horsewhip');
}
