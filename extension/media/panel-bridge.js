/**
 * VS Code webview bridge — loads git log from extension host, runs rollback in IDE.
 */
(function () {
  const vscode = typeof acquireVsCodeApi === 'function' ? acquireVsCodeApi() : null;

  const COMMIT_INPUT_IDS = ['commit-author-name', 'commit-author-email', 'commit-message'];

  let lastRepoStatus = null;

  window.HorsewhipPluginBridge = {
    revealFolder(folderPath) {
      if (!vscode) return;
      vscode.postMessage({ type: 'revealFolder', folderPath: folderPath || '' });
    },
    setBoundaryAllowlist(files) {
      if (!vscode) return;
      vscode.postMessage({ type: 'setBoundaryAllowlist', files: Array.isArray(files) ? files : [] });
    },
    insertBoundaryToChat(text) {
      if (!vscode || !text) return;
      vscode.postMessage({ type: 'insertBoundaryToChat', text });
    },
  };

  function wireRollbackButtons() {
    const btnCheckout = document.getElementById('btn-run-checkout');
    const btnReset = document.getElementById('btn-run-reset');
    const resetInput = document.getElementById('reset-confirm');

    if (resetInput && btnReset) {
      resetInput.addEventListener('input', () => {
        btnReset.disabled = resetInput.value.trim() !== 'RESET';
      });
    }

    if (btnCheckout) {
      btnCheckout.addEventListener('click', () => {
        const node = window.HorsewhipApp?.getModalNode?.();
        if (!node || !vscode) return;
        const filePath = node.filePath || node.files?.[0];
        if (!filePath) return;
        vscode.postMessage({ type: 'gitCheckout', hash: node.hash, filePath });
      });
    }

    if (btnReset) {
      btnReset.addEventListener('click', () => {
        const node = window.HorsewhipApp?.getModalNode?.();
        if (!node || !vscode) return;
        if (resetInput?.value.trim() !== 'RESET') return;
        vscode.postMessage({ type: 'gitResetHard', hash: node.hash });
      });
    }
  }

  function hideCommitPrompt() {
    const el = document.getElementById('commit-prompt');
    if (el) el.hidden = true;
  }

  function setCommitInputsDisabled(disabled) {
    COMMIT_INPUT_IDS.forEach((id) => {
      const el = document.getElementById(id);
      if (el instanceof HTMLInputElement) el.disabled = disabled;
    });
    const btn = document.getElementById('btn-commit');
    if (btn instanceof HTMLButtonElement) {
      btn.disabled = disabled;
      if (!disabled) btn.textContent = '提交';
    }
  }

  function applyRepoStatus(status) {
    if (!status) return;
    lastRepoStatus = status;

    const branchEl = document.getElementById('plugin-branch');
    if (branchEl) branchEl.textContent = status.branch || '—';

    const remoteEl = document.getElementById('plugin-remote-label');
    if (remoteEl) {
      if (status.remoteUrl) {
        remoteEl.textContent = '已连接 origin';
        remoteEl.className = 'git-ok';
        remoteEl.title = status.remoteUrl;
      } else {
        remoteEl.textContent = '未连接 remote';
        remoteEl.className = 'git-warn';
        remoteEl.title = '';
      }
    }

    const btnCommit = document.getElementById('btn-commit-open');
    if (btnCommit instanceof HTMLButtonElement) {
      btnCommit.hidden = !status.hasCommits;
    }

    const btnGithub = document.getElementById('btn-open-github');
    if (btnGithub instanceof HTMLButtonElement) {
      btnGithub.hidden = !status.htmlUrl;
      btnGithub.dataset.url = status.htmlUrl || '';
    }

    const btnPublish = document.getElementById('btn-remote-setup');
    if (btnPublish instanceof HTMLButtonElement) {
      btnPublish.hidden = Boolean(status.remoteUrl);
    }
  }

  function showCommitPrompt(prefill) {
    const mode = prefill?.mode || 'initial';
    const isQuick = mode === 'quick';

    const titleEl = document.getElementById('commit-title');
    const descEl = document.getElementById('commit-desc');
    if (titleEl) {
      titleEl.textContent = isQuick ? '提交更改' : '创建首次 commit';
    }
    if (descEl) {
      descEl.textContent = isQuick
        ? '将当前工作区所有改动 git add -A 并创建 commit。'
        : 'No commits yet — Horsewhip needs at least one commit to draw the timeline. Fill in author info and commit (git add -A; author info is saved to this repo only).';
    }

    const empty = document.getElementById('graph-empty');
    if (!isQuick) {
      const title = empty?.querySelector('.graph-empty__title');
      const desc = empty?.querySelector('.graph-empty__desc');
      if (title) title.textContent = '还没有 commit';
      if (desc) desc.textContent = '填写 Git 作者信息与说明，完成首次提交';
      if (empty) empty.classList.remove('hidden');
    }

    const nameEl = document.getElementById('commit-author-name');
    const emailEl = document.getElementById('commit-author-email');
    const msgEl = document.getElementById('commit-message');
    if (nameEl instanceof HTMLInputElement) {
      nameEl.value = prefill?.authorName || lastRepoStatus?.authorName || '';
    }
    if (emailEl instanceof HTMLInputElement) {
      emailEl.value = prefill?.authorEmail || lastRepoStatus?.authorEmail || '';
    }
    if (msgEl instanceof HTMLInputElement) {
      msgEl.value = '';
    }

    setCommitInputsDisabled(false);
    const err = document.getElementById('commit-error');
    if (err) err.textContent = '';

    const el = document.getElementById('commit-prompt');
    if (el) {
      el.hidden = false;
      const focusTarget = msgEl instanceof HTMLInputElement
        ? msgEl
        : (nameEl instanceof HTMLInputElement && !nameEl.value.trim()
          ? nameEl
          : emailEl);
      if (focusTarget instanceof HTMLInputElement) focusTarget.focus();
    }
  }

  function openGithubUrl(url) {
    const target = (url || lastRepoStatus?.htmlUrl || '').trim();
    if (!target || !vscode) return;
    vscode.postMessage({ type: 'openExternalUrl', url: target });
  }

  function wirePluginBar() {
    document.getElementById('btn-commit-open')?.addEventListener('click', () => {
      if (vscode) {
        vscode.postMessage({ type: 'requestOpenCommitDialog' });
      } else {
        showCommitPrompt({
          mode: 'quick',
          authorName: lastRepoStatus?.authorName,
          authorEmail: lastRepoStatus?.authorEmail,
        });
      }
    });

    document.getElementById('btn-open-github')?.addEventListener('click', (e) => {
      const btn = e.currentTarget;
      const url = btn instanceof HTMLButtonElement ? btn.dataset.url : '';
      openGithubUrl(url);
    });
  }

  function wireCommitPrompt() {
    const btn = document.getElementById('btn-commit');
    if (!btn || !vscode) return;

    const submit = () => {
      const nameEl = document.getElementById('commit-author-name');
      const emailEl = document.getElementById('commit-author-email');
      const msgEl = document.getElementById('commit-message');
      const err = document.getElementById('commit-error');

      const authorName = nameEl instanceof HTMLInputElement ? nameEl.value.trim() : '';
      const authorEmail = emailEl instanceof HTMLInputElement ? emailEl.value.trim() : '';
      const message = msgEl instanceof HTMLInputElement ? msgEl.value.trim() : '';

      if (!authorName) {
        if (err) err.textContent = '请填写 Git 用户名';
        if (nameEl instanceof HTMLInputElement) nameEl.focus();
        return;
      }
      if (!authorEmail) {
        if (err) err.textContent = '请填写 Git 邮箱';
        if (emailEl instanceof HTMLInputElement) emailEl.focus();
        return;
      }
      if (!message) {
        if (err) err.textContent = '请填写 commit 说明';
        if (msgEl instanceof HTMLInputElement) msgEl.focus();
        return;
      }

      if (err) err.textContent = '';
      btn.textContent = '提交中…';
      setCommitInputsDisabled(true);
      vscode.postMessage({ type: 'gitCommit', message, authorName, authorEmail });
    };

    btn.addEventListener('click', submit);
    COMMIT_INPUT_IDS.forEach((id) => {
      const el = document.getElementById(id);
      if (el) {
        el.addEventListener('keydown', (e) => {
          if (e.key === 'Enter') submit();
        });
      }
    });
  }

  function onMessage(event) {
    const msg = event.data;
    if (!msg) return;

    if (msg.type === 'repoStatus') {
      applyRepoStatus(msg);
      return;
    }

    if (msg.type === 'noCommits') {
      showCommitPrompt({
        mode: 'initial',
        authorName: msg.authorName || '',
        authorEmail: msg.authorEmail || '',
      });
      applyRepoStatus({
        branch: '—',
        remoteUrl: null,
        htmlUrl: null,
        hasCommits: false,
        authorName: msg.authorName,
        authorEmail: msg.authorEmail,
      });
      return;
    }

    if (msg.type === 'openCommitDialog') {
      showCommitPrompt({
        mode: msg.mode || 'quick',
        authorName: msg.authorName || '',
        authorEmail: msg.authorEmail || '',
      });
      return;
    }

    if (msg.type === 'commitStarted') {
      const btn = document.getElementById('btn-commit');
      if (btn instanceof HTMLButtonElement) {
        btn.disabled = true;
        btn.textContent = '提交中…';
      }
      setCommitInputsDisabled(true);
      return;
    }

    if (msg.type === 'commitError') {
      const err = document.getElementById('commit-error');
      if (err) err.textContent = msg.error || '提交失败';
      setCommitInputsDisabled(false);
      return;
    }

    if (msg.type === 'commitDone') {
      hideCommitPrompt();
      setCommitInputsDisabled(false);
      const msgEl = document.getElementById('commit-message');
      if (msgEl instanceof HTMLInputElement) msgEl.value = '';
      const err = document.getElementById('commit-error');
      if (err) err.textContent = '';
    }

    if (!window.HorsewhipApp) return;

    if (msg.type === 'loadLog' && msg.log) {
      hideCommitPrompt();
      window.HorsewhipApp.loadLog(msg.log);
      const empty = document.getElementById('graph-empty');
      if (empty) empty.classList.add('hidden');
      const hint = document.getElementById('graph-hint');
      if (hint) hint.hidden = false;
      const zoom = document.getElementById('graph-zoom');
      if (zoom) zoom.hidden = false;
    }
    if (msg.type === 'loadDemo') {
      hideCommitPrompt();
      window.HorsewhipApp.loadDemo();
      const empty = document.getElementById('graph-empty');
      if (empty) empty.classList.add('hidden');
    }
    if (msg.type === 'setWorkspaceFiles') {
      window.HorsewhipApp.setWorkspaceFiles(msg.paths);
    }
    if (msg.type === 'setGitBranches') {
      window.HorsewhipApp.setGitBranches(msg.branches, msg.currentBranch);
    }
    if (window.HorsewhipRemoteWizard) {
      window.HorsewhipRemoteWizard.onMessage(msg);
    }
  }

  window.addEventListener('message', onMessage);

  function boot() {
    wireRollbackButtons();
    wireCommitPrompt();
    wirePluginBar();
    if (vscode) vscode.postMessage({ type: 'ready' });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
