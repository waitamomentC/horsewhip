import * as path from 'path';
import * as vscode from 'vscode';

const EXCLUDE_GLOB = '**/{node_modules,.git,dist,build,out,.vscode,extension}/**';

/** 工作区内相对路径（与资源管理器层级一致），用于插件左侧目录泳道。 */
export async function collectWorkspaceRelPaths(): Promise<string[]> {
  const folder = vscode.workspace.workspaceFolders?.[0];
  if (!folder) return [];

  const uris = await vscode.workspace.findFiles(
    new vscode.RelativePattern(folder, '**/*'),
    EXCLUDE_GLOB,
    3000,
  );

  const root = folder.uri.fsPath;
  const paths = uris
    .map((uri) => {
      const rel = path.relative(root, uri.fsPath);
      if (!rel || rel.startsWith('..') || path.isAbsolute(rel)) return null;
      return rel.split(path.sep).join('/');
    })
    .filter((p): p is string => !!p && !p.endsWith('/'));

  return [...new Set(paths)].sort((a, b) => a.localeCompare(b));
}

export function subscribeWorkspaceFiles(onChange: () => void): vscode.Disposable {
  const fire = () => {
    void onChange();
  };
  return vscode.Disposable.from(
    vscode.workspace.onDidCreateFiles(fire),
    vscode.workspace.onDidDeleteFiles(fire),
    vscode.workspace.onDidRenameFiles(fire),
    vscode.workspace.onDidChangeWorkspaceFolders(fire),
  );
}
