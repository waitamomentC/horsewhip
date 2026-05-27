import { hw } from '../core/hw.js';

function branchRefNames() {
  const names = new Set();
  (hw.state.gitBranches || []).forEach((b) => { if (b.name) names.add(b.name); });
  return names;
}

function normalizeRefName(raw) {
  return String(raw || '').replace(/^origin\//, '').replace(/^HEAD -> /, '').trim();
}

function commitBelongsToBranch(commit, branchName) {
  if (!commit || !branchName) return false;
  const bn = hw.normalizeRefName(branchName).toLowerCase();
  if (!bn) return false;
  if ((commit.refs || []).some((r) => hw.normalizeRefName(r).toLowerCase() === bn)) return true;
  const sub = (commit.subject || '').toLowerCase();
  const escaped = bn.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  if (new RegExp(`(^|\\s)${escaped}($|[\\s:])`, 'i').test(sub)) return true;
  if (new RegExp(`merge\\s+${escaped}([\\s:]|$)`, 'i').test(sub)) return true;
  return sub.includes(`on ${bn} branch`);
}

function hasBranchRef(commit) {
  if (!commit?.refs?.length) return false;
  const known = hw.branchRefNames();
  return commit.refs.some((r) => {
    const clean = hw.normalizeRefName(r);
    if (!clean || clean === 'HEAD' || clean === 'main' || clean === 'master') return false;
    if (known.has(clean)) return true;
    if (/(^|\/)feature\//.test(r)) return true;
    return /^origin\//.test(r);
  });
}

function resolveCommitHash(token, commitMap) {
  if (!token || !commitMap) return null;
  if (commitMap[token]) return commitMap[token];
  const hits = Object.keys(commitMap).filter((h) => h.startsWith(token));
  return hits.length === 1 ? commitMap[hits[0]] : null;
}

function findMergeCommitForBranch(parsed, chain, seg) {
  if (!chain.length) return null;
  const candidates = [];
  parsed.commits.forEach((c) => {
    if (c.parents.length < 2) return;
    if (!hw.segmentParticipatedInMerge(seg, c, chain, parsed)) return;
    const mergeCol = c.versionIndex ?? c.displayColumn ?? 0;
    const allAfterMerge = chain.every((x) => {
      const col = x.versionIndex ?? x.displayColumn ?? 0;
      return col > mergeCol;
    });
    if (allAfterMerge) return;
    candidates.push(c);
  });
  if (!candidates.length) return null;
  candidates.sort((a, b) => {
    const ca = a.versionIndex ?? a.displayColumn ?? 0;
    const cb = b.versionIndex ?? b.displayColumn ?? 0;
    return ca - cb;
  });
  return candidates[0].hash;
}

function resolveSegmentMergeHash(parsed, chain, seg) {
  const found = hw.findMergeCommitForBranch(parsed, chain, seg);
  if (found) return found;
  const mc = seg?.mergeHash && parsed.commitMap[seg.mergeHash];
  const bp = mc?.parents?.[1];
  if (mc && bp && chain.some((c) => c.hash === bp)) return seg.mergeHash;
  return null;
}

function branchSegmentFrozenMerge(seg, parsed) {
  return Boolean(seg?.continued || hw.branchMergeIsBehindTip(seg, parsed));
}

function applyBranchSegmentFromTip(seg, parsed, tip, chain, forkHash) {
  const commitMap = parsed.commitMap;
  const mainlineSet = parsed.mainlineSet;
  const mergeHash = hw.resolveSegmentMergeHash(parsed, chain, seg);
  const commits = chain.length ? chain : (tip ? [commitMap[tip]].filter(Boolean) : []);
  const commitSet = new Set(commits.map((c) => c.hash));
  Object.assign(seg, {
    forkHash: forkHash || seg?.forkHash || null,
    mergeHash,
    merged: Boolean(mergeHash),
    continued: false,
    commits,
    commitSet,
    forkGraphX: forkHash ? commitMap[forkHash]?.graphX ?? null : seg?.forkGraphX ?? null,
    mergeGraphX: mergeHash ? commitMap[mergeHash]?.graphX ?? null : null,
    outOfLog: false,
  });
  const tipAtMerge = mergeHash ? hw.branchTipAtMerge(seg, parsed) : null;
  seg.continued = hw.branchMergeIsBehindTip(seg, parsed)
    || hw.branchHasCommitsAfterMerge(seg, parsed)
    || (mergeHash && tip && !mainlineSet.has(tip.hash) && tipAtMerge && tipAtMerge.hash !== tip.hash)
    || (!mergeHash && tip && !mainlineSet.has(tip.hash));
}

function enrichBranchSegmentsFromGitBranches(parsed, branches) {
  if (!parsed || !branches?.length) return;
  const commitMap = parsed.commitMap;
  const mainlineSet = parsed.mainlineSet;
  const existing = new Set(parsed.branchSegments.map((s) => s.id));

  branches.forEach((b) => {
    if (!b?.name || /^(main|master)$/i.test(b.name)) return;
    const tip = b.hash ? hw.resolveCommitHash(b.hash, commitMap) : null;
    const prior = parsed.branchSegments.find((s) => s.id === b.name || s.name === b.name);
    if (prior && tip) {
      const { chain, forkHash } = hw.collectBranchChainToFork(
        tip.hash, commitMap, mainlineSet, prior.name || b.name,
      );
      hw.applyBranchSegmentFromTip(prior, parsed, tip, chain, forkHash);
      existing.add(b.name);
      return;
    }
    if (existing.has(b.name)) return;
    if (!tip) {
      parsed.branchSegments.push({
        id: b.name,
        name: b.name,
        forkHash: null,
        mergeHash: null,
        merged: false,
        continued: false,
        commits: [],
        commitSet: new Set(),
        forkGraphX: null,
        mergeGraphX: null,
        outOfLog: true,
      });
      existing.add(b.name);
      return;
    }

    const { chain, forkHash } = hw.collectBranchChainToFork(tip.hash, commitMap, mainlineSet, b.name);
    if (!chain.length || !forkHash || forkHash === tip.hash) {
      parsed.branchSegments.push({
        id: b.name,
        name: b.name,
        forkHash: forkHash || tip.parents?.[0] || null,
        mergeHash: mainlineSet.has(tip.hash) ? tip.hash : null,
        merged: mainlineSet.has(tip.hash),
        continued: false,
        commits: chain.length ? chain : [tip],
        commitSet: new Set((chain.length ? chain : [tip]).map((c) => c.hash)),
        forkGraphX: parsed.commits.find((c) => c.hash === forkHash)?.graphX ?? tip.graphX,
        mergeGraphX: mainlineSet.has(tip.hash) ? tip.graphX : null,
        outOfLog: false,
      });
      existing.add(b.name);
      return;
    }

    const seg = {
      id: b.name,
      name: b.name,
      forkHash,
      mergeHash: null,
      merged: false,
      continued: false,
      commits: chain,
      commitSet: new Set(),
      forkGraphX: null,
      mergeGraphX: null,
      outOfLog: false,
    };
    hw.applyBranchSegmentFromTip(seg, parsed, tip, chain, forkHash);
    parsed.branchSegments.push(seg);
    existing.add(b.name);
  });

  parsed.branchSegments = parsed.branchSegments.filter((seg) => {
    if (!/^branch-\d+$/i.test(seg.id || '')) return true;
    return !parsed.branchSegments.some(
      (other) => other !== seg
        && other.id !== seg.id
        && !/^branch-\d+$/i.test(other.id || '')
        && other.forkHash === seg.forkHash
        && other.mergeHash === seg.mergeHash,
    );
  });
}

function inferGitBranchesFromParsed(parsed) {
  const byName = new Map();
  parsed.commits.forEach((c) => {
    (c.refs || []).forEach((r) => {
      const name = hw.normalizeRefName(r);
      if (!name || name === 'HEAD' || name === 'main' || name === 'master') return;
      if (!byName.has(name)) byName.set(name, { name, hash: c.hash });
    });
  });
  return [...byName.values()].sort((a, b) => a.name.localeCompare(b.name));
}

function collectBranchChainToFork(tipHash, commitMap, trunkSet, branchName) {
  const chain = [];
  let cur = commitMap[tipHash];
  while (cur) {
    chain.unshift(cur);
    const p = cur.parents?.[0];
    if (!p) break;
    if (trunkSet.has(p)) {
      const pc = commitMap[p];
      const gp = pc?.parents?.[0];
      if (branchName && pc && hw.commitBelongsToBranch(pc, branchName) && gp) {
        chain.unshift(pc);
        return { chain, forkHash: gp };
      }
      return { chain, forkHash: p };
    }
    cur = commitMap[p];
  }
  return { chain, forkHash: null };
}

function buildTrunkLaneCommitSet(headHash, branchSegments, commitMap, mainlineSet) {
  const interior = new Set();
  branchSegments.forEach((seg) => {
    seg.commits.forEach((c) => {
      if (c.hash === seg.forkHash) return;
      // Junction commits on main (e.g. a2d57ea) stay on parent swimlane.
      if (mainlineSet?.has(c.hash)) return;
      interior.add(c.hash);
    });
  });
  const trunk = new Set();
  let cur = headHash;
  const seen = new Set();
  while (cur && commitMap[cur] && !seen.has(cur)) {
    seen.add(cur);
    if (!interior.has(cur)) trunk.add(cur);
    cur = commitMap[cur].parents[0];
  }
  return trunk;
}

function analyzeDAG(commits, commitMap, headHash) {
  const resolvedHead = headHash || commits[commits.length - 1]?.hash;
  const hasParents = commits.some((c) => c.parents.length > 0);
  const graphX = {};

  if (!hasParents) {
    commits.forEach((c, i) => { graphX[c.hash] = i; });
    const mainlineSet = new Set(commits.map((c) => c.hash));
    return {
      mainlineSet,
      mainlineOrder: commits.map((c) => c.hash),
      trunkLaneCommitSet: mainlineSet,
      branchSegments: [],
      graphX,
      headHash: resolvedHead,
    };
  }

  const mainlineSet = new Set();
  const mainlineOrder = [];
  let cur = resolvedHead;
  while (cur && commitMap[cur]) {
    mainlineSet.add(cur);
    mainlineOrder.unshift(cur);
    cur = commitMap[cur].parents[0];
  }

  function gen(hash) {
    if (graphX[hash] !== undefined) return graphX[hash];
    const c = commitMap[hash];
    if (!c || !c.parents.length) { graphX[hash] = 0; return 0; }
    const g = Math.max(...c.parents.map(gen)) + 1;
    graphX[hash] = g;
    return g;
  }
  commits.forEach((c) => gen(c.hash));

  const branchSegments = [];
  const claimedBranch = new Set();

  commits.forEach((c) => {
    if (c.parents.length < 2) return;
    const branchTip = c.parents[1];
    const chain = hw.collectBranchCommits(branchTip, mainlineSet, commitMap);
    if (!chain.length) return;
    if (!chain.some((x) => x.hash === branchTip)) return;
    const name = hw.extractBranchName(chain) || `branch-${branchSegments.length + 1}`;
    const forkHash = hw.collectBranchChainToFork(branchTip, commitMap, mainlineSet, name).forkHash
      || chain[0].parents[0];
    if (!forkHash) return;
    const commitSet = new Set(chain.map((x) => x.hash));
    chain.forEach((x) => claimedBranch.add(x.hash));
    branchSegments.push({
      id: name,
      name,
      forkHash,
      mergeHash: c.hash,
      merged: true,
      continued: false,
      commits: chain,
      commitSet,
      forkGraphX: graphX[forkHash],
      mergeGraphX: graphX[c.hash],
    });
  });

  const headTip = commitMap[resolvedHead];
  [...commits].reverse().forEach((c) => {
    if (!hw.hasBranchRef(c)) return;
    if (claimedBranch.has(c.hash)) return;
    const name = hw.extractBranchName([c]) || hw.extractBranchName([commitMap[c.hash]].filter(Boolean))
      || `branch-${branchSegments.length + 1}`;
    const { chain, forkHash } = hw.collectBranchChainToFork(c.hash, commitMap, mainlineSet, name);
    if (!chain.length || !forkHash) return;
    if (chain.some((x) => claimedBranch.has(x.hash))) return;
    const commitSet = new Set(chain.map((x) => x.hash));
    chain.forEach((x) => claimedBranch.add(x.hash));
    const continued = chain.some((x) => hw.hasBranchRef(x)) && headTip && !hw.hasBranchRef(headTip);
    branchSegments.push({
      id: name,
      name,
      forkHash,
      mergeHash: null,
      merged: false,
      continued,
      commits: chain,
      commitSet,
      forkGraphX: graphX[forkHash],
      mergeGraphX: null,
    });
  });

  const trunkLaneCommitSet = hw.buildTrunkLaneCommitSet(
    resolvedHead, branchSegments, commitMap, mainlineSet,
  );

  return { mainlineSet, mainlineOrder, trunkLaneCommitSet, branchSegments, graphX, headHash: resolvedHead };
}

function collectBranchCommits(branchTip, mainlineSet, commitMap) {
  const chain = [];
  let cur = branchTip;
  const seen = new Set();
  while (cur && !seen.has(cur) && !mainlineSet.has(cur)) {
    seen.add(cur);
    const c = commitMap[cur];
    if (!c) break;
    chain.push(c);
    cur = c.parents[0];
  }
  return chain.reverse();
}

function extractBranchName(commits) {
  const known = hw.branchRefNames();
  for (const c of commits) {
    for (const r of c.refs || []) {
      const clean = hw.normalizeRefName(r);
      if (known.has(clean)) return clean;
    }
  }
  for (const c of commits) {
    for (const r of c.refs || []) {
      const clean = hw.normalizeRefName(r);
      if (clean && clean !== 'HEAD' && clean !== 'main' && clean !== 'master') return clean;
    }
  }
  return null;
}

function isReachableFrom(ancestorHash, descendantHash, commitMap) {
  if (!ancestorHash || !descendantHash || !commitMap) return false;
  const seen = new Set();
  const stack = [descendantHash];
  while (stack.length) {
    const h = stack.pop();
    if (!h || seen.has(h)) continue;
    if (h === ancestorHash) return true;
    seen.add(h);
    const c = commitMap[h];
    if (!c?.parents) continue;
    c.parents.forEach((p) => { if (p) stack.push(p); });
  }
  return false;
}

Object.assign(hw, {
  branchRefNames,
  normalizeRefName,
  commitBelongsToBranch,
  hasBranchRef,
  resolveCommitHash,
  findMergeCommitForBranch,
  resolveSegmentMergeHash,
  branchSegmentFrozenMerge,
  applyBranchSegmentFromTip,
  enrichBranchSegmentsFromGitBranches,
  inferGitBranchesFromParsed,
  collectBranchChainToFork,
  buildTrunkLaneCommitSet,
  analyzeDAG,
  collectBranchCommits,
  extractBranchName,
  isReachableFrom,
});
