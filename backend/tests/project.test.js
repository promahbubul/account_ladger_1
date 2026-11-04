import test from 'node:test';
import assert from 'node:assert/strict';
import bcrypt from 'bcryptjs';
import { createApp } from '../src/app.js';
import { dbService } from '../src/services/db.service.js';

test('Projects and report analytics', async (t) => {
  await dbService.initialize();
  const app = createApp();
  let server;
  let baseUrl;
  await new Promise((resolve) => {
    server = app.listen(0, '127.0.0.1', () => {
      baseUrl = `http://127.0.0.1:${server.address().port}`;
      resolve();
    });
  });
  t.after(async () => {
    server.close();
    if (dbService.pool) await dbService.pool.end();
  });

  const unique = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`;
  const makeUser = async (name) => {
    const password = 'Project-test-password1!';
    const email = `${name}_${unique}@test.local`;
    const user = {
      id: `p_${name[0]}_${unique}`,
      username: `${name}_${unique}`.slice(0, 60),
      email,
      passwordHash: await bcrypt.hash(password, 4),
      fullName: name,
      role: 'USER',
      isActive: true,
      emailVerified: true,
      currency: 'BDT',
      timezone: 'Asia/Dhaka',
      dateFormat: 'DD MMM YYYY',
    };
    await dbService.createUser(user);
    await dbService.seedDefaultCategories(user.id);
    await dbService.seedDefaultAccounts(user.id);
    const res = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identifier: email, password }),
    });
    const { token } = await res.json();
    const headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };
    return {
      get: (path) => fetch(`${baseUrl}/api${path}`, { headers }),
      send: (method, path, body) => fetch(`${baseUrl}/api${path}`, { method, headers, body: JSON.stringify(body ?? {}) }),
    };
  };
  const owner = await makeUser('owner');
  const stranger = await makeUser('stranger');

  await t.test('analytics groups personal expenses by category and fills every month', async () => {
    const { accounts } = await (await owner.get('/accounts')).json();
    const today = new Date().toISOString().slice(0, 10);
    const income = await owner.send('POST', '/transactions/income', { accountId: accounts[0].id, amount: 1000, date: today, description: 'Pay', category: 'Other Income' });
    assert.equal(income.status, 201);
    const bulk = await owner.send('POST', '/transactions/bulk', {
      accountId: accounts[0].id,
      date: today,
      items: [
        { category: 'Food & Dining', amount: 100.1 },
        { category: 'Food & Dining', amount: 20.2 },
        { category: 'Transportation', amount: 60 },
      ],
    });
    assert.equal(bulk.status, 201);

    const data = await (await owner.get('/reports/analytics')).json();
    assert.equal(data.byCategory[0].name, 'Food & Dining');
    assert.equal(data.byCategory[0].amount, 120.3);
    assert.equal(data.byCategory[0].count, 2);
    assert.equal(data.byCategory[1].amount, 60);
    assert.equal(data.monthly.length, 12);
    const current = data.monthly[data.monthly.length - 1];
    assert.equal(current.month, today.slice(0, 7));
    assert.equal(current.income, 1000);
    assert.equal(current.expense, 180.3);
    assert.ok(data.monthly.slice(0, 11).every((m) => m.income === 0 && m.expense === 0));

    const empty = await (await owner.get('/reports/analytics?startDate=2001-01-01&endDate=2001-02-01')).json();
    assert.deepEqual(empty.byCategory, []);
    assert.equal(empty.monthly[empty.monthly.length - 1].month, '2001-02');
  });

  const postgresOnly = { skip: !process.env.TEST_DATABASE_URL && 'needs Postgres (set TEST_DATABASE_URL)' };

  await t.test('project lifecycle, totals, breakdowns, and isolation', postgresOnly, async () => {
    const summaryBefore = await (await owner.get('/reports/summary')).json();
    const accountsBefore = (await (await owner.get('/accounts')).json()).accounts;

    const missingName = await owner.send('POST', '/projects', { clientName: 'X' });
    assert.equal(missingName.status, 400);

    const created = await owner.send('POST', '/projects', { name: 'Dhaka Building', clientName: 'ACME', budget: 500000, startDate: '2026-01-15' });
    assert.equal(created.status, 201);
    const { project } = await created.json();
    assert.equal(project.totalFunds, 0);
    assert.equal(project.balance, 0);
    assert.equal(project.startDate, '2026-01-15');
    assert.ok(project.heads.length >= 5, 'default heads are created');
    const rod = project.heads.find((h) => h.name === 'Rod');
    const labor = project.heads.find((h) => h.name === 'Labor');
    const base = `/projects/${project.id}`;

    const karim = (await (await owner.send('POST', `${base}/people`, { name: 'Karim', phone: '017' })).json()).person;
    const rahim = (await (await owner.send('POST', `${base}/people`, { name: 'Rahim' })).json()).person;
    assert.equal((await owner.send('POST', `${base}/people`, { name: 'karim' })).status, 409, 'duplicate person');
    assert.equal((await owner.send('POST', `${base}/heads`, { name: 'rod' })).status, 409, 'duplicate head');

    const entries = [
      { type: 'FUND', amount: 500000, date: '2026-02-01', personId: karim.id, description: 'Advance' },
      { type: 'EXPENSE', amount: 150000.5, date: '2026-02-02', headId: rod.id, personId: karim.id },
      { type: 'EXPENSE', amount: 80000.25, date: '2026-02-03', headId: labor.id, personId: rahim.id },
      { type: 'EXPENSE', amount: 10000, date: '2026-02-04', headId: labor.id },
    ];
    const batchId = `batch_${unique}`.slice(0, 40);
    const saved = await owner.send('POST', `${base}/entries`, { entries, batchId });
    assert.equal(saved.status, 201);
    const replay = await owner.send('POST', `${base}/entries`, { entries, batchId });
    assert.equal(replay.status, 200, 'repeating a batch does not save twice');
    assert.equal((await replay.json()).replayed, true);

    const detail = (await (await owner.get(base)).json()).project;
    assert.equal(detail.totalFunds, 500000);
    assert.equal(detail.totalExpense, 240000.75);
    assert.equal(detail.balance, 259999.25);
    assert.deepEqual(detail.byHead.map((h) => [h.name, h.amount]), [['Rod', 150000.5], ['Labor', 90000.25]]);
    const byPerson = Object.fromEntries(detail.byPerson.map((p) => [p.name, p]));
    assert.equal(byPerson.Karim.expense, 150000.5);
    assert.equal(byPerson.Karim.funds, 500000);
    assert.equal(byPerson.Rahim.expense, 80000.25);
    assert.equal(byPerson['Not assigned'].expense, 10000);

    // Project money stays out of the personal ledger.
    const summaryAfter = await (await owner.get('/reports/summary')).json();
    assert.equal(summaryAfter.totalExpense, summaryBefore.totalExpense);
    assert.equal(summaryAfter.netWorth, summaryBefore.netWorth);
    assert.deepEqual((await (await owner.get('/accounts')).json()).accounts.map((a) => a.currentBalance), accountsBefore.map((a) => a.currentBalance));

    // One bad row stores nothing.
    const bad = await owner.send('POST', `${base}/entries`, {
      entries: [
        { type: 'EXPENSE', amount: 5, date: '2026-02-05', headId: rod.id },
        { type: 'EXPENSE', amount: -5, date: '2026-02-05', headId: rod.id },
      ],
    });
    assert.equal(bad.status, 400);
    assert.match((await bad.json()).error, /Entry #2/);
    assert.equal((await (await owner.get(base)).json()).project.totalExpense, 240000.75);
    assert.equal((await owner.send('POST', `${base}/entries`, { entries: [{ type: 'EXPENSE', amount: 5, date: '2026-02-05' }] })).status, 400, 'expense needs a head');
    assert.equal((await owner.send('POST', `${base}/entries`, { entries: [{ type: 'EXPENSE', amount: 5, date: '2026-13-45', headId: rod.id }] })).status, 400, 'bad date');

    // Listing, filtering, editing, deleting.
    const expenses = await (await owner.get(`${base}/entries?type=EXPENSE`)).json();
    assert.equal(expenses.items.length, 3);
    assert.equal(expenses.items[0].date, '2026-02-04');
    assert.equal(expenses.items[1].headName, 'Labor');
    assert.equal(expenses.items[1].personName, 'Rahim');
    const target = expenses.items[0];
    assert.equal((await owner.send('PUT', `${base}/entries/${target.id}`, { ...target, amount: 20000 })).status, 200);
    assert.equal((await (await owner.get(base)).json()).project.totalExpense, 250000.75);
    assert.equal((await owner.send('DELETE', `${base}/entries/${target.id}`)).status, 200);
    assert.equal((await (await owner.get(base)).json()).project.totalExpense, 230000.75);

    // People and heads in use are protected.
    assert.equal((await owner.send('DELETE', `${base}/people/${rahim.id}`)).status, 409);
    assert.equal((await owner.send('DELETE', `${base}/heads/${rod.id}`)).status, 409);

    // Another user cannot see or change anything.
    assert.equal((await stranger.get(base)).status, 404);
    assert.equal((await stranger.get(`${base}/entries`)).status, 404);
    assert.equal((await stranger.send('POST', `${base}/entries`, { entries })).status, 404);
    assert.equal((await stranger.send('POST', `${base}/people`, { name: 'Hacker' })).status, 404);
    assert.equal((await stranger.send('DELETE', base)).status, 404);
    assert.equal((await (await stranger.get('/projects')).json()).projects.length, 0);

    // Ids from a different project are rejected.
    const other = (await (await owner.send('POST', '/projects', { name: 'Other' })).json()).project;
    const crossed = await owner.send('POST', `/projects/${other.id}/entries`, {
      entries: [{ type: 'EXPENSE', amount: 1, date: '2026-03-01', headId: rod.id }],
    });
    assert.equal(crossed.status, 400);

    const list = (await (await owner.get('/projects')).json()).projects;
    assert.equal(list.length, 2);
    assert.equal(list.find((p) => p.id === project.id).balance, 269999.25);

    // Deleting a project removes its entries with it.
    assert.equal((await owner.send('DELETE', base)).status, 200);
    assert.equal((await owner.get(base)).status, 404);
    const leftovers = await dbService.pool.query('SELECT COUNT(*)::int AS n FROM project_entries WHERE project_id = $1', [project.id]);
    assert.equal(leftovers.rows[0].n, 0);
  });

  await t.test('paging returns every entry exactly once', postgresOnly, async () => {
    const { project } = await (await owner.send('POST', '/projects', { name: 'Paged' })).json();
    const base = `/projects/${project.id}`;
    const entries = Array.from({ length: 120 }, (_, i) => ({ type: 'FUND', amount: 1, date: '2026-04-01', description: `Row ${i}` }));
    assert.equal((await owner.send('POST', `${base}/entries`, { entries })).status, 201);

    const seen = new Set();
    let page = 1;
    for (;;) {
      const data = await (await owner.get(`${base}/entries?page=${page}&limit=50`)).json();
      data.items.forEach((item) => seen.add(item.id));
      if (!data.hasNextPage) break;
      page += 1;
    }
    assert.equal(seen.size, 120);
    assert.equal(page, 3);
    assert.equal((await (await owner.get(`${base}/entries?all=true`)).json()).items.length, 120);
  });

  await t.test('the JSON store reports projects as unavailable', { skip: Boolean(process.env.TEST_DATABASE_URL) }, async () => {
    assert.equal((await owner.get('/projects')).status, 503);
  });
});
