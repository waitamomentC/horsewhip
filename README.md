# 马鞭 · Horsewhip

> **For that horse that keeps trampling your codebase**  
> 版本时间线 · AI 文件边界约束 · 回滚命令

**仓库**：<https://github.com/waitamomentC/horsewhip>

![screenshot placeholder](./docs/screenshot.png)

---

## 快速开始

### IDE 插件（推荐演示）

```bash
cd extension && npm install && npm run sync-assets && npm run compile
```

在 VS Code / Cursor 打开 `extension/` → **F5** → **先打开项目文件夹** → 点击左侧活动栏 **马鞭** 图标 → **在编辑器中打开要看的文件**，侧边栏会为这些文件绘制泳道。  
需已 `git init`；否则面板会提示先建立仓库。详见 [`extension/README.md`](./extension/README.md)。

### 网页版

```bash
open index.html
# 或
python3 -m http.server 8080
```

需联网（D3.js CDN + 字体）。

1. 标题栏点 **demo** 或 **paste** → **generate**
2. **V1 贴画布左缘** · 默认**顶层 folder 聚合**（`src/`、`docs/`、`(root)` 等，▸ 展开）
3. 顶部**版本尺**横轴 · 每格 36px · 下方节点与刻度严格对齐
4. 左侧 **▸ 点击展开**文件夹 · **⌥+点击** 递归展开
5. 每个泳道独立配色，子级继承父文件夹色相
6. 左侧上下滚动 ↔ 同步右侧图形纵向位置
7. 右侧滚轮：**↓ 画面右移**（Excel 式无限列）· **↑ 向左至 V1** 贴左停住
8. 点节点 → 约束 + 回滚命令 · 点汇聚线 → 多文件约束

### 键盘

| 键 | 作用 |
|----|------|
| `←` | 向左平移（至 V1 贴左） |
| `→` | 向右平移（无限延伸） |
| `↑` `↓` | 上下滚动文件/泳道（与左侧栏同步） |

先点击右侧节点区再按键。

### Git 命令

```bash
git log --all -100 --name-only --pretty=format:"%H|%P|%D|%an|%ad"
```

### 视觉模型

自研水平 git 时间线 + 文件泳道。设计规范见 [`DESIGN.md`](./DESIGN.md)，参考库在 [awesome-design-md](https://github.com/VoltAgent/awesome-design-md)（本地 `.ref/awesome-design-md/`）。

- **横轴** = DAG 时间 · **纵轴** = 文件 / folder / 分支泳道
- Linear 风 dark canvas · accent `#5e6ad2` 标记 HEAD

---

## UI 原则

- **极简无干扰**：暗色画布为主；彩色马鞭 logo
- **标题栏操作**：demo / paste / generate / filter 不占主视野
- **文件夹树泳道**：默认顶层 folder 聚合 · 展开后显示子级
- **泳道配色**：12 色盘按顶层 folder 分配 · 子级继承 hue
- **暗色单主题**：`#07080a` 画布 · accent `#6d7ce8`
- **极客风**：mono 字体、细边框、纯功能布局

---

## 开发索引

| 文件 | 说明 |
|------|------|
| [`work-log.md`](./work-log.md) | 进度 |
| [`plan.md`](./plan.md) | 产品计划 |
| [`ui-plan.md`](./ui-plan.md) | UI 规格（v1 霓虹版已 supersede → 见 style.css） |
| [`DESIGN.md`](./DESIGN.md) | UI 设计规范（参考 awesome-design-md） |
| `.ref/awesome-design-md/` | 设计参考库（VoltAgent） |
| `index.html` | 页面 |
| `style.css` | 主题 + 布局 |
| `script.js` | 逻辑 + 主题切换 |
| [`extension/`](./extension/) | VS Code / Cursor 插件（Webview + 本地 git） |

**状态**：Phase 1 网页 MVP · **Phase 2 插件 v0.1 已起步**（`extension/`）

---

## 许可证

[GNU AGPL-3.0](./LICENSE)

*2026-05-24*
