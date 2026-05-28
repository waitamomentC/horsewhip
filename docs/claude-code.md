# Horsewhip × Claude Code

Claude 的反馈里 **MCP 进程正常、7 个工具已注册**，但 **当前会话里调不到工具**——多半是 **Claude Code 的配置路径 / 环境变量 / 工具延迟加载**，不是 horsewhip MCP 实现坏了。

`execution.taskSupport: "forbidden"` 是 MCP SDK **默认值**（几乎所有 stdio 工具都一样），**不是** Claude 过滤工具的原因。

---

## 正确配置（与 Cursor 不同）

| 项 | Cursor / Vibecode | Claude Code |
|----|-------------------|-------------|
| MCP 配置文件 | `.cursor/mcp.json` | **项目根 `.mcp.json`** |
| 工作区变量 | `${workspaceFolder}` | **`${CLAUDE_PROJECT_DIR}`** |
| Skill 目录 | `.cursor/skills/horsewhip/` | **`.claude/skills/horsewhip/`** |
| 不推荐 | — | `.claude/mcp.json`（非官方主路径，可能连上但不注入会话） |

一键安装（会写齐两边）：

```bash
cd /path/to/horsewhip
npm run setup:agent -- --project /path/to/your-git-app
```

生成示例（`your-app/.mcp.json`）：

```json
{
  "mcpServers": {
    "horsewhip": {
      "command": "node",
      "args": ["/ABS/PATH/horsewhip/agent/mcp/dist/index.js"],
      "env": {
        "HORSEWHIP_WORKSPACE": "${CLAUDE_PROJECT_DIR}"
      },
      "alwaysLoad": true
    }
  }
}
```

`alwaysLoad: true` 避免 **MCP Tool Search** 把工具延迟加载，导致会话里一时看不到 `horsewhip_*`。

---

## 排查步骤（按顺序）

### 1. 配置文件位置

```bash
# 应在业务项目根目录
ls -la .mcp.json
cat .mcp.json
```

若只有 `.claude/mcp.json`，请 **复制/合并到根目录 `.mcp.json`**，或重新跑 `setup:agent`。

### 2. 重启会话

改 MCP 后必须 **退出 Claude Code 会话再进**（不是只 `/clear`）。

```bash
cd /path/to/your-git-app
claude
```

### 3. 批准项目级 MCP

Claude Code 对 `.mcp.json` 里的服务器要 **用户批准**：

```text
/mcp
```

找到 `horsewhip` → 连接/启用。若曾拒绝过：

```bash
claude mcp reset-project-choices
```

### 4. CLI 诊断

```bash
claude mcp get horsewhip
claude mcp list
```

`/mcp` 界面有时 **不显示** 项目级服务器（已知问题），但 CLI `get` 能确认是否加载。

### 5. 工具名与权限

Claude 里工具名通常为：

`mcp__horsewhip__horsewhip_lock_paths`（前缀因版本略有差异）

检查 `.claude/settings.json` 是否 **deny** 了 `mcp__horsewhip__*`。

### 6. 工作区必须是 Git 根目录

`horsewhip_lock_paths` 会检查 `.git/HEAD`。  
`HORSEWHIP_WORKSPACE` 若仍是字面量 `${workspaceFolder}`（Cursor 变量未展开），会失败——请用 **`${CLAUDE_PROJECT_DIR}`** 或让 MCP 用 `cwd`（已在服务端增加 `CLAUDE_PROJECT_DIR` 回退）。

### 7. 仍无工具时：用户级配置

```bash
npm run setup:agent -- --project /path/to/your-app --global-claude
```

写入 `~/.claude.json` 的 `mcpServers.horsewhip`（仍建议 `alwaysLoad: true`）。

---

## Skill

Claude Code **不读** `.cursor/skills/`。需要：

`.claude/skills/horsewhip/SKILL.md`

`setup:agent` 已同时链接。新开会话后：

```text
/skills
```

应能看到 `horsewhip`。也可手动：`/horsewhip`（以目录名为准）。

---

## 与 VS Code 插件

| 组合 | MCP 写盘 | 泳道 / 鞭声 |
|------|----------|-------------|
| 仅 Claude Code + MCP | ✅ allowlist | ❌ |
| + Horsewhip 扩展（同一文件夹用 VS Code 打开） | ✅ | ✅ |

扩展只在 **VS Code / Cursor** 侧栏；Claude Code 终端里改文件仍走 MCP + `.git/horsewhip/` 守门。

---

## 快速验证

在 Claude Code 对话：

```text
先调用 horsewhip_get_boundary，再 horsewhip_lock_paths 锁定 README.md，
然后 horsewhip_whip_ceremony phase=lock。
```

成功时业务项目出现：

- `.git/horsewhip/allowlist.json`（`locked: true`）
- `.git/horsewhip/mcp-signal.json`

---

*参见 [agent/mcp/README.md](../agent/mcp/README.md) · [ai-test-checklist.md](./ai-test-checklist.md)*
