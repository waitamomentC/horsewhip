#!/usr/bin/env node
/** Sanity-check branch segments for /Users/su/Desktop/text (no browser). */
import { execSync } from 'node:child_process';

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
function normalizeRefName(r) {
  return String(r || '').replace(/^refs\/heads\//, '').replace(/^origin\//, '');
}
function commitBelongsToBranch(commit, branchName) {
  if (!commit || !branchName) return false;
  const bn = normalizeRefName(branchName).toLowerCase();
  if (!bn) return false;
  if ((commit.refs || []).some((r) => normalizeRefName(r).toLowerCase() === bn)) return true;
  const sub = (commit.subject || '').toLowerCase();
  return sub.includes(bn) || sub.includes(`on ${bn} branch`);
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

function collectBranchChainToFork(tipHash, trunkSet, branchName) {
  const chain = [];
  let cur = commitMap[tipHash];
  while (cur) {
    chain.unshift(cur);
    const p = cur.parents?.[0];
    if (!p) break;
    if (trunkSet.has(p)) {
      const pc = commitMap[p];
      const gp = pc?.parents?.[0];
      if (branchName && pc && commitBelongsToBranch(pc, branchName) && gp) {
        chain.unshift(pc);
        return { chain, forkHash: gp };
      }
      return { chain, forkHash: p };
    }
    cur = commitMap[p];
  }
  return { chain, forkHash: null };
}

function segmentOwnsMergeCommit(segName, mergeCommit, chain) {
  if (!mergeCommit?.parents || mergeCommit.parents.length < 2) return false;
  const bp = mergeCommit.parents[1];
  const chainSet = new Set(chain.map((c) => c.hash));
  if (!chainSet.has(bp)) return false;
  const tip = chain[chain.length - 1];
  if (tip && bp === tip.hash) return true;
  const mergeCol = mergeCommit.versionIndex;
  let tipAtMerge = null;
  for (const c of chain) {
    if (c.versionIndex > mergeCol) continue;
    if (!tipAtMerge || c.versionIndex >= tipAtMerge.versionIndex) tipAtMerge = c;
  }
  if (tipAtMerge && bp === tipAtMerge.hash) return true;
  if (commitBelongsToBranch(mergeCommit, segName)) return true;
  const bpCommit = commitMap[bp];
  return Boolean(bpCommit && commitBelongsToBranch(bpCommit, segName));
}

function findMergeCommitForBranch(chain, segName) {
  const candidates = [];
  commits.forEach((c) => {
    if (c.parents.length < 2) return;
    if (!segmentOwnsMergeCommit(segName, c, chain)) return;
    const mergeCol = c.versionIndex;
    if (chain.every((x) => x.versionIndex > mergeCol)) return;
    candidates.push(c);
  });
  candidates.sort((a, b) => a.versionIndex - b.versionIndex);
  return candidates[0]?.hash || null;
}

const headHash = branches.find((b) => b.name === 'main')?.hash || commits[commits.length - 1]?.hash;
const mainlineSet = new Set();
let cur = headHash;
while (cur && commitMap[cur]) {
  mainlineSet.add(cur);
  cur = commitMap[cur].parents[0];
}

const segments = [];
branches.filter((b) => !/^(main|master)$/i.test(b.name)).forEach((b) => {
  const { chain, forkHash } = collectBranchChainToFork(b.hash, mainlineSet, b.name);
  const mergeHash = findMergeCommitForBranch(chain, b.name);
  segments.push({
    name: b.name,
    forkHash: forkHash?.slice(0, 7),
    mergeHash: mergeHash?.slice(0, 7) || null,
    mergeCol: mergeHash ? `C${commitMap[mergeHash].versionIndex}` : null,
    chain: chain.map((x) => `${x.hash.slice(0, 7)}@C${x.versionIndex}`),
    continued: !mergeHash && !mainlineSet.has(b.hash),
  });
});

console.log('HEAD (main):', headHash.slice(0, 7), 'C' + commitMap[headHash].versionIndex);
console.log('Mainline:', [...mainlineSet].map((h) => `${h.slice(0, 7)}@C${commitMap[h].versionIndex}`).join(' → '));
console.log('\nBranch segments:');
for (const s of segments.sort((a, b) => a.name.localeCompare(b.name))) {
  console.log(`  ⎇ ${s.name}: fork ${s.forkHash} chain [${s.chain.join(', ')}] merge ${s.mergeHash || '—'} ${s.mergeCol || ''} ${s.continued ? '(continued)' : ''}`);
}

let ok = true;
function expect(cond, msg) {
  if (!cond) {
    ok = false;
    console.error('FAIL:', msg);
  }
}
const only = segments.find((s) => s.name === 'TA-only-test');
const ta = segments.find((s) => s.name === 'TA');
const fa = segments.find((s) => s.name === 'feature/A');
const fb = segments.find((s) => s.name === 'feature/B');

expect(headHash.startsWith('bae2763'), 'main HEAD should be bae2763');
expect(only?.mergeHash?.startsWith('555aed2'), 'TA-only-test should merge at 555aed2 (C16)');
expect(only?.chain?.some((x) => x.includes('e2fb829')), 'TA-only-test chain includes post-merge tip e2fb829');
expect(ta?.mergeHash?.startsWith('bae2763'), 'TA should merge at bae2763 (C17)');
expect(!fa?.mergeHash, 'feature/A should not inherit TA-only-test merge at C16');
expect(!fb?.mergeHash, 'feature/B should not inherit TA-only-test merge at C16');
console.log(ok ? '\nAll checks passed.' : '\nSome checks failed.');
