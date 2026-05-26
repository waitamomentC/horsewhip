import * as vscode from 'vscode';
import * as path from 'path';
import { isGitRepository, gitInit } from './gitRunner';

export type GateReason = 'no-folder' | 'no-git';

export type WorkspaceReadiness =
  | { ok: true; root: string; folderName: string }
  | { ok: false; reason: GateReason };

/** 当前工作区根目录（优先含活动编辑器的那个文件夹）。 */
export function getWorkspaceRoot(): string | undefined {
  const folders = vscode.workspace.workspaceFolders;
  if (!folders?.length) return undefined;

  const active = vscode.window.activeTextEditor?.document.uri;
  if (active) {
    const wf = vscode.workspace.getWorkspaceFolder(active);
    if (wf) return path.resolve(wf.uri.fsPath);
  }
  return path.resolve(folders[0].uri.fsPath);
}

export function getWorkspaceFolderName(root: string): string {
  return path.basename(root);
}

export async function checkWorkspace(): Promise<WorkspaceReadiness> {
  const root = getWorkspaceRoot();
  if (!root) {
    return { ok: false, reason: 'no-folder' };
  }
  if (!(await isGitRepository(root))) {
    return { ok: false, reason: 'no-git' };
  }
  return { ok: true, root, folderName: getWorkspaceFolderName(root) };
}

/** 不满足条件时弹窗引导；返回可用的仓库根路径或 undefined。 */
export async function ensureWorkspaceReady(): Promise<string | undefined> {
  const state = await checkWorkspace();

  if (state.ok) return state.root;

  if (state.reason === 'no-folder') {
    const pick = await vscode.window.showWarningMessage(
      'Open a folder in VS Code first (File → Open Folder). Horsewhip needs a workspace folder.',
      { modal: true },
      '打开文件夹',
    );
    if (pick === '打开文件夹') {
      await vscode.commands.executeCommand('workbench.action.files.openFolder');
    }
    return undefined;
  }

  const root = getWorkspaceRoot();
  const folderHint = root ? `（${getWorkspaceFolderName(root)}）` : '';
  const pick = await vscode.window.showWarningMessage(
    `This workspace${folderHint} is not a Git repository yet. Run git init in the project root so Horsewhip can read version history.`,
    { modal: true },
    '执行 git init',
    '打开终端',
  );

  if (pick === '执行 git init' && root) {
    try {
      await gitInit(root);
      const again = await isGitRepository(root);
      if (again) {
        vscode.window.showInformationMessage('Git repository initialized — loading Horsewhip…');
        return root;
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      vscode.window.showErrorMessage(`git init 失败：${msg}`);
    }
    return undefined;
  }

  if (pick === '打开终端' && root) {
    const terminal = vscode.window.createTerminal({ cwd: root, name: 'Horsewhip · git init' });
    terminal.show();
    terminal.sendText('git init', true);
  }

  return undefined;
}
