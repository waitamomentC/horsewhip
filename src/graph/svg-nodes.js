import { hw } from '../core/hw.js';

function pulseColumn(parsed) {
  const headCol = hw.headMainlineVersion(parsed) || hw.headColumn(parsed);
  if (hw.state.focusGraphX != null && !hw.columnsMatch(hw.state.focusGraphX, headCol)) {
    return hw.state.focusGraphX;
  }
  return headCol;
}

function rippleTargetNodeId() {
  const lastId = hw.state.lastSelectedNodeId;
  if (lastId && hw.state.selectedNodeIds.has(lastId)) return lastId;
  return hw.state.pulseNodeId || null;
}

function nodeShowsRipples(node) {
  const id = node?.id;
  const target = hw.rippleTargetNodeId();
  return !!(id && target && id === target);
}

function nodeIsPulsing(node) {
  return hw.nodeShowsRipples(node);
}

function syncNodeRippleVisuals() {
  if (!hw.gScroll) return;
  hw.gScroll.selectAll('.node-group').each(function () {
    const sel = d3.select(this);
    const d = sel.datum();
    if (!d) return;
    const show = hw.nodeShowsRipples(d);
    d.isPulse = show;
    sel.classed('node-group--pulse', show);
    sel.selectAll('.node-ripples').remove();
    if (show && d.lane?.color) hw.appendNodeRipples(sel, d.lane.color);
  });
}

function pickDefaultPulseNode(nodes, parsed) {
  const headCol = hw.headMainlineVersion(parsed) || 1;
  const trunk = parsed.trunkLaneCommitSet || parsed.mainlineSet;
  const pulseEligible = (n) => hw.nodeCanShowTooltip(n) && !hw.isBranchGraphAnchor(n);
  const atHead = nodes.filter((n) => pulseEligible(n) && hw.columnsMatch(n.displayColumn, headCol));
  if (atHead.length) {
    const onBranch = atHead.find((n) => !trunk.has(n.hash));
    const onTrunk = atHead.find((n) => trunk.has(n.hash));
    return (onBranch || onTrunk || atHead[0]).id;
  }
  const branchTip = nodes.find((n) => pulseEligible(n) && n.lane?.isBranchLane);
  if (branchTip) return branchTip.id;
  return nodes.find((n) => pulseEligible(n))?.id ?? null;
}

function setPulseNode(nodeId) {
  hw.state.pulseNodeId = nodeId || null;
  hw.syncNodeRippleVisuals();
}

function updateGraphFocus() {
  const parsed = hw.state.parsed;
  if (!parsed || !hw.gScroll) return;
  const focusGraphX = hw.state.focusGraphX ?? hw.resolveFocusGraphX(parsed);
  hw.gScroll.selectAll('.node-group').each(function () {
    const sel = d3.select(this);
    const d = sel.datum();
    if (!d) return;
    const isFocus = hw.columnsMatch(d.displayColumn, focusGraphX);
    d.isFocus = isFocus;
    sel.classed('node-group--focus', isFocus);
    sel.classed('node-group--stale', !isFocus && !d.isFolderAggregate);
  });
  hw.setPulseNode(hw.state.pulseNodeId);
}

function appendNodeRipples(g, color) {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const ripG = g.insert('g', ':first-child').attr('class', 'node-ripples');
  [0, 1, 2].forEach((i) => {
    ripG.append('circle')
      .attr('class', `node-ripple node-ripple--d${i}`)
      .attr('r', hw.ICON_SIZE + 1)
      .attr('fill', 'none')
      .attr('stroke', color)
      .attr('stroke-width', 1.75);
  });
}

function appendRulerRipples(g, cx, cy) {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const ripG = g.append('g')
    .attr('class', 'version-ruler__pulse')
    .attr('transform', `translate(${cx},${cy})`);
  [0, 1, 2].forEach((i) => {
    ripG.append('circle')
      .attr('class', `version-ruler__pulse-ring version-ruler__pulse-ring--d${i}`)
      .attr('r', 2.2)
      .attr('fill', 'none')
      .attr('stroke', 'var(--accent)')
      .attr('stroke-width', 1.5);
  });
}

