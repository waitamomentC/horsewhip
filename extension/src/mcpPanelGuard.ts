import { readAllowlistRecord } from './boundaryPersist';

export async function isMcpAgentPanelLock(workspaceRoot: string): Promise<boolean> {
  const rec = await readAllowlistRecord(workspaceRoot);
  return Boolean(rec?.locked && rec.lockSource === 'mcp' && (rec.allowed?.length ?? 0) > 0);
}

function normalizePaths(files: string[]): string[] {
  return [...new Set(
    files
      .map((f) => String(f || '').replace(/\\/g, '/').replace(/^\.\/+/, '').trim())
      .filter(Boolean),
  )].sort((a, b) => a.localeCompare(b));
}

export function sameAllowlistPaths(a: string[], b: string[]): boolean {
  const left = normalizePaths(a);
  const right = normalizePaths(b);
  if (left.length !== right.length) return false;
  return left.every((p, i) => p === right[i]);
}

export async function shouldBlockWebviewBoundaryChange(
  workspaceRoot: string,
  incoming: { locked: boolean; files: string[] },
): Promise<{ block: boolean; currentFiles: string[] }> {
  const active = await isMcpAgentPanelLock(workspaceRoot);
  if (!active) return { block: false, currentFiles: [] };
  const rec = await readAllowlistRecord(workspaceRoot);
  const currentFiles = rec?.allowed ?? [];
  if (!incoming.locked) return { block: true, currentFiles };
  if (!sameAllowlistPaths(incoming.files, currentFiles)) {
    return { block: true, currentFiles };
  }
  return { block: false, currentFiles };
}

export const MCP_PANEL_READONLY_MSG =
  'Agent 圈定中：泳道为只读。请等 Agent 完成（task_complete / unlock）后再改边界或解锁。';
