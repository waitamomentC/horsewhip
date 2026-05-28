# Horsewhip MCP Server

Agent 程序化圈地；与插件共用 `.git/horsewhip/allowlist.json`。

## 快速安装

**不要手抄 JSON** — 在 horsewhip 根目录：

```bash
npm run setup:agent -- --project /path/to/your-app
```

会 build 本包、写入目标项目的 `.cursor/mcp.json`、链接 Skill。

## 工具

| 工具 | 说明 |
|------|------|
| `horsewhip_lock_paths` | 锁定路径 → allowlist |
| `horsewhip_unlock` | 清空 |
| `horsewhip_get_boundary` | 读 allowlist + edit-blocked |
| `horsewhip_expand_boundary` | 合并路径（须已 locked） |
| `horsewhip_suggest_scope` | 占位（4B） |
| `horsewhip_whip_ceremony` | 鞭声 + UI（lock / expand） |
| `horsewhip_task_complete` | 收工鞭声 |

## 本地开发

```bash
npm install
npm run build
npm start   # stdio MCP
```

## Cursor 配置（手动时）

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

## npx（npm 发布后）

```json
{
  "mcpServers": {
    "horsewhip": {
      "command": "npx",
      "args": ["-y", "@horsewhip/mcp-server"],
      "env": { "HORSEWHIP_WORKSPACE": "${workspaceFolder}" }
    }
  }
}
```

或：`npm run setup:agent -- --project . --use-npx`

## 发布到 npm（维护者）

```bash
cd agent/mcp
npm run build
npm publish --access public
```

包名：`@horsewhip/mcp-server`

## 与插件

MCP 写 `allowlist.json` / `mcp-signal.json` → 扩展 `boundaryMcpBridge` 监听 → 边界栏 + 鞭声 + 守门。
