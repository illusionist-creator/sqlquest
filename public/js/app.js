// SQLQuest front-end: a small hash-routed single-page app (no framework).
import { SCHEMAS } from './schemas.js';
import { LEVELS, LESSONS, CHALLENGES, challengeById, challengesByLevel, levelInfo, rankFor } from './content.js';
import { compareResults, classifyStatement } from './checker.js';
import { emptyState, applyAttempt, summarize, dailyChallengeFor, BADGES, badgeById, challengeXp, DAILY_BONUS_XP, DRILL_REPEAT_XP } from './progress.js';
import * as engine from './engine.js';

// ---------------------------------------------------------------------------
// Utilities
// ---------------------------------------------------------------------------
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const md = (s) => esc(s).replace(/`([^`]+)`/g, '<code>$1</code>').replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
const pad2 = (n) => String(n).padStart(2, '0');
const localToday = () => { const d = new Date(); return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`; };
const fmtMs = (ms) => ms == null ? '-' : ms < 60000 ? `${(ms / 1000).toFixed(1)}s` : `${Math.floor(ms / 60000)}m ${Math.round((ms % 60000) / 1000)}s`;
const fmtDate = (iso) => { const d = new Date(iso.includes('T') ? iso : iso.replace(' ', 'T') + 'Z'); return isNaN(d) ? iso : d.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' }); };
const shuffle = (arr) => { const a = [...arr]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const LS = {
  get(k, d = null) { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* storage unavailable */ } },
  del(k) { try { localStorage.removeItem(k); } catch { /* ignore */ } },
};
function toast(msg, kind = '') {
  const el = document.createElement('div');
  el.className = 'toast ' + kind; el.textContent = msg;
  $('#toasts').appendChild(el);
  setTimeout(() => el.remove(), 3500);
}
async function api(path, opts = {}) {
  const res = await fetch('/api' + path, {
    method: opts.method || 'GET',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'same-origin',
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) { const e = new Error(data.error || res.statusText); e.status = res.status; throw e; }
  return data;
}

// ---------------------------------------------------------------------------
// Theme
// ---------------------------------------------------------------------------
function currentTheme() { return document.documentElement.getAttribute('data-theme') || 'light'; }
function toggleTheme() {
  const t = currentTheme() === 'dark' ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', t);
  LS.set('sq_theme', t);
  renderTopbar();
}

// ---------------------------------------------------------------------------
// Session / progress store (server for accounts, localStorage for guests)
// ---------------------------------------------------------------------------
const state = { user: null, progress: null, guest: false, loaded: false };
const GUEST_KEY = 'sq_guest';

const store = {
  async load() {
    try {
      const me = await api('/me');
      state.user = me.user; state.progress = { ...emptyState(), ...me.progress }; state.guest = false;
    } catch {
      const g = LS.get(GUEST_KEY);
      if (g) { state.guest = true; state.progress = { ...emptyState(), ...g.progress }; state.user = { username: 'Guest', start_level: g.start_level || 1, guest: true }; }
      else { state.user = null; state.progress = null; state.guest = false; }
    }
    state.loaded = true;
  },
  startGuest(start_level) {
    const g = { start_level, progress: emptyState(), history: [] };
    LS.set(GUEST_KEY, g);
    state.guest = true; state.progress = g.progress; state.user = { username: 'Guest', start_level, guest: true };
  },
  saveGuest() {
    const g = LS.get(GUEST_KEY) || { history: [] };
    g.progress = state.progress; g.start_level = state.user.start_level;
    LS.set(GUEST_KEY, g);
  },
  async attempt(att) {
    const payload = { ...att, today: localToday() };
    if (state.guest) {
      const out = applyAttempt(state.progress, { ...payload, now: new Date().toISOString() });
      state.progress = out.state;
      const g = LS.get(GUEST_KEY) || { history: [] };
      g.progress = out.state;
      g.history = [{ challenge_id: att.challenge_id, correct: att.correct ? 1 : 0, hints_used: att.hints_used, time_ms: att.time_ms, mode: att.mode, query: att.query, xp_gained: out.xp_gained, created_at: new Date().toISOString() }, ...(g.history || [])].slice(0, 100);
      LS.set(GUEST_KEY, g);
      return out;
    }
    const out = await api('/attempt', { method: 'POST', body: payload });
    state.progress = { ...emptyState(), ...out.state };
    return out;
  },
  async history() {
    if (state.guest) return (LS.get(GUEST_KEY)?.history) || [];
    return (await api('/history?limit=60')).attempts;
  },
  async setStartLevel(lvl) {
    state.user.start_level = lvl;
    if (state.guest) this.saveGuest(); else await api('/me', { method: 'PATCH', body: { start_level: lvl } });
  },
  async logout() {
    if (!state.guest) await api('/auth/logout', { method: 'POST' }).catch(() => {});
    state.user = null; state.progress = null; state.guest = false;
  },
};

// ---------------------------------------------------------------------------
// Router
// ---------------------------------------------------------------------------
let activeCleanup = null;
function go(hash) { location.hash = hash; }
function route() {
  if (activeCleanup) { try { activeCleanup(); } catch { /* ignore */ } activeCleanup = null; }
  const raw = (location.hash || '#/').slice(1);
  const [path, qs] = raw.split('?');
  const parts = path.split('/').filter(Boolean);
  const query = Object.fromEntries(new URLSearchParams(qs || ''));
  const view = $('#view');
  const needUser = !['auth', 'playground', 'leaderboard'].includes(parts[0] || 'home');
  if (needUser && !state.user) { viewAuth(view, query); renderTopbar(); return; }
  switch (parts[0]) {
    case undefined: viewDashboard(view); break;
    case 'auth': viewAuth(view, query); break;
    case 'level': viewLevel(view, Number(parts[1])); break;
    case 'challenge': viewChallenge(view, parts[1], query); break;
    case 'drill': viewDrill(view); break;
    case 'playground': viewPlayground(view); break;
    case 'leaderboard': viewLeaderboard(view); break;
    case 'profile': viewProfile(view); break;
    default: viewDashboard(view);
  }
  renderTopbar();
  window.scrollTo(0, 0);
}

function renderTopbar() {
  const nav = $('#nav');
  const here = (location.hash || '#/').split('?')[0];
  const links = [['#/', 'Learn'], ['#/drill', 'Drill'], ['#/playground', 'Playground'], ['#/leaderboard', 'Leaderboard']];
  nav.innerHTML = links.map(([h, t]) => `<a href="${h}" class="${here === h ? 'active' : ''}">${t}</a>`).join('');
  const box = $('#userbox');
  const themeBtn = `<button class="icon-btn" id="themeBtn" title="Toggle theme">${currentTheme() === 'dark' ? '☀️' : '🌙'}</button>`;
  if (!state.user) {
    box.innerHTML = `${themeBtn}<a class="btn sm primary" href="#/auth">Log in</a>`;
  } else {
    const p = state.progress;
    const r = rankFor(p.xp);
    box.innerHTML = `
      <span class="chip xp" title="Experience points">✦ ${p.xp} XP</span>
      <span class="chip streak" title="Daily streak">🔥 ${p.streak}</span>
      <a class="chip rank" href="#/profile" title="Your profile">${esc(state.user.username)} · ${r.title}</a>
      ${themeBtn}`;
  }
  $('#themeBtn').onclick = toggleTheme;
}

// ---------------------------------------------------------------------------
// Shared components
// ---------------------------------------------------------------------------
const KEYWORDS = new Set('SELECT FROM WHERE AND OR NOT IN IS NULL AS ON JOIN INNER LEFT RIGHT FULL OUTER CROSS GROUP BY ORDER HAVING LIMIT OFFSET DISTINCT CASE WHEN THEN ELSE END WITH RECURSIVE UNION ALL EXCEPT INTERSECT OVER PARTITION ROWS RANGE BETWEEN PRECEDING FOLLOWING CURRENT ROW UNBOUNDED EXISTS LIKE ASC DESC CAST INSERT INTO VALUES UPDATE SET DELETE CREATE TABLE DROP ALTER VIEW INDEX PRIMARY KEY REFERENCES INTEGER TEXT REAL DEFAULT USING NATURAL GLOB ESCAPE COLLATE FILTER WINDOW NULLS FIRST LAST TRUE FALSE IF TEMP TEMPORARY REPLACE'.split(' '));
const FUNCS = new Set('COUNT SUM AVG MIN MAX ROUND ABS COALESCE IFNULL NULLIF LENGTH UPPER LOWER SUBSTR SUBSTRING TRIM LTRIM RTRIM REPLACE INSTR PRINTF FORMAT DATE TIME DATETIME JULIANDAY STRFTIME ROW_NUMBER RANK DENSE_RANK NTILE LAG LEAD FIRST_VALUE LAST_VALUE NTH_VALUE GROUP_CONCAT TOTAL TYPEOF IIF PERCENT_RANK CUME_DIST RANDOM UNIXEPOCH CONCAT CONCAT_WS'.split(' '));
function highlight(src) {
  const re = /(--[^\n]*)|(\/\*[\s\S]*?\*\/)|('(?:[^']|'')*'?)|("(?:[^"]|"")*"?)|(\b\d+(?:\.\d+)?\b)|([A-Za-z_][A-Za-z0-9_]*)/g;
  let out = '', last = 0, m;
  while ((m = re.exec(src))) {
    out += esc(src.slice(last, m.index));
    const t = m[0];
    if (m[1] || m[2]) out += `<span class="tok-cmt">${esc(t)}</span>`;
    else if (m[3] || m[4]) out += `<span class="tok-str">${esc(t)}</span>`;
    else if (m[5]) out += `<span class="tok-num">${esc(t)}</span>`;
    else if (KEYWORDS.has(t.toUpperCase())) out += `<span class="tok-kw">${esc(t)}</span>`;
    else if (FUNCS.has(t.toUpperCase())) out += `<span class="tok-fn">${esc(t)}</span>`;
    else out += esc(t);
    last = re.lastIndex;
  }
  return out + esc(src.slice(last));
}
function editorHTML(value = '', placeholder = '-- Write your SQL here. Ctrl+Enter runs it, Ctrl+Shift+Enter checks it.') {
  return `<div class="editor"><pre aria-hidden="true"><code>${highlight(value)}\n</code></pre><textarea spellcheck="false" autocapitalize="off" autocomplete="off" placeholder="${esc(placeholder)}">${esc(value)}</textarea></div>`;
}
function bindEditor(root, { onRun, onCheck, onChange } = {}) {
  const ta = $('textarea', root), pre = $('pre', root), code = $('pre code', root);
  const sync = () => { code.innerHTML = highlight(ta.value) + '\n'; pre.scrollTop = ta.scrollTop; pre.scrollLeft = ta.scrollLeft; };
  ta.addEventListener('input', () => { sync(); onChange && onChange(ta.value); });
  ta.addEventListener('scroll', () => { pre.scrollTop = ta.scrollTop; pre.scrollLeft = ta.scrollLeft; });
  ta.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') { e.preventDefault(); (e.shiftKey && onCheck ? onCheck : onRun)?.(); }
    else if (e.key === 'Tab') {
      e.preventDefault();
      const s = ta.selectionStart, en = ta.selectionEnd;
      ta.value = ta.value.slice(0, s) + '  ' + ta.value.slice(en);
      ta.selectionStart = ta.selectionEnd = s + 2; sync(); onChange && onChange(ta.value);
    }
  });
  sync();
  return { get value() { return ta.value; }, set value(v) { ta.value = v; sync(); }, focus: () => ta.focus() };
}
function gridHTML(r, max = 200) {
  if (!r || !r.columns.length) return `<div class="result-empty">Statement ran, nothing to show.</div>`;
  const rows = r.values.slice(0, max).map((row) => `<tr>${row.map((v) => v === null ? '<td class="null">NULL</td>' : typeof v === 'number' ? `<td class="num">${v}</td>` : `<td>${esc(v)}</td>`).join('')}</tr>`).join('');
  return `<div class="grid-wrap"><table class="grid"><thead><tr>${r.columns.map((c) => `<th>${esc(c)}</th>`).join('')}</tr></thead><tbody>${rows || `<tr><td colspan="${r.columns.length}" class="null">0 rows</td></tr>`}</tbody></table></div>`
    + (r.values.length > max ? `<div class="result-meta">Showing the first ${max} of ${r.values.length} rows.</div>` : '');
}
function singleResultHTML(res) {
  if (!res.ok) return `<div class="result-error">${esc(res.error)}</div>`;
  return gridHTML(res.result) + `<div class="result-meta">${res.result.values.length} row${res.result.values.length === 1 ? '' : 's'} · ${res.ms.toFixed(0)} ms</div>`;
}
function schemaPanelHTML(key) {
  const s = SCHEMAS[key];
  return `<div class="card-head"><h3>Database: ${esc(s.name)}</h3></div>
    <p class="muted small">${esc(s.description)}</p>
    ${s.tables.map((t) => `<details class="schema-tbl"><summary><span>${t.name}</span><button class="pv" data-preview="${t.name}">preview</button></summary>
      <ul>${t.columns.map((c) => `<li><span class="${/PRIMARY KEY/.test(c[1]) ? 'pk' : ''}">${c[0]}</span><span class="ty">${esc(c[1].replace(/ REFERENCES.*$/, '').replace(' NOT NULL', '').replace(' PRIMARY KEY', ' PK'))}</span>${c[2] ? `<span class="ds">${esc(c[2])}</span>` : ''}</li>`).join('')}</ul></details>`).join('')}`;
}
function lessonHTML(key, open) {
  const l = LESSONS[key];
  if (!l) return '';
  return `<details class="lesson" ${open ? 'open' : ''}><summary>Lesson: ${esc(l.title)}</summary><div class="body">${l.body}</div></details>`;
}
const levelClass = (n) => `lv${n}`;

