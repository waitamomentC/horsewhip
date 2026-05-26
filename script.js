/**
 * Horsewhip — file rail + graph stage · header toolbar
 */
(function () {
  'use strict';

  const CONFIG = {
    VERSION_SPACING: 26,
    VERSION_ORIGIN_X: 12,
    V1_VIEW_INSET: 26,
    RULER_HEIGHT: 24,
    MARGIN: { top: 7, right: 29, bottom: 17, left: 28 },
    LANE_HEIGHT: 31,
    FUTURE_COLUMNS: 120,
    RULER_PRESET: 100,
    RULER_EXPAND_THRESHOLD: 70,
    RULER_EXPAND_TO: 200,
    COMMIT_PAGE_SIZE: 100,
    COMMIT_PAGE_STEP: 100,
    COLUMN_VIEW_OVERSCAN: 4,
    ZOOM_MIN: 0.45,
    ZOOM_MAX: 2.2,
    ZOOM_STEP: 1.12,
    NODE_R: 5,
    NODE_HALO: 10,
    NODE_HUB_FOCUS: 9,
    NODE_HUB_STALE: 7,
  };

  const ROOT_BUCKET = '__root__';
  /** experiment/per-folder-version: each folder swimlane has its own V1, V2… */
  const PER_LANE_VERSION = true;
  const LANE_LAYOUT_KEY = 'hw-lane-layout';
  const WHIP_SOUND_MUTE_KEY = 'horsewhip:whip-sound-muted';
  /** Drop your file at media/whip-crack.mp3 (or .wav / .ogg); see media/README.md */
  const WHIP_CRACK_AUDIO_DEFAULT = 'media/whip-crack.mp3';
  const LANE_LAYOUT_GROUPED = 'grouped';
  const LANE_LAYOUT_FLAT = 'flat';
  const LANE_HUES = [210, 160, 280, 35, 350, 120, 45, 300, 190, 15, 250, 80];
  const CODE_FILE_RE = /\.(tsx?|jsx?|mjs|cjs|vue|svelte|py|go|rs|java|kt|kts|swift|c|cc|cpp|cxx|h|hh|hpp|cs|rb|php|scala|css|scss|less|sass|html?|sh|bash|zsh|sql|r|lua|dart|elm)$/i;
  const CONFIG_FILE_RE = /\.(json|jsonc|yaml|yml|toml|ini|cfg|conf|xml|plist|properties|lock|npmrc|editorconfig|env)$/i;
  const CONFIG_BASENAMES = /^(package-lock\.json|package\.json|tsconfig\.json|jsconfig\.json|\.env(\..+)?|\.gitignore|\.prettierrc|\.eslintrc|docker-compose\.ya?ml)$/i;
  const ICON_SIZE = 5;
  const VERSION_STEP_ICON_SCALE = 0.5;
  const ICON_HIT_PAD = 4;

  const state = {
    parsed: null,
    panX: null,
    fileFilter: '',
    scrollTop: 0,
    expandedPaths: new Set(),
    /** Multi-select: graph node ids (hash:lanePath). */
    selectedNodeIds: new Set(),
    selectedLink: null,
    pulseNodeId: null,
    nodeIndex: {},
    focusGraphX: null,
    modalNode: null,
    animateNext: true,
    laneLayout: LANE_LAYOUT_GROUPED,
    renderGeneration: 0,
    catalog: null,
    laneSliceCache: null,
    rawLogText: null,
    commitLoadLimit: CONFIG.COMMIT_PAGE_SIZE,
    totalCommitsInLog: 0,
    graphZoom: 1,
    visibleColumnWindow: null,
    /** Plugin: workspace rel paths (explorer tree); web: null */
    workspaceFiles: isPluginHost() ? [] : null,
    pluginDemoAllFiles: false,
    /** Derived from selectedNodeIds — unique file paths for constraint prompt. */
    boundaryFiles: new Set(),
    /** Last toggled-on node id — selection ripple anchor. */
    lastSelectedNodeId: null,
    /** File rail click: lane currently in view focus. */
    focusedFilePath: null,
    viewportAnimGeneration: 0,
    whipSoundMuted: false,
  };

  let whipAudioContext = null;
  let whipCrackBuffer = null;
  let whipCrackLoadPromise = null;
  let whipCrackUseSynth = false;

  const LANE_VIEW_OVERSCAN = 4;

  let svgLayout = null;
  let scrollSync = false;
  let graphRenderCtx = null;
  let viewportSyncQueued = false;
  let svgRoot;
  let gMain;
  let gScroll;

  const $ = (sel) => document.querySelector(sel);

  function isPluginHost() {
    return document.body.classList.contains('hw-plugin');
  }

  const els = {
    logInput: $('#log-input'),
    pasteDrop: $('#paste-drop'),
    btnPasteToggle: $('#btn-paste-toggle'),
    btnGenerate: $('#btn-generate'),
    btnDemo: $('#btn-demo'),
    btnMegaDemo: $('#btn-mega-demo'),
    btnClear: $('#btn-clear'),
    cmdChip: $('#cmd-chip'),
    stats: $('#stats'),
    statCommits: $('#stat-commits'),
    statFiles: $('#stat-files'),
    fileFilter: $('#file-filter'),
    btnLaneLayout: $('#btn-lane-layout'),
    fileRail: $('#file-rail'),
    fileRailInner: $('#file-rail-inner'),
    graphViewport: $('#graph-viewport'),
    graphScroll: $('#graph-scroll'),
    graphEmpty: $('#graph-empty'),
    graphHint: $('#graph-hint'),
    graphSvg: $('#graph-svg'),
    parseError: $('#parse-error'),
    largeWarn: $('#large-data-warn'),
    largeWarnText: $('#large-warn-text'),
    btnLoadMoreCommits: $('#btn-load-more-commits'),
    btnZoomIn: $('#btn-zoom-in'),
    btnZoomOut: $('#btn-zoom-out'),
    btnWhipSound: $('#btn-whip-sound'),
    graphZoom: $('#graph-zoom'),
    zoomLabel: $('#zoom-label'),
    linkPanel: $('#link-panel'),
    linkConstraintText: $('#link-constraint-text'),
    btnCopyLink: $('#btn-copy-link'),
    modalBackdrop: $('#modal-backdrop'),
    modalTitle: $('#modal-title'),
    modalMeta: $('#modal-meta'),
    modalFile: $('#modal-file'),
    modalConstraint: $('#modal-constraint'),
    modalCmdFile: $('#modal-cmd-file'),
    modalCmdReset: $('#modal-cmd-reset'),
    modalClose: $('#modal-close'),
    btnCopyConstraint: $('#btn-copy-constraint'),
    btnCopyCheckout: $('#btn-copy-checkout'),
    btnToggleReset: $('#btn-toggle-reset'),
    rollbackDanger: $('#rollback-danger'),
    resetConfirm: $('#reset-confirm'),
    btnCopyReset: $('#btn-copy-reset'),
    tooltip: $('#tooltip'),
    boundaryBar: $('#hw-boundary'),
    boundaryCount: $('#hw-boundary-count'),
    boundaryFiles: $('#hw-boundary-files'),
    boundaryPreview: $('#hw-boundary-preview'),
    btnBoundaryClear: $('#btn-boundary-clear'),
    btnBoundaryCopy: $('#btn-boundary-copy'),
    btnBoundaryChat: $('#btn-boundary-chat'),
  };

  function isCommitHeaderLine(line) {
    const t = line.trim();
    return /^[0-9a-f]{7,40}\|/i.test(t);
  }

  /** Keep newest N commits from log text (file order = newest first). */
  function sliceLogByCommitLimit(text, maxCommits) {
    const lines = text.split('\n');
    const blocks = [];
    let block = null;
    for (const line of lines) {
      if (isCommitHeaderLine(line)) {
        if (block) blocks.push(block);
        block = [line];
      } else if (block) {
        block.push(line);
      }
    }
    if (block) blocks.push(block);
    const total = blocks.length;
    const limit = Math.max(1, maxCommits || total);
    const kept = blocks.slice(0, Math.min(limit, total));
    return {
      text: kept.map((b) => b.join('\n')).join('\n\n'),
      totalCommits: total,
      loaded: kept.length,
    };
  }

  function parseGitLog(text) {
    const commits = [];
    let current = null;

    for (const rawLine of text.split('\n')) {
      const line = rawLine.trim();
      if (!line) continue;

      const m6 = line.match(/^([0-9a-f]{7,40})\|([^|]*)\|([^|]*)\|([^|]+)\|([^|]+)\|(.+)$/i);
      const m5 = line.match(/^([0-9a-f]{7,40})\|([^|]*)\|([^|]*)\|(.+?)\|(.+)$/i);
      const m4p = line.match(/^([0-9a-f]{7,40})\|([^|]*)\|(.+?)\|(.+)$/i);
      const m3 = line.match(/^([0-9a-f]{7,40})\|(.+?)\|(.+)$/i);

      if (m6) {
        if (current) commits.push(current);
        const parents = m6[2].trim() && m6[2].trim() !== '-' ? m6[2].trim().split(/\s+/) : [];
        const refs = parseRefs(m6[3]);
        current = {
          hash: m6[1],
          parents,
          refs,
          author: m6[4],
          date: m6[5],
          subject: m6[6].trim(),
          files: [],
        };
      } else if (m5) {
        if (current) commits.push(current);
        const parents = m5[2].trim() && m5[2].trim() !== '-' ? m5[2].trim().split(/\s+/) : [];
        const refs = parseRefs(m5[3]);
        current = {
          hash: m5[1],
          parents,
          refs,
          author: m5[4],
          date: m5[5],
          files: [],
        };
      } else if (m4p) {
        if (current) commits.push(current);
        const parents = m4p[2].trim() && m4p[2].trim() !== '-' ? m4p[2].trim().split(/\s+/) : [];
        current = {
          hash: m4p[1],
          parents,
          refs: [],
          author: m4p[3],
          date: m4p[4],
          files: [],
        };
      } else if (m3) {
        if (current) commits.push(current);
        current = { hash: m3[1], parents: [], refs: [], author: m3[2], date: m3[3], files: [] };
      } else if (current) {
        current.files.push(line);
      }
    }
    if (current) commits.push(current);
    if (commits.length === 0) {
      throw new Error('无法解析 log。请使用 git log --all --name-only --pretty=format:"%H|%P|%D|%an|%ad|%s"');
    }

    commits.reverse();
    const commitMap = buildCommitMap(commits);
    const dag = analyzeDAG(commits, commitMap);

    commits.forEach((c, i) => {
      c.versionIndex = i + 1;
      c.globalIndex = i;
      c.files = [...new Set(c.files)].sort();
      c.isMainline = dag.mainlineSet.has(c.hash);
      c.graphX = dag.graphX[c.hash] ?? i;
    });

    let mainlineVersionIndex = 0;
    commits.forEach((c) => {
      if (c.isMainline) {
        mainlineVersionIndex += 1;
        c.mainlineVersionIndex = mainlineVersionIndex;
      }
    });

    assignDisplayColumns(commits);

    const fileTimelines = {};
    for (const c of commits) {
      for (const f of c.files) {
        if (!fileTimelines[f]) fileTimelines[f] = [];
        fileTimelines[f].push({
          commitHash: c.hash,
          date: c.date,
          versionIndex: c.versionIndex,
          graphX: c.graphX,
          displayColumn: c.displayColumn,
        });
      }
    }

    return {
      commits,
      fileTimelines,
      commitMap,
      mainlineSet: dag.mainlineSet,
      trunkLaneCommitSet: dag.trunkLaneCommitSet,
      branchSegments: dag.branchSegments,
      headHash: dag.headHash,
      totalCommitsInLog: commits.length,
      loadedCommitCount: commits.length,
    };
  }

  function parseRefs(raw) {
    if (!raw || !raw.trim()) return [];
    return raw.split(',').map((s) => s.trim().replace(/^\(|\)$/g, ''))
      .map((s) => s.replace(/^HEAD -> /, ''))
      .filter(Boolean);
  }

  function buildCommitMap(commits) {
    const map = {};
    commits.forEach((c) => { map[c.hash] = c; });
    const resolve = (token) => {
      if (map[token]) return token;
      const hits = Object.keys(map).filter((h) => h.startsWith(token));
      return hits.length === 1 ? hits[0] : token;
    };
    commits.forEach((c) => {
      c.parents = c.parents.map(resolve).filter((p) => map[p]);
    });
    return map;
  }

  function hasBranchRef(commit) {
    if (!commit?.refs?.length) return false;
    return commit.refs.some((r) => /(^|\/)feature\//.test(r) || /^origin\//.test(r));
  }

  /** Walk first-parent from tip until trunk; fork = last trunk commit before branch-only chain. */
  function collectBranchChainToFork(tipHash, commitMap, trunkSet) {
    const chain = [];
    let cur = commitMap[tipHash];
    while (cur) {
      chain.unshift(cur);
      const p = cur.parents?.[0];
      if (!p) break;
      if (trunkSet.has(p)) return { chain, forkHash: p };
      const parent = commitMap[p];
      if (!parent) break;
      cur = parent;
    }
    return { chain: [], forkHash: null };
  }

  function buildTrunkLaneCommitSet(headHash, branchSegments, commitMap) {
    const interior = new Set();
    branchSegments.forEach((seg) => {
      seg.commits.forEach((c) => {
        if (c.hash !== seg.forkHash) interior.add(c.hash);
      });
    });
    const trunk = new Set();
    let cur = headHash;
    const seen = new Set();
    while (cur && commitMap[cur] && !seen.has(cur)) {
      seen.add(cur);
      if (!interior.has(cur)) trunk.add(cur);
      cur = commitMap[cur].parents[0];
    }
    return trunk;
  }

  function analyzeDAG(commits, commitMap) {
    const headHash = commits[commits.length - 1].hash;
    const hasParents = commits.some((c) => c.parents.length > 0);
    const graphX = {};

    if (!hasParents) {
      commits.forEach((c, i) => { graphX[c.hash] = i; });
      const mainlineSet = new Set(commits.map((c) => c.hash));
      return {
        mainlineSet,
        mainlineOrder: commits.map((c) => c.hash),
        trunkLaneCommitSet: mainlineSet,
        branchSegments: [],
        graphX,
        headHash,
      };
    }

    const mainlineSet = new Set();
    const mainlineOrder = [];
    let cur = headHash;
    while (cur && commitMap[cur]) {
      mainlineSet.add(cur);
      mainlineOrder.unshift(cur);
      cur = commitMap[cur].parents[0];
    }

    function gen(hash) {
      if (graphX[hash] !== undefined) return graphX[hash];
      const c = commitMap[hash];
      if (!c || !c.parents.length) { graphX[hash] = 0; return 0; }
      const g = Math.max(...c.parents.map(gen)) + 1;
      graphX[hash] = g;
      return g;
    }
    commits.forEach((c) => gen(c.hash));

    const branchSegments = [];
    const claimedBranch = new Set();

    commits.forEach((c) => {
      if (c.parents.length < 2) return;
      const branchTip = c.parents[1];
      const chain = collectBranchCommits(branchTip, mainlineSet, commitMap);
      if (!chain.length) return;
      const forkHash = collectBranchChainToFork(branchTip, commitMap, mainlineSet).forkHash
        || chain[0].parents[0];
      if (!forkHash) return;
      const name = extractBranchName(chain) || `branch-${branchSegments.length + 1}`;
      const commitSet = new Set(chain.map((x) => x.hash));
      chain.forEach((x) => claimedBranch.add(x.hash));
      branchSegments.push({
        id: name,
        name,
        forkHash,
        mergeHash: c.hash,
        merged: true,
        continued: false,
        commits: chain,
        commitSet,
        forkGraphX: graphX[forkHash],
        mergeGraphX: graphX[c.hash],
      });
    });

    const mergedForks = new Set(branchSegments.map((s) => s.forkHash));
    const headTip = commitMap[headHash];
    [...commits].reverse().forEach((c) => {
      if (!hasBranchRef(c)) return;
      if (claimedBranch.has(c.hash)) return;
      const { chain, forkHash } = collectBranchChainToFork(c.hash, commitMap, mainlineSet);
      if (!chain.length || !forkHash || mergedForks.has(forkHash)) return;
      if (chain.some((x) => claimedBranch.has(x.hash))) return;
      const name = extractBranchName(chain) || `branch-${branchSegments.length + 1}`;
      const commitSet = new Set(chain.map((x) => x.hash));
      chain.forEach((x) => claimedBranch.add(x.hash));
      const continued = chain.some((x) => hasBranchRef(x)) && headTip && !hasBranchRef(headTip);
      branchSegments.push({
        id: name,
        name,
        forkHash,
        mergeHash: null,
        merged: false,
        continued,
        commits: chain,
        commitSet,
        forkGraphX: graphX[forkHash],
        mergeGraphX: null,
      });
      mergedForks.add(forkHash);
    });

    const trunkLaneCommitSet = buildTrunkLaneCommitSet(headHash, branchSegments, commitMap);

    return { mainlineSet, mainlineOrder, trunkLaneCommitSet, branchSegments, graphX, headHash };
  }

  /** One integer column per commit (upload); branch commits use same V scale, no fractional slots. */
  function assignDisplayColumns(commits) {
    commits.forEach((c) => {
      c.displayColumn = c.versionIndex;
    });
  }

  function columnsMatch(a, b) {
    return Math.abs(a - b) < 0.001;
  }

  /** Global commit column on the timeline ruler (upload order). */
  function formatGlobalCommitColumn(column) {
    if (column == null || Number.isNaN(column)) return 'C?';
    return `C${Math.round(Number(column))}`;
  }

  /** Per-folder swimlane version (only bumps when that lane is touched). */
  function formatLaneVersion(laneV) {
    if (laneV == null || Number.isNaN(laneV)) return 'V?';
    return `V${Math.round(Number(laneV))}`;
  }

  /** @deprecated alias — global commit column */
  function formatDisplayVersion(column) {
    return PER_LANE_VERSION ? formatGlobalCommitColumn(column) : formatLaneVersion(column);
  }

  function formatNodeVersion(node) {
    if (PER_LANE_VERSION && node?.laneVersion != null) return formatLaneVersion(node.laneVersion);
    return formatDisplayVersion(node?.displayColumn ?? node?.graphX);
  }

  function nodeVersionTooltipLine(node) {
    const col = node?.displayColumn ?? node?.graphX;
    if (!PER_LANE_VERSION) return formatNodeVersion(node);
    const global = formatGlobalCommitColumn(col);
    const local = node?.laneVersion != null ? formatLaneVersion(node.laneVersion) : null;
    return local ? `${local} · 上传 ${global}` : global;
  }

  function assignPerLaneVersions(parsed, allFiles) {
    if (!PER_LANE_VERSION) return;
    const baseLanes = collectVisibleLanes(allFiles).filter((l) => !l.isHeader);
    const counters = new Map();
    const branchPaths = [];

    baseLanes.forEach((lane) => counters.set(lane.path, 0));
    (parsed.branchSegments || []).forEach((seg) => {
      baseLanes.forEach((lane) => {
        if (!segmentTouchesLane(seg, lane)) return;
        const bp = `${lane.path}#⎇${seg.id}`;
        counters.set(bp, 0);
        branchPaths.push({ path: bp, seg, parent: lane });
      });
    });

    parsed.commits.forEach((commit) => {
      commit.laneVersions = {};
      baseLanes.forEach((lane) => {
        const matched = commit.files.filter((f) => fileMatchesLane(f, lane));
        if (!matched.length) return;
        const next = (counters.get(lane.path) || 0) + 1;
        counters.set(lane.path, next);
        commit.laneVersions[lane.path] = next;
      });
      branchPaths.forEach(({ path, seg, parent }) => {
        if (!seg.commitSet.has(commit.hash)) return;
        if (!commit.files.some((f) => fileMatchesLane(f, parent))) return;
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
    if (PER_LANE_VERSION && forkCommit.laneVersions?.[lane.path] != null) {
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

  function versionLabelWithSubject(parsed, columnV, maxSubject = 14) {
    const base = PER_LANE_VERSION ? formatGlobalCommitColumn(columnV) : formatDisplayVersion(columnV);
    const headV = headMainlineVersion(parsed) || 0;
    if (!parsed || columnV > headV) return base;
    const subj = truncateSubject(commitAtMainlineVersion(parsed, columnV)?.subject, maxSubject);
    return subj ? `${base} · ${subj}` : base;
  }

  function commitSubjectForNode(node) {
    const fromNode = node?.subject?.trim();
    if (fromNode) return fromNode;
    const c = state.parsed?.commitMap?.[node?.hash];
    return c?.subject?.trim() || '';
  }

  function rulerExtent(parsed) {
    const headV = headMainlineVersion(parsed) || 0;
    let extent = CONFIG.RULER_PRESET;
    if (headV >= CONFIG.RULER_EXPAND_THRESHOLD) extent = CONFIG.RULER_EXPAND_TO;
    return Math.max(extent, headV + 1);
  }

  function collectBranchCommits(branchTip, mainlineSet, commitMap) {
    const chain = [];
    let cur = branchTip;
    const seen = new Set();
    while (cur && !seen.has(cur) && !mainlineSet.has(cur)) {
      seen.add(cur);
      const c = commitMap[cur];
      if (!c) break;
      chain.push(c);
      cur = c.parents[0];
    }
    return chain.reverse();
  }

  function extractBranchName(commits) {
    for (const c of commits) {
      for (const r of c.refs) {
        if (r.includes('feature/') || r.includes('/')) return r.replace(/^origin\//, '');
      }
    }
    return null;
  }

  function segmentTouchesLane(seg, lane) {
    if (lane.isHeader || lane.isBranchLane) return false;
    return seg.commits.some((c) => c.files.some((f) => fileMatchesLane(f, lane)));
  }

  function insertBranchLanes(baseLanes, branchSegments) {
    const out = [];
    for (const lane of baseLanes) {
      out.push(lane);
      if (lane.isHeader) continue;
      branchSegments.filter((seg) => segmentTouchesLane(seg, lane)).forEach((seg) => {
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
        hueByPath.set(lane.path, LANE_HUES[hueIdx % LANE_HUES.length]);
        hueIdx += 1;
      }
    });

    return lanes.map((lane) => {
      const branch = !!lane.isBranchLane;
      const d = (lane.depth || 0) + (branch ? 1 : 0);
      let h;
      if (branch) {
        h = hueByPath.get(lane.parentLanePath) ?? LANE_HUES[0];
      } else if (lane.isHeader) {
        h = hueByPath.get(lane.path) ?? LANE_HUES[0];
      } else {
        h = hueByPath.get(lane.path) ?? LANE_HUES[hueIdx % LANE_HUES.length];
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

  /** Pulse target: selected column if user picked non-HEAD, else current HEAD. */
  function pulseColumn(parsed) {
    const headCol = headMainlineVersion(parsed) || headColumn(parsed);
    if (state.focusGraphX != null && !columnsMatch(state.focusGraphX, headCol)) {
      return state.focusGraphX;
    }
    return headCol;
  }

  function rippleTargetNodeId() {
    const lastId = state.lastSelectedNodeId;
    if (lastId && state.selectedNodeIds.has(lastId)) return lastId;
    return state.pulseNodeId || null;
  }

  function nodeShowsRipples(node) {
    const id = node?.id;
    const target = rippleTargetNodeId();
    return !!(id && target && id === target);
  }

  function nodeIsPulsing(node) {
    return nodeShowsRipples(node);
  }

  function syncNodeRippleVisuals() {
    if (!gScroll) return;
    gScroll.selectAll('.node-group').each(function () {
      const sel = d3.select(this);
      const d = sel.datum();
      if (!d) return;
      const show = nodeShowsRipples(d);
      d.isPulse = show;
      sel.classed('node-group--pulse', show);
      sel.selectAll('.node-ripples').remove();
      if (show && d.lane?.color) appendNodeRipples(sel, d.lane.color);
    });
  }

  function pickDefaultPulseNode(nodes, parsed) {
    const headCol = headMainlineVersion(parsed) || 1;
    const trunk = parsed.trunkLaneCommitSet || parsed.mainlineSet;
    const pulseEligible = (n) => nodeCanShowTooltip(n) && !isBranchGraphAnchor(n);
    const atHead = nodes.filter((n) => pulseEligible(n) && columnsMatch(n.displayColumn, headCol));
    if (atHead.length) {
      const onBranch = atHead.find((n) => !trunk.has(n.hash));
      const onTrunk = atHead.find((n) => trunk.has(n.hash));
      return (onBranch || onTrunk || atHead[0]).id;
    }
    const branchTip = nodes.find((n) => pulseEligible(n) && n.lane?.isBranchLane);
    if (branchTip) return branchTip.id;
    return nodes.find((n) => pulseEligible(n))?.id ?? null;
  }

  function setPulseNode(nodeId) {
    state.pulseNodeId = nodeId || null;
    syncNodeRippleVisuals();
  }

  function updateGraphFocus() {
    const parsed = state.parsed;
    if (!parsed || !gScroll) return;
    const focusGraphX = state.focusGraphX ?? resolveFocusGraphX(parsed);
    gScroll.selectAll('.node-group').each(function () {
      const sel = d3.select(this);
      const d = sel.datum();
      if (!d) return;
      const isFocus = columnsMatch(d.displayColumn, focusGraphX);
      d.isFocus = isFocus;
      sel.classed('node-group--focus', isFocus);
      sel.classed('node-group--stale', !isFocus && !d.isFolderAggregate);
    });
    setPulseNode(state.pulseNodeId);
  }

  function appendNodeRipples(g, color) {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const ripG = g.insert('g', ':first-child').attr('class', 'node-ripples');
    [0, 1, 2].forEach((i) => {
      ripG.append('circle')
        .attr('class', `node-ripple node-ripple--d${i}`)
        .attr('r', ICON_SIZE + 1)
        .attr('fill', 'none')
        .attr('stroke', color)
        .attr('stroke-width', 1.75);
    });
  }

  function appendRulerRipples(g, cx, cy) {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const ripG = g.append('g')
      .attr('class', 'version-ruler__pulse')
      .attr('transform', `translate(${cx},${cy})`);
    [0, 1, 2].forEach((i) => {
      ripG.append('circle')
        .attr('class', `version-ruler__pulse-ring version-ruler__pulse-ring--d${i}`)
        .attr('r', 2.2)
        .attr('fill', 'none')
        .attr('stroke', 'var(--accent)')
        .attr('stroke-width', 1.5);
    });
  }

  function fileIconKindFromPath(path) {
    const base = (path.split('/').pop() || path).toLowerCase();
    if (CONFIG_FILE_RE.test(base) || CONFIG_BASENAMES.test(base)) return 'config';
    if (CODE_FILE_RE.test(path)) return 'code';
    return 'other';
  }

  function laneIconKind(lane) {
    if (lane.collapsed || lane.isHeader || lane.type === 'folder') return 'folder';
    return fileIconKindFromPath(lane.path);
  }

  function isBranchGraphAnchor(node) {
    return !!(node?.isForkAnchor || node?.isMergeAnchor);
  }

  function isVersionStepNode(node) {
    return !!node?.isVersionStep;
  }

  function versionStepIconSize() {
    return ICON_SIZE * VERSION_STEP_ICON_SCALE;
  }

  function nodeOnLaneAtColumn(nodes, lanePath, columnV) {
    return nodes.some((n) => !isBranchGraphAnchor(n) && !isVersionStepNode(n) && n.lanePath === lanePath
      && columnsMatch(n.displayColumn ?? n.graphX, columnV));
  }

  /** Tooltip on file nodes and folder aggregate nodes. */
  function nodeCanShowTooltip(node) {
    if (!node || isVersionStepNode(node)) return false;
    if (node.isFolderAggregate) return true;
    if (node.isForkAnchor || node.isMergeAnchor) return true;
    const lane = node.lane;
    if (!lane || lane.isHeader) return false;
    if (lane.collapsed && !node.isFolderAggregate) return false;
    if (lane.type === 'folder' && !node.isFolderAggregate) return false;
    const path = node.filePath || node.files?.[0] || lane.path;
    return Boolean(path && !String(path).endsWith('/'));
  }

  function nodeIconKind(node) {
    if (node.isFolderAggregate) return 'folder';
    if (node.lane && laneIconKind(node.lane) === 'folder') return 'folder';
    const fp = node.filePath || node.files?.[0] || node.lane?.path || '';
    return fileIconKindFromPath(fp);
  }

  function equilateralTrianglePath(side) {
    const h = (Math.sqrt(3) / 2) * side;
    return `M0,${(-2 * h) / 3} L${-side / 2},${h / 3} L${side / 2},${h / 3} Z`;
  }

  function regularHexagonPath(radius) {
    const pts = Array.from({ length: 6 }, (_, i) => {
      const a = (Math.PI / 3) * i - Math.PI / 2;
      return [radius * Math.cos(a), radius * Math.sin(a)];
    });
    return `M${pts.map(([x, y]) => `${x},${y}`).join(' L ')} Z`;
  }

  function folderRoundedRectRadius(width, height) {
    return Math.min(width, height) * 0.24;
  }

  function appendSvgFolderRect(g, className, size, color) {
    const side = size * 2;
    const radius = folderRoundedRectRadius(side, side);
    return g.append('rect')
      .attr('class', className)
      .attr('x', -size)
      .attr('y', -size)
      .attr('width', side)
      .attr('height', side)
      .attr('rx', radius)
      .attr('ry', radius)
      .attr('fill', color);
  }

  function appendSvgLaneIcon(g, kind, color, size) {
    const side = size * 2;
    if (kind === 'folder') {
      appendSvgFolderRect(g, 'node-icon node-icon--folder', size, color);
      return;
    }
    if (kind === 'code') {
      g.append('circle')
        .attr('class', 'node-icon node-icon--code')
        .attr('r', size)
        .attr('fill', color);
      return;
    }
    if (kind === 'config') {
      g.append('path')
        .attr('class', 'node-icon node-icon--config')
        .attr('d', regularHexagonPath(size))
        .attr('fill', color);
      return;
    }
    g.append('path')
      .attr('class', 'node-icon node-icon--other')
      .attr('d', equilateralTrianglePath(side))
      .attr('fill', color);
  }

  function createRailIcon(lane) {
    const kind = laneIconKind(lane);
    const color = lane.color;
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('class', 'file-rail__icon');
    svg.setAttribute('width', '7');
    svg.setAttribute('height', '7');
    svg.setAttribute('viewBox', '-4 -4 8 8');
    svg.setAttribute('aria-hidden', 'true');

    if (kind === 'folder') {
      const side = 5.4;
      const r = folderRoundedRectRadius(side, side);
      const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
      rect.setAttribute('x', String(-side / 2));
      rect.setAttribute('y', String(-side / 2));
      rect.setAttribute('width', String(side));
      rect.setAttribute('height', String(side));
      rect.setAttribute('rx', String(r));
      rect.setAttribute('ry', String(r));
      rect.setAttribute('fill', color);
      svg.appendChild(rect);
    } else if (kind === 'code') {
      const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
      circle.setAttribute('r', '2.6');
      circle.setAttribute('fill', color);
      svg.appendChild(circle);
    } else if (kind === 'config') {
      const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      path.setAttribute('d', regularHexagonPath(2.8));
      path.setAttribute('fill', color);
      svg.appendChild(path);
    } else {
      const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      path.setAttribute('d', equilateralTrianglePath(5.2));
      path.setAttribute('fill', color);
      svg.appendChild(path);
    }
    return svg;
  }

  function segmentsForLane(lane, parsed) {
    return (parsed.branchSegments || []).filter((seg) => segmentTouchesLane(seg, lane));
  }

  /** Last trunk upload on this lane before branch commits touch the same lane. */
  function laneForkV(lane, seg, parsed) {
    const trunk = parsed.trunkLaneCommitSet || parsed.mainlineSet;
    const branchOnLane = seg.commits.filter((c) =>
      c.files.some((f) => fileMatchesLane(f, lane)));
    if (!branchOnLane.length) {
      return parsed.commitMap[seg.forkHash]?.versionIndex ?? 1;
    }
    const firstBranchV = Math.min(...branchOnLane.map((c) => c.versionIndex));
    let lastTrunkV = 1;
    parsed.commits.forEach((c) => {
      if (!trunk.has(c.hash)) return;
      if (!c.files.some((f) => fileMatchesLane(f, lane))) return;
      if (c.versionIndex < firstBranchV) lastTrunkV = Math.max(lastTrunkV, c.versionIndex);
    });
    return lastTrunkV;
  }

  function laneSegmentBounds(lane, seg, parsed) {
    const forkV = laneForkV(lane, seg, parsed);
    const mergeV = seg.merged && seg.mergeHash
      ? (parsed.commitMap[seg.mergeHash]?.versionIndex ?? null)
      : null;
    return { forkV, mergeV };
  }

  /** Parent lane must not show commits that only live on the branch gap for this file. */
  function commitBlockedOnParentLane(commit, lane, parsed) {
    const v = commit.versionIndex;
    for (const seg of segmentsForLane(lane, parsed)) {
      const { forkV, mergeV } = laneSegmentBounds(lane, seg, parsed);
      if (!forkV || v <= forkV) continue;
      if (!seg.merged) return true;
      if (mergeV && v > forkV && v < mergeV) return true;
    }
    return false;
  }

  function parentLaneTrackHoles(lane, parsed) {
    const headV = headMainlineVersion(parsed);
    const holes = [];
    segmentsForLane(lane, parsed).forEach((seg) => {
      const { forkV, mergeV } = laneSegmentBounds(lane, seg, parsed);
      if (!forkV) return;
      if (!seg.merged) {
        if (forkV < headV) holes.push({ from: forkV + 1, to: headV });
        return;
      }
      if (mergeV && mergeV > forkV + 1) holes.push({ from: forkV + 1, to: mergeV - 1 });
    });
    return holes;
  }

  function trackRangesFromHoles(vStart, vEnd, holes) {
    const sorted = holes
      .filter((h) => h.to >= h.from)
      .sort((a, b) => a.from - b.from);
    const ranges = [];
    let cur = vStart;
    sorted.forEach((h) => {
      if (cur < h.from) ranges.push({ vStart: cur, vEnd: h.from - 1 });
      cur = Math.max(cur, h.to + 1);
    });
    if (cur <= vEnd) ranges.push({ vStart: cur, vEnd });
    return ranges.length ? ranges : [{ vStart, vEnd }];
  }

  function parentLaneTrackRanges(lane, parsed) {
    const headV = headMainlineVersion(parsed);
    const holes = parentLaneTrackHoles(lane, parsed);
    if (!holes.length) return [{ vStart: 1, vEnd: Math.max(1, headV) }];
    return trackRangesFromHoles(1, headV, holes);
  }

  function branchLaneTrackRange(lane, parsed, bundlesOnLane) {
    const headV = headMainlineVersion(parsed);
    if (bundlesOnLane?.length) {
      const cols = bundlesOnLane.map((b) => b.displayColumn ?? b.commit.displayColumn);
      return { vStart: Math.min(...cols), vEnd: Math.max(headV, ...cols) };
    }
    const first = lane.branchSegment?.commits?.[0]?.versionIndex;
    return { vStart: first ?? 1, vEnd: headV };
  }

  function laneStepSkipColumns(lane, parsed, bundlesOnLane) {
    const skip = new Set();
    if (lane.isBranchLane) {
      const { vStart } = branchLaneTrackRange(lane, parsed, bundlesOnLane);
      const seg = lane.branchSegment;
      const parentLane = { path: lane.parentLanePath };
      const forkV = seg ? laneForkV(parentLane, seg, parsed) : null;
      if (forkV != null) {
        for (let v = forkV; v < vStart; v += 1) skip.add(v);
      }
      return skip;
    }
    parentLaneTrackHoles(lane, parsed).forEach((h) => {
      for (let v = h.from; v <= h.to; v += 1) skip.add(v);
    });
    return skip;
  }

  function commitAppliesToLane(commit, lane, parsed) {
    if (lane.isHeader) return false;
    const matched = commit.files.filter((f) => fileMatchesLane(f, lane));
    if (!matched.length) return false;
    if (lane.isBranchLane) return lane.branchSegment.commitSet.has(commit.hash);
    const trunk = parsed.trunkLaneCommitSet || parsed.mainlineSet;
    if (!trunk.has(commit.hash)) return false;
    if (commitBlockedOnParentLane(commit, lane, parsed)) return false;
    return true;
  }

  function getAllFiles(parsed) {
    return Object.keys(parsed.fileTimelines).sort();
  }

  function getDirectChildren(folderPath, allFiles, rootFiles) {
    if (folderPath === ROOT_BUCKET) {
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
    if (prefix === ROOT_BUCKET) return rootFiles || allFiles.filter((f) => !f.includes('/'));
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
      items.push({ type: 'folder', path: ROOT_BUCKET, depth: 0, rootFiles: [...rootFiles] });
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
    if (folderPath === ROOT_BUCKET) return '(root)';
    const parts = folderPath.split('/').filter(Boolean);
    return `${parts[parts.length - 1]}/`;
  }

  /** VS Code Explorer order: subfolders first, then files, each A→Z. */
  function sortExplorerChildren(children) {
    const folders = children.filter((c) => c.type === 'folder').sort((a, b) => a.path.localeCompare(b.path));
    const files = children.filter((c) => c.type === 'file').sort((a, b) => a.path.localeCompare(b.path));
    return [...folders, ...files];
  }

  /** Root: top-level folders first, then root files (no __root__ bucket). */
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

  /** Plugin / Explorer-aligned tree lanes (folders + files, correct depth & order). */
  function collectExplorerTreeLanes(allFiles) {
    const lanes = [];
    const expanded = state.expandedPaths;

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
      const isRoot = folderPath === ROOT_BUCKET;
      const rootFiles = item.rootFiles;
      const label = isRoot ? '(root)' : folderDisplayLabel(folderPath);
      const desc = filesUnderPrefix(folderPath, allFiles, rootFiles);
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

      sortExplorerChildren(getDirectChildren(folderPath, allFiles, rootFiles))
        .forEach((child) => walk(child, depth + 1));
    }

    getTopLevelItemsExplorer(allFiles).forEach((item) => walk(item, 0));
    return lanes;
  }

  function collectGroupedFileLanes(allFiles) {
    const lanes = [];
    const expanded = state.expandedPaths;

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
      const isRoot = folderPath === ROOT_BUCKET;
      const rootFiles = item.rootFiles;

      if (!expanded.has(folderPath)) {
        const desc = filesUnderPrefix(folderPath, allFiles, rootFiles);
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
      getDirectChildren(folderPath, allFiles, rootFiles).forEach((child, idx) => {
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

    getTopLevelItems(allFiles).forEach((item) => walk(item, 0));
    return lanes;
  }

  function collectVisibleLanes(allFiles) {
    if (isPluginHost()) return collectExplorerTreeLanes(allFiles);
    if (state.laneLayout === LANE_LAYOUT_FLAT) return collectFlatFileLanes(allFiles);
    return collectGroupedFileLanes(allFiles);
  }

  /** Plugin: 工作区目录 + git 历史并集；web: filter + tree/flat. */
  function getLaneSourceFiles(parsed) {
    const fromGit = getFilteredFiles(parsed);
    if (!isPluginHost()) return fromGit;
    if (state.pluginDemoAllFiles) return fromGit;
    const ws = state.workspaceFiles;
    if (!ws?.length) return fromGit;
    const merged = new Set(fromGit);
    ws.forEach((p) => merged.add(p));
    return [...merged].sort((a, b) => a.localeCompare(b));
  }

  function isFlatLaneLayout() {
    return state.laneLayout === LANE_LAYOUT_FLAT;
  }

  function syncLaneLayoutButton() {
    if (!els.btnLaneLayout) return;
    const flat = isFlatLaneLayout();
    els.btnLaneLayout.textContent = flat ? '文件' : '目录';
    els.btnLaneLayout.setAttribute(
      'title',
      flat
        ? '当前：扁平文件列表（点击切换为按目录分组）'
        : '当前：按目录分组（点击切换为扁平文件列表）',
    );
    els.btnLaneLayout.setAttribute('aria-pressed', flat ? 'true' : 'false');
    els.btnLaneLayout.classList.toggle('btn--solid', flat);
  }

  function setLaneLayout(layout) {
    const next = layout === LANE_LAYOUT_FLAT ? LANE_LAYOUT_FLAT : LANE_LAYOUT_GROUPED;
    if (state.laneLayout === next) return;
    state.laneLayout = next;
    try { localStorage.setItem(LANE_LAYOUT_KEY, next); } catch { /* ignore */ }
    syncLaneLayoutButton();
    if (state.parsed) scheduleRenderFromState();
  }

  function toggleLaneLayout() {
    setLaneLayout(isFlatLaneLayout() ? LANE_LAYOUT_GROUPED : LANE_LAYOUT_FLAT);
  }

  function topGroupKey(lane) {
    if (lane.path === ROOT_BUCKET) return ROOT_BUCKET;
    if (lane.type === 'file' && !lane.path.includes('/')) return lane.path;
    return `${lane.path.split('/')[0]}/`;
  }

  function laneMatchPath(lane) {
    if (lane.isBranchLane && lane.parentLanePath) return lane.parentLanePath;
    return lane.path;
  }

  function fileMatchesLane(file, lane) {
    if (lane.isHeader) return false;
    const path = laneMatchPath(lane);
    if (!path) return false;
    if (lane.type === 'file') return file === path;
    if (path === ROOT_BUCKET) return !file.includes('/');
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
        state.expandedPaths.add(ROOT_BUCKET);
        return;
      }
      const parts = f.split('/');
      for (let i = 1; i < parts.length; i++) {
        state.expandedPaths.add(`${parts.slice(0, i).join('/')}/`);
      }
    });
  }

  function toggleExpand(path, recursive) {
    if (!state.parsed) return;
    if (recursive) {
      state.expandedPaths.add(path);
      if (path !== ROOT_BUCKET) {
        const allFiles = getFilteredFiles(state.parsed, false);
        allFiles.filter((f) => f.startsWith(path)).forEach((f) => {
          if (!f.includes('/')) return;
          const rest = f.slice(path.length);
          const slash = rest.indexOf('/');
          if (slash > 0) state.expandedPaths.add(`${path}${rest.slice(0, slash + 1)}`);
        });
      }
    } else if (state.expandedPaths.has(path)) {
      state.expandedPaths.delete(path);
    } else {
      state.expandedPaths.add(path);
    }
    state.animateNext = false;
    renderFromState();
  }

  function getFilteredFiles(parsed, autoExpand) {
    const q = state.fileFilter.trim().toLowerCase();
    let files = getAllFiles(parsed);
    if (q) {
      files = files.filter((f) => f.toLowerCase().includes(q));
      if (autoExpand !== false) expandAncestorsForFiles(files);
    }
    return files;
  }

  function headIndex(parsed) {
    return headColumn(parsed);
  }

  function headColumn(parsed) {
    const head = headCommit(parsed);
    return head.versionIndex ?? head.displayColumn ?? 1;
  }

  function headCommit(parsed) {
    return parsed.commits.find((c) => c.hash === parsed.headHash) || parsed.commits[parsed.commits.length - 1];
  }

  /** Latest upload version at HEAD (integer V column, includes branch tips). */
  function headMainlineVersion(parsed) {
    const head = headCommit(parsed);
    return head.versionIndex ?? head.displayColumn ?? 0;
  }

  function resolveFocusGraphX(parsed) {
    const head = headCommit(parsed);
    if (state.focusGraphX != null) {
      const ok = parsed.commits.some((c) => columnsMatch(c.displayColumn, state.focusGraphX));
      if (ok) return state.focusGraphX;
    }
    return head.versionIndex ?? head.displayColumn ?? 1;
  }

  /** Deterministic 0/1 from commit hash — stable hub side across re-renders */
  function hashBit(str) {
    let h = 0;
    for (let i = 0; i < str.length; i++) {
      h = ((h << 5) - h + str.charCodeAt(i)) | 0;
    }
    return Math.abs(h) % 2;
  }

  /**
   * Hub lane for multi-file commit convergence:
   * odd count  → exact middle lane
   * even count → randomly upper or lower of the two center lanes (stable per commit)
   */
  function pickHubLane(onPage, commitHash) {
    const sorted = [...onPage].sort((a, b) => a.laneIndex - b.laneIndex);
    const n = sorted.length;
    if (n <= 1) return sorted[0];
    if (n % 2 === 1) {
      return sorted[Math.floor((n - 1) / 2)];
    }
    const lo = n / 2 - 1;
    const hi = n / 2;
    return sorted[hashBit(commitHash) ? hi : lo];
  }

  /** Lane list only — no commit walk, no nodes/links. */
  function buildLaneCatalog(parsed) {
    const allFiles = getLaneSourceFiles(parsed);
    assignPerLaneVersions(parsed, allFiles);
    const hi = headIndex(parsed);
    const head = headCommit(parsed);
    const focusGraphX = resolveFocusGraphX(parsed);
    const headMainlineV = headMainlineVersion(parsed);
    const baseLanes = collectVisibleLanes(allFiles);
    const withBranches = insertBranchLanes(baseLanes, parsed.branchSegments || []);
    const lanes = assignLaneColors(withBranches);
    lanes.forEach((lane, i) => { lane.laneIndex = i; });
    return {
      lanes,
      focusGraphX,
      head: hi,
      headHash: head.hash,
      headCommit: head,
      headMainlineV,
      contentHeight: CONFIG.RULER_HEIGHT + Math.max(lanes.length, 1) * CONFIG.LANE_HEIGHT
        + CONFIG.MARGIN.top + CONFIG.MARGIN.bottom,
    };
  }

  function makeVersionStepNode(lane, globalColumn, laneVersion) {
    return {
      id: `step:${lane.path}:${globalColumn}`,
      isVersionStep: true,
      displayColumn: globalColumn,
      graphX: globalColumn,
      laneVersion,
      lanePath: lane.path,
      laneIndex: lane.laneIndex,
      lane,
      label: lane.label,
    };
  }

  function buildLaneVersionEvents(lane, parsed) {
    const events = [];
    parsed.commits.forEach((commit) => {
      if (!commitInColumnWindow(commit)) return;
      if (!commitAppliesToLane(commit, lane, parsed)) return;
      const laneV = commit.laneVersions?.[lane.path];
      if (laneV == null) return;
      events.push({
        laneVersion: laneV,
        globalColumn: commit.displayColumn,
        commit,
      });
    });
    return events;
  }

  /** Integer columns V{vStart}…V{vEnd} in viewport (lane track / step nodes). */
  function laneTrackTimeline(vStart, vEnd, win) {
    const start = Math.max(1, Math.floor(vStart));
    const end = Math.max(start, Math.floor(vEnd));
    const timeline = [];
    for (let v = start; v <= end; v += 1) {
      if (columnInWindow(v, win)) timeline.push(v);
    }
    return { vStart: start, vEnd: end, timeline };
  }

  function traceAnchorAtColumn(nodes, lane, columnV) {
    const node = nodes.find((n) => n.lanePath === lane.path && !isBranchGraphAnchor(n)
      && columnsMatch(n.displayColumn ?? n.graphX, columnV));
    const col = node ? (node.displayColumn ?? node.graphX) : columnV;
    return { graphX: col, displayColumn: col, node };
  }

  /** Lane track: per-folder V bumps only on touches; idle dash when folder unchanged across uploads. */
  function addLaneVersionTrace(lane, nodes, links, parsed, bundlesOnLane) {
    if (lane.isHeader) return;

    if (!PER_LANE_VERSION) {
      const skipCols = laneStepSkipColumns(lane, parsed, bundlesOnLane);
      const ranges = lane.isBranchLane
        ? [branchLaneTrackRange(lane, parsed, bundlesOnLane)]
        : parentLaneTrackRanges(lane, parsed);
      ranges.forEach((range) => {
        const { vStart, vEnd, timeline } = laneTrackTimeline(
          range.vStart,
          range.vEnd,
          state.visibleColumnWindow,
        );
        if (vEnd < vStart) return;
        links.push({
          kind: 'lane-track',
          vStart,
          vEnd,
          lane,
          laneIndex: lane.laneIndex,
          active: false,
        });
        const cols = timeline.filter((columnV) => !skipCols.has(columnV));
        cols.forEach((columnV) => {
          if (nodeOnLaneAtColumn(nodes, lane.path, columnV)) return;
          nodes.push(makeVersionStepNode(lane, columnV, columnV));
        });
        for (let i = 1; i < cols.length; i += 1) {
          links.push({
            kind: 'lane-trace',
            from: traceAnchorAtColumn(nodes, lane, cols[i - 1]),
            to: traceAnchorAtColumn(nodes, lane, cols[i]),
            lane,
            laneIndex: lane.laneIndex,
            active: false,
          });
        }
      });
      return;
    }

    const events = buildLaneVersionEvents(lane, parsed);
    if (!events.length) return;

    const headCol = headColumn(parsed);
    events.forEach((ev, i) => {
      if (!columnInWindow(ev.globalColumn, state.visibleColumnWindow)) return;
      if (!nodeOnLaneAtColumn(nodes, lane.path, ev.globalColumn)) {
        nodes.push(makeVersionStepNode(lane, ev.globalColumn, ev.laneVersion));
      }
      if (i > 0) {
        const prev = events[i - 1];
        links.push({
          kind: 'lane-trace',
          from: traceAnchorAtColumn(nodes, lane, prev.globalColumn),
          to: traceAnchorAtColumn(nodes, lane, ev.globalColumn),
          lane,
          laneIndex: lane.laneIndex,
          active: false,
          laneVersion: ev.laneVersion,
        });
      }
    });

    const last = events[events.length - 1];
    if (last.globalColumn < headCol
      && (columnInWindow(last.globalColumn, state.visibleColumnWindow)
        || columnInWindow(headCol, state.visibleColumnWindow))) {
      links.push({
        kind: 'lane-idle',
        from: traceAnchorAtColumn(nodes, lane, last.globalColumn),
        to: { displayColumn: headCol, graphX: headCol, laneVersion: last.laneVersion },
        lane,
        laneIndex: lane.laneIndex,
        heldVersion: last.laneVersion,
        active: false,
      });
    }
  }

  function makeGraphNode(commit, lane, files, focusGraphX, head) {
    return {
      id: `${commit.hash}:${lane.path}`,
      hash: commit.hash,
      author: commit.author,
      date: commit.date,
      subject: commit.subject || '',
      versionIndex: commit.versionIndex,
      laneVersion: commit.laneVersions?.[lane.path] ?? null,
      globalIndex: commit.displayColumn,
      graphX: commit.displayColumn,
      displayColumn: commit.displayColumn,
      lanePath: lane.path,
      laneIndex: lane.laneIndex,
      lane,
      label: lane.label,
      filePath: lane.collapsed ? lane.label : files[0],
      files,
      fileCount: files.length,
      isFocus: columnsMatch(commit.displayColumn, focusGraphX),
      isPulse: nodeIsPulsing({ id: `${commit.hash}:${lane.path}` }),
      isHead: commit.hash === head.hash,
      isHub: true,
      isFolderAggregate: lane.type === 'folder' && !lane.isHeader,
      isBranchLane: !!lane.isBranchLane,
    };
  }

  function branchBundlesOnLane(parsed, catalog, seg, branchLane) {
    const bundles = [];
    parsed.commits.forEach((commit) => {
      if (!commitInColumnWindow(commit)) return;
      if (!seg.commitSet.has(commit.hash)) return;
      if (!commitAppliesToLane(commit, branchLane, parsed)) return;
      const matched = commit.files.filter((f) => fileMatchesLane(f, branchLane));
      if (!matched.length) return;
      bundles.push({
        commit,
        graphX: commit.displayColumn,
        displayColumn: commit.displayColumn,
        onPage: [{ lane: branchLane, lanePath: branchLane.path, files: matched }],
      });
    });
    return bundles.sort((a, b) => a.displayColumn - b.displayColumn);
  }

  /** Per-lane commit scan — only when the lane enters the viewport. */
  function buildLaneSlice(parsed, catalog, laneIndex) {
    const lane = catalog.lanes[laneIndex];
    const focusGraphX = catalog.focusGraphX;
    const head = catalog.headCommit;
    const nodes = [];
    const links = [];
    const bundlesOnLane = [];

    parsed.commits.forEach((commit) => {
      if (!commitInColumnWindow(commit)) return;
      if (!commitAppliesToLane(commit, lane, parsed)) return;
      const matched = commit.files.filter((f) => fileMatchesLane(f, lane));
      if (!matched.length) return;
      bundlesOnLane.push({
        id: `bundle-${commit.hash}`,
        commit,
        graphX: commit.displayColumn,
        displayColumn: commit.displayColumn,
        isFocus: columnsMatch(commit.displayColumn, focusGraphX),
        isHead: commit.hash === head.hash,
        onPage: [{ lane, laneIndex, lanePath: lane.path, files: matched }],
        hubLanePath: lane.path,
        hubLaneIndex: laneIndex,
        files: matched,
      });
      nodes.push(makeGraphNode(commit, lane, matched, focusGraphX, head));
    });

    bundlesOnLane.sort((a, b) => a.displayColumn - b.displayColumn);
    addLaneVersionTrace(lane, nodes, links, parsed, bundlesOnLane);
    if (lane.isBranchLane) {
      for (let i = 1; i < bundlesOnLane.length; i += 1) {
        links.push({
          kind: 'lane-bridge',
          from: bundlesOnLane[i - 1],
          to: bundlesOnLane[i],
          lane,
          laneIndex,
          active: false,
        });
      }
    }

    (parsed.branchSegments || []).forEach((seg) => {
      const forkCommit = parsed.commitMap[seg.forkHash];
      const mergeCommit = seg.mergeHash ? parsed.commitMap[seg.mergeHash] : null;
      if (!forkCommit) return;
      catalog.lanes.forEach((branchLane) => {
        if (!branchLane.isBranchLane || branchLane.branchSegment !== seg) return;
        const parentLane = catalog.lanes.find((l) => l.path === branchLane.parentLanePath);
        if (!parentLane) return;

        const forkV = laneForkV(parentLane, seg, parsed);
        const mergeV = mergeCommit
          ? (mergeCommit.versionIndex ?? mergeCommit.displayColumn)
          : null;
        const forkX = versionX(forkV);
        const mergeX = mergeV != null ? versionX(mergeV) : null;

        const branchBundles = branchBundlesOnLane(parsed, catalog, seg, branchLane);
        const firstBranch = branchBundles[0];
        const lastBranch = branchBundles[branchBundles.length - 1];

        if (parentLane.laneIndex === laneIndex && firstBranch
          && (columnInWindow(forkV) || columnInWindow(firstBranch.displayColumn))) {
          const forkNode = nodes.find((n) => n.lanePath === parentLane.path
            && !isBranchGraphAnchor(n) && !isVersionStepNode(n)
            && columnsMatch(n.displayColumn ?? n.graphX, forkV));
          if (!forkNode && !nodeOnLaneAtColumn(nodes, parentLane.path, forkV)) {
            nodes.push({
              id: `fork-anchor:${seg.id}:${parentLane.path}`,
              isForkAnchor: true,
              branchName: seg.name,
              hash: forkCommit.hash,
              author: forkCommit.author,
              date: forkCommit.date,
              versionIndex: forkCommit.versionIndex,
              globalIndex: forkV,
              graphX: forkV,
              displayColumn: forkV,
              lanePath: parentLane.path,
              laneIndex: parentLane.laneIndex,
              lane: parentLane,
              label: parentLane.label,
              filePath: laneMatchPath(parentLane),
              files: [],
              fileCount: 0,
              isFocus: columnsMatch(forkV, focusGraphX),
              isPulse: false,
              isHead: false,
              isHub: false,
              isFolderAggregate: false,
              isBranchLane: false,
            });
          }
          const forkCx = forkNode
            ? versionX(forkNode.displayColumn ?? forkV)
            : forkX;
          links.push({
            kind: 'fork',
            x1: forkCx,
            y1: laneCenterY(parentLane.laneIndex),
            x2: versionX(firstBranch.displayColumn),
            y2: laneCenterY(branchLane.laneIndex),
            parentLane,
            branchLane,
            active: true,
          });
        }

        if (seg.merged && mergeCommit && mergeV != null && branchLane.laneIndex === laneIndex
          && lastBranch
          && (columnInWindow(mergeV) || columnInWindow(lastBranch.displayColumn))) {
          if (!nodeOnLaneAtColumn(nodes, branchLane.path, mergeV)) {
            nodes.push({
              id: `merge-anchor:${seg.id}:${branchLane.path}`,
              isMergeAnchor: true,
              branchName: seg.name,
              hash: mergeCommit.hash,
              author: mergeCommit.author,
              date: mergeCommit.date,
              versionIndex: mergeCommit.versionIndex,
              globalIndex: mergeV,
              graphX: mergeV,
              displayColumn: mergeV,
              lanePath: branchLane.path,
              laneIndex: branchLane.laneIndex,
              lane: branchLane,
              label: branchLane.label,
              filePath: laneMatchPath(branchLane),
              files: [],
              fileCount: 0,
              isFocus: columnsMatch(mergeV, focusGraphX),
              isPulse: false,
              isHead: false,
              isHub: false,
              isFolderAggregate: false,
              isBranchLane: true,
            });
          }
          links.push({
            kind: 'merge',
            x1: versionX(lastBranch.displayColumn),
            y1: laneCenterY(branchLane.laneIndex),
            x2: mergeX,
            y2: laneCenterY(branchLane.laneIndex),
            parentLane,
            branchLane,
            active: true,
          });
        }
      });
    });

    return { nodes, links, bundlesOnLane };
  }

  function constraintSingle(filePath) {
    return `【Horsewhip · 文件边界约束】
只允许修改：${filePath}
禁止修改仓库内其他任何文件。
若必须改动其他文件，请先停下并说明理由，待确认后再继续。`;
  }

  function constraintMulti(files) {
    const list = [...files].sort().join(', ');
    return `【Horsewhip · 文件边界约束】
允许修改：${list}
（以上文件在该仓库历史中常于同一 commit 内共变）
禁止修改上述范围以外的文件。`;
  }

  /** Phase 2: explicit task boundary from user multi-select (not git co-change). */
  function constraintBoundary(items) {
    const sorted = [...items].sort((a, b) => a.localeCompare(b));
    const lines = sorted.map((item) => {
      if (isFolderBoundaryPath(item)) {
        const label = item === ROOT_BUCKET ? '仓库根目录/' : item;
        return `- ${label}（文件夹，含其下所有路径）`;
      }
      return `- ${item}`;
    }).join('\n');
    return `【Horsewhip · 文件边界】
本次任务只允许修改以下范围，不要创建/修改/删除其他任何路径：
${lines}

若必须改动其他文件，请先说明理由并等待确认后再继续。`;
  }

  function constraintFolder(folderPath) {
    const label = folderPath === ROOT_BUCKET ? '仓库根目录/' : folderPath;
    const lv = PER_LANE_VERSION && state.parsed ? laneVersionAtHead(state.parsed, folderPath) : 0;
    const verHint = lv > 0
      ? `\n该目录泳道版本：${formatLaneVersion(lv)}（仅在本目录有提交时递增；横轴 Cn 为全仓库上传序）。`
      : '';
    return `【Horsewhip · 文件夹边界】
本次任务只允许修改 ${label} 目录下的内容，不要创建/修改/删除该目录以外的任何路径。${verHint}

若必须改动其他目录，请先说明理由并等待确认后再继续。`;
  }

  function isFolderBoundaryPath(path) {
    return path === ROOT_BUCKET || String(path).endsWith('/');
  }

  function isFolderBoundaryNode(node) {
    if (!node) return false;
    if (node.isFolderAggregate) return true;
    if (node.lane?.type === 'folder' && !node.lane?.isHeader) return true;
    const p = node.lanePath || node.lane?.path;
    return Boolean(p && isFolderBoundaryPath(p));
  }

  function folderBoundaryPathFromNode(node) {
    if (!isFolderBoundaryNode(node)) return null;
    let p = node.lanePath || node.lane?.path;
    if (!p) return null;
    if (p === ROOT_BUCKET) return ROOT_BUCKET;
    return p.endsWith('/') ? p : `${p}/`;
  }

  function boundaryPathLabel(path) {
    if (path === ROOT_BUCKET) return '(root)/';
    return path;
  }

  function getBoundaryFilesList() {
    return [...state.boundaryFiles].sort((a, b) => a.localeCompare(b));
  }

  function buildBoundaryPrompt() {
    const items = getBoundaryFilesList();
    if (items.length === 0) return '';
    if (items.length === 1) {
      const item = items[0];
      return isFolderBoundaryPath(item) ? constraintFolder(item) : constraintSingle(item);
    }
    return constraintBoundary(items);
  }

  function nodeBoundaryPaths(node) {
    if (!node) return [];
    const folderPath = folderBoundaryPathFromNode(node);
    if (folderPath) return [folderPath];
    const primary = node.filePath || node.files?.[0];
    return primary ? [primary] : [];
  }

  function nodeCanSelect(node) {
    if (!node?.id || node.isVersionStep) return false;
    if (isBranchGraphAnchor(node)) return false;
    if (isFolderBoundaryNode(node)) return true;
    return nodeBoundaryPaths(node).length > 0;
  }

  function rebuildBoundaryFromNodes() {
    state.boundaryFiles.clear();
    const paths = [];
    state.selectedNodeIds.forEach((id) => {
      const node = state.nodeIndex[id];
      if (!node) return;
      paths.push(...nodeBoundaryPaths(node));
    });
    const folders = paths.filter((p) => isFolderBoundaryPath(p));
    const files = paths.filter((p) => !isFolderBoundaryPath(p));
    const prunedFiles = files.filter(
      (f) => !folders.some((dir) => fileMatchesLane(f, folderLaneForSelection(dir))),
    );
    [...folders, ...prunedFiles].forEach((p) => state.boundaryFiles.add(p));
  }

  function syncBoundaryBar() {
    const nodeCount = state.selectedNodeIds.size;
    const files = getBoundaryFilesList();
    const hasSelection = nodeCount > 0;

    if (els.boundaryBar) els.boundaryBar.hidden = !hasSelection;
    if (els.boundaryCount) {
      els.boundaryCount.textContent = nodeCount === 1 ? '1 个节点' : `${nodeCount} 个节点`;
    }
    if (els.boundaryFiles) {
      els.boundaryFiles.textContent = hasSelection ? files.map(boundaryPathLabel).join(' · ') : '';
      els.boundaryFiles.title = hasSelection ? files.map(boundaryPathLabel).join('\n') : '';
    }
    if (els.boundaryPreview) {
      els.boundaryPreview.textContent = hasSelection ? buildBoundaryPrompt() : '';
    }
    if (els.btnBoundaryCopy) els.btnBoundaryCopy.disabled = !hasSelection;
    if (els.btnBoundaryChat) els.btnBoundaryChat.disabled = !hasSelection;

    if (isPluginHost() && window.HorsewhipPluginBridge?.setBoundaryAllowlist) {
      window.HorsewhipPluginBridge.setBoundaryAllowlist(files);
    }
    if (isPluginHost() && state.catalog?.lanes?.length) {
      updatePluginBar(state.catalog.lanes.length);
    }
    syncFileRailBoundaryHighlight();
  }

  function syncFileRailBoundaryHighlight() {
    if (!els.fileRailInner) return;
    const items = getBoundaryFilesList();
    const folders = items.filter(isFolderBoundaryPath);
    const files = items.filter((p) => !isFolderBoundaryPath(p));
    els.fileRailInner.querySelectorAll('.file-rail__item').forEach((row) => {
      row.classList.remove('file-rail__item--boundary');
      const folderPath = row.dataset.folderPath;
      const filePath = row.dataset.filePath;
      if (folderPath && folders.includes(folderPath)) {
        row.classList.add('file-rail__item--boundary');
        return;
      }
      if (filePath && files.includes(filePath)) {
        if (!folders.some((dir) => fileMatchesLane(filePath, folderLaneForSelection(dir)))) {
          row.classList.add('file-rail__item--boundary');
        }
      }
    });
  }

  function clearNodeSelection() {
    if (state.selectedNodeIds.size === 0) return;
    state.selectedNodeIds.clear();
    state.boundaryFiles.clear();
    state.lastSelectedNodeId = null;
    syncBoundaryBar();
    updateSelectionVisuals();
  }

  function toggleSelectedNode(node) {
    if (!nodeCanSelect(node) || !state.parsed) return;
    if (state.selectedNodeIds.has(node.id)) {
      state.selectedNodeIds.delete(node.id);
      if (state.lastSelectedNodeId === node.id) {
        state.lastSelectedNodeId = [...state.selectedNodeIds].slice(-1)[0] || null;
      }
    } else {
      state.selectedNodeIds.add(node.id);
      state.lastSelectedNodeId = node.id;
    }
    rebuildBoundaryFromNodes();
    syncBoundaryBar();
  }

  function folderLaneForSelection(folderPath) {
    return { type: 'folder', path: folderPath, isHeader: false, collapsed: true };
  }

  function findLaneIndexForFolderPath(folderPath) {
    const lanes = state.catalog?.lanes;
    if (!lanes) return -1;
    const lane = lanes.find((l) => l.path === folderPath && l.type === 'folder');
    return lane?.laneIndex ?? -1;
  }

  function toggleFolderClusterSelection(node) {
    toggleSelectedNode(node);
  }

  function buildFolderSelectionNode(folderPath) {
    if (!state.parsed) return null;
    refreshNodeIndex();
    const columnV = state.focusGraphX ?? resolveFocusGraphX(state.parsed);
    const folderLane = folderLaneForSelection(folderPath);
    const commit = state.parsed.commits.find(
      (c) => columnsMatch(c.displayColumn ?? c.graphX, columnV)
        && c.files.some((f) => fileMatchesLane(f, folderLane)),
    );
    if (!commit) return null;
    const laneIndex = findLaneIndexForFolderPath(folderPath);
    return {
      id: `${commit.hash}:${folderPath}`,
      hash: commit.hash,
      displayColumn: commit.displayColumn ?? commit.graphX,
      graphX: commit.displayColumn ?? commit.graphX,
      lanePath: folderPath,
      laneIndex,
      lane: { path: folderPath, collapsed: true, type: 'folder' },
      isFolderAggregate: true,
      label: folderDisplayLabel(folderPath),
    };
  }

  function selectFolderFromRail(lane) {
    const stub = buildFolderSelectionNode(lane.path);
    if (!stub) return;
    hideTooltip();
    state.animateNext = false;
    state.selectedLink = null;
    els.linkPanel.hidden = true;
    state.nodeIndex[stub.id] = stub;
    toggleSelectedNode(stub);
    state.focusGraphX = stub.displayColumn ?? stub.graphX;
    state.pulseNodeId = state.selectedNodeIds.has(stub.id) ? stub.id : null;
    updateGraphFocus();
    updateSelectionVisuals();
  }

  function wireFileRailFolderRow(row, lane, chev) {
    if (lane.type !== 'folder' && !lane.collapsed && !lane.isHeader) return;

    const folderLabel = lane.path === ROOT_BUCKET ? '(root)' : lane.path;

    if (lane.isHeader) {
      row.dataset.folderPath = lane.path;
      row.classList.add('file-rail__item--folder-header');
      row.title = `${folderLabel} · 点击收起`;
      const onCollapse = (e) => {
        e.preventDefault();
        e.stopPropagation();
        toggleExpand(lane.path, e.altKey);
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
        toggleExpand(lane.path, e.altKey);
      });
    }
    row.addEventListener('click', (e) => {
      if (e.target.closest('.file-rail__chev--expand')) return;
      if (e.altKey && isPluginHost() && window.HorsewhipPluginBridge?.revealFolder) {
        window.HorsewhipPluginBridge.revealFolder(lane.path === ROOT_BUCKET ? '' : lane.path);
        return;
      }
      e.preventDefault();
      e.stopPropagation();
      selectFolderFromRail(lane);
    });
  }

  function cmdCheckout(hash, filePath) {
    return `git checkout ${hash} -- ${filePath}`;
  }

  function cmdResetHard(hash) {
    return `# ⚠️ 将丢失 ${hash} 之后的所有未提交/已提交本地改动，请先备份或 stash
git reset --hard ${hash}`;
  }

  /** X offset for version column V (1-based). V1 → VERSION_ORIGIN_X. */
  function versionScale() {
    return CONFIG.VERSION_SPACING * (state.graphZoom || 1);
  }

  function versionColumnX(columnV) {
    return CONFIG.VERSION_ORIGIN_X + (columnV - 1) * versionScale();
  }

  function visibleColumnRange() {
    const spacing = versionScale();
    const origin = CONFIG.VERSION_ORIGIN_X;
    const pan = state.panX ?? computePanBounds().panMin;
    const vpW = els.graphViewport?.clientWidth || 800;
    const m = CONFIG.MARGIN.left;
    const rawMin = 1 + (pan - m - origin) / spacing;
    const rawMax = 1 + (pan + vpW - m - origin) / spacing;
    const headCol = state.parsed
      ? (headMainlineVersion(state.parsed) || headColumn(state.parsed))
      : 1;
    const pad = CONFIG.COLUMN_VIEW_OVERSCAN;
    return {
      vMin: Math.min(rawMin, headCol) - pad,
      vMax: Math.max(rawMax, headCol) + pad,
      headCol,
    };
  }

  function updateVisibleColumnWindow() {
    state.visibleColumnWindow = visibleColumnRange();
  }

  function columnInWindow(columnV, win) {
    if (columnV == null || Number.isNaN(columnV)) return false;
    const w = win || state.visibleColumnWindow;
    if (!w) return true;
    if (columnsMatch(columnV, w.headCol)) return true;
    return columnV >= w.vMin && columnV <= w.vMax;
  }

  function commitInColumnWindow(commit) {
    return columnInWindow(commit.displayColumn ?? commit.graphX, state.visibleColumnWindow);
  }

  function panXForHeadFocus(parsed) {
    const headCol = headMainlineVersion(parsed) || headColumn(parsed);
    return panXForColumnFocus(headCol);
  }

  function panXForColumnFocus(columnV) {
    const colScreenX = CONFIG.MARGIN.left + versionColumnX(columnV);
    const vpW = els.graphViewport?.clientWidth || 800;
    const targetX = vpW * 0.5;
    return Math.max(computePanBounds().panMin, colScreenX - targetX);
  }

  function latestVersionColumnForFile(parsed, filePath) {
    const tl = parsed.fileTimelines?.[filePath];
    if (tl?.length) {
      const last = tl[tl.length - 1];
      return last.displayColumn ?? last.versionIndex ?? last.graphX ?? headColumn(parsed);
    }
    return headMainlineVersion(parsed) || headColumn(parsed);
  }

  function findLaneIndexForFilePath(filePath) {
    const lanes = state.catalog?.lanes;
    if (!lanes) return -1;
    const lane = lanes.find((l) => l.type === 'file' && l.path === filePath);
    return lane ? lane.laneIndex : -1;
  }

  function scrollTopForLaneCenter(laneIndex) {
    const vpH = els.graphViewport?.clientHeight || 600;
    const laneY = laneCenterY(laneIndex);
    const maxScroll = Math.max(0, (els.fileRailInner?.offsetHeight || 0) - (els.fileRail?.clientHeight || vpH));
    return Math.max(0, Math.min(maxScroll, laneY - vpH / 2));
  }

  function syncFileRailScrollFromState() {
    if (!els.fileRail) return;
    scrollSync = true;
    els.fileRail.scrollTop = state.scrollTop;
    scrollSync = false;
  }

  function applyGraphTransformImmediate() {
    if (!gMain) return;
    gMain.attr('transform', `translate(${-state.panX}, ${-state.scrollTop})`);
  }

  function animateViewportTo(targetPanX, targetScrollTop, duration = 420) {
    if (!gMain || !state.parsed) return Promise.resolve();
    const gen = ++state.viewportAnimGeneration;
    const bounds = computePanBounds();
    const startPan = state.panX ?? bounds.panMin;
    const startScroll = state.scrollTop ?? 0;
    const endPan = clampPan(targetPanX, bounds);
    const maxScroll = Math.max(0, els.fileRailInner.offsetHeight - els.fileRail.clientHeight);
    const endScroll = Math.max(0, Math.min(maxScroll, targetScrollTop));
    const needMove = Math.abs(endPan - startPan) > 0.5 || Math.abs(endScroll - startScroll) > 0.5;

    const finish = () => {
      if (gen !== state.viewportAnimGeneration) return;
      state.panX = endPan;
      state.scrollTop = endScroll;
      applyGraphTransformImmediate();
      syncFileRailScrollFromState();
      updateVisibleColumnWindow();
      scheduleViewportSync({ invalidateSlices: true });
    };

    if (!needMove) {
      finish();
      return Promise.resolve();
    }

    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      finish();
      return Promise.resolve();
    }

    gMain.interrupt();

    return new Promise((resolve) => {
      d3.select(gMain.node())
        .transition('hw-viewport-pan')
        .duration(duration)
        .ease(d3.easeCubicInOut)
        .tween('hw-viewport', () => {
          const panI = d3.interpolateNumber(startPan, endPan);
          const scrollI = d3.interpolateNumber(startScroll, endScroll);
          return (t) => {
            if (gen !== state.viewportAnimGeneration) return;
            state.panX = panI(t);
            state.scrollTop = scrollI(t);
            applyGraphTransformImmediate();
            syncFileRailScrollFromState();
          };
        })
        .on('end', () => {
          if (gen !== state.viewportAnimGeneration) return;
          finish();
          resolve();
        });
    });
  }

  function focusFileLane(filePath) {
    if (!state.parsed || !state.catalog || !filePath) return;
    const parsed = state.parsed;
    const columnV = latestVersionColumnForFile(parsed, filePath);
    const laneIndex = findLaneIndexForFilePath(filePath);

    state.focusedFilePath = filePath;
    state.focusGraphX = columnV;
    syncFileRailFocusHighlight();

    const panX = panXForColumnFocus(columnV);
    const scrollTop = laneIndex >= 0 ? scrollTopForLaneCenter(laneIndex) : state.scrollTop;

    updateGraphFocus();

    void animateViewportTo(panX, scrollTop).then(() => {
      if (state.focusedFilePath !== filePath) return;
      const lane = laneIndex >= 0 ? state.catalog.lanes[laneIndex] : null;
      if (lane) {
        const commit = parsed.commits.find(
          (c) => columnsMatch(c.displayColumn ?? c.graphX, columnV)
            && c.files.some((f) => fileMatchesLane(f, lane)),
        );
        if (commit) {
          state.pulseNodeId = `${commit.hash}:${lane.path}`;
          setPulseNode(state.pulseNodeId);
        }
      }
      updateGraphFocus();
    });
  }

  function syncFileRailFocusHighlight() {
    if (!els.fileRailInner) return;
    els.fileRailInner.querySelectorAll('[data-file-path]').forEach((row) => {
      row.classList.toggle(
        'file-rail__item--focused',
        row.getAttribute('data-file-path') === state.focusedFilePath,
      );
    });
  }

  function wireFileRailFocus(row, lane) {
    if (lane.type !== 'file' || lane.isBranchLane || lane.collapsed || lane.isHeader) return;
    row.dataset.filePath = lane.path;
    row.classList.add('file-rail__item--focusable');
    row.classList.toggle('file-rail__item--focused', lane.path === state.focusedFilePath);
    row.addEventListener('click', (e) => {
      if (e.altKey) return;
      if (e.target.closest('.file-rail__chev--collapse')) return;
      e.preventDefault();
      e.stopPropagation();
      focusFileLane(lane.path);
    });
  }

  function invalidateLaneSliceCache() {
    state.laneSliceCache = new Map();
    if (graphRenderCtx?.renderedLanes) {
      [...graphRenderCtx.renderedLanes].forEach((i) => unmountLaneSlice(i));
    }
  }

  function sliceCacheKey(laneIndex) {
    const w = state.visibleColumnWindow;
    if (!w) return String(laneIndex);
    return `${laneIndex}:${w.vMin.toFixed(2)}:${w.vMax.toFixed(2)}`;
  }

  function setGraphZoom(next) {
    const z = Math.min(CONFIG.ZOOM_MAX, Math.max(CONFIG.ZOOM_MIN, next));
    if (Math.abs(z - state.graphZoom) < 0.001) return;
    state.graphZoom = z;
    if (els.zoomLabel) els.zoomLabel.textContent = `${Math.round(z * 100)}%`;
    const catalog = state.catalog;
    const pan = state.panX;
    invalidateLaneSliceCache();
    if (catalog) {
      prepareGraphShell(catalog);
      if (pan != null) state.panX = pan;
      scheduleViewportSync({ invalidateSlices: true });
    }
  }

  function nudgeZoom(factor) {
    setGraphZoom((state.graphZoom || 1) * factor);
  }

  function updatePaginationUI(parsed) {
    if (!els.largeWarn || !parsed) return;
    const loaded = parsed.loadedCommitCount ?? parsed.commits.length;
    const total = parsed.totalCommitsInLog ?? loaded;
    if (total <= CONFIG.COMMIT_PAGE_SIZE && loaded >= total) {
      els.largeWarn.hidden = true;
      return;
    }
    if (els.largeWarnText) {
      els.largeWarnText.textContent = total > loaded
        ? `已加载 ${loaded}/${total} commits（分页）`
        : `${total} commits`;
    }
    if (els.btnLoadMoreCommits) {
      const canMore = loaded < total;
      els.btnLoadMoreCommits.hidden = !canMore;
      els.btnLoadMoreCommits.textContent = canMore
        ? `+${Math.min(CONFIG.COMMIT_PAGE_STEP, total - loaded)}`
        : '';
    }
    els.largeWarn.hidden = false;
  }

  function versionX(columnV) {
    return versionColumnX(columnV);
  }

  function laneCenterY(laneIndex) {
    return CONFIG.RULER_HEIGHT + laneIndex * CONFIG.LANE_HEIGHT + CONFIG.LANE_HEIGHT / 2;
  }

  function headXContent(headCol) {
    return CONFIG.MARGIN.left + versionColumnX(headCol);
  }

  function v1ContentX() {
    return CONFIG.MARGIN.left + versionColumnX(1);
  }

  function futureExtentX(parsed) {
    return versionColumnX(rulerExtent(parsed));
  }

  function computePanBounds() {
    return { panMin: v1ContentX() - CONFIG.V1_VIEW_INSET, panMax: Infinity };
  }

  function clampPan(panX, bounds) {
    return Math.max(bounds.panMin, panX);
  }

  /** Smooth cubic bridge between version hubs across file lanes */
  function curveBridge(x1, y1, x2, y2) {
    const dx = x2 - x1;
    const bend = Math.max(6, Math.abs(dx) * 0.44);
    const cx1 = x1 + bend;
    const cx2 = x2 - bend;
    return `M${x1},${y1} C${cx1},${y1} ${cx2},${y2} ${x2},${y2}`;
  }

  /** Horizontal S-curve from file lane to version bus */
  function curveSpoke(x1, y1, x2, y2) {
    const mx = x1 + (x2 - x1) * 0.58;
    if (Math.abs(y2 - y1) < 1) {
      const my = y1 - 3;
      return `M${x1},${y1} Q${mx},${my} ${x2},${y2}`;
    }
    return `M${x1},${y1} C${mx},${y1} ${mx},${y2} ${x2},${y2}`;
  }

  /** Soft vertical bus with slight outward bow */
  function curveBus(x, yTop, yBot) {
    const mid = (yTop + yBot) / 2;
    const bow = Math.min(2, (yBot - yTop) * 0.05);
    return `M${x},${yTop} Q${x + bow},${mid} ${x},${yBot}`;
  }

  function installGraphDefs(defs) {
    const stale = defs.append('filter')
      .attr('id', 'hw-shadow-stale')
      .attr('x', '-50%').attr('y', '-50%')
      .attr('width', '200%').attr('height', '200%');
    stale.append('feDropShadow')
      .attr('dx', 0).attr('dy', 1)
      .attr('stdDeviation', 2.2)
      .attr('flood-color', '#0a0e14')
      .attr('flood-opacity', 0.85);

    const glow = defs.append('filter')
      .attr('id', 'hw-glow-active')
      .attr('x', '-80%').attr('y', '-80%')
      .attr('width', '260%').attr('height', '260%');
    glow.append('feGaussianBlur')
      .attr('in', 'SourceGraphic')
      .attr('stdDeviation', 2.8)
      .attr('result', 'b');
    const transfer = glow.append('feComponentTransfer').attr('in', 'b').attr('result', 'g');
    transfer.append('feFuncA').attr('type', 'linear').attr('slope', 2);
    const merge = glow.append('feMerge');
    merge.append('feMergeNode').attr('in', 'g');
    merge.append('feMergeNode').attr('in', 'SourceGraphic');

    const nodeGlow = defs.append('filter')
      .attr('id', 'hw-node-glow')
      .attr('x', '-100%').attr('y', '-100%')
      .attr('width', '300%').attr('height', '300%');
    nodeGlow.append('feGaussianBlur').attr('stdDeviation', 3).attr('result', 'b');
    const nm = nodeGlow.append('feMerge');
    nm.append('feMergeNode').attr('in', 'b');
    nm.append('feMergeNode').attr('in', 'SourceGraphic');

    const linkStale = defs.append('linearGradient')
      .attr('id', 'hw-grad-link-stale')
      .attr('gradientUnits', 'userSpaceOnUse')
      .attr('x1', 0).attr('y1', 0).attr('x2', 120).attr('y2', 0);
    linkStale.append('stop').attr('offset', '0%').attr('stop-color', '#3a4556');
    linkStale.append('stop').attr('offset', '100%').attr('stop-color', '#6b7d95');

    const linkActive = defs.append('linearGradient')
      .attr('id', 'hw-grad-link-active')
      .attr('gradientUnits', 'userSpaceOnUse')
      .attr('x1', 0).attr('y1', 0).attr('x2', 80).attr('y2', 0);
    linkActive.append('stop').attr('offset', '0%').attr('stop-color', '#ffffff');
    linkActive.append('stop').attr('offset', '55%').attr('stop-color', '#fff7ed');
    linkActive.append('stop').attr('offset', '100%').attr('stop-color', '#fdba74');

    const nodeStale = defs.append('radialGradient')
      .attr('id', 'hw-grad-node-stale')
      .attr('cx', '35%').attr('cy', '30%').attr('r', '65%');
    nodeStale.append('stop').attr('offset', '0%').attr('stop-color', '#7a8aa3');
    nodeStale.append('stop').attr('offset', '100%').attr('stop-color', '#3d4a5c');

    const nodeFocus = defs.append('radialGradient')
      .attr('id', 'hw-grad-node-focus')
      .attr('cx', '32%').attr('cy', '28%').attr('r', '70%');
    nodeFocus.append('stop').attr('offset', '0%').attr('stop-color', '#fed7aa');
    nodeFocus.append('stop').attr('offset', '45%').attr('stop-color', '#fb923c');
    nodeFocus.append('stop').attr('offset', '100%').attr('stop-color', '#c2410c');
  }

  function appendLinkPath(parent, kind, active, d, datum, onClick, laneColor, laneColorDim) {
    const variant = active ? 'active' : 'stale';
    const group = parent.append('g').attr('class', `link-group link-group--${variant} link-${kind}`);

    group.append('path')
      .attr('class', `link-segment link-core link-core--${variant} link-${kind}`)
      .attr('d', d)
      .attr('fill', 'none')
      .attr('stroke', kind === 'bus' ? laneColorDim : (active ? laneColor : laneColorDim))
      .style('opacity', active ? 1 : 1);

    group.selectAll('.link-segment').each(function () {
      if (datum) d3.select(this).datum(datum);
    });

    if (onClick) {
      const handler = (ev, data) => { ev.stopPropagation(); onClick(data); };
      group.selectAll('.link-segment').on('click', handler);
    }

    group.selectAll('.link-segment')
      .on('mouseenter', () => { group.classed('link-group--hover', true); })
      .on('mouseleave', () => { group.classed('link-group--hover', false); });

    return group;
  }

  function laneLine(x1, y1, x2, y2) {
    return `M${x1},${y1} L${x2},${y2}`;
  }

  function appendNodeGraphic(nodeG, node, cx, cy) {
    const lane = node.lane;
    const color = laneIconColor(lane);
    const g = nodeG.append('g')
      .attr('class', `node-group node-group--file${node.isFocus ? ' node-group--focus' : ' node-group--stale'}${node.isPulse ? ' node-group--pulse' : ''}`)
      .attr('data-node-id', node.id)
      .attr('transform', `translate(${cx},${cy})`)
      .attr('opacity', state.animateNext ? 0 : 1)
      .datum(node);

    if (nodeIsPulsing(node)) appendNodeRipples(g, lane.color);

    appendSvgLaneIcon(g, nodeIconKind(node), color, ICON_SIZE);

    g.append('circle')
      .attr('class', 'node-hit')
      .attr('r', ICON_SIZE + ICON_HIT_PAD)
      .attr('fill', 'transparent')
      .style('pointer-events', 'all');

    if (PER_LANE_VERSION && node.laneVersion != null) {
      g.append('text')
        .attr('class', 'node-lane-ver')
        .attr('y', ICON_SIZE + 9)
        .attr('text-anchor', 'middle')
        .text(formatLaneVersion(node.laneVersion));
    }

    bindFileNodePointer(g, node);
  }

  /** 50% lane icon at versions without a commit — connected by lane-trace links. */
  function appendVersionStepGraphic(nodeG, node, cx, cy) {
    const lane = node.lane;
    const color = laneIconColor(lane);
    const size = versionStepIconSize();
    const g = nodeG.append('g')
      .attr('class', 'node-group node-group--step')
      .attr('data-node-id', node.id)
      .attr('transform', `translate(${cx},${cy})`)
      .attr('opacity', state.animateNext ? 0 : 0.62)
      .style('pointer-events', 'none')
      .datum(node);

    appendSvgLaneIcon(g, nodeIconKind(node), color, size);
    if (PER_LANE_VERSION && node.laneVersion != null) {
      g.append('text')
        .attr('class', 'node-lane-ver node-lane-ver--step')
        .attr('y', size + 7)
        .attr('text-anchor', 'middle')
        .text(formatLaneVersion(node.laneVersion));
    }
  }

  /** Parent-lane dot where a branch forks off (when no commit node exists at fork column). */
  function appendBranchForkAnchor(nodeG, node, cx, cy) {
    const lane = node.lane;
    const color = laneIconColor(lane);
    const g = nodeG.append('g')
      .attr('class', `node-group node-group--anchor node-group--fork-anchor${node.isFocus ? ' node-group--focus' : ' node-group--stale'}`)
      .attr('data-node-id', node.id)
      .attr('transform', `translate(${cx},${cy})`)
      .attr('opacity', state.animateNext ? 0 : 1)
      .datum(node);

    g.append('circle')
      .attr('class', 'node-anchor-ring')
      .attr('r', ICON_SIZE + 1.5)
      .attr('fill', 'none')
      .attr('stroke', color)
      .attr('stroke-width', 1.4)
      .style('pointer-events', 'none');
    g.append('circle')
      .attr('class', 'node-anchor-dot')
      .attr('r', ICON_SIZE)
      .attr('fill', color)
      .style('pointer-events', 'none');

    g.append('circle')
      .attr('class', 'node-hit')
      .attr('r', ICON_SIZE + ICON_HIT_PAD)
      .attr('fill', 'transparent')
      .style('pointer-events', 'all');

    bindFileNodePointer(g, node);
  }

  /** Branch-lane dot at merge column (end of branch path on ⎇ lane). */
  function appendBranchMergeAnchor(nodeG, node, cx, cy) {
    const lane = node.lane;
    const color = laneIconColor(lane);
    const g = nodeG.append('g')
      .attr('class', `node-group node-group--anchor node-group--merge-anchor${node.isFocus ? ' node-group--focus' : ' node-group--stale'}`)
      .attr('data-node-id', node.id)
      .attr('transform', `translate(${cx},${cy})`)
      .attr('opacity', state.animateNext ? 0 : 1)
      .datum(node);

    g.append('circle')
      .attr('class', 'node-anchor-ring node-anchor-ring--merge')
      .attr('r', ICON_SIZE + 1.5)
      .attr('fill', 'none')
      .attr('stroke', color)
      .attr('stroke-width', 1.4)
      .attr('stroke-dasharray', '2 2')
      .style('pointer-events', 'none');
    g.append('circle')
      .attr('class', 'node-anchor-dot')
      .attr('r', ICON_SIZE)
      .attr('fill', color)
      .style('pointer-events', 'none');

    g.append('circle')
      .attr('class', 'node-hit')
      .attr('r', ICON_SIZE + ICON_HIT_PAD)
      .attr('fill', 'transparent')
      .style('pointer-events', 'all');

    bindFileNodePointer(g, node);
  }

  function appendFolderClusterNode(nodeG, node, cx, cy, bundle) {
    const lane = node.lane;
    const color = laneIconColor(lane);
    const g = nodeG.append('g')
      .attr('class', `node-group node-group--folder${node.isFocus ? ' node-group--focus' : ''}${node.isPulse ? ' node-group--pulse' : ''}`)
      .attr('data-node-id', node.id)
      .attr('transform', `translate(${cx},${cy})`)
      .attr('opacity', state.animateNext ? 0 : 1)
      .datum(node);

    const side = ICON_SIZE * 2 + 2;
    appendSvgFolderRect(g, 'node-folder-cluster', side / 2, color);

    const hit = g.append('circle')
      .attr('class', 'node-hit node-hit--folder')
      .attr('r', side / 2 + ICON_HIT_PAD)
      .attr('fill', 'transparent')
      .style('pointer-events', 'all');

    hit
      .style('cursor', 'pointer')
      .on('click', (ev) => { ev.stopPropagation(); onFolderClusterClick(ev, node); })
      .on('dblclick', (ev) => {
        ev.stopPropagation();
        suppressOutsideClick = true;
        openNodeModal(node);
      });

    g.select('.node-folder-cluster').style('pointer-events', 'none');

    if (node.fileCount > 1) {
      g.append('text')
        .attr('class', 'node-folder-count')
        .attr('y', 0)
        .attr('dy', '0.32em')
        .attr('text-anchor', 'middle')
        .attr('font-size', '6px')
        .attr('fill', '#0a0a0b')
        .attr('pointer-events', 'none')
        .text(node.fileCount);
    }

    bindFolderNodePointer(g, node);
  }

  function runGraphEntrance() {
    const animate = state.animateNext;
    state.animateNext = false;

    if (!animate || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      gScroll.selectAll('.node-group').attr('opacity', 1);
      return;
    }

    gScroll.selectAll('.link-core').each(function (_, i) {
      const len = this.getTotalLength() || 48;
      d3.select(this)
        .attr('stroke-dasharray', `${len} ${len}`)
        .attr('stroke-dashoffset', len)
        .transition()
        .delay(i * 14)
        .duration(380)
        .ease(d3.easeCubicOut)
        .attr('stroke-dashoffset', 0)
        .on('end', function () {
          d3.select(this).attr('stroke-dasharray', null).attr('stroke-dashoffset', null);
        });
    });

    gScroll.selectAll('.node-group').each(function (_, i) {
      d3.select(this)
        .transition()
        .delay(120 + i * 22)
        .duration(340)
        .ease(d3.easeBackOut.overshoot(1.15))
        .attr('opacity', 1);
    });
  }

  function initSvg(contentHeight) {
    const width = els.graphViewport.clientWidth || 800;
    const height = contentHeight;

    d3.select(els.graphSvg).selectAll('*').remove();

    svgRoot = d3.select(els.graphSvg)
      .attr('width', width)
      .attr('height', height)
      .attr('viewBox', `0 0 ${width} ${height}`);

    gMain = svgRoot.append('g').attr('class', 'graph-main');
    gScroll = gMain.append('g').attr('class', 'graph-scroll-layer');

    installGraphDefs(svgRoot.append('defs'));

    svgRoot.insert('rect', ':first-child')
      .attr('width', width)
      .attr('height', height)
      .attr('fill', 'transparent');

    return { width, height };
  }

  function applyGraphTransform() {
    if (!gMain) return;
    state.viewportAnimGeneration += 1;
    gMain.interrupt();
    applyGraphTransformImmediate();
  }

  function yieldToNextFrame() {
    return new Promise((resolve) => requestAnimationFrame(resolve));
  }

  function bumpRenderGeneration() {
    state.renderGeneration += 1;
    return state.renderGeneration;
  }

  function renderIsAlive(gen) {
    return gen === state.renderGeneration;
  }

  function setGraphStreaming(on) {
    els.graphViewport?.classList.toggle('graph-viewport--streaming', !!on);
    if (els.btnLaneLayout) els.btnLaneLayout.disabled = !!on;
    if (els.btnGenerate) els.btnGenerate.disabled = !!on;
    if (els.btnDemo) els.btnDemo.disabled = !!on;
    if (els.btnMegaDemo) els.btnMegaDemo.disabled = !!on;
  }

  function visibleLaneRange(scrollTop, viewportH, laneCount) {
    if (laneCount <= 0) return { start: 0, end: -1 };
    const top = scrollTop;
    const bot = scrollTop + viewportH;
    let start = Math.floor((top - CONFIG.RULER_HEIGHT) / CONFIG.LANE_HEIGHT);
    let end = Math.ceil((bot - CONFIG.RULER_HEIGHT) / CONFIG.LANE_HEIGHT);
    start = Math.max(0, start - LANE_VIEW_OVERSCAN);
    end = Math.min(laneCount - 1, end + LANE_VIEW_OVERSCAN);
    if (start > end) {
      start = 0;
      end = Math.min(laneCount - 1, LANE_VIEW_OVERSCAN * 2);
    }
    return { start, end };
  }

  function prepareFileRailShell(lanes) {
    const inner = els.fileRailInner;
    inner.innerHTML = '';
    const spacer = document.createElement('div');
    spacer.className = 'file-rail__ruler-spacer';
    spacer.style.height = `${CONFIG.RULER_HEIGHT}px`;
    spacer.setAttribute('aria-hidden', 'true');
    inner.appendChild(spacer);
    inner.style.height = `${CONFIG.RULER_HEIGHT + Math.max(lanes.length, 1) * CONFIG.LANE_HEIGHT}px`;
    return inner;
  }

  function fileRailIndent(depth) {
    const step = isPluginHost() ? 14 : 9;
    return 5 + depth * step;
  }

  function fileRailTitle(lane) {
    let tip = lane.path === ROOT_BUCKET ? '(root)' : lane.path;
    if (PER_LANE_VERSION && state.parsed && !lane.isHeader) {
      const lv = laneVersionAtHead(state.parsed, lane.path);
      if (lv > 0) tip = `${tip} · 泳道 ${formatLaneVersion(lv)}`;
    }
    return tip;
  }

  function appendFileRailRow(lane) {
    const row = document.createElement('div');
    if (lane.isBranchLane) {
      row.className = 'file-rail__item file-rail__item--branch';
      row.style.paddingLeft = `${fileRailIndent(lane.depth)}px`;
      row.title = fileRailTitle(lane);
      const chev = document.createElement('span');
      chev.className = 'file-rail__chev';
      chev.textContent = '⎇';
      const label = document.createElement('span');
      label.className = 'file-rail__label';
      label.textContent = truncatePath(lane.label);
      row.appendChild(chev);
      row.appendChild(label);
      return row;
    }

    if (lane.inlineFolder && !isPluginHost()) {
      row.className = 'file-rail__item file-rail__item--file file-rail__item--folder-inline';
      row.style.paddingLeft = `${fileRailIndent(lane.depth)}px`;
      row.title = fileRailTitle(lane);
      const chev = document.createElement('button');
      chev.type = 'button';
      chev.className = 'file-rail__chev file-rail__chev--collapse';
      chev.textContent = '▾';
      chev.title = `收起 ${shortenFolderLabel(lane.inlineFolder.label)}`;
      chev.addEventListener('click', (e) => {
        e.stopPropagation();
        toggleExpand(lane.inlineFolder.path, e.altKey);
      });
      const label = document.createElement('span');
      label.className = 'file-rail__label';
      const leaf = lane.path.split('/').pop() || lane.label;
      label.textContent = truncatePath(isPluginHost() && lane.type === 'folder' ? leaf : leaf);
      row.appendChild(chev);
      row.appendChild(createRailIcon(lane));
      row.appendChild(label);
      if (lane.type === 'folder' && isPluginHost()) {
        row.classList.remove('file-rail__item--file');
        row.classList.add('file-rail__item--folder');
        row.addEventListener('click', (e) => {
          if (e.altKey && window.HorsewhipPluginBridge?.revealFolder) {
            window.HorsewhipPluginBridge.revealFolder(lane.path === ROOT_BUCKET ? '' : lane.path);
            return;
          }
          toggleExpand(lane.path, e.altKey);
        });
      } else {
        wireFileRailFocus(row, lane);
      }
      return row;
    }

    row.className = `file-rail__item${lane.collapsed || lane.isHeader ? ' file-rail__item--folder' : ' file-rail__item--file'}`;
    row.style.paddingLeft = `${fileRailIndent(lane.depth)}px`;
    const chev = document.createElement('span');
    chev.className = 'file-rail__chev';
    chev.textContent = lane.isHeader ? '▾' : (lane.collapsed ? '▸' : '·');
    const label = document.createElement('span');
    label.className = 'file-rail__label';
    const display = (lane.collapsed || lane.isHeader)
      ? (isPluginHost() ? lane.label : shortenFolderLabel(lane.label))
      : (isFlatLaneLayout() ? lane.path : (lane.path.split('/').pop() || lane.label));
    label.textContent = truncatePath(display);
    row.title = fileRailTitle(lane);
    if (lane.collapsed || lane.isHeader) {
      row.classList.add('file-rail__item--folder');
      row.appendChild(createRailIcon(lane));
      row.appendChild(chev);
      wireFileRailFolderRow(row, lane, chev);
    } else {
      row.appendChild(createRailIcon(lane));
    }
    row.appendChild(label);
    wireFileRailFocus(row, lane);
    return row;
  }

  function renderGraphLink(linkG, link, yScale) {
    if (link.kind === 'lane-track') {
      const x1 = versionX(link.vStart);
      const x2 = versionX(link.vEnd);
      const y = yScale(link.laneIndex);
      appendLinkPath(
        linkG,
        'track',
        false,
        laneLine(x1, y, x2, y),
        null,
        null,
        link.lane.colorDim,
        link.lane.colorDim,
      );
      return;
    }
    if (link.kind === 'lane-idle') {
      const x1 = versionX(link.from.displayColumn ?? link.from.graphX);
      const x2 = versionX(link.to.displayColumn ?? link.to.graphX);
      const y = yScale(link.laneIndex);
      appendLinkPath(
        linkG,
        'idle',
        false,
        laneLine(x1, y, x2, y),
        link,
        null,
        link.lane.colorDim,
        link.lane.colorDim,
      );
      return;
    }
    if (link.kind === 'lane-bridge' || link.kind === 'lane-trace') {
      const x1 = versionX(link.from.displayColumn ?? link.from.graphX);
      const x2 = versionX(link.to.displayColumn ?? link.to.graphX);
      const y = yScale(link.laneIndex);
      const isTrace = link.kind === 'lane-trace';
      appendLinkPath(
        linkG,
        isTrace ? 'trace' : 'lane',
        link.active,
        laneLine(x1, y, x2, y),
        isTrace ? link : { from: link.from, to: link.to },
        null,
        link.lane.color,
        link.lane.colorDim,
      );
      return;
    }
    if (link.kind === 'fork') {
      appendLinkPath(
        linkG,
        'fork',
        link.active,
        curveBridge(link.x1, link.y1, link.x2, link.y2),
        link,
        null,
        link.branchLane.color,
        link.branchLane.colorBright || link.branchLane.color,
      );
      return;
    }
    if (link.kind === 'merge') {
      appendLinkPath(
        linkG,
        'merge',
        link.active,
        laneLine(link.x1, link.y1, link.x2, link.y2),
        link,
        null,
        link.branchLane.color,
        link.branchLane.colorBright || link.branchLane.color,
      );
    }
  }

  function renderGraphNodeEntry(nodeG, node, bundles, yScale) {
    const cx = versionX(node.graphX);
    const cy = yScale(node.laneIndex);
    if (node.isFolderAggregate) {
      const bundle = bundles.find((b) => b.commit.hash === node.hash);
      appendFolderClusterNode(nodeG, node, cx, cy, bundle);
      return;
    }
    if (node.isForkAnchor) {
      appendBranchForkAnchor(nodeG, node, cx, cy);
      return;
    }
    if (node.isMergeAnchor) {
      appendBranchMergeAnchor(nodeG, node, cx, cy);
      return;
    }
    if (node.isVersionStep) {
      appendVersionStepGraphic(nodeG, node, cx, cy);
      return;
    }
    appendNodeGraphic(nodeG, node, cx, cy);
  }

  function prepareGraphShell(catalog) {
    initSvg(catalog.contentHeight);
    const m = CONFIG.MARGIN;
    const innerH = CONFIG.RULER_HEIGHT + Math.max(catalog.lanes.length, 1) * CONFIG.LANE_HEIGHT;
    const bounds = computePanBounds();
    if (state.panX === null && state.parsed) {
      state.panX = panXForHeadFocus(state.parsed);
    } else if (state.panX === null) {
      state.panX = bounds.panMin;
    }
    state.panX = clampPan(state.panX, bounds);
    svgLayout = { innerH, panBounds: bounds, headX: headXContent(catalog.head) };
    const g = gScroll.append('g').attr('transform', `translate(${m.left},${m.top})`);
    renderVersionRuler(g, catalog, innerH);
    graphRenderCtx = {
      catalog,
      yScale: laneCenterY,
      laneSlicesG: g.append('g').attr('class', 'lane-slices'),
      busG: g.append('g').attr('class', 'buses'),
      renderedLanes: new Set(),
    };
  }

  function prepareFileRailAllRows(lanes) {
    const inner = prepareFileRailShell(lanes);
    lanes.forEach((lane) => inner.appendChild(appendFileRailRow(lane)));
    syncFileRailFocusHighlight();
    syncFileRailBoundaryHighlight();
  }

  function getLaneSlice(laneIndex) {
    if (!state.laneSliceCache) state.laneSliceCache = new Map();
    const key = sliceCacheKey(laneIndex);
    let slice = state.laneSliceCache.get(key);
    if (!slice && state.catalog && state.parsed) {
      updateVisibleColumnWindow();
      slice = buildLaneSlice(state.parsed, state.catalog, laneIndex);
      state.laneSliceCache.set(key, slice);
    }
    return slice;
  }

  function unmountLaneSlice(laneIndex) {
    if (!graphRenderCtx) return;
    graphRenderCtx.laneSlicesG.select(`[data-lane-index="${laneIndex}"]`).remove();
    graphRenderCtx.renderedLanes.delete(laneIndex);
  }

  function mountLaneSlice(laneIndex) {
    const ctx = graphRenderCtx;
    const catalog = state.catalog;
    if (!ctx || !catalog) return;
    const lane = catalog.lanes[laneIndex];
    const slice = getLaneSlice(laneIndex);
    if (!slice) return;

    const { yScale } = ctx;
    const root = ctx.laneSlicesG.append('g')
      .attr('class', 'lane-slice')
      .attr('data-lane-index', laneIndex);

    if (!lane.isHeader) {
      root.append('line')
        .attr('class', `lane-guide${lane.isBranchLane ? ' lane-guide--branch' : ''}`)
        .attr('x1', -8)
        .attr('x2', futureExtentX(state.parsed))
        .attr('y1', yScale(laneIndex))
        .attr('y2', yScale(laneIndex))
        .attr('stroke', lane.colorDim)
        .attr('stroke-opacity', 0.42);

    }

    const linkG = root.append('g').attr('class', 'lane-links');
    const nodeG = root.append('g').attr('class', 'lane-nodes');
    slice.links.forEach((link) => renderGraphLink(linkG, link, yScale));
    slice.nodes.forEach((node) => renderGraphNodeEntry(nodeG, node, slice.bundlesOnLane, yScale));
    ctx.renderedLanes.add(laneIndex);
  }

  /** Bus links multi-lane commits; never tie parent lane to its ⎇ child for the same upload. */
  function lanesForCommitBus(onPage) {
    const branchParents = new Set(
      onPage.filter((o) => o.lane.isBranchLane).map((o) => o.lane.parentLanePath),
    );
    return onPage.filter((o) => {
      if (!o.lane.isBranchLane && branchParents.has(o.lane.path)) return false;
      return true;
    });
  }

  function renderBusesInRange(start, end) {
    const ctx = graphRenderCtx;
    const catalog = state.catalog;
    const parsed = state.parsed;
    if (!ctx || !catalog || !parsed) return;

    ctx.busG.selectAll('*').remove();
    const { lanes, focusGraphX } = catalog;
    const yScale = ctx.yScale;

    parsed.commits.forEach((commit) => {
      if (!commitInColumnWindow(commit)) return;
      const onPage = [];
      lanes.forEach((lane) => {
        if (lane.laneIndex < start || lane.laneIndex > end) return;
        if (!commitAppliesToLane(commit, lane, parsed)) return;
        const matched = commit.files.filter((f) => fileMatchesLane(f, lane));
        if (!matched.length) return;
        onPage.push({ lane, laneIndex: lane.laneIndex, lanePath: lane.path, files: matched });
      });
      const busLanes = lanesForCommitBus(onPage);
      if (busLanes.length < 2) return;

      const vx = versionX(commit.displayColumn);
      const ys = busLanes.map((o) => yScale(o.laneIndex));
      const busPad = ICON_SIZE + 3;
      const yTop = Math.min(...ys) + busPad;
      const yBot = Math.max(...ys) - busPad;
      if (yBot <= yTop) return;
      const hub = pickHubLane(busLanes, commit.hash);
      const hubLane = hub.lane;
      const bundle = {
        commit,
        graphX: commit.displayColumn,
        isFocus: columnsMatch(commit.displayColumn, focusGraphX),
        onPage: busLanes,
        hubLanePath: hub.lanePath,
      };
      appendLinkPath(
        ctx.busG,
        'bus',
        bundle.isFocus,
        laneLine(vx, yTop, vx, yBot),
        bundle,
        onBundleClick,
        hubLane.color,
        hubLane.colorDim,
      );
    });
  }

  function collectNodesFromRange(start, end) {
    const nodes = [];
    for (let i = start; i <= end; i += 1) {
      const slice = state.laneSliceCache?.get(i);
      if (slice) nodes.push(...slice.nodes);
    }
    return nodes;
  }

  function tryAssignDefaultPulse(start, end, options) {
    if (!options.assignDefaultPulse || state.pulseNodeId) return;
    const nodes = collectNodesFromRange(start, end);
    if (nodes.length) {
      state.pulseNodeId = pickDefaultPulseNode(nodes, state.parsed);
      return;
    }
    const catalog = state.catalog;
    if (!catalog) return;
    for (let i = 0; i < catalog.lanes.length; i += 1) {
      const slice = getLaneSlice(i);
      if (slice.nodes.length) {
        state.pulseNodeId = pickDefaultPulseNode(slice.nodes, state.parsed);
        if (state.pulseNodeId) return;
      }
    }
  }

  function finalizeGraphView(catalog) {
    refreshNodeIndex();
    setPulseNode(state.pulseNodeId);
    runGraphEntrance();
    const maxScroll = Math.max(0, catalog.contentHeight - els.graphViewport.clientHeight);
    state.scrollTop = Math.min(state.scrollTop, maxScroll);
    applyGraphTransform();
    if (els.fileRail) {
      scrollSync = true;
      els.fileRail.scrollTop = state.scrollTop;
      scrollSync = false;
    }
  }

  function updatePluginBar(laneCount) {
    const el = document.getElementById('plugin-open-status');
    if (!el) return;
    if (state.pluginDemoAllFiles) {
      el.textContent = '演示数据';
      return;
    }
    if (!state.parsed) {
      el.textContent = '读取 git log…';
      return;
    }
    const boundaryN = state.selectedNodeIds.size;
    const ws = state.workspaceFiles?.length ?? 0;
    if (laneCount > 0) {
      const lanes = state.catalog?.lanes || [];
      const dirs = lanes.filter((l) => l.type === 'folder' && (l.collapsed || l.isHeader)).length;
      const files = lanes.filter((l) => l.type === 'file').length;
      const base = files > 0
        ? `${files} 个文件 · ${dirs} 个目录`
        : `${laneCount} 行`;
      const exp = PER_LANE_VERSION ? ' · 每夹V' : '';
      el.textContent = boundaryN > 0 ? `${base} · 边界 ${boundaryN}${exp}` : `${base}${exp}`;
    } else {
      el.textContent = ws > 0 ? '目录已同步，等待 git 记录' : '同步工作区目录…';
    }
  }

  function showPluginEmptyGit() {
    if (els.graphEmpty) {
      els.graphEmpty.classList.remove('hidden');
      const title = els.graphEmpty.querySelector('.graph-empty__title');
      const desc = els.graphEmpty.querySelector('.graph-empty__desc');
      if (title) title.textContent = '暂无泳道';
      if (desc) desc.textContent = '请确认已有 commit，或执行「Horsewhip: Refresh Git Log」';
    }
    if (els.graphHint) els.graphHint.hidden = true;
    if (els.graphZoom) els.graphZoom.hidden = true;
    updatePluginBar(0);
  }

  async function syncVisibleLanes(gen, options = {}) {
    const catalog = state.catalog;
    if (!state.parsed || !catalog || !graphRenderCtx || !renderIsAlive(gen)) return;

    const prevCol = state.visibleColumnWindow;
    updateVisibleColumnWindow();
    if (options.invalidateSlices || (prevCol && (
      Math.abs(prevCol.vMin - state.visibleColumnWindow.vMin) > 0.4
      || Math.abs(prevCol.vMax - state.visibleColumnWindow.vMax) > 0.4
    ))) {
      invalidateLaneSliceCache();
    }

    const vpH = els.graphViewport?.clientHeight || 600;
    const { start, end } = visibleLaneRange(state.scrollTop, vpH, catalog.lanes.length);

    if (end < start) {
      [...graphRenderCtx.renderedLanes].forEach((i) => unmountLaneSlice(i));
      graphRenderCtx.busG.selectAll('*').remove();
      return;
    }

    const toRemove = [...graphRenderCtx.renderedLanes].filter((i) => i < start || i > end);
    toRemove.forEach((i) => unmountLaneSlice(i));

    for (let i = start; i <= end; i += 1) {
      if (!renderIsAlive(gen)) return;
      if (!graphRenderCtx.renderedLanes.has(i)) {
        mountLaneSlice(i);
        await yieldToNextFrame();
      }
    }

    if (!renderIsAlive(gen)) return;
    renderBusesInRange(start, end);
    tryAssignDefaultPulse(start, end, options);
    refreshNodeIndex();
    setPulseNode(state.pulseNodeId);
    updateGraphFocus();
    updateSelectionVisuals();

    if (els.statFiles) {
      const visible = end - start + 1;
      els.statFiles.textContent = `${visible}/${catalog.lanes.length} lanes`;
    }
  }

  function scheduleViewportSync(options = {}) {
    if (!state.catalog || !graphRenderCtx) return;
    if (viewportSyncQueued) return;
    viewportSyncQueued = true;
    const gen = state.renderGeneration;
    requestAnimationFrame(async () => {
      viewportSyncQueued = false;
      if (!renderIsAlive(gen)) return;
      await syncVisibleLanes(gen, options);
    });
  }

  async function bootstrapViewportRender(gen, options = {}) {
    if (!state.parsed || !renderIsAlive(gen)) return;
    hideTooltip();
    clearError();
    state.animateNext = false;
    setGraphStreaming(true);

    try {
      state.laneSliceCache = new Map();
      const catalog = buildLaneCatalog(state.parsed);
      if (!renderIsAlive(gen)) return;
      state.catalog = catalog;

      updatePluginBar(catalog.lanes.length);

      if (isPluginHost() && catalog.lanes.length === 0) {
        graphRenderCtx = null;
        state.catalog = null;
        if (els.graphSvg) els.graphSvg.innerHTML = '';
        showPluginEmptyGit();
        return;
      }

      els.graphEmpty.classList.add('hidden');
      els.graphHint.hidden = false;
      if (els.graphZoom) els.graphZoom.hidden = false;
      prepareFileRailAllRows(catalog.lanes);
      prepareGraphShell(catalog);
      finalizeGraphView(catalog);

      await syncVisibleLanes(gen, options);
      updateStats(state.parsed);
      updatePaginationUI(state.parsed);
    } catch (e) {
      if (renderIsAlive(gen)) showError(e.message || String(e));
    } finally {
      if (renderIsAlive(gen)) setGraphStreaming(false);
    }
  }

  function scheduleRenderFromState(options = {}) {
    const gen = bumpRenderGeneration();
    graphRenderCtx = null;
    state.catalog = null;
    state.laneSliceCache = null;
    bootstrapViewportRender(gen, options);
  }

  function shortenFolderLabel(label) {
    if (label === '(root)') return label;
    return label.endsWith('/') ? label : `${label}/`;
  }

  function renderVersionRuler(g, model, innerH) {
    const rh = CONFIG.RULER_HEIGHT;
    const baseline = rh - 8;
    const headMainlineIdx = headMainlineVersion(state.parsed);
    const pulseCol = pulseColumn(state.parsed);
    const extent = rulerExtent(state.parsed);
    const extendX = versionColumnX(extent);
    const gridG = g.append('g').attr('class', 'version-ruler__grid');
    const chromeG = g.append('g').attr('class', 'version-ruler');

    for (let v = 1; v <= extent; v += 1) {
      const vx = versionColumnX(v);
      const isLit = v <= headMainlineIdx;
      const isHead = v === headMainlineIdx;
      const isFuture = v > headMainlineIdx;

      gridG.append('line')
        .attr('class', `version-ruler__vline${isFuture ? ' version-ruler__vline--future' : ''}`)
        .attr('x1', vx)
        .attr('x2', vx)
        .attr('y1', baseline)
        .attr('y2', innerH);

      chromeG.append('line')
        .attr('class', [
          'version-ruler__tick',
          isLit ? 'version-ruler__tick--lit' : '',
          isFuture ? 'version-ruler__tick--empty' : '',
        ].filter(Boolean).join(' '))
        .attr('x1', vx)
        .attr('x2', vx)
        .attr('y1', baseline - (isLit ? 6 : 3))
        .attr('y2', baseline + 1);

      chromeG.append('text')
        .attr('class', [
          'version-ruler__label',
          isLit ? 'version-ruler__label--lit' : 'version-ruler__label--future',
          isHead && isLit ? 'version-ruler__label--head' : '',
        ].filter(Boolean).join(' '))
        .attr('x', vx)
        .attr('y', baseline - 9)
        .attr('text-anchor', 'middle')
        .text(PER_LANE_VERSION ? `C${v}` : `V${v}`);

      chromeG.append('circle')
        .attr('class', [
          'version-ruler__dot',
          isLit ? 'version-ruler__dot--lit' : '',
          isHead && isLit ? 'version-ruler__dot--head' : '',
          isFuture ? 'version-ruler__dot--future' : '',
        ].filter(Boolean).join(' '))
        .attr('cx', vx)
        .attr('cy', baseline)
        .attr('r', isLit ? 2.2 : 1.4);
    }

    chromeG.append('line')
      .attr('class', 'version-ruler__baseline')
      .attr('x1', versionColumnX(1) - 8)
      .attr('x2', extendX + 8)
      .attr('y1', baseline)
      .attr('y2', baseline);

    if (headMainlineIdx > 0) {
      chromeG.append('line')
        .attr('class', 'version-ruler__progress')
        .attr('x1', versionColumnX(1))
        .attr('x2', versionColumnX(headMainlineIdx))
        .attr('y1', baseline)
        .attr('y2', baseline);
    }

    chromeG.append('line')
      .attr('class', 'version-ruler__separator')
      .attr('x1', -16)
      .attr('x2', extendX + CONFIG.VERSION_SPACING)
      .attr('y1', rh)
      .attr('y2', rh);

    const pulseV = Math.round(pulseCol);
    if (pulseV >= 1 && pulseV <= extent) {
      appendRulerRipples(chromeG, versionColumnX(pulseV), baseline);
    }
  }

  function truncatePath(str) {
    if (str.length <= 44) return str;
    return '…' + str.slice(-43);
  }

  function onFolderClusterClick(ev, node) {
    hideTooltip();
    state.animateNext = false;
    state.selectedLink = null;
    els.linkPanel.hidden = true;
    toggleFolderClusterSelection(node);
    state.focusGraphX = node.displayColumn ?? node.graphX;
    state.pulseNodeId = state.selectedNodeIds.has(node.id) ? node.id : null;
    updateGraphFocus();
    updateSelectionVisuals();
  }

  function nodeClickAnchor(ev) {
    const el = ev?.currentTarget;
    return el instanceof Element ? el.getBoundingClientRect() : null;
  }

  function onFileNodeClick(ev, node) {
    toggleSelectedNode(node);
    state.focusGraphX = node.displayColumn ?? node.graphX;
    if (state.selectedNodeIds.has(node.id) && nodeCanShowTooltip(node) && !isBranchGraphAnchor(node)) {
      state.pulseNodeId = node.id;
    } else if (state.pulseNodeId === node.id) {
      state.pulseNodeId = null;
    }
    state.selectedLink = null;
    els.linkPanel.hidden = true;
    updateGraphFocus();
    updateSelectionVisuals();
  }

  function openNodeModal(node) {
    if (isBranchGraphAnchor(node)) return;
    state.modalNode = node;
    const files = node.files || [node.filePath];
    els.modalTitle.textContent = (() => {
      const ver = nodeVersionTooltipLine(node);
      const subj = commitSubjectForNode(node);
      return subj ? `${ver} · ${subj}` : `${ver} · ${node.hash.slice(0, 7)}`;
    })();
    els.modalMeta.textContent = `${node.author} · ${node.date}`;
    els.modalFile.textContent = node.isFolderAggregate
      ? (node.lanePath === ROOT_BUCKET ? '(root)/' : node.lanePath)
      : files[0];
    els.modalConstraint.textContent = (() => {
      const folderPath = folderBoundaryPathFromNode(node);
      if (folderPath) return constraintFolder(folderPath);
      return files.length === 1 ? constraintSingle(files[0]) : constraintMulti(files);
    })();
    els.modalCmdFile.textContent = node.isFolderAggregate
      ? `# 文件夹边界 · 请按需 checkout 目录下具体文件\n${files.map((f) => cmdCheckout(node.hash, f)).join('\n')}`
      : (files.length === 1
        ? cmdCheckout(node.hash, files[0])
        : files.map((f) => cmdCheckout(node.hash, f)).join('\n'));
    els.modalCmdReset.textContent = cmdResetHard(node.hash);
    els.rollbackDanger.hidden = true;
    els.resetConfirm.value = '';
    els.btnCopyReset.disabled = true;
    els.btnToggleReset.textContent = 'confirm';
    els.modalBackdrop.hidden = false;
  }

  function onBundleClick(bundle) {
    hideTooltip();
    const commit = bundle.commit || bundle;
    const graphX = commit.displayColumn ?? bundle.displayColumn ?? bundle.graphX;
    if (graphX != null) state.focusGraphX = graphX;
    state.selectedLink = bundle;
    els.linkPanel.hidden = true;
    updateGraphFocus();
    updateSelectionVisuals();
  }

  function constraintForNode(node) {
    const folderPath = folderBoundaryPathFromNode(node);
    if (folderPath) return constraintFolder(folderPath);
    const files = node.files || [node.filePath];
    if (files.length === 1) return constraintSingle(files[0]);
    return constraintMulti(files);
  }

  function nodeCanWhip(node) {
    if (!node || node.isVersionStep) return false;
    if (isBranchGraphAnchor(node)) return false;
    if (isFolderBoundaryNode(node)) return true;
    const files = node.files || [node.filePath];
    return Boolean(files?.length && files[0]);
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

  function ensureWhipAudioContext() {
    if (whipAudioContext) return whipAudioContext;
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return null;
    try {
      whipAudioContext = new Ctx();
    } catch {
      return null;
    }
    return whipAudioContext;
  }

  function loadWhipSoundMuted() {
    try {
      return localStorage.getItem(WHIP_SOUND_MUTE_KEY) === '1';
    } catch {
      return false;
    }
  }

  function saveWhipSoundMuted(muted) {
    try {
      localStorage.setItem(WHIP_SOUND_MUTE_KEY, muted ? '1' : '0');
    } catch { /* ignore */ }
  }

  function getWhipCrackAudioUrl() {
    const meta = document.querySelector('meta[name="horsewhip-whip-audio"]');
    const url = meta?.getAttribute('content')?.trim();
    return url || WHIP_CRACK_AUDIO_DEFAULT;
  }

  function whipCrackAudioCandidates(primary) {
    const list = [primary];
    if (/^https?:/i.test(primary) || primary.includes('vscode-webview://')) return list;
    const stem = primary.replace(/\.(mp3|wav|ogg|m4a|webm)$/i, '');
    if (stem !== primary) {
      for (const ext of ['mp3', 'wav', 'ogg', 'm4a']) {
        const alt = `${stem}.${ext}`;
        if (!list.includes(alt)) list.push(alt);
      }
    } else if (!primary.includes('.')) {
      for (const ext of ['mp3', 'wav', 'ogg']) list.push(`${primary}.${ext}`);
    }
    return list;
  }

  function loadWhipCrackAudio() {
    if (whipCrackBuffer || whipCrackUseSynth) return Promise.resolve();
    if (whipCrackLoadPromise) return whipCrackLoadPromise;
    whipCrackLoadPromise = (async () => {
      const ctx = ensureWhipAudioContext();
      if (!ctx) {
        whipCrackUseSynth = true;
        return;
      }
      if (ctx.state === 'suspended') {
        try { await ctx.resume(); } catch { /* ignore */ }
      }
      for (const url of whipCrackAudioCandidates(getWhipCrackAudioUrl())) {
        try {
          const res = await fetch(url);
          if (!res.ok) continue;
          const arr = await res.arrayBuffer();
          whipCrackBuffer = await ctx.decodeAudioData(arr.slice(0));
          return;
        } catch { /* try next format */ }
      }
      whipCrackUseSynth = true;
    })();
    return whipCrackLoadPromise;
  }

  function playWhipCrackFromBuffer(ctx, buffer) {
    const now = ctx.currentTime;
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(1, now);
    src.connect(gain);
    gain.connect(ctx.destination);
    src.start(now);
    src.stop(now + buffer.duration);
  }

  function playWhipCrackSoundSynth(ctx) {
    const now = ctx.currentTime;
    const sampleRate = ctx.sampleRate;
    const crackDur = 0.045;
    const len = Math.floor(sampleRate * crackDur);
    const buf = ctx.createBuffer(1, len, sampleRate);
    const ch = buf.getChannelData(0);
    for (let i = 0; i < len; i++) {
      const t = i / len;
      ch[i] = (Math.random() * 2 - 1) * Math.pow(1 - t, 11);
    }

    const noise = ctx.createBufferSource();
    noise.buffer = buf;

    const hp = ctx.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.value = 3200;

    const peak = ctx.createBiquadFilter();
    peak.type = 'peaking';
    peak.frequency.value = 5200;
    peak.Q.value = 1.6;
    peak.gain.value = 9;

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.88, now);
    gain.gain.exponentialRampToValueAtTime(0.0008, now + crackDur);

    noise.connect(hp);
    hp.connect(peak);
    peak.connect(gain);
    gain.connect(ctx.destination);
    noise.start(now);
    noise.stop(now + crackDur);

    const click = ctx.createOscillator();
    click.type = 'sine';
    click.frequency.setValueAtTime(3800, now);
    click.frequency.exponentialRampToValueAtTime(1800, now + 0.01);
    const clickGain = ctx.createGain();
    clickGain.gain.setValueAtTime(0.14, now);
    clickGain.gain.exponentialRampToValueAtTime(0.0008, now + 0.012);
    click.connect(clickGain);
    clickGain.connect(ctx.destination);
    click.start(now);
    click.stop(now + 0.014);
  }

  function playWhipCrackSound() {
    if (state.whipSoundMuted) return;
    const ctx = ensureWhipAudioContext();
    if (!ctx) return;
    if (ctx.state === 'suspended') void ctx.resume();

    if (whipCrackBuffer) {
      playWhipCrackFromBuffer(ctx, whipCrackBuffer);
      return;
    }
    if (whipCrackUseSynth) {
      playWhipCrackSoundSynth(ctx);
      return;
    }
    void loadWhipCrackAudio().then(() => {
      if (state.whipSoundMuted) return;
      const c = ensureWhipAudioContext();
      if (!c) return;
      if (whipCrackBuffer) playWhipCrackFromBuffer(c, whipCrackBuffer);
      else playWhipCrackSoundSynth(c);
    });
  }

  function syncWhipSoundMuteButton() {
    const btn = els.btnWhipSound;
    if (!btn) return;
    const muted = state.whipSoundMuted;
    btn.setAttribute('aria-pressed', muted ? 'true' : 'false');
    btn.title = muted ? '开启挥鞭音效' : '关闭挥鞭音效';
    btn.setAttribute('aria-label', btn.title);
    btn.classList.toggle('hw-sound-btn--muted', muted);
    const on = btn.querySelector('.hw-sound__on');
    const off = btn.querySelector('.hw-sound__off');
    if (on) on.hidden = muted;
    if (off) off.hidden = !muted;
  }

  function toggleWhipSoundMute() {
    state.whipSoundMuted = !state.whipSoundMuted;
    saveWhipSoundMuted(state.whipSoundMuted);
    syncWhipSoundMuteButton();
  }

  const WHIP_ICON_REV = '6';

  function whipIconSvgHtml(svgClass = 'hw-whip-btn__svg') {
    const large = svgClass === 'hw-whip-float__svg';
    const sparkR = large ? 2 : 1.35;
    const sparkCore = large ? 0.95 : 0.62;
    const gripRx = large ? 1.55 : 1.05;
    const gripRy = large ? 1.02 : 0.68;
    const edgeW = large ? 0.38 : 0.24;
    // Tapered lash: thick at handle (-5.5, 3.45) → hair-thin tip (~6.2, 0)
    return `<svg class="${svgClass}" viewBox="-8 -6 16 12" aria-hidden="true">
      <g class="hw-whip-icon__lash">
        <ellipse class="hw-whip-icon__grip" cx="-5.5" cy="3.45" rx="${gripRx}" ry="${gripRy}" fill="#92400e"/>
        <path fill="#f97316" d="M-6.5,2.45 C-3.55,0.75 1.25,-5.5 6.32,0.04 L6.02,0.2 C0.2,-4.05 -3.35,0.9 -4.48,4.22 Z"/>
        <path class="hw-whip-icon__lash-edge" fill="none" stroke="#c2410c" stroke-width="${edgeW}" stroke-linecap="round" d="M-6.5,2.45 C-3.55,0.75 1.25,-5.5 6.32,0.04"/>
      </g>
      <circle class="hw-whip-icon__spark" cx="6.18" cy="0.1" r="${sparkR}" fill="#fbbf24"/>
      <circle cx="6.18" cy="0.1" r="${sparkCore}" fill="#fef9c3"/>
    </svg>`;
  }

  function mountWhipIcon(host, svgClass) {
    if (!host) return;
    if (host.dataset.whipV === WHIP_ICON_REV && host.querySelector('.hw-whip-icon__lash')) return;
    host.dataset.whipV = WHIP_ICON_REV;
    host.querySelector('svg')?.remove();
    host.insertAdjacentHTML('beforeend', whipIconSvgHtml(svgClass));
  }

  function crackWhipOnSelection(nodes, btnEl) {
    if (!nodes?.length) return;
    const crackTarget = btnEl?.closest?.('.hw-whip-float') || btnEl;
    crackTarget?.classList.add('hw-whip-btn--crack', 'hw-whip-float--crack');
    playWhipCrackSound();
    const text = nodes.length === 1 ? constraintForNode(nodes[0]) : buildBoundaryPrompt();
    copyText(text);
    showCopyToast(
      nodes.length === 1
        ? '约束已复制 · 粘贴到 Chat 即可'
        : `${nodes.length} 个节点约束已复制 · 粘贴到 Chat 即可`,
    );
    setTimeout(() => crackTarget?.classList.remove('hw-whip-btn--crack', 'hw-whip-float--crack'), 520);
  }

  let whipFloatNodesForCopy = null;

  function ensureWhipFloatEl() {
    let el = document.getElementById('hw-whip-float');
    if (!el) {
      el = document.createElement('div');
      el.id = 'hw-whip-float';
      el.className = 'hw-whip-float';
      el.hidden = true;
      el.innerHTML = `<button type="button" class="hw-whip-float__btn hw-whip-btn" aria-label="复制约束" title="复制约束"></button>`;
      el.querySelector('.hw-whip-float__btn').addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        suppressOutsideClick = true;
        if (whipFloatNodesForCopy?.length) {
          crackWhipOnSelection(whipFloatNodesForCopy, el);
        }
      });
      document.body.appendChild(el);
    }
    mountWhipIcon(el.querySelector('.hw-whip-float__btn'), 'hw-whip-float__svg');
    return el;
  }

  function hideWhipFloat() {
    whipFloatNodesForCopy = null;
    const el = document.getElementById('hw-whip-float');
    if (el) {
      el.hidden = true;
      el.classList.remove('hw-whip-float--crack', 'hw-whip-btn--crack');
    }
  }

  function showWhipFloat(_node, nodesForCopy) {
    if (!nodesForCopy?.length) {
      hideWhipFloat();
      return;
    }
    const el = ensureWhipFloatEl();
    whipFloatNodesForCopy = nodesForCopy;
    el.hidden = false;
  }

  function selectedWhipNodes() {
    return [...state.selectedNodeIds]
      .map((id) => state.nodeIndex[id])
      .filter((node) => nodeCanWhip(node));
  }

  function whipHostNode() {
    const lastId = state.lastSelectedNodeId;
    if (lastId && state.selectedNodeIds.has(lastId) && state.nodeIndex[lastId]) {
      return state.nodeIndex[lastId];
    }
    const nodes = selectedWhipNodes();
    return nodes.length ? nodes[nodes.length - 1] : null;
  }

  function updateSelectionVisuals() {
    const bundle = state.selectedLink;
    d3.selectAll('.node-selection-ring').remove();
    d3.selectAll('.node-group').classed('node-group--selected', function () {
      const d = d3.select(this).datum();
      return d?.id && state.selectedNodeIds.has(d.id);
    });
    d3.selectAll('.node-group').classed('node-group--boundary', function () {
      const d = d3.select(this).datum();
      return d?.id && state.selectedNodeIds.has(d.id);
    });
    setPulseNode(state.pulseNodeId);
    d3.selectAll('.link-group').classed('link-group--selected', function () {
      const d = d3.select(this).select('.link-core').datum();
      return bundle && d && (d.id === bundle.id || d.to?.id === bundle.id);
    });

    const whipNodes = selectedWhipNodes();
    const anchorNode = whipHostNode();
    if (whipNodes.length && anchorNode) {
      showWhipFloat(anchorNode, whipNodes);
    } else {
      hideWhipFloat();
    }
  }

  function closeModal() {
    els.modalBackdrop.hidden = true;
    state.modalNode = null;
    updateSelectionVisuals();
  }

  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function positionTooltipFromRect(rect) {
    els.tooltip.style.transform = '';
    const pad = 12;
    let left = rect.right + pad;
    let top = rect.top + rect.height / 2 - 20;
    const tip = els.tooltip;
    const tipW = tip.offsetWidth || 240;
    const tipH = tip.offsetHeight || 96;
    if (left + tipW > window.innerWidth - 10) left = rect.left - tipW - pad;
    if (top + tipH > window.innerHeight - 10) top = window.innerHeight - tipH - 10;
    if (top < 10) top = 10;
    tip.style.left = `${Math.max(10, left)}px`;
    tip.style.top = `${top}px`;
  }

  function refreshNodeIndex() {
    state.nodeIndex = {};
    if (!gScroll) return;
    gScroll.selectAll('.node-group[data-node-id]').each(function () {
      const d = d3.select(this).datum();
      if (d?.id) state.nodeIndex[d.id] = d;
    });
  }

  function pickFileNodeFromPointer(e) {
    const svg = els.graphSvg;
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
    const node = state.nodeIndex[nodeId] || d3.select(gEl).datum();
    if (!node || !nodeCanShowTooltip(node)) return null;

    const hit = gEl.querySelector('.node-hit:not(.node-hit--folder)') || gEl;
    return { node, hit };
  }

  function findNodeGroupEl(nodeId) {
    if (!els.graphSvg || !nodeId) return null;
    const esc = typeof CSS !== 'undefined' && CSS.escape
      ? CSS.escape(nodeId)
      : nodeId.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
    return els.graphSvg.querySelector(`[data-node-id="${esc}"]`);
  }

  function resolveTooltipAnchor(node, anchorRect) {
    if (anchorRect && anchorRect.width > 0 && anchorRect.height > 0) return anchorRect;
    const hit = findNodeGroupEl(node.id)?.querySelector('.node-hit');
    if (hit) return hit.getBoundingClientRect();
    return null;
  }

  function showTooltipForNode(node, anchorRect) {
    const files = node.files || [node.filePath];
    const ver = nodeVersionTooltipLine(node);
    const subj = commitSubjectForNode(node);
    const fileLine = node.isForkAnchor
      ? `主泳道在此处分叉 → ⎇ ${node.branchName || 'branch'}`
      : node.isMergeAnchor
        ? `分支合入主泳道 · ⎇ ${node.branchName || 'branch'}`
        : node.lane?.isBranchLane
          ? (() => {
            const seg = node.lane.branchSegment;
            const forkC = seg && state.parsed?.commitMap[seg.forkHash];
            const parentPath = node.lane?.parentLanePath;
            const forkLabel = forkC && parentPath
              ? (PER_LANE_VERSION && forkC.laneVersions?.[parentPath] != null
                ? formatLaneVersion(forkC.laneVersions[parentPath])
                : formatGlobalCommitColumn(forkC.displayColumn))
              : '?';
            return `⎇ ${seg?.name || 'branch'} · 从主泳道 ${forkLabel} 分出`;
          })()
          : node.isFolderAggregate
            ? (node.lanePath === ROOT_BUCKET ? '(root)/' : (node.lanePath || node.label))
            : files[0];
    const foot = node.isForkAnchor
      ? (PER_LANE_VERSION ? '从该文件夹版本处分出（横轴为上传 Cn）' : '从该版本列分出')
      : node.isMergeAnchor
        ? (PER_LANE_VERSION ? '沿分支泳道合入（横轴为上传 Cn）' : '沿分支泳道合入该版本列')
        : node.isFolderAggregate
          ? '单击选中文件夹边界 · 双击详情 · 点小马鞭复制'
          : '单击切换选中 · 双击详情 · 点小马鞭复制';
    const accent = node.lane?.color || '#6d7ce8';
    const verLine = subj ? `${ver} · ${subj}` : ver;
    if (!els.tooltip) return;
    els.tooltip.removeAttribute('hidden');
    els.tooltip.classList.add('is-open');
    els.tooltip.style.display = 'block';
    els.tooltip.style.setProperty('--tooltip-accent', accent);
    els.tooltip.innerHTML = `
      <div class="tooltip__head">
        <span class="tooltip__ver">${escapeHtml(verLine)}</span>
      </div>
      <div class="tooltip__meta">${escapeHtml(node.author)} · ${escapeHtml(node.date)}${subj ? '' : ` · ${escapeHtml(node.hash.slice(0, 7))}`}</div>
      <div class="tooltip__file">${escapeHtml(fileLine)}</div>
      <div class="tooltip__foot">${escapeHtml(foot)}</div>
    `;
    const rect = resolveTooltipAnchor(node, anchorRect);
    if (rect) positionTooltipFromRect(rect);
    else {
      els.tooltip.style.left = '50%';
      els.tooltip.style.top = '42%';
      els.tooltip.style.transform = 'translate(-50%, -50%)';
    }
  }

  function hideTooltip() {
    if (!els.tooltip) return;
    els.tooltip.setAttribute('hidden', '');
    els.tooltip.classList.remove('is-open');
    els.tooltip.style.display = '';
    d3.selectAll('.node-group--hover').classed('node-group--hover', false);
  }

  function bindFolderNodePointer(g, node) {
    g.style('pointer-events', 'all');
    g.on('pointerenter.tooltip', () => {
      g.classed('node-group--hover', true);
      const hit = g.select('.node-hit').node();
      const rect = hit instanceof Element ? hit.getBoundingClientRect() : null;
      showTooltipForNode(node, rect);
    });
    g.on('pointerleave.tooltip', () => {
      g.classed('node-group--hover', false);
      hideTooltip();
    });
  }

  function bindFileNodePointer(g, node) {
    g.style('pointer-events', 'all');
    g.on('pointerenter.tooltip', (ev) => {
      g.classed('node-group--hover', true);
      if (!nodeCanShowTooltip(node)) return;
      const hit = g.select('.node-hit').node();
      const rect = hit instanceof Element ? hit.getBoundingClientRect() : null;
      showTooltipForNode(node, rect);
    });
    g.on('pointerleave.tooltip', () => {
      g.classed('node-group--hover', false);
      hideTooltip();
    });
  }

  let suppressOutsideClick = false;
  let nodeClickTimer = null;

  function initGraphViewportEvents() {
    if (els.graphViewport.dataset.hwBound) return;
    els.graphViewport.dataset.hwBound = '1';

    const onGraphClick = (e) => {
      const picked = pickFileNodeFromPointer(e);
      if (!picked) return;
      suppressOutsideClick = true;
      e.stopPropagation();
      if (nodeClickTimer) clearTimeout(nodeClickTimer);
      nodeClickTimer = setTimeout(() => {
        nodeClickTimer = null;
        onFileNodeClick(e, picked.node);
      }, 240);
    };

    els.graphViewport.addEventListener('click', onGraphClick);
    els.graphViewport.addEventListener('pointerleave', hideTooltip);

    els.graphViewport.addEventListener('dblclick', (e) => {
      const picked = pickFileNodeFromPointer(e);
      if (!picked) return;
      if (nodeClickTimer) {
        clearTimeout(nodeClickTimer);
        nodeClickTimer = null;
      }
      e.preventDefault();
      e.stopPropagation();
      suppressOutsideClick = true;
      openNodeModal(picked.node);
    });
  }

  async function copyText(text, btn) {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      const ta = document.createElement('textarea');
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
    }
    if (btn) {
      if (btn.classList.contains('hw-whip-btn')) return;
      const orig = btn.textContent;
      btn.textContent = '✓';
      btn.classList.add('copied');
      setTimeout(() => { btn.textContent = orig; btn.classList.remove('copied'); }, 1500);
    }
  }

  function showError(msg) {
    els.parseError.textContent = msg;
    els.parseError.hidden = false;
    els.logInput?.classList.add('shake');
    setTimeout(() => els.logInput?.classList.remove('shake'), 400);
  }

  function clearError() {
    els.parseError.hidden = true;
  }

  function updateStats(parsed) {
    if (!els.stats) return;
    els.stats.hidden = false;
    const loaded = parsed.loadedCommitCount ?? parsed.commits.length;
    const total = parsed.totalCommitsInLog ?? loaded;
    els.statCommits.textContent = total > loaded ? `${loaded}/${total} ver` : `${loaded} ver`;
    els.statFiles.textContent = `${getAllFiles(parsed).length} files`;
  }

  function renderFromState(options = {}) {
    scheduleRenderFromState(options);
  }

  function loadAndRender(text) {
    try {
      const savedExpanded = isPluginHost() ? new Set(state.expandedPaths) : null;
      state.rawLogText = text;
      state.commitLoadLimit = CONFIG.COMMIT_PAGE_SIZE;
      state.totalCommitsInLog = 0;
      const sliced = sliceLogByCommitLimit(text, state.commitLoadLimit);
      state.totalCommitsInLog = sliced.totalCommits;
      const parsed = parseGitLog(sliced.text);
      parsed.totalCommitsInLog = sliced.totalCommits;
      parsed.loadedCommitCount = sliced.loaded;
      state.parsed = parsed;
      state.panX = null;
      state.scrollTop = 0;
      state.expandedPaths = new Set();
      state.focusGraphX = null;
      state.pulseNodeId = null;
      state.graphZoom = 1;
      if (els.zoomLabel) els.zoomLabel.textContent = '100%';
      if (isPluginHost() && savedExpanded?.size) {
        savedExpanded.forEach((p) => state.expandedPaths.add(p));
      }
      state.animateNext = true;
      graphRenderCtx = null;
      state.catalog = null;
      state.laneSliceCache = null;
      renderFromState({ assignDefaultPulse: true });
    } catch (e) {
      showError(e.message || String(e));
    }
  }

  function loadMoreCommits() {
    if (!state.rawLogText || !state.parsed) return;
    const total = state.totalCommitsInLog || state.parsed.totalCommitsInLog;
    if (state.commitLoadLimit >= total) return;
    state.commitLoadLimit = Math.min(state.commitLoadLimit + CONFIG.COMMIT_PAGE_STEP, total);
    const sliced = sliceLogByCommitLimit(state.rawLogText, state.commitLoadLimit);
    const parsed = parseGitLog(sliced.text);
    parsed.totalCommitsInLog = total;
    parsed.loadedCommitCount = sliced.loaded;
    state.parsed = parsed;
    state.panX = null;
    scheduleRenderFromState({ assignDefaultPulse: !state.pulseNodeId });
  }

  function nudgePan(delta) {
    if (!state.parsed || !svgLayout) return;
    const bounds = svgLayout.panBounds || computePanBounds();
    const panMin = bounds.panMin;
    const next = state.panX + delta;

    if (next < panMin) {
      state.panX = panMin;
    } else {
      state.panX = next;
    }
    applyGraphTransform();
    scheduleViewportSync({ invalidateSlices: true });
  }

  function nudgeVerticalScroll(delta) {
    const max = Math.max(0, els.fileRailInner.offsetHeight - els.fileRail.clientHeight);
    state.scrollTop = Math.max(0, Math.min(max, state.scrollTop + delta));
    applyGraphTransform();
    scrollSync = true;
    els.fileRail.scrollTop = state.scrollTop;
    scrollSync = false;
    scheduleViewportSync();
  }

  els.btnGenerate?.addEventListener('click', () => {
    const text = els.logInput?.value?.trim() ?? '';
    if (!text) { showError('paste log or load demo'); return; }
    loadAndRender(text);
  });

  els.btnDemo?.addEventListener('click', () => {
    if (els.logInput) els.logInput.value = DEMO_GIT_LOG;
    loadAndRender(DEMO_GIT_LOG);
  });

  els.btnMegaDemo?.addEventListener('click', () => {
    if (typeof buildMegaDemoLog !== 'function') {
      showError('mega demo unavailable');
      return;
    }
    clearError();
    const t0 = performance.now();
    const built = buildMegaDemoLog();
    const ms = Math.round(performance.now() - t0);
    els.logInput.value = `/* mega demo: ${built.stats.files} files · ${built.stats.commits} commits · generated ${ms}ms — not stored in textarea */`;
    els.pasteDrop.hidden = true;
    els.btnPasteToggle?.classList.remove('btn--solid');
    loadAndRender(built.log);
  });

  els.btnClear?.addEventListener('click', () => {
    if (els.logInput) els.logInput.value = '';
    state.parsed = null;
    state.panX = null;
    state.scrollTop = 0;
    state.expandedPaths = new Set();
    state.focusGraphX = null;
    state.pulseNodeId = null;
    state.catalog = null;
    state.laneSliceCache = null;
    state.rawLogText = null;
    state.boundaryFiles.clear();
    state.selectedNodeIds.clear();
    syncBoundaryBar();
    graphRenderCtx = null;
    d3.select(els.graphSvg).selectAll('*').remove();
    els.fileRailInner.innerHTML = '';
    els.graphEmpty.classList.remove('hidden');
    els.graphHint.hidden = true;
    if (els.graphZoom) els.graphZoom.hidden = true;
    els.stats.hidden = true;
    els.linkPanel.hidden = true;
    els.largeWarn.hidden = true;
    hideTooltip();
    clearError();
  });

  els.btnPasteToggle?.addEventListener('click', () => {
    const open = els.pasteDrop?.hidden;
    if (els.pasteDrop) els.pasteDrop.hidden = !open;
    els.btnPasteToggle?.classList.toggle('btn--solid', open);
    if (open) els.logInput?.focus();
  });

  els.cmdChip?.addEventListener('click', () => {
    copyText('git log --all -100 --name-only --pretty=format:"%H|%P|%D|%an|%ad|%s"', els.cmdChip);
  });

  if (els.zoomLabel) els.zoomLabel.textContent = '100%';

  els.fileFilter?.addEventListener('input', () => {
    state.fileFilter = els.fileFilter.value;
    renderFromState();
  });

  try {
    const savedLayout = localStorage.getItem(LANE_LAYOUT_KEY);
    if (savedLayout === LANE_LAYOUT_FLAT || savedLayout === LANE_LAYOUT_GROUPED) {
      state.laneLayout = savedLayout;
    }
  } catch { /* ignore */ }
  syncLaneLayoutButton();
  els.btnLaneLayout?.addEventListener('click', toggleLaneLayout);

  state.whipSoundMuted = loadWhipSoundMuted();
  try { localStorage.removeItem('horsewhip:whip-icon-image'); } catch { /* legacy cleanup */ }
  void loadWhipCrackAudio();
  syncWhipSoundMuteButton();
  els.btnWhipSound?.addEventListener('click', (e) => {
    e.stopPropagation();
    toggleWhipSoundMute();
  });

  els.fileRail?.addEventListener('scroll', () => {
    if (scrollSync) return;
    state.scrollTop = els.fileRail.scrollTop;
    applyGraphTransform();
    scheduleViewportSync();
  });

  els.graphViewport.addEventListener('wheel', (e) => {
    if (!state.parsed) return;
    e.preventDefault();
    if (e.ctrlKey || e.metaKey) {
      if (e.deltaY < 0) nudgeZoom(CONFIG.ZOOM_STEP);
      else if (e.deltaY > 0) nudgeZoom(1 / CONFIG.ZOOM_STEP);
      return;
    }
    const raw = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY;
    if (raw === 0) return;
    const step = Math.max(versionScale() * 0.5, Math.min(32, Math.abs(raw) * 0.1));
    if (raw < 0) nudgePan(-step);
    else nudgePan(step);
  }, { passive: false });

  els.btnZoomIn?.addEventListener('click', () => nudgeZoom(CONFIG.ZOOM_STEP));
  els.btnZoomOut?.addEventListener('click', () => nudgeZoom(1 / CONFIG.ZOOM_STEP));
  els.btnLoadMoreCommits?.addEventListener('click', loadMoreCommits);

  function ensureBoundaryWhipButton() {
    const btn = els.btnBoundaryCopy;
    if (!btn) return;
    btn.classList.add('hw-whip-btn');
    btn.title = '复制约束';
    btn.setAttribute('aria-label', '复制约束');
    mountWhipIcon(btn, 'hw-whip-btn__svg');
  }

  function wireBoundaryBar() {
    ensureBoundaryWhipButton();
    if (els.btnBoundaryChat && !isPluginHost()) {
      els.btnBoundaryChat.hidden = true;
    }
    els.btnBoundaryClear?.addEventListener('click', () => clearNodeSelection());
    els.btnBoundaryCopy?.addEventListener('click', () => {
      const nodes = selectedWhipNodes();
      if (!nodes.length) return;
      crackWhipOnSelection(nodes, els.btnBoundaryCopy);
    });
    els.btnBoundaryChat?.addEventListener('click', () => {
      const text = buildBoundaryPrompt();
      if (!text) return;
      if (window.HorsewhipPluginBridge?.insertBoundaryToChat) {
        window.HorsewhipPluginBridge.insertBoundaryToChat(text);
      } else {
        copyText(text, els.btnBoundaryChat);
      }
    });
    syncBoundaryBar();
  }
  wireBoundaryBar();

  els.modalClose.addEventListener('click', closeModal);
  els.modalBackdrop.addEventListener('click', (e) => {
    if (e.target === els.modalBackdrop) closeModal();
  });

  els.btnCopyConstraint.addEventListener('click', () => copyText(els.modalConstraint.textContent, els.btnCopyConstraint));
  els.btnCopyCheckout.addEventListener('click', () => copyText(els.modalCmdFile.textContent, els.btnCopyCheckout));
  els.btnToggleReset.addEventListener('click', () => {
    const hidden = els.rollbackDanger.hidden;
    els.rollbackDanger.hidden = !hidden;
    els.btnToggleReset.textContent = hidden ? 'hide' : 'confirm';
  });
  els.resetConfirm.addEventListener('input', () => {
    els.btnCopyReset.disabled = els.resetConfirm.value.trim() !== 'RESET';
  });
  els.btnCopyReset.addEventListener('click', () => {
    if (els.resetConfirm.value.trim() === 'RESET') copyText(els.modalCmdReset.textContent, els.btnCopyReset);
  });
  els.btnCopyLink.addEventListener('click', () => {
    copyText(els.linkPanel.dataset.constraint || els.linkConstraintText.textContent, els.btnCopyLink);
  });

  document.addEventListener('keydown', (e) => {
    if (e.target.matches('textarea, input') && e.key !== 'Escape') return;
    if (e.key === 'Escape') { hideTooltip(); closeModal(); return; }
    if (!state.parsed) return;
    if (e.key === 'ArrowLeft') { e.preventDefault(); nudgePan(-versionScale()); }
    if (e.key === 'ArrowRight') { e.preventDefault(); nudgePan(versionScale()); }
    if (e.key === '-' || e.key === '_') { e.preventDefault(); nudgeZoom(1 / CONFIG.ZOOM_STEP); }
    if (e.key === '=' || e.key === '+') { e.preventDefault(); nudgeZoom(CONFIG.ZOOM_STEP); }
    if (e.key === 'ArrowUp') { e.preventDefault(); nudgeVerticalScroll(-CONFIG.LANE_HEIGHT); }
    if (e.key === 'ArrowDown') { e.preventDefault(); nudgeVerticalScroll(CONFIG.LANE_HEIGHT); }
  });

  window.addEventListener('resize', () => {
    if (!state.parsed) return;
    if (state.catalog) scheduleViewportSync();
    else scheduleRenderFromState();
  });

  initGraphViewportEvents();

  document.addEventListener('click', (e) => {
    if (suppressOutsideClick) {
      suppressOutsideClick = false;
      return;
    }
    if (e.target.closest('#tooltip')) return;
    if (e.target.closest('#hw-whip-float')) return;
    if (els.graphSvg?.contains(e.target)) return;
    if (!e.target.closest('.link-segment') && !e.target.closest('#link-panel')) {
      hideTooltip();
      if (!els.modalBackdrop.hidden) return;
      state.selectedLink = null;
      state.selectedNodeIds.clear();
      state.lastSelectedNodeId = null;
      state.boundaryFiles.clear();
      els.linkPanel.hidden = true;
      updateSelectionVisuals();
    }
  });

  /** VS Code / Cursor webview entry (see extension/media/panel-bridge.js). */
  if (PER_LANE_VERSION) document.documentElement.classList.add('hw-per-lane-v');

  window.HorsewhipApp = {
    loadLog: loadAndRender,
    loadDemo() {
      if (typeof DEMO_GIT_LOG !== 'undefined') {
        if (isPluginHost()) state.pluginDemoAllFiles = true;
        loadAndRender(DEMO_GIT_LOG);
      }
    },
    setWorkspaceFiles(paths) {
      if (!isPluginHost()) return;
      state.pluginDemoAllFiles = false;
      state.workspaceFiles = Array.isArray(paths) ? paths : [];
      if (state.parsed) scheduleRenderFromState();
    },
    getModalNode: () => state.modalNode,
    getBoundaryFiles: getBoundaryFilesList,
    buildBoundaryPrompt,
    clearNodeSelection,
  };

})();
