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

function rebuildBoundaryFromNodes() {
  hw.state.boundaryFiles.clear();
  const paths = [];
  hw.state.selectedNodeIds.forEach((id) => {
    const node = hw.state.nodeIndex[id];
    if (!node) return;
    paths.push(...nodeBoundaryPaths(node));
  });
  const folders = paths.filter((p) => hw.isFolderBoundaryPath(p));
  const files = paths.filter((p) => !hw.isFolderBoundaryPath(p));
  const prunedFiles = files.filter(
    (f) => !folders.some((dir) => hw.fileMatchesLane(f, hw.folderLaneForSelection(dir))),
  );
  [...folders, ...prunedFiles].forEach((p) => hw.state.boundaryFiles.add(p));
}

function syncBoundaryBar() {
  const nodeCount = hw.state.selectedNodeIds.size;
  const files = hw.getBoundaryFilesList();
  const hasSelection = nodeCount > 0;

  if (hw.isPluginHost() && window.HorsewhipPluginBridge?.setBoundaryAllowlist) {
    window.HorsewhipPluginBridge.setBoundaryAllowlist(hasSelection ? files : []);
  }

  if (!hw.BOUNDARY_BAR_ENABLED) {
    if (hw.isPluginHost() && hw.state.catalog?.lanes?.length) {
      hw.updatePluginBar(hw.state.catalog.lanes.length);
    }
    hw.syncFileRailBoundaryHighlight();
    return;
  }

  if (hw.els.boundaryBar) hw.els.boundaryBar.hidden = true;

  if (hw.els.boundaryBar) hw.els.boundaryBar.hidden = !hasSelection;
  if (hw.els.boundaryCount) {
    hw.els.boundaryCount.textContent = nodeCount === 1 ? '1 个节点' : `${nodeCount} 个节点`;
  }
  if (hw.els.boundaryFiles) {
    hw.els.boundaryFiles.textContent = hasSelection ? files.map(hw.boundaryPathLabel).join(' · ') : '';
    hw.els.boundaryFiles.title = hasSelection ? files.map(hw.boundaryPathLabel).join('\n') : '';
  }
  if (hw.els.boundaryPreview) {
    hw.els.boundaryPreview.textContent = hasSelection ? hw.buildBoundaryPrompt() : '';
  }
  if (hw.els.btnBoundaryCopy) hw.els.btnBoundaryCopy.disabled = !hasSelection;
  if (hw.els.btnBoundaryChat) hw.els.btnBoundaryChat.disabled = !hasSelection;

  if (hw.isPluginHost() && hw.state.catalog?.lanes?.length) {
    hw.updatePluginBar(hw.state.catalog.lanes.length);
  }
  hw.syncFileRailBoundaryHighlight();
}

function syncFileRailBoundaryHighlight() {
  if (!hw.els.fileRailInner) return;
  const items = hw.getBoundaryFilesList();
  const folders = items.filter(hw.isFolderBoundaryPath);
  const files = items.filter((p) => !hw.isFolderBoundaryPath(p));
  hw.els.fileRailInner.querySelectorAll('.file-rail__item').forEach((row) => {
    row.classList.remove('file-rail__item--boundary');
    const folderPath = row.dataset.folderPath;
    const filePath = row.dataset.filePath;
    if (folderPath && folders.includes(folderPath)) {
      row.classList.add('file-rail__item--boundary');
      return;
    }
    if (filePath && files.includes(filePath)) {
      if (!folders.some((dir) => hw.fileMatchesLane(filePath, hw.folderLaneForSelection(dir)))) {
        row.classList.add('file-rail__item--boundary');
      }
    }
  });
}

function clearNodeSelection() {
  if (hw.state.selectedNodeIds.size === 0) return;
  hw.state.selectedNodeIds.clear();
  hw.state.boundaryFiles.clear();
  hw.state.lastSelectedNodeId = null;
  hw.state.pulseNodeId = null;
  hw.syncBoundaryBar();
  hw.updateSelectionVisuals();
  hw.syncNodeRippleVisuals();
}

function toggleSelectedNode(node) {
  if (!hw.nodeCanSelect(node) || !hw.state.parsed) return;
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

function crackWhipOnSelection(nodes, btnEl) {
  if (!nodes?.length) return;
  const crackTarget = btnEl?.closest?.('.hw-whip-float') || btnEl;
  crackTarget?.classList.add('hw-whip-btn--crack', 'hw-whip-float--crack');
  hw.playWhipCrackSound();
  const text = nodes.length === 1 ? hw.constraintForNode(nodes[0]) : hw.buildBoundaryPrompt();
  hw.copyText(text);
  hw.showCopyToast(
    nodes.length === 1
      ? '约束已复制 · 粘贴到 Chat 即可'
      : `${nodes.length} 个节点约束已复制 · 粘贴到 Chat 即可`,
  );
  setTimeout(() => crackTarget?.classList.remove('hw-whip-btn--crack', 'hw-whip-float--crack'), 520);
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

function updateSelectionVisuals() {
  const bundle = hw.state.selectedLink;
  d3.selectAll('.node-selection-ring').remove();
  d3.selectAll('.node-group').classed('node-group--selected', function () {
    const d = d3.select(this).datum();
    return d?.id && hw.state.selectedNodeIds.has(d.id);
  });
  d3.selectAll('.node-group').classed('node-group--boundary', function () {
    const d = d3.select(this).datum();
    return d?.id && hw.state.selectedNodeIds.has(d.id);
  });
  hw.setPulseNode(hw.state.pulseNodeId);
  d3.selectAll('.link-group').classed('link-group--selected', function () {
    const d = d3.select(this).select('.link-core').datum();
    return bundle && d && (d.id === bundle.id || d.to?.id === bundle.id);
  });

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
  rebuildBoundaryFromNodes,
  syncBoundaryBar,
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
  cmdResetHard,
  constraintForNode,
  nodeCanWhip,
  crackWhipOnSelection,
  selectedWhipNodes,
  whipHostNode,
  updateSelectionVisuals,
});