/**
 * Mount the challenge workspace (task, schema, editor, results, check flow).
 * opts: { mode: 'challenge'|'daily'|'drill', allowHints, showLesson, onSolved(out), onSkip(), header }
 */
async function mountChallenge(root, ch, opts) {
  const lvl = levelInfo(ch.level);
  const done = !!state.progress.completions[ch.id];
  const draftKey = `sq_draft_${ch.id}`;
  const draft = opts.mode === 'drill' ? '' : (LS.get(draftKey, '') || '');
  let hintsUsed = 0, solutionShown = false, solved = false;
  const startedAt = Date.now();

  root.innerHTML = `
    ${opts.header || ''}
    <div class="ws">
      <div class="stack">
        <section class="card">
          <div class="crumb">Level ${ch.level} · ${esc(lvl.title)} · ${esc(SCHEMAS[ch.schema].name)}</div>
          <h2 style="margin-bottom:8px">${esc(ch.title)} ${done ? '<span class="chip ok">✓ solved</span>' : ''}</h2>
          <div class="task">${md(ch.task)}</div>
          <div class="cols"><span class="muted small">Return columns:</span>${ch.columns.map((c) => `<code>${esc(c)}</code>`).join('')}${ch.ordered ? '<span class="tag">row order matters</span>' : ''}</div>
          <div class="hints" id="hints"></div>
          ${opts.allowHints ? `<div class="toolbar"><button class="btn sm" id="hintBtn">💡 Hint (${ch.hints.length} available)</button><button class="btn sm ghost" id="solBtn">Show solution</button><span class="spacer"></span><span class="muted small" id="xpNote">Worth ${challengeXp(ch, 0)} XP</span></div>` : ''}
          <div id="solution"></div>
        </section>
        ${opts.showLesson ? `<section class="card">${lessonHTML(ch.lesson, !done)}</section>` : ''}
        <section class="card" id="schemaPanel">${schemaPanelHTML(ch.schema)}</section>
      </div>
      <div class="stack">
        <section class="card">
          ${editorHTML(draft)}
          <div class="toolbar">
            <button class="btn" id="runBtn">▶ Run <kbd>Ctrl</kbd>+<kbd>↵</kbd></button>
            <button class="btn primary" id="checkBtn">✓ Check answer</button>
            ${opts.onSkip ? '<button class="btn ghost" id="skipBtn">Skip</button>' : ''}
            <span class="spacer"></span>
            <span class="timer" id="timer">0:00</span>
          </div>
          <div class="feedback" id="feedback"></div>
          <div class="results" id="results"><div class="result-empty">Run your query to see results here. Checking compares your result set with the expected one; column names can differ, column order cannot.</div></div>
        </section>
      </div>
    </div>`;

  const ed = bindEditor($('.editor', root), {
    onRun: run, onCheck: check,
    onChange: (v) => { if (opts.mode !== 'drill') LS.set(draftKey, v); },
  });
  const fb = $('#feedback', root), results = $('#results', root);
  const timerEl = $('#timer', root);
  const tick = setInterval(() => { const s = Math.floor((Date.now() - startedAt) / 1000); timerEl.textContent = `${Math.floor(s / 60)}:${pad2(s % 60)}`; }, 1000);
  activeCleanup = () => clearInterval(tick);

  const show = (kind, html) => { fb.className = `feedback show ${kind}`; fb.innerHTML = html; };

  function run() {
    const cls = classifyStatement(ed.value);
    if (!cls.ok) { show('info', esc(cls.reason)); return null; }
    const res = engine.runSingle(ch.schema, ed.value);
    results.innerHTML = singleResultHTML(res);
    fb.className = 'feedback';
    return res;
  }
  async function check() {
    if (solved) return;
    const cls = classifyStatement(ed.value);
    if (!cls.ok) { show('info', esc(cls.reason)); return; }
    const res = engine.runSingle(ch.schema, ed.value);
    results.innerHTML = singleResultHTML(res);
    $('#checkBtn', root).disabled = true;
    try {
      if (!res.ok) {
        await store.attempt({ challenge_id: ch.id, correct: false, hints_used: effectiveHints(), time_ms: Date.now() - startedAt, mode: opts.mode, query: ed.value });
        show('bad', `<strong>SQL error.</strong> ${esc(res.error)}`);
        return;
      }
      const cmp = compareResults(res.result, engine.expected(ch), { ordered: !!ch.ordered });
      const out = await store.attempt({ challenge_id: ch.id, correct: cmp.pass, hints_used: effectiveHints(), time_ms: Date.now() - startedAt, mode: opts.mode, query: ed.value });
      if (!cmp.pass) { show('bad', `<strong>Not quite.</strong> ${esc(cmp.reason)}`); renderTopbar(); return; }
      solved = true;
      if (opts.mode !== 'drill') LS.del(draftKey);
      const badges = (out.new_badges || []).map((id) => badgeById[id]).filter(Boolean);
      show('good', `<div class="row"><span class="big">Correct!</span>${out.xp_gained ? `<span class="xp-pop">+${out.xp_gained} XP</span>` : '<span class="muted small">already solved, no new XP</span>'}${badges.map((b) => `<span class="badge-pop">${b.icon} ${esc(b.title)}</span>`).join('')}</div>
        <div class="muted small" style="margin-top:4px">Solved in ${fmtMs(Date.now() - startedAt)}${hintsUsed ? ` with ${hintsUsed} hint${hintsUsed > 1 ? 's' : ''}` : ' without hints'}. Rank: ${esc(out.rank?.title || rankFor(state.progress.xp).title)}.</div>
        <div class="actions" id="afterActions"></div>`);
      renderTopbar();
      opts.onSolved && opts.onSolved(out, $('#afterActions', root));
    } catch (e) {
      show('bad', `Could not save your attempt: ${esc(e.message)}`);
    } finally {
      $('#checkBtn', root).disabled = solved;
    }
  }
  const effectiveHints = () => solutionShown ? Math.max(hintsUsed, 3) : hintsUsed;

  $('#runBtn', root).onclick = run;
  $('#checkBtn', root).onclick = check;
  if (opts.onSkip) $('#skipBtn', root).onclick = () => opts.onSkip();
  if (opts.allowHints) {
    const hintBtn = $('#hintBtn', root), xpNote = $('#xpNote', root);
    const updateNote = () => { xpNote.textContent = done ? 'Already solved: re-solving earns no XP here, but drills do.' : `Worth ${challengeXp(ch, effectiveHints())} XP`; };
    updateNote();
    hintBtn.onclick = () => {
      if (hintsUsed >= ch.hints.length) return;
      const h = ch.hints[hintsUsed++];
      $('#hints', root).insertAdjacentHTML('beforeend', `<div class="hint">${md(h)}</div>`);
      hintBtn.textContent = hintsUsed >= ch.hints.length ? 'No more hints' : `💡 Hint (${ch.hints.length - hintsUsed} left)`;
      hintBtn.disabled = hintsUsed >= ch.hints.length;
      updateNote();
    };
    $('#solBtn', root).onclick = () => {
      if (solutionShown) return;
      solutionShown = true;
      $('#solution', root).innerHTML = `<p class="muted small" style="margin:10px 0 6px">Reference solution (any equivalent query also passes). Checking after viewing it earns the minimum XP.</p><pre><code>${highlight(ch.solution)}</code></pre>`;
      updateNote();
    };
  }
  $$('[data-preview]', root).forEach((b) => b.onclick = (e) => {
    e.preventDefault(); e.stopPropagation();
    const res = engine.preview(ch.schema, b.dataset.preview, 8);
    results.innerHTML = `<div class="result-meta" style="margin:0 0 6px">Preview: first rows of <code>${b.dataset.preview}</code></div>` + singleResultHTML(res);
  });
  ed.focus();
  return { editor: ed };
}

