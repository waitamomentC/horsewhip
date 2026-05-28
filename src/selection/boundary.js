import { hw } from '../core/hw.js';

function selectionLocator(node) {
  if (!node) return '';
  const parts = [];
  if (hw.PER_LANE_VERSION && node.laneVersion != null) {
    parts.push(`泳道 ${hw.formatLaneVersion(node.laneVersion)}`);
  }
  const col = node.displayColumn ?? node.graphX;
  if (col != null) {
    parts.push(hw.PER_LANE_VERSION ? hw.formatGlobalCommitColumn(col) : hw.formatDisplayVersion(col));
  }
  parts.push(hw.branchLabelForNode(node));
  if (node.hash) parts.push(`commit ${node.hash.slice(0, 12)}`);
  return parts.join(' · ');
}

function constraintSingle(filePath, node) {
  const loc = node ? `\n定位：${hw.selectionLocator(node)}` : '';
  return `【horsewhip · AI 文件边界】
只允许修改：${filePath}${loc}
禁止修改仓库内其他任何文件。
若必须改动其他文件，请先停下并说明理由，待确认后再继续。`;
}

function constraintMulti(files) {
  const list = [...files].sort().join(', ');
  return `【horsewhip · AI 文件边界】
允许修改：${list}
（以上文件在该仓库历史中常于同一 commit 内共变）
禁止修改上述范围以外的文件。`;
}

function constraintBoundaryFromNodes(nodes) {
  const lines = nodes.map((node) => {
    const folderPath = hw.folderBoundaryPathFromNode(node);
    const path = folderPath || node.filePath || node.files?.[0] || node.lanePath;
    const label = folderPath
      ? (folderPath === hw.ROOT_BUCKET ? '仓库根目录/' : folderPath)
      : path;
    const scope = folderPath ? '（文件夹，含其下所有路径）' : '';
    return `- ${label}${scope}\n  定位：${hw.selectionLocator(node)}`;
  }).join('\n');
  return `【horsewhip · AI 文件边界】
本次任务只允许修改以下范围（每条对应一个泳道上的选定版本），不要创建/修改/删除其他任何路径：
${lines}

若必须改动其他文件，请先说明理由并等待确认后再继续。`;
}

function constraintBoundary(items) {
  const sorted = [...items].sort((a, b) => a.localeCompare(b));
  const lines = sorted.map((item) => {
    if (hw.isFolderBoundaryPath(item)) {
      const label = item === hw.ROOT_BUCKET ? '仓库根目录/' : item;
      return `- ${label}（文件夹，含其下所有路径）`;
    }
    return `- ${item}`;
  }).join('\n');
  return `【horsewhip · AI 文件边界】
本次任务只允许修改以下范围，不要创建/修改/删除其他任何路径：
${lines}

若必须改动其他文件，请先说明理由并等待确认后再继续。`;
}

function constraintFolder(folderPath, node) {
  const label = folderPath === hw.ROOT_BUCKET ? '仓库根目录/' : folderPath;
  const loc = node ? `\n定位：${hw.selectionLocator(node)}` : '';
  return `【horsewhip · AI 文件夹边界】
本次任务只允许修改 ${label} 目录下的内容，不要创建/修改/删除该目录以外的任何路径。${loc}

若必须改动其他目录，请先说明理由并等待确认后再继续。`;
}

function isFolderBoundaryPath(path) {
  return path === hw.ROOT_BUCKET || String(path).endsWith('/');
}

function isFolderBoundaryNode(node) {
  if (!node) return false;
  if (node.isFolderAggregate) return true;
  if (node.lane?.type === 'folder' && !node.lane?.isHeader) return true;
  const p = node.lanePath || node.lane?.path;
  return Boolean(p && hw.isFolderBoundaryPath(p));
}

function folderBoundaryPathFromNode(node) {
  if (!hw.isFolderBoundaryNode(node)) return null;
  let p = node.lanePath || node.lane?.path;
  if (!p) return null;
  if (p === hw.ROOT_BUCKET) return hw.ROOT_BUCKET;
  return p.endsWith('/') ? p : `${p}/`;
}

