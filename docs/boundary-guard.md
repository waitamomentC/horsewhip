# horsewhip 守门（Phase 3）

> **目的**：AI 改完代码后，对比 **泳道划定的边界** 与 **工作区实际 git 改动**，发现越界并生成纠正文案。

## 使用步骤

1. 在泳道 **点选节点** → horsewhip 复制/插入 **事前约束**（同时写入会话 allowlist）。
2. 让 AI 在 Cursor 里改代码。
3. 点击顶栏 **「检查越界」**，或保存文件时自动检查（设置 `horsewhip.guard.onSave`）。
4. 若越界：
   - **插入纠正到 Chat**：把 revert 指令发给 AI；
   - **还原越界文件**：`git checkout HEAD -- …` / 删除未跟踪越界路径（需确认）。

## 状态栏

| 显示 | 含义 |
|------|------|
| 未划定边界 | 尚未在泳道选节点 |
| 边界内 | 有改动且均在 allowlist 内 |
| 越界 N | 有 N 个路径不在边界内 |

## 设置

| 键 | 默认 | 说明 |
|----|------|------|
| `horsewhip.guard.onSave` | `true` | 保存时自动检查 |
| `horsewhip.guard.mode` | `warn` | `warn` 轻提示；`strict` 保存时弹完整对话框 |

## 命令面板

- `Horsewhip: Check Boundary (Guard)`
- `Horsewhip: Insert Overreach Correction to Chat`
- `Horsewhip: Revert Overreach Files`

## 纠正文案模板

```
【horsewhip · 越界纠正】
用户明确要求只修改：…
检测到额外改动：…
请立即 revert …，仅保留允许范围内的修改。
```

## 与事前约束的关系

| 时机 | 工具 |
|------|------|
| 事前 | 点节点 → 约束 prompt → 插入 Chat |
| 事后 | 守门检查 → 越界纠正 prompt |

## Commit 前强制拦截（默认开启）

| 入口 | 行为 |
|------|------|
| horsewhip 面板 **提交** | `horsewhip.guard.blockCommit=true` 时，越界则弹窗并 **拒绝提交** |
| 终端 `git commit` | 自动安装 **pre-commit** 钩子（`horsewhip.guard.installHookOnOpen`） |

allowlist 会写入 **`.git/horsewhip/allowlist.json`**（不进入版本库），供钩子读取。

### 设置

| 键 | 默认 | 说明 |
|----|------|------|
| `horsewhip.guard.blockCommit` | `true` | 有边界且越界 → 拦截 commit |
| `horsewhip.guard.blockCommitWithoutBoundary` | `true` | `true` 时未划边界也拦截 |
| `horsewhip.guard.installHookOnOpen` | `true` | 打开文件夹时安装 git hook |

### 手动安装 hook

命令面板：**Horsewhip: Install Git Pre-Commit Guard Hook**

### 紧急跳过

```bash
git commit --no-verify -m "…"
```

仅在你确认越界可接受时使用。
