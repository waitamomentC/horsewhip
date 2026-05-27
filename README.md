# Horsewhip

> **For that horse that keeps trampling your codebase**  
> **不是 Git 图，是 AI 改代码前的边界尺。**

horsewhip 是为 **AI 协作** 而生的可视化方案：帮你在动手前看清「哪条文件泳道、哪一版、哪条实验线」，用 **挥鞭** 划定允许修改的范围，再把多条实验 **收束回主泳道**。  
Git 只负责记录版本；horsewhip 不负责教你 merge，也不和 GitGraph 比谁更「专业」。

**仓库**：<https://github.com/waitamomentC/horsewhip>

![screenshot placeholder](./docs/screenshot.png)

---

## 我们解决什么问题

在 Cursor / Copilot 等环境里，常见情况是：

- 你只想让 AI 改 `A`，它却动了 `B`、`C`
- 你在分支上试了多个方案，都想 **先留着**，再 **择优融回主线**
- 你需要一句可复制的约束：`只允许修改：…`，而不是自己写小作文

horsewhip 做三件事：

| 时机 | horsewhip 做什么 |
|------|------------|
| **事前** | 在时间轴上选节点 / 选分支 → 生成 **文件边界约束** → 插入 Chat |
| **并行实验** | 分支栏保留 A/B/C → 多选 → **AI 融合 → 主泳道** 任务文案 |
| **事后观察** | 融合 commit 后刷新，在主泳道继续看各文件 **第几版（Vn）**、**第几次上传（Cn）** |

---

## horsewhip ≠ GitGraph ≠ 传统 Git 客户端

| | GitGraph / 传统 Git 可视化 | horsewhip |
|---|---------------------------|------|
| **核心问题** | 仓库拓扑、分支怎么合 | **AI 会不会改飞、改出界** |
| **横轴** | commit / 时间线 | **上传序 Cn**（一次提交 = 一列） |
| **纵轴** | 分支线 | **文件 / 文件夹泳道** + 分支栏 |
| **用户要懂** | DAG、merge、parent | **「只动这些路径、这些版本」** |
| **气质** | 专业、冷静 | **直观 + 挥鞭仪式感（划定边界）** |

**刻意降低 Git 专业性**：界面不说 octopus merge，而说 **实验线、主泳道、融合收束**。底层仍用 `git log`，但你不必成为 Git 专家才能用。

---

## 用户操作指南（按顺序做）

> 在 Git 里打开本 README 即可照着做；协议与插件配套使用效果最佳。

### 0. 准备

| 检查项 | 操作 |
|--------|------|
| 项目是 Git 仓库 | 项目根目录执行 `git init`（若尚未初始化） |
| 至少有一次 commit | 否则泳道为空；可在 horsewhip 面板引导首次提交 |
| IDE | VS Code 或 Cursor + Horsewhip 插件（见下文「快速开始」） |

---

### 1. 在你的项目里安装 AI 协议（必做，一次即可）

让 Claude / Cursor **自动** commit、push、只用 `feature/*`、遵守文件边界。

**Claude Code（推荐，不覆盖已有 `CLAUDE.md`）**

```bash
cd /path/to/your-project    # 你的业务仓库根目录，不是 horsewhip 仓库

curl -fsSL https://raw.githubusercontent.com/waitamomentC/horsewhip/main/protocol/scripts/install-claude-horsewhip.sh | bash -s -- .
```

| 安装结果 | 位置 |
|----------|------|
| 协议正文 | `AGENTS.md` |
| Claude 自动加载 | `.claude/rules/horsewhip-protocol.md` |

- **已有公司 / 开源 `CLAUDE.md`**：上面命令 **不会覆盖**；再加指针：  
  `curl -fsSL …/install-claude-horsewhip.sh | bash -s -- . --snippet`（复制输出贴进 `CLAUDE.md` 靠前位置）
- **全新项目、还没有 `CLAUDE.md`**：  
  `…/install-claude-horsewhip.sh | bash -s -- . --with-claude-md`，再编辑 `CLAUDE.md` 补构建命令

**Cursor / 其他工具**

```bash
cd /path/to/your-project
curl -fsSL -o AGENTS.md \
  "https://raw.githubusercontent.com/waitamomentC/horsewhip/main/protocol/AGENTS.md"
```

在 Cursor **Rules** 固定引用 `@AGENTS.md`，或对话里 `@AGENTS.md`。

**验证（新开 AI 会话问一句）**

> 做完一轮功能后，Git 和文件边界上要做什么？

