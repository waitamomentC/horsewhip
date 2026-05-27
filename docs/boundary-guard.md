# horsewhip 守门（Phase 3）

> **目的**：AI 改完代码后，对比 **泳道划定的边界** 与 **工作区实际 git 改动**，发现越界并生成纠正文案。

## 使用步骤

1. 在泳道 **点选节点**（预览）→ **挥鞭圈定**（旋转色环 = 仅此范围可改）。
2. **未圈定**：全库不可编辑；Agent/终端**一写盘即还原**（`revertOnWrite`），并可选插入 Chat 请 AI 向用户确认是否圈定。**已圈定**：仅圈内可改；圈外写盘同样即时还原。
3. commit / pre-commit 仍为最后一道兜底。
3. 点击顶栏 **「检查越界」**，或保存文件时自动检查（设置 `horsewhip.guard.onSave`）。
4. 若越界：
   - **插入纠正到 Chat**：把 revert 指令发给 AI；
   - **还原越界文件**：`git checkout HEAD -- …` / 删除未跟踪越界路径（需确认）。

## 状态栏

| 显示 | 含义 |
|------|------|
| 未上锁 | 尚未挥鞭锁定边界 |
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
| horsewhip 面板 **提交** | 越界则弹窗并 **拒绝提交** |
| 终端 `git commit` | **pre-commit** 钩子拦截 |

**重要**：拦截只阻止 commit 写入历史，**不会**自动改回工作区。例如锁定 `A` 却改了 `B` → 提交失败后 **`B` 仍在磁盘上**。

### 被拦之后（成熟产品路径）

1. 写入 **`.git/horsewhip/commit-blocked.json`**（记录越界列表）
2. 插件检测到标记 → 顶栏 / Webview 状态；**默认自动还原越界**（全自动 agent 不问用户）
3. 插入 Chat 纠正文案 → AI **仅在边界内重想**（最多 3 轮）→ 仍不行则 **请用户在泳道扩大边界**

| 场景 | `revertOnCommitBlock` |
|------|------------------------|
| **全自动 vibe agent**（默认） | `always`：立即还原，不弹窗 |
| **人在回路**（用户坐 IDE 前） | 改为 `prompt`：弹窗选「还原 / 插入纠正 / 稍后」 |

边界说明见插件写入的 `.git/horsewhip/boundary-notes.md`。

allowlist：**`.git/horsewhip/allowlist.json`**（不进版本库）。

### 设置

| 键 | 默认 | 说明 |
|----|------|------|
| `horsewhip.guard.blockCommit` | `true` | 有边界且越界 → 拦截 commit |
| `horsewhip.guard.blockCommitWithoutBoundary` | `true` | 未划边界也拦截 |
| `horsewhip.guard.installHookOnOpen` | `true` | 打开文件夹时安装 git hook |
| `horsewhip.guard.revertOnCommitBlock` | `always` | `always` 全自动默认还原；`prompt` 人在回路弹窗；`never` 仅拦不还原 |
| `horsewhip.guard.notifyOnCommitBlock` | `false` | `always` 时是否仍弹通知条（默认否，少打断 agent） |
| `horsewhip.guard.offerCorrectionAfterRevert` | `true` | 还原后自动插入纠正到 Chat（含 3 轮边界内重试与扩边界说明） |
| `horsewhip.guard.blockEdit` | `off` | 可选编辑期只读；默认只靠 commit 守门（推荐） |
| `horsewhip.guard.offerEditBlockToChat` | `true` | 编辑被拦时可插入说明到 Chat |

allowlist 需含 **`"locked": true`**（挥鞭后写入）时，编辑锁、commit 与 pre-commit 才生效。

插件自动维护 **`.git/horsewhip/boundary-notes.md`**。编辑被拦：**`edit-blocked.json`**。

### 手动安装 hook

命令面板：**Horsewhip: Install Git Pre-Commit Guard Hook**

### 紧急跳过

```bash
git commit --no-verify -m "…"
```

仅在你确认越界可接受时使用。
