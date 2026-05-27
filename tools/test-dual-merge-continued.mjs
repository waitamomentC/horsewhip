#!/usr/bin/env node
/**
 * Dual-branch merge at C2, then B continues to C3:
 * - A: AC1 → C2 (historical arc)
 * - B: BC1 → C2 (historical arc), BC1 → C3 (lane bridge), NOT C3 → main
 */
import { hw } from '../src/core/hw.js';
import '../src/core/config.js';
import '../src/git/branches.js';
import '../src/graph/branch-merge.js';

function mk(hash, col, parents, refs = '', subject = '') {
  return {
    hash,
    versionIndex: col,
    displayColumn: col,
    parents,
    refs: refs ? refs.split(',').map((s) => s.trim()) : [],
    subject,
    files: ['TA/x'],
    author: 't',
    date: '2026-01-01',
  };
}

const m0 = mk('m0', 1, [], 'main', 'init');
const ac1 = mk('ac1', 2, ['m0'], 'feature/A', 'AC1');
const bc1 = mk('bc1', 3, ['m0'], 'feature/B', 'BC1');
const c2 = mk('c2', 4, ['m0', 'ac1'], 'main', 'merge feature/A and feature/B');
const bc3 = mk('bc3', 5, ['bc1'], 'feature/B', 'C3 on B');

const commits = [m0, ac1, bc1, c2, bc3];
const commitMap = Object.fromEntries(commits.map((c) => [c.hash, c]));
const mainlineSet = new Set(['c2', 'm0']);

const parsed = { commits, commitMap, mainlineSet };

const segA = {
  name: 'feature/A',
  commits: [ac1],
  mergeHash: null,
};
const segB = {
  name: 'feature/B',
  commits: [bc1, bc3],
  mergeHash: null,
};

hw.applyBranchSegmentFromTip(segA, parsed, ac1, [ac1], 'm0');
hw.applyBranchSegmentFromTip(segB, parsed, bc3, [bc1, bc3], 'm0');

let ok = true;
function expect(cond, msg) {
  if (!cond) {
    ok = false;
    console.error('FAIL:', msg);
  }
}

expect(segA.mergeHash === 'c2', `A mergeHash c2 (got ${segA.mergeHash})`);
expect(segB.mergeHash === 'c2', `B mergeHash c2 (got ${segB.mergeHash})`);
expect(hw.segmentParticipatedInMerge(segB, c2, segB.commits, parsed), 'B participated in C2');
expect(hw.branchTipAtMerge(segB, parsed)?.hash === 'bc1', `B tip at merge bc1 (got ${hw.branchTipAtMerge(segB, parsed)?.hash})`);
expect(hw.branchTipAtMerge(segA, parsed)?.hash === 'ac1', `A tip at merge ac1`);
expect(hw.branchHasCommitsAfterMerge(segB, parsed), 'B has commits after merge C2');
expect(hw.branchMergeIsBehindTip(segB, parsed), 'B merge behind tip C3');
expect(segB.continued, 'B segment continued');
expect(hw.branchSegmentJoinColumn(segB, parsed) === 4, 'B join column C2');
expect(!hw.segmentOwnsMergeCommit(segB, c2, segB.commits, parsed) || hw.branchTipAtMerge(segB, parsed).hash === 'bc1',
  'B merge arc must not anchor from AC1 parent');

const tipB = hw.branchTipAtMerge(segB, parsed);
expect((tipB.versionIndex ?? tipB.displayColumn) < 5, 'merge source column before C3');

console.log(ok ? 'OK dual-merge continued' : 'FAILED');
process.exit(ok ? 0 : 1);
