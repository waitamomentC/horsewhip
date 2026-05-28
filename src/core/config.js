import { hw } from './hw.js';

'use strict';

const CONFIG = {
  VERSION_SPACING: 26,
  VERSION_ORIGIN_X: 12,
  V1_VIEW_INSET: 26,
  RULER_HEIGHT: 24,
  MARGIN: { top: 7, right: 29, bottom: 17, left: 28 },
  LANE_HEIGHT: 31,
  /** 最底泳道 Vn 标签在节点下方，需额外可滚动高度 */
  LANE_BOTTOM_PAD: 22,
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
const PER_LANE_VERSION = true;
/** Left sidebar branch list (git branch names) — off; use graph nodes instead */
const BRANCH_RAIL_ENABLED = false;
/** Multi-select branch fusion UI */
const BRANCH_FUSION_ENABLED = false;
/** Top "本次边界" bar — always on in VS Code/Cursor plugin (unlock / re-whip) */
const BOUNDARY_BAR_ENABLED = false;

function boundaryBarActive() {
  return BOUNDARY_BAR_ENABLED || hw.isPluginHost?.();
}
/** 同一 commit 跨泳道的竖向「总线」（易与 C 列网格混淆，默认关） */
const SHOW_COMMIT_BUS_LINES = false;
const LANE_LAYOUT_KEY = 'hw-lane-layout';
const WHIP_SOUND_MUTE_KEY = 'horsewhip:whip-sound-muted';
/** 官方音效源文件：仓库 `sound/whip.wav`（构建时同步进 extension/media） */
const WHIP_CRACK_AUDIO_DEFAULT = 'sound/whip.wav';
const LANE_LAYOUT_GROUPED = 'grouped';
const LANE_LAYOUT_FLAT = 'flat';
const LANE_HUES = [210, 160, 280, 35, 350, 120, 45, 300, 190, 15, 250, 80];
const CODE_FILE_RE = /\.(tsx?|jsx?|mjs|cjs|vue|svelte|py|go|rs|java|kt|kts|swift|c|cc|cpp|cxx|h|hh|hpp|cs|rb|php|scala|css|scss|less|sass|html?|sh|bash|zsh|sql|r|lua|dart|elm)$/i;
const CONFIG_FILE_RE = /\.(json|jsonc|yaml|yml|toml|ini|cfg|conf|xml|plist|properties|lock|npmrc|editorconfig|env)$/i;
const CONFIG_BASENAMES = /^(package-lock\.json|package\.json|tsconfig\.json|jsconfig\.json|\.env(\..+)?|\.gitignore|\.prettierrc|\.eslintrc|docker-compose\.ya?ml)$/i;
const ICON_SIZE = 5;
const VERSION_STEP_ICON_SCALE = 0.5;
const ICON_HIT_PAD = 4;
const LANE_VIEW_OVERSCAN = 4;

Object.assign(hw, {
  CONFIG, ROOT_BUCKET, PER_LANE_VERSION,
  BRANCH_RAIL_ENABLED, BRANCH_FUSION_ENABLED, BOUNDARY_BAR_ENABLED, boundaryBarActive, SHOW_COMMIT_BUS_LINES,
  LANE_LAYOUT_KEY, WHIP_SOUND_MUTE_KEY, WHIP_CRACK_AUDIO_DEFAULT,
  LANE_LAYOUT_GROUPED, LANE_LAYOUT_FLAT, LANE_HUES,
  CODE_FILE_RE, CONFIG_FILE_RE, CONFIG_BASENAMES, ICON_SIZE, VERSION_STEP_ICON_SCALE,
  ICON_HIT_PAD, LANE_VIEW_OVERSCAN,
});