async function ensureEngine(view) {
  if (engine.ready()) return true;
  view.innerHTML = '<div class="loading">Loading the SQL engine…</div>';
  try { await engine.init(); return true; }
  catch (e) { view.innerHTML = `<div class="card"><h2>Could not load the SQL engine</h2><p>${esc(e.message)}</p></div>`; return false; }
}

// ---------------------------------------------------------------------------
// Views
// ---------------------------------------------------------------------------
const LEVEL_CHOICES = [
  { v: 1, b: 'New to SQL', d: 'Start from SELECT and WHERE. Every concept has a lesson.' },
  { v: 3, b: 'I know the basics', d: 'Comfortable with filters and GROUP BY. Start at joins and subqueries.' },
  { v: 4, b: 'Veteran, polishing', d: 'Window functions, CTEs and real analytics. Drill mode recommended.' },
];
function levelChoiceHTML(selected = 1, name = 'lvl') {
  return `<div class="radio-cards">${LEVEL_CHOICES.map((c) => `<label class="radio-card"><input type="radio" name="${name}" value="${c.v}" ${c.v === selected ? 'checked' : ''}><div><b>${c.b}</b><span>${c.d}</span></div></label>`).join('')}</div>`;
}

function viewAuth(view, query) {
  let tab = query.tab === 'register' ? 'register' : 'login';
  const guestProgress = LS.get(GUEST_KEY);
  const render = () => {
    view.innerHTML = `
    <div class="auth-wrap">
      <div class="auth-pitch">
        <h1>Learn SQL by <span>actually writing it.</span></h1>
        <p>${CHALLENGES.length} hands-on challenges across five levels, each with a short lesson and a real database to query. Pick where you start, earn XP, keep a streak, and drill the hard stuff until it is reflex.</p>
        <ul class="pitch-points">
          <li><span class="ico">🎯</span><div><b>Choose your difficulty.</b><br><span class="muted">Beginners start with lessons; veterans jump to window functions and drills.</span></div></li>
          <li><span class="ico">🧪</span><div><b>Real queries, instant feedback.</b><br><span class="muted">SQLite runs in your browser. Any correct query passes, not just one "right" answer.</span></div></li>
          <li><span class="ico">📈</span><div><b>Progress that sticks.</b><br><span class="muted">XP, ranks, badges and your attempt history are saved to your account.</span></div></li>
        </ul>
      </div>
      <div class="card auth-card">
        <div class="tabs"><button class="${tab === 'login' ? 'active' : ''}" data-tab="login">Log in</button><button class="${tab === 'register' ? 'active' : ''}" data-tab="register">Create account</button></div>
        <form id="authForm">
          <div id="formError"></div>
          <div class="field"><label>Username</label><input type="text" name="username" autocomplete="username" required minlength="3" maxlength="20" pattern="[A-Za-z0-9_]+" placeholder="e.g. priya_s"></div>
          <div class="field"><label>Password</label><input type="password" name="password" autocomplete="${tab === 'login' ? 'current-password' : 'new-password'}" required minlength="6" placeholder="at least 6 characters"></div>
          ${tab === 'register' ? `<div class="field"><label>Where are you starting from?</label>${levelChoiceHTML(guestProgress?.start_level || 1)}</div>
            ${guestProgress && Object.keys(guestProgress.progress?.completions || {}).length ? `<p class="small" style="background:var(--success-soft);color:var(--success);padding:8px 12px;border-radius:8px">Your guest progress (${guestProgress.progress.xp} XP, ${Object.keys(guestProgress.progress.completions).length} solved) will be carried into the new account.</p>` : ''}` : ''}
          <button class="btn primary block lg" type="submit">${tab === 'login' ? 'Log in' : 'Create account'}</button>
        </form>
        <div style="text-align:center;margin-top:14px" class="small muted">or</div>
        <details style="margin-top:10px"><summary class="small" style="cursor:pointer;color:var(--accent);text-align:center">Try as a guest (progress stays in this browser only)</summary>
          <div style="margin-top:12px">${levelChoiceHTML(1, 'glvl')}<button class="btn block" id="guestBtn" style="margin-top:10px">Continue as guest</button></div>
        </details>
      </div>
    </div>`;
    $$('.tabs button', view).forEach((b) => b.onclick = () => { tab = b.dataset.tab; render(); });
    $('#authForm', view).onsubmit = async (e) => {
      e.preventDefault();
      const f = new FormData(e.target);
      const body = { username: f.get('username').trim(), password: f.get('password') };
      if (tab === 'register') { body.start_level = Number(f.get('lvl') || 1); if (guestProgress?.progress) body.state = guestProgress.progress; }
      const btn = $('button[type=submit]', e.target); btn.disabled = true;
      try {
        await api(tab === 'login' ? '/auth/login' : '/auth/register', { method: 'POST', body });
        if (tab === 'register') LS.del(GUEST_KEY);
        await store.load();
        toast(tab === 'login' ? `Welcome back, ${state.user.username}!` : `Account created. Welcome, ${state.user.username}!`, 'good');
        go('#/');
      } catch (err) {
        $('#formError', view).innerHTML = `<div class="form-error">${esc(err.message)}</div>`;
        btn.disabled = false;
      }
    };
    $('#guestBtn', view).onclick = () => {
      const lvl = Number(($('input[name=glvl]:checked', view) || {}).value || 1);
      if (guestProgress) { state.guest = true; state.progress = { ...emptyState(), ...guestProgress.progress }; state.user = { username: 'Guest', start_level: guestProgress.start_level || lvl, guest: true }; }
      else store.startGuest(lvl);
      toast('Guest mode: progress is saved in this browser only.', '');
      go('#/');
    };
  };
  render();
}

