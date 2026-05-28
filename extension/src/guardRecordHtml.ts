import type { GuardStatsEvent, GuardStatsView } from './guardStats';

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function kindLabel(kind: string): string {
  if (kind === 'write') return '写盘还原';
  if (kind === 'edit') return '编辑拦截';
  if (kind === 'commit') return '提交拦截';
  if (kind === 'expand') return '边界扩大';
  return kind;
}

function eventDetail(e: GuardStatsView['events'][0]): string {
  if (e.kind === 'expand' && e.addedPaths?.length) {
    return `+ ${e.addedPaths.slice(0, 4).join(', ')}${e.addedPaths.length > 4 ? ` …+${e.addedPaths.length - 4}` : ''}`;
  }
  const files = e.files.slice(0, 4).join(', ');
  const suffix = e.files.length > 4 ? ` …+${e.files.length - 4}` : '';
  if (e.auditChain) return `${files}${suffix} · 未 expand`;
  return `${files}${suffix}`;
}

function formatTime(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleString('zh-CN', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  } catch {
    return iso;
  }
}

export function buildGuardRecordHtml(view: GuardStatsView, projectName: string): string {
  const maxWeek = Math.max(1, ...view.week.map((d) => d.attempts));
  const bars = view.week
    .map(
      (d) =>
        `<div class="bar-col" title="${escapeHtml(d.day)}：${d.attempts} 次"><div class="bar-stack"><div class="bar-fill" style="height:${Math.round((d.attempts / maxWeek) * 100)}%"></div></div><span class="bar-label">${escapeHtml(d.label)}</span><span class="bar-val">${d.attempts}</span></div>`,
    )
    .join('');

  const events =
    view.events.length === 0
      ? '<p class="empty">尚无记录。开启守门后，AI 越界尝试会累积在这里。</p>'
      : `<ul class="events">${view.events
          .map(
            (e: GuardStatsEvent) =>
              `<li class="event event--${escapeHtml(e.kind)}"><span class="event-kind">${escapeHtml(kindLabel(e.kind))}</span><span class="event-time">${escapeHtml(formatTime(e.at))}</span><span class="event-files">${escapeHtml(eventDetail(e))}</span></li>`,
          )
          .join('')}</ul>`;

  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8" />
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline';" />
<title>守护记录</title>
<style>
:root{--bg:#07080a;--fg:#eef0f4;--muted:#9399a8;--accent:#6d7ce8;--accent-soft:rgba(109,124,232,.18);--warn:#e5b84a;--border:rgba(255,255,255,.08);--surface:#101218}
*{box-sizing:border-box}body{margin:0;min-height:100vh;background:var(--bg);color:var(--fg);font-family:'Inter','PingFang SC',system-ui,sans-serif;font-size:14px}
.wrap{max-width:720px;margin:0 auto;padding:28px 20px 48px}.head{margin-bottom:28px}.head h1{margin:0 0 6px;font-size:22px;font-weight:650}
.head p{margin:0;color:var(--muted);font-size:13px}.metrics{display:grid;grid-template-columns:repeat(4,1fr);gap:14px;margin-bottom:28px}
.metric{background:var(--surface);border:1px solid var(--border);border-radius:12px;padding:18px 16px;text-align:center}
.metric-num{font-size:42px;font-weight:700;line-height:1;font-variant-numeric:tabular-nums}
.metric-num.accent{color:var(--accent)}.metric-num.warn{color:var(--warn)}.metric-num.ok{color:#5fd38d}
.metric-label{margin-top:8px;color:var(--muted);font-size:12px}.panel{background:var(--surface);border:1px solid var(--border);border-radius:12px;padding:18px;margin-bottom:18px}
.panel h2{margin:0 0 14px;font-size:13px;color:var(--muted);font-weight:600;text-transform:uppercase;letter-spacing:.06em}
.bars{display:flex;align-items:flex-end;gap:10px;height:140px;padding-top:8px}.bar-col{flex:1;display:flex;flex-direction:column;align-items:center;gap:6px}
.bar-stack{width:100%;height:96px;display:flex;align-items:flex-end;justify-content:center}.bar-fill{width:70%;max-width:36px;min-height:4px;border-radius:6px 6px 2px 2px;background:linear-gradient(180deg,var(--accent),color-mix(in srgb,var(--accent) 55%,#000));box-shadow:0 0 18px var(--accent-soft)}
.bar-label{font-size:11px;color:var(--muted)}.bar-val{font-size:12px;font-weight:600}.actions{display:flex;gap:10px;flex-wrap:wrap;margin-bottom:18px}
button{border:1px solid var(--border);background:var(--surface);color:var(--fg);border-radius:8px;padding:8px 14px;font-size:13px;cursor:pointer}
button.primary{background:var(--accent);border-color:transparent;color:#fff;font-weight:600}
.events{list-style:none;margin:0;padding:0}.event{display:grid;grid-template-columns:88px 108px 1fr;gap:10px;padding:10px 0;border-bottom:1px solid var(--border);font-size:12px}
.event:last-child{border-bottom:none}.event-kind{color:var(--warn);font-weight:600}.event--expand .event-kind{color:#5fd38d}.event-time{color:var(--muted)}.event-files{font-family:ui-monospace,monospace;word-break:break-all}
.empty{color:var(--muted);margin:0;font-size:13px}.footnote{color:var(--muted);font-size:11px;margin-top:8px}
</style>
</head>
<body>
<div class="wrap">
<header class="head"><h1>守护记录</h1><p>${escapeHtml(projectName)} · AI 越界尝试与拦截统计</p></header>
<section class="metrics">
<div class="metric"><div class="metric-num warn">${view.totals.attempts}</div><div class="metric-label">越界尝试</div></div>
<div class="metric"><div class="metric-num accent">${view.totals.blocked}</div><div class="metric-label">成功拦截</div></div>
<div class="metric"><div class="metric-num ok">${view.totals.expansions}</div><div class="metric-label">边界扩大</div></div>
<div class="metric"><div class="metric-num ok">${view.totals.rate}<span style="font-size:22px">%</span></div><div class="metric-label">拦截率</div></div>
</section>
<div class="actions"><button class="primary" id="share">复制分享卡片</button><button id="refresh">刷新</button><button id="timeline">打开泳道</button></div>
<section class="panel"><h2>近 7 天</h2><div class="bars">${bars}</div><p class="footnote">柱高 = 当日越界尝试次数</p></section>
<section class="panel"><h2>最近事件</h2>${events}</section>
</div>
<script>
const vscode=acquireVsCodeApi();
document.getElementById('share').onclick=()=>vscode.postMessage({type:'share'});
document.getElementById('refresh').onclick=()=>vscode.postMessage({type:'refresh'});
document.getElementById('timeline').onclick=()=>vscode.postMessage({type:'timeline'});
</script>
</body></html>`;
}
