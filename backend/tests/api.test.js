import test from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from '../src/app.js';
import { dbService } from '../src/services/db.service.js';

test('Express API Integration Tests', async (t) => {
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

  await t.test('GET /health returns 200 with service status', async () => {
    const res = await fetch(`${baseUrl}/health`);
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.equal(data.status, 'healthy');
    assert.equal(data.service, 'Account Ladger REST API');
  });

  await t.test('GET /api/health returns 200 with service status', async () => {
    const res = await fetch(`${baseUrl}/api/health`);
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.equal(data.status, 'healthy');
  });

  await t.test('POST /api/auth/login rejects wrong password with 401 generic message', async () => {
    const res = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identifier: 'user@example.com', password: 'wrongpassword' }),
    });
    assert.equal(res.status, 401);
    const data = await res.json();
    assert.equal(data.error, 'Invalid credentials. Please check your username/email and password.');
  });

  await t.test('POST /api/auth/login succeeds with valid standard user credentials', async () => {
    const res = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identifier: 'user@example.com', password: '123456' }),
    });
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.equal(data.success, true);
    assert.ok(data.token);
    assert.equal(data.user.role, 'USER');
    assert.equal(data.user.email, 'user@example.com');
  });

  await t.test('GET /api/accounts blocks unauthenticated requests with 401', async () => {
    const res = await fetch(`${baseUrl}/api/accounts`);
    assert.equal(res.status, 401);
  });

  await t.test('Category hierarchy and Transaction Edit full lifecycle', async () => {
    // 1. Login standard user
    const loginRes = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identifier: 'user@example.com', password: '123456' }),
    });
    const loginData = await loginRes.json();
    const token = loginData.token;
    assert.ok(token);

    // 2. Create main parent category
    const mainCatRes = await fetch(`${baseUrl}/api/categories`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ name: 'Test Food Parent', type: 'EXPENSE' }),
    });
    assert.equal(mainCatRes.status, 201);
    const mainCatData = await mainCatRes.json();
    assert.ok(mainCatData.category.id);
    assert.equal(mainCatData.category.parentId, null);
    const parentId = mainCatData.category.id;

    // 3. Create subcategory under main parent
    const subCatRes = await fetch(`${baseUrl}/api/categories`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ name: 'Test Groceries Sub', type: 'EXPENSE', parentId }),
    });
    assert.equal(subCatRes.status, 201);
    const subCatData = await subCatRes.json();
    assert.equal(subCatData.category.parentId, parentId);
    const subCatId = subCatData.category.id;

    // 4. Reject nested subcategory under subcategory (enforcing 1 level)
    const nestedRes = await fetch(`${baseUrl}/api/categories`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ name: 'Test Invalid Deep Sub', type: 'EXPENSE', parentId: subCatId }),
    });
    assert.equal(nestedRes.status, 400);

    // 5. Prevent deleting parent category that has subcategories
    const delParentRes = await fetch(`${baseUrl}/api/categories/${parentId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    });
    assert.equal(delParentRes.status, 400);

    // 6. Get user accounts
    const accsRes = await fetch(`${baseUrl}/api/accounts`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const accsData = await accsRes.json();
    assert.ok(accsData.accounts && accsData.accounts.length > 0);
    const acc = accsData.accounts[0];
    const initialBalance = acc.currentBalance;

    // 7. Create expense transaction
    const expRes = await fetch(`${baseUrl}/api/transactions/expense`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        accountId: acc.id,
        amount: 250,
        date: '2026-10-15',
        description: 'Test Initial Expense',
        category: 'Test Food Parent',
        subcategory: 'Test Groceries Sub',
      }),
    });
    assert.equal(expRes.status, 201);
    const expData = await expRes.json();
    const txId = expData.transaction.id;

    // Verify balance was reduced by 250
    const accsAfterExp = await (await fetch(`${baseUrl}/api/accounts`, { headers: { Authorization: `Bearer ${token}` } })).json();
    const updatedAcc1 = accsAfterExp.accounts.find((a) => a.id === acc.id);
    assert.equal(Number(updatedAcc1.currentBalance), Number((initialBalance - 250).toFixed(2)));

    // 8. Edit expense transaction: change amount to 300 and update description
    const editRes = await fetch(`${baseUrl}/api/transactions/${txId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        amount: 300,
        description: 'Test Updated Expense 300',
        date: '2026-10-15',
      }),
    });
    assert.equal(editRes.status, 200);
    const editData = await editRes.json();
    assert.equal(editData.transaction.amount, 300);
    assert.equal(editData.transaction.description, 'Test Updated Expense 300');

    // Verify balance adjusted by extra 50 (total -300 from initial)
    const accsAfterEdit = await (await fetch(`${baseUrl}/api/accounts`, { headers: { Authorization: `Bearer ${token}` } })).json();
    const updatedAcc2 = accsAfterEdit.accounts.find((a) => a.id === acc.id);
    assert.equal(Number(updatedAcc2.currentBalance), Number((initialBalance - 300).toFixed(2)));

    // 9. Clean up: Delete test transaction
    const delTxRes = await fetch(`${baseUrl}/api/transactions/${txId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    });
    assert.equal(delTxRes.status, 200);

    // Verify balance restored to initial balance
    const accsAfterDel = await (await fetch(`${baseUrl}/api/accounts`, { headers: { Authorization: `Bearer ${token}` } })).json();
    const updatedAcc3 = accsAfterDel.accounts.find((a) => a.id === acc.id);
    assert.equal(Number(updatedAcc3.currentBalance), Number(initialBalance.toFixed(2)));

    // 10. Clean up: Delete subcategory then parent category
    await fetch(`${baseUrl}/api/categories/${subCatId}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } });
    const delParentFinal = await fetch(`${baseUrl}/api/categories/${parentId}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } });
    assert.equal(delParentFinal.status, 200);
  });
});
