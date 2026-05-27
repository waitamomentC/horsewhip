# Horsewhip — VS Code / Cursor Extension

**AI 边界可视化**：侧边栏文件泳道 + 时间轴，挥鞭复制/插入边界约束，可选守门。

完整介绍、安装与演示视频占位见仓库根目录 **[README.md](../README.md)**。

## 用户

- 扩展市场搜索 **Horsewhip** 安装（见 [docs/marketplace-publish.md](../docs/marketplace-publish.md)）
- **文件 → 打开文件夹**（Git 项目）→ 活动栏 Horsewhip

## 开发

```bash
cd .. && npm install && npm run build:extension
cd extension && npm install
# F5 调试
```

## 发布

```bash
npx vsce login horsewhip   # 首次
npm run publish:marketplace
```

详见 [docs/marketplace-publish.md](../docs/marketplace-publish.md)。
