# SQLQuest

A gamified SQL learning app. Learners write real SQL against a practice database that runs
in their browser, get instant feedback, and earn XP, ranks, badges and streaks. Beginners
start with lessons; people who already know SQL can jump straight to window functions and
timed drills.

## What's inside

- **64 challenges across 5 levels** (Foundations, Aggregation, Joins & Subqueries, Advanced,
  Veteran), each with a short lesson, progressive hints and a reference solution.
- **Two practice databases**: a cafe chain (stores, staff, customers, menu, 90 orders with
  line items, ratings, newsletter sign-ups) and an HR company (departments, employees with
  managers, projects, assignments, attendance, salary history). Seed data is deterministic.
- **Answer checking by result set**: any query that returns the same rows passes, not just one
  "right" answer. Column names are ignored; column order is not; row order only when the task
  says so. Feedback tells the learner which column or count is off.
- **Difficulty choice**: pick "new to SQL", "know the basics" or "veteran" at sign-up (changeable
  on the profile page). All levels are open at all times.
- **Gamification**: XP per challenge (reduced by hints), six ranks, daily streak, 13 badges, a
  daily challenge with bonus XP, and a leaderboard.
- **Drill mode** for veterans: timed sets of random challenges from chosen levels, no lessons,
  no hints, re-solves still earn XP.
- **Playground**: free-form SQL (DDL and DML too) on either database.
- **Accounts with persistent history**: username/password login, every attempt stored with the
  query text, progress visible on the profile page. Guest mode keeps progress in the browser and
  can be imported into a new account.
- Light and dark themes, works on phones.

## Run it

Requires Node.js 22.13 or newer (uses the built-in `node:sqlite`).

```
npm install
npm start
```

Open http://localhost:3000. Accounts and progress are stored in `data/sqlquest.db`
(created on first run, ignored by git). Set `PORT` or `SQLQUEST_DATA_DIR` to change defaults.

Verify every challenge solution and the progress rules:

```
npm run verify            # one line per challenge
npm run verify -- --verbose   # also prints the first rows of each expected result
```

## How it works

```
public/
  index.html           shell
  css/style.css        theme (light/dark via CSS variables)
  js/app.js            hash-routed SPA: auth, dashboard, levels, challenge, drill, playground, profile, leaderboard
  js/engine.js         sql.js (SQLite in WebAssembly) wrapper; fresh DB per run
  js/checker.js        result-set comparison and read-only statement guard
  js/schemas.js        practice databases: DDL + deterministic seed generator
  js/content.js        levels, lessons, challenges (task, hints, solution)
  js/progress.js       XP / streak / badge rules (shared with the server)
  vendor/              sql-wasm.js + sql-wasm.wasm
server.js              Express + node:sqlite: auth, sessions, attempts, leaderboard
scripts/verify-content.mjs
```

Learner SQL never reaches the server. The browser loads the practice database, runs the
learner's query and the reference solution, and compares the two result sets. The server only
receives the outcome (correct or not, hints used, time, query text) and applies the same
`progress.js` rules the browser uses for guests, so XP and badges are computed in one place.

Passwords are hashed with scrypt; sessions are random tokens in an httpOnly cookie
(30 days). Auth endpoints are rate limited per IP.

## Adding content

Add a challenge object to `CHALLENGES` in `public/js/content.js` (id, level, schema, lesson,
title, task, columns, hints, solution, optional `ordered: true`). Add a lesson to `LESSONS` if
it is a new concept. Run `npm run verify`; it fails if a solution errors, returns no rows, or
the column count disagrees with the task.

To change the data, edit `public/js/schemas.js`. Seeds are generated from a fixed random seed,
so reorder nothing unless you want every learner's data to change.

## Deploying

It is a single Node process with a SQLite file. Any host that runs Node 22+ and keeps a
persistent disk works (Railway, Render, Fly.io, a VPS). Put it behind HTTPS; the session
cookie turns on `secure` automatically when the request arrives over TLS (`trust proxy` is on).

## Known limits (v1)

- SQLite dialect only. Lessons note where PostgreSQL or MySQL differ, but challenges run on SQLite.
- Challenges accept a single SELECT / WITH statement; the Playground accepts anything.
- No email or password reset; usernames are the only identity.
