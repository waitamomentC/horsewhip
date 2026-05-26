import { execFile } from 'child_process';
import { promisify } from 'util';

const execFileAsync = promisify(execFile);

const LOG_FORMAT = '%H|%P|%D|%an|%ad|%s';
const LOG_ARGS = ['log', '--all', '--name-only', `--pretty=format:${LOG_FORMAT}`];

export type GitBranchRef = { name: string; hash: string };

export async function fetchGitLog(cwd: string, maxCount = 200): Promise<string> {
  const args = [...LOG_ARGS, `-${maxCount}`];
  const { stdout } = await execFileAsync('git', args, {
    cwd,
    maxBuffer: 16 * 1024 * 1024,
    timeout: 120_000,
  });
  return stdout.trim();
}

/** All local branch tips (refs/heads). */
export async function fetchGitBranches(cwd: string): Promise<GitBranchRef[]> {
  const { stdout } = await execFileAsync(
    'git',
    ['for-each-ref', 'refs/heads', '--sort=refname', '--format=%(refname:short)|%(objectname)'],
    { cwd, timeout: 30_000 },
  );
  const out = [];
  for (const line of stdout.trim().split('\n')) {
    if (!line) continue;
    const pipe = line.indexOf('|');
    if (pipe < 1) continue;
    out.push({ name: line.slice(0, pipe), hash: line.slice(pipe + 1) });
  }
  return out;
}

/** Append single-commit log slices for branch tips missing from the main log window. */
export async function augmentLogWithBranchTips(
  cwd: string,
  logText: string,
  branches: GitBranchRef[],
): Promise<string> {
  if (!logText || !branches.length) return logText;
  const have = new Set();
  for (const line of logText.split('\n')) {
    const m = line.match(/^([0-9a-f]{7,40})\|/i);
    if (m) have.add(m[1]);
  }
  const chunks = [logText];
  for (const b of branches) {
    if (!b.hash || have.has(b.hash)) continue;
    try {
      const { stdout } = await execFileAsync(
        'git',
        ['log', '-1', '--name-only', `--pretty=format:${LOG_FORMAT}`, b.hash],
        { cwd, maxBuffer: 2 * 1024 * 1024, timeout: 30_000 },
      );
      const slice = stdout.trim();
      if (slice) chunks.push(slice);
    } catch { /* skip */ }
  }
  return chunks.filter(Boolean).join('\n\n');
}

export async function gitCheckoutFile(cwd: string, hash: string, filePath: string): Promise<void> {
  await execFileAsync('git', ['checkout', hash, '--', filePath], { cwd, timeout: 60_000 });
}

export async function gitResetHard(cwd: string, hash: string): Promise<void> {
  await execFileAsync('git', ['reset', '--hard', hash], { cwd, timeout: 60_000 });
}

export function isGitRepository(cwd: string): Promise<boolean> {
  return execFileAsync('git', ['rev-parse', '--is-inside-work-tree'], { cwd })
    .then(() => true)
    .catch(() => false);
}

export async function gitInit(cwd: string): Promise<void> {
  await execFileAsync('git', ['init'], { cwd, timeout: 60_000 });
}

export async function gitHasCommits(cwd: string): Promise<boolean> {
  try {
    await execFileAsync('git', ['rev-parse', 'HEAD'], { cwd, timeout: 10_000 });
    return true;
  } catch {
    return false;
  }
}

/** Stage all tracked/untracked files and create a commit. */
export async function gitCommitAll(cwd: string, message: string): Promise<void> {
  await execFileAsync('git', ['add', '-A'], { cwd, timeout: 120_000 });
  await execFileAsync('git', ['commit', '-m', message], { cwd, timeout: 120_000 });
}

export async function getGitConfig(cwd: string, key: string): Promise<string> {
  try {
    const { stdout } = await execFileAsync('git', ['config', '--get', key], { cwd, timeout: 10_000 });
    return stdout.trim();
  } catch {
    return '';
  }
}

/** Set repo-local git config (does not touch --global). */
export async function setLocalGitConfig(cwd: string, key: string, value: string): Promise<void> {
  await execFileAsync('git', ['config', key, value], { cwd, timeout: 10_000 });
}

export function isAuthorIdentityError(err: unknown): boolean {
  const text = err instanceof Error ? err.message : String(err);
  return /Author identity unknown|user\.email|user\.name|auto-detect email/i.test(text);
}
