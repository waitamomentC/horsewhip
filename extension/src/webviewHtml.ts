import * as vscode from 'vscode';

function uriFor(webview: vscode.Webview, extensionUri: vscode.Uri, name: string): string {
  return webview.asWebviewUri(vscode.Uri.joinPath(extensionUri, 'media', name)).toString();
}

function csp(webview: vscode.Webview): string {
  return [
    "default-src 'none'",
    `font-src ${webview.cspSource} https://fonts.gstatic.com`,
    `style-src ${webview.cspSource} 'unsafe-inline' https://fonts.googleapis.com`,
    `script-src ${webview.cspSource} https://d3js.org 'unsafe-inline'`,
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
    ? `马鞭只读取<strong>当前工作区</strong>里的 Git 版本历史。${folderName ? `文件夹 <code>${folderName}</code> ` : ''}还没有 <code>.git</code>，请先在项目根目录执行：<br><br><code>git init</code>`
    : '请通过菜单 <strong>文件 → 打开文件夹</strong> 选择一个项目目录，马鞭只会分析该工作区内的文件。';
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
    <h1>马鞭 · Horsewhip</h1>
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
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500&family=Inter:wght@400;500;600&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="${u('style.css')}">
  <style>
    body.hw-plugin .header, body.hw-plugin .paste-drop { display: none !important; }
    body.hw-plugin .file-rail { display: none !important; }
    body.hw-plugin .stage { top: 0; height: 100vh; }
    body.hw-plugin .graph-viewport { flex: 1; min-width: 0; }
    body.hw-plugin .lane-label-plugin { pointer-events: none; user-select: none; }
    .plugin-bar {
      display: flex; align-items: center; gap: 8px; flex-wrap: wrap;
      padding: 6px 12px; border-bottom: 1px solid rgba(255,255,255,.08);
      font: 500 12px/1.4 Inter, sans-serif; color: #9aa3b2;
    }
    .plugin-bar strong { color: #e8eaed; font-weight: 600; }
    .plugin-bar code { font-family: 'JetBrains Mono', monospace; font-size: 11px; color: #6d7ce8; }
    .modal__btn-run { margin-left: 8px; }
  </style>
</head>
<body class="hw-plugin">
  <div class="plugin-bar">
    <strong>马鞭</strong>
    <span>工作区 <code>${workspaceLabel}</code></span>
    <span class="plugin-bar__sep">·</span>
    <span id="plugin-open-status">在编辑器中打开文件以显示泳道</span>
  </div>
  <main class="stage" id="stage">
    <section class="graph-viewport" id="graph-viewport" tabindex="0">
      <div class="graph-scroll" id="graph-scroll">
        <svg id="graph-svg" class="graph-svg" role="img" aria-label="Version timeline"></svg>
      </div>
      <div class="graph-empty" id="graph-empty">
        <p class="graph-empty__title">加载中…</p>
        <p class="graph-empty__desc">正在读取 git log</p>
      </div>
      <div class="graph-hint" id="graph-hint" hidden>
        <span class="graph-hint__item">首屏 HEAD</span>
        <span class="graph-hint__sep">·</span>
        <span class="graph-hint__item">双击 rollback</span>
      </div>
      <div class="graph-zoom" id="graph-zoom" hidden>
        <button type="button" class="btn btn--icon" id="btn-zoom-out" title="缩小">−</button>
        <span class="graph-zoom__label" id="zoom-label">100%</span>
        <button type="button" class="btn btn--icon" id="btn-zoom-in" title="放大">+</button>
      </div>
    </section>
  </main>
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
        <pre class="modal__code" id="modal-constraint"></pre>
        <button type="button" class="btn btn--solid" id="btn-copy-constraint">copy</button>
      </section>
      <section class="modal__section">
        <h3 class="modal__section-title">rollback</h3>
        <p class="modal__label">① file only</p>
        <pre class="modal__code" id="modal-cmd-file"></pre>
        <button type="button" class="btn" id="btn-copy-checkout">copy checkout</button>
        <button type="button" class="btn btn--solid modal__btn-run" id="btn-run-checkout">执行 checkout</button>
        <p class="modal__label modal__label--danger">② reset entire repo</p>
        <button type="button" class="btn" id="btn-toggle-reset">confirm</button>
        <div class="rollback-danger" id="rollback-danger" hidden>
          <label for="reset-confirm">type RESET</label>
          <input type="text" id="reset-confirm" class="input-inline" placeholder="RESET" autocomplete="off">
          <pre class="modal__code" id="modal-cmd-reset"></pre>
          <button type="button" class="btn" id="btn-copy-reset">copy reset</button>
          <button type="button" class="btn btn--danger modal__btn-run" id="btn-run-reset" disabled>执行 reset --hard</button>
        </div>
      </section>
    </div>
  </div>
  <div class="tooltip" id="tooltip" hidden></div>
  <script src="https://d3js.org/d3.v7.min.js"></script>
  <script src="${u('demo-data.js')}"></script>
  <script src="${u('script.js')}"></script>
  <script src="${u('panel-bridge.js')}"></script>
</body>
</html>`;
}
