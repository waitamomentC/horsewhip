/**
 * GitHub SSH publish wizard (webview).
 */
(function () {
  const vscode = typeof acquireVsCodeApi === 'function' ? acquireVsCodeApi() : null;

  const panels = {
    ask: 'remote-panel-ask',
    ssh: 'remote-panel-ssh',
    repo: 'remote-panel-repo',
    done: 'remote-panel-done',
  };

  let wizardData = { projectName: '', githubUser: '', ghAvailable: false };
  let lastHtmlUrl = '';

  function $(id) { return document.getElementById(id); }

  function showPanel(name) {
    Object.entries(panels).forEach(([key, id]) => {
      const el = $(id);
      if (el) el.hidden = key !== name;
    });
  }

  function openWizard(data) {
    wizardData = { ...wizardData, ...data };
    const err = $('remote-error');
    if (err) err.textContent = '';
    const repoName = $('remote-repo-name');
    if (repoName instanceof HTMLInputElement && data.projectName) {
      repoName.value = data.projectName;
    }
    const ghUser = $('remote-github-user');
    if (ghUser instanceof HTMLInputElement && data.githubUser) {
      ghUser.value = data.githubUser;
    }
  }

  function showWizard() {
    const w = $('remote-wizard');
    if (w) w.hidden = false;
    showPanel('ask');
  }

  function hideWizard() {
    const w = $('remote-wizard');
    if (w) w.hidden = true;
  }

  async function copyText(text) {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      const ta = document.createElement('textarea');
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
    }
  }

  function wireWizard() {
    $('remote-btn-skip')?.addEventListener('click', hideWizard);

    $('remote-btn-use-ssh')?.addEventListener('click', () => {
      showPanel('ssh');
      if (vscode) vscode.postMessage({ type: 'remoteTestSsh' });
    });

    $('remote-btn-test-ssh')?.addEventListener('click', () => {
      if (vscode) vscode.postMessage({ type: 'remoteTestSsh' });
    });

    $('remote-btn-gen-key')?.addEventListener('click', () => {
      if (vscode) vscode.postMessage({ type: 'remoteGenerateKey' });
    });

    $('remote-btn-ssh-next')?.addEventListener('click', () => {
      showPanel('repo');
    });

    $('remote-btn-done')?.addEventListener('click', hideWizard);

    $('remote-btn-open-github')?.addEventListener('click', () => {
      if (lastHtmlUrl && vscode) {
        vscode.postMessage({ type: 'openExternalUrl', url: lastHtmlUrl });
      }
    });

    $('btn-remote-setup')?.addEventListener('click', () => {
      if (vscode) vscode.postMessage({ type: 'remoteWizardOpen' });
    });

    $('remote-btn-publish')?.addEventListener('click', () => {
      const modeCreate = $('remote-mode-create');
      const isCreate = modeCreate instanceof HTMLInputElement && modeCreate.checked;
      const repoUrlEl = $('remote-repo-url');
      const userEl = $('remote-github-user');
      const nameEl = $('remote-repo-name');
      const tokenEl = $('remote-github-token');
      const err = $('remote-repo-error');
      if (err) err.textContent = '';

      if (isCreate) {
        const githubUser = userEl instanceof HTMLInputElement ? userEl.value.trim() : '';
        const repoName = nameEl instanceof HTMLInputElement ? nameEl.value.trim() : '';
        const token = tokenEl instanceof HTMLInputElement ? tokenEl.value.trim() : '';
        if (!githubUser) {
          if (err) err.textContent = '请填写 GitHub 用户名';
          return;
        }
        if (!repoName) {
          if (err) err.textContent = '请填写仓库名';
          return;
        }
        if (vscode) {
          vscode.postMessage({
            type: 'remotePublish',
            mode: 'create',
            githubUser,
            repoName,
            token: token || undefined,
          });
        }
      } else {
        const repoUrl = repoUrlEl instanceof HTMLInputElement ? repoUrlEl.value.trim() : '';
        if (!repoUrl) {
          if (err) err.textContent = '请填写 SSH 仓库地址';
          return;
        }
        if (vscode) vscode.postMessage({ type: 'remotePublish', mode: 'existing', repoUrl });
      }

      const btn = $('remote-btn-publish');
      if (btn instanceof HTMLButtonElement) {
        btn.disabled = true;
        btn.textContent = '发布中…';
      }
    });

    document.querySelectorAll('input[name="remote-mode"]').forEach((el) => {
      el.addEventListener('change', () => {
        const create = $('remote-mode-create');
        const fields = $('remote-create-fields');
        const url = $('remote-repo-url');
        const isCreate = create instanceof HTMLInputElement && create.checked;
        if (fields) fields.style.opacity = isCreate ? '1' : '0.45';
        if (url instanceof HTMLInputElement) url.disabled = isCreate;
      });
    });
  }

  function onWizardMessage(msg) {
    if (msg.type === 'offerRemoteSetup') {
      openWizard(msg);
      showWizard();
      return;
    }
    if (msg.type === 'remoteWizardInit') {
      openWizard(msg);
      showWizard();
      return;
    }
    if (msg.type === 'remoteSshStatus') {
      const status = $('remote-ssh-status');
      const next = $('remote-btn-ssh-next');
      const pubkey = $('remote-pubkey');
      if (status) {
        status.textContent = msg.ok
          ? `✓ SSH 已连接 GitHub（${msg.username || '已认证'}）`
          : (msg.message || 'SSH 未就绪');
      }
      if (pubkey instanceof HTMLTextAreaElement && msg.publicKey) {
        pubkey.value = msg.publicKey;
      }
      if (next instanceof HTMLButtonElement) next.disabled = !msg.ok;
      return;
    }
    if (msg.type === 'remoteKeyGenerated') {
      const pubkey = $('remote-pubkey');
      if (pubkey instanceof HTMLTextAreaElement) pubkey.value = msg.publicKey || '';
      if (msg.publicKey) copyText(msg.publicKey);
      const status = $('remote-ssh-status');
      if (status) status.textContent = msg.publicKey ? '公钥已复制到剪贴板，请粘贴到 GitHub' : '公钥生成失败';
      return;
    }
    if (msg.type === 'remotePublishError') {
      const err = $('remote-repo-error');
      if (err) err.textContent = msg.error || '发布失败';
      const btn = $('remote-btn-publish');
      if (btn instanceof HTMLButtonElement) {
        btn.disabled = false;
        btn.textContent = '添加 remote 并 push';
      }
      return;
    }
    if (msg.type === 'remotePublishDone') {
      lastHtmlUrl = msg.htmlUrl || '';
      showPanel('done');
      const desc = $('remote-done-desc');
      if (desc) {
        desc.textContent = msg.htmlUrl
          ? `已推送到 ${msg.remoteUrl}。点击下方按钮在浏览器打开仓库。`
          : `已推送到 ${msg.remoteUrl}`;
      }
      const openBtn = $('remote-btn-open-github');
      if (openBtn instanceof HTMLButtonElement) {
        openBtn.hidden = !lastHtmlUrl;
      }
      const btn = $('remote-btn-publish');
      if (btn instanceof HTMLButtonElement) {
        btn.disabled = false;
        btn.textContent = '添加 remote 并 push';
      }
      return;
    }
  }

  window.HorsewhipRemoteWizard = { onMessage: onWizardMessage, wire: wireWizard };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', wireWizard);
  } else {
    wireWizard();
  }
})();
