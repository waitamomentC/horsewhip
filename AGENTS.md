# 马鞭协作协议 · Horsewhip AI Protocol

> **受众**：Cursor、Copilot、Claude Code 等 vibe coding 工具。  
> **目的**：让 Git 记录与马鞭时间轴一致，避免分支命名混乱导致马鞭难读、难融合。  
> **原则**：马鞭是 **AI 边界可视化**，不是 Git 专家工具——你用 **简单、统一的 Git 习惯** 喂给它，它才能直观。

### 各工具怎么「自动读到」本协议（不必每次 @）

| 工具 | 放什么文件 | 要不要对话里 @ |
|------|------------|----------------|
| **Claude Code** | [`CLAUDE.md`](./CLAUDE.md) + [`.claude/rules/horsewhip-protocol.md`](./.claude/rules/horsewhip-protocol.md) | **不要**，会话启动自动加载 |
| **Cursor** | 本文件 `AGENTS.md` 或 Rules 里引用 | 建议在 Rules 固定引用，或 `@AGENTS.md` |
| **用户业务仓库** | 复制规则 + 模板，见 [`docs/claude-code.md`](./docs/claude-code.md) | Claude Code：**不用** |

---

## 0. 你现在处于哪一步（项目进度）

| 阶段 | 状态 | 说明 |
|------|------|------|
| Phase 1 网页 MVP | ✅ | demo / 粘贴 log、泳道、边界复制 |
| Phase 2 插件 | 🔄 进行中 | 自动读 log、分支栏、`feature/*` 实验线、多选 **AI 融合 → 主泳道**、边界插入 Chat、allowlist |
| Phase 3 守门 | ⬜ | 事后 diff 越界检测、纠正 prompt |
| **本协议** | ✅ 生效 | 约束 **AI 写代码时的 Git 行为**，与马鞭 UI 配套 |

- **Claude Code 用户**：按 [`docs/claude-code.md`](./docs/claude-code.md) 复制 `CLAUDE.md` 与 `.claude/rules/`（无需 `@`）。  
- **Cursor 用户**：在 Rules 引用本 `AGENTS.md`，或对话 `@AGENTS.md`。

---

## 1. 铁律（每次任务结束必做）

### 1.1 必须 commit

- **每完成一轮用户可验收的修改**（一个明确任务、一个 bug、一次融合），在当次工作结束前 **必须** 创建一次 Git commit。
- **禁止** 只在工作区留改动不提交——马鞭时间轴依赖 commit 才能在泳道上出现新节点。
- commit 说明 **必须反映用户实际改了什么**（见 §3），不要写 `update`、`fix`、`wip` 等空泛信息。

```bash
git add -A   # 或仅 add 边界内的文件（见马鞭「本次边界」）
git commit -m "<类型>: <简短说明 — 与用户任务一致>"
```

### 1.2 有云端仓库则必须 push

在 commit 之后 **立即检查** 是否已配置远程：

```bash
git remote get-url origin 2>/dev/null
```

| 情况 | 行为 |
|------|------|
| **存在 `origin` 且可访问**（用户已配置 SSH/HTTPS 云端仓库） | **必须** `git push`（当前分支）；若首次推送该分支：`git push -u origin HEAD` |
| 无 `origin` 或用户明确说「不要 push」 | 只 commit，不 push |
| push 失败 | 向用户报告错误，**不要** 假装已完成；已 commit 的保留本地 |

> 用户用马鞭「发布 / 连接 GitHub」后，默认视为希望 **commit + push** 形成云端上传序（Cn），便于多端查看。

### 1.3 先边界，后改码

- 若用户在马鞭中划定了 **本次边界** 或插入了 Chat 约束，**只允许修改边界内路径**。
- 未给边界时，改动范围仍应与用户当次描述一致；不得借机重构无关目录。

---

## 2. 分支命名（统一 `feature/`，降低马鞭复杂度）

### 2.1 新建实验分支

**所有** 为保留方案、并行尝试、待融合回主线而创建的分支，必须使用：

```text
feature/<简短英文或拼音>-<可选序号>
```

示例（推荐）：

- `feature/login-oauth`
- `feature/ui-dark-v2`
- `feature/read-cache`