function firstUnsolved(fromLevel = 1) {
  const p = state.progress;
  return CHALLENGES.find((c) => c.level >= fromLevel && !p.completions[c.id]) || CHALLENGES.find((c) => !p.completions[c.id]) || null;
}

function viewDashboard(view) {
  const p = state.progress, sum = summarize(p), r = rankFor(p.xp);
  const today = localToday();
  const daily = dailyChallengeFor(today);
  const dailyDone = p.daily?.date === today && p.daily?.done;
  const next = firstUnsolved(state.user.start_level || 1);
  const toNext = r.next ? Math.round(100 * (p.xp - r.xp) / (r.next.xp - r.xp)) : 100;
  const veteran = (state.user.start_level || 1) >= 4;
  const greeting = state.guest ? 'Guest session' : `Welcome back, ${esc(state.user.username)}`;

  view.innerHTML = `
    <div class="hero">
      <section class="card">
        <div class="card-head"><div><div class="muted small">${greeting}</div><h1 style="margin:0">${esc(r.title)} <span class="muted" style="font-weight:500;font-size:16px">· ${p.xp} XP</span></h1></div>
          ${state.guest ? '<a class="btn sm primary" href="#/auth?tab=register">Save progress</a>' : ''}</div>
        <div class="progress" title="${r.next ? `${r.next.xp - p.xp} XP to ${r.next.title}` : 'Max rank'}"><i style="width:${toNext}%"></i></div>
        <div class="muted small" style="margin:6px 0 14px">${r.next ? `${r.next.xp - p.xp} XP to <b>${esc(r.next.title)}</b>` : 'You hold the highest rank.'}</div>
        <div class="stat-row">
          <div class="stat"><div class="v">${sum.done}<span class="muted" style="font-size:14px">/${sum.total}</span></div><div class="l">Solved</div></div>
          <div class="stat"><div class="v">🔥 ${p.streak}</div><div class="l">Day streak</div></div>
          <div class="stat"><div class="v">${Object.keys(p.badges).length}</div><div class="l">Badges</div></div>
          <div class="stat"><div class="v">${p.counters.attempts ? Math.round(100 * p.counters.correct / p.counters.attempts) : 0}%</div><div class="l">Accuracy</div></div>
        </div>
      </section>
      <section class="card stack">
        <div class="feature"><span class="ico">📅</span><div style="flex:1"><h3>Daily challenge</h3>
          <p>${esc(daily.title)} · Level ${daily.level} · <b>+${DAILY_BONUS_XP} XP bonus</b>${dailyDone ? ' · <span class="chip ok">done today</span>' : ''}</p>
          <a class="btn sm ${dailyDone ? '' : 'primary'}" href="#/challenge/${daily.id}?mode=daily">${dailyDone ? 'Solve again' : 'Take it on'}</a></div></div>
        <div class="feature"><span class="ico">${next ? '🚀' : '🏆'}</span><div style="flex:1"><h3>${next ? 'Continue' : 'Everything solved!'}</h3>
          <p>${next ? `${esc(next.title)} · Level ${next.level} ${esc(levelInfo(next.level).title)}` : 'Keep sharp with drills and the daily challenge.'}</p>
          ${next ? `<a class="btn sm" href="#/challenge/${next.id}">Open challenge</a>` : '<a class="btn sm" href="#/drill">Start a drill</a>'}</div></div>
      </section>
    </div>

    <div class="card-head" style="margin-top:8px"><h2>Levels</h2><span class="muted small">All levels are open. Pick your difficulty.</span></div>
    <div class="levels">
      ${LEVELS.map((l) => { const pl = sum.perLevel.find((x) => x.level === l.n); const first = challengesByLevel(l.n).find((c) => !p.completions[c.id]); const pct = Math.round(100 * pl.done / pl.total);
        return `<a class="card level-card ${levelClass(l.n)}" href="#/level/${l.n}">
          <div class="row spread"><span class="num">Level ${l.n} · ${l.tag} · ${l.xp} XP</span>${pl.done === pl.total ? '<span class="chip ok">✓</span>' : ''}</div>
          <h3>${l.title}</h3>
          <p class="muted small" style="margin:0">${l.blurb}</p>
          <div class="progress"><i style="width:${pct}%"></i></div>
          <div class="foot"><span class="muted small">${pl.done}/${pl.total} solved</span><span class="btn sm ${first && (l.n === (next?.level)) ? 'primary' : ''}">${pl.done === 0 ? 'Start' : pl.done === pl.total ? 'Review' : 'Continue'}</span></div>
        </a>`; }).join('')}
    </div>

    <div class="grid-2">
      <section class="card feature" style="${veteran ? 'border-color:var(--accent)' : ''}"><span class="ico">🎯</span><div style="flex:1"><h3>Drill mode ${veteran ? '<span class="tag" style="background:var(--accent-soft);color:var(--accent)">recommended</span>' : ''}</h3>
        <p>Timed sets of random challenges from the levels you choose, no lessons, no hints. Built for people who already know SQL and want it fast and automatic. Re-solving in drills still earns ${DRILL_REPEAT_XP} XP.</p><a class="btn sm" href="#/drill">Set up a drill</a></div></section>
      <section class="card feature"><span class="ico">🧪</span><div style="flex:1"><h3>Playground</h3>
        <p>Free-form SQL on either practice database. Create tables, insert rows, experiment. Nothing you do here affects challenges.</p><a class="btn sm" href="#/playground">Open playground</a></div></section>
    </div>`;
}

