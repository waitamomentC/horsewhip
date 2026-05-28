#!/usr/bin/env node
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import {
  persistAllowlist,
  readAllowlistRecord,
  readEditBlocked,
  writeMcpSignal,
} from './persist.js';
import { assertGitWorkspace, normalizeRelPaths, resolveWorkspaceRoot } from './workspace.js';

const server = new McpServer({
  name: 'horsewhip',
  version: '0.1.0',
});

function workspaceOrThrow(): string {
  const root = resolveWorkspaceRoot();
  assertGitWorkspace(root);
  return root;
}

function textResult(data: unknown) {
  return {
    content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }],
  };
}

server.registerTool(
  'horsewhip_lock_paths',
  {
    description:
      'Lock allowed file paths for the current task. Writes .git/horsewhip/allowlist.json (locked).',
    inputSchema: {
      paths: z.array(z.string()).min(1),
      reason: z.string().optional(),
    },
  },
  async ({ paths, reason }) => {
    const root = workspaceOrThrow();
    const allowed = normalizeRelPaths(root, paths);
    const record = await persistAllowlist(root, allowed, true);
    await writeMcpSignal(root, { type: 'lock', playWhip: false });
    return textResult({
      ok: true,
      workspaceRoot: root,
      allowed: record.allowed,
      locked: true,
      reason: reason ?? null,
    });
  },
);

server.registerTool(
  'horsewhip_unlock',
  {
    description: 'Clear boundary lock and allowlist.',
    inputSchema: {},
  },
  async () => {
    const root = workspaceOrThrow();
    await persistAllowlist(root, [], false);
    await writeMcpSignal(root, { type: 'unlock', playWhip: false });
    return textResult({ ok: true, workspaceRoot: root, locked: false, allowed: [] });
  },
);

server.registerTool(
  'horsewhip_get_boundary',
  {
    description: 'Read current allowlist, lock state, and recent edit-blocked marker.',
    inputSchema: {},
  },
  async () => {
    const root = workspaceOrThrow();
    const record = await readAllowlistRecord(root);
    const editBlocked = await readEditBlocked(root);
    return textResult({
      workspaceRoot: root,
      allowed: record?.allowed ?? [],
      locked: Boolean(record?.locked) && (record?.allowed?.length ?? 0) > 0,
      guardActive: record?.guardActive !== false,
      updatedAt: record?.updatedAt ?? null,
      editBlocked,
    });
  },
);

server.registerTool(
  'horsewhip_expand_boundary',
  {
    description: 'Merge additional paths into the locked allowlist (user must have agreed).',
    inputSchema: {
      paths: z.array(z.string()).min(1),
    },
  },
  async ({ paths }) => {
    const root = workspaceOrThrow();
    const rec = await readAllowlistRecord(root);
    if (!rec?.locked) {
      throw new Error('Boundary is not locked. Call horsewhip_lock_paths first.');
    }
    const merged = normalizeRelPaths(root, [...(rec.allowed ?? []), ...paths]);
    const record = await persistAllowlist(root, merged, true, rec.guardActive !== false);
    await writeMcpSignal(root, { type: 'expand', playWhip: false });
    return textResult({
      ok: true,
      workspaceRoot: root,
      allowed: record.allowed,
      locked: true,
    });
  },
);

server.registerTool(
  'horsewhip_suggest_scope',
  {
    description:
      'Suggest candidate paths for a task (Phase 4B stub — returns workspace-relative hints only).',
    inputSchema: {
      task: z.string(),
    },
  },
  async ({ task }) => {
    const root = workspaceOrThrow();
    return textResult({
      workspaceRoot: root,
      task,
      candidates: [],
      note: 'suggest_scope v1 not implemented — infer paths from the task and call horsewhip_lock_paths.',
    });
  },
);

server.registerTool(
  'horsewhip_whip_ceremony',
  {
    description:
      'Play whip sound + UI feedback in the Horsewhip extension (phase: lock after boundary set, or expand).',
    inputSchema: {
      phase: z.enum(['lock', 'expand']),
    },
  },
  async ({ phase }) => {
    const root = workspaceOrThrow();
    await writeMcpSignal(root, { type: 'whip_ceremony', phase, playWhip: true });
    return textResult({ ok: true, workspaceRoot: root, phase, playWhip: true });
  },
);

server.registerTool(
  'horsewhip_task_complete',
  {
    description: 'Mark task complete — extension plays closing whip + toast.',
    inputSchema: {
      summary: z.string().optional(),
    },
  },
  async ({ summary }) => {
    const root = workspaceOrThrow();
    await writeMcpSignal(root, {
      type: 'task_complete',
      playWhip: true,
      summary,
    });
    return textResult({ ok: true, workspaceRoot: root, summary: summary ?? null });
  },
);

async function main(): Promise<void> {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((err) => {
  console.error('[horsewhip-mcp]', err);
  process.exit(1);
});
