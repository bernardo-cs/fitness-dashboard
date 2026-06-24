// App shell: lock screen, sidebar navigation, theme switching, display settings.
import { decryptFitnessPayload } from './crypto.js';
import { FT, esc } from './helpers.js';
import { todayView, overviewView, strengthView, liftDrawer, bodyView } from './views.js';

const PASS_KEY = 'ftd_passphrase';
const TWEAKS_KEY = 'ftd_tweaks';
const TWEAK_DEFAULTS = { theme: 'Notion', staleMonths: 3, rounding: '2.5 kg', showEst: true };
const DATA_URL = 'data/fitness.encrypted.json';

const icons = {
  sun: `<svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
    <circle cx="8" cy="8" r="3.2" fill="currentColor"></circle>
    <g stroke="currentColor" stroke-width="1.4" stroke-linecap="round" opacity="0.65">
      <line x1="8" y1="1.2" x2="8" y2="3"></line>
      <line x1="8" y1="13" x2="8" y2="14.8"></line>
      <line x1="1.2" y1="8" x2="3" y2="8"></line>
      <line x1="13" y1="8" x2="14.8" y2="8"></line>
    </g>
  </svg>`,
  grid: `<svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
    <rect x="1.5" y="1.5" width="5.5" height="5.5" rx="1.5" fill="currentColor"></rect>
    <rect x="9" y="1.5" width="5.5" height="5.5" rx="1.5" fill="currentColor" opacity="0.5"></rect>
    <rect x="1.5" y="9" width="5.5" height="5.5" rx="1.5" fill="currentColor" opacity="0.5"></rect>
    <rect x="9" y="9" width="5.5" height="5.5" rx="1.5" fill="currentColor"></rect>
  </svg>`,
  barbell: `<svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
    <rect x="1" y="7.1" width="14" height="1.8" rx="0.9" fill="currentColor" opacity="0.5"></rect>
    <rect x="3.2" y="4" width="2.4" height="8" rx="1.1" fill="currentColor"></rect>
    <rect x="10.4" y="4" width="2.4" height="8" rx="1.1" fill="currentColor"></rect>
  </svg>`,
  pulse: `<svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
    <path d="M1.5 8.5h3l2-4.5 3 8 2-3.5h3" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"></path>
  </svg>`,
  gear: `<svg width="17" height="17" viewBox="0 0 16 16" fill="none" aria-hidden="true">
    <circle cx="8" cy="8" r="2.4" stroke="currentColor" stroke-width="1.4"></circle>
    <path d="M8 1.6v1.9M8 12.5v1.9M1.6 8h1.9M12.5 8h1.9M3.5 3.5l1.3 1.3M11.2 11.2l1.3 1.3M12.5 3.5l-1.3 1.3M4.8 11.2l-1.3 1.3" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"></path>
  </svg>`
};

const NAV = [
  { id: 'today', label: 'Today', icon: icons.sun },
  { id: 'overview', label: 'Overview', icon: icons.grid },
  { id: 'strength', label: 'Strength', icon: icons.barbell },
  { id: 'body', label: 'Body & Recovery', short: 'Body', icon: icons.pulse }
];

function loadTweaks() {
  try { return { ...TWEAK_DEFAULTS, ...JSON.parse(localStorage.getItem(TWEAKS_KEY) || '{}') }; }
  catch { return { ...TWEAK_DEFAULTS }; }
}

const state = {
  enc: null,
  loadError: null,
  data: null,
  view: 'today',
  openLift: null,
  panelOpen: false,
  tweaks: loadTweaks(),
  busy: false,
  refreshing: false,
  refreshMessage: '',
  lastCheckedAt: null,
  lockError: null,
  triedSaved: false
};

function setTweak(key, value) {
  state.tweaks[key] = value;
  localStorage.setItem(TWEAKS_KEY, JSON.stringify(state.tweaks));
  render();
}

function applyTheme() {
  document.documentElement.dataset.theme = (state.tweaks.theme || 'Notion').toLowerCase();
}