function viewLevel(view, n) {
  const l = levelInfo(n);
  if (!l) return go('#/');
  const p = state.progress;
  const list = challengesByLevel(n);
  const done = list.filter((c) => p.completions[c.id]).length;
  view.innerHTML = `
    <div class="ws-head"><div><div class="crumb"><a href="#/">Learn</a> › Level ${n}</div><h1>Level ${n}: ${l.title}</h1><p class="muted" style="margin:4px 0 0">${l.blurb} · ${l.xp} XP per challenge · ${done}/${list.length} solved</p></div>
      ${done < list.length ? `<a class="btn primary" href="#/challenge/${list.find((c) => !p.completions[c.id]).id}">${done ? 'Continue' : 'Start level'}</a>` : '<span class="chip ok">Level cleared</span>'}</div>
    <div class="progress ${levelClass(n)}" style="margin-bottom:16px"><i style="width:${Math.round(100 * done / list.length)}%;background:var(--lc)"></i></div>
    <div class="ch-list">
      ${list.map((c, i) => { const comp = p.completions[c.id]; return `<a class="ch-item ${comp ? 'done' : ''}" href="#/challenge/${c.id}">
        <span class="st">${comp ? '✓' : i + 1}</span>
        <span class="t">${esc(c.title)}<div class="meta">${esc(LESSONS[c.lesson]?.title || '')} · ${esc(SCHEMAS[c.schema].name)}</div></span>
        <span class="meta">${comp ? `${comp.xp} XP · best ${fmtMs(comp.best_ms)}` : `${l.xp} XP`}</span>
      </a>`; }).join('')}
    </div>`;
}

