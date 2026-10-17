import test from 'node:test';
import assert from 'node:assert/strict';
import { generateToken, requireAdmin, requireUserOnly } from '../src/middleware/auth.js';
import jwt from 'jsonwebtoken';
import { config } from '../src/config/env.js';
import { createApp } from '../src/app.js';
import { dbService } from '../src/services/db.service.js';

test('Authentication & Role Enforcement', async (t) => {
  const dummyUser = {
    id: 'usr_test_1',
    username: 'testuser',
    email: 'test@example.com',
    role: 'USER',
  };

  const dummyAdmin = {
    id: 'usr_admin_1',
    username: 'adminuser',
    email: 'admin@example.com',
    role: 'ADMIN',
  };

  await t.test('generateToken produces verifiable JWT', () => {
    const token = generateToken(dummyUser);
    assert.equal(typeof token, 'string');
    const decoded = jwt.verify(token, config.jwtSecret);
    assert.equal(decoded.id, dummyUser.id);
    assert.equal(decoded.email, dummyUser.email);
    assert.equal(decoded.role, 'USER');
  });

  await t.test('requireAdmin rejects standard user with 403', () => {
    let statusCode = null;
    let jsonBody = null;
    let nextCalled = false;

    const req = { user: dummyUser };
    const res = {
      status: (code) => {
        statusCode = code;
        return {
          json: (body) => {
            jsonBody = body;
          },
        };
      },
    };
    const next = () => {
      nextCalled = true;
    };

    requireAdmin(req, res, next);
    assert.equal(statusCode, 403);
    assert.ok(jsonBody.error.includes('Administrator privileges required'));
    assert.equal(nextCalled, false);
  });

  await t.test('requireAdmin allows administrator', () => {
    let nextCalled = false;
    const req = { user: dummyAdmin };
    const res = {};
    const next = () => {
      nextCalled = true;
    };

    requireAdmin(req, res, next);
    assert.equal(nextCalled, true);
  });

  await t.test('requireUserOnly blocks administrator from private user financials with 403', () => {
    let statusCode = null;
    let jsonBody = null;
    let nextCalled = false;

    const req = { user: dummyAdmin };
    const res = {
      status: (code) => {
        statusCode = code;
        return {
          json: (body) => {
            jsonBody = body;
          },
        };
      },
    };
    const next = () => {
      nextCalled = true;
    };

    requireUserOnly(req, res, next);
    assert.equal(statusCode, 403);
    assert.ok(jsonBody.error.includes('System administrators do not have personal financial accounts'));
    assert.equal(nextCalled, false);
  });

  await t.test('requireUserOnly allows regular user', () => {
    let nextCalled = false;
    const req = { user: dummyUser };
    const res = {};
    const next = () => {
      nextCalled = true;
    };

    requireUserOnly(req, res, next);
    assert.equal(nextCalled, true);
  });
});

test('Registration Flow - Email and Password Only', async (t) => {
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

  const testEmail = `reg_only_${Date.now()}@example.com`;
  const testPassword = 'Password123!';
  let createdUserId = null;

  await t.test('1. Rejects registration missing email or password with 400', async () => {
    const res = await fetch(`${baseUrl}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: '' }),
    });
    assert.equal(res.status, 400);
    const data = await res.json();
    assert.ok(data.error.includes('Email and password are required'));
  });

  await t.test('2. Rejects invalid email format with 400', async () => {
    const res = await fetch(`${baseUrl}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'invalidemailformat', password: 'validPassword123' }),
    });
    assert.equal(res.status, 400);
    const data = await res.json();
    assert.ok(data.error.includes('valid email address'));
  });

  await t.test('3. Rejects password shorter than 6 characters with 400', async () => {
    const res = await fetch(`${baseUrl}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'shortpass@example.com', password: '123' }),
    });
    assert.equal(res.status, 400);
    const data = await res.json();
    assert.ok(data.error.includes('at least 6 characters'));
  });

  await t.test('4. Successfully registers user with ONLY email and password (creates unverified account)', async () => {
    const res = await fetch(`${baseUrl}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: testEmail,
        password: testPassword,
      }), // STRICT: No fullName sent!
    });

    assert.equal(res.status, 201);
    const data = await res.json();
    assert.equal(data.success, true);
    assert.equal(data.emailVerified, false, 'Account must be created with emailVerified = false');
    assert.equal(data.token, undefined, 'Session token must NOT be returned on registration before email verification');
    assert.equal(data.user.email, testEmail);
    assert.equal(data.user.role, 'USER');
    assert.equal(data.user.fullName, null, 'fullName should be null when not provided');
    assert.equal(data.user.passwordHash, undefined, 'passwordHash must never be exposed');

    createdUserId = data.user.id;

    // Verify database row directly
    const userInDb = await dbService.getUserById(createdUserId);
    assert.ok(userInDb, 'User must exist in database');
    assert.equal(userInDb.fullName, null, 'Database column full_name must be null');
    assert.equal(userInDb.emailVerified, false, 'Database column email_verified must be false');

    // Verify verification code was generated in database
    const codeRecord = await dbService.getLatestEmailVerificationCode(createdUserId);
    assert.ok(codeRecord, 'Verification code must be issued in database');
    assert.ok(codeRecord.codeHash, 'Code hash must exist');

    // Verify default accounts and categories seeded
    const accounts = await dbService.getAccounts(createdUserId);
    assert.ok(accounts.length >= 2, 'Default accounts should be seeded');
    const categories = await dbService.getCategories(createdUserId);
    assert.ok(categories.length >= 10, 'Default categories should be seeded');
  });

  await t.test('5. Rejects duplicate email registration with 409 Conflict', async () => {
    const res = await fetch(`${baseUrl}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: testEmail,
        password: 'AnotherPassword123!',
      }),
    });
    assert.equal(res.status, 409);
    const data = await res.json();
    assert.ok(data.error.includes('already exists'));
  });

  await t.test('6. Unverified user login is blocked with 403, then succeeds after email verification', async () => {
    // Attempt login while unverified -> must be blocked with 403
    const blockedRes = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        identifier: testEmail,
        password: testPassword,
      }),
    });

    assert.equal(blockedRes.status, 403);
    const blockedData = await blockedRes.json();
    assert.equal(blockedData.emailVerified, false);
    assert.ok(blockedData.error.includes('Email verification required'));

    // Now mark verified
    await dbService.markUserEmailVerified(createdUserId);

    // Login must now succeed
    const res = await fetch(`${baseUrl}/api/auth/login`, {
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
    assert.equal(data.user.id, createdUserId);
    assert.equal(data.user.email, testEmail);
  });

  // Cleanup created test user
  if (createdUserId) {
    await dbService.deleteUser(createdUserId);
  }
});