function fileIconKindFromPath(path) {
  const base = (path.split('/').pop() || path).toLowerCase();
  if (hw.CONFIG_FILE_RE.test(base) || hw.CONFIG_BASENAMES.test(base)) return 'config';
  if (hw.CODE_FILE_RE.test(path)) return 'code';
  return 'other';
}

function laneIconKind(lane) {
  if (lane.collapsed || lane.isHeader || lane.type === 'folder') return 'folder';
  return hw.fileIconKindFromPath(lane.path);
}

function isBranchGraphAnchor(node) {
  return !!(node?.isForkAnchor || node?.isMergeAnchor);
}

function isVersionStepNode(node) {
  return !!node?.isVersionStep;
}

function versionStepIconSize() {
  return hw.ICON_SIZE * hw.VERSION_STEP_ICON_SCALE;
}

function nodeOnLaneAtColumn(nodes, lanePath, columnV) {
  return nodes.some((n) => !hw.isBranchGraphAnchor(n) && !hw.isVersionStepNode(n) && n.lanePath === lanePath
    && hw.columnsMatch(n.displayColumn ?? n.graphX, columnV));
}

function nodeCanShowTooltip(node) {
  if (!node || hw.isVersionStepNode(node)) return false;
  if (node.isFolderAggregate) return true;
  if (node.isForkAnchor || node.isMergeAnchor || node.isMergeLanding) return true;
  const lane = node.lane;
  if (!lane || lane.isHeader) return false;
  if (lane.collapsed && !node.isFolderAggregate) return false;
  if (lane.type === 'folder' && !node.isFolderAggregate) return false;
  const path = node.filePath || node.files?.[0] || lane.path;
  return Boolean(path && !String(path).endsWith('/'));
}

function nodeIconKind(node) {
  if (node.isFolderAggregate) return 'folder';
  if (node.lane && hw.laneIconKind(node.lane) === 'folder') return 'folder';
  const fp = node.filePath || node.files?.[0] || node.lane?.path || '';
  return hw.fileIconKindFromPath(fp);
}

function equilateralTrianglePath(side) {
  const h = (Math.sqrt(3) / 2) * side;
  return `M0,${(-2 * h) / 3} L${-side / 2},${h / 3} L${side / 2},${h / 3} Z`;
}

function regularHexagonPath(radius) {
  const pts = Array.from({ length: 6 }, (_, i) => {
    const a = (Math.PI / 3) * i - Math.PI / 2;
    return [radius * Math.cos(a), radius * Math.sin(a)];
  });
  return `M${pts.map(([x, y]) => `${x},${y}`).join(' L ')} Z`;
}

function folderRoundedRectRadius(width, height) {
  return Math.min(width, height) * 0.24;
}

function appendSvgFolderRect(g, className, size, color) {
  const side = size * 2;
  const radius = hw.folderRoundedRectRadius(side, side);
  return g.append('rect')
    .attr('class', className)
    .attr('x', -size)
    .attr('y', -size)
    .attr('width', side)
    .attr('height', side)
    .attr('rx', radius)
    .attr('ry', radius)
    .attr('fill', color);
}

function appendSvgLaneIcon(g, kind, color, size) {
  const side = size * 2;
  if (kind === 'folder') {
    hw.appendSvgFolderRect(g, 'node-icon node-icon--folder', size, color);
    return;
  }
  if (kind === 'code') {
    g.append('circle')
      .attr('class', 'node-icon node-icon--code')
      .attr('r', size)
      .attr('fill', color);
    return;
  }
  if (kind === 'config') {
    g.append('path')
      .attr('class', 'node-icon node-icon--config')
      .attr('d', hw.regularHexagonPath(size))
      .attr('fill', color);
    return;
  }
  g.append('path')
    .attr('class', 'node-icon node-icon--other')
    .attr('d', hw.equilateralTrianglePath(side))
    .attr('fill', color);
}

