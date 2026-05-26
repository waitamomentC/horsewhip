import { hw } from '../core/hw.js';

function onFolderClusterClick(ev, node) {
  hw.hideTooltip();
  hw.state.animateNext = false;
  hw.state.selectedLink = null;
  hw.els.linkPanel.hidden = true;
  hw.toggleFolderClusterSelection(node);
  hw.state.focusGraphX = node.displayColumn ?? node.graphX;
  hw.state.pulseNodeId = hw.state.selectedNodeIds.has(node.id) ? node.id : null;
  hw.updateGraphFocus();
  hw.updateSelectionVisuals();
}

function nodeClickAnchor(ev) {
  const el = ev?.currentTarget;
  return el instanceof Element ? el.getBoundingClientRect() : null;
}

function onFileNodeClick(ev, node) {
  hw.toggleSelectedNode(node);
  hw.state.focusGraphX = node.displayColumn ?? node.graphX;
  if (hw.state.selectedNodeIds.has(node.id) && hw.nodeCanShowTooltip(node) && !hw.isBranchGraphAnchor(node)) {
    hw.state.pulseNodeId = node.id;
  } else if (hw.state.pulseNodeId === node.id) {
    hw.state.pulseNodeId = null;
  }
  hw.state.selectedLink = null;
  hw.els.linkPanel.hidden = true;
  hw.updateGraphFocus();
  hw.updateSelectionVisuals();
}

function openNodeModal(node) {
  if (hw.isBranchGraphAnchor(node)) return;
  hw.state.modalNode = node;
  const files = node.files || [node.filePath];
  hw.els.modalTitle.textContent = (() => {
    const ver = hw.nodeVersionTooltipLine(node);
    const subj = hw.commitSubjectForNode(node);
    return subj ? `${ver} · ${subj}` : `${ver} · ${node.hash.slice(0, 7)}`;
  })();
  hw.els.modalMeta.textContent = `${node.author} · ${node.date}`;
  hw.els.modalFile.textContent = node.isFolderAggregate
    ? (node.lanePath === hw.ROOT_BUCKET ? '(root)/' : node.lanePath)
    : files[0];
  hw.els.modalConstraint.textContent = (() => {
    const folderPath = hw.folderBoundaryPathFromNode(node);
    if (folderPath) return hw.constraintFolder(folderPath);
    return files.length === 1 ? hw.constraintSingle(files[0]) : hw.constraintMulti(files);
  })();
  hw.els.modalCmdFile.textContent = node.isFolderAggregate
    ? `# 文件夹边界 · 请按需 checkout 目录下具体文件\n${files.map((f) => hw.cmdCheckout(node.hash, f)).join('\n')}`
    : (files.length === 1
      ? hw.cmdCheckout(node.hash, files[0])
      : files.map((f) => hw.cmdCheckout(node.hash, f)).join('\n'));
  hw.els.modalCmdReset.textContent = hw.cmdResetHard(node.hash);
  hw.els.rollbackDanger.hidden = true;
  hw.els.resetConfirm.value = '';
  hw.els.btnCopyReset.disabled = true;
  hw.els.btnToggleReset.textContent = 'confirm';
  hw.els.modalBackdrop.hidden = false;
}

function onBundleClick(bundle) {
  hw.hideTooltip();
  const commit = bundle.commit || bundle;
  const graphX = commit.displayColumn ?? bundle.displayColumn ?? bundle.graphX;
  if (graphX != null) hw.state.focusGraphX = graphX;
  hw.state.selectedLink = bundle;
  hw.els.linkPanel.hidden = true;
  hw.updateGraphFocus();
  hw.updateSelectionVisuals();
}

function closeModal() {
  hw.els.modalBackdrop.hidden = true;
  hw.state.modalNode = null;
  hw.updateSelectionVisuals();
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

Object.assign(hw, {
  onFolderClusterClick,
  nodeClickAnchor,
  onFileNodeClick,
  openNodeModal,
  onBundleClick,
  closeModal,
  escapeHtml,
});
