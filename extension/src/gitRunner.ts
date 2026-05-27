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

/** Paths changed vs HEAD (staged, unstaged, and untracked). */
export async function fetchWorkingTreeChangedFiles(cwd: string): Promise<string[]> {
  const files = new Set<string>();
  try {
    const { stdout: diffOut } = await execFileAsync(
      'git',
      ['diff', 'HEAD', '--name-only', '--diff-filter=ACDMRTUXB'],
      { cwd, maxBuffer: 8 * 1024 * 1024, timeout: 60_000 },
    );
    diffOut
      .trim()
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean)
      .forEach((f) => files.add(f));
  } catch {
    /* no commits yet — fall through to status */
  }
  try {
    const { stdout: untracked } = await execFileAsync(
      'git',
      ['ls-files', '--others', '--exclude-standard'],
      { cwd, maxBuffer: 8 * 1024 * 1024, timeout: 60_000 },
    );
    untracked
      .trim()
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean)
      .forEach((f) => files.add(f));
  } catch {
    /* ignore */
  }
  if (!files.size) {
    try {
      const { stdout: status } = await execFileAsync(
        'git',
        ['status', '--porcelain'],
        { cwd, maxBuffer: 8 * 1024 * 1024, timeout: 60_000 },
      );
      for (const line of status.trim().split('\n')) {
        if (!line || line.length < 4) continue;
        const path = line.slice(3).trim().replace(/^"|"$/g, '');
        if (path.includes(' -> ')) {
          path.split(' -> ').forEach((p) => files.add(p.trim()));
        } else {
          files.add(path);
        }
      }
    } catch {
      /* ignore */
    }
  }
  return [...files].sort((a, b) => a.localeCompare(b));
}

/** Restore tracked paths to HEAD; remove untracked paths under workspace. */
export async function gitRestorePaths(cwd: string, paths: string[]): Promise<void> {
  const rel = [...new Set(paths.map((p) => p.trim()).filter(Boolean))];
  if (!rel.length) return;
  const tracked: string[] = [];
  const untracked: string[] = [];
  for (const p of rel) {
    try {
      await execFileAsync('git', ['ls-files', '--error-unmatch', '--', p], { cwd, timeout: 15_000 });
      tracked.push(p);
    } catch {
      untracked.push(p);
    }
  }
  if (tracked.length) {
    await execFileAsync('git', ['checkout', 'HEAD', '--', ...tracked], { cwd, timeout: 120_000 });
  }
  for (const p of untracked) {
    try {
      await execFileAsync('git', ['clean', '-fd', '--', p], { cwd, timeout: 60_000 });
    } catch {
      /* ignore single-file clean failure */
    }
  }
}

export async function gitCheckoutFile(cwd: string, hash: string, filePath: string): Promise<void> {
  await execFileAsync('git', ['checkout', hash, '--', filePath], { cwd, timeout: 60_000 });
}

/** Pull file contents at `hash` into working tree; does not move HEAD (for A/B/main compare). */
export async function gitCheckoutFiles(cwd: string, hash: string, filePaths: string[]): Promise<void> {
  const paths = filePaths.filter(Boolean);
  if (!paths.length) throw new Error('无文件路径');
  await execFileAsync('git', ['checkout', hash, '--', ...paths], { cwd, timeout: 120_000 });
}

export async function gitCheckoutDetached(cwd: string, hash: string): Promise<void> {
  try {
    await execFileAsync('git', ['switch', '--detach', hash], { cwd, timeout: 60_000 });
  } catch {
    await execFileAsync('git', ['checkout', '--detach', hash], { cwd, timeout: 60_000 });
  }
}

export async function gitSwitchBranch(cwd: string, branchName: string): Promise<void> {
  try {
    await execFileAsync('git', ['switch', branchName], { cwd, timeout: 60_000 });
  } catch {
    await execFileAsync('git', ['checkout', branchName], { cwd, timeout: 60_000 });
  }
}

/** Return to branch before detached preview (`git switch -`). */
export async function gitSwitchPrevious(cwd: string): Promise<string> {
  let previous = '';
  try {
    const { stdout } = await execFileAsync('git', ['rev-parse', '--abbrev-ref', '@{-1}'], {
      cwd,
      timeout: 10_000,
    });
    previous = stdout.trim();
  } catch {
    /* ignore */
  }
  try {
    await execFileAsync('git', ['switch', '-'], { cwd, timeout: 60_000 });
  } catch {
    await execFileAsync('git', ['checkout', '-'], { cwd, timeout: 60_000 });
  }
  return previous;
}

export async function gitBranchDisplay(cwd: string): Promise<{ label: string; detached: boolean }> {
  try {
    const { stdout } = await execFileAsync('git', ['branch', '--show-current'], { cwd, timeout: 10_000 });
    const cur = stdout.trim();
    if (cur) return { label: cur, detached: false };
  } catch {
    /* fall through */
  }
  try {
    const { stdout } = await execFileAsync('git', ['rev-parse', '--short', 'HEAD'], { cwd, timeout: 10_000 });
    const short = stdout.trim();
    return { label: short ? `detached @ ${short}` : 'detached', detached: true };
  } catch {
    return { label: 'detached', detached: true };
  }
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
