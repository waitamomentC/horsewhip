import { hw } from '../core/hw.js';

function makeVersionStepNode(lane, globalColumn, laneVersion) {
  return {
    id: `step:${lane.path}:${globalColumn}`,
    isVersionStep: true,
    displayColumn: globalColumn,
    graphX: globalColumn,
    laneVersion,
    lanePath: lane.path,
    laneIndex: lane.laneIndex,
    lane,
    label: lane.label,
  };
}

function buildLaneVersionEvents(lane, parsed, graphNodes = []) {
  const events = [];
  const seen = new Set();
  const pushEvent = (globalColumn, laneVersion, commit) => {
    const key = `${globalColumn}:${lane.path}`;
    if (seen.has(key)) return;
    seen.add(key);
    events.push({ laneVersion, globalColumn, commit });
  };

  parsed.commits.forEach((commit) => {
    if (!hw.commitInColumnWindow(commit)) return;
    if (!hw.commitAppliesToLane(commit, lane, parsed)) return;
    const laneV = commit.laneVersions?.[lane.path];
    if (laneV == null) return;
    pushEvent(commit.displayColumn, laneV, commit);
  });

  graphNodes.forEach((n) => {
    if (n.lanePath !== lane.path || !n.isMergeLanding) return;
    const col = n.displayColumn ?? n.graphX;
    if (col == null || !hw.columnInWindow(col)) return;
    pushEvent(col, n.laneVersion ?? 1, parsed.commitMap[n.hash]);
  });

  return events.sort((a, b) => a.globalColumn - b.globalColumn);
}

function laneTrackTimeline(vStart, vEnd, win) {
  const start = Math.max(1, Math.floor(vStart));
  const end = Math.max(start, Math.floor(vEnd));
  const timeline = [];
  for (let v = start; v <= end; v += 1) {
    if (hw.columnInWindow(v, win)) timeline.push(v);
  }
  return { vStart: start, vEnd: end, timeline };
}

function traceAnchorAtColumn(nodes, lane, columnV) {
  const node = nodes.find((n) => n.lanePath === lane.path && !hw.isBranchGraphAnchor(n)
    && hw.columnsMatch(n.displayColumn ?? n.graphX, columnV));
  const col = node ? (node.displayColumn ?? node.graphX) : columnV;
  return { graphX: col, displayColumn: col, node };
}

function addLaneVersionTrace(lane, nodes, links, parsed, bundlesOnLane) {
  if (lane.isHeader) return;

  if (!hw.PER_LANE_VERSION) {
    const skipCols = hw.laneStepSkipColumns(lane, parsed, bundlesOnLane);
    const ranges = lane.isBranchLane
      ? [hw.branchLaneTrackRange(lane, parsed, bundlesOnLane)]
      : hw.parentLaneTrackRanges(lane, parsed);
    ranges.forEach((range) => {
      const { vStart, vEnd, timeline } = hw.laneTrackTimeline(
        range.vStart,
        range.vEnd,
        hw.state.visibleColumnWindow,
      );
      if (vEnd < vStart) return;
      links.push({
        kind: 'lane-track',
        vStart,
        vEnd,
        lane,
        laneIndex: lane.laneIndex,
        active: false,
      });
      const cols = timeline.filter((columnV) => !skipCols.has(columnV));
      cols.forEach((columnV) => {
        if (hw.nodeOnLaneAtColumn(nodes, lane.path, columnV)) return;
        nodes.push(hw.makeVersionStepNode(lane, columnV, columnV));
      });
      for (let i = 1; i < cols.length; i += 1) {
        links.push({
          kind: 'lane-trace',
          from: hw.traceAnchorAtColumn(nodes, lane, cols[i - 1]),
          to: hw.traceAnchorAtColumn(nodes, lane, cols[i]),
          lane,
          laneIndex: lane.laneIndex,
          active: false,
        });
      }
    });
    return;
  }

  const events = hw.buildLaneVersionEvents(lane, parsed, nodes);
  if (!events.length) return;

  events.forEach((ev, i) => {
    if (!hw.columnInWindow(ev.globalColumn, hw.state.visibleColumnWindow)) return;
    if (!hw.nodeOnLaneAtColumn(nodes, lane.path, ev.globalColumn)) {
      nodes.push(hw.makeVersionStepNode(lane, ev.globalColumn, ev.laneVersion));
    }
    if (i > 0) {
      const prev = events[i - 1];
      links.push({
        kind: 'lane-trace',
        from: hw.traceAnchorAtColumn(nodes, lane, prev.globalColumn),
        to: hw.traceAnchorAtColumn(nodes, lane, ev.globalColumn),
        lane,
        laneIndex: lane.laneIndex,
        active: false,
        laneVersion: ev.laneVersion,
      });
    }
  });
}

