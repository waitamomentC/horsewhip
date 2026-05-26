# 马鞭 · Horsewhip

> **For that horse that keeps trampling your codebase**  
> **不是 Git 图，是 AI 改代码前的边界尺。**

马鞭是为 **AI 协作** 而生的可视化方案：帮你在动手前看清「哪条文件泳道、哪一版、哪条实验线」，用 **挥鞭** 划定允许修改的范围，再把多条实验 **收束回主泳道**。  
Git 只负责记录版本；马鞭不负责教你 merge，也不和 GitGraph 比谁更「专业」。

**仓库**：<https://github.com/waitamomentC/horsewhip>

![screenshot placeholder](./docs/screenshot.png)

---

## 我们解决什么问题

在 Cursor / Copilot 等环境里，常见情况是：

- 你只想让 AI 改 `A`，它却动了 `B`、`C`
- 你在分支上试了多个方案，都想 **先留着**，再 **择优融回主线**
- 你需要一句可复制的约束：`只允许修改：…`，而不是自己写小作文

马鞭做三件事：

| 时机 | 马鞭做什么 |
|------|------------|
| **事前** | 在时间轴上选节点 / 选分支 → 生成 **文件边界约束** → 插入 Chat |
| **并行实验** | 分支栏保留 A/B/C → 多选 → **AI 融合 → 主泳道** 任务文案 |
| **事后观察** | 融合 commit 后刷新，在主泳道继续看各文件 **第几版（Vn）**、**第几次上传（Cn）** |

---

## 马鞭 ≠ GitGraph ≠ 传统 Git 客户端

| | GitGraph / 传统 Git 可视化 | 马鞭 |
|---|---------------------------|------|
| **核心问题** | 仓库拓扑、分支怎么合 | **AI 会不会改飞、改出界** |
| **横轴** | commit / 时间线 | **上传序 Cn**（一次提交 = 一列） |
| **纵轴** | 分支线 | **文件 / 文件夹泳道** + 分支栏 |
| **用户要懂** | DAG、merge、parent | **「只动这些路径、这些版本」** |
| **气质** | 专业、冷静 | **直观 + 挥鞭仪式感（划定边界）** |

**刻意降低 Git 专业性**：界面不说 octopus merge，而说 **实验线、主泳道、融合收束**。底层仍用 `git log`，但你不必成为 Git 专家才能用。

---

## 典型工作流（成品路径）

```
1. 看泳道     每个文件一条线，圆点 = 某次上传改了这个文件
2. 划边界     点节点 →「本次边界」→ 挥鞭复制 / 插入 Chat
3. 留实验     分支 A/B/C 各自迭代，时间轴上 ⎇ 泳道保留
4. 收束融合   分支栏多选 ≥2 →「AI 融合 → 主泳道」→ AI 择优合并
5. 继续观察   commit 后刷新，新结果出现在主泳道，接着用边界约束下一任务
```

**插件（推荐）**：边界可同步为会话 allowlist，减少 AI 越界。  
**网页版**：粘贴 `git log` 或 demo，体验同一套视觉与约束文案。

### 配合 AI：让 Claude / Cursor 自动守规矩

马鞭时间轴依赖 **commit** 出节点、**`feature/*`** 分支名可读。请在你的 **业务项目根目录**（已 `git init`）安装下面协议文件。

#### Claude Code（推荐，会话自动读，不用每次 `@`）

> **注意分支**：协议文件、`CLAUDE.md` 等目前在 **`experiment/per-folder-version`** 分支；`main` 上还没有。  
> 下面 `curl` / `git clone -b …` 已指向该分支；日后合并进 `main` 后，把 URL 里的分支名改成 `main` 即可。

在 **你的项目根目录** 执行（从 GitHub 下载马鞭协议；需联网）：

```bash
cd /path/to/your-project

# 与马鞭仓库当前开发分支一致（合并到 main 后改为 main）
HW_BRANCH=experiment/per-folder-version

mkdir -p .claude/rules

curl -fsSL -o .claude/rules/horsewhip-protocol.md \
  "https://raw.githubusercontent.com/waitamomentC/horsewhip/${HW_BRANCH}/.claude/rules/horsewhip-protocol.md"

curl -fsSL -o CLAUDE.md \
  "https://raw.githubusercontent.com/waitamomentC/horsewhip/${HW_BRANCH}/docs/templates/CLAUDE.horsewhip-user.md"
```

然后编辑根目录 **`CLAUDE.md`**，在文末补上你们项目的构建/测试命令（模板里已留占位）。

验证：

```bash
claude
# 新开会话问：「做完一轮功能后 Git 要做什么？」
# 应回答：必须 commit；有 origin 必须 push；新分支只用 feature/…
```

| 安装结果 | 作用 |
|----------|------|
| `.claude/rules/horsewhip-protocol.md` | 铁律全文（每轮自动加载） |
| `CLAUDE.md` | 项目说明 + 马鞭摘要（每轮自动加载） |

**无 curl / 离线**：克隆马鞭仓库**指定分支**后复制：