function boundaryPathLabel(path) {
  if (path === hw.ROOT_BUCKET) return '(root)/';
  return path;
}

function getBoundaryFilesList() {
  return [...hw.state.boundaryFiles].sort((a, b) => a.localeCompare(b));
}

function getSelectedGraphNodes() {
  return [...hw.state.selectedNodeIds]
    .map((id) => hw.state.nodeIndex[id])
    .filter((n) => n && hw.nodeCanSelect(n));
}

function clearSelectionOnLane(lanePath, exceptId = null) {
  for (const id of [...hw.state.selectedNodeIds]) {
    if (id === exceptId) continue;
    const other = hw.state.nodeIndex[id];
    if (other?.lanePath === lanePath) hw.state.selectedNodeIds.delete(id);
  }
}

function buildBoundaryPrompt() {
  const nodes = hw.getSelectedGraphNodes();
  if (nodes.length === 0) return '';
  if (nodes.length === 1) return hw.constraintForNode(nodes[0]);
  return hw.constraintBoundaryFromNodes(nodes);
}

function nodeBoundaryPaths(node) {
  if (!node) return [];
  const folderPath = hw.folderBoundaryPathFromNode(node);
  if (folderPath) return [folderPath];
  const primary = node.filePath || node.files?.[0];
  return primary ? [primary] : [];
}

function nodeCanSelect(node) {
  if (!node?.id || node.isVersionStep) return false;
  if (hw.isBranchGraphAnchor(node)) return false;
  if (hw.isFolderBoundaryNode(node)) return true;
  return hw.nodeBoundaryPaths(node).length > 0;
}

function branchNameFromNode(node) {
  if (node?.branchName) return String(node.branchName);
  const seg = node?.lane?.branchSegment;
  if (seg?.name) return String(seg.name);
  if (node?.lane?.isBranchLane && node.lane?.label) {
    return String(node.lane.label).replace(/^⎇\s*/, '').trim();
  }
  return '';
}

function lockTargetsFromNodes(nodes) {
  return nodes.map((node) => ({
    nodeId: node.id,
    commit: node.hash || '',
    branch: hw.branchNameFromNode(node),
    lanePath: node.lanePath || '',
    files: hw.pathsFromNodeIds(new Set([node.id])),
  }));
}

function pathsFromNodeIds(nodeIds) {
  const paths = [];
  nodeIds.forEach((id) => {
    const node = hw.state.nodeIndex[id];
    if (!node) return;
    paths.push(...nodeBoundaryPaths(node));
  });
  const folders = paths.filter((p) => hw.isFolderBoundaryPath(p));
  const files = paths.filter((p) => !hw.isFolderBoundaryPath(p));
  const prunedFiles = files.filter(
    (f) => !folders.some((dir) => hw.fileMatchesLane(f, hw.folderLaneForSelection(dir))),
  );
  return [...folders, ...prunedFiles];
}

function rebuildBoundaryFromNodes() {
  if (hw.state.mcpBoundaryLocked) return;
  hw.state.boundaryFiles.clear();
  const sourceIds = hw.state.lockedNodeIds.size ? hw.state.lockedNodeIds : hw.state.selectedNodeIds;
  pathsFromNodeIds(sourceIds).forEach((p) => hw.state.boundaryFiles.add(p));
}

function isBoundaryLocked() {
  return hw.state.lockedNodeIds.size > 0 || Boolean(hw.state.mcpBoundaryLocked);
}

function isMcpPanelReadOnly() {
  return Boolean(hw.state.mcpBoundaryLocked);
}

function mcpPanelReadOnlyToast() {
  hw.showCopyToast?.('Agent 圈定中 · 泳道只读，请等 Agent 完成');
}

