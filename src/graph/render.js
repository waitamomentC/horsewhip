import { hw } from '../core/hw.js';

function spatialEntranceRank(laneIndex, column) {
  const lane = Number.isFinite(laneIndex) ? laneIndex : 0;
  const col = Number.isFinite(column) ? column : 0;
  return lane * 10000 + col;
}

function linkEntranceRank(el) {
  const laneSlice = el.closest?.('.lane-slice');
  const laneIndex = laneSlice ? parseInt(laneSlice.getAttribute('data-lane-index'), 10) : 0;
  const group = el.parentNode;
  const datum = group ? d3.select(group).datum() : null;
  if (!datum) {
    return spatialEntranceRank(laneIndex, 0);
  }
  if (datum.kind === 'lane-track') {
    return spatialEntranceRank(laneIndex, datum.vStart ?? datum.vEnd ?? 0);
  }
  if (datum.vStart != null || datum.vEnd != null) {
    return spatialEntranceRank(laneIndex, datum.vStart ?? datum.vEnd ?? 0);
  }
  if (datum.from) {
    return spatialEntranceRank(laneIndex, datum.from.displayColumn ?? datum.from.graphX ?? 0);
  }
  if (datum.x1 != null) {
    return spatialEntranceRank(laneIndex, datum.x1);
  }
  return spatialEntranceRank(laneIndex, datum.graphX ?? 0);
}

function runGraphEntrance() {
  const animate = hw.state.animateNext;
  hw.state.animateNext = false;

  if (!animate || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    hw.gScroll.selectAll('.node-group').attr('opacity', 1);
    hw.gScroll.selectAll('.link-core').style('opacity', 1);
    return;
  }

  const linkEls = hw.gScroll.selectAll('.link-core').nodes()
    .map((el) => ({ el, rank: hw.linkEntranceRank(el) }))
    .sort((a, b) => a.rank - b.rank);

  linkEls.forEach(({ el }, i) => {
    const len = el.getTotalLength?.() || 48;
    d3.select(el)
      .attr('stroke-dasharray', `${len} ${len}`)
      .attr('stroke-dashoffset', len)
      .style('opacity', 0.2)
      .transition()
      .delay(i * 6)
      .duration(240)
      .ease(d3.easeCubicOut)
      .attr('stroke-dashoffset', 0)
      .style('opacity', 1)
      .on('end', function () {
        const group = this.parentNode ? d3.select(this.parentNode) : null;
        const keepHistoricalDash = group?.classed('link-merge--historical');
        d3.select(this).attr('stroke-dasharray', null).attr('stroke-dashoffset', null);
        if (keepHistoricalDash) d3.select(this).style('stroke-dasharray', '6 4');
      });
  });

  const nodeEls = hw.gScroll.selectAll('.node-group').nodes()
    .map((el) => {
      const d = d3.select(el).datum();
      const laneIndex = d?.laneIndex ?? parseInt(el.closest?.('.lane-slice')?.getAttribute('data-lane-index') ?? '0', 10);
      const col = d?.displayColumn ?? d?.graphX ?? 0;
      return { el, rank: hw.spatialEntranceRank(laneIndex, col) };
    })
    .sort((a, b) => a.rank - b.rank);

  nodeEls.forEach(({ el }, i) => {
    d3.select(el)
      .attr('opacity', 0)
      .transition()
      .delay(28 + i * 10)
      .duration(220)
      .ease(d3.easeCubicOut)
      .attr('opacity', 1);
  });
}

function graphViewportWidthPx() {
  return Math.max(1, Math.round(hw.els.graphViewport?.clientWidth || 800));
}

/** 窗口变宽/变窄时同步 SVG viewBox，避免 width:100% 单独缩放导致 C 列与节点错位 */
function syncGraphSvgViewportSize() {
  if (!hw.svgRoot || !hw.els.graphSvg) return false;
  const w = hw.graphViewportWidthPx();
  const curW = parseFloat(hw.svgRoot.attr('width')) || 0;
  const h = parseFloat(hw.svgRoot.attr('height')) || 0;
  if (!h || Math.abs(curW - w) < 0.5) return false;

  hw.svgRoot.attr('width', w).attr('viewBox', `0 0 ${w} ${h}`);
  const bg = hw.svgRoot.select(':scope > rect');
  if (!bg.empty()) bg.attr('width', w);
  hw.els.graphSvg.style.width = `${w}px`;
  hw.updateVisibleColumnWindow();
  hw.applyGraphTransformImmediate();
  return true;
}

