# 鞭子音效（自定义）

把音频文件放在本目录，命名为下面**任意一种**即可：

| 文件名 | 说明 |
|--------|------|
| `whip-crack.mp3` | 推荐 |
| `whip-crack.wav` | 未放 mp3 时会自动尝试 |
| `whip-crack.ogg` | 同上 |

建议：**短促「啪」一声**（约 50–200ms），音量在剪辑软件里调好；程序会原样播放，不再做合成处理。

## 网页版

文件放好后刷新 `index.html` 即可。

## VS Code / Cursor 插件

```bash
# 在仓库根目录放好 media/whip-crack.mp3 后
cd extension && npm run sync-assets && npm run compile
```

然后 **F5** 重载扩展窗口。未找到文件时会自动退回内置合成音效。
