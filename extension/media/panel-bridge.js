/**
 * VS Code webview bridge — loads git log from extension host, preview at commit in IDE.
 */
(function () {
  const vscode = typeof acquireVsCodeApi === 'function' ? acquireVsCodeApi() : null;

  if (vscode) {
    vscode.postMessage({ type: 'webviewHandshake' });
  }

  const COMMIT_INPUT_IDS = ['commit-author-name', 'commit-author-email', 'commit-message'];

  let lastRepoStatus = null;

  window.HorsewhipPluginBridge = {
    revealFolder(folderPath) {
      if (!vscode) return;
      vscode.postMessage({ type: 'revealFolder', folderPath: folderPath || '' });
    },
    setBoundaryAllowlist(files, locked = false, targets = []) {
      if (!vscode) return;
      vscode.postMessage({
        type: 'setBoundaryAllowlist',
        files: Array.isArray(files) ? files : [],
        locked: Boolean(locked),
        targets: Array.isArray(targets) ? targets : [],
      });
    },
    insertBoundaryToChat(text) {
      if (!vscode || !text) return;
      vscode.postMessage({ type: 'insertBoundaryToChat', text });
    },
    setGuardActive(active) {
      if (!vscode) return;
      vscode.postMessage({ type: 'setGuardActive', active: Boolean(active) });
    },
  };

  function wirePreviewButtons() {
    const btnPreview = document.getElementById('btn-run-preview');
    if (!btnPreview) return;
    btnPreview.addEventListener('click', () => {
      const node = window.HorsewhipApp?.getModalNode?.();
      if (!node || !vscode) return;
      vscode.postMessage({ type: 'gitPreviewUi', hash: node.hash });
    });
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

    const restoreBtn = document.getElementById('btn-restore-env');
    if (restoreBtn instanceof HTMLButtonElement) {
      restoreBtn.hidden = !status.detached;
    }

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
        : '尚无 commit — 需要至少一次提交才能绘制泳道。填写作者信息并提交（git add -A；作者信息仅保存在本仓库）。';
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

  function syncGuardArmFromHost(active) {
    if (window.HorsewhipApp?.setGuardActive) {
      window.HorsewhipApp.setGuardActive(active, { notifyHost: false });
      return;
    }
    const wrap = document.getElementById('guard-arm-wrap');
    const btn = document.getElementById('btn-guard-arm');
    const lamp = document.getElementById('guard-arm-lamp');
    const on = Boolean(active);
    document.body.classList.toggle('hw-guard-inactive', !on);
    document.body.classList.toggle('hw-guard-active', on);
    if (wrap) {
      wrap.classList.toggle('plugin-guard__arm-wrap--on', on);
      wrap.classList.toggle('plugin-guard__arm-wrap--off', !on);
    }
    if (btn) {
      btn.textContent = on ? '失效' : '激活';
      btn.setAttribute('aria-pressed', on ? 'true' : 'false');
    }
    if (lamp) lamp.setAttribute('aria-label', on ? '守门已激活' : '守门未激活');
  }

  function applyGuardStatus(msg) {
    const statusEl = document.getElementById('plugin-guard-status');
    const btnCorrect = document.getElementById('btn-guard-correct');
    const btnRevert = document.getElementById('btn-guard-revert');
    if (!statusEl) return;
    if (msg.guardActive === false) {
      syncGuardArmFromHost(false);
    } else if (msg.guardActive === true) {
      syncGuardArmFromHost(true);
    }
    statusEl.className = 'plugin-guard__status';
    if (msg.guardActive === false) {
      statusEl.classList.add('plugin-guard__status--idle');
      statusEl.textContent = '守门 · 未激活';
      if (btnCorrect) btnCorrect.hidden = true;
      if (btnRevert) btnRevert.hidden = true;
      return;
    }
    statusEl.className = 'plugin-guard__status';
    if (!msg.hasBoundary) {
      statusEl.classList.add('plugin-guard__status--idle');
      statusEl.textContent = '守门 · 已激活 · 可自由改码';
      if (btnCorrect) btnCorrect.hidden = true;
      if (btnRevert) btnRevert.hidden = true;
      return;
    }
    if (msg.hookInstalled === false && msg.ok) {
      statusEl.classList.add('plugin-guard__status--warn');
      const label = (msg.allowed || [])[0] || '边界';
      statusEl.textContent = `守门 · ${label}（未装 hook）`;
      statusEl.title = '请运行命令：Horsewhip: 安装 Git Pre-Commit 守门钩子';
      if (btnCorrect) btnCorrect.hidden = true;
      if (btnRevert) btnRevert.hidden = true;
      return;
    }
    if (msg.ok) {
      statusEl.classList.add('plugin-guard__status--ok');
      statusEl.textContent = msg.actualCount
        ? `守门 · 边界内 (${msg.actualCount})`
        : '守门 · 边界内';
      if (btnCorrect) btnCorrect.hidden = true;
      if (btnRevert) btnRevert.hidden = true;
      return;
    }
    statusEl.classList.add('plugin-guard__status--over');
    statusEl.textContent = `守门 · 越界 ${(msg.overreach || []).length}`;
    if (btnCorrect) btnCorrect.hidden = false;
    if (btnRevert) btnRevert.hidden = false;
  }

  function wireGuardArmControl() {
    const btn = document.getElementById('btn-guard-arm');
    const wrap = document.getElementById('guard-arm-wrap');
    if (!btn || btn.dataset.hwBridgeBound === '1') return;
    btn.dataset.hwBridgeBound = '1';

    const toggle = () => {
      const cur = btn.getAttribute('aria-pressed') === 'true';
      const next = !cur;
      if (window.HorsewhipApp?.setGuardActive) {
        window.HorsewhipApp.setGuardActive(next);
      } else {
        syncGuardArmFromHost(next);
        window.HorsewhipPluginBridge?.setGuardActive?.(next);
      }
    };

    btn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      toggle();
    });
    wrap?.addEventListener('click', (e) => {
      if (e.target === wrap || e.target?.classList?.contains('plugin-guard__lamp')) {
        e.preventDefault();
        e.stopPropagation();
        toggle();
      }
    });
    syncGuardArmFromHost(true);
  }

  function applyGuardStats(msg) {
    const btn = document.getElementById('btn-guard-record');
    if (!btn) return;
    const blocked = Number(msg.blocked) || 0;
    const attempts = Number(msg.attempts) || 0;
    btn.textContent = blocked > 0 ? `守护记录 ${blocked}` : '守护记录';
    btn.title =
      attempts > 0
        ? `累计越界 ${attempts} 次 · 拦截 ${blocked} 次 — 点击查看仪表盘`
        : '查看 AI 越界尝试与拦截统计';
  }

  function wireGuardBar() {
    wireGuardArmControl();
    document.getElementById('btn-guard-record')?.addEventListener('click', () => {
      if (vscode) vscode.postMessage({ type: 'openGuardRecord' });
    });
    document.getElementById('btn-guard-check')?.addEventListener('click', () => {
      if (vscode) vscode.postMessage({ type: 'guardCheck' });
    });
    document.getElementById('btn-guard-correct')?.addEventListener('click', () => {
      if (vscode) vscode.postMessage({ type: 'guardInsertCorrection' });
    });
    document.getElementById('btn-guard-revert')?.addEventListener('click', () => {
      if (vscode) vscode.postMessage({ type: 'guardRevertOverreach' });
    });
  }

  function wirePluginBar() {
    document.getElementById('btn-restore-env')?.addEventListener('click', () => {
      if (vscode) vscode.postMessage({ type: 'gitSwitchPrevious' });
    });

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

  const pendingAppMessages = [];
  const APP_WAIT_MS = 20000;
  const GIT_SYNC_WAIT_MS = 180000;
  let gitSyncTimer = null;
  /** @type {'booting'|'rendering'|'done'|'error'} */
  let bootPhase = 'booting';

  function setGraphEmptyStatus(text) {
    if (bootPhase === 'error' || bootPhase === 'done') return;
    const desc = document.querySelector('.graph-empty__desc');
    if (desc) desc.textContent = text;
  }

  function clearGitSyncTimer() {
    if (gitSyncTimer) {
      clearTimeout(gitSyncTimer);
      gitSyncTimer = null;
    }
  }

  function armGitSyncTimer() {
    clearGitSyncTimer();
    gitSyncTimer = setTimeout(() => {
      gitSyncTimer = null;
      showGraphBootError(
        '同步 Git 超时（网络或仓库过大）。请执行「Horsewhip: 刷新 Git 记录」或重新加载窗口；终端需联网时勿阻塞 xterm CDN。',
      );
    }, GIT_SYNC_WAIT_MS);
  }

  function hideGraphEmpty() {
    const empty = document.getElementById('graph-empty');
    if (empty) empty.classList.add('hidden');
    const hint = document.getElementById('graph-hint');
    if (hint) hint.hidden = false;
    const zoom = document.getElementById('graph-zoom');
    if (zoom) zoom.hidden = false;
  }

  function showGraphBootError(text) {
    bootPhase = 'error';
    clearGitSyncTimer();
    const empty = document.getElementById('graph-empty');
    if (!empty) return;
    empty.classList.remove('hidden');
    const title = empty.querySelector('.graph-empty__title');
    const desc = empty.querySelector('.graph-empty__desc');
    if (title) title.textContent = 'horsewhip 未能启动';
    if (desc) desc.textContent = text || '请重新加载窗口（命令面板：Developer: Reload Window）';
  }

  function applyTimelineLog(log) {
    if (!window.HorsewhipApp) {
      pendingAppMessages.push({ type: 'loadLog', log });
      return;
    }
    bootPhase = 'rendering';
    clearGitSyncTimer();
    hideCommitPrompt();
    setGraphEmptyStatus('正在解析并绘制泳道…');
    try {
      window.HorsewhipApp.loadLog(log);
      bootPhase = 'done';
      hideGraphEmpty();
    } catch (err) {
      showGraphBootError(err?.message || String(err));
    }
  }

  function loadLogFromUri(uri) {
    bootPhase = 'rendering';
    setGraphEmptyStatus('正在读取 git log…');
    fetch(uri)
      .then((r) => {
        if (!r.ok) throw new Error(`读取 log 失败（HTTP ${r.status}）`);
        return r.text();
      })
      .then((log) => {
        if (!log?.trim()) throw new Error('git log 为空');
        applyTimelineLog(log);
      })
      .catch((err) => {
        showGraphBootError(err?.message || String(err));
      });
  }

  function needsHorsewhipApp(msg) {
    return msg.type === 'loadLog'
      || msg.type === 'loadDemo'
      || msg.type === 'setWorkspaceFiles'
      || msg.type === 'setGitBranches';
  }

  function dispatchToHorsewhipApp(msg) {
    if (!window.HorsewhipApp) return false;

    if (msg.type === 'loadLog' && msg.log) {
      applyTimelineLog(msg.log);
      return true;
    }
    if (msg.type === 'loadLogUri' && msg.uri) {
      loadLogFromUri(msg.uri);
      return true;
    }
    if (msg.type === 'loadDemo') {
      clearGitSyncTimer();
      hideCommitPrompt();
      try {
        window.HorsewhipApp.loadDemo();
        hideGraphEmpty();
      } catch (err) {
        showGraphBootError(err?.message || String(err));
      }
      return true;
    }
    if (msg.type === 'setWorkspaceFiles') {
      window.HorsewhipApp.setWorkspaceFiles(msg.paths);
      return true;
    }
    if (msg.type === 'setGitBranches') {
      window.HorsewhipApp.setGitBranches(msg.branches, msg.currentBranch);
      return true;
    }
    return false;
  }

  function flushPendingAppMessages() {
    while (pendingAppMessages.length) {
      const msg = pendingAppMessages.shift();
      if (msg.type === 'loadLog' && msg.log) {
        applyTimelineLog(msg.log);
      } else if (msg.type === 'loadLogUri' && msg.uri) {
        loadLogFromUri(msg.uri);
      } else if (window.HorsewhipApp) {
        dispatchToHorsewhipApp(msg);
      } else {
        pendingAppMessages.unshift(msg);
        break;
      }
    }
  }

  function startHostIfReady() {
    if (window.__horsewhipBootError) {
      showGraphBootError(window.__horsewhipBootError);
      return true;
    }
    if (!window.HorsewhipApp) return false;
    flushPendingAppMessages();
    if (vscode) {
      armGitSyncTimer();
      vscode.postMessage({ type: 'ready' });
    }
    return true;
  }

  function whenHorsewhipAppReady(onReady) {
    const done = () => {
      if (!startHostIfReady()) {
        showGraphBootError(
          '脚本未加载（extension/media/script.js）。请确认：① 仓库根目录 npm run build:extension  ② 用 VS Code/Cursor 打开 horsewhip 根目录  ③ F5 调试（不要只装旧 VSIX）  ④ 重新加载窗口',
        );
      }
      if (typeof onReady === 'function') onReady();
    };

    if (window.HorsewhipApp || window.__horsewhipBootError) {
      done();
      return;
    }

    const onAppReady = () => {
      window.removeEventListener('horsewhip-app-ready', onAppReady);
      clearInterval(timer);
      done();
    };
    window.addEventListener('horsewhip-app-ready', onAppReady);

    const t0 = Date.now();
    const timer = setInterval(() => {
      if (window.HorsewhipApp || window.__horsewhipBootError) {
        onAppReady();
        return;
      }
      if (Date.now() - t0 > APP_WAIT_MS) {
        onAppReady();
      }
    }, 20);
  }

  function onMessage(event) {
    const msg = event.data;
    if (!msg) return;

    if (msg.type === 'syncBoundaryFromHost') {
      const apply = () => {
        window.HorsewhipApp?.applyBoundaryFromHost?.(msg.files || [], Boolean(msg.locked), {
          playWhip: Boolean(msg.playWhip),
          toast: msg.toast,
          ceremonyOnly: Boolean(msg.ceremonyOnly),
        });
      };
      if (!window.HorsewhipApp) {
        pendingAppMessages.push(msg);
        whenHorsewhipAppReady(apply);
        return;
      }
      apply();
      return;
    }

    if (msg.type === 'guardStatus') {
      applyGuardStatus(msg);
      return;
    }

    if (msg.type === 'guardStats') {
      applyGuardStats(msg);
      return;
    }

    if (msg.type === 'repoStatus') {
      applyRepoStatus(msg);
      if (msg.guardActive === true) syncGuardArmFromHost(true);
      else if (msg.guardActive === false) syncGuardArmFromHost(false);
      return;
    }

    if (msg.type === 'bootStatus' && msg.text) {
      if (bootPhase === 'booting') setGraphEmptyStatus(msg.text);
      return;
    }

    if (msg.type === 'gitLoadError') {
      clearGitSyncTimer();
      showGraphBootError(msg.error || '读取 git log 失败');
      return;
    }

    if (msg.type === 'noCommits') {
      clearGitSyncTimer();
      hideGraphEmpty();
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

    if (msg.type === 'commitBlocked') {
      const err = document.getElementById('commit-error');
      const list = (msg.overreach || []).join(', ');
      if (err) {
        err.textContent = msg.reason
          || `提交被拦截。越界仍留在工作区：${list || '—'}。请点「还原越界」或让 AI 复原后仅在边界内改。`;
      }
      applyGuardStatus({
        hasBoundary: msg.hasBoundary !== false,
        ok: false,
        allowed: msg.allowed || [],
        overreach: msg.overreach || [],
      });
      setCommitInputsDisabled(false);
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

    if (msg.type === 'loadLogUri' && msg.uri) {
      if (!window.HorsewhipApp && !window.__horsewhipBootError) {
        pendingAppMessages.push(msg);
        return;
      }
      loadLogFromUri(msg.uri);
      return;
    }

    if (needsHorsewhipApp(msg)) {
      if (!window.HorsewhipApp && !window.__horsewhipBootError) {
        pendingAppMessages.push(msg);
        return;
      }
      dispatchToHorsewhipApp(msg);
      return;
    }

    if (window.HorsewhipRemoteWizard) {
      window.HorsewhipRemoteWizard.onMessage(msg);
    }
  }

  window.addEventListener('message', onMessage);

  function boot() {
    wirePreviewButtons();
    wireCommitPrompt();
    wireGuardBar();
    wirePluginBar();
    window.HorsewhipApp?.initGuardArmControl?.();
    if (startHostIfReady()) return;
    whenHorsewhipAppReady(() => {
      wireGuardArmControl();
      window.HorsewhipApp?.initGuardArmControl?.();
      startHostIfReady();
    });
  }

  if (startHostIfReady()) {
    wirePreviewButtons();
    wireCommitPrompt();
    wireGuardBar();
    wirePluginBar();
    wireGuardArmControl();
    window.HorsewhipApp?.initGuardArmControl?.();
  } else if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