function makeGraphNode(commit, lane, files, focusGraphX, head) {
  return {
    id: `${commit.hash}:${lane.path}`,
    hash: commit.hash,
    author: commit.author,
    date: commit.date,
    subject: commit.subject || '',
    versionIndex: commit.versionIndex,
    laneVersion: commit.laneVersions?.[lane.path] ?? null,
    globalIndex: commit.displayColumn,
    graphX: commit.displayColumn,
    displayColumn: commit.displayColumn,
    lanePath: lane.path,
    laneIndex: lane.laneIndex,
    lane,
    label: lane.label,
    filePath: lane.collapsed ? lane.label : files[0],
    files,
    fileCount: files.length,
    isFocus: hw.columnsMatch(commit.displayColumn, focusGraphX),
    isPulse: hw.nodeIsPulsing({ id: `${commit.hash}:${lane.path}` }),
    isHead: commit.hash === head.hash,
    isHub: true,
    isFolderAggregate: lane.type === 'folder' && !lane.isHeader,
    isBranchLane: !!lane.isBranchLane,
  };
}

function branchBundlesOnLane(parsed, catalog, seg, branchLane) {
  const bundles = [];
  parsed.commits.forEach((commit) => {
    if (!hw.commitInColumnWindow(commit)) return;
    if (!seg.commitSet.has(commit.hash)) return;
    if (!hw.commitAppliesToLane(commit, branchLane, parsed)) return;
    const matched = commit.files.filter((f) => hw.fileMatchesLane(f, branchLane));
    if (!matched.length) return;
    bundles.push({
      commit,
      graphX: commit.displayColumn,
      displayColumn: commit.displayColumn,
      onPage: [{ lane: branchLane, lanePath: branchLane.path, files: matched }],
    });
  });
  return bundles.sort((a, b) => a.displayColumn - b.displayColumn);
}

