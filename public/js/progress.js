// Gamification rules shared by the server (logged-in users) and the browser (guest mode).
// A progress "state" is a plain JSON object; applyAttempt() returns a new state plus what changed.

import { CHALLENGES, challengeById, levelInfo, rankFor, LEVELS } from './content.js';

export const HINT_PENALTY = 0.25;      // each hint removes 25% of the challenge XP
export const MIN_XP_FRACTION = 0.25;   // never less than 25% of base XP for a correct answer
export const DRILL_REPEAT_XP = 5;      // re-solving an already-completed challenge in drill mode
export const DAILY_BONUS_XP = 20;      // first daily-challenge solve of the day

export const BADGES = [
  { id: 'first_blood', title: 'First Query', desc: 'Solve your first challenge.', icon: '⚡' },
  { id: 'hintless_10', title: 'No Training Wheels', desc: 'Solve 10 challenges without using a hint.', icon: '🧠' },
  { id: 'speedster', title: 'Speedster', desc: 'Solve a Level 3+ challenge in under 60 seconds.', icon: '⏱️' },
  { id: 'comeback', title: 'Comeback', desc: 'Solve a challenge after 3 or more failed attempts.', icon: '🔁' },
  { id: 'streak_7', title: 'Week Warrior', desc: 'Practise 7 days in a row.', icon: '🔥' },
  { id: 'drill_25', title: 'Drill Sergeant', desc: 'Answer 25 drill questions correctly.', icon: '🎯' },
  { id: 'centurion', title: 'Centurion', desc: 'Make 100 attempts.', icon: '💯' },
  ...LEVELS.map(l => ({ id: `level_${l.n}`, title: `${l.title} Cleared`, desc: `Complete every Level ${l.n} challenge.`, icon: ['1️⃣', '2️⃣', '3️⃣', '4️⃣', '5️⃣'][l.n - 1] })),
  { id: 'grandmaster', title: 'SQL Grandmaster', desc: 'Complete every challenge in the game.', icon: '👑' },
];
export const badgeById = Object.fromEntries(BADGES.map(b => [b.id, b]));

export function emptyState() {
  return {
    xp: 0, streak: 0, best_streak: 0, last_active: null,
    completions: {},      // challenge_id -> { at, best_ms, xp, hints }
    badges: {},           // badge_id -> ISO timestamp earned
    counters: { attempts: 0, correct: 0, drill_correct: 0, hintless: 0 },
    fails: {},            // challenge_id -> failed attempts before first success
    daily: { date: null, done: false },
  };
}

export function challengeXp(challenge, hintsUsed) {
  const base = levelInfo(challenge.level).xp;
  const frac = Math.max(MIN_XP_FRACTION, 1 - HINT_PENALTY * (hintsUsed || 0));
  return Math.round(base * frac);
}

function dayDiff(a, b) {
  return Math.round((Date.parse(b + 'T00:00:00Z') - Date.parse(a + 'T00:00:00Z')) / 86400000);
}

export function updateStreak(state, today) {
  if (state.last_active === today) return state;
  const next = { ...state };
  if (state.last_active && dayDiff(state.last_active, today) === 1) next.streak = (state.streak || 0) + 1;
  else next.streak = 1;
  next.best_streak = Math.max(next.best_streak || 0, next.streak);
  next.last_active = today;
  return next;
}

/**
 * Apply one attempt to a progress state.
 * attempt: { challenge_id, correct, hints_used, time_ms, mode: 'challenge'|'drill'|'daily', today: 'YYYY-MM-DD', now: ISO }
 * Returns { state, xp_gained, new_badges: [ids], first_completion: bool }
 */
export function applyAttempt(prev, attempt) {
  const ch = challengeById[attempt.challenge_id];
  if (!ch) throw new Error('Unknown challenge ' + attempt.challenge_id);
  const today = attempt.today;
  const now = attempt.now || new Date().toISOString();
  let state = JSON.parse(JSON.stringify(prev || emptyState()));
  state = updateStreak(state, today);
  state.counters.attempts += 1;

  let xp = 0, first = false;
  const newBadges = [];
  const award = (id) => { if (!state.badges[id]) { state.badges[id] = now; newBadges.push(id); } };
  const hints = attempt.hints_used || 0;

  if (!attempt.correct) {
    state.fails[ch.id] = (state.fails[ch.id] || 0) + 1;
  } else {
    state.counters.correct += 1;
    const existing = state.completions[ch.id];
    if (!existing) {
      first = true;
      xp += challengeXp(ch, hints);
      state.completions[ch.id] = { at: now, best_ms: attempt.time_ms || null, xp, hints };
      if (hints === 0) state.counters.hintless += 1;
      if ((state.fails[ch.id] || 0) >= 3) award('comeback');
    } else {
      if (attempt.time_ms && (!existing.best_ms || attempt.time_ms < existing.best_ms)) existing.best_ms = attempt.time_ms;
      if (attempt.mode === 'drill') xp += DRILL_REPEAT_XP;
    }
    if (attempt.mode === 'drill') state.counters.drill_correct += 1;
    if (attempt.mode === 'daily') {
      if (state.daily.date !== today || !state.daily.done) { xp += DAILY_BONUS_XP; state.daily = { date: today, done: true }; }
    }
    if (ch.level >= 3 && attempt.time_ms && attempt.time_ms < 60000) award('speedster');
    award('first_blood');
    if (state.counters.hintless >= 10) award('hintless_10');
    if (state.counters.drill_correct >= 25) award('drill_25');
    for (const l of LEVELS) {
      const ids = CHALLENGES.filter(c => c.level === l.n).map(c => c.id);
      if (ids.every(id => state.completions[id])) award(`level_${l.n}`);
    }
    if (CHALLENGES.every(c => state.completions[c.id])) award('grandmaster');
  }
  if (state.streak >= 7) award('streak_7');
  if (state.counters.attempts >= 100) award('centurion');

  state.xp += xp;
  return { state, xp_gained: xp, new_badges: newBadges, first_completion: first, rank: rankFor(state.xp) };
}

export function summarize(state) {
  const done = Object.keys(state.completions || {}).length;
  const perLevel = LEVELS.map(l => {
    const ids = CHALLENGES.filter(c => c.level === l.n).map(c => c.id);
    return { level: l.n, total: ids.length, done: ids.filter(id => state.completions[id]).length };
  });
  return { done, total: CHALLENGES.length, perLevel, rank: rankFor(state.xp || 0) };
}

/** Deterministic daily challenge: same for every player on a given date, drawn from levels 2-5. */
export function dailyChallengeFor(dateStr) {
  const pool = CHALLENGES.filter(c => c.level >= 2);
  let h = 0;
  for (const ch of dateStr) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return pool[h % pool.length];
}
