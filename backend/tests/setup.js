// Loaded before every test file. These values win over .env because dotenv never overrides existing variables,
// so a test run cannot reach a real database or send real email.
import os from 'node:os';
import path from 'node:path';

process.env.NODE_ENV = 'test';
process.env.DATABASE_URL = process.env.TEST_DATABASE_URL || '';
process.env.DIRECT_URL = '';
process.env.SMTP_HOST = '';
process.env.SMTP_USER = '';
process.env.SMTP_PASS = '';
process.env.EMAIL_USER = '';
process.env.EMAIL_PASS = '';
process.env.JWT_SECRET = 'test-only-jwt-secret-that-is-long-enough-to-be-valid';
process.env.ADMIN_INITIAL_PASSWORD = 'test-only-admin-password';
process.env.USER_INITIAL_PASSWORD = '123456';
process.env.LOCAL_DB_PATH = path.join(os.tmpdir(), `accountledger-test-${process.pid}-${Date.now()}.json`);