function fmtDateTime(iso) {
  if (!iso) return 'unknown';
  return new Intl.DateTimeFormat('en-GB', {
    day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit',
    timeZone: 'Europe/Lisbon'
  }).format(new Date(iso));
}

function fmtChecked(iso) {
  if (!iso) return 'not checked yet';
  return new Intl.DateTimeFormat('en-GB', {
    hour: '2-digit', minute: '2-digit', second: '2-digit', timeZone: 'Europe/Lisbon'
  }).format(new Date(iso));
}

function savedPass() {
  return sessionStorage.getItem(PASS_KEY) || localStorage.getItem(PASS_KEY) || '';
}

async function attempt(pass, manual, remember) {
  if (!state.enc || !pass || state.busy) return;
  state.busy = true; state.lockError = null;
  render();
  try {
    const payload = await decryptFitnessPayload(pass, state.enc);
    sessionStorage.setItem(PASS_KEY, pass);
    if (remember) localStorage.setItem(PASS_KEY, pass);
    state.data = payload;
    state.view = payload.today ? 'today' : 'overview';
    state.openLift = null;
    passDraft = ''; rememberDraft = false;
  } catch (e) {
    if (manual) state.lockError = 'That passphrase didn’t work. Try again.';
  } finally {
    state.busy = false;
    render();
  }
}

function lock() {
  sessionStorage.removeItem(PASS_KEY);
  localStorage.removeItem(PASS_KEY);
  state.data = null; state.openLift = null; state.view = 'today';
  state.triedSaved = true; // don't auto-unlock again right after an explicit lock
  passDraft = ''; rememberDraft = false;
  render();
}

function settingsPanel() {
  const t = state.tweaks;
  const seg = (options, current, attr) => `<div class="seg">
    ${options.map(o => `<button type="button" class="${o === current ? 'active' : ''}" data-${attr}="${esc(o)}">${esc(o)}</button>`).join('')}
  </div>`;
  return `
    ${state.panelOpen ? `<div class="settings-panel">
      <div class="settings-row">
        <div class="settings-label">Theme</div>
        ${seg(['Notion', 'Plum', 'Graphite'], t.theme, 'tweak-theme')}
      </div>
      <div class="settings-row">
        <div class="settings-label">Stale after <span class="val" id="staleVal">${t.staleMonths} mo</span></div>
        <input class="settings-slider" type="range" min="1" max="12" step="1" value="${t.staleMonths}" data-tweak-stale />
      </div>
      <div class="settings-row">
        <div class="settings-label">Round loads to</div>
        ${seg(['1 kg', '2.5 kg', '5 kg'], t.rounding, 'tweak-rounding')}
      </div>
      <div class="settings-row">
        <label class="settings-toggle">
          <input type="checkbox" ${t.showEst ? 'checked' : ''} data-tweak-showest />
          Show estimated 1RMs
        </label>
      </div>
      ${state.data ? `<div class="settings-row">
        <button class="settings-lock" type="button" data-lock>Lock dashboard</button>
      </div>` : ''}
    </div>` : ''}
    <button class="settings-fab" data-settings-toggle aria-label="Display settings" title="Display settings">${icons.gear}</button>
  `;
}

function lockScreen() {
  const { enc, loadError, busy, lockError } = state;
  const label = loadError ? 'Data file missing' : busy ? 'Decrypting…' : enc ? 'Unlock' : 'Loading…';
  return `<div class="lock">
    <form class="lock-card" id="unlockForm">
      <div class="lock-mark">${icons.barbell}</div>
      <h1 class="lock-title">Bernardo · Training</h1>
      <p class="lock-sub">This dashboard is encrypted. Enter the passphrase to decrypt it in your browser — nothing is sent anywhere.</p>
      <input class="lock-input" id="passInput" type="password" placeholder="Passphrase" autocomplete="current-password" />
      <button class="lock-submit" type="submit" ${busy || !enc ? 'disabled' : ''}>${label}</button>
      ${lockError ? `<div class="lock-error">${esc(lockError)}</div>` : ''}
      ${loadError ? `<div class="lock-error">${esc(loadError)}</div>` : ''}
      <label class="lock-remember">
        <input type="checkbox" id="rememberBox" />
        Stay unlocked on this device
      </label>
      <div class="lock-hint">Hint: how you said the wall balls felt</div>
    </form>
  </div>`;
}

