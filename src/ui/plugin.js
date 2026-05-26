import { hw } from '../core/hw.js';

function updatePluginBar(laneCount) {
  const el = document.getElementById('plugin-open-status');
  if (!el) return;
  if (hw.state.pluginDemoAllFiles) {
    el.textContent = '演示数据';
    return;
  }
  if (!hw.state.parsed) {
    el.textContent = '读取 git log…';
    return;
  }
  const boundaryN = hw.BOUNDARY_BAR_ENABLED ? hw.state.selectedNodeIds.size : 0;
  const ws = hw.state.workspaceFiles?.length ?? 0;
  if (laneCount > 0) {
    const lanes = hw.state.catalog?.lanes || [];
    const dirs = lanes.filter((l) => l.type === 'folder' && (l.collapsed || l.isHeader)).length;
    const files = lanes.filter((l) => l.type === 'file').length;
    const base = files > 0
      ? `${files} 个文件 · ${dirs} 个目录`
      : `${laneCount} 行`;
    const exp = hw.PER_LANE_VERSION ? ' · 每夹V' : '';
    el.textContent = boundaryN > 0 ? `${base} · 边界 ${boundaryN}${exp}` : `${base}${exp}`;
  } else {
    el.textContent = ws > 0 ? '目录已同步，等待 git 记录' : '同步工作区目录…';
  }
}

function showPluginEmptyGit() {
  if (hw.els.graphEmpty) {
    hw.els.graphEmpty.classList.remove('hidden');
    const title = hw.els.graphEmpty.querySelector('.graph-empty__title');
    const desc = hw.els.graphEmpty.querySelector('.graph-empty__desc');
    if (title) title.textContent = '划定边界，再让 AI 动手';
    if (desc) desc.textContent = '需要至少一次 commit 才有泳道 · 命令面板：马鞭: 刷新 Git 记录';
  }
  if (hw.els.graphHint) hw.els.graphHint.hidden = true;
  if (hw.els.graphZoom) hw.els.graphZoom.hidden = true;
  hw.updatePluginBar(0);
}

Object.assign(hw, {
  updatePluginBar,
  showPluginEmptyGit,
});
