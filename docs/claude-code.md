# Claude Code 接入马鞭

## 为什么有些 MD 不用 `@`？

不同工具 **自动读取的文件名不同**：

| 工具 | 自动加载（无需每次 @） | 说明 |
|------|------------------------|------|
| **Claude Code** | `CLAUDE.md`、`.claude/CLAUDE.md`、`.claude/rules/*.md` | 每次 `claude` 会话启动时注入上下文 |
| **Cursor** | 常认 `AGENTS.md`、`.cursor/rules/*.mdc` | 视版本与项目设置而定 |
| **通用** | `AGENTS.md` | 需在 Rules 引用或对话 `@AGENTS.md` |

马鞭在仓库里 **两套都放了**：Claude Code 优先用本页流程；Cursor 用 [`AGENTS.md`](../AGENTS.md)。

官方说明：[Claude Code · Memory](https://code.claude.com/docs/en/memory)

---

## 在本仓库（开发 horsewhip）

已配置，直接在该目录运行 `claude` 即可：

- [`CLAUDE.md`](../CLAUDE.md) — 产品说明 + 开发命令
- [`.claude/rules/horsewhip-protocol.md`](../.claude/rules/horsewhip-protocol.md) — Git / 分支铁律

---

## 在用户业务仓库（推荐）

在 **用户自己的项目**（已 `git init`、用马鞭插件看泳道）：

### 一键安装（在项目根目录执行）

```bash
cd /path/to/your-project

mkdir -p .claude/rules

curl -fsSL -o .claude/rules/horsewhip-protocol.md \
  https://raw.githubusercontent.com/waitamomentC/horsewhip/main/.claude/rules/horsewhip-protocol.md

curl -fsSL -o CLAUDE.md \
  https://raw.githubusercontent.com/waitamomentC/horsewhip/main/docs/templates/CLAUDE.horsewhip-user.md
```

编辑 **`CLAUDE.md`** 文末，补上你们项目的构建/测试命令。

**离线 / 无 curl**：

```bash
git clone https://github.com/waitamomentC/horsewhip.git /tmp/horsewhip
mkdir -p .claude/rules
cp /tmp/horsewhip/.claude/rules/horsewhip-protocol.md .claude/rules/
cp /tmp/horsewhip/docs/templates/CLAUDE.horsewhip-user.md ./CLAUDE.md
```

若已有 `CLAUDE.md`，只复制 `horsewhip-protocol.md`，并把模板中的马鞭章节合并进现有文件。

### 3. 验证

```bash
cd your-project
claude
```

新开一次会话，让 Claude 总结「完成一次功能开发后 Git 要做什么」——应提到 **commit、push（有 origin）、feature/ 分支**。

无需再说「请遵守 AGENTS.md」。

---

## 可选：仅规则、不要根 CLAUDE.md

若项目已有很长的 `CLAUDE.md`，可 **只** 添加 `.claude/rules/horsewhip-protocol.md`。  
Claude Code 也会自动加载 `rules` 目录下所有 `.md` 文件。

---

## 与马鞭 UI 的关系

| 协议（本 MD） | 马鞭插件 |
|---------------|----------|
| 约束 AI 的 **Git 行为** | 可视化 **边界 + 分支 + 融合** |
| commit → 泳道出现节点 | 点节点 → 边界栏 |
| `feature/*` → 分支栏可读 | 多选 → AI 融合 → 主泳道 |

两者配套使用，马鞭才不会因乱分支、不提交而「变复杂」。
