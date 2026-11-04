import test from 'node:test';
import assert from 'node:assert/strict';
import bcrypt from 'bcryptjs';
import { createApp } from '../src/app.js';
import { dbService } from '../src/services/db.service.js';

test('Renaming a category', async (t) => {
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
  const password = 'Rename-test-password1!';
  const email = `rename_${unique}@test.local`;
  const user = {
    id: `r_${unique}`,
    username: `rename_${unique}`,
    email,
    passwordHash: await bcrypt.hash(password, 4),
    fullName: 'Rename',
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
  const login = await fetch(`${baseUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ identifier: email, password }),
  });
  const { token } = await login.json();
  const headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };
  const send = (method, path, body) =>
    fetch(`${baseUrl}/api${path}`, { method, headers, body: body ? JSON.stringify(body) : undefined });

  const { accounts } = await (await send('GET', '/accounts')).json();
  const today = new Date().toISOString().slice(0, 10);
  const created = await (await send('POST', '/categories', { name: 'Old Name', type: 'EXPENSE', subcategories: ['Tea'] })).json();
  const id = created.category.id;

  const bulk = await send('POST', '/transactions/bulk', {
    accountId: accounts[0].id,
    date: today,
    items: [{ category: 'Old Name', subcategory: 'Tea', amount: 40 }],
  });
  assert.equal(bulk.status, 201);
  assert.equal((await send('POST', '/budgets', { categoryName: 'Old Name', monthlyLimit: 500 })).ok, true);

  await t.test('moves existing transactions and budgets to the new name', async () => {
    const res = await send('PUT', `/categories/${id}`, { name: 'New Name' });
    assert.equal(res.status, 200);

    const { transactions } = await (await send('GET', '/transactions?type=EXPENSE&all=true')).json();
    const moved = transactions.filter((tx) => tx.amount === 40);
    assert.equal(moved.length, 1);
    assert.equal(moved[0].category, 'New Name');

    const { budgets } = await (await send('GET', '/budgets')).json();
    assert.ok(budgets.some((b) => b.categoryName === 'New Name'));
    assert.ok(!budgets.some((b) => b.categoryName === 'Old Name'));
  });

  await t.test('a category in use still cannot be deleted after a rename', async () => {
    const res = await send('DELETE', `/categories/${id}`);
    assert.equal(res.status, 400);
  });

  await t.test('rejects a name already used by another category of that type', async () => {
    const res = await send('PUT', `/categories/${id}`, { name: 'food & dining' });
    assert.equal(res.status, 409);
  });

  await t.test('rejects an empty name', async () => {
    const res = await send('PUT', `/categories/${id}`, { name: '   ' });
    assert.equal(res.status, 400);
  });

  await t.test('saving the same name with other changes still works', async () => {
    const res = await send('PUT', `/categories/${id}`, { name: 'New Name', subcategories: ['Tea', 'Coffee'] });
    assert.equal(res.status, 200);
    assert.deepEqual((await res.json()).category.subcategories, ['Tea', 'Coffee']);
  });
});
