# Horsewhip

**For that horse that keeps trampling your codebase**

**仓库 · Repository:** https://github.com/waitamomentC/horsewhip

---

### 不是 Git 图 · 是 AI 动手前的边界尺

在 **VS Code / Cursor** 里，用**文件泳道 + 时间轴**看清「动哪、哪一版」；**两重鞭子**在泳道**挥鞭圈定**跑马范围，对写盘与 commit **即时拦、自动还原**——未圈定的一律不许改。

| 痛点 | 马鞭 |
|------|------|
| AI 改了边界外的文件 | **两重鞭** · 圈外写盘即还原 |
| 不知道这一版动了谁 | **Cn 上传序** + **文件 Vn** |
| 复制小作文约束 AI | **挥鞭圈定** · 机器守门，越界须问用户 |

---

## 两重鞭子

**未圈定 = 全库禁止修改 · 已圈定 = 仅圈内路径可改**（反直觉但最稳：圈住的是「能跑的地方」）。

| 鞭 | 作用 |
|----|------|
| **第一重 · 挥鞭圈定** | 泳道点选节点 → 挥鞭 → 泳道色**瞄准环**（慢速旋转）锁定 **commit + 分支 + 路径**；当前 git 分支泳道**细线高亮** |
| **第二重 · 写盘守门** | 未圈定或圈外：**编辑器只读** + 磁盘变更**立即还原**（含 Agent 直写，不等 commit）；可选插入 Chat，要求 AI **先问用户**是否扩大圈定 |
| **兜底 · commit** | `pre-commit` + 面板提交；分支须与瞄准一致 |

持久化：`.git/horsewhip/allowlist.json`（`locked` + `targets`）；写盘被拦记录：`edit-blocked.json`。

---

## 安装本扩展

1. 扩展面板搜索 **Horsewhip** → 安装 → **重载窗口**
2. **文件 → 打开文件夹**（你的 **Git 项目**）
3. 活动栏 **Horsewhip** → 点选节点 → **挥鞭圈定**

也可从 [Releases](https://github.com/waitamomentC/horsewhip/releases) 安装 `.vsix`。

打开 **Git 仓库**即激活守门（不必先点侧栏）；首次可自动安装 pre-commit hook。

---

## 3 步 Quick Start

| 步骤 | 做什么 |
|:---:|--------|
| **1** | 安装扩展并重载 |
| **2** | 点泳道节点 → **挥鞭圈定**（见旋转瞄准环） |
| **3** | 仅在圈内改码 → `git commit` → **刷新 Git 记录** |

完整图文：[docs/user-guide.md](https://github.com/waitamomentC/horsewhip/blob/main/docs/user-guide.md)

---

## 守门设置（默认已开）

| 键 | 默认 | 说明 |
|----|------|------|
| `horsewhip.guard.blockEdit` | `lock` | 未圈定全库只读；已圈定仅圈内可编辑 |
| `horsewhip.guard.revertOnWrite` | `true` | 圈外/未圈定写盘立即还原 |
| `horsewhip.guard.notifyAiOnWrite` | `true` | 还原后向 Chat 插入说明，请 AI 问用户 |
| `horsewhip.guard.blockCommit` | `true` | 越界或未圈定拦截 commit |

详见 [boundary-guard.md](https://github.com/waitamomentC/horsewhip/blob/main/docs/boundary-guard.md)。

---

## 不是 GitGraph

| | GitGraph / GitLens | Horsewhip |
|---|-------------------|-----------|
| **解决什么** | 分支拓扑 | **AI 会不会改飞** |
| **横轴** | commit 时间 | **上传序 Cn** |
| **纵轴** | 分支 | **文件泳道** |
| **你要懂** | DAG、merge | **只动圈定路径** |

---

## 守门元数据

打开 Git 仓库后，插件在 `.git/horsewhip/` 写入 `allowlist.json`、`boundary-notes.md` 等（本地，勿提交）。

**软著提示**：`git commit` / `push` 请用户本人在本机执行，勿让 Agent 代提交。见主仓库 [README 软著说明](https://github.com/waitamomentC/horsewhip#软件著作权与国内-git-登记建议)。

---

## 文档

| 链接 | 说明 |
|------|------|
| [主仓库](https://github.com/waitamomentC/horsewhip) | 源码与网页 Demo |
| [用户指南](https://github.com/waitamomentC/horsewhip/blob/main/docs/user-guide.md) | 操作步骤 |
| [两重鞭 / 守门](https://github.com/waitamomentC/horsewhip/blob/main/docs/boundary-guard.md) | 写盘还原、pre-commit |
| [Issues](https://github.com/waitamomentC/horsewhip/issues) | 反馈 |

---

## License

[GNU AGPL-3.0](https://github.com/waitamomentC/horsewhip/blob/main/LICENSE)

*马鞭 · 两重鞭子 · 圈地即守门 · 简单 Git = 清晰时间轴*
