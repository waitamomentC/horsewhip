import * as vscode from 'vscode';
import { HorsewhipTimeline } from './horsewhipTimeline';

export class HorsewhipPanel {
  static instance: HorsewhipPanel | undefined;

  readonly timeline: HorsewhipTimeline;

  private constructor(
    private readonly panel: vscode.WebviewPanel,
    extensionUri: vscode.Uri,
  ) {
    this.timeline = new HorsewhipTimeline(panel.webview, extensionUri);
    this.timeline.bind();

    panel.onDidDispose(() => {
      if (HorsewhipPanel.instance === this) {
        HorsewhipPanel.instance = undefined;
      }
      this.timeline.dispose();
    });

    panel.iconPath = vscode.Uri.joinPath(extensionUri, 'media', 'horsewhip.svg');
  }

  static async open(extensionUri: vscode.Uri): Promise<HorsewhipPanel> {
    await vscode.commands.executeCommand('workbench.action.closeAllEditors');
    await vscode.commands.executeCommand('workbench.action.closeSidebar');

    if (HorsewhipPanel.instance) {
      HorsewhipPanel.instance.panel.reveal(vscode.ViewColumn.One, false);
      await HorsewhipPanel.instance.timeline.refresh();
      return HorsewhipPanel.instance;
    }

    const panel = vscode.window.createWebviewPanel(
      'horsewhipTimeline',
      '马鞭 · Horsewhip',
      { viewColumn: vscode.ViewColumn.One, preserveFocus: false },
      {
        enableScripts: true,
        retainContextWhenHidden: true,
        localResourceRoots: [vscode.Uri.joinPath(extensionUri, 'media')],
      },
    );

    HorsewhipPanel.instance = new HorsewhipPanel(panel, extensionUri);
    await HorsewhipPanel.instance.timeline.refresh();
    return HorsewhipPanel.instance;
  }

  static get(): HorsewhipPanel | undefined {
    return HorsewhipPanel.instance;
  }

  async refresh(): Promise<void> {
    await this.timeline.refresh();
  }

  async loadFromGit(): Promise<void> {
    await this.timeline.loadFromGit();
  }

  loadDemo(): void {
    this.timeline.loadDemo();
  }

  async openRemoteWizard(): Promise<void> {
    await this.timeline.openRemoteWizard();
  }

  async openCommitDialog(): Promise<void> {
    await this.timeline.openCommitDialog();
  }

  dispose(): void {
    this.panel.dispose();
  }
}
