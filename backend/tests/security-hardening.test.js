import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import bcrypt from 'bcryptjs';
import { createApp } from '../src/app.js';
import { dbService } from '../src/services/db.service.js';

const STRONG_SECRET = 'x'.repeat(64);
const RETIRED_SECRET = 'hisabflow-secure-jwt-secret-key-neon-db';
const UNREACHABLE_DB = 'postgresql://nobody:nothing@localhost:1/none';

// Runs in a child process because the configuration is read once, when the module loads.
const runInProduction = (source, env) =>
  spawnSync(process.execPath, ['--input-type=module', '-e', source], {
    cwd: process.cwd(),
    encoding: 'utf8',
    timeout: 60000,
    env: { ...process.env, NODE_ENV: 'production', JWT_SECRET: '', DATABASE_URL: '', ...env },
  });
const LOAD_CONFIG = "await import('./src/config/env.js');";

test('Production configuration fails closed', async (t) => {
  await t.test('refuses a missing JWT secret', () => {
    const result = runInProduction(LOAD_CONFIG, { DATABASE_URL: UNREACHABLE_DB });
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /JWT_SECRET must be set/);
  });

  await t.test('refuses the retired public JWT secret', () => {
    const result = runInProduction(LOAD_CONFIG, { JWT_SECRET: RETIRED_SECRET, DATABASE_URL: UNREACHABLE_DB });
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /old public default/);
  });

  await t.test('refuses a missing database URL', () => {
    const result = runInProduction(LOAD_CONFIG, { JWT_SECRET: STRONG_SECRET });
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /DATABASE_URL must be set/);
  });

  await t.test('starts with valid settings', () => {
    const result = runInProduction(LOAD_CONFIG, { JWT_SECRET: STRONG_SECRET, DATABASE_URL: UNREACHABLE_DB });
    assert.equal(result.status, 0, result.stderr);
  });

  await t.test('an unset NODE_ENV counts as production', () => {
    const env = { ...process.env, JWT_SECRET: '', DATABASE_URL: UNREACHABLE_DB };
    // An empty value is what dotenv leaves alone, so .env cannot switch this back to development.
    env.NODE_ENV = '';
    const result = spawnSync(process.execPath, ['--input-type=module', '-e', LOAD_CONFIG], {
      cwd: process.cwd(),
      encoding: 'utf8',
      timeout: 60000,
      env,
    });
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /JWT_SECRET must be set/);
  });

  await t.test('an unreachable database stops startup instead of using the local file', () => {
    const result = runInProduction(
      `const { dbService } = await import('./src/services/db.service.js');
       try {
         await dbService.initialize();
         console.log('STARTED');
       } catch (err) {
         console.log('REFUSED', err.message);
       }
       process.exit(0);`,
      { JWT_SECRET: STRONG_SECRET, DATABASE_URL: UNREACHABLE_DB }
    );
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /REFUSED Could not connect to PostgreSQL/);
    assert.doesNotMatch(result.stdout, /STARTED/);
  });

  await t.test('production never seeds demo accounts', () => {
    const result = runInProduction(
      `const { dbService } = await import('./src/services/db.service.js');
       dbService.isPostgresConnected = true;
       let touched = false;
       const refuse = () => { touched = true; throw new Error('database touched'); };
       dbService.pool = { query: refuse, connect: refuse };
       await dbService.seedInitialSystemState();
       console.log(touched ? 'SEEDED' : 'SKIPPED');
       process.exit(0);`,
      { JWT_SECRET: STRONG_SECRET, DATABASE_URL: UNREACHABLE_DB, ADMIN_INITIAL_PASSWORD: 'x', USER_INITIAL_PASSWORD: 'y' }
    );
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /SKIPPED/);
  });
});

