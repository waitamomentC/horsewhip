import { hw } from '../core/hw.js';

function versionScale() {
  return hw.CONFIG.VERSION_SPACING * (hw.state.graphZoom || 1);
}

function versionColumnX(columnV) {
  return hw.CONFIG.VERSION_ORIGIN_X + (columnV - 1) * hw.versionScale();
}

function visibleColumnRange() {
  const spacing = hw.versionScale();
  const origin = hw.CONFIG.VERSION_ORIGIN_X;
  const pan = hw.state.panX ?? hw.computePanBounds().panMin;
  const vpW = hw.els.graphViewport?.clientWidth || 800;
  const m = hw.CONFIG.MARGIN.left;
  const rawMin = 1 + (pan - m - origin) / spacing;
  const rawMax = 1 + (pan + vpW - m - origin) / spacing;
  const headCol = hw.state.parsed
    ? (hw.headMainlineVersion(hw.state.parsed) || hw.headColumn(hw.state.parsed))
    : 1;
  const pad = hw.CONFIG.COLUMN_VIEW_OVERSCAN;
  return {
    vMin: Math.min(rawMin, headCol) - pad,
    vMax: Math.max(rawMax, headCol) + pad,
    headCol,
  };
}

function updateVisibleColumnWindow() {
  hw.state.visibleColumnWindow = hw.visibleColumnRange();
}

function columnInWindow(columnV, win) {
  if (columnV == null || Number.isNaN(columnV)) return false;
  const w = win || hw.state.visibleColumnWindow;
  if (!w) return true;
  if (hw.columnsMatch(columnV, w.headCol)) return true;
  return columnV >= w.vMin && columnV <= w.vMax;
}

function commitInColumnWindow(commit) {
  return hw.columnInWindow(commit.displayColumn ?? commit.graphX, hw.state.visibleColumnWindow);
}

function panXForHeadFocus(parsed) {
  const headCol = hw.headMainlineVersion(parsed) || hw.headColumn(parsed);
  return hw.panXForColumnFocus(headCol);
}

function panXForColumnFocus(columnV) {
  const colScreenX = hw.CONFIG.MARGIN.left + hw.versionColumnX(columnV);
  const vpW = hw.els.graphViewport?.clientWidth || 800;
  const targetX = vpW * 0.5;
  return Math.max(hw.computePanBounds().panMin, colScreenX - targetX);
}

function latestVersionColumnForFile(parsed, filePath) {
  const tl = parsed.fileTimelines?.[filePath];
  if (tl?.length) {
    const last = tl[tl.length - 1];
    return last.displayColumn ?? last.versionIndex ?? last.graphX ?? hw.headColumn(parsed);
  }
  return hw.headMainlineVersion(parsed) || hw.headColumn(parsed);
}

function findLaneIndexForFilePath(filePath) {
  const lanes = hw.state.catalog?.lanes;
  if (!lanes) return -1;
  const lane = lanes.find((l) => l.type === 'file' && l.path === filePath);
  return lane ? lane.laneIndex : -1;
}

function fileRailScrollEl() {
  return hw.els.fileRailInner || hw.els.fileRail;
}

function fileRailScrollViewportH() {
  const el = hw.fileRailScrollEl();
  return el?.clientHeight || hw.els.graphViewport?.clientHeight || 600;
}

function fileRailMaxScroll() {
  const inner = hw.els.fileRailInner;
  const scrollEl = hw.fileRailScrollEl();
  if (!inner || !scrollEl) return 0;
  return Math.max(0, inner.offsetHeight - scrollEl.clientHeight);
}

function scrollTopForLaneCenter(laneIndex) {
  const vpH = hw.fileRailScrollViewportH();
  const laneY = hw.laneCenterY(laneIndex);
  const maxScroll = hw.fileRailMaxScroll();
  return Math.max(0, Math.min(maxScroll, laneY - vpH / 2));
}

function syncFileRailScrollFromState() {
  const scrollEl = hw.fileRailScrollEl();
  if (!scrollEl) return;
  hw.scrollSync = true;
  scrollEl.scrollTop = hw.state.scrollTop;
  hw.scrollSync = false;
}

function applyGraphTransformImmediate() {
  if (!hw.gMain) return;
  hw.gMain.attr('transform', `translate(${-hw.state.panX}, ${-hw.state.scrollTop})`);
}

