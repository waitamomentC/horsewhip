/**
 * Demo git log — realistic branch scenarios (newest commit first).
 * Format: %H|%P|%D|%an|%ad
 *
 * Scenarios:
 * 1. feature/auth — fork → 2 commits → merge back (login.ts 回到主泳道)
 * 2. feature/exp — fork → 2 commits → 主泳道从分支 tip 继续（无 merge commit）
 * 3. feature/ui — fork → 2 commits → 未合并，HEAD 在分支上（Button 主泳道在分叉点停止）
 */
const DEMO_GIT_LOG = `0100000000000000000000000000000000000018|0100000000000000000000000000000000000017|HEAD -> feature/ui|Bob Dev|2024-03-22
src/components/Button.tsx

0100000000000000000000000000000000000017|0100000000000000000000000000000000000016||Bob Dev|2024-03-21
src/components/Button.tsx
src/components/Header.tsx

0100000000000000000000000000000000000016|0100000000000000000000000000000000000015|feature/ui|Bob Dev|2024-03-20
src/components/Button.tsx

0100000000000000000000000000000000000015|010000000000000000000000000000000000000b||Alice Chen|2024-03-19
src/components/Button.tsx

0100000000000000000000000000000000000014|010000000000000000000000000000000000000b||Alice Chen|2024-03-18
README.md

0100000000000000000000000000000000000013|0100000000000000000000000000000000000012||Alice Chen|2024-03-17
src/app.tsx
src/experiment.ts

0100000000000000000000000000000000000012|0100000000000000000000000000000000000011||Bob Dev|2024-03-16
src/experiment.ts

0100000000000000000000000000000000000011|0100000000000000000000000000000000000010|feature/exp|Bob Dev|2024-03-15
src/experiment.ts

0100000000000000000000000000000000000010|0100000000000000000000000000000000000006||Alice Chen|2024-03-14
src/experiment.ts

0100000000000000000000000000000000000009|0100000000000000000000000000000000000006 0100000000000000000000000000000000000008||Alice Chen|2024-03-12
src/auth/login.ts

0100000000000000000000000000000000000008|0100000000000000000000000000000000000007||Bob Dev|2024-03-11
src/auth/oauth.ts

0100000000000000000000000000000000000007|0100000000000000000000000000000000000006|feature/auth|Bob Dev|2024-03-10
src/auth/login.ts

0100000000000000000000000000000000000006|0100000000000000000000000000000000000005||Alice Chen|2024-03-08
src/utils/format.ts

0100000000000000000000000000000000000005|0100000000000000000000000000000000000004||Carol Ops|2024-03-06
docs/api.md
docs/changelog.md

0100000000000000000000000000000000000004|0100000000000000000000000000000000000003||Bob Dev|2024-03-04
src/components/Footer.tsx
src/components/Header.tsx

0100000000000000000000000000000000000003|0100000000000000000000000000000000000002||Alice Chen|2024-03-02
src/auth/login.ts
src/auth/session.ts
src/middleware/auth.ts

0100000000000000000000000000000000000002|0100000000000000000000000000000000000001||Bob Dev|2024-02-24
src/app.tsx
src/index.ts
tsconfig.json

0100000000000000000000000000000000000001|-|Alice Chen|2024-02-01
README.md
package.json
src/index.ts
`;

/** Synthetic stress-test log (~1500 files, ~170 commits, mixed branch endings). */
const MEGA_DEMO_DEFAULTS = {
  files: 1500,
  commits: 120,
  branchEvery: 15,
  branchDepth: 5,
  filesPerCommit: 18,
};

function padHash(n) {
  const hex = n.toString(16);
  return hex.padStart(40, '0');
}

function buildFilePool(target) {
  const paths = [];
  const roots = [
    'src/core', 'src/ui', 'src/api', 'src/data', 'lib/shared', 'lib/utils',
    'apps/web', 'apps/admin', 'apps/mobile', 'services/auth', 'services/billing',
    'services/notify', 'packages/forms', 'packages/charts', 'packages/tables',
    'tests/unit', 'tests/integration', 'tests/e2e', 'docs/api', 'docs/guides',
    'tools/ci', 'tools/scripts', 'config/env', 'public/assets',
  ];
  const ext = ['.ts', '.tsx', '.js', '.md', '.json', '.css', '.mjs'];
  for (let ring = 0; paths.length < target; ring += 1) {
    for (const root of roots) {
      for (let i = 0; i < 6 && paths.length < target; i += 1) {
        for (let j = 0; j < 5 && paths.length < target; j += 1) {
          const extName = ext[(ring + i + j) % ext.length];
          paths.push(`${root}/z${ring}/m${i}/f${j}${extName}`);
        }
      }
    }
  }
  return paths.slice(0, target);
}

