import * as vscode from 'vscode';
import { fetchGitLog, gitCheckoutFile, gitResetHard, gitInit } from './gitRunner';
import { subscribeOpenWorkspaceFiles } from './openFiles';
import { checkWorkspace, getWorkspaceFolderName, getWorkspaceRoot } from './workspaceGate';
import { buildGateHtml, buildTimelineHtml } from './webviewHtml';

type WebviewInbound =
  | { type: 'ready' }
  | { type: 'gitCheckout'; hash: string; filePath: string }
  | { type: 'gitResetHard'; hash: string }
  | { type: 'gateOpenFolder' }
  | { type: 'gateGitInit' };

export class HorsewhipTimeline {
  private workspaceRoot: string | undefined;

  private disposables: vscode.Disposable[] = [];

  private openFilesDisposable: vscode.Disposable | undefined;

  constructor(
    private readonly webview: vscode.Webview,
    private readonly extensionUri: vscode.Uri,
  ) {}

  bind(): void {
    this.webview.options = {
      enableScripts: true,
      localResourceRoots: [vscode.Uri.joinPath(this.extensionUri, 'media')],
    };

    this.disposables.push(
      this.webview.onDidReceiveMessage((msg: WebviewInbound) => this.onMessage(msg)),
    );
  }

  dispose(): void {
    this.openFilesDisposable?.dispose();
    this.openFilesDisposable = undefined;
    while (this.disposables.length) {
      this.disposables.pop()?.dispose();
    }
  }

  private bindOpenFilesWatch(): void {
    this.openFilesDisposable?.dispose();
    if (!this.workspaceRoot) {
      this.openFilesDisposable = undefined;
      return;
    }
    const root = this.workspaceRoot;
    this.openFilesDisposable = subscribeOpenWorkspaceFiles(root, (paths) => {
      this.webview.postMessage({ type: 'setOpenFiles', paths });
    });
  }

  /** 根据工作区 / git 状态刷新整个 Webview。 */
  async refresh(): Promise<void> {
    const state = await checkWorkspace();

    if (!state.ok) {
      this.openFilesDisposable?.dispose();
      this.openFilesDisposable = undefined;
      this.workspaceRoot = undefined;
      const folder = getWorkspaceRoot();
      this.webview.html = buildGateHtml(
        this.webview,
        state.reason,
        folder ? getWorkspaceFolderName(folder) : undefined,
      );
      return;
    }

    this.workspaceRoot = state.root;
    this.webview.html = buildTimelineHtml(
      this.webview,
      this.extensionUri,
      state.folderName,
    );
    this.bindOpenFilesWatch();
  }

  async loadFromGit(maxCount = 100): Promise<void> {
    if (!this.workspaceRoot) return;
    try {
      const log = await fetchGitLog(this.workspaceRoot, maxCount);
      if (!log) {
        vscode.window.showWarningMessage('马鞭：git log 为空（是否还没有任何 commit？）');
        return;
      }
      this.webview.postMessage({ type: 'loadLog', log });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      vscode.window.showErrorMessage(`马鞭：读取 git log 失败 — ${msg}`);
    }
  }

  loadDemo(): void {
    this.webview.postMessage({ type: 'loadDemo' });
  }

  private async onMessage(msg: WebviewInbound): Promise<void> {
    if (msg.type === 'gateOpenFolder') {
      await vscode.commands.executeCommand('workbench.action.files.openFolder');
      return;
    }
    if (msg.type === 'gateGitInit') {
      const root = getWorkspaceRoot();
      if (!root) return;
      try {
        await gitInit(root);
        await this.refresh();
        if (this.workspaceRoot) await this.loadFromGit();
      } catch (err) {
        const text = err instanceof Error ? err.message : String(err);
        vscode.window.showErrorMessage(`git init 失败：${text}`);
      }
      return;
    }
    if (msg.type === 'ready') {
      const state = await checkWorkspace();
      if (!state.ok) return;
      await this.loadFromGit();
      return;
    }
    if (msg.type === 'gitCheckout') {
      if (!this.workspaceRoot) return;
      try {
        await gitCheckoutFile(this.workspaceRoot, msg.hash, msg.filePath);
        vscode.window.showInformationMessage(`已回滚文件：${msg.filePath}`);
      } catch (err) {
        const text = err instanceof Error ? err.message : String(err);
        vscode.window.showErrorMessage(`checkout 失败：${text}`);
      }
      return;
    }
    if (msg.type === 'gitResetHard') {
      if (!this.workspaceRoot) return;
      const ok = await vscode.window.showWarningMessage(
        `将整个仓库 reset 到 ${msg.hash.slice(0, 7)}？未提交改动会丢失。`,
        { modal: true },
        '执行 reset --hard',
      );
      if (ok !== '执行 reset --hard') return;
      const typed = await vscode.window.showInputBox({
        prompt: '输入 RESET 确认',
        placeHolder: 'RESET',
      });
      if (typed?.trim() !== 'RESET') return;
      try {
        await gitResetHard(this.workspaceRoot, msg.hash);
        vscode.window.showInformationMessage(`已 reset --hard 到 ${msg.hash.slice(0, 7)}`);
        await this.loadFromGit();
      } catch (err) {
        const text = err instanceof Error ? err.message : String(err);
        vscode.window.showErrorMessage(`reset 失败：${text}`);
      }
    }
  }
}
