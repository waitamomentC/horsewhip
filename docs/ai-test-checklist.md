# Horsewhip · AI 自测清单（Phase 4A）

> **用途**：由 **Vibecode / Cursor Agent** 在**用户的业务 Git 项目**里先跑一轮；你再用 [acceptance-checklist.md](./acceptance-checklist.md) 做 UI/听感/手感验收。  
> **不要**在 horsewhip **产品源码仓**里跑本清单（避免污染产品 Git）。

---

## 0. 开始前（向用户确认）

Agent 先问清或从上下文读取：

| 项 | 需要 |
|----|------|
| 业务项目路径 | `PROJECT_ROOT`（已 `git init`，≥1 commit） |
| horsewhip 克隆路径 | `HORSEWHIP_ROOT`（含 `agent/mcp`） |
| 是否完整版 | VS Code 已装 **Horsewhip 扩展** 且已打开 `PROJECT_ROOT` |
| MCP | Vibecode：`.cursor/mcp.json`；Claude Code：**`.mcp.json`**（见 [claude-code.md](./claude-code.md)） |

若未配置 MCP/Skill，在 `HORSEWHIP_ROOT` 执行：

```bash
npm run setup:agent -- --project "$PROJECT_ROOT"
```

然后请用户 **重载窗口**，并确认 MCP 已连接。

---

## 1. 环境预检（Agent 可自动）

在 `PROJECT_ROOT` 执行并记录输出：

| # | 检查 | 命令 / 操作 | 期望 |
|---|------|-------------|------|
| 1.1 | Git 仓库 | `test -f .git/HEAD && git rev-parse --show-toplevel` | 成功，toplevel = `PROJECT_ROOT` |
| 1.2 | MCP 配置 | Cursor：`cat .cursor/mcp.json`；Claude：`cat .mcp.json` | 含 `horsewhip`；Claude 侧 `env` 为 `${CLAUDE_PROJECT_DIR}`，建议 `alwaysLoad: true` |
| 1.3 | Skill | Cursor：`.cursor/skills/horsewhip/SKILL.md`；Claude：`.claude/skills/horsewhip/SKILL.md` | 存在 |
| 1.4 | MCP 构建产物 | `test -f "$HORSEWHIP_ROOT/agent/mcp/dist/index.js"` | 存在 |
| 1.5 | 插件数据目录 | `ls -la .git/horsewhip/` 2>/dev/null | 扩展打开后可有 `boundary-notes.md` 等（可选） |

**通过标准**：1.1、1.2、1.4 必须过；1.3 完整版 Agent 纪律需要；1.5 仅完整版期望。

---

## 2. MCP 工具往返（Agent 按序调用）

在**新对话**中严格按 [agent/skills/horsewhip/SKILL.md](../agent/skills/horsewhip/SKILL.md) 执行。  
测试用路径（按项目改）：`TEST_FILE=README.md` 或 `src/…` 中一个**已存在**的小文件；**禁止**改 horsewhip 产品仓。

### 2.1 锁定

| # | 工具 | 参数要点 | 期望 |
|---|------|----------|------|
| 2.1 | `horsewhip_lock_paths` | `paths: [TEST_FILE]` | 返回 `ok: true`, `locked: true` |
| 2.2 | 磁盘 | 读 `.git/horsewhip/allowlist.json` | `locked: true`，`allowed` 含 `TEST_FILE`，`lockSource` 含 `mcp` |
| 2.3 | `horsewhip_whip_ceremony` | `phase: "lock"` | 成功；`.git/horsewhip/mcp-signal.json` 更新 |

### 2.2 读回

| # | 工具 | 期望 |
|---|------|------|
| 2.4 | `horsewhip_get_boundary` | 与 `allowlist.json` 一致；`locked: true` |
| 2.5 | `horsewhip_suggest_scope` | 返回占位说明（4B 未实现），**不**当作自动圈地 |

### 2.3 圈内编辑（Agent）

| # | 操作 | 期望 |
|---|------|------|
| 2.6 | 仅修改 `TEST_FILE`（加一行注释 `# horsewhip-ai-test`） | 保存成功，无 `edit-blocked.json`（或很快清除） |
| 2.7 | `git status` | 仅 `TEST_FILE` 在改动列表（或用户允许的测试文件） |

### 2.4 圈外探测（Agent）

| # | 操作 | 期望（记录实际行为） |
|---|------|----------------------|
| 2.8 | 故意修改 **不在 allowlist** 的另一文件并保存 | **完整版+已锁定**：写盘被还原或出现守门提示 / `edit-blocked.json` |
| 2.9 | 未调用 `expand_boundary` 前 | **不得**静默改圈外文件 |

> 若 2.8 未拦截：在报告中写明「当前未锁定 / guard 关闭 / 仅 commit 兜底」——供人工对照 [boundary-guard.md](./boundary-guard.md)。

### 2.5 扩大边界（须模拟用户同意）

