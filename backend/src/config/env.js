import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import crypto from 'crypto';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 1. Try backend/.env (two levels up from src/config)
const backendEnv = path.resolve(__dirname, '../../.env');
if (fs.existsSync(backendEnv)) {
  dotenv.config({ path: backendEnv });
}

// 2. Try root .env (three levels up)
const rootEnv = path.resolve(__dirname, '../../../.env');
if (fs.existsSync(rootEnv)) {
  dotenv.config({ path: rootEnv });
}

// 3. Fallback to current working directory .env
dotenv.config();

// An unset NODE_ENV counts as production, so a misconfigured server fails closed.
const nodeEnv = process.env.NODE_ENV || 'production';
const isProduction = !['development', 'test'].includes(nodeEnv);

// SHA-256 of the secret that used to be committed here. It is public, so it can never be accepted in production.
const RETIRED_JWT_SECRET_HASH = '27e9a96a72165c208a2b5db82707d6b1485965bbb8b506291f83e28af0755029';
const MIN_JWT_SECRET_LENGTH = 32;

function resolveJwtSecret() {
  const secret = process.env.JWT_SECRET;
  if (secret) return secret;
  if (isProduction) return '';
  // Sessions simply do not survive a restart in development without a configured secret.
  console.warn('[AccountLedger.com API Warning] JWT_SECRET is not set; using a random secret for this process.');
  return crypto.randomBytes(48).toString('hex');
}

function assertProductionConfig({ jwtSecret, databaseUrl }) {
  const problems = [];
  const jwtHash = crypto.createHash('sha256').update(jwtSecret).digest('hex');
  if (jwtSecret.length < MIN_JWT_SECRET_LENGTH) {
    problems.push(`JWT_SECRET must be set and at least ${MIN_JWT_SECRET_LENGTH} characters long.`);
  } else if (jwtHash === RETIRED_JWT_SECRET_HASH) {
    problems.push('JWT_SECRET is the old public default. Generate a new one.');
  }
  if (!databaseUrl) {
    problems.push('DATABASE_URL must be set.');
  }
  if (problems.length > 0) {
    throw new Error(`Refusing to start in production:\n- ${problems.join('\n- ')}`);
  }
}

export const config = {
  port: Number(process.env.PORT) || 5001,
  nodeEnv,
  isProduction,
  // Hops of reverse proxy in front of the app, needed to read each client's real IP.
  trustProxy: Number(process.env.TRUST_PROXY ?? (isProduction ? 1 : 0)),
  frontendUrl: process.env.FRONTEND_URL || 'http://localhost:5000',
  databaseUrl: process.env.DATABASE_URL || '',
  auditLogRetentionDays: Number(process.env.AUDIT_LOG_RETENTION_DAYS) || 365,
  directUrl: process.env.DIRECT_URL || '',
  jwtSecret: resolveJwtSecret(),
  // Only used to seed development data; production never seeds.
  adminInitialPassword: process.env.ADMIN_INITIAL_PASSWORD || '',
  userInitialPassword: process.env.USER_INITIAL_PASSWORD || '',
  firebaseProjectId: process.env.FIREBASE_PROJECT_ID || 'account-ladger01',
  smtpHost: process.env.SMTP_HOST || 'smtp.gmail.com',
  smtpPort: Number(process.env.SMTP_PORT) || 587,
  smtpSecure: process.env.SMTP_SECURE === 'true',
  smtpUser: process.env.SMTP_USER || process.env.EMAIL_USER || '',
  smtpPass: process.env.SMTP_PASS || process.env.EMAIL_PASS || '',
  emailFrom: process.env.EMAIL_FROM || process.env.SMTP_USER || process.env.EMAIL_USER || 'AccountLedger <noreply@accountledger.com>',
  appName: process.env.APP_NAME || 'AccountLedger',
};

if (isProduction) {
  assertProductionConfig(config);
}
