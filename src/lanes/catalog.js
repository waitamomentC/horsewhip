import { hw } from '../core/hw.js';

function insertBranchLanes(baseLanes, branchSegments) {
  const out = [];
  for (const lane of baseLanes) {
    out.push(lane);
    if (lane.isHeader) continue;
    branchSegments.filter((seg) => hw.segmentTouchesLane(seg, lane)).forEach((seg) => {
      out.push({
        ...lane,
        path: `${lane.path}#⎇${seg.id}`,
        parentLanePath: lane.path,
        isBranchLane: true,
        branchSegment: seg,
        label: `⎇ ${seg.name}`,
      });
    });
  }
  return out;
}

function assignLaneColors(lanes) {
  const assignable = lanes.filter((l) => !l.isHeader && !l.isBranchLane);
  const hueByPath = new Map();
  let hueIdx = 0;
  assignable.forEach((lane) => {
    if (!hueByPath.has(lane.path)) {
      hueByPath.set(lane.path, hw.LANE_HUES[hueIdx % hw.LANE_HUES.length]);
      hueIdx += 1;
    }
  });

  return lanes.map((lane) => {
    const branch = !!lane.isBranchLane;
    const d = (lane.depth || 0) + (branch ? 1 : 0);
    let h;
    if (branch) {
      h = hueByPath.get(lane.parentLanePath) ?? hw.LANE_HUES[0];
    } else if (lane.isHeader) {
      h = hueByPath.get(lane.path) ?? hw.LANE_HUES[0];
    } else {
      h = hueByPath.get(lane.path) ?? hw.LANE_HUES[hueIdx % hw.LANE_HUES.length];
    }
    const sat = Math.min(82, 74 - d * 2);
    const lit = Math.max(32, 62 - d * 2);
    const satDim = Math.max(38, sat - 18);
    const litDim = Math.max(28, lit - 14);
    return {
      ...lane,
      hue: h,
      color: `hsl(${h}, ${sat}%, ${lit}%)`,
      colorDim: `hsl(${h}, ${satDim}%, ${litDim}%)`,
      colorBright: `hsl(${h}, ${Math.min(88, sat + 6)}%, ${Math.min(72, lit + 6)}%)`,
    };
  });
}

function laneIconColor(lane) {
  return lane.color;
}

function getAllFiles(parsed) {
  return Object.keys(parsed.fileTimelines).sort();
}

function getDirectChildren(folderPath, allFiles, rootFiles) {
  if (folderPath === hw.ROOT_BUCKET) {
    return (rootFiles || allFiles.filter((f) => !f.includes('/')))
      .map((f) => ({ type: 'file', path: f, name: f }));
  }
  const map = new Map();
  for (const f of allFiles) {
    if (!f.startsWith(folderPath)) continue;
    const rest = f.slice(folderPath.length);
    const slash = rest.indexOf('/');
    if (slash === -1) {
      map.set(f, { type: 'file', path: f, name: rest });
    } else {
      const seg = rest.slice(0, slash + 1);
      const childPath = folderPath + seg;
      if (!map.has(childPath)) map.set(childPath, { type: 'folder', path: childPath, name: seg });
    }
  }
  return [...map.values()].sort((a, b) => a.path.localeCompare(b.path));
}

function filesUnderPrefix(prefix, allFiles, rootFiles) {
  if (prefix === hw.ROOT_BUCKET) return rootFiles || allFiles.filter((f) => !f.includes('/'));
  return allFiles.filter((f) => f.startsWith(prefix));
}

function getTopLevelItems(allFiles) {
  const folders = new Set();
  const rootFiles = [];
  for (const f of allFiles) {
    if (f.includes('/')) folders.add(`${f.split('/')[0]}/`);
    else rootFiles.push(f);
  }
  const items = [...folders].sort().map((p) => ({ type: 'folder', path: p, depth: 0 }));
  if (rootFiles.length === 1) {
    items.push({ type: 'file', path: rootFiles[0], depth: 0 });
  } else if (rootFiles.length > 1) {
    items.push({ type: 'folder', path: hw.ROOT_BUCKET, depth: 0, rootFiles: [...rootFiles] });
  }
  return items.sort((a, b) => a.path.localeCompare(b.path));
}