function tryMapMcpPathsToNodes(paths) {
  if (!hw.state.parsed || !paths?.length) return;
  hw.refreshNodeIndex?.();
  const want = new Set(paths.filter((p) => p && !hw.isFolderBoundaryPath(p)));
  if (!want.size) return;
  const nodes = Object.values(hw.state.nodeIndex || {});
  want.forEach((filePath) => {
    const node = nodes.find((n) => {
      if (!n?.id || hw.state.lockedNodeIds.has(n.id)) return false;
      const primary = n.filePath || n.files?.[0];
      if (primary === filePath) return true;
      return Array.isArray(n.files) && n.files.includes(filePath);
    });
    if (node?.id) hw.state.lockedNodeIds.add(node.id);
  });
  if (hw.state.lockedNodeIds.size) {
    hw.state.lockTargets = hw.lockTargetsFromNodes(
      [...hw.state.lockedNodeIds].map((id) => hw.state.nodeIndex[id]).filter(Boolean),
    );
  }
}

function applyBoundaryFromHost(files, locked, options = {}) {
  const list = Array.isArray(files) ? files.filter(Boolean) : [];
  if (options.ceremonyOnly) {
    if (options.playWhip) hw.playWhipCrackSound();
    if (options.toast) hw.showCopyToast?.(options.toast);
    return;
  }
  hw.state.selectedNodeIds.clear();
  if (!locked || !list.length) {
    hw.state.mcpBoundaryLocked = false;
    hw.state.lockedNodeIds.clear();
    hw.state.lockTargets = [];
    hw.state.boundaryFiles.clear();
    document.body.classList.remove('hw-mcp-panel-readonly');
    hw.syncBoundaryBar();
    hw.updateSelectionVisuals();
    if (options.playWhip) hw.playWhipCrackSound();
    return;
  }
  hw.state.mcpBoundaryLocked = true;
  hw.state.lockedNodeIds.clear();
  hw.state.lockTargets = [];
  hw.state.boundaryFiles.clear();
  list.forEach((p) => hw.state.boundaryFiles.add(p));
  hw.tryMapMcpPathsToNodes(list);
  document.body.classList.toggle('hw-mcp-panel-readonly', true);
  hw.syncBoundaryBar();
  hw.updateSelectionVisuals();
  hw.navigateMcpBoundaryPaths?.(list);
  if (options.playWhip) hw.playWhipCrackSound();
  if (options.toast) hw.showCopyToast?.(options.toast);
}

function pushBoundaryLockToPlugin() {
  if (!hw.isPluginHost() || !window.HorsewhipPluginBridge?.setBoundaryAllowlist) return;
  if (!hw.isBoundaryLocked()) return;
  hw.rebuildBoundaryFromNodes();
  window.HorsewhipPluginBridge.setBoundaryAllowlist(
    hw.getBoundaryFilesList(),
    true,
    hw.state.lockTargets,
  );
}

function pushBoundaryUnlockToPlugin() {
  if (!hw.isPluginHost() || !window.HorsewhipPluginBridge?.setBoundaryAllowlist) return;
  if (isMcpPanelReadOnly()) {
    mcpPanelReadOnlyToast();
    return;
  }
  window.HorsewhipPluginBridge.setBoundaryAllowlist([], false, []);
}

/** 仅在上锁时推送；预览点选不得发送 locked=false（会误清已有锁）。 */
function pushBoundaryToPlugin() {
  if (hw.isBoundaryLocked()) hw.pushBoundaryLockToPlugin();
}

