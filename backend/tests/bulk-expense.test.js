import test from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from '../src/app.js';
import { dbService } from '../src/services/db.service.js';

test('Bulk expense API', async (t) => {
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
  t.after(() => server.close());

  const loginRes = await fetch(`${baseUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ identifier: 'user@example.com', password: '123456' }),
  });
  const { token } = await loginRes.json();
  const headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };

  const get = async (path) => (await fetch(`${baseUrl}${path}`, { headers })).json();
  const postBulk = (body) =>
    fetch(`${baseUrl}/api/transactions/bulk`, { method: 'POST', headers, body: JSON.stringify(body) });

  const { accounts } = await get('/api/accounts');
  const accountId = accounts[0].id;
  const balance = async () => {
    const data = await get('/api/accounts');
    return Number(data.accounts.find((a) => a.id === accountId).currentBalance);
  };
  const expenseCount = async () => {
    const txs = await dbService.getTransactions(accounts[0].userId);
    return txs.length;
  };

  const { categories } = await get('/api/categories');
  const food = categories.find((c) => c.name === 'Food & Dining');
  const transport = categories.find((c) => c.name === 'Transportation');
  // The endpoint toggles the current state.
  const toggleArchived = (category) =>
    fetch(`${baseUrl}/api/categories/${category.id}/archive`, { method: 'PATCH', headers });
  const batchId = () => `test_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

  await t.test('saves multiple items per category and deducts the exact total', async () => {
    const before = await balance();
    const res = await postBulk({
      accountId,
      date: '2026-11-03',
      batchId: batchId(),
      items: [
        { categoryId: food.id, subcategory: food.subcategories[0], description: 'Lunch', amount: 150.1 },
        { categoryId: food.id, description: 'Tea', amount: 20.2 },
        { categoryId: transport.id, description: 'Bus', amount: 60 },
      ],
    });
    assert.equal(res.status, 201);
    const data = await res.json();
    assert.equal(data.count, 3);
    assert.equal(data.transactions[0].category, 'Food & Dining');
    assert.equal(data.transactions[0].subcategory, food.subcategories[0]);
    assert.equal(data.transactions[2].category, 'Transportation');
    assert.equal(Math.round((before - (await balance())) * 100), 23030);
  });

  await t.test('repeating the same batchId does not save or deduct again', async () => {
    const id = batchId();
    const body = { accountId, date: '2026-11-03', batchId: id, items: [{ categoryId: food.id, amount: 75 }] };
    assert.equal((await postBulk(body)).status, 201);
    const before = await balance();
    const count = await expenseCount();

    const retry = await postBulk(body);
    assert.equal(retry.status, 200);
    assert.equal((await retry.json()).replayed, true);
    assert.equal(await balance(), before);
    assert.equal(await expenseCount(), count);
  });

  await t.test('one invalid item rejects the whole batch with nothing saved', async () => {
    const before = await balance();
    const count = await expenseCount();
    const res = await postBulk({
      accountId,
      date: '2026-11-03',
      items: [
        { categoryId: food.id, amount: 100 },
        { categoryId: food.id, amount: 0 },
      ],
    });
    assert.equal(res.status, 400);
    assert.match((await res.json()).error, /Expense #2/);
    assert.equal(await balance(), before);
    assert.equal(await expenseCount(), count);
  });

  await t.test('rejects unknown categories, archived categories and impossible dates', async () => {
    const unknown = await postBulk({
      accountId,
      date: '2026-11-03',
      items: [{ categoryId: 'cat_missing', amount: 10 }],
    });
    assert.equal(unknown.status, 400);

    const badSub = await postBulk({
      accountId,
      date: '2026-11-03',
      items: [{ categoryId: food.id, subcategory: 'Not a subcategory', amount: 10 }],
    });
    assert.equal(badSub.status, 400);

    const badDate = await postBulk({
      accountId,
      date: '2026-13-45',
      items: [{ categoryId: food.id, amount: 10 }],
    });
    assert.equal(badDate.status, 400);

    assert.equal((await toggleArchived(transport)).status, 200);
    const archived = await postBulk({
      accountId,
      date: '2026-11-03',
      items: [{ categoryId: transport.id, amount: 10 }],
    });
    assert.equal(archived.status, 400);
    assert.equal((await toggleArchived(transport)).status, 200);
  });

  await t.test('items sent by category name only still save, as the web app does', async () => {
    const res = await postBulk({
      accountId,
      date: '2026-11-03',
      items: [{ category: 'Food & Dining', desc: 'Web row', amount: 40 }],
    });
    assert.equal(res.status, 201);
    assert.equal((await res.json()).transactions[0].description, 'Web row');
  });
});