function createRailIcon(lane) {
  const kind = hw.laneIconKind(lane);
  const color = lane.color;
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('class', 'file-rail__icon');
  svg.setAttribute('width', '7');
  svg.setAttribute('height', '7');
  svg.setAttribute('viewBox', '-4 -4 8 8');
  svg.setAttribute('aria-hidden', 'true');

  if (kind === 'folder') {
    const side = 5.4;
    const r = hw.folderRoundedRectRadius(side, side);
    const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    rect.setAttribute('x', String(-side / 2));
    rect.setAttribute('y', String(-side / 2));
    rect.setAttribute('width', String(side));
    rect.setAttribute('height', String(side));
    rect.setAttribute('rx', String(r));
    rect.setAttribute('ry', String(r));
    rect.setAttribute('fill', color);
    svg.appendChild(rect);
  } else if (kind === 'code') {
    const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    circle.setAttribute('r', '2.6');
    circle.setAttribute('fill', color);
    svg.appendChild(circle);
  } else if (kind === 'config') {
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('d', hw.regularHexagonPath(2.8));
    path.setAttribute('fill', color);
    svg.appendChild(path);
  } else {
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('d', hw.equilateralTrianglePath(5.2));
    path.setAttribute('fill', color);
    svg.appendChild(path);
  }
  return svg;
}

function installGraphDefs(defs) {
  const stale = defs.append('filter')
    .attr('id', 'hw-shadow-stale')
    .attr('x', '-50%').attr('y', '-50%')
    .attr('width', '200%').attr('height', '200%');
  stale.append('feDropShadow')
    .attr('dx', 0).attr('dy', 1)
    .attr('stdDeviation', 2.2)
    .attr('flood-color', '#0a0e14')
    .attr('flood-opacity', 0.85);

  const glow = defs.append('filter')
    .attr('id', 'hw-glow-active')
    .attr('x', '-80%').attr('y', '-80%')
    .attr('width', '260%').attr('height', '260%');
  glow.append('feGaussianBlur')
    .attr('in', 'SourceGraphic')
    .attr('stdDeviation', 2.8)
    .attr('result', 'b');
  const transfer = glow.append('feComponentTransfer').attr('in', 'b').attr('result', 'g');
  transfer.append('feFuncA').attr('type', 'linear').attr('slope', 2);
  const merge = glow.append('feMerge');
  merge.append('feMergeNode').attr('in', 'g');
  merge.append('feMergeNode').attr('in', 'SourceGraphic');

  const nodeGlow = defs.append('filter')
    .attr('id', 'hw-node-glow')
    .attr('x', '-100%').attr('y', '-100%')
    .attr('width', '300%').attr('height', '300%');
  nodeGlow.append('feGaussianBlur').attr('stdDeviation', 3).attr('result', 'b');
  const nm = nodeGlow.append('feMerge');
  nm.append('feMergeNode').attr('in', 'b');
  nm.append('feMergeNode').attr('in', 'SourceGraphic');

  const linkStale = defs.append('linearGradient')
    .attr('id', 'hw-grad-link-stale')
    .attr('gradientUnits', 'userSpaceOnUse')
    .attr('x1', 0).attr('y1', 0).attr('x2', 120).attr('y2', 0);
  linkStale.append('stop').attr('offset', '0%').attr('stop-color', '#3a4556');
  linkStale.append('stop').attr('offset', '100%').attr('stop-color', '#6b7d95');

  const linkActive = defs.append('linearGradient')
    .attr('id', 'hw-grad-link-active')
    .attr('gradientUnits', 'userSpaceOnUse')
    .attr('x1', 0).attr('y1', 0).attr('x2', 80).attr('y2', 0);
  linkActive.append('stop').attr('offset', '0%').attr('stop-color', '#ffffff');
  linkActive.append('stop').attr('offset', '55%').attr('stop-color', '#fff7ed');
  linkActive.append('stop').attr('offset', '100%').attr('stop-color', '#fdba74');

  const nodeStale = defs.append('radialGradient')
    .attr('id', 'hw-grad-node-stale')
    .attr('cx', '35%').attr('cy', '30%').attr('r', '65%');
  nodeStale.append('stop').attr('offset', '0%').attr('stop-color', '#7a8aa3');
  nodeStale.append('stop').attr('offset', '100%').attr('stop-color', '#3d4a5c');

  const nodeFocus = defs.append('radialGradient')
    .attr('id', 'hw-grad-node-focus')
    .attr('cx', '32%').attr('cy', '28%').attr('r', '70%');
  nodeFocus.append('stop').attr('offset', '0%').attr('stop-color', '#fed7aa');
  nodeFocus.append('stop').attr('offset', '45%').attr('stop-color', '#fb923c');
  nodeFocus.append('stop').attr('offset', '100%').attr('stop-color', '#c2410c');
}

