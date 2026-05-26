# 马鞭 (Horsewhip) — 完整产品计划

> **讽刺标语**：For that horse that keeps trampling your codebase  
> **策略**：先用 **网页 MVP** 验证需求与传播力 → 有信号再投入 **IDE 插件完整版**  
> **UI 细则**：见 [`ui-plan.md`](./ui-plan.md)

---

## 0. 产品愿景（终态）

> **定位摘要**（对外文案见 [`README.md`](./README.md)）：马鞭为 **AI 协作** 而生，是边界可视化与收束方案，**不是** GitGraph / 传统 Git 客户端；刻意降低 Git 专业术语，强化「划边界 → 融合回主泳道」。

用户在 Cursor / Claude Code 等 vibe coding 环境里对 AI 说：「改 A 文件，做 xxx」。  
AI 却悄悄改了 A、B、C。马鞭的职责是 **锁死文件边界**：

| 时机 | 马鞭做什么 |
|------|------------|
| **事前** | 生成约束 prompt：`只允许修改：A` |
| **事后**（完整版） | 检测 diff 越界 → 生成纠正 prompt：`用户仅要求 A，请 revert B、C` |

**终态形态**：IDE 插件（本地读 git、执行回滚、监听改动、一键插入/纠正 prompt）。  
**当前形态**：纯前端网页（粘贴 git log、版本时间线可视化、复制约束 prompt / 回滚命令）。

### 0.1 版本时间线模型（已确认）

横轴 = **项目版本时间线**（从左旧 → 右新，最右 = 最新提交）。纵轴 = **文件泳道**。

```
版本:     V1          V2              V3 (最新)
         ─────────────────────────────────→ 时间

a 文件    ●
b 文件                ●
c 文件    (无节点 = 该版本未改此文件)
d 文件                                ●
```

- 某文件上的 **圆点** = 该版本（commit）修改了此文件
- V2 改 b 时，a 在 V1 的改动 **已 cumulative 在仓库中**
- V3（d 的最新提交）= 当前时间线最右端

### 0.2 点击节点 · 回滚双选项（已确认）

点击 **a 文件的 V1 节点** → 弹出版本详情面板，提供两个操作：

| 选项 | 说明 | Git 命令 | 阶段 |
|------|------|----------|------|
| **① 只回滚当前文件** | 仅将 `a` 还原到 V1 内容；b、d 等工作区内容不变 | `git checkout <hash> -- path/to/a` | 网页：复制命令 · 插件：**执行** |
| **② 高危 · 回滚整个仓库** | 将整个工作区还原到 V1 时刻；**b、d 等后续改动全部丢失** | `git reset --hard <hash>` | 网页：复制命令 + 二次警告 · 插件：**执行** + 输入确认 |

面板同时展示：commit hash、作者、日期、版本序号（V1/V2/…）、文件路径、AI 约束 prompt（可复制）。

---

## 1. 为什么要分三期

### 1.1 明确不做的事（避免跑偏）

| 设想 | 为何不做（至少 MVP 不做） |
|------|---------------------------|
| 网页填仓库地址 + SSH 连 git | 浏览器无法 SSH；需后端 + 安全审计，成本高 |
| 网页实时 hook AI 改文件 | 无 IDE 接入权，做不到 |
| 一上来就做插件 + 守门 hook | 开发周期长，未验证需求就投入 |

### 1.2 三期路线图

```
┌─────────────────────────────────────────────────────────────────┐
│  Phase 1 · 网页 MVP（现在）                                      │
│  粘贴 git log → 星图可视化 → 点选 → 复制 AI 约束 prompt          │
│  目标：传播、Star、验证「是否有人真需要锁 AI 边界」               │
└───────────────────────────────┬─────────────────────────────────┘
                                │ 验证信号达标
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│  Phase 2 · IDE 插件 v1                                           │
│  本地自动 git log → 同款可视化 → 声明「本次只改 A」→ 插入 Chat    │
│  目标：进入真实开发工作流，减少手动粘贴                           │
└───────────────────────────────┬─────────────────────────────────┘
                                │ 用户反馈需要事后纠偏
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│  Phase 3 · IDE 插件完整版（守门 Hook）                           │
│  AI 会话 / 保存 / 提交前 diff → 期望文件 vs 实际文件 → 越界告警   │
│  目标：你要的「鞭子抽回去」全自动体验                             │
└─────────────────────────────────────────────────────────────────┘
```

