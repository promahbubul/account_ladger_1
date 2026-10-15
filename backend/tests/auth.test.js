import test from 'node:test';
import assert from 'node:assert/strict';
import { generateToken, requireAdmin, requireUserOnly } from '../src/middleware/auth.js';
import jwt from 'jsonwebtoken';
import { config } from '../src/config/env.js';

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