function buildLaneSlice(parsed, catalog, laneIndex) {
  const lane = catalog.lanes[laneIndex];
  const focusGraphX = catalog.focusGraphX;
  const head = catalog.headCommit;
  const nodes = [];
  const links = [];
  const bundlesOnLane = [];

  parsed.commits.forEach((commit) => {
    if (!hw.commitInColumnWindow(commit)) return;
    if (!hw.commitAppliesToLane(commit, lane, parsed)) return;
    const matched = commit.files.filter((f) => hw.fileMatchesLane(f, lane));
    if (!matched.length) return;
    bundlesOnLane.push({
      id: `bundle-${commit.hash}`,
      commit,
      graphX: commit.displayColumn,
      displayColumn: commit.displayColumn,
      isFocus: hw.columnsMatch(commit.displayColumn, focusGraphX),
      isHead: commit.hash === head.hash,
      onPage: [{ lane, laneIndex, lanePath: lane.path, files: matched }],
      hubLanePath: lane.path,
      hubLaneIndex: laneIndex,
      files: matched,
    });
    nodes.push(hw.makeGraphNode(commit, lane, matched, focusGraphX, head));
  });

  bundlesOnLane.sort((a, b) => a.displayColumn - b.displayColumn);

  if (!lane.isHeader && !lane.isBranchLane) {
    (parsed.branchSegments || []).forEach((seg) => {
      if (!hw.segmentTouchesLane(seg, lane)) return;
      hw.ensureParentMergeLandingNode(
        nodes, bundlesOnLane, lane, seg, parsed, focusGraphX, head,
      );
    });
  }

  hw.addLaneVersionTrace(lane, nodes, links, parsed, bundlesOnLane);
  if (lane.isBranchLane && bundlesOnLane.length > 1) {
    for (let i = 1; i < bundlesOnLane.length; i += 1) {
      links.push({
        kind: 'lane-bridge',
        from: bundlesOnLane[i - 1],
        to: bundlesOnLane[i],
        lane,
        laneIndex,
        active: false,
      });
    }
  }

  (parsed.branchSegments || []).forEach((seg) => {
    const forkCommit = parsed.commitMap[seg.forkHash];
      const mergeCommit = seg.mergeHash ? parsed.commitMap[seg.mergeHash] : null;
      const joinV = hw.branchSegmentJoinColumn(seg, parsed);
      const drawMerge = hw.shouldDrawMergeIntoParent(seg, parsed);
      if (!forkCommit) return;
      catalog.lanes.forEach((branchLane) => {
        if (!branchLane.isBranchLane || branchLane.branchSegment !== seg) return;
        const parentLane = catalog.lanes.find((l) => l.path === branchLane.parentLanePath);
        if (!parentLane) return;

        const forkV = hw.laneForkV(parentLane, seg, parsed);
        const mergeV = drawMerge ? joinV : null;
        const forkX = hw.versionX(forkV);
        const mergeX = mergeV != null ? hw.versionX(mergeV) : null;

      const branchBundles = hw.branchBundlesOnLane(parsed, catalog, seg, branchLane);
      const firstBranch = branchBundles[0];
      const lastBranch = branchBundles[branchBundles.length - 1];

      if (parentLane.laneIndex === laneIndex && firstBranch
        && (hw.columnInWindow(forkV) || hw.columnInWindow(firstBranch.displayColumn))) {
        links.push({
          kind: 'fork',
          x1: forkX,
          y1: hw.laneCenterY(parentLane.laneIndex),
          x2: hw.versionX(firstBranch.displayColumn ?? firstBranch.commit.displayColumn),
          y2: hw.laneCenterY(branchLane.laneIndex),
          parentLane,
          branchLane,
          active: true,
        });
      }

      if (drawMerge && mergeV != null && branchLane.laneIndex === laneIndex
        && lastBranch
        && (hw.columnInWindow(mergeV) || hw.columnInWindow(lastBranch.displayColumn))) {
        const histMerge = hw.branchMergeIsBehindTip(seg, parsed);
        const mergeSource = histMerge ? hw.branchTipAtMerge(seg, parsed) : lastBranch.commit;
        const mergeFromCol = mergeSource
          ? (mergeSource.versionIndex ?? mergeSource.displayColumn)
          : lastBranch.displayColumn;
        const mergeFromX = hw.versionX(mergeFromCol);
        const mergeToX = mergeX ?? hw.versionX(mergeV);
        links.push({
          kind: 'merge',
          x1: mergeFromX,
          y1: hw.laneCenterY(branchLane.laneIndex),
          x2: mergeToX,
          y2: hw.laneCenterY(parentLane.laneIndex),
          parentLane,
          branchLane,
          active: true,
        });
      }
    });
  });

  return { nodes, links, bundlesOnLane };
}

function branchLabelForNode(node) {
  if (node?.lane?.isBranchLane && node.lane.branchSegment) {
    return `分支 ⎇ ${node.lane.branchSegment.name}`;
  }
  return '主泳道';
}

Object.assign(hw, {
  makeVersionStepNode,
  buildLaneVersionEvents,
  laneTrackTimeline,
  traceAnchorAtColumn,
  addLaneVersionTrace,
  makeGraphNode,
  branchBundlesOnLane,
  buildLaneSlice,
  branchLabelForNode,
});
