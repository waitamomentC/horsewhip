import * as path from 'path';
import * as vscode from 'vscode';
import {
  buildGuardStatsView,
  buildShareCard,
  onGuardStatsChanged,
} from './guardStats';
import { buildGuardRecordHtml } from './guardRecordHtml';

export class GuardRecordPanel {
  static instance: GuardRecordPanel | undefined;

  private readonly disposables: vscode.Disposable[] = [];

  private constructor(
    private readonly panel: vscode.WebviewPanel,
    private readonly extensionUri: vscode.Uri,
    private workspaceRoot: string,
  ) {
    panel.iconPath = vscode.Uri.joinPath(extensionUri, 'media', 'horsewhip.svg');
    panel.webview.onDidReceiveMessage((msg) => void this.onMessage(msg));
    panel.onDidDispose(() => {
      if (GuardRecordPanel.instance === this) GuardRecordPanel.instance = undefined;
      this.disposables.forEach((d) => d.dispose());
    });

    this.disposables.push(
      onGuardStatsChanged((root) => {
        if (root === this.workspaceRoot) void this.render();
      }),
    );
  }

  static async open(
    extensionUri: vscode.Uri,
    workspaceRoot?: string,
  ): Promise<GuardRecordPanel> {
    const root =
      workspaceRoot ??
      vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
    if (!root) {
      throw new Error('no-workspace');
    }

    if (GuardRecordPanel.instance) {
      GuardRecordPanel.instance.workspaceRoot = root;
      GuardRecordPanel.instance.panel.reveal(vscode.ViewColumn.One, false);
      await GuardRecordPanel.instance.render();
      return GuardRecordPanel.instance;
    }

    const panel = vscode.window.createWebviewPanel(
      'horsewhipGuardRecord',
      '守护记录',
      { viewColumn: vscode.ViewColumn.One, preserveFocus: false },
      {
        enableScripts: true,
        retainContextWhenHidden: true,
        localResourceRoots: [vscode.Uri.joinPath(extensionUri, 'media')],
      },
    );

    GuardRecordPanel.instance = new GuardRecordPanel(panel, extensionUri, root);
    await GuardRecordPanel.instance.render();
    return GuardRecordPanel.instance;
  }

  private async onMessage(msg: { type?: string }): Promise<void> {
    if (msg.type === 'refresh') {
      await this.render();
      return;
    }
    if (msg.type === 'timeline') {
      await vscode.commands.executeCommand('horsewhip.showTimeline');
      return;
    }
    if (msg.type === 'share') {
      const view = await buildGuardStatsView(this.workspaceRoot);
      const card = buildShareCard(view, path.basename(this.workspaceRoot));
      await vscode.env.clipboard.writeText(card);
      vscode.window.showInformationMessage('守护记录卡片已复制到剪贴板，可直接分享。');
    }
  }

  async render(): Promise<void> {
    const view = await buildGuardStatsView(this.workspaceRoot);
    const projectName = path.basename(this.workspaceRoot);
    this.panel.webview.html = buildGuardRecordHtml(view, projectName);
    this.panel.title = `守护记录 · ${view.totals.blocked} 次拦截`;
  }
}

export function registerGuardRecordPanel(context: vscode.ExtensionContext): void {
  context.subscriptions.push(
    vscode.commands.registerCommand('horsewhip.openGuardRecord', async (workspaceRoot?: string) => {
      try {
        await GuardRecordPanel.open(context.extensionUri, workspaceRoot);
      } catch {
        vscode.window.showWarningMessage('请先打开 Git 项目文件夹。');
      }
    }),
  );
}
