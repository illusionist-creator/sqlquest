// SQLQuest server: static files + a small JSON API for accounts and progress.
// Learner SQL never runs here (it runs in the browser); this server only stores progress.
import express from 'express';
import { DatabaseSync } from 'node:sqlite';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { applyAttempt, emptyState, summarize } from './public/js/progress.js';
import { challengeById, rankFor } from './public/js/content.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT) || 3000;
const DATA_DIR = process.env.SQLQUEST_DATA_DIR || path.join(__dirname, 'data');
fs.mkdirSync(DATA_DIR, { recursive: true });

// ---------------------------------------------------------------------------
// Storage
// ---------------------------------------------------------------------------
const db = new DatabaseSync(path.join(DATA_DIR, 'sqlquest.db'));
db.exec(`
  PRAGMA journal_mode = WAL;
  PRAGMA foreign_keys = ON;
  CREATE TABLE IF NOT EXISTS users (
    id            INTEGER PRIMARY KEY,
    username      TEXT    NOT NULL UNIQUE COLLATE NOCASE,
    password_hash TEXT    NOT NULL,
    salt          TEXT    NOT NULL,
    start_level   INTEGER NOT NULL DEFAULT 1,
    state_json    TEXT    NOT NULL,
    xp            INTEGER NOT NULL DEFAULT 0,
    streak        INTEGER NOT NULL DEFAULT 0,
    created_at    TEXT    NOT NULL DEFAULT (datetime('now'))
  );
  CREATE TABLE IF NOT EXISTS sessions (
    token      TEXT PRIMARY KEY,
    user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    expires_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS attempts (
    id           INTEGER PRIMARY KEY,
    user_id      INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    challenge_id TEXT    NOT NULL,
    correct      INTEGER NOT NULL,
    hints_used   INTEGER NOT NULL DEFAULT 0,
    time_ms      INTEGER,
    mode         TEXT    NOT NULL DEFAULT 'challenge',
    query        TEXT,
    xp_gained    INTEGER NOT NULL DEFAULT 0,
    created_at   TEXT    NOT NULL DEFAULT (datetime('now'))
  );
  CREATE INDEX IF NOT EXISTS idx_attempts_user ON attempts(user_id, id);
  CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);
`);

const stmts = {
  userByName: db.prepare('SELECT * FROM users WHERE username = ?'),
  userById: db.prepare('SELECT * FROM users WHERE id = ?'),
  insertUser: db.prepare('INSERT INTO users (username, password_hash, salt, start_level, state_json, xp, streak) VALUES (?, ?, ?, ?, ?, ?, ?)'),
  updateState: db.prepare('UPDATE users SET state_json = ?, xp = ?, streak = ? WHERE id = ?'),
  updateStartLevel: db.prepare('UPDATE users SET start_level = ? WHERE id = ?'),
  insertSession: db.prepare('INSERT INTO sessions (token, user_id, expires_at) VALUES (?, ?, ?)'),
  sessionUser: db.prepare(`SELECT u.* FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.token = ? AND s.expires_at > datetime('now')`),
  deleteSession: db.prepare('DELETE FROM sessions WHERE token = ?'),
  purgeSessions: db.prepare(`DELETE FROM sessions WHERE expires_at <= datetime('now')`),
  insertAttempt: db.prepare('INSERT INTO attempts (user_id, challenge_id, correct, hints_used, time_ms, mode, query, xp_gained) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'),
  history: db.prepare('SELECT id, challenge_id, correct, hints_used, time_ms, mode, query, xp_gained, created_at FROM attempts WHERE user_id = ? ORDER BY id DESC LIMIT ?'),
  leaderboard: db.prepare('SELECT username, xp, streak, state_json, created_at FROM users ORDER BY xp DESC, created_at ASC LIMIT 25'),
};
stmts.purgeSessions.run();

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
const hashPassword = (pw, salt) => crypto.scryptSync(pw, salt, 64).toString('hex');
const safeEqual = (a, b) => a.length === b.length && crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b));
const SESSION_DAYS = 30;
const USERNAME_RE = /^[A-Za-z0-9_]{3,20}$/;

