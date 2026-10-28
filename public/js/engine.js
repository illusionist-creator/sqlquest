// Browser-side SQL engine: SQLite compiled to WebAssembly (sql.js).
// Learner queries run in the browser against a fresh copy of the practice database,
// so nothing a learner writes can touch the server.
import { schemaSQL } from './schemas.js';

let SQL = null;
const seedBytes = {};
const expectedCache = {};

export async function init() {
  if (SQL) return SQL;
  if (typeof window.initSqlJs !== 'function') throw new Error('sql.js failed to load');
  SQL = await window.initSqlJs({ locateFile: (f) => '/vendor/' + f });
  return SQL;
}

export const ready = () => !!SQL;

function bytesFor(key) {
  if (!seedBytes[key]) {
    const db = new SQL.Database();
    db.run(schemaSQL(key));
    seedBytes[key] = db.export();
    db.close();
  }
  return seedBytes[key];
}

/** A fresh database loaded with the practice data. Caller must close() it. */
export function freshDb(key) {
  return new SQL.Database(bytesFor(key));
}

/** Run one statement, returning column names even when there are no rows. */
export function runSingle(key, sql, db = null) {
  const own = !db;
  if (own) db = freshDb(key);
  const t0 = performance.now();
  let stmt = null;
  try {
    stmt = db.prepare(sql);
    const columns = stmt.getColumnNames();
    const values = [];
    while (stmt.step()) values.push(stmt.get());
    return { ok: true, result: { columns, values }, ms: performance.now() - t0 };
  } catch (e) {
    return { ok: false, error: e.message, ms: performance.now() - t0 };
  } finally {
    if (stmt) stmt.free();
    if (own) db.close();
  }
}

/** Run any number of statements on an existing database (playground). */
export function runMulti(db, sql) {
  const t0 = performance.now();
  try {
    const results = db.exec(sql);
    return { ok: true, results, ms: performance.now() - t0, changes: db.getRowsModified() };
  } catch (e) {
    return { ok: false, error: e.message, ms: performance.now() - t0 };
  }
}

export function preview(key, table, n = 5) {
  return runSingle(key, `SELECT * FROM ${table} LIMIT ${n}`);
}

/** The reference result set for a challenge (cached). */
export function expected(challenge) {
  if (!expectedCache[challenge.id]) {
    const r = runSingle(challenge.schema, challenge.solution);
    if (!r.ok) throw new Error('Reference solution failed: ' + r.error);
    expectedCache[challenge.id] = r.result;
  }
  return expectedCache[challenge.id];
}
