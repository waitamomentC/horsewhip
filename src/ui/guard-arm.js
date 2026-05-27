import { hw } from '../core/hw.js';

function syncGuardArmButton() {
  const btn = document.getElementById('btn-guard-arm');
  const wrap = document.getElementById('guard-arm-wrap');
  const lamp = document.getElementById('guard-arm-lamp');
  if (!btn) return;

  const on = hw.state.guardActive;
  btn.textContent = on ? '失效' : '激活';
  btn.title = on
    ? '守门已开启：越界写盘会还原。点击关闭后可自由改码。'
    : '守门未开启：点击「激活」后，挥鞭圈定才会拦改码与 commit';
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
  setGuardActive(!hw.state.guardActive);
}

function initGuardArmControl() {
  if (!hw.isPluginHost()) return;
  const btn = document.getElementById('btn-guard-arm');
  if (!btn || btn.dataset.hwBound === '1') return;
  btn.dataset.hwBound = '1';
  if (!document.body.classList.contains('hw-guard-active')) {
    hw.state.guardActive = false;
    applyGuardActiveUi();
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