function syncBoundaryBar() {
  const selectedCount = hw.state.selectedNodeIds.size;
  const lockedCount = hw.state.lockedNodeIds.size;
  const mcpLocked = Boolean(hw.state.mcpBoundaryLocked);
  const locked = hw.isBoundaryLocked();
  hw.rebuildBoundaryFromNodes();
  const files = hw.getBoundaryFilesList();
  const showBar = selectedCount > 0 || locked;

  if (!hw.boundaryBarActive()) {
    if (hw.isPluginHost() && hw.state.catalog?.lanes?.length) {
      hw.updatePluginBar(hw.state.catalog.lanes.length);
    }
    hw.syncFileRailBoundaryHighlight();
    return;
  }

  if (hw.els.boundaryBar) hw.els.boundaryBar.hidden = !showBar;
  if (hw.els.boundaryTitle) {
    hw.els.boundaryTitle.textContent = mcpLocked
      ? 'Agent 圈定（只读）'
      : locked
        ? '跑马范围（仅此可改）'
        : '点选范围';
  }
  if (hw.els.boundaryCount) {
    if (locked) {
      const branchHint = hw.state.lockTargets.length
        ? [...new Set(hw.state.lockTargets.map((t) => t.branch).filter(Boolean))]
            .map((b) => `⎇ ${b}`)
            .join(' · ') || '主泳道'
        : '';
      const aimLabel = mcpLocked && !lockedCount
        ? `已圈定 ${files.length} 条路径可改`
        : lockedCount === 1
          ? '已圈定 1 处可改'
          : `已圈定 ${lockedCount} 处可改`;
      hw.els.boundaryCount.textContent = branchHint ? `${aimLabel} · ${branchHint}` : aimLabel;
    } else {
      hw.els.boundaryCount.textContent =
        selectedCount === 1
          ? '已选 1 个节点 · 挥鞭圈定'
          : `已选 ${selectedCount} 个节点 · 挥鞭圈定`;
    }
  }
  if (hw.els.boundaryFiles) {
    hw.els.boundaryFiles.textContent = files.length ? files.map(hw.boundaryPathLabel).join(' · ') : '';
    hw.els.boundaryFiles.title = files.length ? files.map(hw.boundaryPathLabel).join('\n') : '';
  }
  if (hw.els.boundaryPreview) {
    hw.els.boundaryPreview.textContent = '';
  }
  if (hw.els.btnBoundaryCopy) {
    hw.els.btnBoundaryCopy.disabled = mcpLocked || !selectedCount;
    hw.els.btnBoundaryCopy.title = mcpLocked
      ? 'Agent 圈定中不可重新挥鞭'
      : locked
        ? '重新挥鞭圈定（替换当前锁定范围）'
        : '挥鞭圈定（仅此范围可改）';
  }
  if (hw.els.btnBoundaryClear) {
    hw.els.btnBoundaryClear.disabled = mcpLocked;
    hw.els.btnBoundaryClear.textContent = locked ? '解锁' : '清空';
    hw.els.btnBoundaryClear.title = mcpLocked
      ? 'Agent 圈定中不可解锁'
      : locked
        ? '解除圈定，恢复自由改码'
        : '清空点选';
  }
  if (hw.els.boundaryBar) {
    hw.els.boundaryBar.classList.toggle('hw-boundary--mcp-readonly', mcpLocked);
  }
  if (hw.els.btnBoundaryChat) {
    hw.els.btnBoundaryChat.disabled = !files.length;
    hw.els.btnBoundaryChat.hidden = hw.isPluginHost();
  }

  if (hw.isPluginHost() && hw.state.catalog?.lanes?.length) {
    hw.updatePluginBar(hw.state.catalog.lanes.length);
  }
  if (hw.isPluginHost() && typeof hw.syncGuardArmButton === 'function') {
    hw.syncGuardArmButton();
  }
  hw.syncFileRailBoundaryHighlight();
}

function syncFileRailBoundaryHighlight() {
  if (!hw.els.fileRailInner) return;
  const lockedItems = hw.isBoundaryLocked() ? hw.getBoundaryFilesList() : [];
  const previewItems = hw.isBoundaryLocked()
    ? pathsFromNodeIds(hw.state.selectedNodeIds)
    : hw.getBoundaryFilesList();
  const lockedFolders = lockedItems.filter(hw.isFolderBoundaryPath);
  const lockedFiles = lockedItems.filter((p) => !hw.isFolderBoundaryPath(p));
  const previewFolders = previewItems.filter(hw.isFolderBoundaryPath);
  const previewFiles = previewItems.filter((p) => !hw.isFolderBoundaryPath(p));

  const rowMatches = (row, folders, files) => {
    const folderPath = row.dataset.folderPath;
    const filePath = row.dataset.filePath;
    if (folderPath && folders.includes(folderPath)) return true;
    if (filePath && files.includes(filePath)) {
      return !folders.some((dir) => hw.fileMatchesLane(filePath, hw.folderLaneForSelection(dir)));
    }
    return false;
  };

  hw.els.fileRailInner.querySelectorAll('.file-rail__item').forEach((row) => {
    row.classList.remove('file-rail__item--boundary', 'file-rail__item--locked');
    if (rowMatches(row, lockedFolders, lockedFiles)) {
      row.classList.add('file-rail__item--locked');
      return;
    }
    if (!hw.isBoundaryLocked() && rowMatches(row, previewFolders, previewFiles)) {
      row.classList.add('file-rail__item--boundary');
    }
  });
}

