import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';

const STATS_NAME = 'guard-stats.json';
const MAX_EVENTS = 120;
const DEDUPE_MS = 4000;

export type GuardEventKind = 'write' | 'edit' | 'commit';

export type GuardStatsEvent = {
  at: string;
  kind: GuardEventKind;
  files: string[];
  attempts: number;
  blocked: number;
  source?: string;
};

export type GuardStatsDay = {
  attempts: number;
  blocked: number;
};

export type GuardStatsFile = {
  version: 1;
  updatedAt: string;
  totals: { attempts: number; blocked: number };
  byDay: Record<string, GuardStatsDay>;
  events: GuardStatsEvent[];
};

export type GuardStatsView = {
  totals: { attempts: number; blocked: number; rate: number };
  week: Array<{ day: string; label: string; attempts: number; blocked: number }>;
  events: GuardStatsEvent[];
  workspaceRoot: string;
};

const statsCache = new Map<string, GuardStatsFile>();
const dedupeAt = new Map<string, number>();
const changeEmitter = new vscode.EventEmitter<string>();

export const onGuardStatsChanged = changeEmitter.event;

function statsPath(workspaceRoot: string): string {
  return path.join(workspaceRoot, '.git', 'horsewhip', STATS_NAME);
}

function dayKey(iso: string): string {
  return iso.slice(0, 10);
}

function emptyStats(): GuardStatsFile {
  return {
    version: 1,
    updatedAt: new Date().toISOString(),
    totals: { attempts: 0, blocked: 0 },
    byDay: {},
    events: [],
  };
}

function ratePercent(attempts: number, blocked: number): number {
  if (attempts <= 0) return blocked > 0 ? 100 : 0;
  return Math.round((blocked / attempts) * 1000) / 10;
}

export function getCachedTotals(workspaceRoot: string | undefined): { attempts: number; blocked: number } {
  if (!workspaceRoot) return { attempts: 0, blocked: 0 };
  return statsCache.get(workspaceRoot)?.totals ?? { attempts: 0, blocked: 0 };
}

export async function loadGuardStats(workspaceRoot: string): Promise<GuardStatsFile> {
  const cached = statsCache.get(workspaceRoot);
  if (cached) return cached;

  const file = statsPath(workspaceRoot);
  try {
    const raw = await fs.promises.readFile(file, 'utf8');
    const data = JSON.parse(raw) as GuardStatsFile;
    if (data.version !== 1 || !data.totals || !Array.isArray(data.events)) {
      const fresh = emptyStats();
      statsCache.set(workspaceRoot, fresh);
      return fresh;
    }
    statsCache.set(workspaceRoot, data);
    return data;
  } catch {
    const fresh = emptyStats();
    statsCache.set(workspaceRoot, fresh);
    return fresh;
  }
}

function shouldRecord(workspaceRoot: string, dedupeKey: string): boolean {
  const full = `${workspaceRoot}::${dedupeKey}`;
  const last = dedupeAt.get(full) ?? 0;
  if (Date.now() - last < DEDUPE_MS) return false;
  dedupeAt.set(full, Date.now());
  return true;
}

export async function recordGuardEvent(
  workspaceRoot: string,
  payload: {
    kind: GuardEventKind;
    files: string[];
    source?: string;
    dedupeKey?: string;
  },
): Promise<GuardStatsFile | null> {
  const files = [...new Set(payload.files.filter(Boolean))];
  if (!files.length && payload.kind !== 'commit') return null;

  const dedupeKey = payload.dedupeKey ?? `${payload.kind}:${files.sort().join('|')}`;
  if (!shouldRecord(workspaceRoot, dedupeKey)) return null;

  const stats = await loadGuardStats(workspaceRoot);
  const attempts = Math.max(1, files.length);
  const blocked = attempts;
  const at = new Date().toISOString();
  const day = dayKey(at);

  stats.totals.attempts += attempts;
  stats.totals.blocked += blocked;
  if (!stats.byDay[day]) stats.byDay[day] = { attempts: 0, blocked: 0 };
  stats.byDay[day].attempts += attempts;
  stats.byDay[day].blocked += blocked;

  stats.events.unshift({
    at,
    kind: payload.kind,
    files,
    attempts,
    blocked,
    source: payload.source,
  });
  if (stats.events.length > MAX_EVENTS) stats.events.length = MAX_EVENTS;
  stats.updatedAt = at;

  statsCache.set(workspaceRoot, stats);
  await fs.promises.mkdir(path.dirname(statsPath(workspaceRoot)), { recursive: true });
  await fs.promises.writeFile(statsPath(workspaceRoot), `${JSON.stringify(stats, null, 2)}\n`, 'utf8');
  changeEmitter.fire(workspaceRoot);
  return stats;
}

export async function buildGuardStatsView(workspaceRoot: string): Promise<GuardStatsView> {
  const stats = await loadGuardStats(workspaceRoot);
  const week: GuardStatsView['week'] = [];
  const now = new Date();
  for (let i = 6; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    const key = d.toISOString().slice(0, 10);
    const label = `${d.getMonth() + 1}/${d.getDate()}`;
    const row = stats.byDay[key] ?? { attempts: 0, blocked: 0 };
    week.push({ day: key, label, attempts: row.attempts, blocked: row.blocked });
  }
  return {
    totals: {
      ...stats.totals,
      rate: ratePercent(stats.totals.attempts, stats.totals.blocked),
    },
    week,
    events: stats.events.slice(0, 30),
    workspaceRoot,
  };
}

export function buildShareCard(view: GuardStatsView, projectName: string): string {
  const weekAttempts = view.week.reduce((n, d) => n + d.attempts, 0);
  const weekBlocked = view.week.reduce((n, d) => n + d.blocked, 0);
  const weekRate = ratePercent(weekAttempts, weekBlocked);
  return [
    '🐎 Horsewhip 守护记录',
    `项目：${projectName}`,
    '',
    `累计：AI 越界尝试 ${view.totals.attempts} 次 · 成功拦截 ${view.totals.blocked} 次（${view.totals.rate}%）`,
    `近 7 天：越界 ${weekAttempts} 次 · 拦截 ${weekBlocked} 次（${weekRate}%）`,
    '',
    '边界内改码，圈外一律拦下。',
    '#Horsewhip #AI守门',
  ].join('\n');
}

export async function bootstrapGuardStats(workspaceRoot: string): Promise<void> {
  await loadGuardStats(workspaceRoot);
}
