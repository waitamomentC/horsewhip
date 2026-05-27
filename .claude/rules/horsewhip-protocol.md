<!-- AUTO-GENERATED — edit protocol/AGENTS.md or protocol/templates/claude-rules-preamble.md, then: node protocol/scripts/sync.mjs -->

# Horsewhip · Claude Code 规则范围

本文件与项目 **`CLAUDE.md`**、**其他** `.claude/rules/*.md` **同时**加载。

## 会和别的 `CLAUDE.md` 冲突吗？

**通常不会。**

| 主题 | 听谁的 |
|------|--------|
| Git：commit / push / `feature/*` | **Horsewhip（下文 §A–§H）** |
| 文件边界、越界纠正 | **Horsewhip**（泳道贴入文案最高） |
| 构建、测试、架构、风格 | **项目 `CLAUDE.md`** |

冲突时：Git/边界 → Horsewhip；其余 → 项目 `CLAUDE.md`；并简短提醒用户。

## 给用户（维护者）

- 不要在 `CLAUDE.md` 重复 Git 铁律；用 [`CLAUDE.snippet-horsewhip.md`](./CLAUDE.snippet-horsewhip.md) 加指针即可。
- 完整条文在下方（与 `AGENTS.md` 相同）。

---

# Horsewhip AI Protocol

> **唯一权威协议**（v1.0.1，与插件 1.0.1 对齐）。安装到 **业务项目根目录** 的 `AGENTS.md` 即本文件。  
> Cursor / Copilot：根目录引用或 `@AGENTS.md`。Claude Code：另见 `.claude/rules/horsewhip-protocol.md`（§ Install）。  
> 其他 IDE 适配欢迎社区 PR；**不要** fork 第二套铁律。

---

## 这是什么（30 秒读完）

**horsewhip** 是为 **AI 协作** 设计的 **文件边界可视化**，不是 GitGraph，也不是教用户背 Git 术语的客户端。

| 你（AI）要做的 | horsewhip 帮人类看的 |
|----------------|----------------------|
| 只在边界内改文件 | 哪条泳道、哪一版、哪条实验线 |
| 用简单统一的 Git 习惯 | 时间轴上的节点与 `feature/*` 分支 |
| 每轮可验收任务 **commit**（有 origin 则 **push**） | 泳道出现新节点、云端与本地一致 |

**事前**：人类在泳道点节点 → 复制/插入 **边界约束** 到 Chat → 你严格遵守。  
**事后**（若安装了 horsewhip 插件）：对比 allowlist 与工作区改动 → 越界则纠正，**commit 可被拦截**。

---

## A. 文件边界（先读再做）

### A.1 边界从哪来

1. 用户在 horsewhip **点选泳道节点**（文件或 `文件夹/` 聚合）。
2. 顶栏出现 **本次边界**；用户 **挥鞭** 或 **插入 Chat** 的文案形如：

```text
【horsewhip · AI 文件边界】
本次任务只允许修改以下范围，不要创建/修改/删除其他任何路径：
- TA/（文件夹，含其下所有路径）
  定位：泳道 V3 · C17 · …

若必须改动其他文件，请先说明理由并等待确认后再继续。
```

3. 插件会把边界写入会话 **allowlist**（并持久化到 `.git/horsewhip/allowlist.json`，供 git hook 读取）。

### A.2 你必须遵守

| 规则 | 说明 |
|------|------|
| **只改边界内路径** | 文件路径完全匹配，或落在 `文件夹/` 前缀下 |
| **先停后扩** | 必须改边界外文件时，**先说明理由，等用户确认**，再继续 |
| **不夹带** | 不顺手重构、不改无关目录、不更新边界外依赖锁文件（除非用户明确要求） |
| **与 commit 一致** | 一次 commit 里的文件集合应落在边界内（或用户已扩边界） |

### A.3 没有划边界时

