// Result-set comparison. Pure module shared by the browser and the verifier.
// A result is { columns: string[], values: any[][] } as returned by sql.js exec().

function normCell(v) {
  if (v === null || v === undefined) return '∅';
  if (typeof v === 'number') {
    if (Number.isInteger(v)) return String(v);
    return String(Math.round(v * 1e6) / 1e6);
  }
  if (v instanceof Uint8Array) return 'blob:' + v.length;
  const s = String(v).trim();
  // Numeric strings (e.g. CAST results) compare like numbers.
  if (/^-?\d+(\.\d+)?$/.test(s)) return normCell(Number(s));
  return s;
}
const normRow = (row) => row.map(normCell).join('\u0001');

/**
 * Compare a learner's result against the expected one.
 * Column names are ignored; column order and values matter. Row order matters only when ordered=true.
 */
export function compareResults(actual, expected, { ordered = false } = {}) {
  if (!actual || !actual.columns) return { pass: false, reason: 'Your query did not return a result set.' };
  if (actual.values.length === 0 && expected.values.length > 0) return { pass: false, reason: `Your query returned 0 rows; expected ${expected.values.length}.` };
  if (actual.columns.length !== expected.columns.length) {
    return { pass: false, reason: `Expected ${expected.columns.length} column(s) but got ${actual.columns.length} (${actual.columns.join(', ')}).` };
  }
  if (actual.values.length !== expected.values.length) {
    return { pass: false, reason: `Expected ${expected.values.length} row(s) but got ${actual.values.length}.` };
  }
  let a = actual.values.map(normRow);
  let e = expected.values.map(normRow);
  if (!ordered) { a = [...a].sort(); e = [...e].sort(); }
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== e[i]) {
      if (ordered) {
        const unorderedOk = [...a].sort().join('\n') === [...e].sort().join('\n');
        if (unorderedOk) return { pass: false, reason: 'The rows are right but in the wrong order. Check your ORDER BY.' };
      }
      // Try to say which column differs most often.
      const colDiffs = new Array(actual.columns.length).fill(0);
      const ea = e.map(r => r.split('\u0001')), aa = a.map(r => r.split('\u0001'));
      for (let j = 0; j < aa.length; j++) for (let c = 0; c < colDiffs.length; c++) if (aa[j][c] !== ea[j][c]) colDiffs[c]++;
      const worst = colDiffs.indexOf(Math.max(...colDiffs));
      const hint = colDiffs[worst] > 0 ? ` Column ${worst + 1} (${actual.columns[worst]}) differs in ${colDiffs[worst]} row(s).` : '';
      return { pass: false, reason: `Row and column counts match but some values differ.${hint} Check column order, rounding and filters.` };
    }
  }
  return { pass: true };
}

/** Challenges accept a single read-only statement. */
export function classifyStatement(sql) {
  const stripped = sql.replace(/--[^\n]*/g, '').replace(/\/\*[\s\S]*?\*\//g, '').trim();
  if (!stripped) return { ok: false, reason: 'Write a query first.' };
  const first = stripped.split(/\s+/)[0].toUpperCase();
  if (first !== 'SELECT' && first !== 'WITH') return { ok: false, reason: `Challenges accept a SELECT (or WITH ... SELECT) statement; yours starts with ${first}. Use the Playground for anything else.` };
  return { ok: true };
}
