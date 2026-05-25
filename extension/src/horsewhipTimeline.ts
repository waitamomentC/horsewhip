import * as path from 'path';
import * as vscode from 'vscode';
import { fetchGitLog, gitCheckoutFile, gitResetHard, gitInit, gitCommitAll, getGitConfig, setLocalGitConfig } from './gitRunner';
import {
  createRepoWithGh,
  createRepoWithToken,
  getGhUsername,
  getRemoteUrl,
  ghAvailable,
  pushOrigin,
  sanitizeRepoName,
  setRemoteOrigin,
} from './githubRemote';
import { ensureSshKey, readSshPublicKey, testGitHubSsh } from './sshSetup';
import { getRepoStatus, remoteToHtmlUrl } from './gitStatus';
import { collectWorkspaceRelPaths, subscribeWorkspaceFiles } from './workspaceFiles';
import { checkWorkspace, getWorkspaceFolderName, getWorkspaceRoot } from './workspaceGate';
import { buildGateHtml, buildTimelineHtml } from './webviewHtml';
import { watchGitRepository } from './gitWatch';
import { WorkspaceTerminal } from './workspaceTerminal';

type WebviewInbound =
  | { type: 'ready' }
  | { type: 'gitCheckout'; hash: string; filePath: string }
  | { type: 'gitResetHard'; hash: string }
  | { type: 'gitCommit'; message: string; authorName: string; authorEmail: string }
  | { type: 'remoteWizardOpen' }
  | { type: 'remoteTestSsh' }
  | { type: 'remoteGenerateKey' }
  | { type: 'remotePublish'; mode: 'existing' | 'create'; repoUrl?: string; githubUser?: string; repoName?: string; token?: string }
  | { type: 'requestOpenCommitDialog' }
  | { type: 'openExternalUrl'; url: string }
  | { type: 'revealFolder'; folderPath: string }
  | { type: 'terminalOpen' }
  | { type: 'terminalClose' }
  | { type: 'terminalInput'; data: string }
  | { type: 'terminalResize'; cols: number; rows: number }
  | { type: 'gateOpenFolder' }
  | { type: 'gateGitInit' };

export class HorsewhipTimeline {
  private workspaceRoot: string | undefined;

  private disposables: vscode.Disposable[] = [];

  private workspaceFilesDisposable: vscode.Disposable | undefined;

  private projectName = 'project';

  private workspaceTerminal: WorkspaceTerminal | undefined;

  private gitWatchDisposable: vscode.Disposable | undefined;