async function viewChallenge(view, id, query) {
  const ch = challengeById[id];
  if (!ch) return go('#/');
  if (!(await ensureEngine(view))) return;
  const mode = query.mode === 'daily' ? 'daily' : 'challenge';
  const list = challengesByLevel(ch.level);
  const idx = list.indexOf(ch);
  const prev = list[idx - 1], next = list[idx + 1];
  const header = `<div class="ws-head"><div class="crumb"><a href="#/">Learn</a> › <a href="#/level/${ch.level}">Level ${ch.level}</a> › ${idx + 1} of ${list.length}${mode === 'daily' ? ' · <span class="tag" style="background:var(--gold-soft);color:var(--gold)">daily challenge</span>' : ''}</div>
    <div class="row">${prev ? `<a class="btn sm" href="#/challenge/${prev.id}">← Prev</a>` : ''}${next ? `<a class="btn sm" href="#/challenge/${next.id}">Next →</a>` : `<a class="btn sm" href="#/level/${ch.level}">Level overview</a>`}</div></div>`;
  await mountChallenge(view, ch, {
    mode, allowHints: true, showLesson: true, header,
    onSolved: (out, actions) => {
      const nextUnsolved = list.slice(idx + 1).find((c) => !state.progress.completions[c.id]) || next;
      const levelDone = list.every((c) => state.progress.completions[c.id]);
      actions.innerHTML = (nextUnsolved ? `<a class="btn primary" href="#/challenge/${nextUnsolved.id}">Next challenge →</a>` : '')
        + (levelDone ? `<a class="btn" href="#/">Level ${ch.level} cleared! Back to levels</a>` : `<a class="btn" href="#/level/${ch.level}">Level overview</a>`);
      if (out.new_badges?.length) toast(`Badge earned: ${out.new_badges.map((b) => badgeById[b]?.title).join(', ')}`, 'good');
    },
  });
}

function viewDrill(view) {
  const p = state.progress;
  const start = state.user.start_level || 1;
  const defaults = start >= 4 ? [4, 5] : start >= 3 ? [2, 3, 4] : [1, 2];
  const saved = LS.get('sq_drill_cfg');
  const cfg = saved || { levels: defaults, count: 5, includeSolved: true };
  view.innerHTML = `
    <div class="ws-head"><div><div class="crumb"><a href="#/">Learn</a> › Drill</div><h1>Drill mode</h1><p class="muted" style="margin:4px 0 0">Random challenges, one after another, against the clock. No lessons, no hints. Great for keeping SQL sharp.</p></div></div>
    <div class="grid-2">
      <section class="card">
        <h3>Levels to draw from</h3>
        <div class="row" id="lvlChecks">${LEVELS.map((l) => `<label class="check"><input type="checkbox" value="${l.n}" ${cfg.levels.includes(l.n) ? 'checked' : ''}> L${l.n} ${l.title}</label>`).join('')}</div>
        <h3 style="margin-top:18px">Questions</h3>
        <div class="row" id="countChecks">${[5, 10, 15].map((n) => `<label class="check"><input type="radio" name="cnt" value="${n}" ${cfg.count === n ? 'checked' : ''}> ${n}</label>`).join('')}</div>
        <h3 style="margin-top:18px">Pool</h3>
        <label class="check"><input type="checkbox" id="inclSolved" ${cfg.includeSolved ? 'checked' : ''}> Include challenges I have already solved</label>
        <p class="muted small" style="margin-top:14px">First-time solves earn full XP. Re-solves earn ${DRILL_REPEAT_XP} XP each. Skips count as wrong.</p>
        <button class="btn primary lg" id="startDrill">Start drill</button>
        <div id="drillErr" style="margin-top:10px"></div>
      </section>
      <section class="card">
        <h3>Your drill record</h3>
        <div class="stat-row">
          <div class="stat"><div class="v">${p.counters.drill_correct}</div><div class="l">Drill solves</div></div>
          <div class="stat"><div class="v">${p.badges.drill_25 ? '🎯' : `${p.counters.drill_correct}/25`}</div><div class="l">Drill Sergeant</div></div>
          <div class="stat"><div class="v">${p.counters.attempts ? Math.round(100 * p.counters.correct / p.counters.attempts) : 0}%</div><div class="l">Overall accuracy</div></div>
        </div>
        <p class="muted small" style="margin-top:14px">Tip for veterans: pick Levels 4 and 5 with solved challenges included. The point is speed and recall, not novelty.</p>
      </section>
    </div>`;
  $('#startDrill', view).onclick = async () => {
    const levels = $$('#lvlChecks input:checked', view).map((i) => Number(i.value));
    const count = Number(($('#countChecks input:checked', view) || {}).value || 5);
    const includeSolved = $('#inclSolved', view).checked;
    let pool = CHALLENGES.filter((c) => levels.includes(c.level));
    if (!includeSolved) pool = pool.filter((c) => !p.completions[c.id]);
    if (!levels.length || !pool.length) { $('#drillErr', view).innerHTML = '<div class="form-error">Pick at least one level with available challenges.</div>'; return; }
    LS.set('sq_drill_cfg', { levels, count, includeSolved });
    runDrill(view, shuffle(pool).slice(0, Math.min(count, pool.length)));
  };
}

