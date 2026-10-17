import test from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from '../src/app.js';
import { dbService, formatToISODate } from '../src/services/db.service.js';
import { parseDateToISO } from '../src/controllers/transaction.controller.js';

test('Transaction Date Sorting, Normalization & Update Lifecycle Tests', async (t) => {
  await dbService.initialize();
  const app = createApp();

  let server;
  let baseUrl;

  await new Promise((resolve) => {
    server = app.listen(0, '127.0.0.1', () => {
      const port = server.address().port;
      baseUrl = `http://127.0.0.1:${port}`;
      resolve();
    });
  });

  t.after(() => {
    server.close();
  });

  // Register dedicated test user for date-sorting tests to prevent race conditions
  const uniqueEmail = `datesort_${Date.now()}@example.com`;
  const regRes = await fetch(`${baseUrl}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: uniqueEmail, password: 'password123' }),
  });
  const regData = await regRes.json();
  const token = regData.token;
  assert.ok(token);

  const accRes = await fetch(`${baseUrl}/api/accounts`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ name: 'DateSort Test Wallet', type: 'CASH', openingBalance: 10000 }),
  });
  const accData = await accRes.json();
  assert.ok(accData.account && accData.account.id);
  const accountId = accData.account.id;

  await t.test('1. Date parser and formatter handles strings and prevents timezone day shifts', () => {
    assert.equal(parseDateToISO('2026-10-17'), '2026-10-17');
    assert.equal(parseDateToISO('2026-10-17T12:00:00.000Z'), '2026-10-17');
    assert.equal(parseDateToISO('17/10/2026'), '2026-10-17');
    assert.equal(parseDateToISO('01/10/2026'), '2026-10-01');
    assert.equal(parseDateToISO('17-10-2026'), '2026-10-17');
    assert.equal(formatToISODate('2026-10-17'), '2026-10-17');
    const localDate = new Date(2026, 9, 17); // October 17 local
    assert.equal(formatToISODate(localDate), '2026-10-17');
  });

  await t.test('2. Expense date update immediately moves record to correct sorted position', async () => {
    // Create an older expense: 2026-10-01
    const createRes1 = await fetch(`${baseUrl}/api/transactions/expense`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        accountId,
        amount: 20,
        date: '2026-10-01',
        description: 'Office to Home Commute',
        category: 'Transportation',
      }),
    });
    assert.equal(createRes1.status, 201);
    const tx1 = (await createRes1.json()).transaction;

    // Create a newer expense: 2026-10-15
    const createRes2 = await fetch(`${baseUrl}/api/transactions/expense`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        accountId,
        amount: 50,
        date: '2026-10-15',
        description: 'Mid Month Expense',
        category: 'Food & Dining',
      }),
    });
    assert.equal(createRes2.status, 201);
    const tx2 = (await createRes2.json()).transaction;

    // Fetch transactions - tx2 (15th) should come before tx1 (1st)
    const listRes1 = await fetch(`${baseUrl}/api/transactions?type=EXPENSE`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const list1 = (await listRes1.json()).items;
    const idxTx1_initial = list1.findIndex((t) => t.id === tx1.id);
    const idxTx2_initial = list1.findIndex((t) => t.id === tx2.id);
    assert.ok(idxTx2_initial < idxTx1_initial, 'tx2 (2026-10-15) must appear before tx1 (2026-10-01)');

    // Now edit tx1 to newer date: 2026-10-17 (as illustrated in user screenshot 1 & 2)
    const updateRes = await fetch(`${baseUrl}/api/transactions/${tx1.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        date: '2026-10-17',
        description: 'Office to Home, Home to Office',
      }),
    });
    assert.equal(updateRes.status, 200);
    const updatedTx1 = (await updateRes.json()).transaction;
    assert.equal(updatedTx1.date, '2026-10-17');

    // Fetch transactions again - tx1 (now 17th) MUST appear before tx2 (15th)!
    const listRes2 = await fetch(`${baseUrl}/api/transactions?type=EXPENSE`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const list2 = (await listRes2.json()).items;
    const idxTx1_after = list2.findIndex((t) => t.id === tx1.id);
    const idxTx2_after = list2.findIndex((t) => t.id === tx2.id);
    assert.ok(idxTx1_after < idxTx2_after, 'tx1 (now 2026-10-17) must appear ABOVE tx2 (2026-10-15)!');

    // Clean up
    await fetch(`${baseUrl}/api/transactions/${tx1.id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } });
    await fetch(`${baseUrl}/api/transactions/${tx2.id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } });
  });

  await t.test('3. Income date update moves record down when edited to older date', async () => {
    // Create newer income: 2026-10-20
    const createRes1 = await fetch(`${baseUrl}/api/transactions/income`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        accountId,
        amount: 15000,
        date: '2026-10-20',
        description: 'Freelance Milestone',
        category: 'Freelance & Contracting',
      }),
    });
    assert.equal(createRes1.status, 201);
    const tx1 = (await createRes1.json()).transaction;

    // Create intermediate income: 2026-10-10
    const createRes2 = await fetch(`${baseUrl}/api/transactions/income`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        accountId,
        amount: 8000,
        date: '2026-10-10',
        description: 'Consulting Session',
        category: 'Business & Sales',
      }),
    });
    assert.equal(createRes2.status, 201);
    const tx2 = (await createRes2.json()).transaction;

    // Edit tx1 from 2026-10-20 to 2026-10-05 (older than tx2)
    const updateRes = await fetch(`${baseUrl}/api/transactions/${tx1.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        date: '2026-10-05',
      }),
    });
    assert.equal(updateRes.status, 200);

    // Fetch income records - tx2 (10th) must now appear before tx1 (5th)
    const listRes = await fetch(`${baseUrl}/api/transactions?type=INCOME`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const list = (await listRes.json()).items;
    const idxTx1 = list.findIndex((t) => t.id === tx1.id);
    const idxTx2 = list.findIndex((t) => t.id === tx2.id);
    assert.ok(idxTx2 < idxTx1, 'tx2 (2026-10-10) must appear ABOVE tx1 (2026-10-05)');

    // Clean up
    await fetch(`${baseUrl}/api/transactions/${tx1.id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } });
    await fetch(`${baseUrl}/api/transactions/${tx2.id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } });
  });

  await t.test('4. Date range filters accurately filter edited records', async () => {
    // Create transaction in October
    const createRes = await fetch(`${baseUrl}/api/transactions/expense`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        accountId,
        amount: 100,
        date: '2026-10-15',
        description: 'Filter Test Expense',
      }),
    });
    assert.equal(createRes.status, 201);
    const tx = (await createRes.json()).transaction;

    // Verify it is returned for October filter
    const octRes1 = await fetch(`${baseUrl}/api/transactions?type=EXPENSE&startDate=2026-10-01&endDate=2026-10-31`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const octList1 = (await octRes1.json()).items;
    assert.ok(octList1.some((t) => t.id === tx.id));

    // Edit date to September (outside October range)
    await fetch(`${baseUrl}/api/transactions/${tx.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ date: '2026-09-25' }),
    });

    // Verify it is excluded from October filter
    const octRes2 = await fetch(`${baseUrl}/api/transactions?type=EXPENSE&startDate=2026-10-01&endDate=2026-10-31`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const octList2 = (await octRes2.json()).items;
    assert.ok(!octList2.some((t) => t.id === tx.id), 'September transaction must be excluded from October filter');

    // Clean up
    await fetch(`${baseUrl}/api/transactions/${tx.id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } });
  });
});
