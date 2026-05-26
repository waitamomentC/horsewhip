import { hw } from '../core/hw.js';

function runGraphEntrance() {
  const animate = hw.state.animateNext;
  hw.state.animateNext = false;

  if (!animate || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    hw.gScroll.selectAll('.node-group').attr('opacity', 1);
    return;
  }

  hw.gScroll.selectAll('.link-core').each(function (_, i) {
    const len = this.getTotalLength() || 48;
    d3.select(this)
      .attr('stroke-dasharray', `${len} ${len}`)
      .attr('stroke-dashoffset', len)
      .transition()
      .delay(i * 14)
      .duration(380)
      .ease(d3.easeCubicOut)
      .attr('stroke-dashoffset', 0)
      .on('end', function () {
        d3.select(this).attr('stroke-dasharray', null).attr('stroke-dashoffset', null);
      });
  });

  hw.gScroll.selectAll('.node-group').each(function (_, i) {
    d3.select(this)
      .transition()
      .delay(120 + i * 22)
      .duration(340)
      .ease(d3.easeBackOut.overshoot(1.15))
      .attr('opacity', 1);
  });
}

function initSvg(contentHeight) {
  const width = hw.els.graphViewport.clientWidth || 800;
  const height = contentHeight;

  d3.select(hw.els.graphSvg).selectAll('*').remove();

  hw.svgRoot = d3.select(hw.els.graphSvg)
    .attr('width', width)
    .attr('height', height)
    .attr('viewBox', `0 0 ${width} ${height}`);

  hw.gMain = hw.svgRoot.append('g').attr('class', 'graph-main');
  hw.gScroll = hw.gMain.append('g').attr('class', 'graph-scroll-layer');

  hw.installGraphDefs(hw.svgRoot.append('defs'));

  hw.svgRoot.insert('rect', ':first-child')
    .attr('width', width)
    .attr('height', height)
    .attr('fill', 'transparent');

  return { width, height };
}

function applyGraphTransform() {
  hw.applyGraphTransformImmediate();
}

function yieldToNextFrame() {
  return new Promise((resolve) => requestAnimationFrame(resolve));
}

function bumpRenderGeneration() {
  hw.state.renderGeneration += 1;
  return hw.state.renderGeneration;
}

function renderIsAlive(gen) {
  return gen === hw.state.renderGeneration;
}

function setGraphStreaming(on) {
  hw.els.graphViewport?.classList.toggle('graph-viewport--streaming', !!on);
  if (hw.els.btnLaneLayout) hw.els.btnLaneLayout.disabled = !!on;
  if (hw.els.btnGenerate) hw.els.btnGenerate.disabled = !!on;
  if (hw.els.btnDemo) hw.els.btnDemo.disabled = !!on;
  if (hw.els.btnMegaDemo) hw.els.btnMegaDemo.disabled = !!on;
}

function visibleLaneRange(scrollTop, viewportH, laneCount) {
  if (laneCount <= 0) return { start: 0, end: -1 };
  const top = scrollTop;
  const bot = scrollTop + viewportH;
  let start = Math.floor((top - hw.CONFIG.RULER_HEIGHT) / hw.CONFIG.LANE_HEIGHT);
  let end = Math.ceil((bot - hw.CONFIG.RULER_HEIGHT) / hw.CONFIG.LANE_HEIGHT);
  start = Math.max(0, start - hw.LANE_VIEW_OVERSCAN);
  end = Math.min(laneCount - 1, end + hw.LANE_VIEW_OVERSCAN);
  if (start > end) {
    start = 0;
    end = Math.min(laneCount - 1, hw.LANE_VIEW_OVERSCAN * 2);
  }
  return { start, end };
}

function renderGraphLink(linkG, link, yScale) {
  if (link.kind === 'lane-track') {
    const x1 = hw.versionX(link.vStart);
    const x2 = hw.versionX(link.vEnd);
    const y = yScale(link.laneIndex);
    hw.appendLinkPath(
      linkG,
      'track',
      false,
      hw.laneLine(x1, y, x2, y),
      null,
      null,
      link.lane.colorDim,
      link.lane.colorDim,
    );
    return;
  }
  if (link.kind === 'lane-bridge' || link.kind === 'lane-trace') {
    const x1 = hw.versionX(link.from.displayColumn ?? link.from.graphX);
    const x2 = hw.versionX(link.to.displayColumn ?? link.to.graphX);
    const y = yScale(link.laneIndex);
    const isTrace = link.kind === 'lane-trace';
    hw.appendLinkPath(
      linkG,
      isTrace ? 'trace' : 'lane',
      link.active,
      hw.laneLine(x1, y, x2, y),
      isTrace ? link : { from: link.from, to: link.to },
      null,
      link.lane.color,
      link.lane.colorDim,
    );
    return;
  }
  if (link.kind === 'fork') {
    hw.appendLinkPath(
      linkG,
      'fork',
      link.active,
      hw.curveBridge(link.x1, link.y1, link.x2, link.y2),
      link,
      null,
      link.branchLane.color,
      link.branchLane.colorBright || link.branchLane.color,
    );
    return;
  }
  if (link.kind === 'merge') {
    hw.appendLinkPath(
      linkG,
      'merge',
      link.active,
      hw.curveBridge(link.x1, link.y1, link.x2, link.y2),
      link,
      null,
      link.branchLane.color,
      link.branchLane.colorBright || link.branchLane.color,
    );
    return;
  }
}

