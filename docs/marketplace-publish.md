# 发布到 VS Code 扩展市场（v1.0.1）

> 一次注册发布者，之后每次改版本号 + `vsce publish` 即可迭代。

---

## 1. 注册 Microsoft 发布者（只做一次）

1. 打开 [Visual Studio Marketplace 管理](https://marketplace.visualstudio.com/manage)
2. 用 **Microsoft 账号** 或 **GitHub** 登录
3. **Create publisher**
   - **Publisher ID** 必须与 `extension/package.json` 里 `"publisher"` **完全一致**  
   - 当前仓库为：`horsewhip`（也可改成 `waitamomentC`，改后需同步 `package.json`）
   - **Publisher name**：显示名，如 `Horsewhip` 或 `waitamomentC`

4. 创建 **Personal Access Token（PAT）**
   - 打开 [Azure DevOps](https://dev.azure.com) → 右上角用户 → **Personal access tokens**
   - **New Token** → 自定义过期时间（建议 90 天或 1 年）
   - **Scopes**：勾选 **Marketplace** → **Manage**
   - 复制 token（只显示一次）

---

## 2. 本机登录 vsce

```bash
cd /Users/su/Desktop/horsewhip/extension
npm install
npx vsce login horsewhip    # 换成你的 Publisher ID
# 粘贴 PAT
```

---

## 3. 发布前检查

| 项 | 命令 / 说明 |
|----|-------------|
| 版本号 | `extension/package.json` → `"version": "1.0.1"` |
| 官方音效 | 确认存在 `sound/whip.wav` |
| 构建 | 在仓库根：`npm run build:extension` |
| 本地试装 | `cd extension && npm run package` → 扩展面板「从 VSIX 安装」 |
| 仓库字段 | `repository`、`bugs`、`homepage` 已填（已配置 GitHub） |

`vsce publish` 会自动执行 `vscode:prepublish` → `build:all`（含同步 `sound/whip.wav`）。

---

## 4. 首次上架

```bash
cd /Users/su/Desktop/horsewhip/extension
npx vsce publish --no-dependencies
```

成功后在 [marketplace.visualstudio.com](https://marketplace.visualstudio.com/vscode) 搜索 **Horsewhip**。

**Cursor**：多数版本可直接装 VS Code 市场扩展；扩展面板搜 `Horsewhip` 即可。

---

## 5. 后续迭代（1.0.1、1.0.2…）

1. 改 `extension/package.json` 的 `version`
2. 改代码 → `npm run build:extension`（在仓库根）
3. `cd extension && npx vsce publish --no-dependencies`

也可在 `package.json` 使用：

```bash
npm run publish:marketplace
```

（需已 `vsce login`）

---

## 6. 常见问题

| 问题 | 处理 |
|------|------|
| `Publisher 'xxx' not found` | Marketplace 建的 ID 与 `package.json` 不一致 |
| `You must be logged in` | 重新 `vsce login <publisher>` |
| 扩展搜不到 | 上架后等几分钟；确认未设 `private` |
| AGPL 许可证 | 市场允许；README 已声明 [AGPL-3.0](../LICENSE) |

---

## 7. 与 GitHub Release 的关系

| 渠道 | 用途 |
|------|------|
| **VS Code Marketplace** | 用户搜索安装，自动更新（推荐主渠道） |
| **GitHub Releases + .vsix** | 内测、无法访问市场时的备用 |

发布市场后，可在 GitHub Release 附同名 `.vsix`：`npm run package` 生成。