**禁止** 使用无规则名称，例如：`TA`、`TA-only-test`、`readme-update`、`test-branch`、`mywork`。  
这些名字在马鞭分支栏里难以一眼识别，多分支融合时也容易搞混。

### 2.2 主泳道

- 集成分支固定为 **`main`** 或 **`master`**（与仓库已有默认分支一致，不要另造 `develop` 除非用户明确要求）。
- **融合目标永远是主泳道**；实验在 `feature/*` 上完成，择优合并回 `main`。

### 2.3 马鞭仓库自身的例外

本仓库（horsewhip 产品）可能存在 `experiment/*` 等内部开发分支，**仅用于马鞭产品开发**，不作为用户项目的范例。  
**用户项目** 上 AI 仍应只用 `feature/*` + `main`/`master`。

### 2.4 创建分支命令

```bash
git checkout main          # 或 master
git pull --ff-only         # 若已有 origin
git checkout -b feature/<name>
# … 修改、commit、push …
```

---

## 3. Commit 信息规范

格式（与内容语言可与用户一致，中文/英文均可）：

```text
<type>: <一句话说明用户可见结果>

可选正文：改了哪些文件/模块；若跨 feature 融合，写明来源分支。
```

| type | 用途 |
|------|------|
| `feat` | 新功能、新方案 |
| `fix` | 修 bug |
| `refactor` | 行为不变的重构（须在边界内） |
| `docs` | 仅文档 |
| `chore` | 构建、依赖、无用户可见行为 |
| `merge` | 融合多分支回主泳道 |

示例：

```text
feat: 登录页支持 OAuth 回调

- 修改 src/auth/oauth.ts, src/pages/Login.tsx
- 分支 feature/login-oauth
```

```text
merge: 融合 feature/ui-dark-v2 与 feature/read-cache 回 main

- 保留 dark 主题与 read 缓存逻辑
- 来源分支: feature/ui-dark-v2, feature/read-cache
```

**Commit 内容** = 用户当次要求下的真实文件变更，不要夹带边界外文件。

---

## 4. 与马鞭 UI 配合的标准流程

```text
1. 用户在主泳道 / 或说明任务
2. AI 确认边界（马鞭选中节点 → 插入 Chat 的约束）
3. git checkout -b feature/<name>   # 新实验
4. 在边界内改码
5. git commit -m "…"               # 必须
6. git push                        # 有 origin 则必须
7. 用户在马鞭分支栏看到 feature/* 泳道
8. 多方案保留 → 用户多选分支 →「AI 融合 → 主泳道」
9. AI 在 main 上择优合并，再 commit（+ push）
10. 用户刷新马鞭，在主泳道继续观察
```

**不要** 要求用户理解 merge commit 的 parent 顺序；**要** 用 `feature/*` + 清晰 commit + push，让马鞭图谱可读。

---

## 5. 禁止事项（避免马鞭「变复杂」）

| 禁止 | 原因 |
|------|------|
| 改了一大堆却不 commit | 泳道无节点，马鞭失效 |
| 乱建分支名 | 分支栏无法扫一眼识别实验 |
| 在 `main` 上直接做大量实验且不提交 | 无法并行保留 A/B/C |
| 有 origin 却不 push | 云端与本地时间轴不一致 |
| 一次 commit 混入边界外文件 | 破坏 AI 边界信任 |
| 教用户背 Git 术语才能用马鞭 | 马鞭面向 AI 边界，不是 Git 课 |

---

## 6. 自检清单（任务结束前 30 秒）

- [ ] 改动是否在边界 / 用户描述范围内？
- [ ] 是否已 `git commit`，且说明与改动一致？
- [ ] 若有 `origin`，是否已 `git push`？
- [ ] 实验是否在 `feature/*` 上（而非随意分支名）？
- [ ] 若已融合，是否在 `main` 上留下清晰的 merge commit？

全部勾选后，再向用户报告「完成」。

---

## 7. 引用方式

- **Cursor**：项目 Rules 或对话中 `@AGENTS.md`
- **其他工具**：将本文件路径加入系统提示 / 项目说明
- **人类用户**：见根目录 [`README.md`](./README.md) 产品定位

*马鞭 · 为 AI 协作而生 · 简单 Git 习惯 = 清晰边界时间轴*
