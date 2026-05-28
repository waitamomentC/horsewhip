import { hw } from '../core/hw.js';

function syncGuardArmButton() {
  const btn = document.getElementById('btn-guard-arm');
  const wrap = document.getElementById('guard-arm-wrap');
  const lamp = document.getElementById('guard-arm-lamp');
  if (!btn) return;

  const on = hw.state.guardActive;
  const mcpReadOnly = Boolean(hw.state.mcpBoundaryLocked);
  btn.textContent = on ? '失效' : '激活';
  btn.disabled = mcpReadOnly && on;
  btn.title = mcpReadOnly && on
    ? 'Agent 圈定中 · 不可关闭守门'
    : on
      ? '守门已开启：选中节点后仅圈内可改；未选中时可自由改码。点击「失效」关闭守门。'
      : '守门已关闭：写盘与 commit 均不拦截。点击「激活」恢复守门。';
  btn.setAttribute('aria-pressed', on ? 'true' : 'false');

  if (wrap) {
    wrap.classList.toggle('plugin-guard__arm-wrap--on', on);
    wrap.classList.toggle('plugin-guard__arm-wrap--off', !on);
  }
  if (lamp) {
    lamp.setAttribute('aria-label', on ? '守门已激活' : '守门未激活');
  }
}

function applyGuardActiveUi() {
  syncGuardArmButton();
  document.body.classList.toggle('hw-guard-inactive', !hw.state.guardActive);
}

function setGuardActive(active, { notifyHost = true } = {}) {
  hw.state.guardActive = Boolean(active);
  applyGuardActiveUi();
  document.body.classList.toggle('hw-guard-active', hw.state.guardActive);
  if (notifyHost && hw.isPluginHost() && window.HorsewhipPluginBridge?.setGuardActive) {
    window.HorsewhipPluginBridge.setGuardActive(hw.state.guardActive);
  }
}

function toggleGuardActive() {
  if (hw.state.mcpBoundaryLocked && hw.state.guardActive) {
    hw.showCopyToast?.('Agent 圈定中 · 不可关闭守门');
    return;
  }
  setGuardActive(!hw.state.guardActive);
}

function initGuardArmControl() {
  if (!hw.isPluginHost()) return;
  const btn = document.getElementById('btn-guard-arm');
  if (!btn || btn.dataset.hwBound === '1') return;
  btn.dataset.hwBound = '1';
  if (!document.body.classList.contains('hw-guard-active')) {
    hw.setGuardActive(true);
  }
}

function onHostGuardActive(active) {
  hw.state.guardActive = Boolean(active);
  applyGuardActiveUi();
}

Object.assign(hw, {
  initGuardArmControl,
  setGuardActive,
  toggleGuardActive,
  onHostGuardActive,
  syncGuardArmButton,
});