test('Login security', async (t) => {
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
  t.after(() => server.close());

  const login = (identifier, password) =>
    fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identifier, password }),
    });

  const unique = Date.now();
  const createUser = async (name, role, password) => {
    const email = `${name}_${unique}@test.local`;
    const created = await dbService.createUser({
      id: `sec_${name}_${unique}`,
      username: `${name}_${unique}`,
      email,
      passwordHash: await bcrypt.hash(password, 4),
      fullName: name,
      role,
      isActive: true,
      emailVerified: true,
      currency: 'BDT',
      timezone: 'Asia/Dhaka',
      dateFormat: 'DD MMM YYYY',
    });
    return { email, id: created?.id || `sec_${name}_${unique}` };
  };

  const adminPassword = 'A-strong-unique-admin-password!';
  const admin = await createUser('admin_guard', 'ADMIN', adminPassword);

  await t.test('the old shared passwords no longer open admin accounts', async () => {
    const before = (await dbService.getUserById(admin.id)).passwordHash;

    for (const guess of ['123456', process.env.ADMIN_INITIAL_PASSWORD].filter(Boolean)) {
      const res = await login(admin.email, guess);
      assert.equal(res.status, 401, `"${guess.length} character guess" must be rejected`);
    }

    assert.equal((await dbService.getUserById(admin.id)).passwordHash, before, 'password must not be overwritten');
    assert.equal((await login(admin.email, adminPassword)).status, 200);
  });

  await t.test('an invalid token gets 401 so clients can sign out', async () => {
    const res = await fetch(`${baseUrl}/api/accounts`, { headers: { Authorization: 'Bearer not-a-real-token' } });
    assert.equal(res.status, 401);
  });

  await t.test('changing a password ends existing sessions', async () => {
    const password = 'Session-user-password1!';
    const user = await createUser('session', 'USER', password);
    const { token } = await (await login(user.email, password)).json();
    const authed = () => fetch(`${baseUrl}/api/auth/me`, { headers: { Authorization: `Bearer ${token}` } });
    assert.equal((await authed()).status, 200);

    await dbService.updateUser(user.id, { passwordHash: await bcrypt.hash('Another-password1!', 4) });
    assert.equal((await authed()).status, 401);
  });

  await t.test('security headers are set and health reports the database', async () => {
    const res = await fetch(`${baseUrl}/health`);
    assert.equal(res.status, 200);
    assert.equal(res.headers.get('x-content-type-options'), 'nosniff');
    assert.equal(res.headers.get('x-powered-by'), null);
    assert.equal((await res.json()).status, 'healthy');
  });

  await t.test('successful logins do not use up attempts', async () => {
    const user = await createUser('frequent', 'USER', 'Frequent-user-password1!');
    for (let i = 0; i < 12; i += 1) {
      assert.equal((await login(user.email, 'Frequent-user-password1!')).status, 200);
    }
  });

  await t.test('repeated failures lock that account from this address only', async () => {
    const target = await createUser('target', 'USER', 'Target-user-password1!');
    const other = await createUser('other', 'USER', 'Other-user-password1!');

    for (let i = 0; i < 10; i += 1) {
      assert.equal((await login(target.email, 'wrong-password')).status, 401);
    }

    const blocked = await login(target.email, 'Target-user-password1!');
    assert.equal(blocked.status, 429, 'even the right password waits out the lock');
    assert.ok(blocked.headers.get('retry-after'));
    assert.match((await blocked.json()).error, /Too many failed sign-in attempts/);

    // Identifier case and spacing cannot be used to dodge the limit.
    assert.equal((await login(`  ${target.email.toUpperCase()} `, 'wrong-password')).status, 429);
    assert.equal((await login(other.email, 'Other-user-password1!')).status, 200);
  });

  await t.test('failures across many accounts hit the address limit', async () => {
    let lastStatus;
    for (let i = 0; i < 60 && lastStatus !== 429; i += 1) {
      lastStatus = (await login(`nobody_${unique}_${i}@test.local`, 'wrong-password')).status;
    }
    assert.equal(lastStatus, 429);
  });
});
