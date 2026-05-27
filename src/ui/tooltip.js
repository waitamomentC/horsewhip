import { hw } from '../core/hw.js';

function positionTooltipFromRect(rect) {
  hw.els.tooltip.style.transform = '';
  const pad = 12;
  let left = rect.right + pad;
  let top = rect.top + rect.height / 2 - 20;
  const tip = hw.els.tooltip;
  const tipW = tip.offsetWidth || 240;
  const tipH = tip.offsetHeight || 96;
  if (left + tipW > window.innerWidth - 10) left = rect.left - tipW - pad;
  if (top + tipH > window.innerHeight - 10) top = window.innerHeight - tipH - 10;
  if (top < 10) top = 10;
  tip.style.left = `${Math.max(10, left)}px`;
  tip.style.top = `${top}px`;
}

function refreshNodeIndex() {
  hw.state.nodeIndex = {};
  if (!hw.gScroll) return;
  hw.gScroll.selectAll('.node-group[data-node-id]').each(function () {
    const d = d3.select(this).datum();
    if (d?.id) hw.state.nodeIndex[d.id] = d;
  });
}

function pickFileNodeFromPointer(e) {
  const svg = hw.els.graphSvg;
  if (!svg || !e?.target) return null;
  let el = e.target;
  if (!(el instanceof Element)) return null;
  if (!svg.contains(el)) return null;

  let gEl = null;
  for (let n = el; n && n !== svg; n = n.parentElement || n.parentNode) {
    if (!(n instanceof Element)) break;
    if (n.hasAttribute('data-node-id')) {
      gEl = n;
      break;
    }
  }
  if (!gEl || gEl.classList.contains('node-group--folder')) return null;

  const nodeId = gEl.getAttribute('data-node-id');
  const node = hw.state.nodeIndex[nodeId] || d3.select(gEl).datum();
  if (!node || !hw.nodeCanShowTooltip(node)) return null;

  const hit = gEl.querySelector('.node-hit:not(.node-hit--folder)') || gEl;
  return { node, hit };
}

function findNodeGroupEl(nodeId) {
  if (!hw.els.graphSvg || !nodeId) return null;
  const esc = typeof CSS !== 'undefined' && CSS.escape
    ? CSS.escape(nodeId)
    : nodeId.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
  return hw.els.graphSvg.querySelector(`[data-node-id="${esc}"]`);
}

function resolveTooltipAnchor(node, anchorRect) {
  if (anchorRect && anchorRect.width > 0 && anchorRect.height > 0) return anchorRect;
  const hit = hw.findNodeGroupEl(node.id)?.querySelector('.node-hit');
  if (hit) return hit.getBoundingClientRect();
  return null;
}

function showTooltipForNode(node, anchorRect) {
  const files = node.files || [node.filePath];
  const ver = hw.nodeVersionTooltipLine(node);
  const subj = hw.commitSubjectForNode(node);
  const fileLine = node.isForkAnchor
    ? `主泳道在此处分叉 → ⎇ ${node.branchName || 'branch'}`
    : node.isMergeAnchor || node.isMergeLanding
      ? node.isHistoricalMergeLanding
        ? `曾由分支汇入主泳道（分支已继续迭代）· ⎇ ${node.branchName || 'branch'}`
        : `分支合入主泳道 · ⎇ ${node.branchName || 'branch'}`
      : node.lane?.isBranchLane
        ? (() => {
          const seg = node.lane.branchSegment;
          const parsed = hw.state.parsed;
          return (seg && parsed && hw.branchLaneProvenanceLine(node, seg, parsed))
            || `⎇ ${seg?.name || 'branch'} · 沿分支推进`;
        })()
        : node.isFolderAggregate
          ? (node.lanePath === hw.ROOT_BUCKET ? '(root)/' : (node.lanePath || node.label))
          : files[0];
  const foot = node.isForkAnchor
    ? (hw.PER_LANE_VERSION ? '从该文件夹版本处分出（横轴为上传 Cn）' : '从该版本列分出')
    : node.isMergeAnchor || node.isMergeLanding
      ? (hw.PER_LANE_VERSION ? '沿分支泳道合入（横轴为上传 Cn）' : '沿分支泳道合入该版本列')
      : node.lane?.isBranchLane
        ? (hw.branchLaneProvenanceIsContinuation(node, node.lane.branchSegment, hw.state.parsed)
          ? '沿本分支泳道推进（非主泳道新分叉）'
          : (hw.PER_LANE_VERSION ? '从主泳道该列分出（横轴为上传 Cn）' : '从主泳道该列分出'))
      : node.isFolderAggregate
        ? '单击选中文件夹边界 · 双击详情 · 点 horsewhip 复制'
        : '单击切换选中 · 双击详情 · 点 horsewhip 复制';
  const accent = node.lane?.color || '#6d7ce8';
  const verLine = subj ? `${ver} · ${subj}` : ver;
  if (!hw.els.tooltip) return;
  hw.els.tooltip.removeAttribute('hidden');
  hw.els.tooltip.classList.add('is-open');
  hw.els.tooltip.style.display = 'block';
  hw.els.tooltip.style.setProperty('--tooltip-accent', accent);
  hw.els.tooltip.innerHTML = `
    <div class="tooltip__head">
      <span class="tooltip__ver">${hw.escapeHtml(verLine)}</span>
    </div>
    <div class="tooltip__meta">${hw.escapeHtml(node.author)} · ${hw.escapeHtml(node.date)}${subj ? '' : ` · ${hw.escapeHtml(node.hash.slice(0, 7))}`}</div>
    <div class="tooltip__file">${hw.escapeHtml(fileLine)}</div>
    <div class="tooltip__foot">${hw.escapeHtml(foot)}</div>
  `;
  const rect = hw.resolveTooltipAnchor(node, anchorRect);
  if (rect) hw.positionTooltipFromRect(rect);
  else {
    hw.els.tooltip.style.left = '50%';
    hw.els.tooltip.style.top = '42%';
    hw.els.tooltip.style.transform = 'translate(-50%, -50%)';
  }
}

