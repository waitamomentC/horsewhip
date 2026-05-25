/**
 * VS Code webview bridge — loads git log from extension host, runs rollback in IDE.
 */
(function () {
  const vscode = typeof acquireVsCodeApi === 'function' ? acquireVsCodeApi() : null;

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

  function onMessage(event) {
    const msg = event.data;
    if (!msg || !window.HorsewhipApp) return;
    if (msg.type === 'loadLog' && msg.log) {
      window.HorsewhipApp.loadLog(msg.log);
      const empty = document.getElementById('graph-empty');
      if (empty) empty.classList.add('hidden');
      const hint = document.getElementById('graph-hint');
      if (hint) hint.hidden = false;
      const zoom = document.getElementById('graph-zoom');
      if (zoom) zoom.hidden = false;
    }
    if (msg.type === 'loadDemo') {
      window.HorsewhipApp.loadDemo();
      const empty = document.getElementById('graph-empty');
      if (empty) empty.classList.add('hidden');
    }
    if (msg.type === 'setOpenFiles') {
      window.HorsewhipApp.setOpenFiles(msg.paths);
    }
  }

  window.addEventListener('message', onMessage);

  function boot() {
    wireRollbackButtons();
    if (vscode) vscode.postMessage({ type: 'ready' });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
