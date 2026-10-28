// Runs every reference solution against its practice database and checks the
// challenge metadata. Exits non-zero on any problem. Usage: npm run verify
import initSqlJs from 'sql.js';
import { schemaSQL, SCHEMAS } from '../public/js/schemas.js';
import { CHALLENGES, LESSONS, LEVELS } from '../public/js/content.js';
import { compareResults } from '../public/js/checker.js';
import { applyAttempt, emptyState } from '../public/js/progress.js';

const SQL = await initSqlJs();
const dbs = {};
for (const key of Object.keys(SCHEMAS)) { const db = new SQL.Database(); db.run(schemaSQL(key)); dbs[key] = db; }

let problems = 0;
const warn = (msg) => { problems++; console.log('  PROBLEM: ' + msg); };
const ids = new Set();
const verbose = process.argv.includes('--verbose');

for (const ch of CHALLENGES) {
  const label = `${ch.id} "${ch.title}"`;
  if (ids.has(ch.id)) warn(`${label}: duplicate id`);
  ids.add(ch.id);
  if (!LESSONS[ch.lesson]) warn(`${label}: unknown lesson "${ch.lesson}"`);
  if (!LEVELS.find(l => l.n === ch.level)) warn(`${label}: unknown level ${ch.level}`);
  if (!SCHEMAS[ch.schema]) { warn(`${label}: unknown schema ${ch.schema}`); continue; }
  if (!ch.hints || !ch.hints.length) warn(`${label}: no hints`);
  if (!ch.columns || !ch.columns.length) warn(`${label}: no expected columns listed`);
  if (ch.ordered && !/order\s+by/i.test(ch.solution)) warn(`${label}: ordered=true but solution has no ORDER BY`);

  let res;
  try { res = dbs[ch.schema].exec(ch.solution); }
  catch (e) { warn(`${label}: solution error: ${e.message}`); continue; }
  if (!res.length) { warn(`${label}: solution returned no rows`); continue; }
  const r = res[res.length - 1];
  if (ch.columns[0] !== '*' && r.columns.length !== ch.columns.length)
    warn(`${label}: task lists ${ch.columns.length} columns but solution returns ${r.columns.length} (${r.columns.join(', ')})`);
  const cmp = compareResults(r, r, { ordered: !!ch.ordered });
  if (!cmp.pass) warn(`${label}: solution does not match itself: ${cmp.reason}`);
  // Un-ordered challenges must not depend on the engine's arbitrary order: run a shuffled self-check.
  const shuffled = { columns: r.columns, values: [...r.values].reverse() };
  if (!ch.ordered && !compareResults(shuffled, r, { ordered: false }).pass) warn(`${label}: unordered compare failed on reversed rows`);
  if (verbose) {
    console.log(`\n${label} [L${ch.level} ${ch.schema}] -> ${r.values.length} rows x ${r.columns.length} cols (${r.columns.join(', ')})`);
    for (const row of r.values.slice(0, 6)) console.log('   ', row.join(' | '));
    if (r.values.length > 6) console.log('    ...');
  } else {
    console.log(`ok  ${ch.id}  L${ch.level}  ${String(r.values.length).padStart(3)} rows  ${r.columns.join(', ')}`);
  }
}

// Progress rules smoke test.
const today = '2026-10-28';
let s = emptyState();
let out = applyAttempt(s, { challenge_id: 'l1c01', correct: false, hints_used: 0, time_ms: 5000, mode: 'challenge', today });
out = applyAttempt(out.state, { challenge_id: 'l1c01', correct: true, hints_used: 1, time_ms: 8000, mode: 'challenge', today });
if (out.xp_gained !== 8) warn(`expected 8 XP for L1 with one hint, got ${out.xp_gained}`);
if (!out.new_badges.includes('first_blood')) warn('first_blood badge not awarded');
if (out.state.streak !== 1) warn('streak should be 1 after first day');
out = applyAttempt(out.state, { challenge_id: 'l1c01', correct: true, hints_used: 0, time_ms: 3000, mode: 'drill', today: '2026-10-29' });
if (out.xp_gained !== 5) warn(`drill repeat should give 5 XP, got ${out.xp_gained}`);
if (out.state.streak !== 2) warn(`streak should be 2 on consecutive day, got ${out.state.streak}`);
out = applyAttempt(out.state, { challenge_id: 'l5c01', correct: true, hints_used: 0, time_ms: 30000, mode: 'daily', today: '2026-11-02' });
if (out.state.streak !== 1) warn(`streak should reset to 1 after a gap, got ${out.state.streak}`);
if (out.xp_gained !== 85 + 20) warn(`daily L5 solve should give 105 XP, got ${out.xp_gained}`);
if (!out.new_badges.includes('speedster')) warn('speedster badge not awarded for fast L5 solve');

console.log(`\n${CHALLENGES.length} challenges, ${Object.keys(LESSONS).length} lessons, ${problems} problem(s).`);
process.exit(problems ? 1 : 0);