应提到：**必须 commit**、有 **origin 则 push**、新分支仅 **`feature/*`**、只改 **horsewhip 划定的边界**。

冲突说明：[protocol/docs/claude-code.md](./protocol/docs/claude-code.md)

---

### 2. 打开 horsewhip 看泳道

| 方式 | 操作 |
|------|------|
| **插件（推荐）** | 用 VS Code/Cursor 打开 **你的项目文件夹** → 左侧活动栏 **Horsewhip** 图标 |
| **网页体验** | 克隆 horsewhip 后 `open index.html`，粘贴 [下方 git log](#网页版) 或点 demo |

首次打开若提示无 Git：在项目根 `git init` 并做首次 commit。

---

### 3. 划边界 → 让 AI 只改指定范围

```
点泳道上的节点（文件或 TA/ 这类文件夹）
    → 节点高亮 = 已加入「本次边界」
    → 点「挥鞭」：复制约束文案
    → 或「插入 Chat」：直接送进 Cursor/Claude 对话
```

约束示例（会出现在剪贴板 / Chat）：

```text
【horsewhip · AI 文件边界】
本次任务只允许修改以下范围…
- TA/（文件夹，含其下所有路径）
禁止修改上述范围以外的文件。
```

**插件额外能力**：边界同步为 **allowlist**；保存或 commit 时可 **拦截越界**（见下节）。

---

### 4. 让 AI 改代码 → 你或 AI 提交 Git

在 AI 对话里粘贴边界后改码。每完成 **一轮可验收任务**，在终端或 horsewhip 面板：

```bash
git add <边界内的文件>    # 或 git add -A（确认无越界）
git commit -m "feat: 与用户任务一致的一句话"
git remote get-url origin 2>/dev/null && git push
# 新分支首次 push：git push -u origin HEAD
```

| 规则 | 说明 |
|------|------|
| 实验分支名 | 只用 `feature/简短描述`，例如 `feature/login-oauth` |
| 融合目标 | `main` 或 `master` |
| 禁止 | 长期不 commit；有 origin 不 push；`git commit --no-verify` 绕过守门（除非明确同意） |

完整条文：[protocol/AGENTS.md](./protocol/AGENTS.md)

---

### 5. 守门：改完后检查是否越界（插件）

| 操作 | 说明 |
|------|------|
| 已点选边界节点 | allowlist 写入 `.git/horsewhip/allowlist.json`（本地，不进版本库） |
| 顶栏 **检查越界** | 对比 allowlist 与当前工作区改动 |
| **插入纠正到 Chat** | 让 AI revert 越界文件 |
| **还原越界文件** | 一键 `git checkout` 越界路径 |
| 终端 `git commit` | 默认安装 **pre-commit** 钩子，越界会拒绝提交 |

**重要**：钩子只挡 commit，**不会自动改回越界文件**。例如锁定 `A` 却改了 `B` → 提交失败时 **`B` 仍在工作区**。  
应让 AI（见 [protocol/AGENTS.md](./protocol/AGENTS.md) §F.2）：**默认立即 revert 越界**（全自动不问）→ **边界内最多 3 轮重想** → 仍不行则 **请用户在泳道扩大边界**。

未装钩子时：命令面板 → **Horsewhip: Install Git Pre-Commit Guard Hook**

设置说明：[docs/boundary-guard.md](./docs/boundary-guard.md)

---

### 6. 多分支实验 → 融合回主泳道（可选）

```
git checkout -b feature/方案-a    # 在边界内改码 → commit → push
# 再开 feature/方案-b …
```

在 horsewhip **分支栏** 勾选 ≥2 条实验分支（不含 main）→ **AI 融合 → 主泳道** → 把生成文案贴进 Chat → AI 在 `main` 上择优合并 → **commit + push** → 插件里 **刷新 Git 记录**，在主泳道看新节点。

---

### 7. 日常 checklist（给 AI 也适用）

- [ ] 已在泳道划定边界（或对话里说明范围）
- [ ] 只改了边界内文件
- [ ] 已 `git commit`，说明与改动一致
- [ ] 有 `origin` 则已 `git push`
- [ ] 新实验在 `feature/*` 上
- [ ] 越界检查通过（若启用守门）

---

## 典型工作流（一览）

```
安装协议 → 打开 horsewhip → 点节点划边界 → 挥鞭/插入 Chat
    → AI 在边界内改码 → commit（+ push）→ 刷新泳道看新节点
    → 可选：多 feature 分支 → 融合回 main
```

**插件**：allowlist + 守门 + 自动读 git。  
**网页版**：粘贴 log / demo，无 allowlist、无自动读盘。

协议包：[protocol/](./protocol/) · 正文 [protocol/AGENTS.md](./protocol/AGENTS.md)

---

## 快速开始（安装 horsewhip 本身）

### 安装插件（终端用户）

从 [Releases](https://github.com/waitamomentC/horsewhip/releases) 安装 `.vsix`，或在扩展市场搜索 **Horsewhip**（若已发布）。  
然后：**文件 → 打开文件夹**（你的 git 项目）→ 活动栏 **Horsewhip**。

### 安装插件（本仓库开发者）

```bash
cd extension && npm install && npm run sync-assets && npm run compile
```

VS Code / Cursor 打开 `extension/` → **F5** → 新窗口打开 **你的 git 项目** → 点 **Horsewhip** 图标。

详见 [`extension/README.md`](./extension/README.md)。

| 面板操作 | 说明 |
|----------|------|
| 点泳道节点 | 加入「本次边界」 |
| 挥鞭 | 复制约束（音效见 [`media/README.md`](./media/README.md)） |
| 插入 Chat | 边界约束送进 AI |
| 检查越界 / 还原 / 插入纠正 | Phase 3 守门 |
| 提交 | 面板内 commit（受守门约束） |
| 刷新 Git 记录 | 拉最新 log，泳道更新 |

### 网页版

```bash
open index.html
# 或 python3 -m http.server 8080
```

1. **demo** 或粘贴 log → **generate**
2. 交互与插件一致（无 allowlist / 无自动读 git）

**Git log 格式**（网页粘贴用）：

```bash
git log --all -200 --name-only --pretty=format:"%H|%P|%D|%an|%ad|%s"
```

---

## 视觉模型（直觉优先）

- **横轴 Cn**：全仓库第几次上传（commit），右端更新
- **纵轴**：文件夹 / 文件泳道；**⎇** 行 = 某条实验分支触及的路径
- **泳道 Vn**（每文件夹独立版本）：该文件夹自己的第几版，仅在它被改动时 +1
- **挥鞭 / 扫光**：划定边界、发起融合时的反馈，不是装饰

设计规范：[`DESIGN.md`](./DESIGN.md)

---

## 产品边界（我们刻意不做的）

- ❌ 全仓库 DAG 炫技、替代 Git Graph / GitLens
- ❌ 面向 Git 专家的 merge 编辑器教学
- ✅ AI 边界可视化 + 约束生成 + 多分支收束叙事
- ✅ 本地 git 只作数据源（log、checkout、allowlist）

---

## 版本与分支

| 项 | 说明 |
|----|------|
| **默认分支** | **`main`**（`experiment/per-folder-version` 已合并进来） |
| 插件版本 | `extension/package.json`，当前 **0.8.0**（正式版目标 **1.0.0**；打包时 patch 递增：`0.8.1`、`0.8.2` …） |
| 协议 | [protocol/AGENTS.md](./protocol/AGENTS.md) v0.7 · 安装 URL 用 `main` |

---

## 开发索引

| 文件 | 说明 |
|------|------|
| [`CLAUDE.md`](./CLAUDE.md) | **Claude Code 自动读**（无需 @） |
| [`protocol/`](./protocol/) | AI 协议包（`AGENTS.md`、Claude 安装、模板） |
| [`protocol/docs/claude-code.md`](./protocol/docs/claude-code.md) | Claude 安装与冲突说明 |
| [`AGENTS.md`](./AGENTS.md) | 协议同步副本（Cursor `@AGENTS.md`） |
| [`plan.md`](./plan.md) | 三期产品计划（AI 边界为核心） |
| [`work-log.md`](./work-log.md) | 进度 |
| [`ui-plan.md`](./ui-plan.md) | UI 规格历史 |
| [`DESIGN.md`](./DESIGN.md) | 设计规范 |
| `script.js` / `style.css` | 网页与插件 Webview 逻辑（改后 `npm run sync-assets`） |
| [`extension/`](./extension/) | VS Code / Cursor 插件 |

**当前阶段**：Phase 2 插件 — 边界栏、分支栏、多分支融合任务、allowlist；向「AI 边界成品」迭代。

---

## 许可证

[GNU AGPL-3.0](./LICENSE)

*最后更新：2026-05-27 · `main` 已包含 per-folder Vn、protocol、守门 · [用户操作指南](#用户操作指南按顺序做)*
