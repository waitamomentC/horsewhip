import * as vscode from 'vscode';
import { HorsewhipPanel } from './horsewhipPanel';

export class HorsewhipLauncherProvider implements vscode.TreeDataProvider<vscode.TreeItem> {
  public static readonly viewId = 'horsewhip.timelineView';

  private readonly onDidChangeTreeDataEmitter = new vscode.EventEmitter<void>();

  readonly onDidChangeTreeData = this.onDidChangeTreeDataEmitter.event;

  constructor(
    private readonly extensionUri: vscode.Uri,
    private readonly storageUri: vscode.Uri,
  ) {}

  getTreeItem(element: vscode.TreeItem): vscode.TreeItem {
    return element;
  }

  getChildren(): vscode.TreeItem[] {
    const open = new vscode.TreeItem('打开 Horsewhip 工作区', vscode.TreeItemCollapsibleState.None);
    open.iconPath = new vscode.ThemeIcon('symbol-event');
    open.description = '全屏时间线';
    open.command = { command: 'horsewhip.open', title: '打开 Horsewhip 工作区' };

    const agent = new vscode.TreeItem('配置 Agent（MCP + Skill）', vscode.TreeItemCollapsibleState.None);
    agent.iconPath = new vscode.ThemeIcon('server-process');
    agent.description = '完整版 · Vibecode / Claude';
    agent.command = { command: 'horsewhip.setupAgent', title: '配置 Agent' };

    return [open, agent];
  }

  bindTreeView(treeView: vscode.TreeView<vscode.TreeItem>): void {
    treeView.onDidChangeVisibility((e) => {
      if (e.visible) {
        void HorsewhipPanel.open(this.extensionUri, this.storageUri);
      }
    });
  }
}
