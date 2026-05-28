# 守护记录（Guard Record）

> **守护记录** — 把瞬时拦截变成累积数据，用于产品说服力与分享传播。  
> Phase 1 已实现在扩展内；Phase 2 见下文计划，**暂不开发**，待你回来再改。

---

## Phase 1 · 已交付（当前）

| 项 | 说明 |
|----|------|
| 持久化 | `.git/horsewhip/guard-stats.json`（本地，勿提交） |
| 三指标 | 越界尝试 · 成功拦截 · 拦截率 |
| 边界扩大 | MCP `expand_boundary` 成功合并后记入 **边界扩大**（不计入越界尝试） |
| 复查链 | 圈外写/编/提交 **未先 expand** → 守护记录事件带「未 expand」+ `.git/horsewhip/edit-blocked.json`（v2 `auditChain`） |
| 近 7 天 | 柱状趋势 |
| 最近事件 | 写盘还原 / 编辑拦截 / 提交拦截 / **边界扩大** + 路径 |
| 分享 | **文本卡片** → 剪贴板 |
| 入口 | 状态栏 `· 守护 N` · 侧栏 · 命令 **Horsewhip: 守护记录** |

**记账方**：VS Code **扩展**在拦截瞬间写入，**不依赖 MCP**，不区分 AI/人手（语义上为「圈外改动尝试」）。

详见 [user-guide.md §守护记录](./user-guide.md)。

---

## Phase 2 · 计划（待做）

> 你确认后再实现；此处仅作 backlog，避免遗忘。

### P1 · 分享卡片 PNG

| 项 | 说明 |
|----|------|
| 目标 | 一键导出带样式的 **PNG 卡片**（发朋友圈 / V2EX / 掘金），替代纯文本 |
| 内容 | 项目名、累计/本周三指标、拦截率大字、Horsewhip 标识 |
| 实现方向 | Webview `html2canvas` / 扩展宿主用 `canvas` 或预渲染 SVG → PNG；或复制到剪贴板为 image |
| 入口 | 守护记录面板「导出 PNG」按钮（保留现有「复制文本」） |

### P1 · Agent 会话维度

| 项 | 说明 |
|----|------|
| 目标 | 按 **Agent 任务会话** 聚合（非仅全局累计） |
| 会话边界 | 建议：`horsewhip_lock_paths` / MCP lock 到 `unlock` 或 `task_complete` 为一段；泳道挥鞭 lock 可选第二来源 |
| 展示 | 每会话：越界次数、拦截次数、涉及文件列表 |
| 数据 | `guard-stats.json` 增加 `sessions[]` 或 `events[].sessionId` |
| 注意 | 仍不证明「一定是 AI」；会话 ID 来自 MCP/扩展 lock 事件 |

### P2 · 文件 Top N 排行

| 项 | 说明 |
|----|------|
| 目标 | **被越界尝试最多的路径** Top N（如 Top 5） |
| 统计 | 从 `events[].files` 聚合；可按会话 / 全项目切换 |
| UI | 守护记录面板新增排行区块 |

### P2 · 泳道内嵌迷你计数器

| 项 | 说明 |
|----|------|
| 目标 | 时间轴/泳道面板一角显示 **本周越界 · 累计拦截**（计步器风格），点击跳转守护记录 |
| 实现 | Webview `postMessage` 接收 `guardStats`；与 `boundaryMcpBridge` / `onGuardStatsChanged` 联动刷新 |
| 位置 | 顶栏或边界栏旁，不抢泳道主视觉 |

### P2 · 验收清单

| 项 | 说明 |
|----|------|
| 目标 | [acceptance-checklist.md](./acceptance-checklist.md) 增加 **守护记录** 人工验收段 |
| 内容 | 触发 write/edit/commit 拦截 → 数字 +1 → 面板/状态栏一致 → 分享文本/PDF（Phase 2 后加 PNG） |

---

## 数据与语义（设计约束）

| 问题 | Phase 1 答案 | Phase 2 可加强 |
|------|--------------|----------------|
| 是否 MCP 写统计？ | **否**，扩展执法时记账；**expand** 由 MCP 信号触发扩展写入 | 会话 ID 可来自 MCP lock |
| expand vs 越界？ | **expand** = 用户同意后 `horsewhip_expand_boundary` 合并路径；**越界** = 未 expand 即改圈外 | 会话维度可串联 lock→expand→overreach |
| 越界复查链？ | `guard-stats.json` 事件 `auditChain` + `edit-blocked.json` v2 同字段 | commit 拦截同样带 `auditChain` |
| 是否识别 AI？ | **否**，仅圈外拦截 | 会话维度近似「Agent 任务」 |
| 圈内修改计数？ | **否** | 一般不做（非产品叙事） |
| 去重 | 同路径 ~4s 内合并 | 可按需调整 |

---

## 相关代码（Phase 1）

| 文件 | 职责 |
|------|------|
| `extension/src/guardStats.ts` | 持久化、聚合、分享文本 |
| `extension/src/guardRecordPanel.ts` | 守护记录 Webview |
| `extension/src/guardRecordHtml.ts` | 仪表盘 HTML |
| `extension/src/boundaryEditGuard.ts` | write/edit 拦截记账 + edit-blocked auditChain |
| `extension/src/boundaryMcpBridge.ts` | expand 信号 → `recordGuardExpand` |
| `extension/src/boundaryGuardHost.ts` | commit 拦截记账、状态栏 |

---

## 版本

| 阶段 | 扩展版本（约） | 状态 |
|------|----------------|------|
| Phase 1 | 2.1.x+ | ✅ 已实现 |
| Phase 2 | TBD | 📋 计划中 |

---

*horsewhip · 守护记录 · 最后更新：2026-05-28*
