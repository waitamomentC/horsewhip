import * as vscode from 'vscode';
import { HorsewhipTimeline } from './horsewhipTimeline';

export class HorsewhipSidebarProvider implements vscode.WebviewViewProvider {
  public static readonly viewId = 'horsewhip.timelineView';

  private timeline: HorsewhipTimeline | undefined;

  constructor(private readonly extensionUri: vscode.Uri) {}

  resolveWebviewView(
    webviewView: vscode.WebviewView,
    _context: vscode.WebviewViewResolveContext,
    _token: vscode.CancellationToken,
  ): void {
    this.timeline = new HorsewhipTimeline(webviewView.webview, this.extensionUri);
    this.timeline.bind();

    webviewView.webview.onDidReceiveMessage(() => { /* handled in timeline */ });

    const runRefresh = () => {
      this.timeline?.refresh().then(() => {
        if (webviewView.visible) {
          /* ready 由 panel-bridge 在 timeline html 加载后发送 */
        }
      });
    };

    runRefresh();

    webviewView.onDidChangeVisibility(() => {
      if (webviewView.visible) runRefresh();
    });
  }

  async refresh(): Promise<void> {
    await this.timeline?.refresh();
  }

  async loadFromGit(): Promise<void> {
    await this.timeline?.loadFromGit();
  }

  loadDemo(): void {
    this.timeline?.loadDemo();
  }

  dispose(): void {
    this.timeline?.dispose();
  }
}
