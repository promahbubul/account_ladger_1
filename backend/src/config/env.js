import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

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

export const config = {
  port: Number(process.env.PORT) || 5001,
  nodeEnv: process.env.NODE_ENV || 'development',
  frontendUrl: process.env.FRONTEND_URL || 'http://localhost:5000',
  databaseUrl: process.env.DATABASE_URL || '',
  directUrl: process.env.DIRECT_URL || '',
  jwtSecret: process.env.JWT_SECRET || 'hisabflow-secure-jwt-secret-key-neon-db',
  adminInitialPassword: process.env.ADMIN_INITIAL_PASSWORD || 'Mahbub@12345',
  userInitialPassword: process.env.USER_INITIAL_PASSWORD || 'User@12345',
  firebaseProjectId: process.env.FIREBASE_PROJECT_ID || 'account-ladger01',
  smtpHost: process.env.SMTP_HOST || 'smtp.gmail.com',
  smtpPort: Number(process.env.SMTP_PORT) || 587,
  smtpSecure: process.env.SMTP_SECURE === 'true',
  smtpUser: process.env.SMTP_USER || process.env.EMAIL_USER || '',
  smtpPass: process.env.SMTP_PASS || process.env.EMAIL_PASS || '',
  emailFrom: process.env.EMAIL_FROM || process.env.SMTP_USER || process.env.EMAIL_USER || 'AccountLedger <noreply@accountledger.com>',
  appName: process.env.APP_NAME || 'AccountLedger',
};

