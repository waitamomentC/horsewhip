import { hw } from '../core/hw.js';

function prepareFileRailShell(lanes) {
  hw.renderBranchRail();
  const inner = hw.els.fileRailInner;
  inner.innerHTML = '';
  const spacer = document.createElement('div');
  spacer.className = 'file-rail__ruler-spacer';
  spacer.style.height = `${hw.CONFIG.RULER_HEIGHT}px`;
  spacer.setAttribute('aria-hidden', 'true');
  inner.appendChild(spacer);
  const laneCount = hw.laneCountForScroll(lanes.length);
  inner.style.height = `${hw.graphSvgHeight(laneCount)}px`;
  return inner;
}

function ensureFileRailScrollPad() {
  const inner = hw.els.fileRailInner;
  if (!inner) return;
  const padH = hw.fileRailScrollPadHeight();
  let pad = inner.querySelector('.file-rail__scroll-pad');
  if (!pad) {
    pad = document.createElement('div');
    pad.className = 'file-rail__scroll-pad';
    pad.setAttribute('aria-hidden', 'true');
    inner.appendChild(pad);
  }
  pad.style.height = `${padH}px`;
  pad.style.flexShrink = '0';
}

function fileRailIndent(depth) {
  const step = hw.isPluginHost() ? 14 : 9;
  return 5 + depth * step;
}

function fileRailTitle(lane) {
  let tip = lane.path === hw.ROOT_BUCKET ? '(root)' : lane.path;
  if (hw.PER_LANE_VERSION && hw.state.parsed && !lane.isHeader) {
    const lv = hw.laneVersionAtHead(hw.state.parsed, lane.path);
    if (lv > 0) tip = `${tip} · 泳道 ${hw.formatLaneVersion(lv)}`;
  }
  return tip;
}

function appendFileRailRow(lane) {
  const row = document.createElement('div');
  if (lane.isBranchLane) {
    row.className = 'file-rail__item file-rail__item--branch';
    if (lane.branchSegment?.name) row.dataset.branchName = lane.branchSegment.name;
    row.style.paddingLeft = `${hw.fileRailIndent(lane.depth)}px`;
    row.title = hw.fileRailTitle(lane);
    const chev = document.createElement('span');
    chev.className = 'file-rail__chev';
    chev.textContent = '⎇';
    const label = document.createElement('span');
    label.className = 'file-rail__label';
    label.textContent = hw.truncatePath(lane.label);
    if (lane.color) {
      const c = lane.color;
      chev.style.color = c;
      label.style.color = c;
    }
    row.appendChild(chev);
    row.appendChild(label);
    return row;
  }

  if (lane.inlineFolder && !hw.isPluginHost()) {
    row.className = 'file-rail__item file-rail__item--file file-rail__item--folder-inline';
    row.style.paddingLeft = `${hw.fileRailIndent(lane.depth)}px`;
    row.title = hw.fileRailTitle(lane);
    const chev = document.createElement('button');
    chev.type = 'button';
    chev.className = 'file-rail__chev file-rail__chev--collapse';
    chev.textContent = '▾';
    chev.title = `收起 ${hw.shortenFolderLabel(lane.inlineFolder.label)}`;
    chev.addEventListener('click', (e) => {
      e.stopPropagation();
      hw.toggleExpand(lane.inlineFolder.path, e.altKey);
    });
    const label = document.createElement('span');
    label.className = 'file-rail__label';
    const leaf = lane.path.split('/').pop() || lane.label;
    label.textContent = hw.truncatePath(hw.isPluginHost() && lane.type === 'folder' ? leaf : leaf);
    row.appendChild(chev);
    row.appendChild(hw.createRailIcon(lane));
    row.appendChild(label);
    if (lane.type === 'folder' && hw.isPluginHost()) {
      row.classList.remove('file-rail__item--file');
      row.classList.add('file-rail__item--folder');
      row.addEventListener('click', (e) => {
        if (e.altKey && window.HorsewhipPluginBridge?.revealFolder) {
          window.HorsewhipPluginBridge.revealFolder(lane.path === hw.ROOT_BUCKET ? '' : lane.path);
          return;
        }
        hw.toggleExpand(lane.path, e.altKey);
      });
    } else {
      hw.wireFileRailFocus(row, lane);
    }
    return row;
  }

  row.className = `file-rail__item${lane.collapsed || lane.isHeader ? ' file-rail__item--folder' : ' file-rail__item--file'}`;
  row.style.paddingLeft = `${hw.fileRailIndent(lane.depth)}px`;
  const chev = document.createElement('span');
  chev.className = 'file-rail__chev';
  chev.textContent = lane.isHeader ? '▾' : (lane.collapsed ? '▸' : '·');
  const label = document.createElement('span');
  label.className = 'file-rail__label';
  const display = (lane.collapsed || lane.isHeader)
    ? (hw.isPluginHost() ? lane.label : hw.shortenFolderLabel(lane.label))
    : (hw.isFlatLaneLayout() ? lane.path : (lane.path.split('/').pop() || lane.label));
  label.textContent = hw.truncatePath(display);
  row.title = hw.fileRailTitle(lane);
  if (lane.collapsed || lane.isHeader) {
    row.classList.add('file-rail__item--folder');
    row.appendChild(hw.createRailIcon(lane));
    row.appendChild(chev);
    hw.wireFileRailFolderRow(row, lane, chev);
  } else {
    row.appendChild(hw.createRailIcon(lane));
  }
  row.appendChild(label);
  hw.wireFileRailFocus(row, lane);
  return row;
}

Object.assign(hw, {
  prepareFileRailShell,
  ensureFileRailScrollPad,
  fileRailIndent,
  fileRailTitle,
  appendFileRailRow,
});
