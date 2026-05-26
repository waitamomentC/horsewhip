import { hw } from '../core/hw.js';

function segmentsForLane(lane, parsed) {
  return (parsed.branchSegments || []).filter((seg) => hw.segmentTouchesLane(seg, lane));
}

function laneForkV(lane, seg, parsed) {
  const trunk = parsed.trunkLaneCommitSet || parsed.mainlineSet;
  const branchOnLane = seg.commits.filter((c) =>
    c.files.some((f) => hw.fileMatchesLane(f, lane)));
  if (!branchOnLane.length) {
    return parsed.commitMap[seg.forkHash]?.versionIndex ?? 1;
  }
  const firstBranchV = Math.min(...branchOnLane.map((c) => c.versionIndex));
  let lastTrunkV = 1;
  parsed.commits.forEach((c) => {
    if (!trunk.has(c.hash)) return;
    if (!c.files.some((f) => hw.fileMatchesLane(f, lane))) return;
    if (c.versionIndex < firstBranchV) lastTrunkV = Math.max(lastTrunkV, c.versionIndex);
  });
  return lastTrunkV;
}

function laneSegmentBounds(lane, seg, parsed) {
  const forkV = hw.laneForkV(lane, seg, parsed);
  const mergeV = hw.shouldDrawMergeIntoParent(seg, parsed)
    ? hw.branchSegmentJoinColumn(seg, parsed)
    : null;
  return { forkV, mergeV };
}

function commitBlockedOnParentLane(commit, lane, parsed) {
  const trunk = parsed.trunkLaneCommitSet || parsed.mainlineSet;
  if (trunk.has(commit.hash)) return false;
  const v = commit.versionIndex;
  for (const seg of hw.segmentsForLane(lane, parsed)) {
    const { forkV, mergeV } = hw.laneSegmentBounds(lane, seg, parsed);
    if (!forkV || v <= forkV) continue;
    if (!seg.merged) return true;
    if (mergeV && v > forkV && v < mergeV) return true;
  }
  return false;
}

function parentLaneTrackHoles(lane, parsed) {
  const headV = hw.headMainlineVersion(parsed);
  const holes = [];
  hw.segmentsForLane(lane, parsed).forEach((seg) => {
    const { forkV, mergeV } = hw.laneSegmentBounds(lane, seg, parsed);
    if (!forkV) return;
    if (seg.continued) return;
    if (!seg.merged && forkV < headV) {
      holes.push({ from: forkV + 1, to: headV });
    }
  });
  return holes;
}

function trackRangesFromHoles(vStart, vEnd, holes) {
  const sorted = holes
    .filter((h) => h.to >= h.from)
    .sort((a, b) => a.from - b.from);
  const ranges = [];
  let cur = vStart;
  sorted.forEach((h) => {
    if (cur < h.from) ranges.push({ vStart: cur, vEnd: h.from - 1 });
    cur = Math.max(cur, h.to + 1);
  });
  if (cur <= vEnd) ranges.push({ vStart: cur, vEnd });
  return ranges.length ? ranges : [{ vStart, vEnd }];
}

function parentLaneTrackRanges(lane, parsed) {
  const headV = hw.headMainlineVersion(parsed);
  const holes = hw.parentLaneTrackHoles(lane, parsed);
  if (!holes.length) return [{ vStart: 1, vEnd: Math.max(1, headV) }];
  return hw.trackRangesFromHoles(1, headV, holes);
}

function branchLaneTrackRange(lane, parsed, bundlesOnLane) {
  const headV = hw.headMainlineVersion(parsed);
  const seg = lane.branchSegment;
  let vStart = 1;
  let vEnd = headV;
  if (bundlesOnLane?.length) {
    const cols = bundlesOnLane.map((b) => b.displayColumn ?? b.commit.displayColumn);
    vStart = Math.min(...cols);
    vEnd = Math.max(headV, ...cols);
  } else if (seg?.commits?.length) {
    vStart = Math.min(...seg.commits.map((c) => c.versionIndex ?? c.displayColumn));
  }
  if (seg && hw.branchMergeIsBehindTip(seg, parsed)) {
    const joinV = hw.branchSegmentJoinColumn(seg, parsed);
    if (joinV != null) vStart = Math.min(vStart, joinV);
  }
  return { vStart, vEnd };
}

function laneStepSkipColumns(lane, parsed, bundlesOnLane) {
  const skip = new Set();
  if (lane.isBranchLane) {
    const { vStart } = hw.branchLaneTrackRange(lane, parsed, bundlesOnLane);
    const seg = lane.branchSegment;
    const parentLane = { path: lane.parentLanePath };
    const forkV = seg ? hw.laneForkV(parentLane, seg, parsed) : null;
    if (forkV != null) {
      for (let v = forkV; v < vStart; v += 1) skip.add(v);
    }
    return skip;
  }
  hw.parentLaneTrackHoles(lane, parsed).forEach((h) => {
    for (let v = h.from; v <= h.to; v += 1) skip.add(v);
  });
  return skip;
}

function commitAppliesToLane(commit, lane, parsed) {
  if (lane.isHeader) return false;
  const matched = commit.files.filter((f) => hw.fileMatchesLane(f, lane));
  if (!matched.length) return false;
  if (lane.isBranchLane) return lane.branchSegment.commitSet.has(commit.hash);
  const trunk = parsed.trunkLaneCommitSet || parsed.mainlineSet;
  if (!trunk.has(commit.hash)) return false;
  if (hw.commitBlockedOnParentLane(commit, lane, parsed)) return false;
  return true;
}

Object.assign(hw, {
  segmentsForLane,
  laneForkV,
  laneSegmentBounds,
  commitBlockedOnParentLane,
  parentLaneTrackHoles,
  trackRangesFromHoles,
  parentLaneTrackRanges,
  branchLaneTrackRange,
  laneStepSkipColumns,
  commitAppliesToLane,
});