function animateViewportTo(targetPanX, targetScrollTop, duration = 420) {
  if (!hw.gMain || !hw.state.parsed) return Promise.resolve();
  const gen = ++hw.state.viewportAnimGeneration;
  const bounds = hw.computePanBounds();
  const startPan = hw.state.panX ?? bounds.panMin;
  const startScroll = hw.state.scrollTop ?? 0;
  const endPan = hw.clampPan(targetPanX, bounds);
  const maxScroll = hw.fileRailMaxScroll();
  const endScroll = Math.max(0, Math.min(maxScroll, targetScrollTop));
  const needMove = Math.abs(endPan - startPan) > 0.5 || Math.abs(endScroll - startScroll) > 0.5;

  const finish = () => {
    if (gen !== hw.state.viewportAnimGeneration) return;
    hw.state.panX = endPan;
    hw.state.scrollTop = endScroll;
    hw.applyGraphTransformImmediate();
    hw.syncFileRailScrollFromState();
    hw.updateVisibleColumnWindow();
    hw.scheduleViewportSync({ invalidateSlices: true });
  };

  if (!needMove) {
    finish();
    return Promise.resolve();
  }

  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    finish();
    return Promise.resolve();
  }

  hw.stopViewportAnimation();

  return new Promise((resolve) => {
    d3.select(hw.gMain.node())
      .transition('hw-viewport-pan')
      .duration(duration)
      .ease(d3.easeCubicInOut)
      .tween('hw-viewport', () => {
        const panI = d3.interpolateNumber(startPan, endPan);
        const scrollI = d3.interpolateNumber(startScroll, endScroll);
        return (t) => {
          if (gen !== hw.state.viewportAnimGeneration) return;
          hw.state.panX = panI(t);
          hw.state.scrollTop = scrollI(t);
          hw.applyGraphTransformImmediate();
          hw.syncFileRailScrollFromState();
        };
      })
      .on('end', () => {
        if (gen !== hw.state.viewportAnimGeneration) return;
        finish();
        resolve();
      });
  });
}

function focusFileLane(filePath) {
  if (!hw.state.parsed || !hw.state.catalog || !filePath) return;
  const parsed = hw.state.parsed;
  const columnV = hw.latestVersionColumnForFile(parsed, filePath);
  const laneIndex = hw.findLaneIndexForFilePath(filePath);

  hw.state.focusedFilePath = filePath;
  hw.state.focusGraphX = columnV;
  hw.syncFileRailFocusHighlight();

  const panX = hw.panXForColumnFocus(columnV);
  const scrollTop = laneIndex >= 0 ? hw.scrollTopForLaneCenter(laneIndex) : hw.state.scrollTop;

  hw.updateGraphFocus();

  void hw.animateViewportTo(panX, scrollTop).then(() => {
    if (hw.state.focusedFilePath !== filePath) return;
    const lane = laneIndex >= 0 ? hw.state.catalog.lanes[laneIndex] : null;
    if (lane) {
      const commit = parsed.commits.find(
        (c) => hw.columnsMatch(c.displayColumn ?? c.graphX, columnV)
          && c.files.some((f) => hw.fileMatchesLane(f, lane)),
      );
      if (commit) {
        hw.state.pulseNodeId = `${commit.hash}:${lane.path}`;
        hw.setPulseNode(hw.state.pulseNodeId);
      }
    }
    hw.updateGraphFocus();
  });
}

function syncFileRailFocusHighlight() {
  if (!hw.els.fileRailInner) return;
  hw.els.fileRailInner.querySelectorAll('[data-file-path]').forEach((row) => {
    row.classList.toggle(
      'file-rail__item--focused',
      row.getAttribute('data-file-path') === hw.state.focusedFilePath,
    );
  });
}

function wireFileRailFocus(row, lane) {
  if (lane.type !== 'file' || lane.isBranchLane || lane.collapsed || lane.isHeader) return;
  row.dataset.filePath = lane.path;
  row.classList.add('file-rail__item--focusable');
  row.classList.toggle('file-rail__item--focused', lane.path === hw.state.focusedFilePath);
  row.addEventListener('click', (e) => {
    if (e.altKey) return;
    if (e.target.closest('.file-rail__chev--collapse')) return;
    e.preventDefault();
    e.stopPropagation();
    hw.focusFileLane(lane.path);
  });
}

function invalidateLaneSliceCache() {
  hw.state.laneSliceCache = new Map();
  if (hw.graphRenderCtx?.renderedLanes) {
    [...graphRenderCtx.renderedLanes].forEach((i) => hw.unmountLaneSlice(i));
  }
}

function sliceCacheKey(laneIndex) {
  const w = hw.state.visibleColumnWindow;
  if (!w) return String(laneIndex);
  const vMin = Math.floor(w.vMin);
  const vMax = Math.ceil(w.vMax);
  return `${laneIndex}:${vMin}:${vMax}`;
}

function columnWindowCacheChanged(prev, next) {
  if (!prev || !next) return true;
  return Math.floor(prev.vMin) !== Math.floor(next.vMin)
    || Math.ceil(prev.vMax) !== Math.ceil(next.vMax);
}

function stopViewportAnimation() {
  hw.state.viewportAnimGeneration += 1;
  if (hw.gMain) d3.select(hw.gMain.node()).interrupt('hw-viewport-pan');
}

function markViewportInteracting() {
  if (!hw.state.viewportInteracting) {
    hw.state.viewportInteracting = true;
    hw.els.graphViewport?.classList.add('graph-viewport--panning');
  }
  if (hw.viewportInteractEndTimer) clearTimeout(hw.viewportInteractEndTimer);
  hw.viewportInteractEndTimer = setTimeout(() => {
    hw.viewportInteractEndTimer = null;
    hw.state.viewportInteracting = false;
    hw.els.graphViewport?.classList.remove('graph-viewport--panning');
    hw.updateVisibleColumnWindow();
    hw.scheduleViewportSync();
  }, 120);
}

