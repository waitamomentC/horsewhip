# Horsewhip Agent 层

**Skills + MCP**，配合 [Horsewhip 扩展](../extension/README.md)（泳道 + 两重鞭守门）。

| 目录 | 内容 |
|------|------|
| [`skills/horsewhip/`](./skills/horsewhip/) | Agent Skill（英文工作流） |
| [`mcp/`](./mcp/) | MCP Server（7 个工具） |

## 快速安装（推荐）

1. 安装 **Horsewhip** VS Code 扩展（Marketplace）
2. 打开 Git 项目 → 命令面板 → **Horsewhip: 配置 Agent（MCP + Skill）**
3. 重载窗口；Claude Code 见 [docs/claude-code.md](../docs/claude-code.md)

> **legacy**：在本仓库 `npm run build:extension` 后 `npm run setup:agent -- --project . --from-extension ./extension`（见 [docs/trust-model.md §8](../docs/trust-model.md#8-mcp-分发已知弱点与目标形态)）。

在 horsewhip 仓库根目录：

```bash
npm run setup:agent -- --project /path/to/your-git-app
```

或在业务项目里：

```bash
node /path/to/horsewhip/scripts/setup-cursor-agent.mjs --project .
```

然后：

- **Cursor / Vibecode**：装 Horsewhip 插件 → 重载 → MCP 里启用 `horsewhip`
- **Claude Code**：见 [docs/claude-code.md](../docs/claude-code.md)（用项目根 **`.mcp.json`**，不是 `.claude/mcp.json`）

选项：`--copy-skill` · `--rebuild` · `--use-npx` · `--global-mcp` · `--global-claude`

详见根目录 [README.md § 快速安装](../README.md#快速安装完整版--cursor)。

## 手动

见 [mcp/README.md](./mcp/README.md) 与根 README [Agent 手动安装](../README.md#agent-手动安装)。

## 与插件

| 组合 | 面板 / 鞭声 | 守门 |
|------|-------------|------|
| 仅 MCP + Skill | 无 | allowlist + hook |
| 完整版 + 插件 | 有 | 同上 + 写盘还原 |

allowlist 格式：[docs/boundary-guard.md](../docs/boundary-guard.md)  
信任模型（MCP 非沙箱）：[docs/trust-model.md](../docs/trust-model.md)
