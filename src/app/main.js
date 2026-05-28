/** Horsewhip entry — bundle → script.js */
import { hw } from '../core/hw.js';
import '../core/config.js';
import '../core/state.js';
import '../core/dom.js';
import '../git/parse.js';
import '../git/branches.js';
import '../git/columns.js';
import '../graph/branch-merge.js';
import '../lanes/bounds.js';
import '../lanes/catalog.js';
import '../graph/build.js';
import '../selection/boundary.js';
import '../selection/mcp-boundary-navigate.js';
import '../viewport/layout.js';
import '../graph/geometry.js';
import '../graph/svg-nodes.js';
import '../graph/render.js';
import '../ui/ruler.js';
import '../ui/file-rail.js';
import '../ui/branches.js';
import '../ui/modal.js';
import '../ui/tooltip.js';
import '../ui/plugin.js';
import '../ui/guard-arm.js';
import '../audio/whip.js';
import './data.js';
import './wire.js';
import { bootstrap } from './bootstrap.js';

if (typeof d3 === 'undefined') {
  window.__horsewhipBootError = 'd3 图表库未加载。请重新加载窗口；若仍失败，确认 extension/media/d3.min.js 存在。';
} else {
  try {
    bootstrap();
  } catch (err) {
    console.error('[Horsewhip] bootstrap failed:', err);
    window.__horsewhipBootError = err?.message || String(err);
  }
}

if (hw.PER_LANE_VERSION) document.documentElement.classList.add('hw-per-lane-v');

window.HorsewhipApp = {
  loadLog: hw.loadAndRender,
  loadDemo() {
    if (typeof DEMO_GIT_LOG !== 'undefined') {
      if (hw.isPluginHost()) hw.state.pluginDemoAllFiles = true;
      hw.loadAndRender(DEMO_GIT_LOG);
    }
  },
  setWorkspaceFiles(paths) {
    if (!hw.isPluginHost()) return;
    hw.state.pluginDemoAllFiles = false;
    hw.state.workspaceFiles = Array.isArray(paths) ? paths : [];
    if (hw.state.parsed) hw.scheduleRenderFromState();
  },
  setGitBranches(branches, currentBranch) {
    hw.state.gitBranches = Array.isArray(branches) ? branches : [];
    hw.state.currentGitBranch = currentBranch || '';
    if (hw.state.parsed) {
      hw.enrichBranchSegmentsFromGitBranches(hw.state.parsed, hw.state.gitBranches);
      hw.scheduleRenderFromState();
    } else {
      hw.renderBranchRail();
    }
  },
  getModalNode: () => hw.state.modalNode,
  getBoundaryFiles: hw.getBoundaryFilesList,
  buildBoundaryPrompt: hw.buildBoundaryPrompt,
  clearNodeSelection: hw.clearNodeSelection,
  applyBoundaryFromHost: hw.applyBoundaryFromHost,
  refreshMcpBoundaryAfterParse: hw.refreshMcpBoundaryAfterParse,
  onHostGuardActive: (active) => hw.onHostGuardActive(active),
  initGuardArmControl: () => hw.initGuardArmControl(),
};

window.dispatchEvent(new CustomEvent('horsewhip-app-ready'));
