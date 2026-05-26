import * as vscode from 'vscode';

const OPEN_CHAT_COMMANDS = [
  'composer.startComposerPrompt',
  'composer.focusComposer',
  'aichat.show-ai-chat',
  'workbench.action.chat.open',
];

export type ChatInsertResult = 'chat' | 'clipboard';

/** Best-effort: open AI chat/composer and paste constraint text. */
export async function insertTextIntoChat(text: string): Promise<ChatInsertResult> {
  const trimmed = text.trim();
  if (!trimmed) return 'clipboard';

  let originalClipboard = '';
  try {
    originalClipboard = await vscode.env.clipboard.readText();
  } catch {
    /* ignore */
  }

  await vscode.env.clipboard.writeText(trimmed);

  for (const cmd of OPEN_CHAT_COMMANDS) {
    try {
      await vscode.commands.executeCommand(cmd);
      await delay(350);
      try {
        await vscode.commands.executeCommand('editor.action.clipboardPasteAction');
        try {
          await vscode.env.clipboard.writeText(originalClipboard);
        } catch {
          /* ignore */
        }
        return 'chat';
      } catch {
        /* paste failed — try next command */
      }
    } catch {
      /* command unavailable in this editor */
    }
  }

  await vscode.env.clipboard.writeText(trimmed);
  return 'clipboard';
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
