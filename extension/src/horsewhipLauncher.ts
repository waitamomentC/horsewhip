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
    const open = new vscode.TreeItem('Open Horsewhip workspace', vscode.TreeItemCollapsibleState.None);
    open.iconPath = new vscode.ThemeIcon('symbol-event');
    open.description = '全屏时间线';
    open.command = { command: 'horsewhip.open', title: 'Open Horsewhip workspace' };
    return [open];
  }

  bindTreeView(treeView: vscode.TreeView<vscode.TreeItem>): void {
    treeView.onDidChangeVisibility((e) => {
      if (e.visible) {
        void HorsewhipPanel.open(this.extensionUri, this.storageUri);
      }
    });
  }
}
