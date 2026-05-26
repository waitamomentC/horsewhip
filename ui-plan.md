# horsewhip (Horsewhip) — UI 设计计划

> **新窗口入口**：先读 [`README.md`](./README.md)，再读 [`work-log.md`](./work-log.md) 查进度。  
> **UI 现行版**：极简纯黑/白双主题 + **布局 v3**（标题栏工具 · 左文件栏 · 右节点视图，见 `style.css` / `index.html`）。下文霓虹版为早期草案，仅供参考。

---

## 1. 设计定位

### 1.1 一句话视觉概念

**「代码星图 · 版本时间线」** — 横轴为项目版本（左旧右新），每个文件是一条轨道；圆点 = 该版本改了此文件；同版本多文件用能量束连接。点节点可 **约束 AI** 或 **回滚到该版本**。

### 1.2 版本时间线示意

```
版本:     V1          V2              V3 (最新)
         ─────────────────────────────────→

a 文件    ●
b 文件                ●
c 文件    (无节点)
d 文件                                ●
```

### 1.3 参考气质（非抄袭）

| 参考 | 借鉴点 |
|------|--------|
| GitHub Universe / Vercel 深色落地页 | 大留白、渐变光晕、精致 typography |
| 科幻 HUD / 飞行雷达 | 细网格、扫描线、发光描边 |
| Figma / Linear | 玻璃面板、柔和阴影、高对比文字 |
| 音乐可视化 / 粒子场 | 背景微动、节点 pulse |

### 1.4 不做的事

- 不做花哨到影响可读性（文件路径、约束文案必须清晰）
- 不做纯 3D WebGL（维护成本高，与「无构建」冲突）
- 不做过度动画导致 D3 大图卡顿

---

## 2. 设计系统 (Design Tokens)

### 2.1 色彩

```css
:root {
  /* 背景层 */
  --bg-deep:       #06080f;   /* 最深背景 */
  --bg-base:       #0b0f1a;   /* 主背景 */
  --bg-elevated:   #111827;   /* 卡片底 */
  --bg-glass:      rgba(17, 24, 39, 0.55);

  /* 品牌主色 — 「horsewhip」能量紫 + 电 cyan */
  --accent-primary:   #8b5cf6;  /* violet-500 */
  --accent-secondary: #22d3ee;  /* cyan-400 */
  --accent-warm:      #f472b6;  /* pink-400，用于 hover 高亮 */

  /* 语义色 */
  --success:  #34d399;
  --warning:  #fbbf24;
  --danger:   #f87171;

  /* 文字 */
  --text-primary:   #f1f5f9;
  --text-secondary: #94a3b8;
  --text-muted:     #64748b;

  /* 图形专用 */
  --lane-line:      rgba(148, 163, 184, 0.12);
  --node-fill:      #1e293b;
  --node-stroke:    var(--accent-secondary);
  --node-glow:      rgba(34, 211, 238, 0.45);
  --link-stroke:    rgba(139, 92, 246, 0.55);
  --link-flow:      var(--accent-primary);
  --selection-ring: var(--accent-warm);

  /* 玻璃与边框 */
  --border-subtle:  rgba(255, 255, 255, 0.06);
  --border-glow:    rgba(139, 92, 246, 0.35);
  --shadow-panel:   0 8px 32px rgba(0, 0, 0, 0.45);
}
```

**配色逻辑**

- 背景：近黑蓝，衬托发光元素
- 节点默认：深灰填充 + cyan 描边（冷静、技术感）
- 连接线：紫色半透明虚线 + **流动动画**（「能量束」）
- 选中态：pink 外环 + 节点 scale 1.25
- 约束面板：玻璃卡片 + 左侧 accent 竖条

### 2.2 字体

| 用途 | 字体 | 来源 |
|------|------|------|
| 标题 / Logo | **Syne** 或 **Outfit** | Google Fonts |
| 正文 UI | **Inter** | Google Fonts |
| 代码 / 路径 / 约束 | **JetBrains Mono** | Google Fonts |

```css
--font-display: 'Syne', 'PingFang SC', sans-serif;
--font-body:    'Inter', 'PingFang SC', sans-serif;
--font-mono:    'JetBrains Mono', 'SF Mono', monospace;
```

- 「horsewhip」中文用 display 字重 800，英文副标题 letter-spacing: 0.08em
- 文件路径一律 mono，过长 truncate + tooltip 完整展示

