import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import { createApp } from '../src/app.js';
import { dbService } from '../src/services/db.service.js';
import { emailService } from '../src/services/email.service.js';
import { config } from '../src/config/env.js';

test('Password Reset & Forgot Password Complete Lifecycle Tests', async (t) => {
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

  // Setup dedicated test user
  const initialPassword = 'OriginalPassword123!';
  const updatedPassword = 'NewSecretPassword456#';
  const testEmail = `pwdreset_${Date.now()}@example.com`;

  const regRes = await fetch(`${baseUrl}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: testEmail, password: initialPassword }),
  });
  const regData = await regRes.json();
  assert.equal(regRes.status, 201);
  const testUserId = regData.user.id;
  const initialUserRole = regData.user.role;
  await dbService.markUserEmailVerified(testUserId);

  const loginRes = await fetch(`${baseUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ identifier: testEmail, password: initialPassword }),
  });
  const loginData = await loginRes.json();
  const sessionToken = loginData.token;
  assert.ok(sessionToken);

  // Create financial account to ensure reset never alters financial data
  const accRes = await fetch(`${baseUrl}/api/accounts`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${sessionToken}`,
    },
    body: JSON.stringify({ name: 'ResetTest Cash', type: 'CASH', openingBalance: 5000 }),
  });
  const accData = await accRes.json();
  const accountId = accData.account.id;

  let activeResetToken = null;

  await t.test('1. Forgot-password request for an existing email returns generic success and generates token', async () => {
    const prevCount = emailService.sentEmails.length;
    const res = await fetch(`${baseUrl}/api/auth/forgot-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: testEmail }),
    });

    assert.equal(res.status, 200);
    const data = await res.json();
    assert.equal(data.success, true);
    assert.ok(data.message.includes('If an account exists'));

    // Check email dispatch
    const sent = emailService.sentEmails.slice(prevCount);
    assert.ok(sent.length >= 1, 'Email must be recorded in sentEmails');
    const resetEmail = sent[sent.length - 1];
    assert.equal(resetEmail.to, testEmail);

    // Extract raw token from reset URL
    const match = resetEmail.text.match(/token=([a-f0-9]+)/);
    assert.ok(match && match[1], 'Reset URL must contain raw token');
    activeResetToken = match[1];

    // Verify token hash is stored in database, not the raw token
    const tokenHash = crypto.createHash('sha256').update(activeResetToken).digest('hex');
    const tokenRecord = await dbService.getPasswordResetTokenByHash(tokenHash);
    assert.ok(tokenRecord, 'Token hash must be stored in database');
    assert.equal(tokenRecord.userId, testUserId);
    assert.equal(tokenRecord.usedAt, null);
  });

  await t.test('2. Forgot-password request for an unknown email returns identical generic response without leaking', async () => {
    const unknownEmail = `unknown_${Date.now()}@nonexistent.domain`;
    const res = await fetch(`${baseUrl}/api/auth/forgot-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: unknownEmail }),
    });

    assert.equal(res.status, 200);
    const data = await res.json();
    assert.equal(data.success, true);
    assert.equal(
      data.message,
      'If an account exists for this email address, you will receive a password reset link shortly.'
    );
  });

  await t.test('3. Invalid email format is rejected with 400', async () => {
    const res = await fetch(`${baseUrl}/api/auth/forgot-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'not-an-email' }),
    });

    assert.equal(res.status, 400);
    const data = await res.json();
    assert.ok(data.error.includes('valid email address'));
  });

  await t.test('4. Token verification endpoint confirms token is valid', async () => {
    const res = await fetch(`${baseUrl}/api/auth/verify-reset-token?token=${activeResetToken}`);
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.equal(data.valid, true);
  });

  await t.test('5. Invalid token is rejected by reset-password and verify-reset-token', async () => {
    const invalidToken = 'deadbeef1234567890abcdef1234567890abcdef1234567890abcdef12345678';
    const verifyRes = await fetch(`${baseUrl}/api/auth/verify-reset-token?token=${invalidToken}`);
    assert.equal(verifyRes.status, 400);

    const resetRes = await fetch(`${baseUrl}/api/auth/reset-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: invalidToken, newPassword: 'SomePassword123!' }),
    });
    assert.equal(resetRes.status, 400);
    const data = await resetRes.json();
    assert.ok(data.error.includes('Invalid or unrecognized'));
  });

  await t.test('6. Expired token is rejected', async () => {
    // Register temporary user for expired token test so activeResetToken remains active
    const expEmail = `exp_${Date.now()}@example.com`;
    const expUserRes = await fetch(`${baseUrl}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: expEmail, password: 'password123' }),
    });
    const expUserData = await expUserRes.json();
    const expUserId = expUserData.user.id;

    const expiredRawToken = crypto.randomBytes(32).toString('hex');
    const expiredHash = crypto.createHash('sha256').update(expiredRawToken).digest('hex');
    await dbService.createPasswordResetToken({
      userId: expUserId,
      tokenHash: expiredHash,
      expiresAt: new Date(Date.now() - 60 * 1000), // 1 minute in the past
    });

    const verifyRes = await fetch(`${baseUrl}/api/auth/verify-reset-token?token=${expiredRawToken}`);
    assert.equal(verifyRes.status, 400);
    const data = await verifyRes.json();
    assert.ok(data.error.includes('expired'));

    await dbService.deleteUser(expUserId);
  });


  await t.test('7 & 8. Correct reset token updates password, and concurrent reset cannot both succeed', async () => {
    // Attempt two simultaneous redemptions with the same token
    const [res1, res2] = await Promise.all([
      fetch(`${baseUrl}/api/auth/reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: activeResetToken, newPassword: updatedPassword }),
      }),
      fetch(`${baseUrl}/api/auth/reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: activeResetToken, newPassword: 'ConcurrentPassword999!' }),
      }),
    ]);

    const statuses = [res1.status, res2.status];
    // Exactly one should succeed with 200, the other rejected with 400
    assert.ok(statuses.includes(200), 'One request must succeed');
    assert.ok(statuses.includes(400), 'Second concurrent request must fail');

    const successRes = res1.status === 200 ? res1 : res2;
    const succData = await successRes.json();
    assert.equal(succData.success, true);
  });

  await t.test('7b. Reused token is rejected', async () => {
    const res = await fetch(`${baseUrl}/api/auth/reset-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: activeResetToken, newPassword: 'AnotherPassword789!' }),
    });
    assert.equal(res.status, 400);
    const data = await res.json();
    assert.ok(data.error.includes('already been used') || data.error.includes('expired'));
  });

  await t.test('9. New password works with normal email/password login', async () => {
    const res = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identifier: testEmail, password: updatedPassword }),
    });
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.equal(data.success, true);
    assert.equal(data.user.email, testEmail);
  });

  await t.test('10. Old password no longer works after reset', async () => {
    const res = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identifier: testEmail, password: initialPassword }),
    });
    assert.equal(res.status, 401);
  });

  await t.test('11. Password reset does not modify user roles, accounts, or financial records', async () => {
    const userInDb = await dbService.getUserById(testUserId);
    assert.equal(userInDb.role, initialUserRole, 'Role must remain USER');
    assert.notEqual(userInDb.role, 'SYSTEM_ADMIN', 'Never elevate role to SYSTEM_ADMIN');

    const accounts = await dbService.getAccounts(testUserId);
    const testAccount = accounts.find((a) => a.id === accountId);
    assert.ok(testAccount, 'Financial accounts must remain intact');
    assert.equal(Number(testAccount.openingBalance), 5000);
  });

  await t.test('12. Reset URL uses configured frontend origin and safe structure', async () => {
    const recentEmail = emailService.sentEmails.findLast((e) => e.to === testEmail && e.subject.includes('Reset'));
    assert.ok(recentEmail);
    assert.ok(
      recentEmail.html.includes(config.frontendUrl) || recentEmail.html.includes('http://localhost:5000'),
      'Reset link must point to configured frontend URL'
    );
    assert.ok(recentEmail.html.includes('/reset-password?token='));
  });

  await t.test('13. Rate limiting blocks excessive requests with 429', async () => {
    const spamEmail = `spam_${Date.now()}@example.com`;
    // We already made some requests. Send rapid requests to trigger limit.
    const requests = [];
    for (let i = 0; i < 7; i++) {
      requests.push(
        fetch(`${baseUrl}/api/auth/forgot-password`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: spamEmail }),
        })
      );
    }
    const responses = await Promise.all(requests);
    const rateLimited = responses.some((r) => r.status === 429);
    assert.ok(rateLimited, 'Excessive requests must trigger HTTP 429 rate limit');
  });

  // Cleanup test user
  await dbService.deleteUser(testUserId);
});