function appendLinkPath(parent, kind, active, d, datum, onClick, laneColor, laneColorDim, extraClass) {
  const variant = active ? 'active' : 'stale';
  const group = parent.append('g').attr('class', [
    'link-group',
    `link-group--${variant}`,
    `link-${kind}`,
    extraClass || '',
  ].filter(Boolean).join(' '));

  group.append('path')
    .attr('class', `link-segment link-core link-core--${variant} link-${kind}`)
    .attr('d', d)
    .attr('fill', 'none')
    .attr('stroke', kind === 'bus' ? laneColorDim : (active ? laneColor : laneColorDim))
    .style('opacity', active ? 1 : 1);

  group.selectAll('.link-segment').each(function () {
    if (datum) d3.select(this).datum(datum);
  });

  if (onClick) {
    const handler = (ev, data) => { ev.stopPropagation(); onClick(data); };
    group.selectAll('.link-segment').on('click', handler);
  }

  group.selectAll('.link-segment')
    .on('mouseenter', () => { group.classed('link-group--hover', true); })
    .on('mouseleave', () => { group.classed('link-group--hover', false); });

  return group;
}

function appendNodeGraphic(nodeG, node, cx, cy) {
  const lane = node.lane;
  const color = hw.laneIconColor(lane);
  const g = nodeG.append('g')
    .attr('class', `node-group node-group--file${node.isFocus ? ' node-group--focus' : ' node-group--stale'}${node.isPulse ? ' node-group--pulse' : ''}`)
    .attr('data-node-id', node.id)
    .attr('transform', `translate(${cx},${cy})`)
    .attr('opacity', hw.state.animateNext ? 0 : 1)
    .datum(node);

  if (hw.nodeIsPulsing(node)) hw.appendNodeRipples(g, lane.color);

  hw.appendSvgLaneIcon(g, hw.nodeIconKind(node), color, hw.ICON_SIZE);

  g.append('circle')
    .attr('class', 'node-hit')
    .attr('r', hw.ICON_SIZE + hw.ICON_HIT_PAD)
    .attr('fill', 'transparent')
    .style('pointer-events', 'all');

  if (hw.PER_LANE_VERSION && node.laneVersion != null) {
    g.append('text')
      .attr('class', 'node-lane-ver')
      .attr('y', hw.ICON_SIZE + 9)
      .attr('text-anchor', 'middle')
      .text(hw.formatLaneVersion(node.laneVersion));
  }

  hw.bindFileNodePointer(g, node);
}

function appendVersionStepGraphic(nodeG, node, cx, cy) {
  const lane = node.lane;
  const color = hw.laneIconColor(lane);
  const size = hw.versionStepIconSize();
  const g = nodeG.append('g')
    .attr('class', 'node-group node-group--step')
    .attr('data-node-id', node.id)
    .attr('transform', `translate(${cx},${cy})`)
    .attr('opacity', hw.state.animateNext ? 0 : 0.62)
    .style('pointer-events', 'none')
    .datum(node);

  hw.appendSvgLaneIcon(g, hw.nodeIconKind(node), color, size);
  if (hw.PER_LANE_VERSION && node.laneVersion != null) {
    g.append('text')
      .attr('class', 'node-lane-ver node-lane-ver--step')
      .attr('y', size + 7)
      .attr('text-anchor', 'middle')
      .text(hw.formatLaneVersion(node.laneVersion));
  }
}

function appendBranchForkAnchor(nodeG, node, cx, cy) {
  const lane = node.lane;
  const color = hw.laneIconColor(lane);
  const g = nodeG.append('g')
    .attr('class', `node-group node-group--anchor node-group--fork-anchor${node.isFocus ? ' node-group--focus' : ' node-group--stale'}`)
    .attr('data-node-id', node.id)
    .attr('transform', `translate(${cx},${cy})`)
    .attr('opacity', hw.state.animateNext ? 0 : 1)
    .datum(node);

  g.append('circle')
    .attr('class', 'node-anchor-ring')
    .attr('r', hw.ICON_SIZE + 1.5)
    .attr('fill', 'none')
    .attr('stroke', color)
    .attr('stroke-width', 1.4)
    .style('pointer-events', 'none');
  g.append('circle')
    .attr('class', 'node-anchor-dot')
    .attr('r', hw.ICON_SIZE)
    .attr('fill', color)
    .style('pointer-events', 'none');

  g.append('circle')
    .attr('class', 'node-hit')
    .attr('r', hw.ICON_SIZE + hw.ICON_HIT_PAD)
    .attr('fill', 'transparent')
    .style('pointer-events', 'all');

  hw.bindFileNodePointer(g, node);
}

