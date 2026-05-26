import { hw } from '../core/hw.js';

function headIndex(parsed) {
  return hw.headColumn(parsed);
}

function headColumn(parsed) {
  const head = hw.headCommit(parsed);
  return head.versionIndex ?? head.displayColumn ?? 1;
}

function headCommit(parsed) {
  return parsed.commits.find((c) => c.hash === parsed.headHash) || parsed.commits[parsed.commits.length - 1];
}

function captureHeadSnapshot() {
  if (!hw.state.parsed) return null;
  const head = hw.headCommit(hw.state.parsed);
  return {
    hash: head.hash,
    uploadCol: hw.headUploadColumn(hw.state.parsed),
    column: head.versionIndex ?? head.displayColumn ?? 1,
  };
}

function findHeadMainlinePulseNodeId(parsed) {
  const head = hw.headCommit(parsed);
  const col = head.versionIndex ?? head.displayColumn ?? hw.headUploadColumn(parsed);
  const trunk = parsed.trunkLaneCommitSet || parsed.mainlineSet;
  let fallback = null;
  for (const n of Object.values(hw.state.nodeIndex)) {
    if (!n || !hw.nodeCanShowTooltip(n) || hw.isBranchGraphAnchor(n)) continue;
    if (n.hash !== head.hash) continue;
    if (!hw.columnsMatch(n.displayColumn ?? n.graphX, col)) continue;
    if (n.lane?.isBranchLane) continue;
    if (trunk.has(n.hash)) return n.id;
    if (!fallback) fallback = n.id;
  }
  return fallback;
}

function laneIndexForPulseNode(pulseId) {
  const n = pulseId ? hw.state.nodeIndex[pulseId] : null;
  return n?.laneIndex ?? -1;
}

function runHeadArrivalPulse() {
  const vp = hw.els.graphViewport;
  if (!vp) return;
  vp.classList.add('hw-head-arrival');
  hw.playWhipCrackSound();
  setTimeout(() => vp.classList.remove('hw-head-arrival'), 1400);
}

function applyNewHeadFocusAfterRender() {
  const snap = hw.state.headSnapshotBeforeLoad;
  hw.state.headSnapshotBeforeLoad = null;
  if (!snap || !hw.state.parsed || !hw.state.catalog) return false;

  const parsed = hw.state.parsed;
  const head = hw.headCommit(parsed);
  const newUpload = hw.headUploadColumn(parsed);
  const newCol = head.versionIndex ?? head.displayColumn ?? newUpload;
  const hashChanged = snap.hash !== head.hash;
  const uploadAdvanced = newUpload > snap.uploadCol;
  if (!hashChanged && !uploadAdvanced) return false;

  hw.state.focusGraphX = newCol;
  hw.state.focusedFilePath = null;
  hw.syncFileRailFocusHighlight();

  hw.refreshNodeIndex();
  const pulseId = hw.findHeadMainlinePulseNodeId(parsed);
  hw.state.pulseNodeId = pulseId;
  hw.setPulseNode(pulseId);
  hw.updateGraphFocus();
  hw.syncNodeRippleVisuals();

  const laneIdx = hw.laneIndexForPulseNode(pulseId);
  const panX = hw.panXForColumnFocus(newCol);
  const scrollTop = laneIdx >= 0 ? hw.scrollTopForLaneCenter(laneIdx) : hw.state.scrollTop;

  void hw.animateViewportTo(panX, scrollTop, 520).then(() => {
    hw.runHeadArrivalPulse();
    const msg = hashChanged
      ? '主泳道新上传 · 已聚焦最新 Cn'
      : '主泳道已更新 · 已聚焦';
    hw.showCopyToast(msg);
  });

  return true;
}

function headMainlineVersion(parsed) {
  return hw.headUploadColumn(parsed);
}

function resolveFocusGraphX(parsed) {
  const head = hw.headCommit(parsed);
  if (hw.state.focusGraphX != null) {
    const ok = parsed.commits.some((c) => hw.columnsMatch(c.displayColumn, hw.state.focusGraphX));
    if (ok) return hw.state.focusGraphX;
  }
  return head.versionIndex ?? head.displayColumn ?? 1;
}