### 1.3 三期能力对照

| 能力 | Phase 1 网页 | Phase 2 插件 v1 | Phase 3 插件完整版 |
|------|:------------:|:---------------:|:------------------:|
| 版本时间线可视化（泳道+节点+虚线） | ✅ | ✅ | ✅ |
| 版本分页（横 10 列 / 纵 限泳道） | ✅ | ✅ | ✅ |
| 点击节点 → 版本详情弹层 | ✅ | ✅ | ✅ |
| 回滚 · 仅当前文件（复制/执行命令） | 复制 | **执行** | **执行** |
| 回滚 · 整个仓库（高危，二次确认） | 复制 | **执行** | **执行** |
| 点击节点 → 单文件 AI 约束 | ✅ | ✅ | ✅ |
| 点击连接线 → 多文件 AI 约束 | ✅ | ✅ | ✅ |
| 一键 Demo 数据（演示用） | ✅ | ✅ | — |
| 自动读本地仓库 log | ❌ | ✅ | ✅ |
| 声明「本次目标文件」 | ⚠️ 可选轻量 | ✅ | ✅ |
| 约束 prompt 插入 AI Chat | 手动复制 | 一键插入 | 一键插入 |
| AI 改完后 diff 越界检测 | ❌ | ❌ | ✅ |
| 越界纠正 prompt | ❌ | ❌ | ✅ |
| SSH / 远程仓库配置 | ❌ | ❌ | ❌（仍用本地 git） |

---

## 2. Phase 1 — 网页 MVP（当前全部精力）

### 2.1 目标

1. **30 秒内**让访客理解：「这是给 AI 编程锁文件边界的工具」
2. **无需安装**，双击或静态托管即可体验
3. 视觉足够炫酷，适合录 GIF、发 Twitter/X、HN、V2EX
4. 收集验证信号（Star、反馈、Waitlist）

### 2.2 用户旅程

```
开发者遇到 AI 乱改文件
        ↓
打开 horsewhip 网页（或 GitHub Pages）
        ↓
终端：git log -50 --name-only --pretty=format:"%H|%an|%ad"
        ↓
粘贴 → 点击「生成演化图」
        ↓
看到「版本时间线」：文件泳道、版本节点、同批虚线连接
        ↓
横向翻页：每页 10 个版本列（← →）；纵向：泳道分页或搜索/filter
        ↓
场景 A：点击节点 → 版本弹层（hash/作者/日期/Vn）
        · [复制 AI 约束] 只允许修改：a.ts
        · [① 只回滚此文件] 复制 git checkout 命令（插件：直接执行）
        · [② 高危 · 回滚整个仓库] 复制 git reset --hard（插件：二次确认后执行）
场景 B：点击连接线 → 「允许修改：a.ts, b.ts, c.ts」→ 复制 → 贴进 Cursor
```

### 2.3 MVP 功能范围（Must Have）

- [ ] 版本时间线 D3 图：泳道、节点、同 commit 虚线、入场动画
- [ ] **版本分页**：横向每页 10 个版本列，全泳道同步翻页
- [ ] **泳道限制**：纵向分页或 filter；单 commit 改 ≥20 文件时聚合显示
- [ ] 点击节点 → **版本详情弹层** + AI 约束 + **回滚双选项（复制命令）**
- [ ] 点击连接线 → 多文件约束 + 复制
- [ ] 悬停 tooltip：hash、author、date、版本号 Vn
- [ ] **一键 Demo 数据**（无 git 也能 30 秒演示）
- [ ] 炫酷深色 UI（见 `ui-plan.md`）
- [ ] 响应式（移动端可用，展示以桌面为主）
- [ ] Header：GitHub Star + 捐赠占位
- [ ] 底部广告位空 div
- [ ] README + AGPL-3.0 LICENSE

### 2.4 MVP 可选增强（Nice to Have，不挡发布）

- [ ] 「本次目标文件」输入框 → 生成更完整的约束块：
  ```
  【文件边界约束】
  只允许修改：src/a.ts
  禁止修改其他任何文件。如需改动其他文件，请先说明理由。
  ```
- [ ] 导出 PNG 截图（方便用户分享）
- [ ] 简单统计：N commits · M files · K links
- [ ] Waitlist 邮件收集（Google Form / 第三方，无后端）

### 2.5 MVP 明确不做

