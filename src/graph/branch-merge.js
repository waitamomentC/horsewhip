import { hw } from '../core/hw.js';

function segmentTouchesLane(seg, lane) {
  if (lane.isHeader || lane.isBranchLane) return false;
  return seg.commits.some((c) => c.files.some((f) => hw.fileMatchesLane(f, lane)));
}

function branchSegmentFullyOnMainline(seg, parsed) {
  if (!seg?.commits?.length) return false;
  const trunk = parsed.mainlineSet;
  return seg.commits.every((c) => trunk.has(c.hash));
}

function branchMergeIsBehindTip(seg, parsed) {
  const tip = seg.commits[seg.commits.length - 1];
  const mc = hw.segmentOwnsMerge(seg, parsed) ? parsed.commitMap[seg.mergeHash] : null;
  if (!tip || !mc) return false;
  return hw.isReachableFrom(mc.hash, tip.hash, parsed.commitMap)
    && !hw.isReachableFrom(tip.hash, mc.hash, parsed.commitMap);
}

function branchTipAtMerge(seg, parsed) {
  const mc = hw.segmentOwnsMerge(seg, parsed) ? parsed.commitMap[seg.mergeHash] : null;
  if (mc?.parents?.length >= 2) {
    const p = parsed.commitMap[mc.parents[1]];
    if (p) return p;
  }
  if (!hw.branchMergeIsBehindTip(seg, parsed)) {
    return seg.commits[seg.commits.length - 1] || null;
  }
  const mergeCol = mc?.versionIndex ?? mc?.displayColumn;
  if (mergeCol == null) return seg.commits[seg.commits.length - 1] || null;
  let best = null;
  seg.commits.forEach((c) => {
    const col = c.versionIndex ?? c.displayColumn;
    if (col > mergeCol) return;
    if (!best || col > (best.versionIndex ?? best.displayColumn)) best = c;
  });
  return best || seg.commits[seg.commits.length - 1] || null;
}

function coMergeLookupTip(seg, parsed) {
  return hw.branchMergeIsBehindTip(seg, parsed)
    ? hw.branchTipAtMerge(seg, parsed)
    : seg.commits[seg.commits.length - 1];
}

function findCoMergeLanding(seg, parsed) {
  if (seg.mergeHash && parsed.commitMap[seg.mergeHash]) return null;
  if (hw.branchSegmentFrozenMerge(seg, parsed)) return null;
  const tip = hw.coMergeLookupTip(seg, parsed);
  if (!tip) return null;
  let best = null;
  parsed.commits.forEach((c) => {
    if (!c.parents || c.parents.length < 2) return;
    if (!parsed.mainlineSet.has(c.hash)) return;
    const branchParent = c.parents[1];
    if (!branchParent) return;
    if (!hw.segmentOwnsMergeCommit(seg, c, seg.commits, parsed)) return;
    const col = c.versionIndex ?? c.displayColumn;
    if (!best || col < best.column) best = { commit: c, column: col };
  });
  return best;
}

function branchSegmentJoinColumn(seg, parsed) {
  const mc = hw.segmentOwnsMerge(seg, parsed) ? parsed.commitMap[seg.mergeHash] : null;
  if (mc && mc.parents.length >= 2) {
    return mc.versionIndex ?? mc.displayColumn;
  }
  const co = hw.findCoMergeLanding(seg, parsed);
  if (co) return co.column;
  const tip = seg.commits[seg.commits.length - 1];
  return tip ? (tip.versionIndex ?? tip.displayColumn) : null;
}

/** True when this segment (not a cousin branch) is what the merge commit brought in. */
function segmentOwnsMergeCommit(seg, mergeCommit, chain, parsed) {
  if (!mergeCommit?.parents || mergeCommit.parents.length < 2) return false;
  const bp = mergeCommit.parents[1];
  const chainSet = new Set((chain || seg.commits || []).map((c) => c.hash));
  if (!chainSet.has(bp)) return false;
  const commits = chain || seg.commits || [];
  const tip = commits[commits.length - 1];
  if (tip && bp === tip.hash) return true;
  const mergeCol = mergeCommit.versionIndex ?? mergeCommit.displayColumn ?? 0;
  let tipAtMerge = null;
  commits.forEach((c) => {
    const col = c.versionIndex ?? c.displayColumn ?? 0;
    if (col > mergeCol) return;
    if (!tipAtMerge || col >= (tipAtMerge.versionIndex ?? tipAtMerge.displayColumn)) tipAtMerge = c;
  });
  if (tipAtMerge && bp === tipAtMerge.hash) return true;
  const name = seg?.name || seg?.id;
  if (!name) return false;
  if (hw.commitBelongsToBranch(mergeCommit, name)) return true;
  const bpCommit = parsed.commitMap[bp];
  return Boolean(bpCommit && hw.commitBelongsToBranch(bpCommit, name));
}

function segmentOwnsMerge(seg, parsed) {
  const mc = seg.mergeHash && parsed.commitMap[seg.mergeHash];
  if (!mc) return false;
  return hw.segmentOwnsMergeCommit(seg, mc, seg.commits, parsed);
}

