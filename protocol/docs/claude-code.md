# Claude Code 与 Horsewhip（安装与冲突说明）

> **协议正文**：[`../AGENTS.md`](../AGENTS.md)（安装后位于用户项目根目录 `AGENTS.md`）。

---

## 核心结论

| 文件 | 谁写 | Horsewhip 会不会覆盖 |
|------|------|----------------------|
| **`CLAUDE.md`** | 你 / 其他模板 | **默认不碰** |
| **`.claude/rules/horsewhip-protocol.md`** | Horsewhip 安装 | Git + 文件边界 |
| **`AGENTS.md`** | Horsewhip | 与 rules 正文一致 |

**冲突优先级**：泳道边界文案 > Git/边界（Horsewhip）> 构建/架构（你的 `CLAUDE.md`）。

---

## 三种情况

### ① 新项目

```bash
curl -fsSL https://raw.githubusercontent.com/waitamomentC/horsewhip/experiment/per-folder-version/protocol/scripts/install-claude-horsewhip.sh | bash -s -- . --with-claude-md
```

### ② 已有 `CLAUDE.md`（推荐）

```bash
curl -fsSL https://raw.githubusercontent.com/waitamomentC/horsewhip/experiment/per-folder-version/protocol/scripts/install-claude-horsewhip.sh | bash -s -- .
```

加指针：`…/install-claude-horsewhip.sh . --snippet` 或 `--append-snippet`

### ③ 已有其他 `.claude/rules/*.md`

可共存；Git/边界冲突时以 Horsewhip 为准。

---

## 安装脚本

```bash
# 在 horsewhip 仓库内
./protocol/scripts/install-claude-horsewhip.sh /path/to/your-project

# 离线
HW_REPO=/path/to/horsewhip ./protocol/scripts/install-claude-horsewhip.sh /path/to/project --offline
```

| 选项 | 作用 |
|------|------|
| （默认） | `AGENTS.md` + `.claude/rules/horsewhip-protocol.md` |
| `--with-claude-md` | 无 `CLAUDE.md` 时创建模板 |
| `--snippet` / `--append-snippet` | 给已有 `CLAUDE.md` 加短指针 |

根目录 [`scripts/install-claude-horsewhip.sh`](../../scripts/install-claude-horsewhip.sh) 为同名包装，便于旧链接。

---

## 验证

```bash
claude
```

问：「Git 和 CLAUDE.md 冲突听谁的？」→ Git/边界听 Horsewhip。

插件守门见 [`../../docs/boundary-guard.md`](../../docs/boundary-guard.md)。
