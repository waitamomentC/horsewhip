# Horsewhip Agent 层

面向 Cursor / Claude Code 等 Agent 的 **Skills + MCP**，与 VS Code/Cursor 插件（泳道可视化 + 守门）配合成完整版马鞭。

| 目录 | 内容 | 状态 |
|------|------|------|
| [`skills/horsewhip/`](./skills/horsewhip/) | Agent Skill：工作流、挥鞭仪式、禁止项 | 可用 |
| [`mcp/`](./mcp/) | MCP Server：lock / unlock / expand / whip / task_complete | Phase 4A |

## 安装 Skill（Cursor）

将本目录下的 skill 链到项目或用户 skills 目录，例如：

```bash
# 项目内（推荐，随仓库分发）
mkdir -p .cursor/skills
ln -sf ../../agent/skills/horsewhip .cursor/skills/horsewhip
```

或复制 `agent/skills/horsewhip/` 到 `~/.cursor/skills/horsewhip`。

## 配置 MCP

见 [`mcp/README.md`](./mcp/README.md)（含 `mcpServers` 配置示例）。

## 与插件的关系

- **仅 Agent 层**：可读写 `.git/horsewhip/allowlist.json`，无泳道 UI。
- **完整版**：安装 [Horsewhip 扩展](../extension/README.md) 后，MCP `lock_paths` 须在面板中可见锁定路径，并播放鞭声（lock / task_complete 各一次）。

守门与 allowlist 格式见 [docs/boundary-guard.md](../docs/boundary-guard.md)。