function setGraphZoom(next) {
  const z = Math.min(hw.CONFIG.ZOOM_MAX, Math.max(hw.CONFIG.ZOOM_MIN, next));
  if (Math.abs(z - hw.state.graphZoom) < 0.001) return;
  hw.state.graphZoom = z;
  if (hw.els.zoomLabel) hw.els.zoomLabel.textContent = `${Math.round(z * 100)}%`;
  const catalog = hw.state.catalog;
  const pan = hw.state.panX;
  hw.invalidateLaneSliceCache();
  if (catalog) {
    hw.prepareGraphShell(catalog);
    if (pan != null) hw.state.panX = pan;
    hw.scheduleViewportSync({ invalidateSlices: true });
  }
}

function nudgeZoom(factor) {
  hw.setGraphZoom((hw.state.graphZoom || 1) * factor);
}

function updatePaginationUI(parsed) {
  if (!hw.els.largeWarn || !parsed) return;
  const loaded = parsed.loadedCommitCount ?? parsed.commits.length;
  const total = parsed.totalCommitsInLog ?? loaded;
  if (total <= hw.CONFIG.COMMIT_PAGE_SIZE && loaded >= total) {
    hw.els.largeWarn.hidden = true;
    return;
  }
  if (hw.els.largeWarnText) {
    hw.els.largeWarnText.textContent = total > loaded
      ? `已加载 ${loaded}/${total} commits（分页）`
      : `${total} commits`;
  }
  if (hw.els.btnLoadMoreCommits) {
    const canMore = loaded < total;
    hw.els.btnLoadMoreCommits.hidden = !canMore;
    hw.els.btnLoadMoreCommits.textContent = canMore
      ? `+${Math.min(hw.CONFIG.COMMIT_PAGE_STEP, total - loaded)}`
      : '';
  }
  hw.els.largeWarn.hidden = false;
}

function versionX(columnV) {
  return hw.versionColumnX(columnV);
}

function laneCenterY(laneIndex) {
  return hw.CONFIG.RULER_HEIGHT + laneIndex * hw.CONFIG.LANE_HEIGHT + hw.CONFIG.LANE_HEIGHT / 2;
}

function headXContent(headCol) {
  return hw.CONFIG.MARGIN.left + hw.versionColumnX(headCol);
}

function v1ContentX() {
  return hw.CONFIG.MARGIN.left + hw.versionColumnX(1);
}

function futureExtentX(parsed) {
  return hw.versionColumnX(hw.rulerExtent(parsed));
}

function computePanBounds() {
  return { panMin: hw.v1ContentX() - hw.CONFIG.V1_VIEW_INSET, panMax: Infinity };
}

function clampPan(panX, bounds) {
  return Math.max(bounds.panMin, panX);
}

function nudgePan(delta) {
  if (!hw.state.parsed || !hw.svgLayout) return;
  hw.stopViewportAnimation();
  const bounds = hw.svgLayout.panBounds || hw.computePanBounds();
  const panMin = bounds.panMin;
  const next = hw.state.panX + delta;

  if (next < panMin) {
    hw.state.panX = panMin;
  } else {
    hw.state.panX = next;
  }
  hw.updateVisibleColumnWindow();
  hw.applyGraphTransformImmediate();
  hw.markViewportInteracting();
  hw.scheduleViewportSync();
}

function nudgeVerticalScroll(delta) {
  hw.stopViewportAnimation();
  const max = hw.fileRailMaxScroll();
  hw.state.scrollTop = Math.max(0, Math.min(max, hw.state.scrollTop + delta));
  hw.applyGraphTransformImmediate();
  hw.syncFileRailScrollFromState();
  hw.markViewportInteracting();
  hw.scheduleViewportSync();
}

Object.assign(hw, {
  versionScale,
  versionColumnX,
  visibleColumnRange,
  updateVisibleColumnWindow,
  columnInWindow,
  commitInColumnWindow,
  panXForHeadFocus,
  panXForColumnFocus,
  latestVersionColumnForFile,
  findLaneIndexForFilePath,
  fileRailScrollEl,
  fileRailScrollViewportH,
  fileRailMaxScroll,
  scrollTopForLaneCenter,
  syncFileRailScrollFromState,
  applyGraphTransformImmediate,
  animateViewportTo,
  focusFileLane,
  syncFileRailFocusHighlight,
  wireFileRailFocus,
  invalidateLaneSliceCache,
  sliceCacheKey,
  columnWindowCacheChanged,
  stopViewportAnimation,
  markViewportInteracting,
  setGraphZoom,
  nudgeZoom,
  updatePaginationUI,
  versionX,
  laneCenterY,
  headXContent,
  v1ContentX,
  futureExtentX,
  computePanBounds,
  clampPan,
  nudgePan,
  nudgeVerticalScroll,
});
