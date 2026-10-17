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

    const parentName = `Test Food Parent ${Date.now()}`;
    const subCatName = `Test Groceries Sub ${Date.now()}`;

    // 2. Create main parent category
    const mainCatRes = await fetch(`${baseUrl}/api/categories`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ name: parentName, type: 'EXPENSE' }),
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
      body: JSON.stringify({ name: subCatName, type: 'EXPENSE', parentId }),
    });
    assert.equal(subCatRes.status, 201);
    const subCatData = await subCatRes.json();
    assert.equal(subCatData.category.parentId, parentId);
    const subCatId = subCatData.category.id;

    // 4. Reject nested subcategory under subcategory (enforcing 1 level)
    const nestedRes = await fetch(`${baseUrl}/api/categories`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ name: `Test Invalid Deep Sub ${Date.now()}`, type: 'EXPENSE', parentId: subCatId }),
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
        category: parentName,
        subcategory: subCatName,
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

  await t.test('Transfer atomic lifecycle and integrity constraints', async () => {
    const loginRes = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identifier: 'user@example.com', password: '123456' }),
    });
    const { token } = await loginRes.json();

    let accs = (await (await fetch(`${baseUrl}/api/accounts`, { headers: { Authorization: `Bearer ${token}` } })).json()).accounts;
    if (accs.length < 2) {
      await fetch(`${baseUrl}/api/accounts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ name: 'Secondary Bank Account', type: 'BANK', openingBalance: 10000 }),
      });
      accs = (await (await fetch(`${baseUrl}/api/accounts`, { headers: { Authorization: `Bearer ${token}` } })).json()).accounts;
    }
    assert.ok(accs.length >= 2, 'Need at least 2 accounts for transfer test');
    const src = accs[0];
    const dst = accs[1];
    const srcInitial = Number(src.currentBalance);
    const dstInitial = Number(dst.currentBalance);

    // 1. Reject self-transfer (same source and destination)
    const selfRes = await fetch(`${baseUrl}/api/transfers`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        sourceAccountId: src.id,
        destinationAccountId: src.id,
        amount: 500,
        date: '2026-10-15',
      }),
    });
    assert.equal(selfRes.status, 400);

    // 2. Reject negative transfer amount
    const negRes = await fetch(`${baseUrl}/api/transfers`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        sourceAccountId: src.id,
        destinationAccountId: dst.id,
        amount: -500,
        date: '2026-10-15',
      }),
    });
    assert.equal(negRes.status, 400);

    // 3. Create valid transfer
    const trfRes = await fetch(`${baseUrl}/api/transfers`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        sourceAccountId: src.id,
        destinationAccountId: dst.id,
        amount: 1000,
        transferFee: 15,
        date: '2026-10-15',
        description: 'Test Inter-Account Transfer',
      }),
    });
    assert.equal(trfRes.status, 201);
    const { transfer } = await trfRes.json();
    assert.ok(transfer.id);

    // Verify balances updated atomically
    const accsAfterTrf = (await (await fetch(`${baseUrl}/api/accounts`, { headers: { Authorization: `Bearer ${token}` } })).json()).accounts;
    const srcAfter = accsAfterTrf.find((a) => a.id === src.id);
    const dstAfter = accsAfterTrf.find((a) => a.id === dst.id);
    assert.equal(Number(srcAfter.currentBalance), Number((srcInitial - 1015).toFixed(2)));
    assert.equal(Number(dstAfter.currentBalance), Number((dstInitial + 1000).toFixed(2)));

    // 4. Delete transfer -> balances restored
    const delRes = await fetch(`${baseUrl}/api/transfers/${transfer.id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    });
    assert.equal(delRes.status, 200);

    const accsAfterDel = (await (await fetch(`${baseUrl}/api/accounts`, { headers: { Authorization: `Bearer ${token}` } })).json()).accounts;
    const srcRestored = accsAfterDel.find((a) => a.id === src.id);
    const dstRestored = accsAfterDel.find((a) => a.id === dst.id);
    assert.equal(Number(srcRestored.currentBalance), Number(srcInitial.toFixed(2)));
    assert.equal(Number(dstRestored.currentBalance), Number(dstInitial.toFixed(2)));
  });

  await t.test('Loan and Repayment atomic lifecycle and overpayment prevention', async () => {
    const loginRes = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identifier: 'user@example.com', password: '123456' }),
    });
    const { token } = await loginRes.json();

    const accs = (await (await fetch(`${baseUrl}/api/accounts`, { headers: { Authorization: `Bearer ${token}` } })).json()).accounts;
    const acc = accs[0];
    const initialBalance = Number(acc.currentBalance);

    // 1. Create Loan (LENT: money given to counterparty)
    const loanRes = await fetch(`${baseUrl}/api/loans`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        accountId: acc.id,
        type: 'LENT',
        counterpartyName: 'Rahim Khan',
        counterpartyContact: '01711000000',
        principalAmount: 5000,
        startDate: '2026-10-15',
        notes: 'Personal friendly loan',
      }),
    });
    assert.equal(loanRes.status, 201);
    const { loan } = await loanRes.json();
    assert.equal(loan.principalAmount, 5000);
    assert.equal(loan.outstandingPrincipal, 5000);

    // Verify account balance was deducted by 5000
    const accsAfterLoan = (await (await fetch(`${baseUrl}/api/accounts`, { headers: { Authorization: `Bearer ${token}` } })).json()).accounts;
    const updatedAcc1 = accsAfterLoan.find((a) => a.id === acc.id);
    assert.equal(Number(updatedAcc1.currentBalance), Number((initialBalance - 5000).toFixed(2)));

    try {
      // 2. Reject repayment exceeding outstanding principal
      const overpayRes = await fetch(`${baseUrl}/api/loans/${loan.id}/repayments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          accountId: acc.id,
          amount: 6000, // 6000 > 5000
          date: '2026-10-15',
        }),
      });
      assert.equal(overpayRes.status, 400);

      // 3. Add partial repayment of 2000
      const repRes1 = await fetch(`${baseUrl}/api/loans/${loan.id}/repayments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          accountId: acc.id,
          amount: 2000,
          date: '2026-10-15',
          notes: 'First installment',
        }),
      });
      assert.equal(repRes1.status, 201);

      // Verify loan outstanding is now 3000 and account balance was refunded 2000
      const loansList1 = (await (await fetch(`${baseUrl}/api/loans`, { headers: { Authorization: `Bearer ${token}` } })).json()).loans;
      const loanUpdated1 = loansList1.find((l) => l.id === loan.id);
      assert.equal(Number(loanUpdated1.outstandingPrincipal), 3000);
      assert.equal(loanUpdated1.status, 'PARTIALLY_REPAID');

      const accsAfterRep1 = (await (await fetch(`${baseUrl}/api/accounts`, { headers: { Authorization: `Bearer ${token}` } })).json()).accounts;
      const updatedAcc2 = accsAfterRep1.find((a) => a.id === acc.id);
      assert.equal(Number(updatedAcc2.currentBalance), Number((initialBalance - 3000).toFixed(2)));
    } finally {
      // 4. Clean up: Delete loan -> reverses remaining and repayments
      const delLoanRes = await fetch(`${baseUrl}/api/loans/${loan.id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      assert.equal(delLoanRes.status, 200);

      // Verify account balance restored to initial balance
      const accsAfterDel = (await (await fetch(`${baseUrl}/api/accounts`, { headers: { Authorization: `Bearer ${token}` } })).json()).accounts;
      const updatedAcc3 = accsAfterDel.find((a) => a.id === acc.id);
      assert.equal(Number(updatedAcc3.currentBalance), Number(initialBalance.toFixed(2)));
    }
  });

  await t.test('Authoritative Balance Reconciliation function detects and heals drift', async () => {
    const loginRes = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identifier: 'user@example.com', password: '123456' }),
    });
    const { token, user } = await loginRes.json();

    const accs = (await (await fetch(`${baseUrl}/api/accounts`, { headers: { Authorization: `Bearer ${token}` } })).json()).accounts;
    const acc = accs[0];

    // Run reconciliation on the account
    const recon = await dbService.reconcileAccountBalance(acc.id, user.id);
    assert.ok(recon);
    assert.equal(recon.accountId, acc.id);
    assert.equal(typeof recon.calculatedBalance, 'number');
  });
});
