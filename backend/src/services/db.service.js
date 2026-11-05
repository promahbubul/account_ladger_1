import { PROJECT_SCHEMA_SQL } from './project.schema.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import pg from 'pg';
import bcrypt from 'bcryptjs';
import { encodeCursor, decodeCursor } from '../utils/cursor.js';
import { logger } from '../utils/logger.js';
import { config } from '../config/env.js';
import {
  DEFAULT_INCOME_CATEGORIES,
  DB_CONNECT_ATTEMPTS,
  DEFAULT_EXPENSE_CATEGORIES,
  MAX_PAGE,
  isCursorTimestamp,
} from './db/helpers.js';
import { UsersMethods } from './db/users.js';
import { AccountsMethods } from './db/accounts.js';
import { CategoriesMethods } from './db/categories.js';
import { ReportsMethods } from './db/reports.js';
import { TransactionsMethods } from './db/transactions.js';
import { TransfersMethods } from './db/transfers.js';
import { LoansMethods } from './db/loans.js';
import { BudgetsMethods } from './db/budgets.js';
import { AdminMethods } from './db/admin.js';

const { Pool } = pg;

// Ensure PostgreSQL DATE columns (OID 1082) return as plain YYYY-MM-DD string without timezone day shifting
if (pg.types && typeof pg.types.setTypeParser === 'function') {
  pg.types.setTypeParser(1082, (val) => val);
}