function clearSelectionPreview() {
  if (hw.state.selectedNodeIds.size === 0) return;
  hw.state.selectedNodeIds.clear();
  hw.state.lastSelectedNodeId = null;
  hw.state.pulseNodeId = null;
  hw.syncBoundaryBar();
  hw.updateSelectionVisuals();
  hw.syncNodeRippleVisuals();
}

function clearNodeSelection() {
  if (isMcpPanelReadOnly()) {
    mcpPanelReadOnlyToast();
    return;
  }
  if (
    hw.state.selectedNodeIds.size === 0
    && hw.state.lockedNodeIds.size === 0
    && !hw.state.mcpBoundaryLocked
  ) return;
  hw.state.selectedNodeIds.clear();
  hw.state.lockedNodeIds.clear();
  hw.state.lockTargets = [];
  hw.state.mcpBoundaryLocked = false;
  hw.state.boundaryFiles.clear();
  hw.state.lastSelectedNodeId = null;
  hw.state.pulseNodeId = null;
  hw.pushBoundaryUnlockToPlugin();
  hw.syncBoundaryBar();
  hw.updateSelectionVisuals();
  hw.syncNodeRippleVisuals();
}

function toggleSelectedNode(node) {
  if (!hw.nodeCanSelect(node) || !hw.state.parsed) return;
  if (isMcpPanelReadOnly()) {
    mcpPanelReadOnlyToast();
    return;
  }
  if (hw.state.selectedNodeIds.has(node.id)) {
    hw.state.selectedNodeIds.delete(node.id);
    if (hw.state.lastSelectedNodeId === node.id) {
      hw.state.lastSelectedNodeId = [...hw.state.selectedNodeIds].slice(-1)[0] || null;
    }
  } else {
    hw.clearSelectionOnLane(node.lanePath, node.id);
    hw.state.selectedNodeIds.add(node.id);
    hw.state.lastSelectedNodeId = node.id;
  }
  hw.rebuildBoundaryFromNodes();
  hw.syncBoundaryBar();
  hw.updateSelectionVisuals();
}

function folderLaneForSelection(folderPath) {
  return { type: 'folder', path: folderPath, isHeader: false, collapsed: true };
}

function findLaneIndexForFolderPath(folderPath) {
  const lanes = hw.state.catalog?.lanes;
  if (!lanes) return -1;
  const lane = lanes.find((l) => l.path === folderPath && l.type === 'folder');
  return lane?.laneIndex ?? -1;
}

function toggleFolderClusterSelection(node) {
  hw.toggleSelectedNode(node);
}

function buildFolderSelectionNode(folderPath) {
  if (!hw.state.parsed) return null;
  hw.refreshNodeIndex();
  const columnV = hw.state.focusGraphX ?? hw.resolveFocusGraphX(hw.state.parsed);
  const folderLane = hw.folderLaneForSelection(folderPath);
  const commit = hw.state.parsed.commits.find(
    (c) => hw.columnsMatch(c.displayColumn ?? c.graphX, columnV)
      && c.files.some((f) => hw.fileMatchesLane(f, folderLane)),
  );
  if (!commit) return null;
  const laneIndex = hw.findLaneIndexForFolderPath(folderPath);
  return {
    id: `${commit.hash}:${folderPath}`,
    hash: commit.hash,
    displayColumn: commit.displayColumn ?? commit.graphX,
    graphX: commit.displayColumn ?? commit.graphX,
    lanePath: folderPath,
    laneIndex,
    lane: { path: folderPath, collapsed: true, type: 'folder' },
    isFolderAggregate: true,
    label: hw.folderDisplayLabel(folderPath),
  };
}