### 2.3 圆角 / 间距 / 阴影

```css
--radius-sm:  6px;
--radius-md:  12px;
--radius-lg:  20px;
--radius-full: 9999px;

--space-xs: 4px;
--space-sm: 8px;
--space-md: 16px;
--space-lg: 24px;
--space-xl: 40px;

--glow-node:  0 0 12px var(--node-glow);
--glow-panel: 0 0 60px rgba(139, 92, 246, 0.15);
```

### 2.4 动效时长

```css
--ease-out-expo: cubic-bezier(0.16, 1, 0.3, 1);
--duration-fast:   150ms;
--duration-normal: 280ms;
--duration-slow:     600ms;
```

---

## 3. 页面结构与布局

### 3.1 桌面端 (≥1024px) — 展示主舞台

```
┌──────────────────────────────────────────────────────────────────┐
│  HEADER (64px, sticky, glass blur)                               │
│  ⚡ horsewhip Horsewhip    [GitHub ★] [Buy me a coffee]                 │
├──────────────────────────────────────────────────────────────────┤
│  HERO STRIP (可选，首次未生成时全屏；生成后折叠为 120px)          │
│  标语 + 一行 git 命令 chip + 「生成演化图」主按钮                  │
├───────────────────────────────┬──────────────────────────────────┤
│  INPUT PANEL (280px 宽, 左)   │  GRAPH STAGE (flex 1)            │
│  · textarea 粘贴区            │  · 全屏 SVG canvas               │
│  · 样例数据按钮 (Demo)        │  · 右上角 mini 图例              │
│  · 统计 chips: N commits      │  · 左下角 zoom 控件              │
│              M files          │                                  │
├───────────────────────────────┤                                  │
│  CONSTRAINT PANEL (左下固定)    │                                  │
│  玻璃卡片 · 约束文案 · 复制 CTA │                                  │
├───────────────────────────────┴──────────────────────────────────┤
│  AD SLOT (80px, 虚线框占位)                                       │
└──────────────────────────────────────────────────────────────────┘
```

**布局决策**

- 演化图占 **70%+ 视口面积** — 演示时截图主体
- 输入区左栏可 **折叠**（chevron），让图全宽展示
- 约束面板：桌面端 **左下角浮动**（不挡图右侧时间轴），宽 360px

### 3.2 平板 (768–1023px)

- 输入区变为顶部可折叠 drawer
- 图 + 约束面板上下分栏（图 65vh，约束 sticky bottom）

### 3.3 手机 (<768px)

- 单列：Hero → 粘贴区 → 图（横向 scroll + pinch 提示）
- 约束面板：**底部 sheet**（默认 peek 48px，上滑展开）
- 节点 hit area 最小 44px

---

## 4. 分区 UI 规格

### 4.1 Header

```
[ Logo 图标 ]  horsewhip  ·  HORSEWHIP          [ ★ Star on GitHub ]  [ ♥ Sponsor ]
```

| 元素 | 规格 |
|------|------|
| Logo | 32×32 SVG：抽象「鞭痕」S 形曲线 + 星点，渐变 `#8b5cf6 → #22d3ee` |
| 背景 | `backdrop-filter: blur(16px)` + 底边 1px `--border-subtle` |
| Star 按钮 | outline ghost，hover 时 fill 微光 |
| Sponsor | 小 pill，warm gradient border |

**Scroll 行为**：页面向下滚动 80px 后 header 略微缩小（64→52px），增强沉浸感。

### 4.2 Hero（首屏 / 空状态）

**未粘贴数据时** — 全屏沉浸式 landing：

```
                    ✦
              [ 鞭痕 Logo 动画 ]

         horsewhip · Horsewhip
   For that horse that keeps trampling your codebase

   ┌─────────────────────────────────────────┐
   │ git log --name-only --pretty=format:... │  ← 可复制 chip
   └─────────────────────────────────────────┘

        [ ⚡ 粘贴并生成 ]    [ 加载 Demo 数据 ]

   背景：缓慢移动的 radial gradient blob（purple/cyan）
         + 细点阵 grid（opacity 0.04）
```

- Logo 鞭痕：SVG stroke-dashoffset 循环动画（「鞭抽」感，1.2s）
- Demo 按钮：内置一份 8 commit × 6 file 样例，**演示必用**

