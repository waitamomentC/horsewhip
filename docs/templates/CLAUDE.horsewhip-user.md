# 本项目 · 马鞭协作（Claude Code 自动加载）

> 由 [Horsewhip](https://github.com/waitamomentC/horsewhip) 提供。Claude Code **每次会话自动读本文件**，无需 `@`。

## 强制规则

完整条文见 `.claude/rules/horsewhip-protocol.md`（请一并放入本仓库）。

1. 每轮任务结束 **必须 `git commit`**（说明反映真实改动）
2. 若已配置 **`origin`**，commit 后 **必须 `git push`**
3. 新建实验分支 **仅 `feature/<名>`**；合并回 **`main`** 或 **`master`**
4. 遵守马鞭 / 对话中的 **文件边界**，不修改范围外路径

## 工作流

划边界 → `feature/*` 实验 → commit → push → 马鞭多选分支融合 → main 上 merge commit → 刷新马鞭观察主泳道。

---

（以下为你们团队自己的项目说明，可写在下方。）

## 构建与测试

```bash
# 在此填写你们项目的常用命令
```
