<div align="center">

# Horsewhip

**For that horse that keeps trampling your codebase**

### 不是 Git 图 · 是 AI 动手前的边界尺

在 AI 改代码之前，用**文件泳道 + 时间轴**看清「动哪、哪一版」；**两重鞭子**——泳道上**挥鞭圈定**跑马范围，写盘与 commit **即时拦、自动还原**——未圈定的一律不许改。

**适用于 VS Code · Cursor**（只装插件）

<br>

[![License: AGPL-3.0](https://img.shields.io/badge/License-AGPL--3.0-blue.svg)](LICENSE)
[![Version](https://img.shields.io/badge/version-1.0.8-orange.svg)](https://github.com/waitamomentC/horsewhip/releases)
[![Install](https://img.shields.io/badge/VS%20Code-Install%20Extension-007ACC?style=flat&logo=visualstudiocode&logoColor=white)](#install-extension)
[![Self-guarded](https://img.shields.io/badge/boundary-self--guarded-6d7ce8?style=flat)](#两重鞭子核心)
[![Demo](https://img.shields.io/badge/Demo-Video%20Soon-9ca3af?style=flat)](#demo)

<br>

| | |
|:---:|:---:|
| **乱改** · AI 动了边界外的 B、C | **两重鞭** · 圈外写盘即还原，commit 兜底 |
| 不知道「这一版」动了哪些文件 | 泳道上看 **Cn 上传序** + **文件 Vn** |
| 自己写小作文约束 AI | **挥鞭圈定** → 仅圈内可改；AI 越界须问用户 |

</div>

---

## Quick Start

**3 步开始（在你的业务项目里，不是本仓库）：**

| 步骤 | 做什么 |
|:---:|--------|
| **1** | 安装 [插件](#install-extension) → 重载窗口（打开 Git 仓库即激活守门） |
| **2** | 侧栏 **Horsewhip** → 点选节点 → **挥鞭圈定**（旋转瞄准环 = 仅此可改） |
| **3** | AI 只在圈内改码 → **你本人** `git commit`（有 origin 则 `push`）→ **刷新 Git 记录** 看新节点 |

守门元数据在 `.git/horsewhip/`（如 `allowlist.json`、`boundary-notes.md`），**勿提交**到业务仓库。

完整图文步骤：[docs/user-guide.md](./docs/user-guide.md)

---

## Demo

> **演示视频：即将发布**（v1.0 上架后贴链接，约 30–60 秒）  
> 内容预览：打开泳道 → 点选 → 挥鞭圈定 → Agent 改圈外文件被立即还原 → commit 兜底 → 泳道新节点。

在此之前可先 [安装插件](#install-extension) 按 Quick Start 体验。

<!-- 发布后替换为：
[![Demo video](https://img.shields.io/badge/Watch-Demo%20Video-red?style=for-the-badge&logo=youtube)](https://你的视频链接)
-->

---

## Install Extension

| 方式 | 说明 |
|------|------|
| **VS Code 市场（推荐）** | 扩展面板搜索 **Horsewhip** → 安装 → 重载窗口 |
| **GitHub Release** | [Releases](https://github.com/waitamomentC/horsewhip/releases) 下载 `.vsix` →「从 VSIX 安装…」 |
| **开发版** | 克隆本仓库 → 根目录 `npm run build:extension` → 打开 `extension/` → **F5** |

安装后：**文件 → 打开文件夹**（你的 Git 项目）→ 活动栏 **Horsewhip**。

首次上架与市场发布流程：[docs/marketplace-publish.md](./docs/marketplace-publish.md)

---

## What Horsewhip Does

| 时机 | 能力 |
|------|------|
| **圈地** | 泳道点选 → **挥鞭圈定** commit/路径（瞄准环）；当前 **git 分支** 泳道高亮 |
| **事中** | **两重鞭子** 守门（见下）；越界可自动还原并提示 AI 询问用户 |
| **事后** | 刷新泳道，在主泳道看各文件 **第几版**、**第几次上传** |
| **版本预览** | 节点详情 **检出并运行** → 看完 **恢复工作区** |

### 两重鞭子（核心）

马只能在你圈定的牧场里跑——**未圈定 = 全库禁止修改**；**已圈定 = 仅圈内路径可改**。

| 鞭 | 做什么 | 拦在哪 |
|----|--------|--------|
| **第一重 · 挥鞭圈定** | 在泳道选定节点，瞄准环（泳道色、慢速旋转）锁定 **commit + 分支 + 路径** | 未圈定时：编辑器只读；圈外路径不可改 |
| **第二重 · 写盘守门** | 监听磁盘与编辑（含 **Cursor Agent 直写**）；圈外或未圈定 → **立即 `git` 还原** | 不等 commit；可选向 Chat 插入说明，要求 AI **先问用户** 是否扩大圈定 |
| **兜底 · commit** | `pre-commit` + 面板提交校验；分支须与瞄准一致 | 防止绕过 IDE 的终端提交 |

不必再复制大段约束贴 Chat：圈定即机器可读（`allowlist.json`）；被拦时读 `edit-blocked.json` 或可选向 Chat 插入说明。

设置见 [docs/boundary-guard.md](./docs/boundary-guard.md)（`blockEdit` · `revertOnWrite` · `notifyAiOnWrite`）。

---

## Not GitGraph

| | GitGraph / GitLens | Horsewhip |
|---|-------------------|-----------|
| **解决什么** | 分支拓扑、怎么 merge | **AI 会不会改飞** |
| **横轴** | commit 时间线 | **上传序 Cn** |
| **纵轴** | 分支线 | **文件 / 文件夹泳道** |
| **你要懂** | DAG、merge 术语 | **只动这些路径** |

底层仍用 `git log`；界面面向 **vibe coding**，不教 Git 课。

---

## Web Demo

无需插件，本地打开网页体验泳道（粘贴 log / demo，无自动读盘、无守门）：

```bash
git clone https://github.com/waitamomentC/horsewhip.git
cd horsewhip && open index.html
```

---

## Documentation

| 文档 | 内容 |
|------|------|
| [docs/user-guide.md](./docs/user-guide.md) | 完整操作步骤 |
| [docs/boundary-guard.md](./docs/boundary-guard.md) | 两重鞭子守门 |
| [docs/marketplace-publish.md](./docs/marketplace-publish.md) | 上架 VS Code 市场 |
| [extension/README.md](./extension/README.md) | 插件说明（市场上架详情） |

---

## For Developers

```bash
git clone https://github.com/waitamomentC/horsewhip.git
cd horsewhip && npm install
npm run build:extension    # esbuild + 同步 extension/media + tsc
```

改 `src/` 或 `style.css` 后重新执行 `npm run build:extension`，插件开发宿主 **F5**（打开 `extension/`）。

发布市场：`cd extension && npx vsce publish`（见 [marketplace-publish.md](./docs/marketplace-publish.md)）。

---

## Version

| 项 | 说明 |
|----|------|
| **插件** | **1.0.9+**（`extension/package.json`，两重鞭子守门） |
| **本地元数据** | `.git/horsewhip/`（插件写入，勿提交） |

---

## 软件著作权与国内 Git 登记建议

若你计划在国内办理**软件著作权**登记，并关心公开仓库里的**作者署名**与材料可信度，建议如下（**不构成法律意见**；以版权保护中心及代理要求为准）。

### 只用插件

边界与守门由 **VS Code/Cursor 插件**在本地执行（两重鞭子、`.git/horsewhip/`，一般**不进入**你提交的版本库）。本仓库**不包含**任何需安装到业务项目的协议文件。

### Git 提交必须本人在本机完成（重要）

- **每一次** `git commit`、`git push` 请在**本机由你亲自执行**（终端或 IDE 自带 Git 界面）。  
- **不要**让 Cursor、Claude Code 等 **Agent 代你执行 commit/push**。代提交时说明里常出现 `Co-authored-by: Cursor` 等字段，在 GitHub/GitLab 上会显示 **AI 或工具为共同作者**，与软著材料中「著作权人仅为本人」的常见诉求**相冲突**，**容易导致审查困难或不被认可**。  
- 可以让 Agent 在插件圈定范围内**改工作区文件**；**写入版本历史**这一步请保留给人。  

### 公开仓库与材料

- 用于软著的源代码、说明书中，提交记录宜为**本人署名**、说明清晰，避免「AI 代提交」等表述。  
- 若使用本插件，鉴别材料可用：泳道截图、挥鞭圈定、越界被拦界面等**产品行为**。  

网页 Demo（`index.html`）无守门，仅作泳道体验，与登记用插件行为无关。

---

## License

[GNU AGPL-3.0](./LICENSE)

---

<div align="center">

**仓库** · [github.com/waitamomentC/horsewhip](https://github.com/waitamomentC/horsewhip)

*马鞭 · 两重鞭子 · 圈地即守门 · 简单 Git = 清晰边界时间轴*

</div>