function collectFlatFileLanes(allFiles) {
  return [...allFiles].sort((a, b) => a.localeCompare(b)).map((path) => ({
    path,
    type: 'file',
    depth: 0,
    collapsed: false,
    label: path,
    files: [path],
  }));
}

function folderDisplayLabel(folderPath) {
  if (folderPath === hw.ROOT_BUCKET) return '(root)';
  const parts = folderPath.split('/').filter(Boolean);
  return `${parts[parts.length - 1]}/`;
}

function sortExplorerChildren(children) {
  const folders = children.filter((c) => c.type === 'folder').sort((a, b) => a.path.localeCompare(b.path));
  const files = children.filter((c) => c.type === 'file').sort((a, b) => a.path.localeCompare(b.path));
  return [...folders, ...files];
}

function getTopLevelItemsExplorer(allFiles) {
  const folders = new Set();
  const rootFiles = [];
  for (const f of allFiles) {
    if (f.includes('/')) folders.add(`${f.split('/')[0]}/`);
    else rootFiles.push(f);
  }
  const folderItems = [...folders].sort((a, b) => a.localeCompare(b)).map((p) => ({ type: 'folder', path: p }));
  const fileItems = rootFiles.sort((a, b) => a.localeCompare(b)).map((p) => ({ type: 'file', path: p }));
  return [...folderItems, ...fileItems];
}

function collectExplorerTreeLanes(allFiles) {
  const lanes = [];
  const expanded = hw.state.expandedPaths;

  function walk(item, depth) {
    if (item.type === 'file') {
      lanes.push({
        path: item.path,
        type: 'file',
        depth,
        collapsed: false,
        label: item.path.split('/').pop(),
        files: [item.path],
      });
      return;
    }

    const folderPath = item.path;
    const isRoot = folderPath === hw.ROOT_BUCKET;
    const rootFiles = item.rootFiles;
    const label = isRoot ? '(root)' : hw.folderDisplayLabel(folderPath);
    const desc = hw.filesUnderPrefix(folderPath, allFiles, rootFiles);
    if (desc.length === 0) return;

    if (!expanded.has(folderPath)) {
      lanes.push({
        path: folderPath,
        type: 'folder',
        depth,
        collapsed: true,
        label,
        files: desc,
      });
      return;
    }

    lanes.push({
      path: folderPath,
      type: 'folder',
      depth,
      collapsed: true,
      isHeader: true,
      label,
      files: desc,
    });

    hw.sortExplorerChildren(hw.getDirectChildren(folderPath, allFiles, rootFiles))
      .forEach((child) => walk(child, depth + 1));
  }

  hw.getTopLevelItemsExplorer(allFiles).forEach((item) => walk(item, 0));
  return lanes;
}

function collectGroupedFileLanes(allFiles) {
  const lanes = [];
  const expanded = hw.state.expandedPaths;

  function walk(item, depth) {
    if (item.type === 'file') {
      lanes.push({
        path: item.path,
        type: 'file',
        depth,
        collapsed: false,
        label: item.path.split('/').pop(),
        files: [item.path],
      });
      return;
    }

    const folderPath = item.path;
    const isRoot = folderPath === hw.ROOT_BUCKET;
    const rootFiles = item.rootFiles;

    if (!expanded.has(folderPath)) {
      const desc = hw.filesUnderPrefix(folderPath, allFiles, rootFiles);
      if (desc.length === 0) return;
      lanes.push({
        path: folderPath,
        type: 'folder',
        depth,
        collapsed: true,
        label: isRoot ? '(root)' : folderPath,
        files: desc,
      });
      return;
    }

    const folderLabel = isRoot ? '(root)' : folderPath;
    hw.getDirectChildren(folderPath, allFiles, rootFiles).forEach((child, idx) => {
      const inlineFolder = idx === 0 ? { path: folderPath, label: folderLabel } : null;
      if (child.type === 'file') {
        lanes.push({
          path: child.path,
          type: 'file',
          depth,
          collapsed: false,
          label: child.path.split('/').pop(),
          files: [child.path],
          inlineFolder,
        });
      } else {
        walk({ type: 'folder', path: child.path }, depth);
      }
    });
  }

  hw.getTopLevelItems(allFiles).forEach((item) => walk(item, 0));
  return lanes;
}

