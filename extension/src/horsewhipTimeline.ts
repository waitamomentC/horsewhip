import * as path from 'path';
import * as vscode from 'vscode';
import { writeTimelineLogForWebview } from './timelineLogCache';
import {
  augmentLogWithBranchTips,
  fetchGitBranches,
  fetchGitLog,
  gitCheckoutFile,
  gitCheckoutFiles,
  gitCheckoutDetached,
  gitSwitchBranch,
  gitSwitchPrevious,
  gitInit,
  gitCommitAll,
  getGitConfig,
  setLocalGitConfig,
} from './gitRunner';
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
import { setBoundaryAllowlist, setBoundaryAllowlistWorkspaceRoot } from './boundaryAllowlist';
import {
  assertCommitAllowed,
  processCommitBlockedMarker,
  insertCorrectionPrompt,
  notifyBoundaryArmed,
  revertOverreachFiles,
  runBoundaryGuardCheck,
  setGuardWebviewNotifier,
  syncBoundaryLockFromWebview,
} from './boundaryGuardHost';
import { isHorsewhipPreCommitHookInstalled, installHorsewhipPreCommitHook } from './boundaryGitHook';
import { insertTextIntoChat } from './chatInsert';
import { detectDevStartCommand } from './previewDev';
import { gitBranchDisplay } from './gitRunner';

type WebviewInbound =
  | { type: 'ready' }
  | { type: 'webviewHandshake' }
  | { type: 'requestGitReload' }
  | { type: 'gitCheckout'; hash: string; filePath: string }
  | { type: 'gitCheckoutFiles'; hash: string; filePaths: string[] }
  | { type: 'gitCheckoutDetached'; hash: string }
  | { type: 'gitPreviewUi'; hash: string; devCommand?: string }
  | { type: 'gitSwitchBranch'; branchName: string }
  | { type: 'gitSwitchPrevious' }
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
  | { type: 'gateGitInit' }
  | {
      type: 'setBoundaryAllowlist';
      files: string[];
      locked?: boolean;
      targets?: Array<{
        nodeId: string;
        commit: string;
        branch: string;
        lanePath?: string;
        files: string[];
      }>;
    }
  | { type: 'insertBoundaryToChat'; text: string }
  | { type: 'guardCheck' }
  | { type: 'guardInsertCorrection' }
  | { type: 'guardRevertOverreach' };

export class HorsewhipTimeline {
  private workspaceRoot: string | undefined;

  private disposables: vscode.Disposable[] = [];

  private workspaceFilesDisposable: vscode.Disposable | undefined;

  private projectName = 'project';

  private workspaceTerminal: WorkspaceTerminal | undefined;

  private gitWatchDisposable: vscode.Disposable | undefined;

  private gitReloadInFlight = false;

  private gitReloadPending = false;

  /** Bumped on each timeline HTML reset — drops stale async git loads. */
  private webviewEpoch = 0;

  private timelineHtmlLoaded = false;

  private htmlWorkspaceRoot: string | undefined;

  /** Avoid handshake + ready + watch all starting parallel git reloads. */
  private webviewBootLoadStarted = false;

  constructor(
    private readonly webview: vscode.Webview,
    private readonly extensionUri: vscode.Uri,
    private readonly storageUri: vscode.Uri,
  ) {}

  bind(): void {
    this.webview.options = {
      enableScripts: true,
      localResourceRoots: [
        vscode.Uri.joinPath(this.extensionUri, 'media'),
        this.storageUri,
      ],
    };

    this.disposables.push(
      this.webview.onDidReceiveMessage((msg: WebviewInbound) => this.onMessage(msg)),
    );

    setGuardWebviewNotifier((payload) => {
      this.webview.postMessage(payload);
    });
  }