function parseCookies(req) {
  const out = {};
  for (const part of (req.headers.cookie || '').split(';')) {
    const i = part.indexOf('=');
    if (i > 0) out[part.slice(0, i).trim()] = decodeURIComponent(part.slice(i + 1).trim());
  }
  return out;
}
function publicUser(u) {
  return { id: u.id, username: u.username, start_level: u.start_level, created_at: u.created_at };
}
function loadState(u) {
  try { return { ...emptyState(), ...JSON.parse(u.state_json) }; } catch { return emptyState(); }
}
function startSession(res, userId) {
  const token = crypto.randomBytes(32).toString('hex');
  const expires = new Date(Date.now() + SESSION_DAYS * 86400000);
  stmts.insertSession.run(token, userId, expires.toISOString().replace('T', ' ').slice(0, 19));
  res.cookie('sq_session', token, { httpOnly: true, sameSite: 'lax', secure: 'auto', maxAge: SESSION_DAYS * 86400000, path: '/' });
}
function todayFrom(body) {
  const serverToday = new Date().toISOString().slice(0, 10);
  const t = typeof body.today === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(body.today) ? body.today : null;
  if (!t) return serverToday;
  const diff = Math.abs(Date.parse(t) - Date.parse(serverToday)) / 86400000;
  return diff <= 1 ? t : serverToday; // tolerate the client's local timezone, nothing more
}

// Very small in-memory rate limit for auth endpoints.
const authHits = new Map();
function rateLimited(ip) {
  const now = Date.now();
  const rec = authHits.get(ip) || { count: 0, reset: now + 15 * 60000 };
  if (now > rec.reset) { rec.count = 0; rec.reset = now + 15 * 60000; }
  rec.count++;
  authHits.set(ip, rec);
  return rec.count > 30;
}

// ---------------------------------------------------------------------------
// App
// ---------------------------------------------------------------------------
const app = express();
app.set('trust proxy', 1);
app.disable('x-powered-by');
app.use(express.json({ limit: '256kb' }));

app.use((req, res, next) => {
  const cookies = parseCookies(req);
  req.user = cookies.sq_session ? stmts.sessionUser.get(cookies.sq_session) || null : null;
  req.sessionToken = cookies.sq_session || null;
  next();
});
const requireUser = (req, res, next) => req.user ? next() : res.status(401).json({ error: 'Not logged in' });

app.get('/api/health', (req, res) => res.json({ ok: true }));

app.post('/api/auth/register', (req, res) => {
  if (rateLimited(req.ip)) return res.status(429).json({ error: 'Too many attempts, try again later' });
  const { username, password, start_level } = req.body || {};
  if (typeof username !== 'string' || !USERNAME_RE.test(username)) return res.status(400).json({ error: 'Username must be 3-20 letters, digits or underscores' });
  if (typeof password !== 'string' || password.length < 6 || password.length > 200) return res.status(400).json({ error: 'Password must be at least 6 characters' });
  if (stmts.userByName.get(username)) return res.status(409).json({ error: 'That username is taken' });
  const lvl = [1, 2, 3, 4, 5].includes(Number(start_level)) ? Number(start_level) : 1;
  // Guests can bring their local progress with them when they sign up.
  let state = emptyState();
  if (req.body.state && typeof req.body.state === 'object') {
    const s = req.body.state;
    if (s.completions && typeof s.completions === 'object' && Number.isFinite(s.xp)) {
      state = { ...emptyState(), ...s };
      state.xp = Math.max(0, Math.min(Number(s.xp) | 0, 10000));
    }
  }
  const salt = crypto.randomBytes(16).toString('hex');
  const info = stmts.insertUser.run(username, hashPassword(password, salt), salt, lvl, JSON.stringify(state), state.xp, state.streak || 0);
  startSession(res, Number(info.lastInsertRowid));
  const u = stmts.userById.get(Number(info.lastInsertRowid));
  res.json({ user: publicUser(u), progress: state });
});

