// Curriculum for SQLQuest: levels, lessons and challenges.
// Pure data module shared by the browser app, the server (XP rules) and the verifier.
// Every challenge has a reference solution; the checker compares result sets, so any
// equivalent query passes. Column ORDER matters, column names do not.

export const LEVELS = [
  { n: 1, title: 'Foundations', blurb: 'SELECT, WHERE, ORDER BY, LIMIT, NULLs and expressions.', xp: 10, tag: 'Beginner' },
  { n: 2, title: 'Aggregation', blurb: 'COUNT, SUM, AVG, GROUP BY, HAVING and date buckets.', xp: 20, tag: 'Beginner+' },
  { n: 3, title: 'Joins & Subqueries', blurb: 'INNER, LEFT and self joins. IN, EXISTS, derived tables.', xp: 35, tag: 'Intermediate' },
  { n: 4, title: 'Advanced', blurb: 'CASE, CTEs, window functions, set operations, date math.', xp: 55, tag: 'Advanced' },
  { n: 5, title: 'Veteran', blurb: 'Real analytics: islands, medians, cohorts, recursion, frames.', xp: 85, tag: 'Expert' },
];

// Ranks unlocked by total XP.
export const RANKS = [
  { xp: 0, title: 'Novice' },
  { xp: 100, title: 'Apprentice' },
  { xp: 300, title: 'Analyst' },
  { xp: 700, title: 'Engineer' },
  { xp: 1400, title: 'Architect' },
  { xp: 2400, title: 'Grandmaster' },
];

const code = (s) => `<pre><code>${s.replace(/&/g, '&amp;').replace(/</g, '&lt;')}</code></pre>`;

