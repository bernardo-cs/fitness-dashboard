import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
const fitnessRoot = '/root/clawd/fitness';
const readJson = (name) => JSON.parse(readFileSync(join(fitnessRoot, name), 'utf8'));

const benchmarks = readJson('benchmarks.json');
const workoutLog = readJson('workout-log.json');
const bodyLog = readJson('body-log.json');
const prHistory = readJson('pr-history.json');
const mapping = readJson('exercise-mapping.json');

const niceName = (key) => key
  .replace(/_/g, ' ')
  .replace(/\b\w/g, c => c.toUpperCase())
  .replace('Rm', 'RM');

const allStrength = Object.entries(benchmarks.crossfit || {}).map(([key, value]) => {
  const maxes = Object.entries(value)
    .filter(([k, v]) => /^(\d+rm|deep_1rm|\d+rm_est)$/.test(k) && typeof v === 'number')
    .map(([label, weight]) => ({ label: label.toUpperCase().replace('_', ' '), weight }));
  const best = maxes.reduce((m, x) => !m || x.weight > m.weight ? x : m, null);
  return {
    key,
    name: niceName(key),
    maxes,
    bestWeight: best?.weight || 0,
    bestLabel: best?.label || null,
    lastTest: value.last_test || value.last_deep_test || null,
    notes: value.notes || '',
    history: value.history || []
  };
}).filter(x => x.maxes.length).sort((a,b) => b.bestWeight - a.bestWeight);

const machineRows = Object.entries(benchmarks.machines || {}).map(([key, value]) => ({
  key,
  name: niceName(key),
  weight: value.weight || value.working_weight || value.kg || null,
  reps: value.reps || value.scheme || value.sets || null,
  notes: value.notes || ''
}));

const dumbbellRows = Object.entries(benchmarks.dumbbells || {}).map(([key, value]) => ({
  key,
  name: niceName(key),
  weight: typeof value === 'number' ? value : (value.weight || value.kg || null),
  notes: typeof value === 'object' ? (value.notes || value.scheme || '') : ''
}));

const recentWorkouts = (workoutLog.recent_workouts || []).slice().sort((a,b) => String(b.date).localeCompare(String(a.date)));
const muscleGroups = Object.entries(workoutLog.muscle_groups || {}).map(([key, value]) => ({ key, name: niceName(key), ...value }));
const bodyEntries = (bodyLog.entries || []).slice().sort((a,b) => String(b.date).localeCompare(String(a.date)));
const chronic = bodyLog.chronic || [];
const prs = (prHistory || []).slice().sort((a,b) => String(b.date).localeCompare(String(a.date)));

const topStrength = allStrength.slice(0, 10);
const latestWorkout = recentWorkouts[0] || null;
const latestPr = prs[0] || null;
const activeIssues = bodyEntries.slice(0, 4);

const muscleCounts = {};
for (const w of recentWorkouts) {
  const text = `${w.workout || ''} ${w.weights || ''} ${w.notes || ''}`.toLowerCase();
  for (const [exercise, groups] of Object.entries(mapping.mapping || {})) {
    const words = exercise.replace(/_/g, ' ');
    if (text.includes(words) || text.includes(exercise)) {
      for (const g of groups) muscleCounts[g] = (muscleCounts[g] || 0) + 1;
    }
  }
}

const payload = {
  meta: {
    generatedAt: new Date().toISOString(),
    source: 'Local Carla fitness files',
    title: 'Dashboard de Malhar do Bernardo'
  },
  summary: {
    strengthExercises: allStrength.length,
    recentWorkouts: recentWorkouts.length,
    prs: prs.length,
    activeIssues: activeIssues.length,
    latestWorkout,
    latestPr
  },
  topStrength,
  allStrength,
  machineRows,
  dumbbellRows,
  recentWorkouts,
  muscleGroups,
  muscleCounts: Object.entries(muscleCounts).map(([name,count]) => ({ name: niceName(name), count })).sort((a,b) => b.count - a.count),
  prs,
  body: { entries: bodyEntries, chronic, notes: bodyLog.notes || '' },
  conditioning: benchmarks.conditioning || {},
  conditioningBenchmarks: benchmarks.conditioning_benchmarks || {},
  warmupTips: benchmarks.warmup_tips || {},
  notes: benchmarks.notes || ''
};

mkdirSync(join(root, 'data'), { recursive: true });
writeFileSync(join(root, 'data', 'fitness.raw.json'), JSON.stringify(payload, null, 2));
console.log(`Wrote data/fitness.raw.json (${allStrength.length} strength exercises, ${recentWorkouts.length} workouts)`);
