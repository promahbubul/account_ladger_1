import test from 'node:test';
import assert from 'node:assert/strict';
import bcrypt from 'bcryptjs';
import { createApp } from '../src/app.js';
import { dbService } from '../src/services/db.service.js';

test('List pagination', async (t) => {
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
  const makeUser = async (name, role = 'USER') => {
    const password = 'Paging-test-password1!';
    const email = `${name}_${unique}@test.local`;
    const user = {
      id: `pg_${name[0]}_${unique}`,
      username: `${name}_${unique}`.slice(0, 60),
      email,
      passwordHash: await bcrypt.hash(password, 4),
      fullName: name,
      role,
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
      authHeader: `Bearer ${token}`,
      get: async (path) => (await fetch(`${baseUrl}/api${path}`, { headers })).json(),
      raw: (path, extra = {}) => fetch(`${baseUrl}/api${path}`, { headers: { ...headers, ...extra } }),
      post: (path, body) => fetch(`${baseUrl}/api${path}`, { method: 'POST', headers, body: JSON.stringify(body) }),
    };
  };
  const owner = await makeUser('owner');
  const stranger = await makeUser('stranger');
  const { accounts } = await owner.get('/accounts');
  const source = accounts[0].id;
  const other = await (await owner.post('/accounts', { name: 'Paging Bank', type: 'BANK', openingBalance: 0, providerName: 'Other' })).json();
  const destination = other.account.id;
  await owner.post('/transactions/income', { accountId: source, amount: 500000, date: '2026-01-01', category: 'Salary', description: 'Seed' });

  // Several rows share each date, so ordering and paging must rely on the tie-breakers.
  const dateOf = (i) => `2026-03-${String((i % 5) + 1).padStart(2, '0')}`;
  for (let batch = 0; batch < 3; batch += 1) {
    const res = await owner.post('/transactions/bulk', {
      accountId: source,
      date: dateOf(batch),
      items: Array.from({ length: 49 }, (_, i) => ({ category: 'Food & Dining', amount: 1, description: `Meal ${batch}-${i}` })),
    });
    assert.equal(res.status, 201);
  }
  await owner.post('/transactions/expense', { accountId: source, amount: 7, date: '2026-03-09', category: 'Food & Dining', description: '100% unique_marker' });
  for (let i = 0; i < 55; i += 1) {
    assert.equal((await owner.post('/transfers', { sourceAccountId: source, destinationAccountId: destination, amount: 1, date: dateOf(i), description: `Move ${i}` })).status, 201);
    assert.equal((await owner.post('/loans', { type: i % 2 ? 'LENT' : 'BORROWED', accountId: source, counterpartyName: `Person ${i}`, principalAmount: 10, startDate: dateOf(i) })).status, 201);
  }
  const allLoans = (await owner.get('/loans?all=true')).loans;
  for (let i = 0; i < 55; i += 1) {
    const res = await owner.post(`/loans/${allLoans[0].id}/repayments`, { amount: 0.01, date: dateOf(i), accountId: source, notes: `Part ${i}` });
    assert.ok(res.ok, `repayment ${i}`);
  }

  const lists = [
    { name: 'transactions', path: '/transactions', key: 'transactions', extra: 'type=EXPENSE', date: 'date' },
    { name: 'transfers', path: '/transfers', key: 'transfers', extra: '', date: 'date' },
    { name: 'loans', path: '/loans', key: 'loans', extra: '', date: 'startDate' },
    { name: 'repayments', path: '/loans/repayments', key: 'repayments', extra: '', date: 'date' },
  ];

  for (const list of lists) {
    const url = (query) => `${list.path}?${[list.extra, query].filter(Boolean).join('&')}`;
    const everything = (await owner.get(url('all=true')))[list.key];
    assert.ok(everything.length > 50, `${list.name} needs more than one page`);

    await t.test(`${list.name}: page numbers return every row once, newest first`, async () => {
      const seen = [];
      let page = 1;
      for (;;) {
        const res = await owner.get(url(`page=${page}&limit=50`));
        assert.equal(res.totalCount, everything.length);
        assert.equal(res.hasPreviousPage, page > 1);
        seen.push(...res.items);
        if (!res.hasNextPage) break;
        assert.equal(res.items.length, 50);
        page += 1;
      }
      assert.equal(seen.length, everything.length);
      assert.equal(new Set(seen.map((r) => r.id)).size, everything.length);
      const dates = seen.map((r) => r[list.date]);
      assert.deepEqual(dates, [...dates].sort().reverse());
      assert.deepEqual(new Set(seen.map((r) => r.id)), new Set(everything.map((r) => r.id)));
    });

    await t.test(`${list.name}: cursors walk forward and back`, async () => {
      const first = await owner.get(url('limit=50'));
      assert.equal(first.hasPreviousPage, false);
      const second = await owner.get(url(`limit=50&cursor=${first.nextCursor}`));
      assert.equal(second.hasPreviousPage, true);
      assert.equal(new Set([...first.items, ...second.items].map((r) => r.id)).size, first.items.length + second.items.length);
      const back = await owner.get(url(`limit=50&direction=backward&cursor=${second.previousCursor}`));
      assert.deepEqual(back.items.map((r) => r.id), first.items.map((r) => r.id));
      assert.equal(back.hasNextPage, true);
      assert.equal(back.hasPreviousPage, false);
    });

    await t.test(`${list.name}: bad input cannot break the request`, async () => {
      for (const query of ['cursor=not-a-real-cursor', 'page=999999999999999999999', 'page=abc']) {
        assert.equal((await owner.raw(url(`limit=50&${query}`))).status, 200, query);
      }
      assert.deepEqual((await owner.get(url('limit=50&page=5000'))).items, []);
    });

    await t.test(`${list.name}: another user's cursor reveals nothing`, async () => {
      const mine = await owner.get(url('limit=50'));
      const theirs = await stranger.get(`${list.path}?limit=50&cursor=${mine.nextCursor}`);
      assert.ok(!theirs.items.some((r) => mine.items.some((m) => m.id === r.id)));
      assert.equal((await stranger.get(`${list.path}?limit=50`)).items.some((r) => everything.some((m) => m.id === r.id)), false);
    });

    await t.test(`${list.name}: a page does not repeat the list under a second name`, async () => {
      const page = await owner.get(url('limit=50'));
      assert.equal(page[list.key], undefined);
      const all = await owner.get(url('all=true'));
      assert.equal(all.items, undefined);
    });
  }

  await t.test('filters and search run on the same rows as before', async () => {
    const march = await owner.get('/transactions?type=EXPENSE&startDate=2026-03-01&endDate=2026-03-02&limit=50');
    assert.ok(march.totalCount > 0);
    assert.ok(march.items.every((r) => r.date >= '2026-03-01' && r.date <= '2026-03-02'));

    const moves = await owner.get('/transfers?search=move 7&limit=50');
    assert.ok(moves.items.length > 0 && moves.items.every((r) => r.description.toLowerCase().includes('move 7')));
    assert.equal((await owner.get(`/transfers?sourceAccountId=${destination}&limit=50`)).totalCount, 0);
    assert.equal((await owner.get('/transfers?startDate=2026-02-30&limit=50')).success, true);

    assert.equal((await owner.get('/loans?type=LENT&limit=50')).totalCount, 27);
    assert.equal((await owner.get('/loans?search=person 1&limit=50')).items.every((r) => r.counterpartyName.includes('Person 1')), true);
    assert.equal((await owner.get(`/loans/repayments?loanId=${allLoans[0].id}&limit=50`)).totalCount, 55);
  });

  await t.test('search treats % and _ as plain text', async () => {
    assert.equal((await owner.get('/transactions?search=100%25&limit=50')).totalCount, 1);
    assert.equal((await owner.get('/transactions?search=unique_marker&limit=50')).totalCount, 1);
    assert.equal((await owner.get('/transactions?search=uniquexmarker&limit=50')).totalCount, 0);
    assert.equal((await owner.get('/transfers?search=%25&limit=50')).totalCount, 0);
  });

  await t.test('a deleted row used as a cursor does not restart the list', { skip: !process.env.TEST_DATABASE_URL && 'needs Postgres (set TEST_DATABASE_URL)' }, async () => {
    const first = await owner.get('/transactions?type=EXPENSE&limit=50');
    const anchor = first.items[first.items.length - 1];
    assert.equal((await fetch(`${baseUrl}/api/transactions/${anchor.id}`, {
      method: 'DELETE',
      headers: { Authorization: owner.authHeader },
    })).status, 200);
    const next = await owner.get(`/transactions?type=EXPENSE&limit=50&cursor=${first.nextCursor}`);
    assert.ok(next.items.length > 0);
    assert.ok(next.items.every((r) => r.date <= anchor.date));
    assert.equal(next.hasPreviousPage, true);
  });

  await t.test('large lists are gzipped, small and auth responses are not', async () => {
    const large = await owner.raw('/transactions?limit=100', { 'Accept-Encoding': 'gzip' });
    assert.equal(large.headers.get('content-encoding'), 'gzip');
    assert.match(large.headers.get('vary'), /Accept-Encoding/i);
    assert.equal(large.headers.get('content-type').includes('application/json'), true);
    assert.equal((await large.json()).items.length, 100);

    const small = await owner.raw('/budgets', { 'Accept-Encoding': 'gzip' });
    assert.equal(small.headers.get('content-encoding'), null);
    const auth = await owner.raw('/auth/me', { 'Accept-Encoding': 'gzip' });
    assert.equal(auth.headers.get('content-encoding'), null);
    const plain = await owner.raw('/transactions?limit=100', { 'Accept-Encoding': 'identity' });
    assert.equal(plain.headers.get('content-encoding'), null);
  });

  await t.test('deleting a category checks for use without loading the rows', async () => {
    const { categories } = await owner.get('/categories');
    const food = categories.find((c) => c.name === 'Food & Dining');
    const res = await fetch(`${baseUrl}/api/categories/${food.id}`, { method: 'DELETE', headers: { Authorization: owner.authHeader } });
    assert.equal(res.status, 400);
  });

  await t.test('a repayment still finds its own loan only', async () => {
    const res = await stranger.post(`/loans/${allLoans[0].id}/repayments`, { amount: 1, date: '2026-03-01', accountId: source });
    assert.equal(res.status, 404);
  });

  await t.test('account and category pages only take the allowed page sizes', async () => {
    assert.equal((await owner.raw('/accounts?paginate=true&limit=7')).status, 400);
    assert.equal((await owner.raw('/categories?paginate=true&limit=1000')).status, 400);
    const accountsPage = await owner.get('/accounts?paginate=true&limit=50&page=abc');
    assert.equal(accountsPage.items.length, 2);
    assert.equal((await owner.get('/categories?paginate=true&limit=50')).success, true);
  });

  await t.test('admin users page by cursor, newest first, without password hashes', async () => {
    const admin = await makeUser('admin', 'ADMIN');
    const hash = await bcrypt.hash('Paging-test-password1!', 4);
    const tag = `crowd${unique}`;
    for (let i = 0; i < 55; i += 1) {
      await dbService.createUser({
        id: `pg_crowd_${unique}_${i}`,
        username: `${tag}_${i}`,
        email: `${tag}_${i}@test.local`,
        passwordHash: hash,
        fullName: `Crowd ${i}`,
        role: 'USER',
        isActive: i % 5 !== 0,
        emailVerified: true,
        currency: 'BDT',
        timezone: 'Asia/Dhaka',
        dateFormat: 'DD MMM YYYY',
      });
    }

    const first = await admin.get(`/admin/users?search=${tag}&limit=50`);
    assert.equal(first.totalCount, 55);
    assert.equal(first.items.length, 50);
    assert.equal(first.hasNextPage, true);
    assert.ok(first.items.every((u) => u.passwordHash === undefined && u.password_hash === undefined));
    const second = await admin.get(`/admin/users?search=${tag}&limit=50&cursor=${first.nextCursor}`);
    assert.equal(second.items.length, 5);
    assert.equal(second.hasNextPage, false);
    const ids = [...first.items, ...second.items].map((u) => u.id);
    assert.equal(new Set(ids).size, 55);

    assert.equal((await admin.get(`/admin/users?search=${tag}&status=INACTIVE&limit=50`)).totalCount, 11);
    assert.equal((await admin.get(`/admin/users?search=${tag}&role=ADMIN&limit=50`)).totalCount, 0);
    assert.equal((await owner.raw('/admin/users?limit=50')).status, 403);
  });
});
