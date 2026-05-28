import { hw } from '../core/hw.js';

function ensureBoundaryWhipButton() {
  const btn = hw.els.btnBoundaryCopy;
  if (!btn) return;
  btn.classList.add('hw-whip-btn');
  btn.title = '挥鞭圈定（仅此范围可改）';
  btn.setAttribute('aria-label', '挥鞭圈定');
  hw.mountWhipIcon(btn, 'hw-whip-btn__svg');
}

function ensureFuseWhipButton() {
  const btn = hw.els.btnFuseCopy;
  if (!btn) return;
  btn.classList.add('hw-whip-btn');
  btn.title = '复制融合任务';
  btn.setAttribute('aria-label', '复制融合任务');
  hw.mountWhipIcon(btn, 'hw-whip-btn__svg');
}

function wireFuseBar() {
  if (!hw.BRANCH_FUSION_ENABLED) {
    if (hw.els.fuseBar) hw.els.fuseBar.hidden = true;
    return;
  }
  hw.ensureFuseWhipButton();
  if (hw.els.btnFuseChat && !hw.isPluginHost()) {
    hw.els.btnFuseChat.textContent = '复制融合任务';
  }
  hw.els.btnFuseClear?.addEventListener('click', () => hw.clearBranchFusionSelection());
  hw.els.btnFuseCopy?.addEventListener('click', () => hw.crackWhipOnFusion(hw.els.btnFuseCopy));
  hw.els.btnFuseChat?.addEventListener('click', () => hw.insertBranchFusionToChat());
  hw.syncFuseBar();
}

function wireBoundaryBar() {
  if (!hw.boundaryBarActive()) {
    if (hw.els.boundaryBar) hw.els.boundaryBar.hidden = true;
    return;
  }
  hw.ensureBoundaryWhipButton();
  if (hw.els.btnBoundaryChat && !hw.isPluginHost()) {
    hw.els.btnBoundaryChat.hidden = true;
  }
  hw.els.btnBoundaryClear?.addEventListener('click', () => hw.clearNodeSelection());
  hw.els.btnBoundaryCopy?.addEventListener('click', () => {
    const nodes = hw.selectedWhipNodes();
    if (!nodes.length) return;
    hw.lockBoundaryFromSelection(nodes, hw.els.btnBoundaryCopy);
  });
  hw.els.btnBoundaryChat?.addEventListener('click', () => {
    const text = hw.buildBoundaryPrompt();
    if (!text) return;
    if (window.HorsewhipPluginBridge?.insertBoundaryToChat) {
      window.HorsewhipPluginBridge.insertBoundaryToChat(text);
    } else {
      hw.copyText(text, hw.els.btnBoundaryChat);
    }
  });
  hw.syncBoundaryBar();
}

Object.assign(hw, {
  ensureBoundaryWhipButton,
  ensureFuseWhipButton,
  wireFuseBar,
  wireBoundaryBar,
});