app.post('/api/auth/login', (req, res) => {
  if (rateLimited(req.ip)) return res.status(429).json({ error: 'Too many attempts, try again later' });
  const { username, password } = req.body || {};
  const u = typeof username === 'string' ? stmts.userByName.get(username.trim()) : null;
  if (!u || typeof password !== 'string' || !safeEqual(hashPassword(password, u.salt), u.password_hash)) {
    return res.status(401).json({ error: 'Wrong username or password' });
  }
  startSession(res, u.id);
  res.json({ user: publicUser(u), progress: loadState(u) });
});

app.post('/api/auth/logout', (req, res) => {
  if (req.sessionToken) stmts.deleteSession.run(req.sessionToken);
  res.clearCookie('sq_session', { path: '/' });
  res.json({ ok: true });
});

app.get('/api/me', requireUser, (req, res) => {
  res.json({ user: publicUser(req.user), progress: loadState(req.user) });
});

app.patch('/api/me', requireUser, (req, res) => {
  const lvl = Number(req.body?.start_level);
  if (![1, 2, 3, 4, 5].includes(lvl)) return res.status(400).json({ error: 'Invalid level' });
  stmts.updateStartLevel.run(lvl, req.user.id);
  res.json({ user: publicUser({ ...req.user, start_level: lvl }) });
});

app.post('/api/attempt', requireUser, (req, res) => {
  const b = req.body || {};
  const ch = challengeById[b.challenge_id];
  if (!ch) return res.status(400).json({ error: 'Unknown challenge' });
  const mode = ['challenge', 'drill', 'daily'].includes(b.mode) ? b.mode : 'challenge';
  const attempt = {
    challenge_id: ch.id,
    correct: !!b.correct,
    hints_used: Math.max(0, Math.min(Number(b.hints_used) | 0, 10)),
    time_ms: Number.isFinite(Number(b.time_ms)) ? Math.max(0, Math.min(Number(b.time_ms) | 0, 86400000)) : null,
    mode,
    today: todayFrom(b),
    now: new Date().toISOString(),
  };
  const query = typeof b.query === 'string' ? b.query.slice(0, 8000) : null;
  const prev = loadState(req.user);
  const out = applyAttempt(prev, attempt);
  db.exec('BEGIN');
  try {
    stmts.updateState.run(JSON.stringify(out.state), out.state.xp, out.state.streak, req.user.id);
    stmts.insertAttempt.run(req.user.id, ch.id, attempt.correct ? 1 : 0, attempt.hints_used, attempt.time_ms, mode, query, out.xp_gained);
    db.exec('COMMIT');
  } catch (e) {
    db.exec('ROLLBACK');
    throw e;
  }
  res.json(out);
});

app.get('/api/history', requireUser, (req, res) => {
  const limit = Math.max(1, Math.min(Number(req.query.limit) || 50, 200));
  res.json({ attempts: stmts.history.all(req.user.id, limit) });
});

app.get('/api/leaderboard', (req, res) => {
  const rows = stmts.leaderboard.all().map((r, i) => {
    let solved = 0;
    try { solved = Object.keys(JSON.parse(r.state_json).completions || {}).length; } catch { /* ignore */ }
    return { rank: i + 1, username: r.username, xp: r.xp, streak: r.streak, solved, title: rankFor(r.xp).title, you: !!(req.user && req.user.username === r.username) };
  });
  res.json({ leaderboard: rows });
});

app.get('/api/stats', requireUser, (req, res) => res.json(summarize(loadState(req.user))));

app.use(express.static(path.join(__dirname, 'public'), { extensions: ['html'], maxAge: 0 }));
app.use('/api', (req, res) => res.status(404).json({ error: 'Not found' }));
app.use((err, req, res, next) => { // eslint-disable-line no-unused-vars
  console.error(err);
  res.status(500).json({ error: 'Server error' });
});

app.listen(PORT, () => {
  console.log(`SQLQuest running at http://localhost:${PORT}  (data: ${path.join(DATA_DIR, 'sqlquest.db')})`);
});