  dispose(): void {
    setBoundaryAllowlistWorkspaceRoot(undefined);
    setGuardWebviewNotifier(undefined);
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
      void processCommitBlockedMarker(this.workspaceRoot!);
      void this.reloadGitTimeline({ offerRemote: false });
    });
  }

  /** 根据工作区 / git 状态刷新整个 Webview。 */
  async refresh(): Promise<void> {
    this.workspaceTerminal?.stop();
    this.workspaceTerminal = undefined;

    const state = await checkWorkspace();

    if (!state.ok) {
      this.timelineHtmlLoaded = false;
      this.htmlWorkspaceRoot = undefined;
      this.workspaceFilesDisposable?.dispose();
      this.workspaceFilesDisposable = undefined;
      this.gitWatchDisposable?.dispose();
      this.gitWatchDisposable = undefined;
      this.workspaceRoot = undefined;
      setBoundaryAllowlistWorkspaceRoot(undefined);
      const folder = getWorkspaceRoot();
      this.webview.html = buildGateHtml(
        this.webview,
        state.reason,
        folder ? getWorkspaceFolderName(folder) : undefined,
      );
      return;
    }

    const root = state.root;
    const needNewHtml = !this.timelineHtmlLoaded || this.htmlWorkspaceRoot !== root;

    this.workspaceRoot = root;
    setBoundaryAllowlistWorkspaceRoot(this.workspaceRoot);
    this.projectName = sanitizeRepoName(state.folderName);

    if (needNewHtml) {
      this.resetWebviewSession();
      this.webview.html = buildTimelineHtml(
        this.webview,
        this.extensionUri,
        state.folderName,
      );
      this.timelineHtmlLoaded = true;
      this.htmlWorkspaceRoot = root;
      this.bindWorkspaceFilesWatch();
      void this.ensureCommitHookInstalled();
      void processCommitBlockedMarker(this.workspaceRoot);
    } else {
      this.bindWorkspaceFilesWatch();
      await this.reloadGitTimeline({ offerRemote: false });
      void processCommitBlockedMarker(this.workspaceRoot);
    }
  }

  private postTimelineLog(log: string, epoch: number): void {
    if (epoch !== this.webviewEpoch) return;
    const INLINE_MAX = 3 * 1024 * 1024;
    if (log.length <= INLINE_MAX) {
      this.webview.postMessage({ type: 'loadLog', log });
      return;
    }
    void writeTimelineLogForWebview(this.storageUri, this.webview, log)
      .then((uri) => {
        if (epoch !== this.webviewEpoch) return;
        this.webview.postMessage({ type: 'loadLogUri', uri });
      })
      .catch((err) => {
        const msg = err instanceof Error ? err.message : String(err);
        this.webview.postMessage({ type: 'gitLoadError', error: `无法传递 git log：${msg}` });
      });
  }

  private async startWebviewGitLoad(): Promise<void> {
    if (this.webviewBootLoadStarted || !this.workspaceRoot) return;
    this.webviewBootLoadStarted = true;
    await this.loadFromGit();
  }

  private async ensureCommitHookInstalled(): Promise<void> {
    if (!this.workspaceRoot) return;
    const cfg = vscode.workspace.getConfiguration('horsewhip.guard');
    if (!cfg.get<boolean>('installHookOnOpen', true)) return;
    try {
      if (await isHorsewhipPreCommitHookInstalled(this.workspaceRoot)) return;
      await installHorsewhipPreCommitHook(this.extensionUri, this.workspaceRoot);
    } catch (err) {
      const text = err instanceof Error ? err.message : String(err);
      console.error('[Horsewhip] pre-commit hook install failed:', err);
      vscode.window.showErrorMessage(
        `horsewhip：无法安装 git pre-commit 守门钩子 — ${text}。请运行命令「Horsewhip: Install Git Pre-Commit Guard Hook」。`,
      );
    }
  }

  async loadFromGit(maxCount = 100): Promise<void> {
    await this.reloadGitTimeline({ maxCount, offerRemote: true });
  }

  private resetWebviewSession(): void {
    this.webviewEpoch += 1;
    this.gitReloadInFlight = false;
    this.gitReloadPending = false;
    this.webviewBootLoadStarted = false;
  }

  private async reloadGitTimeline(options: {
    maxCount?: number;
    offerRemote?: boolean;
  } = {}): Promise<void> {
    if (!this.workspaceRoot) return;
    if (this.gitReloadInFlight) {
      this.gitReloadPending = true;
      return;
    }
    const epoch = this.webviewEpoch;
    const maxCount = options.maxCount ?? 200;
    this.gitReloadInFlight = true;
    try {
      this.webview.postMessage({ type: 'bootStatus', text: '正在读取分支与 commit…' });
      const pathsPromise = collectWorkspaceRelPaths();
      const [branches, status] = await Promise.all([
        fetchGitBranches(this.workspaceRoot),
        getRepoStatus(this.workspaceRoot),
      ]);
      if (epoch !== this.webviewEpoch) return;

      this.webview.postMessage({ type: 'bootStatus', text: '正在解析 git log…' });
      let log = await fetchGitLog(this.workspaceRoot, maxCount);
      if (epoch !== this.webviewEpoch) return;

      this.webview.postMessage({
        type: 'setGitBranches',
        branches,
        currentBranch: status.branch,
      });

      if (!log) {
        const authorName = await getGitConfig(this.workspaceRoot, 'user.name');
        const authorEmail = await getGitConfig(this.workspaceRoot, 'user.email');
        this.webview.postMessage({ type: 'noCommits', authorName, authorEmail });
        await this.pushRepoStatus();
        return;
      }
      log = await augmentLogWithBranchTips(this.workspaceRoot, log, branches);
      if (epoch !== this.webviewEpoch) return;

      this.webview.postMessage({ type: 'bootStatus', text: '正在绘制泳道…' });
      this.postTimelineLog(log, epoch);

      const paths = await pathsPromise;
      if (epoch !== this.webviewEpoch) return;
      this.webview.postMessage({ type: 'setWorkspaceFiles', paths });

      await this.pushRepoStatus();
      if (options.offerRemote) {
        await this.offerRemoteSetupIfNeeded();
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      vscode.window.showErrorMessage(`Horsewhip: failed to read git log — ${msg}`);
      this.webview.postMessage({ type: 'gitLoadError', error: msg });
    } finally {
      this.gitReloadInFlight = false;
      if (this.gitReloadPending) {
        this.gitReloadPending = false;
        void this.reloadGitTimeline(options);
      }
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

    const mayCommit = await assertCommitAllowed(cwd);
    if (!mayCommit) {
      return;
    }

    this.webview.postMessage({ type: 'commitStarted' });
    try {
      await gitCommitAll(cwd, message);
      const { clearCommitBlockedMarker } = await import('./boundaryPersist');
      await clearCommitBlockedMarker(cwd);
      vscode.window.showInformationMessage(`Horsewhip: committed — ${message}`);
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
      vscode.window.showInformationMessage(`Horsewhip: published to ${remoteUrl}`);
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
      } catch (err) {
        const text = err instanceof Error ? err.message : String(err);
        vscode.window.showErrorMessage(`git init 失败：${text}`);
      }
      return;
    }
    if (msg.type === 'requestGitReload') {
      const state = await checkWorkspace();
      if (!state.ok) return;
      this.webviewBootLoadStarted = false;
      await this.loadFromGit();
      return;
    }
    if (msg.type === 'webviewHandshake' || msg.type === 'ready') {
      const state = await checkWorkspace();
      if (!state.ok) {
        this.webview.postMessage({
          type: 'gitLoadError',
          error: state.reason === 'no-git'
            ? '当前文件夹不是 Git 仓库，请先 git init。'
            : '请先打开一个工作区文件夹。',
        });
        return;
      }
      await this.startWebviewGitLoad();
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
        vscode.window.showInformationMessage(`已拉出参考：${msg.filePath}`);
      } catch (err) {
        const text = err instanceof Error ? err.message : String(err);
        vscode.window.showErrorMessage(`checkout 失败：${text}`);
      }
      return;
    }
    if (msg.type === 'gitCheckoutFiles') {
      if (!this.workspaceRoot) return;
      const paths = Array.isArray(msg.filePaths) ? msg.filePaths.filter(Boolean) : [];
      if (!paths.length) {
        vscode.window.showWarningMessage('此节点没有可拉出的文件路径');
        return;
      }
      try {
        await gitCheckoutFiles(this.workspaceRoot, msg.hash, paths);
        vscode.window.showInformationMessage(
          `已将 ${paths.length} 个路径写成 ${msg.hash.slice(0, 7)} 的内容（工作区真实文件，HEAD 与分支未变）`,
        );
      } catch (err) {
        const text = err instanceof Error ? err.message : String(err);
        vscode.window.showErrorMessage(`拉出参考失败：${text}`);
      }
      return;
    }
    if (msg.type === 'gitCheckoutDetached') {
      if (!this.workspaceRoot) return;
      const ok = await vscode.window.showWarningMessage(
        `切换到 detached ${msg.hash.slice(0, 7)} 查看？未提交改动可能需先 stash。`,
        { modal: true },
        '切换查看',
      );
      if (ok !== '切换查看') return;
      try {
        await gitCheckoutDetached(this.workspaceRoot, msg.hash);
        vscode.window.showInformationMessage(`已在 ${msg.hash.slice(0, 7)}（detached）。点标题栏「恢复工作区」回到原分支。`);
        await this.loadFromGit();
      } catch (err) {
        const text = err instanceof Error ? err.message : String(err);
        vscode.window.showErrorMessage(`切换失败：${text}`);
      }
      return;
    }
    if (msg.type === 'gitPreviewUi') {
      if (!this.workspaceRoot) return;
      const short = msg.hash.slice(0, 7);
      const detected = await detectDevStartCommand(this.workspaceRoot);
      const devCmd = (msg.devCommand || detected || '').trim();
      if (!devCmd) {
        vscode.window.showWarningMessage(
          '未找到 package.json 的 dev/start 脚本。请先在项目根配置 npm run dev，或用手动 detached 检出后自己启动。',
        );
        return;
      }
      const ok = await vscode.window.showWarningMessage(
        `检出 ${short} 并运行「${devCmd}」？未提交改动请先 stash；完成后点标题栏「恢复工作区」。`,
        { modal: true },
        '检出并运行',
      );
      if (ok !== '检出并运行') return;
      try {
        await gitCheckoutDetached(this.workspaceRoot, msg.hash);
        await this.loadFromGit();
        const term = vscode.window.createTerminal({
          cwd: this.workspaceRoot,
          name: `horsewhip · preview ${short}`,
        });
        term.show();
        term.sendText(devCmd, true);
        vscode.window.showInformationMessage(
          `已在 ${short} 检出并运行。完成后点标题栏「恢复工作区」。`,
        );
      } catch (err) {
        const text = err instanceof Error ? err.message : String(err);
        vscode.window.showErrorMessage(`预览失败：${text}`);
      }
      return;
    }
    if (msg.type === 'gitSwitchPrevious') {
      if (!this.workspaceRoot) return;
      try {
        const prev = await gitSwitchPrevious(this.workspaceRoot);
        vscode.window.showInformationMessage(
          prev ? `已恢复工作区，回到分支 ${prev}` : '已恢复工作区（git switch -）',
        );
        await this.loadFromGit();
      } catch (err) {
        const text = err instanceof Error ? err.message : String(err);
        vscode.window.showErrorMessage(`恢复工作区失败：${text}`);
      }
      return;
    }
    if (msg.type === 'gitSwitchBranch') {
      if (!this.workspaceRoot) return;
      const ok = await vscode.window.showWarningMessage(
        `切换到分支 ${msg.branchName}？未提交改动可能需先 stash。`,
        { modal: true },
        '切换分支',
      );
      if (ok !== '切换分支') return;
      try {
        await gitSwitchBranch(this.workspaceRoot, msg.branchName);
        vscode.window.showInformationMessage(`已切换到 ${msg.branchName}`);
        await this.loadFromGit();
      } catch (err) {
        const text = err instanceof Error ? err.message : String(err);
        vscode.window.showErrorMessage(`切换分支失败：${text}`);
      }
      return;
    }
    if (msg.type === 'setBoundaryAllowlist') {
      const files = Array.isArray(msg.files) ? msg.files : [];
      const locked = Boolean(msg.locked);
      const targets = Array.isArray(msg.targets) ? msg.targets : [];
      void (async () => {
        const branchInfo = this.workspaceRoot
          ? await gitBranchDisplay(this.workspaceRoot)
          : { label: '', detached: false };
        await setBoundaryAllowlist(files, locked, targets, branchInfo.label);
        if (!this.workspaceRoot) return;
        await syncBoundaryLockFromWebview(this.workspaceRoot, files, locked);
        if (locked && files.length) {
          await this.ensureCommitHookInstalled();
          await notifyBoundaryArmed(this.workspaceRoot, files);
        }
        await runBoundaryGuardCheck(this.workspaceRoot, { silent: true });
      })();
      return;
    }
    if (msg.type === 'guardCheck') {
      if (!this.workspaceRoot) return;
      await runBoundaryGuardCheck(this.workspaceRoot);
      return;
    }
    if (msg.type === 'guardInsertCorrection') {
      await insertCorrectionPrompt();
      return;
    }
    if (msg.type === 'guardRevertOverreach') {
      if (!this.workspaceRoot) return;
      await revertOverreachFiles(this.workspaceRoot);
      return;
    }
    if (msg.type === 'insertBoundaryToChat') {
      const text = (msg.text ?? '').trim();
      if (!text) return;
      const result = await insertTextIntoChat(text);
      if (result === 'chat') {
        vscode.window.showInformationMessage('Horsewhip: constraint inserted into Chat — add your task description and send');
      } else {
        vscode.window.showInformationMessage('Horsewhip: constraint copied to clipboard — paste into Chat');
      }
    }
  }
}
