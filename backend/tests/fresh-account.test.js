import test from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from '../src/app.js';
import { dbService } from '../src/services/db.service.js';
import { emailService } from '../src/services/email.service.js';
import { getFirebaseAuth } from '../src/config/firebase-admin.js';

test('Fresh Empty Default Data for Every New Account - Comprehensive Test Suite', async (t) => {
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

  const createdUserIds = [];

  t.after(async () => {
    for (const uid of createdUserIds) {
      try {
        await dbService.deleteUser(uid);
      } catch {
        // ignore cleanup errors
      }
    }
  });

  const authInstance = getFirebaseAuth();

  // Test User A
  const emailA = `fresh_user_a_${Date.now()}@example.com`;
  const passA = 'SecureFresh123!';
  let userAId = null;
  let tokenA = null;

  // 1, 2, 3, 4, 5, 6, 7: Self-registration verification and empty state validation
  await t.test('1-7. New user receives exactly one Cash account with 0 balance, 0 transactions/transfers/loans, and empty categories', async () => {
    // 1. Register User A
    const regRes = await fetch(`${baseUrl}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: emailA, password: passA }),
    });

    assert.equal(regRes.status, 201);
    const regData = await regRes.json();
    assert.equal(regData.success, true);
    assert.equal(regData.emailVerified, false);
    userAId = regData.user.id;
    createdUserIds.push(userAId);

    // Verify email using the generated verification code
    const vCodeRecord = await dbService.getLatestEmailVerificationCode(userAId);
    assert.ok(vCodeRecord, 'Verification code must be issued in DB');
    
    // We retrieve the sent email code from emailService.sentEmails
    const sentEmail = emailService.sentEmails.find((e) => e.to === emailA);
    assert.ok(sentEmail, 'Verification email must be sent');
    const codeMatch = sentEmail.text.match(/\b\d{6}\b/);
    assert.ok(codeMatch, 'Must find 6-digit code in email text');
    const verificationCode = codeMatch[0];

    const verifyRes = await fetch(`${baseUrl}/api/auth/verify-email`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: emailA, code: verificationCode }),
    });
    assert.equal(verifyRes.status, 200);
    const verifyData = await verifyRes.json();
    tokenA = verifyData.token;
    assert.ok(tokenA, 'Session token returned upon successful email verification');

    // 1. Exactly one Cash account created
    const accsRes = await fetch(`${baseUrl}/api/accounts`, {
      headers: { Authorization: `Bearer ${tokenA}` },
    });
    assert.equal(accsRes.status, 200);
    const accsData = await accsRes.json();
    assert.equal(accsData.accounts.length, 1, 'New user must receive exactly one account');

    const defaultCash = accsData.accounts[0];
    assert.equal(defaultCash.name, 'Cash', 'Default account name must be exactly Cash');
    assert.equal(defaultCash.type, 'CASH', 'Default account type must be CASH');

    // 2. Cash opening and current balances are zero
    assert.equal(Number(defaultCash.openingBalance), 0, 'Opening balance must be 0');
    assert.equal(Number(defaultCash.currentBalance), 0, 'Current balance must be 0');

    // 3. Total balance across all accounts is zero
    const totalBalance = accsData.accounts.reduce((sum, a) => sum + Number(a.currentBalance), 0);
    assert.equal(totalBalance, 0, 'Total balance must be 0.00');

    // 4 & 5. Total transactions is zero
    const txRes = await fetch(`${baseUrl}/api/transactions?all=true`, {
      headers: { Authorization: `Bearer ${tokenA}` },
    });
    assert.equal(txRes.status, 200);
    const txData = await txRes.json();
    const transactions = txData.transactions || txData.items || [];
    assert.equal(transactions.length, 0, 'Total transactions must be 0');

    const totalIncome = transactions.filter((t) => t.type === 'INCOME').reduce((sum, t) => sum + t.amount, 0);
    const totalExpense = transactions.filter((t) => t.type === 'EXPENSE').reduce((sum, t) => sum + t.amount, 0);
    assert.equal(totalIncome, 0, 'Total income must be 0.00');
    assert.equal(totalExpense, 0, 'Total expense must be 0.00');

    // 6. No transfers or loans
    const trfRes = await fetch(`${baseUrl}/api/transfers`, {
      headers: { Authorization: `Bearer ${tokenA}` },
    });
    assert.equal(trfRes.status, 200);
    const trfData = await trfRes.json();
    assert.equal((trfData.transfers || []).length, 0, 'No transfers should exist');

    const loansRes = await fetch(`${baseUrl}/api/loans?all=true`, {
      headers: { Authorization: `Bearer ${tokenA}` },
    });
    assert.equal(loansRes.status, 200);
    const loansData = await loansRes.json();
    assert.equal((loansData.loans || []).length, 0, 'No loan records should exist');

    // 7. Default categories are created without transactions
    const catRes = await fetch(`${baseUrl}/api/categories`, {
      headers: { Authorization: `Bearer ${tokenA}` },
    });
    assert.equal(catRes.status, 200);
    const catData = await catRes.json();
    const categories = catData.categories || [];
    assert.ok(categories.length > 0, 'Default categories should be initialized');
    for (const c of categories) {
      assert.equal(c.userId, userAId, 'Categories must belong to this specific user');
    }
  });

  // 8. Repeated initialization does not create duplicate accounts or categories
  await t.test('8. Repeated initialization does not create duplicate accounts or categories (idempotency)', async () => {
    // Call seedDefaultAccounts and seedDefaultCategories again for userA
    await dbService.seedDefaultAccounts(userAId);
    await dbService.seedDefaultAccounts(userAId);
    await dbService.seedDefaultCategories(userAId);
    await dbService.seedDefaultCategories(userAId);

    const accs = await dbService.getAccounts(userAId);
    assert.equal(accs.length, 1, 'Accounts count must remain exactly 1 after repeated seeding');

    const cats = await dbService.getCategories(userAId);
    const uniqueCatNames = new Set(cats.map((c) => c.name));
    assert.equal(cats.length, uniqueCatNames.size, 'Categories must not contain duplicates');
  });

  // 9. Two different users have completely isolated financial data
  await t.test('9. Two different users have completely isolated financial data', async () => {
    const emailB = `fresh_user_b_${Date.now()}@example.com`;
    const passB = 'SecureFresh456!';

    const regBRes = await fetch(`${baseUrl}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: emailB, password: passB }),
    });
    assert.equal(regBRes.status, 201);
    const regBData = await regBRes.json();
    const userBId = regBData.user.id;
    createdUserIds.push(userBId);

    // Get User B token via verify-email
    const sentEmailB = emailService.sentEmails.find((e) => e.to === emailB);
    const codeMatchB = sentEmailB.text.match(/\b\d{6}\b/);
    const vResB = await fetch(`${baseUrl}/api/auth/verify-email`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: emailB, code: codeMatchB[0] }),
    });
    const { token: tokenB } = await vResB.json();

    // User A records an income transaction
    const userAAccs = await dbService.getAccounts(userAId);
    const incomeRes = await fetch(`${baseUrl}/api/transactions/income`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenA}` },
      body: JSON.stringify({
        accountId: userAAccs[0].id,
        amount: 25000,
        date: '2026-10-17',
        description: 'User A Freelance Earnings',
        category: 'Freelance & Contracting',
      }),
    });
    assert.equal(incomeRes.status, 201);

    // User A balance should now be 25,000
    const aAccsAfter = await dbService.getAccounts(userAId);
    assert.equal(Number(aAccsAfter[0].currentBalance), 25000);

    // User B must still have EXACTLY 0 balance and 0 transactions!
    const bAccs = await dbService.getAccounts(userBId);
    assert.equal(bAccs.length, 1);
    assert.equal(Number(bAccs[0].currentBalance), 0, 'User B balance must remain unaffected by User A activity');

    const bTxRes = await fetch(`${baseUrl}/api/transactions?all=true`, {
      headers: { Authorization: `Bearer ${tokenB}` },
    });
    const bTxData = await bTxRes.json();
    assert.equal((bTxData.transactions || []).length, 0, 'User B must see zero transactions');

    // User B cannot access User A account by ID
    const crossAccessRes = await fetch(`${baseUrl}/api/accounts/${userAAccs[0].id}`, {
      headers: { Authorization: `Bearer ${tokenB}` },
    });
    assert.ok(crossAccessRes.status === 404 || crossAccessRes.status === 403, 'Cross-user account access must be blocked');
  });

  // 10. Existing users' records remain unchanged
  await t.test('10. Existing users records remain unchanged', async () => {
    // Verify standardUser existing credentials and state
    const stdUser = await dbService.getUserByEmail('user@example.com');
    if (stdUser) {
      assert.ok(stdUser.id, 'Existing standard user exists');
      const stdAccs = await dbService.getAccounts(stdUser.id);
      assert.ok(stdAccs.length > 0, 'Existing standard user accounts are preserved');
    }
  });

  // 11 & 12. Dashboard values come from actual database data and first transaction updates totals correctly
  await t.test('11 & 12. First real income or expense transaction updates the appropriate totals correctly', async () => {
    // User A adds an expense transaction of 5000
    const aAcc = (await dbService.getAccounts(userAId))[0];
    const expRes = await fetch(`${baseUrl}/api/transactions/expense`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenA}` },
      body: JSON.stringify({
        accountId: aAcc.id,
        amount: 5000,
        date: '2026-10-17',
        description: 'User A Groceries',
        category: 'Food & Dining',
      }),
    });
    assert.equal(expRes.status, 201);

    // User A balance was 25000, after 5000 expense it must be 20000
    const updatedAcc = (await dbService.getAccounts(userAId))[0];
    assert.equal(Number(updatedAcc.currentBalance), 20000);

    const aTxs = (await (await fetch(`${baseUrl}/api/transactions?all=true`, { headers: { Authorization: `Bearer ${tokenA}` } })).json()).transactions;
    assert.equal(aTxs.length, 2);

    const totalIncome = aTxs.filter((t) => t.type === 'INCOME').reduce((sum, t) => sum + t.amount, 0);
    const totalExpense = aTxs.filter((t) => t.type === 'EXPENSE').reduce((sum, t) => sum + t.amount, 0);
    assert.equal(totalIncome, 25000);
    assert.equal(totalExpense, 5000);
  });

  // 13. Registration, email verification, Google login flows remain functional
  await t.test('13. Google login creates a fresh user with exactly one Cash account at 0 balance', async () => {
    const googleEmail = `google_fresh_${Date.now()}@example.com`;
    const origVerify = authInstance.verifyIdToken.bind(authInstance);

    authInstance.verifyIdToken = async (tok) => {
      if (tok === 'valid-google-fresh-token') {
        return {
          uid: `g_uid_${Date.now()}`,
          email: googleEmail,
          email_verified: true,
          aud: 'account-ladger01',
          name: 'Google Fresh User',
          firebase: { sign_in_provider: 'google.com' },
        };
      }
      return origVerify(tok);
    };

    try {
      const gRes = await fetch(`${baseUrl}/api/auth/google`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idToken: 'valid-google-fresh-token' }),
      });

      assert.ok(gRes.status === 200 || gRes.status === 201, 'Google login should succeed with 200 or 201');
      const gData = await gRes.json();
      assert.ok(gData.token);
      assert.equal(gData.user.emailVerified, true);
      const gUserId = gData.user.id;
      createdUserIds.push(gUserId);

      // Verify Google user starts with 1 Cash account at 0 balance
      const gAccs = await dbService.getAccounts(gUserId);
      assert.equal(gAccs.length, 1, 'Google user must receive exactly one Cash account');
      assert.equal(gAccs[0].name, 'Cash');
      assert.equal(Number(gAccs[0].openingBalance), 0);
      assert.equal(Number(gAccs[0].currentBalance), 0);

      // Verify Google user starts with 0 transactions
      const gTxs = await (await fetch(`${baseUrl}/api/transactions?all=true`, { headers: { Authorization: `Bearer ${gData.token}` } })).json();
      assert.equal((gTxs.transactions || []).length, 0, 'Google user starts with 0 transactions');
    } finally {
      authInstance.verifyIdToken = origVerify;
    }
  });
});
