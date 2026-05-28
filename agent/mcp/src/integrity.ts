import * as crypto from 'node:crypto';
import * as fs from 'node:fs';

/**
 * Refuse to start when HORSEWHIP_MCP_HASH is set and does not match this entry file.
 * Prevents tampered MCP binaries from serving tools even if the IDE launches them.
 */
export function assertMcpIntegrityOrExit(entryPath: string): void {
  const expected = process.env.HORSEWHIP_MCP_HASH?.trim();
  if (!expected) return;

  let actual: string;
  try {
    actual = crypto.createHash('sha256').update(fs.readFileSync(entryPath)).digest('hex');
  } catch (err) {
    console.error('[horsewhip-mcp] integrity read failed:', err);
    process.exit(1);
  }

  if (actual !== expected) {
    console.error(
      '[horsewhip-mcp] INTEGRITY CHECK FAILED — MCP binary hash mismatch.',
      'Expected:',
      `${expected.slice(0, 16)}…`,
      'Actual:',
      `${actual.slice(0, 16)}…`,
      'Re-run Horsewhip: Configure Agent and reload the window.',
    );
    process.exit(1);
  }
}