function showCopyToast(message) {
  let el = document.getElementById('hw-copy-toast');
  if (!el) {
    el = document.createElement('div');
    el.id = 'hw-copy-toast';
    el.className = 'hw-copy-toast';
    document.body.appendChild(el);
  }
  el.textContent = message;
  el.hidden = false;
  clearTimeout(showCopyToast._timer);
  showCopyToast._timer = setTimeout(() => {
    el.hidden = true;
  }, 1800);
}

function showError(msg) {
  hw.els.parseError.textContent = msg;
  hw.els.parseError.hidden = false;
  hw.els.logInput?.classList.add('shake');
  setTimeout(() => hw.els.logInput?.classList.remove('shake'), 400);
}

function clearError() {
  hw.els.parseError.hidden = true;
}

function updateStats(parsed) {
  if (!hw.els.stats) return;
  hw.els.stats.hidden = false;
  const loaded = parsed.loadedCommitCount ?? parsed.commits.length;
  const total = parsed.totalCommitsInLog ?? loaded;
  hw.els.statCommits.textContent = total > loaded ? `${loaded}/${total} ver` : `${loaded} ver`;
  hw.els.statFiles.textContent = `${hw.getAllFiles(parsed).length} files`;
}

function renderFromState(options = {}) {
  hw.scheduleRenderFromState(options);
}

function loadAndRender(text) {
  try {
    hw.state.headSnapshotBeforeLoad = hw.captureHeadSnapshot();
    const savedExpanded = hw.isPluginHost() ? new Set(hw.state.expandedPaths) : null;
    hw.state.rawLogText = text;
    hw.state.commitLoadLimit = hw.CONFIG.COMMIT_PAGE_SIZE;
    hw.state.totalCommitsInLog = 0;
    const sliced = hw.sliceLogByCommitLimit(text, hw.state.commitLoadLimit);
    hw.state.totalCommitsInLog = sliced.totalCommits;
    const parsed = hw.parseGitLog(sliced.text, { gitBranches: hw.state.gitBranches });
    parsed.totalCommitsInLog = sliced.totalCommits;
    parsed.loadedCommitCount = sliced.loaded;
    if (!hw.state.gitBranches.length) {
      hw.state.gitBranches = hw.inferGitBranchesFromParsed(parsed);
    }
    hw.enrichBranchSegmentsFromGitBranches(parsed, hw.state.gitBranches);
    hw.state.parsed = parsed;
    hw.state.panX = null;
    hw.state.scrollTop = 0;
    hw.state.expandedPaths = new Set();
    hw.state.focusGraphX = null;
    hw.state.pulseNodeId = null;
    hw.state.graphZoom = 1;
    if (hw.els.zoomLabel) hw.els.zoomLabel.textContent = '100%';
    if (hw.isPluginHost() && savedExpanded?.size) {
      savedExpanded.forEach((p) => hw.state.expandedPaths.add(p));
    }
    hw.state.animateNext = true;
    hw.graphRenderCtx = null;
    hw.state.catalog = null;
    hw.state.laneSliceCache = null;
    hw.renderFromState({ assignDefaultPulse: true });
  } catch (e) {
    hw.showError(e.message || String(e));
  }
}

function loadMoreCommits() {
  if (!hw.state.rawLogText || !hw.state.parsed) return;
  const total = hw.state.totalCommitsInLog || hw.state.parsed.totalCommitsInLog;
  if (hw.state.commitLoadLimit >= total) return;
  hw.state.commitLoadLimit = Math.min(hw.state.commitLoadLimit + hw.CONFIG.COMMIT_PAGE_STEP, total);
  const sliced = hw.sliceLogByCommitLimit(hw.state.rawLogText, hw.state.commitLoadLimit);
  const parsed = hw.parseGitLog(sliced.text, { gitBranches: hw.state.gitBranches });
  parsed.totalCommitsInLog = total;
  parsed.loadedCommitCount = sliced.loaded;
  hw.state.parsed = parsed;
  hw.state.panX = null;
  hw.scheduleRenderFromState({ assignDefaultPulse: !hw.state.pulseNodeId });
}

Object.assign(hw, {
  headIndex,
  headColumn,
  headCommit,
  captureHeadSnapshot,
  findHeadMainlinePulseNodeId,
  laneIndexForPulseNode,
  runHeadArrivalPulse,
  applyNewHeadFocusAfterRender,
  headMainlineVersion,
  resolveFocusGraphX,
  showCopyToast,
  showError,
  clearError,
  updateStats,
  renderFromState,
  loadAndRender,
  loadMoreCommits,
});
