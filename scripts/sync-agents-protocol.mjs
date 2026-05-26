#!/usr/bin/env node
/** @deprecated Use node protocol/scripts/sync.mjs */
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const sync = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../protocol/scripts/sync.mjs');
const r = spawnSync(process.execPath, [sync], { stdio: 'inherit' });
process.exit(r.status ?? 1);
