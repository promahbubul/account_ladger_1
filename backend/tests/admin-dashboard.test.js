import test from 'node:test';
import assert from 'node:assert/strict';
import bcrypt from 'bcryptjs';
import { createApp } from '../src/app.js';
import { dbService } from '../src/services/db.service.js';

test('Admin dashboard', async (t) => {
  await dbService.initialize();
  const app = createApp();
  let server;
  let baseUrl;
  await new Promise((resolve) => {
    server = app.listen(0, '127.0.0.1', () => {
      baseUrl = `http://127.0.0.1:${server.address().port}`;
      resolve();
    });
  });
  const originalSettings = await dbService.getSystemSettings();
  t.after(async () => {
    await dbService.updateSystemSettings(originalSettings);
    server.close();
    if (dbService.pool) await dbService.pool.end();
  });

  const unique = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`;
  const password = 'Admin-test-password1!';
  const adminEmail = `boss_${unique}@test.local`;
  await dbService.createUser({
    id: `boss_${unique}`,
    username: `boss_${unique}`,
    email: adminEmail,
    passwordHash: await bcrypt.hash(password, 4),
    fullName: 'Boss',
    role: 'ADMIN',
    isActive: true,
    emailVerified: true,
  });
  const signIn = (identifier, pass = password) =>
    fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identifier, password: pass }),
    });
  const { token } = await (await signIn(adminEmail)).json();
  const call = (method, path, body) =>
    fetch(`${baseUrl}/api/admin${path}`, {
      method,
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: body ? JSON.stringify(body) : undefined,
    });
  const makeUser = async (name, role = 'USER') => {
    const res = await call('POST', '/users', {
      username: `${name}_${unique}`,
      email: `${name}_${unique}@test.local`,
      fullName: name,
      password,
      role,
    });
    assert.equal(res.status, 201);
    return (await res.json()).user;
  };
  const logsFor = async (search) => (await (await call('GET', `/audit-logs?limit=100&search=${search}`)).json()).items;

  await t.test('stats are real counts and hide server paths', async () => {
    const res = await call('GET', '/stats');
    assert.equal(res.status, 200);
    const stats = await res.json();
    assert.ok(stats.adminCount >= 1);
    for (const key of ['totalUsers', 'activeUsers', 'unverifiedUsers', 'newUsersThisWeek', 'totalTransactions', 'totalAccounts']) {
      assert.equal(typeof stats[key], 'number', key);
    }
    assert.ok(!JSON.stringify(stats).includes('.json'));
    assert.ok(!JSON.stringify(await (await call('GET', '/db-status')).json()).includes('.json'));
  });

  await t.test('a user an admin creates can sign in, and weak details are refused', async () => {
    const user = await makeUser('signsin');
    assert.equal((await signIn(user.email)).status, 200);

    const base = { username: `bad_${unique}`, email: `bad_${unique}@test.local`, fullName: 'Bad', password };
    assert.equal((await call('POST', '/users', { ...base, password: '123' })).status, 400);
    assert.equal((await call('POST', '/users', { ...base, email: 'not-an-email' })).status, 400);
    assert.equal((await call('POST', '/users', { ...base, email: user.email.toUpperCase() })).status, 409);
  });

  await t.test('users can be listed by unverified email', async () => {
    const email = `unverified_${unique}@test.local`;
    await dbService.createUser({
      id: `unv_${unique}`,
      username: `unverified_${unique}`,
      email,
      passwordHash: await bcrypt.hash(password, 4),
      role: 'USER',
      isActive: true,
      emailVerified: false,
    });
    const { items } = await (await call('GET', `/users?limit=100&status=UNVERIFIED&search=${unique}`)).json();
    assert.deepEqual(items.map((u) => u.email), [email]);
  });

  await t.test('editing changes only what was sent', async () => {
    const user = await makeUser('keeprole', 'ADMIN');
    const res = await call('PUT', `/users/${user.id}`, { fullName: 'Renamed' });
    assert.equal(res.status, 200);
    const updated = (await res.json()).user;
    assert.equal(updated.role, 'ADMIN');
    assert.equal(updated.fullName, 'Renamed');
    assert.equal(updated.currency, 'BDT');
    assert.equal(updated.email, user.email);

    assert.equal((await call('PUT', `/users/${user.id}`, { fullName: '   ' })).status, 400);
    assert.equal((await call('PUT', `/users/${user.id}`, { role: 'OWNER' })).status, 400);
    assert.equal((await call('PUT', `/users/${user.id}`, { email: adminEmail })).status, 409);
    assert.equal((await call('PUT', `/users/${user.id}`, {})).status, 200);
  });

  await t.test('a role change is recorded', async () => {
    const user = await makeUser('promoted');
    await call('PUT', `/users/${user.id}`, { role: 'ADMIN' });
    const logs = await logsFor(user.username);
    assert.ok(logs.some((l) => l.action === 'UPDATE_USER' && l.details.includes('USER to ADMIN')));
  });

  await t.test('a wrong password reaches the audit log, without the password', async () => {
    const user = await makeUser('wrongpass');
    const wrong = 'Not-the-right-one9';
    assert.equal((await signIn(user.email, wrong)).status, 401);
    const logs = await logsFor(user.email);
    const failed = logs.find((l) => l.action === 'LOGIN_FAILED');
    assert.ok(failed);
    assert.ok(!JSON.stringify(failed).includes(wrong));
    // An address with no account leaves nothing behind.
    assert.equal((await signIn(`nobody_${unique}@test.local`, wrong)).status, 401);
    assert.equal((await logsFor(`nobody_${unique}`)).length, 0);
  });

  await t.test('deleting a user keeps their audit history', async () => {
    const user = await makeUser('deleted');
    assert.equal((await signIn(user.email)).status, 200);
    assert.equal((await call('DELETE', `/users/${user.id}`)).status, 200);
    assert.equal((await signIn(user.email)).status, 401);
    const logs = await logsFor(user.email);
    assert.ok(logs.some((l) => l.action === 'LOGIN' && l.userEmail === user.email));
    assert.ok(logs.some((l) => l.action === 'DELETE_USER'));
  });

  await t.test('settings are saved, validated, and drive sign-up', async () => {
    const register = (name) =>
      fetch(`${baseUrl}/api/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: `${name}_${unique}`, email: `${name}_${unique}@test.local`, password, fullName: name }),
      });

    let res = await call('PUT', '/settings', { allowUserRegistration: false, defaultCurrency: 'USD', sessionTimeoutHours: -5, junk: 'x' });
    assert.equal(res.status, 200);
    const { settings } = await res.json();
    assert.equal(settings.allowUserRegistration, false);
    assert.equal(settings.defaultCurrency, 'USD');
    assert.equal(settings.junk, undefined);
    assert.equal(settings.sessionTimeoutHours, undefined);

    assert.equal((await register('closed')).status, 403);
    if (dbService.isPostgresConnected) {
      // Stored in the database, so a restart or a second server process sees the same values.
      const { rows } = await dbService.pool.query('SELECT allow_user_registration, default_currency FROM system_settings WHERE id = 1');
      assert.equal(rows[0].allow_user_registration, false);
      assert.equal(rows[0].default_currency, 'USD');
    }

    assert.equal((await call('PUT', '/settings', { allowUserRegistration: 'no' })).status, 400);
    assert.equal((await call('PUT', '/settings', { defaultCurrency: 'XXX' })).status, 400);

    res = await call('PUT', '/settings', { allowUserRegistration: true });
    assert.equal((await res.json()).settings.defaultCurrency, 'USD');
    assert.equal((await register('opened')).status, 201);
    const opened = await dbService.getUserByEmail(`opened_${unique}@test.local`);
    assert.equal(opened.currency, 'USD');
  });
});
