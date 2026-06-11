// Views: Today, Overview, Strength (+ detail drawer), Body & Recovery.
// Each returns an HTML string; interaction is wired via data-* attributes in main.js
// (data-open-lift opens the lift drawer, data-close-drawer closes it).
import { FT, esc, chip, statCard, sectionTitle } from './helpers.js';
import { sparkline, lineChart } from './charts.js';

export function todayView(data) {
  const tw = data.today;
  if (!tw) {
    return `<div class="page">
      <h1 class="page-title">Today</h1>
      <p class="page-meta">No workout posted yet — when your agent writes <code>today-workout.json</code> and rebuilds the data, it shows up here.</p>
    </div>`;
  }
  const lift = tw.strength && tw.strength.liftKey ? data.strength.find(l => l.key === tw.strength.liftKey) : null;
  return `<div class="page">
    <h1 class="page-title">Today’s Workout</h1>
    <p class="page-meta">${FT.fmtDate(tw.date)}</p>
    <div class="chip-row" style="margin-top:-18px;margin-bottom:26px">
      ${tw.confirmed ? chip('Confirmed', 'good') : chip('Not confirmed')}
      ${tw.type ? chip(esc(tw.type), 'accent') : ''}
      ${tw.location ? chip(esc(tw.location) + (tw.time ? ' · ' + esc(tw.time) : '')) : ''}
    </div>

    ${tw.warmup && tw.warmup.length ? `<div class="section" style="margin-top:0">
      ${sectionTitle('Warm-up')}
      <div class="chronic-card">
        <div class="chip-row" style="margin-top:0">
          ${tw.warmup.map(w => chip(esc(w))).join('')}
        </div>
      </div>
    </div>` : ''}

    <div class="section">
      <div class="today-grid">
        ${tw.strength ? `<div class="chronic-card">
          ${sectionTitle('Strength')}
          <div class="chronic-area">${esc(tw.strength.title)}</div>
          ${tw.strength.scheme ? `<div class="chronic-type">${esc(tw.strength.scheme)}</div>` : ''}
          ${tw.strength.sets && tw.strength.sets.length ? `<table class="pct-table" style="margin-top:12px">
            <thead>
              <tr>
                <th class="sets-th">Set</th>
                <th class="sets-th">Reps</th>
                <th class="sets-th">Weight</th>
              </tr>
            </thead>
            <tbody>
              ${tw.strength.sets.map(s => `<tr>
                <td class="pct">${esc(s.set)}</td>
                <td class="pct">${esc(s.reps)}</td>
                <td class="kg">${esc(s.weight)}</td>
              </tr>`).join('')}
            </tbody>
          </table>` : ''}
          ${tw.strength.rationale ? `<div class="chronic-notes" style="margin-top:12px">${esc(tw.strength.rationale)}</div>` : ''}
          ${lift ? `<button class="link-btn" data-open-lift="${esc(lift.key)}">View ${esc(lift.name)} — ${FT.fmtKg(lift.bestWeight)} ${esc(lift.bestLabel)} →</button>` : ''}
        </div>` : ''}

        <div style="display:flex;flex-direction:column;gap:12px">
          ${tw.conditioning ? `<div class="chronic-card">
            ${sectionTitle('Conditioning')}
            <div class="chronic-area">${esc(tw.conditioning.title)}</div>
            ${tw.conditioning.rx ? `<div class="chip-row">${chip('RX ' + esc(tw.conditioning.rx), 'accent')}</div>` : ''}
            ${(tw.conditioning.tips || []).map(t => `<div class="chronic-notes">${esc(t)}</div>`).join('')}
          </div>` : ''}
          ${tw.mobility && tw.mobility.length ? `<div class="chronic-card">
            ${sectionTitle('Mobility before class')}
            ${tw.mobility.map((m, i) => `<div class="chronic-warmup" style="margin-top:${i === 0 ? 0 : 8}px">
              <b>${esc(m.area)}:</b> ${esc(m.drill)}
            </div>`).join('')}
          </div>` : ''}
        </div>
      </div>
    </div>

    ${tw.note ? `<p class="today-note">${esc(tw.note)}</p>` : ''}
  </div>`;
}

