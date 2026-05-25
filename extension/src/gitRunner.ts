import { execFile } from 'child_process';
import { promisify } from 'util';

const execFileAsync = promisify(execFile);

const LOG_FORMAT = '%H|%P|%D|%an|%ad';
const LOG_ARGS = ['log', '--all', '--name-only', `--pretty=format:${LOG_FORMAT}`];

export async function fetchGitLog(cwd: string, maxCount = 100): Promise<string> {
  const args = [...LOG_ARGS, `-${maxCount}`];
  const { stdout } = await execFileAsync('git', args, {
    cwd,
    maxBuffer: 16 * 1024 * 1024,
    timeout: 120_000,
  });
  return stdout.trim();
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