async function runDrill(view, set) {
  if (!(await ensureEngine(view))) return;
  const startedAt = Date.now();
  let i = 0, correct = 0, xp = 0, skipped = 0;
  const show = async () => {
    if (i >= set.length) return finish();
    const ch = set[i];
    const header = `<div class="drill-bar"><span class="chip">Drill · ${i + 1}/${set.length}</span><div class="progress"><i style="width:${Math.round(100 * i / set.length)}%"></i></div><span class="score">${correct} ✓</span><span class="timer" id="drillTimer"></span><a class="btn sm ghost" href="#/drill">Quit</a></div>`;
    await mountChallenge(view, ch, {
      mode: 'drill', allowHints: false, showLesson: false, header,
      onSolved: (out, actions) => {
        correct++; xp += out.xp_gained || 0;
        actions.innerHTML = `<button class="btn primary" id="nextDrill">${i + 1 < set.length ? 'Next question →' : 'See results'}</button>`;
        $('#nextDrill', view).onclick = () => { i++; show(); };
        $('#nextDrill', view).focus();
      },
      onSkip: () => { skipped++; store.attempt({ challenge_id: ch.id, correct: false, hints_used: 0, time_ms: 0, mode: 'drill', query: '' }).catch(() => {}); i++; show(); },
    });
    const t = $('#drillTimer', view);
    const iv = setInterval(() => { if (!t.isConnected) return clearInterval(iv); const s = Math.floor((Date.now() - startedAt) / 1000); t.textContent = `total ${Math.floor(s / 60)}:${pad2(s % 60)}`; }, 500);
  };
  const finish = () => {
    const ms = Date.now() - startedAt;
    const acc = Math.round(100 * correct / set.length);
    view.innerHTML = `<div class="card" style="max-width:640px;margin:40px auto;text-align:center">
      <div style="font-size:48px">${acc === 100 ? '🏆' : acc >= 60 ? '🎯' : '💪'}</div>
      <h1>Drill complete</h1>
      <div class="stat-row" style="margin:18px 0">
        <div class="stat"><div class="v">${correct}/${set.length}</div><div class="l">Correct</div></div>
        <div class="stat"><div class="v">${acc}%</div><div class="l">Accuracy</div></div>
        <div class="stat"><div class="v">${fmtMs(ms)}</div><div class="l">Time</div></div>
        <div class="stat"><div class="v">+${xp}</div><div class="l">XP earned</div></div>
      </div>
      <p class="muted">${skipped ? `${skipped} skipped. ` : ''}${acc === 100 ? 'Flawless. Try a bigger set or higher levels.' : acc >= 60 ? 'Solid. Review the ones you missed in Learn mode, then run it again.' : 'Rough set. Open the relevant lessons in Learn mode, then come back.'}</p>
      <div class="row" style="justify-content:center"><a class="btn primary" href="#/drill">New drill</a><a class="btn" href="#/">Dashboard</a></div>
    </div>`;
    renderTopbar();
  };
  show();
}

async function viewPlayground(view) {
  if (!(await ensureEngine(view))) return;
  let key = LS.get('sq_pg_schema', 'cafe');
  let db = engine.freshDb(key);
  const draft = LS.get('sq_pg_draft', 'SELECT * FROM ' + SCHEMAS[key].tables[0].name + ' LIMIT 10;');
  view.innerHTML = `
    <div class="ws-head"><div><div class="crumb"><a href="#/">Learn</a> › Playground</div><h1>Playground</h1><p class="muted" style="margin:4px 0 0">Anything goes here: SELECT, CREATE TABLE, INSERT, UPDATE. Changes persist until you reset or switch database.</p></div>
      <div class="row"><select id="pgSchema">${Object.values(SCHEMAS).map((s) => `<option value="${s.key}" ${s.key === key ? 'selected' : ''}>${esc(s.name)}</option>`).join('')}</select><button class="btn sm" id="pgReset">Reset data</button></div></div>
    <div class="ws">
      <div class="stack"><section class="card" id="pgSchemaPanel">${schemaPanelHTML(key)}</section></div>
      <div class="stack"><section class="card">
        ${editorHTML(draft, '-- Any SQL. Ctrl+Enter runs all statements.')}
        <div class="toolbar"><button class="btn primary" id="pgRun">▶ Run <kbd>Ctrl</kbd>+<kbd>↵</kbd></button><span class="spacer"></span><span class="muted small">SQLite ${engine.ready() ? '' : ''}in your browser</span></div>
        <div class="results" id="pgResults"><div class="result-empty">Results appear here.</div></div>
      </section></div>
    </div>`;
  const results = $('#pgResults', view);
  const run = () => {
    const sql = ed.value;
    const res = engine.runMulti(db, sql);
    if (!res.ok) { results.innerHTML = `<div class="result-error">${esc(res.error)}</div>`; return; }
    if (!res.results.length) {
      results.innerHTML = `<div class="result-empty">Done in ${res.ms.toFixed(0)} ms. ${res.changes ? `${res.changes} row(s) changed.` : 'No rows returned.'}</div>`;
    } else {
      results.innerHTML = res.results.map((r) => gridHTML(r)).join('<div style="height:10px"></div>') + `<div class="result-meta">${res.results.length > 1 ? `${res.results.length} result sets · ` : `${res.results[0].values.length} rows · `}${res.ms.toFixed(0)} ms</div>`;
    }
    $('#pgSchemaPanel', view).innerHTML = schemaPanelHTML(key) + userTablesHTML();
    bindPreviews();
  };
  const userTablesHTML = () => {
    const r = engine.runSingle(key, "SELECT name FROM sqlite_master WHERE type IN ('table','view') AND name NOT LIKE 'sqlite_%'", db);
    const known = new Set(SCHEMAS[key].tables.map((t) => t.name));
    const extra = r.ok ? r.result.values.map((v) => v[0]).filter((n) => !known.has(n)) : [];
    return extra.length ? `<h4 style="margin:12px 0 6px">Your tables</h4>${extra.map((n) => `<details class="schema-tbl"><summary><span>${esc(n)}</span><button class="pv" data-preview="${esc(n)}">preview</button></summary></details>`).join('')}` : '';
  };
  const bindPreviews = () => $$('[data-preview]', view).forEach((b) => b.onclick = (e) => {
    e.preventDefault(); e.stopPropagation();
    const res = engine.runSingle(key, `SELECT * FROM "${b.dataset.preview.replace(/"/g, '""')}" LIMIT 8`, db);
    results.innerHTML = `<div class="result-meta" style="margin:0 0 6px">Preview: <code>${esc(b.dataset.preview)}</code></div>` + singleResultHTML(res);
  });
  const ed = bindEditor($('.editor', view), { onRun: run, onChange: (v) => LS.set('sq_pg_draft', v) });
  $('#pgRun', view).onclick = run;
  $('#pgReset', view).onclick = () => { db.close(); db = engine.freshDb(key); $('#pgSchemaPanel', view).innerHTML = schemaPanelHTML(key); bindPreviews(); results.innerHTML = '<div class="result-empty">Data reset to the original seed.</div>'; };
  $('#pgSchema', view).onchange = (e) => { key = e.target.value; LS.set('sq_pg_schema', key); db.close(); db = engine.freshDb(key); $('#pgSchemaPanel', view).innerHTML = schemaPanelHTML(key); bindPreviews(); results.innerHTML = `<div class="result-empty">Switched to ${esc(SCHEMAS[key].name)}.</div>`; };
  bindPreviews();
  activeCleanup = () => { try { db.close(); } catch { /* ignore */ } };
  ed.focus();
}