function updateStatus() {
  const generated = state.data?.meta?.generatedAt;
  const msg = state.refreshMessage ? `<span class="update-msg">${esc(state.refreshMessage)}</span>` : '';
  return `<div class="update-strip">
    <div>
      <span class="update-dot"></span>
      <span>Updated ${esc(fmtDateTime(generated))}</span>
      <span class="update-muted">· checked ${esc(fmtChecked(state.lastCheckedAt))}</span>
      ${msg}
    </div>
    <button class="refresh-btn" type="button" data-refresh ${state.refreshing ? 'disabled' : ''}>${state.refreshing ? 'Checking…' : 'Check updates'}</button>
  </div>`;
}

function appShell() {
  const { data, view, tweaks } = state;
  const liftObj = data.strength.find(l => l.key === state.openLift) || null;
  return `<div class="app">
    <nav class="sidebar">
      <div class="brand">
        <div class="brand-mark">B</div>
        <div>
          <div class="brand-name">Bernardo</div>
          <div class="brand-sub">Training data</div>
        </div>
      </div>
      ${NAV.map(n => `<button class="nav-item${view === n.id ? ' active' : ''}" data-nav="${n.id}">${n.icon}<span class="nav-label">${esc(n.label)}</span><span class="nav-label-sm">${esc(n.short || n.label)}</span></button>`).join('')}
      <div class="sidebar-foot">
        <span>Updated ${esc(fmtDateTime(data.meta.generatedAt))} · kg</span>
        <button class="refresh-side" data-refresh type="button" ${state.refreshing ? 'disabled' : ''}>${state.refreshing ? 'Checking…' : 'Check updates'}</button>
        <button class="lock-btn" data-lock>Lock dashboard</button>
      </div>
    </nav>
    <main class="content">
      ${updateStatus()}
      ${view === 'today' ? todayView(data) : ''}
      ${view === 'overview' ? overviewView(data, tweaks) : ''}
      ${view === 'strength' ? strengthView(data, tweaks) : ''}
      ${view === 'body' ? bodyView(data) : ''}
    </main>
    ${liftObj ? liftDrawer(liftObj, data, tweaks) : ''}
  </div>`;
}

const root = document.getElementById('root');
let passDraft = '';
let rememberDraft = false;

function render() {
  applyTheme();
  // No settings FAB/panel while the lift drawer is open — the raised mobile FAB
  // would float over the drawer's bottom content with no way to scroll it clear.
  root.innerHTML = (state.data ? appShell() : lockScreen()) + (state.openLift ? '' : settingsPanel());
  if (!state.data) {
    const input = root.querySelector('#passInput');
    const remember = root.querySelector('#rememberBox');
    if (input) {
      input.value = passDraft;
      input.addEventListener('input', e => { passDraft = e.target.value; });
      if (!state.panelOpen) input.focus();
    }
    if (remember) {
      remember.checked = rememberDraft;
      remember.addEventListener('change', e => { rememberDraft = e.target.checked; });
    }
    const form = root.querySelector('#unlockForm');
    if (form) form.addEventListener('submit', e => {
      e.preventDefault();
      attempt(passDraft, true, rememberDraft);
    });
  }
}

root.addEventListener('click', e => {
  const t = e.target.closest('[data-nav],[data-open-lift],[data-close-drawer],[data-lock],[data-settings-toggle],[data-tweak-theme],[data-tweak-rounding],[data-refresh]');
  if (!t) return;
  if (t.dataset.nav) { state.view = t.dataset.nav; state.openLift = null; render(); }
  else if (t.dataset.openLift) { state.openLift = t.dataset.openLift; state.view = 'strength'; render(); }
  else if ('closeDrawer' in t.dataset) { state.openLift = null; render(); }
  else if ('lock' in t.dataset) { lock(); }
  else if ('settingsToggle' in t.dataset) { state.panelOpen = !state.panelOpen; render(); }
  else if ('refresh' in t.dataset) { refreshData(true); }
  else if (t.dataset.tweakTheme) { setTweak('theme', t.dataset.tweakTheme); }
  else if (t.dataset.tweakRounding) { setTweak('rounding', t.dataset.tweakRounding); }
});

