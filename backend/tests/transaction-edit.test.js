import test from 'node:test';
import assert from 'node:assert/strict';
import bcrypt from 'bcryptjs';
import { createApp } from '../src/app.js';
import { dbService } from '../src/services/db.service.js';

test('Editing a transaction', async (t) => {
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
  const password = 'Edit-test-password1!';
  const email = `edit_${unique}@test.local`;
  const userId = `ed_${unique}`;
  await dbService.createUser({
    id: userId,
    username: `edit_${unique}`,
    email,
    passwordHash: await bcrypt.hash(password, 4),
    fullName: 'Editor',
    role: 'USER',
    isActive: true,
    emailVerified: true,
    currency: 'BDT',
    timezone: 'Asia/Dhaka',
    dateFormat: 'DD MMM YYYY',
  });
  await dbService.seedDefaultCategories(userId);
  await dbService.seedDefaultAccounts(userId);
  const login = await (await fetch(`${baseUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ identifier: email, password }),
  })).json();
  const headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${login.token}` };
  const api = async (method, path, body) => {
    const res = await fetch(`${baseUrl}/api${path}`, { method, headers, body: body ? JSON.stringify(body) : undefined });
    return { status: res.status, data: await res.json() };
  };
  const balances = async () => Object.fromEntries((await api('GET', '/accounts')).data.accounts.map((a) => [a.name, Number(a.currentBalance)]));

  const second = await api('POST', '/accounts', { name: 'Second', type: 'CASH', openingBalance: 1000 });
  assert.equal(second.status, 201);
  const secondId = (second.data.account || second.data).id;
  const cashId = (await api('GET', '/accounts')).data.accounts.find((a) => a.name === 'Cash').id;

  const created = await api('POST', '/transactions/expense', {
    accountId: cashId, amount: 200, date: '2026-05-01', description: 'Row', category: 'Food & Dining',
  });
  assert.equal(created.status, 201);
  const id = created.data.transaction.id;
  assert.deepEqual(await balances(), { Cash: -200, Second: 1000 });

  await t.test('moving to another account and category updates both balances and reports', async () => {
    const updated = await api('PUT', `/transactions/${id}`, {
      accountId: secondId, category: 'Transportation', subcategory: 'Public Bus & Metro', amount: 300,
    });
    assert.equal(updated.status, 200);
    assert.deepEqual(await balances(), { Cash: 0, Second: 700 });

    const row = (await api('GET', '/transactions?limit=50')).data.items.find((x) => x.id === id);
    assert.equal(row.category, 'Transportation');
    assert.equal(row.subcategory, 'Public Bus & Metro');
    assert.equal(row.accountName, 'Second');

    const analytics = (await api('GET', '/reports/analytics')).data;
    assert.deepEqual(analytics.byCategory.map((c) => [c.name, c.amount]), [['Transportation', 300]]);
  });

  await t.test('category_id follows the new category', { skip: !process.env.TEST_DATABASE_URL && 'needs Postgres (set TEST_DATABASE_URL)' }, async () => {
    const res = await dbService.pool.query(
      `SELECT c.name FROM transactions t JOIN categories c ON c.id = t.category_id WHERE t.id = $1`,
      [id]
    );
    assert.ok(['Transportation', 'Public Bus & Metro'].includes(res.rows[0]?.name), `category_id points at ${res.rows[0]?.name}`);
  });
});
