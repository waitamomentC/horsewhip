import { hw } from './hw.js';

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
  /** Plugin: all local branches from git for-each-ref. */
  gitBranches: [],
  currentGitBranch: '',
  highlightBranchName: null,
  /** Multi-branch pick for AI fusion → main. */
  selectedBranchNames: new Set(),
  /** True while user pans/scrolls — skip per-lane rAF mount & pause ripples. */
  viewportInteracting: false,
  /** Snapshot before loadLog / reload — detect new HEAD on main swimlane. */
  headSnapshotBeforeLoad: null,
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
let viewportInteractEndTimer = null;
let svgRoot;
let gMain;
let gScroll;


Object.assign(hw, {
  state, whipAudioContext, whipCrackBuffer, whipCrackLoadPromise, whipCrackUseSynth,
  svgLayout, scrollSync, graphRenderCtx, viewportSyncQueued, viewportInteractEndTimer,
  svgRoot, gMain, gScroll, suppressOutsideClick, nodeClickTimer,
});