- 以用户 **当次对话描述** 为范围，仍禁止擅自扩大 scope。
- 若安装了 horsewhip 且开启 `horsewhip.guard.blockCommitWithoutBoundary`，**未划边界可能无法 commit**——应提醒用户先在泳道点节点。

---

## B. Git 铁律（每轮可验收任务结束时）

### B.1 必须 commit

完成 **一个明确、用户可验收的任务**（一个功能、一个 bug、一次融合）后，**在本轮结束前** 必须：

```bash
git add -A   # 优先只 add 边界内文件；不确定时用 git add <paths>
git commit -m "<type>: <与用户任务一致的一句话>"
```

- **禁止** 只改工作区不提交——没有 commit，horsewhip 泳道不会出现节点。
- **禁止** 空泛说明：`update`、`fix`、`wip`、`misc`。

### B.2 有 origin 则必须 push

commit 后 **立即** 检查：

```bash
git remote get-url origin 2>/dev/null
```

| 情况 | 行为 |
|------|------|
| 存在可访问的 `origin` | **必须** `git push`；新分支：`git push -u origin HEAD` |
| 无 `origin` 或用户明确说不要 push | 只 commit |
| push 失败 | **如实报告**，不得谎称已完成；本地 commit 保留 |

用户通过 horsewhip 连接 GitHub 后，默认期望 **commit + push**，以便云端时间轴（Cn）与本地一致。

### B.3 禁止绕过守门（除非用户明确要求）

- 不要用 `git commit --no-verify` 规避越界拦截，除非用户 **明确同意** 本次越界。
- 不要 force push 到 `main` / `master`，除非用户 **明确要求**。

---

## C. 分支命名（只用 `feature/*`）

### C.1 新建实验分支

为保留并行方案、待融合回主线而建的分支 **必须**：

```text
feature/<简短英文或拼音>-<可选序号>
```

✅ `feature/login-oauth` · `feature/ui-dark-v2`  
❌ `TA`、`readme-update`、`test-branch`、`mywork`

### C.2 主泳道

- 集成目标只能是 **`main`** 或 **`master`**（与仓库默认分支一致）。
- 不要在未征得同意时另造 `develop`。
- 实验在 `feature/*` 完成，**择优合并回主泳道**。

### C.3 创建分支

```bash
git checkout main          # 或 master
git pull --ff-only         # 若已有 origin
git checkout -b feature/<name>
# … 在边界内改码 → commit → push …
```

---

## D. Commit 信息规范

```text
<type>: <一句话说明用户可见结果>

可选正文：
- 改了哪些路径
- 若在 feature 上：分支名
- 若为融合：来源分支列表
```

| type | 用途 |
|------|------|
| `feat` | 新功能、新方案 |
| `fix` | 修 bug |
| `refactor` | 行为不变的重构（须在边界内） |
| `docs` | 仅文档 |
| `chore` | 构建、依赖，无用户可见行为 |
| `merge` | 多分支融合回主泳道 |

示例：

```text
feat: 登录页支持 OAuth 回调

- src/auth/oauth.ts, src/pages/Login.tsx
- 分支 feature/login-oauth
```

```text
merge: 融合 feature/ui-dark-v2 与 feature/read-cache 回 main

- 保留 dark 主题与 read 缓存
- 来源: feature/ui-dark-v2, feature/read-cache
```

---

## E. 标准工作流（与 horsewhip UI 配合）

```text
1. 用户说明任务，或在泳道选定边界节点
2. 你确认边界（或请用户在 horsewhip 点选后把约束贴入 Chat）
3. git checkout -b feature/<name>     # 新实验时
4. 仅在边界内改码
5. git commit -m "…"                  # 必须
6. git push                           # 有 origin 则必须
7. 用户刷新 horsewhip，在分支栏看到 feature/* 泳道
8. 多方案：用户多选分支 →「AI 融合 → 主泳道」→ 你把择优结果合并到 main
9. 在 main 上 merge commit（+ push）
10. 用户刷新，在主泳道继续
```