function hideTooltip() {
  if (!hw.els.tooltip) return;
  hw.els.tooltip.setAttribute('hidden', '');
  hw.els.tooltip.classList.remove('is-open');
  hw.els.tooltip.style.display = '';
  d3.selectAll('.node-group--hover').classed('node-group--hover', false);
}

function bindFolderNodePointer(g, node) {
  g.style('pointer-events', 'all');
  g.on('pointerenter.tooltip', () => {
    g.classed('node-group--hover', true);
    const hit = g.select('.node-hit').node();
    const rect = hit instanceof Element ? hit.getBoundingClientRect() : null;
    hw.showTooltipForNode(node, rect);
  });
  g.on('pointerleave.tooltip', () => {
    g.classed('node-group--hover', false);
    hw.hideTooltip();
  });
}

function bindFileNodePointer(g, node) {
  g.style('pointer-events', 'all');
  g.on('pointerenter.tooltip', (ev) => {
    g.classed('node-group--hover', true);
    if (!hw.nodeCanShowTooltip(node)) return;
    const hit = g.select('.node-hit').node();
    const rect = hit instanceof Element ? hit.getBoundingClientRect() : null;
    hw.showTooltipForNode(node, rect);
  });
  g.on('pointerleave.tooltip', () => {
    g.classed('node-group--hover', false);
    hw.hideTooltip();
  });
}

function initGraphViewportEvents() {
  if (!hw.els.graphViewport) return;
  if (hw.els.graphViewport.dataset.hwBound) return;
  hw.els.graphViewport.dataset.hwBound = '1';

  const onGraphClick = (e) => {
    const picked = hw.pickFileNodeFromPointer(e);
    if (!picked) {
      if (hw.nodeClickTimer) {
        clearTimeout(hw.nodeClickTimer);
        hw.nodeClickTimer = null;
      }
      if (hw.state.selectedNodeIds.size > 0) hw.clearNodeSelection();
      if (hw.state.selectedLink) {
        hw.state.selectedLink = null;
        hw.els.linkPanel.hidden = true;
        hw.updateSelectionVisuals();
      }
      hw.hideTooltip();
      return;
    }
    hw.suppressOutsideClick = true;
    e.stopPropagation();
    if (hw.nodeClickTimer) clearTimeout(hw.nodeClickTimer);
    hw.nodeClickTimer = setTimeout(() => {
      hw.nodeClickTimer = null;
      hw.onFileNodeClick(e, picked.node);
    }, 240);
  };

  hw.els.graphViewport.addEventListener('click', onGraphClick);
  hw.els.graphViewport.addEventListener('pointerleave', hw.hideTooltip);

  hw.els.graphViewport.addEventListener('dblclick', (e) => {
    const picked = hw.pickFileNodeFromPointer(e);
    if (!picked) return;
    if (hw.nodeClickTimer) {
      clearTimeout(hw.nodeClickTimer);
      hw.nodeClickTimer = null;
    }
    e.preventDefault();
    e.stopPropagation();
    hw.suppressOutsideClick = true;
    hw.openNodeModal(picked.node);
  });
}

Object.assign(hw, {
  positionTooltipFromRect,
  refreshNodeIndex,
  pickFileNodeFromPointer,
  findNodeGroupEl,
  resolveTooltipAnchor,
  showTooltipForNode,
  hideTooltip,
  bindFolderNodePointer,
  bindFileNodePointer,
  initGraphViewportEvents,
});
