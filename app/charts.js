// SVG charts: sparkline (table cell) + lineChart (drawer). Points: [{date, weight, reps, notes, src}]
import { esc } from './helpers.js';

export function sparkline(points, width = 92, height = 26) {
  if (!points || points.length < 2) return '<span class="dash">—</span>';
  const ws = points.map(p => p.weight);
  const min = Math.min(...ws), max = Math.max(...ws);
  const pad = 3;
  const span = max - min || 1;
  const x = i => pad + (i / (points.length - 1)) * (width - pad * 2);
  const y = w => height - pad - ((w - min) / span) * (height - pad * 2);
  const d = points.map((p, i) => `${x(i).toFixed(1)},${y(p.weight).toFixed(1)}`).join(' ');
  const last = points[points.length - 1];
  return `<svg width="${width}" height="${height}" style="color:var(--accent);display:block">
    <polyline points="${d}" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round" stroke-linecap="round"></polyline>
    <circle cx="${x(points.length - 1)}" cy="${y(last.weight)}" r="2.4" fill="currentColor"></circle>
  </svg>`;
}

export function lineChart(points, width = 412, height = 218) {
  if (!points || points.length < 2) {
    return '<div style="color:var(--muted);font-size:13px;padding:14px 0">Not enough logged sessions to chart yet — only the current maxes are recorded.</div>';
  }
  const m = { l: 42, r: 18, t: 22, b: 30 };
  const iw = width - m.l - m.r, ih = height - m.t - m.b;
  const ts = points.map(p => new Date(p.date + 'T00:00:00').getTime());
  const ws = points.map(p => p.weight);
  let t0 = Math.min(...ts), t1 = Math.max(...ts);
  if (t0 === t1) { t0 -= 86400000; t1 += 86400000; }
  let w0 = Math.min(...ws), w1 = Math.max(...ws);
  const wpad = Math.max((w1 - w0) * 0.15, 2.5);
  w0 = Math.floor((w0 - wpad) / 5) * 5;
  w1 = Math.ceil((w1 + wpad) / 5) * 5;
  const x = t => m.l + ((t - t0) / (t1 - t0)) * iw;
  const y = w => m.t + ih - ((w - w0) / (w1 - w0)) * ih;
  const ticks = [];
  const step = Math.max(5, Math.round((w1 - w0) / 4 / 5) * 5);
  for (let v = w0; v <= w1 + 0.001; v += step) ticks.push(v);
  const fmtD = t => new Date(t).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
  const d = points.map((p, i) => `${x(ts[i]).toFixed(1)},${y(p.weight).toFixed(1)}`).join(' ');
  const labelAll = points.length <= 6;
  return `<svg width="${width}" height="${height}" style="max-width:100%;display:block">
    ${ticks.map(v => `<g>
      <line x1="${m.l}" x2="${width - m.r}" y1="${y(v)}" y2="${y(v)}" stroke="var(--border)" stroke-width="1"></line>
      <text x="${m.l - 8}" y="${y(v) + 3.5}" text-anchor="end" font-size="10.5" fill="var(--muted)">${v}</text>
    </g>`).join('')}
    <polyline points="${d}" fill="none" stroke="var(--accent)" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"></polyline>
    ${points.map((p, i) => `<g>
      <circle cx="${x(ts[i])}" cy="${y(p.weight)}" r="3.4" fill="var(--accent)">
        <title>${esc(`${p.date} — ${p.weight} kg${p.reps ? ' × ' + p.reps : ''}${p.notes ? '\n' + p.notes : ''}`)}</title>
      </circle>
      ${labelAll ? `<text x="${x(ts[i])}" y="${y(p.weight) - 9}" text-anchor="middle" font-size="10.5" font-weight="600" fill="var(--text)">${p.weight}</text>` : ''}
    </g>`).join('')}
    <text x="${m.l}" y="${height - 8}" font-size="10.5" fill="var(--muted)">${fmtD(t0)}</text>
    <text x="${width - m.r}" y="${height - 8}" text-anchor="end" font-size="10.5" fill="var(--muted)">${fmtD(t1)}</text>
  </svg>`;
}
