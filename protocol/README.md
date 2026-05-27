# Horsewhip Protocol（AI 协作协议包）

**当前版本：v1.0.1**（与 `extension/package.json` 插件版本对齐）

本目录是 horsewhip 仓库里的 **协议子包**（暂不单独建仓）。产品与插件在仓库根目录、`extension/`。

## 目录

| 路径 | 说明 |
|------|------|
| **`AGENTS.md`** | **唯一正文**（Git + 边界 + 守门 + 自检） |
| `docs/claude-code.md` | Claude 安装、与已有 `CLAUDE.md` 冲突说明 |
| `templates/` | Claude 用 preamble、snippet、空项目 `CLAUDE.md` 模板 |
| `scripts/sync.mjs` | 同步到根 `AGENTS.md` 与 `.claude/rules/` |
| `scripts/install-claude-horsewhip.sh` | 安装到用户业务仓库 |

## 维护者（horsewhip 仓库内）

```bash
# 1. 只改 protocol/AGENTS.md（或 templates/、docs/）
# 2. 同步到根目录与 Claude rules
node protocol/scripts/sync.mjs
```

## 用户安装（业务项目）

```bash
curl -fsSL https://raw.githubusercontent.com/waitamomentC/horsewhip/main/protocol/scripts/install-claude-horsewhip.sh | bash -s -- .
```

详见 [`docs/claude-code.md`](./docs/claude-code.md)。

## 与根目录 `AGENTS.md` 的关系

- **编辑**：`protocol/AGENTS.md`
- **根目录 `AGENTS.md`**：同步副本（方便 Cursor `@AGENTS.md`、旧链接）
- **`.claude/rules/horsewhip-protocol.md`**：preamble + 正文（Claude Code）

不要维护第二套铁律。
