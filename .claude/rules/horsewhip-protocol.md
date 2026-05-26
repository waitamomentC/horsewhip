# 马鞭 Git 协作协议（Claude Code 自动加载）

本文件位于 `.claude/rules/`，**Claude Code 每次开会话都会读**，无需在对话里 `@` 或重复说明。

马鞭是 **AI 边界可视化**：时间轴靠 **commit** 出节点，分支栏靠 **`feature/*` 命名** 可读。请严格遵守下列规则。

---

## 1. 每轮任务结束：必须 commit

- 完成一轮用户可验收的修改后，**必须** `git commit`，禁止只改工作区不提交。
- 说明须写清用户改了什么，禁止空泛的 `update` / `wip`。

```bash
git add -A   # 或仅马鞭「本次边界」内的文件
git commit -m "<type>: <与用户任务一致的说明>"
```

| type | 用途 |
|------|------|
| `feat` | 新功能 / 新方案 |
| `fix` | 修 bug |
| `refactor` | 边界内重构 |
| `docs` | 仅文档 |
| `merge` | 多分支融合回 main |

---

## 2. 有 origin：必须 push

```bash
git remote get-url origin 2>/dev/null
```

- **有 `origin` 且可访问** → commit 后 **必须** `git push`（新分支用 `git push -u origin HEAD`）
- **无 origin** 或用户明确不要 push → 只 commit
- push 失败 → 如实告知用户，不得谎称完成

---

## 3. 新建实验分支：只用 `feature/`

```text
feature/<简短描述>     ✅
TA、readme-update      ❌ 禁止
```

```bash
git checkout main    # 或 master
git pull --ff-only   # 若有 origin
git checkout -b feature/<name>
```

- 实验在 `feature/*` 上做；**融合回 `main` / `master`**
- 不要另造与马鞭无关的分支名

---

## 4. 先边界，后改码

- 用户通过马鞭给出「本次边界」或 Chat 约束时，**只改边界内路径**
- 不得夹带无关文件

---

## 5. 与马鞭 UI 的配合

1. 确认边界 → 2. `feature/*` 上改码 → 3. commit → 4. push（若有 origin）
5. 用户在马鞭看多分支 → 6. 多选融合 → 7. 在 main 择优合并 → 8. 再 commit + push
9. 用户刷新马鞭，在主泳道观察

---

## 6. 完成前自检

- [ ] 已 commit，说明与改动一致？
- [ ] 有 origin 则已 push？
- [ ] 新分支是否为 `feature/…`？
- [ ] 未越出边界？

全部勾选后再向用户报告完成。

---

完整说明（含 Cursor 等）：仓库根目录 [`AGENTS.md`](../../AGENTS.md)
