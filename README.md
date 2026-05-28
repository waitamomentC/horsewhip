<div align="center">

# Horsewhip

**For that horse that keeps trampling your codebase**

### AI 动手前的边界尺 · 文件泳道 + 两重鞭守门

**泳道**看清动哪、哪一版。**挥鞭**圈定跑马范围。**写盘 / commit** 圈外即拦、可自动还原。  
适用 **VS Code · Cursor**（插件）；Cursor 可加 **MCP + Skill** 让 Agent 自动圈地。

<br>

[![License: AGPL-3.0](https://img.shields.io/badge/License-AGPL--3.0-blue.svg)](LICENSE)
[![Version](https://img.shields.io/badge/version-1.0.8-orange.svg)](https://github.com/waitamomentC/horsewhip/releases)
[![Install](https://img.shields.io/badge/VS%20Code-Install%20Extension-007ACC?style=flat&logo=visualstudiocode&logoColor=white)](#install-extension)
[![Agent](https://img.shields.io/badge/Agent-MCP%20%2B%20Skill-6d7ce8?style=flat)](#agent-完整流程cursor)
[![Demo](https://img.shields.io/badge/Demo-Video%20Soon-9ca3af?style=flat)](#demo)

<br>

| 痛点 | Horsewhip |
|:---:|:---:|
| AI 改飞 B、C | 圈外写盘还原，commit 兜底 |
| 不知道动了哪一版 | 泳道 **Cn** + 文件 **Vn** |
| 贴长文约束 AI | **挥鞭圈定** → 仅圈内可改 |

</div>

---

## 三种用法

| 模式 | 安装 | 谁圈地 | 面板 / 鞭声 |
|------|------|--------|-------------|
| **手动** | 仅插件 | 你在泳道点选 → 挥鞭 | 有 |
| **完整版** | 插件 + MCP + Skill | Agent `lock_paths` + 仪式鞭 | 有（与手动共用 allowlist） |
| **轻量 Agent** | MCP + Skill | Agent 写 allowlist | 无泳道、无鞭声 |

均在**你的业务 Git 项目**里用，不是在本 horsewhip 源码仓里试 Agent。

---

## Quick Start（手动 · 3 步）

| # | 操作 |
|:-:|------|
| 1 | [安装插件](#install-extension) → 重载 → 打开 Git 项目文件夹 |
| 2 | 侧栏 **Horsewhip** → 点选节点 → **挥鞭圈定**（瞄准环 = 仅此可改） |
| 3 | AI 只在圈内改 → **你本人** `git commit` → 面板 **刷新 Git 记录** |

元数据在 `.git/horsewhip/`（`allowlist.json` 等），**勿提交**到业务仓库。  
详细步骤：[docs/user-guide.md](./docs/user-guide.md)

---

## Agent 完整流程（Cursor）

### 一次性准备

| # | 操作 |
|:-:|------|
| 1 | 安装 [Horsewhip 插件](#install-extension)，打开业务项目 |
| 2 | 构建 MCP：`cd agent/mcp && npm install && npm run build` |
| 3 | Cursor **MCP** 配置（路径改成你的克隆位置）： |

```json
{
  "mcpServers": {
    "horsewhip": {
      "command": "node",
      "args": ["/ABS/PATH/horsewhip/agent/mcp/dist/index.js"],
      "env": { "HORSEWHIP_WORKSPACE": "${workspaceFolder}" }
    }
  }
}
```

| # | 操作 |
|:-:|------|
| 4 | 挂上 Skill：`ln -sf ../../agent/skills/horsewhip .cursor/skills/horsewhip`（在项目根执行，路径按仓库调整） |
| 5 | Reload Window |

说明：[agent/README.md](./agent/README.md) · [agent/mcp/README.md](./agent/mcp/README.md)

### 完整版怎么协作（架构）

Agent **不直接画 UI**。MCP 只写磁盘；插件监听后守门 + 更新泳道面板。

```mermaid
flowchart TB
  subgraph you [你]
    Chat[Cursor Chat]
    Panel[Horsewhip 面板]
    Git[本人 git commit]
  end
  subgraph agent [Agent]
    Skill[horsewhip SKILL]
    Tools[MCP 7 个工具]
  end
  subgraph disk [.git/horsewhip/]
    AL[allowlist.json]
    SIG[mcp-signal.json]
    EB[edit-blocked.json]
  end
  subgraph ext [插件进程]
    Mem[内存 allowlist + 守门]
    Watch[文件监听]
    WV[Webview 边界栏 + 鞭声]
  end

  Chat --> Skill --> Tools
  Tools --> AL
  Tools --> SIG
  AL --> Watch --> Mem
  SIG --> Watch --> WV
  Mem -->|圈外保存| Git
  WV --> Panel
  Chat --> you
  Git --> Panel
```

### 对话时序（一次任务）

```mermaid
sequenceDiagram
  participant U as 你
  participant C as Chat
  participant A as Agent
  participant M as MCP
  participant E as 插件

  U->>C: 改 Login 页
  A->>M: lock_paths
  M->>E: allowlist.json
  A->>M: whip_ceremony lock
  M->>E: 鞭1 + 边界栏
  A->>A: 改 Login.tsx
  alt 改圈外
    E-->>A: 还原
    A->>U: 扩圈?
  end
  A->>M: task_complete
  M->>E: 鞭2
  U->>U: git commit
  U->>E: 刷新泳道
```

<details>
<summary>展开：含 Skill / unlock 的完整时序</summary>

```mermaid
sequenceDiagram
  participant U as 你
  participant C as Cursor Chat
  participant A as Agent + Skill
  participant M as horsewhip MCP
  participant E as 插件 + 泳道

  U->>C: 描述改代码需求
  C->>A: 加载 horsewhip skill
  A->>M: horsewhip_lock_paths
  M->>E: allowlist.json
  A->>M: horsewhip_whip_ceremony lock
  M->>E: 第一声鞭 + 边界栏
  A->>A: 只改 allowlist 内文件
  alt 改圈外
    E-->>A: edit-blocked.json
    A->>U: expand_boundary?
    U->>A: 同意 / 拒绝
  end
  A->>M: horsewhip_task_complete
  M->>E: 第二声鞭
  U->>U: 本人 git commit
  U->>M: unlock（换任务可选）
```

</details>

### 步骤对照（完整版）

| 阶段 | Agent（MCP） | 你看到 / 你做 |
|------|----------------|----------------|
| 开任务 | — | Chat 描述需求；可开着 Horsewhip 面板 |
| 圈地 | `lock_paths` | 边界栏出现路径列表 |
| 开工鞭 | `whip_ceremony` phase=`lock` | **第一声鞭** |
| 改码 | 只动圈内 | 圈外保存被还原 |
| 越界 | 应停下问你 | 同意 → `expand_boundary`；拒绝 → 只改圈内方案 |
| 收工 | `task_complete` | **第二声鞭**；Agent **不代 commit** |
| 收尾 | 可选 `unlock` | 你 `git commit` → 刷新泳道；空白处 / 解锁按钮可解除圈定 |

Chat 可加一句：「按 horsewhip 流程，先 lock 再改。」

### MCP 工具一览

| 工具 | 作用 |
|------|------|
| `horsewhip_lock_paths` | 写 allowlist，`locked: true` |
| `horsewhip_whip_ceremony` | 圈定 / 扩圈鞭声 + UI |
| `horsewhip_task_complete` | 收工鞭声 + 提示 |
| `horsewhip_expand_boundary` | 用户同意后合并路径 |
| `horsewhip_get_boundary` | 读 allowlist、拦截标记 |
| `horsewhip_unlock` | 清空圈定 |
| `horsewhip_suggest_scope` | 路径建议（占位，4B） |

### 为什么 MCP 要本地装？能「拉下来」或让 AI 自己装吗？

| 问题 | 简短回答 |
|------|----------|
| 不能像插件一样一键安装？ | **暂时不能**。插件走 VS Code 市场；MCP 走 Cursor 的 `mcpServers` 配置，需本机有 `node` 和 `dist/index.js` 路径。 |
| 能从网上直接拉吗？ | 代码在仓库 [`agent/mcp/`](./agent/mcp/)。**尚未**发布成 `npx horsewhip-mcp` 一键包（后续可做）。现在要：`git clone` → `npm run build` → 配 MCP。 |
| Skill 挂上就够了？ | **不够**。Skill 只教 Agent **怎么用工具**；工具由 **MCP 进程**提供。没配 MCP，Agent 调不到 `horsewhip_lock_paths`。 |
| 让 AI 自己 `npm install` 行吗？ | Agent **可以**在你机器上跑命令建 `dist/`，但 **不能代替你在 Cursor 里批准 MCP 配置**。stdio MCP 必须写进设置 / `mcp.json`，属于安全边界。 |
| 为什么要自建、不和插件打成一个包？ | 当前是 **4A-2**：独立进程写 `.git/horsewhip/`，插件 **监听同一文件** 做 UI 与守门。进程分离 = Agent 无面板也能圈地；与扩展同进程是后续选项。 |

**你现在要做的事（一次性）：**

1. 克隆 horsewhip → `npm run build`（在 `agent/mcp`）
2. Cursor 填 `mcpServers.horsewhip`（见上 JSON）
3. 项目里链 `.cursor/skills/horsewhip`
4. Reload Window

**以后可能：** `npx @horsewhip/mcp`、插件内置 MCP、Cursor MCP 目录一键添加 — 见 [agent/mcp/README.md](./agent/mcp/README.md)。

---

## 两重鞭子（核心）

**规则：** 未圈定 → 全库不可改；已圈定 → 仅 `allowlist` 内路径可改。

| 鞭 | 精确含义 | 拦截点 |
|----|----------|--------|
| **第一重 · 挥鞭圈定** | 泳道选定节点 → 瞄准环锁定 **commit + 分支 + 路径**（或 MCP 写同一份 allowlist） | 未圈定：编辑器只读；已圈定：圈外不可改 |
| **第二重 · 写盘守门** | 监听保存（含 Agent 直写）；圈外或未圈定 → **`git` 还原** | 不等 commit；可写 `edit-blocked.json`，提示先问用户是否扩圈 |
| **兜底 · commit** | `pre-commit` + 面板提交；分支与圈定一致 | 防终端 `--no-verify` 以外绕过 |

圈定 = `allowlist.json`（机器可读）。不必再贴长约束进 Chat。  
设置：[docs/boundary-guard.md](./docs/boundary-guard.md)

**手动 vs Agent 圈地**

| | 手动挥鞭 | MCP `lock_paths` |
|--|----------|------------------|
| 写入 | 插件，`lockSource: webview` | MCP，`lockSource: mcp` |
| 泳道瞄准环 | 有（点节点） | 路径能对上节点时可能有 |
| 边界栏 / 文件轨 | 有 | 有 |
| 解锁 | 泳道空白 / 边界栏 | `unlock` 或同上 |

---

## 能做什么

| 时机 | 能力 |
|------|------|
| 圈地 | 挥鞭或 MCP lock；当前分支泳道高亮 |
| 事中 | 两重鞭守门；越界还原 |
| 事后 | 刷新泳道，看 **Cn / Vn** |
| 预览 | 节点 **检出并运行** → **恢复工作区** |

---

## Install Extension

| 方式 | 操作 |
|------|------|
| 市场 | 搜 **Horsewhip** → 安装 → 重载 |
| Release | [Releases](https://github.com/waitamomentC/horsewhip/releases) → 从 VSIX 安装 |
| 开发 | 克隆 → `npm run build:extension` → 打开 `extension/` → **F5** |

打开 **你的 Git 项目** → 活动栏 **Horsewhip**。

---

## Demo

> 视频即将发布：点选 → 挥鞭 → Agent 越界被还原 → commit → 新节点。

先按 [Quick Start](#quick-start手动--3-步) 或 [Agent 流程](#agent-完整流程cursor) 本地体验。

---

## Not GitGraph

| | GitGraph | Horsewhip |
|---|----------|-----------|
| 问题 | 分支怎么 merge | **AI 会不会改飞** |
| 横轴 | commit 时间 | **上传序 Cn** |
| 纵轴 | 分支 | **文件泳道** |

底层仍是 `git log`；界面面向改码边界，不教 Git 课。

---

## Web Demo

无插件、无守门，只看泳道：

```bash
git clone https://github.com/waitamomentC/horsewhip.git
cd horsewhip && open index.html
```

---

## Documentation

| 文档 | 内容 |
|------|------|
| [docs/user-guide.md](./docs/user-guide.md) | 手动操作 |
| [docs/boundary-guard.md](./docs/boundary-guard.md) | 守门设置 |
| [agent/README.md](./agent/README.md) | MCP + Skill |
| [agent/skills/horsewhip/SKILL.md](./agent/skills/horsewhip/SKILL.md) | Agent 工作流（英文） |
| [extension/README.md](./extension/README.md) | 插件 / 上架 |

---

## For Developers

```bash
git clone https://github.com/waitamomentC/horsewhip.git
cd horsewhip && npm install
npm run build:extension   # web → extension/media → tsc
npm run build:mcp         # agent/mcp → dist/
```

改 `src/` 或 `style.css` 后重跑 `build:extension`，**F5** 调试 `extension/`。

---

## Version

| 项 | 说明 |
|----|------|
| 插件 | `extension/package.json`（如 1.0.20+） |
| 本地 | `.git/horsewhip/` 勿提交 |

---

## 软著与国内 Git 登记（简要）

- 边界由**插件本地**执行；`.git/horsewhip/` 一般不进业务提交。
- **`git commit` / `push` 请本人在本机完成**，勿让 Agent 代提交（易出现 `Co-authored-by: Cursor` 等，与「著作权人仅为本人」材料冲突）。
- Agent 可在圈内改文件；**写入版本历史**留给人。
- 材料可用：挥鞭圈定、越界拦截、泳道截图。

---

## License

[GNU AGPL-3.0](./LICENSE)

---

<div align="center">

**[github.com/waitamomentC/horsewhip](https://github.com/waitamomentC/horsewhip)**

*两重鞭 · 圈地即守门 · 手动挥鞭或 Agent MCP*

</div>