function initSvg(contentHeight) {
  const width = hw.graphViewportWidthPx();
  const height = contentHeight;

  d3.select(hw.els.graphSvg).selectAll('*').remove();

  hw.svgRoot = d3.select(hw.els.graphSvg)
    .attr('width', width)
    .attr('height', height)
    .attr('viewBox', `0 0 ${width} ${height}`)
    .attr('preserveAspectRatio', 'xMinYMin meet');

  hw.gMain = hw.svgRoot.append('g').attr('class', 'graph-main');
  hw.gScroll = hw.gMain.append('g').attr('class', 'graph-scroll-layer');
  hw.gRuler = hw.gMain.append('g').attr('class', 'graph-ruler-layer');

  hw.installGraphDefs(hw.svgRoot.append('defs'));

  hw.svgRoot.insert('rect', ':first-child')
    .attr('width', width)
    .attr('height', height)
    .attr('fill', 'transparent');

  hw.els.graphSvg.style.width = `${width}px`;
  hw.els.graphSvg.style.height = `${height}px`;

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
      link,
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
      link.historical ? 'link-merge--historical' : '',
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
  const innerH = hw.laneBlockHeight(catalog.lanes.length);
  const bounds = hw.computePanBounds();
  if (hw.state.panX === null && hw.state.parsed) {
    hw.state.panX = hw.panXForHeadFocus(hw.state.parsed);
  } else if (hw.state.panX === null) {
    hw.state.panX = bounds.panMin;
  }
  hw.state.panX = hw.clampPan(hw.state.panX, bounds);
  hw.svgLayout = { innerH, panBounds: bounds, headX: hw.headXContent(catalog.head) };
  const gRuler = hw.gRuler.append('g').attr('class', 'graph-ruler-inner');
  hw.renderVersionRulerHeader(gRuler, catalog);
  const g = hw.gScroll.append('g').attr('class', 'graph-content-inner');
  hw.renderVersionRulerGrid(g, catalog, innerH);
  hw.graphRenderCtx = {
    catalog,
    yScale: hw.laneCenterY,
    laneSlicesG: g.append('g').attr('class', 'lane-slices'),
    busG: g.append('g').attr('class', 'buses'),
    renderedLanes: new Set(),
  };
  hw.applyGraphTransformImmediate();
}

function prepareFileRailAllRows(lanes) {
  const inner = hw.prepareFileRailShell(lanes);
  lanes.forEach((lane) => inner.appendChild(hw.appendFileRailRow(lane)));
  hw.ensureFileRailScrollPad();
  hw.syncFileRailFocusHighlight();
  hw.syncFileRailBoundaryHighlight();
  hw.syncBranchLaneHighlight();
}

