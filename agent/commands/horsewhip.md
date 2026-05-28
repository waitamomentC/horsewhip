# Horsewhip — 强制边界工作流

**本命令已激活。** 你必须严格按 Horsewhip 流程执行；在圈地完成前 **禁止** Write / 编辑 / 批量改任何项目文件。

## 1. 加载 Skill（必读）

先阅读并遵守 Skill 全文（按客户端择一）：

- Cursor：`.cursor/skills/horsewhip/SKILL.md`
- Claude Code：`.claude/skills/horsewhip/SKILL.md`

## 2. 用户任务

**命令名之后、同一消息里** 的文字即本次任务。若没有具体任务，先向用户确认要做什么，再开始圈地。

## 3. 强制顺序（不可跳过、不可调换）

1. **Scope** — 分析任务，列出 **最小** 会改动的文件（先 read/search，禁止猜 `src/`）。
2. **`horsewhip_lock_paths`** — 只锁具体文件或 ≥2 层子目录；初次禁止 `src/`、`lib/` 等宽路径（MCP 会拒绝）。
3. **`horsewhip_whip_ceremony`** — `{ "phase": "lock" }`
4. **Edit** — 仅在 allowlist 内改代码
5. **Done** — `horsewhip_task_complete` + 提醒用户自行 `git commit`（勿代提交、勿 `--no-verify`）

## 4. 越界与扩大

- 写盘被拦 / `edit-blocked.json` / 圈外路径 → **立即停止**，说明当前 pasture 与所需路径，**问用户** 是否 `horsewhip_expand_boundary`
- 未经用户同意不得 expand；不得静默改圈外文件

## 5. 与「普通对话」的区别

用户输入 `/horsewhip` 表示 **必须** 走上述 MCP 流程，不能当作普通编码请求直接改文件。
