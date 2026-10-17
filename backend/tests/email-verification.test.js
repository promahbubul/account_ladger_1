import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'crypto';
import { createApp } from '../src/app.js';
import { dbService } from '../src/services/db.service.js';
import { emailService } from '../src/services/email.service.js';
import { getFirebaseAuth } from '../src/config/firebase-admin.js';
import { generateToken } from '../src/middleware/auth.js';

test('Mandatory Email Verification & Google OAuth Exception - Complete Test Suite', async (t) => {
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

  const authInstance = getFirebaseAuth();
  const createdUserIds = [];

  t.after(async () => {
    for (const uid of createdUserIds) {
      try {
        await dbService.deleteUser(uid);
      } catch {
        // Ignore cleanup errors
      }
    }
  });

  // Scenario 1 & 2: Email/password registration creates unverified account & sends verification code email
  let testUser1Id = null;
  const testEmail1 = `verify_test_${Date.now()}_1@example.com`;
  const testPassword1 = 'SecurePass123!';
  let latestCode1 = null;

  await t.test('1 & 2. Email/password registration creates unverified account and sends 6-digit code', async () => {
    const prevEmailCount = emailService.sentEmails.length;

    const res = await fetch(`${baseUrl}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: testEmail1, password: testPassword1 }),
    });

    assert.equal(res.status, 201);
    const data = await res.json();
    assert.equal(data.emailVerified, false);
    assert.equal(data.user.emailVerified, false);
    assert.equal(data.token, undefined, 'Registration must never return a session token for unverified account');
    assert.ok(data.message.includes('verification code') || data.message.includes('check your email'));

    testUser1Id = data.user.id;
    createdUserIds.push(testUser1Id);

    // Verify DB user record
    const dbUser = await dbService.getUserById(testUser1Id);
    assert.equal(dbUser.emailVerified, false);

    // Verify email was dispatched
    const sentEmails = emailService.sentEmails.slice(prevEmailCount);
    const verifyEmail = sentEmails.find((e) => e.to === testEmail1);
    assert.ok(verifyEmail, 'Verification email must be dispatched');
    assert.ok(verifyEmail.subject.includes('Verification Code'));

    // Extract 6-digit code from email text or html
    const match = verifyEmail.text.match(/\b\d{6}\b/);
    assert.ok(match && match[0], 'Email must contain a 6-digit verification code');
    latestCode1 = match[0];

    // Verify code is stored hashed in DB, never plaintext
    const codeRecord = await dbService.getLatestEmailVerificationCode(testUser1Id);
    assert.ok(codeRecord, 'Verification code record must exist in DB');
    const expectedHash = crypto.createHash('sha256').update(latestCode1).digest('hex');
    assert.equal(codeRecord.codeHash, expectedHash);
    assert.notEqual(codeRecord.codeHash, latestCode1, 'Plaintext code must never be stored');
  });

  // Scenario 7 & 10: Unverified user cannot log in and receives 403
  await t.test('7 & 10. Unverified user login is blocked with 403 and cannot access dashboard session', async () => {
    const loginRes = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identifier: testEmail1, password: testPassword1 }),
    });

    assert.equal(loginRes.status, 403);
    const loginData = await loginRes.json();
    assert.equal(loginData.emailVerified, false);
    assert.equal(loginData.token, undefined);
    assert.ok(loginData.error.includes('Email verification required'));
  });

  // Scenario 8 & 11 & 17: Unverified user cannot access protected financial APIs
  await t.test('8 & 11 & 17. Unverified JWT token is blocked from financial APIs with 403', async () => {
    // Generate a token for an unverified user
    const unverifiedToken = generateToken({
      id: testUser1Id,
      username: testEmail1,
      email: testEmail1,
      role: 'USER',
      emailVerified: false,
    });

    const apiRes = await fetch(`${baseUrl}/api/accounts`, {
      headers: { Authorization: `Bearer ${unverifiedToken}` },
    });

    assert.equal(apiRes.status, 403);
    const apiData = await apiRes.json();
    assert.equal(apiData.emailVerified, false);
    assert.ok(apiData.error.includes('Email verification required'));
  });

  // Scenario 4: Incorrect code is rejected and decrements remaining attempts
  await t.test('4. Incorrect code is rejected with 400 and decrements attempts', async () => {
    const wrongRes = await fetch(`${baseUrl}/api/auth/verify-email`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: testEmail1, code: '000000' }),
    });

    assert.equal(wrongRes.status, 400);
    const wrongData = await wrongRes.json();
    assert.ok(wrongData.error.includes('Invalid'));
    assert.equal(wrongData.remainingAttempts, 4);
  });

  // Scenario 6: Resend cooldown works (<60s returns 429)
  await t.test('6. Resend verification code within 60s cooldown is rejected with 429', async () => {
    const resendRes = await fetch(`${baseUrl}/api/auth/resend-verification`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: testEmail1 }),
    });

    assert.equal(resendRes.status, 429);
    const resendData = await resendRes.json();
    assert.ok(resendData.error.includes('wait'));
    assert.ok(resendData.retryAfter > 0);
  });

  // Scenario 5: Max attempts limit (5 attempts) invalidates the code
  await t.test('5. Exceeding 5 failed verification attempts invalidates code', async () => {
    // We already used 1 attempt. Send 3 more wrong codes (making 4 attempts total).
    for (let i = 0; i < 3; i++) {
      const r = await fetch(`${baseUrl}/api/auth/verify-email`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: testEmail1, code: '999999' }),
      });
      assert.equal(r.status, 400);
    }

    // 5th attempt: triggers attempt limit
    const fifthRes = await fetch(`${baseUrl}/api/auth/verify-email`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: testEmail1, code: '999999' }),
    });
    assert.equal(fifthRes.status, 400);
    const fifthData = await fifthRes.json();
    assert.ok(fifthData.error.includes('Maximum verification attempts exceeded'));

    // Even entering the correct code must now be rejected
    const tryCorrectRes = await fetch(`${baseUrl}/api/auth/verify-email`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: testEmail1, code: latestCode1 }),
    });
    assert.equal(tryCorrectRes.status, 400);
    const tryCorrectData = await tryCorrectRes.json();
    assert.ok(tryCorrectData.error.includes('exceeded') || tryCorrectData.error.includes('expired') || tryCorrectData.error.includes('request a new code'));
  });

  // Scenario 3 & 9: Resend code after cooldown, correct code verifies user, verified user logs in
  let newValidCode = null;
  await t.test('3 & 9. Resend code creates new code, correct code verifies account, and verified user logs in', async () => {
    // Age all codes for this user by 2 minutes in DB to simulate cooldown expiration
    if (dbService.isPostgresConnected && dbService.pool) {
      await dbService.pool.query(
        `UPDATE email_verification_codes SET created_at = NOW() - INTERVAL '2 minutes' WHERE user_id = $1`,
        [testUser1Id]
      );
    } else if (dbService.inMemoryData?.emailVerificationCodes) {
      dbService.inMemoryData.emailVerificationCodes.forEach((c) => {
        if (c.userId === testUser1Id) {
          c.createdAt = new Date(Date.now() - 120000).toISOString();
        }
      });
    }

    const prevEmailCount = emailService.sentEmails.length;
    const resendRes = await fetch(`${baseUrl}/api/auth/resend-verification`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: testEmail1 }),
    });

    assert.equal(resendRes.status, 200);
    const resendData = await resendRes.json();
    assert.equal(resendData.success, true);

    const sentEmails = emailService.sentEmails.slice(prevEmailCount);
    const resendEmail = sentEmails.find((e) => e.to === testEmail1);
    assert.ok(resendEmail);
    const match = resendEmail.text.match(/\b\d{6}\b/);
    assert.ok(match);
    newValidCode = match[0];

    // Correct code verifies the email
    const verifyRes = await fetch(`${baseUrl}/api/auth/verify-email`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: testEmail1, code: newValidCode }),
    });

    assert.equal(verifyRes.status, 200);
    const verifyData = await verifyRes.json();
    assert.equal(verifyData.user.emailVerified, true);
    assert.ok(verifyData.token, 'Must return session token upon successful verification');

    // Verify DB user is now marked verified
    const verifiedDbUser = await dbService.getUserById(testUser1Id);
    assert.equal(verifiedDbUser.emailVerified, true);

    // Verified email/password user can now log in normally
    const loginRes = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identifier: testEmail1, password: testPassword1 }),
    });

    assert.equal(loginRes.status, 200);
    const loginData = await loginRes.json();
    assert.ok(loginData.token);
    assert.equal(loginData.user.emailVerified, true);

    // Verified session token can access protected financial APIs
    const accRes = await fetch(`${baseUrl}/api/accounts`, {
      headers: { Authorization: `Bearer ${loginData.token}` },
    });
    assert.equal(accRes.status, 200);
  });

  // Scenario 4 (reused & expired code rejection)
  await t.test('4b. Reused code is rejected with 400 or returns already verified', async () => {
    const reuseRes = await fetch(`${baseUrl}/api/auth/verify-email`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: testEmail1, code: newValidCode }),
    });

    // Code was already used or user is already verified
    assert.ok(reuseRes.status === 400 || reuseRes.status === 200);
    const reuseData = await reuseRes.json();
    if (reuseRes.status === 400) {
      assert.ok(reuseData.error);
    } else {
      assert.equal(reuseData.alreadyVerified, true);
    }
  });

  await t.test('4c. Expired verification code is rejected with 400', async () => {
    const testEmailExpired = `expired_${Date.now()}@example.com`;
    const regRes = await fetch(`${baseUrl}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: testEmailExpired, password: 'Password123!' }),
    });
    const regData = await regRes.json();
    const expiredUserId = regData.user.id;
    createdUserIds.push(expiredUserId);

    // Age the code past 10 minutes
    const codeRecord = await dbService.getLatestEmailVerificationCode(expiredUserId);
    if (codeRecord && dbService.isPostgresConnected && dbService.pool) {
      await dbService.pool.query(
        `UPDATE email_verification_codes SET expires_at = NOW() - INTERVAL '5 minutes' WHERE id = $1`,
        [codeRecord.id]
      );
    }

    const verifyRes = await fetch(`${baseUrl}/api/auth/verify-email`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: testEmailExpired, code: '123456' }),
    });

    assert.equal(verifyRes.status, 400);
    const verifyData = await verifyRes.json();
    assert.ok(verifyData.error.toLowerCase().includes('expired'));
  });

  // Scenario 10: Google OAuth with verified email bypasses separate email verification
  let googleUserId = null;
  const googleEmail = `google_verified_${Date.now()}@gmail.com`;

  await t.test('10 & 15. Google user with verified email gets emailVerified=true and accesses dashboard without code', async () => {
    const origVerify = authInstance.verifyIdToken.bind(authInstance);
    authInstance.verifyIdToken = async (token) => {
      if (token === 'valid-google-verified-token') {
        return {
          uid: `google_uid_${Date.now()}`,
          email: googleEmail,
          email_verified: true,
          aud: 'account-ladger01',
          name: 'Google User',
          picture: 'https://lh3.googleusercontent.com/photo.jpg',
          firebase: { sign_in_provider: 'google.com' },
        };
      }
      return origVerify(token);
    };

    try {
      const res = await fetch(`${baseUrl}/api/auth/google`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idToken: 'valid-google-verified-token' }),
      });

      assert.ok(res.status === 200 || res.status === 201);
      const data = await res.json();
      assert.ok(data.token, 'Must issue token for verified Google user');
      assert.equal(data.user.emailVerified, true);
      googleUserId = data.user.id;
      createdUserIds.push(googleUserId);

      // Verify DB record has emailVerified = true
      const dbUser = await dbService.getUserById(googleUserId);
      assert.equal(dbUser.emailVerified, true);

      // Financial APIs are immediately accessible
      const accRes = await fetch(`${baseUrl}/api/accounts`, {
        headers: { Authorization: `Bearer ${data.token}` },
      });
      assert.equal(accRes.status, 200);
    } finally {
      authInstance.verifyIdToken = origVerify;
    }
  });

  // Scenario 11: Google OAuth with unverified email cannot bypass verification
  await t.test('11. Google user with UNVERIFIED email cannot bypass verification (rejected with 403)', async () => {
    const unverifiedGoogleEmail = `unverified_google_${Date.now()}@gmail.com`;
    const origVerify = authInstance.verifyIdToken.bind(authInstance);
    authInstance.verifyIdToken = async (token) => {
      if (token === 'unverified-google-token') {
        return {
          uid: `google_uid_unver_${Date.now()}`,
          email: unverifiedGoogleEmail,
          email_verified: false, // Unverified in Google!
          aud: 'account-ladger01',
          name: 'Unverified Google',
          firebase: { sign_in_provider: 'google.com' },
        };
      }
      return origVerify(token);
    };

    try {
      const res = await fetch(`${baseUrl}/api/auth/google`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idToken: 'unverified-google-token' }),
      });

      assert.equal(res.status, 403);
      const data = await res.json();
      assert.ok(data.error.toLowerCase().includes('unverified') || data.error.toLowerCase().includes('verify'));
    } finally {
      authInstance.verifyIdToken = origVerify;
    }
  });

  // Scenario 13, 14, 15: Existing email/password user linked to Google preserves ID, role, financial records, and never auto-elevates to ADMIN
  await t.test('13, 14, 15. Securely linking existing password account to Google preserves user ID, role, financial records, and marks verified', async () => {
    const linkEmail = `link_test_${Date.now()}@example.com`;
    const linkPassword = 'Password123#';

    // 1. Register unverified user
    const regRes = await fetch(`${baseUrl}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: linkEmail, password: linkPassword }),
    });
    const regData = await regRes.json();
    const linkUserId = regData.user.id;
    createdUserIds.push(linkUserId);

    // 2. Temporarily mark verified to create a financial account
    await dbService.markUserEmailVerified(linkUserId);
    const loginRes = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identifier: linkEmail, password: linkPassword }),
    });
    const loginData = await loginRes.json();

    const createAccRes = await fetch(`${baseUrl}/api/accounts`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${loginData.token}`,
      },
      body: JSON.stringify({
        name: 'Pre-Link Checking Account',
        type: 'BANK',
        openingBalance: 12500,
      }),
    });
    assert.equal(createAccRes.status, 201);
    const accData = await createAccRes.json();
    const createdAccountId = accData.account.id;

    // 3. Authenticate with Google OAuth for the exact same email
    const origVerify = authInstance.verifyIdToken.bind(authInstance);
    authInstance.verifyIdToken = async (token) => {
      if (token === 'link-google-token') {
        return {
          uid: `google_linked_${Date.now()}`,
          email: linkEmail,
          email_verified: true,
          aud: 'account-ladger01',
          name: 'Linked Google User',
          firebase: { sign_in_provider: 'google.com' },
        };
      }
      return origVerify(token);
    };

    try {
      const gRes = await fetch(`${baseUrl}/api/auth/google`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idToken: 'link-google-token' }),
      });

      assert.equal(gRes.status, 200);
      const gData = await gRes.json();

      // Verify user ID is PRESERVED
      assert.equal(gData.user.id, linkUserId, 'Linking must preserve existing user ID');
      assert.equal(gData.user.role, 'USER', 'Linking must never auto-elevate user to ADMIN');
      assert.equal(gData.user.emailVerified, true, 'Linking verified Google account marks user verified');

      // Verify financial records are PRESERVED
      const accListRes = await fetch(`${baseUrl}/api/accounts`, {
        headers: { Authorization: `Bearer ${gData.token}` },
      });
      assert.equal(accListRes.status, 200);
      const accounts = await dbService.getAccounts(linkUserId);
      const userAcc = accounts.find((a) => a.id === createdAccountId);
      assert.ok(userAcc, 'Existing financial records must remain completely intact');
      assert.equal(Number(userAcc.openingBalance), 12500);
    } finally {
      authInstance.verifyIdToken = origVerify;
    }
  });

  // Scenario 12: Frontend-supplied verification flags are ignored
  await t.test('12. Frontend-supplied emailVerified flags in request bodies are ignored', async () => {
    const maliciousEmail = `fake_verify_${Date.now()}@example.com`;
    const regRes = await fetch(`${baseUrl}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: maliciousEmail,
        password: 'Password123!',
        emailVerified: true, // Malicious frontend claim
      }),
    });
    const regData = await regRes.json();
    createdUserIds.push(regData.user.id);

    assert.equal(regData.user.emailVerified, false, 'Backend must force emailVerified to false on registration');
    assert.equal(regData.token, undefined);

    const dbUser = await dbService.getUserById(regData.user.id);
    assert.equal(dbUser.emailVerified, false);
  });
});
