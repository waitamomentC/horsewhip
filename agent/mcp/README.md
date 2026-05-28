# Horsewhip MCP Server

Phase 4A：为 Agent 提供程序化圈地，并与 VS Code/Cursor 插件联动（可视化 + 鞭声）。

## 工具

| 工具 | 说明 |
|------|------|
| `horsewhip_lock_paths` | 锁定路径列表，写入 `.git/horsewhip/allowlist.json` |
| `horsewhip_unlock` | 解除圈定 |
| `horsewhip_get_boundary` | 当前 allowlist、是否 locked、edit-blocked |
| `horsewhip_expand_boundary` | 用户同意后合并路径 |
| `horsewhip_suggest_scope` | 占位（4B 实现候选路径） |
| `horsewhip_whip_ceremony` | `phase: lock \| expand` — 插件鞭声 + UI |
| `horsewhip_task_complete` | 任务收束 — 再挥鞭一次 |

## 构建

```bash
cd agent/mcp
npm install
npm run build
```

## Cursor 配置

将 `command` 指向本仓库构建产物（使用你机器上的绝对路径）：

```json
{
  "mcpServers": {
    "horsewhip": {
      "command": "node",
      "args": ["/ABS/PATH/TO/horsewhip/agent/mcp/dist/index.js"],
      "env": {
        "HORSEWHIP_WORKSPACE": "${workspaceFolder}"
      }
    }
  }
}
```

`HORSEWHIP_WORKSPACE` 可选；未设置时使用 MCP 进程的 `cwd`（Cursor 通常以项目根启动）。

## 与插件联动

1. MCP 写入 `.git/horsewhip/allowlist.json` 与 `mcp-signal.json`
2. Horsewhip 扩展监听上述文件 → 同步内存守门 + webview 边界栏/文件轨
3. `horsewhip_whip_ceremony` / `horsewhip_task_complete` 通过 signal 触发鞭声

**推荐工作流**（与 `agent/skills/horsewhip/SKILL.md` 一致）：

1. `horsewhip_lock_paths`
2. `horsewhip_whip_ceremony` phase=`lock`
3. 改码…
4. `horsewhip_task_complete`

未装插件时：allowlist 仍生效（pre-commit / 写盘 hook）；无泳道 UI 与音效。