**不要** 要求用户理解 merge parent 顺序；**要** 用 `feature/*` + 清晰 commit + push，让图谱可读。

### 多分支融合任务（用户从 horsewhip 插入时）

约束文案可能包含：

```text
【horsewhip · AI 多分支融合】
目标：以下 N 条实验分支…择优融合回主泳道 main…
```

你应：在 `main` 上合并选定分支的有价值改动，解决冲突，留下 **一条清晰的 merge commit**，然后 push。

---

## F. 守门（插件 Phase 3，若已安装）

| 时机 | 作用 |
|------|------|
| 事前 | 边界约束 prompt（§A） |
| 保存 / 检查越界 | 对比 allowlist 与实际改动 |
| commit 前 | 面板提交与 **pre-commit hook** 可拦截越界 |

### F.1 commit 被拦 ≠ 可以收工

**拦截只阻止 commit 进历史，不会自动清空工作区。** 典型：锁定只改 `A`，却改了 `B` → 提交失败 → **`B` 仍留在磁盘** → 必须处理。

---

### F.2 全自动代理（默认 · 无人逐项确认时）

适用：Cursor / Claude Code **Agent 全自动**、CI 里的 coding agent、用户未在场点按钮。

**不要**在越界时停下来问「要不要还原？」——**默认就是还原**，与 horsewhip 插件默认 `revertOnCommitBlock: always` 一致。

**标准流程（必须执行）：**

1. **立即 revert 全部越界路径**（同一轮内、不要先讨论）：
   ```bash
   git checkout HEAD -- <越界文件>
   git restore --staged <越界文件>   # 若已误 add
   ```
2. **仅在边界内重想方案**，最多 **3 轮**不同思路（换实现方式、换入口文件、缩小需求等），每轮仍只改边界内路径。
3. 每轮结束尝试 `git commit`；若仍因越界失败 → 再 revert → 再重想，计入一轮。
4. **3 轮后仍无法在边界内完成用户目标** → **停止改代码**，向用户说明：
   - 已尝试的方向（简短列表）；
   - 卡在哪、为何边界内不够；
   - **必须在马鞭泳道扩大边界**（选更大文件夹 / 多选节点 / 换版本）或用户明确口头扩边界后，才能继续；
   - **禁止**保留越界改动、`git commit --no-verify`、或偷偷改 B「反正上次拦了」。

全自动模式下 **不得** 为省事扩大修改范围；扩边界只能由 **用户** 在马鞭或对话里明确授权。

---

### F.3 人在回路（可选 · 用户在场点选时）

适用：用户坐在 IDE 前，马鞭插件可弹窗。

此时可由用户点击 **「还原越界」/「插入纠正」**；你仍应遵守 §F.2 的 revert 与边界内重想，**不要**等用户帮你 revert 越界文件——agent 应主动执行 git 还原。

---

### F.4 越界纠正文案（插件 / 用户插入 Chat 时）

```text
【horsewhip · 越界纠正】
用户明确要求只修改：…
检测到额外改动：…
请立即 revert …，仅保留允许范围内的修改。
然后仅在边界内重新设计方案，不要继续改动越界路径。
```

你应：**先 revert** → **边界内重想（§F.2 最多 3 轮）** → 仍不行则 **请用户扩边界** → 再 commit。

相关设置见产品文档 [`docs/boundary-guard.md`](../docs/boundary-guard.md)。  
钩子未安装时，终端 `git commit` 不会自动拦截——提醒用户运行 **Horsewhip: Install Git Pre-Commit Guard Hook**。

---

## G. 禁止事项

