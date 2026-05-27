import * as vscode from 'vscode';

function uriFor(webview: vscode.Webview, extensionUri: vscode.Uri, name: string): string {
  return webview.asWebviewUri(vscode.Uri.joinPath(extensionUri, 'media', name)).toString();
}

function csp(webview: vscode.Webview): string {
  return [
    "default-src 'none'",
    `font-src ${webview.cspSource} https://fonts.gstatic.com`,
    `style-src ${webview.cspSource} 'unsafe-inline' https://fonts.googleapis.com https://cdn.jsdelivr.net`,
    `script-src ${webview.cspSource} https://cdn.jsdelivr.net 'unsafe-inline'`,
    `connect-src ${webview.cspSource}`,
    `media-src ${webview.cspSource}`,
  ].join('; ');
}

export function buildGateHtml(
  webview: vscode.Webview,
  reason: 'no-folder' | 'no-git',
  folderName?: string,
): string {
  const isNoGit = reason === 'no-git';
  const title = isNoGit ? '需要先建立 Git 仓库' : '需要先打开工作区';
  const body = isNoGit
    ? `Horsewhip only reads Git history from your <strong>current workspace</strong>.${folderName ? ` Folder <code>${folderName}</code> ` : ' '}has no <code>.git</code> yet. Run in the project root:<br><br><code>git init</code>`
    : 'Use <strong>File → Open Folder</strong> to pick a project directory. Horsewhip only analyzes files inside that workspace.';
  const action = isNoGit ? 'gateGitInit' : 'gateOpenFolder';
  const btnLabel = isNoGit ? '执行 git init' : '打开文件夹';

  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta http-equiv="Content-Security-Policy" content="${csp(webview)}">
  <style>
    body {
      margin: 0; min-height: 100vh; display: flex; align-items: center; justify-content: center;
      background: #07080a; color: #e8eaed;
      font: 400 14px/1.55 Inter, system-ui, sans-serif;
      padding: 24px; box-sizing: border-box;
    }
    .card { max-width: 360px; text-align: center; }
    h1 { font-size: 18px; margin: 0 0 12px; color: #f97316; }
    p { margin: 0 0 20px; color: #9aa3b2; }
    code { font-family: 'JetBrains Mono', monospace; font-size: 12px; color: #c4cad6; }
    button {
      background: #6d7ce8; color: #fff; border: none; border-radius: 6px;
      padding: 10px 18px; font-size: 13px; font-weight: 600; cursor: pointer;
    }
    button:hover { filter: brightness(1.08); }
  </style>
</head>
<body>
  <div class="card">
    <h1>Horsewhip</h1>
    <p>${body}</p>
    <button type="button" id="gate-btn">${btnLabel}</button>
  </div>
  <script>
    const vscode = acquireVsCodeApi();
    document.getElementById('gate-btn').onclick = () => vscode.postMessage({ type: '${action}' });
  </script>
</body>
</html>`;
}

export function buildTimelineHtml(
  webview: vscode.Webview,
  extensionUri: vscode.Uri,
  workspaceLabel: string,
): string {
  const u = (name: string) => uriFor(webview, extensionUri, name);

  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta http-equiv="Content-Security-Policy" content="${csp(webview)}">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="horsewhip-whip-audio" content="${u('whip-crack.mp3')}">
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/@xterm/xterm@5.5.0/css/xterm.min.css">
  <link rel="stylesheet" href="${u('style.css')}">
  <style>
    body.hw-plugin .header, body.hw-plugin .paste-drop { display: none !important; }
    html, body.hw-plugin {
      font-family: system-ui, -apple-system, 'Segoe UI', sans-serif;
      height: 100%; margin: 0; overflow: hidden;
      display: flex; flex-direction: column;
    }
    body.hw-plugin .plugin-bar { flex: 0 0 auto; }
    .plugin-guard {
      display: inline-flex; align-items: center; gap: 6px;
      font-size: 11px; color: #9aa3b2;
    }
    .plugin-guard__status { font-weight: 600; }
    .plugin-guard__status--ok { color: #4ade80; }
    .plugin-guard__status--warn { color: #fbbf24; }
    .plugin-guard__status--idle { color: #6b7280; }
    .plugin-guard__status--over { color: #f87171; }
    .hw-workspace {
      flex: 1 1 auto; min-height: 0;
      display: flex; flex-direction: column;
      overflow: hidden;
    }
    body.hw-plugin .stage {
      flex: 1 1 auto; min-height: 100px;
      height: auto !important; top: auto;
      overflow: hidden;
      display: flex;
      flex-direction: row;
    }
    body.hw-plugin .file-rail {
      width: var(--file-rail-w, 200px);
      flex: 0 0 var(--file-rail-w, 200px);
      border-right: 1px solid rgba(255,255,255,.1);
      display: flex;
      flex-direction: column;
      min-height: 0;
    }
    .hw-branch-rail {
      flex: 0 0 auto;
      max-height: 38%;
      overflow-y: auto;
      border-bottom: 1px solid rgba(255,255,255,.12);
      padding: 6px 0 4px;
      background: #0c0d10;
    }
    .hw-branch-rail__title {
      padding: 2px 10px 6px;
      font: 600 10px/1.2 Inter, system-ui, sans-serif;
      letter-spacing: 0.06em;
      text-transform: uppercase;
      color: #9aa3b2;
    }
    .hw-branch-rail__item {
      display: block;
      width: 100%;
      text-align: left;
      border: none;
      background: transparent;
      color: #c4cad6;
      font: 500 11px/1.35 'JetBrains Mono', ui-monospace, monospace;
      padding: 4px 10px;
      cursor: pointer;
    }
    .hw-branch-rail__item:hover { background: rgba(255,255,255,.06); }
    .hw-branch-rail__item--current { color: #fbbf24; }
    .hw-branch-rail__item--current::before { content: '● '; color: #f97316; }
    .hw-branch-rail__item--focus { background: rgba(109,126,232,.22); color: #fff; }
    .hw-branch-rail__item--merged { opacity: 0.72; }
    .hw-branch-rail__item--muted { opacity: 0.45; font-style: italic; }
    .hw-branch-rail__hint { padding: 0 10px 6px; font-size: 9px; color: #6b7280; }
    .hw-branch-rail__item { display: flex; align-items: center; gap: 6px; }
    .hw-branch-rail__check { flex: 0 0 14px; color: #8b97ff; font-size: 10px; text-align: center; }
    .hw-branch-rail__item--fuse-pick { background: rgba(139,151,255,.14); color: #e8ecff; }
    .hw-fuse-bar {
      flex: 0 0 auto;
      padding: 8px 10px;
      border-bottom: 1px solid rgba(139,151,255,.35);
      background: linear-gradient(180deg, rgba(109,126,232,.12), #0c0d10);
    }
    .hw-fuse-bar__title { font: 600 10px/1.2 Inter,sans-serif; color: #a5b4fc; text-transform: uppercase; letter-spacing: .05em; }
    .hw-fuse-bar__count { display: block; font-size: 11px; color: #e5e7eb; margin-top: 2px; }
    .hw-fuse-bar__names { display: block; font: 10px/1.35 'JetBrains Mono',monospace; color: #9ca3af; margin-top: 2px; }
    .hw-fuse-bar__actions { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 8px; }
    .hw-plugin .stage.hw-fuse-pulse::after {
      content: '';
      position: absolute;
      inset: 0;
      pointer-events: none;
      z-index: 40;
      background: linear-gradient(105deg, transparent, rgba(251,191,36,.2), transparent);
      animation: hw-fuse-sweep 1.2s ease-in-out;
    }
    @keyframes hw-fuse-sweep {
      0% { transform: translateX(-100%); opacity: 0; }
      20% { opacity: 1; }
      100% { transform: translateX(100%); opacity: 0; }
    }
    body.hw-plugin .file-rail__inner {
      flex: 1 1 auto;
      min-height: 0;
      overflow-y: auto;
    }
    body.hw-plugin .graph-viewport {
      flex: 1 1 auto;
      min-width: 0;
    }
    .hw-stage-head {
      flex: 0 0 28px;
      display: flex;
      align-items: stretch;
      border-bottom: 1px solid rgba(255,255,255,.1);
      background: #0a0b0e;
      font: 600 11px/1 Inter, sans-serif;
      color: #9aa3b2;
      user-select: none;
    }
    .hw-stage-head__files {
      flex: 0 0 var(--file-rail-w, 200px);
      display: flex; align-items: center;
      padding: 0 12px;
      border-right: 1px solid rgba(255,255,255,.1);
      color: #e8eaed;
    }
    .hw-stage-head__lanes {
      flex: 1 1 auto;
      display: flex; align-items: center;
      padding: 0 12px;
      color: #e8eaed;
    }
    .hw-stage-head__hint {
      margin-left: auto;
      font-weight: 400;
      font-size: 10px;
      color: #6b7280;
    }
    body.hw-plugin .file-rail__item--folder { cursor: pointer; }
    body.hw-plugin .file-rail__item--folder-header { cursor: default; }
    body.hw-plugin .file-rail__item--folder:hover { background: rgba(255,255,255,.06); }
    .hw-terminal {
      flex: 0 0 min(38vh, 280px);
      display: flex; flex-direction: column;
      border-top: 1px solid rgba(255,255,255,.1);
      background: #07080a;
      min-height: 0;
      overflow: hidden;
    }
    .hw-terminal[hidden] { display: none !important; }
    .hw-terminal__body {
      flex: 1 1 auto; min-height: 0;
      padding: 4px 8px 6px;
      overflow: hidden;
    }
    .hw-terminal__body .xterm { height: 100%; }
    .hw-terminal__body .xterm-viewport { overflow-y: auto !important; }
    .hw-dock {
      flex: 0 0 32px;
      display: flex; align-items: center;
      padding: 0 10px;
      border-top: 1px solid rgba(255,255,255,.08);
      background: #0a0b0e;
    }
    .hw-dock__btn {
      display: inline-flex; align-items: center; gap: 6px;
      padding: 4px 10px; border-radius: 5px;
      border: 1px solid rgba(255,255,255,.12);
      background: transparent; color: #c4cad6;
      font: 500 11px Inter, sans-serif; cursor: pointer;
    }
    .hw-dock__btn:hover { background: rgba(255,255,255,.06); color: #fff; }
    .hw-dock__btn--active {
      background: rgba(109,124,232,.22);
      border-color: #6d7ce8; color: #e8eaed;
    }
    .hw-dock__btn-icon { font-family: 'JetBrains Mono', monospace; font-size: 11px; opacity: .85; }
    .plugin-bar {
      display: flex; align-items: center; gap: 8px; flex-wrap: wrap;
      padding: 6px 12px; border-bottom: 1px solid rgba(255,255,255,.08);
      font: 500 12px/1.4 Inter, sans-serif; color: #9aa3b2;
    }
    .plugin-bar strong { color: #e8eaed; font-weight: 600; }
    .plugin-bar__tagline { font-size: 10px; font-weight: 600; color: #a5b4fc; letter-spacing: 0.04em; }
    .plugin-bar code { font-family: 'JetBrains Mono', monospace; font-size: 11px; color: #6d7ce8; }
    .modal__btn-run { margin-left: 8px; }
    .commit-prompt {
      position: fixed; inset: 0; z-index: 100;
      display: flex; align-items: center; justify-content: center;
      background: rgba(7, 8, 10, 0.82); padding: 16px; box-sizing: border-box;
    }
    .commit-prompt[hidden] { display: none !important; }
    .commit-prompt__card {
      width: min(360px, 100%); background: #12141a; border: 1px solid rgba(255,255,255,.1);
      border-radius: 10px; padding: 20px; box-shadow: 0 12px 40px rgba(0,0,0,.45);
    }
    .commit-prompt__title { margin: 0 0 8px; font-size: 16px; font-weight: 600; color: #f97316; }
    .commit-prompt__desc { margin: 0 0 14px; font-size: 13px; line-height: 1.5; color: #9aa3b2; }
    .commit-prompt__desc code { font-family: 'JetBrains Mono', monospace; font-size: 11px; color: #c4cad6; }
    .commit-prompt__label {
      display: block; margin: 0 0 4px; font-size: 11px; font-weight: 500; color: #9aa3b2;
    }
    .commit-prompt__field { margin-bottom: 10px; }
    .commit-prompt__hint { margin: -4px 0 10px; font-size: 11px; color: #6b7280; }
    .commit-prompt__input {
      width: 100%; box-sizing: border-box;
      padding: 10px 12px; border-radius: 6px; border: 1px solid rgba(255,255,255,.12);
      background: #07080a; color: #e8eaed; font: 400 13px/1.4 Inter, sans-serif;
    }
    .commit-prompt__input:focus { outline: 1px solid #6d7ce8; border-color: #6d7ce8; }
    .commit-prompt__btn {
      width: 100%; padding: 10px 16px; border: none; border-radius: 6px;
      background: #6d7ce8; color: #fff; font: 600 13px Inter, sans-serif; cursor: pointer;
    }
    .commit-prompt__btn:disabled { opacity: 0.55; cursor: not-allowed; }
    .commit-prompt__btn:not(:disabled):hover { filter: brightness(1.08); }
    .commit-prompt__error { margin: 0 0 10px; font-size: 12px; color: #f87171; min-height: 1.2em; }
    .plugin-bar__btn {
      margin-left: auto; padding: 4px 10px; border-radius: 5px; border: 1px solid rgba(255,255,255,.14);
      background: transparent; color: #c4cad6; font: 500 11px Inter, sans-serif; cursor: pointer;
    }
    .plugin-bar__btn:hover { background: rgba(255,255,255,.06); color: #fff; }
    .plugin-bar__git {
      display: flex; align-items: center; gap: 6px; flex-wrap: wrap;
      font-size: 11px; color: #9aa3b2;
    }
    .plugin-bar__git code { font-family: 'JetBrains Mono', monospace; font-size: 10px; color: #6d7ce8; }
    .plugin-bar__git .git-ok { color: #4ade80; }
    .plugin-bar__git .git-warn { color: #fbbf24; }
    .plugin-bar__actions { display: flex; gap: 6px; margin-left: auto; flex-shrink: 0; }
    .plugin-bar__actions .plugin-bar__btn { margin-left: 0; }
    .plugin-bar__btn--primary { background: #6d7ce8; border-color: transparent; color: #fff; }
    .plugin-bar__btn--primary:hover { filter: brightness(1.08); color: #fff; }
    .plugin-bar__btn--accent {
      background: rgba(251, 146, 60, 0.22);
      border-color: rgba(251, 146, 60, 0.55);
      color: #fdba74;
    }
    .plugin-bar__btn--accent:hover { background: rgba(251, 146, 60, 0.35); color: #ffedd5; }
    body.hw-plugin .hw-boundary .plugin-bar__btn { margin-left: 0; }
    .hw-whip-btn {
      display: inline-flex; align-items: center; justify-content: center;
      padding: 2px 10px; min-width: 36px; line-height: 0;
    }
    .hw-whip-btn__svg, .hw-whip-float__svg {
      overflow: visible;
      filter: drop-shadow(0 1px 3px rgba(0, 0, 0, 0.45));
    }
    .hw-whip-btn__svg { width: 22px; height: 18px; }
    .hw-whip-icon__lash { transform-origin: -5.5px 3.45px; transform-box: fill-box; }
    .hw-whip-icon__lash path[fill="#f97316"] { transition: fill 0.15s ease; }
    .hw-whip-btn--crack .hw-whip-icon__lash {
      animation: whip-crack 0.38s cubic-bezier(0.34, 1.4, 0.64, 1);
    }
    .hw-whip-btn--crack .hw-whip-icon__spark {
      animation: whip-spark 0.38s ease-out;
    }
    .hw-whip-btn:hover .hw-whip-icon__lash path[fill="#f97316"] { fill: #fbbf24; }
    .hw-whip-float {
      position: fixed; right: 20px; bottom: 52px; left: auto; top: auto;
      z-index: 10050; pointer-events: none;
    }
    .hw-whip-float:not([hidden]) { pointer-events: auto; }
    .hw-whip-float__btn {
      display: block; padding: 8px; margin: 0; border: none; background: transparent;
      cursor: pointer; line-height: 0;
    }
    .hw-whip-float__svg {
      width: 84px; height: 66px; display: block;
      filter: drop-shadow(0 2px 8px rgba(0, 0, 0, 0.5));
    }
    .hw-whip-float--crack .hw-whip-icon__lash {
      animation: whip-crack-float 0.52s cubic-bezier(0.22, 1.45, 0.36, 1);
    }
    .hw-whip-float--crack .hw-whip-icon__spark {
      animation: whip-spark-float 0.52s ease-out;
    }
    .hw-whip-float__btn:hover .hw-whip-icon__lash path[fill="#f97316"] { fill: #fbbf24; }
    .hw-whip-float__btn:hover .hw-whip-float__svg {
      filter: drop-shadow(0 0 14px rgba(249, 115, 22, 0.7));
    }
    @keyframes whip-crack {
      0% { transform: rotate(0deg); }
      22% { transform: rotate(-42deg); }
      48% { transform: rotate(18deg); }
      72% { transform: rotate(-10deg); }
      100% { transform: rotate(0deg); }
    }
    @keyframes whip-spark {
      0%, 100% { opacity: 1; }
      35% { opacity: 1; transform: scale(1.7); }
      60% { opacity: 0.5; }
    }
    @keyframes whip-crack-float {
      0% { transform: rotate(0deg); }
      18% { transform: rotate(-56deg); }
      42% { transform: rotate(26deg); }
      65% { transform: rotate(-16deg); }
      82% { transform: rotate(8deg); }
      100% { transform: rotate(0deg); }
    }
    @keyframes whip-spark-float {
      0%, 100% { opacity: 1; transform: scale(1); }
      28% { opacity: 1; transform: scale(2.4); }
      55% { opacity: 0.55; transform: scale(1.5); }
    }
    .remote-wizard {
      position: fixed; inset: 0; z-index: 110;
      display: flex; align-items: center; justify-content: center;
      background: rgba(7, 8, 10, 0.88); padding: 16px; box-sizing: border-box;
    }
    .remote-wizard[hidden] { display: none !important; }
    .remote-wizard__card {
      width: min(420px, 100%); max-height: 90vh; overflow-y: auto;
      background: #12141a; border: 1px solid rgba(255,255,255,.1);
      border-radius: 10px; padding: 20px; box-shadow: 0 12px 40px rgba(0,0,0,.45);
    }
    .remote-wizard__title { margin: 0 0 8px; font-size: 16px; font-weight: 600; color: #f97316; }
    .remote-wizard__desc { margin: 0 0 12px; font-size: 13px; line-height: 1.55; color: #9aa3b2; }
    .remote-wizard__desc code, .remote-wizard__steps code { font-family: 'JetBrains Mono', monospace; font-size: 11px; color: #c4cad6; }
    .remote-wizard__steps { margin: 0 0 12px; padding-left: 18px; font-size: 12px; line-height: 1.6; color: #9aa3b2; }
    .remote-wizard__status { margin: 0 0 10px; font-size: 12px; color: #6d7ce8; }
    .remote-wizard__error { margin: 0 0 10px; font-size: 12px; color: #f87171; min-height: 1.2em; }
    .remote-wizard__pubkey {
      width: 100%; box-sizing: border-box; min-height: 72px; margin-bottom: 8px;
      padding: 8px 10px; border-radius: 6px; border: 1px solid rgba(255,255,255,.12);
      background: #07080a; color: #c4cad6; font: 400 11px/1.45 'JetBrains Mono', monospace;
      resize: vertical;
    }
    .remote-wizard__field { margin-bottom: 10px; }
    .remote-wizard__label { display: block; margin-bottom: 4px; font-size: 11px; color: #9aa3b2; }
    .remote-wizard__input {
      width: 100%; box-sizing: border-box; padding: 9px 11px; border-radius: 6px;
      border: 1px solid rgba(255,255,255,.12); background: #07080a; color: #e8eaed;
      font: 400 13px/1.4 Inter, sans-serif;
    }
    .remote-wizard__row { display: flex; gap: 8px; flex-wrap: wrap; margin-top: 12px; }
    .remote-wizard__btn {
      flex: 1; min-width: 120px; padding: 9px 14px; border-radius: 6px; border: none;
      background: #6d7ce8; color: #fff; font: 600 12px Inter, sans-serif; cursor: pointer;
    }
    .remote-wizard__btn--ghost { background: transparent; border: 1px solid rgba(255,255,255,.14); color: #c4cad6; }
    .remote-wizard__btn:disabled { opacity: 0.55; cursor: not-allowed; }
    .remote-wizard__panel[hidden] { display: none !important; }
  </style>
</head>
<body class="hw-plugin hw-per-lane-v">
  <div class="plugin-bar">
    <strong>Horsewhip</strong>
    <span class="plugin-bar__tagline">AI 边界</span>
    <span class="plugin-bar__sep">·</span>
    <span>工作区 <code>${workspaceLabel}</code></span>
    <span class="plugin-bar__sep">·</span>
    <span id="plugin-open-status">同步资源管理器目录层级…</span>
    <span class="plugin-bar__git" id="plugin-git-status">
      <span>分支 <code id="plugin-branch">—</code></span>
      <span class="plugin-bar__sep">·</span>
      <span id="plugin-remote-label" class="git-warn">未连接 remote</span>
    </span>
    <span class="plugin-bar__sep">·</span>
    <span class="plugin-guard" id="plugin-guard">
      <span class="plugin-guard__status plugin-guard__status--idle" id="plugin-guard-status">守门 · 未划定</span>
      <button type="button" class="plugin-bar__btn" id="btn-guard-check" title="对比 git 改动与泳道边界">检查越界</button>
      <button type="button" class="plugin-bar__btn" id="btn-guard-correct" hidden title="把越界纠正文案插入 Chat">插入纠正</button>
      <button type="button" class="plugin-bar__btn" id="btn-guard-revert" hidden title="还原越界文件到 HEAD">还原越界</button>
    </span>
    <div class="plugin-bar__actions">
      <button type="button" class="plugin-bar__btn plugin-bar__btn--accent" id="btn-restore-env" hidden title="从预览 commit 回到之前的分支（git switch -）">恢复工作区</button>
      <button type="button" class="plugin-bar__btn" id="btn-commit-open" hidden title="提交当前更改">提交</button>
      <button type="button" class="plugin-bar__btn" id="btn-open-github" hidden title="在浏览器打开 GitHub 仓库">GitHub</button>
      <button type="button" class="plugin-bar__btn" id="btn-remote-setup">发布</button>
    </div>
  </div>
  <div class="hw-boundary" id="hw-boundary" hidden>
    <div class="hw-boundary__info">
      <strong class="hw-boundary__title">本次边界</strong>
      <span class="hw-boundary__count" id="hw-boundary-count">0 个文件</span>
      <span class="hw-boundary__files" id="hw-boundary-files"></span>
    </div>
    <div class="hw-boundary__actions">
      <button type="button" class="plugin-bar__btn" id="btn-boundary-clear">清空</button>
      <button type="button" class="plugin-bar__btn hw-whip-btn" id="btn-boundary-copy" title="复制约束" aria-label="复制约束"></button>
      <button type="button" class="plugin-bar__btn plugin-bar__btn--primary" id="btn-boundary-chat">插入 Chat</button>
    </div>
    <pre class="hw-boundary__preview" id="hw-boundary-preview" hidden></pre>
  </div>
  <div class="hw-workspace" id="hw-workspace">
  <div class="hw-stage-head" aria-hidden="false">
    <div class="hw-stage-head__files">分支 · 文件</div>
    <div class="hw-stage-head__lanes">
      泳道
      <span class="hw-stage-head__hint">点文件聚焦 · 点泳道节点操作 · horsewhip 复制</span>
    </div>
  </div>
  <main class="stage" id="stage">
    <aside class="file-rail" id="file-rail" aria-label="Files">
      <div class="hw-branch-rail" id="branch-rail" hidden aria-label="Git branches"></div>
      <div class="hw-fuse-bar" id="hw-fuse-bar" hidden>
        <div class="hw-fuse-bar__info">
          <strong class="hw-fuse-bar__title">分支融合</strong>
          <span class="hw-fuse-bar__count" id="hw-fuse-count"></span>
          <span class="hw-fuse-bar__names" id="hw-fuse-names"></span>
        </div>
        <div class="hw-fuse-bar__actions">
          <button type="button" class="plugin-bar__btn" id="btn-fuse-clear">清空</button>
          <button type="button" class="plugin-bar__btn hw-whip-btn" id="btn-fuse-copy" title="复制融合任务" aria-label="复制融合任务"></button>
          <button type="button" class="plugin-bar__btn plugin-bar__btn--primary" id="btn-fuse-chat">AI 融合 → 主泳道</button>
        </div>
      </div>
      <div class="file-rail__inner" id="file-rail-inner"></div>
    </aside>
    <section class="graph-viewport" id="graph-viewport" tabindex="0" aria-label="泳道时间线">
      <div class="graph-scroll" id="graph-scroll">
        <svg id="graph-svg" class="graph-svg" role="img" aria-label="Version timeline"></svg>
      </div>
      <div class="graph-empty" id="graph-empty">
        <p class="graph-empty__title">划定边界，再让 AI 动手</p>
        <p class="graph-empty__desc">正在同步泳道与分支…</p>
      </div>
      <div class="graph-hint" id="graph-hint" hidden>
        <span class="graph-hint__item">首屏 HEAD</span>
        <span class="graph-hint__sep">·</span>
        <span class="graph-hint__item">双击详情</span>
      </div>
      <div class="graph-zoom" id="graph-zoom" hidden>
        <button type="button" class="btn btn--icon hw-sound-btn" id="btn-whip-sound" title="关闭挥鞭音效" aria-pressed="false" aria-label="关闭挥鞭音效">
          <span class="hw-sound__on" aria-hidden="true">🔊</span>
          <span class="hw-sound__off" hidden aria-hidden="true">🔇</span>
        </button>
        <span class="graph-zoom__sep" aria-hidden="true"></span>
        <button type="button" class="btn btn--icon" id="btn-zoom-out" title="缩小">−</button>
        <span class="graph-zoom__label" id="zoom-label">100%</span>
        <button type="button" class="btn btn--icon" id="btn-zoom-in" title="放大">+</button>
      </div>
    </section>
  </main>
  <div class="hw-terminal" id="hw-terminal" hidden>
    <div id="hw-terminal-host" class="hw-terminal__body"></div>
  </div>
  <footer class="hw-dock">
    <button type="button" class="hw-dock__btn" id="btn-toggle-terminal" title="打开/关闭终端" aria-pressed="false">
      <span class="hw-dock__btn-icon">&gt;_</span> 终端
    </button>
  </footer>
  </div>
  <div class="toast toast--error" id="parse-error" hidden></div>
  <div class="toast toast--warn toast--pager" id="large-data-warn" hidden>
    <span id="large-warn-text"></span>
    <button type="button" class="btn btn--compact" id="btn-load-more-commits" hidden>+100</button>
  </div>
  <aside class="constraint-panel" id="link-panel" hidden>
    <p class="constraint-panel__label">constraint</p>
    <pre class="constraint-panel__text" id="link-constraint-text"></pre>
    <button type="button" class="btn btn--solid btn--block" id="btn-copy-link">copy</button>
  </aside>
  <div class="modal-backdrop" id="modal-backdrop" hidden>
    <div class="modal" role="dialog" aria-modal="true">
      <header class="modal__header">
        <div>
          <h2 class="modal__title" id="modal-title"></h2>
          <p class="modal__meta" id="modal-meta"></p>
          <p class="modal__file" id="modal-file"></p>
        </div>
        <button type="button" class="btn btn--icon modal__close" id="modal-close">×</button>
      </header>
      <section class="modal__section">
        <h3 class="modal__section-title">constraint</h3>
        <pre class="modal__code modal__code--constraint" id="modal-constraint"></pre>
      </section>
      <section class="modal__section modal__section--actions">
        <button type="button" class="btn btn--solid btn--block modal__btn-run" id="btn-run-preview">检出并运行</button>
      </section>
    </div>
  </div>
  <div class="commit-prompt" id="commit-prompt" hidden>
    <div class="commit-prompt__card">
      <h2 class="commit-prompt__title" id="commit-title">创建首次 commit</h2>
      <p class="commit-prompt__desc" id="commit-desc">No commits yet — Horsewhip needs at least one commit to draw the timeline. Fill in author info and commit (<code>git add -A</code>; author info is saved to <strong>this repo only</strong>).</p>
      <p class="commit-prompt__error" id="commit-error"></p>
      <div class="commit-prompt__field">
        <label class="commit-prompt__label" for="commit-author-name">Git 用户名</label>
        <input type="text" class="commit-prompt__input" id="commit-author-name" placeholder="例如：Su" autocomplete="name">
      </div>
      <div class="commit-prompt__field">
        <label class="commit-prompt__label" for="commit-author-email">Git 邮箱</label>
        <input type="email" class="commit-prompt__input" id="commit-author-email" placeholder="例如：you@example.com" autocomplete="email">
      </div>
      <p class="commit-prompt__hint">仅保存在当前项目的 <code>.git/config</code>，不修改全局设置</p>
      <div class="commit-prompt__field">
        <label class="commit-prompt__label" for="commit-message">Commit 说明</label>
        <input type="text" class="commit-prompt__input" id="commit-message" placeholder="例如：initial commit" autocomplete="off">
      </div>
      <button type="button" class="commit-prompt__btn" id="btn-commit">提交</button>
    </div>
  </div>
  <div class="remote-wizard" id="remote-wizard" hidden>
    <div class="remote-wizard__card">
      <div class="remote-wizard__panel" id="remote-panel-ask">
        <h2 class="remote-wizard__title">发布到 GitHub</h2>
        <p class="remote-wizard__desc">是否使用 <strong>SSH</strong> 连接 GitHub？（推荐，地址形如 <code>git@github.com:用户/仓库.git</code>）</p>
        <p class="remote-wizard__error" id="remote-error"></p>
        <div class="remote-wizard__row">
          <button type="button" class="remote-wizard__btn" id="remote-btn-use-ssh">使用 SSH</button>
          <button type="button" class="remote-wizard__btn remote-wizard__btn--ghost" id="remote-btn-skip">暂不发布</button>
        </div>
      </div>
      <div class="remote-wizard__panel" id="remote-panel-ssh" hidden>
        <h2 class="remote-wizard__title">配置 SSH</h2>
        <p class="remote-wizard__status" id="remote-ssh-status">检测中…</p>
        <ol class="remote-wizard__steps">
          <li>点击下方「生成 / 复制公钥」</li>
          <li>打开 <strong>GitHub → Settings → SSH and GPG keys → New SSH key</strong></li>
          <li>Title 随意，Key 里 <strong>粘贴</strong> 复制的公钥 → Add SSH key</li>
          <li>Return to Horsewhip and click «Detect SSH»</li>
        </ol>
        <textarea class="remote-wizard__pubkey" id="remote-pubkey" readonly placeholder="公钥将显示在这里…"></textarea>
        <div class="remote-wizard__row">
          <button type="button" class="remote-wizard__btn" id="remote-btn-gen-key">生成 / 复制公钥</button>
          <button type="button" class="remote-wizard__btn remote-wizard__btn--ghost" id="remote-btn-test-ssh">检测 SSH</button>
        </div>
        <div class="remote-wizard__row">
          <button type="button" class="remote-wizard__btn" id="remote-btn-ssh-next" disabled>SSH 已就绪，下一步</button>
        </div>
      </div>
      <div class="remote-wizard__panel" id="remote-panel-repo" hidden>
        <h2 class="remote-wizard__title">远程仓库</h2>
        <p class="remote-wizard__desc">Use an existing SSH remote URL, or let Horsewhip create a new <strong>public</strong> GitHub repo named after your <strong>project folder</strong>.</p>
        <div class="remote-wizard__field">
          <label class="remote-wizard__label"><input type="radio" name="remote-mode" id="remote-mode-existing" value="existing" checked> 已有仓库地址</label>
        </div>
        <input type="text" class="remote-wizard__input" id="remote-repo-url" placeholder="git@github.com:用户名/仓库.git">
        <div class="remote-wizard__field" style="margin-top:12px">
          <label class="remote-wizard__label"><input type="radio" name="remote-mode" id="remote-mode-create" value="create"> 新建开源仓库</label>
        </div>
        <div id="remote-create-fields">
          <div class="remote-wizard__field">
            <label class="remote-wizard__label" for="remote-github-user">GitHub 用户名</label>
            <input type="text" class="remote-wizard__input" id="remote-github-user" placeholder="例如：waitamomentC">
          </div>
          <div class="remote-wizard__field">
            <label class="remote-wizard__label" for="remote-repo-name">仓库名（默认项目名）</label>
            <input type="text" class="remote-wizard__input" id="remote-repo-name" placeholder="TEXT">
          </div>
          <div class="remote-wizard__field">
            <label class="remote-wizard__label" for="remote-github-token">GitHub Token（未安装 gh 时需要）</label>
            <input type="password" class="remote-wizard__input" id="remote-github-token" placeholder="ghp_… 或 github_pat_…" autocomplete="off">
          </div>
          <p class="remote-wizard__desc" style="margin-top:0;font-size:11px">已安装并登录 <code>gh</code> 时可留空 Token。</p>
        </div>
        <p class="remote-wizard__error" id="remote-repo-error"></p>
        <div class="remote-wizard__row">
          <button type="button" class="remote-wizard__btn" id="remote-btn-publish">添加 remote 并 push</button>
        </div>
      </div>
      <div class="remote-wizard__panel" id="remote-panel-done" hidden>
        <h2 class="remote-wizard__title">发布成功</h2>
        <p class="remote-wizard__desc" id="remote-done-desc"></p>
        <div class="remote-wizard__row">
          <button type="button" class="remote-wizard__btn" id="remote-btn-open-github">在浏览器打开 GitHub</button>
          <button type="button" class="remote-wizard__btn remote-wizard__btn--ghost" id="remote-btn-done">完成</button>
        </div>
      </div>
    </div>
  </div>
  <div class="tooltip" id="tooltip" hidden></div>
  <script>
    window.addEventListener('error', function (e) {
      var t = e && e.target;
      if (t && t.tagName === 'SCRIPT' && t.src) {
        window.__horsewhipBootError = '脚本加载失败: ' + t.src;
      }
    }, true);
  </script>
  <script src="${u('d3.min.js')}"></script>
  <script src="${u('demo-data.js')}"></script>
  <script src="${u('script.js')}"></script>
  <script>
    if (typeof d3 === 'undefined' && !window.__horsewhipBootError) {
      window.__horsewhipBootError = 'd3.min.js 未加载，请确认 extension/media/d3.min.js 存在并已 npm run build:extension';
    } else if (!window.HorsewhipApp && !window.__horsewhipBootError) {
      window.__horsewhipBootError = 'script.js 未执行（文件缺失或运行时报错）。仓库根目录执行 npm run build:extension 后 F5';
    }
  </script>
  <script src="${u('panel-bridge.js')}"></script>
  <script src="${u('remote-wizard.js')}"></script>
  <script src="${u('terminal-bridge.js')}"></script>
  <script async src="https://cdn.jsdelivr.net/npm/@xterm/xterm@5.5.0/lib/xterm.min.js"></script>
  <script async src="https://cdn.jsdelivr.net/npm/@xterm/addon-fit@0.10.0/lib/addon-fit.min.js"></script>
</body>
</html>`;
}
