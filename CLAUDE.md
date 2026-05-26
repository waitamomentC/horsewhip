# 马鞭 · Horsewhip（Claude Code）

> **本文件由 Claude Code 在每次会话开始时自动加载**，不必在对话里写「请读 CLAUDE.md」或 `@CLAUDE.md`。  
> 与 Cursor 的 [`AGENTS.md`](./AGENTS.md) 内容一致；Claude Code 以 **本文件 + `.claude/rules/`** 为准。

---

## 使用马鞭时的强制 Git 习惯（摘要）

详细条文在 [`.claude/rules/horsewhip-protocol.md`](./.claude/rules/horsewhip-protocol.md)（同样自动加载）。

1. **每轮可验收任务结束 → 必须 `git commit`**（说明写清用户改了什么）
2. **若已配置 `git remote origin` → 必须 `git push`**（除非用户明确不要）
3. **新建实验分支 → 仅 `feature/<名>`**；融合目标为 `main` / `master`
4. **先遵守马鞭边界，再改代码**；禁止夹带边界外文件

马鞭 **不是 GitGraph**：不要堆专业 Git 术语，用统一习惯让时间轴可读。

---

## 本仓库开发（horsewhip 产品本身）

在 **本仓库** 内改网页 / 插件时：

```bash
# 改 script.js / style.css 后同步插件
node extension/scripts/sync-web-assets.js

cd extension && npm run compile
# F5 调试：打开 extension/，新窗口打开带 git 的文件夹
```

| 路径 | 说明 |
|------|------|
| `script.js` `style.css` | 网页 + Webview 逻辑 |
| `extension/src/` | 插件 TypeScript |
| `extension/media/` | sync 后的静态资源 |
| `README.md` | 产品定位（AI 边界，非 Git 图） |
| `AGENTS.md` | 全平台协议全文 |

**本仓库** 可有 `experiment/*` 产品开发分支；**用户业务仓库** 请 AI 仍只用 `feature/*` + `main`。

提交本仓库代码时同样遵守上文 commit / push 规则。

---

## 给用户业务仓库安装（复制即用）

把下面两样复制到 **用户项目根目录**（与 `git` 仓库同级）：

1. [`.claude/rules/horsewhip-protocol.md`](./.claude/rules/horsewhip-protocol.md) → 用户项目的 `.claude/rules/`
2. 将 [`docs/templates/CLAUDE.horsewhip-user.md`](./docs/templates/CLAUDE.horsewhip-user.md) 复制为 **`CLAUDE.md`**（或把其中「马鞭」章节合并进已有 `CLAUDE.md`）

然后在用户项目里运行 `claude` 即可，**无需每次提醒 commit / feature 分支**。

安装说明：[docs/claude-code.md](./docs/claude-code.md)