function renderGraphNodeEntry(nodeG, node, bundles, yScale) {
  const cx = hw.versionX(node.graphX);
  const cy = yScale(node.laneIndex);
  if (node.isFolderAggregate) {
    const bundle = bundles.find((b) => b.commit.hash === node.hash);
    hw.appendFolderClusterNode(nodeG, node, cx, cy, bundle);
    return;
  }
  if (node.isForkAnchor) {
    hw.appendBranchForkAnchor(nodeG, node, cx, cy);
    return;
  }
  if (node.isMergeAnchor) {
    hw.appendBranchMergeAnchor(nodeG, node, cx, cy);
    return;
  }
  if (node.isVersionStep) {
    hw.appendVersionStepGraphic(nodeG, node, cx, cy);
    return;
  }
  hw.appendNodeGraphic(nodeG, node, cx, cy);
}

function prepareGraphShell(catalog) {
  hw.initSvg(catalog.contentHeight);
  const m = hw.CONFIG.MARGIN;
  const innerH = hw.CONFIG.RULER_HEIGHT + Math.max(catalog.lanes.length, 1) * hw.CONFIG.LANE_HEIGHT;
  const bounds = hw.computePanBounds();
  if (hw.state.panX === null && hw.state.parsed) {
    hw.state.panX = hw.panXForHeadFocus(hw.state.parsed);
  } else if (hw.state.panX === null) {
    hw.state.panX = bounds.panMin;
  }
  hw.state.panX = hw.clampPan(hw.state.panX, bounds);
  hw.svgLayout = { innerH, panBounds: bounds, headX: hw.headXContent(catalog.head) };
  const g = hw.gScroll.append('g').attr('transform', `translate(${m.left},${m.top})`);
  hw.renderVersionRuler(g, catalog, innerH);
  hw.graphRenderCtx = {
    catalog,
    yScale: hw.laneCenterY,
    laneSlicesG: g.append('g').attr('class', 'lane-slices'),
    busG: g.append('g').attr('class', 'buses'),
    renderedLanes: new Set(),
  };
}

function prepareFileRailAllRows(lanes) {
  const inner = hw.prepareFileRailShell(lanes);
  lanes.forEach((lane) => inner.appendChild(hw.appendFileRailRow(lane)));
  hw.syncFileRailFocusHighlight();
  hw.syncFileRailBoundaryHighlight();
  hw.syncBranchLaneHighlight();
}

function getLaneSlice(laneIndex) {
  if (!hw.state.laneSliceCache) hw.state.laneSliceCache = new Map();
  const key = hw.sliceCacheKey(laneIndex);
  let slice = hw.state.laneSliceCache.get(key);
  if (!slice && hw.state.catalog && hw.state.parsed) {
    hw.updateVisibleColumnWindow();
    slice = hw.buildLaneSlice(hw.state.parsed, hw.state.catalog, laneIndex);
    hw.state.laneSliceCache.set(key, slice);
  }
  return slice;
}

function unmountLaneSlice(laneIndex) {
  if (!hw.graphRenderCtx) return;
  hw.graphRenderCtx.laneSlicesG.select(`[data-lane-index="${laneIndex}"]`).remove();
  hw.graphRenderCtx.renderedLanes.delete(laneIndex);
}

function mountLaneSlice(laneIndex) {
  const ctx = hw.graphRenderCtx;
  const catalog = hw.state.catalog;
  if (!ctx || !catalog) return;
  const lane = catalog.lanes[laneIndex];
  const slice = hw.getLaneSlice(laneIndex);
  if (!slice) return;

  const { yScale } = ctx;
  const root = ctx.laneSlicesG.append('g')
    .attr('class', 'lane-slice')
    .attr('data-lane-index', laneIndex);

  if (!lane.isHeader) {
    const fusePick = lane.isBranchLane
      && lane.branchSegment
      && hw.state.selectedBranchNames.has(lane.branchSegment.name);
    root.append('line')
      .attr('class', `lane-guide${lane.isBranchLane ? ' lane-guide--branch' : ''}${fusePick ? ' lane-guide--branch-fuse' : ''}`)
      .attr('x1', -8)
      .attr('x2', hw.futureExtentX(hw.state.parsed))
      .attr('y1', yScale(laneIndex))
      .attr('y2', yScale(laneIndex))
      .attr('stroke', lane.colorDim)
      .attr('stroke-opacity', 0.42);

  }

  const linkG = root.append('g').attr('class', 'lane-links');
  const nodeG = root.append('g').attr('class', 'lane-nodes');
  slice.links.forEach((link) => hw.renderGraphLink(linkG, link, yScale));
  slice.nodes.forEach((node) => hw.renderGraphNodeEntry(nodeG, node, slice.bundlesOnLane, yScale));
  ctx.renderedLanes.add(laneIndex);
}

