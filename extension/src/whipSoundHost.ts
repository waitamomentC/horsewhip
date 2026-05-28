import { execFile } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';

let output: vscode.OutputChannel | undefined;

function log(msg: string): void {
  if (!output) {
    output = vscode.window.createOutputChannel('Horsewhip');
  }
  output.appendLine(msg);
}

/** Play whip.wav from the extension bundle (works without webview / user gesture). */
export function playWhipSoundFromHost(extensionUri: vscode.Uri): void {
  const wavPath = path.join(extensionUri.fsPath, 'media', 'whip.wav');
  if (!fs.existsSync(wavPath)) {
    log(`[whip] missing audio file: ${wavPath}`);
    return;
  }

  const platform = process.platform;
  if (platform === 'darwin') {
    execFile('afplay', [wavPath], (err) => {
      if (err) log(`[whip] afplay failed: ${err.message}`);
    });
    return;
  }

  if (platform === 'win32') {
    const ps = `Add-Type -AssemblyName presentationCore; `
      + `$p = New-Object System.Windows.Media.MediaPlayer; `
      + `$p.Open([Uri]'file:///${wavPath.replace(/\\/g, '/')}'); `
      + `$p.Play(); Start-Sleep -Milliseconds 800`;
    execFile(
      'powershell.exe',
      ['-NoProfile', '-NonInteractive', '-Command', ps],
      (err) => {
        if (err) log(`[whip] PowerShell play failed: ${err.message}`);
      },
    );
    return;
  }

  execFile('paplay', [wavPath], (err) => {
    if (err) {
      execFile('aplay', ['-q', wavPath], (err2) => {
        if (err2) log(`[whip] paplay/aplay failed: ${err2.message}`);
      });
    }
  });
}