function collectVisibleLanes(allFiles) {
  if (hw.isPluginHost()) return hw.collectExplorerTreeLanes(allFiles);
  if (hw.state.laneLayout === hw.LANE_LAYOUT_FLAT) return hw.collectFlatFileLanes(allFiles);
  return hw.collectGroupedFileLanes(allFiles);
}

function getLaneSourceFiles(parsed) {
  const fromGit = hw.getFilteredFiles(parsed);
  if (!hw.isPluginHost()) return fromGit;
  if (hw.state.pluginDemoAllFiles) return fromGit;
  const ws = hw.state.workspaceFiles;
  if (!ws?.length) return fromGit;
  const merged = new Set(fromGit);
  ws.forEach((p) => merged.add(p));
  return [...merged].sort((a, b) => a.localeCompare(b));
}

function isFlatLaneLayout() {
  return hw.state.laneLayout === hw.LANE_LAYOUT_FLAT;
}

function syncLaneLayoutButton() {
  if (!hw.els.btnLaneLayout) return;
  const flat = hw.isFlatLaneLayout();
  hw.els.btnLaneLayout.textContent = flat ? '文件' : '目录';
  hw.els.btnLaneLayout.setAttribute(
    'title',
    flat
      ? '当前：扁平文件列表（点击切换为按目录分组）'
      : '当前：按目录分组（点击切换为扁平文件列表）',
  );
  hw.els.btnLaneLayout.setAttribute('aria-pressed', flat ? 'true' : 'false');
  hw.els.btnLaneLayout.classList.toggle('btn--solid', flat);
}

function setLaneLayout(layout) {
  const next = layout === hw.LANE_LAYOUT_FLAT ? LANE_LAYOUT_FLAT : hw.LANE_LAYOUT_GROUPED;
  if (hw.state.laneLayout === next) return;
  hw.state.laneLayout = next;
  try { localStorage.setItem(hw.LANE_LAYOUT_KEY, next); } catch { /* ignore */ }
  hw.syncLaneLayoutButton();
  if (hw.state.parsed) hw.scheduleRenderFromState();
}

function toggleLaneLayout() {
  hw.setLaneLayout(hw.isFlatLaneLayout() ? LANE_LAYOUT_GROUPED : hw.LANE_LAYOUT_FLAT);
}

function topGroupKey(lane) {
  if (lane.path === hw.ROOT_BUCKET) return hw.ROOT_BUCKET;
  if (lane.type === 'file' && !lane.path.includes('/')) return lane.path;
  return `${lane.path.split('/')[0]}/`;
}

function laneMatchPath(lane) {
  if (lane.isBranchLane && lane.parentLanePath) return lane.parentLanePath;
  return lane.path;
}

function fileMatchesLane(file, lane) {
  if (lane.isHeader) return false;
  const path = hw.laneMatchPath(lane);
  if (!path) return false;
  if (lane.type === 'file') return file === path;
  if (path === hw.ROOT_BUCKET) return !file.includes('/');
  return file.startsWith(path);
}

function getVersionColumns(parsed) {
  const byX = new Map();
  parsed.commits.forEach((c) => {
    if (!byX.has(c.graphX)) byX.set(c.graphX, c);
  });
  return [...byX.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([, commit]) => commit);
}

function expandAncestorsForFiles(files) {
  files.forEach((f) => {
    if (!f.includes('/')) {
      hw.state.expandedPaths.add(hw.ROOT_BUCKET);
      return;
    }
    const parts = f.split('/');
    for (let i = 1; i < parts.length; i++) {
      hw.state.expandedPaths.add(`${parts.slice(0, i).join('/')}/`);
    }
  });
}