  private gitReloadInFlight = false;

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
    this.workspaceTerminal?.stop();
    this.workspaceTerminal = undefined;
    this.gitWatchDisposable?.dispose();
    this.gitWatchDisposable = undefined;
    this.workspaceFilesDisposable?.dispose();
    this.workspaceFilesDisposable = undefined;
    while (this.disposables.length) {
      this.disposables.pop()?.dispose();
    }
  }

  private bindWorkspaceFilesWatch(): void {
    this.workspaceFilesDisposable?.dispose();
    if (!this.workspaceRoot) {
      this.workspaceFilesDisposable = undefined;
      return;
    }
    const push = () => {
      void collectWorkspaceRelPaths().then((paths) => {
        this.webview.postMessage({ type: 'setWorkspaceFiles', paths });
      });
    };
    push();
    this.workspaceFilesDisposable = subscribeWorkspaceFiles(push);
    this.bindGitWatch();
  }

  private bindGitWatch(): void {
    this.gitWatchDisposable?.dispose();
    if (!this.workspaceRoot) {
      this.gitWatchDisposable = undefined;
      return;
    }
    this.gitWatchDisposable = watchGitRepository(this.workspaceRoot, () => {
      void this.reloadGitTimeline({ offerRemote: false });
    });
  }

  /** 根据工作区 / git 状态刷新整个 Webview。 */
  async refresh(): Promise<void> {
    this.workspaceTerminal?.stop();
    this.workspaceTerminal = undefined;

    const state = await checkWorkspace();

    if (!state.ok) {
      this.workspaceFilesDisposable?.dispose();
      this.workspaceFilesDisposable = undefined;
      this.gitWatchDisposable?.dispose();
      this.gitWatchDisposable = undefined;
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
    this.projectName = sanitizeRepoName(state.folderName);
    this.webview.html = buildTimelineHtml(
      this.webview,
      this.extensionUri,
      state.folderName,
    );
    this.bindWorkspaceFilesWatch();
  }

  async loadFromGit(maxCount = 100): Promise<void> {
    await this.reloadGitTimeline({ maxCount, offerRemote: true });
  }

  private async reloadGitTimeline(options: {
    maxCount?: number;
    offerRemote?: boolean;
  } = {}): Promise<void> {
    if (!this.workspaceRoot || this.gitReloadInFlight) return;
    const maxCount = options.maxCount ?? 100;
    this.gitReloadInFlight = true;
    try {
      const paths = await collectWorkspaceRelPaths();
      this.webview.postMessage({ type: 'setWorkspaceFiles', paths });
      const log = await fetchGitLog(this.workspaceRoot, maxCount);
      if (!log) {
        const authorName = await getGitConfig(this.workspaceRoot, 'user.name');
        const authorEmail = await getGitConfig(this.workspaceRoot, 'user.email');
        this.webview.postMessage({ type: 'noCommits', authorName, authorEmail });
        await this.pushRepoStatus();
        return;
      }
      this.webview.postMessage({ type: 'loadLog', log });
      await this.pushRepoStatus();
      if (options.offerRemote) {
        await this.offerRemoteSetupIfNeeded();
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      vscode.window.showErrorMessage(`马鞭：读取 git log 失败 — ${msg}`);
    } finally {
      this.gitReloadInFlight = false;
    }
  }

  loadDemo(): void {
    this.webview.postMessage({ type: 'loadDemo' });
  }

  async openRemoteWizard(): Promise<void> {
    const payload = await this.remoteWizardPayload();
    this.webview.postMessage({ type: 'remoteWizardInit', ...payload });
  }

  async openCommitDialog(): Promise<void> {
    if (!this.workspaceRoot) return;
    const authorName = await getGitConfig(this.workspaceRoot, 'user.name');
    const authorEmail = await getGitConfig(this.workspaceRoot, 'user.email');
    this.webview.postMessage({
      type: 'openCommitDialog',
      authorName,
      authorEmail,
      mode: 'quick',
    });
  }

  private ensureWorkspaceTerminal(): WorkspaceTerminal | undefined {
    if (!this.workspaceRoot) return undefined;
    if (!this.workspaceTerminal) {
      this.workspaceTerminal = new WorkspaceTerminal(
        this.workspaceRoot,
        (msg) => this.webview.postMessage(msg),
      );
    }
    return this.workspaceTerminal;
  }

  private async pushRepoStatus(): Promise<void> {
    if (!this.workspaceRoot) return;
    const status = await getRepoStatus(this.workspaceRoot);
    const authorName = await getGitConfig(this.workspaceRoot, 'user.name');
    const authorEmail = await getGitConfig(this.workspaceRoot, 'user.email');
    this.webview.postMessage({ type: 'repoStatus', ...status, authorName, authorEmail });
  }

  private async runGitCommit(message: string, authorName: string, authorEmail: string): Promise<void> {
    if (!this.workspaceRoot) return;
    const cwd = this.workspaceRoot;
    const name = authorName.trim();
    const email = authorEmail.trim();

    if (!name) {
      this.webview.postMessage({ type: 'commitError', error: '请填写 Git 用户名' });
      return;
    }
    if (!email) {
      this.webview.postMessage({ type: 'commitError', error: '请填写 Git 邮箱' });
      return;
    }

    await setLocalGitConfig(cwd, 'user.name', name);
    await setLocalGitConfig(cwd, 'user.email', email);

    this.webview.postMessage({ type: 'commitStarted' });
    try {
      await gitCommitAll(cwd, message);
      vscode.window.showInformationMessage(`马鞭：已提交 — ${message}`);
      await this.reloadGitTimeline({ offerRemote: true });
      this.webview.postMessage({ type: 'commitDone', message });
    } catch (err) {
      const text = err instanceof Error ? err.message : String(err);
      this.webview.postMessage({ type: 'commitError', error: text });
      vscode.window.showErrorMessage(`提交失败：${text}`);
    }
  }

  private async remoteWizardPayload() {
    const githubUser = (await getGhUsername()) ?? '';
    const ghOk = await ghAvailable();
    return {
      projectName: this.projectName,
      githubUser,
      ghAvailable: ghOk,
    };
  }

  private async offerRemoteSetupIfNeeded(force = false): Promise<void> {
    if (!this.workspaceRoot) return;
    const remote = await getRemoteUrl(this.workspaceRoot);
    if (remote && !force) return;
    const payload = await this.remoteWizardPayload();
    this.webview.postMessage({ type: 'offerRemoteSetup', ...payload });
  }

  private async postSshStatus(): Promise<void> {
    if (!this.workspaceRoot) return;
    const test = await testGitHubSsh();
    const publicKey = readSshPublicKey() ?? undefined;
    this.webview.postMessage({
      type: 'remoteSshStatus',
      ok: test.ok,
      username: test.username,
      message: test.message,
      publicKey,
    });
  }

  private async handleRemoteGenerateKey(): Promise<void> {
    if (!this.workspaceRoot) return;
    const email = (await getGitConfig(this.workspaceRoot, 'user.email')) || 'horsewhip@local';
    try {
      const publicKey = await ensureSshKey(email);
      this.webview.postMessage({ type: 'remoteKeyGenerated', publicKey });
      await vscode.env.clipboard.writeText(publicKey);
    } catch (err) {
      const text = err instanceof Error ? err.message : String(err);
      this.webview.postMessage({ type: 'remoteKeyGenerated', publicKey: '' });
      vscode.window.showErrorMessage(`生成 SSH 密钥失败：${text}`);
    }
  }

  private async handleRemotePublish(msg: Extract<WebviewInbound, { type: 'remotePublish' }>): Promise<void> {
    if (!this.workspaceRoot) return;
    const cwd = this.workspaceRoot;

    try {
      let remoteUrl = '';
      let htmlUrl = '';

      if (msg.mode === 'existing') {
        remoteUrl = (msg.repoUrl ?? '').trim();
        if (!/^git@github\.com:[^/]+\/[^/]+\.git$/i.test(remoteUrl)) {
          throw new Error('请使用 SSH 地址，例如 git@github.com:用户名/仓库.git');
        }
        await setRemoteOrigin(cwd, remoteUrl);
        await pushOrigin(cwd);
        htmlUrl = remoteToHtmlUrl(remoteUrl) ?? '';
      } else {
        const repoName = sanitizeRepoName(msg.repoName ?? this.projectName);
        const githubUser = (msg.githubUser ?? '').trim();
        if (!githubUser) throw new Error('请填写 GitHub 用户名');

        if (await ghAvailable()) {
          remoteUrl = await createRepoWithGh(cwd, repoName);
          htmlUrl = remoteToHtmlUrl(remoteUrl) ?? `https://github.com/${githubUser}/${repoName}`;
        } else {
          const token = (msg.token ?? '').trim();
          if (!token) {
            throw new Error('未检测到 gh 登录，请填写 GitHub Token（需 repo 权限）或先运行 gh auth login');
          }
          const created = await createRepoWithToken(token, repoName, false);
          remoteUrl = created.sshUrl;
          htmlUrl = created.htmlUrl;
          await setRemoteOrigin(cwd, remoteUrl);
          await pushOrigin(cwd);
        }
      }

      this.webview.postMessage({ type: 'remotePublishDone', remoteUrl, htmlUrl });
      await this.pushRepoStatus();
      vscode.window.showInformationMessage(`马鞭：已发布到 ${remoteUrl}`);
    } catch (err) {
      const text = err instanceof Error ? err.message : String(err);
      this.webview.postMessage({ type: 'remotePublishError', error: text });
      vscode.window.showErrorMessage(`发布失败：${text}`);
    }
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
    if (msg.type === 'gitCommit') {
      if (!this.workspaceRoot) return;
      const message = msg.message.trim();
      if (!message) {
        this.webview.postMessage({ type: 'commitError', error: '请输入 commit 说明' });
        return;
      }
      await this.runGitCommit(message, msg.authorName ?? '', msg.authorEmail ?? '');
      return;
    }
    if (msg.type === 'requestOpenCommitDialog') {
      await this.openCommitDialog();
      return;
    }
    if (msg.type === 'openExternalUrl') {
      const url = msg.url?.trim();
      if (url) await vscode.env.openExternal(vscode.Uri.parse(url));
      return;
    }
    if (msg.type === 'revealFolder') {
      if (!this.workspaceRoot) return;
      const rel = (msg.folderPath ?? '').replace(/\/$/, '');
      const abs = rel ? path.join(this.workspaceRoot, rel) : this.workspaceRoot;
      const uri = vscode.Uri.file(abs);
      await vscode.commands.executeCommand('workbench.view.explorer');
      await vscode.commands.executeCommand('revealInExplorer', uri);
      return;
    }
    if (msg.type === 'terminalOpen') {
      this.ensureWorkspaceTerminal()?.start();
      return;
    }
    if (msg.type === 'terminalClose') {
      return;
    }
    if (msg.type === 'terminalInput') {
      this.ensureWorkspaceTerminal()?.write(msg.data ?? '');
      return;
    }
    if (msg.type === 'terminalResize') {
      return;
    }
    if (msg.type === 'remoteWizardOpen') {
      const payload = await this.remoteWizardPayload();
      this.webview.postMessage({ type: 'remoteWizardInit', ...payload });
      return;
    }
    if (msg.type === 'remoteTestSsh') {
      await this.postSshStatus();
      return;
    }
    if (msg.type === 'remoteGenerateKey') {
      await this.handleRemoteGenerateKey();
      return;
    }
    if (msg.type === 'remotePublish') {
      await this.handleRemotePublish(msg);
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