function lanesForCommitBus(onPage) {
  const branchParents = new Set(
    onPage.filter((o) => o.lane.isBranchLane).map((o) => o.lane.parentLanePath),
  );
  return onPage.filter((o) => {
    if (!o.lane.isBranchLane && branchParents.has(o.lane.path)) return false;
    return true;
  });
}

function renderBusesInRange(start, end) {
  const ctx = hw.graphRenderCtx;
  const catalog = hw.state.catalog;
  const parsed = hw.state.parsed;
  if (!ctx || !catalog || !parsed) return;

  ctx.busG.selectAll('*').remove();
  const { lanes, focusGraphX } = catalog;
  const yScale = ctx.yScale;

  parsed.commits.forEach((commit) => {
    if (!hw.commitInColumnWindow(commit)) return;
    const onPage = [];
    lanes.forEach((lane) => {
      if (lane.laneIndex < start || lane.laneIndex > end) return;
      if (!hw.commitAppliesToLane(commit, lane, parsed)) return;
      const matched = commit.files.filter((f) => hw.fileMatchesLane(f, lane));
      if (!matched.length) return;
      onPage.push({ lane, laneIndex: lane.laneIndex, lanePath: lane.path, files: matched });
    });
    const busLanes = hw.lanesForCommitBus(onPage);
    if (busLanes.length < 2) return;

    const vx = hw.versionX(commit.displayColumn);
    const ys = busLanes.map((o) => yScale(o.laneIndex));
    const busPad = hw.ICON_SIZE + 3;
    const yTop = Math.min(...ys) + busPad;
    const yBot = Math.max(...ys) - busPad;
    if (yBot <= yTop) return;
    const hub = hw.pickHubLane(busLanes, commit.hash);
    const hubLane = hub.lane;
    const bundle = {
      commit,
      graphX: commit.displayColumn,
      isFocus: hw.columnsMatch(commit.displayColumn, focusGraphX),
      onPage: busLanes,
      hubLanePath: hub.lanePath,
    };
    hw.appendLinkPath(
      ctx.busG,
      'bus',
      bundle.isFocus,
      hw.laneLine(vx, yTop, vx, yBot),
      bundle,
      hw.onBundleClick,
      hubLane.color,
      hubLane.colorDim,
    );
  });
}

function collectNodesFromRange(start, end) {
  const nodes = [];
  for (let i = start; i <= end; i += 1) {
    const slice = hw.state.laneSliceCache?.get(i);
    if (slice) nodes.push(...slice.nodes);
  }
  return nodes;
}

function tryAssignDefaultPulse(start, end, options) {
  if (!options.assignDefaultPulse || hw.state.pulseNodeId) return;
  const nodes = hw.collectNodesFromRange(start, end);
  if (nodes.length) {
    hw.state.pulseNodeId = hw.pickDefaultPulseNode(nodes, hw.state.parsed);
    return;
  }
  const catalog = hw.state.catalog;
  if (!catalog) return;
  for (let i = 0; i < catalog.lanes.length; i += 1) {
    const slice = hw.getLaneSlice(i);
    if (slice.nodes.length) {
      hw.state.pulseNodeId = hw.pickDefaultPulseNode(slice.nodes, hw.state.parsed);
      if (hw.state.pulseNodeId) return;
    }
  }
}

function finalizeGraphView(catalog) {
  hw.refreshNodeIndex();
  hw.setPulseNode(hw.state.pulseNodeId);
  hw.runGraphEntrance();
  const maxScroll = Math.min(
    Math.max(0, catalog.contentHeight - hw.els.graphViewport.clientHeight),
    hw.fileRailMaxScroll(),
  );
  hw.state.scrollTop = Math.min(hw.state.scrollTop, maxScroll);
  hw.applyGraphTransform();
  hw.syncFileRailScrollFromState();
}

