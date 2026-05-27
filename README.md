<div align="center">

# Horsewhip

**For that horse that keeps trampling your codebase**

### 不是 Git 图 · 是 AI 动手前的边界尺

在 Cursor / Copilot / Claude Code 改代码之前，用**文件泳道 + 时间轴**看清「动哪、哪一版」，**挥鞭**划出允许修改的范围，再让 AI 在边界内干活。

**适用于 VS Code · Cursor · Claude Code · Copilot**（协议可进任意支持 `AGENTS.md` 的工具）

<br>

[![License: AGPL-3.0](https://img.shields.io/badge/License-AGPL--3.0-blue.svg)](LICENSE)
[![Version](https://img.shields.io/badge/version-1.0.1-orange.svg)](https://github.com/waitamomentC/horsewhip/releases)
[![Install](https://img.shields.io/badge/VS%20Code-Install%20Extension-007ACC?style=flat&logo=visualstudiocode&logoColor=white)](#install-extension)
[![Protocol](https://img.shields.io/badge/AI-Protocol-6d7ce8?style=flat)](#install-protocol)
[![Demo](https://img.shields.io/badge/Demo-Video%20Soon-9ca3af?style=flat)](#demo)

<br>

| | |
|:---:|:---:|
| **乱改** · AI 动了边界外的 B、C | **收束** · 只允许改你划定的路径 |
| 不知道「这一版」动了哪些文件 | 泳道上看 **Cn 上传序** + **文件 Vn** |
| 自己写小作文约束 AI | **挥鞭** → 一键复制 / 插入 Chat |

</div>

---

## Quick Start

**3 步开始（在你的业务项目里，不是本仓库）：**

| 步骤 | 做什么 |
|:---:|--------|
| **1** | 安装 [插件](#install-extension) + [AI 协议](#install-protocol)（一次） |
| **2** | 打开项目 → 侧栏 **Horsewhip** → 点泳道节点 → **挥鞭** 或 **插入 Chat** |
| **3** | AI 在边界内改码 → `git commit`（有 origin 则 `push`）→ 插件 **刷新 Git 记录** 看新节点 |

<details>
<summary><strong>展开：协议安装命令</strong></summary>

```bash
cd /path/to/your-project

# Claude Code（不覆盖已有 CLAUDE.md）
curl -fsSL https://raw.githubusercontent.com/waitamomentC/horsewhip/main/protocol/scripts/install-claude-horsewhip.sh | bash -s -- .

# Cursor：下载 AGENTS.md 后在 Rules 里 @AGENTS.md
curl -fsSL -o AGENTS.md \
  "https://raw.githubusercontent.com/waitamomentC/horsewhip/main/protocol/AGENTS.md"
```

</details>

完整图文步骤：[docs/user-guide.md](./docs/user-guide.md)

---

## Demo

> **演示视频：即将发布**（v1.0 上架后贴链接，约 30–60 秒）  
> 内容预览：打开泳道 → 点节点划边界 → 挥鞭 / 插入 Chat → commit 后泳道出现新节点 → 可选守门拦截越界。

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

## Install Protocol

插件负责**看图划界**；协议负责让 AI **自动 commit / push / 只用 `feature/*` / 守边界**。

| 工具 | 做法 |
|------|------|
| **Claude Code** | 运行 [安装脚本](https://raw.githubusercontent.com/waitamomentC/horsewhip/main/protocol/scripts/install-claude-horsewhip.sh)（见 Quick Start） |
| **Cursor** | 项目根 `AGENTS.md` + Rules 引用 `@AGENTS.md` |
| **其他** | 复制 [protocol/AGENTS.md](./protocol/AGENTS.md) 到业务仓库根目录 |

与已有 `CLAUDE.md` **可共存**：Git / 边界听 horsewhip，构建架构听你的文件。见 [protocol/docs/claude-code.md](./protocol/docs/claude-code.md)。

---

## What Horsewhip Does

| 时机 | 能力 |
|------|------|
| **事前** | 泳道选节点 → 生成边界约束 → 复制 / **插入 Chat** |
| **事中** | 插件 **allowlist**；保存 / commit 可 **拦截越界**（可选） |
| **事后** | 刷新泳道，在主泳道看各文件 **第几版**、**第几次上传** |
| **版本预览** | 节点详情 **检出并运行** → 看完 **恢复工作区** |

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
| [protocol/AGENTS.md](./protocol/AGENTS.md) | AI 协作协议（v1.0.1） |
| [docs/boundary-guard.md](./docs/boundary-guard.md) | 守门与 pre-commit |
| [docs/marketplace-publish.md](./docs/marketplace-publish.md) | 上架 VS Code 市场 |
| [extension/README.md](./extension/README.md) | 插件开发与打包 |

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
| **插件** | **1.0.1**（`extension/package.json`） |
| **协议** | **v1.0.1**（`protocol/AGENTS.md`，与插件同历） |
| **迭代** | 1.0.x 小步修 bug / 体验；功能在后续 minor 收 |

---

## License

[GNU AGPL-3.0](./LICENSE)

---

<div align="center">

**仓库** · [github.com/waitamomentC/horsewhip](https://github.com/waitamomentC/horsewhip)

*马鞭 · 为 AI 协作而生 · 简单 Git 习惯 = 清晰边界时间轴*

</div>
