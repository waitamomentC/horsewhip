# horsewhip 用户操作指南

> 安装与快速上手见根目录 [README.md](../README.md)。

---

## 0. 准备

| 检查项 | 操作 |
|--------|------|
| 项目是 Git 仓库 | 项目根 `git init`（若尚未初始化） |
| 至少有一次 commit | 否则泳道为空 |
| IDE | VS Code 或 **Cursor** + **Horsewhip 插件** |

---

## 1. 安装插件

| 方式 | 操作 |
|------|------|
| 市场 | 扩展面板搜索 **Horsewhip** → 安装 → 重载 |
| VSIX | [Releases](https://github.com/waitamomentC/horsewhip/releases) |

打开你的 **Git 项目文件夹** 后，守门自动激活（不必先点侧栏）。

**完整版（Vibecode / Claude Code + Agent）**：命令 **Horsewhip: 配置 Agent（MCP + Skill）** → 重载窗口。详见 [agent-setup.md](./agent-setup.md)。

**守护记录**：泳道顶栏 **「守护记录」** 按钮（有拦截时显示次数）→ 切换到仪表盘；或命令 **Horsewhip: 守护记录**。

---

## 2. 打开泳道

活动栏 **Horsewhip** → 打开时间轴（或命令 `Horsewhip: Open Timeline`）。

网页 Demo（无守门）：克隆本仓库 → `open index.html`。

---

## 3. 挥鞭圈定（跑马范围）

```
点选节点（预览）→ 挥鞭圈定 → 旋转瞄准环出现
```

| 状态 | 含义 |
|------|------|
| 未圈定 | **全库禁止修改**（写盘即还原） |
| 已圈定 | **仅圈内路径可改** |

插件写入 `.git/horsewhip/allowlist.json`（本地，勿提交）。说明见 `boundary-notes.md`、`edit-blocked.json`。

---

## 4. commit 与 push（请本人操作）

```bash
git add <边界内文件>
git commit -m "feat: 与用户任务一致的一句话"
git push   # 有 origin 时
```

| 建议 | 说明 |
|------|------|
| 实验分支 | `feature/简短描述` |
| 主泳道 | `main` 或 `master` |
| **本人提交** | 软著与公开历史宜**不要**让 Agent 代 commit（见 README 软著说明） |

---

## 5. 两重鞭子守门

| 鞭 | 说明 |
|----|------|
| 挥鞭圈定 | 锁定 commit + 分支 + 路径 |
| 写盘守门 | 圈外或未圈定 → 立即还原 |
| commit | pre-commit + 面板校验 |

详见 [boundary-guard.md](./boundary-guard.md)。

---

## 6. 日常 checklist

- [ ] 已挥鞭圈定
- [ ] 只改圈内文件
- [ ] **本人** commit（有 origin 则 push）
- [ ] 守门通过
