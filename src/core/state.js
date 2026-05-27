import { hw } from './hw.js';

const state = {
  parsed: null,
  panX: null,
  fileFilter: '',
  scrollTop: 0,
  expandedPaths: new Set(),
  selectedNodeIds: new Set(),
  lockedNodeIds: new Set(),
  /** @type {Array<{ nodeId: string, commit: string, branch: string, lanePath: string, files: string[] }>} */
  lockTargets: [],
  selectedLink: null,
  pulseNodeId: null,
  nodeIndex: {},
  focusGraphX: null,
  modalNode: null,
  animateNext: true,
  laneLayout: 'grouped',
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
  boundaryFiles: new Set(),
  lastSelectedNodeId: null,
  focusedFilePath: null,
  viewportAnimGeneration: 0,
  whipSoundMuted: false,
  gitBranches: [],
  currentGitBranch: '',
  highlightBranchName: null,
  selectedBranchNames: new Set(),
  viewportInteracting: false,
  headSnapshotBeforeLoad: null,
};

let whipAudioContext = null;
let whipCrackBuffer = null;
let whipCrackLoadPromise = null;
let whipCrackUseSynth = false;

let suppressOutsideClick = false;
let nodeClickTimer = null;

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
  suppressOutsideClick, nodeClickTimer,
  svgLayout, scrollSync, graphRenderCtx, viewportSyncQueued, viewportInteractEndTimer,
  svgRoot, gMain, gScroll,
});
