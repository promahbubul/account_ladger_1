import test from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from '../src/app.js';
import { dbService } from '../src/services/db.service.js';
import { getFirebaseAuth } from '../src/config/firebase-admin.js';

test('Firebase Google Social Authentication Tests - Passwordless Linking & Acceptance Criteria', async (t) => {
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

  t.after(async () => {
    server.close();
  });

  // Ensure Firebase Admin is initialized
  const authInstance = getFirebaseAuth();

  // Original verifyIdToken reference for restore
  const originalVerifyIdToken = authInstance.verifyIdToken.bind(authInstance);

  await t.test('1. Missing token is rejected with 400', async () => {
    const res = await fetch(`${baseUrl}/api/auth/google`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    assert.equal(res.status, 400);
    const data = await res.json();
    assert.ok(data.error.includes('Firebase ID token is required'));
  });

  await t.test('2. Invalid token string is rejected with 401', async () => {
    const res = await fetch(`${baseUrl}/api/auth/google`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ idToken: 'invalid_malformed_token_string' }),
    });
    assert.equal(res.status, 401);
    const data = await res.json();
    assert.ok(data.error.includes('Invalid, expired, or revoked authentication token'));
  });

  await t.test('3. Expired token is rejected with 401', async () => {
    authInstance.verifyIdToken = async () => {
      const err = new Error('Firebase ID token has expired.');
      err.code = 'auth/id-token-expired';
      throw err;
    };

    const res = await fetch(`${baseUrl}/api/auth/google`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ idToken: 'mock_expired_token' }),
    });
    assert.equal(res.status, 401);
    const data = await res.json();
    assert.ok(data.error.includes('Invalid, expired, or revoked authentication token'));
  });

  await t.test('4. Wrong project/audience is rejected with 401', async () => {
    authInstance.verifyIdToken = async () => ({
      uid: 'fake_uid_wrong_proj',
      email: 'attacker@gmail.com',
      email_verified: true,
      aud: 'malicious-unauthorized-project-id',
      iss: 'https://securetoken.google.com/malicious-unauthorized-project-id',
      firebase: { sign_in_provider: 'google.com' },
    });

    const res = await fetch(`${baseUrl}/api/auth/google`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ idToken: 'mock_token_wrong_aud' }),
    });
    assert.equal(res.status, 401);
    const data = await res.json();
    assert.ok(data.error.includes('authorized project audience'));
  });

  await t.test('5. Non-Google provider identity is rejected with 401', async () => {
    authInstance.verifyIdToken = async () => ({
      uid: 'fake_uid_wrong_provider',
      email: 'attacker_provider@gmail.com',
      email_verified: true,
      aud: 'account-ladger01',
      iss: 'https://securetoken.google.com/account-ladger01',
      firebase: { sign_in_provider: 'facebook.com' },
    });

    const res = await fetch(`${baseUrl}/api/auth/google`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ idToken: 'mock_token_wrong_provider' }),
    });
    assert.equal(res.status, 401);
    const data = await res.json();
    assert.ok(data.error.includes('Google provider'));
  });

  await t.test('Acceptance Test 4: Unverified email cannot trigger automatic account linking (403)', async () => {
    authInstance.verifyIdToken = async () => ({
      uid: 'fake_uid_unverified',
      email: 'unverified_user@gmail.com',
      email_verified: false,
      aud: 'account-ladger01',
      iss: 'https://securetoken.google.com/account-ladger01',
      firebase: { sign_in_provider: 'google.com' },
    });

    const res = await fetch(`${baseUrl}/api/auth/google`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ idToken: 'mock_token_unverified_email' }),
    });
    assert.equal(res.status, 403);
    const data = await res.json();
    assert.ok(data.error.includes('Unverified email'));
  });

  await t.test('Acceptance Tests 1 & 2: Existing password user logs in passwordless with matching verified Google email; ID and financial records preserved', async () => {
    // 1. Fetch user before linking to record baseline
    const existingUserBefore = await dbService.getUserByEmail('user@example.com');
    assert.ok(existingUserBefore, 'Seed user user@example.com must exist');
    assert.equal(existingUserBefore.role, 'USER');

    const accountsBefore = await dbService.getAccounts(existingUserBefore.id);
    const transactionsBefore = await dbService.getTransactions(existingUserBefore.id);

    // 2. Perform passwordless Google login
    authInstance.verifyIdToken = async () => ({
      uid: 'google_uid_existing_user',
      email: 'user@example.com',
      email_verified: true,
      aud: 'account-ladger01',
      iss: 'https://securetoken.google.com/account-ladger01',
      firebase: { sign_in_provider: 'google.com' },
      name: 'Standard User Google',
      picture: 'https://lh3.googleusercontent.com/avatar_user.jpg',
    });

    const res = await fetch(`${baseUrl}/api/auth/google`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ idToken: 'mock_existing_email_token' }), // NO password provided!
    });

    assert.equal(res.status, 200);
    const data = await res.json();
    assert.equal(data.success, true);
    assert.ok(data.token, 'JWT session token must be issued');

    // 3. Verify user ID, role, and persistent mapping
    assert.equal(data.user.id, existingUserBefore.id, 'User ID must remain exactly identical');
    assert.equal(data.user.email, 'user@example.com');
    assert.equal(data.user.role, 'USER', 'Role must remain USER');
    assert.equal(data.user.firebaseUid, 'google_uid_existing_user', 'Firebase UID must be persistently linked');
    assert.equal(data.user.authProvider, 'GOOGLE_LINKED');

    // 4. Verify all accounts and transactions remain unchanged
    const accountsAfter = await dbService.getAccounts(existingUserBefore.id);
    const transactionsAfter = await dbService.getTransactions(existingUserBefore.id);
    assert.equal(accountsAfter.length, accountsBefore.length, 'Account count must not change');
    assert.equal(transactionsAfter.total, transactionsBefore.total, 'Transaction count must not change');
  });

  await t.test('Acceptance Test 3: Subsequent Google logins work directly by Firebase UID without re-linking', async () => {
    authInstance.verifyIdToken = async () => ({
      uid: 'google_uid_existing_user',
      email: 'user@example.com',
      email_verified: true,
      aud: 'account-ladger01',
      iss: 'https://securetoken.google.com/account-ladger01',
      firebase: { sign_in_provider: 'google.com' },
    });

    const res = await fetch(`${baseUrl}/api/auth/google`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ idToken: 'mock_existing_email_token_subsequent' }),
    });

    assert.equal(res.status, 200);
    const data = await res.json();
    assert.equal(data.success, true);
    assert.ok(data.token);
    assert.equal(data.user.firebaseUid, 'google_uid_existing_user');
  });

  await t.test('Acceptance Test 5: Mismatched or conflicting Firebase identity cannot access another user account (409)', async () => {
    // Attempt to log into user@example.com with a different Google UID while it is already linked to google_uid_existing_user
    authInstance.verifyIdToken = async () => ({
      uid: 'completely_different_google_uid',
      email: 'user@example.com',
      email_verified: true,
      aud: 'account-ladger01',
      iss: 'https://securetoken.google.com/account-ladger01',
      firebase: { sign_in_provider: 'google.com' },
    });

    const res = await fetch(`${baseUrl}/api/auth/google`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ idToken: 'mock_mismatched_token' }),
    });

    assert.equal(res.status, 409);
    const data = await res.json();
    assert.ok(data.error.includes('Identity conflict') || data.error.includes('already linked'));
  });

  await t.test('Acceptance Test 6: SYSTEM_ADMIN privileges preserved only for authorized users; new Google users get USER', async () => {
    // 1. Existing ADMIN user logs in via Google: ADMIN role preserved
    const adminUser = await dbService.getUserByEmail('mahbub@gmail.com');
    assert.ok(adminUser, 'Admin user mahbub@gmail.com must exist');
    assert.equal(adminUser.role, 'ADMIN');

    authInstance.verifyIdToken = async () => ({
      uid: 'google_uid_admin_user',
      email: 'mahbub@gmail.com',
      email_verified: true,
      aud: 'account-ladger01',
      iss: 'https://securetoken.google.com/account-ladger01',
      firebase: { sign_in_provider: 'google.com' },
      name: 'Admin Mahbub',
    });

    const resAdmin = await fetch(`${baseUrl}/api/auth/google`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ idToken: 'mock_admin_token' }),
    });

    assert.equal(resAdmin.status, 200);
    const adminData = await resAdmin.json();
    assert.equal(adminData.user.role, 'ADMIN', 'Admin role must be preserved');
    assert.equal(adminData.user.id, adminUser.id);

    // Clean up admin mapping
    await dbService.updateUser(adminUser.id, { firebaseUid: null, authProvider: 'LOCAL' });

    // 2. New Google user registration NEVER gets ADMIN (always USER)
    const newGoogleUid = `google_uid_new_role_${Date.now()}`;
    const newEmail = `new_role_user_${Date.now()}@gmail.com`;

    authInstance.verifyIdToken = async () => ({
      uid: newGoogleUid,
      email: newEmail,
      email_verified: true,
      aud: 'account-ladger01',
      iss: 'https://securetoken.google.com/account-ladger01',
      firebase: { sign_in_provider: 'google.com' },
      name: 'Regular New User',
    });

    const resNew = await fetch(`${baseUrl}/api/auth/google`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ idToken: 'mock_new_user_token' }),
    });

    assert.equal(resNew.status, 201);
    const newData = await resNew.json();
    try {
      assert.equal(newData.user.role, 'USER', 'Newly registered Google users must strictly receive USER role, never ADMIN');
    } finally {
      await dbService.deleteUser(newData.user.id);
    }
  });

  await t.test('Acceptance Test 7: Suspended/deactivated users remain blocked (403)', async () => {
    const suspendedEmail = `suspended_${Date.now()}@gmail.com`;
    const suspendedUid = `google_uid_suspended_${Date.now()}`;

    // Register active user first
    authInstance.verifyIdToken = async () => ({
      uid: suspendedUid,
      email: suspendedEmail,
      email_verified: true,
      aud: 'account-ladger01',
      iss: 'https://securetoken.google.com/account-ladger01',
      firebase: { sign_in_provider: 'google.com' },
    });

    const resReg = await fetch(`${baseUrl}/api/auth/google`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ idToken: 'mock_token_reg' }),
    });
    assert.equal(resReg.status, 201);
    const regData = await resReg.json();

    try {
      // Deactivate user
      await dbService.updateUser(regData.user.id, { isActive: false });

      // Attempt Google login again
      const resBlocked = await fetch(`${baseUrl}/api/auth/google`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idToken: 'mock_token_blocked' }),
      });

      assert.equal(resBlocked.status, 403);
      const blockedData = await resBlocked.json();
      assert.ok(blockedData.error.includes('Account is deactivated'));
    } finally {
      await dbService.deleteUser(regData.user.id);
    }
  });

  await t.test('Acceptance Test 8: Concurrent first-login requests do not create duplicate accounts or identity mappings', async () => {
    const concurrentUid = `google_uid_concurrent_${Date.now()}`;
    const concurrentEmail = `concurrent_${Date.now()}@gmail.com`;

    authInstance.verifyIdToken = async () => ({
      uid: concurrentUid,
      email: concurrentEmail,
      email_verified: true,
      aud: 'account-ladger01',
      iss: 'https://securetoken.google.com/account-ladger01',
      firebase: { sign_in_provider: 'google.com' },
      name: 'Concurrent User',
    });

    // Launch two requests simultaneously
    const [res1, res2] = await Promise.all([
      fetch(`${baseUrl}/api/auth/google`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idToken: 'token_concurrent_1' }),
      }),
      fetch(`${baseUrl}/api/auth/google`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idToken: 'token_concurrent_2' }),
      }),
    ]);

    const data1 = await res1.json();
    const data2 = await res2.json();

    // Both should yield the identical user ID without creating duplicate rows
    const user1Id = data1.user?.id;
    const user2Id = data2.user?.id;
    assert.ok(user1Id, 'First request should succeed with user');
    assert.ok(user2Id, 'Second request should succeed with user');
    assert.equal(user1Id, user2Id, 'Concurrent requests must resolve to the exact same user ID');

    // Clean up
    if (user1Id) {
      await dbService.deleteUser(user1Id);
    }
  });

  await t.test('Acceptance Test 9: Existing email/password authentication continues to work', async () => {
    const res = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identifier: 'user@example.com', password: '123456' }),
    });
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.equal(data.success, true);
    assert.ok(data.token);
    assert.equal(data.user.email, 'user@example.com');
  });

  // Teardown: Restore original verifyIdToken and unlink test user
  authInstance.verifyIdToken = originalVerifyIdToken;
  const userToClean = await dbService.getUserByEmail('user@example.com');
  if (userToClean) {
    await dbService.updateUser(userToClean.id, { firebaseUid: null, authProvider: 'LOCAL' });
  }
});
