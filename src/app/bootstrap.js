import { hw } from '../core/hw.js';

export function bootstrap() {
  if (hw.isPluginHost() && hw.state.workspaceFiles == null) {
    hw.state.workspaceFiles = [];
  }
  hw.els.btnGenerate?.addEventListener('click', () => {
    const text = hw.els.logInput?.value?.trim() ?? '';
    if (!text) { hw.showError('paste log or load demo'); return; }
    hw.loadAndRender(text);
  });

  hw.els.btnDemo?.addEventListener('click', () => {
    if (hw.els.logInput) hw.els.logInput.value = hw.DEMO_GIT_LOG;
    hw.loadAndRender(hw.DEMO_GIT_LOG);
  });

  hw.els.btnMegaDemo?.addEventListener('click', () => {
    if (typeof hw.buildMegaDemoLog !== 'function') {
      hw.showError('mega demo unavailable');
      return;
    }
    hw.clearError();
    const t0 = performance.now();
    const built = hw.buildMegaDemoLog();
    const ms = Math.round(performance.now() - t0);
    hw.els.logInput.value = `/* mega demo: ${built.stats.files} files · ${built.stats.commits} commits · generated ${ms}ms — not stored in textarea */`;
    hw.els.pasteDrop.hidden = true;
    hw.els.btnPasteToggle?.classList.remove('btn--solid');
    hw.loadAndRender(built.log);
  });

  hw.els.btnClear?.addEventListener('click', () => {
    if (hw.els.logInput) hw.els.logInput.value = '';
    hw.state.parsed = null;
    hw.state.panX = null;
    hw.state.scrollTop = 0;
    hw.state.expandedPaths = new Set();
    hw.state.focusGraphX = null;
    hw.state.pulseNodeId = null;
    hw.state.catalog = null;
    hw.state.laneSliceCache = null;
    hw.state.rawLogText = null;
    hw.state.boundaryFiles.clear();
    hw.state.selectedNodeIds.clear();
    hw.syncBoundaryBar();
    hw.graphRenderCtx = null;
    d3.select(hw.els.graphSvg).selectAll('*').remove();
    hw.els.fileRailInner.innerHTML = '';
    hw.els.graphEmpty.classList.remove('hidden');
    hw.els.graphHint.hidden = true;
    if (hw.els.graphZoom) hw.els.graphZoom.hidden = true;
    hw.els.stats.hidden = true;
    hw.els.linkPanel.hidden = true;
    hw.els.largeWarn.hidden = true;
    hw.hideTooltip();
    hw.clearError();
  });

  hw.els.btnPasteToggle?.addEventListener('click', () => {
    const open = hw.els.pasteDrop?.hidden;
    if (hw.els.pasteDrop) hw.els.pasteDrop.hidden = !open;
    hw.els.btnPasteToggle?.classList.toggle('btn--solid', open);
    if (open) hw.els.logInput?.focus();
  });

  hw.els.cmdChip?.addEventListener('click', () => {
    hw.copyText('git log --all -100 --name-only --pretty=format:"%H|%P|%D|%an|%ad|%s"', hw.els.cmdChip);
  });

  if (hw.els.zoomLabel) hw.els.zoomLabel.textContent = '100%';

  hw.els.fileFilter?.addEventListener('input', () => {
    hw.state.fileFilter = hw.els.fileFilter.value;
    hw.renderFromState();
  });

  try {
    const savedLayout = localStorage.getItem(hw.LANE_LAYOUT_KEY);
    if (savedLayout === hw.LANE_LAYOUT_FLAT || savedLayout === hw.LANE_LAYOUT_GROUPED) {
      hw.state.laneLayout = savedLayout;
    }
  } catch { /* ignore */ }
  hw.syncLaneLayoutButton();
  hw.els.btnLaneLayout?.addEventListener('click', hw.toggleLaneLayout);

  hw.state.whipSoundMuted = hw.loadWhipSoundMuted();
  try { localStorage.removeItem('horsewhip:whip-icon-image'); } catch { /* legacy cleanup */ }
  void hw.loadWhipCrackAudio();
  hw.syncWhipSoundMuteButton();
  hw.els.btnWhipSound?.addEventListener('click', (e) => {
    e.stopPropagation();
    hw.toggleWhipSoundMute();
  });

  const onFileRailScroll = () => {
    if (hw.scrollSync) return;
    const scrollEl = hw.fileRailScrollEl();
    if (!scrollEl) return;
    hw.stopViewportAnimation();
    hw.state.scrollTop = scrollEl.scrollTop;
    hw.applyGraphTransformImmediate();
    hw.markViewportInteracting();
    hw.scheduleViewportSync();
  };
  hw.els.fileRailInner?.addEventListener('scroll', onFileRailScroll, { passive: true });
  hw.els.fileRail?.addEventListener('scroll', onFileRailScroll, { passive: true });

  if (!hw.els.graphViewport) {
    console.error('[Horsewhip] #graph-viewport missing — plugin HTML out of date?');
    return;
  }

  hw.els.graphViewport.addEventListener('wheel', (e) => {
    if (!hw.state.parsed) return;
    e.preventDefault();
    if (e.ctrlKey || e.metaKey) {
      if (e.deltaY < 0) hw.nudgeZoom(hw.CONFIG.ZOOM_STEP);
      else if (e.deltaY > 0) hw.nudgeZoom(1 / hw.CONFIG.ZOOM_STEP);
      return;
    }
    const raw = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY;
    if (raw === 0) return;
    const step = Math.max(hw.versionScale() * 0.5, Math.min(32, Math.abs(raw) * 0.1));
    if (raw < 0) hw.nudgePan(-step);
    else hw.nudgePan(step);
  }, { passive: false });

  hw.els.btnZoomIn?.addEventListener('click', () => hw.nudgeZoom(hw.CONFIG.ZOOM_STEP));
  hw.els.btnZoomOut?.addEventListener('click', () => hw.nudgeZoom(1 / hw.CONFIG.ZOOM_STEP));
  hw.els.btnLoadMoreCommits?.addEventListener('click', hw.loadMoreCommits);








  hw.wireBoundaryBar();
  hw.wireFuseBar();

  hw.els.modalClose?.addEventListener('click', hw.closeModal);
  hw.els.modalBackdrop?.addEventListener('click', (e) => {
    if (e.target === hw.els.modalBackdrop) hw.closeModal();
  });

  hw.els.btnCopyConstraint?.addEventListener('click', () => hw.copyText(hw.els.modalConstraint.textContent, hw.els.btnCopyConstraint));
  hw.els.btnCopyCheckout?.addEventListener('click', () => hw.copyText(hw.els.modalCmdFile.textContent, hw.els.btnCopyCheckout));
  hw.els.btnToggleReset?.addEventListener('click', () => {
    const hidden = hw.els.rollbackDanger.hidden;
    hw.els.rollbackDanger.hidden = !hidden;
    hw.els.btnToggleReset.textContent = hidden ? 'hide' : 'confirm';
  });
  hw.els.resetConfirm?.addEventListener('input', () => {
    hw.els.btnCopyReset.disabled = hw.els.resetConfirm.value.trim() !== 'RESET';
  });
  hw.els.btnCopyReset?.addEventListener('click', () => {
    if (hw.els.resetConfirm.value.trim() === 'RESET') hw.copyText(hw.els.modalCmdReset.textContent, hw.els.btnCopyReset);
  });
  hw.els.btnCopyLink?.addEventListener('click', () => {
    hw.copyText(hw.els.linkPanel.dataset.constraint || hw.els.linkConstraintText.textContent, hw.els.btnCopyLink);
  });

  document.addEventListener('keydown', (e) => {
    if (e.target.matches('textarea, input') && e.key !== 'Escape') return;
    if (e.key === 'Escape') { hw.hideTooltip(); hw.closeModal(); return; }
    if (!hw.state.parsed) return;
    if (e.key === 'ArrowLeft') { e.preventDefault(); hw.nudgePan(-hw.versionScale()); }
    if (e.key === 'ArrowRight') { e.preventDefault(); hw.nudgePan(hw.versionScale()); }
    if (e.key === '-' || e.key === '_') { e.preventDefault(); hw.nudgeZoom(1 / hw.CONFIG.ZOOM_STEP); }
    if (e.key === '=' || e.key === '+') { e.preventDefault(); hw.nudgeZoom(hw.CONFIG.ZOOM_STEP); }
    if (e.key === 'ArrowUp') { e.preventDefault(); hw.nudgeVerticalScroll(-hw.CONFIG.LANE_HEIGHT); }
    if (e.key === 'ArrowDown') { e.preventDefault(); hw.nudgeVerticalScroll(hw.CONFIG.LANE_HEIGHT); }
  });

  window.addEventListener('resize', () => {
    if (!hw.state.parsed) return;
    if (hw.state.catalog) hw.scheduleViewportSync();
    else hw.scheduleRenderFromState();
  });

  hw.initGraphViewportEvents();

  document.addEventListener('click', (e) => {
    if (hw.suppressOutsideClick) {
      hw.suppressOutsideClick = false;
      return;
    }
    if (e.target.closest('#tooltip')) return;
    if (e.target.closest('#hw-whip-float')) return;
    if (e.target.closest('#file-rail') || e.target.closest('.file-rail')) return;
    if (e.target.closest('#plugin-bar') || e.target.closest('.plugin-bar')) return;
    if (hw.els.graphSvg?.contains(e.target)) return;
    if (!e.target.closest('.link-segment') && !e.target.closest('#link-panel')) {
      hw.hideTooltip();
        if (hw.els.modalBackdrop && !hw.els.modalBackdrop.hidden) return;
        hw.state.selectedLink = null;
        hw.state.selectedNodeIds.clear();
        hw.state.lastSelectedNodeId = null;
        hw.state.boundaryFiles.clear();
        if (hw.els.linkPanel) hw.els.linkPanel.hidden = true;
      hw.syncBoundaryBar();
      hw.updateSelectionVisuals();
    }
  });

  /** VS Code / Cursor webview entry (see extension/media/panel-bridge.js). */
}