root.addEventListener('input', e => {
  if ('tweakStale' in e.target.dataset) {
    const v = +e.target.value;
    state.tweaks.staleMonths = v;
    const label = root.querySelector('#staleVal');
    if (label) label.textContent = `${v} mo`;
  }
});

root.addEventListener('change', e => {
  if ('tweakStale' in e.target.dataset) setTweak('staleMonths', +e.target.value);
  else if ('tweakShowest' in e.target.dataset) setTweak('showEst', e.target.checked);
});

window.addEventListener('keydown', e => {
  if (e.key === 'Escape' && state.openLift) { state.openLift = null; render(); }
});

// Re-render on width changes so the drawer chart picks the right size.
// The chart is the only width-dependent render output, so skip the re-render
// (and the scroll/focus loss it causes) unless its width would actually change.
let lastWidth = window.innerWidth, resizeTimer;
window.addEventListener('resize', () => {
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(() => {
    const w = window.innerWidth;
    if (w === lastWidth) return; // iOS fires resize on URL-bar show/hide (height-only)
    const chartChanged = FT.chartWidth(w) !== FT.chartWidth(lastWidth);
    lastWidth = w;
    if (!state.data || !state.openLift || !chartChanged) return;
    const body = root.querySelector('.drawer-body');
    const scroll = body ? body.scrollTop : 0;
    render();
    const fresh = root.querySelector('.drawer-body');
    if (fresh) fresh.scrollTop = scroll;
  }, 150);
});

async function refreshData(manual = false) {
  if (state.refreshing) return;
  state.refreshing = true;
  if (manual) state.refreshMessage = '';
  render();
  try {
    const before = state.data?.meta?.generatedAt || null;
    const r = await fetch(`${DATA_URL}?v=${Date.now()}`, { cache: 'no-store' });
    if (!r.ok) throw new Error('HTTP ' + r.status);
    const enc = await r.json();
    state.enc = enc;
    state.loadError = null;
    state.lastCheckedAt = new Date().toISOString();

    const pass = savedPass();
    if (state.data && pass) {
      const payload = await decryptFitnessPayload(pass, enc);
      state.data = payload;
      state.view = payload.today ? state.view : (state.view === 'today' ? 'overview' : state.view);
      const after = payload.meta?.generatedAt || null;
      state.refreshMessage = before && after && before !== after ? 'New data loaded' : (manual ? 'Already up to date' : '');
      setTimeout(() => { state.refreshMessage = ''; render(); }, 3500);
    } else if (!state.data && !state.triedSaved) {
      state.triedSaved = true;
      const saved = savedPass();
      if (saved) await attempt(saved, false, false);
    }
  } catch (e) {
    if (!state.data) state.loadError = `Could not load ${DATA_URL}`;
    state.refreshMessage = manual ? 'Could not check updates' : '';
  } finally {
    state.refreshing = false;
    render();
  }
}

// Lightweight pull-to-refresh for the mobile web app. Native browser pull-to-refresh
// still works; this gives feedback and reloads just the encrypted data file.
let pullStartY = null;
window.addEventListener('touchstart', e => {
  const content = root.querySelector('.content');
  if (!state.data || !content || content.scrollTop > 0 || e.touches.length !== 1) return;
  pullStartY = e.touches[0].clientY;
}, { passive: true });
window.addEventListener('touchend', e => {
  if (pullStartY == null || !state.data) { pullStartY = null; return; }
  const dy = (e.changedTouches[0]?.clientY || 0) - pullStartY;
  pullStartY = null;
  if (dy > 90) refreshData(true);
}, { passive: true });

refreshData(false).finally(() => render());

render();
