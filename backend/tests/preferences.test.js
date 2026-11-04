import test from 'node:test';
import assert from 'node:assert/strict';
import bcrypt from 'bcryptjs';
import { createApp } from '../src/app.js';
import { dbService } from '../src/services/db.service.js';

test('Profile preferences are validated', async (t) => {
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
  t.after(async () => {
    server.close();
    if (dbService.pool) await dbService.pool.end();
  });

  const unique = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`;
  const makeUser = async (name, role) => {
    const password = 'Preference-test-password1!';
    const email = `${name}_${unique}@test.local`;
    await dbService.createUser({
      id: `pf_${name[0]}_${unique}`,
      username: `${name}_${unique}`,
      email,
      passwordHash: await bcrypt.hash(password, 4),
      fullName: 'Original Name',
      role,
      isActive: true,
      emailVerified: true,
      currency: 'BDT',
      timezone: 'Asia/Dhaka',
      dateFormat: 'DD MMM YYYY',
    });
    const res = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identifier: email, password }),
    });
    const { token } = await res.json();
    return { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };
  };

  const userHeaders = await makeUser('member', 'USER');
  const updateProfile = (body) =>
    fetch(`${baseUrl}/api/user/profile`, { method: 'PUT', headers: userHeaders, body: JSON.stringify(body) });

  await t.test('valid values are saved', async () => {
    const res = await updateProfile({ currency: 'usd', timezone: 'Asia/Kolkata', dateFormat: 'YYYY-MM-DD' });
    assert.equal(res.status, 200);
    const { user } = await res.json();
    assert.equal(user.currency, 'USD');
    assert.equal(user.timezone, 'Asia/Kolkata');
    assert.equal(user.dateFormat, 'YYYY-MM-DD');
  });

  await t.test('unknown values are rejected and change nothing', async () => {
    assert.equal((await updateProfile({ currency: 'XYZ' })).status, 400);
    assert.equal((await updateProfile({ timezone: 'Mars/Olympus' })).status, 400);
    assert.equal((await updateProfile({ dateFormat: 'whatever' })).status, 400);
    const me = await (await fetch(`${baseUrl}/api/auth/me`, { headers: userHeaders })).json();
    assert.equal(me.user.currency, 'USD');
    assert.equal(me.user.timezone, 'Asia/Kolkata');
  });

  await t.test('a full name can be cleared', async () => {
    const res = await updateProfile({ fullName: '   ' });
    assert.equal(res.status, 200);
    assert.ok(!(await res.json()).user.fullName);
  });

  await t.test('admin user forms only accept supported currencies', async () => {
    const adminHeaders = await makeUser('boss', 'ADMIN');
    const res = await fetch(`${baseUrl}/api/admin/users`, {
      method: 'POST',
      headers: adminHeaders,
      body: JSON.stringify({ username: `u_${unique}`, email: `u_${unique}@test.local`, fullName: 'New', password: 'Password123!', role: 'USER', currency: 'XYZ' }),
    });
    assert.equal(res.status, 400);
  });
});
