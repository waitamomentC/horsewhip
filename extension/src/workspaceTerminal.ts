import { type ChildProcessWithoutNullStreams, spawn } from 'child_process';

type PostFn = (msg: { type: string; data?: string; code?: number }) => void;

function defaultShell(): { cmd: string; args: string[] } {
  if (process.platform === 'win32') {
    return { cmd: process.env.COMSPEC || 'cmd.exe', args: [] };
  }
  const shell = process.env.SHELL || '/bin/bash';
  const base = shell.split('/').pop() || '';
  const args = base.includes('zsh') || base.includes('bash') ? ['-l'] : [];
  return { cmd: shell, args };
}

export class WorkspaceTerminal {
  private proc: ChildProcessWithoutNullStreams | undefined;

  constructor(
    private readonly cwd: string,
    private readonly post: PostFn,
  ) {}

  get running(): boolean {
    return !!this.proc;
  }

  start(): void {
    if (this.proc) return;

    const { cmd, args } = defaultShell();
    this.proc = spawn(cmd, args, {
      cwd: this.cwd,
      env: { ...process.env, TERM: 'xterm-256color' },
    });

    this.proc.stdout.on('data', (chunk: Buffer) => {
      this.post({ type: 'terminalOutput', data: chunk.toString() });
    });
    this.proc.stderr.on('data', (chunk: Buffer) => {
      this.post({ type: 'terminalOutput', data: chunk.toString() });
    });
    this.proc.on('exit', (code) => {
      this.post({ type: 'terminalExit', code: code ?? 0 });
      this.proc = undefined;
    });
  }

  write(data: string): void {
    if (!this.proc?.stdin.writable) return;
    this.proc.stdin.write(data);
  }

  stop(): void {
    if (!this.proc) return;
    this.proc.kill();
    this.proc = undefined;
  }
}