| 禁止 | 原因 |
|------|------|
| 改很多却不 commit | 泳道无节点，horsewhip 失效 |
| 随意分支名 | 实验线不可读 |
| 在 `main` 上长期做大实验且不提交 | 无法并行保留 A/B/C |
| 有 origin 却不 push | 云端与本地时间轴不一致 |
| commit 混入边界外文件 | 破坏信任 |
| 用 `--no-verify` 偷偷提交越界 | 绕过守门 |
| commit 失败后不复原越界文件 | 工作区仍脏，误提交风险仍在 |
| 为完成功能坚持改边界外文件 | 应先边界内多轮重想，或请用户扩边界 |
| 全自动时问用户「要不要还原」 | 默认立即还原，不问 |
| 3 轮边界内仍失败仍硬做 | 必须停并说明需扩边界 |
| 教用户背 Git 术语才能协作 | horsewhip 面向 AI 边界，不是 Git 课 |

---

## H. 完成前自检（30 秒）

- [ ] 改动是否在边界或用户当次描述范围内？
- [ ] 是否已 `git commit`，且说明与真实改动一致？
- [ ] 若有 `origin`，是否已 `git push`？
- [ ] 新实验是否在 `feature/*` 上？
- [ ] 融合后是否在 `main`/`master` 上有清晰 merge commit？
- [ ] 若 commit 曾被越界拦截：越界文件是否 **已全部 revert**（全自动下是否未询问即还原）？
- [ ] 是否在边界内已尝试多轮重想（≤3 轮），而非改越界文件碰运气？
- [ ] 若仍无法完成：是否已 **明确请用户扩大马鞭边界**，而非 `--no-verify` 或留脏文件？

**全部勾选后** 再向用户报告「完成」。

---

## Install（人类操作一次）

### Claude Code（推荐：不覆盖已有 `CLAUDE.md`）

```bash
cd /path/to/your-project
curl -fsSL https://raw.githubusercontent.com/waitamomentC/horsewhip/main/protocol/scripts/install-claude-horsewhip.sh | bash -s -- .
```

| 情况 | 做法 |
|------|------|
| **已有 `CLAUDE.md`**（公司模板等） | 默认 **只装** `.claude/rules/horsewhip-protocol.md` + `AGENTS.md`；用 `--snippet` 在 `CLAUDE.md` 加一段指针 |
| **没有 `CLAUDE.md`** | 加 `--with-claude-md` 生成短模板 |

**会和别的 `CLAUDE.md` 冲突吗？** 一般 **不会**：Horsewhip 只管 Git 与文件边界；构建/架构仍听你的 `CLAUDE.md`。若冲突，Git/边界 **以 Horsewhip 为准**。详见 [`protocol/docs/claude-code.md`](./docs/claude-code.md)。

### 手动安装 / Cursor

```bash
BRANCH=main
curl -fsSL -o AGENTS.md \
  "https://raw.githubusercontent.com/waitamomentC/horsewhip/${BRANCH}/protocol/AGENTS.md"
```

Claude 还需将 **带优先级说明的** rules 装入 `.claude/rules/`（用上面脚本，或见 `protocol/docs/claude-code.md`）。

**验证**：`claude` 问「Git 和 CLAUDE.md 冲突听谁的？」；Cursor 用 `@AGENTS.md`。

---

## 社区扩展（非本文件范围）

| 工具 | 建议 | 维护 |
|------|------|------|
| Cursor `.mdc` rules |  `@AGENTS.md` 或 include 本文件 | 社区 |
| Windsurf / Continue | 项目 rules 指向 `AGENTS.md` | 社区 |
| 其他 IDE | 复制本文件 + 适配说明 PR | 社区 |

**不要** 在别处维护第二套铁律；有冲突以 **本文件** 为准。

---

## 附录：仅 horsewhip 产品仓库

开发 **horsewhip 本身** 时，除本协议外还可使用 `experiment/*` 等内部分支；**用户业务仓库不要学这个例外**。

产品进度与插件构建见仓库根目录 [`README.md`](../README.md)、[`CLAUDE.md`](../CLAUDE.md)。

---

*Horsewhip · AI boundary first · Simple Git habits = readable timeline*
