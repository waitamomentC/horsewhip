import * as path from 'path';
import * as vscode from 'vscode';

function relPathFromWorkspace(uri: vscode.Uri, workspaceRoot: string): string | undefined {
  if (uri.scheme !== 'file') return undefined;
  const rel = path.relative(workspaceRoot, uri.fsPath);
  if (!rel || rel.startsWith('..') || path.isAbsolute(rel)) return undefined;
  return rel.split(path.sep).join('/');
}

function uriFromTab(tab: vscode.Tab): vscode.Uri | undefined {
  const input = tab.input;
  if (input instanceof vscode.TabInputText) return input.uri;
  if (input instanceof vscode.TabInputTextDiff) return input.modified;
  if (input instanceof vscode.TabInputCustom) return input.uri;
  return undefined;
}

/** Paths relative to workspace root, tab order (deduped). */
export function collectOpenWorkspaceRelPaths(workspaceRoot: string): string[] {
  const ordered: string[] = [];
  const seen = new Set<string>();

  const push = (uri: vscode.Uri | undefined) => {
    const rel = uri ? relPathFromWorkspace(uri, workspaceRoot) : undefined;
    if (!rel || seen.has(rel)) return;
    seen.add(rel);
    ordered.push(rel);
  };

  for (const group of vscode.window.tabGroups.all) {
    for (const tab of group.tabs) {
      push(uriFromTab(tab));
    }
  }

  for (const ed of vscode.window.visibleTextEditors) {
    push(ed.document.uri);
  }

  return ordered;
}

export function subscribeOpenWorkspaceFiles(
  workspaceRoot: string,
  onChange: (paths: string[]) => void,
): vscode.Disposable {
  const fire = () => onChange(collectOpenWorkspaceRelPaths(workspaceRoot));
  fire();
  return vscode.Disposable.from(
    vscode.window.onDidChangeActiveTextEditor(() => fire()),
    vscode.window.onDidChangeVisibleTextEditors(() => fire()),
    vscode.workspace.onDidCloseTextDocument(() => fire()),
    vscode.window.tabGroups.onDidChangeTabs(() => fire()),
  );
}
