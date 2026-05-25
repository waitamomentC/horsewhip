/**
 * Embedded workspace terminal (xterm.js) inside Horsewhip webview.
 */
(function () {
  const vscode = typeof acquireVsCodeApi === 'function' ? acquireVsCodeApi() : null;

  const TERMINAL_HEIGHT = 'min(38vh, 280px)';

  let term;
  let fitAddon;
  let open = false;
  let booted = false;

  function $(id) { return document.getElementById(id); }

  function getFitCtor() {
    if (typeof FitAddon === 'undefined') return null;
    return FitAddon.FitAddon || FitAddon;
  }

  function getTerminalCtor() {
    return typeof Terminal !== 'undefined' ? Terminal : null;
  }

  function ensureTerminal() {
    if (term) return term;
    const TerminalCtor = getTerminalCtor();
    const FitCtor = getFitCtor();
    const host = $('hw-terminal-host');
    if (!TerminalCtor || !host) return null;

    term = new TerminalCtor({
      cursorBlink: true,
      fontSize: 12,
      lineHeight: 1.25,
      fontFamily: "'JetBrains Mono', Menlo, Monaco, monospace",
      theme: {
        background: '#07080a',
        foreground: '#e8eaed',
        cursor: '#6d7ce8',
        selectionBackground: 'rgba(109,124,232,.35)',
      },
      scrollback: 4000,
    });

    if (FitCtor) {
      fitAddon = new FitCtor();
      term.loadAddon(fitAddon);
    }

    term.open(host);
    term.onData((data) => {
      if (vscode) vscode.postMessage({ type: 'terminalInput', data });
    });

    return term;
  }

  function fitTerminal() {
    if (!term) return;
    try {
      fitAddon?.fit();
    } catch { /* ignore */ }
    if (vscode && term) {
      vscode.postMessage({
        type: 'terminalResize',
        cols: term.cols,
        rows: term.rows,
      });
    }
  }

  function setOpen(next) {
    open = next;
    const drawer = $('hw-terminal');
    const btn = $('btn-toggle-terminal');
    const workspace = $('hw-workspace');

    if (drawer) {
      drawer.hidden = !open;
      if (open) {
        drawer.style.flexBasis = TERMINAL_HEIGHT;
      }
    }
    if (btn) {
      btn.classList.toggle('hw-dock__btn--active', open);
      btn.setAttribute('aria-pressed', open ? 'true' : 'false');
    }
    if (workspace) {
      workspace.classList.toggle('hw-workspace--terminal-open', open);
    }

    if (open) {
      ensureTerminal();
      if (vscode) vscode.postMessage({ type: 'terminalOpen' });
      requestAnimationFrame(() => {
        fitTerminal();
        term?.focus();
        window.dispatchEvent(new Event('resize'));
      });
    } else if (vscode) {
      vscode.postMessage({ type: 'terminalClose' });
      window.dispatchEvent(new Event('resize'));
    }
  }

  function toggleTerminal() {
    setOpen(!open);
  }

  function onMessage(event) {
    const msg = event.data;
    if (!msg) return;

    if (msg.type === 'terminalOutput' && typeof msg.data === 'string') {
      if (!term) ensureTerminal();
      term?.write(msg.data);
      return;
    }

    if (msg.type === 'terminalExit') {
      term?.writeln(`\r\n\x1b[90m[进程已退出 ${msg.code ?? 0}]\x1b[0m`);
    }
  }

  function wireDock() {
    $('btn-toggle-terminal')?.addEventListener('click', toggleTerminal);
  }

  function boot() {
    if (booted) return;
    booted = true;
    wireDock();
    window.addEventListener('message', onMessage);
    window.addEventListener('resize', () => {
      if (open) fitTerminal();
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }

  window.HorsewhipTerminal = { toggle: toggleTerminal, setOpen, fit: fitTerminal };
})();
