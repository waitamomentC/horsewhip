# Horsewhip Agent 层

**Skills + MCP**，配合 [Horsewhip 扩展](../extension/README.md)（泳道 + 两重鞭守门）。

| 目录 | 内容 |
|------|------|
| [`skills/horsewhip/`](./skills/horsewhip/) | Agent Skill（英文工作流） |
| [`mcp/`](./mcp/) | MCP Server（7 个工具） |

## 快速安装（推荐）

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