| # | 步骤 | 期望 |
|---|------|------|
| 2.10 | 向用户说明需扩大范围，**等待明确同意**（测试可用文字「同意扩大」） | 未同意前不调 `expand_boundary` |
| 2.11 | `horsewhip_expand_boundary` | `allowed` 合并新路径 |
| 2.12 | `horsewhip_whip_ceremony` `phase: "expand"` | 成功（完整版应有第二段仪式信号） |

### 2.6 收工与解锁

| # | 工具 | 期望 |
|---|------|------|
| 2.13 | `horsewhip_task_complete` | `summary` 一行；`mcp-signal.json` 类型为 task 完成 |
| 2.14 | **不要**替用户 `git commit` / `push` | 仅提醒用户本人提交 |
| 2.15 | `horsewhip_unlock` | `locked: false`，allowlist 清空或解锁 |
| 2.16 | `horsewhip_get_boundary` | `locked: false` |

### 2.7 Skill 纪律（Agent 自检）

| # | 禁止项 | 本轮是否遵守 |
|---|--------|--------------|
| 2.17 | 未 `lock_paths` 就批量改文件 | ☐ 是 |
| 2.18 | 跳过 `whip_ceremony` / `task_complete` | ☐ 是 |
| 2.19 | 未经用户同意 `expand_boundary` | ☐ 是 |
| 2.20 | `git commit --no-verify` | ☐ 是 |

---

## 3. 完整版 · 插件联动（Agent 部分可证 + 请人眼确认）

Agent 在 2.1–2.3 期间请用户同时看 VS Code 侧栏 Horsewhip，并填写：

| # | 项 | Agent 可验证 | 用户眼/耳确认 |
|---|-----|--------------|---------------|
| 3.1 | `lock_paths` 后面板边界栏显示路径 | 可读 `allowlist` 与 MCP 一致 | ☐ 看见路径 |
| 3.2 | `whip_ceremony` lock | `mcp-signal.json` 有记录 | ☐ **第一声鞭** |
| 3.3 | `task_complete` | 同上 | ☐ **第二声鞭** + 提示 |
| 3.4 | 文件轨/节点高亮与 allowlist 一致 | — | ☐ |
| 3.5 | MCP 锁定后 UI 显示「MCP 已锁定」类状态（若有） | — | ☐ |

---

## 4. 守门与 Git（Agent + 用户）

| # | 项 | 执行者 | 期望 |
|---|-----|--------|------|
| 4.1 | 安装 pre-commit 钩子 | 用户运行命令或 Agent 提示：`Horsewhip: 安装 Git Pre-Commit 守门钩子` | `.git/hooks/pre-commit` 存在 |
| 4.2 | 锁定后仅改圈外 → `git commit` | Agent 提示用户在本机终端试 | 提交被拒绝 |
| 4.3 | 面板「检查边界」 | 用户点顶栏 | 状态与 `git status` 一致 |
| 4.4 | 测试结束 | Agent | `git checkout -- .` 或 revert 测试改动，可选 `unlock` |

---

## 5. AI 测试报告（Agent 必须输出）

跑完后，在对话里贴以下表格（可复制）：

```markdown
## Horsewhip AI 自测报告

- 项目：`<PROJECT_ROOT>`
- 日期：
- 完整版（插件）：是 / 否
- MCP 连接：是 / 否

| 章节 | 通过 | 备注 |
|------|------|------|
| 1 环境预检 | ☐ | |
| 2 MCP 往返 | ☐ | |
| 2.8 圈外写盘 | ☐ 拦截 / ☐ 未拦截 | |
| 3 插件联动 | ☐ / N/A | |
| 4 守门 | ☐ / 未测 | |
| 2.17–2.20 Skill | ☐ | |

### 产物路径
- allowlist: `.git/horsewhip/allowlist.json`（粘贴末次内容摘要）
- signal: `.git/horsewhip/mcp-signal.json`（末次 type）

### 失败项
1.
2.

### 交给人工验收
请用户打开 [acceptance-checklist.md](./acceptance-checklist.md)，重点勾 §1–§2、§5。
```

---

## 6. 人工第二轮（你来做）

AI 跑完后，你只补这些（AI 测不准或测不了）：

1. [acceptance-checklist.md](./acceptance-checklist.md) **§1 能看** — 泳道、缩放、刷新  
2. **§2 能划界** — 挥鞭、插入对话、constraint 文案  
3. **§3 协议** — 新开一轮真实小需求，看 AI 是否守界  
4. **§4 版本预览** — 检出 / 恢复工作区（若你用）  
5. **鞭声与中文 UI** — 两声鞭、toast 是否为中文  

---

## 7. 一键提示词（复制给 Agent）

```
在 PROJECT_ROOT=<你的业务项目> 按 docs/ai-test-checklist.md 跑完整 Phase 4A 自测：
先环境预检，再按 Skill 顺序调用 horsewhip_* MCP 工具，做圈内/圈外写盘探测，
最后输出 §5 报告表格。不要 git commit。测试改动请 revert。
完整版请提醒我同时看侧栏边界栏与听鞭声。
```

---

*horsewhip · AI 先测 · 人工复验 · 对应 acceptance-checklist + Phase 4A*