async function syncVisibleLanes(gen, options = {}) {
  const catalog = hw.state.catalog;
  if (!hw.state.parsed || !catalog || !hw.graphRenderCtx || !hw.renderIsAlive(gen)) return;

  const prevCol = hw.state.visibleColumnWindow;
  hw.updateVisibleColumnWindow();
  if (options.invalidateSlices || hw.columnWindowCacheChanged(prevCol, hw.state.visibleColumnWindow)) {
    hw.invalidateLaneSliceCache();
  }

  const vpH = hw.els.graphViewport?.clientHeight || 600;
  const { start, end } = hw.visibleLaneRange(hw.state.scrollTop, vpH, catalog.lanes.length);

  if (end < start) {
    [...hw.graphRenderCtx.renderedLanes].forEach((i) => hw.unmountLaneSlice(i));
    hw.graphRenderCtx.busG.selectAll('*').remove();
    return;
  }

  const toRemove = [...hw.graphRenderCtx.renderedLanes].filter((i) => i < start || i > end);
  toRemove.forEach((i) => hw.unmountLaneSlice(i));

  for (let i = start; i <= end; i += 1) {
    if (!hw.renderIsAlive(gen)) return;
    if (!hw.graphRenderCtx.renderedLanes.has(i)) {
      hw.mountLaneSlice(i);
      if (!hw.state.viewportInteracting) await hw.yieldToNextFrame();
    }
  }

  if (!hw.renderIsAlive(gen)) return;
  if (!hw.state.viewportInteracting) {
    hw.renderBusesInRange(start, end);
    hw.tryAssignDefaultPulse(start, end, options);
    hw.setPulseNode(hw.state.pulseNodeId);
    hw.updateGraphFocus();
    hw.updateSelectionVisuals();
  }
  hw.refreshNodeIndex();

  if (hw.els.statFiles) {
    const visible = end - start + 1;
    hw.els.statFiles.textContent = `${visible}/${catalog.lanes.length} lanes`;
  }
}

async function bootstrapViewportRender(gen, options = {}) {
  if (!hw.state.parsed || !hw.renderIsAlive(gen)) return;
  hw.hideTooltip();
  hw.clearError();
  hw.state.animateNext = false;
  hw.setGraphStreaming(true);

  try {
    hw.state.laneSliceCache = new Map();
    const catalog = hw.buildLaneCatalog(hw.state.parsed);
    if (!hw.renderIsAlive(gen)) return;
    hw.state.catalog = catalog;

    hw.updatePluginBar(catalog.lanes.length);

    if (hw.isPluginHost() && catalog.lanes.length === 0) {
      hw.graphRenderCtx = null;
      hw.state.catalog = null;
      if (hw.els.graphSvg) hw.els.graphSvg.innerHTML = '';
      hw.showPluginEmptyGit();
      return;
    }

    hw.els.graphEmpty?.classList.add('hidden');
    if (hw.els.graphHint) hw.els.graphHint.hidden = false;
    if (hw.els.graphZoom) hw.els.graphZoom.hidden = false;
    hw.prepareFileRailAllRows(catalog.lanes);
    hw.prepareGraphShell(catalog);
    hw.finalizeGraphView(catalog);

    await hw.syncVisibleLanes(gen, options);
    if (hw.renderIsAlive(gen) && !hw.applyNewHeadFocusAfterRender()) {
      hw.updateGraphFocus();
      hw.syncNodeRippleVisuals();
    }
    hw.updateStats(hw.state.parsed);
    hw.updatePaginationUI(hw.state.parsed);
  } catch (e) {
    if (hw.renderIsAlive(gen)) hw.showError(e.message || String(e));
  } finally {
    if (hw.renderIsAlive(gen)) hw.setGraphStreaming(false);
  }
}

function scheduleViewportSync(options = {}) {
  if (!hw.state.catalog || !hw.graphRenderCtx) return;
  if (hw.viewportSyncQueued) return;
  hw.viewportSyncQueued = true;
  const gen = hw.state.renderGeneration;
  requestAnimationFrame(async () => {
    hw.viewportSyncQueued = false;
    if (!hw.renderIsAlive(gen)) return;
    await hw.syncVisibleLanes(gen, options);
  });
}

function scheduleRenderFromState(options = {}) {
  const gen = hw.bumpRenderGeneration();
  hw.graphRenderCtx = null;
  hw.state.catalog = null;
  hw.state.laneSliceCache = null;
  hw.bootstrapViewportRender(gen, options);
}

Object.assign(hw, {
  runGraphEntrance,
  initSvg,
  applyGraphTransform,
  yieldToNextFrame,
  bumpRenderGeneration,
  renderIsAlive,
  setGraphStreaming,
  visibleLaneRange,
  renderGraphLink,
  renderGraphNodeEntry,
  prepareGraphShell,
  prepareFileRailAllRows,
  getLaneSlice,
  unmountLaneSlice,
  mountLaneSlice,
  lanesForCommitBus,
  renderBusesInRange,
  collectNodesFromRange,
  tryAssignDefaultPulse,
  finalizeGraphView,
  syncVisibleLanes,
  bootstrapViewportRender,
  scheduleViewportSync,
  scheduleRenderFromState,
});
