import { hw } from '../core/hw.js';

function ensureBoundaryWhipButton() {
  const btn = hw.els.btnBoundaryCopy;
  if (!btn) return;
  btn.classList.add('hw-whip-btn');
  btn.title = '复制约束';
  btn.setAttribute('aria-label', '复制约束');
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
  if (!hw.BOUNDARY_BAR_ENABLED) {
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
    hw.crackWhipOnSelection(nodes, hw.els.btnBoundaryCopy);
  });
  hw.els.btnBoundaryChat?.addEventListener('click', () => {
    const text = hw.buildBoundaryPrompt();
    if (!text) return;
    if (window.HorsewhipPluginBridge?.insertBoundaryToChat) {
      window.HorsewhipPluginBridge.insertBoundaryToChat(text);
    } else {
      copyText(text, hw.els.btnBoundaryChat);
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