- ❌ 仓库 URL / SSH 配置
- ❌ 后端、数据库、用户登录
- ❌ 网页内 **执行** git 回滚（仅复制命令；**执行**留给 Phase 2 插件）
- ❌ IDE 插件（单独仓库，Phase 2 再开）
- ❌ Marketplace 发布

### 2.6 技术栈

| 项 | 选择 |
|----|------|
| 前端 | 原生 HTML / CSS / JS，无构建 |
| 可视化 | D3.js v7（CDN） |
| 部署 | GitHub Pages / Cloudflare Pages / 任意静态托管 |
| 许可 | AGPL-3.0 |

### 2.7 交付物

| 文件 | 说明 |
|------|------|
| `index.html` | 主页面 |
| `style.css` | 样式（可内联） |
| `script.js` | 解析 + 渲染 + 交互（可内联） |
| `demo-data.js` 或内联常量 | Demo git log |
| `LICENSE` | AGPL-3.0 全文 |
| `README.md` | 使用说明、截图、标语 |
| `ui-plan.md` | UI 设计规格（已有） |
| `plan.md` | 本文件 |

`extension/` 文件夹 **Phase 1 不创建**。

### 2.8 开发任务（Phase 1 Checklist）

#### 基础（Day 1）

- [ ] **1.1** 项目骨架：`index.html` + 引入 D3 + Google Fonts
- [ ] **1.2** Design tokens + 全局背景 + Header（`ui-plan.md` UI-1/UI-2）
- [ ] **1.3** Hero 空态 + Demo 按钮 + 输入 textarea
- [ ] **1.4** `parseGitLog(text)` + 边界处理 + 2–3 份测试样例
- [ ] **1.5** `buildGraphModel()` → lanes / nodes / links

#### 可视化（Day 2）

- [ ] **2.1** D3 泳道 + 标签 + 版本时间轴（右 = 最新）
- [ ] **2.2** 节点绘制 + hover tooltip（含 Vn 版本号）
- [ ] **2.3** 连接线贝塞尔 + 虚线流动动画
- [ ] **2.4** 入场 stagger 动画 + zoom/pan
- [ ] **2.5** 点击节点/线 → 选中高亮 + dim 其他
- [ ] **2.6** **版本分页**：横向每页 10 列，← → 翻页，全泳道同步
- [ ] **2.7** **泳道分页 / filter**；单 commit 多文件聚合节点

#### 交互与发布（Day 3）

- [ ] **3.1** **版本详情弹层**：commit 信息 + AI 约束 + 回滚双选项
- [ ] **3.2** 回滚命令生成：`checkout -- file` / `reset --hard`（网页仅复制）
- [ ] **3.3** 高危整库回滚：二次确认 UI（输入 `RESET` 或勾选）
- [ ] **3.4** 连接线约束面板 + 复制 + 成功反馈
- [ ] **3.5** 响应式 + 移动 bottom sheet
- [ ] **3.6** 广告位 + 错误态 + 大数据提示
- [ ] **3.7** LICENSE + README（含演示 GIF 占位）
- [ ] **3.8** 部署 GitHub Pages + 录 30s 演示 GIF
- [ ] **3.9** 全流程自测（见 §7 测试清单）

**工期**：约 3 天（单人）

### 2.9 发布与传播计划

| 渠道 | 内容 |
|------|------|
| GitHub README | 标语 + GIF + 3 步用法 + Star CTA |
| GitHub Pages | 在线 demo 链接 |
| Twitter/X | 30s 视频：Demo → 点线 → 复制约束 |
| HN / Reddit r/cursor / V2EX | 「Tool to lock AI to specific files using git history」 |
| Product Hunt（可选） | Phase 1 稳定后 |

**README 里预埋 Phase 2**：  
「Want auto git log + IDE hook? → Star & join waitlist」

---

## 3. Phase 1 验证：什么时候做插件

### 3.1 核心问题

> 有没有「大量用户」需要锁 AI 文件边界？

网页 MVP 不追求付费，追求 **需求信号**。

### 3.2 观测指标（建议 4–8 周）

| 指标 | 门槛（示例，可按实际情况调整） | 含义 |
|------|-------------------------------|------|
| GitHub Stars | ≥ 200 | 基础传播力 |
| 独立访客（Pages 分析） | ≥ 2,000 | 真实触达 |
| Demo → 粘贴自有 log 比例 | ≥ 15% | 非只看热闹 |
| Issue / 私信 / 问卷反馈 | ≥ 20 条有效反馈 | 定性需求 |
| 「想要 IDE 插件」提及次数 | ≥ 10 | 直接验证 Phase 2 |
| 「想要 AI 改完自动检测」提及 | ≥ 5 | 验证 Phase 3 |