export const LESSONS = {
  'select-from': { title: 'SELECT and FROM', body: `
<p>Every query starts with two questions: <em>which table</em> am I reading, and <em>which columns</em> do I want back? <code>FROM</code> answers the first, <code>SELECT</code> the second. The star <code>*</code> means "all columns".</p>
${code(`SELECT * FROM stores;`)}
<p>SQL keywords are case-insensitive, but writing them in UPPERCASE makes queries easier to scan. A statement ends with a semicolon.</p>` },

  'select-columns': { title: 'Choosing columns', body: `
<p>Instead of <code>*</code>, name the columns you need, separated by commas. The result shows them in the order you list them, so order matters when a task says "return a, b".</p>
${code(`SELECT item_name, price
FROM menu_items;`)}
<p>Fetching only what you need is faster and makes the result easier to read.</p>` },

  'where': { title: 'Filtering rows with WHERE', body: `
<p><code>WHERE</code> keeps only rows for which a condition is true. Compare with <code>=</code>, <code>&lt;&gt;</code> (not equal), <code>&lt;</code>, <code>&gt;</code>, <code>&lt;=</code>, <code>&gt;=</code>.</p>
${code(`SELECT full_name, city
FROM customers
WHERE city = 'Mumbai';`)}
<p>Text values go in single quotes and are compared exactly: <code>'mumbai'</code> is not <code>'Mumbai'</code>. Numbers are written bare: <code>price &gt; 100</code>.</p>` },

  'where-logic': { title: 'Combining conditions', body: `
<p>Join conditions with <code>AND</code> (both must hold), <code>OR</code> (either), and negate with <code>NOT</code>. <code>AND</code> binds tighter than <code>OR</code>, so use parentheses when mixing them.</p>
${code(`SELECT item_name
FROM menu_items
WHERE category = 'Beverage'
  AND (price < 50 OR is_veg = 0);`)}
<p>Boolean-like columns are often stored as integers: <code>is_veg = 1</code> means vegetarian.</p>` },

  'order-by': { title: 'Sorting with ORDER BY', body: `
<p>Rows come back in no guaranteed order unless you ask. <code>ORDER BY</code> sorts ascending by default; add <code>DESC</code> for descending. You can sort by several columns, each with its own direction.</p>
${code(`SELECT full_name, joined_on
FROM customers
ORDER BY joined_on DESC, full_name;`)}
<p>Dates stored as <code>YYYY-MM-DD</code> text sort correctly because the format is big-endian.</p>` },

  'limit': { title: 'LIMIT: top-N queries', body: `
<p><code>LIMIT n</code> returns only the first n rows. Combined with <code>ORDER BY</code> it answers "top 3", "latest 10", "cheapest 5".</p>
${code(`SELECT item_name, price
FROM menu_items
ORDER BY price DESC
LIMIT 3;`)}
<p>Without <code>ORDER BY</code>, LIMIT gives you an arbitrary handful, which is rarely what you want.</p>` },

  'distinct': { title: 'DISTINCT: removing duplicates', body: `
<p><code>SELECT DISTINCT</code> collapses identical rows into one. With several columns it de-duplicates on the <em>combination</em> of values.</p>
${code(`SELECT DISTINCT city
FROM customers;`)}` },

  'between-in': { title: 'BETWEEN and IN', body: `
<p><code>BETWEEN a AND b</code> is an inclusive range test. <code>IN (...)</code> matches any value in a list; it replaces a chain of <code>OR</code>s.</p>
${code(`SELECT full_name
FROM staff
WHERE hired_on BETWEEN '2020-01-01' AND '2020-12-31'
  AND role IN ('Barista', 'Store Manager');`)}
<p>Both work with text dates in <code>YYYY-MM-DD</code> form.</p>` },

  'like': { title: 'Pattern matching with LIKE', body: `
<p><code>LIKE</code> compares against a pattern: <code>%</code> matches any run of characters (including none), <code>_</code> matches exactly one.</p>
${code(`SELECT full_name, email
FROM customers
WHERE email LIKE '%@outlook.com';   -- ends with
-- 'A%'   starts with A
-- '%ai%' contains "ai"`)}
<p>In SQLite, LIKE is case-insensitive for ASCII letters.</p>` },

  'null': { title: 'NULL: the missing value', body: `
<p><code>NULL</code> means "unknown / not provided". It is not zero and not an empty string, and <code>= NULL</code> never matches. Test for it with <code>IS NULL</code> or <code>IS NOT NULL</code>.</p>
${code(`SELECT full_name
FROM customers
WHERE email IS NULL;`)}
<p>Most comparisons and arithmetic involving NULL produce NULL, which is why rows with a NULL silently drop out of <code>WHERE</code> filters.</p>` },

  'expressions': { title: 'Expressions and aliases', body: `
<p>Columns in <code>SELECT</code> can be calculations. Give the result a readable name with <code>AS</code>. <code>ROUND(x, 2)</code> rounds to two decimals.</p>
${code(`SELECT item_name,
       price * 2            AS double_price,
       ROUND(price / 3.0, 2) AS third
FROM menu_items;`)}
<p>Integer division truncates in SQL (<code>7 / 2 = 3</code>). Multiply or divide by a decimal like <code>1.0</code> to get fractional results.</p>` },

  'count': { title: 'COUNT', body: `
<p>Aggregate functions fold many rows into one value. <code>COUNT(*)</code> counts rows; <code>COUNT(column)</code> counts only rows where that column is <strong>not NULL</strong>.</p>
${code(`SELECT COUNT(*)       AS rows_total,
       COUNT(comment) AS with_comment
FROM ratings;`)}` },

  'aggregates': { title: 'SUM, AVG, MIN, MAX', body: `
<p>The other core aggregates: <code>SUM</code> adds, <code>AVG</code> averages, <code>MIN</code>/<code>MAX</code> find extremes. They ignore NULLs. Without <code>GROUP BY</code> they return exactly one row.</p>
${code(`SELECT MIN(price), MAX(price), ROUND(AVG(price), 2)
FROM menu_items;`)}` },

  'group-by': { title: 'GROUP BY', body: `
<p><code>GROUP BY</code> splits rows into groups that share a value, then aggregates run <em>per group</em>. Every column in SELECT must be either grouped or aggregated.</p>
${code(`SELECT category, COUNT(*) AS items, AVG(price) AS avg_price
FROM menu_items
GROUP BY category;`)}
<p>Think of it as: one output row per distinct category.</p>` },

  'group-by-multi': { title: 'Grouping by several columns', body: `
<p>List more than one column in <code>GROUP BY</code> to get one row per <em>combination</em>.</p>
${code(`SELECT store_id, channel, COUNT(*) AS orders
FROM orders
GROUP BY store_id, channel;`)}` },

  'having': { title: 'HAVING: filtering groups', body: `
<p><code>WHERE</code> filters rows <em>before</em> grouping; <code>HAVING</code> filters groups <em>after</em> aggregation, so it can reference aggregates.</p>
${code(`SELECT customer_id, COUNT(*) AS order_count
FROM orders
GROUP BY customer_id
HAVING COUNT(*) > 5;`)}
<p>Order of execution: FROM, WHERE, GROUP BY, HAVING, SELECT, ORDER BY, LIMIT.</p>` },

  'count-distinct': { title: 'COUNT(DISTINCT ...)', body: `
<p>To count unique values rather than rows, use <code>COUNT(DISTINCT col)</code>.</p>
${code(`SELECT COUNT(DISTINCT customer_id) AS buyers
FROM orders;`)}` },

  'aggregate-expressions': { title: 'Aggregating expressions', body: `
<p>Aggregates accept any expression, not just a column. Revenue is typically <code>SUM(quantity * unit_price)</code>.</p>
${code(`SELECT SUM(quantity * unit_price) AS revenue
FROM order_items;`)}` },

  'dates': { title: 'Working with dates in SQLite', body: `
<p>SQLite stores dates as text. <code>strftime(format, value)</code> extracts parts: <code>'%Y'</code> year, <code>'%m'</code> month, <code>'%d'</code> day, <code>'%H'</code> hour. <code>date(value)</code> trims a timestamp to its day.</p>
${code(`SELECT strftime('%Y-%m', ordered_at) AS month, COUNT(*)
FROM orders
GROUP BY month
ORDER BY month;`)}
<p>Other engines use <code>DATE_TRUNC</code>, <code>EXTRACT</code> or <code>FORMAT</code>, but the idea is identical: bucket by a derived value, then group by it.</p>` },

  'join': { title: 'INNER JOIN', body: `
<p>A join combines rows from two tables where a condition holds, usually a key match. Table aliases (<code>orders o</code>) keep it short. Qualify columns (<code>o.order_id</code>) when names could clash.</p>
${code(`SELECT o.order_id, c.full_name
FROM orders o
JOIN customers c ON c.customer_id = o.customer_id;`)}
<p><code>JOIN</code> alone means <code>INNER JOIN</code>: rows with no match on either side are dropped.</p>` },

  'multi-join': { title: 'Joining several tables', body: `
<p>Chain joins to walk across relationships: orders know the store, order_items know the order. Aggregate at the end.</p>
${code(`SELECT s.store_name, SUM(oi.quantity * oi.unit_price) AS revenue
FROM orders o
JOIN order_items oi ON oi.order_id = o.order_id
JOIN stores s       ON s.store_id  = o.store_id
GROUP BY s.store_name;`)}` },

  'left-join': { title: 'LEFT JOIN and finding what is missing', body: `
<p><code>LEFT JOIN</code> keeps every row from the left table even without a match; the right side's columns become NULL. Filtering on <code>right.key IS NULL</code> finds left rows with <em>no</em> match, the classic "never ordered" question.</p>
${code(`SELECT m.item_name
FROM menu_items m
LEFT JOIN order_items oi ON oi.item_id = m.item_id
WHERE oi.order_id IS NULL;`)}
<p>When counting after a LEFT JOIN use <code>COUNT(right.column)</code>, not <code>COUNT(*)</code>, so unmatched rows count as 0.</p>` },

  'self-join': { title: 'Self joins', body: `
<p>A table can be joined to itself when rows refer to other rows, such as employees and their managers. Use two different aliases.</p>
${code(`SELECT e.full_name AS employee, m.full_name AS manager
FROM staff e
JOIN staff m ON m.staff_id = e.manager_id;`)}` },

  'subquery-scalar': { title: 'Scalar subqueries', body: `
<p>A query in parentheses that returns a single value can be used wherever a value can.</p>
${code(`SELECT item_name, price
FROM menu_items
WHERE price > (SELECT AVG(price) FROM menu_items);`)}` },

  'subquery-in': { title: 'Subqueries with IN', body: `
<p>A subquery returning one column can feed <code>IN</code>, letting you filter by membership in another table's results.</p>
${code(`SELECT full_name
FROM customers
WHERE customer_id IN (SELECT customer_id FROM orders WHERE channel = 'app');`)}` },

  'exists': { title: 'EXISTS and NOT EXISTS', body: `
<p><code>EXISTS</code> is true if the subquery returns any row. The subquery is <em>correlated</em>: it refers to the outer row. <code>NOT EXISTS</code> is the safest way to express "has none", because it behaves correctly even when NULLs are involved.</p>
${code(`SELECT c.full_name
FROM customers c
WHERE NOT EXISTS (
  SELECT 1 FROM orders o WHERE o.customer_id = c.customer_id
);`)}` },

  'derived-table': { title: 'Derived tables (subqueries in FROM)', body: `
<p>A subquery in <code>FROM</code> acts as a temporary table. Use it to aggregate in two stages, for example per-order totals and then their average.</p>
${code(`SELECT ROUND(AVG(order_total), 2) AS avg_order_value
FROM (
  SELECT order_id, SUM(quantity * unit_price) AS order_total
  FROM order_items
  GROUP BY order_id
);`)}` },

  'case': { title: 'CASE expressions', body: `
<p><code>CASE</code> is SQL's if/else. Conditions are checked top to bottom; the first match wins; <code>ELSE</code> covers the rest.</p>
${code(`SELECT item_name,
       CASE WHEN price < 60  THEN 'budget'
            WHEN price < 150 THEN 'standard'
            ELSE 'premium'
       END AS tier
FROM menu_items;`)}` },

  'conditional-agg': { title: 'Conditional aggregation (pivoting)', body: `
<p>Put a <code>CASE</code> inside an aggregate to count or sum only matching rows. This turns category values into columns, a manual pivot.</p>
${code(`SELECT store_id,
       SUM(CASE WHEN channel = 'app' THEN 1 ELSE 0 END) AS app_orders,
       SUM(CASE WHEN channel = 'counter' THEN 1 ELSE 0 END) AS counter_orders
FROM orders
GROUP BY store_id;`)}` },

  'cte': { title: 'Common Table Expressions (WITH)', body: `
<p>A CTE names a subquery up front so the main query reads top-down. Several CTEs can be chained with commas, each able to use the previous ones.</p>
${code(`WITH totals AS (
  SELECT order_id, SUM(quantity * unit_price) AS total
  FROM order_items
  GROUP BY order_id
)
SELECT order_id, total
FROM totals
WHERE total > 500;`)}` },

  'window-ranking': { title: 'Window functions: ROW_NUMBER, RANK, DENSE_RANK', body: `
<p>Window functions compute a value for each row using a "window" of related rows, without collapsing them like GROUP BY. <code>OVER (PARTITION BY ... ORDER BY ...)</code> defines the window.</p>
${code(`SELECT full_name, dept_id, salary,
       ROW_NUMBER() OVER (PARTITION BY dept_id ORDER BY salary DESC) AS rn,
       RANK()       OVER (ORDER BY salary DESC) AS rnk,
       DENSE_RANK() OVER (ORDER BY salary DESC) AS drnk
FROM employees;`)}
<p><code>ROW_NUMBER</code> is always unique (ties broken arbitrarily unless you add a tiebreaker). <code>RANK</code> leaves gaps after ties (1, 2, 2, 4); <code>DENSE_RANK</code> does not (1, 2, 2, 3).</p>` },

  'window-aggregate': { title: 'Aggregates as window functions', body: `
<p>Any aggregate can run over a window: <code>AVG(salary) OVER (PARTITION BY dept_id)</code> gives each row its department's average while keeping every row.</p>
${code(`SELECT full_name, salary,
       AVG(salary) OVER (PARTITION BY dept_id) AS dept_avg,
       salary - AVG(salary) OVER (PARTITION BY dept_id) AS diff
FROM employees;`)}` },

  'running-total': { title: 'Running totals', body: `
<p>Adding <code>ORDER BY</code> inside <code>OVER</code> makes an aggregate cumulative: each row sums everything up to itself.</p>
${code(`SELECT month, revenue,
       SUM(revenue) OVER (ORDER BY month) AS cumulative
FROM monthly;`)}` },

  'lag-lead': { title: 'LAG and LEAD', body: `
<p><code>LAG(col)</code> fetches the previous row's value within the window; <code>LEAD(col)</code> the next. Ideal for comparisons with the prior period or computing gaps.</p>
${code(`SELECT emp_id, changed_on, new_salary,
       LAG(new_salary) OVER (PARTITION BY emp_id ORDER BY changed_on) AS prev_salary
FROM salary_history;`)}
<p>The first row of each partition gets NULL (or a default you pass as the second argument).</p>` },

  'union': { title: 'UNION and UNION ALL', body: `
<p><code>UNION</code> stacks results of two queries with the same column count and removes duplicates; <code>UNION ALL</code> keeps them (and is faster).</p>
${code(`SELECT city FROM stores
UNION
SELECT city FROM customers;`)}` },

  'except': { title: 'EXCEPT and INTERSECT', body: `
<p><code>EXCEPT</code> returns rows in the first query that are not in the second. <code>INTERSECT</code> returns rows in both. Both de-duplicate.</p>
${code(`SELECT city FROM customers
EXCEPT
SELECT city FROM stores;`)}` },

  'top-n': { title: 'Top-N per group', body: `
<p>"The best X in each group" is the signature window-function problem: number rows within each group, then keep rank 1 (or the top N).</p>
${code(`WITH ranked AS (
  SELECT category, item_name, price,
         ROW_NUMBER() OVER (PARTITION BY category ORDER BY price DESC) AS rn
  FROM menu_items
)
SELECT category, item_name, price
FROM ranked
WHERE rn = 1;`)}
<p>Add a tiebreaker to ORDER BY when values can tie, so results are deterministic.</p>` },

  'date-arithmetic': { title: 'Date arithmetic', body: `
<p><code>julianday(d)</code> converts a date to a day number, so subtracting two gives days between. <code>date(d, '+7 days')</code> and <code>date(d, '-1 month')</code> shift dates. Use <code>CAST(x AS INTEGER)</code> for whole days.</p>
${code(`SELECT CAST(julianday('2024-03-01') - julianday('2024-01-01') AS INTEGER) AS days;  -- 60`)}` },

  'gaps-islands': { title: 'Gaps and islands', body: `
<p>To find runs of consecutive dates: number the rows per group with <code>ROW_NUMBER</code>, then subtract that number of days from each date. Rows in the same run land on the same anchor date, so you can GROUP BY it.</p>
${code(`WITH x AS (
  SELECT emp_id, work_date,
         date(work_date, '-' || ROW_NUMBER() OVER (PARTITION BY emp_id ORDER BY work_date) || ' days') AS grp
  FROM attendance
)
SELECT emp_id, MIN(work_date) AS start, MAX(work_date) AS finish, COUNT(*) AS days
FROM x
GROUP BY emp_id, grp;`)}` },

  'median': { title: 'Computing a median', body: `
<p>SQLite has no MEDIAN. Number the rows in order, count them, and average the middle one (odd count) or two (even count). With n rows, the middle positions are <code>(n+1)/2</code> and <code>(n+2)/2</code> using integer division.</p>
${code(`WITH r AS (
  SELECT dept_id, salary,
         ROW_NUMBER() OVER (PARTITION BY dept_id ORDER BY salary) AS rn,
         COUNT(*)     OVER (PARTITION BY dept_id) AS cnt
  FROM employees
)
SELECT dept_id, AVG(salary) AS median_salary
FROM r
WHERE rn IN ((cnt + 1) / 2, (cnt + 2) / 2)
GROUP BY dept_id;`)}` },

  'recursive-cte': { title: 'Recursive CTEs', body: `
<p>A recursive CTE has an anchor query and a recursive part joined to the CTE itself, repeated until no new rows appear. It walks trees such as org charts.</p>
${code(`WITH RECURSIVE tree(emp_id, depth) AS (
  SELECT emp_id, 0 FROM employees WHERE manager_id IS NULL
  UNION ALL
  SELECT e.emp_id, t.depth + 1
  FROM employees e JOIN tree t ON e.manager_id = t.emp_id
)
SELECT * FROM tree;`)}` },

  'dedupe': { title: 'De-duplicating with ROW_NUMBER', body: `
<p>To keep one row per key (the latest, the cheapest...), number rows within the key ordered by your preference and keep <code>rn = 1</code>.</p>
${code(`WITH r AS (
  SELECT *, ROW_NUMBER() OVER (PARTITION BY email ORDER BY signed_up_at DESC) AS rn
  FROM newsletter_signups
)
SELECT email, source, signed_up_at FROM r WHERE rn = 1;`)}` },

  'retention': { title: 'Retention and cohorts', body: `
<p>Retention asks: of the people active in period A, what share were also active in period B? Build the two sets with DISTINCT, then count the overlap against the base. Half-open date ranges (<code>&gt;= start AND &lt; next_start</code>) avoid off-by-one errors with timestamps.</p>
${code(`WITH jan AS (SELECT DISTINCT customer_id FROM orders WHERE ordered_at >= '2024-01-01' AND ordered_at < '2024-02-01'),
     feb AS (SELECT DISTINCT customer_id FROM orders WHERE ordered_at >= '2024-02-01' AND ordered_at < '2024-03-01')
SELECT 100.0 * (SELECT COUNT(*) FROM jan WHERE customer_id IN (SELECT customer_id FROM feb))
            / (SELECT COUNT(*) FROM jan) AS retention_pct;`)}` },

  'pct-of-total': { title: 'Percent of total', body: `
<p>An empty <code>OVER ()</code> makes the window the whole result, so <code>SUM(x) OVER ()</code> is the grand total on every row, which gives shares without a second query.</p>
${code(`SELECT category, revenue,
       ROUND(100.0 * revenue / SUM(revenue) OVER (), 1) AS pct
FROM category_revenue;`)}` },

  'window-frames': { title: 'Window frames (moving averages)', body: `
<p>A frame clause limits a window to nearby rows. <code>ROWS BETWEEN 2 PRECEDING AND CURRENT ROW</code> covers the current row and the two before it: a 3-row moving average.</p>
${code(`SELECT order_id, total,
       AVG(total) OVER (ORDER BY order_id ROWS BETWEEN 2 PRECEDING AND CURRENT ROW) AS ma3
FROM order_totals;`)}
<p>Default frame with ORDER BY is <code>RANGE BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW</code>, which is what makes running totals work.</p>` },

  'nth-per-group': { title: 'The N-th value per group', body: `
<p>"Second highest" is a ranking problem. <code>DENSE_RANK</code> ensures that tied salaries share a rank, so rank 2 is the second <em>distinct</em> value.</p>
${code(`WITH r AS (
  SELECT dept_id, salary, DENSE_RANK() OVER (PARTITION BY dept_id ORDER BY salary DESC) AS rk
  FROM employees
)
SELECT DISTINCT dept_id, salary FROM r WHERE rk = 2;`)}` },
};

