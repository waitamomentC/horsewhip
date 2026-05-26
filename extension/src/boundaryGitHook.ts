import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';
import { hooksDirPath, preCommitGuardScriptPath } from './boundaryPersist';

const HOOK_BEGIN = '# horsewhip-guard-begin';
const HOOK_END = '# horsewhip-guard-end';
const USER_HOOK_RUNNER = [
  '# --- preserved user pre-commit ---',
  'if [ -f "$(git rev-parse --show-toplevel)/.git/hooks/pre-commit.user" ]; then',
  '  sh "$(git rev-parse --show-toplevel)/.git/hooks/pre-commit.user" "$@" || exit 1',
  'fi',
].join('\n');

function preCommitHookPath(workspaceRoot: string): string {
  return path.join(workspaceRoot, '.git', 'hooks', 'pre-commit');
}

function hookRunnerBlock(): string {
  return [
    '#!/bin/sh',
    HOOK_BEGIN,
    'ROOT="$(git rev-parse --show-toplevel)"',
    'GUARD="$ROOT/.horsewhip/hooks/pre-commit-guard.mjs"',
    'if [ -f "$GUARD" ]; then',
    '  node "$GUARD" "$ROOT" || exit 1',
    'fi',
    HOOK_END,
  ].join('\n');
}

function stripHorsewhipBlock(content: string): string {
  const begin = content.indexOf(HOOK_BEGIN);
  if (begin < 0) return content.trim();
  const end = content.indexOf(HOOK_END, begin);
  if (end < 0) return content.trim();
  let after = end + HOOK_END.length;
  while (after < content.length && (content[after] === '\n' || content[after] === '\r')) after += 1;
  const before = content.slice(0, begin).trim();
  const tail = content.slice(after).trim();
  return [before, tail].filter(Boolean).join('\n\n');
}

async function resolveGuardScriptUri(extensionUri: vscode.Uri): Promise<vscode.Uri> {
  const media = vscode.Uri.joinPath(extensionUri, 'media', 'pre-commit-guard.mjs');
  const scripts = vscode.Uri.joinPath(extensionUri, 'scripts', 'pre-commit-guard.mjs');
  for (const uri of [media, scripts]) {
    try {
      await vscode.workspace.fs.stat(uri);
      return uri;
    } catch {
      /* try next */
    }
  }
  throw new Error(
    '找不到 pre-commit-guard.mjs（请在本仓库执行 node extension/scripts/sync-web-assets.js 后重新编译插件）',
  );
}

export async function installHorsewhipPreCommitHook(
  extensionUri: vscode.Uri,
  workspaceRoot: string,
): Promise<void> {
  const srcScript = await resolveGuardScriptUri(extensionUri);
  const hooksDir = hooksDirPath(workspaceRoot);
  const destScript = preCommitGuardScriptPath(workspaceRoot);
  await fs.promises.mkdir(hooksDir, { recursive: true });
  await fs.promises.copyFile(srcScript.fsPath, destScript);
  await fs.promises.chmod(destScript, 0o755);

  const hookPath = preCommitHookPath(workspaceRoot);
  const hooksGitDir = path.dirname(hookPath);
  await fs.promises.mkdir(hooksGitDir, { recursive: true });

  let existing = '';
  try {
    existing = await fs.promises.readFile(hookPath, 'utf8');
  } catch {
    /* new */
  }

  let tail = '';
  let runUserHook = false;

  if (existing) {
    if (existing.includes(HOOK_BEGIN)) {
      tail = stripHorsewhipBlock(existing);
    } else {
      const backup = path.join(hooksGitDir, 'pre-commit.user');
      await fs.promises.writeFile(backup, existing, { mode: 0o755 });
      runUserHook = true;
    }
  }

  const parts = [hookRunnerBlock()];
  if (runUserHook) parts.push(USER_HOOK_RUNNER);
  if (tail) parts.push(tail);
  const body = `${parts.join('\n\n')}\n`;
  await fs.promises.writeFile(hookPath, body, { mode: 0o755 });

  if (!(await isHorsewhipPreCommitHookInstalled(workspaceRoot))) {
    throw new Error('pre-commit 钩子写入后校验失败');
  }
}

export async function isHorsewhipPreCommitHookInstalled(workspaceRoot: string): Promise<boolean> {
  try {
    const hook = await fs.promises.readFile(preCommitHookPath(workspaceRoot), 'utf8');
    return hook.includes(HOOK_BEGIN) && fs.existsSync(preCommitGuardScriptPath(workspaceRoot));
  } catch {
    return false;
  }
}