export function overviewView(data, tweaks) {
  const heaviest = data.strength[0];
  const latestPr = data.prs[0];
  const staleCount = data.strength.filter(l => FT.staleness(l, tweaks.staleMonths).state !== 'fresh').length;
  const latestEntry = [...data.body.entries].sort((a, b) => b.date.localeCompare(a.date))[0];
  const liftByKey = k => data.strength.find(l => l.key === k || l.key === k.replace(/_deep$/, ''));

  return `<div class="page">
    <h1 class="page-title">Training Overview</h1>
    <p class="page-meta">Bernardo · all weights in kg · data generated ${FT.fmtDate(data.meta.generatedAt.slice(0, 10))}</p>

    <div class="stat-grid">
      ${statCard('Lifts tracked', data.strength.length, `${staleCount} due for a retest`)}
      ${statCard('Heaviest lift', FT.fmtKg(heaviest.bestWeight), `${heaviest.name} · ${heaviest.bestLabel}`)}
      ${statCard('PRs logged', data.prs.length, latestPr ? `latest ${FT.fmtDateShort(latestPr.date)} · ${FT.titleCase(latestPr.exercise)}` : '')}
      ${statCard('Chronic flags', data.body.chronic.length, `${data.body.entries.length} body-log entries`)}
    </div>

    ${latestEntry ? `<div class="section">
      <div class="callout">
        <div>
          <div class="callout-title">Current focus — ${esc(FT.areaLabel(latestEntry.area))}</div>
          <div class="callout-body">${esc(latestEntry.notes)}</div>
        </div>
      </div>
    </div>` : ''}

    <div class="section">
      ${sectionTitle('Recent PRs')}
      <div class="card">
        ${data.prs.map(p => {
          const lift = liftByKey(p.exercise);
          return `<div class="list-row${lift ? ' clickable' : ''}"${lift ? ` data-open-lift="${esc(lift.key)}"` : ''}>
            <span class="list-date">${FT.fmtDateShort(p.date)}</span>
            <span class="lift-name" style="width:170px;flex-shrink:0">${esc(FT.titleCase(p.exercise))}</span>
            <span class="num" style="font-weight:600;width:90px;flex-shrink:0">
              ${FT.fmtKg(p.weight)}${p.reps ? `<span class="cell-muted"> × ${esc(p.reps)}</span>` : ''}
            </span>
            <span class="list-note">${esc(p.notes)}</span>
          </div>`;
        }).join('')}
      </div>
    </div>

    <div class="section">
      ${sectionTitle('Muscle group freshness')}
      <div class="fresh-grid">
        ${data.muscleGroups.map(mg => {
          const f = FT.freshness(mg);
          return `<div class="fresh-card">
            <div class="fresh-name">${esc(mg.name)}</div>
            <div class="fresh-meta">
              ${f.days === null ? 'No heavy session logged' : f.days === 0 ? 'Heavy today' : `Heavy ${f.days}d ago`}
              · ${esc(mg.sessions_this_week)}× this week
            </div>
            ${chip(esc(f.label), f.cls)}
          </div>`;
        }).join('')}
      </div>
    </div>
  </div>`;
}

export function strengthView(data, tweaks) {
  return `<div class="page">
    <h1 class="page-title">Strength</h1>
    <p class="page-meta">${data.strength.length} lifts · click a row for progression, history and loading percentages</p>
    <div class="card" style="overflow-x:auto">
      <table class="data">
        <thead>
          <tr>
            <th>Lift</th>
            <th>Best</th>
            <th>Est. 1RM</th>
            <th>Last tested</th>
            <th>Trend</th>
            <th>Flags</th>
          </tr>
        </thead>
        <tbody>
          ${data.strength.map(lift => {
            const eff = FT.effective1RM(lift);
            const st = FT.staleness(lift, tweaks.staleMonths);
            const inj = FT.injuriesFor(lift.key, data.body.chronic);
            const pts = FT.trendPoints(lift, data.prs);
            return `<tr class="clickable" data-open-lift="${esc(lift.key)}">
              <td class="lift-name">${esc(lift.name)}</td>
              <td class="num">
                <span style="font-weight:600">${FT.fmtKg(lift.bestWeight)}</span>
                <span class="cell-muted"> ${esc(lift.bestLabel)}</span>
              </td>
              <td class="num">
                ${eff ? `<span>
                  ${FT.fmtKg(eff.weight)}
                  ${eff.kind !== 'confirmed' && tweaks.showEst ? chip('est', 'accent', eff.detail) : ''}
                </span>` : '<span class="dash">—</span>'}
              </td>
              <td>
                <span class="cell-muted">${lift.lastTest ? FT.fmtDateShort(lift.lastTest) : 'never'}</span>
                ${st.state === 'stale' ? chip('stale', 'warn', `${st.days} days ago — older than ${tweaks.staleMonths} months`) : ''}
                ${st.state === 'untested' ? chip('no date', '', 'No test date recorded') : ''}
              </td>
              <td>${sparkline(pts)}</td>
              <td>
                ${inj.length
                  ? `<span style="display:inline-flex;gap:4px;flex-wrap:wrap">${inj.map(c => chip('⚠ ' + esc(FT.areaLabel(c.area).split(' ')[0].toLowerCase()), 'warn', c.notes)).join('')}</span>`
                  : '<span class="dash">—</span>'}
              </td>
            </tr>`;
          }).join('')}
        </tbody>
      </table>
    </div>
  </div>`;
}