// ---------------------------------------------------------------------------
// Challenges. `ordered: true` means row order is part of the answer.
// ---------------------------------------------------------------------------
export const CHALLENGES = [
  // ---------------- LEVEL 1: Foundations (cafe) ----------------
  { id: 'l1c01', level: 1, schema: 'cafe', lesson: 'select-from', title: 'Hello, stores',
    task: 'Show **every column** of every row in the `stores` table.',
    columns: ['*'],
    hints: ['The star `*` means all columns.', 'Pattern: `SELECT * FROM table_name;`'],
    solution: 'SELECT * FROM stores;' },

  { id: 'l1c02', level: 1, schema: 'cafe', lesson: 'select-columns', title: 'Just the essentials',
    task: 'List the name and price of every menu item.',
    columns: ['item_name', 'price'],
    hints: ['Name the columns after SELECT, separated by a comma.', 'Columns live in `menu_items`.'],
    solution: 'SELECT item_name, price FROM menu_items;' },

  { id: 'l1c03', level: 1, schema: 'cafe', lesson: 'where', title: 'Premium picks',
    task: 'Menu items that cost **more than 100** rupees.',
    columns: ['item_name', 'price'],
    hints: ['Add a `WHERE` clause after FROM.', '`WHERE price > 100`'],
    solution: 'SELECT item_name, price FROM menu_items WHERE price > 100;' },

  { id: 'l1c04', level: 1, schema: 'cafe', lesson: 'where-logic', title: 'Veg snacks only',
    task: 'Names of **vegetarian** items in the `Snack` category.',
    columns: ['item_name'],
    hints: ['Two conditions joined with AND.', 'Text needs quotes: `category = \'Snack\'`; vegetarian is `is_veg = 1`.'],
    solution: "SELECT item_name FROM menu_items WHERE category = 'Snack' AND is_veg = 1;" },

  { id: 'l1c05', level: 1, schema: 'cafe', lesson: 'order-by', title: 'Newest members first', ordered: true,
    task: 'Every customer with their join date, **newest joiner first**.',
    columns: ['full_name', 'joined_on'],
    hints: ['Use ORDER BY on the date column.', 'Newest first means descending: `DESC`.'],
    solution: 'SELECT full_name, joined_on FROM customers ORDER BY joined_on DESC;' },

  { id: 'l1c06', level: 1, schema: 'cafe', lesson: 'limit', title: 'Top three', ordered: true,
    task: 'The **three most expensive** menu items, most expensive first.',
    columns: ['item_name', 'price'],
    hints: ['Sort by price descending first.', 'Then `LIMIT 3`.'],
    solution: 'SELECT item_name, price FROM menu_items ORDER BY price DESC LIMIT 3;' },

  { id: 'l1c07', level: 1, schema: 'cafe', lesson: 'distinct', title: 'Where do customers live?',
    task: 'A list of the **distinct** cities our customers live in. Each city once.',
    columns: ['city'],
    hints: ['Add DISTINCT right after SELECT.'],
    solution: 'SELECT DISTINCT city FROM customers;' },

  { id: 'l1c08', level: 1, schema: 'cafe', lesson: 'between-in', title: 'Class of 2021',
    task: 'Staff members hired at any point **during 2021**.',
    columns: ['full_name', 'hired_on'],
    hints: ['Dates are text like `2021-07-15`, so a range test works.', "`hired_on BETWEEN '2021-01-01' AND '2021-12-31'`"],
    solution: "SELECT full_name, hired_on FROM staff WHERE hired_on BETWEEN '2021-01-01' AND '2021-12-31';" },

  { id: 'l1c09', level: 1, schema: 'cafe', lesson: 'like', title: 'Gmail users',
    task: 'Customers whose email **ends with** `@gmail.com`.',
    columns: ['full_name', 'email'],
    hints: ['Use LIKE with a wildcard at the start.', "`email LIKE '%@gmail.com'`"],
    solution: "SELECT full_name, email FROM customers WHERE email LIKE '%@gmail.com';" },

  { id: 'l1c10', level: 1, schema: 'cafe', lesson: 'null', title: 'Missing emails',
    task: 'Customers who have **no email** on file.',
    columns: ['full_name'],
    hints: ['`= NULL` never matches anything.', 'Use `IS NULL`.'],
    solution: 'SELECT full_name FROM customers WHERE email IS NULL;' },

  { id: 'l1c11', level: 1, schema: 'cafe', lesson: 'expressions', title: 'Price with GST',
    task: 'Each menu item with its price **including 5% GST**, rounded to 2 decimals. Name the computed column `price_with_tax`.',
    columns: ['item_name', 'price_with_tax'],
    hints: ['Multiply the price by 1.05.', '`ROUND(price * 1.05, 2) AS price_with_tax`'],
    solution: 'SELECT item_name, ROUND(price * 1.05, 2) AS price_with_tax FROM menu_items;' },

  { id: 'l1c12', level: 1, schema: 'cafe', lesson: 'between-in', title: 'Mumbai VIPs',
    task: 'Customers living in **Mumbai** whose loyalty tier is **Gold or Silver**.',
    columns: ['full_name', 'loyalty_tier'],
    hints: ['Two conditions: city and tier.', "`loyalty_tier IN ('Gold', 'Silver')` is neater than two ORs."],
    solution: "SELECT full_name, loyalty_tier FROM customers WHERE city = 'Mumbai' AND loyalty_tier IN ('Gold', 'Silver');" },

  // ---------------- LEVEL 2: Aggregation ----------------
  { id: 'l2c01', level: 2, schema: 'cafe', lesson: 'count', title: 'Head count',
    task: 'How many customers do we have? Return a single value named `total_customers`.',
    columns: ['total_customers'],
    hints: ['`COUNT(*)` counts rows.'],
    solution: 'SELECT COUNT(*) AS total_customers FROM customers;' },

  { id: 'l2c02', level: 2, schema: 'cafe', lesson: 'aggregates', title: 'Average price',
    task: 'The **average** menu price, rounded to 2 decimals.',
    columns: ['avg_price'],
    hints: ['`AVG(price)` then wrap in ROUND.'],
    solution: 'SELECT ROUND(AVG(price), 2) AS avg_price FROM menu_items;' },

  { id: 'l2c03', level: 2, schema: 'cafe', lesson: 'aggregates', title: 'Price range',
    task: 'The **cheapest** and the **most expensive** menu price, as two columns in one row.',
    columns: ['min_price', 'max_price'],
    hints: ['MIN and MAX in the same SELECT.'],
    solution: 'SELECT MIN(price) AS min_price, MAX(price) AS max_price FROM menu_items;' },

  { id: 'l2c04', level: 2, schema: 'cafe', lesson: 'group-by', title: 'Items per category',
    task: 'How many menu items are in **each category**?',
    columns: ['category', 'item_count'],
    hints: ['GROUP BY category.', '`SELECT category, COUNT(*) ... GROUP BY category`'],
    solution: 'SELECT category, COUNT(*) AS item_count FROM menu_items GROUP BY category;' },

  { id: 'l2c05', level: 2, schema: 'cafe', lesson: 'group-by', title: 'Units sold',
    task: 'Total **quantity sold** of each item, using `order_items` only.',
    columns: ['item_id', 'total_qty'],
    hints: ['Sum the quantity column.', 'Group by item_id.'],
    solution: 'SELECT item_id, SUM(quantity) AS total_qty FROM order_items GROUP BY item_id;' },

  { id: 'l2c06', level: 2, schema: 'cafe', lesson: 'having', title: 'Regulars',
    task: 'Customers (by id) who have placed **more than 5 orders**, with their order count.',
    columns: ['customer_id', 'order_count'],
    hints: ['Group orders by customer_id and count.', 'Filter groups with `HAVING COUNT(*) > 5`, not WHERE.'],
    solution: 'SELECT customer_id, COUNT(*) AS order_count FROM orders GROUP BY customer_id HAVING COUNT(*) > 5;' },

  { id: 'l2c07', level: 2, schema: 'cafe', lesson: 'group-by-multi', title: 'Channel mix',
    task: 'Number of orders for **each store and channel** combination.',
    columns: ['store_id', 'channel', 'order_count'],
    hints: ['Group by both columns.'],
    solution: 'SELECT store_id, channel, COUNT(*) AS order_count FROM orders GROUP BY store_id, channel;' },

  { id: 'l2c08', level: 2, schema: 'cafe', lesson: 'count-distinct', title: 'Unique buyers',
    task: 'How many **distinct customers** have placed at least one order?',
    columns: ['buyers'],
    hints: ['`COUNT(DISTINCT customer_id)` on the orders table.'],
    solution: 'SELECT COUNT(DISTINCT customer_id) AS buyers FROM orders;' },

  { id: 'l2c09', level: 2, schema: 'cafe', lesson: 'aggregate-expressions', title: 'Total revenue',
    task: 'Total revenue across all order lines. A line is worth `quantity * unit_price`.',
    columns: ['revenue'],
    hints: ['Put the multiplication inside SUM.'],
    solution: 'SELECT SUM(quantity * unit_price) AS revenue FROM order_items;' },

  { id: 'l2c10', level: 2, schema: 'cafe', lesson: 'dates', title: 'Monthly orders', ordered: true,
    task: 'Orders per month. Show the month as `YYYY-MM`, earliest month first.',
    columns: ['month', 'order_count'],
    hints: ["`strftime('%Y-%m', ordered_at)` gives the month bucket.", 'Group and order by that expression (or its alias).'],
    solution: "SELECT strftime('%Y-%m', ordered_at) AS month, COUNT(*) AS order_count FROM orders GROUP BY month ORDER BY month;" },

  { id: 'l2c11', level: 2, schema: 'hr', lesson: 'having', title: 'Well-paid departments', ordered: true,
    task: 'Average salary per department (ROUND to 2) for employees **who have a department**. Keep only departments averaging **above 80000**, highest average first.',
    columns: ['dept_id', 'avg_salary'],
    hints: ['Exclude `dept_id IS NULL` in WHERE.', 'Filter the averages with HAVING, then ORDER BY the average DESC.'],
    solution: 'SELECT dept_id, ROUND(AVG(salary), 2) AS avg_salary FROM employees WHERE dept_id IS NOT NULL GROUP BY dept_id HAVING AVG(salary) > 80000 ORDER BY avg_salary DESC;' },

  { id: 'l2c12', level: 2, schema: 'cafe', lesson: 'count', title: 'Star ratings',
    task: 'For each star value that appears in `ratings`: how many ratings it has, and how many of those **have a comment**.',
    columns: ['stars', 'rating_count', 'with_comment'],
    hints: ['`COUNT(comment)` ignores NULL comments.', 'Group by stars.'],
    solution: 'SELECT stars, COUNT(*) AS rating_count, COUNT(comment) AS with_comment FROM ratings GROUP BY stars;' },

  // ---------------- LEVEL 3: Joins & Subqueries ----------------
  { id: 'l3c01', level: 3, schema: 'cafe', lesson: 'join', title: 'Who ordered?',
    task: 'Every order id together with the **customer\'s name**.',
    columns: ['order_id', 'full_name'],
    hints: ['Join orders to customers on customer_id.', '`FROM orders o JOIN customers c ON c.customer_id = o.customer_id`'],
    solution: 'SELECT o.order_id, c.full_name FROM orders o JOIN customers c ON c.customer_id = o.customer_id;' },

  { id: 'l3c02', level: 3, schema: 'cafe', lesson: 'join', title: 'Inside order 13',
    task: 'The item names and quantities in **order 13**.',
    columns: ['item_name', 'quantity'],
    hints: ['order_items has item_id; menu_items has the name.', 'Filter `WHERE order_id = 13` after joining.'],
    solution: 'SELECT m.item_name, oi.quantity FROM order_items oi JOIN menu_items m ON m.item_id = oi.item_id WHERE oi.order_id = 13;' },

  { id: 'l3c03', level: 3, schema: 'cafe', lesson: 'multi-join', title: 'Revenue by store',
    task: 'Total revenue (`quantity * unit_price`) of **each store**, by store name.',
    columns: ['store_name', 'revenue'],
    hints: ['Three tables: orders, order_items, stores.', 'Group by store_name after joining.'],
    solution: 'SELECT s.store_name, SUM(oi.quantity * oi.unit_price) AS revenue FROM orders o JOIN order_items oi ON oi.order_id = o.order_id JOIN stores s ON s.store_id = o.store_id GROUP BY s.store_name;' },

  { id: 'l3c04', level: 3, schema: 'cafe', lesson: 'left-join', title: 'Never ordered',
    task: 'Menu items that have **never** appeared in any order.',
    columns: ['item_name'],
    hints: ['LEFT JOIN menu_items to order_items.', 'Keep rows where the order side `IS NULL`.'],
    solution: 'SELECT m.item_name FROM menu_items m LEFT JOIN order_items oi ON oi.item_id = m.item_id WHERE oi.order_id IS NULL;' },

  { id: 'l3c05', level: 3, schema: 'cafe', lesson: 'left-join', title: 'Everyone counts',
    task: 'Each customer with their **number of orders**, including customers with zero orders.',
    columns: ['full_name', 'order_count'],
    hints: ['LEFT JOIN from customers to orders.', 'Use `COUNT(o.order_id)` so unmatched customers count as 0.'],
    solution: 'SELECT c.full_name, COUNT(o.order_id) AS order_count FROM customers c LEFT JOIN orders o ON o.customer_id = c.customer_id GROUP BY c.customer_id, c.full_name;' },

  { id: 'l3c06', level: 3, schema: 'cafe', lesson: 'self-join', title: 'Chain of command',
    task: 'Each staff member next to their **manager\'s name**. Leave out anyone who has no manager.',
    columns: ['employee', 'manager'],
    hints: ['Join `staff` to itself with two aliases.', '`JOIN staff m ON m.staff_id = e.manager_id`'],
    solution: 'SELECT e.full_name AS employee, m.full_name AS manager FROM staff e JOIN staff m ON m.staff_id = e.manager_id;' },

  { id: 'l3c07', level: 3, schema: 'cafe', lesson: 'subquery-scalar', title: 'Above average',
    task: 'Menu items priced **above the average** menu price.',
    columns: ['item_name', 'price'],
    hints: ['Compute the average in a subquery.', '`WHERE price > (SELECT AVG(price) FROM menu_items)`'],
    solution: 'SELECT item_name, price FROM menu_items WHERE price > (SELECT AVG(price) FROM menu_items);' },

  { id: 'l3c08', level: 3, schema: 'cafe', lesson: 'subquery-in', title: 'Delivery customers',
    task: 'Customers who have placed **at least one delivery** order. Each name once.',
    columns: ['full_name'],
    hints: ['Find delivery customer_ids in a subquery.', "`WHERE customer_id IN (SELECT customer_id FROM orders WHERE channel = 'delivery')`"],
    solution: "SELECT full_name FROM customers WHERE customer_id IN (SELECT customer_id FROM orders WHERE channel = 'delivery');" },

  { id: 'l3c09', level: 3, schema: 'cafe', lesson: 'exists', title: 'Silent members',
    task: 'Customers who have **never placed an order**.',
    columns: ['full_name'],
    hints: ['NOT EXISTS with a correlated subquery.', 'Correlate on `o.customer_id = c.customer_id`.'],
    solution: 'SELECT c.full_name FROM customers c WHERE NOT EXISTS (SELECT 1 FROM orders o WHERE o.customer_id = c.customer_id);' },

  { id: 'l3c10', level: 3, schema: 'cafe', lesson: 'derived-table', title: 'Average basket',
    task: 'The **average order value**: total each order first (sum of `quantity * unit_price`), then average those totals. Round to 2 decimals.',
    columns: ['avg_order_value'],
    hints: ['Inner query: per-order totals with GROUP BY order_id.', 'Outer query: AVG of that column.'],
    solution: 'SELECT ROUND(AVG(order_total), 2) AS avg_order_value FROM (SELECT order_id, SUM(quantity * unit_price) AS order_total FROM order_items GROUP BY order_id);' },

  { id: 'l3c11', level: 3, schema: 'hr', lesson: 'join', title: 'Mumbai teams',
    task: 'Employees who work in a department located in **Mumbai**, with the department name.',
    columns: ['full_name', 'dept_name'],
    hints: ['Join employees to departments on dept_id.', "Filter `d.location = 'Mumbai'`."],
    solution: "SELECT e.full_name, d.dept_name FROM employees e JOIN departments d ON d.dept_id = e.dept_id WHERE d.location = 'Mumbai';" },

  { id: 'l3c12', level: 3, schema: 'hr', lesson: 'left-join', title: 'Benched',
    task: 'Employees with **no project assignment** at all.',
    columns: ['full_name'],
    hints: ['LEFT JOIN employees to assignments.', 'Keep rows where the assignment side is NULL.'],
    solution: 'SELECT e.full_name FROM employees e LEFT JOIN assignments a ON a.emp_id = e.emp_id WHERE a.emp_id IS NULL;' },

  { id: 'l3c13', level: 3, schema: 'hr', lesson: 'multi-join', title: 'Project effort',
    task: 'For each project: total hours logged and the number of **distinct people** assigned.',
    columns: ['project_name', 'total_hours', 'people'],
    hints: ['Join projects to assignments.', '`COUNT(DISTINCT a.emp_id)` for people.'],
    solution: 'SELECT p.project_name, SUM(a.hours_logged) AS total_hours, COUNT(DISTINCT a.emp_id) AS people FROM projects p JOIN assignments a ON a.project_id = p.project_id GROUP BY p.project_id, p.project_name;' },

  // ---------------- LEVEL 4: Advanced ----------------
  { id: 'l4c01', level: 4, schema: 'cafe', lesson: 'case', title: 'Price tiers',
    task: 'Label every menu item: price below 60 is `budget`, below 150 is `standard`, otherwise `premium`.',
    columns: ['item_name', 'tier'],
    hints: ['A CASE with two WHENs and an ELSE.', 'Conditions are checked in order, so `< 60` must come before `< 150`.'],
    solution: "SELECT item_name, CASE WHEN price < 60 THEN 'budget' WHEN price < 150 THEN 'standard' ELSE 'premium' END AS tier FROM menu_items;" },

  { id: 'l4c02', level: 4, schema: 'cafe', lesson: 'conditional-agg', title: 'Channel pivot',
    task: 'For each store id, the number of orders per channel **as three columns**: counter, app, delivery.',
    columns: ['store_id', 'counter_orders', 'app_orders', 'delivery_orders'],
    hints: ['One `SUM(CASE WHEN channel = ... THEN 1 ELSE 0 END)` per channel.', 'Group by store_id.'],
    solution: "SELECT store_id, SUM(CASE WHEN channel = 'counter' THEN 1 ELSE 0 END) AS counter_orders, SUM(CASE WHEN channel = 'app' THEN 1 ELSE 0 END) AS app_orders, SUM(CASE WHEN channel = 'delivery' THEN 1 ELSE 0 END) AS delivery_orders FROM orders GROUP BY store_id;" },

  { id: 'l4c03', level: 4, schema: 'cafe', lesson: 'cte', title: 'Big baskets',
    task: 'Using a CTE that computes each order\'s total, list orders with a total **above 500**.',
    columns: ['order_id', 'total'],
    hints: ['`WITH totals AS (SELECT order_id, SUM(quantity * unit_price) AS total FROM order_items GROUP BY order_id)`', 'Then select from totals with WHERE total > 500.'],
    solution: 'WITH totals AS (SELECT order_id, SUM(quantity * unit_price) AS total FROM order_items GROUP BY order_id) SELECT order_id, total FROM totals WHERE total > 500;' },

  { id: 'l4c04', level: 4, schema: 'hr', lesson: 'window-ranking', title: 'Department pecking order',
    task: 'Number employees **within each department** by salary, highest salary = 1. Break ties by lower `emp_id` first. Only employees with a department.',
    columns: ['full_name', 'dept_id', 'salary', 'rn'],
    hints: ['`ROW_NUMBER() OVER (PARTITION BY dept_id ORDER BY salary DESC, emp_id)`', 'Filter out NULL departments.'],
    solution: 'SELECT full_name, dept_id, salary, ROW_NUMBER() OVER (PARTITION BY dept_id ORDER BY salary DESC, emp_id) AS rn FROM employees WHERE dept_id IS NOT NULL;' },

  { id: 'l4c05', level: 4, schema: 'hr', lesson: 'window-ranking', title: 'Salary ranks',
    task: 'Every employee with their **dense rank** by salary across the whole company (highest = 1).',
    columns: ['full_name', 'salary', 'salary_rank'],
    hints: ['`DENSE_RANK() OVER (ORDER BY salary DESC)`', 'No PARTITION BY: the window is the whole table.'],
    solution: 'SELECT full_name, salary, DENSE_RANK() OVER (ORDER BY salary DESC) AS salary_rank FROM employees;' },

  { id: 'l4c06', level: 4, schema: 'hr', lesson: 'window-aggregate', title: 'Compared to peers',
    task: 'Each employee with their salary and their **department\'s average salary** (ROUND to 2), keeping every row. Only employees with a department.',
    columns: ['full_name', 'salary', 'dept_avg'],
    hints: ['`AVG(salary) OVER (PARTITION BY dept_id)`', 'Wrap in ROUND(..., 2).'],
    solution: 'SELECT full_name, salary, ROUND(AVG(salary) OVER (PARTITION BY dept_id), 2) AS dept_avg FROM employees WHERE dept_id IS NOT NULL;' },

  { id: 'l4c07', level: 4, schema: 'cafe', lesson: 'running-total', title: 'Running revenue', ordered: true,
    task: 'Monthly revenue (`YYYY-MM`, `quantity * unit_price`) with a **running cumulative** total, oldest month first.',
    columns: ['month', 'revenue', 'cumulative'],
    hints: ['First aggregate per month in a CTE.', '`SUM(revenue) OVER (ORDER BY month)` gives the cumulative.'],
    solution: "WITH m AS (SELECT strftime('%Y-%m', o.ordered_at) AS month, SUM(oi.quantity * oi.unit_price) AS revenue FROM orders o JOIN order_items oi ON oi.order_id = o.order_id GROUP BY month) SELECT month, revenue, SUM(revenue) OVER (ORDER BY month) AS cumulative FROM m ORDER BY month;" },

  { id: 'l4c08', level: 4, schema: 'hr', lesson: 'lag-lead', title: 'Raise history',
    task: 'For every row in `salary_history`, show the employee\'s **previous salary** (NULL for their first row).',
    columns: ['emp_id', 'changed_on', 'new_salary', 'prev_salary'],
    hints: ['`LAG(new_salary) OVER (PARTITION BY emp_id ORDER BY changed_on)`'],
    solution: 'SELECT emp_id, changed_on, new_salary, LAG(new_salary) OVER (PARTITION BY emp_id ORDER BY changed_on) AS prev_salary FROM salary_history;' },

  { id: 'l4c09', level: 4, schema: 'cafe', lesson: 'union', title: 'All the cities',
    task: 'One de-duplicated list of every city that appears in **either** `stores` or `customers`.',
    columns: ['city'],
    hints: ['UNION removes duplicates; UNION ALL would not.'],
    solution: 'SELECT city FROM stores UNION SELECT city FROM customers;' },

  { id: 'l4c10', level: 4, schema: 'cafe', lesson: 'except', title: 'Expansion targets',
    task: 'Cities where customers live but **no store exists**.',
    columns: ['city'],
    hints: ['Customer cities EXCEPT store cities.'],
    solution: 'SELECT city FROM customers EXCEPT SELECT city FROM stores;' },

  { id: 'l4c11', level: 4, schema: 'cafe', lesson: 'top-n', title: 'Category champions',
    task: 'The **most expensive item in each category**.',
    columns: ['category', 'item_name', 'price'],
    hints: ['ROW_NUMBER partitioned by category, ordered by price DESC.', 'Keep rn = 1 in an outer query or CTE.'],
    solution: 'WITH r AS (SELECT category, item_name, price, ROW_NUMBER() OVER (PARTITION BY category ORDER BY price DESC) AS rn FROM menu_items) SELECT category, item_name, price FROM r WHERE rn = 1;' },

  { id: 'l4c12', level: 4, schema: 'cafe', lesson: 'date-arithmetic', title: 'Time to first order',
    task: 'For each customer who has ordered: the number of **whole days** between their `joined_on` date and the **date** of their first order, as an integer.',
    columns: ['full_name', 'days_to_first_order'],
    hints: ['`MIN(ordered_at)` is the first order; wrap in `date()` to drop the time.', '`CAST(julianday(...) - julianday(c.joined_on) AS INTEGER)`'],
    solution: 'SELECT c.full_name, CAST(julianday(date(MIN(o.ordered_at))) - julianday(c.joined_on) AS INTEGER) AS days_to_first_order FROM customers c JOIN orders o ON o.customer_id = c.customer_id GROUP BY c.customer_id, c.full_name;' },

  { id: 'l4c13', level: 4, schema: 'cafe', lesson: 'left-join', title: 'Rating coverage',
    task: 'Per store: total orders, how many of them were **rated**, and the average stars (ROUND to 2).',
    columns: ['store_name', 'orders', 'rated', 'avg_stars'],
    hints: ['Join stores to orders, then LEFT JOIN ratings so unrated orders survive.', '`COUNT(r.stars)` counts only rated orders.'],
    solution: 'SELECT s.store_name, COUNT(o.order_id) AS orders, COUNT(r.stars) AS rated, ROUND(AVG(r.stars), 2) AS avg_stars FROM stores s JOIN orders o ON o.store_id = s.store_id LEFT JOIN ratings r ON r.order_id = o.order_id GROUP BY s.store_id, s.store_name;' },

  // ---------------- LEVEL 5: Veteran ----------------
  { id: 'l5c01', level: 5, schema: 'hr', lesson: 'gaps-islands', title: 'Attendance streaks',
    task: 'Find every streak of **consecutive office days** per employee that lasted **3 days or more**. Return the employee, streak start, streak end and the number of days.',
    columns: ['emp_id', 'streak_start', 'streak_end', 'days'],
    hints: ['Subtract ROW_NUMBER (in days) from each date; equal results mean the same streak.', "`date(work_date, '-' || ROW_NUMBER() OVER (...) || ' days')`", 'GROUP BY emp_id and that anchor, HAVING COUNT(*) >= 3.'],
    solution: "WITH x AS (SELECT emp_id, work_date, date(work_date, '-' || ROW_NUMBER() OVER (PARTITION BY emp_id ORDER BY work_date) || ' days') AS grp FROM attendance) SELECT emp_id, MIN(work_date) AS streak_start, MAX(work_date) AS streak_end, COUNT(*) AS days FROM x GROUP BY emp_id, grp HAVING COUNT(*) >= 3;" },

  { id: 'l5c02', level: 5, schema: 'cafe', lesson: 'top-n', title: 'Store MVPs',
    task: 'For each store, the **customer who spent the most** there, with the amount (`quantity * unit_price`).',
    columns: ['store_name', 'full_name', 'total_spent'],
    hints: ['Aggregate spend per (store, customer) first.', 'Rank within store by spend DESC and keep rank 1.', 'Join to stores and customers for names.'],
    solution: 'WITH spend AS (SELECT o.store_id, o.customer_id, SUM(oi.quantity * oi.unit_price) AS total FROM orders o JOIN order_items oi ON oi.order_id = o.order_id GROUP BY o.store_id, o.customer_id), r AS (SELECT *, ROW_NUMBER() OVER (PARTITION BY store_id ORDER BY total DESC) AS rn FROM spend) SELECT s.store_name, c.full_name, r.total AS total_spent FROM r JOIN stores s ON s.store_id = r.store_id JOIN customers c ON c.customer_id = r.customer_id WHERE r.rn = 1;' },

  { id: 'l5c03', level: 5, schema: 'cafe', lesson: 'lag-lead', title: 'Month-over-month', ordered: true,
    task: 'Monthly revenue with the **percentage change** from the previous month (ROUND to 1; NULL for the first month). Oldest month first.',
    columns: ['month', 'revenue', 'pct_change'],
    hints: ['Monthly revenue in a CTE, then LAG(revenue) OVER (ORDER BY month).', '`ROUND((revenue - prev) * 100.0 / prev, 1)`'],
    solution: "WITH m AS (SELECT strftime('%Y-%m', o.ordered_at) AS month, SUM(oi.quantity * oi.unit_price) AS revenue FROM orders o JOIN order_items oi ON oi.order_id = o.order_id GROUP BY month), l AS (SELECT month, revenue, LAG(revenue) OVER (ORDER BY month) AS prev FROM m) SELECT month, revenue, ROUND((revenue - prev) * 100.0 / prev, 1) AS pct_change FROM l ORDER BY month;" },

  { id: 'l5c04', level: 5, schema: 'hr', lesson: 'median', title: 'Median salary',
    task: 'The **median salary per department** (average of the two middle values when the count is even). Only employees with a department.',
    columns: ['dept_id', 'median_salary'],
    hints: ['ROW_NUMBER ordered by salary plus COUNT(*) OVER per department.', 'Middle positions: `(cnt + 1) / 2` and `(cnt + 2) / 2`.', 'AVG the salaries at those positions, grouped by dept.'],
    solution: 'WITH r AS (SELECT dept_id, salary, ROW_NUMBER() OVER (PARTITION BY dept_id ORDER BY salary) AS rn, COUNT(*) OVER (PARTITION BY dept_id) AS cnt FROM employees WHERE dept_id IS NOT NULL) SELECT dept_id, AVG(salary) AS median_salary FROM r WHERE rn IN ((cnt + 1) / 2, (cnt + 2) / 2) GROUP BY dept_id;' },

  { id: 'l5c05', level: 5, schema: 'hr', lesson: 'recursive-cte', title: 'Org depth',
    task: 'Each employee\'s **depth** in the reporting hierarchy: the CEO is 0, their direct reports 1, and so on.',
    columns: ['full_name', 'depth'],
    hints: ['Anchor: employees with no manager at depth 0.', 'Recursive step: join employees to the CTE on manager_id, depth + 1.'],
    solution: 'WITH RECURSIVE t(emp_id, full_name, depth) AS (SELECT emp_id, full_name, 0 FROM employees WHERE manager_id IS NULL UNION ALL SELECT e.emp_id, e.full_name, t.depth + 1 FROM employees e JOIN t ON e.manager_id = t.emp_id) SELECT full_name, depth FROM t;' },

  { id: 'l5c06', level: 5, schema: 'cafe', lesson: 'dedupe', title: 'Latest sign-up per email',
    task: '`newsletter_signups` contains duplicate emails. Keep only the **most recent** row for each email.',
    columns: ['email', 'source', 'signed_up_at'],
    hints: ['ROW_NUMBER partitioned by email, ordered by signed_up_at DESC.', 'Keep rn = 1.'],
    solution: 'WITH r AS (SELECT *, ROW_NUMBER() OVER (PARTITION BY email ORDER BY signed_up_at DESC) AS rn FROM newsletter_signups) SELECT email, source, signed_up_at FROM r WHERE rn = 1;' },

  { id: 'l5c07', level: 5, schema: 'cafe', lesson: 'retention', title: 'January retention',
    task: 'Of the customers who ordered in **January 2024**, what percentage also ordered in **February 2024**? One value, ROUND to 1.',
    columns: ['retention_pct'],
    hints: ['Build two DISTINCT customer sets (Jan and Feb) as CTEs.', 'Count Jan customers that are IN the Feb set, divide by the Jan count, times 100.0.'],
    solution: "WITH jan AS (SELECT DISTINCT customer_id FROM orders WHERE ordered_at >= '2024-01-01' AND ordered_at < '2024-02-01'), feb AS (SELECT DISTINCT customer_id FROM orders WHERE ordered_at >= '2024-02-01' AND ordered_at < '2024-03-01') SELECT ROUND(100.0 * (SELECT COUNT(*) FROM jan WHERE customer_id IN (SELECT customer_id FROM feb)) / (SELECT COUNT(*) FROM jan), 1) AS retention_pct;" },

  { id: 'l5c08', level: 5, schema: 'cafe', lesson: 'pct-of-total', title: 'Share of revenue',
    task: 'Each menu **category\'s revenue** and its **share of total revenue** as a percentage (ROUND to 1).',
    columns: ['category', 'revenue', 'pct_of_total'],
    hints: ['Aggregate revenue per category in a CTE.', '`SUM(revenue) OVER ()` is the grand total.'],
    solution: 'WITH c AS (SELECT m.category, SUM(oi.quantity * oi.unit_price) AS revenue FROM order_items oi JOIN menu_items m ON m.item_id = oi.item_id GROUP BY m.category) SELECT category, revenue, ROUND(100.0 * revenue / SUM(revenue) OVER (), 1) AS pct_of_total FROM c;' },

  { id: 'l5c09', level: 5, schema: 'cafe', lesson: 'lag-lead', title: 'Order cadence',
    task: 'Average number of days between a customer\'s **consecutive orders**, for customers with **at least 3 orders**. Use order **dates** (ignore the time of day); ROUND to 1.',
    columns: ['full_name', 'avg_gap_days'],
    hints: ['LAG(date(ordered_at)) per customer; gap = julianday difference.', 'A customer with 3+ orders has 2+ gaps: `HAVING COUNT(*) >= 2` after dropping NULL gaps.'],
    solution: 'WITH g AS (SELECT customer_id, julianday(date(ordered_at)) - julianday(LAG(date(ordered_at)) OVER (PARTITION BY customer_id ORDER BY ordered_at)) AS gap FROM orders) SELECT c.full_name, ROUND(AVG(g.gap), 1) AS avg_gap_days FROM g JOIN customers c ON c.customer_id = g.customer_id WHERE g.gap IS NOT NULL GROUP BY c.customer_id, c.full_name HAVING COUNT(*) >= 2;' },

  { id: 'l5c10', level: 5, schema: 'hr', lesson: 'nth-per-group', title: 'Runner-up salaries',
    task: 'The **second-highest distinct salary** in each department (departments with only one distinct salary are left out).',
    columns: ['dept_id', 'second_highest'],
    hints: ['DENSE_RANK partitioned by dept, ordered by salary DESC.', 'Keep rank 2; use DISTINCT in case two people share that salary.'],
    solution: 'WITH r AS (SELECT dept_id, salary, DENSE_RANK() OVER (PARTITION BY dept_id ORDER BY salary DESC) AS rk FROM employees WHERE dept_id IS NOT NULL) SELECT DISTINCT dept_id, salary AS second_highest FROM r WHERE rk = 2;' },

  { id: 'l5c11', level: 5, schema: 'cafe', lesson: 'window-frames', title: 'Moving average', ordered: true,
    task: 'For orders in `order_id` order: each order\'s total and the **moving average** of the current and two preceding order totals (ROUND to 2).',
    columns: ['order_id', 'total', 'ma3'],
    hints: ['Per-order totals in a CTE.', '`AVG(total) OVER (ORDER BY order_id ROWS BETWEEN 2 PRECEDING AND CURRENT ROW)`'],
    solution: 'WITH t AS (SELECT order_id, SUM(quantity * unit_price) AS total FROM order_items GROUP BY order_id) SELECT order_id, total, ROUND(AVG(total) OVER (ORDER BY order_id ROWS BETWEEN 2 PRECEDING AND CURRENT ROW), 2) AS ma3 FROM t ORDER BY order_id;' },

  { id: 'l5c12', level: 5, schema: 'cafe', lesson: 'conditional-agg', title: 'Growing accounts',
    task: 'Customers whose spend in **Q2 2024** (April to June) was **higher than in Q1 2024** (January to March). Show both amounts.',
    columns: ['full_name', 'q1_spend', 'q2_spend'],
    hints: ["Two conditional SUMs split on `ordered_at < '2024-04-01'`.", 'Compare them in HAVING.'],
    solution: "SELECT c.full_name, SUM(CASE WHEN o.ordered_at < '2024-04-01' THEN oi.quantity * oi.unit_price ELSE 0 END) AS q1_spend, SUM(CASE WHEN o.ordered_at >= '2024-04-01' THEN oi.quantity * oi.unit_price ELSE 0 END) AS q2_spend FROM orders o JOIN order_items oi ON oi.order_id = o.order_id JOIN customers c ON c.customer_id = o.customer_id GROUP BY c.customer_id, c.full_name HAVING q2_spend > q1_spend;" },

  { id: 'l5c13', level: 5, schema: 'hr', lesson: 'recursive-cte', title: 'Reporting lines',
    task: 'For every employee, their full **reporting path** from the CEO down, names joined with ` > ` (for example `Kavita Menon > Rajesh Kumar > Pooja Sharma`).',
    columns: ['full_name', 'path'],
    hints: ['Carry a `path` column through the recursive CTE.', "Recursive step: `t.path || ' > ' || e.full_name`."],
    solution: "WITH RECURSIVE t(emp_id, full_name, path) AS (SELECT emp_id, full_name, full_name FROM employees WHERE manager_id IS NULL UNION ALL SELECT e.emp_id, e.full_name, t.path || ' > ' || e.full_name FROM employees e JOIN t ON e.manager_id = t.emp_id) SELECT full_name, path FROM t;" },

  { id: 'l5c14', level: 5, schema: 'cafe', lesson: 'top-n', title: 'Rush hour',
    task: 'For each store, the **hour of day** (0-23, as an integer) with the most orders and that count. If hours tie, pick the earliest hour.',
    columns: ['store_name', 'hour', 'orders'],
    hints: ["`CAST(strftime('%H', ordered_at) AS INTEGER)` extracts the hour.", 'Count per (store, hour), then ROW_NUMBER ordered by count DESC, hour ASC.'],
    solution: "WITH h AS (SELECT store_id, CAST(strftime('%H', ordered_at) AS INTEGER) AS hour, COUNT(*) AS n FROM orders GROUP BY store_id, hour), r AS (SELECT *, ROW_NUMBER() OVER (PARTITION BY store_id ORDER BY n DESC, hour) AS rn FROM h) SELECT s.store_name, r.hour, r.n AS orders FROM r JOIN stores s ON s.store_id = r.store_id WHERE r.rn = 1;" },
];

export const challengeById = Object.fromEntries(CHALLENGES.map(c => [c.id, c]));
export const challengesByLevel = (n) => CHALLENGES.filter(c => c.level === n);
export const levelInfo = (n) => LEVELS.find(l => l.n === n);
export function rankFor(xp) {
  let r = RANKS[0];
  for (const x of RANKS) if (xp >= x.xp) r = x;
  const next = RANKS.find(x => x.xp > xp) || null;
  return { ...r, next };
}
