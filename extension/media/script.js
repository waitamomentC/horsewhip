(() => {
  // src/core/hw.js
  var hw = {};

  // src/core/config.js
  var CONFIG = {
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
    NODE_HUB_STALE: 7
  };
  var ROOT_BUCKET = "__root__";
  var PER_LANE_VERSION = true;
  var BRANCH_RAIL_ENABLED = false;
  var BRANCH_FUSION_ENABLED = false;
  var BOUNDARY_BAR_ENABLED = false;
  var LANE_LAYOUT_KEY = "hw-lane-layout";
  var WHIP_SOUND_MUTE_KEY = "horsewhip:whip-sound-muted";
  var WHIP_CRACK_AUDIO_DEFAULT = "sound/whip.wav";
  var LANE_LAYOUT_GROUPED2 = "grouped";
  var LANE_LAYOUT_FLAT2 = "flat";
  var LANE_HUES = [210, 160, 280, 35, 350, 120, 45, 300, 190, 15, 250, 80];
  var CODE_FILE_RE = /\.(tsx?|jsx?|mjs|cjs|vue|svelte|py|go|rs|java|kt|kts|swift|c|cc|cpp|cxx|h|hh|hpp|cs|rb|php|scala|css|scss|less|sass|html?|sh|bash|zsh|sql|r|lua|dart|elm)$/i;
  var CONFIG_FILE_RE = /\.(json|jsonc|yaml|yml|toml|ini|cfg|conf|xml|plist|properties|lock|npmrc|editorconfig|env)$/i;
  var CONFIG_BASENAMES = /^(package-lock\.json|package\.json|tsconfig\.json|jsconfig\.json|\.env(\..+)?|\.gitignore|\.prettierrc|\.eslintrc|docker-compose\.ya?ml)$/i;
  var ICON_SIZE = 5;
  var VERSION_STEP_ICON_SCALE = 0.5;
  var ICON_HIT_PAD = 4;
  var LANE_VIEW_OVERSCAN = 4;
  Object.assign(hw, {
    CONFIG,
    ROOT_BUCKET,
    PER_LANE_VERSION,
    BRANCH_RAIL_ENABLED,
    BRANCH_FUSION_ENABLED,
    BOUNDARY_BAR_ENABLED,
    LANE_LAYOUT_KEY,
    WHIP_SOUND_MUTE_KEY,
    WHIP_CRACK_AUDIO_DEFAULT,
    LANE_LAYOUT_GROUPED: LANE_LAYOUT_GROUPED2,
    LANE_LAYOUT_FLAT: LANE_LAYOUT_FLAT2,
    LANE_HUES,
    CODE_FILE_RE,
    CONFIG_FILE_RE,
    CONFIG_BASENAMES,
    ICON_SIZE,
    VERSION_STEP_ICON_SCALE,
    ICON_HIT_PAD,
    LANE_VIEW_OVERSCAN
  });

  // src/core/state.js
  var state = {
    parsed: null,
    panX: null,
    fileFilter: "",
    scrollTop: 0,
    expandedPaths: /* @__PURE__ */ new Set(),
    selectedNodeIds: /* @__PURE__ */ new Set(),
    lockedNodeIds: /* @__PURE__ */ new Set(),
    /** @type {Array<{ nodeId: string, commit: string, branch: string, lanePath: string, files: string[] }>} */
    lockTargets: [],
    selectedLink: null,
    pulseNodeId: null,
    nodeIndex: {},
    focusGraphX: null,
    modalNode: null,
    animateNext: true,
    laneLayout: "grouped",
    renderGeneration: 0,
    catalog: null,
    laneSliceCache: null,
    rawLogText: null,
    commitLoadLimit: 100,
    totalCommitsInLog: 0,
    graphZoom: 1,
    visibleColumnWindow: null,
    workspaceFiles: null,
    pluginDemoAllFiles: false,
    boundaryFiles: /* @__PURE__ */ new Set(),
    lastSelectedNodeId: null,
    focusedFilePath: null,
    viewportAnimGeneration: 0,
    whipSoundMuted: false,
    gitBranches: [],
    currentGitBranch: "",
    highlightBranchName: null,
    selectedBranchNames: /* @__PURE__ */ new Set(),
    viewportInteracting: false,
    headSnapshotBeforeLoad: null
  };
  var whipAudioContext = null;
  var whipCrackBuffer = null;
  var whipCrackLoadPromise = null;
  var whipCrackUseSynth = false;
  var suppressOutsideClick = false;
  var nodeClickTimer = null;
  var svgLayout = null;
  var scrollSync = false;
  var graphRenderCtx = null;
  var viewportSyncQueued = false;
  var viewportInteractEndTimer = null;
  var svgRoot;
  var gMain;
  var gScroll;
  Object.assign(hw, {
    state,
    whipAudioContext,
    whipCrackBuffer,
    whipCrackLoadPromise,
    whipCrackUseSynth,
    suppressOutsideClick,
    nodeClickTimer,
    svgLayout,
    scrollSync,
    graphRenderCtx,
    viewportSyncQueued,
    viewportInteractEndTimer,
    svgRoot,
    gMain,
    gScroll
  });

  // src/core/dom.js
  var $ = (sel) => document.querySelector(sel);
  var els = {
    logInput: $("#log-input"),
    pasteDrop: $("#paste-drop"),
    btnPasteToggle: $("#btn-paste-toggle"),
    btnGenerate: $("#btn-generate"),
    btnDemo: $("#btn-demo"),
    btnMegaDemo: $("#btn-mega-demo"),
    btnClear: $("#btn-clear"),
    cmdChip: $("#cmd-chip"),
    stats: $("#stats"),
    statCommits: $("#stat-commits"),
    statFiles: $("#stat-files"),
    fileFilter: $("#file-filter"),
    btnLaneLayout: $("#btn-lane-layout"),
    stage: $("#stage"),
    fileRail: $("#file-rail"),
    branchRail: $("#branch-rail"),
    fuseBar: $("#hw-fuse-bar"),
    fuseCount: $("#hw-fuse-count"),
    fuseNames: $("#hw-fuse-names"),
    btnFuseClear: $("#btn-fuse-clear"),
    btnFuseCopy: $("#btn-fuse-copy"),
    btnFuseChat: $("#btn-fuse-chat"),
    fileRailInner: $("#file-rail-inner"),
    graphViewport: $("#graph-viewport"),
    graphScroll: $("#graph-scroll"),
    graphEmpty: $("#graph-empty"),
    graphHint: $("#graph-hint"),
    graphSvg: $("#graph-svg"),
    parseError: $("#parse-error"),
    largeWarn: $("#large-data-warn"),
    largeWarnText: $("#large-warn-text"),
    btnLoadMoreCommits: $("#btn-load-more-commits"),
    btnZoomIn: $("#btn-zoom-in"),
    btnZoomOut: $("#btn-zoom-out"),
    btnWhipSound: $("#btn-whip-sound"),
    graphZoom: $("#graph-zoom"),
    zoomLabel: $("#zoom-label"),
    linkPanel: $("#link-panel"),
    linkConstraintText: $("#link-constraint-text"),
    btnCopyLink: $("#btn-copy-link"),
    modalBackdrop: $("#modal-backdrop"),
    modalTitle: $("#modal-title"),
    modalMeta: $("#modal-meta"),
    modalFile: $("#modal-file"),
    modalConstraint: $("#modal-constraint"),
    modalClose: $("#modal-close"),
    tooltip: $("#tooltip"),
    boundaryBar: $("#hw-boundary"),
    boundaryTitle: $("#hw-boundary-title"),
    boundaryCount: $("#hw-boundary-count"),
    boundaryFiles: $("#hw-boundary-files"),
    boundaryPreview: $("#hw-boundary-preview"),
    btnBoundaryClear: $("#btn-boundary-clear"),
    btnBoundaryCopy: $("#btn-boundary-copy"),
    btnBoundaryChat: $("#btn-boundary-chat")
  };
  function isPluginHost() {
    return document.body.classList.contains("hw-plugin");
  }
  Object.assign(hw, { $, els, isPluginHost });

  // src/git/parse.js
  function isCommitHeaderLine(line) {
    const t = line.trim();
    return /^[0-9a-f]{7,40}\|/i.test(t);
  }
  function sliceLogByCommitLimit(text, maxCommits) {
    const lines = text.split("\n");
    const blocks = [];
    let block = null;
    for (const line of lines) {
      if (hw.isCommitHeaderLine(line)) {
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
      text: kept.map((b) => b.join("\n")).join("\n\n"),
      totalCommits: total,
      loaded: kept.length
    };
  }
  function resolveHeadHash(commits, commitMap, gitBranches) {
    for (const name of ["main", "master"]) {
      const tip = gitBranches?.find((b) => b.name === name)?.hash;
      if (tip && commitMap[tip]) return tip;
    }
    for (const name of ["main", "master"]) {
      const hit = commits.find((c) => (c.refs || []).some((r) => hw.normalizeRefName(r) === name));
      if (hit) return hit.hash;
    }
    return commits[commits.length - 1]?.hash || null;
  }
  function parseGitLog(text, options = {}) {
    const commits = [];
    let current = null;
    for (const rawLine of text.split("\n")) {
      const line = rawLine.trim();
      if (!line) continue;
      const m6 = line.match(/^([0-9a-f]{7,40})\|([^|]*)\|([^|]*)\|([^|]+)\|([^|]+)\|(.+)$/i);
      const m5 = line.match(/^([0-9a-f]{7,40})\|([^|]*)\|([^|]*)\|(.+?)\|(.+)$/i);
      const m4p = line.match(/^([0-9a-f]{7,40})\|([^|]*)\|(.+?)\|(.+)$/i);
      const m3 = line.match(/^([0-9a-f]{7,40})\|(.+?)\|(.+)$/i);
      if (m6) {
        if (current) commits.push(current);
        const parents = m6[2].trim() && m6[2].trim() !== "-" ? m6[2].trim().split(/\s+/) : [];
        const refs = hw.parseRefs(m6[3]);
        current = {
          hash: m6[1],
          parents,
          refs,
          author: m6[4],
          date: m6[5],
          subject: m6[6].trim(),
          files: []
        };
      } else if (m5) {
        if (current) commits.push(current);
        const parents = m5[2].trim() && m5[2].trim() !== "-" ? m5[2].trim().split(/\s+/) : [];
        const refs = hw.parseRefs(m5[3]);
        current = {
          hash: m5[1],
          parents,
          refs,
          author: m5[4],
          date: m5[5],
          files: []
        };
      } else if (m4p) {
        if (current) commits.push(current);
        const parents = m4p[2].trim() && m4p[2].trim() !== "-" ? m4p[2].trim().split(/\s+/) : [];
        current = {
          hash: m4p[1],
          parents,
          refs: [],
          author: m4p[3],
          date: m4p[4],
          files: []
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
      throw new Error('\u65E0\u6CD5\u89E3\u6790 log\u3002\u8BF7\u4F7F\u7528 git log --all --name-only --pretty=format:"%H|%P|%D|%an|%ad|%s"');
    }
    commits.reverse();
    const commitMap = hw.buildCommitMap(commits);
    const headHash = hw.resolveHeadHash(commits, commitMap, options.gitBranches || []);
    const dag = hw.analyzeDAG(commits, commitMap, headHash);
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
    hw.assignDisplayColumns(commits);
    const fileTimelines = {};
    for (const c of commits) {
      for (const f of c.files) {
        if (!fileTimelines[f]) fileTimelines[f] = [];
        fileTimelines[f].push({
          commitHash: c.hash,
          date: c.date,
          versionIndex: c.versionIndex,
          graphX: c.graphX,
          displayColumn: c.displayColumn
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
      loadedCommitCount: commits.length
    };
  }
  function parseRefs(raw) {
    if (!raw || !raw.trim()) return [];
    return raw.split(",").map((s) => s.trim().replace(/^\(|\)$/g, "")).map((s) => s.replace(/^HEAD -> /, "")).filter(Boolean);
  }
  function buildCommitMap(commits) {
    const map = {};
    commits.forEach((c) => {
      map[c.hash] = c;
    });
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
  Object.assign(hw, {
    isCommitHeaderLine,
    sliceLogByCommitLimit,
    resolveHeadHash,
    parseGitLog,
    parseRefs,
    buildCommitMap
  });

  // src/git/branches.js
  function branchRefNames() {
    const names = /* @__PURE__ */ new Set();
    (hw.state.gitBranches || []).forEach((b) => {
      if (b.name) names.add(b.name);
    });
    return names;
  }
  function normalizeRefName(raw) {
    return String(raw || "").replace(/^origin\//, "").replace(/^HEAD -> /, "").trim();
  }
  function commitBelongsToBranch(commit, branchName) {
    if (!commit || !branchName) return false;
    const bn = hw.normalizeRefName(branchName).toLowerCase();
    if (!bn) return false;
    if ((commit.refs || []).some((r) => hw.normalizeRefName(r).toLowerCase() === bn)) return true;
    const sub = (commit.subject || "").toLowerCase();
    const escaped = bn.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    if (new RegExp(`(^|\\s)${escaped}($|[\\s:])`, "i").test(sub)) return true;
    if (new RegExp(`merge\\s+${escaped}([\\s:]|$)`, "i").test(sub)) return true;
    return sub.includes(`on ${bn} branch`);
  }
  function hasBranchRef(commit) {
    if (!commit?.refs?.length) return false;
    const known = hw.branchRefNames();
    return commit.refs.some((r) => {
      const clean = hw.normalizeRefName(r);
      if (!clean || clean === "HEAD" || clean === "main" || clean === "master") return false;
      if (known.has(clean)) return true;
      if (/(^|\/)feature\//.test(r)) return true;
      return /^origin\//.test(r);
    });
  }
  function resolveCommitHash(token, commitMap) {
    if (!token || !commitMap) return null;
    if (commitMap[token]) return commitMap[token];
    const hits = Object.keys(commitMap).filter((h) => h.startsWith(token));
    return hits.length === 1 ? commitMap[hits[0]] : null;
  }
  function findMergeCommitForBranch(parsed, chain, seg) {
    if (!chain.length) return null;
    const candidates = [];
    parsed.commits.forEach((c) => {
      if (c.parents.length < 2) return;
      if (!hw.segmentParticipatedInMerge(seg, c, chain, parsed)) return;
      const mergeCol = c.versionIndex ?? c.displayColumn ?? 0;
      const allAfterMerge = chain.every((x) => {
        const col = x.versionIndex ?? x.displayColumn ?? 0;
        return col > mergeCol;
      });
      if (allAfterMerge) return;
      candidates.push(c);
    });
    if (!candidates.length) return null;
    candidates.sort((a, b) => {
      const ca = a.versionIndex ?? a.displayColumn ?? 0;
      const cb = b.versionIndex ?? b.displayColumn ?? 0;
      return ca - cb;
    });
    return candidates[0].hash;
  }
  function resolveSegmentMergeHash(parsed, chain, seg) {
    const found = hw.findMergeCommitForBranch(parsed, chain, seg);
    if (found) return found;
    const mc = seg?.mergeHash && parsed.commitMap[seg.mergeHash];
    const bp = mc?.parents?.[1];
    if (mc && bp && chain.some((c) => c.hash === bp)) return seg.mergeHash;
    return null;
  }
  function branchSegmentFrozenMerge(seg, parsed) {
    return Boolean(seg?.continued || hw.branchMergeIsBehindTip(seg, parsed));
  }
  function applyBranchSegmentFromTip(seg, parsed, tip, chain, forkHash) {
    const commitMap = parsed.commitMap;
    const mainlineSet = parsed.mainlineSet;
    const mergeHash = hw.resolveSegmentMergeHash(parsed, chain, seg);
    const commits = chain.length ? chain : tip ? [commitMap[tip]].filter(Boolean) : [];
    const commitSet = new Set(commits.map((c) => c.hash));
    Object.assign(seg, {
      forkHash: forkHash || seg?.forkHash || null,
      mergeHash,
      merged: Boolean(mergeHash),
      continued: false,
      commits,
      commitSet,
      forkGraphX: forkHash ? commitMap[forkHash]?.graphX ?? null : seg?.forkGraphX ?? null,
      mergeGraphX: mergeHash ? commitMap[mergeHash]?.graphX ?? null : null,
      outOfLog: false
    });
    const tipAtMerge = mergeHash ? hw.branchTipAtMerge(seg, parsed) : null;
    seg.continued = hw.branchMergeIsBehindTip(seg, parsed) || hw.branchHasCommitsAfterMerge(seg, parsed) || mergeHash && tip && !mainlineSet.has(tip.hash) && tipAtMerge && tipAtMerge.hash !== tip.hash || !mergeHash && tip && !mainlineSet.has(tip.hash);
  }
  function enrichBranchSegmentsFromGitBranches(parsed, branches) {
    if (!parsed || !branches?.length) return;
    const commitMap = parsed.commitMap;
    const mainlineSet = parsed.mainlineSet;
    const existing = new Set(parsed.branchSegments.map((s) => s.id));
    branches.forEach((b) => {
      if (!b?.name || /^(main|master)$/i.test(b.name)) return;
      const tip = b.hash ? hw.resolveCommitHash(b.hash, commitMap) : null;
      const prior = parsed.branchSegments.find((s) => s.id === b.name || s.name === b.name);
      if (prior && tip) {
        const { chain: chain2, forkHash: forkHash2 } = hw.collectBranchChainToFork(
          tip.hash,
          commitMap,
          mainlineSet,
          prior.name || b.name
        );
        hw.applyBranchSegmentFromTip(prior, parsed, tip, chain2, forkHash2);
        existing.add(b.name);
        return;
      }
      if (existing.has(b.name)) return;
      if (!tip) {
        parsed.branchSegments.push({
          id: b.name,
          name: b.name,
          forkHash: null,
          mergeHash: null,
          merged: false,
          continued: false,
          commits: [],
          commitSet: /* @__PURE__ */ new Set(),
          forkGraphX: null,
          mergeGraphX: null,
          outOfLog: true
        });
        existing.add(b.name);
        return;
      }
      const { chain, forkHash } = hw.collectBranchChainToFork(tip.hash, commitMap, mainlineSet, b.name);
      if (!chain.length || !forkHash || forkHash === tip.hash) {
        parsed.branchSegments.push({
          id: b.name,
          name: b.name,
          forkHash: forkHash || tip.parents?.[0] || null,
          mergeHash: mainlineSet.has(tip.hash) ? tip.hash : null,
          merged: mainlineSet.has(tip.hash),
          continued: false,
          commits: chain.length ? chain : [tip],
          commitSet: new Set((chain.length ? chain : [tip]).map((c) => c.hash)),
          forkGraphX: parsed.commits.find((c) => c.hash === forkHash)?.graphX ?? tip.graphX,
          mergeGraphX: mainlineSet.has(tip.hash) ? tip.graphX : null,
          outOfLog: false
        });
        existing.add(b.name);
        return;
      }
      const seg = {
        id: b.name,
        name: b.name,
        forkHash,
        mergeHash: null,
        merged: false,
        continued: false,
        commits: chain,
        commitSet: /* @__PURE__ */ new Set(),
        forkGraphX: null,
        mergeGraphX: null,
        outOfLog: false
      };
      hw.applyBranchSegmentFromTip(seg, parsed, tip, chain, forkHash);
      parsed.branchSegments.push(seg);
      existing.add(b.name);
    });
    parsed.branchSegments = parsed.branchSegments.filter((seg) => {
      if (!/^branch-\d+$/i.test(seg.id || "")) return true;
      return !parsed.branchSegments.some(
        (other) => other !== seg && other.id !== seg.id && !/^branch-\d+$/i.test(other.id || "") && other.forkHash === seg.forkHash && other.mergeHash === seg.mergeHash
      );
    });
  }
  function inferGitBranchesFromParsed(parsed) {
    const byName = /* @__PURE__ */ new Map();
    parsed.commits.forEach((c) => {
      (c.refs || []).forEach((r) => {
        const name = hw.normalizeRefName(r);
        if (!name || name === "HEAD" || name === "main" || name === "master") return;
        if (!byName.has(name)) byName.set(name, { name, hash: c.hash });
      });
    });
    return [...byName.values()].sort((a, b) => a.name.localeCompare(b.name));
  }
  function collectBranchChainToFork(tipHash, commitMap, trunkSet, branchName) {
    const chain = [];
    let cur = commitMap[tipHash];
    while (cur) {
      chain.unshift(cur);
      const p = cur.parents?.[0];
      if (!p) break;
      if (trunkSet.has(p)) {
        const pc = commitMap[p];
        const gp = pc?.parents?.[0];
        if (branchName && pc && hw.commitBelongsToBranch(pc, branchName) && gp) {
          chain.unshift(pc);
          return { chain, forkHash: gp };
        }
        return { chain, forkHash: p };
      }
      cur = commitMap[p];
    }
    return { chain, forkHash: null };
  }
  function buildTrunkLaneCommitSet(headHash, branchSegments, commitMap, mainlineSet) {
    const interior = /* @__PURE__ */ new Set();
    branchSegments.forEach((seg) => {
      seg.commits.forEach((c) => {
        if (c.hash === seg.forkHash) return;
        if (mainlineSet?.has(c.hash)) return;
        interior.add(c.hash);
      });
    });
    const trunk = /* @__PURE__ */ new Set();
    let cur = headHash;
    const seen = /* @__PURE__ */ new Set();
    while (cur && commitMap[cur] && !seen.has(cur)) {
      seen.add(cur);
      if (!interior.has(cur)) trunk.add(cur);
      cur = commitMap[cur].parents[0];
    }
    return trunk;
  }
  function analyzeDAG(commits, commitMap, headHash) {
    const resolvedHead = headHash || commits[commits.length - 1]?.hash;
    const hasParents = commits.some((c) => c.parents.length > 0);
    const graphX = {};
    if (!hasParents) {
      commits.forEach((c, i) => {
        graphX[c.hash] = i;
      });
      const mainlineSet2 = new Set(commits.map((c) => c.hash));
      return {
        mainlineSet: mainlineSet2,
        mainlineOrder: commits.map((c) => c.hash),
        trunkLaneCommitSet: mainlineSet2,
        branchSegments: [],
        graphX,
        headHash: resolvedHead
      };
    }
    const mainlineSet = /* @__PURE__ */ new Set();
    const mainlineOrder = [];
    let cur = resolvedHead;
    while (cur && commitMap[cur]) {
      mainlineSet.add(cur);
      mainlineOrder.unshift(cur);
      cur = commitMap[cur].parents[0];
    }
    function gen(hash) {
      if (graphX[hash] !== void 0) return graphX[hash];
      const c = commitMap[hash];
      if (!c || !c.parents.length) {
        graphX[hash] = 0;
        return 0;
      }
      const g = Math.max(...c.parents.map(gen)) + 1;
      graphX[hash] = g;
      return g;
    }
    commits.forEach((c) => gen(c.hash));
    const branchSegments = [];
    const claimedBranch = /* @__PURE__ */ new Set();
    commits.forEach((c) => {
      if (c.parents.length < 2) return;
      const branchTip = c.parents[1];
      const chain = hw.collectBranchCommits(branchTip, mainlineSet, commitMap);
      if (!chain.length) return;
      if (!chain.some((x) => x.hash === branchTip)) return;
      const name = hw.extractBranchName(chain) || `branch-${branchSegments.length + 1}`;
      const forkHash = hw.collectBranchChainToFork(branchTip, commitMap, mainlineSet, name).forkHash || chain[0].parents[0];
      if (!forkHash) return;
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
        mergeGraphX: graphX[c.hash]
      });
    });
    const headTip = commitMap[resolvedHead];
    [...commits].reverse().forEach((c) => {
      if (!hw.hasBranchRef(c)) return;
      if (claimedBranch.has(c.hash)) return;
      const name = hw.extractBranchName([c]) || hw.extractBranchName([commitMap[c.hash]].filter(Boolean)) || `branch-${branchSegments.length + 1}`;
      const { chain, forkHash } = hw.collectBranchChainToFork(c.hash, commitMap, mainlineSet, name);
      if (!chain.length || !forkHash) return;
      if (chain.some((x) => claimedBranch.has(x.hash))) return;
      const commitSet = new Set(chain.map((x) => x.hash));
      chain.forEach((x) => claimedBranch.add(x.hash));
      const continued = chain.some((x) => hw.hasBranchRef(x)) && headTip && !hw.hasBranchRef(headTip);
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
        mergeGraphX: null
      });
    });
    const trunkLaneCommitSet = hw.buildTrunkLaneCommitSet(
      resolvedHead,
      branchSegments,
      commitMap,
      mainlineSet
    );
    return { mainlineSet, mainlineOrder, trunkLaneCommitSet, branchSegments, graphX, headHash: resolvedHead };
  }
  function collectBranchCommits(branchTip, mainlineSet, commitMap) {
    const chain = [];
    let cur = branchTip;
    const seen = /* @__PURE__ */ new Set();
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
    const known = hw.branchRefNames();
    for (const c of commits) {
      for (const r of c.refs || []) {
        const clean = hw.normalizeRefName(r);
        if (known.has(clean)) return clean;
      }
    }
    for (const c of commits) {
      for (const r of c.refs || []) {
        const clean = hw.normalizeRefName(r);
        if (clean && clean !== "HEAD" && clean !== "main" && clean !== "master") return clean;
      }
    }
    return null;
  }
  function isReachableFrom(ancestorHash, descendantHash, commitMap) {
    if (!ancestorHash || !descendantHash || !commitMap) return false;
    const seen = /* @__PURE__ */ new Set();
    const stack = [descendantHash];
    while (stack.length) {
      const h = stack.pop();
      if (!h || seen.has(h)) continue;
      if (h === ancestorHash) return true;
      seen.add(h);
      const c = commitMap[h];
      if (!c?.parents) continue;
      c.parents.forEach((p) => {
        if (p) stack.push(p);
      });
    }
    return false;
  }
  Object.assign(hw, {
    branchRefNames,
    normalizeRefName,
    commitBelongsToBranch,
    hasBranchRef,
    resolveCommitHash,
    findMergeCommitForBranch,
    resolveSegmentMergeHash,
    branchSegmentFrozenMerge,
    applyBranchSegmentFromTip,
    enrichBranchSegmentsFromGitBranches,
    inferGitBranchesFromParsed,
    collectBranchChainToFork,
    buildTrunkLaneCommitSet,
    analyzeDAG,
    collectBranchCommits,
    extractBranchName,
    isReachableFrom
  });

  // src/git/columns.js
  function assignDisplayColumns(commits) {
    commits.forEach((c) => {
      c.displayColumn = c.versionIndex;
    });
  }
  function columnsMatch(a, b) {
    return Math.abs(a - b) < 1e-3;
  }
  function formatGlobalCommitColumn(column) {
    if (column == null || Number.isNaN(column)) return "C?";
    return `C${Math.round(Number(column))}`;
  }
  function formatLaneVersion(laneV) {
    if (laneV == null || Number.isNaN(laneV)) return "V?";
    return `V${Math.round(Number(laneV))}`;
  }
  function formatDisplayVersion(column) {
    return hw.PER_LANE_VERSION ? hw.formatGlobalCommitColumn(column) : hw.formatLaneVersion(column);
  }
  function formatNodeVersion(node) {
    if (hw.PER_LANE_VERSION && node?.laneVersion != null) return hw.formatLaneVersion(node.laneVersion);
    return hw.formatDisplayVersion(node?.displayColumn ?? node?.graphX);
  }
  function nodeVersionTooltipLine(node) {
    const col = node?.displayColumn ?? node?.graphX;
    if (!hw.PER_LANE_VERSION) return hw.formatNodeVersion(node);
    const global = hw.formatGlobalCommitColumn(col);
    const local = node?.laneVersion != null ? hw.formatLaneVersion(node.laneVersion) : null;
    return local ? `${local} \xB7 \u4E0A\u4F20 ${global}` : global;
  }
  function assignPerLaneVersions(parsed, allFiles) {
    if (!hw.PER_LANE_VERSION) return;
    const baseLanes = hw.collectVisibleLanes(allFiles).filter((l) => !l.isHeader);
    const counters = /* @__PURE__ */ new Map();
    const branchPaths = [];
    baseLanes.forEach((lane) => counters.set(lane.path, 0));
    (parsed.branchSegments || []).forEach((seg) => {
      baseLanes.forEach((lane) => {
        if (!hw.segmentTouchesLane(seg, lane)) return;
        const bp = `${lane.path}#\u2387${seg.id}`;
        counters.set(bp, 0);
        branchPaths.push({ path: bp, seg, parent: lane });
      });
    });
    parsed.commits.forEach((commit) => {
      commit.laneVersions = {};
      baseLanes.forEach((lane) => {
        const matched = commit.files.filter((f) => hw.fileMatchesLane(f, lane));
        if (!matched.length) return;
        const next = (counters.get(lane.path) || 0) + 1;
        counters.set(lane.path, next);
        commit.laneVersions[lane.path] = next;
      });
      branchPaths.forEach(({ path, seg, parent }) => {
        if (!seg.commitSet.has(commit.hash)) return;
        if (!commit.files.some((f) => hw.fileMatchesLane(f, parent))) return;
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
    if (hw.PER_LANE_VERSION && forkCommit.laneVersions?.[lane.path] != null) {
      return forkCommit.laneVersions[lane.path];
    }
    return forkCommit.versionIndex ?? forkCommit.displayColumn ?? 1;
  }
  function truncateSubject(text, max = 16) {
    const t = String(text || "").trim();
    if (!t) return "";
    if (t.length <= max) return t;
    return `${t.slice(0, Math.max(1, max - 1))}\u2026`;
  }
  function commitAtMainlineVersion(parsed, columnV) {
    if (!parsed) return null;
    return parsed.commits.find(
      (c) => c.isMainline && c.mainlineVersionIndex === columnV
    ) || null;
  }
  function commitAtUploadColumn(parsed, columnV) {
    if (!parsed) return null;
    return parsed.commits.find(
      (c) => c.versionIndex === columnV || hw.columnsMatch(c.displayColumn, columnV)
    ) || null;
  }
  function headUploadColumn(parsed) {
    const head = hw.headCommit(parsed);
    return head?.versionIndex ?? head?.displayColumn ?? parsed?.commits?.length ?? 0;
  }
  function maxLoadedUploadColumn(parsed) {
    if (!parsed?.commits?.length) return 0;
    let max = 0;
    parsed.commits.forEach((c) => {
      const col = c.versionIndex ?? c.displayColumn ?? 0;
      if (col > max) max = col;
    });
    return max;
  }
  function versionLabelWithSubject(parsed, columnV, maxSubject = 14) {
    const base = hw.PER_LANE_VERSION ? hw.formatGlobalCommitColumn(columnV) : hw.formatDisplayVersion(columnV);
    const headV = hw.headUploadColumn(parsed) || 0;
    if (!parsed || columnV > headV) return base;
    const commit = hw.PER_LANE_VERSION ? hw.commitAtUploadColumn(parsed, columnV) : hw.commitAtMainlineVersion(parsed, columnV);
    const subj = hw.truncateSubject(commit?.subject, maxSubject);
    return subj ? `${base} \xB7 ${subj}` : base;
  }
  function commitSubjectForNode(node) {
    const fromNode = node?.subject?.trim();
    if (fromNode) return fromNode;
    const c = hw.state.parsed?.commitMap?.[node?.hash];
    return c?.subject?.trim() || "";
  }
  function rulerExtent(parsed) {
    const headV = hw.headMainlineVersion(parsed) || 0;
    const loadedMax = hw.maxLoadedUploadColumn(parsed);
    let extent = hw.CONFIG.RULER_PRESET;
    if (Math.max(headV, loadedMax) >= hw.CONFIG.RULER_EXPAND_THRESHOLD) extent = hw.CONFIG.RULER_EXPAND_TO;
    return Math.max(extent, headV + 1, loadedMax + 1);
  }
  Object.assign(hw, {
    assignDisplayColumns,
    columnsMatch,
    formatGlobalCommitColumn,
    formatLaneVersion,
    formatDisplayVersion,
    formatNodeVersion,
    nodeVersionTooltipLine,
    assignPerLaneVersions,
    laneVersionAtHead,
    laneForkLaneVersion,
    truncateSubject,
    commitAtMainlineVersion,
    commitAtUploadColumn,
    headUploadColumn,
    maxLoadedUploadColumn,
    versionLabelWithSubject,
    commitSubjectForNode,
    rulerExtent
  });

  // src/graph/branch-merge.js
  function segmentTouchesLane(seg, lane) {
    if (lane.isHeader || lane.isBranchLane) return false;
    return seg.commits.some((c) => c.files.some((f) => hw.fileMatchesLane(f, lane)));
  }
  function branchSegmentFullyOnMainline(seg, parsed) {
    if (!seg?.commits?.length) return false;
    const trunk = parsed.mainlineSet;
    return seg.commits.every((c) => trunk.has(c.hash));
  }
  function segmentMergeCommit(seg, parsed) {
    const h = seg?.mergeHash;
    return h && parsed.commitMap[h] ? parsed.commitMap[h] : null;
  }
  function segmentTipAtMergeColumn(mergeCommit, chain) {
    if (!mergeCommit || !chain?.length) return null;
    const bp = mergeCommit.parents?.[1];
    const chainSet = new Set(chain.map((c) => c.hash));
    if (bp && chainSet.has(bp)) {
      return chain.find((c) => c.hash === bp) || null;
    }
    const mergeCol = mergeCommit.versionIndex ?? mergeCommit.displayColumn ?? 0;
    let best = null;
    chain.forEach((c) => {
      const col = c.versionIndex ?? c.displayColumn ?? 0;
      if (col > mergeCol) return;
      if (!best || col >= (best.versionIndex ?? best.displayColumn)) best = c;
    });
    return best;
  }
  function mergeCommitNamesBranchFromSubject(mergeCommit) {
    const sub = (mergeCommit?.subject || "").trim();
    const m = sub.match(/^merge\s+([^:(]+)/i);
    if (!m) return [];
    return m[1].split(/\s+and\s+|\s*,\s*/i).map((s) => s.trim()).filter(Boolean);
  }
  function mergeCommitNamesBranch(mergeCommit, branchName) {
    if (!mergeCommit || !branchName) return false;
    if (hw.commitBelongsToBranch(mergeCommit, branchName)) return true;
    const bn = hw.normalizeRefName(branchName).toLowerCase();
    const sub = (mergeCommit.subject || "").toLowerCase();
    if (!bn) return false;
    const escaped = bn.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    if (new RegExp(`merge\\s+${escaped}([\\s:]|$)`, "i").test(sub)) return true;
    if (sub.includes(`merge branch '${bn}'`) || sub.includes(`merge branch "${bn}"`)) return true;
    return false;
  }
  function mergeCommitNamedBranches(mergeCommit, parsed) {
    const names = /* @__PURE__ */ new Set();
    (parsed?.branchSegments || []).forEach((s) => {
      const n = s.name || s.id;
      if (n && hw.mergeCommitNamesBranch(mergeCommit, n)) names.add(n);
    });
    (hw.state?.gitBranches || parsed?.gitBranches || []).forEach((b) => {
      if (b?.name && hw.mergeCommitNamesBranch(mergeCommit, b.name)) names.add(b.name);
    });
    hw.mergeCommitNamesBranchFromSubject(mergeCommit).forEach((n) => names.add(n));
    return [...names];
  }
  function segmentParticipatedInMerge(seg, mergeCommit, chain, parsed) {
    const commits = chain || seg?.commits || [];
    const tipAtMerge = hw.segmentTipAtMergeColumn(mergeCommit, commits);
    if (!tipAtMerge) return false;
    const name = seg?.name || seg?.id;
    const named = hw.mergeCommitNamedBranches(mergeCommit, parsed);
    if (named.length) {
      return Boolean(name && named.some((n) => n.toLowerCase() === String(name).toLowerCase()));
    }
    const bp = mergeCommit.parents?.[1];
    if (!bp) return false;
    const chainSet = new Set(commits.map((c) => c.hash));
    return tipAtMerge.hash === bp || chainSet.has(bp);
  }
  function branchHasCommitsAfterMerge(seg, parsed) {
    const mc = hw.segmentMergeCommit(seg, parsed);
    const tip = seg.commits[seg.commits.length - 1];
    if (!mc || !tip) return false;
    const mergeCol = mc.versionIndex ?? mc.displayColumn ?? 0;
    const tipCol = tip.versionIndex ?? tip.displayColumn ?? 0;
    return tipCol > mergeCol;
  }
  function branchMergeIsBehindTip(seg, parsed) {
    if (hw.branchHasCommitsAfterMerge(seg, parsed)) return true;
    const tip = seg.commits[seg.commits.length - 1];
    const mc = hw.segmentMergeCommit(seg, parsed);
    if (!tip || !mc) return false;
    return hw.isReachableFrom(mc.hash, tip.hash, parsed.commitMap) && !hw.isReachableFrom(tip.hash, mc.hash, parsed.commitMap);
  }
  function branchTipAtMerge(seg, parsed) {
    const mc = hw.segmentMergeCommit(seg, parsed);
    if (!mc) return seg.commits[seg.commits.length - 1] || null;
    const atMerge = hw.segmentTipAtMergeColumn(mc, seg.commits);
    if (atMerge) return atMerge;
    const bp = mc.parents?.[1] && parsed.commitMap[mc.parents[1]];
    const chainSet = new Set(seg.commits.map((c) => c.hash));
    if (bp && chainSet.has(bp.hash)) return bp;
    return seg.commits[seg.commits.length - 1] || null;
  }
  function coMergeLookupTip(seg, parsed) {
    return hw.branchMergeIsBehindTip(seg, parsed) ? hw.branchTipAtMerge(seg, parsed) : seg.commits[seg.commits.length - 1];
  }
  function findCoMergeLanding(seg, parsed) {
    if (seg.mergeHash && parsed.commitMap[seg.mergeHash]) return null;
    const tip = hw.coMergeLookupTip(seg, parsed);
    if (!tip) return null;
    let best = null;
    parsed.commits.forEach((c) => {
      if (!c.parents || c.parents.length < 2) return;
      if (!parsed.mainlineSet.has(c.hash)) return;
      const branchParent = c.parents[1];
      if (!branchParent) return;
      if (!hw.segmentParticipatedInMerge(seg, c, seg.commits, parsed)) return;
      const col = c.versionIndex ?? c.displayColumn;
      if (!best || col < best.column) best = { commit: c, column: col };
    });
    return best;
  }
  function branchSegmentJoinColumn(seg, parsed) {
    const mc = hw.segmentMergeCommit(seg, parsed);
    if (mc && mc.parents.length >= 2) {
      return mc.versionIndex ?? mc.displayColumn;
    }
    const co = hw.findCoMergeLanding(seg, parsed);
    if (co) return co.column;
    const tip = seg.commits[seg.commits.length - 1];
    return tip ? tip.versionIndex ?? tip.displayColumn : null;
  }
  function segmentOwnsMergeCommit(seg, mergeCommit, chain, parsed) {
    if (!mergeCommit?.parents || mergeCommit.parents.length < 2) return false;
    const commits = chain || seg.commits || [];
    const tipAtMerge = hw.segmentTipAtMergeColumn(mergeCommit, commits);
    if (!tipAtMerge) return false;
    const bp = mergeCommit.parents[1];
    const chainSet = new Set(commits.map((c) => c.hash));
    if (chainSet.has(bp) || tipAtMerge.hash === bp) return true;
    const bpCommit = parsed.commitMap[bp];
    if (bpCommit && hw.isReachableFrom(tipAtMerge.hash, bp, parsed.commitMap)) return true;
    if (bpCommit && hw.isReachableFrom(bp, tipAtMerge.hash, parsed.commitMap)) return true;
    return false;
  }
  function segmentOwnsMerge(seg, parsed) {
    const mc = hw.segmentMergeCommit(seg, parsed);
    if (!mc) return false;
    return hw.segmentParticipatedInMerge(seg, mc, seg.commits, parsed);
  }
  function branchSegmentHasHistoricalMerge(seg, parsed) {
    if (hw.segmentOwnsMerge(seg, parsed)) return true;
    if (hw.findCoMergeLanding(seg, parsed)) return true;
    if (hw.branchSegmentFullyOnMainline(seg, parsed)) return true;
    return false;
  }
  function shouldDrawMergeIntoParent(seg, parsed) {
    return hw.branchSegmentHasHistoricalMerge(seg, parsed);
  }
  function branchSegmentLandingCommit(seg, parsed) {
    const mc = hw.segmentMergeCommit(seg, parsed);
    if (mc) return mc;
    const co = hw.findCoMergeLanding(seg, parsed);
    if (co) return co.commit;
    if (seg.mergeHash) return parsed.commitMap[seg.mergeHash] || null;
    return seg.commits[seg.commits.length - 1] || null;
  }
  function mergeLaneVersionOnParent(landing, seg, parentLane, parsed) {
    if (landing?.laneVersions?.[parentLane.path] != null) {
      return landing.laneVersions[parentLane.path];
    }
    let maxV = 0;
    seg.commits.forEach((c) => {
      const v = c.laneVersions?.[parentLane.path];
      if (v != null) maxV = Math.max(maxV, v);
    });
    if (maxV > 0) return maxV;
    return hw.laneForkLaneVersion(parentLane, seg, parsed);
  }
  function ensureParentMergeLandingNode(nodes, bundlesOnLane, parentLane, seg, parsed, focusGraphX, head) {
    if (!hw.shouldDrawMergeIntoParent(seg, parsed)) return;
    const mergeV = hw.branchSegmentJoinColumn(seg, parsed);
    if (mergeV == null || !hw.columnInWindow(mergeV)) return;
    if (hw.nodeOnLaneAtColumn(nodes, parentLane.path, mergeV)) return;
    const landing = hw.branchSegmentLandingCommit(seg, parsed);
    if (!landing) return;
    const matched = landing.files.filter((f) => hw.fileMatchesLane(f, parentLane));
    const laneVer = hw.mergeLaneVersionOnParent(landing, seg, parentLane, parsed);
    const applies = matched.length > 0 && hw.commitAppliesToLane(landing, parentLane, parsed);
    const nodeId = applies ? `${landing.hash}:${parentLane.path}@c${mergeV}` : `merge-landing:${landing.hash}:${parentLane.path}:${mergeV}`;
    const graphNode = {
      id: nodeId,
      hash: landing.hash,
      author: landing.author,
      date: landing.date,
      subject: landing.subject || "",
      versionIndex: landing.versionIndex,
      laneVersion: hw.PER_LANE_VERSION ? laneVer : null,
      globalIndex: mergeV,
      graphX: mergeV,
      displayColumn: mergeV,
      lanePath: parentLane.path,
      laneIndex: parentLane.laneIndex,
      lane: parentLane,
      label: parentLane.label,
      filePath: matched[0] || hw.laneMatchPath(parentLane),
      files: matched,
      fileCount: matched.length,
      isFocus: hw.columnsMatch(mergeV, focusGraphX),
      isPulse: hw.nodeIsPulsing({ id: nodeId }),
      isHead: landing.hash === head.hash,
      isHub: true,
      isMergeLanding: true,
      isHistoricalMergeLanding: hw.branchSegmentFrozenMerge(seg, parsed),
      isFolderAggregate: parentLane.type === "folder" && !parentLane.isHeader,
      isBranchLane: false,
      branchName: seg.name
    };
    if (!applies && !hw.segmentTouchesLane(seg, parentLane)) return;
    nodes.push(graphNode);
    const hasBundle = bundlesOnLane.some(
      (b) => b.commit.hash === landing.hash && hw.columnsMatch(b.displayColumn ?? b.graphX, mergeV)
    );
    if (!hasBundle) {
      bundlesOnLane.push({
        id: `bundle-${landing.hash}`,
        commit: landing,
        graphX: mergeV,
        displayColumn: mergeV,
        isFocus: graphNode.isFocus,
        isHead: graphNode.isHead,
        onPage: [{ lane: parentLane, laneIndex: parentLane.laneIndex, lanePath: parentLane.path, files: matched }],
        hubLanePath: parentLane.path,
        hubLaneIndex: parentLane.laneIndex,
        files: matched
      });
      bundlesOnLane.sort((a, b) => a.displayColumn - b.displayColumn);
    }
  }
  Object.assign(hw, {
    segmentTouchesLane,
    branchSegmentFullyOnMainline,
    segmentMergeCommit,
    segmentTipAtMergeColumn,
    mergeCommitNamesBranchFromSubject,
    mergeCommitNamesBranch,
    mergeCommitNamedBranches,
    segmentParticipatedInMerge,
    branchHasCommitsAfterMerge,
    branchMergeIsBehindTip,
    branchTipAtMerge,
    coMergeLookupTip,
    findCoMergeLanding,
    branchSegmentJoinColumn,
    segmentOwnsMergeCommit,
    segmentOwnsMerge,
    branchSegmentHasHistoricalMerge,
    shouldDrawMergeIntoParent,
    branchSegmentLandingCommit,
    mergeLaneVersionOnParent,
    ensureParentMergeLandingNode
  });

  // src/lanes/bounds.js
  function segmentsForLane(lane, parsed) {
    return (parsed.branchSegments || []).filter((seg) => hw.segmentTouchesLane(seg, lane));
  }
  function laneForkV(lane, seg, parsed) {
    const trunk = parsed.trunkLaneCommitSet || parsed.mainlineSet;
    const branchOnLane = seg.commits.filter((c) => c.files.some((f) => hw.fileMatchesLane(f, lane)));
    if (!branchOnLane.length) {
      return parsed.commitMap[seg.forkHash]?.versionIndex ?? 1;
    }
    const firstBranchV = Math.min(...branchOnLane.map((c) => c.versionIndex));
    let lastTrunkV = 1;
    parsed.commits.forEach((c) => {
      if (!trunk.has(c.hash)) return;
      if (!c.files.some((f) => hw.fileMatchesLane(f, lane))) return;
      if (c.versionIndex < firstBranchV) lastTrunkV = Math.max(lastTrunkV, c.versionIndex);
    });
    return lastTrunkV;
  }
  function laneSegmentBounds(lane, seg, parsed) {
    const forkV = hw.laneForkV(lane, seg, parsed);
    const mergeV = hw.shouldDrawMergeIntoParent(seg, parsed) ? hw.branchSegmentJoinColumn(seg, parsed) : null;
    return { forkV, mergeV };
  }
  function branchLaneProvenanceLine(node, seg, parsed) {
    const p = parsed || hw.state.parsed;
    if (!node?.lane?.isBranchLane || !seg?.commits?.length || !p?.commitMap) return null;
    const commit = node.hash ? p.commitMap[node.hash] : null;
    if (!commit) return null;
    const parentPath = node.lane.parentLanePath;
    const branchLabel = seg.name || seg.id || "branch";
    const chainSet = new Set(seg.commits.map((c) => c.hash));
    const nodeCol = commit.versionIndex ?? commit.displayColumn ?? node.displayColumn ?? node.graphX ?? 0;
    const formatRef = (c) => {
      if (!c) return "?";
      const gc = hw.formatGlobalCommitColumn(c.displayColumn ?? c.versionIndex);
      if (hw.PER_LANE_VERSION && parentPath && c.laneVersions?.[parentPath] != null) {
        return `${hw.formatLaneVersion(c.laneVersions[parentPath])}\uFF08${gc}\uFF09`;
      }
      return gc;
    };
    let pred = null;
    const gitParent = commit.parents?.[0] && p.commitMap[commit.parents[0]];
    if (gitParent && chainSet.has(gitParent.hash)) pred = gitParent;
    if (!pred) {
      seg.commits.forEach((c) => {
        if (c.hash === commit.hash) return;
        const cCol = c.versionIndex ?? c.displayColumn ?? 0;
        if (cCol >= nodeCol) return;
        if (!pred || cCol > (pred.versionIndex ?? pred.displayColumn)) pred = c;
      });
    }
    if (pred) {
      return `\u2387 ${branchLabel} \xB7 \u6CBF\u5206\u652F\u7531 ${formatRef(pred)} \u63A8\u8FDB`;
    }
    const parentLane = hw.state.catalog?.lanes?.find((l) => l.path === parentPath && !l.isBranchLane);
    const forkV = parentLane ? hw.laneForkV(parentLane, seg, p) : p.commitMap[seg.forkHash]?.versionIndex ?? 1;
    return `\u2387 ${branchLabel} \xB7 \u4ECE\u4E3B\u6CF3\u9053 ${hw.formatGlobalCommitColumn(forkV)} \u5206\u51FA`;
  }
  function branchLaneProvenanceIsContinuation(node, seg, parsed) {
    const line = hw.branchLaneProvenanceLine(node, seg, parsed);
    return Boolean(line && line.includes("\u6CBF\u5206\u652F\u7531"));
  }
  function commitBlockedOnParentLane(commit, lane, parsed) {
    const trunk = parsed.trunkLaneCommitSet || parsed.mainlineSet;
    if (trunk.has(commit.hash)) return false;
    const v = commit.versionIndex;
    for (const seg of hw.segmentsForLane(lane, parsed)) {
      const { forkV, mergeV } = hw.laneSegmentBounds(lane, seg, parsed);
      if (!forkV || v <= forkV) continue;
      if (!seg.merged) return true;
      if (mergeV && v > forkV && v < mergeV) return true;
    }
    return false;
  }
  function parentLaneTrackHoles(lane, parsed) {
    const headV = hw.headMainlineVersion(parsed);
    const holes = [];
    hw.segmentsForLane(lane, parsed).forEach((seg) => {
      const { forkV, mergeV } = hw.laneSegmentBounds(lane, seg, parsed);
      if (!forkV) return;
      if (seg.continued) return;
      if (!seg.merged && forkV < headV) {
        holes.push({ from: forkV + 1, to: headV });
      }
    });
    return holes;
  }
  function trackRangesFromHoles(vStart, vEnd, holes) {
    const sorted = holes.filter((h) => h.to >= h.from).sort((a, b) => a.from - b.from);
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
    const headV = hw.headMainlineVersion(parsed);
    const holes = hw.parentLaneTrackHoles(lane, parsed);
    if (!holes.length) return [{ vStart: 1, vEnd: Math.max(1, headV) }];
    return hw.trackRangesFromHoles(1, headV, holes);
  }
  function branchLaneTrackRange(lane, parsed, bundlesOnLane) {
    const headV = hw.headMainlineVersion(parsed);
    const seg = lane.branchSegment;
    let vStart = 1;
    let vEnd = headV;
    if (bundlesOnLane?.length) {
      const cols = bundlesOnLane.map((b) => b.displayColumn ?? b.commit.displayColumn);
      vStart = Math.min(...cols);
      vEnd = Math.max(headV, ...cols);
    } else if (seg?.commits?.length) {
      vStart = Math.min(...seg.commits.map((c) => c.versionIndex ?? c.displayColumn));
    }
    if (seg && hw.branchMergeIsBehindTip(seg, parsed)) {
      const joinV = hw.branchSegmentJoinColumn(seg, parsed);
      if (joinV != null) vStart = Math.min(vStart, joinV);
    }
    return { vStart, vEnd };
  }
  function laneStepSkipColumns(lane, parsed, bundlesOnLane) {
    const skip = /* @__PURE__ */ new Set();
    if (lane.isBranchLane) {
      const { vStart } = hw.branchLaneTrackRange(lane, parsed, bundlesOnLane);
      const seg = lane.branchSegment;
      const parentLane = { path: lane.parentLanePath };
      const forkV = seg ? hw.laneForkV(parentLane, seg, parsed) : null;
      if (forkV != null) {
        for (let v = forkV; v < vStart; v += 1) skip.add(v);
      }
      return skip;
    }
    hw.parentLaneTrackHoles(lane, parsed).forEach((h) => {
      for (let v = h.from; v <= h.to; v += 1) skip.add(v);
    });
    return skip;
  }
  function commitAppliesToLane(commit, lane, parsed) {
    if (lane.isHeader) return false;
    const matched = commit.files.filter((f) => hw.fileMatchesLane(f, lane));
    if (!matched.length) return false;
    if (lane.isBranchLane) return lane.branchSegment.commitSet.has(commit.hash);
    const trunk = parsed.trunkLaneCommitSet || parsed.mainlineSet;
    if (!trunk.has(commit.hash)) return false;
    if (hw.commitBlockedOnParentLane(commit, lane, parsed)) return false;
    return true;
  }
  Object.assign(hw, {
    segmentsForLane,
    laneForkV,
    branchLaneProvenanceLine,
    branchLaneProvenanceIsContinuation,
    laneSegmentBounds,
    commitBlockedOnParentLane,
    parentLaneTrackHoles,
    trackRangesFromHoles,
    parentLaneTrackRanges,
    branchLaneTrackRange,
    laneStepSkipColumns,
    commitAppliesToLane
  });

  // src/lanes/catalog.js
  function insertBranchLanes(baseLanes, branchSegments) {
    const out = [];
    for (const lane of baseLanes) {
      out.push(lane);
      if (lane.isHeader) continue;
      branchSegments.filter((seg) => hw.segmentTouchesLane(seg, lane)).forEach((seg) => {
        out.push({
          ...lane,
          path: `${lane.path}#\u2387${seg.id}`,
          parentLanePath: lane.path,
          isBranchLane: true,
          branchSegment: seg,
          label: `\u2387 ${seg.name}`
        });
      });
    }
    return out;
  }
  function wrapHue(h) {
    return (Math.round(h) % 360 + 360) % 360;
  }
  function analogousBranchHues(baseHue, count) {
    if (count <= 0) return [];
    if (count === 1) return [wrapHue(baseHue + 14)];
    const halfSpan = Math.min(52, 12 + count * 8);
    const step = halfSpan * 2 / (count - 1);
    return Array.from({ length: count }, (_, i) => wrapHue(baseHue - halfSpan + i * step));
  }
  function laneHslPack(h, sat, lit) {
    const satDim = Math.max(38, sat - 18);
    const litDim = Math.max(28, lit - 14);
    return {
      hue: h,
      color: `hsl(${h}, ${sat}%, ${lit}%)`,
      colorDim: `hsl(${h}, ${satDim}%, ${litDim}%)`,
      colorBright: `hsl(${h}, ${Math.min(88, sat + 6)}%, ${Math.min(72, lit + 6)}%)`
    };
  }
  function assignLaneColors(lanes) {
    const assignable = lanes.filter((l) => !l.isHeader && !l.isBranchLane);
    const hueByPath = /* @__PURE__ */ new Map();
    let hueIdx = 0;
    assignable.forEach((lane) => {
      if (!hueByPath.has(lane.path)) {
        hueByPath.set(lane.path, hw.LANE_HUES[hueIdx % hw.LANE_HUES.length]);
        hueIdx += 1;
      }
    });
    const branchHueByPath = /* @__PURE__ */ new Map();
    const branchIndexByPath = /* @__PURE__ */ new Map();
    const branchesByParent = /* @__PURE__ */ new Map();
    lanes.filter((l) => l.isBranchLane && l.parentLanePath).forEach((lane) => {
      const parent = lane.parentLanePath;
      if (!branchesByParent.has(parent)) branchesByParent.set(parent, []);
      branchesByParent.get(parent).push(lane);
    });
    branchesByParent.forEach((branchLanes, parentPath) => {
      const baseHue = hueByPath.get(parentPath) ?? hw.LANE_HUES[0];
      const sorted = [...branchLanes].sort((a, b) => String(a.label || "").localeCompare(String(b.label || "")));
      const hues = analogousBranchHues(baseHue, sorted.length);
      sorted.forEach((lane, i) => {
        branchHueByPath.set(lane.path, hues[i]);
        branchIndexByPath.set(lane.path, i);
      });
    });
    return lanes.map((lane) => {
      const branch = !!lane.isBranchLane;
      const d = (lane.depth || 0) + (branch ? 1 : 0);
      let h;
      if (branch) {
        const parentHue = hueByPath.get(lane.parentLanePath) ?? hw.LANE_HUES[0];
        h = branchHueByPath.get(lane.path) ?? wrapHue(parentHue + 14);
      } else if (lane.isHeader) {
        h = hueByPath.get(lane.path) ?? hw.LANE_HUES[0];
      } else {
        h = hueByPath.get(lane.path) ?? hw.LANE_HUES[hueIdx % hw.LANE_HUES.length];
      }
      let sat = Math.min(82, 74 - d * 2);
      let lit = Math.max(32, 62 - d * 2);
      if (branch) {
        const bi = branchIndexByPath.get(lane.path) ?? 0;
        sat = Math.min(86, sat + 6 + bi % 3 * 2);
        lit = Math.max(34, lit + bi % 2 * 3 - 1);
      }
      return { ...lane, ...laneHslPack(h, sat, lit) };
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
      return (rootFiles || allFiles.filter((f) => !f.includes("/"))).map((f) => ({ type: "file", path: f, name: f }));
    }
    const map = /* @__PURE__ */ new Map();
    for (const f of allFiles) {
      if (!f.startsWith(folderPath)) continue;
      const rest = f.slice(folderPath.length);
      const slash = rest.indexOf("/");
      if (slash === -1) {
        map.set(f, { type: "file", path: f, name: rest });
      } else {
        const seg = rest.slice(0, slash + 1);
        const childPath = folderPath + seg;
        if (!map.has(childPath)) map.set(childPath, { type: "folder", path: childPath, name: seg });
      }
    }
    return [...map.values()].sort((a, b) => a.path.localeCompare(b.path));
  }
  function filesUnderPrefix(prefix, allFiles, rootFiles) {
    if (prefix === hw.ROOT_BUCKET) return rootFiles || allFiles.filter((f) => !f.includes("/"));
    return allFiles.filter((f) => f.startsWith(prefix));
  }
  function getTopLevelItems(allFiles) {
    const folders = /* @__PURE__ */ new Set();
    const rootFiles = [];
    for (const f of allFiles) {
      if (f.includes("/")) folders.add(`${f.split("/")[0]}/`);
      else rootFiles.push(f);
    }
    const items = [...folders].sort().map((p) => ({ type: "folder", path: p, depth: 0 }));
    if (rootFiles.length === 1) {
      items.push({ type: "file", path: rootFiles[0], depth: 0 });
    } else if (rootFiles.length > 1) {
      items.push({ type: "folder", path: hw.ROOT_BUCKET, depth: 0, rootFiles: [...rootFiles] });
    }
    return items.sort((a, b) => a.path.localeCompare(b.path));
  }
  function collectFlatFileLanes(allFiles) {
    return [...allFiles].sort((a, b) => a.localeCompare(b)).map((path) => ({
      path,
      type: "file",
      depth: 0,
      collapsed: false,
      label: path,
      files: [path]
    }));
  }
  function folderDisplayLabel(folderPath) {
    if (folderPath === hw.ROOT_BUCKET) return "(root)";
    const parts = folderPath.split("/").filter(Boolean);
    return `${parts[parts.length - 1]}/`;
  }
  function sortExplorerChildren(children) {
    const folders = children.filter((c) => c.type === "folder").sort((a, b) => a.path.localeCompare(b.path));
    const files = children.filter((c) => c.type === "file").sort((a, b) => a.path.localeCompare(b.path));
    return [...folders, ...files];
  }
  function getTopLevelItemsExplorer(allFiles) {
    const folders = /* @__PURE__ */ new Set();
    const rootFiles = [];
    for (const f of allFiles) {
      if (f.includes("/")) folders.add(`${f.split("/")[0]}/`);
      else rootFiles.push(f);
    }
    const folderItems = [...folders].sort((a, b) => a.localeCompare(b)).map((p) => ({ type: "folder", path: p }));
    const fileItems = rootFiles.sort((a, b) => a.localeCompare(b)).map((p) => ({ type: "file", path: p }));
    return [...folderItems, ...fileItems];
  }
  function collectExplorerTreeLanes(allFiles) {
    const lanes = [];
    const expanded = hw.state.expandedPaths;
    function walk(item, depth) {
      if (item.type === "file") {
        lanes.push({
          path: item.path,
          type: "file",
          depth,
          collapsed: false,
          label: item.path.split("/").pop(),
          files: [item.path]
        });
        return;
      }
      const folderPath = item.path;
      const isRoot = folderPath === hw.ROOT_BUCKET;
      const rootFiles = item.rootFiles;
      const label = isRoot ? "(root)" : hw.folderDisplayLabel(folderPath);
      const desc = hw.filesUnderPrefix(folderPath, allFiles, rootFiles);
      if (desc.length === 0) return;
      if (!expanded.has(folderPath)) {
        lanes.push({
          path: folderPath,
          type: "folder",
          depth,
          collapsed: true,
          label,
          files: desc
        });
        return;
      }
      lanes.push({
        path: folderPath,
        type: "folder",
        depth,
        collapsed: true,
        isHeader: true,
        label,
        files: desc
      });
      hw.sortExplorerChildren(hw.getDirectChildren(folderPath, allFiles, rootFiles)).forEach((child) => walk(child, depth + 1));
    }
    hw.getTopLevelItemsExplorer(allFiles).forEach((item) => walk(item, 0));
    return lanes;
  }
  function collectGroupedFileLanes(allFiles) {
    const lanes = [];
    const expanded = hw.state.expandedPaths;
    function walk(item, depth) {
      if (item.type === "file") {
        lanes.push({
          path: item.path,
          type: "file",
          depth,
          collapsed: false,
          label: item.path.split("/").pop(),
          files: [item.path]
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
          type: "folder",
          depth,
          collapsed: true,
          label: isRoot ? "(root)" : folderPath,
          files: desc
        });
        return;
      }
      const folderLabel = isRoot ? "(root)" : folderPath;
      hw.getDirectChildren(folderPath, allFiles, rootFiles).forEach((child, idx) => {
        const inlineFolder = idx === 0 ? { path: folderPath, label: folderLabel } : null;
        if (child.type === "file") {
          lanes.push({
            path: child.path,
            type: "file",
            depth,
            collapsed: false,
            label: child.path.split("/").pop(),
            files: [child.path],
            inlineFolder
          });
        } else {
          walk({ type: "folder", path: child.path }, depth);
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
    hw.els.btnLaneLayout.textContent = flat ? "\u6587\u4EF6" : "\u76EE\u5F55";
    hw.els.btnLaneLayout.setAttribute(
      "title",
      flat ? "\u5F53\u524D\uFF1A\u6241\u5E73\u6587\u4EF6\u5217\u8868\uFF08\u70B9\u51FB\u5207\u6362\u4E3A\u6309\u76EE\u5F55\u5206\u7EC4\uFF09" : "\u5F53\u524D\uFF1A\u6309\u76EE\u5F55\u5206\u7EC4\uFF08\u70B9\u51FB\u5207\u6362\u4E3A\u6241\u5E73\u6587\u4EF6\u5217\u8868\uFF09"
    );
    hw.els.btnLaneLayout.setAttribute("aria-pressed", flat ? "true" : "false");
    hw.els.btnLaneLayout.classList.toggle("btn--solid", flat);
  }
  function setLaneLayout(layout) {
    const next = layout === hw.LANE_LAYOUT_FLAT ? LANE_LAYOUT_FLAT : hw.LANE_LAYOUT_GROUPED;
    if (hw.state.laneLayout === next) return;
    hw.state.laneLayout = next;
    try {
      localStorage.setItem(hw.LANE_LAYOUT_KEY, next);
    } catch {
    }
    hw.syncLaneLayoutButton();
    if (hw.state.parsed) hw.scheduleRenderFromState();
  }
  function toggleLaneLayout() {
    hw.setLaneLayout(hw.isFlatLaneLayout() ? LANE_LAYOUT_GROUPED : hw.LANE_LAYOUT_FLAT);
  }
  function topGroupKey(lane) {
    if (lane.path === hw.ROOT_BUCKET) return hw.ROOT_BUCKET;
    if (lane.type === "file" && !lane.path.includes("/")) return lane.path;
    return `${lane.path.split("/")[0]}/`;
  }
  function laneMatchPath(lane) {
    if (lane.isBranchLane && lane.parentLanePath) return lane.parentLanePath;
    return lane.path;
  }
  function fileMatchesLane(file, lane) {
    if (lane.isHeader) return false;
    const path = hw.laneMatchPath(lane);
    if (!path) return false;
    if (lane.type === "file") return file === path;
    if (path === hw.ROOT_BUCKET) return !file.includes("/");
    return file.startsWith(path);
  }
  function getVersionColumns(parsed) {
    const byX = /* @__PURE__ */ new Map();
    parsed.commits.forEach((c) => {
      if (!byX.has(c.graphX)) byX.set(c.graphX, c);
    });
    return [...byX.entries()].sort((a, b) => a[0] - b[0]).map(([, commit]) => commit);
  }
  function expandAncestorsForFiles(files) {
    files.forEach((f) => {
      if (!f.includes("/")) {
        hw.state.expandedPaths.add(hw.ROOT_BUCKET);
        return;
      }
      const parts = f.split("/");
      for (let i = 1; i < parts.length; i++) {
        hw.state.expandedPaths.add(`${parts.slice(0, i).join("/")}/`);
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
          if (!f.includes("/")) return;
          const rest = f.slice(path.length);
          const slash = rest.indexOf("/");
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
      h = (h << 5) - h + str.charCodeAt(i) | 0;
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
    lanes.forEach((lane, i) => {
      lane.laneIndex = i;
    });
    return {
      lanes,
      focusGraphX,
      head: hi,
      headHash: head.hash,
      headCommit: head,
      headMainlineV,
      contentHeight: hw.CONFIG.RULER_HEIGHT + Math.max(lanes.length, 1) * hw.CONFIG.LANE_HEIGHT + hw.CONFIG.MARGIN.top + hw.CONFIG.MARGIN.bottom
    };
  }
  Object.assign(hw, {
    insertBranchLanes,
    wrapHue,
    analogousBranchHues,
    laneHslPack,
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
    buildLaneCatalog
  });

  // src/graph/build.js
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
      label: lane.label
    };
  }
  function buildLaneVersionEvents(lane, parsed, graphNodes = []) {
    const events = [];
    const seen = /* @__PURE__ */ new Set();
    const pushEvent = (globalColumn, laneVersion, commit) => {
      const key = `${globalColumn}:${lane.path}`;
      if (seen.has(key)) return;
      seen.add(key);
      events.push({ laneVersion, globalColumn, commit });
    };
    parsed.commits.forEach((commit) => {
      if (!hw.commitInColumnWindow(commit)) return;
      if (!hw.commitAppliesToLane(commit, lane, parsed)) return;
      const laneV = commit.laneVersions?.[lane.path];
      if (laneV == null) return;
      pushEvent(commit.displayColumn, laneV, commit);
    });
    graphNodes.forEach((n) => {
      if (n.lanePath !== lane.path || !n.isMergeLanding) return;
      const col = n.displayColumn ?? n.graphX;
      if (col == null || !hw.columnInWindow(col)) return;
      pushEvent(col, n.laneVersion ?? 1, parsed.commitMap[n.hash]);
    });
    return events.sort((a, b) => a.globalColumn - b.globalColumn);
  }
  function laneTrackTimeline(vStart, vEnd, win) {
    const start = Math.max(1, Math.floor(vStart));
    const end = Math.max(start, Math.floor(vEnd));
    const timeline = [];
    for (let v = start; v <= end; v += 1) {
      if (hw.columnInWindow(v, win)) timeline.push(v);
    }
    return { vStart: start, vEnd: end, timeline };
  }
  function traceAnchorAtColumn(nodes, lane, columnV) {
    const node = nodes.find((n) => n.lanePath === lane.path && !hw.isBranchGraphAnchor(n) && hw.columnsMatch(n.displayColumn ?? n.graphX, columnV));
    const col = node ? node.displayColumn ?? node.graphX : columnV;
    return { graphX: col, displayColumn: col, node };
  }
  function addLaneVersionTrace(lane, nodes, links, parsed, bundlesOnLane) {
    if (lane.isHeader) return;
    if (!hw.PER_LANE_VERSION) {
      const skipCols = hw.laneStepSkipColumns(lane, parsed, bundlesOnLane);
      const ranges = lane.isBranchLane ? [hw.branchLaneTrackRange(lane, parsed, bundlesOnLane)] : hw.parentLaneTrackRanges(lane, parsed);
      ranges.forEach((range) => {
        const { vStart, vEnd, timeline } = hw.laneTrackTimeline(
          range.vStart,
          range.vEnd,
          hw.state.visibleColumnWindow
        );
        if (vEnd < vStart) return;
        links.push({
          kind: "lane-track",
          vStart,
          vEnd,
          lane,
          laneIndex: lane.laneIndex,
          active: false
        });
        const cols = timeline.filter((columnV) => !skipCols.has(columnV));
        cols.forEach((columnV) => {
          if (hw.nodeOnLaneAtColumn(nodes, lane.path, columnV)) return;
          nodes.push(hw.makeVersionStepNode(lane, columnV, columnV));
        });
        for (let i = 1; i < cols.length; i += 1) {
          links.push({
            kind: "lane-trace",
            from: hw.traceAnchorAtColumn(nodes, lane, cols[i - 1]),
            to: hw.traceAnchorAtColumn(nodes, lane, cols[i]),
            lane,
            laneIndex: lane.laneIndex,
            active: false
          });
        }
      });
      return;
    }
    const events = hw.buildLaneVersionEvents(lane, parsed, nodes);
    if (!events.length) return;
    events.forEach((ev, i) => {
      if (!hw.columnInWindow(ev.globalColumn, hw.state.visibleColumnWindow)) return;
      if (!hw.nodeOnLaneAtColumn(nodes, lane.path, ev.globalColumn)) {
        nodes.push(hw.makeVersionStepNode(lane, ev.globalColumn, ev.laneVersion));
      }
      if (i > 0) {
        const prev = events[i - 1];
        links.push({
          kind: "lane-trace",
          from: hw.traceAnchorAtColumn(nodes, lane, prev.globalColumn),
          to: hw.traceAnchorAtColumn(nodes, lane, ev.globalColumn),
          lane,
          laneIndex: lane.laneIndex,
          active: false,
          laneVersion: ev.laneVersion
        });
      }
    });
  }
  function makeGraphNode(commit, lane, files, focusGraphX, head) {
    return {
      id: `${commit.hash}:${lane.path}`,
      hash: commit.hash,
      author: commit.author,
      date: commit.date,
      subject: commit.subject || "",
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
      isFocus: hw.columnsMatch(commit.displayColumn, focusGraphX),
      isPulse: hw.nodeIsPulsing({ id: `${commit.hash}:${lane.path}` }),
      isHead: commit.hash === head.hash,
      isHub: true,
      isFolderAggregate: lane.type === "folder" && !lane.isHeader,
      isBranchLane: !!lane.isBranchLane
    };
  }
  function branchBundlesOnLane(parsed, catalog, seg, branchLane) {
    const bundles = [];
    parsed.commits.forEach((commit) => {
      if (!hw.commitInColumnWindow(commit)) return;
      if (!seg.commitSet.has(commit.hash)) return;
      if (!hw.commitAppliesToLane(commit, branchLane, parsed)) return;
      const matched = commit.files.filter((f) => hw.fileMatchesLane(f, branchLane));
      if (!matched.length) return;
      bundles.push({
        commit,
        graphX: commit.displayColumn,
        displayColumn: commit.displayColumn,
        onPage: [{ lane: branchLane, lanePath: branchLane.path, files: matched }]
      });
    });
    return bundles.sort((a, b) => a.displayColumn - b.displayColumn);
  }
  function buildLaneSlice(parsed, catalog, laneIndex) {
    const lane = catalog.lanes[laneIndex];
    const focusGraphX = catalog.focusGraphX;
    const head = catalog.headCommit;
    const nodes = [];
    const links = [];
    const bundlesOnLane = [];
    parsed.commits.forEach((commit) => {
      if (!hw.commitInColumnWindow(commit)) return;
      if (!hw.commitAppliesToLane(commit, lane, parsed)) return;
      const matched = commit.files.filter((f) => hw.fileMatchesLane(f, lane));
      if (!matched.length) return;
      bundlesOnLane.push({
        id: `bundle-${commit.hash}`,
        commit,
        graphX: commit.displayColumn,
        displayColumn: commit.displayColumn,
        isFocus: hw.columnsMatch(commit.displayColumn, focusGraphX),
        isHead: commit.hash === head.hash,
        onPage: [{ lane, laneIndex, lanePath: lane.path, files: matched }],
        hubLanePath: lane.path,
        hubLaneIndex: laneIndex,
        files: matched
      });
      nodes.push(hw.makeGraphNode(commit, lane, matched, focusGraphX, head));
    });
    bundlesOnLane.sort((a, b) => a.displayColumn - b.displayColumn);
    if (!lane.isHeader && !lane.isBranchLane) {
      (parsed.branchSegments || []).forEach((seg) => {
        if (!hw.segmentTouchesLane(seg, lane)) return;
        hw.ensureParentMergeLandingNode(
          nodes,
          bundlesOnLane,
          lane,
          seg,
          parsed,
          focusGraphX,
          head
        );
      });
    }
    hw.addLaneVersionTrace(lane, nodes, links, parsed, bundlesOnLane);
    if (lane.isBranchLane && bundlesOnLane.length > 1) {
      for (let i = 1; i < bundlesOnLane.length; i += 1) {
        links.push({
          kind: "lane-bridge",
          from: bundlesOnLane[i - 1],
          to: bundlesOnLane[i],
          lane,
          laneIndex,
          active: false
        });
      }
    }
    (parsed.branchSegments || []).forEach((seg) => {
      const forkCommit = parsed.commitMap[seg.forkHash];
      const mergeCommit = seg.mergeHash ? parsed.commitMap[seg.mergeHash] : null;
      const joinV = hw.branchSegmentJoinColumn(seg, parsed);
      const drawMerge = hw.shouldDrawMergeIntoParent(seg, parsed);
      if (!forkCommit) return;
      catalog.lanes.forEach((branchLane) => {
        if (!branchLane.isBranchLane || branchLane.branchSegment !== seg) return;
        const parentLane = catalog.lanes.find((l) => l.path === branchLane.parentLanePath);
        if (!parentLane) return;
        const forkV = hw.laneForkV(parentLane, seg, parsed);
        const mergeV = drawMerge ? joinV : null;
        const forkX = hw.versionX(forkV);
        const mergeX = mergeV != null ? hw.versionX(mergeV) : null;
        const branchBundles = hw.branchBundlesOnLane(parsed, catalog, seg, branchLane);
        const firstBranch = branchBundles[0];
        const lastBranch = branchBundles[branchBundles.length - 1];
        if (parentLane.laneIndex === laneIndex && firstBranch && (hw.columnInWindow(forkV) || hw.columnInWindow(firstBranch.displayColumn))) {
          links.push({
            kind: "fork",
            x1: forkX,
            y1: hw.laneCenterY(parentLane.laneIndex),
            x2: hw.versionX(firstBranch.displayColumn ?? firstBranch.commit.displayColumn),
            y2: hw.laneCenterY(branchLane.laneIndex),
            parentLane,
            branchLane,
            active: true
          });
        }
        if (drawMerge && mergeV != null && branchLane.laneIndex === laneIndex && lastBranch && (hw.columnInWindow(mergeV) || hw.columnInWindow(lastBranch.displayColumn))) {
          const historical = hw.branchSegmentFrozenMerge(seg, parsed);
          const histMerge = historical || hw.branchMergeIsBehindTip(seg, parsed);
          let mergeSource = histMerge ? hw.branchTipAtMerge(seg, parsed) : lastBranch.commit;
          if (mergeSource && mergeV != null) {
            const srcCol = mergeSource.versionIndex ?? mergeSource.displayColumn;
            if (srcCol > mergeV) mergeSource = hw.branchTipAtMerge(seg, parsed);
          }
          const mergeFromCol = mergeSource ? mergeSource.versionIndex ?? mergeSource.displayColumn : lastBranch.displayColumn;
          const mergeFromX = hw.versionX(mergeFromCol);
          const mergeToX = mergeX ?? hw.versionX(mergeV);
          links.push({
            kind: "merge",
            x1: mergeFromX,
            y1: hw.laneCenterY(branchLane.laneIndex),
            x2: mergeToX,
            y2: hw.laneCenterY(parentLane.laneIndex),
            parentLane,
            branchLane,
            active: !historical,
            historical
          });
        }
      });
    });
    return { nodes, links, bundlesOnLane };
  }
  function branchLabelForNode(node) {
    if (node?.lane?.isBranchLane && node.lane.branchSegment) {
      return `\u5206\u652F \u2387 ${node.lane.branchSegment.name}`;
    }
    return "\u4E3B\u6CF3\u9053";
  }
  Object.assign(hw, {
    makeVersionStepNode,
    buildLaneVersionEvents,
    laneTrackTimeline,
    traceAnchorAtColumn,
    addLaneVersionTrace,
    makeGraphNode,
    branchBundlesOnLane,
    buildLaneSlice,
    branchLabelForNode
  });

  // src/selection/boundary.js
  function selectionLocator(node) {
    if (!node) return "";
    const parts = [];
    if (hw.PER_LANE_VERSION && node.laneVersion != null) {
      parts.push(`\u6CF3\u9053 ${hw.formatLaneVersion(node.laneVersion)}`);
    }
    const col = node.displayColumn ?? node.graphX;
    if (col != null) {
      parts.push(hw.PER_LANE_VERSION ? hw.formatGlobalCommitColumn(col) : hw.formatDisplayVersion(col));
    }
    parts.push(hw.branchLabelForNode(node));
    if (node.hash) parts.push(`commit ${node.hash.slice(0, 12)}`);
    return parts.join(" \xB7 ");
  }
  function constraintSingle(filePath, node) {
    const loc = node ? `
\u5B9A\u4F4D\uFF1A${hw.selectionLocator(node)}` : "";
    return `\u3010horsewhip \xB7 AI \u6587\u4EF6\u8FB9\u754C\u3011
\u53EA\u5141\u8BB8\u4FEE\u6539\uFF1A${filePath}${loc}
\u7981\u6B62\u4FEE\u6539\u4ED3\u5E93\u5185\u5176\u4ED6\u4EFB\u4F55\u6587\u4EF6\u3002
\u82E5\u5FC5\u987B\u6539\u52A8\u5176\u4ED6\u6587\u4EF6\uFF0C\u8BF7\u5148\u505C\u4E0B\u5E76\u8BF4\u660E\u7406\u7531\uFF0C\u5F85\u786E\u8BA4\u540E\u518D\u7EE7\u7EED\u3002`;
  }
  function constraintMulti(files) {
    const list = [...files].sort().join(", ");
    return `\u3010horsewhip \xB7 AI \u6587\u4EF6\u8FB9\u754C\u3011
\u5141\u8BB8\u4FEE\u6539\uFF1A${list}
\uFF08\u4EE5\u4E0A\u6587\u4EF6\u5728\u8BE5\u4ED3\u5E93\u5386\u53F2\u4E2D\u5E38\u4E8E\u540C\u4E00 commit \u5185\u5171\u53D8\uFF09
\u7981\u6B62\u4FEE\u6539\u4E0A\u8FF0\u8303\u56F4\u4EE5\u5916\u7684\u6587\u4EF6\u3002`;
  }
  function constraintBoundaryFromNodes(nodes) {
    const lines = nodes.map((node) => {
      const folderPath = hw.folderBoundaryPathFromNode(node);
      const path = folderPath || node.filePath || node.files?.[0] || node.lanePath;
      const label = folderPath ? folderPath === hw.ROOT_BUCKET ? "\u4ED3\u5E93\u6839\u76EE\u5F55/" : folderPath : path;
      const scope = folderPath ? "\uFF08\u6587\u4EF6\u5939\uFF0C\u542B\u5176\u4E0B\u6240\u6709\u8DEF\u5F84\uFF09" : "";
      return `- ${label}${scope}
  \u5B9A\u4F4D\uFF1A${hw.selectionLocator(node)}`;
    }).join("\n");
    return `\u3010horsewhip \xB7 AI \u6587\u4EF6\u8FB9\u754C\u3011
\u672C\u6B21\u4EFB\u52A1\u53EA\u5141\u8BB8\u4FEE\u6539\u4EE5\u4E0B\u8303\u56F4\uFF08\u6BCF\u6761\u5BF9\u5E94\u4E00\u4E2A\u6CF3\u9053\u4E0A\u7684\u9009\u5B9A\u7248\u672C\uFF09\uFF0C\u4E0D\u8981\u521B\u5EFA/\u4FEE\u6539/\u5220\u9664\u5176\u4ED6\u4EFB\u4F55\u8DEF\u5F84\uFF1A
${lines}

\u82E5\u5FC5\u987B\u6539\u52A8\u5176\u4ED6\u6587\u4EF6\uFF0C\u8BF7\u5148\u8BF4\u660E\u7406\u7531\u5E76\u7B49\u5F85\u786E\u8BA4\u540E\u518D\u7EE7\u7EED\u3002`;
  }
  function constraintBoundary(items) {
    const sorted = [...items].sort((a, b) => a.localeCompare(b));
    const lines = sorted.map((item) => {
      if (hw.isFolderBoundaryPath(item)) {
        const label = item === hw.ROOT_BUCKET ? "\u4ED3\u5E93\u6839\u76EE\u5F55/" : item;
        return `- ${label}\uFF08\u6587\u4EF6\u5939\uFF0C\u542B\u5176\u4E0B\u6240\u6709\u8DEF\u5F84\uFF09`;
      }
      return `- ${item}`;
    }).join("\n");
    return `\u3010horsewhip \xB7 AI \u6587\u4EF6\u8FB9\u754C\u3011
\u672C\u6B21\u4EFB\u52A1\u53EA\u5141\u8BB8\u4FEE\u6539\u4EE5\u4E0B\u8303\u56F4\uFF0C\u4E0D\u8981\u521B\u5EFA/\u4FEE\u6539/\u5220\u9664\u5176\u4ED6\u4EFB\u4F55\u8DEF\u5F84\uFF1A
${lines}

\u82E5\u5FC5\u987B\u6539\u52A8\u5176\u4ED6\u6587\u4EF6\uFF0C\u8BF7\u5148\u8BF4\u660E\u7406\u7531\u5E76\u7B49\u5F85\u786E\u8BA4\u540E\u518D\u7EE7\u7EED\u3002`;
  }
  function constraintFolder(folderPath, node) {
    const label = folderPath === hw.ROOT_BUCKET ? "\u4ED3\u5E93\u6839\u76EE\u5F55/" : folderPath;
    const loc = node ? `
\u5B9A\u4F4D\uFF1A${hw.selectionLocator(node)}` : "";
    return `\u3010horsewhip \xB7 AI \u6587\u4EF6\u5939\u8FB9\u754C\u3011
\u672C\u6B21\u4EFB\u52A1\u53EA\u5141\u8BB8\u4FEE\u6539 ${label} \u76EE\u5F55\u4E0B\u7684\u5185\u5BB9\uFF0C\u4E0D\u8981\u521B\u5EFA/\u4FEE\u6539/\u5220\u9664\u8BE5\u76EE\u5F55\u4EE5\u5916\u7684\u4EFB\u4F55\u8DEF\u5F84\u3002${loc}

\u82E5\u5FC5\u987B\u6539\u52A8\u5176\u4ED6\u76EE\u5F55\uFF0C\u8BF7\u5148\u8BF4\u660E\u7406\u7531\u5E76\u7B49\u5F85\u786E\u8BA4\u540E\u518D\u7EE7\u7EED\u3002`;
  }
  function isFolderBoundaryPath(path) {
    return path === hw.ROOT_BUCKET || String(path).endsWith("/");
  }
  function isFolderBoundaryNode(node) {
    if (!node) return false;
    if (node.isFolderAggregate) return true;
    if (node.lane?.type === "folder" && !node.lane?.isHeader) return true;
    const p = node.lanePath || node.lane?.path;
    return Boolean(p && hw.isFolderBoundaryPath(p));
  }
  function folderBoundaryPathFromNode(node) {
    if (!hw.isFolderBoundaryNode(node)) return null;
    let p = node.lanePath || node.lane?.path;
    if (!p) return null;
    if (p === hw.ROOT_BUCKET) return hw.ROOT_BUCKET;
    return p.endsWith("/") ? p : `${p}/`;
  }
  function boundaryPathLabel(path) {
    if (path === hw.ROOT_BUCKET) return "(root)/";
    return path;
  }
  function getBoundaryFilesList() {
    return [...hw.state.boundaryFiles].sort((a, b) => a.localeCompare(b));
  }
  function getSelectedGraphNodes() {
    return [...hw.state.selectedNodeIds].map((id) => hw.state.nodeIndex[id]).filter((n) => n && hw.nodeCanSelect(n));
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
    if (nodes.length === 0) return "";
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
      return String(node.lane.label).replace(/^⎇\s*/, "").trim();
    }
    return "";
  }
  function lockTargetsFromNodes(nodes) {
    return nodes.map((node) => ({
      nodeId: node.id,
      commit: node.hash || "",
      branch: hw.branchNameFromNode(node),
      lanePath: node.lanePath || "",
      files: hw.pathsFromNodeIds(/* @__PURE__ */ new Set([node.id]))
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
      (f) => !folders.some((dir) => hw.fileMatchesLane(f, hw.folderLaneForSelection(dir)))
    );
    return [...folders, ...prunedFiles];
  }
  function rebuildBoundaryFromNodes() {
    hw.state.boundaryFiles.clear();
    const sourceIds = hw.state.lockedNodeIds.size ? hw.state.lockedNodeIds : hw.state.selectedNodeIds;
    pathsFromNodeIds(sourceIds).forEach((p) => hw.state.boundaryFiles.add(p));
  }
  function isBoundaryLocked() {
    return hw.state.lockedNodeIds.size > 0;
  }
  function pushBoundaryToPlugin() {
    if (!hw.isPluginHost() || !window.HorsewhipPluginBridge?.setBoundaryAllowlist) return;
    const locked = hw.isBoundaryLocked();
    const files = locked ? hw.getBoundaryFilesList() : [];
    const targets = locked ? hw.state.lockTargets : [];
    window.HorsewhipPluginBridge.setBoundaryAllowlist(files, locked, targets);
  }
  function syncBoundaryBar() {
    const selectedCount = hw.state.selectedNodeIds.size;
    const lockedCount = hw.state.lockedNodeIds.size;
    const locked = hw.isBoundaryLocked();
    hw.rebuildBoundaryFromNodes();
    const files = hw.getBoundaryFilesList();
    const showBar = selectedCount > 0 || locked;
    hw.pushBoundaryToPlugin();
    if (!hw.BOUNDARY_BAR_ENABLED) {
      if (hw.isPluginHost() && hw.state.catalog?.lanes?.length) {
        hw.updatePluginBar(hw.state.catalog.lanes.length);
      }
      hw.syncFileRailBoundaryHighlight();
      return;
    }
    if (hw.els.boundaryBar) hw.els.boundaryBar.hidden = !showBar;
    if (hw.els.boundaryTitle) {
      hw.els.boundaryTitle.textContent = locked ? "\u8DD1\u9A6C\u8303\u56F4\uFF08\u4EC5\u6B64\u53EF\u6539\uFF09" : "\u70B9\u9009\u8303\u56F4";
    }
    if (hw.els.boundaryCount) {
      if (locked) {
        const branchHint = hw.state.lockTargets.length ? [...new Set(hw.state.lockTargets.map((t) => t.branch).filter(Boolean))].map((b) => `\u2387 ${b}`).join(" \xB7 ") || "\u4E3B\u6CF3\u9053" : "";
        const aimLabel = lockedCount === 1 ? "\u5DF2\u5708\u5B9A 1 \u5904\u53EF\u6539" : `\u5DF2\u5708\u5B9A ${lockedCount} \u5904\u53EF\u6539`;
        hw.els.boundaryCount.textContent = branchHint ? `${aimLabel} \xB7 ${branchHint}` : aimLabel;
      } else {
        hw.els.boundaryCount.textContent = selectedCount === 1 ? "\u5DF2\u9009 1 \u4E2A\u8282\u70B9 \xB7 \u6325\u97AD\u5708\u5B9A" : `\u5DF2\u9009 ${selectedCount} \u4E2A\u8282\u70B9 \xB7 \u6325\u97AD\u5708\u5B9A`;
      }
    }
    if (hw.els.boundaryFiles) {
      hw.els.boundaryFiles.textContent = files.length ? files.map(hw.boundaryPathLabel).join(" \xB7 ") : "";
      hw.els.boundaryFiles.title = files.length ? files.map(hw.boundaryPathLabel).join("\n") : "";
    }
    if (hw.els.boundaryPreview) {
      hw.els.boundaryPreview.textContent = "";
    }
    if (hw.els.btnBoundaryCopy) hw.els.btnBoundaryCopy.disabled = !selectedCount;
    if (hw.els.btnBoundaryChat) {
      hw.els.btnBoundaryChat.disabled = !files.length;
      hw.els.btnBoundaryChat.hidden = hw.isPluginHost();
    }
    if (hw.isPluginHost() && hw.state.catalog?.lanes?.length) {
      hw.updatePluginBar(hw.state.catalog.lanes.length);
    }
    hw.syncFileRailBoundaryHighlight();
  }
  function syncFileRailBoundaryHighlight() {
    if (!hw.els.fileRailInner) return;
    const lockedItems = hw.isBoundaryLocked() ? hw.getBoundaryFilesList() : [];
    const previewItems = hw.isBoundaryLocked() ? pathsFromNodeIds(hw.state.selectedNodeIds) : hw.getBoundaryFilesList();
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
    hw.els.fileRailInner.querySelectorAll(".file-rail__item").forEach((row) => {
      row.classList.remove("file-rail__item--boundary", "file-rail__item--locked");
      if (rowMatches(row, lockedFolders, lockedFiles)) {
        row.classList.add("file-rail__item--locked");
        return;
      }
      if (!hw.isBoundaryLocked() && rowMatches(row, previewFolders, previewFiles)) {
        row.classList.add("file-rail__item--boundary");
      }
    });
  }
  function clearNodeSelection() {
    if (hw.state.selectedNodeIds.size === 0 && hw.state.lockedNodeIds.size === 0) return;
    hw.state.selectedNodeIds.clear();
    hw.state.lockedNodeIds.clear();
    hw.state.lockTargets = [];
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
    return { type: "folder", path: folderPath, isHeader: false, collapsed: true };
  }
  function findLaneIndexForFolderPath(folderPath) {
    const lanes = hw.state.catalog?.lanes;
    if (!lanes) return -1;
    const lane = lanes.find((l) => l.path === folderPath && l.type === "folder");
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
      (c) => hw.columnsMatch(c.displayColumn ?? c.graphX, columnV) && c.files.some((f) => hw.fileMatchesLane(f, folderLane))
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
      lane: { path: folderPath, collapsed: true, type: "folder" },
      isFolderAggregate: true,
      label: hw.folderDisplayLabel(folderPath)
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
    if (lane.type !== "folder" && !lane.collapsed && !lane.isHeader) return;
    const folderLabel = lane.path === hw.ROOT_BUCKET ? "(root)" : lane.path;
    if (lane.isHeader) {
      row.dataset.folderPath = lane.path;
      row.classList.add("file-rail__item--folder-header");
      row.title = `${folderLabel} \xB7 \u70B9\u51FB\u6536\u8D77`;
      const onCollapse = (e) => {
        e.preventDefault();
        e.stopPropagation();
        hw.toggleExpand(lane.path, e.altKey);
      };
      if (chev) {
        chev.classList.add("file-rail__chev--collapse");
        chev.title = `\u6536\u8D77 ${lane.label || folderLabel}`;
        chev.addEventListener("click", onCollapse);
      }
      row.addEventListener("click", (e) => {
        if (e.target.closest(".file-rail__chev--collapse")) return;
        onCollapse(e);
      });
      return;
    }
    if (!lane.collapsed) return;
    row.dataset.folderPath = lane.path;
    row.title = `${folderLabel} \xB7 \u70B9\u51FB\u9009\u4E2D\u6587\u4EF6\u5939\u8FB9\u754C \xB7 \u25B8 \u5C55\u5F00`;
    if (chev) {
      chev.classList.add("file-rail__chev--expand");
      chev.title = `\u5C55\u5F00 ${lane.label || folderLabel}`;
      chev.addEventListener("click", (e) => {
        e.stopPropagation();
        hw.toggleExpand(lane.path, e.altKey);
      });
    }
    row.addEventListener("click", (e) => {
      if (e.target.closest(".file-rail__chev--expand")) return;
      if (e.altKey && hw.isPluginHost() && window.HorsewhipPluginBridge?.revealFolder) {
        window.HorsewhipPluginBridge.revealFolder(lane.path === hw.ROOT_BUCKET ? "" : lane.path);
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
    const files = node?.files?.length ? node.files : node?.filePath ? [node.filePath] : [];
    return [...new Set(files.filter(Boolean))];
  }
  function cmdCheckoutFiles(hash, filePaths) {
    const paths = filePaths || [];
    if (!paths.length) return "# \u6B64\u8282\u70B9\u65E0\u6587\u4EF6\u8DEF\u5F84\uFF08\u8BF7\u9009\u5177\u4F53\u6587\u4EF6\u8282\u70B9\u6216\u542B\u6587\u4EF6\u7684 commit\uFF09";
    return paths.map((f) => hw.cmdCheckout(hash, f)).join("\n");
  }
  function cmdCheckoutDetach(hash) {
    const short = String(hash || "").slice(0, 7);
    return `git switch --detach ${short}
# \u4EC5\u67E5\u770B\u8BE5\u7248\u672C\uFF1BHEAD \u4F1A\u8FDB\u5165 detached\u3002\u56DE\u5230\u539F\u5206\u652F\uFF1Agit switch -`;
  }
  function cmdPreviewUi(hash, devCommand) {
    const short = String(hash || "").slice(0, 7);
    const dev = devCommand || "npm run dev";
    return `# \u6574\u5E93\u68C0\u51FA\uFF08\u5DE5\u4F5C\u533A\u5168\u90E8\u6587\u4EF6\u53D8\u4E3A\u8BE5\u63D0\u4EA4\uFF1B\u975E\u4E34\u65F6\u526F\u672C\uFF09
git switch --detach ${short}
${dev}
# \u770B\u5B8C\u540E\u70B9 horsewhip \u6807\u9898\u680F\u300C\u6062\u590D\u5DE5\u4F5C\u533A\u300D`;
  }
  function branchRefOnNode(node, parsed) {
    const c = parsed?.commitMap?.[node?.hash];
    if (!c?.refs?.length) return null;
    for (const r of c.refs) {
      const clean = hw.normalizeRefName?.(r) ?? String(r).replace(/^origin\//, "").trim();
      if (!clean || /^HEAD$/i.test(clean) || /^(main|master)$/i.test(clean)) continue;
      return clean;
    }
    return null;
  }
  function cmdSwitchBranch(branchName) {
    return `git switch ${branchName}`;
  }
  function cmdResetHard(hash) {
    return `# \u26A0\uFE0F \u5C06\u4E22\u5931 ${hash} \u4E4B\u540E\u7684\u6240\u6709\u672A\u63D0\u4EA4/\u5DF2\u63D0\u4EA4\u672C\u5730\u6539\u52A8\uFF0C\u8BF7\u5148\u5907\u4EFD\u6216 stash
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
    const crackTarget = btnEl?.closest?.(".hw-whip-float") || btnEl;
    crackTarget?.classList.add("hw-whip-btn--crack", "hw-whip-float--crack");
    hw.playWhipCrackSound();
    hw.state.lockedNodeIds.clear();
    nodes.forEach((node) => {
      if (node?.id) hw.state.lockedNodeIds.add(node.id);
    });
    hw.state.lockTargets = hw.lockTargetsFromNodes(nodes);
    hw.rebuildBoundaryFromNodes();
    hw.pushBoundaryToPlugin();
    hw.syncBoundaryBar();
    hw.updateSelectionVisuals();
    const fileCount = hw.getBoundaryFilesList().length;
    const branches = [...new Set(hw.state.lockTargets.map((t) => t.branch).filter(Boolean))];
    const branchText = branches.length ? ` \xB7 ${branches.map((b) => `\u2387 ${b}`).join(" ")}` : " \xB7 \u4E3B\u6CF3\u9053";
    const msg = nodes.length === 1 ? `\u5DF2\u5708\u5B9A\u8DD1\u9A6C\u8303\u56F4\uFF1A\u4EC5\u6B64 ${fileCount} \u6761\u8DEF\u5F84\u53EF\u6539${branchText}` : `\u5DF2\u5708\u5B9A\u8DD1\u9A6C\u8303\u56F4\uFF1A\u4EC5\u6B64 ${fileCount} \u6761\u8DEF\u5F84\u53EF\u6539${branchText}`;
    hw.showCopyToast(msg);
    setTimeout(() => crackTarget?.classList.remove("hw-whip-btn--crack", "hw-whip-float--crack"), 520);
  }
  function crackWhipOnSelection(nodes, btnEl) {
    hw.lockBoundaryFromSelection(nodes, btnEl);
  }
  function selectedWhipNodes() {
    return [...hw.state.selectedNodeIds].map((id) => hw.state.nodeIndex[id]).filter((node) => hw.nodeCanWhip(node));
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
    d3.selectAll(".node-lock-aim").remove();
    d3.selectAll(".node-group").each(function() {
      const d = d3.select(this).datum();
      if (!d?.id || !hw.state.lockedNodeIds.has(d.id)) return;
      const lane = d.lane;
      const color = hw.laneIconColor(lane);
      const g = d3.select(this);
      const rOuter = hw.ICON_SIZE + 7.2;
      const aim = g.insert("g", ".node-hit").attr("class", "node-lock-aim").style("pointer-events", "none");
      aim.append("circle").attr("class", "node-lock-ring node-lock-ring--outer").attr("r", rOuter).attr("fill", "none").attr("stroke", color).attr("stroke-width", 2).attr("opacity", 0.95);
      aim.append("circle").attr("class", "node-lock-ring node-lock-ring--tick").attr("r", rOuter).attr("fill", "none").attr("stroke", color).attr("stroke-width", 1.2).attr("stroke-dasharray", "2.5 5.5").attr("opacity", 0.55);
    });
  }
  function updateSelectionVisuals() {
    const bundle = hw.state.selectedLink;
    d3.selectAll(".node-selection-ring").remove();
    d3.selectAll(".node-group").classed("node-group--selected", function() {
      const d = d3.select(this).datum();
      return d?.id && hw.state.selectedNodeIds.has(d.id) && !hw.state.lockedNodeIds.has(d.id);
    });
    d3.selectAll(".node-group").classed("node-group--locked", function() {
      const d = d3.select(this).datum();
      return d?.id && hw.state.lockedNodeIds.has(d.id);
    });
    hw.syncNodeLockRings();
    hw.setPulseNode(hw.state.pulseNodeId);
    d3.selectAll(".link-group").classed("link-group--selected", function() {
      const d = d3.select(this).select(".link-core").datum();
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
    branchNameFromNode,
    lockTargetsFromNodes,
    pathsFromNodeIds,
    rebuildBoundaryFromNodes,
    isBoundaryLocked,
    pushBoundaryToPlugin,
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
    updateSelectionVisuals
  });

  // src/viewport/layout.js
  function versionScale() {
    return hw.CONFIG.VERSION_SPACING * (hw.state.graphZoom || 1);
  }
  function versionColumnX(columnV) {
    return hw.CONFIG.VERSION_ORIGIN_X + (columnV - 1) * hw.versionScale();
  }
  function visibleColumnRange() {
    const spacing = hw.versionScale();
    const origin = hw.CONFIG.VERSION_ORIGIN_X;
    const pan = hw.state.panX ?? hw.computePanBounds().panMin;
    const vpW = hw.els.graphViewport?.clientWidth || 800;
    const m = hw.CONFIG.MARGIN.left;
    const rawMin = 1 + (pan - m - origin) / spacing;
    const rawMax = 1 + (pan + vpW - m - origin) / spacing;
    const headCol = hw.state.parsed ? hw.headMainlineVersion(hw.state.parsed) || hw.headColumn(hw.state.parsed) : 1;
    const pad = hw.CONFIG.COLUMN_VIEW_OVERSCAN;
    return {
      vMin: Math.min(rawMin, headCol) - pad,
      vMax: Math.max(rawMax, headCol) + pad,
      headCol
    };
  }
  function updateVisibleColumnWindow() {
    hw.state.visibleColumnWindow = hw.visibleColumnRange();
  }
  function columnInWindow(columnV, win) {
    if (columnV == null || Number.isNaN(columnV)) return false;
    const w = win || hw.state.visibleColumnWindow;
    if (!w) return true;
    if (hw.columnsMatch(columnV, w.headCol)) return true;
    return columnV >= w.vMin && columnV <= w.vMax;
  }
  function commitInColumnWindow(commit) {
    return hw.columnInWindow(commit.displayColumn ?? commit.graphX, hw.state.visibleColumnWindow);
  }
  function panXForHeadFocus(parsed) {
    const headCol = hw.headMainlineVersion(parsed) || hw.headColumn(parsed);
    return hw.panXForColumnFocus(headCol);
  }
  function panXForColumnFocus(columnV) {
    const colScreenX = hw.CONFIG.MARGIN.left + hw.versionColumnX(columnV);
    const vpW = hw.els.graphViewport?.clientWidth || 800;
    const targetX = vpW * 0.5;
    return Math.max(hw.computePanBounds().panMin, colScreenX - targetX);
  }
  function latestVersionColumnForFile(parsed, filePath) {
    const tl = parsed.fileTimelines?.[filePath];
    if (tl?.length) {
      const last = tl[tl.length - 1];
      return last.displayColumn ?? last.versionIndex ?? last.graphX ?? hw.headColumn(parsed);
    }
    return hw.headMainlineVersion(parsed) || hw.headColumn(parsed);
  }
  function findLaneIndexForFilePath(filePath) {
    const lanes = hw.state.catalog?.lanes;
    if (!lanes) return -1;
    const lane = lanes.find((l) => l.type === "file" && l.path === filePath);
    return lane ? lane.laneIndex : -1;
  }
  function fileRailScrollEl() {
    return hw.els.fileRailInner || hw.els.fileRail;
  }
  function fileRailScrollViewportH() {
    const el = hw.fileRailScrollEl();
    return el?.clientHeight || hw.els.graphViewport?.clientHeight || 600;
  }
  function fileRailMaxScroll() {
    const inner = hw.els.fileRailInner;
    const scrollEl = hw.fileRailScrollEl();
    if (!inner || !scrollEl) return 0;
    return Math.max(0, inner.offsetHeight - scrollEl.clientHeight);
  }
  function scrollTopForLaneCenter(laneIndex) {
    const vpH = hw.fileRailScrollViewportH();
    const laneY = hw.laneCenterY(laneIndex);
    const maxScroll = hw.fileRailMaxScroll();
    return Math.max(0, Math.min(maxScroll, laneY - vpH / 2));
  }
  function syncFileRailScrollFromState() {
    const scrollEl = hw.fileRailScrollEl();
    if (!scrollEl) return;
    hw.scrollSync = true;
    scrollEl.scrollTop = hw.state.scrollTop;
    hw.scrollSync = false;
  }
  function applyGraphTransformImmediate() {
    if (!hw.gMain) return;
    hw.gMain.attr("transform", `translate(${-hw.state.panX}, ${-hw.state.scrollTop})`);
  }
  function animateViewportTo(targetPanX, targetScrollTop, duration = 420) {
    if (!hw.gMain || !hw.state.parsed) return Promise.resolve();
    const gen = ++hw.state.viewportAnimGeneration;
    const bounds = hw.computePanBounds();
    const startPan = hw.state.panX ?? bounds.panMin;
    const startScroll = hw.state.scrollTop ?? 0;
    const endPan = hw.clampPan(targetPanX, bounds);
    const maxScroll = hw.fileRailMaxScroll();
    const endScroll = Math.max(0, Math.min(maxScroll, targetScrollTop));
    const needMove = Math.abs(endPan - startPan) > 0.5 || Math.abs(endScroll - startScroll) > 0.5;
    const finish = () => {
      if (gen !== hw.state.viewportAnimGeneration) return;
      hw.state.panX = endPan;
      hw.state.scrollTop = endScroll;
      hw.applyGraphTransformImmediate();
      hw.syncFileRailScrollFromState();
      hw.updateVisibleColumnWindow();
      hw.scheduleViewportSync({ invalidateSlices: true });
    };
    if (!needMove) {
      finish();
      return Promise.resolve();
    }
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      finish();
      return Promise.resolve();
    }
    hw.stopViewportAnimation();
    return new Promise((resolve) => {
      d3.select(hw.gMain.node()).transition("hw-viewport-pan").duration(duration).ease(d3.easeCubicInOut).tween("hw-viewport", () => {
        const panI = d3.interpolateNumber(startPan, endPan);
        const scrollI = d3.interpolateNumber(startScroll, endScroll);
        return (t) => {
          if (gen !== hw.state.viewportAnimGeneration) return;
          hw.state.panX = panI(t);
          hw.state.scrollTop = scrollI(t);
          hw.applyGraphTransformImmediate();
          hw.syncFileRailScrollFromState();
        };
      }).on("end", () => {
        if (gen !== hw.state.viewportAnimGeneration) return;
        finish();
        resolve();
      });
    });
  }
  function focusFileLane(filePath) {
    if (!hw.state.parsed || !hw.state.catalog || !filePath) return;
    const parsed = hw.state.parsed;
    const columnV = hw.latestVersionColumnForFile(parsed, filePath);
    const laneIndex = hw.findLaneIndexForFilePath(filePath);
    hw.state.focusedFilePath = filePath;
    hw.state.focusGraphX = columnV;
    hw.syncFileRailFocusHighlight();
    const panX = hw.panXForColumnFocus(columnV);
    const scrollTop = laneIndex >= 0 ? hw.scrollTopForLaneCenter(laneIndex) : hw.state.scrollTop;
    hw.updateGraphFocus();
    void hw.animateViewportTo(panX, scrollTop).then(() => {
      if (hw.state.focusedFilePath !== filePath) return;
      const lane = laneIndex >= 0 ? hw.state.catalog.lanes[laneIndex] : null;
      if (lane) {
        const commit = parsed.commits.find(
          (c) => hw.columnsMatch(c.displayColumn ?? c.graphX, columnV) && c.files.some((f) => hw.fileMatchesLane(f, lane))
        );
        if (commit) {
          hw.state.pulseNodeId = `${commit.hash}:${lane.path}`;
          hw.setPulseNode(hw.state.pulseNodeId);
        }
      }
      hw.updateGraphFocus();
    });
  }
  function syncFileRailFocusHighlight() {
    if (!hw.els.fileRailInner) return;
    hw.els.fileRailInner.querySelectorAll("[data-file-path]").forEach((row) => {
      row.classList.toggle(
        "file-rail__item--focused",
        row.getAttribute("data-file-path") === hw.state.focusedFilePath
      );
    });
  }
  function wireFileRailFocus(row, lane) {
    if (lane.type !== "file" || lane.isBranchLane || lane.collapsed || lane.isHeader) return;
    row.dataset.filePath = lane.path;
    row.classList.add("file-rail__item--focusable");
    row.classList.toggle("file-rail__item--focused", lane.path === hw.state.focusedFilePath);
    row.addEventListener("click", (e) => {
      if (e.altKey) return;
      if (e.target.closest(".file-rail__chev--collapse")) return;
      e.preventDefault();
      e.stopPropagation();
      hw.focusFileLane(lane.path);
    });
  }
  function invalidateLaneSliceCache() {
    hw.state.laneSliceCache = /* @__PURE__ */ new Map();
    if (hw.graphRenderCtx?.renderedLanes) {
      [...hw.graphRenderCtx.renderedLanes].forEach((i) => hw.unmountLaneSlice(i));
    }
  }
  function sliceCacheKey(laneIndex) {
    const w = hw.state.visibleColumnWindow;
    if (!w) return String(laneIndex);
    const vMin = Math.floor(w.vMin);
    const vMax = Math.ceil(w.vMax);
    return `${laneIndex}:${vMin}:${vMax}`;
  }
  function columnWindowCacheChanged(prev, next) {
    if (!prev || !next) return true;
    return Math.floor(prev.vMin) !== Math.floor(next.vMin) || Math.ceil(prev.vMax) !== Math.ceil(next.vMax);
  }
  function stopViewportAnimation() {
    hw.state.viewportAnimGeneration += 1;
    if (hw.gMain) d3.select(hw.gMain.node()).interrupt("hw-viewport-pan");
  }
  function markViewportInteracting() {
    if (!hw.state.viewportInteracting) {
      hw.state.viewportInteracting = true;
      hw.els.graphViewport?.classList.add("graph-viewport--panning");
    }
    if (hw.viewportInteractEndTimer) clearTimeout(hw.viewportInteractEndTimer);
    hw.viewportInteractEndTimer = setTimeout(() => {
      hw.viewportInteractEndTimer = null;
      hw.state.viewportInteracting = false;
      hw.els.graphViewport?.classList.remove("graph-viewport--panning");
      hw.updateVisibleColumnWindow();
      hw.scheduleViewportSync();
    }, 120);
  }
  function setGraphZoom(next) {
    const z = Math.min(hw.CONFIG.ZOOM_MAX, Math.max(hw.CONFIG.ZOOM_MIN, next));
    if (Math.abs(z - hw.state.graphZoom) < 1e-3) return;
    hw.state.graphZoom = z;
    if (hw.els.zoomLabel) hw.els.zoomLabel.textContent = `${Math.round(z * 100)}%`;
    const catalog = hw.state.catalog;
    const pan = hw.state.panX;
    hw.invalidateLaneSliceCache();
    if (catalog) {
      hw.prepareGraphShell(catalog);
      if (pan != null) hw.state.panX = pan;
      hw.scheduleViewportSync({ invalidateSlices: true });
    }
  }
  function nudgeZoom(factor) {
    hw.setGraphZoom((hw.state.graphZoom || 1) * factor);
  }
  function updatePaginationUI(parsed) {
    if (!hw.els.largeWarn || !parsed) return;
    const loaded = parsed.loadedCommitCount ?? parsed.commits.length;
    const total = parsed.totalCommitsInLog ?? loaded;
    if (total <= hw.CONFIG.COMMIT_PAGE_SIZE && loaded >= total) {
      hw.els.largeWarn.hidden = true;
      return;
    }
    if (hw.els.largeWarnText) {
      hw.els.largeWarnText.textContent = total > loaded ? `\u5DF2\u52A0\u8F7D ${loaded}/${total} commits\uFF08\u5206\u9875\uFF09` : `${total} commits`;
    }
    if (hw.els.btnLoadMoreCommits) {
      const canMore = loaded < total;
      hw.els.btnLoadMoreCommits.hidden = !canMore;
      hw.els.btnLoadMoreCommits.textContent = canMore ? `+${Math.min(hw.CONFIG.COMMIT_PAGE_STEP, total - loaded)}` : "";
    }
    hw.els.largeWarn.hidden = false;
  }
  function versionX(columnV) {
    return hw.versionColumnX(columnV);
  }
  function laneCenterY(laneIndex) {
    return hw.CONFIG.RULER_HEIGHT + laneIndex * hw.CONFIG.LANE_HEIGHT + hw.CONFIG.LANE_HEIGHT / 2;
  }
  function headXContent(headCol) {
    return hw.CONFIG.MARGIN.left + hw.versionColumnX(headCol);
  }
  function v1ContentX() {
    return hw.CONFIG.MARGIN.left + hw.versionColumnX(1);
  }
  function futureExtentX(parsed) {
    return hw.versionColumnX(hw.rulerExtent(parsed));
  }
  function computePanBounds() {
    return { panMin: hw.v1ContentX() - hw.CONFIG.V1_VIEW_INSET, panMax: Infinity };
  }
  function clampPan(panX, bounds) {
    return Math.max(bounds.panMin, panX);
  }
  function nudgePan(delta) {
    if (!hw.state.parsed || !hw.svgLayout) return;
    hw.stopViewportAnimation();
    const bounds = hw.svgLayout.panBounds || hw.computePanBounds();
    const panMin = bounds.panMin;
    const next = hw.state.panX + delta;
    if (next < panMin) {
      hw.state.panX = panMin;
    } else {
      hw.state.panX = next;
    }
    hw.updateVisibleColumnWindow();
    hw.applyGraphTransformImmediate();
    hw.markViewportInteracting();
    hw.scheduleViewportSync();
  }
  function nudgeVerticalScroll(delta) {
    hw.stopViewportAnimation();
    const max = hw.fileRailMaxScroll();
    hw.state.scrollTop = Math.max(0, Math.min(max, hw.state.scrollTop + delta));
    hw.applyGraphTransformImmediate();
    hw.syncFileRailScrollFromState();
    hw.markViewportInteracting();
    hw.scheduleViewportSync();
  }
  Object.assign(hw, {
    versionScale,
    versionColumnX,
    visibleColumnRange,
    updateVisibleColumnWindow,
    columnInWindow,
    commitInColumnWindow,
    panXForHeadFocus,
    panXForColumnFocus,
    latestVersionColumnForFile,
    findLaneIndexForFilePath,
    fileRailScrollEl,
    fileRailScrollViewportH,
    fileRailMaxScroll,
    scrollTopForLaneCenter,
    syncFileRailScrollFromState,
    applyGraphTransformImmediate,
    animateViewportTo,
    focusFileLane,
    syncFileRailFocusHighlight,
    wireFileRailFocus,
    invalidateLaneSliceCache,
    sliceCacheKey,
    columnWindowCacheChanged,
    stopViewportAnimation,
    markViewportInteracting,
    setGraphZoom,
    nudgeZoom,
    updatePaginationUI,
    versionX,
    laneCenterY,
    headXContent,
    v1ContentX,
    futureExtentX,
    computePanBounds,
    clampPan,
    nudgePan,
    nudgeVerticalScroll
  });

  // src/graph/geometry.js
  function curveBridge(x1, y1, x2, y2) {
    const dx = x2 - x1;
    const bend = Math.max(6, Math.abs(dx) * 0.44);
    const cx1 = x1 + bend;
    const cx2 = x2 - bend;
    return `M${x1},${y1} C${cx1},${y1} ${cx2},${y2} ${x2},${y2}`;
  }
  function curveSpoke(x1, y1, x2, y2) {
    const mx = x1 + (x2 - x1) * 0.58;
    if (Math.abs(y2 - y1) < 1) {
      const my = y1 - 3;
      return `M${x1},${y1} Q${mx},${my} ${x2},${y2}`;
    }
    return `M${x1},${y1} C${mx},${y1} ${mx},${y2} ${x2},${y2}`;
  }
  function curveBus(x, yTop, yBot) {
    const mid = (yTop + yBot) / 2;
    const bow = Math.min(2, (yBot - yTop) * 0.05);
    return `M${x},${yTop} Q${x + bow},${mid} ${x},${yBot}`;
  }
  function laneLine(x1, y1, x2, y2) {
    return `M${x1},${y1} L${x2},${y2}`;
  }
  Object.assign(hw, {
    curveBridge,
    curveSpoke,
    curveBus,
    laneLine
  });

  // src/graph/svg-nodes.js
  function pulseColumn(parsed) {
    const headCol = hw.headMainlineVersion(parsed) || hw.headColumn(parsed);
    if (hw.state.focusGraphX != null && !hw.columnsMatch(hw.state.focusGraphX, headCol)) {
      return hw.state.focusGraphX;
    }
    return headCol;
  }
  function rippleTargetNodeId() {
    const lastId = hw.state.lastSelectedNodeId;
    if (lastId && hw.state.selectedNodeIds.has(lastId)) return lastId;
    return hw.state.pulseNodeId || null;
  }
  function nodeShowsRipples(node) {
    const id = node?.id;
    const target = hw.rippleTargetNodeId();
    return !!(id && target && id === target);
  }
  function nodeIsPulsing(node) {
    return hw.nodeShowsRipples(node);
  }
  function syncNodeRippleVisuals() {
    if (!hw.gScroll) return;
    hw.gScroll.selectAll(".node-group").each(function() {
      const sel = d3.select(this);
      const d = sel.datum();
      if (!d) return;
      const show = hw.nodeShowsRipples(d);
      d.isPulse = show;
      sel.classed("node-group--pulse", show);
      sel.selectAll(".node-ripples").remove();
      if (show && d.lane?.color) hw.appendNodeRipples(sel, d.lane.color);
    });
  }
  function pickDefaultPulseNode(nodes, parsed) {
    const headCol = hw.headMainlineVersion(parsed) || 1;
    const trunk = parsed.trunkLaneCommitSet || parsed.mainlineSet;
    const pulseEligible = (n) => hw.nodeCanShowTooltip(n) && !hw.isBranchGraphAnchor(n);
    const atHead = nodes.filter((n) => pulseEligible(n) && hw.columnsMatch(n.displayColumn, headCol));
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
    hw.state.pulseNodeId = nodeId || null;
    hw.syncNodeRippleVisuals();
  }
  function updateGraphFocus() {
    const parsed = hw.state.parsed;
    if (!parsed || !hw.gScroll) return;
    const focusGraphX = hw.state.focusGraphX ?? hw.resolveFocusGraphX(parsed);
    hw.gScroll.selectAll(".node-group").each(function() {
      const sel = d3.select(this);
      const d = sel.datum();
      if (!d) return;
      const isFocus = hw.columnsMatch(d.displayColumn, focusGraphX);
      d.isFocus = isFocus;
      sel.classed("node-group--focus", isFocus);
      sel.classed("node-group--stale", !isFocus && !d.isFolderAggregate);
    });
    hw.setPulseNode(hw.state.pulseNodeId);
  }
  function appendNodeRipples(g, color) {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const ripG = g.insert("g", ":first-child").attr("class", "node-ripples");
    [0, 1, 2].forEach((i) => {
      ripG.append("circle").attr("class", `node-ripple node-ripple--d${i}`).attr("r", hw.ICON_SIZE + 1).attr("fill", "none").attr("stroke", color).attr("stroke-width", 1.75);
    });
  }
  function appendRulerRipples(g, cx, cy) {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const ripG = g.append("g").attr("class", "version-ruler__pulse").attr("transform", `translate(${cx},${cy})`);
    [0, 1, 2].forEach((i) => {
      ripG.append("circle").attr("class", `version-ruler__pulse-ring version-ruler__pulse-ring--d${i}`).attr("r", 2.2).attr("fill", "none").attr("stroke", "var(--accent)").attr("stroke-width", 1.5);
    });
  }
  function fileIconKindFromPath(path) {
    const base = (path.split("/").pop() || path).toLowerCase();
    if (hw.CONFIG_FILE_RE.test(base) || hw.CONFIG_BASENAMES.test(base)) return "config";
    if (hw.CODE_FILE_RE.test(path)) return "code";
    return "other";
  }
  function laneIconKind(lane) {
    if (lane.collapsed || lane.isHeader || lane.type === "folder") return "folder";
    return hw.fileIconKindFromPath(lane.path);
  }
  function isBranchGraphAnchor(node) {
    return !!(node?.isForkAnchor || node?.isMergeAnchor);
  }
  function isVersionStepNode(node) {
    return !!node?.isVersionStep;
  }
  function versionStepIconSize() {
    return hw.ICON_SIZE * hw.VERSION_STEP_ICON_SCALE;
  }
  function nodeOnLaneAtColumn(nodes, lanePath, columnV) {
    return nodes.some((n) => !hw.isBranchGraphAnchor(n) && !hw.isVersionStepNode(n) && n.lanePath === lanePath && hw.columnsMatch(n.displayColumn ?? n.graphX, columnV));
  }
  function nodeCanShowTooltip(node) {
    if (!node || hw.isVersionStepNode(node)) return false;
    if (node.isFolderAggregate) return true;
    if (node.isForkAnchor || node.isMergeAnchor || node.isMergeLanding) return true;
    const lane = node.lane;
    if (!lane || lane.isHeader) return false;
    if (lane.collapsed && !node.isFolderAggregate) return false;
    if (lane.type === "folder" && !node.isFolderAggregate) return false;
    const path = node.filePath || node.files?.[0] || lane.path;
    return Boolean(path && !String(path).endsWith("/"));
  }
  function nodeIconKind(node) {
    if (node.isFolderAggregate) return "folder";
    if (node.lane && hw.laneIconKind(node.lane) === "folder") return "folder";
    const fp = node.filePath || node.files?.[0] || node.lane?.path || "";
    return hw.fileIconKindFromPath(fp);
  }
  function equilateralTrianglePath(side) {
    const h = Math.sqrt(3) / 2 * side;
    return `M0,${-2 * h / 3} L${-side / 2},${h / 3} L${side / 2},${h / 3} Z`;
  }
  function regularHexagonPath(radius) {
    const pts = Array.from({ length: 6 }, (_, i) => {
      const a = Math.PI / 3 * i - Math.PI / 2;
      return [radius * Math.cos(a), radius * Math.sin(a)];
    });
    return `M${pts.map(([x, y]) => `${x},${y}`).join(" L ")} Z`;
  }
  function folderRoundedRectRadius(width, height) {
    return Math.min(width, height) * 0.24;
  }
  function appendSvgFolderRect(g, className, size, color) {
    const side = size * 2;
    const radius = hw.folderRoundedRectRadius(side, side);
    return g.append("rect").attr("class", className).attr("x", -size).attr("y", -size).attr("width", side).attr("height", side).attr("rx", radius).attr("ry", radius).attr("fill", color);
  }
  function appendSvgLaneIcon(g, kind, color, size) {
    const side = size * 2;
    if (kind === "folder") {
      hw.appendSvgFolderRect(g, "node-icon node-icon--folder", size, color);
      return;
    }
    if (kind === "code") {
      g.append("circle").attr("class", "node-icon node-icon--code").attr("r", size).attr("fill", color);
      return;
    }
    if (kind === "config") {
      g.append("path").attr("class", "node-icon node-icon--config").attr("d", hw.regularHexagonPath(size)).attr("fill", color);
      return;
    }
    g.append("path").attr("class", "node-icon node-icon--other").attr("d", hw.equilateralTrianglePath(side)).attr("fill", color);
  }
  function createRailIcon(lane) {
    const kind = hw.laneIconKind(lane);
    const color = lane.color;
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("class", "file-rail__icon");
    svg.setAttribute("width", "7");
    svg.setAttribute("height", "7");
    svg.setAttribute("viewBox", "-4 -4 8 8");
    svg.setAttribute("aria-hidden", "true");
    if (kind === "folder") {
      const side = 5.4;
      const r = hw.folderRoundedRectRadius(side, side);
      const rect = document.createElementNS("http://www.w3.org/2000/svg", "rect");
      rect.setAttribute("x", String(-side / 2));
      rect.setAttribute("y", String(-side / 2));
      rect.setAttribute("width", String(side));
      rect.setAttribute("height", String(side));
      rect.setAttribute("rx", String(r));
      rect.setAttribute("ry", String(r));
      rect.setAttribute("fill", color);
      svg.appendChild(rect);
    } else if (kind === "code") {
      const circle = document.createElementNS("http://www.w3.org/2000/svg", "circle");
      circle.setAttribute("r", "2.6");
      circle.setAttribute("fill", color);
      svg.appendChild(circle);
    } else if (kind === "config") {
      const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
      path.setAttribute("d", hw.regularHexagonPath(2.8));
      path.setAttribute("fill", color);
      svg.appendChild(path);
    } else {
      const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
      path.setAttribute("d", hw.equilateralTrianglePath(5.2));
      path.setAttribute("fill", color);
      svg.appendChild(path);
    }
    return svg;
  }
  function installGraphDefs(defs) {
    const stale = defs.append("filter").attr("id", "hw-shadow-stale").attr("x", "-50%").attr("y", "-50%").attr("width", "200%").attr("height", "200%");
    stale.append("feDropShadow").attr("dx", 0).attr("dy", 1).attr("stdDeviation", 2.2).attr("flood-color", "#0a0e14").attr("flood-opacity", 0.85);
    const glow = defs.append("filter").attr("id", "hw-glow-active").attr("x", "-80%").attr("y", "-80%").attr("width", "260%").attr("height", "260%");
    glow.append("feGaussianBlur").attr("in", "SourceGraphic").attr("stdDeviation", 2.8).attr("result", "b");
    const transfer = glow.append("feComponentTransfer").attr("in", "b").attr("result", "g");
    transfer.append("feFuncA").attr("type", "linear").attr("slope", 2);
    const merge = glow.append("feMerge");
    merge.append("feMergeNode").attr("in", "g");
    merge.append("feMergeNode").attr("in", "SourceGraphic");
    const nodeGlow = defs.append("filter").attr("id", "hw-node-glow").attr("x", "-100%").attr("y", "-100%").attr("width", "300%").attr("height", "300%");
    nodeGlow.append("feGaussianBlur").attr("stdDeviation", 3).attr("result", "b");
    const nm = nodeGlow.append("feMerge");
    nm.append("feMergeNode").attr("in", "b");
    nm.append("feMergeNode").attr("in", "SourceGraphic");
    const linkStale = defs.append("linearGradient").attr("id", "hw-grad-link-stale").attr("gradientUnits", "userSpaceOnUse").attr("x1", 0).attr("y1", 0).attr("x2", 120).attr("y2", 0);
    linkStale.append("stop").attr("offset", "0%").attr("stop-color", "#3a4556");
    linkStale.append("stop").attr("offset", "100%").attr("stop-color", "#6b7d95");
    const linkActive = defs.append("linearGradient").attr("id", "hw-grad-link-active").attr("gradientUnits", "userSpaceOnUse").attr("x1", 0).attr("y1", 0).attr("x2", 80).attr("y2", 0);
    linkActive.append("stop").attr("offset", "0%").attr("stop-color", "#ffffff");
    linkActive.append("stop").attr("offset", "55%").attr("stop-color", "#fff7ed");
    linkActive.append("stop").attr("offset", "100%").attr("stop-color", "#fdba74");
    const nodeStale = defs.append("radialGradient").attr("id", "hw-grad-node-stale").attr("cx", "35%").attr("cy", "30%").attr("r", "65%");
    nodeStale.append("stop").attr("offset", "0%").attr("stop-color", "#7a8aa3");
    nodeStale.append("stop").attr("offset", "100%").attr("stop-color", "#3d4a5c");
    const nodeFocus = defs.append("radialGradient").attr("id", "hw-grad-node-focus").attr("cx", "32%").attr("cy", "28%").attr("r", "70%");
    nodeFocus.append("stop").attr("offset", "0%").attr("stop-color", "#fed7aa");
    nodeFocus.append("stop").attr("offset", "45%").attr("stop-color", "#fb923c");
    nodeFocus.append("stop").attr("offset", "100%").attr("stop-color", "#c2410c");
  }
  function appendLinkPath(parent, kind, active, d, datum, onClick, laneColor, laneColorDim, extraClass) {
    const variant = active ? "active" : "stale";
    const group = parent.append("g").attr("class", [
      "link-group",
      `link-group--${variant}`,
      `link-${kind}`,
      extraClass || ""
    ].filter(Boolean).join(" "));
    group.append("path").attr("class", `link-segment link-core link-core--${variant} link-${kind}`).attr("d", d).attr("fill", "none").attr("stroke", kind === "bus" ? laneColorDim : active ? laneColor : laneColorDim).style("opacity", active ? 1 : 1);
    group.selectAll(".link-segment").each(function() {
      if (datum) d3.select(this).datum(datum);
    });
    if (onClick) {
      const handler = (ev, data) => {
        ev.stopPropagation();
        onClick(data);
      };
      group.selectAll(".link-segment").on("click", handler);
    }
    group.selectAll(".link-segment").on("mouseenter", () => {
      group.classed("link-group--hover", true);
    }).on("mouseleave", () => {
      group.classed("link-group--hover", false);
    });
    return group;
  }
  function appendNodeGraphic(nodeG, node, cx, cy) {
    const lane = node.lane;
    const color = hw.laneIconColor(lane);
    const g = nodeG.append("g").attr("class", `node-group node-group--file${node.isFocus ? " node-group--focus" : " node-group--stale"}${node.isPulse ? " node-group--pulse" : ""}`).attr("data-node-id", node.id).attr("transform", `translate(${cx},${cy})`).attr("opacity", hw.state.animateNext ? 0 : 1).datum(node);
    if (hw.nodeIsPulsing(node)) hw.appendNodeRipples(g, lane.color);
    hw.appendSvgLaneIcon(g, hw.nodeIconKind(node), color, hw.ICON_SIZE);
    g.append("circle").attr("class", "node-hit").attr("r", hw.ICON_SIZE + hw.ICON_HIT_PAD).attr("fill", "transparent").style("pointer-events", "all");
    if (hw.PER_LANE_VERSION && node.laneVersion != null) {
      g.append("text").attr("class", "node-lane-ver").attr("y", hw.ICON_SIZE + 9).attr("text-anchor", "middle").text(hw.formatLaneVersion(node.laneVersion));
    }
    hw.bindFileNodePointer(g, node);
  }
  function appendVersionStepGraphic(nodeG, node, cx, cy) {
    const lane = node.lane;
    const color = hw.laneIconColor(lane);
    const size = hw.versionStepIconSize();
    const g = nodeG.append("g").attr("class", "node-group node-group--step").attr("data-node-id", node.id).attr("transform", `translate(${cx},${cy})`).attr("opacity", hw.state.animateNext ? 0 : 0.62).style("pointer-events", "none").datum(node);
    hw.appendSvgLaneIcon(g, hw.nodeIconKind(node), color, size);
    if (hw.PER_LANE_VERSION && node.laneVersion != null) {
      g.append("text").attr("class", "node-lane-ver node-lane-ver--step").attr("y", size + 7).attr("text-anchor", "middle").text(hw.formatLaneVersion(node.laneVersion));
    }
  }
  function appendBranchForkAnchor(nodeG, node, cx, cy) {
    const lane = node.lane;
    const color = hw.laneIconColor(lane);
    const g = nodeG.append("g").attr("class", `node-group node-group--anchor node-group--fork-anchor${node.isFocus ? " node-group--focus" : " node-group--stale"}`).attr("data-node-id", node.id).attr("transform", `translate(${cx},${cy})`).attr("opacity", hw.state.animateNext ? 0 : 1).datum(node);
    g.append("circle").attr("class", "node-anchor-ring").attr("r", hw.ICON_SIZE + 1.5).attr("fill", "none").attr("stroke", color).attr("stroke-width", 1.4).style("pointer-events", "none");
    g.append("circle").attr("class", "node-anchor-dot").attr("r", hw.ICON_SIZE).attr("fill", color).style("pointer-events", "none");
    g.append("circle").attr("class", "node-hit").attr("r", hw.ICON_SIZE + hw.ICON_HIT_PAD).attr("fill", "transparent").style("pointer-events", "all");
    hw.bindFileNodePointer(g, node);
  }
  function appendBranchMergeAnchor(nodeG, node, cx, cy) {
    const lane = node.lane;
    const color = hw.laneIconColor(lane);
    const g = nodeG.append("g").attr("class", `node-group node-group--anchor node-group--merge-anchor${node.isFocus ? " node-group--focus" : " node-group--stale"}`).attr("data-node-id", node.id).attr("transform", `translate(${cx},${cy})`).attr("opacity", hw.state.animateNext ? 0 : 1).datum(node);
    g.append("circle").attr("class", "node-anchor-ring node-anchor-ring--merge").attr("r", hw.ICON_SIZE + 1.5).attr("fill", "none").attr("stroke", color).attr("stroke-width", 1.4).style("pointer-events", "none");
    g.append("circle").attr("class", "node-anchor-dot").attr("r", hw.ICON_SIZE).attr("fill", color).style("pointer-events", "none");
    g.append("circle").attr("class", "node-hit").attr("r", hw.ICON_SIZE + hw.ICON_HIT_PAD).attr("fill", "transparent").style("pointer-events", "all");
    hw.bindFileNodePointer(g, node);
  }
  function appendFolderClusterNode(nodeG, node, cx, cy, bundle) {
    const lane = node.lane;
    const color = hw.laneIconColor(lane);
    const g = nodeG.append("g").attr("class", `node-group node-group--folder${node.isFocus ? " node-group--focus" : ""}${node.isPulse ? " node-group--pulse" : ""}`).attr("data-node-id", node.id).attr("transform", `translate(${cx},${cy})`).attr("opacity", hw.state.animateNext ? 0 : 1).datum(node);
    const side = hw.ICON_SIZE * 2 + 2;
    hw.appendSvgFolderRect(g, "node-folder-cluster", side / 2, color);
    const hit = g.append("circle").attr("class", "node-hit node-hit--folder").attr("r", side / 2 + hw.ICON_HIT_PAD).attr("fill", "transparent").style("pointer-events", "all");
    hit.style("cursor", "pointer").on("click", (ev) => {
      ev.stopPropagation();
      hw.onFolderClusterClick(ev, node);
    }).on("dblclick", (ev) => {
      ev.stopPropagation();
      hw.suppressOutsideClick = true;
      hw.openNodeModal(node);
    });
    g.select(".node-folder-cluster").style("pointer-events", "none");
    if (node.fileCount > 1) {
      g.append("text").attr("class", "node-folder-count").attr("y", 0).attr("dy", "0.32em").attr("text-anchor", "middle").attr("font-size", "6px").attr("fill", "#0a0a0b").attr("pointer-events", "none").text(node.fileCount);
    }
    hw.bindFolderNodePointer(g, node);
  }
  Object.assign(hw, {
    pulseColumn,
    rippleTargetNodeId,
    nodeShowsRipples,
    nodeIsPulsing,
    syncNodeRippleVisuals,
    pickDefaultPulseNode,
    setPulseNode,
    updateGraphFocus,
    appendNodeRipples,
    appendRulerRipples,
    fileIconKindFromPath,
    laneIconKind,
    isBranchGraphAnchor,
    isVersionStepNode,
    versionStepIconSize,
    nodeOnLaneAtColumn,
    nodeCanShowTooltip,
    nodeIconKind,
    equilateralTrianglePath,
    regularHexagonPath,
    folderRoundedRectRadius,
    appendSvgFolderRect,
    appendSvgLaneIcon,
    createRailIcon,
    installGraphDefs,
    appendLinkPath,
    appendNodeGraphic,
    appendVersionStepGraphic,
    appendBranchForkAnchor,
    appendBranchMergeAnchor,
    appendFolderClusterNode
  });

  // src/graph/render.js
  function runGraphEntrance() {
    const animate = hw.state.animateNext;
    hw.state.animateNext = false;
    if (!animate || window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      hw.gScroll.selectAll(".node-group").attr("opacity", 1);
      return;
    }
    hw.gScroll.selectAll(".link-core").each(function(_, i) {
      const len = this.getTotalLength() || 48;
      d3.select(this).attr("stroke-dasharray", `${len} ${len}`).attr("stroke-dashoffset", len).transition().delay(i * 14).duration(380).ease(d3.easeCubicOut).attr("stroke-dashoffset", 0).on("end", function() {
        d3.select(this).attr("stroke-dasharray", null).attr("stroke-dashoffset", null);
      });
    });
    hw.gScroll.selectAll(".node-group").each(function(_, i) {
      d3.select(this).transition().delay(120 + i * 22).duration(340).ease(d3.easeBackOut.overshoot(1.15)).attr("opacity", 1);
    });
  }
  function initSvg(contentHeight) {
    const width = hw.els.graphViewport.clientWidth || 800;
    const height = contentHeight;
    d3.select(hw.els.graphSvg).selectAll("*").remove();
    hw.svgRoot = d3.select(hw.els.graphSvg).attr("width", width).attr("height", height).attr("viewBox", `0 0 ${width} ${height}`);
    hw.gMain = hw.svgRoot.append("g").attr("class", "graph-main");
    hw.gScroll = hw.gMain.append("g").attr("class", "graph-scroll-layer");
    hw.installGraphDefs(hw.svgRoot.append("defs"));
    hw.svgRoot.insert("rect", ":first-child").attr("width", width).attr("height", height).attr("fill", "transparent");
    return { width, height };
  }
  function applyGraphTransform() {
    hw.applyGraphTransformImmediate();
  }
  function yieldToNextFrame() {
    return new Promise((resolve) => requestAnimationFrame(resolve));
  }
  function bumpRenderGeneration() {
    hw.state.renderGeneration += 1;
    return hw.state.renderGeneration;
  }
  function renderIsAlive(gen) {
    return gen === hw.state.renderGeneration;
  }
  function setGraphStreaming(on) {
    hw.els.graphViewport?.classList.toggle("graph-viewport--streaming", !!on);
    if (hw.els.btnLaneLayout) hw.els.btnLaneLayout.disabled = !!on;
    if (hw.els.btnGenerate) hw.els.btnGenerate.disabled = !!on;
    if (hw.els.btnDemo) hw.els.btnDemo.disabled = !!on;
    if (hw.els.btnMegaDemo) hw.els.btnMegaDemo.disabled = !!on;
  }
  function visibleLaneRange(scrollTop, viewportH, laneCount) {
    if (laneCount <= 0) return { start: 0, end: -1 };
    const top = scrollTop;
    const bot = scrollTop + viewportH;
    let start = Math.floor((top - hw.CONFIG.RULER_HEIGHT) / hw.CONFIG.LANE_HEIGHT);
    let end = Math.ceil((bot - hw.CONFIG.RULER_HEIGHT) / hw.CONFIG.LANE_HEIGHT);
    start = Math.max(0, start - hw.LANE_VIEW_OVERSCAN);
    end = Math.min(laneCount - 1, end + hw.LANE_VIEW_OVERSCAN);
    if (start > end) {
      start = 0;
      end = Math.min(laneCount - 1, hw.LANE_VIEW_OVERSCAN * 2);
    }
    return { start, end };
  }
  function renderGraphLink(linkG, link, yScale) {
    if (link.kind === "lane-track") {
      const x1 = hw.versionX(link.vStart);
      const x2 = hw.versionX(link.vEnd);
      const y = yScale(link.laneIndex);
      hw.appendLinkPath(
        linkG,
        "track",
        false,
        hw.laneLine(x1, y, x2, y),
        null,
        null,
        link.lane.colorDim,
        link.lane.colorDim
      );
      return;
    }
    if (link.kind === "lane-bridge" || link.kind === "lane-trace") {
      const x1 = hw.versionX(link.from.displayColumn ?? link.from.graphX);
      const x2 = hw.versionX(link.to.displayColumn ?? link.to.graphX);
      const y = yScale(link.laneIndex);
      const isTrace = link.kind === "lane-trace";
      hw.appendLinkPath(
        linkG,
        isTrace ? "trace" : "lane",
        link.active,
        hw.laneLine(x1, y, x2, y),
        isTrace ? link : { from: link.from, to: link.to },
        null,
        link.lane.color,
        link.lane.colorDim
      );
      return;
    }
    if (link.kind === "fork") {
      hw.appendLinkPath(
        linkG,
        "fork",
        link.active,
        hw.curveBridge(link.x1, link.y1, link.x2, link.y2),
        link,
        null,
        link.branchLane.color,
        link.branchLane.colorBright || link.branchLane.color
      );
      return;
    }
    if (link.kind === "merge") {
      hw.appendLinkPath(
        linkG,
        "merge",
        link.active,
        hw.curveBridge(link.x1, link.y1, link.x2, link.y2),
        link,
        null,
        link.branchLane.color,
        link.branchLane.colorBright || link.branchLane.color
      );
      return;
    }
  }
  function renderGraphNodeEntry(nodeG, node, bundles, yScale) {
    const cx = hw.versionX(node.graphX);
    const cy = yScale(node.laneIndex);
    if (node.isFolderAggregate) {
      const bundle = bundles.find((b) => b.commit.hash === node.hash);
      hw.appendFolderClusterNode(nodeG, node, cx, cy, bundle);
      return;
    }
    if (node.isForkAnchor) {
      hw.appendBranchForkAnchor(nodeG, node, cx, cy);
      return;
    }
    if (node.isMergeAnchor) {
      hw.appendBranchMergeAnchor(nodeG, node, cx, cy);
      return;
    }
    if (node.isVersionStep) {
      hw.appendVersionStepGraphic(nodeG, node, cx, cy);
      return;
    }
    hw.appendNodeGraphic(nodeG, node, cx, cy);
  }
  function prepareGraphShell(catalog) {
    hw.initSvg(catalog.contentHeight);
    const m = hw.CONFIG.MARGIN;
    const innerH = hw.CONFIG.RULER_HEIGHT + Math.max(catalog.lanes.length, 1) * hw.CONFIG.LANE_HEIGHT;
    const bounds = hw.computePanBounds();
    if (hw.state.panX === null && hw.state.parsed) {
      hw.state.panX = hw.panXForHeadFocus(hw.state.parsed);
    } else if (hw.state.panX === null) {
      hw.state.panX = bounds.panMin;
    }
    hw.state.panX = hw.clampPan(hw.state.panX, bounds);
    hw.svgLayout = { innerH, panBounds: bounds, headX: hw.headXContent(catalog.head) };
    const g = hw.gScroll.append("g").attr("transform", `translate(${m.left},${m.top})`);
    hw.renderVersionRuler(g, catalog, innerH);
    hw.graphRenderCtx = {
      catalog,
      yScale: hw.laneCenterY,
      laneSlicesG: g.append("g").attr("class", "lane-slices"),
      busG: g.append("g").attr("class", "buses"),
      renderedLanes: /* @__PURE__ */ new Set()
    };
  }
  function prepareFileRailAllRows(lanes) {
    const inner = hw.prepareFileRailShell(lanes);
    lanes.forEach((lane) => inner.appendChild(hw.appendFileRailRow(lane)));
    hw.syncFileRailFocusHighlight();
    hw.syncFileRailBoundaryHighlight();
    hw.syncBranchLaneHighlight();
  }
  function getLaneSlice(laneIndex) {
    if (!hw.state.laneSliceCache) hw.state.laneSliceCache = /* @__PURE__ */ new Map();
    const key = hw.sliceCacheKey(laneIndex);
    let slice = hw.state.laneSliceCache.get(key);
    if (!slice && hw.state.catalog && hw.state.parsed) {
      hw.updateVisibleColumnWindow();
      slice = hw.buildLaneSlice(hw.state.parsed, hw.state.catalog, laneIndex);
      hw.state.laneSliceCache.set(key, slice);
    }
    return slice;
  }
  function unmountLaneSlice(laneIndex) {
    if (!hw.graphRenderCtx) return;
    hw.graphRenderCtx.laneSlicesG.select(`[data-lane-index="${laneIndex}"]`).remove();
    hw.graphRenderCtx.renderedLanes.delete(laneIndex);
  }
  function mountLaneSlice(laneIndex) {
    const ctx = hw.graphRenderCtx;
    const catalog = hw.state.catalog;
    if (!ctx || !catalog) return;
    const lane = catalog.lanes[laneIndex];
    const slice = hw.getLaneSlice(laneIndex);
    if (!slice) return;
    const { yScale } = ctx;
    const root = ctx.laneSlicesG.append("g").attr("class", "lane-slice").attr("data-lane-index", laneIndex);
    if (!lane.isHeader) {
      const fusePick = lane.isBranchLane && lane.branchSegment && hw.state.selectedBranchNames.has(lane.branchSegment.name);
      const branchCurrent = hw.isLaneCurrentGitBranch(lane);
      let guideClass = `lane-guide${lane.isBranchLane ? " lane-guide--branch" : ""}`;
      if (fusePick) guideClass += " lane-guide--branch-fuse";
      if (branchCurrent) guideClass += " lane-guide--branch-current";
      if (branchCurrent) {
        root.append("line").attr("class", `${guideClass} lane-guide--branch-current-glow`).attr("x1", -8).attr("x2", hw.futureExtentX(hw.state.parsed)).attr("y1", yScale(laneIndex)).attr("y2", yScale(laneIndex)).attr("stroke", lane.color).attr("stroke-width", 4).attr("stroke-opacity", 0.14);
      }
      root.append("line").attr("class", guideClass).attr("x1", -8).attr("x2", hw.futureExtentX(hw.state.parsed)).attr("y1", yScale(laneIndex)).attr("y2", yScale(laneIndex)).attr("stroke", branchCurrent ? lane.color : lane.colorDim).attr("stroke-width", branchCurrent ? 1.1 : 1.5).attr("stroke-opacity", branchCurrent ? 0.92 : 0.42);
    }
    const linkG = root.append("g").attr("class", "lane-links");
    const nodeG = root.append("g").attr("class", "lane-nodes");
    slice.links.forEach((link) => hw.renderGraphLink(linkG, link, yScale));
    slice.nodes.forEach((node) => hw.renderGraphNodeEntry(nodeG, node, slice.bundlesOnLane, yScale));
    ctx.renderedLanes.add(laneIndex);
  }
  function lanesForCommitBus(onPage) {
    const branchParents = new Set(
      onPage.filter((o) => o.lane.isBranchLane).map((o) => o.lane.parentLanePath)
    );
    return onPage.filter((o) => {
      if (!o.lane.isBranchLane && branchParents.has(o.lane.path)) return false;
      return true;
    });
  }
  function renderBusesInRange(start, end) {
    const ctx = hw.graphRenderCtx;
    const catalog = hw.state.catalog;
    const parsed = hw.state.parsed;
    if (!ctx || !catalog || !parsed) return;
    ctx.busG.selectAll("*").remove();
    const { lanes, focusGraphX } = catalog;
    const yScale = ctx.yScale;
    parsed.commits.forEach((commit) => {
      if (!hw.commitInColumnWindow(commit)) return;
      const onPage = [];
      lanes.forEach((lane) => {
        if (lane.laneIndex < start || lane.laneIndex > end) return;
        if (!hw.commitAppliesToLane(commit, lane, parsed)) return;
        const matched = commit.files.filter((f) => hw.fileMatchesLane(f, lane));
        if (!matched.length) return;
        onPage.push({ lane, laneIndex: lane.laneIndex, lanePath: lane.path, files: matched });
      });
      const busLanes = hw.lanesForCommitBus(onPage);
      if (busLanes.length < 2) return;
      const vx = hw.versionX(commit.displayColumn);
      const ys = busLanes.map((o) => yScale(o.laneIndex));
      const busPad = hw.ICON_SIZE + 3;
      const yTop = Math.min(...ys) + busPad;
      const yBot = Math.max(...ys) - busPad;
      if (yBot <= yTop) return;
      const hub = hw.pickHubLane(busLanes, commit.hash);
      const hubLane = hub.lane;
      const bundle = {
        commit,
        graphX: commit.displayColumn,
        isFocus: hw.columnsMatch(commit.displayColumn, focusGraphX),
        onPage: busLanes,
        hubLanePath: hub.lanePath
      };
      hw.appendLinkPath(
        ctx.busG,
        "bus",
        bundle.isFocus,
        hw.laneLine(vx, yTop, vx, yBot),
        bundle,
        hw.onBundleClick,
        hubLane.color,
        hubLane.colorDim
      );
    });
  }
  function collectNodesFromRange(start, end) {
    const nodes = [];
    for (let i = start; i <= end; i += 1) {
      const slice = hw.state.laneSliceCache?.get(i);
      if (slice) nodes.push(...slice.nodes);
    }
    return nodes;
  }
  function tryAssignDefaultPulse(start, end, options) {
    if (!options.assignDefaultPulse || hw.state.pulseNodeId) return;
    const nodes = hw.collectNodesFromRange(start, end);
    if (nodes.length) {
      hw.state.pulseNodeId = hw.pickDefaultPulseNode(nodes, hw.state.parsed);
      return;
    }
    const catalog = hw.state.catalog;
    if (!catalog) return;
    for (let i = 0; i < catalog.lanes.length; i += 1) {
      const slice = hw.getLaneSlice(i);
      if (slice.nodes.length) {
        hw.state.pulseNodeId = hw.pickDefaultPulseNode(slice.nodes, hw.state.parsed);
        if (hw.state.pulseNodeId) return;
      }
    }
  }
  function finalizeGraphView(catalog) {
    hw.refreshNodeIndex();
    hw.setPulseNode(hw.state.pulseNodeId);
    hw.runGraphEntrance();
    const maxScroll = Math.min(
      Math.max(0, catalog.contentHeight - hw.els.graphViewport.clientHeight),
      hw.fileRailMaxScroll()
    );
    hw.state.scrollTop = Math.min(hw.state.scrollTop, maxScroll);
    hw.applyGraphTransform();
    hw.syncFileRailScrollFromState();
  }
  async function syncVisibleLanes(gen, options = {}) {
    const catalog = hw.state.catalog;
    if (!hw.state.parsed || !catalog || !hw.graphRenderCtx || !hw.renderIsAlive(gen)) return;
    const prevCol = hw.state.visibleColumnWindow;
    hw.updateVisibleColumnWindow();
    if (options.invalidateSlices || hw.columnWindowCacheChanged(prevCol, hw.state.visibleColumnWindow)) {
      hw.invalidateLaneSliceCache();
    }
    const vpH = hw.els.graphViewport?.clientHeight || 600;
    const { start, end } = hw.visibleLaneRange(hw.state.scrollTop, vpH, catalog.lanes.length);
    if (end < start) {
      [...hw.graphRenderCtx.renderedLanes].forEach((i) => hw.unmountLaneSlice(i));
      hw.graphRenderCtx.busG.selectAll("*").remove();
      return;
    }
    const toRemove = [...hw.graphRenderCtx.renderedLanes].filter((i) => i < start || i > end);
    toRemove.forEach((i) => hw.unmountLaneSlice(i));
    for (let i = start; i <= end; i += 1) {
      if (!hw.renderIsAlive(gen)) return;
      if (!hw.graphRenderCtx.renderedLanes.has(i)) {
        hw.mountLaneSlice(i);
        if (!hw.state.viewportInteracting) await hw.yieldToNextFrame();
      }
    }
    if (!hw.renderIsAlive(gen)) return;
    if (!hw.state.viewportInteracting) {
      hw.renderBusesInRange(start, end);
      hw.tryAssignDefaultPulse(start, end, options);
      hw.setPulseNode(hw.state.pulseNodeId);
      hw.updateGraphFocus();
      hw.updateSelectionVisuals();
    }
    hw.refreshNodeIndex();
    if (hw.els.statFiles) {
      const visible = end - start + 1;
      hw.els.statFiles.textContent = `${visible}/${catalog.lanes.length} lanes`;
    }
  }
  async function bootstrapViewportRender(gen, options = {}) {
    if (!hw.state.parsed || !hw.renderIsAlive(gen)) return;
    hw.hideTooltip();
    hw.clearError();
    hw.state.animateNext = false;
    hw.setGraphStreaming(true);
    if (hw.isPluginHost() && hw.els.graphEmpty) {
      hw.els.graphEmpty.classList.add("hidden");
    }
    try {
      hw.state.laneSliceCache = /* @__PURE__ */ new Map();
      const catalog = hw.buildLaneCatalog(hw.state.parsed);
      if (!hw.renderIsAlive(gen)) return;
      hw.state.catalog = catalog;
      hw.updatePluginBar(catalog.lanes.length);
      if (hw.isPluginHost() && catalog.lanes.length === 0) {
        hw.graphRenderCtx = null;
        hw.state.catalog = null;
        if (hw.els.graphSvg) hw.els.graphSvg.innerHTML = "";
        hw.showPluginEmptyGit();
        return;
      }
      hw.els.graphEmpty?.classList.add("hidden");
      if (hw.els.graphHint) hw.els.graphHint.hidden = false;
      if (hw.els.graphZoom) hw.els.graphZoom.hidden = false;
      hw.prepareFileRailAllRows(catalog.lanes);
      hw.prepareGraphShell(catalog);
      hw.finalizeGraphView(catalog);
      await hw.syncVisibleLanes(gen, options);
      if (hw.renderIsAlive(gen) && !hw.applyNewHeadFocusAfterRender()) {
        hw.updateGraphFocus();
        hw.syncNodeRippleVisuals();
      }
      hw.updateStats(hw.state.parsed);
      hw.updatePaginationUI(hw.state.parsed);
    } catch (e) {
      if (hw.renderIsAlive(gen)) hw.showError(e.message || String(e));
    } finally {
      if (hw.renderIsAlive(gen)) hw.setGraphStreaming(false);
    }
  }
  function scheduleViewportSync(options = {}) {
    if (!hw.state.catalog || !hw.graphRenderCtx) return;
    if (hw.viewportSyncQueued) return;
    hw.viewportSyncQueued = true;
    const gen = hw.state.renderGeneration;
    requestAnimationFrame(async () => {
      hw.viewportSyncQueued = false;
      if (!hw.renderIsAlive(gen)) return;
      await hw.syncVisibleLanes(gen, options);
    });
  }
  function scheduleRenderFromState(options = {}) {
    const gen = hw.bumpRenderGeneration();
    hw.graphRenderCtx = null;
    hw.state.catalog = null;
    hw.state.laneSliceCache = null;
    hw.bootstrapViewportRender(gen, options);
  }
  Object.assign(hw, {
    runGraphEntrance,
    initSvg,
    applyGraphTransform,
    yieldToNextFrame,
    bumpRenderGeneration,
    renderIsAlive,
    setGraphStreaming,
    visibleLaneRange,
    renderGraphLink,
    renderGraphNodeEntry,
    prepareGraphShell,
    prepareFileRailAllRows,
    getLaneSlice,
    unmountLaneSlice,
    mountLaneSlice,
    lanesForCommitBus,
    renderBusesInRange,
    collectNodesFromRange,
    tryAssignDefaultPulse,
    finalizeGraphView,
    syncVisibleLanes,
    bootstrapViewportRender,
    scheduleViewportSync,
    scheduleRenderFromState
  });

  // src/ui/ruler.js
  function shortenFolderLabel(label) {
    if (label === "(root)") return label;
    return label.endsWith("/") ? label : `${label}/`;
  }
  function renderVersionRuler(g, model, innerH) {
    const rh = hw.CONFIG.RULER_HEIGHT;
    const baseline = rh - 8;
    const parsed = hw.state.parsed;
    const headUploadIdx = hw.headUploadColumn(parsed);
    const loadedMaxCol = hw.maxLoadedUploadColumn(parsed);
    const pulseCol = hw.pulseColumn(parsed);
    const extent = hw.rulerExtent(parsed);
    const extendX = hw.versionColumnX(extent);
    const gridG = g.append("g").attr("class", "version-ruler__grid");
    const chromeG = g.append("g").attr("class", "version-ruler");
    for (let v = 1; v <= extent; v += 1) {
      const vx = hw.versionColumnX(v);
      const uploadCommit = parsed ? hw.commitAtUploadColumn(parsed, v) : null;
      const isFuture = v > loadedMaxCol;
      const isLit = !!uploadCommit && !isFuture;
      const isHead = v === headUploadIdx;
      const isBranchOnly = isLit && uploadCommit && !uploadCommit.isMainline;
      gridG.append("line").attr("class", `version-ruler__vline${isFuture ? " version-ruler__vline--future" : ""}`).attr("x1", vx).attr("x2", vx).attr("y1", baseline).attr("y2", innerH);
      chromeG.append("line").attr("class", [
        "version-ruler__tick",
        isLit ? "version-ruler__tick--lit" : "",
        isFuture ? "version-ruler__tick--empty" : ""
      ].filter(Boolean).join(" ")).attr("x1", vx).attr("x2", vx).attr("y1", baseline - (isLit ? 6 : 3)).attr("y2", baseline + 1);
      chromeG.append("text").attr("class", [
        "version-ruler__label",
        isLit ? "version-ruler__label--lit" : "version-ruler__label--future",
        isHead && isLit ? "version-ruler__label--head" : ""
      ].filter(Boolean).join(" ")).attr("x", vx).attr("y", baseline - 9).attr("text-anchor", "middle").text(hw.PER_LANE_VERSION ? `C${v}` : `V${v}`);
      if (uploadCommit || isFuture) {
        chromeG.append("circle").attr("class", [
          "version-ruler__dot",
          isLit ? "version-ruler__dot--lit" : "",
          isHead && isLit ? "version-ruler__dot--head" : "",
          isFuture ? "version-ruler__dot--future" : "",
          isBranchOnly ? "version-ruler__dot--branch" : ""
        ].filter(Boolean).join(" ")).attr("cx", vx).attr("cy", baseline).attr("r", isLit ? 2.2 : 1.4);
      }
    }
    chromeG.append("line").attr("class", "version-ruler__baseline").attr("x1", hw.versionColumnX(1) - 8).attr("x2", extendX + 8).attr("y1", baseline).attr("y2", baseline);
    if (headUploadIdx > 0) {
      chromeG.append("line").attr("class", "version-ruler__progress").attr("x1", hw.versionColumnX(1)).attr("x2", hw.versionColumnX(headUploadIdx)).attr("y1", baseline).attr("y2", baseline);
    }
    if (loadedMaxCol > headUploadIdx) {
      chromeG.append("line").attr("class", "version-ruler__progress version-ruler__progress--branch").attr("x1", hw.versionColumnX(headUploadIdx)).attr("x2", hw.versionColumnX(loadedMaxCol)).attr("y1", baseline).attr("y2", baseline);
    }
    chromeG.append("line").attr("class", "version-ruler__separator").attr("x1", -16).attr("x2", extendX + hw.CONFIG.VERSION_SPACING).attr("y1", rh).attr("y2", rh);
    const pulseV = Math.round(pulseCol);
    if (pulseV >= 1 && pulseV <= extent) {
      hw.appendRulerRipples(chromeG, hw.versionColumnX(pulseV), baseline);
    }
  }
  function truncatePath(str) {
    if (str.length <= 44) return str;
    return "\u2026" + str.slice(-43);
  }
  Object.assign(hw, {
    shortenFolderLabel,
    renderVersionRuler,
    truncatePath
  });

  // src/ui/file-rail.js
  function prepareFileRailShell(lanes) {
    hw.renderBranchRail();
    const inner = hw.els.fileRailInner;
    inner.innerHTML = "";
    const spacer = document.createElement("div");
    spacer.className = "file-rail__ruler-spacer";
    spacer.style.height = `${hw.CONFIG.RULER_HEIGHT}px`;
    spacer.setAttribute("aria-hidden", "true");
    inner.appendChild(spacer);
    inner.style.height = `${hw.CONFIG.RULER_HEIGHT + Math.max(lanes.length, 1) * hw.CONFIG.LANE_HEIGHT}px`;
    return inner;
  }
  function fileRailIndent(depth) {
    const step = hw.isPluginHost() ? 14 : 9;
    return 5 + depth * step;
  }
  function fileRailTitle(lane) {
    let tip = lane.path === hw.ROOT_BUCKET ? "(root)" : lane.path;
    if (hw.PER_LANE_VERSION && hw.state.parsed && !lane.isHeader) {
      const lv = hw.laneVersionAtHead(hw.state.parsed, lane.path);
      if (lv > 0) tip = `${tip} \xB7 \u6CF3\u9053 ${hw.formatLaneVersion(lv)}`;
    }
    return tip;
  }
  function appendFileRailRow(lane) {
    const row = document.createElement("div");
    if (lane.isBranchLane) {
      row.className = "file-rail__item file-rail__item--branch";
      if (lane.branchSegment?.name) row.dataset.branchName = lane.branchSegment.name;
      row.style.paddingLeft = `${hw.fileRailIndent(lane.depth)}px`;
      row.title = hw.fileRailTitle(lane);
      const chev2 = document.createElement("span");
      chev2.className = "file-rail__chev";
      chev2.textContent = "\u2387";
      const label2 = document.createElement("span");
      label2.className = "file-rail__label";
      label2.textContent = hw.truncatePath(lane.label);
      if (lane.color) {
        const c = lane.color;
        chev2.style.color = c;
        label2.style.color = c;
      }
      row.appendChild(chev2);
      row.appendChild(label2);
      return row;
    }
    if (lane.inlineFolder && !hw.isPluginHost()) {
      row.className = "file-rail__item file-rail__item--file file-rail__item--folder-inline";
      row.style.paddingLeft = `${hw.fileRailIndent(lane.depth)}px`;
      row.title = hw.fileRailTitle(lane);
      const chev2 = document.createElement("button");
      chev2.type = "button";
      chev2.className = "file-rail__chev file-rail__chev--collapse";
      chev2.textContent = "\u25BE";
      chev2.title = `\u6536\u8D77 ${hw.shortenFolderLabel(lane.inlineFolder.label)}`;
      chev2.addEventListener("click", (e) => {
        e.stopPropagation();
        hw.toggleExpand(lane.inlineFolder.path, e.altKey);
      });
      const label2 = document.createElement("span");
      label2.className = "file-rail__label";
      const leaf = lane.path.split("/").pop() || lane.label;
      label2.textContent = hw.truncatePath(hw.isPluginHost() && lane.type === "folder" ? leaf : leaf);
      row.appendChild(chev2);
      row.appendChild(hw.createRailIcon(lane));
      row.appendChild(label2);
      if (lane.type === "folder" && hw.isPluginHost()) {
        row.classList.remove("file-rail__item--file");
        row.classList.add("file-rail__item--folder");
        row.addEventListener("click", (e) => {
          if (e.altKey && window.HorsewhipPluginBridge?.revealFolder) {
            window.HorsewhipPluginBridge.revealFolder(lane.path === hw.ROOT_BUCKET ? "" : lane.path);
            return;
          }
          hw.toggleExpand(lane.path, e.altKey);
        });
      } else {
        hw.wireFileRailFocus(row, lane);
      }
      return row;
    }
    row.className = `file-rail__item${lane.collapsed || lane.isHeader ? " file-rail__item--folder" : " file-rail__item--file"}`;
    row.style.paddingLeft = `${hw.fileRailIndent(lane.depth)}px`;
    const chev = document.createElement("span");
    chev.className = "file-rail__chev";
    chev.textContent = lane.isHeader ? "\u25BE" : lane.collapsed ? "\u25B8" : "\xB7";
    const label = document.createElement("span");
    label.className = "file-rail__label";
    const display = lane.collapsed || lane.isHeader ? hw.isPluginHost() ? lane.label : hw.shortenFolderLabel(lane.label) : hw.isFlatLaneLayout() ? lane.path : lane.path.split("/").pop() || lane.label;
    label.textContent = hw.truncatePath(display);
    row.title = hw.fileRailTitle(lane);
    if (lane.collapsed || lane.isHeader) {
      row.classList.add("file-rail__item--folder");
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
    fileRailIndent,
    fileRailTitle,
    appendFileRailRow
  });

  // src/ui/branches.js
  function branchSegmentByName(name) {
    return (hw.state.parsed?.branchSegments || []).find((s) => s.id === name || s.name === name);
  }
  function isMainBranchName(name) {
    return /^(main|master)$/i.test(String(name || "").trim());
  }
  function mainBranchName() {
    const cur = hw.state.currentGitBranch || "";
    if (hw.isMainBranchName(cur)) return cur;
    const list = hw.state.gitBranches || [];
    if (list.some((b) => b.name === "main")) return "main";
    if (list.some((b) => b.name === "master")) return "master";
    return "main";
  }
  function filesForBranchSegment(seg) {
    const s = /* @__PURE__ */ new Set();
    (seg?.commits || []).forEach((c) => (c.files || []).forEach((f) => s.add(f)));
    return [...s].sort((a, b) => a.localeCompare(b));
  }
  function fusionBoundaryFiles() {
    const files = /* @__PURE__ */ new Set();
    hw.state.selectedBranchNames.forEach((name) => {
      hw.filesForBranchSegment(hw.branchSegmentByName(name)).forEach((f) => files.add(f));
    });
    return [...files].sort((a, b) => a.localeCompare(b));
  }
  function buildBranchFusionPrompt() {
    const names = [...hw.state.selectedBranchNames].sort((a, b) => a.localeCompare(b));
    if (names.length < 2) return "";
    const main = hw.mainBranchName();
    const parsed = hw.state.parsed;
    const blocks = names.map((name) => {
      const b = (hw.state.gitBranches || []).find((x) => x.name === name);
      const seg = hw.branchSegmentByName(name);
      const tip = b?.hash && parsed ? hw.resolveCommitHash(b.hash, parsed.commitMap) : null;
      const files = seg ? hw.filesForBranchSegment(seg) : [];
      const preview = files.length ? files.slice(0, 36).join(", ") + (files.length > 36 ? ` \u2026+${files.length - 36}` : "") : "(log \u4E2D\u65E0\u8DEF\u5F84\u8BB0\u5F55\uFF0C\u8BF7 checkout \u8BE5\u5206\u652F\u540E\u81EA\u884C\u67E5\u770B)";
      const status = seg?.merged ? "\u5DF2\u5408\u5E76\u8FC7" : seg?.continued ? "\u8FDB\u884C\u4E2D" : "\u5B9E\u9A8C\u4FDD\u7559";
      return `- **${name}**\uFF08${status}\uFF09${tip ? `
  tip commit: \`${tip.hash}\`` : ""}
  \u6D89\u53CA\u6587\u4EF6 ${files.length} \u4E2A\uFF1A${preview}`;
    }).join("\n\n");
    const allFiles = hw.fusionBoundaryFiles();
    const fileScope = allFiles.length ? allFiles.join(", ") : "\uFF08\u8BF7\u6839\u636E\u5404\u5206\u652F diff \u81EA\u884C\u786E\u5B9A\uFF09";
    return `\u3010horsewhip \xB7 AI \u591A\u5206\u652F\u878D\u5408\u3011

\u76EE\u6807\uFF1A\u4EE5\u4E0B ${names.length} \u6761\u5B9E\u9A8C\u5206\u652F\u5404\u81EA\u90FD\u6709\u53EF\u53D6\u4E4B\u5904\uFF0C\u8BF7\u628A\u5B83\u4EEC**\u62E9\u4F18\u878D\u5408**\u56DE\u4E3B\u6CF3\u9053 **${main}**\uFF0C\u5F62\u6210\u4E00\u4E2A\u65B0\u7684\u7EDF\u4E00\u7248\u672C\uFF1B\u5B8C\u6210\u540E\u6211\u4F1A\u5728 horsewhip \u4E3B\u6CF3\u9053\u4E0A\u7EE7\u7EED\u89C2\u5BDF\uFF08\u672C\u5DE5\u5177\u4E3A AI \u8FB9\u754C\u6536\u675F\uFF0C\u975E Git \u62D3\u6251\u56FE\uFF09\u3002

\u5F85\u878D\u5408\u5206\u652F\uFF08\u8BF7\u4FDD\u7559\u5404\u5206\u652F\u4E0A\u300C\u8FD8\u53EF\u4EE5\u300D\u7684\u5B9E\u73B0\uFF0C\u4E0D\u8981\u7B80\u5355\u7528\u67D0\u4E00\u7248\u5168\u8986\u76D6\uFF09\uFF1A
${blocks}

\u4E3B\u6CF3\u9053\uFF1A\`${main}\`\uFF08\u878D\u5408\u7ED3\u679C\u7684\u843D\u70B9\uFF09

\u5141\u8BB8\u4FEE\u6539\u7684\u6587\u4EF6\u8303\u56F4\uFF08\u5404\u5206\u652F\u89E6\u53CA\u8DEF\u5F84\u7684\u5E76\u96C6\uFF09\uFF1A
${fileScope}

\u7981\u6B62\u4FEE\u6539\u4E0A\u8FF0\u8303\u56F4\u4EE5\u5916\u7684\u6587\u4EF6\uFF1B\u82E5\u5FC5\u987B\u6269\u5C55\u8303\u56F4\uFF0C\u8BF7\u5148\u8BF4\u660E\u7406\u7531\u5E76\u7B49\u5F85\u786E\u8BA4\u3002

\u63A8\u8350\u6D41\u7A0B\uFF1A
1. \`git checkout ${main}\` \u5E76\u786E\u4FDD\u5DE5\u4F5C\u533A\u5E72\u51C0\uFF08\u6216 stash\uFF09
2. \u9010\u5206\u652F\u5BF9\u6BD4 diff\uFF08\`git diff ${main}..<branch>\` \u6216 checkout \u67E5\u770B\uFF09\uFF0C\u6309\u6587\u4EF6\u62E9\u4F18\u5408\u5E76
3. \u89E3\u51B3\u51B2\u7A81\u540E\u63D0\u4EA4\u4E00\u6B21\u6E05\u6670\u7684 merge commit\uFF08\u8BF4\u660E\u878D\u5408\u4E86\uFF1A${names.join("\u3001")}\uFF09
4. \u544A\u77E5\u6211\u5237\u65B0 Horsewhip\uFF1B\u65B0 commit \u5E94\u51FA\u73B0\u5728\u4E3B\u6CF3\u9053\u65F6\u95F4\u8F74\u4E0A

\u878D\u5408\u539F\u5219\uFF1A\u540C\u4E00\u6587\u4EF6\u591A\u5904\u6539\u52A8\u65F6\uFF0C\u4FDD\u7559\u5404\u5206\u652F\u4F18\u70B9\u5E76\u5408\u6210\u4E00\u81F4\u98CE\u683C\uFF1B\u4E0D\u786E\u5B9A\u5904\u5217\u51FA\u9009\u9879\u8BA9\u6211\u786E\u8BA4\u3002`;
  }
  function clearBranchFusionSelection() {
    if (hw.state.selectedBranchNames.size === 0) return;
    hw.state.selectedBranchNames.clear();
    hw.syncFuseBar();
    hw.renderBranchRail();
    if (hw.state.parsed) hw.scheduleRenderFromState();
  }
  function toggleBranchFusionPick(name) {
    if (hw.isMainBranchName(name)) return;
    if (hw.state.selectedBranchNames.has(name)) hw.state.selectedBranchNames.delete(name);
    else hw.state.selectedBranchNames.add(name);
    hw.state.highlightBranchName = name;
    hw.syncFuseBar();
    hw.renderBranchRail();
    hw.syncBranchLaneHighlight();
    if (hw.state.parsed) hw.scheduleRenderFromState();
  }
  function runFusionPulseAnim() {
    hw.playWhipCrackSound();
    const stage = hw.els.stage || document.getElementById("stage");
    stage?.classList.add("hw-fuse-pulse");
    setTimeout(() => stage?.classList.remove("hw-fuse-pulse"), 1500);
  }
  function crackWhipOnFusion(btnEl) {
    const text = hw.buildBranchFusionPrompt();
    if (!text) return;
    const crackTarget = btnEl?.closest?.(".hw-fuse-bar") || btnEl;
    crackTarget?.classList.add("hw-fuse-bar--crack");
    hw.runFusionPulseAnim();
    hw.copyText(text);
    hw.showCopyToast(`\u5DF2\u590D\u5236 ${hw.state.selectedBranchNames.size} \u6761\u5206\u652F\u7684\u878D\u5408\u4EFB\u52A1 \xB7 \u7C98\u8D34\u5230 Chat`);
    setTimeout(() => crackTarget?.classList.remove("hw-fuse-bar--crack"), 520);
  }
  function insertBranchFusionToChat() {
    const text = hw.buildBranchFusionPrompt();
    if (!text) return;
    hw.runFusionPulseAnim();
    if (window.HorsewhipPluginBridge?.insertBoundaryToChat) {
      window.HorsewhipPluginBridge.insertBoundaryToChat(text);
    } else {
      hw.copyText(text, hw.els.btnFuseChat);
    }
  }
  function syncFuseBar() {
    if (!hw.BRANCH_FUSION_ENABLED || !hw.BRANCH_RAIL_ENABLED) {
      if (hw.state.selectedBranchNames.size) hw.state.selectedBranchNames.clear();
      if (hw.els.fuseBar) hw.els.fuseBar.hidden = true;
      return;
    }
    const n = hw.state.selectedBranchNames.size;
    const show = n >= 2;
    if (hw.els.fuseBar) hw.els.fuseBar.hidden = !show;
    if (hw.els.fuseCount) {
      hw.els.fuseCount.textContent = show ? `\u5DF2\u9009 ${n} \u6761\u5206\u652F` : "";
    }
    if (hw.els.fuseNames) {
      hw.els.fuseNames.textContent = show ? [...hw.state.selectedBranchNames].sort().join(" \xB7 ") : "";
      hw.els.fuseNames.title = show ? [...hw.state.selectedBranchNames].join("\n") : "";
    }
    if (hw.els.btnFuseCopy) hw.els.btnFuseCopy.disabled = !show;
    if (hw.els.btnFuseChat) hw.els.btnFuseChat.disabled = !show;
    if (show && hw.isPluginHost() && window.HorsewhipPluginBridge?.setBoundaryAllowlist) {
      window.HorsewhipPluginBridge.setBoundaryAllowlist([], false);
    } else if (!show && hw.isPluginHost()) {
      hw.syncBoundaryBar();
    }
  }
  function renderBranchRail() {
    const rail = hw.els.branchRail;
    if (!rail) return;
    rail.innerHTML = "";
    if (!hw.BRANCH_RAIL_ENABLED) {
      rail.hidden = true;
      hw.syncFuseBar();
      return;
    }
    const list = hw.state.gitBranches || [];
    if (!list.length) {
      rail.hidden = true;
      return;
    }
    rail.hidden = false;
    const title = document.createElement("div");
    title.className = "hw-branch-rail__title";
    title.textContent = `\u5206\u652F (${list.length})`;
    rail.appendChild(title);
    const hint = document.createElement("div");
    hint.className = "hw-branch-rail__hint";
    hint.textContent = "\u70B9\u51FB\u52FE\u9009\u878D\u5408 \xB7 Shift+\u70B9\u51FB\u4EC5\u805A\u7126";
    rail.appendChild(hint);
    list.forEach((b) => {
      const row = document.createElement("button");
      row.type = "button";
      row.className = "hw-branch-rail__item";
      const seg = hw.branchSegmentByName(b.name);
      const tip = b.hash && hw.state.parsed ? hw.resolveCommitHash(b.hash, hw.state.parsed.commitMap) : null;
      const isMain = hw.isMainBranchName(b.name);
      if (b.name === hw.state.currentGitBranch) row.classList.add("hw-branch-rail__item--current");
      if (b.name === hw.state.highlightBranchName) row.classList.add("hw-branch-rail__item--focus");
      if (hw.state.selectedBranchNames.has(b.name)) row.classList.add("hw-branch-rail__item--fuse-pick");
      if (!tip || seg?.outOfLog) row.classList.add("hw-branch-rail__item--muted");
      if (seg?.merged) row.classList.add("hw-branch-rail__item--merged");
      if (isMain) row.classList.add("hw-branch-rail__item--main");
      const check = document.createElement("span");
      check.className = "hw-branch-rail__check";
      check.setAttribute("aria-hidden", "true");
      check.textContent = hw.state.selectedBranchNames.has(b.name) ? "\u2713" : "";
      const label = document.createElement("span");
      label.className = "hw-branch-rail__label";
      label.textContent = b.name;
      row.appendChild(check);
      row.appendChild(label);
      const status = seg?.merged ? "\u5DF2\u5408\u5E76" : seg?.continued ? "\u8FDB\u884C\u4E2D" : seg?.outOfLog ? "\u672A\u8F7D\u5165" : "\u6D3B\u8DC3";
      row.title = `${b.name}${b.hash ? `
${b.hash.slice(0, 12)}` : ""}
${status}${isMain ? "\n\u4E3B\u6CF3\u9053\uFF08\u878D\u5408\u76EE\u6807\uFF09" : "\n\u70B9\u51FB\uFF1A\u52A0\u5165/\u53D6\u6D88\u878D\u5408 \xB7 Shift+\u70B9\u51FB\uFF1A\u805A\u7126\u65F6\u95F4\u8F74"}`;
      row.addEventListener("click", (e) => {
        if (e.shiftKey || isMain) {
          hw.focusGitBranch(b.name);
          return;
        }
        hw.toggleBranchFusionPick(b.name);
      });
      rail.appendChild(row);
    });
    hw.syncFuseBar();
  }
  function focusGitBranch(name) {
    hw.state.highlightBranchName = name;
    const b = (hw.state.gitBranches || []).find((x) => x.name === name);
    if (b?.hash && hw.state.parsed) {
      const tip = hw.resolveCommitHash(b.hash, hw.state.parsed.commitMap);
      if (tip) {
        hw.state.focusGraphX = tip.displayColumn ?? tip.versionIndex;
        hw.state.panX = null;
        hw.scheduleRenderFromState();
      }
    }
    hw.renderBranchRail();
    hw.syncBranchLaneHighlight();
  }
  function isLaneCurrentGitBranch(lane) {
    if (!lane?.isBranchLane || !lane.branchSegment) return false;
    const cur = String(hw.state.currentGitBranch || "").trim();
    if (!cur || hw.isMainBranchName(cur)) return false;
    return lane.branchSegment.name === cur;
  }
  function syncBranchLaneHighlight() {
    if (!hw.els.fileRailInner) return;
    const name = hw.state.highlightBranchName;
    const fuseSet = hw.state.selectedBranchNames;
    const cur = String(hw.state.currentGitBranch || "").trim();
    const showCurrent = cur && !hw.isMainBranchName(cur);
    hw.els.fileRailInner.querySelectorAll(".file-rail__item--branch").forEach((row) => {
      const branchName = row.dataset.branchName || (row.querySelector(".file-rail__label")?.textContent || "").replace(/^⎇\s*/, "").trim();
      const match = name && branchName === name;
      row.classList.toggle("file-rail__item--branch-focus", !!match);
      row.classList.toggle("file-rail__item--branch-fuse", fuseSet.size >= 2 && fuseSet.has(branchName));
      row.classList.toggle("file-rail__item--branch-current", showCurrent && branchName === cur);
    });
  }
  Object.assign(hw, {
    branchSegmentByName,
    isMainBranchName,
    mainBranchName,
    filesForBranchSegment,
    fusionBoundaryFiles,
    buildBranchFusionPrompt,
    clearBranchFusionSelection,
    toggleBranchFusionPick,
    runFusionPulseAnim,
    crackWhipOnFusion,
    insertBranchFusionToChat,
    syncFuseBar,
    renderBranchRail,
    focusGitBranch,
    isLaneCurrentGitBranch,
    syncBranchLaneHighlight
  });

  // src/ui/modal.js
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
    const files = node.files || [node.filePath];
    const parsed = hw.state.parsed;
    const branchRef = hw.branchRefOnNode(node, parsed);
    node.branchRef = branchRef;
    hw.state.modalNode = node;
    hw.els.modalTitle.textContent = (() => {
      const ver = hw.nodeVersionTooltipLine(node);
      const subj = hw.commitSubjectForNode(node);
      return subj ? `${ver} \xB7 ${subj}` : `${ver} \xB7 ${node.hash.slice(0, 7)}`;
    })();
    hw.els.modalMeta.textContent = `${node.author} \xB7 ${node.date}`;
    hw.els.modalFile.textContent = node.isFolderAggregate ? node.lanePath === hw.ROOT_BUCKET ? "(root)/" : node.lanePath : files[0];
    hw.els.modalConstraint.textContent = (() => {
      const folderPath = hw.folderBoundaryPathFromNode(node);
      if (folderPath) return hw.constraintFolder(folderPath);
      return files.length === 1 ? hw.constraintSingle(files[0]) : hw.constraintMulti(files);
    })();
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
    return String(str).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }
  Object.assign(hw, {
    onFolderClusterClick,
    nodeClickAnchor,
    onFileNodeClick,
    openNodeModal,
    onBundleClick,
    closeModal,
    escapeHtml
  });

  // src/ui/tooltip.js
  function positionTooltipFromRect(rect) {
    hw.els.tooltip.style.transform = "";
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
    hw.gScroll.selectAll(".node-group[data-node-id]").each(function() {
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
      if (n.hasAttribute("data-node-id")) {
        gEl = n;
        break;
      }
    }
    if (!gEl || gEl.classList.contains("node-group--folder")) return null;
    const nodeId = gEl.getAttribute("data-node-id");
    const node = hw.state.nodeIndex[nodeId] || d3.select(gEl).datum();
    if (!node || !hw.nodeCanShowTooltip(node)) return null;
    const hit = gEl.querySelector(".node-hit:not(.node-hit--folder)") || gEl;
    return { node, hit };
  }
  function findNodeGroupEl(nodeId) {
    if (!hw.els.graphSvg || !nodeId) return null;
    const esc = typeof CSS !== "undefined" && CSS.escape ? CSS.escape(nodeId) : nodeId.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
    return hw.els.graphSvg.querySelector(`[data-node-id="${esc}"]`);
  }
  function resolveTooltipAnchor(node, anchorRect) {
    if (anchorRect && anchorRect.width > 0 && anchorRect.height > 0) return anchorRect;
    const hit = hw.findNodeGroupEl(node.id)?.querySelector(".node-hit");
    if (hit) return hit.getBoundingClientRect();
    return null;
  }
  function showTooltipForNode(node, anchorRect) {
    const files = node.files || [node.filePath];
    const ver = hw.nodeVersionTooltipLine(node);
    const subj = hw.commitSubjectForNode(node);
    const fileLine = node.isForkAnchor ? `\u4E3B\u6CF3\u9053\u5728\u6B64\u5904\u5206\u53C9 \u2192 \u2387 ${node.branchName || "branch"}` : node.isMergeAnchor || node.isMergeLanding ? node.isHistoricalMergeLanding ? `\u66FE\u7531\u5206\u652F\u6C47\u5165\u4E3B\u6CF3\u9053\uFF08\u5206\u652F\u5DF2\u7EE7\u7EED\u8FED\u4EE3\uFF09\xB7 \u2387 ${node.branchName || "branch"}` : `\u5206\u652F\u5408\u5165\u4E3B\u6CF3\u9053 \xB7 \u2387 ${node.branchName || "branch"}` : node.lane?.isBranchLane ? (() => {
      const seg = node.lane.branchSegment;
      const parsed = hw.state.parsed;
      return seg && parsed && hw.branchLaneProvenanceLine(node, seg, parsed) || `\u2387 ${seg?.name || "branch"} \xB7 \u6CBF\u5206\u652F\u63A8\u8FDB`;
    })() : node.isFolderAggregate ? node.lanePath === hw.ROOT_BUCKET ? "(root)/" : node.lanePath || node.label : files[0];
    const foot = node.isForkAnchor ? hw.PER_LANE_VERSION ? "\u4ECE\u8BE5\u6587\u4EF6\u5939\u7248\u672C\u5904\u5206\u51FA\uFF08\u6A2A\u8F74\u4E3A\u4E0A\u4F20 Cn\uFF09" : "\u4ECE\u8BE5\u7248\u672C\u5217\u5206\u51FA" : node.isMergeAnchor || node.isMergeLanding ? hw.PER_LANE_VERSION ? "\u6CBF\u5206\u652F\u6CF3\u9053\u5408\u5165\uFF08\u6A2A\u8F74\u4E3A\u4E0A\u4F20 Cn\uFF09" : "\u6CBF\u5206\u652F\u6CF3\u9053\u5408\u5165\u8BE5\u7248\u672C\u5217" : node.lane?.isBranchLane ? hw.branchLaneProvenanceIsContinuation(node, node.lane.branchSegment, hw.state.parsed) ? "\u6CBF\u672C\u5206\u652F\u6CF3\u9053\u63A8\u8FDB\uFF08\u975E\u4E3B\u6CF3\u9053\u65B0\u5206\u53C9\uFF09" : hw.PER_LANE_VERSION ? "\u4ECE\u4E3B\u6CF3\u9053\u8BE5\u5217\u5206\u51FA\uFF08\u6A2A\u8F74\u4E3A\u4E0A\u4F20 Cn\uFF09" : "\u4ECE\u4E3B\u6CF3\u9053\u8BE5\u5217\u5206\u51FA" : node.isFolderAggregate ? "\u5355\u51FB\u9009\u4E2D\u6587\u4EF6\u5939\u8FB9\u754C \xB7 \u53CC\u51FB\u8BE6\u60C5 \xB7 \u70B9 horsewhip \u590D\u5236" : "\u5355\u51FB\u5207\u6362\u9009\u4E2D \xB7 \u53CC\u51FB\u8BE6\u60C5 \xB7 \u70B9 horsewhip \u590D\u5236";
    const accent = node.lane?.color || "#6d7ce8";
    const verLine = subj ? `${ver} \xB7 ${subj}` : ver;
    if (!hw.els.tooltip) return;
    hw.els.tooltip.removeAttribute("hidden");
    hw.els.tooltip.classList.add("is-open");
    hw.els.tooltip.style.display = "block";
    hw.els.tooltip.style.setProperty("--tooltip-accent", accent);
    hw.els.tooltip.innerHTML = `
    <div class="tooltip__head">
      <span class="tooltip__ver">${hw.escapeHtml(verLine)}</span>
    </div>
    <div class="tooltip__meta">${hw.escapeHtml(node.author)} \xB7 ${hw.escapeHtml(node.date)}${subj ? "" : ` \xB7 ${hw.escapeHtml(node.hash.slice(0, 7))}`}</div>
    <div class="tooltip__file">${hw.escapeHtml(fileLine)}</div>
    <div class="tooltip__foot">${hw.escapeHtml(foot)}</div>
  `;
    const rect = hw.resolveTooltipAnchor(node, anchorRect);
    if (rect) hw.positionTooltipFromRect(rect);
    else {
      hw.els.tooltip.style.left = "50%";
      hw.els.tooltip.style.top = "42%";
      hw.els.tooltip.style.transform = "translate(-50%, -50%)";
    }
  }
  function hideTooltip() {
    if (!hw.els.tooltip) return;
    hw.els.tooltip.setAttribute("hidden", "");
    hw.els.tooltip.classList.remove("is-open");
    hw.els.tooltip.style.display = "";
    d3.selectAll(".node-group--hover").classed("node-group--hover", false);
  }
  function bindFolderNodePointer(g, node) {
    g.style("pointer-events", "all");
    g.on("pointerenter.tooltip", () => {
      g.classed("node-group--hover", true);
      const hit = g.select(".node-hit").node();
      const rect = hit instanceof Element ? hit.getBoundingClientRect() : null;
      hw.showTooltipForNode(node, rect);
    });
    g.on("pointerleave.tooltip", () => {
      g.classed("node-group--hover", false);
      hw.hideTooltip();
    });
  }
  function bindFileNodePointer(g, node) {
    g.style("pointer-events", "all");
    g.on("pointerenter.tooltip", (ev) => {
      g.classed("node-group--hover", true);
      if (!hw.nodeCanShowTooltip(node)) return;
      const hit = g.select(".node-hit").node();
      const rect = hit instanceof Element ? hit.getBoundingClientRect() : null;
      hw.showTooltipForNode(node, rect);
    });
    g.on("pointerleave.tooltip", () => {
      g.classed("node-group--hover", false);
      hw.hideTooltip();
    });
  }
  function initGraphViewportEvents() {
    if (!hw.els.graphViewport) return;
    if (hw.els.graphViewport.dataset.hwBound) return;
    hw.els.graphViewport.dataset.hwBound = "1";
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
    hw.els.graphViewport.addEventListener("click", onGraphClick);
    hw.els.graphViewport.addEventListener("pointerleave", hw.hideTooltip);
    hw.els.graphViewport.addEventListener("dblclick", (e) => {
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
    initGraphViewportEvents
  });

  // src/ui/plugin.js
  function updatePluginBar(laneCount) {
    const el = document.getElementById("plugin-open-status");
    if (!el) return;
    if (hw.state.pluginDemoAllFiles) {
      el.textContent = "\u6F14\u793A\u6570\u636E";
      return;
    }
    if (!hw.state.parsed) {
      el.textContent = "\u8BFB\u53D6 git log\u2026";
      return;
    }
    const boundaryN = hw.BOUNDARY_BAR_ENABLED ? hw.state.selectedNodeIds.size : 0;
    const ws = hw.state.workspaceFiles?.length ?? 0;
    if (laneCount > 0) {
      const lanes = hw.state.catalog?.lanes || [];
      const dirs = lanes.filter((l) => l.type === "folder" && (l.collapsed || l.isHeader)).length;
      const files = lanes.filter((l) => l.type === "file").length;
      const base = files > 0 ? `${files} \u4E2A\u6587\u4EF6 \xB7 ${dirs} \u4E2A\u76EE\u5F55` : `${laneCount} \u884C`;
      const exp = hw.PER_LANE_VERSION ? " \xB7 \u6BCF\u5939V" : "";
      el.textContent = boundaryN > 0 ? `${base} \xB7 \u8FB9\u754C ${boundaryN}${exp}` : `${base}${exp}`;
    } else {
      el.textContent = ws > 0 ? "\u76EE\u5F55\u5DF2\u540C\u6B65\uFF0C\u7B49\u5F85 git \u8BB0\u5F55" : "\u540C\u6B65\u5DE5\u4F5C\u533A\u76EE\u5F55\u2026";
    }
  }
  function showPluginEmptyGit() {
    if (hw.els.graphEmpty) {
      hw.els.graphEmpty.classList.remove("hidden");
      const title = hw.els.graphEmpty.querySelector(".graph-empty__title");
      const desc = hw.els.graphEmpty.querySelector(".graph-empty__desc");
      if (title) title.textContent = "\u5212\u5B9A\u8FB9\u754C\uFF0C\u518D\u8BA9 AI \u52A8\u624B";
      if (desc) desc.textContent = "\u9700\u8981\u81F3\u5C11\u4E00\u6B21 commit \u624D\u6709\u6CF3\u9053 \xB7 \u547D\u4EE4\u9762\u677F\uFF1Ahorsewhip: \u5237\u65B0 Git \u8BB0\u5F55";
    }
    if (hw.els.graphHint) hw.els.graphHint.hidden = true;
    if (hw.els.graphZoom) hw.els.graphZoom.hidden = true;
    hw.updatePluginBar(0);
  }
  Object.assign(hw, {
    updatePluginBar,
    showPluginEmptyGit
  });

  // src/audio/whip.js
  var WHIP_ICON_REV = "6";
  var whipFloatNodesForCopy = null;
  function ensureWhipAudioContext() {
    if (hw.whipAudioContext) return hw.whipAudioContext;
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return null;
    try {
      hw.whipAudioContext = new Ctx();
    } catch {
      return null;
    }
    return hw.whipAudioContext;
  }
  function loadWhipSoundMuted() {
    try {
      return localStorage.getItem(hw.WHIP_SOUND_MUTE_KEY) === "1";
    } catch {
      return false;
    }
  }
  function saveWhipSoundMuted(muted) {
    try {
      localStorage.setItem(hw.WHIP_SOUND_MUTE_KEY, muted ? "1" : "0");
    } catch {
    }
  }
  function getWhipCrackAudioUrl() {
    const meta = document.querySelector('meta[name="horsewhip-whip-audio"]');
    const url = meta?.getAttribute("content")?.trim();
    if (url) return url;
    if (hw.isPluginHost()) return "media/whip.wav";
    return hw.WHIP_CRACK_AUDIO_DEFAULT;
  }
  function whipCrackAudioCandidates(primary) {
    const list = [primary];
    if (/^https?:/i.test(primary) || primary.includes("vscode-webview://")) return list;
    const stem = primary.replace(/\.(mp3|wav|ogg|m4a|webm)$/i, "");
    if (stem !== primary) {
      for (const ext of ["wav", "mp3", "ogg", "m4a"]) {
        const alt = `${stem}.${ext}`;
        if (!list.includes(alt)) list.push(alt);
      }
    } else if (!primary.includes(".")) {
      for (const ext of ["wav", "mp3", "ogg"]) list.push(`${primary}.${ext}`);
    }
    const official = hw.isPluginHost() ? ["media/whip.wav", "media/whip-crack.wav"] : ["sound/whip.wav", "media/whip.wav"];
    for (const p of official) {
      if (!list.includes(p)) list.push(p);
    }
    return list;
  }
  function loadWhipCrackAudio() {
    if (hw.whipCrackBuffer || hw.whipCrackUseSynth) return Promise.resolve();
    if (hw.whipCrackLoadPromise) return hw.whipCrackLoadPromise;
    hw.whipCrackLoadPromise = (async () => {
      const ctx = hw.ensureWhipAudioContext();
      if (!ctx) {
        hw.whipCrackUseSynth = true;
        return;
      }
      if (ctx.state === "suspended") {
        try {
          await ctx.resume();
        } catch {
        }
      }
      for (const url of hw.whipCrackAudioCandidates(hw.getWhipCrackAudioUrl())) {
        try {
          const res = await fetch(url);
          if (!res.ok) continue;
          const arr = await res.arrayBuffer();
          hw.whipCrackBuffer = await ctx.decodeAudioData(arr.slice(0));
          return;
        } catch {
        }
      }
      hw.whipCrackUseSynth = true;
    })();
    return hw.whipCrackLoadPromise;
  }
  function playWhipCrackFromBuffer(ctx, buffer) {
    const now = ctx.currentTime;
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.72, now);
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
    hp.type = "highpass";
    hp.frequency.value = 3200;
    const peak = ctx.createBiquadFilter();
    peak.type = "peaking";
    peak.frequency.value = 5200;
    peak.Q.value = 1.6;
    peak.gain.value = 9;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.68, now);
    gain.gain.exponentialRampToValueAtTime(8e-4, now + crackDur);
    noise.connect(hp);
    hp.connect(peak);
    peak.connect(gain);
    gain.connect(ctx.destination);
    noise.start(now);
    noise.stop(now + crackDur);
    const click = ctx.createOscillator();
    click.type = "sine";
    click.frequency.setValueAtTime(3800, now);
    click.frequency.exponentialRampToValueAtTime(1800, now + 0.01);
    const clickGain = ctx.createGain();
    clickGain.gain.setValueAtTime(0.1, now);
    clickGain.gain.exponentialRampToValueAtTime(8e-4, now + 0.012);
    click.connect(clickGain);
    clickGain.connect(ctx.destination);
    click.start(now);
    click.stop(now + 0.014);
  }
  function playWhipCrackSound() {
    if (hw.state.whipSoundMuted) return;
    const ctx = hw.ensureWhipAudioContext();
    if (!ctx) return;
    if (ctx.state === "suspended") void ctx.resume();
    if (hw.whipCrackBuffer) {
      hw.playWhipCrackFromBuffer(ctx, hw.whipCrackBuffer);
      return;
    }
    if (hw.whipCrackUseSynth) {
      hw.playWhipCrackSoundSynth(ctx);
      return;
    }
    void hw.loadWhipCrackAudio().then(() => {
      if (hw.state.whipSoundMuted) return;
      const c = hw.ensureWhipAudioContext();
      if (!c) return;
      if (hw.whipCrackBuffer) hw.playWhipCrackFromBuffer(c, hw.whipCrackBuffer);
      else hw.playWhipCrackSoundSynth(c);
    });
  }
  function syncWhipSoundMuteButton() {
    const btn = hw.els.btnWhipSound;
    if (!btn) return;
    const muted = hw.state.whipSoundMuted;
    btn.setAttribute("aria-pressed", muted ? "true" : "false");
    btn.title = muted ? "\u5F00\u542F\u6325\u97AD\u97F3\u6548" : "\u5173\u95ED\u6325\u97AD\u97F3\u6548";
    btn.setAttribute("aria-label", btn.title);
    btn.classList.toggle("hw-sound-btn--muted", muted);
    const on = btn.querySelector(".hw-sound__on");
    const off = btn.querySelector(".hw-sound__off");
    if (on) on.hidden = muted;
    if (off) off.hidden = !muted;
  }
  function toggleWhipSoundMute() {
    hw.state.whipSoundMuted = !hw.state.whipSoundMuted;
    hw.saveWhipSoundMuted(hw.state.whipSoundMuted);
    hw.syncWhipSoundMuteButton();
  }
  function whipIconSvgHtml(svgClass = "hw-whip-btn__svg") {
    const large = svgClass === "hw-whip-float__svg";
    const sparkR = large ? 2 : 1.35;
    const sparkCore = large ? 0.95 : 0.62;
    const gripRx = large ? 1.55 : 1.05;
    const gripRy = large ? 1.02 : 0.68;
    const edgeW = large ? 0.38 : 0.24;
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
    if (host.dataset.whipV === WHIP_ICON_REV && host.querySelector(".hw-whip-icon__lash")) return;
    host.dataset.whipV = WHIP_ICON_REV;
    host.querySelector("svg")?.remove();
    host.insertAdjacentHTML("beforeend", hw.whipIconSvgHtml(svgClass));
  }
  function ensureWhipFloatEl() {
    let el = document.getElementById("hw-whip-float");
    if (!el) {
      el = document.createElement("div");
      el.id = "hw-whip-float";
      el.className = "hw-whip-float";
      el.hidden = true;
      el.innerHTML = `<button type="button" class="hw-whip-float__btn hw-whip-btn" aria-label="\u6325\u97AD\u4E0A\u9501" title="\u6325\u97AD\u4E0A\u9501"></button>`;
      el.querySelector(".hw-whip-float__btn").addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        hw.suppressOutsideClick = true;
        if (whipFloatNodesForCopy?.length) {
          hw.lockBoundaryFromSelection(whipFloatNodesForCopy, el);
        }
      });
      document.body.appendChild(el);
    }
    hw.mountWhipIcon(el.querySelector(".hw-whip-float__btn"), "hw-whip-float__svg");
    return el;
  }
  function hideWhipFloat() {
    whipFloatNodesForCopy = null;
    const el = document.getElementById("hw-whip-float");
    if (el) {
      el.hidden = true;
      el.classList.remove("hw-whip-float--crack", "hw-whip-btn--crack");
    }
  }
  function showWhipFloat(_node, nodesForCopy) {
    if (!nodesForCopy?.length) {
      hw.hideWhipFloat();
      return;
    }
    const el = hw.ensureWhipFloatEl();
    whipFloatNodesForCopy = nodesForCopy;
    el.hidden = false;
  }
  Object.assign(hw, {
    ensureWhipAudioContext,
    loadWhipSoundMuted,
    saveWhipSoundMuted,
    getWhipCrackAudioUrl,
    whipCrackAudioCandidates,
    loadWhipCrackAudio,
    playWhipCrackFromBuffer,
    playWhipCrackSoundSynth,
    playWhipCrackSound,
    syncWhipSoundMuteButton,
    toggleWhipSoundMute,
    whipIconSvgHtml,
    mountWhipIcon,
    ensureWhipFloatEl,
    hideWhipFloat,
    showWhipFloat
  });

  // src/app/data.js
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
      column: head.versionIndex ?? head.displayColumn ?? 1
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
    vp.classList.add("hw-head-arrival");
    hw.playWhipCrackSound();
    setTimeout(() => vp.classList.remove("hw-head-arrival"), 1400);
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
      const msg = hashChanged ? "\u4E3B\u6CF3\u9053\u65B0\u4E0A\u4F20 \xB7 \u5DF2\u805A\u7126\u6700\u65B0 Cn" : "\u4E3B\u6CF3\u9053\u5DF2\u66F4\u65B0 \xB7 \u5DF2\u805A\u7126";
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
  async function copyText(text, btn) {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      const ta = document.createElement("textarea");
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
    }
    if (btn) {
      if (btn.classList.contains("hw-whip-btn")) return;
      const orig = btn.textContent;
      btn.textContent = "\u2713";
      btn.classList.add("copied");
      setTimeout(() => {
        btn.textContent = orig;
        btn.classList.remove("copied");
      }, 1500);
    }
  }
  function showCopyToast(message) {
    let el = document.getElementById("hw-copy-toast");
    if (!el) {
      el = document.createElement("div");
      el.id = "hw-copy-toast";
      el.className = "hw-copy-toast";
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
    hw.els.logInput?.classList.add("shake");
    setTimeout(() => hw.els.logInput?.classList.remove("shake"), 400);
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
      if (typeof d3 === "undefined") {
        throw new Error("d3 \u672A\u52A0\u8F7D\uFF0C\u65E0\u6CD5\u7ED8\u5236\u6CF3\u9053");
      }
      if (hw.isPluginHost() && hw.els.graphEmpty) {
        hw.els.graphEmpty.classList.add("hidden");
      }
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
      hw.state.expandedPaths = /* @__PURE__ */ new Set();
      hw.state.focusGraphX = null;
      hw.state.pulseNodeId = null;
      hw.state.graphZoom = 1;
      if (hw.els.zoomLabel) hw.els.zoomLabel.textContent = "100%";
      if (hw.isPluginHost() && savedExpanded?.size) {
        savedExpanded.forEach((p) => hw.state.expandedPaths.add(p));
      }
      hw.state.animateNext = true;
      hw.graphRenderCtx = null;
      hw.state.catalog = null;
      hw.state.laneSliceCache = null;
      hw.renderFromState({ assignDefaultPulse: true });
      if (hw.state.selectedNodeIds.size) {
        hw.rebuildBoundaryFromNodes();
        hw.syncBoundaryBar();
      }
    } catch (e) {
      if (hw.isPluginHost() && hw.els.graphEmpty) {
        hw.els.graphEmpty.classList.remove("hidden");
        const title = hw.els.graphEmpty.querySelector(".graph-empty__title");
        const desc = hw.els.graphEmpty.querySelector(".graph-empty__desc");
        if (title) title.textContent = "\u6CF3\u9053\u7ED8\u5236\u5931\u8D25";
        if (desc) desc.textContent = e.message || String(e);
      }
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
    copyText,
    showCopyToast,
    showError,
    clearError,
    updateStats,
    renderFromState,
    loadAndRender,
    loadMoreCommits
  });

  // src/app/wire.js
  function ensureBoundaryWhipButton() {
    const btn = hw.els.btnBoundaryCopy;
    if (!btn) return;
    btn.classList.add("hw-whip-btn");
    btn.title = "\u6325\u97AD\u5708\u5B9A\uFF08\u4EC5\u6B64\u8303\u56F4\u53EF\u6539\uFF09";
    btn.setAttribute("aria-label", "\u6325\u97AD\u5708\u5B9A");
    hw.mountWhipIcon(btn, "hw-whip-btn__svg");
  }
  function ensureFuseWhipButton() {
    const btn = hw.els.btnFuseCopy;
    if (!btn) return;
    btn.classList.add("hw-whip-btn");
    btn.title = "\u590D\u5236\u878D\u5408\u4EFB\u52A1";
    btn.setAttribute("aria-label", "\u590D\u5236\u878D\u5408\u4EFB\u52A1");
    hw.mountWhipIcon(btn, "hw-whip-btn__svg");
  }
  function wireFuseBar() {
    if (!hw.BRANCH_FUSION_ENABLED) {
      if (hw.els.fuseBar) hw.els.fuseBar.hidden = true;
      return;
    }
    hw.ensureFuseWhipButton();
    if (hw.els.btnFuseChat && !hw.isPluginHost()) {
      hw.els.btnFuseChat.textContent = "\u590D\u5236\u878D\u5408\u4EFB\u52A1";
    }
    hw.els.btnFuseClear?.addEventListener("click", () => hw.clearBranchFusionSelection());
    hw.els.btnFuseCopy?.addEventListener("click", () => hw.crackWhipOnFusion(hw.els.btnFuseCopy));
    hw.els.btnFuseChat?.addEventListener("click", () => hw.insertBranchFusionToChat());
    hw.syncFuseBar();
  }
  function wireBoundaryBar() {
    if (!hw.BOUNDARY_BAR_ENABLED) {
      if (hw.els.boundaryBar) hw.els.boundaryBar.hidden = true;
      return;
    }
    hw.ensureBoundaryWhipButton();
    if (hw.els.btnBoundaryChat && !hw.isPluginHost()) {
      hw.els.btnBoundaryChat.hidden = true;
    }
    hw.els.btnBoundaryClear?.addEventListener("click", () => hw.clearNodeSelection());
    hw.els.btnBoundaryCopy?.addEventListener("click", () => {
      const nodes = hw.selectedWhipNodes();
      if (!nodes.length) return;
      hw.lockBoundaryFromSelection(nodes, hw.els.btnBoundaryCopy);
    });
    hw.els.btnBoundaryChat?.addEventListener("click", () => {
      const text = hw.buildBoundaryPrompt();
      if (!text) return;
      if (window.HorsewhipPluginBridge?.insertBoundaryToChat) {
        window.HorsewhipPluginBridge.insertBoundaryToChat(text);
      } else {
        hw.copyText(text, hw.els.btnBoundaryChat);
      }
    });
    hw.syncBoundaryBar();
  }
  Object.assign(hw, {
    ensureBoundaryWhipButton,
    ensureFuseWhipButton,
    wireFuseBar,
    wireBoundaryBar
  });

  // src/app/bootstrap.js
  function bootstrap() {
    if (hw.isPluginHost() && hw.state.workspaceFiles == null) {
      hw.state.workspaceFiles = [];
    }
    hw.els.btnGenerate?.addEventListener("click", () => {
      const text = hw.els.logInput?.value?.trim() ?? "";
      if (!text) {
        hw.showError("paste log or load demo");
        return;
      }
      hw.loadAndRender(text);
    });
    hw.els.btnDemo?.addEventListener("click", () => {
      if (hw.els.logInput) hw.els.logInput.value = hw.DEMO_GIT_LOG;
      hw.loadAndRender(hw.DEMO_GIT_LOG);
    });
    hw.els.btnMegaDemo?.addEventListener("click", () => {
      if (typeof hw.buildMegaDemoLog !== "function") {
        hw.showError("mega demo unavailable");
        return;
      }
      hw.clearError();
      const t0 = performance.now();
      const built = hw.buildMegaDemoLog();
      const ms = Math.round(performance.now() - t0);
      hw.els.logInput.value = `/* mega demo: ${built.stats.files} files \xB7 ${built.stats.commits} commits \xB7 generated ${ms}ms \u2014 not stored in textarea */`;
      hw.els.pasteDrop.hidden = true;
      hw.els.btnPasteToggle?.classList.remove("btn--solid");
      hw.loadAndRender(built.log);
    });
    hw.els.btnClear?.addEventListener("click", () => {
      if (hw.els.logInput) hw.els.logInput.value = "";
      hw.state.parsed = null;
      hw.state.panX = null;
      hw.state.scrollTop = 0;
      hw.state.expandedPaths = /* @__PURE__ */ new Set();
      hw.state.focusGraphX = null;
      hw.state.pulseNodeId = null;
      hw.state.catalog = null;
      hw.state.laneSliceCache = null;
      hw.state.rawLogText = null;
      hw.state.boundaryFiles.clear();
      hw.state.selectedNodeIds.clear();
      hw.syncBoundaryBar();
      hw.graphRenderCtx = null;
      d3.select(hw.els.graphSvg).selectAll("*").remove();
      hw.els.fileRailInner.innerHTML = "";
      hw.els.graphEmpty.classList.remove("hidden");
      hw.els.graphHint.hidden = true;
      if (hw.els.graphZoom) hw.els.graphZoom.hidden = true;
      hw.els.stats.hidden = true;
      hw.els.linkPanel.hidden = true;
      hw.els.largeWarn.hidden = true;
      hw.hideTooltip();
      hw.clearError();
    });
    hw.els.btnPasteToggle?.addEventListener("click", () => {
      const open = hw.els.pasteDrop?.hidden;
      if (hw.els.pasteDrop) hw.els.pasteDrop.hidden = !open;
      hw.els.btnPasteToggle?.classList.toggle("btn--solid", open);
      if (open) hw.els.logInput?.focus();
    });
    hw.els.cmdChip?.addEventListener("click", () => {
      hw.copyText('git log --all -100 --name-only --pretty=format:"%H|%P|%D|%an|%ad|%s"', hw.els.cmdChip);
    });
    if (hw.els.zoomLabel) hw.els.zoomLabel.textContent = "100%";
    hw.els.fileFilter?.addEventListener("input", () => {
      hw.state.fileFilter = hw.els.fileFilter.value;
      hw.renderFromState();
    });
    try {
      const savedLayout = localStorage.getItem(hw.LANE_LAYOUT_KEY);
      if (savedLayout === hw.LANE_LAYOUT_FLAT || savedLayout === hw.LANE_LAYOUT_GROUPED) {
        hw.state.laneLayout = savedLayout;
      }
    } catch {
    }
    hw.syncLaneLayoutButton();
    hw.els.btnLaneLayout?.addEventListener("click", hw.toggleLaneLayout);
    hw.state.whipSoundMuted = hw.loadWhipSoundMuted();
    try {
      localStorage.removeItem("horsewhip:whip-icon-image");
    } catch {
    }
    void hw.loadWhipCrackAudio();
    hw.syncWhipSoundMuteButton();
    hw.els.btnWhipSound?.addEventListener("click", (e) => {
      e.stopPropagation();
      hw.toggleWhipSoundMute();
    });
    const onFileRailScroll = () => {
      if (hw.scrollSync) return;
      const scrollEl = hw.fileRailScrollEl();
      if (!scrollEl) return;
      hw.stopViewportAnimation();
      hw.state.scrollTop = scrollEl.scrollTop;
      hw.applyGraphTransformImmediate();
      hw.markViewportInteracting();
      hw.scheduleViewportSync();
    };
    hw.els.fileRailInner?.addEventListener("scroll", onFileRailScroll, { passive: true });
    hw.els.fileRail?.addEventListener("scroll", onFileRailScroll, { passive: true });
    if (!hw.els.graphViewport) {
      console.error("[Horsewhip] #graph-viewport missing \u2014 plugin HTML out of date?");
      return;
    }
    hw.els.graphViewport.addEventListener("wheel", (e) => {
      if (!hw.state.parsed) return;
      e.preventDefault();
      if (e.ctrlKey || e.metaKey) {
        if (e.deltaY < 0) hw.nudgeZoom(hw.CONFIG.ZOOM_STEP);
        else if (e.deltaY > 0) hw.nudgeZoom(1 / hw.CONFIG.ZOOM_STEP);
        return;
      }
      const raw = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY;
      if (raw === 0) return;
      const step = Math.max(hw.versionScale() * 0.5, Math.min(32, Math.abs(raw) * 0.1));
      if (raw < 0) hw.nudgePan(-step);
      else hw.nudgePan(step);
    }, { passive: false });
    hw.els.btnZoomIn?.addEventListener("click", () => hw.nudgeZoom(hw.CONFIG.ZOOM_STEP));
    hw.els.btnZoomOut?.addEventListener("click", () => hw.nudgeZoom(1 / hw.CONFIG.ZOOM_STEP));
    hw.els.btnLoadMoreCommits?.addEventListener("click", hw.loadMoreCommits);
    hw.wireBoundaryBar();
    hw.wireFuseBar();
    hw.els.modalClose?.addEventListener("click", hw.closeModal);
    hw.els.modalBackdrop?.addEventListener("click", (e) => {
      if (e.target === hw.els.modalBackdrop) hw.closeModal();
    });
    hw.els.btnCopyLink?.addEventListener("click", () => {
      hw.copyText(hw.els.linkPanel.dataset.constraint || hw.els.linkConstraintText.textContent, hw.els.btnCopyLink);
    });
    document.addEventListener("keydown", (e) => {
      if (e.target.matches("textarea, input") && e.key !== "Escape") return;
      if (e.key === "Escape") {
        hw.hideTooltip();
        hw.closeModal();
        return;
      }
      if (!hw.state.parsed) return;
      if (e.key === "ArrowLeft") {
        e.preventDefault();
        hw.nudgePan(-hw.versionScale());
      }
      if (e.key === "ArrowRight") {
        e.preventDefault();
        hw.nudgePan(hw.versionScale());
      }
      if (e.key === "-" || e.key === "_") {
        e.preventDefault();
        hw.nudgeZoom(1 / hw.CONFIG.ZOOM_STEP);
      }
      if (e.key === "=" || e.key === "+") {
        e.preventDefault();
        hw.nudgeZoom(hw.CONFIG.ZOOM_STEP);
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        hw.nudgeVerticalScroll(-hw.CONFIG.LANE_HEIGHT);
      }
      if (e.key === "ArrowDown") {
        e.preventDefault();
        hw.nudgeVerticalScroll(hw.CONFIG.LANE_HEIGHT);
      }
    });
    window.addEventListener("resize", () => {
      if (!hw.state.parsed) return;
      if (hw.state.catalog) hw.scheduleViewportSync();
      else hw.scheduleRenderFromState();
    });
    hw.initGraphViewportEvents();
    document.addEventListener("click", (e) => {
      if (hw.suppressOutsideClick) {
        hw.suppressOutsideClick = false;
        return;
      }
      if (e.target.closest("#tooltip")) return;
      if (e.target.closest("#hw-whip-float")) return;
      if (e.target.closest("#file-rail") || e.target.closest(".file-rail")) return;
      if (e.target.closest("#plugin-bar") || e.target.closest(".plugin-bar")) return;
      if (hw.els.graphSvg?.contains(e.target)) return;
      if (!e.target.closest(".link-segment") && !e.target.closest("#link-panel")) {
        hw.hideTooltip();
        if (hw.els.modalBackdrop && !hw.els.modalBackdrop.hidden) return;
        hw.state.selectedLink = null;
        hw.state.selectedNodeIds.clear();
        hw.state.lastSelectedNodeId = null;
        hw.state.boundaryFiles.clear();
        if (hw.els.linkPanel) hw.els.linkPanel.hidden = true;
        hw.syncBoundaryBar();
        hw.updateSelectionVisuals();
      }
    });
  }

  // src/app/main.js
  if (typeof d3 === "undefined") {
    window.__horsewhipBootError = "d3 \u56FE\u8868\u5E93\u672A\u52A0\u8F7D\u3002\u8BF7 Reload Window\uFF1B\u82E5\u4ECD\u5931\u8D25\uFF0C\u786E\u8BA4 extension/media/d3.min.js \u5B58\u5728\u3002";
  } else {
    try {
      bootstrap();
    } catch (err) {
      console.error("[Horsewhip] bootstrap failed:", err);
      window.__horsewhipBootError = err?.message || String(err);
    }
  }
  if (hw.PER_LANE_VERSION) document.documentElement.classList.add("hw-per-lane-v");
  window.HorsewhipApp = {
    loadLog: hw.loadAndRender,
    loadDemo() {
      if (typeof DEMO_GIT_LOG !== "undefined") {
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
      hw.state.currentGitBranch = currentBranch || "";
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
    clearNodeSelection: hw.clearNodeSelection
  };
  window.dispatchEvent(new CustomEvent("horsewhip-app-ready"));
})();