async function viewLeaderboard(view) {
  view.innerHTML = '<div class="loading">Loading leaderboard…</div>';
  try {
    const { leaderboard } = await api('/leaderboard');
    view.innerHTML = `
      <div class="ws-head"><div><div class="crumb"><a href="#/">Learn</a> › Leaderboard</div><h1>Leaderboard</h1><p class="muted" style="margin:4px 0 0">Top players by XP. ${state.guest ? '<a href="#/auth?tab=register">Create an account</a> to appear here.' : ''}</p></div></div>
      <section class="card" style="padding:0;overflow:hidden">
        <table class="lb"><thead><tr><th>#</th><th>Player</th><th>Rank</th><th>XP</th><th>Solved</th><th>Streak</th></tr></thead>
        <tbody>${leaderboard.length ? leaderboard.map((r) => `<tr class="${r.you ? 'you' : ''}"><td class="r">${r.rank}</td><td><b>${esc(r.username)}</b>${r.you ? ' <span class="tag">you</span>' : ''}</td><td>${esc(r.title)}</td><td>${r.xp}</td><td>${r.solved}/${CHALLENGES.length}</td><td>🔥 ${r.streak}</td></tr>`).join('') : '<tr><td colspan="6" class="muted" style="text-align:center;padding:30px">No players yet. Be the first.</td></tr>'}</tbody></table>
      </section>`;
  } catch (e) {
    view.innerHTML = `<div class="card"><h2>Leaderboard unavailable</h2><p class="muted">${esc(e.message)}</p></div>`;
  }
}

async function viewProfile(view) {
  const p = state.progress, sum = summarize(p), r = rankFor(p.xp);
  view.innerHTML = '<div class="loading">Loading…</div>';
  let history = [];
  try { history = await store.history(); } catch { /* show without history */ }
  const member = state.user.created_at ? `Member since ${fmtDate(state.user.created_at)}` : 'Guest (saved in this browser only)';
  view.innerHTML = `
    <div class="ws-head"><div><div class="crumb"><a href="#/">Learn</a> › Profile</div><h1>${esc(state.user.username)}</h1><p class="muted" style="margin:4px 0 0">${member} · ${esc(r.title)} · ${p.xp} XP</p></div>
      <div class="row">${state.guest ? '<a class="btn primary" href="#/auth?tab=register">Create account to save</a>' : ''}<button class="btn" id="logoutBtn">${state.guest ? 'Exit guest mode' : 'Log out'}</button></div></div>
    <div class="grid-2">
      <section class="card">
        <h3>Stats</h3>
        <div class="stat-row">
          <div class="stat"><div class="v">${sum.done}/${sum.total}</div><div class="l">Solved</div></div>
          <div class="stat"><div class="v">${p.counters.attempts}</div><div class="l">Attempts</div></div>
          <div class="stat"><div class="v">${p.counters.attempts ? Math.round(100 * p.counters.correct / p.counters.attempts) : 0}%</div><div class="l">Accuracy</div></div>
          <div class="stat"><div class="v">🔥 ${p.streak}</div><div class="l">Streak (best ${p.best_streak})</div></div>
          <div class="stat"><div class="v">${p.counters.hintless}</div><div class="l">Hint-free solves</div></div>
          <div class="stat"><div class="v">${p.counters.drill_correct}</div><div class="l">Drill solves</div></div>
        </div>
        <h3 style="margin-top:18px">Per level</h3>
        <div class="stack">${sum.perLevel.map((l) => `<div class="${levelClass(l.level)}"><div class="row spread small"><span><b>Level ${l.level}</b> ${esc(levelInfo(l.level).title)}</span><span class="muted">${l.done}/${l.total}</span></div><div class="progress"><i style="width:${Math.round(100 * l.done / l.total)}%;background:var(--lc)"></i></div></div>`).join('')}</div>
        <h3 style="margin-top:18px">Starting level</h3>
        <p class="muted small">Changes which level the dashboard recommends and which levels drills default to.</p>
        <div id="lvlPick">${levelChoiceHTML(state.user.start_level || 1)}</div>
      </section>
      <section class="card">
        <h3>Badges (${Object.keys(p.badges).length}/${BADGES.length})</h3>
        <div class="badges">${BADGES.map((b) => `<div class="badge ${p.badges[b.id] ? '' : 'locked'}" title="${p.badges[b.id] ? 'Earned ' + fmtDate(p.badges[b.id]) : 'Locked'}"><span class="ico">${b.icon}</span><div><b>${esc(b.title)}</b><span>${esc(b.desc)}</span></div></div>`).join('')}</div>
      </section>
    </div>
    <section class="card" style="margin-top:16px">
      <div class="card-head"><h3>Recent attempts</h3><span class="muted small">${history.length} shown</span></div>
      <div class="history">${history.length ? history.map((h) => { const ch = challengeById[h.challenge_id]; return `<div class="hist"><span class="${h.correct ? 'ok' : 'no'}">${h.correct ? '✓' : '✗'}</span><span><a href="#/challenge/${h.challenge_id}">${esc(ch?.title || h.challenge_id)}</a> <span class="muted">· L${ch?.level || '?'} · ${h.mode}${h.hints_used ? ` · ${h.hints_used} hint${h.hints_used > 1 ? 's' : ''}` : ''}${h.xp_gained ? ` · +${h.xp_gained} XP` : ''}</span></span><span class="muted">${fmtDate(h.created_at)}${h.time_ms ? ` · ${fmtMs(h.time_ms)}` : ''}</span>${h.query ? `<details><summary>query</summary><pre><code>${highlight(h.query)}</code></pre></details>` : ''}</div>`; }).join('') : '<p class="muted">No attempts yet.</p>'}</div>
    </section>`;
  $('#logoutBtn', view).onclick = async () => { await store.logout(); toast('Logged out.'); go('#/auth'); };
  $$('#lvlPick input', view).forEach((i) => i.onchange = async () => { await store.setStartLevel(Number(i.value)); toast('Starting level updated.', 'good'); });
}

// ---------------------------------------------------------------------------
// Boot
// ---------------------------------------------------------------------------
window.addEventListener('hashchange', route);
await store.load();
engine.init().catch((e) => console.error('sql.js init failed', e));
route();