function toggleExpand(path, recursive) {
  if (!hw.state.parsed) return;
  if (recursive) {
    hw.state.expandedPaths.add(path);
    if (path !== hw.ROOT_BUCKET) {
      const allFiles = hw.getFilteredFiles(hw.state.parsed, false);
      allFiles.filter((f) => f.startsWith(path)).forEach((f) => {
        if (!f.includes('/')) return;
        const rest = f.slice(path.length);
        const slash = rest.indexOf('/');
        if (slash > 0) hw.state.expandedPaths.add(`${path}${rest.slice(0, slash + 1)}`);
      });
    }
  } else if (hw.state.expandedPaths.has(path)) {
    hw.state.expandedPaths.delete(path);
  } else {
    hw.state.expandedPaths.add(path);
  }
  hw.state.animateNext = false;
  hw.renderFromState();
}

function getFilteredFiles(parsed, autoExpand) {
  const q = hw.state.fileFilter.trim().toLowerCase();
  let files = hw.getAllFiles(parsed);
  if (q) {
    files = files.filter((f) => f.toLowerCase().includes(q));
    if (autoExpand !== false) hw.expandAncestorsForFiles(files);
  }
  return files;
}

function hashBit(str) {
  let h = 0;
  for (let i = 0; i < str.length; i++) {
    h = ((h << 5) - h + str.charCodeAt(i)) | 0;
  }
  return Math.abs(h) % 2;
}

function pickHubLane(onPage, commitHash) {
  const sorted = [...onPage].sort((a, b) => a.laneIndex - b.laneIndex);
  const n = sorted.length;
  if (n <= 1) return sorted[0];
  if (n % 2 === 1) {
    return sorted[Math.floor((n - 1) / 2)];
  }
  const lo = n / 2 - 1;
  const hi = n / 2;
  return sorted[hw.hashBit(commitHash) ? hi : lo];
}

function buildLaneCatalog(parsed) {
  const allFiles = hw.getLaneSourceFiles(parsed);
  hw.assignPerLaneVersions(parsed, allFiles);
  const hi = hw.headIndex(parsed);
  const head = hw.headCommit(parsed);
  const focusGraphX = hw.resolveFocusGraphX(parsed);
  const headMainlineV = hw.headMainlineVersion(parsed);
  const baseLanes = hw.collectVisibleLanes(allFiles);
  const withBranches = hw.insertBranchLanes(baseLanes, parsed.branchSegments || []);
  const lanes = hw.assignLaneColors(withBranches);
  lanes.forEach((lane, i) => { lane.laneIndex = i; });
  return {
    lanes,
    focusGraphX,
    head: hi,
    headHash: head.hash,
    headCommit: head,
    headMainlineV,
    contentHeight: hw.CONFIG.RULER_HEIGHT + Math.max(lanes.length, 1) * hw.CONFIG.LANE_HEIGHT
      + hw.CONFIG.MARGIN.top + hw.CONFIG.MARGIN.bottom,
  };
}

Object.assign(hw, {
  insertBranchLanes,
  assignLaneColors,
  laneIconColor,
  getAllFiles,
  getDirectChildren,
  filesUnderPrefix,
  getTopLevelItems,
  collectFlatFileLanes,
  folderDisplayLabel,
  sortExplorerChildren,
  getTopLevelItemsExplorer,
  collectExplorerTreeLanes,
  collectGroupedFileLanes,
  collectVisibleLanes,
  getLaneSourceFiles,
  isFlatLaneLayout,
  syncLaneLayoutButton,
  setLaneLayout,
  toggleLaneLayout,
  topGroupKey,
  laneMatchPath,
  fileMatchesLane,
  getVersionColumns,
  expandAncestorsForFiles,
  toggleExpand,
  getFilteredFiles,
  hashBit,
  pickHubLane,
  buildLaneCatalog,
});