function appendBranchMergeAnchor(nodeG, node, cx, cy) {
  const lane = node.lane;
  const color = hw.laneIconColor(lane);
  const g = nodeG.append('g')
    .attr('class', `node-group node-group--anchor node-group--merge-anchor${node.isFocus ? ' node-group--focus' : ' node-group--stale'}`)
    .attr('data-node-id', node.id)
    .attr('transform', `translate(${cx},${cy})`)
    .attr('opacity', hw.state.animateNext ? 0 : 1)
    .datum(node);

  g.append('circle')
    .attr('class', 'node-anchor-ring node-anchor-ring--merge')
    .attr('r', hw.ICON_SIZE + 1.5)
    .attr('fill', 'none')
    .attr('stroke', color)
    .attr('stroke-width', 1.4)
    .style('pointer-events', 'none');
  g.append('circle')
    .attr('class', 'node-anchor-dot')
    .attr('r', hw.ICON_SIZE)
    .attr('fill', color)
    .style('pointer-events', 'none');

  g.append('circle')
    .attr('class', 'node-hit')
    .attr('r', hw.ICON_SIZE + hw.ICON_HIT_PAD)
    .attr('fill', 'transparent')
    .style('pointer-events', 'all');

  hw.bindFileNodePointer(g, node);
}

function appendFolderClusterNode(nodeG, node, cx, cy, bundle) {
  const lane = node.lane;
  const color = hw.laneIconColor(lane);
  const g = nodeG.append('g')
    .attr('class', `node-group node-group--folder${node.isFocus ? ' node-group--focus' : ''}${node.isPulse ? ' node-group--pulse' : ''}`)
    .attr('data-node-id', node.id)
    .attr('transform', `translate(${cx},${cy})`)
    .attr('opacity', hw.state.animateNext ? 0 : 1)
    .datum(node);

  const side = hw.ICON_SIZE * 2 + 2;
  hw.appendSvgFolderRect(g, 'node-folder-cluster', side / 2, color);

  const hit = g.append('circle')
    .attr('class', 'node-hit node-hit--folder')
    .attr('r', side / 2 + hw.ICON_HIT_PAD)
    .attr('fill', 'transparent')
    .style('pointer-events', 'all');

  hit
    .style('cursor', 'pointer')
    .on('click', (ev) => { ev.stopPropagation(); hw.onFolderClusterClick(ev, node); })
    .on('dblclick', (ev) => {
      ev.stopPropagation();
      hw.suppressOutsideClick = true;
      hw.openNodeModal(node);
    });

  g.select('.node-folder-cluster').style('pointer-events', 'none');

  if (node.fileCount > 1) {
    g.append('text')
      .attr('class', 'node-folder-count')
      .attr('y', 0)
      .attr('dy', '0.32em')
      .attr('text-anchor', 'middle')
      .attr('font-size', '6px')
      .attr('fill', '#0a0a0b')
      .attr('pointer-events', 'none')
      .text(node.fileCount);
  }

  hw.bindFolderNodePointer(g, node);
}

Object.assign(hw, {
  pulseColumn,
  rippleTargetNodeId,
  nodeShowsRipples,
  nodeIsPulsing,
  syncNodeRippleVisuals,
  pickDefaultPulseNode,
  setPulseNode,
  updateGraphFocus,
  appendNodeRipples,
  appendRulerRipples,
  fileIconKindFromPath,
  laneIconKind,
  isBranchGraphAnchor,
  isVersionStepNode,
  versionStepIconSize,
  nodeOnLaneAtColumn,
  nodeCanShowTooltip,
  nodeIconKind,
  equilateralTrianglePath,
  regularHexagonPath,
  folderRoundedRectRadius,
  appendSvgFolderRect,
  appendSvgLaneIcon,
  createRailIcon,
  installGraphDefs,
  appendLinkPath,
  appendNodeGraphic,
  appendVersionStepGraphic,
  appendBranchForkAnchor,
  appendBranchMergeAnchor,
  appendFolderClusterNode,
});
