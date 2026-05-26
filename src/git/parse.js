import { hw } from '../core/hw.js';

function isCommitHeaderLine(line) {
  const t = line.trim();
  return /^[0-9a-f]{7,40}\|/i.test(t);
}

function sliceLogByCommitLimit(text, maxCommits) {
  const lines = text.split('\n');
  const blocks = [];
  let block = null;
  for (const line of lines) {
    if (hw.isCommitHeaderLine(line)) {
      if (block) blocks.push(block);
      block = [line];
    } else if (block) {
      block.push(line);
    }
  }
  if (block) blocks.push(block);
  const total = blocks.length;
  const limit = Math.max(1, maxCommits || total);
  const kept = blocks.slice(0, Math.min(limit, total));
  return {
    text: kept.map((b) => b.join('\n')).join('\n\n'),
    totalCommits: total,
    loaded: kept.length,
  };
}

function resolveHeadHash(commits, commitMap, gitBranches) {
  for (const name of ['main', 'master']) {
    const tip = gitBranches?.find((b) => b.name === name)?.hash;
    if (tip && commitMap[tip]) return tip;
  }
  for (const name of ['main', 'master']) {
    const hit = commits.find((c) => (c.refs || []).some((r) => hw.normalizeRefName(r) === name));
    if (hit) return hit.hash;
  }
  return commits[commits.length - 1]?.hash || null;
}

function parseGitLog(text, options = {}) {
  const commits = [];
  let current = null;

  for (const rawLine of text.split('\n')) {
    const line = rawLine.trim();
    if (!line) continue;

    const m6 = line.match(/^([0-9a-f]{7,40})\|([^|]*)\|([^|]*)\|([^|]+)\|([^|]+)\|(.+)$/i);
    const m5 = line.match(/^([0-9a-f]{7,40})\|([^|]*)\|([^|]*)\|(.+?)\|(.+)$/i);
    const m4p = line.match(/^([0-9a-f]{7,40})\|([^|]*)\|(.+?)\|(.+)$/i);
    const m3 = line.match(/^([0-9a-f]{7,40})\|(.+?)\|(.+)$/i);

    if (m6) {
      if (current) commits.push(current);
      const parents = m6[2].trim() && m6[2].trim() !== '-' ? m6[2].trim().split(/\s+/) : [];
      const refs = hw.parseRefs(m6[3]);
      current = {
        hash: m6[1],
        parents,
        refs,
        author: m6[4],
        date: m6[5],
        subject: m6[6].trim(),
        files: [],
      };
    } else if (m5) {
      if (current) commits.push(current);
      const parents = m5[2].trim() && m5[2].trim() !== '-' ? m5[2].trim().split(/\s+/) : [];
      const refs = hw.parseRefs(m5[3]);
      current = {
        hash: m5[1],
        parents,
        refs,
        author: m5[4],
        date: m5[5],
        files: [],
      };
    } else if (m4p) {
      if (current) commits.push(current);
      const parents = m4p[2].trim() && m4p[2].trim() !== '-' ? m4p[2].trim().split(/\s+/) : [];
      current = {
        hash: m4p[1],
        parents,
        refs: [],
        author: m4p[3],
        date: m4p[4],
        files: [],
      };
    } else if (m3) {
      if (current) commits.push(current);
      current = { hash: m3[1], parents: [], refs: [], author: m3[2], date: m3[3], files: [] };
    } else if (current) {
      current.files.push(line);
    }
  }
  if (current) commits.push(current);
  if (commits.length === 0) {
    throw new Error('无法解析 log。请使用 git log --all --name-only --pretty=format:"%H|%P|%D|%an|%ad|%s"');
  }

  commits.reverse();
  const commitMap = hw.buildCommitMap(commits);
  const headHash = hw.resolveHeadHash(commits, commitMap, options.gitBranches || []);
  const dag = hw.analyzeDAG(commits, commitMap, headHash);

  commits.forEach((c, i) => {
    c.versionIndex = i + 1;
    c.globalIndex = i;
    c.files = [...new Set(c.files)].sort();
    c.isMainline = dag.mainlineSet.has(c.hash);
    c.graphX = dag.graphX[c.hash] ?? i;
  });

  let mainlineVersionIndex = 0;
  commits.forEach((c) => {
    if (c.isMainline) {
      mainlineVersionIndex += 1;
      c.mainlineVersionIndex = mainlineVersionIndex;
    }
  });

  hw.assignDisplayColumns(commits);

  const fileTimelines = {};
  for (const c of commits) {
    for (const f of c.files) {
      if (!fileTimelines[f]) fileTimelines[f] = [];
      fileTimelines[f].push({
        commitHash: c.hash,
        date: c.date,
        versionIndex: c.versionIndex,
        graphX: c.graphX,
        displayColumn: c.displayColumn,
      });
    }
  }

  return {
    commits,
    fileTimelines,
    commitMap,
    mainlineSet: dag.mainlineSet,
    trunkLaneCommitSet: dag.trunkLaneCommitSet,
    branchSegments: dag.branchSegments,
    headHash: dag.headHash,
    totalCommitsInLog: commits.length,
    loadedCommitCount: commits.length,
  };
}

function parseRefs(raw) {
  if (!raw || !raw.trim()) return [];
  return raw.split(',').map((s) => s.trim().replace(/^\(|\)$/g, ''))
    .map((s) => s.replace(/^HEAD -> /, ''))
    .filter(Boolean);
}

function buildCommitMap(commits) {
  const map = {};
  commits.forEach((c) => { map[c.hash] = c; });
  const resolve = (token) => {
    if (map[token]) return token;
    const hits = Object.keys(map).filter((h) => h.startsWith(token));
    return hits.length === 1 ? hits[0] : token;
  };
  commits.forEach((c) => {
    c.parents = c.parents.map(resolve).filter((p) => map[p]);
  });
  return map;
}

Object.assign(hw, {
  isCommitHeaderLine,
  sliceLogByCommitLimit,
  resolveHeadHash,
  parseGitLog,
  parseRefs,
  buildCommitMap,
});
