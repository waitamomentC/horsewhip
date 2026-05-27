import * as vscode from 'vscode';

/** Debounced refresh when repo HEAD / refs change (commit, checkout, etc.). */
export function watchGitRepository(cwd: string, onChange: () => void): vscode.Disposable {
  const root = vscode.Uri.file(cwd);
  const patterns = [
    new vscode.RelativePattern(root, '.git/HEAD'),
    new vscode.RelativePattern(root, '.git/logs/HEAD'),
    new vscode.RelativePattern(root, '.git/index'),
    new vscode.RelativePattern(root, '.git/horsewhip/commit-blocked.json'),
  ];

  let timer: ReturnType<typeof setTimeout> | undefined;
  const fire = () => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => onChange(), 250);
  };

  const watchers = patterns.map((pattern) => {
    const w = vscode.workspace.createFileSystemWatcher(pattern);
    w.onDidChange(fire);
    w.onDidCreate(fire);
    return w;
  });

  return vscode.Disposable.from(
    ...watchers,
    new vscode.Disposable(() => {
      if (timer) clearTimeout(timer);
    }),
  );
}
