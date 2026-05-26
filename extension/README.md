# 马鞭 · Horsewhip（VS Code / Cursor 插件）

**AI 边界可视化**：在侧边栏看清文件泳道与版本，挥鞭划定约束，多选分支生成「融合回主泳道」任务并插入 Chat。  
不是 GitGraph，不追求 DAG 专业度；Git 仅用于读取 log 与记录版本。

## 使用前提

1. **文件 → 打开文件夹**（你的项目根）
2. 项目已 **`git init`** 且至少有一次 commit（否则面板引导首次提交）

## 入口

| 入口 | 说明 |
|------|------|
| 左侧活动栏 **马鞭** | 主面板 |
| `马鞭: 打开时间线` | 聚焦侧边栏 |
| `马鞭: 刷新 Git 记录` | 重新拉 log + 分支列表 |

## AI 边界工作流（推荐）

1. **看**：左侧目录泳道 + 时间轴节点（Cn 上传序 / Vn 夹内版本）
2. **划**：点节点 → 顶栏「本次边界」→ **挥鞭** 复制或 **插入 Chat**
3. **留**：各实验分支在分支栏列出；相关文件下显示 ⎇ 泳道
4. **融**：分支栏勾选 ≥2 条（不含 main）→ **AI 融合 → 主泳道** → 在 Chat 里让 AI 择优合并
5. **看**：merge commit 后 **刷新 Git 记录**，主泳道出现新节点

边界文件会同步为会话 **allowlist**（减少 AI 改飞）。

## 开发调试

```bash
cd extension
npm install
npm run sync-assets
npm run compile
```

打开 **`extension/`** → **F5** → 新窗口打开带 git 的文件夹 → 点马鞭图标。

修改仓库根目录 `script.js` / `style.css` 后：

```bash
npm run sync-assets
```

## 打包

```bash
npm run package
```

需 `package.json` 中 `repository` 等字段完整；见根目录 [`README.md`](../README.md)。

## 与网页版

| 网页 | 插件 |
|------|------|
| 粘贴 log / demo | 自动 `git log` + 全部分支 `for-each-ref` |
| 复制约束 | 复制 + **插入 Chat** + allowlist |
| 无分支融合条 | 分支栏多选 + **AI 融合 → 主泳道** |

鞭子音效：根目录 [`media/whip-crack.mp3`](https://github.com/waitamomentC/horsewhip/blob/main/media/README.md) → `npm run sync-assets`。
