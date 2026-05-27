# horsewhip 用户操作指南

> 安装与快速上手见根目录 [README.md](../README.md)。本文是完整步骤说明。

---

## 0. 准备

| 检查项 | 操作 |
|--------|------|
| 项目是 Git 仓库 | 项目根目录执行 `git init`（若尚未初始化） |
| 至少有一次 commit | 否则泳道为空；可在 horsewhip 面板引导首次提交 |
| IDE | VS Code 或 Cursor + Horsewhip 插件 |

---

## 1. 在你的项目里安装 AI 协议（推荐，一次即可）

让 Claude / Cursor **自动** commit、push、只用 `feature/*`、遵守文件边界。

**Claude Code（推荐，不覆盖已有 `CLAUDE.md`）**

```bash
cd /path/to/your-project

curl -fsSL https://raw.githubusercontent.com/waitamomentC/horsewhip/main/protocol/scripts/install-claude-horsewhip.sh | bash -s -- .
```

| 安装结果 | 位置 |
|----------|------|
| 协议正文 | `AGENTS.md` |
| Claude 自动加载 | `.claude/rules/horsewhip-protocol.md` |

- **已有 `CLAUDE.md`**：默认不覆盖；`…/install-claude-horsewhip.sh . --snippet` 加指针  
- **无 `CLAUDE.md`**：`--with-claude-md` 生成短模板  

**Cursor / 其他**

```bash
curl -fsSL -o AGENTS.md \
  "https://raw.githubusercontent.com/waitamomentC/horsewhip/main/protocol/AGENTS.md"
```

在 Cursor Rules 引用 `@AGENTS.md`。

**验证**：新开 AI 会话问「做完一轮功能后，Git 和文件边界上要做什么？」→ 应提到 commit、push、`feature/*`、边界。

冲突说明：[protocol/docs/claude-code.md](../protocol/docs/claude-code.md)

---

## 2. 打开 horsewhip

| 方式 | 操作 |
|------|------|
| **插件（推荐）** | 打开你的项目文件夹 → 活动栏 **Horsewhip** |
| **网页** | 克隆本仓库 → `open index.html` → demo 或粘贴 log |

---

## 3. 划边界 → 让 AI 只改指定范围

```
点泳道节点 → 挥鞭复制约束 / 插入 Chat
```

约束示例：

```text
【horsewhip · AI 文件边界】
本次任务只允许修改以下范围…
禁止修改上述范围以外的文件。
```

插件会同步 **allowlist**；保存或 commit 时可 **拦截越界**。

---

## 4. commit 与 push

```bash
git add <边界内文件>
git commit -m "feat: 与用户任务一致的一句话"
git push   # 有 origin 时
```

| 规则 | 说明 |
|------|------|
| 实验分支 | `feature/简短描述` |
| 主泳道 | `main` 或 `master` |

全文：[protocol/AGENTS.md](../protocol/AGENTS.md)

---

## 5. 守门（插件）

| 操作 | 说明 |
|------|------|
| 检查越界 | 对比 allowlist 与工作区 |
| 插入纠正 / 还原文件 | 越界后处理 |
| pre-commit | 默认拦截越界 commit |

详见 [boundary-guard.md](./boundary-guard.md)

---

## 6. 日常 checklist

- [ ] 已划边界
- [ ] 只改边界内文件
- [ ] 已 commit（有 origin 则 push）
- [ ] 实验在 `feature/*`
- [ ] 守门通过（若启用）