export { formatToISODate, DEFAULT_INCOME_CATEGORIES, DEFAULT_EXPENSE_CATEGORIES } from './db/helpers.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class DatabaseService {
  constructor() {
    this.pool = null;
    this.isPostgresConnected = false;
    this.inMemoryData = {
      users: [],
      accounts: [],
      categories: [],
      transactions: [],
      transfers: [],
      loans: [],
      repayments: [],
      budgets: [],
      auditLogs: [],
      passwordResetTokens: [],
      emailVerificationCodes: [],
      systemSettings: {
        appName: 'AccountLedger.com',
        maintenanceMode: false,
        allowUserRegistration: true,
        defaultCurrency: 'BDT',
        sessionTimeoutHours: 720,
        auditLoggingEnabled: true,
        updatedAt: new Date().toISOString(),
      },
    };

    // Locate local DB file (support backend/data/ or root/data/)
    const possiblePaths = [
      path.resolve(__dirname, '../../data/hisabflow_db.json'),
      path.resolve(process.cwd(), 'data/hisabflow_db.json'),
      path.resolve(process.cwd(), '../data/hisabflow_db.json'),
    ];

    let foundPath = possiblePaths.find((p) => fs.existsSync(p));
    if (!foundPath) {
      const defaultDir = path.resolve(__dirname, '../../data');
      if (!fs.existsSync(defaultDir)) {
        try {
          fs.mkdirSync(defaultDir, { recursive: true });
        } catch {
          // ignore
        }
      }
      foundPath = path.resolve(defaultDir, 'hisabflow_db.json');
    }

    this.localDbPath = process.env.LOCAL_DB_PATH || foundPath;
    if (!config.isProduction) this.loadLocalDb();
  }

  loadLocalDb() {
    if (fs.existsSync(this.localDbPath)) {
      try {
        const raw = fs.readFileSync(this.localDbPath, 'utf-8');
        const parsed = JSON.parse(raw);
        this.inMemoryData = {
          users: parsed.users || [],
          accounts: (parsed.accounts || []).filter((a) => a.userId !== 'user_admin_mahbub'),
          categories: (parsed.categories || []).filter((c) => c.userId !== 'user_admin_mahbub'),
          transactions: (parsed.transactions || []).filter((t) => t.userId !== 'user_admin_mahbub'),
          transfers: (parsed.transfers || []).filter((t) => t.userId !== 'user_admin_mahbub'),
          loans: (parsed.loans || []).filter((l) => l.userId !== 'user_admin_mahbub'),
          repayments: (parsed.repayments || []).filter((r) => r.userId !== 'user_admin_mahbub'),
          budgets: (parsed.budgets || []).filter((b) => b.userId !== 'user_admin_mahbub'),
          auditLogs: parsed.auditLogs || [],
          passwordResetTokens: parsed.passwordResetTokens || [],
          emailVerificationCodes: parsed.emailVerificationCodes || [],
          systemSettings: parsed.systemSettings || {
            appName: 'AccountLedger.com',
            maintenanceMode: false,
            allowUserRegistration: true,
            defaultCurrency: 'BDT',
            sessionTimeoutHours: 720,
            auditLoggingEnabled: true,
            updatedAt: new Date().toISOString(),
          },
        };
        this.persistLocalDb();
      } catch (err) {
        logger.error('Error loading local DB file, initializing fresh:', err);
      }
    }
  }

  persistLocalDb() {
    if (this.isPostgresConnected) {
      return;
    }
    try {
      const dir = path.dirname(this.localDbPath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      fs.writeFileSync(this.localDbPath, JSON.stringify(this.inMemoryData, null, 2), 'utf-8');
    } catch (err) {
      logger.error('Error persisting local DB:', err);
    }
  }

  async isDatabaseHealthy() {
    if (!this.isPostgresConnected || !this.pool) return !config.isProduction;
    try {
      await this.pool.query('SELECT 1');
      return true;
    } catch (err) {
      logger.error('Database health check failed:', err);
      return false;
    }
  }

  async connectToPostgres(dbUrl) {
    // Neon can take a few seconds to wake from idle, so production retries before giving up.
    const maxAttempts = config.isProduction ? DB_CONNECT_ATTEMPTS : 1;
    for (let attempt = 1; ; attempt += 1) {
      try {
        this.pool = new Pool({
          connectionString: dbUrl,
          ssl: dbUrl.includes('localhost') ? false : { rejectUnauthorized: false },
          max: 10,
          connectionTimeoutMillis: 10000,
        });

        const client = await this.pool.connect();
        const res = await client.query('SELECT NOW()');
        client.release();
        return res.rows[0].now;
      } catch (err) {
        await this.pool?.end().catch(() => {});
        this.pool = null;
        if (attempt >= maxAttempts) throw err;
        logger.warn(`PostgreSQL connection attempt ${attempt} failed, retrying:`, err.message);
        await new Promise((resolve) => setTimeout(resolve, attempt * 1000));
      }
    }
  }

  async initialize() {
    const dbUrl = config.databaseUrl;
    if (dbUrl && !dbUrl.includes('YOUR_ROTATED_NEON_DATABASE_URL') && !dbUrl.includes('user:password@localhost')) {
      try {
        logger.info('Connecting to PostgreSQL database...');
        const connectedAt = await this.connectToPostgres(dbUrl);
        this.isPostgresConnected = true;
        logger.info('Connected to PostgreSQL successfully at', connectedAt);

        await this.initPostgresSchema();
      } catch (err) {
        // Serving from an empty local file would look like data loss and split writes away from the database.
        if (config.isProduction) {
          throw new Error(`Could not connect to PostgreSQL: ${err.message}`);
        }
        logger.warn('Could not connect to PostgreSQL:', err.message);
        logger.warn('Running in Local Persistent Mode (data/hisabflow_db.json).');
        this.isPostgresConnected = false;
      }
    } else if (config.isProduction) {
      throw new Error('DATABASE_URL is a placeholder. Refusing to start in production.');
    } else {
      logger.info('No external DATABASE_URL active. Operating in Local Persistent Mode.');
      this.isPostgresConnected = false;
    }

    await this.seedInitialSystemState();
  }

  async initPostgresSchema() {
    if (!this.pool) return;
    const client = await this.pool.connect();
    try {
      await client.query(`
        CREATE TABLE IF NOT EXISTS users (
          id VARCHAR(64) PRIMARY KEY,
          username VARCHAR(64) UNIQUE NOT NULL,
          email VARCHAR(128) UNIQUE NOT NULL,
          password_hash VARCHAR(255) NOT NULL,
          full_name VARCHAR(128),
          role VARCHAR(20) DEFAULT 'USER' NOT NULL,
          is_active BOOLEAN DEFAULT TRUE NOT NULL,
          currency VARCHAR(10) DEFAULT 'BDT' NOT NULL,
          timezone VARCHAR(64) DEFAULT 'Asia/Dhaka' NOT NULL,
          date_format VARCHAR(32) DEFAULT 'DD MMM YYYY' NOT NULL,
          created_at TIMESTAMPTZ DEFAULT NOW(),
          updated_at TIMESTAMPTZ DEFAULT NOW()
        );

        CREATE TABLE IF NOT EXISTS accounts (
          id VARCHAR(64) PRIMARY KEY,
          user_id VARCHAR(64) REFERENCES users(id) ON DELETE CASCADE,
          name VARCHAR(128) NOT NULL,
          type VARCHAR(32) NOT NULL,
          provider_name VARCHAR(128),
          account_number VARCHAR(64),
          opening_balance NUMERIC(14, 2) NOT NULL DEFAULT 0.00,
          current_balance NUMERIC(14, 2) NOT NULL DEFAULT 0.00,
          currency VARCHAR(10) NOT NULL DEFAULT 'BDT',
          status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
          created_at TIMESTAMPTZ DEFAULT NOW(),
          updated_at TIMESTAMPTZ DEFAULT NOW()
        );

        CREATE TABLE IF NOT EXISTS categories (
          id VARCHAR(64) PRIMARY KEY,
          user_id VARCHAR(64) REFERENCES users(id) ON DELETE CASCADE,
          parent_id VARCHAR(64) REFERENCES categories(id) ON DELETE SET NULL,
          name VARCHAR(128) NOT NULL,
          type VARCHAR(20) NOT NULL,
          icon VARCHAR(64),
          color VARCHAR(32),
          subcategories JSONB DEFAULT '[]'::jsonb,
          is_archived BOOLEAN DEFAULT FALSE,
          is_system BOOLEAN DEFAULT FALSE,
          created_at TIMESTAMPTZ DEFAULT NOW(),
          updated_at TIMESTAMPTZ DEFAULT NOW()
        );

        CREATE TABLE IF NOT EXISTS transactions (
          id VARCHAR(64) PRIMARY KEY,
          user_id VARCHAR(64) REFERENCES users(id) ON DELETE CASCADE,
          account_id VARCHAR(64) REFERENCES accounts(id) ON DELETE RESTRICT,
          account_name VARCHAR(128),
          category_id VARCHAR(64) REFERENCES categories(id) ON DELETE SET NULL,
          type VARCHAR(32) NOT NULL,
          category VARCHAR(128),
          subcategory VARCHAR(128),
          amount NUMERIC(14, 2) NOT NULL,
          direction VARCHAR(20) NOT NULL,
          date DATE NOT NULL,
          description TEXT NOT NULL,
          reference VARCHAR(128),
          counterparty VARCHAR(128),
          status VARCHAR(20) DEFAULT 'COMPLETED',
          transfer_id VARCHAR(64),
          loan_id VARCHAR(64),
          destination_account_id VARCHAR(64),
          destination_account_name VARCHAR(128),
          created_at TIMESTAMPTZ DEFAULT NOW()
        );

        CREATE TABLE IF NOT EXISTS transfers (
          id VARCHAR(64) PRIMARY KEY,
          user_id VARCHAR(64) REFERENCES users(id) ON DELETE CASCADE,
          source_account_id VARCHAR(64) REFERENCES accounts(id) ON DELETE RESTRICT,
          source_account_name VARCHAR(128),
          destination_account_id VARCHAR(64) REFERENCES accounts(id) ON DELETE RESTRICT,
          destination_account_name VARCHAR(128),
          amount NUMERIC(14, 2) NOT NULL,
          transfer_fee NUMERIC(14, 2) DEFAULT 0.00,
          date DATE NOT NULL,
          description TEXT,
          reference VARCHAR(128),
          created_at TIMESTAMPTZ DEFAULT NOW()
        );

        CREATE TABLE IF NOT EXISTS loans (
          id VARCHAR(64) PRIMARY KEY,
          user_id VARCHAR(64) REFERENCES users(id) ON DELETE CASCADE,
          account_id VARCHAR(64) REFERENCES accounts(id) ON DELETE RESTRICT,
          account_name VARCHAR(128),
          type VARCHAR(20) NOT NULL,
          counterparty_name VARCHAR(128) NOT NULL,
          counterparty_contact VARCHAR(128),
          principal_amount NUMERIC(14, 2) NOT NULL,
          outstanding_principal NUMERIC(14, 2) NOT NULL,
          interest_rate NUMERIC(5, 2) DEFAULT 0.00,
          start_date DATE NOT NULL,
          due_date DATE,
          status VARCHAR(20) DEFAULT 'ACTIVE',
          notes TEXT,
          created_at TIMESTAMPTZ DEFAULT NOW(),
          updated_at TIMESTAMPTZ DEFAULT NOW()
        );

        CREATE TABLE IF NOT EXISTS repayments (
          id VARCHAR(64) PRIMARY KEY,
          user_id VARCHAR(64) REFERENCES users(id) ON DELETE CASCADE,
          loan_id VARCHAR(64) REFERENCES loans(id) ON DELETE RESTRICT,
          counterparty_name VARCHAR(128) NOT NULL,
          loan_type VARCHAR(20) NOT NULL,
          account_id VARCHAR(64) REFERENCES accounts(id) ON DELETE RESTRICT,
          account_name VARCHAR(128),
          amount NUMERIC(14, 2) NOT NULL,
          date DATE NOT NULL,
          notes TEXT,
          created_at TIMESTAMPTZ DEFAULT NOW()
        );

        CREATE TABLE IF NOT EXISTS budgets (
          id VARCHAR(64) PRIMARY KEY,
          user_id VARCHAR(64) REFERENCES users(id) ON DELETE CASCADE,
          category_name VARCHAR(128) NOT NULL,
          monthly_limit NUMERIC(14, 2) NOT NULL
        );

        CREATE TABLE IF NOT EXISTS audit_logs (
          id VARCHAR(64) PRIMARY KEY,
          user_id VARCHAR(64) REFERENCES users(id) ON DELETE CASCADE,
          user_email VARCHAR(128),
          action VARCHAR(64) NOT NULL,
          entity_type VARCHAR(64) NOT NULL,
          entity_id VARCHAR(64) NOT NULL,
          details TEXT,
          ip_address VARCHAR(64),
          created_at TIMESTAMPTZ DEFAULT NOW()
        );

        CREATE TABLE IF NOT EXISTS system_settings (
          id INT PRIMARY KEY DEFAULT 1,
          app_name VARCHAR(128) DEFAULT 'AccountLedger.com',
          maintenance_mode BOOLEAN DEFAULT FALSE,
          allow_user_registration BOOLEAN DEFAULT TRUE,
          default_currency VARCHAR(10) DEFAULT 'BDT',
          session_timeout_hours INT DEFAULT 720,
          audit_logging_enabled BOOLEAN DEFAULT TRUE,
          updated_at TIMESTAMPTZ DEFAULT NOW()
        );

        CREATE TABLE IF NOT EXISTS password_reset_tokens (
          id VARCHAR(64) PRIMARY KEY,
          user_id VARCHAR(64) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          token_hash VARCHAR(128) UNIQUE NOT NULL,
          expires_at TIMESTAMPTZ NOT NULL,
          used_at TIMESTAMPTZ,
          created_at TIMESTAMPTZ DEFAULT NOW()
        );

        CREATE TABLE IF NOT EXISTS email_verification_codes (
          id VARCHAR(64) PRIMARY KEY,
          user_id VARCHAR(64) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          code_hash VARCHAR(128) NOT NULL,
          expires_at TIMESTAMPTZ NOT NULL,
          attempts INT DEFAULT 0 NOT NULL,
          used_at TIMESTAMPTZ,
          created_at TIMESTAMPTZ DEFAULT NOW()
        );

        CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_user_id ON password_reset_tokens(user_id);
        CREATE UNIQUE INDEX IF NOT EXISTS idx_password_reset_tokens_hash ON password_reset_tokens(token_hash);
        CREATE INDEX IF NOT EXISTS idx_email_verification_codes_user_id ON email_verification_codes(user_id);
        CREATE INDEX IF NOT EXISTS idx_email_verification_codes_hash ON email_verification_codes(code_hash);

        -- Ensure schema integrity columns and constraints
        ALTER TABLE users ADD COLUMN IF NOT EXISTS token_version INTEGER DEFAULT 0 NOT NULL;
        ALTER TABLE users ADD COLUMN IF NOT EXISTS firebase_uid VARCHAR(128) UNIQUE;
        ALTER TABLE users ADD COLUMN IF NOT EXISTS auth_provider VARCHAR(20) DEFAULT 'LOCAL' NOT NULL;
        ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar_url TEXT;
        ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verified BOOLEAN DEFAULT FALSE NOT NULL;
        ALTER TABLE categories ADD COLUMN IF NOT EXISTS parent_id VARCHAR(64) REFERENCES categories(id) ON DELETE SET NULL;
        ALTER TABLE transactions ADD COLUMN IF NOT EXISTS category_id VARCHAR(64) REFERENCES categories(id) ON DELETE SET NULL;

        -- Migrate existing verified accounts (Google OAuth verified and system administrators)
        UPDATE users SET email_verified = TRUE WHERE auth_provider IN ('GOOGLE', 'GOOGLE_LINKED') OR role = 'ADMIN';

        -- Unique indexes
        CREATE UNIQUE INDEX IF NOT EXISTS uq_accounts_user_name ON accounts(user_id, LOWER(name));
        CREATE UNIQUE INDEX IF NOT EXISTS uq_categories_user_name_parent ON categories(user_id, LOWER(name), type, COALESCE(parent_id, ''));

        -- Performance indexes
        CREATE INDEX IF NOT EXISTS idx_categories_parent_id ON categories(parent_id);
        CREATE INDEX IF NOT EXISTS idx_categories_user_type ON categories(user_id, type);
        CREATE INDEX IF NOT EXISTS idx_transactions_category_id ON transactions(category_id);
        CREATE INDEX IF NOT EXISTS idx_transactions_user_account_date ON transactions(user_id, account_id, date DESC, created_at DESC);
        CREATE INDEX IF NOT EXISTS idx_transactions_user_type_date ON transactions(user_id, type, date DESC);
        CREATE INDEX IF NOT EXISTS idx_transfers_user_date ON transfers(user_id, date DESC, created_at DESC);
        CREATE INDEX IF NOT EXISTS idx_transfers_source_account ON transfers(source_account_id);
        CREATE INDEX IF NOT EXISTS idx_transfers_destination_account ON transfers(destination_account_id);
        CREATE INDEX IF NOT EXISTS idx_loans_user_type_status ON loans(user_id, type, status);
        CREATE INDEX IF NOT EXISTS idx_loans_account_id ON loans(account_id);
        CREATE INDEX IF NOT EXISTS idx_repayments_loan_id ON repayments(loan_id);
        CREATE INDEX IF NOT EXISTS idx_repayments_account_id ON repayments(account_id);
        CREATE INDEX IF NOT EXISTS idx_audit_logs_user_entity ON audit_logs(user_id, entity_type, entity_id);
        CREATE INDEX IF NOT EXISTS idx_transactions_user_feed ON transactions(user_id, date DESC, created_at DESC NULLS LAST, id DESC);
        CREATE INDEX IF NOT EXISTS idx_transfers_user_feed ON transfers(user_id, date DESC, created_at DESC NULLS LAST, id DESC);
        CREATE INDEX IF NOT EXISTS idx_loans_user_feed ON loans(user_id, start_date DESC, created_at DESC NULLS LAST, id DESC);
        CREATE INDEX IF NOT EXISTS idx_repayments_user_feed ON repayments(user_id, date DESC, created_at DESC NULLS LAST, id DESC);
        CREATE INDEX IF NOT EXISTS idx_audit_logs_feed ON audit_logs(created_at DESC NULLS LAST, id DESC);

        -- Check constraints
        DO $$ BEGIN
          IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_categories_parent_not_self') THEN
            ALTER TABLE categories ADD CONSTRAINT chk_categories_parent_not_self CHECK (parent_id IS NULL OR parent_id <> id);
          END IF;
          IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_transfers_diff_accounts') THEN
            ALTER TABLE transfers ADD CONSTRAINT chk_transfers_diff_accounts CHECK (source_account_id <> destination_account_id);
          END IF;
          IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_transfers_amount_positive') THEN
            ALTER TABLE transfers ADD CONSTRAINT chk_transfers_amount_positive CHECK (amount > 0);
          END IF;
          IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_transactions_amount_positive') THEN
            ALTER TABLE transactions ADD CONSTRAINT chk_transactions_amount_positive CHECK (amount > 0);
          END IF;
          IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_loans_principal_positive') THEN
            ALTER TABLE loans ADD CONSTRAINT chk_loans_principal_positive CHECK (principal_amount > 0);
          END IF;
          IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_loans_outstanding_non_negative') THEN
            ALTER TABLE loans ADD CONSTRAINT chk_loans_outstanding_non_negative CHECK (outstanding_principal >= 0);
          END IF;
          IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_repayments_amount_positive') THEN
            ALTER TABLE repayments ADD CONSTRAINT chk_repayments_amount_positive CHECK (amount > 0);
          END IF;
        END $$;

        -- Ensure full_name is optional (nullable)
        ALTER TABLE users ALTER COLUMN full_name DROP NOT NULL;
      `);
      await client.query(PROJECT_SCHEMA_SQL);
      logger.info('PostgreSQL schema verification, constraints, and indexes complete.');
    } catch (err) {
      logger.error('Error creating PostgreSQL tables:', err);
    } finally {
      client.release();
    }
  }

  async seedInitialSystemState() {
    // Known demo accounts must never be created on a production database.
    if (config.isProduction) return;

    const adminPassword = config.adminInitialPassword;
    if (!adminPassword || !config.userInitialPassword) {
      logger.warn('ADMIN_INITIAL_PASSWORD or USER_INITIAL_PASSWORD is not set; skipping demo account seeding.');
      return;
    }
    const adminHash = await bcrypt.hash(adminPassword, 10);
    const standardPassword = config.userInitialPassword;
    const standardHash = await bcrypt.hash(standardPassword, 10);

    const initialAdmin = {
      id: 'user_admin_mahbub',
      username: 'mahbub',
      email: 'mahbub@gmail.com',
      passwordHash: adminHash,
      fullName: 'Mahbub Alam',
      role: 'ADMIN',
      isActive: true,
      emailVerified: true,
      currency: 'BDT',
      timezone: 'Asia/Dhaka',
      dateFormat: 'DD MMM YYYY',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const secondaryAdmin = {
      id: 'user_admin_example',
      username: 'admin',
      email: 'admin@example.com',
      passwordHash: adminHash,
      fullName: 'System Administrator',
      role: 'ADMIN',
      isActive: true,
      emailVerified: true,
      currency: 'BDT',
      timezone: 'Asia/Dhaka',
      dateFormat: 'DD MMM YYYY',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const standardUser = {
      id: 'user_standard_01',
      username: 'user',
      email: 'user@example.com',
      passwordHash: standardHash,
      fullName: 'Standard User',
      role: 'USER',
      isActive: true,
      emailVerified: true,
      currency: 'BDT',
      timezone: 'Asia/Dhaka',
      dateFormat: 'DD MMM YYYY',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    if (this.isPostgresConnected && this.pool) {
      const client = await this.pool.connect();
      try {
        const adminCheck = await client.query('SELECT id FROM users WHERE role = $1 LIMIT 1', ['ADMIN']);
        if (adminCheck.rows.length === 0) {
          await client.query(
            `INSERT INTO users (id, username, email, password_hash, full_name, role, is_active, email_verified, currency, timezone, date_format)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
             ON CONFLICT (email) DO NOTHING`,
            [
              initialAdmin.id,
              initialAdmin.username,
              initialAdmin.email,
              initialAdmin.passwordHash,
              initialAdmin.fullName,
              initialAdmin.role,
              initialAdmin.isActive,
              true,
              initialAdmin.currency,
              initialAdmin.timezone,
              initialAdmin.dateFormat,
            ]
          );
        }

        const userCheck = await client.query('SELECT id FROM users WHERE email = $1 LIMIT 1', [standardUser.email]);
        if (userCheck.rows.length === 0) {
          await client.query(
            `INSERT INTO users (id, username, email, password_hash, full_name, role, is_active, email_verified, currency, timezone, date_format)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
             ON CONFLICT (email) DO NOTHING`,
            [
              standardUser.id,
              standardUser.username,
              standardUser.email,
              standardUser.passwordHash,
              standardUser.fullName,
              standardUser.role,
              standardUser.isActive,
              true,
              standardUser.currency,
              standardUser.timezone,
              standardUser.dateFormat,
            ]
          );
          await this.seedDefaultCategories(standardUser.id);
          await this.seedDefaultAccounts(standardUser.id);
        } else {
          // Ensure standard test user is verified in existing postgres database
          await client.query('UPDATE users SET email_verified = true WHERE email IN ($1, $2, $3)', [
            standardUser.email,
            initialAdmin.email,
            secondaryAdmin.email,
          ]);
        }
      } catch (err) {
        logger.error('Error seeding initial PostgreSQL state:', err);
      } finally {
        client.release();
      }
    } else {
      // Local persistent JSON storage
      const existingAdmin = this.inMemoryData.users.find((u) => u.email === initialAdmin.email);
      if (!existingAdmin) {
        this.inMemoryData.users.push(initialAdmin);
      }
      const existingSecAdmin = this.inMemoryData.users.find((u) => u.email === secondaryAdmin.email);
      if (!existingSecAdmin) {
        this.inMemoryData.users.push(secondaryAdmin);
      }

      const existingStd = this.inMemoryData.users.find((u) => u.email === standardUser.email);
      if (!existingStd) {
        this.inMemoryData.users.push(standardUser);
        await this.seedDefaultCategories(standardUser.id);
        await this.seedDefaultAccounts(standardUser.id);
      }
      this.persistLocalDb();
    }
  }

  async seedDefaultAccounts(userId) {
    // Check if the user already has any account to prevent duplicate Cash creation on retries
    const existingAccounts = await this.getAccounts(userId);
    if (existingAccounts && existingAccounts.length > 0) {
      return existingAccounts;
    }

    let currency = 'BDT';
    try {
      const user = await this.getUserById(userId);
      if (user && user.currency) {
        currency = user.currency;
      }
    } catch {
      // Fallback to BDT default
    }

    const cashAccountId = `acc_cash_${userId}_default`;
    const cashAccount = {
      id: cashAccountId,
      userId,
      name: 'Cash',
      type: 'CASH',
      providerName: null,
      accountNumber: null,
      openingBalance: 0,
      currentBalance: 0,
      currency,
      status: 'ACTIVE',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    if (this.isPostgresConnected && this.pool) {
      await this.pool.query(
        `INSERT INTO accounts (id, user_id, name, type, provider_name, account_number, opening_balance, current_balance, currency, status)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
         ON CONFLICT (id) DO NOTHING`,
        [
          cashAccount.id,
          cashAccount.userId,
          cashAccount.name,
          cashAccount.type,
          null,
          null,
          0,
          0,
          cashAccount.currency,
          'ACTIVE',
        ]
      );
      return [cashAccount];
    }

    const exists = this.inMemoryData.accounts.some((a) => a.userId === userId);
    if (!exists) {
      this.inMemoryData.accounts.push(cashAccount);
      this.persistLocalDb();
    }
    return [cashAccount];
  }

  async seedDefaultCategories(userId) {
    const existingCategories = await this.getCategories(userId);
    if (existingCategories && existingCategories.length > 0) {
      return existingCategories;
    }

    for (const cat of DEFAULT_INCOME_CATEGORIES) {
      const categoryId = `cat_inc_${userId}_${cat.name.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase()}`;
      if (this.isPostgresConnected && this.pool) {
        await this.pool.query(
          `INSERT INTO categories (id, user_id, parent_id, name, type, icon, color, subcategories, is_archived, is_system)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
           ON CONFLICT (id) DO NOTHING`,
          [
            categoryId,
            userId,
            null,
            cat.name,
            'INCOME',
            cat.icon,
            cat.color,
            JSON.stringify(cat.subcategories || []),
            false,
            true,
          ]
        );
      } else {
        const exists = this.inMemoryData.categories.some((c) => c.id === categoryId);
        if (!exists) {
          this.inMemoryData.categories.push({
            id: categoryId,
            userId,
            name: cat.name,
            type: 'INCOME',
            icon: cat.icon,
            color: cat.color,
            subcategories: cat.subcategories,
            isArchived: false,
            isSystem: true,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          });
        }
      }
    }

    for (const cat of DEFAULT_EXPENSE_CATEGORIES) {
      const categoryId = `cat_exp_${userId}_${cat.name.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase()}`;
      if (this.isPostgresConnected && this.pool) {
        await this.pool.query(
          `INSERT INTO categories (id, user_id, parent_id, name, type, icon, color, subcategories, is_archived, is_system)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
           ON CONFLICT (id) DO NOTHING`,
          [
            categoryId,
            userId,
            null,
            cat.name,
            'EXPENSE',
            cat.icon,
            cat.color,
            JSON.stringify(cat.subcategories || []),
            false,
            true,
          ]
        );
      } else {
        const exists = this.inMemoryData.categories.some((c) => c.id === categoryId);
        if (!exists) {
          this.inMemoryData.categories.push({
            id: categoryId,
            userId,
            name: cat.name,
            type: 'EXPENSE',
            icon: cat.icon,
            color: cat.color,
            subcategories: cat.subcategories,
            isArchived: false,
            isSystem: true,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          });
        }
      }
    }

    if (!this.isPostgresConnected || !this.pool) {
      this.persistLocalDb();
    }
  }

  // --------------------------------------------------------------------------
  // USER OPERATIONS
  // --------------------------------------------------------------------------

  // Reads one page in SQL, newest first, without loading the rest of the list.
  // A cursor names the row a page continues from, and only counts if that row matches the same filters.
  async queryPage({ table, select, filters, dateColumn, options, mapRow, cursorField }) {
    const limit = options.limit || 50;
    const { where, values } = filters;
    const whereSql = (conditions) => (conditions.length ? `WHERE ${conditions.join(' AND ')}` : '');

    const created = "COALESCE(created_at, '-infinity'::timestamptz)";
    const key = [dateColumn, created, 'id'].filter(Boolean).join(', ');
    const newestFirst = [dateColumn && `${dateColumn} DESC`, 'created_at DESC NULLS LAST', 'id DESC'].filter(Boolean).join(', ');
    const oldestFirst = [dateColumn && `${dateColumn} ASC`, 'created_at ASC NULLS FIRST', 'id ASC'].filter(Boolean).join(', ');

    const countRes = await this.pool.query(`SELECT COUNT(*)::int AS n FROM ${table} ${whereSql(where)}`, values);
    const totalCount = countRes.rows[0].n;

    const encode = (row) => encodeCursor({ id: row.id, timestamp: row[cursorField] });
    const finish = (rows, hasNextPage, hasPreviousPage) => {
      const items = rows.map(mapRow);
      return {
        items,
        nextCursor: items.length > 0 && hasNextPage ? encode(items[items.length - 1]) : null,
        previousCursor: items.length > 0 && hasPreviousPage ? encode(items[0]) : null,
        hasNextPage,
        hasPreviousPage,
        totalCount,
      };
    };

    if (options.page !== undefined && options.page > 0) {
      const offset = (Math.min(options.page, MAX_PAGE) - 1) * limit;
      const res = await this.pool.query(
        `${select} ${whereSql(where)} ORDER BY ${newestFirst} LIMIT ${limit} OFFSET ${offset}`,
        values
      );
      return finish(res.rows, offset + limit < totalCount, offset > 0);
    }

    const backward = options.direction === 'backward';
    const decoded = options.cursor ? decodeCursor(options.cursor) : null;
    const conditions = [...where];
    const params = [...values];
    let continues = false;

    if (decoded && typeof decoded.id === 'string') {
      const exists = await this.pool.query(
        `SELECT 1 FROM ${table} ${whereSql([...where, `id = $${values.length + 1}`])} LIMIT 1`,
        [...values, decoded.id]
      );
      if (exists.rows.length > 0) {
        params.push(decoded.id);
        conditions.push(`(${key}) ${backward ? '>' : '<'} (SELECT ${key} FROM ${table} WHERE id = $${params.length})`);
        continues = true;
      } else if (!backward && isCursorTimestamp(decoded.timestamp)) {
        // The row was deleted between pages, so carry on from its date instead of restarting.
        params.push(decoded.timestamp);
        conditions.push(`${dateColumn || 'created_at'} <= $${params.length}`);
        continues = true;
      }
    }

    const res = await this.pool.query(
      `${select} ${whereSql(conditions)} ORDER BY ${backward ? oldestFirst : newestFirst} LIMIT ${limit + 1}`,
      params
    );
    const hasMore = res.rows.length > limit;
    const rows = res.rows.slice(0, limit);
    if (backward) {
      rows.reverse();
      return finish(rows, continues, hasMore);
    }
    return finish(rows, hasMore, continues);
  }

  getStatus() {
    return {
      mode: this.isPostgresConnected ? 'PostgreSQL' : 'Local Persistent JSON',
      connectedToPostgres: this.isPostgresConnected,
      connectedToNeon: this.isPostgresConnected,
      localDbFile: this.localDbPath,
    };
  }
}

// The methods for each area live in ./db/*.js and are copied onto the class here.
for (const methods of [UsersMethods, AccountsMethods, CategoriesMethods, ReportsMethods, TransactionsMethods, TransfersMethods, LoansMethods, BudgetsMethods, AdminMethods]) {
  for (const name of Object.getOwnPropertyNames(methods.prototype)) {
    if (name === 'constructor') continue;
    if (Object.prototype.hasOwnProperty.call(DatabaseService.prototype, name)) {
      throw new Error(`DatabaseService.${name} is defined twice`);
    }
    Object.defineProperty(DatabaseService.prototype, name, Object.getOwnPropertyDescriptor(methods.prototype, name));
  }
}

export const dbService = new DatabaseService();
