import { hw } from '../core/hw.js';

function assignDisplayColumns(commits) {
  commits.forEach((c) => {
    c.displayColumn = c.versionIndex;
  });
}

function columnsMatch(a, b) {
  return Math.abs(a - b) < 0.001;
}

function formatGlobalCommitColumn(column) {
  if (column == null || Number.isNaN(column)) return 'C?';
  return `C${Math.round(Number(column))}`;
}

function formatLaneVersion(laneV) {
  if (laneV == null || Number.isNaN(laneV)) return 'V?';
  return `V${Math.round(Number(laneV))}`;
}

function formatDisplayVersion(column) {
  return hw.PER_LANE_VERSION ? hw.formatGlobalCommitColumn(column) : hw.formatLaneVersion(column);
}

function formatNodeVersion(node) {
  if (hw.PER_LANE_VERSION && node?.laneVersion != null) return hw.formatLaneVersion(node.laneVersion);
  return hw.formatDisplayVersion(node?.displayColumn ?? node?.graphX);
}

function nodeVersionTooltipLine(node) {
  const col = node?.displayColumn ?? node?.graphX;
  if (!hw.PER_LANE_VERSION) return hw.formatNodeVersion(node);
  const global = hw.formatGlobalCommitColumn(col);
  const local = node?.laneVersion != null ? hw.formatLaneVersion(node.laneVersion) : null;
  return local ? `${local} · 上传 ${global}` : global;
}

function assignPerLaneVersions(parsed, allFiles) {
  if (!hw.PER_LANE_VERSION) return;
  const baseLanes = hw.collectVisibleLanes(allFiles).filter((l) => !l.isHeader);
  const counters = new Map();
  const branchPaths = [];

  baseLanes.forEach((lane) => counters.set(lane.path, 0));
  (parsed.branchSegments || []).forEach((seg) => {
    baseLanes.forEach((lane) => {
      if (!hw.segmentTouchesLane(seg, lane)) return;
      const bp = `${lane.path}#⎇${seg.id}`;
      counters.set(bp, 0);
      branchPaths.push({ path: bp, seg, parent: lane });
    });
  });

  parsed.commits.forEach((commit) => {
    commit.laneVersions = {};
    baseLanes.forEach((lane) => {
      const matched = commit.files.filter((f) => hw.fileMatchesLane(f, lane));
      if (!matched.length) return;
      const next = (counters.get(lane.path) || 0) + 1;
      counters.set(lane.path, next);
      commit.laneVersions[lane.path] = next;
    });
    branchPaths.forEach(({ path, seg, parent }) => {
      if (!seg.commitSet.has(commit.hash)) return;
      if (!commit.files.some((f) => hw.fileMatchesLane(f, parent))) return;
      const next = (counters.get(path) || 0) + 1;
      counters.set(path, next);
      commit.laneVersions[path] = next;
    });
  });

  parsed.laneVersionAtHead = Object.fromEntries(counters);
}

function laneVersionAtHead(parsed, lanePath) {
  return parsed?.laneVersionAtHead?.[lanePath] ?? 0;
}

function laneForkLaneVersion(lane, seg, parsed) {
  const forkCommit = parsed.commitMap[seg.forkHash];
  if (!forkCommit) return 1;
  if (hw.PER_LANE_VERSION && forkCommit.laneVersions?.[lane.path] != null) {
    return forkCommit.laneVersions[lane.path];
  }
  return forkCommit.versionIndex ?? forkCommit.displayColumn ?? 1;
}

function truncateSubject(text, max = 16) {
  const t = String(text || '').trim();
  if (!t) return '';
  if (t.length <= max) return t;
  return `${t.slice(0, Math.max(1, max - 1))}…`;
}

function commitAtMainlineVersion(parsed, columnV) {
  if (!parsed) return null;
  return parsed.commits.find(
    (c) => c.isMainline && c.mainlineVersionIndex === columnV,
  ) || null;
}

function commitAtUploadColumn(parsed, columnV) {
  if (!parsed) return null;
  return parsed.commits.find(
    (c) => c.versionIndex === columnV || hw.columnsMatch(c.displayColumn, columnV),
  ) || null;
}

function headUploadColumn(parsed) {
  const head = hw.headCommit(parsed);
  return head?.versionIndex ?? head?.displayColumn ?? parsed?.commits?.length ?? 0;
}

function maxLoadedUploadColumn(parsed) {
  if (!parsed?.commits?.length) return 0;
  let max = 0;
  parsed.commits.forEach((c) => {
    const col = c.versionIndex ?? c.displayColumn ?? 0;
    if (col > max) max = col;
  });
  return max;
}

function versionLabelWithSubject(parsed, columnV, maxSubject = 14) {
  const base = hw.PER_LANE_VERSION ? hw.formatGlobalCommitColumn(columnV) : hw.formatDisplayVersion(columnV);
  const headV = hw.headUploadColumn(parsed) || 0;
  if (!parsed || columnV > headV) return base;
  const commit = hw.PER_LANE_VERSION
    ? hw.commitAtUploadColumn(parsed, columnV)
    : hw.commitAtMainlineVersion(parsed, columnV);
  const subj = hw.truncateSubject(commit?.subject, maxSubject);
  return subj ? `${base} · ${subj}` : base;
}

function commitSubjectForNode(node) {
  const fromNode = node?.subject?.trim();
  if (fromNode) return fromNode;
  const c = hw.state.parsed?.commitMap?.[node?.hash];
  return c?.subject?.trim() || '';
}

function rulerExtent(parsed) {
  const headV = hw.headMainlineVersion(parsed) || 0;
  const loadedMax = hw.maxLoadedUploadColumn(parsed);
  let extent = hw.CONFIG.RULER_PRESET;
  if (Math.max(headV, loadedMax) >= hw.CONFIG.RULER_EXPAND_THRESHOLD) extent = hw.CONFIG.RULER_EXPAND_TO;
  return Math.max(extent, headV + 1, loadedMax + 1);
}

Object.assign(hw, {
  assignDisplayColumns,
  columnsMatch,
  formatGlobalCommitColumn,
  formatLaneVersion,
  formatDisplayVersion,
  formatNodeVersion,
  nodeVersionTooltipLine,
  assignPerLaneVersions,
  laneVersionAtHead,
  laneForkLaneVersion,
  truncateSubject,
  commitAtMainlineVersion,
  commitAtUploadColumn,
  headUploadColumn,
  maxLoadedUploadColumn,
  versionLabelWithSubject,
  commitSubjectForNode,
  rulerExtent,
});
