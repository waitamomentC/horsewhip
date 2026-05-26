# Horsewhip（Claude Code · 本仓库开发）

> 自动加载本文件 + `.claude/rules/*.md`。  
> **协议唯一正文**：[`protocol/AGENTS.md`](./protocol/AGENTS.md)（根 [`AGENTS.md`](./AGENTS.md) 为同步副本，勿手改）。

## 摘要

先边界 → `feature/*` → commit → push · 详见 `protocol/AGENTS.md` §A–§H

---

## 本仓库开发

```bash
# 改协议后同步
node protocol/scripts/sync.mjs

node extension/scripts/sync-web-assets.js
cd extension && npm run compile
```

| 路径 | 说明 |
|------|------|
| [`protocol/`](./protocol/) | AI 协议子包 |
| `extension/` | 插件 |

---

## 给用户项目安装

[`protocol/docs/claude-code.md`](./protocol/docs/claude-code.md) · `./protocol/scripts/install-claude-horsewhip.sh`