### 3.3 达标 → 启动 Phase 2

- 开独立仓库 `horsewhip-extension`
- 复用 Phase 1 的 `parseGitLog` + D3 渲染逻辑
- README 留 Waitlist → 通知早期用户内测

### 3.4 未达标 → 调整方向

| 信号 | 可能结论 | 动作 |
|------|----------|------|
| 看的人多，Star 少 | 概念有趣，体验不够/immediate | 加强 Demo、加「目标文件」输入 |
| Star 有，无反馈 | 玩具感，非刚需 | 访谈 5 个用户，问愿否装插件 |
| 反馈「粘贴 log 太烦」 | 刚需存在，摩擦在流程 | **提前 Phase 2** |
| 反馈「复制 prompt 够用」 | 事前约束已满足 | Phase 3 降级或不做 |
| 完全没流量 | 定位或渠道问题 | 换叙事角度，不急着做插件 |

---

## 4. Phase 2 — IDE 插件 v1（验证通过后）

### 4.1 目标

把 Phase 1 的体验 **搬进 Cursor / VS Code**，去掉「手动粘贴 log」摩擦。

### 4.2 用户旅程

```
在 Cursor 打开 git 仓库
        ↓
命令面板：Horsewhip: Show File Evolution
        ↓
插件自动：git log -100 --name-only --pretty=format:"%H|%an|%ad"
        ↓
Webview 展示同款星图
        ↓
用户输入「本次目标文件：src/a.ts」
        ↓
点击「插入约束到 Chat」→ prompt 进入 AI 对话框
        ↓
AI 编程（事前约束已生效）
```

### 4.3 功能范围

- [ ] VS Code Extension（Cursor 兼容）
- [ ] 本地 `git log` 自动获取（**非 SSH**）
- [ ] Webview 嵌入 Phase 1 可视化
- [ ] **执行回滚**：单文件 `git checkout` / 整库 `git reset --hard`（高危二次确认）
- [ ] 「本次目标文件」输入 + 约束 prompt 模板
- [ ] 一键复制 / 插入 Chat（视 API 可用性）
- [ ] `.vsix` 本地安装 + 内测
- [ ] Marketplace 发布（可选，建议内测 2 周后再上）

### 4.4 仓库结构（独立 repo）

```
horsewhip-extension/
├── package.json
├── src/
│   ├── extension.ts
│   ├── gitRunner.ts
│   ├── gitLogParser.ts      ← 从网页版移植
│   └── webview/
│       ├── panel.html
│       ├── panel.js         ← D3 渲染，与网页同源
│       └── panel.css
├── media/
└── README.md
```

### 4.5 工期估算

约 **5–7 天**（含 Webview 联调、打包、文档）

### 4.6 Phase 2 验证指标

| 指标 | 门槛（示例） |
|------|-------------|
| 内测安装 | ≥ 50 |
| 周活跃使用 | ≥ 20 |
| 「想要自动检测越界」反馈 | ≥ 8 → 启动 Phase 3 |

---

## 5. Phase  / 3 — IDE 插件完整版（守门 Hook）

### 5.1 目标

实现你最初描述的闭环：

```
用户：改 A
AI 实际改了：A, B, C
马鞭：越界！→ 生成纠正 prompt，可选 block commit
```

### 5.2 核心逻辑（不复杂）

```javascript
const allowed = userDeclaredFiles;          // ['src/a.ts']
const actual  = gitDiffChangedFiles();      // ['src/a.ts', 'src/b.ts', 'src/c.ts']
const overreach = actual.filter(f => !allowed.includes(f));

if (overreach.length) {
  prompt = `用户仅要求修改：${allowed.join(', ')}
            检测到额外修改：${overreach.join(', ')}
            请 revert 这些文件，或说明必要性。`;
}
```

难点不在 prompt，在 **触发时机与 IDE 集成**。

### 5.3 Hook 触发点（按实现难度排序）

| 触发点 | 难度 | 体验 | 推荐 |
|--------|------|------|------|
| 用户手动 Run「检查越界」 | 低 | 需记得点 | Phase 3 首发 |
| 保存文件时（`onDidSaveTextDocument`） | 中 | 较实时 | v1.1 |
| AI 对话轮次结束（若 API 开放） | 高 | 最佳 | 视 Cursor API |
| git commit 前 hook | 中 | 偏晚 | 可选 |

