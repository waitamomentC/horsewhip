#!/usr/bin/env node
/** Validate branch merge attribution against /Users/su/Desktop/text using horsewhip graph rules. */
import { execSync } from 'node:child_process';
import { hw } from '../src/core/hw.js';
import '../src/core/config.js';
import '../src/git/branches.js';
import '../src/graph/branch-merge.js';

const REPO = '/Users/su/Desktop/text';
const log = execSync(
  'git log --all --name-only --pretty=format:"%H|%P|%D|%an|%ad|%s"',
  { cwd: REPO, encoding: 'utf8' },
);
const branches = execSync('git for-each-ref refs/heads --format="%(refname:short)|%(objectname)"', {
  cwd: REPO,
  encoding: 'utf8',
})
  .trim()
  .split('\n')
  .filter(Boolean)
  .map((line) => {
    const [name, hash] = line.split('|');
    return { name, hash };
  });

function parseRefs(raw) {
  if (!raw?.trim()) return [];
  return raw.split(',').map((s) => s.trim().replace(/^HEAD -> /, '')).filter(Boolean);
}

const commits = [];
let current = null;
for (const rawLine of log.split('\n')) {
  const line = rawLine.trim();
  if (!line) continue;
  const m6 = line.match(/^([0-9a-f]{7,40})\|([^|]*)\|([^|]*)\|([^|]+)\|([^|]+)\|(.+)$/i);
  if (m6) {
    if (current) commits.push(current);
    current = {
      hash: m6[1],
      parents: m6[2].trim() && m6[2].trim() !== '-' ? m6[2].trim().split(/\s+/) : [],
      refs: parseRefs(m6[3]),
      author: m6[4],
      date: m6[5],
      subject: m6[6].trim(),
      files: [],
    };
  } else if (current) current.files.push(line);
}
if (current) commits.push(current);
commits.reverse();
const commitMap = Object.fromEntries(commits.map((c) => [c.hash, c]));
commits.forEach((c, i) => {
  c.versionIndex = i + 1;
  c.displayColumn = i + 1;
});

const headHash = branches.find((b) => b.name === 'main')?.hash || commits[commits.length - 1]?.hash;
const mainlineSet = new Set();
let cur = headHash;
while (cur && commitMap[cur]) {
  mainlineSet.add(cur);
  cur = commitMap[cur].parents[0];
}

const parsed = {
  commits,
  commitMap,
  mainlineSet,
  branchSegments: [],
  gitBranches: branches,
};

branches.filter((b) => !/^(main|master)$/i.test(b.name)).forEach((b) => {
  const tip = commitMap[b.hash];
  if (!tip) return;
  const { chain, forkHash } = hw.collectBranchChainToFork(tip.hash, commitMap, mainlineSet, b.name);
  const seg = { id: b.name, name: b.name, commits: [], mergeHash: null };
  hw.applyBranchSegmentFromTip(seg, parsed, tip, chain, forkHash);
  parsed.branchSegments.push(seg);
});

let ok = true;
function expect(cond, msg) {
  if (!cond) {
    ok = false;
    console.error('FAIL:', msg);
  }
}

const only = parsed.branchSegments.find((s) => s.name === 'TA-only-test');
const ta = parsed.branchSegments.find((s) => s.name === 'TA');
const fa = parsed.branchSegments.find((s) => s.name === 'feature/A');
const fb = parsed.branchSegments.find((s) => s.name === 'feature/B');

console.log('HEAD main:', headHash.slice(0, 7), 'C' + commitMap[headHash].versionIndex);
for (const s of parsed.branchSegments.sort((a, b) => a.name.localeCompare(b.name))) {
  const tipAt = s.mergeHash
    ? hw.branchTipAtMerge(s, parsed)?.hash?.slice(0, 7)
    : '—';
  console.log(
    `  ⎇ ${s.name}: merge ${s.mergeHash?.slice(0, 7) || '—'}`
    + ` @C${s.mergeHash ? commitMap[s.mergeHash].versionIndex : '?'}`
    + ` tip@merge ${tipAt}`
    + ` continued=${s.continued}`,
  );
}

expect(only?.mergeHash?.startsWith('555aed2'), 'TA-only-test → 555aed2 (C16)');
expect(hw.branchTipAtMerge(only, parsed)?.hash?.startsWith('a2d57ea'), 'TA-only-test arc from a2d57ea not e2fb829');
expect(only?.continued, 'TA-only-test continued after C16');
expect(ta?.mergeHash?.startsWith('bae2763'), 'TA → bae2763 (C17)');
expect(hw.branchTipAtMerge(ta, parsed)?.hash?.startsWith('b58850c'), 'TA arc from b58850c');
expect(!fa?.mergeHash, 'feature/A must not claim TA-only-test merge');
expect(!fb?.mergeHash, 'feature/B must not claim TA-only-test merge');

console.log(ok ? '\nAll horsewhip merge checks passed.' : '\nSome checks failed.');
process.exit(ok ? 0 : 1);