export function liftDrawer(lift, data, tweaks) {
  if (!lift) return '';
  const eff = FT.effective1RM(lift);
  const inj = FT.injuriesFor(lift.key, data.body.chronic);
  const pts = FT.trendPoints(lift, data.prs);
  const inc = parseFloat(tweaks.rounding);
  const pcts = [95, 90, 85, 80, 75, 70, 65, 60, 55, 50];

  return `<div>
    <div class="scrim" data-close-drawer></div>
    <aside class="drawer">
      <div class="drawer-head">
        <div>
          <div class="drawer-title">${esc(lift.name)}</div>
          <div class="cell-muted">${lift.lastTest ? 'Last tested ' + FT.fmtDate(lift.lastTest) : 'No test date recorded'}</div>
        </div>
        <button class="drawer-close" data-close-drawer aria-label="Close">✕</button>
      </div>
      <div class="drawer-body">
        <div class="drawer-section">
          <div class="chip-row" style="margin-top:0">
            ${lift.maxes.map(m => chip(`${esc(m.label)} · ${FT.fmtKg(m.weight)}`, 'accent')).join('')}
          </div>
          ${lift.notes ? `<div class="chronic-notes">${esc(lift.notes)}</div>` : ''}
        </div>

        ${inj.map(c => `<div class="drawer-section">
          <div class="callout">
            <div>
              <div class="callout-title">Train around it — ${esc(FT.areaLabel(c.area))}</div>
              <div class="callout-body"><b>Warm-up:</b> ${esc(c.warmupNeeded)}</div>
              ${c.notes ? `<div class="callout-body" style="margin-top:4px">${esc(c.notes)}</div>` : ''}
            </div>
          </div>
        </div>`).join('')}

        <div class="drawer-section">
          ${sectionTitle('Progression')}
          ${lineChart(pts)}
        </div>

        ${eff ? `<div class="drawer-section">
          ${sectionTitle('Loading table')}
          <div class="cell-muted" style="margin-bottom:8px">
            Based on ${FT.fmtKg(eff.weight)} (${esc(eff.detail)}) · rounded to ${inc} kg
          </div>
          <table class="pct-table">
            <tbody>
              ${pcts.map(p => `<tr>
                <td class="pct">${p}%</td>
                <td class="kg">${FT.fmtKg(FT.roundTo(eff.weight * p / 100, inc))}</td>
              </tr>`).join('')}
            </tbody>
          </table>
        </div>` : ''}

        ${pts.length ? `<div class="drawer-section">
          ${sectionTitle('History')}
          <div class="card">
            ${[...pts].reverse().map(h => `<div class="list-row">
              <span class="list-date">${FT.fmtDateShort(h.date)}</span>
              <span class="num" style="font-weight:600;width:86px;flex-shrink:0">
                ${FT.fmtKg(h.weight)}${h.reps ? `<span class="cell-muted"> × ${esc(h.reps)}</span>` : ''}
              </span>
              ${h.src === 'pr' ? chip('PR', 'good') : ''}
              <span class="list-note" style="white-space:normal">${esc(h.notes)}</span>
            </div>`).join('')}
          </div>
        </div>` : ''}
      </div>
    </aside>
  </div>`;
}

export function bodyView(data) {
  const entries = [...data.body.entries].sort((a, b) => b.date.localeCompare(a.date));
  return `<div class="page">
    <h1 class="page-title">Body &amp; Recovery</h1>
    <p class="page-meta">Chronic areas to train around, plus the running body log</p>

    <div class="section" style="margin-top:0">
      ${sectionTitle('Chronic — train around these')}
      <div class="chronic-grid">
        ${data.body.chronic.map(c => `<div class="chronic-card">
          <div class="chronic-area">${esc(FT.areaLabel(c.area))} ${chip(esc(c.type), 'warn')}</div>
          <div class="chip-row">
            ${(c.affectedExercises || []).map(ex => chip(esc(FT.titleCase(ex)))).join('')}
          </div>
          <div class="chronic-warmup"><b>Warm-up:</b> ${esc(c.warmupNeeded)}</div>
          ${c.notes ? `<div class="chronic-notes">${esc(c.notes)}</div>` : ''}
        </div>`).join('')}
      </div>
    </div>

    <div class="section">
      ${sectionTitle('Body log')}
      <div class="card">
        ${entries.map(e => {
          const sev = FT.severity(e.severity);
          return `<div class="list-row" style="align-items:flex-start">
            <span class="list-date">${FT.fmtDateShort(e.date)}</span>
            <span style="width:110px;flex-shrink:0">${chip(esc(sev.label), sev.cls)}</span>
            <span style="flex:1;min-width:0">
              <span class="lift-name">${esc(FT.areaLabel(e.area))}</span>
              <span class="cell-muted"> · ${esc(e.type)} · ${esc(FT.titleCase(e.exercise))}</span>
              <div class="chronic-notes" style="margin-top:4px">${esc(e.notes)}</div>
            </span>
          </div>`;
        }).join('')}
      </div>
    </div>
  </div>`;
}
