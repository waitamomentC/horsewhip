import { execFile } from 'child_process';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { promisify } from 'util';

const execFileAsync = promisify(execFile);

function sshDir(): string {
  return path.join(os.homedir(), '.ssh');
}

export function readSshPublicKey(): string | null {
  for (const name of ['id_ed25519.pub', 'id_rsa.pub']) {
    const p = path.join(sshDir(), name);
    if (fs.existsSync(p)) {
      return fs.readFileSync(p, 'utf8').trim();
    }
  }
  return null;
}

/** Generate ed25519 key if missing; return public key text. */
export async function ensureSshKey(email: string): Promise<string> {
  const existing = readSshPublicKey();
  if (existing) return existing;

  const dir = sshDir();
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
  }

  const keyPath = path.join(dir, 'id_ed25519');
  const comment = email.trim() || 'horsewhip@local';
  await execFileAsync('ssh-keygen', [
    '-t', 'ed25519', '-C', comment, '-f', keyPath, '-N', '',
  ], { timeout: 60_000 });

  const pub = `${keyPath}.pub`;
  if (!fs.existsSync(pub)) {
    throw new Error('SSH 公钥生成失败');
  }
  return fs.readFileSync(pub, 'utf8').trim();
}

export type SshTestResult = {
  ok: boolean;
  username?: string;
  message: string;
};

/** Test GitHub SSH (exit 1 with "Hi user!" still counts as success). */
export async function testGitHubSsh(): Promise<SshTestResult> {
  try {
    await execFileAsync('ssh', [
      '-T', '-o', 'BatchMode=yes', '-o', 'StrictHostKeyChecking=accept-new',
      'git@github.com',
    ], { timeout: 20_000 });
    return { ok: true, message: 'SSH 连接成功' };
  } catch (err: unknown) {
    const e = err as { stderr?: string; stdout?: string; message?: string };
    const text = [e.stderr, e.stdout, e.message].filter(Boolean).join('\n');
    if (/successfully authenticated/i.test(text)) {
      const m = text.match(/Hi ([^!\s]+)!/);
      return { ok: true, username: m?.[1], message: text.trim() };
    }
    if (/Permission denied \(publickey\)/i.test(text)) {
      return { ok: false, message: '尚未配置 GitHub SSH 公钥，请复制下方公钥并添加到 GitHub' };
    }
    return { ok: false, message: text.trim() || 'SSH 检测失败' };
  }
}
