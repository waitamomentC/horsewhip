import { execFile } from 'child_process';
import { promisify } from 'util';

const execFileAsync = promisify(execFile);

export function sanitizeRepoName(name: string): string {
  const cleaned = name.trim().replace(/[^a-zA-Z0-9._-]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
  return cleaned || 'project';
}

export async function getRemoteUrl(cwd: string): Promise<string | null> {
  try {
    const { stdout } = await execFileAsync('git', ['remote', 'get-url', 'origin'], { cwd, timeout: 10_000 });
    return stdout.trim() || null;
  } catch {
    return null;
  }
}

export async function currentBranch(cwd: string): Promise<string> {
  try {
    const { stdout } = await execFileAsync('git', ['branch', '--show-current'], { cwd, timeout: 10_000 });
    return stdout.trim() || 'main';
  } catch {
    return 'main';
  }
}

export async function ghAvailable(): Promise<boolean> {
  try {
    await execFileAsync('gh', ['auth', 'status'], { timeout: 10_000 });
    return true;
  } catch {
    return false;
  }
}

export async function getGhUsername(): Promise<string | null> {
  try {
    const { stdout } = await execFileAsync('gh', ['api', 'user', '-q', '.login'], { timeout: 15_000 });
    return stdout.trim() || null;
  } catch {
    return null;
  }
}

export function buildSshRemoteUrl(githubUser: string, repoName: string): string {
  return `git@github.com:${githubUser.trim()}/${sanitizeRepoName(repoName)}.git`;
}

export async function createRepoWithGh(cwd: string, repoName: string): Promise<string> {
  const name = sanitizeRepoName(repoName);
  await execFileAsync('gh', [
    'repo', 'create', name, '--public', '--source=.', '--remote=origin', '--push', '--git-protocol', 'ssh',
  ], { cwd, timeout: 180_000 });
  const url = await getRemoteUrl(cwd);
  if (!url) throw new Error('仓库已创建，但无法读取 origin 地址');
  return url;
}

export async function createRepoWithToken(
  token: string,
  repoName: string,
  isPrivate = false,
): Promise<{ sshUrl: string; htmlUrl: string }> {
  const name = sanitizeRepoName(repoName);
  const res = await fetch('https://api.github.com/user/repos', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token.trim()}`,
      Accept: 'application/vnd.github+json',
      'Content-Type': 'application/json',
      'User-Agent': 'horsewhip-vscode',
    },
    body: JSON.stringify({ name, private: isPrivate, auto_init: false }),
  });
  const body = await res.json() as { message?: string; ssh_url?: string; html_url?: string; full_name?: string };
  if (!res.ok) {
    throw new Error(body.message || `GitHub API 错误 (${res.status})`);
  }
  if (!body.ssh_url) {
    throw new Error('GitHub 未返回 SSH 地址');
  }
  return { sshUrl: body.ssh_url, htmlUrl: body.html_url || `https://github.com/${body.full_name}` };
}

export async function setRemoteOrigin(cwd: string, url: string): Promise<void> {
  try {
    await execFileAsync('git', ['remote', 'get-url', 'origin'], { cwd, timeout: 10_000 });
    await execFileAsync('git', ['remote', 'set-url', 'origin', url], { cwd, timeout: 10_000 });
  } catch {
    await execFileAsync('git', ['remote', 'add', 'origin', url], { cwd, timeout: 10_000 });
  }
}

export async function pushOrigin(cwd: string, branch?: string): Promise<void> {
  const b = branch || await currentBranch(cwd);
  await execFileAsync('git', ['push', '-u', 'origin', b], { cwd, timeout: 180_000 });
}
