// Starts the API for browser tests. Values set here win over backend/.env (dotenv never overrides keys
// that already exist), so a test run never reads the real database or sends real email. It uses a
// fresh JSON file, or the throwaway Postgres in E2E_DATABASE_URL, which Projects need.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dbPath = path.join(os.tmpdir(), `accountledger-e2e-${process.pid}.json`);
fs.rmSync(dbPath, { force: true });

const databaseUrl = process.env.E2E_DATABASE_URL || '';
if (/neon\.tech|nutrimedbd/i.test(databaseUrl)) {
  throw new Error('E2E_DATABASE_URL points at a hosted database. Browser tests only run against a throwaway one.');
}

Object.assign(process.env, {
  NODE_ENV: 'development',
  PORT: process.env.E2E_API_PORT || '5056',
  DATABASE_URL: databaseUrl,
  DIRECT_URL: '',
  SMTP_HOST: '',
  SMTP_USER: '',
  SMTP_PASS: '',
  EMAIL_USER: '',
  EMAIL_PASS: '',
  FRONTEND_URL: `http://localhost:${process.env.E2E_WEB_PORT || '5010'}`,
  JWT_SECRET: 'e2e-only-jwt-secret-that-is-long-enough-to-be-valid',
  ADMIN_INITIAL_PASSWORD: 'E2e-admin-password1!',
  USER_INITIAL_PASSWORD: 'E2e-user-password1!',
  LOCAL_DB_PATH: dbPath,
});

await import(pathToFileURL(path.join(root, 'backend', 'server.js')).href);