function selectFolderFromRail(lane) {
  const stub = hw.buildFolderSelectionNode(lane.path);
  if (!stub) return;
  hw.hideTooltip();
  hw.state.animateNext = false;
  hw.state.selectedLink = null;
  hw.els.linkPanel.hidden = true;
  hw.state.nodeIndex[stub.id] = stub;
  hw.toggleSelectedNode(stub);
  hw.state.focusGraphX = stub.displayColumn ?? stub.graphX;
  hw.state.pulseNodeId = hw.state.selectedNodeIds.has(stub.id) ? stub.id : null;
  hw.updateGraphFocus();
  hw.updateSelectionVisuals();
}

function wireFileRailFolderRow(row, lane, chev) {
  if (lane.type !== 'folder' && !lane.collapsed && !lane.isHeader) return;

  const folderLabel = lane.path === hw.ROOT_BUCKET ? '(root)' : lane.path;

  if (lane.isHeader) {
    row.dataset.folderPath = lane.path;
    row.classList.add('file-rail__item--folder-header');
    row.title = `${folderLabel} · 点击收起`;
    const onCollapse = (e) => {
      e.preventDefault();
      e.stopPropagation();
      hw.toggleExpand(lane.path, e.altKey);
    };
    if (chev) {
      chev.classList.add('file-rail__chev--collapse');
      chev.title = `收起 ${lane.label || folderLabel}`;
      chev.addEventListener('click', onCollapse);
    }
    row.addEventListener('click', (e) => {
      if (e.target.closest('.file-rail__chev--collapse')) return;
      onCollapse(e);
    });
    return;
  }

  if (!lane.collapsed) return;

  row.dataset.folderPath = lane.path;
  row.title = `${folderLabel} · 点击选中文件夹边界 · ▸ 展开`;
  if (chev) {
    chev.classList.add('file-rail__chev--expand');
    chev.title = `展开 ${lane.label || folderLabel}`;
    chev.addEventListener('click', (e) => {
      e.stopPropagation();
      hw.toggleExpand(lane.path, e.altKey);
    });
  }
  row.addEventListener('click', (e) => {
    if (e.target.closest('.file-rail__chev--expand')) return;
    if (e.altKey && hw.isPluginHost() && window.HorsewhipPluginBridge?.revealFolder) {
      window.HorsewhipPluginBridge.revealFolder(lane.path === hw.ROOT_BUCKET ? '' : lane.path);
      return;
    }
    e.preventDefault();
    e.stopPropagation();
    hw.selectFolderFromRail(lane);
  });
}

function cmdCheckout(hash, filePath) {
  return `git checkout ${hash} -- ${filePath}`;
}

function nodeReferenceFilePaths(node) {
  const files = node?.files?.length ? node.files : (node?.filePath ? [node.filePath] : []);
  return [...new Set(files.filter(Boolean))];
}

function cmdCheckoutFiles(hash, filePaths) {
  const paths = filePaths || [];
  if (!paths.length) return '# 此节点无文件路径（请选具体文件节点或含文件的 commit）';
  return paths.map((f) => hw.cmdCheckout(hash, f)).join('\n');
}

function cmdCheckoutDetach(hash) {
  const short = String(hash || '').slice(0, 7);
  return `git switch --detach ${short}
# 仅查看该版本；HEAD 会进入 detached。回到原分支：git switch -`;
}

function cmdPreviewUi(hash, devCommand) {
  const short = String(hash || '').slice(0, 7);
  const dev = devCommand || 'npm run dev';
  return `# 整库检出（工作区全部文件变为该提交；非临时副本）
git switch --detach ${short}
${dev}
# 看完后点 horsewhip 标题栏「恢复工作区」`;
}