**建议**：Phase 3 先做 **手动检查 + 保存时轻量提示**，再迭代 AI 轮次 hook。

### 5.4 功能范围

- [ ] 用户声明 allowlist（单文件 / 多文件）
- [ ] `git diff` / workspace 变更对比
- [ ] 越界面板 + 纠正 prompt 一键复制/插入
- [ ] Status bar 指示：🟢 边界内 / 🔴 越界 N 个文件
- [ ] 可选：越界时 git checkout 还原指定文件（需确认对话框）
- [ ] 设置项：strict mode / warn only

### 5.5 工期估算

在 Phase 2 基础上再加 **7–10 天**。

---

## 6. 技术架构

### 6.1 Phase 1 数据流

```
粘贴 git log 文本
        ↓
   parseGitLog(rawText)
        ↓
{ commits, fileTimelines }   // 全量缓存于内存
        ↓
   sliceByPage(page, pageSize=10)   // 横向：版本列分页
   filterLanes / aggregateNodes     // 纵向：泳道限制
        ↓
   buildGraphModel(slice)
        ↓
   renderWithD3(svg, model)
        ↓
点击节点 → 版本弹层 → 约束 prompt / 回滚命令 → clipboard（网页）或 exec（插件）
```

### 6.2 核心数据结构

```javascript
// 解析结果
{
  commits: [
    { hash, author, date, files: ["src/a.js", "src/b.js"] }
  ],
  fileTimelines: {
    "src/a.js": [{ commitHash, date }]
  }
}

// 图形模型
{
  lanes: [{ filePath, y }],
  nodes: [{ hash, filePath, x, y, author, date, versionIndex }],  // versionIndex = V1,V2…
  links: [{ commitHash, nodeIds, files }],
  pagination: { page, pageSize: 10, totalVersions }
}

// Phase 3 守门模型
{
  declaredAllowlist: ["src/a.ts"],
  actualChanged:     ["src/a.ts", "src/b.ts"],
  overreach:         ["src/b.ts"]
}
```

### 6.3 约束 Prompt 模板

**单文件（点击节点 / 声明目标）**

```
【马鞭 · 文件边界约束】
只允许修改：src/a.ts
禁止修改仓库内其他任何文件。
若必须改动其他文件，请先停下并说明理由，待确认后再继续。
```

**多文件（点击连接线 / 历史共变）**

```
【马鞭 · 文件边界约束】
允许修改：src/a.ts, src/b.ts, src/types.ts
（以上文件在该仓库历史中常于同一 commit 内共变）
禁止修改上述范围以外的文件。
```

**回滚 · 仅当前文件（选项 ①）**

```bash
git checkout abc123f -- src/a.ts
```

**回滚 · 整个仓库（选项 ② · 高危）**

```bash
# ⚠️ 将丢失 abc123f 之后的所有未提交/已提交本地改动，请先备份或 stash
git reset --hard abc123f
```

网页版：弹层展示命令 +「复制」；插件版：确认后 `child_process` / VS Code git API 执行。

**越界纠正（Phase 3）**

```
【马鞭 · 越界纠正】
用户明确要求只修改：src/a.ts
检测到额外改动：src/b.ts, src/c.ts
请立即 revert src/b.ts 和 src/c.ts 的变更，仅保留对 src/a.ts 的修改。
```

### 6.5 分页与性能策略

| 维度 | 策略 | 默认值 |
|------|------|--------|
| **横向（版本）** | 全泳道同步，每页 N 个版本列；← → 从内存 slice 重渲染 | N = 10 |
| **纵向（文件）** | 泳道分页或搜索 filter；避免一次渲染 100+ 行 | 每页 30 泳道 |
| **单 commit 多文件** | ≥20 文件时显示聚合节点「N files」，点击展开 | 阈值 20 |
| **解析** | 粘贴一次，全量 parse 进内存；翻页不重新 parse | 建议 log ≤100 commits |

往前翻页 = 从缓存取上一 slice **重新 render**（不重新粘贴 log）。

### 6.6 推荐 Git 命令

