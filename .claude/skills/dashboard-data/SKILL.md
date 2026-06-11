---
name: dashboard-data
description: Update the encrypted JSON that powers Bernardo's fitness dashboard. Use when adding workout results, PRs, injuries/body-log entries, muscle-group freshness, or today's WOD, and when rebuilding or re-encrypting data/fitness.encrypted.json. Documents the source fitness/*.json schemas, how each field drives the UI, and the build + verify workflow.
---

# Fitness Dashboard Data

The dashboard (`index.html` + `app/*.js`) is a static page that renders **one decrypted JSON payload**. The repo is **public**: only the encrypted file is committed. Never commit plaintext fitness data — that includes using real entries as examples in docs.

All examples below are **fictional**.

## Pipeline

```
fitness/*.json  ──>  tools/build-data.js  ──>  data/fitness.encrypted.json  (committed, public)
(source of truth)    (merge + encrypt)         data/fitness.raw.json        (git-ignored, for inspection)
```

```bash
npm run build:data                      # default passphrase (see tools/build-data.js)
FITNESS_PASS=secret npm run build:data  # custom passphrase (FITNESS_PASSWORD also accepted)
FITNESS_DIR=/path/to/fitness npm run build:data
```

Source dir resolution: `$FITNESS_DIR` → `/root/clawd/fitness` (Carla's canonical files on the home server) → `./fitness/` (git-ignored local copy). Encryption: PBKDF2-SHA256 (250k iterations) → AES-256-GCM; the browser decrypts locally with WebCrypto. **Never write the real passphrase into committed files.**

## Hard rules

- Weights are **numbers in kg**, dates are `YYYY-MM-DD` strings.
- Lift keys are `snake_case` (`back_squat`, `push_jerk`) and must match **across all files**: `benchmarks.json` crossfit keys = `pr-history.json` `exercise` = `body-log.json` `affectedExercises` = `today-workout.json` `strength.liftKey`. A mismatched key silently breaks drawer links, injury flags, and PR↔chart merging.
- PR exercise convention: a `_deep` suffix (e.g. `back_squat_deep`) still matches the base lift's chart/drawer.
- A lift with **no numeric field from the max list below is dropped** from the dashboard (the build prints a warning). String values like `"~135-140kg"` don't count — give the lift a real numeric field.

## Source files

### `benchmarks.json` — lifts (drives the Strength view)

Only the `crossfit` section is rendered. Per lift, these numeric fields become max chips: `1rm`, `2rm`, `3rm`, `5rm`, `1rm_est`, `deep_1rm`, `technical_1rm`, `max`. Other sections (`machines`, `dumbbells`, `conditioning`, …) are kept in the file but not shown on the dashboard.

```json
{ "crossfit": { "back_squat": {
    "1rm": 100, "deep_1rm": 90,
    "last_test": "2025-01-10",
    "notes": "Free text shown in the lift drawer.",
    "history": [ { "date": "2025-01-10", "weight": 90, "reps": 1, "notes": "..." } ]
} } }
```

UI effects:
- Highest max becomes the lift's "Best" + sort order.
- `last_test` drives the **stale** chip (older than 3 months by default; user-adjustable 1–12). Missing → "never" + "no date" chip.
- Effective/est. 1RM: confirmed `1rm` wins; otherwise best of `1rm_est` vs Epley (`weight × (1 + reps/30)`) from `2rm`–`5rm` — it feeds the drawer's % loading table.
- `history[]` + matching PRs draw the sparkline and the drawer chart; **fewer than 2 points → no chart**, so log history entries whenever a lift is tested.

### `pr-history.json` — flat PR list (Overview "Recent PRs" + merged into charts)

```json
[ { "date": "2025-01-12", "exercise": "deadlift", "weight": 150, "reps": 1, "notes": "PR! Free text." } ]
```

### `body-log.json` — injuries & cautions (Body & Recovery view)

```json
{
  "entries": [ { "date": "2025-01-14", "area": "tornozelos", "type": "rigidez",
                 "severity": "leve", "exercise": "back_squat", "notes": "Free text." } ],
  "chronic": [ { "area": "tornozelos", "type": "mobilidade limitada",
                 "affectedExercises": ["back_squat", "overhead_squat"],
                 "warmupNeeded": "ankle circles, calf stretches", "notes": "Free text." } ]
}
```

UI effects:
- The **newest entry** becomes the Overview "Current focus" callout.
- `severity` must be `leve` | `leve-moderada` | `moderada` (mapped to mild/mild–moderate/moderate chips; anything else displays raw).
- `chronic[].affectedExercises` puts ⚠ flags on those lifts in the Strength table and a "Train around it" warm-up callout inside their drawers.
- `area` values are translated PT→EN by a fixed map in `app/helpers.js` (see `FT.areaLabel` for the supported keys). A new area shows as-is unless you extend that map.

### `workout-log.json` — muscle-group freshness (Overview grid)

```json
{ "muscle_groups": { "legs": { "last_heavy": "2025-01-13", "sessions_this_week": 1 } } }
```

`last_heavy` → chip: ≤2 days "Loaded", ≤4 "Recovering", else "Fresh"; `null` → "No heavy log". `recent_workouts[]` may stay in the file but isn't rendered.

### `exercise-mapping.json` — `exercise → [muscle groups]`

Included in the payload as `mapping` for future analytics; not currently rendered.

### `today-workout.json` — today's WOD (Today view; **optional file**)

**Delete the file when there's no plan** — then the Today view shows a quiet empty state and the dashboard opens on Overview. A stale file keeps rendering its old plan under "Today's Workout" (only the date line changes), so the agent should remove or replace it daily. All fields besides `date` are optional.

```json
{
  "date": "2025-01-15", "confirmed": true, "type": "Cross Training",
  "location": "The Box", "time": "18:00–19:00",
  "warmup": ["PVC pass-throughs", "Air squats"],
  "strength": {
    "title": "Front Squat 3RM", "liftKey": "front_squat",
    "scheme": "5-5-3-3-3 · window 2:00",
    "rationale": "Why these targets (free text).",
    "sets": [ { "set": "1", "reps": 5, "weight": "40 kg" }, { "set": "3–5", "reps": 3, "weight": "60–70 kg" } ]
  },
  "conditioning": { "title": "EMOM 12: Row / Burpees / Rest", "rx": "15/12 cal", "tips": ["Pacing note."] },
  "mobility": [ { "area": "Ankles", "drill": "Wall stretch, 2 min" } ],
  "note": "Closing free-text line, shown in italics."
}
```

`sets[].set`/`weight` are display strings (ranges like `"3–5"`, `"60–70 kg"` are fine). `liftKey` links the card to that lift's drawer.

## Update workflow

1. Edit the source `fitness/*.json` (on the server that's `/root/clawd/fitness`).
2. `npm run build:data` — and read its output: it warns about lifts it had to skip. Set `FITNESS_PASS` if the passphrase was changed.
3. Verify the round-trip before pushing — **use the same passphrase the build used** (if you didn't set `FITNESS_PASS`, the default is the one in `tools/build-data.js`):
   ```bash
   FITNESS_PASS=... node --input-type=module -e "
   import fs from 'node:fs'; import { webcrypto as wc } from 'node:crypto';
   const e = JSON.parse(fs.readFileSync('data/fitness.encrypted.json','utf8'));
   const b = s => Uint8Array.from(Buffer.from(s,'base64'));
   const km = await wc.subtle.importKey('raw', new TextEncoder().encode(process.env.FITNESS_PASS), 'PBKDF2', false, ['deriveKey']);
   const k = await wc.subtle.deriveKey({name:'PBKDF2',hash:e.kdf.hash,salt:b(e.kdf.salt),iterations:e.kdf.iterations}, km, {name:'AES-GCM',length:256}, false, ['decrypt']);
   const p = JSON.parse(new TextDecoder().decode(await wc.subtle.decrypt({name:'AES-GCM',iv:b(e.cipher.iv)}, k, b(e.ciphertext))));
   console.log('lifts', p.strength.length, '| prs', p.prs.length, '| today', p.today && p.today.date);"
   ```
   It should print the expected lift/PR counts and today's date. For UI changes, also eyeball it: `npm run serve` → http://localhost:8080 → unlock → check the affected view.
4. Commit and push **only** `data/fitness.encrypted.json` (plus code changes). `fitness/` and `data/fitness.raw.json` are git-ignored — keep it that way.

## Payload shape (what build-data.js emits, for debugging the UI)

```
{ meta: { generatedAt, source, title },
  strength: [ { key, name, maxes: [{label, weight}], bestWeight, bestLabel, lastTest, notes, history } ],
  prs:      [ { date, exercise, weight, reps, notes } ],            // sorted desc
  body:     { entries: [...], chronic: [...] },
  muscleGroups: [ { key, name, last_heavy, sessions_this_week } ],
  mapping:  { exercise: [groups] },
  today:    { ... } | null }
```