function pickFiles(pool, count, seed) {
  const picked = new Set();
  const n = pool.length;
  for (let k = 0; picked.size < count && k < n * 2; k += 1) {
    const idx = (seed * 9973 + k * 104729) % n;
    picked.add(pool[idx]);
  }
  return [...picked].sort();
}

function dateForMainline(index) {
  const d = new Date('2023-01-10');
  d.setDate(d.getDate() + index * 3);
  return d.toISOString().slice(0, 10);
}

function formatCommitLine(c) {
  const parents = c.parents.join(' ');
  const refs = c.refs || '';
  return `${c.hash}|${parents}|${refs}|${c.author}|${c.date}`;
}

/**
 * Build a large git log string (newest commit first).
 * Branch endings rotate: merge · open (HEAD stays on branch) · continue from tip (no merge).
 */
function buildMegaDemoLog(options = {}) {
  const cfg = { ...MEGA_DEMO_DEFAULTS, ...options };
  const pool = buildFilePool(cfg.files);
  const authors = ['Alice Chen', 'Bob Dev', 'Carol Ops', 'Dana Lin', 'Eve Park', 'Frank Wu'];
  const chronological = [];
  let seq = 0;
  let mainTip = null;
  let branchRound = 0;

  for (let m = 1; m <= cfg.commits; m += 1) {
    seq += 1;
    const hash = padHash(seq);
    const parents = mainTip ? [mainTip] : ['-'];
    const refs = m === cfg.commits ? 'HEAD -> main' : '';
    chronological.push({
      hash,
      parents,
      refs,
      author: authors[m % authors.length],
      date: dateForMainline(m),
      files: pickFiles(pool, cfg.filesPerCommit + (m % 7), m * 31),
    });
    mainTip = hash;

    const room = m + cfg.branchDepth + 1 <= cfg.commits;
    if (room && m % cfg.branchEvery === 0) {
      const forkPoint = mainTip;
      let branchTip = forkPoint;
      const stream = `feature/stream-${m}`;
      const mode = branchRound % 3;
      branchRound += 1;

      for (let b = 1; b <= cfg.branchDepth; b += 1) {
        seq += 1;
        const bh = padHash(seq);
        chronological.push({
          hash: bh,
          parents: [branchTip],
          refs: b === 1 ? stream : '',
          author: authors[(m + b) % authors.length],
          date: dateForMainline(m + b * 0.4),
          files: pickFiles(pool, cfg.filesPerCommit - 2 + (b % 5), m * 97 + b),
        });
        branchTip = bh;
      }

      if (mode === 0) {
        seq += 1;
        const mergeHash = padHash(seq);
        chronological.push({
          hash: mergeHash,
          parents: [forkPoint, branchTip],
          refs: '',
          author: authors[(m + 2) % authors.length],
          date: dateForMainline(m + 1),
          files: pickFiles(pool, cfg.filesPerCommit + 4, m * 53 + 7),
        });
        mainTip = mergeHash;
      } else if (mode === 1) {
        chronological[chronological.length - 1].refs = stream;
        mainTip = forkPoint;
      } else {
        seq += 1;
        const continued = padHash(seq);
        chronological.push({
          hash: continued,
          parents: [branchTip],
          refs: '',
          author: authors[(m + 1) % authors.length],
          date: dateForMainline(m + 1),
          files: pickFiles(pool, cfg.filesPerCommit + 2, m * 71 + 2),
        });
        mainTip = continued;
      }
    }
  }

  const last = chronological[chronological.length - 1];
  if (last && !String(last.refs).includes('HEAD')) {
    last.refs = last.refs ? `${last.refs}, HEAD -> main` : 'HEAD -> main';
  }

  const lines = [];
  for (let i = chronological.length - 1; i >= 0; i -= 1) {
    const c = chronological[i];
    lines.push(formatCommitLine(c));
    c.files.forEach((f) => lines.push(f));
    if (i > 0) lines.push('');
  }
  return {
    log: lines.join('\n'),
    stats: {
      files: pool.length,
      commits: chronological.length,
      branches: Math.floor(cfg.commits / cfg.branchEvery),
    },
  };
}
