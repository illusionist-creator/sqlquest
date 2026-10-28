// Practice databases for SQLQuest.
// Pure ES module: runs in the browser (sql.js) and in Node (verification script).
// Seed data is generated deterministically so every learner sees identical data.

function rng(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const q = (v) => (v === null || v === undefined) ? 'NULL' : (typeof v === 'number' ? String(v) : `'${String(v).replace(/'/g, "''")}'`);
const row = (vals) => `(${vals.map(q).join(', ')})`;
const pad = (n) => String(n).padStart(2, '0');
function addDays(iso, n) { const d = new Date(iso + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); }
function daysBetween(a, b) { return Math.round((new Date(b + 'T00:00:00Z') - new Date(a + 'T00:00:00Z')) / 86400000); }
function insert(table, cols, rows) { return rows.length ? `INSERT INTO ${table} (${cols.join(', ')}) VALUES\n${rows.map(row).join(',\n')};\n` : ''; }
function ddlFor(tables) {
  return tables.map(t => `CREATE TABLE ${t.name} (\n  ${t.columns.map(c => `${c[0]} ${c[1]}`).join(',\n  ')}\n);`).join('\n');
}

// ---------------------------------------------------------------------------
// CAFE: a small chai-and-coffee chain. Stores, staff, customers, menu, orders.
// ---------------------------------------------------------------------------
const cafeTables = [
  { name: 'stores', columns: [
    ['store_id', 'INTEGER PRIMARY KEY', 'Unique store number'],
    ['store_name', 'TEXT NOT NULL', 'Branch name'],
    ['city', 'TEXT NOT NULL', 'City the store is in'],
    ['state', 'TEXT NOT NULL', 'State'],
    ['opened_on', 'TEXT NOT NULL', 'Opening date (YYYY-MM-DD)'] ] },
  { name: 'staff', columns: [
    ['staff_id', 'INTEGER PRIMARY KEY', ''],
    ['full_name', 'TEXT NOT NULL', ''],
    ['role', 'TEXT NOT NULL', 'Regional Head / Store Manager / Barista'],
    ['store_id', 'INTEGER NOT NULL REFERENCES stores(store_id)', 'Store they work at'],
    ['hired_on', 'TEXT NOT NULL', 'Hire date'],
    ['monthly_salary', 'INTEGER NOT NULL', 'Salary in rupees per month'],
    ['manager_id', 'INTEGER REFERENCES staff(staff_id)', 'Their manager (NULL for the regional head)'] ] },
  { name: 'customers', columns: [
    ['customer_id', 'INTEGER PRIMARY KEY', ''],
    ['full_name', 'TEXT NOT NULL', ''],
    ['email', 'TEXT', 'May be NULL if never provided'],
    ['city', 'TEXT NOT NULL', 'Home city'],
    ['joined_on', 'TEXT NOT NULL', 'Loyalty sign-up date'],
    ['loyalty_tier', 'TEXT NOT NULL', 'Bronze / Silver / Gold'] ] },
  { name: 'menu_items', columns: [
    ['item_id', 'INTEGER PRIMARY KEY', ''],
    ['item_name', 'TEXT NOT NULL', ''],
    ['category', 'TEXT NOT NULL', 'Beverage / Snack / Bakery / Dessert / Meal'],
    ['price', 'INTEGER NOT NULL', 'List price in rupees'],
    ['is_veg', 'INTEGER NOT NULL', '1 = vegetarian, 0 = not'] ] },
  { name: 'orders', columns: [
    ['order_id', 'INTEGER PRIMARY KEY', ''],
    ['customer_id', 'INTEGER NOT NULL REFERENCES customers(customer_id)', ''],
    ['store_id', 'INTEGER NOT NULL REFERENCES stores(store_id)', ''],
    ['staff_id', 'INTEGER NOT NULL REFERENCES staff(staff_id)', 'Who served the order'],
    ['ordered_at', 'TEXT NOT NULL', 'Timestamp YYYY-MM-DD HH:MM:SS'],
    ['channel', 'TEXT NOT NULL', 'counter / app / delivery'] ] },
  { name: 'order_items', columns: [
    ['order_id', 'INTEGER NOT NULL REFERENCES orders(order_id)', ''],
    ['item_id', 'INTEGER NOT NULL REFERENCES menu_items(item_id)', ''],
    ['quantity', 'INTEGER NOT NULL', ''],
    ['unit_price', 'INTEGER NOT NULL', 'Price charged per unit'] ] },
  { name: 'ratings', columns: [
    ['order_id', 'INTEGER PRIMARY KEY REFERENCES orders(order_id)', 'One rating per order; not every order is rated'],
    ['stars', 'INTEGER NOT NULL', '1 to 5'],
    ['comment', 'TEXT', 'Optional free text'] ] },
  { name: 'newsletter_signups', columns: [
    ['signup_id', 'INTEGER PRIMARY KEY', ''],
    ['email', 'TEXT NOT NULL', 'The same email can appear more than once'],
    ['source', 'TEXT NOT NULL', 'website / instagram / in-store'],
    ['signed_up_at', 'TEXT NOT NULL', ''] ] },
];

const CAFE_STORES = [
  [1, 'Chai & Co. Bandra', 'Mumbai', 'Maharashtra', '2019-03-15'],
  [2, 'Chai & Co. Koramangala', 'Bengaluru', 'Karnataka', '2019-11-02'],
  [3, 'Chai & Co. Connaught Place', 'Delhi', 'Delhi', '2020-08-20'],
  [4, 'Chai & Co. Park Street', 'Kolkata', 'West Bengal', '2021-01-10'],
  [5, 'Chai & Co. Indiranagar', 'Bengaluru', 'Karnataka', '2022-06-01'],
  [6, 'Chai & Co. Banjara Hills', 'Hyderabad', 'Telangana', '2023-02-14'],
];
const CAFE_STAFF = [
  [1, 'Rohan Mehta', 'Regional Head', 1, '2019-03-01', 95000, null],
  [2, 'Ananya Iyer', 'Store Manager', 1, '2019-03-10', 55000, 1],
  [3, 'Vikram Singh', 'Barista', 1, '2019-04-01', 28000, 2],
  [4, 'Neha Kulkarni', 'Barista', 1, '2021-07-15', 26000, 2],
  [5, 'Arjun Nair', 'Store Manager', 2, '2019-10-20', 52000, 1],
  [6, 'Divya Reddy', 'Barista', 2, '2020-01-05', 27000, 5],
  [7, 'Karan Malhotra', 'Store Manager', 3, '2020-08-01', 50000, 1],
  [8, 'Sana Khan', 'Barista', 3, '2020-09-12', 25000, 7],
  [9, 'Ritika Bose', 'Store Manager', 4, '2021-01-01', 48000, 1],
  [10, 'Imran Sheikh', 'Barista', 4, '2021-02-14', 24000, 9],
  [11, 'Meera Pillai', 'Store Manager', 5, '2022-05-20', 51000, 1],
  [12, 'Aditya Rao', 'Barista', 5, '2022-06-10', 26500, 11],
  [13, 'Fatima Begum', 'Store Manager', 6, '2023-02-01', 49000, 1],
  [14, 'Siddharth Joshi', 'Barista', 6, '2023-03-01', 25500, 13],
];
const CAFE_CUSTOMERS = [
  [1, 'Priya Sharma', 'priya.sharma@gmail.com', 'Mumbai', '2023-01-12', 'Gold'],
  [2, 'Rahul Verma', 'rahul.v@outlook.com', 'Bengaluru', '2023-02-03', 'Gold'],
  [3, 'Aisha Khan', 'aisha.khan@gmail.com', 'Delhi', '2023-02-20', 'Silver'],
  [4, 'Dev Patel', 'dev.patel@yahoo.com', 'Mumbai', '2023-03-15', 'Gold'],
  [5, 'Sneha Reddy', 'sneha.r@gmail.com', 'Hyderabad', '2023-04-02', 'Silver'],
  [6, 'Arnav Gupta', 'arnav.g@gmail.com', 'Kolkata', '2023-05-18', 'Silver'],
  [7, 'Ishita Bose', null, 'Kolkata', '2023-06-07', 'Bronze'],
  [8, 'Kabir Singh', 'kabir.singh@outlook.com', 'Delhi', '2023-07-22', 'Silver'],
  [9, 'Meghna Iyer', 'meghna.iyer@gmail.com', 'Bengaluru', '2023-08-14', 'Bronze'],
  [10, 'Rohit Nair', 'rohit.nair@gmail.com', 'Bengaluru', '2023-09-01', 'Silver'],
  [11, 'Tanvi Joshi', 'tanvi.j@yahoo.com', 'Pune', '2023-09-25', 'Bronze'],
  [12, 'Yash Malhotra', 'yash.m@gmail.com', 'Mumbai', '2023-10-10', 'Bronze'],
  [13, 'Zoya Ahmed', 'zoya.ahmed@gmail.com', 'Hyderabad', '2023-11-05', 'Bronze'],
  [14, 'Nikhil Rao', null, 'Bengaluru', '2023-11-28', 'Bronze'],
  [15, 'Pallavi Desai', 'pallavi.d@outlook.com', 'Mumbai', '2023-12-12', 'Silver'],
  [16, 'Siddhant Kapoor', 'sid.kapoor@gmail.com', 'Delhi', '2024-01-08', 'Bronze'],
  [17, 'Ritu Agarwal', 'ritu.a@gmail.com', 'Kolkata', '2024-02-14', 'Bronze'],
  [18, 'Farhan Ali', 'farhan.ali@yahoo.com', 'Hyderabad', '2024-03-03', 'Bronze'],
  [19, 'Ananya Das', 'ananya.das@gmail.com', 'Kolkata', '2024-04-19', 'Bronze'],
  [20, 'Vivek Menon', 'vivek.menon@gmail.com', 'Pune', '2024-05-21', 'Bronze'],
];
const CAFE_MENU = [
  [1, 'Masala Chai', 'Beverage', 40, 1],
  [2, 'Filter Coffee', 'Beverage', 60, 1],
  [3, 'Cold Brew', 'Beverage', 180, 1],
  [4, 'Mango Lassi', 'Beverage', 120, 1],
  [5, 'Samosa', 'Snack', 30, 1],
  [6, 'Chicken Puff', 'Snack', 70, 0],
  [7, 'Veg Sandwich', 'Snack', 110, 1],
  [8, 'Egg Bhurji Toast', 'Snack', 130, 0],
  [9, 'Butter Croissant', 'Bakery', 90, 1],
  [10, 'Chocolate Brownie', 'Bakery', 95, 1],
  [11, 'Banana Bread', 'Bakery', 85, 1],
  [12, 'Blueberry Cheesecake', 'Dessert', 220, 1],
  [13, 'Gulab Jamun', 'Dessert', 60, 1],
  [14, 'Keto Chicken Bowl', 'Meal', 320, 0],
];
const COMMENTS = ['Loved the chai!', 'Service was slow.', 'Croissant was fresh and buttery.', 'Too sweet for me.', 'Great place to work from.', 'Order arrived cold.', 'Staff were very friendly.', 'Will come again.'];

function cafeSeed() {
  const r = rng(20240101);
  const pick = (arr) => arr[Math.floor(r() * arr.length)];
  const weighted = (pairs) => { const total = pairs.reduce((s, p) => s + p[1], 0); let x = r() * total; for (const [v, w] of pairs) { x -= w; if (x <= 0) return v; } return pairs[pairs.length - 1][0]; };

  // Customer order propensity: a handful of regulars, many occasional, one who never orders (id 20).
  const custWeights = CAFE_CUSTOMERS.filter(c => c[0] !== 20).map(c => [c, c[0] <= 5 ? 4 : c[0] <= 12 ? 2 : 1]);
  const staffByStore = {};
  for (const s of CAFE_STAFF) if (s[2] !== 'Regional Head') (staffByStore[s[3]] ||= []).push(s[0]);

  const raw = [];
  for (let i = 0; i < 90; i++) {
    const cust = weighted(custWeights);
    const start = cust[4] > '2024-01-01' ? cust[4] : '2024-01-01';
    const span = daysBetween(start, '2024-06-30');
    const date = addDays(start, Math.floor(r() * (span + 1)));
    const hour = 8 + Math.floor(r() * 13), min = Math.floor(r() * 60), sec = Math.floor(r() * 60);
    const store = 1 + Math.floor(r() * 6);
    const staff = pick(staffByStore[store]);
    const channel = weighted([['counter', 5], ['app', 3], ['delivery', 2]]);
    const nItems = weighted([[1, 4], [2, 4], [3, 2]]);
    const items = new Set();
    while (items.size < nItems) items.add(1 + Math.floor(r() * 13)); // item 14 is never ordered on purpose
    const lines = [...items].map(id => [id, weighted([[1, 6], [2, 3], [3, 1]]), CAFE_MENU[id - 1][3]]);
    const rated = r() < 0.4 ? [weighted([[5, 35], [4, 30], [3, 15], [2, 10], [1, 10]]), r() < 0.5 ? pick(COMMENTS) : null] : null;
    raw.push({ ts: `${date} ${pad(hour)}:${pad(min)}:${pad(sec)}`, cust: cust[0], store, staff, channel, lines, rated });
  }
  raw.sort((a, b) => a.ts < b.ts ? -1 : 1);
  const orders = [], orderItems = [], ratings = [];
  raw.forEach((o, idx) => {
    const id = idx + 1;
    orders.push([id, o.cust, o.store, o.staff, o.ts, o.channel]);
    for (const [item, qty, price] of o.lines) orderItems.push([id, item, qty, price]);
    if (o.rated) ratings.push([id, o.rated[0], o.rated[1]]);
  });

  const emails = ['neha@example.com', 'arjun.k@example.com', 'priya.sharma@gmail.com', 'tom.b@example.com', 'latha@example.com', 'rahul.v@outlook.com', 'zara@example.com', 'omar.f@example.com', 'ira.s@example.com', 'kunal@example.com'];
  const signups = [];
  for (let i = 0; i < 26; i++) {
    const email = i < 10 ? emails[i] : pick(emails);
    const date = addDays('2024-01-01', Math.floor(r() * 180));
    signups.push([i + 1, email, weighted([['website', 5], ['instagram', 3], ['in-store', 2]]), `${date} ${pad(9 + Math.floor(r() * 12))}:${pad(Math.floor(r() * 60))}:00`]);
  }

  return [
    insert('stores', ['store_id', 'store_name', 'city', 'state', 'opened_on'], CAFE_STORES),
    insert('staff', ['staff_id', 'full_name', 'role', 'store_id', 'hired_on', 'monthly_salary', 'manager_id'], CAFE_STAFF),
    insert('customers', ['customer_id', 'full_name', 'email', 'city', 'joined_on', 'loyalty_tier'], CAFE_CUSTOMERS),
    insert('menu_items', ['item_id', 'item_name', 'category', 'price', 'is_veg'], CAFE_MENU),
    insert('orders', ['order_id', 'customer_id', 'store_id', 'staff_id', 'ordered_at', 'channel'], orders),
    insert('order_items', ['order_id', 'item_id', 'quantity', 'unit_price'], orderItems),
    insert('ratings', ['order_id', 'stars', 'comment'], ratings),
    insert('newsletter_signups', ['signup_id', 'email', 'source', 'signed_up_at'], signups),
  ].join('\n');
}

// ---------------------------------------------------------------------------
// HR: a mid-sized company. Departments, employees (with managers), projects,
// assignments, attendance (for streak problems) and salary history.
// ---------------------------------------------------------------------------
const hrTables = [
  { name: 'departments', columns: [
    ['dept_id', 'INTEGER PRIMARY KEY', ''],
    ['dept_name', 'TEXT NOT NULL', ''],
    ['location', 'TEXT NOT NULL', 'Office city'] ] },
  { name: 'employees', columns: [
    ['emp_id', 'INTEGER PRIMARY KEY', ''],
    ['full_name', 'TEXT NOT NULL', ''],
    ['dept_id', 'INTEGER REFERENCES departments(dept_id)', 'NULL for the CEO'],
    ['title', 'TEXT NOT NULL', 'Job title'],
    ['salary', 'INTEGER NOT NULL', 'Monthly salary in rupees'],
    ['hire_date', 'TEXT NOT NULL', ''],
    ['manager_id', 'INTEGER REFERENCES employees(emp_id)', 'NULL for the CEO'] ] },
  { name: 'projects', columns: [
    ['project_id', 'INTEGER PRIMARY KEY', ''],
    ['project_name', 'TEXT NOT NULL', ''],
    ['dept_id', 'INTEGER NOT NULL REFERENCES departments(dept_id)', 'Owning department'],
    ['budget', 'INTEGER NOT NULL', 'Rupees'],
    ['start_date', 'TEXT NOT NULL', ''],
    ['end_date', 'TEXT', 'NULL while the project is still running'] ] },
  { name: 'assignments', columns: [
    ['emp_id', 'INTEGER NOT NULL REFERENCES employees(emp_id)', ''],
    ['project_id', 'INTEGER NOT NULL REFERENCES projects(project_id)', ''],
    ['hours_logged', 'INTEGER NOT NULL', ''],
    ['role', 'TEXT NOT NULL', 'Lead / Developer / Owner / ...'] ] },
  { name: 'attendance', columns: [
    ['emp_id', 'INTEGER NOT NULL REFERENCES employees(emp_id)', ''],
    ['work_date', 'TEXT NOT NULL', 'A day the employee came to the office'] ] },
  { name: 'salary_history', columns: [
    ['emp_id', 'INTEGER NOT NULL REFERENCES employees(emp_id)', ''],
    ['changed_on', 'TEXT NOT NULL', 'Date the new salary took effect'],
    ['new_salary', 'INTEGER NOT NULL', ''] ] },
];
const HR_DEPTS = [
  [1, 'Engineering', 'Bengaluru'], [2, 'Sales', 'Mumbai'], [3, 'Marketing', 'Delhi'],
  [4, 'Finance', 'Mumbai'], [5, 'Human Resources', 'Bengaluru'], [6, 'Research', 'Pune'],
];
const HR_EMPLOYEES = [
  [1, 'Kavita Menon', null, 'Chief Executive Officer', 250000, '2015-04-01', null],
  [2, 'Rajesh Kumar', 1, 'VP Engineering', 180000, '2016-02-15', 1],
  [3, 'Pooja Sharma', 1, 'Senior Engineer', 95000, '2018-06-10', 2],
  [4, 'Amit Verma', 1, 'Engineer', 72000, '2020-09-01', 2],
  [5, 'Lakshmi Narayanan', 1, 'Engineer', 72000, '2021-03-15', 2],
  [6, 'Deepak Chawla', 1, 'Junior Engineer', 48000, '2023-07-01', 3],
  [7, 'Sunita Rao', 2, 'Head of Sales', 150000, '2017-01-20', 1],
  [8, 'Manish Gupta', 2, 'Account Executive', 65000, '2019-11-11', 7],
  [9, 'Nisha Patel', 2, 'Account Executive', 68000, '2021-08-23', 7],
  [10, 'Varun Desai', 2, 'Sales Associate', 42000, '2023-02-01', 8],
  [11, 'Shreya Ghosh', 3, 'Marketing Lead', 110000, '2018-10-05', 1],
  [12, 'Harish Babu', 3, 'Content Strategist', 58000, '2022-04-18', 11],
  [13, 'Anjali Saxena', 4, 'Finance Controller', 125000, '2016-09-30', 1],
  [14, 'Mohan Das', 4, 'Accountant', 55000, '2020-01-13', 13],
  [15, 'Preethi Suresh', 5, 'HR Manager', 90000, '2019-05-06', 1],
  [16, 'Tarun Bhatia', 5, 'HR Associate', 38000, '2022-11-21', 15],
];
const HR_PROJECTS = [
  [1, 'Atlas Platform', 1, 1200000, '2023-01-10', '2023-12-20'],
  [2, 'Mobile App v2', 1, 800000, '2024-02-01', null],
  [3, 'Enterprise Outreach', 2, 300000, '2023-06-01', '2024-01-31'],
  [4, 'Brand Refresh', 3, 250000, '2024-01-15', '2024-05-30'],
  [5, 'Audit Automation', 4, 150000, '2023-09-01', '2024-03-15'],
  [6, 'Talent Portal', 5, 90000, '2024-03-01', null],
];
const HR_ASSIGNMENTS = [
  [3, 1, 420, 'Lead'], [4, 1, 380, 'Developer'], [5, 1, 300, 'Developer'], [6, 1, 120, 'Intern'],
  [3, 2, 200, 'Lead'], [4, 2, 260, 'Developer'], [8, 3, 150, 'Owner'], [9, 3, 180, 'Owner'],
  [10, 3, 90, 'Support'], [11, 4, 220, 'Owner'], [12, 4, 300, 'Contributor'], [13, 5, 100, 'Sponsor'],
  [14, 5, 340, 'Owner'], [15, 6, 160, 'Owner'], [16, 6, 200, 'Contributor'], [4, 6, 40, 'Consultant'],
];
// Attendance as date ranges so streak ("gaps and islands") problems have known answers.
const HR_ATTENDANCE_RANGES = [
  [3, '2024-03-04', '2024-03-08'], [3, '2024-03-11', '2024-03-12'], [3, '2024-03-14', '2024-03-18'],
  [4, '2024-03-04', '2024-03-06'], [4, '2024-03-08', '2024-03-08'], [4, '2024-03-11', '2024-03-15'],
  [5, '2024-03-04', '2024-03-05'], [5, '2024-03-07', '2024-03-07'], [5, '2024-03-11', '2024-03-13'],
  [6, '2024-03-04', '2024-03-04'], [6, '2024-03-06', '2024-03-06'], [6, '2024-03-08', '2024-03-08'],
  [8, '2024-03-01', '2024-03-10'],
];
const HR_SALARY_HISTORY = [
  [3, '2018-06-10', 60000], [3, '2020-01-01', 70000], [3, '2022-01-01', 82000], [3, '2024-01-01', 95000],
  [4, '2020-09-01', 60000], [4, '2023-01-01', 72000],
  [7, '2017-01-20', 90000], [7, '2019-01-01', 115000], [7, '2022-01-01', 150000],
  [9, '2021-08-23', 55000], [9, '2023-07-01', 68000],
  [16, '2022-11-21', 38000],
];

function hrSeed() {
  const attendance = [];
  for (const [emp, from, to] of HR_ATTENDANCE_RANGES) {
    for (let d = from; d <= to; d = addDays(d, 1)) attendance.push([emp, d]);
  }
  return [
    insert('departments', ['dept_id', 'dept_name', 'location'], HR_DEPTS),
    insert('employees', ['emp_id', 'full_name', 'dept_id', 'title', 'salary', 'hire_date', 'manager_id'], HR_EMPLOYEES),
    insert('projects', ['project_id', 'project_name', 'dept_id', 'budget', 'start_date', 'end_date'], HR_PROJECTS),
    insert('assignments', ['emp_id', 'project_id', 'hours_logged', 'role'], HR_ASSIGNMENTS),
    insert('attendance', ['emp_id', 'work_date'], attendance),
    insert('salary_history', ['emp_id', 'changed_on', 'new_salary'], HR_SALARY_HISTORY),
  ].join('\n');
}

export const SCHEMAS = {
  cafe: {
    key: 'cafe',
    name: 'Chai & Co. (cafe chain)',
    description: 'A six-store chai and coffee chain: stores, staff, loyalty customers, a menu, six months of orders with line items, ratings and newsletter sign-ups.',
    tables: cafeTables,
    ddl: ddlFor(cafeTables),
    seed: cafeSeed,
  },
  hr: {
    key: 'hr',
    name: 'Meridian Corp (HR)',
    description: 'A company of sixteen people: departments, employees with managers, projects and assignments, attendance days and salary history.',
    tables: hrTables,
    ddl: ddlFor(hrTables),
    seed: hrSeed,
  },
};

export function schemaSQL(key) {
  const s = SCHEMAS[key];
  return s.ddl + '\n' + s.seed();
}
