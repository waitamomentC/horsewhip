import * as fs from 'fs';
import * as path from 'path';

function packageManagerRun(cwd: string): 'npm run' | 'pnpm run' | 'yarn' {
  if (fs.existsSync(path.join(cwd, 'pnpm-lock.yaml'))) return 'pnpm run';
  if (fs.existsSync(path.join(cwd, 'yarn.lock'))) return 'yarn';
  return 'npm run';
}

/** Best-effort dev server command for preview-after-checkout. */
export async function detectDevStartCommand(cwd: string): Promise<string | null> {
  const pkgPath = path.join(cwd, 'package.json');
  let pkg: { scripts?: Record<string, string> };
  try {
    pkg = JSON.parse(await fs.promises.readFile(pkgPath, 'utf8'));
  } catch {
    return null;
  }
  const scripts = pkg.scripts || {};
  const pm = packageManagerRun(cwd);
  if (scripts.dev) return `${pm} dev`;
  if (scripts.start) return `${pm} start`;
  if (scripts.serve) return `${pm} serve`;
  return null;
}
