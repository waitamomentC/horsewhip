#!/usr/bin/env node
/**
 * protocol/AGENTS.md  →  ../AGENTS.md
 *                    →  ../.claude/rules/horsewhip-protocol.md (preamble + body)
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const protocolDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const repoRoot = path.resolve(protocolDir, '..');
const agents = path.join(protocolDir, 'AGENTS.md');
const preamble = path.join(protocolDir, 'templates/claude-rules-preamble.md');
const rootAgents = path.join(repoRoot, 'AGENTS.md');
const rulesDir = path.join(repoRoot, '.claude', 'rules');
const rulesFile = path.join(rulesDir, 'horsewhip-protocol.md');

const rootBanner =
  '<!-- 同步自 protocol/AGENTS.md — 只编辑 protocol/AGENTS.md，然后: node protocol/scripts/sync.mjs -->\n\n';
const rulesBanner =
  '<!-- AUTO-GENERATED — edit protocol/AGENTS.md or protocol/templates/claude-rules-preamble.md, then: node protocol/scripts/sync.mjs -->\n\n';

const body = fs.readFileSync(agents, 'utf8');
const rulesBody = `${fs.readFileSync(preamble, 'utf8')}\n${body}`;

fs.writeFileSync(rootAgents, rootBanner + body, 'utf8');
fs.mkdirSync(rulesDir, { recursive: true });
fs.writeFileSync(rulesFile, rulesBanner + rulesBody, 'utf8');

console.log('synced protocol/AGENTS.md → AGENTS.md');
console.log('synced preamble + AGENTS.md → .claude/rules/horsewhip-protocol.md');
