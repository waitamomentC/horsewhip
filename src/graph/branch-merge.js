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

function segmentMergeCommit(seg, parsed) {
  const h = seg?.mergeHash;
  return h && parsed.commitMap[h] ? parsed.commitMap[h] : null;
}

/** Branch-side commit that was merged (2nd parent if on chain; else latest on chain at/before merge column). */
function segmentTipAtMergeColumn(mergeCommit, chain) {
  if (!mergeCommit || !chain?.length) return null;
  const bp = mergeCommit.parents?.[1];
  const chainSet = new Set(chain.map((c) => c.hash));
  if (bp && chainSet.has(bp)) {
    return chain.find((c) => c.hash === bp) || null;
  }
  const mergeCol = mergeCommit.versionIndex ?? mergeCommit.displayColumn ?? 0;
  let best = null;
  chain.forEach((c) => {
    const col = c.versionIndex ?? c.displayColumn ?? 0;
    if (col > mergeCol) return;
    if (!best || col >= (best.versionIndex ?? best.displayColumn)) best = c;
  });
  return best;
}

/** Branch names cited in merge subject (e.g. "merge TA-only-test: …"). */
function mergeCommitNamesBranchFromSubject(mergeCommit) {
  const sub = (mergeCommit?.subject || '').trim();
  const m = sub.match(/^merge\s+([^:(]+)/i);
  if (!m) return [];
  return m[1]
    .split(/\s+and\s+|\s*,\s*/i)
    .map((s) => s.trim())
    .filter(Boolean);
}

function mergeCommitNamesBranch(mergeCommit, branchName) {
  if (!mergeCommit || !branchName) return false;
  if (hw.commitBelongsToBranch(mergeCommit, branchName)) return true;
  const bn = hw.normalizeRefName(branchName).toLowerCase();
  const sub = (mergeCommit.subject || '').toLowerCase();
  if (!bn) return false;
  const escaped = bn.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  if (new RegExp(`merge\\s+${escaped}([\\s:]|$)`, 'i').test(sub)) return true;
  if (sub.includes(`merge branch '${bn}'`) || sub.includes(`merge branch "${bn}"`)) return true;
  return false;
}

function mergeCommitNamedBranches(mergeCommit, parsed) {
  const names = new Set();
  (parsed?.branchSegments || []).forEach((s) => {
    const n = s.name || s.id;
    if (n && hw.mergeCommitNamesBranch(mergeCommit, n)) names.add(n);
  });
  (hw.state?.gitBranches || parsed?.gitBranches || []).forEach((b) => {
    if (b?.name && hw.mergeCommitNamesBranch(mergeCommit, b.name)) names.add(b.name);
  });
  hw.mergeCommitNamesBranchFromSubject(mergeCommit).forEach((n) => names.add(n));
  return [...names];
}

/**
 * Branch actually merged at this commit (not merely sharing fork a2d57ea with cousins).
 * Named merges ("merge TA-only-test") only attach to that branch segment.
 */
function segmentParticipatedInMerge(seg, mergeCommit, chain, parsed) {
  const commits = chain || seg?.commits || [];
  const tipAtMerge = hw.segmentTipAtMergeColumn(mergeCommit, commits);
  if (!tipAtMerge) return false;
  const name = seg?.name || seg?.id;
  const named = hw.mergeCommitNamedBranches(mergeCommit, parsed);
  if (named.length) {
    return Boolean(name && named.some((n) => n.toLowerCase() === String(name).toLowerCase()));
  }
  const bp = mergeCommit.parents?.[1];
  if (!bp) return false;
  const chainSet = new Set(commits.map((c) => c.hash));
  return tipAtMerge.hash === bp || chainSet.has(bp);
}

function branchHasCommitsAfterMerge(seg, parsed) {
  const mc = hw.segmentMergeCommit(seg, parsed);
  const tip = seg.commits[seg.commits.length - 1];
  if (!mc || !tip) return false;
  const mergeCol = mc.versionIndex ?? mc.displayColumn ?? 0;
  const tipCol = tip.versionIndex ?? tip.displayColumn ?? 0;
  return tipCol > mergeCol;
}

/** Tip is strictly after merge on branch timeline (includes post-merge iteration from BC1 → C3). */
function branchMergeIsBehindTip(seg, parsed) {
  if (hw.branchHasCommitsAfterMerge(seg, parsed)) return true;
  const tip = seg.commits[seg.commits.length - 1];
  const mc = hw.segmentMergeCommit(seg, parsed);
  if (!tip || !mc) return false;
  return hw.isReachableFrom(mc.hash, tip.hash, parsed.commitMap)
    && !hw.isReachableFrom(tip.hash, mc.hash, parsed.commitMap);
}

function branchTipAtMerge(seg, parsed) {
  const mc = hw.segmentMergeCommit(seg, parsed);
  if (!mc) return seg.commits[seg.commits.length - 1] || null;
  const atMerge = hw.segmentTipAtMergeColumn(mc, seg.commits);
  if (atMerge) return atMerge;
  const bp = mc.parents?.[1] && parsed.commitMap[mc.parents[1]];
  const chainSet = new Set(seg.commits.map((c) => c.hash));
  if (bp && chainSet.has(bp.hash)) return bp;
  return seg.commits[seg.commits.length - 1] || null;
}

function coMergeLookupTip(seg, parsed) {
  return hw.branchMergeIsBehindTip(seg, parsed)
    ? hw.branchTipAtMerge(seg, parsed)
    : seg.commits[seg.commits.length - 1];
}

function findCoMergeLanding(seg, parsed) {
  if (seg.mergeHash && parsed.commitMap[seg.mergeHash]) return null;
  const tip = hw.coMergeLookupTip(seg, parsed);
  if (!tip) return null;
  let best = null;
  parsed.commits.forEach((c) => {
    if (!c.parents || c.parents.length < 2) return;
    if (!parsed.mainlineSet.has(c.hash)) return;
    const branchParent = c.parents[1];
    if (!branchParent) return;
    if (!hw.segmentParticipatedInMerge(seg, c, seg.commits, parsed)) return;
    const col = c.versionIndex ?? c.displayColumn;
    if (!best || col < best.column) best = { commit: c, column: col };
  });
  return best;
}

function branchSegmentJoinColumn(seg, parsed) {
  const mc = hw.segmentMergeCommit(seg, parsed);
  if (mc && mc.parents.length >= 2) {
    return mc.versionIndex ?? mc.displayColumn;
  }
  const co = hw.findCoMergeLanding(seg, parsed);
  if (co) return co.column;
  const tip = seg.commits[seg.commits.length - 1];
  return tip ? (tip.versionIndex ?? tip.displayColumn) : null;
}

/**
 * Strict: merge commit's 2nd parent is on this chain (single-branch merge).
 * For graph arcs use segmentParticipatedInMerge — dual merge often lists only one parent tip.
 */
function segmentOwnsMergeCommit(seg, mergeCommit, chain, parsed) {
  if (!mergeCommit?.parents || mergeCommit.parents.length < 2) return false;
  const commits = chain || seg.commits || [];
  const tipAtMerge = hw.segmentTipAtMergeColumn(mergeCommit, commits);
  if (!tipAtMerge) return false;
  const bp = mergeCommit.parents[1];
  const chainSet = new Set(commits.map((c) => c.hash));
  if (chainSet.has(bp) || tipAtMerge.hash === bp) return true;
  const bpCommit = parsed.commitMap[bp];
  if (bpCommit && hw.isReachableFrom(tipAtMerge.hash, bp, parsed.commitMap)) return true;
  if (bpCommit && hw.isReachableFrom(bp, tipAtMerge.hash, parsed.commitMap)) return true;
  return false;
}

function segmentOwnsMerge(seg, parsed) {
  const mc = hw.segmentMergeCommit(seg, parsed);
  if (!mc) return false;
  return hw.segmentParticipatedInMerge(seg, mc, seg.commits, parsed);
}

/** Whether this segment has a merge landing on the parent lane (incl. after branch continued past merge). */
function branchSegmentHasHistoricalMerge(seg, parsed) {
  if (hw.segmentOwnsMerge(seg, parsed)) return true;
  if (hw.findCoMergeLanding(seg, parsed)) return true;
  if (hw.branchSegmentFullyOnMainline(seg, parsed)) return true;
  return false;
}

function shouldDrawMergeIntoParent(seg, parsed) {
  return hw.branchSegmentHasHistoricalMerge(seg, parsed);
}

function branchSegmentLandingCommit(seg, parsed) {
  const mc = hw.segmentMergeCommit(seg, parsed);
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
    isHistoricalMergeLanding: hw.branchSegmentFrozenMerge(seg, parsed),
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
  segmentMergeCommit,
  segmentTipAtMergeColumn,
  mergeCommitNamesBranchFromSubject,
  mergeCommitNamesBranch,
  mergeCommitNamedBranches,
  segmentParticipatedInMerge,
  branchHasCommitsAfterMerge,
  branchMergeIsBehindTip,
  branchTipAtMerge,
  coMergeLookupTip,
  findCoMergeLanding,
  branchSegmentJoinColumn,
  segmentOwnsMergeCommit,
  segmentOwnsMerge,
  branchSegmentHasHistoricalMerge,
  shouldDrawMergeIntoParent,
  branchSegmentLandingCommit,
  mergeLaneVersionOnParent,
  ensureParentMergeLandingNode,
});