```bash
git clone -b experiment/per-folder-version --depth 1 \
  https://github.com/waitamomentC/horsewhip.git /tmp/horsewhip

cd /path/to/your-project
mkdir -p .claude/rules
cp /tmp/horsewhip/.claude/rules/horsewhip-protocol.md .claude/rules/
cp /tmp/horsewhip/docs/templates/CLAUDE.horsewhip-user.md ./CLAUDE.md
```

**整仓下载马鞭（含插件、网页）** 也要带分支，否则默认只有 `main` 上的旧内容：

```bash
git clone -b experiment/per-folder-version https://github.com/waitamomentC/horsewhip.git
cd horsewhip
```

若项目里 **已有** `CLAUDE.md`，不要覆盖；只复制 `horsewhip-protocol.md`，并把模板中的「马鞭」章节合并进现有 `CLAUDE.md`。

更细说明：[docs/claude-code.md](./docs/claude-code.md)

#### Cursor 等

将 [`AGENTS.md`](./AGENTS.md) 放入项目根目录，或在 Cursor **Rules** 中固定引用 / 对话 `@AGENTS.md`。

**铁律（所有工具一致）**：每轮任务结束 **commit**；已配置云端 **`origin` 则 push**；新建实验分支仅 **`feature/<名>`**。

---

## 快速开始

### IDE 插件（推荐）

```bash
cd extension && npm install && npm run sync-assets && npm run compile
```

1. VS Code / Cursor 打开 `extension/` → **F5**
2. 新窗口 **文件 → 打开文件夹**（你的项目，且已 `git init`）
3. 左侧活动栏 **马鞭** 图标 → 打开要关注的文件，侧边栏绘制泳道

详见 [`extension/README.md`](./extension/README.md)。

| 操作 | 说明 |
|------|------|
| 点泳道节点 | 加入「本次边界」（每泳道一个节点） |
| 挥鞭按钮 | 复制约束；音效见 [`media/README.md`](./media/README.md) |
| **插入 Chat** | 把边界约束送进 AI 对话 |
| 分支栏点击 | 勾选待融合分支（main 为落点，不参与多选） |
| **AI 融合 → 主泳道** | 生成多分支择优融合任务（≥2 条分支） |

### 网页版

```bash
open index.html
# 或 python3 -m http.server 8080
```

1. **demo** 或粘贴 log → **generate**
2. 交互与插件一致（无 allowlist / 无自动读 git）

**Git log 格式**（网页粘贴用）：

```bash
git log --all -200 --name-only --pretty=format:"%H|%P|%D|%an|%ad|%s"
```

---

## 视觉模型（直觉优先）

- **横轴 Cn**：全仓库第几次上传（commit），右端更新
- **纵轴**：文件夹 / 文件泳道；**⎇** 行 = 某条实验分支触及的路径
- **泳道 Vn**（实验分支 `experiment/per-folder-version`）：该文件夹自己的第几版，仅在它被改动时 +1
- **挥鞭 / 扫光**：划定边界、发起融合时的反馈，不是装饰

设计规范：[`DESIGN.md`](./DESIGN.md)

---

## 产品边界（我们刻意不做的）

- ❌ 全仓库 DAG 炫技、替代 Git Graph / GitLens
- ❌ 面向 Git 专家的 merge 编辑器教学
- ✅ AI 边界可视化 + 约束生成 + 多分支收束叙事
- ✅ 本地 git 只作数据源（log、checkout、allowlist）

---

## 版本与分支

| 分支 / 版本 | 说明 |
|-------------|------|
| `main` | 较早稳定基线；**尚无** `AGENTS.md` / `CLAUDE.md` / 分支融合等最新功能 |
| `experiment/per-folder-version` | **当前推荐**：每夹 Vn、分支栏、AI 融合、协议文档；插件 `0.6.0-ve.x` |

远程安装协议、`curl` 下载、克隆仓库时，请使用 **`experiment/per-folder-version`**（见上文「配合 AI」）。合并进 `main` 后文档会改为默认 `main`。

---

## 开发索引

| 文件 | 说明 |
|------|------|
| [`CLAUDE.md`](./CLAUDE.md) | **Claude Code 自动读**（无需 @） |
| [`docs/claude-code.md`](./docs/claude-code.md) | 用户项目接入 Claude Code |
| [`AGENTS.md`](./AGENTS.md) | Cursor 等：commit / push / `feature/*` 全文 |
| [`plan.md`](./plan.md) | 三期产品计划（AI 边界为核心） |
| [`work-log.md`](./work-log.md) | 进度 |
| [`ui-plan.md`](./ui-plan.md) | UI 规格历史 |
| [`DESIGN.md`](./DESIGN.md) | 设计规范 |
| `script.js` / `style.css` | 网页与插件 Webview 逻辑（改后 `npm run sync-assets`） |
| [`extension/`](./extension/) | VS Code / Cursor 插件 |

**当前阶段**：Phase 2 插件 — 边界栏、分支栏、多分支融合任务、allowlist；向「AI 边界成品」迭代。

---

## 许可证

[GNU AGPL-3.0](./LICENSE)

*最后更新：2026-05-25*
