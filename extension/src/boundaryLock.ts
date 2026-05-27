/** Commit + branch scope for whip-lock (Git layer, not editor). */

import { gitBranchDisplay } from './gitRunner';

export type LockTarget = {
  nodeId: string;
  commit: string;
  branch: string;
  lanePath?: string;
  files: string[];
};

export function normalizeBranchName(branch: string | undefined): string {
  const b = String(branch || '').trim();
  if (!b) return '';
  const lower = b.toLowerCase();
  if (lower === 'main' || lower === 'master') return lower;
  return b;
}

export function branchesFromTargets(targets: LockTarget[]): string[] {
  return [...new Set(targets.map((t) => normalizeBranchName(t.branch)).filter(Boolean))];
}

export type BranchLockVerdict = {
  ok: boolean;
  reason?: string;
};

/** Local repo is on one branch; locked aim must match it (or main/master pair). */
export async function evaluateBranchLock(
  workspaceRoot: string,
  targets: LockTarget[],
): Promise<BranchLockVerdict> {
  if (!targets.length) return { ok: true };

  const lockedBranches = branchesFromTargets(targets);
  if (lockedBranches.length > 1) {
    return {
      ok: false,
      reason: `瞄准了多条分支（${lockedBranches.join('、')}），本地一次只能在一个分支上提交。请只瞄准同一分支上的节点后重新挥鞭。`,
    };
  }

  const { label: currentRaw, detached } = await gitBranchDisplay(workspaceRoot);
  if (detached) {
    return {
      ok: false,
      reason: '当前处于 detached HEAD，请先 git switch 到瞄准分支后再提交。',
    };
  }

  const expected = lockedBranches[0] || '';
  const current = normalizeBranchName(currentRaw);

  if (!expected) {
    const onMain = current === 'main' || current === 'master' || !current;
    if (!onMain) {
      return {
        ok: false,
        reason: `瞄准为主泳道 commit，但当前在 ⎇ ${currentRaw}。请先 git switch main（或 master）后再改/提交。`,
      };
    }
    return { ok: true };
  }

  if (current === expected) return { ok: true };
  if (
    (expected === 'main' || expected === 'master') &&
    (current === 'main' || current === 'master')
  ) {
    return { ok: true };
  }

  return {
    ok: false,
    reason: `当前在 ⎇ ${currentRaw}，瞄准锁定为 ⎇ ${expected}。请先 git switch ${expected} 后再提交。`,
  };
}
