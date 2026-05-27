import * as fs from 'fs/promises';
import * as path from 'path';
import * as vscode from 'vscode';

const LOG_BASENAME = 'timeline-log.txt';

/** Write under extension globalStorage — webview may fetch via localResourceRoots. */
export async function writeTimelineLogForWebview(
  storageUri: vscode.Uri,
  webview: vscode.Webview,
  log: string,
): Promise<string> {
  const dir = storageUri.fsPath;
  await fs.mkdir(dir, { recursive: true });
  const filePath = path.join(dir, LOG_BASENAME);
  await fs.writeFile(filePath, log, 'utf8');
  return webview.asWebviewUri(vscode.Uri.file(filePath)).toString();
}
