#!/usr/bin/env node
// build-data.js — merges the canonical fitness/*.json into one payload and encrypts it
// (PBKDF2-SHA256, 250k iterations -> AES-256-GCM) for the static dashboard.
//
// Usage:
//   npm run build:data                                 # uses FITNESS_PASS env or default
//   FITNESS_PASS=my-secret node tools/build-data.js
//   FITNESS_DIR=/path/to/fitness node tools/build-data.js
//
// Source dir resolution: $FITNESS_DIR, else /root/clawd/fitness (Carla's canonical
// files on the home server), else ./fitness (git-ignored local copy).
// Output: data/fitness.encrypted.json (committed) + data/fitness.raw.json (git-ignored).

import fs from 'node:fs';
import path from 'node:path';
import { webcrypto } from 'node:crypto';
import { fileURLToPath } from 'node:url';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const SRC = process.env.FITNESS_DIR
  || (fs.existsSync('/root/clawd/fitness') ? '/root/clawd/fitness' : path.join(ROOT, 'fitness'));
const OUT = path.join(ROOT, 'data', 'fitness.encrypted.json');
const RAW_OUT = path.join(ROOT, 'data', 'fitness.raw.json');
const PASS = process.env.FITNESS_PASS || process.env.FITNESS_PASSWORD || 'puxado';

const readJson = (f) => {
  try {
    return JSON.parse(fs.readFileSync(path.join(SRC, f), 'utf8'));
  } catch (e) {
    console.error(`Cannot read ${f} from ${SRC}: ${e.message}`);
    process.exit(1);
  }
};

const bm = readJson('benchmarks.json');
const prs = readJson('pr-history.json');
const body = readJson('body-log.json');
const wlog = readJson('workout-log.json');
const map = readJson('exercise-mapping.json');
let today = null;
try {
  today = JSON.parse(fs.readFileSync(path.join(SRC, 'today-workout.json'), 'utf8'));
} catch (e) {
  if (e.code !== 'ENOENT') { console.error(`today-workout.json exists but is invalid: ${e.message}`); process.exit(1); }
  // missing file is fine — the Today view shows its empty state
}

const LABELS = { '1rm': '1RM', '2rm': '2RM', '3rm': '3RM', '5rm': '5RM', '1rm_est': '1RM EST', deep_1rm: 'DEEP 1RM', technical_1rm: 'TECH 1RM', max: 'MAX' };
const titleCase = k => k.split('_').map(w => w[0].toUpperCase() + w.slice(1)).join(' ');

const strength = [];
for (const [key, v] of Object.entries(bm.crossfit || {})) {
  const maxes = [];
  for (const [f, label] of Object.entries(LABELS)) {
    if (typeof v[f] === 'number') maxes.push({ label, weight: v[f] });
  }
  if (!maxes.length) {
    console.warn(`Skipping ${key}: no numeric max field (expected one of ${Object.keys(LABELS).join(', ')})`);
    continue;
  }
  const best = maxes.reduce((a, b) => (b.weight > a.weight ? b : a));
  strength.push({
    key,
    name: titleCase(key),
    maxes,
    bestWeight: best.weight,
    bestLabel: best.label,
    lastTest: v.last_test || null,
    notes: v.notes || '',
    history: v.history || []
  });
}
strength.sort((a, b) => b.bestWeight - a.bestWeight);

const muscleGroups = Object.entries(wlog.muscle_groups || {}).map(([key, v]) => ({
  key,
  name: titleCase(key),
  last_heavy: v.last_heavy,
  sessions_this_week: v.sessions_this_week
}));

const payload = {
  meta: { generatedAt: new Date().toISOString(), source: 'fitness/*.json', title: 'Bernardo · Training' },
  strength,
  prs: [...prs].sort((a, b) => b.date.localeCompare(a.date)),
  body: { entries: body.entries || [], chronic: body.chronic || [] },
  muscleGroups,
  mapping: map.mapping || {},
  today
};

async function main() {
  const subtle = webcrypto.subtle;
  const te = new TextEncoder();
  const salt = webcrypto.getRandomValues(new Uint8Array(16));
  const iv = webcrypto.getRandomValues(new Uint8Array(12));
  const keyMat = await subtle.importKey('raw', te.encode(PASS), 'PBKDF2', false, ['deriveKey']);
  const key = await subtle.deriveKey(
    { name: 'PBKDF2', hash: 'SHA-256', salt, iterations: 250000 },
    keyMat,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt']
  );
  const ct = await subtle.encrypt({ name: 'AES-GCM', iv }, key, te.encode(JSON.stringify(payload)));
  const b64 = buf => Buffer.from(buf).toString('base64');

  const out = {
    version: 1,
    algorithm: 'PBKDF2-SHA256+AES-256-GCM',
    kdf: { name: 'PBKDF2', hash: 'SHA-256', iterations: 250000, salt: b64(salt) },
    cipher: { name: 'AES-GCM', iv: b64(iv) },
    ciphertext: b64(ct)
  };

  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(RAW_OUT, JSON.stringify(payload, null, 2));
  fs.writeFileSync(OUT, JSON.stringify(out));
  console.log(`Source: ${SRC}`);
  console.log(`Encrypted ${strength.length} lifts, ${payload.prs.length} PRs, ${payload.body.entries.length} body entries -> ${OUT}`);
}

main().catch(e => { console.error(e); process.exit(1); });
