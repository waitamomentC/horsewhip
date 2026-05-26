# 马鞭 · Horsewhip（VS Code / Cursor 插件）

在 VS Code **左侧活动栏** 点击 **马鞭** 图标，侧边栏会**同步工作区目录层级**（与资源管理器一致）并绘制 git 时间线泳道。

## 使用前提（必须）

1. **先打开工作区**：菜单 **文件 → 打开文件夹**，选中你的项目目录  
2. **工作区必须是 Git 仓库**：若还没有，在项目根执行 `git init`（面板里也会提示）

马鞭**只读取当前工作区**里的 `git log`，不会访问工作区外的文件。

## 界面入口

| 入口 | 说明 |
|------|------|
| 左侧活动栏 **马鞭** 图标 | 主入口（与 Git、资源管理器并列） |
| 命令面板 `马鞭: 打开时间线` | 聚焦侧边栏 |
| `马鞭: 刷新 Git 记录` | 重新拉取 log |

未打开文件夹或未 `git init` 时，侧边栏会显示说明页，而不是空白图。

## 开发调试

```bash
cd extension
npm install
npm run sync-assets
npm run compile
```

用 VS Code 打开 **`extension/`** 目录 → **F5** → 在新窗口 **打开 horsewhip 仓库文件夹** → 点左侧马鞭图标。

## 打包（将来上架商店）

```bash
npm run package
# 生成 horsewhip-0.6.0.vsix → 扩展视图 → 从 VSIX 安装
```

## 泳道来源（v0.6.0）

- **复制资源管理器的文件夹层级** → 左侧只显示目录（`TA/`、`TC/`…），**不列出** `a.c` 等单文件行
- 目录下所有文件的 commit **汇聚**到该文件夹泳道上的节点
- 仓库**还没有任何 commit** 时 → 侧边栏 **「创建首次 commit」**（含 Git 用户名/邮箱）
- **发布 GitHub (SSH)**：顶栏按钮或命令 `马鞭: 发布到 GitHub (SSH)` — 检测/生成 SSH 公钥、新建或绑定远程仓库、push
- 命令 **马鞭: 加载演示数据** → 内置 demo 全部文件

## 与网页版

| 网页 | 插件 |
|------|------|
| 粘贴 log · 左侧目录树 | 自动读工作区 git · 同步工作区目录树 |
| 无工作区概念 | 必须先打开文件夹 + git 仓库 |

修改根目录 `script.js` / `style.css` 后执行 `npm run sync-assets` 同步到 `media/`。

自定义鞭子音效：在仓库根目录 `media/` 放入 `whip-crack.mp3`（或 `.wav` / `.ogg`），再 `npm run sync-assets`。详见 [media/README.md](https://github.com/waitamomentC/horsewhip/blob/main/media/README.md)。