**已有图时** — Hero 折叠为 slim bar，仅保留标语 + 统计。

### 4.3 输入面板

| 组件 | 样式 |
|------|------|
| Textarea | 深色 inset，mono 字体，min-height 200px，focus 时 border glow |
| 主按钮 | 全宽 gradient `primary → secondary`，hover lift + shadow |
| 统计 chips | `12 commits · 34 files · 6 links` pill badges |
| 清空 | 文字按钮，muted |

Placeholder 文案：

```
Paste output of:
git log --name-only --pretty=format:"%H|%an|%ad"
```

### 4.4 版本详情弹层（点击节点 · 核心交互）

```
┌─ glass modal ─────────────────────────────────────┐
│  V1 · abc123f                          [ × ]      │
│  Alice · 2024-01-15                               │
│  文件：src/a.ts                                   │
├───────────────────────────────────────────────────┤
│  ▎ AI 约束                                        │
│  只允许修改：src/a.ts          [ 📋 复制 ]        │
├───────────────────────────────────────────────────┤
│  ▎ 回滚到此版本                                   │
│                                                   │
│  [ ① 只回滚此文件 ]   ← 默认样式，cyan            │
│      git checkout abc123f -- src/a.ts             │
│      仅还原 a.ts；b、d 等其它文件不变             │
│                                                   │
│  [ ② 高危 · 回滚整个仓库 ]  ← danger 红框         │
│      git reset --hard abc123f                     │
│      ⚠ 将丢失此版本之后的所有改动                 │
│      [ 展开高危确认：输入 RESET 后复制/执行 ]     │
└───────────────────────────────────────────────────┘
```

| 元素 | 规格 |
|------|------|
| ① 单文件回滚 | 主按钮 ghost + cyan border；展示完整命令；网页「复制命令」/ 插件「执行」 |
| ② 整库回滚 | `--danger` 色；默认折叠；展开后需输入 `RESET` 才可点复制/执行 |
| 版本号 Vn | 弹层标题；tooltip 同步显示 |
| 移动端 | 全屏 bottom sheet，同上结构 |

**Phase 1 网页**：两个按钮均为 **复制 git 命令**，不执行。  
**Phase 2 插件**：①② 在确认后调用本地 git 执行。

### 4.5 约束面板（点击连接线）

```
┌─ glass panel ─────────────────────┐
│ ▎ AI CONSTRAINT（同批文件）       │
│  允许修改：a.ts, b.ts, c.ts       │
│  [ 📋 复制到剪贴板 ]              │
└───────────────────────────────────┘
```

### 4.6 版本分页控件

```
[ ← ]   版本 11–20 / 共 47   [ → ]
        ●○○○○  （可选页码指示）
```

- 位置：图下方或右上角，glass  pill
- 翻页：slide 过渡 300ms；从内存 slice 重渲染
- 文案：`Versions 11–20 of 47` 或 `第 2 页 · V11–V20`

### 4.7 广告位

```html
<div id="ad-slot" class="ad-slot" aria-hidden="true"></motion.div>
```

- 高度 80px，虚线 border，`AD` 水印 centered muted
- 与主内容 `--space-lg` 间距，不抢视觉

---

## 5. D3 演化图视觉规格（重点）

### 5.1 画布背景

SVG 内层：

1. **点阵 grid**：`pattern` 4×4px，#ffffff opacity 0.03
2. **泳道线**：水平线 `--lane-line`，alternate 行 subtle fill `rgba(255,255,255,0.015)`
3. **时间轴**（底部）：commit 索引或日期 tick，muted mono 10px

可选：SVG 外容器 `box-shadow: inset 0 0 80px rgba(139,92,246,0.08)`  vignette。

### 5.2 泳道标签（左侧）

```
src/components/Header.tsx          ●───●──────●
```

- 标签区固定宽 220px（desktop），sticky left on horizontal scroll
- 路径：右对齐 mono 12px，`text-overflow: ellipsis`
- Hover 泳道：该行背景 highlight band 扫过（CSS overlay 或 SVG rect opacity 动画）

### 5.3 节点 (Commit Node)

| 属性 | 值 |
|------|-----|
| 形状 | circle |
| 半径 | 7px（desktop）/ 10px（mobile） |
| 填充 | `--node-fill` |
| 描边 | 2px `--node-stroke` |
| 阴影 | SVG filter `feGaussianBlur` 发光 |

