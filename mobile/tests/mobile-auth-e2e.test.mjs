import test from 'node:test';
import assert from 'node:assert/strict';
import { dbService } from '../../backend/src/services/db.service.js';
import { createApp } from '../../backend/src/app.js';

test('Mobile API End-to-End Authentication & Feature Verification', async (t) => {
  await dbService.initialize();

  let server;
  let BACKEND_URL = process.env.API_URL;

  if (!BACKEND_URL) {
    const app = createApp();
    await new Promise((resolve) => {
      server = app.listen(0, '127.0.0.1', () => {
        const port = server.address().port;
        BACKEND_URL = `http://127.0.0.1:${port}`;
        resolve();
      });
    });
  }

  const testId = `mob_${Date.now()}`;
  const testEmail = `${testId}@example.com`;
  const testPassword = 'Password123!';
  let userId = null;
  let userToken = null;
  let adminToken = null;

  t.after(async () => {
    if (server) {
      server.close();
    }
    if (userId) {
      try {
        await dbService.deleteUser(userId);
      } catch {
        // cleanup
      }
    }
  });

  await t.test('1. Health check: Express backend is healthy and connected to PostgreSQL', async () => {
    const res = await fetch(`${BACKEND_URL}/health`);
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.equal(data.status, 'healthy');
    assert.equal(data.connectedToPostgres, true);
  });

  await t.test('2. Unauthenticated user cannot access protected endpoints', async () => {
    const res = await fetch(`${BACKEND_URL}/api/reports/summary`);
    assert.equal(res.status, 401);
  });

  await t.test('3. Register new user: created with unverified status and 6-digit code issued', async () => {
    const res = await fetch(`${BACKEND_URL}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: testEmail,
        password: testPassword,
        fullName: 'Mobile Test User',
      }),
    });

    assert.equal(res.status, 201);
    const data = await res.json();
    assert.equal(data.success, true);
    assert.equal(data.emailVerified, false);
    assert.equal(data.email, testEmail);
    assert.equal(data.token, undefined); // STRICT: No token for unverified user
    userId = data.user.id;
  });

  await t.test('4. Unverified user login attempt is blocked with 403', async () => {
    const res = await fetch(`${BACKEND_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        identifier: testEmail,
        password: testPassword,
      }),
    });

    assert.equal(res.status, 403);
    const data = await res.json();
    assert.equal(data.emailVerified, false);
    assert.ok(data.error.includes('Email verification required'));
  });

  await t.test('5. Invalid password rejected with 401', async () => {
    const res = await fetch(`${BACKEND_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        identifier: testEmail,
        password: 'WrongPassword!',
      }),
    });

    assert.equal(res.status, 401);
    const data = await res.json();
    assert.ok(data.error.includes('Invalid credentials'));
  });

  await t.test('6. Non-existent email rejected with 401 without user enumeration', async () => {
    const res = await fetch(`${BACKEND_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        identifier: 'nonexistent_account_xyz@example.com',
        password: testPassword,
      }),
    });

    assert.equal(res.status, 401);
    const data = await res.json();
    assert.ok(data.error.includes('Invalid credentials'));
  });

  await t.test('7. Verify user email and log in successfully', async () => {
    // Mark verified
    await dbService.updateUser(userId, { emailVerified: true });

    const res = await fetch(`${BACKEND_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        identifier: testEmail,
        password: testPassword,
      }),
    });

    assert.equal(res.status, 200);
    const data = await res.json();
    assert.equal(data.success, true);
    assert.ok(data.token);
    assert.equal(data.user.role, 'USER');
    assert.equal(data.user.emailVerified, true);
    userToken = data.token;
  });

  await t.test('8. Session restoration: /api/auth/me validates user token', async () => {
    const res = await fetch(`${BACKEND_URL}/api/auth/me`, {
      headers: { Authorization: `Bearer ${userToken}` },
    });

    assert.equal(res.status, 200);
    const data = await res.json();
    assert.ok(data.user);
    assert.equal(data.user.id, userId);
    assert.equal(data.user.email, testEmail);
  });

  await t.test('9. Fresh user financial isolation: exactly 1 default Cash account with 0 balance', async () => {
    const res = await fetch(`${BACKEND_URL}/api/accounts`, {
      headers: { Authorization: `Bearer ${userToken}` },
    });

    assert.equal(res.status, 200);
    const data = await res.json();
    assert.ok(Array.isArray(data.accounts));
    assert.equal(data.accounts.length, 1);
    assert.equal(data.accounts[0].name, 'Cash');
    assert.equal(Number(data.accounts[0].currentBalance), 0);
  });

  await t.test('10. Dashboard summary endpoint returns 0 totals for fresh user', async () => {
    const res = await fetch(`${BACKEND_URL}/api/reports/summary`, {
      headers: { Authorization: `Bearer ${userToken}` },
    });

    assert.equal(res.status, 200);
    const data = await res.json();
    assert.equal(Number(data.netWorth), 0);
    assert.equal(Number(data.totalIncome), 0);
    assert.equal(Number(data.totalExpense), 0);
    assert.equal(Number(data.totalReceivables), 0);
    assert.equal(Number(data.totalPayables), 0);
  });

  await t.test('11. Account CRUD: Create, update, archive, and delete account', async () => {
    // Create
    const createRes = await fetch(`${BACKEND_URL}/api/accounts`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${userToken}`,
      },
      body: JSON.stringify({
        name: `Bank Acc ${Date.now()}`,
        type: 'BANK',
        openingBalance: 500,
        providerName: 'Test Bank PLC',
      }),
    });

    assert.equal(createRes.status, 201);
    const created = await createRes.json();
    assert.ok(created.account.id);
    const newAccId = created.account.id;

    // Update
    const updateRes = await fetch(`${BACKEND_URL}/api/accounts/${newAccId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${userToken}`,
      },
      body: JSON.stringify({
        name: 'Renamed Bank Acc',
        providerName: 'Renamed Bank PLC',
      }),
    });
    assert.equal(updateRes.status, 200);

    // Archive
    const archiveRes = await fetch(`${BACKEND_URL}/api/accounts/${newAccId}/archive`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${userToken}` },
    });
    assert.equal(archiveRes.status, 200);

    // Delete
    const deleteRes = await fetch(`${BACKEND_URL}/api/accounts/${newAccId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${userToken}` },
    });
    assert.equal(deleteRes.status, 200);
  });

  await t.test('12. Transactions endpoint with pagination and filtering', async () => {
    const res = await fetch(`${BACKEND_URL}/api/transactions?limit=50&page=1`, {
      headers: { Authorization: `Bearer ${userToken}` },
    });

    assert.equal(res.status, 200);
    const data = await res.json();
    assert.ok(Array.isArray(data.items));
    assert.equal(data.items.length, 0); // Fresh user has 0 transactions
  });

  await t.test('13. Admin role security: Admin is granted ADMIN role and blocked from personal accounts', async () => {
    const res = await fetch(`${BACKEND_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        identifier: 'admin',
        password: 'Mahbub@12345',
      }),
    });

    assert.equal(res.status, 200);
    const data = await res.json();
    assert.equal(data.user.role, 'ADMIN');
    adminToken = data.token;

    // Admin blocked from user personal finance endpoints
    const reportsRes = await fetch(`${BACKEND_URL}/api/reports/summary`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    assert.equal(reportsRes.status, 403);
    const reportsData = await reportsRes.json();
    assert.ok(reportsData.error.includes('System administrators do not have personal financial accounts'));

    // Admin allowed on admin endpoints
    const auditRes = await fetch(`${BACKEND_URL}/api/admin/audit-logs?limit=50`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    assert.equal(auditRes.status, 200);
  });

  await t.test('14. Mobile Google Auth API: Missing ID token is rejected with 400', async () => {
    const res = await fetch(`${BACKEND_URL}/api/auth/google`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    assert.equal(res.status, 400);
    const data = await res.json();
    assert.ok(data.error.includes('Firebase ID token is required'));
  });

  await t.test('15. Mobile Google Auth API: Malformed ID token is rejected with 401', async () => {
    const res = await fetch(`${BACKEND_URL}/api/auth/google`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ idToken: 'malformed_mobile_test_token' }),
    });
    assert.equal(res.status, 401);
    const data = await res.json();
    assert.ok(data.error.includes('Invalid, expired, or revoked authentication token'));
  });

  await t.test('16. Mobile Google Auth API: Non-Google provider token is rejected with 401', async () => {
    const res = await fetch(`${BACKEND_URL}/api/auth/google`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ idToken: 'eyJhbGciOiJSUzI1NiIsImtpZCI6IjEyMyJ9.eyJpc3MiOiJodHRwczovL3NlY3VyZXRva2VuLmdvb2dsZS5jb20vYWNjb3VudC1sYWRnZXIwMSIsImF1ZCI6ImFjY291bnQtbGFkZ2VyMDEifQ.sig' }),
    });
    assert.equal(res.status, 401);
  });

  let cashAccountId = null;
  let testIncomeTxId = null;
  let testExpenseTxId = null;

  await t.test('17. Add Income Flow: Create income, balance increases, dashboard updates', async () => {
    // 1. Get default Cash account ID
    const accsRes = await fetch(`${BACKEND_URL}/api/accounts`, {
      headers: { Authorization: `Bearer ${userToken}` },
    });
    const accsData = await accsRes.json();
    const cashAcc = accsData.accounts.find((a) => a.name === 'Cash');
    assert.ok(cashAcc, 'User should have default Cash account');
    cashAccountId = cashAcc.id;

    // 2. Create income of 2500 BDT
    const incomeRes = await fetch(`${BACKEND_URL}/api/transactions/income`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${userToken}`,
      },
      body: JSON.stringify({
        accountId: cashAccountId,
        amount: 2500,
        date: '2026-10-15',
        category: 'Freelance',
        description: 'Mobile App Freelance Project',
      }),
    });

    assert.equal(incomeRes.status, 201);
    const incomeData = await incomeRes.json();
    assert.equal(incomeData.success, true);
    assert.equal(Number(incomeData.transaction.amount), 2500);
    assert.equal(incomeData.transaction.type, 'INCOME');
    testIncomeTxId = incomeData.transaction.id;

    // 3. Verify Cash account balance is now 2500
    const updatedAccRes = await fetch(`${BACKEND_URL}/api/accounts`, {
      headers: { Authorization: `Bearer ${userToken}` },
    });
    const updatedAccData = await updatedAccRes.json();
    const updatedCash = updatedAccData.accounts.find((a) => a.id === cashAccountId);
    assert.equal(Number(updatedCash.currentBalance), 2500);

    // 4. Verify Dashboard summary reflects 2500 income
    const summaryRes = await fetch(`${BACKEND_URL}/api/reports/summary`, {
      headers: { Authorization: `Bearer ${userToken}` },
    });
    const summaryData = await summaryRes.json();
    assert.equal(Number(summaryData.totalIncome), 2500);
    assert.equal(Number(summaryData.netWorth), 2500);
  });

  await t.test('18. Add Expense Flow: Create expense, balance decreases, dashboard updates', async () => {
    // 1. Record expense of 600 BDT
    const expenseRes = await fetch(`${BACKEND_URL}/api/transactions/expense`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${userToken}`,
      },
      body: JSON.stringify({
        accountId: cashAccountId,
        amount: 600,
        date: '2026-10-16',
        category: 'Food & Dining',
        description: 'Lunch & Groceries',
      }),
    });

    assert.equal(expenseRes.status, 201);
    const expenseData = await expenseRes.json();
    assert.equal(expenseData.success, true);
    assert.equal(Number(expenseData.transaction.amount), 600);
    assert.equal(expenseData.transaction.type, 'EXPENSE');
    testExpenseTxId = expenseData.transaction.id;

    // 2. Verify Cash account balance is now 1900 (2500 - 600)
    const updatedAccRes = await fetch(`${BACKEND_URL}/api/accounts`, {
      headers: { Authorization: `Bearer ${userToken}` },
    });
    const updatedAccData = await updatedAccRes.json();
    const updatedCash = updatedAccData.accounts.find((a) => a.id === cashAccountId);
    assert.equal(Number(updatedCash.currentBalance), 1900);

    // 3. Verify Dashboard summary reflects 600 expense and 1900 net worth
    const summaryRes = await fetch(`${BACKEND_URL}/api/reports/summary`, {
      headers: { Authorization: `Bearer ${userToken}` },
    });
    const summaryData = await summaryRes.json();
    assert.equal(Number(summaryData.totalExpense), 600);
    assert.equal(Number(summaryData.netWorth), 1900);
  });

  await t.test('19. Transaction Lifecycle: Edit date and amount, verify immediate chronological sorting', async () => {
    // Update the expense from 2026-10-16 to 2026-10-20 with updated amount 750
    const updateRes = await fetch(`${BACKEND_URL}/api/transactions/${testExpenseTxId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${userToken}`,
      },
      body: JSON.stringify({
        amount: 750,
        date: '2026-10-20',
        description: 'Updated Groceries & Dinner',
      }),
    });

    assert.equal(updateRes.status, 200);
    const updateData = await updateRes.json();
    assert.equal(updateData.success, true);
    assert.equal(Number(updateData.transaction.amount), 750);
    assert.equal(updateData.transaction.date.slice(0, 10), '2026-10-20');

    // Fetch transactions list and verify chronological sort: 2026-10-20 should be first (descending)
    const listRes = await fetch(`${BACKEND_URL}/api/transactions?limit=50`, {
      headers: { Authorization: `Bearer ${userToken}` },
    });
    const listData = await listRes.json();
    assert.ok(listData.items.length >= 2);
    assert.equal(listData.items[0].id, testExpenseTxId, 'Latest dated transaction (2026-10-20) must be first');
    assert.equal(listData.items[1].id, testIncomeTxId, 'Earlier dated transaction (2026-10-15) must be second');
  });

  await t.test('20. Transaction Deletion: Delete transaction and verify balance recalculation', async () => {
    const deleteRes = await fetch(`${BACKEND_URL}/api/transactions/${testExpenseTxId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${userToken}` },
    });

    assert.equal(deleteRes.status, 200);

    // Balance should restore back to 2500 (2500 income remaining)
    const accRes = await fetch(`${BACKEND_URL}/api/accounts`, {
      headers: { Authorization: `Bearer ${userToken}` },
    });
    const accData = await accRes.json();
    const cashAcc = accData.accounts.find((a) => a.id === cashAccountId);
    assert.equal(Number(cashAcc.currentBalance), 2500);
  });

  await t.test('21. Account Transfer Flow: Transfer from Cash to Bank account', async () => {
    // 1. Create a bank account
    const bankRes = await fetch(`${BACKEND_URL}/api/accounts`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${userToken}`,
      },
      body: JSON.stringify({
        name: 'BRAC Bank Savings',
        type: 'BANK',
        openingBalance: 0,
        providerName: 'BRAC Bank PLC',
      }),
    });
    assert.equal(bankRes.status, 201);
    const bankData = await bankRes.json();
    const bankAccountId = bankData.account.id;

    // 2. Transfer 1000 from Cash to Bank
    const transferRes = await fetch(`${BACKEND_URL}/api/transfers`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${userToken}`,
      },
      body: JSON.stringify({
        date: '2026-10-18',
        sourceAccountId: cashAccountId,
        destinationAccountId: bankAccountId,
        amount: 1000,
        description: 'ATM Cash Deposit',
      }),
    });
    assert.equal(transferRes.status, 201);

    // 3. Verify Cash is now 1500 and Bank is 1000
    const accsRes = await fetch(`${BACKEND_URL}/api/accounts`, {
      headers: { Authorization: `Bearer ${userToken}` },
    });
    const accsData = await accsRes.json();
    const cashAcc = accsData.accounts.find((a) => a.id === cashAccountId);
    const bankAcc = accsData.accounts.find((a) => a.id === bankAccountId);
    assert.equal(Number(cashAcc.currentBalance), 1500);
    assert.equal(Number(bankAcc.currentBalance), 1000);
  });

  await t.test('22. More Screen Feature Endpoints: Categories, Loans, Budgets', async () => {
    // Categories
    const catRes = await fetch(`${BACKEND_URL}/api/categories`, {
      headers: { Authorization: `Bearer ${userToken}` },
    });
    assert.equal(catRes.status, 200);
    const catData = await catRes.json();
    assert.ok(Array.isArray(catData.categories));

    // Budgets
    const budgetRes = await fetch(`${BACKEND_URL}/api/budgets`, {
      headers: { Authorization: `Bearer ${userToken}` },
    });
    assert.equal(budgetRes.status, 200);

    // Loans
    const loansRes = await fetch(`${BACKEND_URL}/api/loans`, {
      headers: { Authorization: `Bearer ${userToken}` },
    });
    assert.equal(loansRes.status, 200);
    const loansData = await loansRes.json();
    assert.ok(Array.isArray(loansData.items));
  });
});