```bash
# MVP 推荐（最近 100 条；展示分页，每页 10 版本列）
git log -100 --name-only --pretty=format:"%H|%an|%ad"

# 全历史
git log --name-only --pretty=format:"%H|%an|%ad"

# 指定范围
git log main..HEAD --name-only --pretty=format:"%H|%an|%ad"
```

---

## 7. 测试清单

### 7.1 Phase 1 必测

- [ ] Demo 一键加载 → 图正常渲染
- [ ] 粘贴真实 log → 解析正确
- [ ] 版本分页：← → 翻页，每页 10 列，全泳道同步
- [ ] 点击节点 → 版本弹层 + 回滚双选项命令正确
- [ ] 高危整库回滚：二次确认 UI 出现
- [ ] 单 commit 多文件 → 连接线或聚合节点
- [ ] 点击连接线 → 多文件约束正确
- [ ] 复制在 Chrome / Firefox / Safari 可用
- [ ] 50 commits × 30 files 性能可接受
- [ ] 移动端布局不崩
- [ ] `prefers-reduced-motion` 动画关闭
- [ ] 空输入 / 错误格式有提示

### 7.2 Phase 2 追加

- [ ] 非 git 目录友好报错
- [ ] 大 repo `-n 100` 不卡死
- [ ] Webview CSP 下 D3 正常

### 7.3 Phase 3 追加

- [ ] 声明 A，只改 A → 不告警
- [ ] 声明 A，改 A+B → 越界告警
- [ ] 纠正 prompt 内容准确
- [ ] strict / warn 模式切换

---

## 8. 风险与对策

| 风险 | 阶段 | 对策 |
|------|------|------|
| MVP 没人用 | P1 | 炫酷 Demo + 清晰标语 + 多渠道发布 |
| 粘贴 log 门槛高 | P1→P2 | 反馈够多则提前做插件 |
| 事前约束不够用 | P2→P3 | 做 diff hook |
| 超大 repo 卡顿 | 全阶段 | 默认 `-50`/`-100` commits |
| clipboard 在 file:// 受限 | P1 | README 建议 GitHub Pages |
| Cursor API 不开放 | P3 | 降级为手动检查 + onSave |
| 代码重复（网页 vs 插件） | P2 | 解析器单文件，复制或抽 shared |
| 过早做 SSH/后端 | 全阶段 | **明确禁止**，直到有付费需求 |

---

## 9. 里程碑总览

| 里程碑 | 内容 | 工期 | 前置条件 |
|--------|------|------|----------|
| **M1** | Phase 1 网页 MVP 开发完成 | 3 天 | — |
| **M2** | 部署 + GIF + 首发传播 | 1 天 | M1 |
| **M3** | 验证窗口（收集 4–8 周数据） | 4–8 周 | M2 |
| **M4** | Go/No-Go 决策 | 1 天 | M3 |
| **M5** | Phase 2 插件 v1 | 5–7 天 | M4 达标 |
| **M6** | Phase 2 内测 + 迭代 | 2–4 周 | M5 |
| **M7** | Phase 3 守门 Hook | 7–10 天 | M6 反馈 |
| **M8** | Marketplace 正式版 | 3–5 天 | M7 稳定 |

---

## 10. 当前行动项（只做 Phase 1）

```
本周
├── [ ] 按 ui-plan.md 实现炫酷网页
├── [ ] 内置 Demo 数据 + 30s 演示路径
├── [ ] LICENSE + README
└── [ ] 部署 GitHub Pages

验证期（MVP 上线后）
├── [ ] 配置 GitHub Stars / Pages 访问统计
├── [ ] README 加 Waitlist 链接
├── [ ] 收集 Issue 模板（反馈 / 功能请求）
└── [ ] 4–8 周后做 Go/No-Go

暂不做
├── [ ] extension/ 文件夹
├── [ ] SSH / 后端
└── [ ] AI hook
```

---

## 11. 相关文档

| 文档 | 用途 |
|------|------|
| [`README.md`](./README.md) | **项目入口**：文件依赖、新窗口恢复上下文、进度快照 |
| [`plan.md`](./plan.md) | 产品分期、验证标准、任务清单（本文件） |
| [`ui-plan.md`](./ui-plan.md) | 网页 MVP 视觉与交互规格 |
| [`work-log.md`](./work-log.md) | 工作日志：任务状态、完成日期、进度追踪 |

---

*文档版本：2.1 | 策略：MVP 验证 → 插件 v1（含回滚执行）→ 守门完整版 | 最后更新：2026-05-24*
