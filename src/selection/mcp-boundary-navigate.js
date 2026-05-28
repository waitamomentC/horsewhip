import { hw } from '../core/hw.js';

/** Normalize MCP allowlist path for explorer expand / lane lookup. */
function normalizeBoundaryNavPath(raw) {
  let s = String(raw || '').replace(/\\/g, '/').replace(/^\.\/+/, '').trim();
  if (!s || s === hw.ROOT_BUCKET) return s || hw.ROOT_BUCKET;
  if (s.endsWith('/')) return s;
  const base = s.split('/').pop() || '';
  if (base.includes('.') || base.startsWith('.')) return s;
  return `${s}/`;
}

function expandAncestorsForBoundaryPaths(paths) {
  if (!paths?.length) return;
  const files = [];
  for (const raw of paths) {
    const p = normalizeBoundaryNavPath(raw);
    if (!p) continue;
    if (p === hw.ROOT_BUCKET || p.endsWith('/')) {
      if (p === hw.ROOT_BUCKET) {
        hw.state.expandedPaths.add(hw.ROOT_BUCKET);
        continue;
      }
      const parts = p.replace(/\/$/, '').split('/').filter(Boolean);
      for (let i = 1; i <= parts.length; i++) {
        hw.state.expandedPaths.add(`${parts.slice(0, i).join('/')}/`);
      }
      continue;
    }
    files.push(p);
  }
  if (files.length) hw.expandAncestorsForFiles(files);
}

function findLaneIndexForBoundaryPath(path) {
  const lanes = hw.state.catalog?.lanes;
  if (!lanes?.length) return -1;
  const p = normalizeBoundaryNavPath(path);
  if (!p) return -1;
  if (p.endsWith('/') || p === hw.ROOT_BUCKET) {
    const headerIdx = lanes.findIndex((l) => l.path === p && l.isHeader);
    if (headerIdx >= 0) return headerIdx;
    return lanes.findIndex((l) => l.path === p && (l.type === 'folder' || l.collapsed || l.isHeader));
  }
  return hw.findLaneIndexForFilePath(p);
}

function laneIndexVisibleInViewport(laneIndex, scrollTop, viewportH) {
  if (laneIndex < 0) return false;
  const laneTop = hw.CONFIG.RULER_HEIGHT + laneIndex * hw.CONFIG.LANE_HEIGHT;
  const laneBottom = laneTop + hw.CONFIG.LANE_HEIGHT;
  const pageTop = scrollTop;
  const pageBottom = scrollTop + viewportH;
  return laneBottom > pageTop && laneTop < pageBottom;
}

function focusBoundaryPathView(path, { allowScroll = false } = {}) {
  if (!hw.state.parsed || !hw.state.catalog) return;
  const p = normalizeBoundaryNavPath(path);
  if (!p) return;

  if (p.endsWith('/') && p !== hw.ROOT_BUCKET) {
    const stub = hw.buildFolderSelectionNode(p);
    if (!stub) return;
    hw.state.focusedFilePath = null;
    hw.syncFileRailFocusHighlight();
    hw.state.focusGraphX = stub.displayColumn ?? stub.graphX;
    hw.state.pulseNodeId = stub.id;
    hw.setPulseNode(stub.id);
    hw.updateGraphFocus();
    hw.syncNodeRippleVisuals();
    const laneIndex = hw.findLaneIndexForBoundaryPath(p);
    const panX = hw.panXForColumnFocus(hw.state.focusGraphX);
    const scrollTop =
      allowScroll && laneIndex >= 0 ? hw.scrollTopForLaneCenter(laneIndex) : hw.state.scrollTop ?? 0;
    void hw.animateViewportTo(panX, scrollTop);
    hw.syncFileRailBoundaryHighlight();
    return;
  }

  if (p === hw.ROOT_BUCKET) return;
  hw.focusFileLane(p, { allowScroll });
}

/** After catalog rebuild: focus topmost locked path that is already on screen (no scroll). */
function finishMcpBoundaryNavigate(paths) {
  if (!hw.isPluginHost() || !paths?.length || !hw.state.catalog) return;

  const scrollTop = hw.state.scrollTop ?? 0;
  const vpH = hw.fileRailScrollViewportH();
  const sorted = [...new Set(paths.map(normalizeBoundaryNavPath).filter(Boolean))].sort((a, b) =>
    a.localeCompare(b),
  );

  const visible = [];
  for (const p of sorted) {
    const laneIndex = hw.findLaneIndexForBoundaryPath(p);
    if (hw.laneIndexVisibleInViewport(laneIndex, scrollTop, vpH)) {
      visible.push({ path: p, laneIndex });
    }
  }

  hw.syncFileRailBoundaryHighlight();

  if (!visible.length) return;

  visible.sort((a, b) => a.laneIndex - b.laneIndex);
  focusBoundaryPathView(visible[0].path, { allowScroll: false });
}

function navigateMcpBoundaryPaths(paths) {
  if (!hw.isPluginHost() || !paths?.length || !hw.state.parsed) return;
  expandAncestorsForBoundaryPaths(paths);
  hw.state.animateNext = false;
  hw.scheduleRenderFromState({ mcpBoundaryNavigate: paths });
}

Object.assign(hw, {
  normalizeBoundaryNavPath,
  expandAncestorsForBoundaryPaths,
  findLaneIndexForBoundaryPath,
  laneIndexVisibleInViewport,
  focusBoundaryPathView,
  finishMcpBoundaryNavigate,
  navigateMcpBoundaryPaths,
});
