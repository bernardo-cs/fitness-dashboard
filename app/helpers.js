// Shared helpers + small HTML builders for the fitness dashboard.

export const esc = (s = '') => String(s ?? '').replace(/[&<>"']/g, c => (
  { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
));

export const FT = {
  fmtKg(w) {
    const r = Math.round(w * 10) / 10;
    return (Number.isInteger(r) ? r.toString() : r.toFixed(1)) + ' kg';
  },
  parseDate(s) { return s ? new Date(s + 'T00:00:00') : null; },
  fmtDate(s) {
    const d = FT.parseDate(s);
    return d ? d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '—';
  },
  fmtDateShort(s) {
    const d = FT.parseDate(s);
    return d ? d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) : '—';
  },
  daysAgo(s) {
    const d = FT.parseDate(s);
    if (!d) return null;
    return Math.max(0, Math.floor((Date.now() - d.getTime()) / 86400000));
  },
  titleCase(k) { return String(k || '').split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' '); },

  // Effective 1RM: confirmed > data-provided estimate > Epley from best rep-max.
  effective1RM(lift) {
    const conf = lift.maxes.find(m => m.label === '1RM');
    if (conf) return { weight: conf.weight, kind: 'confirmed', detail: 'confirmed 1RM' };
    const est = lift.maxes.find(m => m.label === '1RM EST');
    const reps = lift.maxes
      .map(m => { const mt = /^([2-9])RM$/.exec(m.label); return mt ? { reps: +mt[1], w: m.weight } : null; })
      .filter(Boolean);
    let epley = null, epleyFrom = null;
    for (const r of reps) {
      const e = r.w * (1 + r.reps / 30);
      if (epley === null || e > epley) { epley = e; epleyFrom = r; }
    }
    if (est && (epley === null || est.weight >= epley)) return { weight: est.weight, kind: 'est', detail: 'estimate from logs' };
    if (epley !== null) return { weight: Math.round(epley * 2) / 2, kind: 'epley', detail: `Epley from ${epleyFrom.w} kg × ${epleyFrom.reps}` };
    if (est) return { weight: est.weight, kind: 'est', detail: 'estimate from logs' };
    return null;
  },

  staleness(lift, months) {
    if (!lift.lastTest) return { state: 'untested', days: null };
    const days = FT.daysAgo(lift.lastTest);
    return { state: days > months * 30.44 ? 'stale' : 'fresh', days };
  },

  injuriesFor(key, chronic) {
    return (chronic || []).filter(c => (c.affectedExercises || []).includes(key));
  },

  // Progression points: lift.history merged with matching PR entries, ascending by date.
  trendPoints(lift, prs) {
    const pts = (lift.history || [])
      .filter(h => typeof h.weight === 'number')
      .map(h => ({ date: h.date, weight: h.weight, reps: h.reps, notes: h.notes || '', src: 'log' }));
    (prs || []).forEach(p => {
      if (typeof p.weight !== 'number') return;
      const base = p.exercise.replace(/_deep$/, '');
      if (p.exercise !== lift.key && base !== lift.key) return;
      const dup = pts.find(q => q.date === p.date && q.weight === p.weight);
      if (dup) { dup.src = 'pr'; return; } // same event logged in both places — it's still a PR
      pts.push({ date: p.date, weight: p.weight, reps: p.reps, notes: p.notes || '', src: 'pr' });
    });
    pts.sort((a, b) => a.date.localeCompare(b.date));
    return pts;
  },

  roundTo(w, inc) { return Math.round(w / inc) * inc; },

  severity(s) {
    const map = {
      'leve': { label: 'mild', cls: '' },
      'leve-moderada': { label: 'mild–moderate', cls: 'warn' },
      'moderada': { label: 'moderate', cls: 'warn' }
    };
    return map[(s || '').toLowerCase()] || { label: s || '—', cls: '' };
  },

  areaLabel(area) {
    const map = {
      'pulsos': 'Wrists',
      'bacia/hips': 'Hips',
      'tornozelos': 'Ankles',
      'ombro esquerdo/overhead': 'Left shoulder (overhead)',
      'ombro esquerdo': 'Left shoulder',
      'ombro direito': 'Right shoulder',
      'ombros/rack position': 'Shoulders / rack position',
      'core/overhead stability': 'Core / overhead stability',
      'joelho esquerdo': 'Left knee'
    };
    return map[(area || '').toLowerCase()] || area;
  },

  freshness(mg) {
    const days = FT.daysAgo(mg.last_heavy);
    if (days === null) return { label: 'No heavy log', cls: '', days };
    if (days <= 2) return { label: 'Loaded', cls: 'warn', days };
    if (days <= 4) return { label: 'Recovering', cls: 'accent', days };
    return { label: 'Fresh', cls: 'good', days };
  }
};

export function chip(children, tone = '', title = '') {
  return `<span class="chip${tone ? ' ' + tone : ''}"${title ? ` title="${esc(title)}"` : ''}>${children}</span>`;
}

export function statCard(label, value, sub) {
  return `<div class="stat-card">
    <div class="stat-label">${esc(label)}</div>
    <div class="stat-value">${value}</div>
    ${sub ? `<div class="stat-sub">${esc(sub)}</div>` : ''}
  </div>`;
}

export function sectionTitle(children) {
  return `<h2 class="section-title">${esc(children)}</h2>`;
}