**交互态**

```
default   → 静态发光
hover     → r×1.3, stroke bright, tooltip fade in
selected  → pink ring (outer circle r+4), pulse keyframes
```

**Tooltip**（自定义 HTML，非 browser title）：

```
┌─────────────────────┐
│ abc123f             │
│ Alice · 2024-01-15  │
│ src/auth/login.ts   │
└─────────────────────┘
```

- 玻璃 dark tooltip，follow cursor，offset 12px
- 进入 delay 100ms，防抖动

### 5.4 连接线 (Same-Commit Links)

| 属性 | 值 |
|------|-----|
| 类型 | 三次贝塞尔 `d3.linkVertical` 或自定义 curve |
|  stroke | `--link-stroke` |
| dash | `6 4` |
| 宽度 | 1.5px default → 3px hover |

**流动动画（炫酷关键）**

```css
@keyframes dash-flow {
  to { stroke-dashoffset: -20; }
}
```

SVG:

```javascript
link.attr('stroke-dasharray', '6 4')
    .style('animation', 'dash-flow 1s linear infinite');
```

Hover 连接线：stroke 变 `--link-flow`，opacity 1，同 commit 所有节点 **同步 highlight**。

### 5.5 入场动画（首次 render）

| 元素 | 动画 |
|------|------|
| 泳道线 | width 0 → 100%，stagger 30ms/行 |
| 节点 | scale 0 → 1，stagger 按 x 从左到右，像「时间展开」 |
| 连接线 | stroke-dashoffset 绘制动画 400ms，在节点之后 |

使用 D3 `transition().delay().duration()`，总时长 ≤ 1.2s，避免演示等待过长。

### 5.6 Zoom / Pan

- `d3.zoom` 绑定 canvas
- 右下角控件：`+` `−` `⌂ reset`，glass 小按钮
- 滚轮缩放以 cursor 为中心
- 初次 fit：`.fitToView()` 自动 scale 使全部节点可见，padding 40px

---

## 6. 微交互清单

| 交互 | 反馈 |
|------|------|
| 粘贴 log | textarea border pulse 一次 |
| 点击「生成」 | 按钮 loading spinner 300ms → 图入场 |
| 点击节点 | 节点 pulse + 约束面板 slide up + 图内其他节点 dim（opacity 0.35） |
| 点击连接线 | 线上 flash + 涉及节点全部 selected ring |
| 复制成功 | CTA 变绿 + 轻微 haptic（mobile `navigator.vibrate(10)` 可选） |
| 折叠输入栏 | 图 width transition 400ms |
| 错误 parse | 输入框 shake + 红色 inline message |

---

## 7. 空态 / 错误态 / 加载态

### 7.1 空态（无数据）

Hero 全屏（见 4.2），图区域显示 faint 鞭痕 watermark。

### 7.2 加载态

- 按钮内 spinner + 「Parsing…」
- 图区域 skeleton：5 条灰色泳道 shimmer animation

### 7.3 错误态

```
⚠ 无法解析 log 格式
  请确认使用：git log --name-only --pretty=format:"%H|%an|%ad"
  [ 查看示例 ]
```

- 红色 left border alert card，不 modal

### 7.4 大数据提示

> 100 commits · 80 files — 图较密集，可横向滚动探索

- 顶部 amber info bar，可 dismiss

---

## 8. 组件级 CSS 类名约定

```
.app
.header / .header__logo / .header__actions
.hero / .hero--collapsed
.layout / .layout__sidebar / .layout__stage
.input-panel / .input-panel__textarea / .input-panel__submit
.graph-stage / .graph-stage__svg / .graph-stage__controls
.constraint-panel / .constraint-panel--visible
.tooltip / .tooltip--commit
.ad-slot
.chip / .chip--stat
.btn / .btn--primary / .btn--ghost
.alert / .alert--error
```

BEM 风格，便于纯 CSS 维护。

---

## 9. 响应式断点

```css
--bp-sm:  480px;
--bp-md:  768px;
--bp-lg:  1024px;
--bp-xl:  1440px;
```

| 断点 | 调整 |
|------|------|
| xl | 图 max-height none，充分利用大屏 |
| lg | 标准桌面布局 |
| md | sidebar → top drawer |
| sm | bottom sheet 约束，节点 r+3 |

---

## 10. 无障碍 (A11y)