/** 先画泳道，文件栏分批追加，避免阻塞首帧 */
async function prepareFileRailProgressive(lanes, gen) {
  const inner = hw.prepareFileRailShell(lanes);
  const batchSize = lanes.length > 120 ? 24 : 48;
  for (let i = 0; i < lanes.length; i += batchSize) {
    if (!hw.renderIsAlive(gen)) return;
    const frag = document.createDocumentFragment();
    const end = Math.min(i + batchSize, lanes.length);
    for (let j = i; j < end; j += 1) {
      frag.appendChild(hw.appendFileRailRow(lanes[j]));
    }
    inner.appendChild(frag);
    if (end < lanes.length) await hw.yieldToNextFrame();
  }
  hw.ensureFileRailScrollPad();
  hw.syncFileRailFocusHighlight();
  hw.syncFileRailBoundaryHighlight();
  hw.syncBranchLaneHighlight();
  hw.syncFileRailScrollFromState();
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
    const branchCurrent = hw.isLaneCurrentGitBranch(lane);
    let guideClass = `lane-guide${lane.isBranchLane ? ' lane-guide--branch' : ''}`;
    if (fusePick) guideClass += ' lane-guide--branch-fuse';
    if (branchCurrent) guideClass += ' lane-guide--branch-current';

    if (branchCurrent) {
      root
        .append('line')
        .attr('class', `${guideClass} lane-guide--branch-current-glow`)
        .attr('x1', -8)
        .attr('x2', hw.futureExtentX(hw.state.parsed))
        .attr('y1', yScale(laneIndex))
        .attr('y2', yScale(laneIndex))
        .attr('stroke', lane.color)
        .attr('stroke-width', 4)
        .attr('stroke-opacity', 0.14);
    }

    root
      .append('line')
      .attr('class', guideClass)
      .attr('x1', -8)
      .attr('x2', hw.futureExtentX(hw.state.parsed))
      .attr('y1', yScale(laneIndex))
      .attr('y2', yScale(laneIndex))
      .attr('stroke', branchCurrent ? lane.color : lane.colorDim)
      .attr('stroke-width', branchCurrent ? 1.1 : 1.5)
      .attr('stroke-opacity', branchCurrent ? 0.92 : 0.42);

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
  if (!hw.SHOW_COMMIT_BUS_LINES) return;
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

function applyGraphViewAfterMount(catalog) {
  const maxScroll = hw.maxVerticalScroll();
  hw.state.scrollTop = Math.min(hw.state.scrollTop, maxScroll);
  hw.applyGraphTransform();
  hw.syncFileRailScrollFromState();
}

function finalizeGraphView(catalog) {
  hw.refreshNodeIndex();
  hw.setPulseNode(hw.state.pulseNodeId);
  hw.runGraphEntrance();
  hw.applyGraphViewAfterMount(catalog);
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

  const animating = hw.state.animateNext;
  const lanesPerFrame = animating ? 1 : 3;
  let mountedThisFrame = 0;

  for (let i = start; i <= end; i += 1) {
    if (!hw.renderIsAlive(gen)) return;
    if (!hw.graphRenderCtx.renderedLanes.has(i)) {
      hw.mountLaneSlice(i);
      mountedThisFrame += 1;
      if (!hw.state.viewportInteracting && mountedThisFrame >= lanesPerFrame && i < end) {
        mountedThisFrame = 0;
        await hw.yieldToNextFrame();
      }
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
  const shouldAnimate = hw.state.animateNext;
  hw.setGraphStreaming(true);

  if (hw.isPluginHost() && hw.els.graphEmpty) {
    hw.els.graphEmpty.classList.add('hidden');
  }

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

    hw.prepareGraphShell(catalog);
    hw.applyGraphViewAfterMount(catalog);

    await hw.syncVisibleLanes(gen, options);

    if (hw.renderIsAlive(gen) && shouldAnimate) {
      hw.state.animateNext = true;
      hw.runGraphEntrance();
    }

    void hw.prepareFileRailProgressive(catalog.lanes, gen);

    if (hw.renderIsAlive(gen) && !hw.applyNewHeadFocusAfterRender()) {
      hw.updateGraphFocus();
      hw.syncNodeRippleVisuals();
    }
    if (hw.renderIsAlive(gen) && options.mcpBoundaryNavigate?.length) {
      hw.finishMcpBoundaryNavigate?.(options.mcpBoundaryNavigate);
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
    const sizeChanged = hw.syncGraphSvgViewportSize();
    await hw.syncVisibleLanes(gen, {
      ...options,
      invalidateSlices: options.invalidateSlices || sizeChanged,
    });
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
  spatialEntranceRank,
  linkEntranceRank,
  runGraphEntrance,
  graphViewportWidthPx,
  syncGraphSvgViewportSize,
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
  prepareFileRailProgressive,
  getLaneSlice,
  unmountLaneSlice,
  mountLaneSlice,
  lanesForCommitBus,
  renderBusesInRange,
  collectNodesFromRange,
  tryAssignDefaultPulse,
  applyGraphViewAfterMount,
  finalizeGraphView,
  syncVisibleLanes,
  bootstrapViewportRender,
  scheduleViewportSync,
  scheduleRenderFromState,
});