function shouldDrawMergeIntoParent(seg, parsed) {
  if (hw.segmentOwnsMerge(seg, parsed)) {
    return !hw.branchSegmentFrozenMerge(seg, parsed);
  }
  if (hw.branchSegmentFrozenMerge(seg, parsed)) return false;
  if (hw.findCoMergeLanding(seg, parsed)) return true;
  if (hw.branchSegmentFullyOnMainline(seg, parsed)) return true;
  return false;
}

function branchSegmentLandingCommit(seg, parsed) {
  const mc = hw.segmentOwnsMerge(seg, parsed) ? parsed.commitMap[seg.mergeHash] : null;
  if (mc) return mc;
  const co = hw.findCoMergeLanding(seg, parsed);
  if (co) return co.commit;
  if (seg.mergeHash) return parsed.commitMap[seg.mergeHash] || null;
  return seg.commits[seg.commits.length - 1] || null;
}

function mergeLaneVersionOnParent(landing, seg, parentLane, parsed) {
  if (landing?.laneVersions?.[parentLane.path] != null) {
    return landing.laneVersions[parentLane.path];
  }
  let maxV = 0;
  seg.commits.forEach((c) => {
    const v = c.laneVersions?.[parentLane.path];
    if (v != null) maxV = Math.max(maxV, v);
  });
  if (maxV > 0) return maxV;
  return hw.laneForkLaneVersion(parentLane, seg, parsed);
}

function ensureParentMergeLandingNode(nodes, bundlesOnLane, parentLane, seg, parsed, focusGraphX, head) {
  if (!hw.shouldDrawMergeIntoParent(seg, parsed)) return;
  const mergeV = hw.branchSegmentJoinColumn(seg, parsed);
  if (mergeV == null || !hw.columnInWindow(mergeV)) return;
  if (hw.nodeOnLaneAtColumn(nodes, parentLane.path, mergeV)) return;

  const landing = hw.branchSegmentLandingCommit(seg, parsed);
  if (!landing) return;

  const matched = landing.files.filter((f) => hw.fileMatchesLane(f, parentLane));
  const laneVer = hw.mergeLaneVersionOnParent(landing, seg, parentLane, parsed);
  const applies = matched.length > 0 && hw.commitAppliesToLane(landing, parentLane, parsed);
  const nodeId = applies
    ? `${landing.hash}:${parentLane.path}@c${mergeV}`
    : `merge-landing:${landing.hash}:${parentLane.path}:${mergeV}`;

  const graphNode = {
    id: nodeId,
    hash: landing.hash,
    author: landing.author,
    date: landing.date,
    subject: landing.subject || '',
    versionIndex: landing.versionIndex,
    laneVersion: hw.PER_LANE_VERSION ? laneVer : null,
    globalIndex: mergeV,
    graphX: mergeV,
    displayColumn: mergeV,
    lanePath: parentLane.path,
    laneIndex: parentLane.laneIndex,
    lane: parentLane,
    label: parentLane.label,
    filePath: matched[0] || hw.laneMatchPath(parentLane),
    files: matched,
    fileCount: matched.length,
    isFocus: hw.columnsMatch(mergeV, focusGraphX),
    isPulse: hw.nodeIsPulsing({ id: nodeId }),
    isHead: landing.hash === head.hash,
    isHub: true,
    isMergeLanding: true,
    isFolderAggregate: parentLane.type === 'folder' && !parentLane.isHeader,
    isBranchLane: false,
    branchName: seg.name,
  };

  if (!applies && !hw.segmentTouchesLane(seg, parentLane)) return;

  nodes.push(graphNode);
  const hasBundle = bundlesOnLane.some(
    (b) => b.commit.hash === landing.hash
      && hw.columnsMatch(b.displayColumn ?? b.graphX, mergeV),
  );
  if (!hasBundle) {
    bundlesOnLane.push({
      id: `bundle-${landing.hash}`,
      commit: landing,
      graphX: mergeV,
      displayColumn: mergeV,
      isFocus: graphNode.isFocus,
      isHead: graphNode.isHead,
      onPage: [{ lane: parentLane, laneIndex: parentLane.laneIndex, lanePath: parentLane.path, files: matched }],
      hubLanePath: parentLane.path,
      hubLaneIndex: parentLane.laneIndex,
      files: matched,
    });
    bundlesOnLane.sort((a, b) => a.displayColumn - b.displayColumn);
  }
}

Object.assign(hw, {
  segmentTouchesLane,
  branchSegmentFullyOnMainline,
  branchMergeIsBehindTip,
  branchTipAtMerge,
  coMergeLookupTip,
  findCoMergeLanding,
  branchSegmentJoinColumn,
  segmentOwnsMergeCommit,
  segmentOwnsMerge,
  shouldDrawMergeIntoParent,
  branchSegmentLandingCommit,
  mergeLaneVersionOnParent,
  ensureParentMergeLandingNode,
});
