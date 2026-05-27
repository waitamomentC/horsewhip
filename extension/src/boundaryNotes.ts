import * as fs from 'fs';
import * as path from 'path';

const GIT_META = path.join('.git', 'horsewhip');
const NOTES_FILE = 'boundary-notes.md';

/** 插件写入工作区的边界说明（本地 Git 元数据，勿提交）。 */
export const HORSEWHIP_BOUNDARY_NOTES_BODY = `# Horsewhip · 边界说明

> 由 Horsewhip 扩展自动维护（\`.git/horsewhip/boundary-notes.md\`）。  
> 守边界靠插件两重鞭子机械执行；本文说明当前圈定与拦截原因。

## 圈地

- **未挥鞭圈定** → **禁止修改**仓库内任何路径。
- **已挥鞭圈定** → **仅允许**修改 \`allowlist.json\` 中列出的路径（及对应 commit/分支）。
- 当前状态：\`.git/horsewhip/allowlist.json\`（\`locked: true\` 且 \`allowed\` 非空才算已圈定）。

## 两重鞭子

| 鞭 | 行为 |
|----|------|
| **挥鞭圈定** | 人在泳道点选节点后挥鞭；不得自行扩大范围。 |
| **写盘守门** | 圈外或未圈定写入 → **立即 git 还原**；见 \`edit-blocked.json\`。 |
| **commit 兜底** | 越界或未圈定 → pre-commit / 面板提交 **拦截**。 |

## 写盘被拦之后

1. **停止**继续改该路径。
2. **请用户在泳道扩大圈定**（点选更大范围后挥鞭），或 **明确口头授权**该路径。
3. 在用户确认并圈定之前：**不要**再次写入、**不要** \`git commit --no-verify\`。

## Git 建议

- 可验收任务完成后由 **用户本人** \`git commit\`；有 \`origin\` 则 \`git push\`。
- 实验分支用 \`feature/<简短名>\`；融合回 \`main\` / \`master\`。

## 机器可读文件

| 文件 | 含义 |
|------|------|
| \`allowlist.json\` | 当前圈定路径、分支、targets |
| \`edit-blocked.json\` | 最近一次写盘被拦 |
| \`commit-blocked.json\` | 最近一次 commit 被拦 |
`;

export function boundaryNotesFilePath(workspaceRoot: string): string {
  return path.join(workspaceRoot, GIT_META, NOTES_FILE);
}

export async function syncHorsewhipBoundaryNotes(workspaceRoot: string): Promise<void> {
  const file = boundaryNotesFilePath(workspaceRoot);
  await fs.promises.mkdir(path.dirname(file), { recursive: true });
  const next = `${HORSEWHIP_BOUNDARY_NOTES_BODY.trim()}\n`;
  try {
    const cur = await fs.promises.readFile(file, 'utf8');
    if (cur === next) return;
  } catch {
    /* write fresh */
  }
  await fs.promises.writeFile(file, next, 'utf8');
}

export function boundaryNotesHintForPrompt(): string {
  return '详见 `.git/horsewhip/boundary-notes.md`。';
}