- 色彩对比：正文 vs 背景 ≥ 4.5:1
- 节点：`role="button"` `tabindex="0"` `aria-label="commit abc123 on login.ts"`
- 连接线：`aria-label="link files in commit abc123"`
- 复制按钮：`aria-live="polite"` 播报「已复制」
- `prefers-reduced-motion`：关闭入场动画、流动 dash、背景 blob

---

## 11. 演示场景脚本（Showcase Flow）

用于录屏 / GIF / 路演，**30 秒内完成**：

1. **0–5s** — 打开页，Hero 鞭痕动画 + 标语
2. **5–10s** — 点击「加载 Demo 数据」
3. **10–18s** — 点 **a 的 V1 节点** → 版本弹层 → 展示回滚双选项
4. **18–24s** — 复制 AI 约束 / 复制单文件回滚命令
5. **24–30s** — ← → 版本翻页；点连接线 → 多文件约束

**Demo 数据要求**：至少 2 次「多文件同 commit」形成明显虚线束，1 条文件有 4+ 节点展示时间深度。

---

## 12. 资产清单

| 资产 | 格式 | 说明 |
|------|------|------|
| Logo / Favicon | SVG | 鞭痕 + 星点，内联 |
| Demo git log | `.txt` 或 JS 常量 | 内置样例 |
| OG Image（可选） | 1200×630 PNG | README / 社交分享，后期导出 |
| 截图 | README 占位 | 深色主题全图 + 约束面板 |

字体通过 Google Fonts CDN，不打包。

---

## 13. UI 实现阶段（对接 plan.md）

| 步骤 | 任务 | 产出 |
|------|------|------|
| UI-1 | Design tokens + 全局背景 + 字体 | `style.css` 基础层 |
| UI-2 | Header + Hero + 输入面板静态 | HTML 结构 |
| UI-3 | 约束面板 + 广告位 + 响应式骨架 | 布局完成 |
| UI-4 | D3 泳道/节点/线静态样式 | 无动画版图表 |
| UI-5 | 入场动画 + 流动虚线 + hover/selected | 「炫酷」达标 |
| UI-6 | Tooltip + 微交互 + reduced-motion | 交互抛光 |
| UI-7 | Demo 数据 + 演示脚本走通 | 可录屏 |
| UI-8 | 移动端 bottom sheet + touch | 响应式完成 |

**炫酷验收标准（Must Have）**

- [ ] 深色渐变背景 + 玻璃面板，截图可直接发 Twitter
- [ ] 节点发光 + 连接线 dash 流动动画
- [ ] 首次 render 有 stagger 入场
- [ ] 版本分页 ← → + 版本弹层回滚双选项
- [ ] 高危 reset 二次确认（输入 RESET）
- [ ] Demo 一键加载，30 秒可完成演示闭环
- [ ] 约束面板复制有明确 success 反馈

---

## 14. 视觉稿示意（ASCII Wireframe）

### 生成图后桌面态

```
╔══════════════════════════════════════════════════════════════════╗
║ ⚡ horsewhip HORSEWHIP                          [ ★ GitHub ] [ ♥ ]   ║
╠══════════════╦═══════════════════════════════════════════════════╣
║ PASTE LOG    ║  · · · · · · · · · · · · · · · · · · · · · · ·  ║
║ ┌──────────┐ ║       ●━━━━━━━━━━━━━━━●                        ║
║ │          │ ║  Header.tsx ───●           ●────●              ║
║ │  textarea│ ║                  ╲         ╱                   ║
║ │          │ ║  auth/login.ts ───●━━━━━━━●                    ║
║ └──────────┘ ║                           ╲ ╱                     ║
║ [⚡ 生成]    ║  auth/types.ts ────────────●                      ║
║ 12 commits   ║                                                  ║
║ 34 files     ║  ──── time →                                      ║
║              ║                                    [ + ] [ - ] [⌂]║
║ ┌─约束面板──┐║                                                  ║
║ │只允许修改: │║                                                  ║
║ │login.ts   │║                                                  ║
║ │[ 复制 ]   │║                                                  ║
║ └──────────┘ ║                                                  ║
╠══════════════╩═══════════════════════════════════════════════════╣
║ · · · AD SLOT · · ·                                              ║
╚══════════════════════════════════════════════════════════════════╝
```

---

*文档版本：1.0 | 展示向网页版 UI 规格 | 2026-05-24*