function branchRefOnNode(node, parsed) {
  const c = parsed?.commitMap?.[node?.hash];
  if (!c?.refs?.length) return null;
  for (const r of c.refs) {
    const clean = hw.normalizeRefName?.(r) ?? String(r).replace(/^origin\//, '').trim();
    if (!clean || /^HEAD$/i.test(clean) || /^(main|master)$/i.test(clean)) continue;
    return clean;
  }
  return null;
}

function cmdSwitchBranch(branchName) {
  return `git switch ${branchName}`;
}

function cmdResetHard(hash) {
  return `# ⚠️ 将丢失 ${hash} 之后的所有未提交/已提交本地改动，请先备份或 stash
git reset --hard ${hash}`;
}

function constraintForNode(node) {
  const folderPath = hw.folderBoundaryPathFromNode(node);
  if (folderPath) return hw.constraintFolder(folderPath, node);
  const files = node.files || [node.filePath];
  if (files.length === 1) return hw.constraintSingle(files[0], node);
  return hw.constraintMulti(files);
}

function nodeCanWhip(node) {
  if (!node || node.isVersionStep) return false;
  if (hw.isBranchGraphAnchor(node)) return false;
  if (hw.isFolderBoundaryNode(node)) return true;
  const files = node.files || [node.filePath];
  return Boolean(files?.length && files[0]);
}

function lockBoundaryFromSelection(nodes, btnEl) {
  if (!nodes?.length) return;
  if (isMcpPanelReadOnly()) {
    mcpPanelReadOnlyToast();
    return;
  }
  const crackTarget = btnEl?.closest?.('.hw-whip-float') || btnEl;
  crackTarget?.classList.add('hw-whip-btn--crack', 'hw-whip-float--crack');
  hw.playWhipCrackSound();

  hw.state.mcpBoundaryLocked = false;
  hw.state.lockedNodeIds.clear();
  nodes.forEach((node) => {
    if (node?.id) hw.state.lockedNodeIds.add(node.id);
  });
  hw.state.lockTargets = hw.lockTargetsFromNodes(nodes);

  hw.rebuildBoundaryFromNodes();
  hw.pushBoundaryLockToPlugin();
  hw.syncBoundaryBar();
  hw.updateSelectionVisuals();

  const fileCount = hw.getBoundaryFilesList().length;
  const branches = [...new Set(hw.state.lockTargets.map((t) => t.branch).filter(Boolean))];
  const branchText = branches.length ? ` · ${branches.map((b) => `⎇ ${b}`).join(' ')}` : ' · 主泳道';
  const msg =
    nodes.length === 1
      ? `已圈定跑马范围：仅此 ${fileCount} 条路径可改${branchText}`
      : `已圈定跑马范围：仅此 ${fileCount} 条路径可改${branchText}`;
  hw.showCopyToast(msg);
  setTimeout(() => crackTarget?.classList.remove('hw-whip-btn--crack', 'hw-whip-float--crack'), 520);
}

/** @deprecated alias — whip now locks boundary instead of copying. */
function crackWhipOnSelection(nodes, btnEl) {
  hw.lockBoundaryFromSelection(nodes, btnEl);
}

function selectedWhipNodes() {
  return [...hw.state.selectedNodeIds]
    .map((id) => hw.state.nodeIndex[id])
    .filter((node) => hw.nodeCanWhip(node));
}

function whipHostNode() {
  const lastId = hw.state.lastSelectedNodeId;
  if (lastId && hw.state.selectedNodeIds.has(lastId) && hw.state.nodeIndex[lastId]) {
    return hw.state.nodeIndex[lastId];
  }
  const nodes = hw.selectedWhipNodes();
  return nodes.length ? nodes[nodes.length - 1] : null;
}

function syncNodeLockRings() {
  d3.selectAll('.node-lock-aim').remove();
  d3.selectAll('.node-group').each(function () {
    const d = d3.select(this).datum();
    if (!d?.id || !hw.state.lockedNodeIds.has(d.id)) return;
    const lane = d.lane;
    const color = hw.laneIconColor(lane);
    const g = d3.select(this);
    const rOuter = hw.ICON_SIZE + 7.2;
    const aim = g
      .insert('g', '.node-hit')
      .attr('class', 'node-lock-aim')
      .style('pointer-events', 'none');
    aim
      .append('circle')
      .attr('class', 'node-lock-ring node-lock-ring--outer')
      .attr('r', rOuter)
      .attr('fill', 'none')
      .attr('stroke', color)
      .attr('stroke-width', 2)
      .attr('opacity', 0.95);
    aim
      .append('circle')
      .attr('class', 'node-lock-ring node-lock-ring--tick')
      .attr('r', rOuter)
      .attr('fill', 'none')
      .attr('stroke', color)
      .attr('stroke-width', 1.2)
      .attr('stroke-dasharray', '2.5 5.5')
      .attr('opacity', 0.55);
  });
}

function updateSelectionVisuals() {
  const bundle = hw.state.selectedLink;
  d3.selectAll('.node-selection-ring').remove();
  d3.selectAll('.node-group').classed('node-group--selected', function () {
    const d = d3.select(this).datum();
    return d?.id && hw.state.selectedNodeIds.has(d.id) && !hw.state.lockedNodeIds.has(d.id);
  });
  d3.selectAll('.node-group').classed('node-group--locked', function () {
    const d = d3.select(this).datum();
    return d?.id && hw.state.lockedNodeIds.has(d.id);
  });
  hw.syncNodeLockRings();
  hw.setPulseNode(hw.state.pulseNodeId);
  d3.selectAll('.link-group').classed('link-group--selected', function () {
    const d = d3.select(this).select('.link-core').datum();
    return bundle && d && (d.id === bundle.id || d.to?.id === bundle.id);
  });

  if (hw.state.mcpBoundaryLocked) {
    hw.hideWhipFloat();
    return;
  }
  const whipNodes = hw.selectedWhipNodes();
  const anchorNode = hw.whipHostNode();
  if (whipNodes.length && anchorNode) {
    hw.showWhipFloat(anchorNode, whipNodes);
  } else {
    hw.hideWhipFloat();
  }
}

Object.assign(hw, {
  selectionLocator,
  constraintSingle,
  constraintMulti,
  constraintBoundaryFromNodes,
  constraintBoundary,
  constraintFolder,
  isFolderBoundaryPath,
  isFolderBoundaryNode,
  folderBoundaryPathFromNode,
  boundaryPathLabel,
  getBoundaryFilesList,
  getSelectedGraphNodes,
  clearSelectionOnLane,
  buildBoundaryPrompt,
  nodeBoundaryPaths,
  nodeCanSelect,
  branchNameFromNode,
  lockTargetsFromNodes,
  pathsFromNodeIds,
  rebuildBoundaryFromNodes,
  tryMapMcpPathsToNodes,
  applyBoundaryFromHost,
  isBoundaryLocked,
  pushBoundaryLockToPlugin,
  pushBoundaryUnlockToPlugin,
  pushBoundaryToPlugin,
  clearSelectionPreview,
  lockBoundaryFromSelection,
  syncBoundaryBar,
  syncNodeLockRings,
  syncFileRailBoundaryHighlight,
  clearNodeSelection,
  toggleSelectedNode,
  folderLaneForSelection,
  findLaneIndexForFolderPath,
  toggleFolderClusterSelection,
  buildFolderSelectionNode,
  selectFolderFromRail,
  wireFileRailFolderRow,
  cmdCheckout,
  nodeReferenceFilePaths,
  cmdCheckoutFiles,
  cmdCheckoutDetach,
  cmdPreviewUi,
  branchRefOnNode,
  cmdSwitchBranch,
  cmdResetHard,
  constraintForNode,
  nodeCanWhip,
  crackWhipOnSelection,
  selectedWhipNodes,
  whipHostNode,
  updateSelectionVisuals,
});
