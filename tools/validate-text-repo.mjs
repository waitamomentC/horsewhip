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

function resolveHeadHash() {
  for (const name of ['main', 'master']) {
    const tip = branches.find((b) => b.name === name)?.hash;
    if (tip && commitMap[tip]) return tip;
  }
  return commits[commits.length - 1]?.hash;
}

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
      const sub = (pc?.subject || '').toLowerCase();
      const bn = (branchName || '').toLowerCase();
      const belongs = bn && sub.includes(bn);
      if (belongs && gp) {
        chain.unshift(pc);
        return { chain, forkHash: gp };
      }
      return { chain, forkHash: p };
    }
    cur = commitMap[p];
  }
  return { chain, forkHash: null };
}

function findMergeCommitForBranch(chain) {
  const chainSet = new Set(chain.map((c) => c.hash));
  const candidates = [];
  commits.forEach((c) => {
    if (c.parents.length < 2) return;
    const bp = c.parents[1];
    if (!chainSet.has(bp)) return;
    const mergeCol = c.versionIndex;
    if (chain.every((x) => x.versionIndex > mergeCol)) return;
    candidates.push(c);
  });
  candidates.sort((a, b) => a.versionIndex - b.versionIndex);
  return candidates[0]?.hash || null;
}

const headHash = resolveHeadHash();
const mainlineSet = new Set();
let cur = headHash;
while (cur && commitMap[cur]) {
  mainlineSet.add(cur);
  cur = commitMap[cur].parents[0];
}

const segments = [];
commits.forEach((c) => {
  if (c.parents.length < 2) return;
  const chain = [];
  let t = commitMap[c.parents[1]];
  while (t && !mainlineSet.has(t.hash)) {
    chain.unshift(t);
    t = commitMap[t.parents[0]];
  }
  if (!chain.length) return;
  segments.push({
    name: chain.find((x) => x.refs.length)?.refs.map(normalizeRefName)[0] || 'merge-branch',
    forkHash: chain[0].parents[0],
    mergeHash: c.hash,
    chain: chain.map((x) => `${x.hash.slice(0, 7)}@C${x.versionIndex}`),
  });
});

branches.filter((b) => !/^(main|master)$/i.test(b.name)).forEach((b) => {
  const { chain, forkHash } = collectBranchChainToFork(b.hash, mainlineSet, b.name);
  const mergeHash = findMergeCommitForBranch(chain);
  const id = b.name;
  const existing = segments.find((s) => s.name === id);
  const row = {
    name: id,
    forkHash: forkHash?.slice(0, 7),
    mergeHash: mergeHash?.slice(0, 7) || null,
    mergeCol: mergeHash ? `C${commitMap[mergeHash].versionIndex}` : null,
    chain: chain.map((x) => `${x.hash.slice(0, 7)}@C${x.versionIndex}`),
    continued: !mergeHash && !mainlineSet.has(b.hash),
  };
  if (existing) Object.assign(existing, row);
  else segments.push(row);
});

console.log('HEAD (main):', headHash.slice(0, 7), 'C' + commitMap[headHash].versionIndex);
console.log('Mainline:', [...mainlineSet].map((h) => `${h.slice(0, 7)}@C${commitMap[h].versionIndex}`).join(' → '));
console.log('\nBranch segments:');
for (const s of segments.sort((a, b) => a.name.localeCompare(b.name))) {
  console.log(`  ⎇ ${s.name}: fork ${s.forkHash} chain [${s.chain.join(', ')}] merge ${s.mergeHash || '—'} ${s.mergeCol || ''} ${s.continued ? '(continued)' : ''}`);
}

const only = segments.find((s) => s.name === 'TA-only-test');
const ta = segments.find((s) => s.name === 'TA');
const fa = segments.find((s) => s.name === 'feature/A');
let ok = true;
function expect(cond, msg) {
  if (!cond) {
    ok = false;
    console.error('FAIL:', msg);
  }
}
expect(headHash.startsWith('23a5435'), 'main HEAD should be 23a5435');
expect(only?.chain?.length === 2, 'TA-only-test chain should have 2 commits');
expect(only?.chain?.[0]?.includes('a2d57ea'), 'TA-only-test should include a2d57ea');
expect(only?.chain?.[1]?.includes('e2fb829'), 'TA-only-test should include e2fb829');
expect(!only?.mergeHash, 'TA-only-test should not merge to main');
expect(ta?.mergeHash?.startsWith('23a5435'), 'TA should merge at 23a5435');
expect(!fa?.mergeHash, 'feature/A should not co-merge to 23a5435');
console.log(ok ? '\nAll checks passed.' : '\nSome checks failed.');
