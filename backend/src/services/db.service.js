import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import pg from 'pg';
import bcrypt from 'bcryptjs';
import { encodeCursor, decodeCursor } from '../utils/cursor.js';
import { logger } from '../utils/logger.js';
import { config } from '../config/env.js';

const { Pool } = pg;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const DEFAULT_INCOME_CATEGORIES = [
  { name: 'Salary & Wages', icon: 'Briefcase', color: '#10b981', subcategories: ['Basic Salary', 'Bonus', 'Commission', 'Overtime'] },
  { name: 'Business & Sales', icon: 'Building2', color: '#06b6d4', subcategories: ['Product Sales', 'Service Revenue', 'Client Consulting'] },
  { name: 'Investments & Returns', icon: 'TrendingUp', color: '#3b82f6', subcategories: ['Stock Dividends', 'Capital Gains', 'Bank Profit/Interest'] },
  { name: 'Freelance & Contracting', icon: 'Laptop', color: '#8b5cf6', subcategories: ['Upwork/Fiverr', 'Direct Clients', 'Project Deliverables'] },
  { name: 'Rental Income', icon: 'Home', color: '#ec4899', subcategories: ['Residential Rent', 'Commercial Rent', 'Parking Space'] },
  { name: 'Other Income', icon: 'Coins', color: '#64748b', subcategories: ['Gifts & Family Support', 'Tax Refund', 'Reimbursements', 'Asset Liquidation'] },
];

export const DEFAULT_EXPENSE_CATEGORIES = [
  { name: 'Food & Dining', icon: 'UtensilsCrossed', color: '#f59e0b', subcategories: ['Groceries & Provisions', 'Dining Out & Restaurants', 'Snacks & Cafes', 'Water & Milk'] },
  { name: 'Housing & Utilities', icon: 'Home', color: '#ef4444', subcategories: ['Apartment Rent', 'Electricity Bill', 'Gas & Cylinder', 'Water Bill', 'Internet & Fiber', 'Building Service Charge'] },
  { name: 'Transportation', icon: 'Car', color: '#3b82f6', subcategories: ['Vehicle Fuel & CNG', 'Public Bus & Metro', 'Ride Sharing (Uber/Pathao)', 'Vehicle Maintenance', 'Tolls & Parking'] },
  { name: 'Healthcare & Medical', icon: 'HeartPulse', color: '#ec4899', subcategories: ['Prescription Medicines', 'Doctor Consultation', 'Medical Diagnostic Tests', 'Hospital Care', 'Dental & Vision'] },
  { name: 'Family & Education', icon: 'GraduationCap', color: '#8b5cf6', subcategories: ['Tuition & School Fees', 'Books & Stationery', 'Courses & Learning', 'Children Allowances', 'Parental Support'] },
  { name: 'Shopping & Apparel', icon: 'ShoppingBag', color: '#14b8a6', subcategories: ['Clothing & Footwear', 'Electronics & Gadgets', 'Home Appliances', 'Gifts & Celebrations'] },
  { name: 'Personal Care & Lifestyle', icon: 'Smile', color: '#06b6d4', subcategories: ['Grooming & Salon', 'Gym & Fitness', 'Streaming Subscriptions', 'Entertainment & Outings'] },
  { name: 'Financial & Banking', icon: 'Landmark', color: '#64748b', subcategories: ['Bank Service Charges', 'Card Annual Fees', 'Mobile Money Cashout Fees', 'Government Taxes'] },
  { name: 'Miscellaneous', icon: 'Receipt', color: '#94a3b8', subcategories: ['Emergency Repairs', 'Unplanned Incidentals', 'General Donations'] },
];

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

    this.localDbPath = foundPath;
    this.loadLocalDb();
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

  async initialize() {
    const dbUrl = config.databaseUrl;
    if (dbUrl && !dbUrl.includes('YOUR_ROTATED_NEON_DATABASE_URL') && !dbUrl.includes('user:password@localhost')) {
      try {
        logger.info('Connecting to PostgreSQL database...');
        this.pool = new Pool({
          connectionString: dbUrl,
          ssl: dbUrl.includes('localhost') ? false : { rejectUnauthorized: false },
          max: 10,
          connectionTimeoutMillis: 10000,
        });

        const client = await this.pool.connect();
        const res = await client.query('SELECT NOW()');
        client.release();
        this.isPostgresConnected = true;
        logger.info('Connected to PostgreSQL successfully at', res.rows[0].now);

        await this.initPostgresSchema();
      } catch (err) {
        logger.warn('Could not connect to PostgreSQL:', err.message);
        logger.warn('Running in Local Persistent Mode (data/hisabflow_db.json).');
        this.isPostgresConnected = false;
      }
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

        -- Ensure schema integrity columns and constraints
        ALTER TABLE categories ADD COLUMN IF NOT EXISTS parent_id VARCHAR(64) REFERENCES categories(id) ON DELETE SET NULL;
        ALTER TABLE transactions ADD COLUMN IF NOT EXISTS category_id VARCHAR(64) REFERENCES categories(id) ON DELETE SET NULL;

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
      logger.info('PostgreSQL schema verification, constraints, and indexes complete.');
    } catch (err) {
      logger.error('Error creating PostgreSQL tables:', err);
    } finally {
      client.release();
    }
  }

  async seedInitialSystemState() {
    const adminPassword = config.adminInitialPassword;
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
            `INSERT INTO users (id, username, email, password_hash, full_name, role, is_active, currency, timezone, date_format)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
             ON CONFLICT (email) DO NOTHING`,
            [
              initialAdmin.id,
              initialAdmin.username,
              initialAdmin.email,
              initialAdmin.passwordHash,
              initialAdmin.fullName,
              initialAdmin.role,
              initialAdmin.isActive,
              initialAdmin.currency,
              initialAdmin.timezone,
              initialAdmin.dateFormat,
            ]
          );
        }

        const userCheck = await client.query('SELECT id FROM users WHERE email = $1 LIMIT 1', [standardUser.email]);
        if (userCheck.rows.length === 0) {
          await client.query(
            `INSERT INTO users (id, username, email, password_hash, full_name, role, is_active, currency, timezone, date_format)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
             ON CONFLICT (email) DO NOTHING`,
            [
              standardUser.id,
              standardUser.username,
              standardUser.email,
              standardUser.passwordHash,
              standardUser.fullName,
              standardUser.role,
              standardUser.isActive,
              standardUser.currency,
              standardUser.timezone,
              standardUser.dateFormat,
            ]
          );
          await this.seedDefaultCategories(standardUser.id);
          await this.seedDefaultAccounts(standardUser.id);
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
    const starterAccounts = [
      {
        id: `acc_cash_${Date.now()}_default`,
        userId,
        name: 'Cash Wallet',
        type: 'CASH',
        openingBalance: 5000,
        currentBalance: 5000,
        currency: 'BDT',
        status: 'ACTIVE',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      {
        id: `acc_mfs_${Date.now()}_bkash`,
        userId,
        name: 'bKash Personal',
        type: 'MOBILE_BANKING',
        providerName: 'bKash',
        accountNumber: '01700000000',
        openingBalance: 10000,
        currentBalance: 10000,
        currency: 'BDT',
        status: 'ACTIVE',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      {
        id: `acc_bank_${Date.now()}_city`,
        userId,
        name: 'City Bank Priority',
        type: 'BANK',
        providerName: 'City Bank',
        accountNumber: '1102938475',
        openingBalance: 50000,
        currentBalance: 50000,
        currency: 'BDT',
        status: 'ACTIVE',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    ];

    for (const acc of starterAccounts) {
      await this.createAccount(acc);
    }
  }

  async seedDefaultCategories(userId) {
    for (const cat of DEFAULT_INCOME_CATEGORIES) {
      await this.createCategory({
        id: `cat_inc_${userId}_${cat.name.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase()}`,
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

    for (const cat of DEFAULT_EXPENSE_CATEGORIES) {
      await this.createCategory({
        id: `cat_exp_${userId}_${cat.name.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase()}`,
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

  // --------------------------------------------------------------------------
  // USER OPERATIONS
  // --------------------------------------------------------------------------

  async getUserById(id) {
    if (this.isPostgresConnected && this.pool) {
      const res = await this.pool.query(
        'SELECT id, username, email, password_hash as "passwordHash", firebase_uid as "firebaseUid", auth_provider as "authProvider", avatar_url as "avatarUrl", full_name as "fullName", role, is_active as "isActive", currency, timezone, date_format as "dateFormat", created_at as "createdAt", updated_at as "updatedAt" FROM users WHERE id = $1',
        [id]
      );
      return res.rows[0] || null;
    }
    return this.inMemoryData.users.find((u) => u.id === id) || null;
  }

  async getUserByUsernameOrEmail(identifier) {
    const clean = identifier.trim().toLowerCase();
    if (this.isPostgresConnected && this.pool) {
      const res = await this.pool.query(
        'SELECT id, username, email, password_hash as "passwordHash", firebase_uid as "firebaseUid", auth_provider as "authProvider", avatar_url as "avatarUrl", full_name as "fullName", role, is_active as "isActive", currency, timezone, date_format as "dateFormat", created_at as "createdAt", updated_at as "updatedAt" FROM users WHERE LOWER(username) = $1 OR LOWER(email) = $1',
        [clean]
      );
      return res.rows[0] || null;
    }
    return (
      this.inMemoryData.users.find(
        (u) => u.username.toLowerCase() === clean || u.email.toLowerCase() === clean
      ) || null
    );
  }

  async getUserByEmail(email) {
    const clean = email.trim().toLowerCase();
    if (this.isPostgresConnected && this.pool) {
      const res = await this.pool.query(
        'SELECT id, username, email, password_hash as "passwordHash", firebase_uid as "firebaseUid", auth_provider as "authProvider", avatar_url as "avatarUrl", full_name as "fullName", role, is_active as "isActive", currency, timezone, date_format as "dateFormat", created_at as "createdAt", updated_at as "updatedAt" FROM users WHERE LOWER(email) = $1',
        [clean]
      );
      return res.rows[0] || null;
    }
    return this.inMemoryData.users.find((u) => u.email.toLowerCase() === clean) || null;
  }

  async getUserByFirebaseUid(firebaseUid) {
    if (!firebaseUid) return null;
    if (this.isPostgresConnected && this.pool) {
      const res = await this.pool.query(
        'SELECT id, username, email, password_hash as "passwordHash", firebase_uid as "firebaseUid", auth_provider as "authProvider", avatar_url as "avatarUrl", full_name as "fullName", role, is_active as "isActive", currency, timezone, date_format as "dateFormat", created_at as "createdAt", updated_at as "updatedAt" FROM users WHERE firebase_uid = $1',
        [firebaseUid]
      );
      return res.rows[0] || null;
    }
    return this.inMemoryData.users.find((u) => u.firebaseUid === firebaseUid) || null;
  }

  async createUser(user) {
    if (this.isPostgresConnected && this.pool) {
      await this.pool.query(
        `INSERT INTO users (id, username, email, password_hash, full_name, role, is_active, currency, timezone, date_format, firebase_uid, auth_provider, avatar_url)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)`,
        [
          user.id,
          user.username,
          user.email,
          user.passwordHash,
          user.fullName || null,
          user.role || 'USER',
          user.isActive !== false,
          user.currency || 'BDT',
          user.timezone || 'Asia/Dhaka',
          user.dateFormat || 'DD MMM YYYY',
          user.firebaseUid || null,
          user.authProvider || 'LOCAL',
          user.avatarUrl || null,
        ]
      );
      return user;
    }
    this.inMemoryData.users.push(user);
    this.persistLocalDb();
    return user;
  }

  async updateUser(id, updates) {
    if (this.isPostgresConnected && this.pool) {
      const fields = [];
      const values = [];
      let i = 1;

      if (updates.fullName !== undefined) {
        fields.push(`full_name = $${i++}`);
        values.push(updates.fullName);
      }
      if (updates.email !== undefined) {
        fields.push(`email = $${i++}`);
        values.push(updates.email);
      }
      if (updates.passwordHash !== undefined) {
        fields.push(`password_hash = $${i++}`);
        values.push(updates.passwordHash);
      }
      if (updates.firebaseUid !== undefined) {
        fields.push(`firebase_uid = $${i++}`);
        values.push(updates.firebaseUid);
      }
      if (updates.authProvider !== undefined) {
        fields.push(`auth_provider = $${i++}`);
        values.push(updates.authProvider);
      }
      if (updates.avatarUrl !== undefined) {
        fields.push(`avatar_url = $${i++}`);
        values.push(updates.avatarUrl);
      }
      if (updates.role !== undefined) {
        fields.push(`role = $${i++}`);
        values.push(updates.role);
      }
      if (updates.isActive !== undefined) {
        fields.push(`is_active = $${i++}`);
        values.push(updates.isActive);
      }
      if (updates.currency !== undefined) {
        fields.push(`currency = $${i++}`);
        values.push(updates.currency);
      }
      if (updates.timezone !== undefined) {
        fields.push(`timezone = $${i++}`);
        values.push(updates.timezone);
      }
      if (updates.dateFormat !== undefined) {
        fields.push(`date_format = $${i++}`);
        values.push(updates.dateFormat);
      }

      fields.push(`updated_at = NOW()`);
      values.push(id);

      await this.pool.query(
        `UPDATE users SET ${fields.join(', ')} WHERE id = $${i}`,
        values
      );
      return this.getUserById(id);
    }

    const idx = this.inMemoryData.users.findIndex((u) => u.id === id);
    if (idx !== -1) {
      this.inMemoryData.users[idx] = {
        ...this.inMemoryData.users[idx],
        ...updates,
        updatedAt: new Date().toISOString(),
      };
      this.persistLocalDb();
      return this.inMemoryData.users[idx];
    }
    return null;
  }

  async deleteUser(id) {
    if (this.isPostgresConnected && this.pool) {
      await this.pool.query('DELETE FROM users WHERE id = $1', [id]);
      return true;
    }
    const idx = this.inMemoryData.users.findIndex((u) => u.id === id);
    if (idx !== -1) {
      this.inMemoryData.users.splice(idx, 1);
      // Cascade delete user data in local store
      this.inMemoryData.accounts = this.inMemoryData.accounts.filter((a) => a.userId !== id);
      this.inMemoryData.categories = this.inMemoryData.categories.filter((c) => c.userId !== id);
      this.inMemoryData.transactions = this.inMemoryData.transactions.filter((t) => t.userId !== id);
      this.inMemoryData.transfers = this.inMemoryData.transfers.filter((t) => t.userId !== id);
      this.inMemoryData.loans = this.inMemoryData.loans.filter((l) => l.userId !== id);
      this.inMemoryData.repayments = this.inMemoryData.repayments.filter((r) => r.userId !== id);
      this.inMemoryData.budgets = this.inMemoryData.budgets.filter((b) => b.userId !== id);
      this.persistLocalDb();
      return true;
    }
    return false;
  }

  async getPaginatedUsers(options) {
    const limit = options.limit || 50;
    const direction = options.direction || 'forward';
    let users = [...this.inMemoryData.users];

    if (this.isPostgresConnected && this.pool) {
      const res = await this.pool.query(
        'SELECT id, username, email, full_name as "fullName", role, is_active as "isActive", currency, timezone, date_format as "dateFormat", created_at as "createdAt", updated_at as "updatedAt" FROM users ORDER BY created_at DESC'
      );
      users = res.rows;
    }

    if (options.role && options.role !== 'ALL') {
      users = users.filter((u) => u.role === options.role);
    }
    if (options.status && options.status !== 'ALL') {
      const isActive = options.status === 'ACTIVE';
      users = users.filter((u) => u.isActive === isActive);
    }
    if (options.search && options.search.trim()) {
      const term = options.search.trim().toLowerCase();
      users = users.filter(
        (u) =>
          u.username.toLowerCase().includes(term) ||
          u.email.toLowerCase().includes(term) ||
          u.fullName.toLowerCase().includes(term)
      );
    }

    const totalCount = users.length;
    let cursorIdx = -1;
    if (options.cursor) {
      const decoded = decodeCursor(options.cursor);
      if (decoded && decoded.id) {
        cursorIdx = users.findIndex((u) => u.id === decoded.id);
      }
    }

    let items = [];
    let hasNextPage = false;
    let hasPreviousPage = false;

    if (direction === 'forward') {
      const startIndex = cursorIdx === -1 ? 0 : cursorIdx + 1;
      items = users.slice(startIndex, startIndex + limit);
      hasNextPage = startIndex + limit < users.length;
      hasPreviousPage = startIndex > 0;
    } else {
      const endIndex = cursorIdx === -1 ? users.length : cursorIdx;
      const startIndex = Math.max(0, endIndex - limit);
      items = users.slice(startIndex, endIndex);
      hasNextPage = endIndex < users.length;
      hasPreviousPage = startIndex > 0;
    }

    const nextCursor =
      items.length > 0 && hasNextPage
        ? encodeCursor({ id: items[items.length - 1].id, timestamp: items[items.length - 1].createdAt })
        : null;
    const previousCursor =
      items.length > 0 && hasPreviousPage
        ? encodeCursor({ id: items[0].id, timestamp: items[0].createdAt })
        : null;

    return {
      items: items.map(({ passwordHash, ...rest }) => rest),
      nextCursor,
      previousCursor,
      hasNextPage,
      hasPreviousPage,
      totalCount,
    };
  }

  // --------------------------------------------------------------------------
  // ACCOUNTS OPERATIONS
  // --------------------------------------------------------------------------

  async getAccounts(userId) {
    if (this.isPostgresConnected && this.pool) {
      const res = await this.pool.query(
        'SELECT id, user_id as "userId", name, type, provider_name as "providerName", account_number as "accountNumber", opening_balance as "openingBalance", current_balance as "currentBalance", currency, status, created_at as "createdAt", updated_at as "updatedAt" FROM accounts WHERE user_id = $1 ORDER BY created_at DESC',
        [userId]
      );
      return res.rows.map((r) => ({
        ...r,
        openingBalance: Number(r.openingBalance),
        currentBalance: Number(r.currentBalance),
      }));
    }
    return this.inMemoryData.accounts.filter((a) => a.userId === userId);
  }

  async getAccountById(userId, accountId) {
    const accounts = await this.getAccounts(userId);
    return accounts.find((a) => a.id === accountId) || null;
  }

  async createAccount(account) {
    if (this.isPostgresConnected && this.pool) {
      await this.pool.query(
        `INSERT INTO accounts (id, user_id, name, type, provider_name, account_number, opening_balance, current_balance, currency, status)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
        [
          account.id,
          account.userId,
          account.name,
          account.type,
          account.providerName || null,
          account.accountNumber || null,
          account.openingBalance || 0,
          account.currentBalance !== undefined ? account.currentBalance : account.openingBalance || 0,
          account.currency || 'BDT',
          account.status || 'ACTIVE',
        ]
      );
      return account;
    }
    this.inMemoryData.accounts.push(account);
    this.persistLocalDb();
    return account;
  }

  async updateAccount(id, userId, updates) {
    if (this.isPostgresConnected && this.pool) {
      const fields = [];
      const values = [];
      let i = 1;

      if (updates.name !== undefined) {
        fields.push(`name = $${i++}`);
        values.push(updates.name);
      }
      if (updates.type !== undefined) {
        fields.push(`type = $${i++}`);
        values.push(updates.type);
      }
      if (updates.providerName !== undefined) {
        fields.push(`provider_name = $${i++}`);
        values.push(updates.providerName);
      }
      if (updates.accountNumber !== undefined) {
        fields.push(`account_number = $${i++}`);
        values.push(updates.accountNumber);
      }
      if (updates.currentBalance !== undefined) {
        fields.push(`current_balance = $${i++}`);
        values.push(updates.currentBalance);
      }
      if (updates.status !== undefined) {
        fields.push(`status = $${i++}`);
        values.push(updates.status);
      }

      fields.push(`updated_at = NOW()`);
      values.push(id, userId);

      await this.pool.query(
        `UPDATE accounts SET ${fields.join(', ')} WHERE id = $${i++} AND user_id = $${i}`,
        values
      );
      return this.getAccountById(userId, id);
    }

    const idx = this.inMemoryData.accounts.findIndex((a) => a.id === id && a.userId === userId);
    if (idx !== -1) {
      this.inMemoryData.accounts[idx] = {
        ...this.inMemoryData.accounts[idx],
        ...updates,
        updatedAt: new Date().toISOString(),
      };
      this.persistLocalDb();
      return this.inMemoryData.accounts[idx];
    }
    return null;
  }

  async updateAccountBalance(accountId, delta) {
    if (this.isPostgresConnected && this.pool) {
      await this.pool.query(
        'UPDATE accounts SET current_balance = current_balance + $1, updated_at = NOW() WHERE id = $2',
        [delta, accountId]
      );
      return;
    }
    const acc = this.inMemoryData.accounts.find((a) => a.id === accountId);
    if (acc) {
      acc.currentBalance = Number((acc.currentBalance + delta).toFixed(2));
      acc.updatedAt = new Date().toISOString();
      this.persistLocalDb();
    }
  }

  async reconcileAccountBalance(accountId, userId) {
    if (this.isPostgresConnected && this.pool) {
      const client = await this.pool.connect();
      try {
        await client.query('BEGIN');
        const accRes = await client.query('SELECT * FROM accounts WHERE id = $1 AND user_id = $2 FOR UPDATE', [accountId, userId]);
        if (accRes.rows.length === 0) {
          await client.query('ROLLBACK');
          return null;
        }
        const acc = accRes.rows[0];
        const opening = Number(acc.opening_balance);

        const txRes = await client.query(
          `SELECT 
             COALESCE(SUM(CASE WHEN direction = 'INFLOW' THEN amount ELSE 0 END), 0) as inflows,
             COALESCE(SUM(CASE WHEN direction = 'OUTFLOW' THEN amount ELSE 0 END), 0) as outflows
           FROM transactions 
           WHERE account_id = $1 AND user_id = $2`,
          [accountId, userId]
        );
        const inflows = Number(txRes.rows[0].inflows);
        const outflows = Number(txRes.rows[0].outflows);

        const trfOutRes = await client.query(
          `SELECT COALESCE(SUM(amount + transfer_fee), 0) as transfers_out 
           FROM transfers WHERE source_account_id = $1 AND user_id = $2`,
          [accountId, userId]
        );
        const transfersOut = Number(trfOutRes.rows[0].transfers_out);

        const trfInRes = await client.query(
          `SELECT COALESCE(SUM(amount), 0) as transfers_in 
           FROM transfers WHERE destination_account_id = $1 AND user_id = $2`,
          [accountId, userId]
        );
        const transfersIn = Number(trfInRes.rows[0].transfers_in);

        const loansRes = await client.query(
          `SELECT 
             COALESCE(SUM(CASE WHEN type = 'LENT' THEN principal_amount ELSE 0 END), 0) as lent,
             COALESCE(SUM(CASE WHEN type = 'BORROWED' THEN principal_amount ELSE 0 END), 0) as borrowed
           FROM loans WHERE account_id = $1 AND user_id = $2`,
          [accountId, userId]
        );
        const lent = Number(loansRes.rows[0].lent);
        const borrowed = Number(loansRes.rows[0].borrowed);

        const repsRes = await client.query(
          `SELECT 
             COALESCE(SUM(CASE WHEN loan_type = 'LENT' THEN amount ELSE 0 END), 0) as lent_repaid,
             COALESCE(SUM(CASE WHEN loan_type = 'BORROWED' THEN amount ELSE 0 END), 0) as borrowed_repaid
           FROM repayments WHERE account_id = $1 AND user_id = $2`,
          [accountId, userId]
        );
        const lentRepaid = Number(repsRes.rows[0].lent_repaid);
        const borrowedRepaid = Number(repsRes.rows[0].borrowed_repaid);

        const calculatedBalance = Number(
          (opening + inflows - outflows - transfersOut + transfersIn - lent + borrowed + lentRepaid - borrowedRepaid).toFixed(2)
        );
        const currentStored = Number(acc.current_balance);
        const drift = Number((currentStored - calculatedBalance).toFixed(2));

        if (drift !== 0) {
          logger.warn(`Account balance drift detected for account ${accountId}: stored=${currentStored}, calculated=${calculatedBalance}, drift=${drift}. Auto-reconciling...`);
          await client.query('UPDATE accounts SET current_balance = $1, updated_at = NOW() WHERE id = $2', [calculatedBalance, accountId]);
        }

        await client.query('COMMIT');
        return {
          accountId,
          openingBalance: opening,
          storedBalance: currentStored,
          calculatedBalance,
          drift,
          reconciled: drift !== 0,
        };
      } catch (err) {
        await client.query('ROLLBACK');
        throw err;
      } finally {
        client.release();
      }
    }
    return null;
  }

  async reconcileAllUserAccounts(userId) {
    const accounts = await this.getAccounts(userId);
    const results = [];
    for (const a of accounts) {
      const res = await this.reconcileAccountBalance(a.id, userId);
      if (res) results.push(res);
    }
    return results;
  }

  async deleteAccount(id, userId) {
    // Safety check: Cannot delete account if it has any financial history
    const txs = await this.getTransactions(userId);
    if (txs.some((t) => t.accountId === id || t.destinationAccountId === id)) {
      return { success: false, error: 'Cannot delete account with existing transactions. Please archive it instead.' };
    }
    const trfs = await this.getTransfers(userId);
    if (trfs.some((t) => t.sourceAccountId === id || t.destinationAccountId === id)) {
      return { success: false, error: 'Cannot delete account with existing transfers. Please archive it instead.' };
    }
    const loans = await this.getLoans(userId);
    if (loans.some((l) => l.accountId === id)) {
      return { success: false, error: 'Cannot delete account with associated loans. Please archive it instead.' };
    }
    const reps = await this.getRepayments(userId);
    if (reps.some((r) => r.accountId === id)) {
      return { success: false, error: 'Cannot delete account with associated repayments. Please archive it instead.' };
    }

    if (this.isPostgresConnected && this.pool) {
      await this.pool.query('DELETE FROM accounts WHERE id = $1 AND user_id = $2', [id, userId]);
      return { success: true };
    }

    const idx = this.inMemoryData.accounts.findIndex((a) => a.id === id && a.userId === userId);
    if (idx !== -1) {
      this.inMemoryData.accounts.splice(idx, 1);
      this.persistLocalDb();
      return { success: true };
    }
    return { success: false, error: 'Account not found.' };
  }

  // --------------------------------------------------------------------------
  // CATEGORIES OPERATIONS
  // --------------------------------------------------------------------------

  async getCategories(userId) {
    if (this.isPostgresConnected && this.pool) {
      const res = await this.pool.query(
        'SELECT id, user_id as "userId", parent_id as "parentId", name, type, icon, color, subcategories, is_archived as "isArchived", is_system as "isSystem", created_at as "createdAt", updated_at as "updatedAt" FROM categories WHERE user_id = $1 ORDER BY name ASC',
        [userId]
      );
      const all = res.rows;
      const childMap = new Map();
      for (const c of all) {
        if (c.parentId) {
          if (!childMap.has(c.parentId)) childMap.set(c.parentId, []);
          childMap.get(c.parentId).push(c.name);
        }
      }
      return all.map((c) => {
        const extraSubs = childMap.get(c.id) || [];
        const existingSubs = Array.isArray(c.subcategories) ? c.subcategories : [];
        const combined = Array.from(new Set([...existingSubs, ...extraSubs]));
        return {
          ...c,
          subcategories: combined,
        };
      });
    }
    return this.inMemoryData.categories.filter((c) => c.userId === userId);
  }

  async createCategory(category) {
    if (this.isPostgresConnected && this.pool) {
      await this.pool.query(
        `INSERT INTO categories (id, user_id, parent_id, name, type, icon, color, subcategories, is_archived, is_system)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
        [
          category.id,
          category.userId,
          category.parentId || null,
          category.name,
          category.type,
          category.icon || null,
          category.color || null,
          JSON.stringify(category.subcategories || []),
          Boolean(category.isArchived),
          Boolean(category.isSystem),
        ]
      );
      return category;
    }
    this.inMemoryData.categories.push(category);
    this.persistLocalDb();
    return category;
  }

  async updateCategory(id, userId, updates) {
    if (this.isPostgresConnected && this.pool) {
      const fields = [];
      const values = [];
      let i = 1;

      if (updates.name !== undefined) {
        fields.push(`name = $${i++}`);
        values.push(updates.name);
      }
      if (updates.icon !== undefined) {
        fields.push(`icon = $${i++}`);
        values.push(updates.icon);
      }
      if (updates.color !== undefined) {
        fields.push(`color = $${i++}`);
        values.push(updates.color);
      }
      if (updates.subcategories !== undefined) {
        fields.push(`subcategories = $${i++}`);
        values.push(JSON.stringify(updates.subcategories));
      }
      if (updates.isArchived !== undefined) {
        fields.push(`is_archived = $${i++}`);
        values.push(updates.isArchived);
      }
      if (updates.parentId !== undefined) {
        fields.push(`parent_id = $${i++}`);
        values.push(updates.parentId || null);
      }

      fields.push(`updated_at = NOW()`);
      values.push(id, userId);

      await this.pool.query(
        `UPDATE categories SET ${fields.join(', ')} WHERE id = $${i++} AND user_id = $${i}`,
        values
      );
      const all = await this.getCategories(userId);
      return all.find((c) => c.id === id) || null;
    }

    const idx = this.inMemoryData.categories.findIndex((c) => c.id === id && c.userId === userId);
    if (idx !== -1) {
      this.inMemoryData.categories[idx] = {
        ...this.inMemoryData.categories[idx],
        ...updates,
        updatedAt: new Date().toISOString(),
      };
      this.persistLocalDb();
      return this.inMemoryData.categories[idx];
    }
    return null;
  }

  async deleteCategory(id, userId) {
    if (this.isPostgresConnected && this.pool) {
      await this.pool.query('DELETE FROM categories WHERE id = $1 AND user_id = $2', [id, userId]);
      return { success: true };
    }
    const idx = this.inMemoryData.categories.findIndex((c) => c.id === id && c.userId === userId);
    if (idx !== -1) {
      this.inMemoryData.categories.splice(idx, 1);
      this.persistLocalDb();
      return { success: true };
    }
    return { success: false, error: 'Category not found.' };
  }

  // --------------------------------------------------------------------------
  // TRANSACTIONS OPERATIONS
  // --------------------------------------------------------------------------

  async getTransactions(userId, filters = {}) {
    let txs = [];

    if (this.isPostgresConnected && this.pool) {
      const conditions = ['user_id = $1'];
      const values = [userId];
      let pIdx = 2;

      if (filters.type && filters.type !== 'ALL') {
        conditions.push(`type = $${pIdx++}`);
        values.push(filters.type);
      }
      if (filters.accountId && filters.accountId !== 'ALL') {
        conditions.push(`account_id = $${pIdx++}`);
        values.push(filters.accountId);
      }
      if (filters.categoryId) {
        conditions.push(`category_id = $${pIdx++}`);
        values.push(filters.categoryId);
      }
      if (filters.category && filters.category !== 'ALL') {
        conditions.push(`category = $${pIdx++}`);
        values.push(filters.category);
      }
      if (filters.startDate) {
        conditions.push(`date >= $${pIdx++}`);
        values.push(filters.startDate);
      }
      if (filters.endDate) {
        conditions.push(`date <= $${pIdx++}`);
        values.push(filters.endDate);
      }
      if (filters.search && filters.search.trim()) {
        const term = `%${filters.search.trim().toLowerCase()}%`;
        conditions.push(`(LOWER(description) LIKE $${pIdx} OR LOWER(reference) LIKE $${pIdx} OR LOWER(counterparty) LIKE $${pIdx} OR LOWER(category) LIKE $${pIdx})`);
        values.push(term);
        pIdx++;
      }

      const sql = `
        SELECT id, user_id as "userId", account_id as "accountId", account_name as "accountName", 
               category_id as "categoryId", type, category, subcategory, amount, direction, date, 
               description, reference, counterparty, status, transfer_id as "transferId", 
               loan_id as "loanId", destination_account_id as "destinationAccountId", 
               destination_account_name as "destinationAccountName", created_at as "createdAt" 
        FROM transactions 
        WHERE ${conditions.join(' AND ')} 
        ORDER BY date DESC, created_at DESC
      `;
      const res = await this.pool.query(sql, values);
      txs = res.rows.map((r) => ({
        ...r,
        amount: Number(r.amount),
        date: typeof r.date === 'string' ? r.date.slice(0, 10) : new Date(r.date).toISOString().slice(0, 10),
        createdAt: r.createdAt instanceof Date ? r.createdAt.toISOString() : (r.createdAt ? String(r.createdAt) : new Date().toISOString()),
      }));
    } else {
      txs = this.inMemoryData.transactions.filter((t) => t.userId === userId);
      if (filters.type && filters.type !== 'ALL') {
        txs = txs.filter((t) => t.type === filters.type);
      }
      if (filters.accountId && filters.accountId !== 'ALL') {
        txs = txs.filter((t) => t.accountId === filters.accountId);
      }
      if (filters.category && filters.category !== 'ALL') {
        txs = txs.filter((t) => t.category === filters.category);
      }
      if (filters.startDate) {
        txs = txs.filter((t) => t.date >= filters.startDate);
      }
      if (filters.endDate) {
        txs = txs.filter((t) => t.date <= filters.endDate);
      }
      if (filters.search && filters.search.trim()) {
        const term = filters.search.trim().toLowerCase();
        txs = txs.filter(
          (t) =>
            t.description.toLowerCase().includes(term) ||
            (t.reference && t.reference.toLowerCase().includes(term)) ||
            (t.counterparty && t.counterparty.toLowerCase().includes(term)) ||
            (t.category && t.category.toLowerCase().includes(term))
        );
      }
    }

    return txs.sort((a, b) => {
      const dateCmp = new Date(b.date).getTime() - new Date(a.date).getTime();
      if (dateCmp !== 0) return dateCmp;
      const timeA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const timeB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return timeB - timeA;
    });
  }

  async getPaginatedTransactions(userId, options) {
    const limit = options.limit || 50;
    const direction = options.direction || 'forward';
    const txs = await this.getTransactions(userId, options);

    const totalCount = txs.length;
    let cursorIdx = -1;
    if (options.cursor) {
      const decoded = decodeCursor(options.cursor);
      if (decoded && decoded.id) {
        cursorIdx = txs.findIndex((t) => t.id === decoded.id);
      }
    }

    let items = [];
    let hasNextPage = false;
    let hasPreviousPage = false;

    if (options.page !== undefined && options.page > 0) {
      const pageNum = options.page;
      const startIndex = (pageNum - 1) * limit;
      items = txs.slice(startIndex, startIndex + limit);
      hasNextPage = startIndex + limit < txs.length;
      hasPreviousPage = startIndex > 0;
    } else if (direction === 'forward') {
      const startIndex = cursorIdx === -1 ? 0 : cursorIdx + 1;
      items = txs.slice(startIndex, startIndex + limit);
      hasNextPage = startIndex + limit < txs.length;
      hasPreviousPage = startIndex > 0;
    } else {
      const endIndex = cursorIdx === -1 ? txs.length : cursorIdx;
      const startIndex = Math.max(0, endIndex - limit);
      items = txs.slice(startIndex, endIndex);
      hasNextPage = endIndex < txs.length;
      hasPreviousPage = startIndex > 0;
    }

    const nextCursor =
      items.length > 0 && hasNextPage
        ? encodeCursor({ id: items[items.length - 1].id, timestamp: items[items.length - 1].date })
        : null;
    const previousCursor =
      items.length > 0 && hasPreviousPage
        ? encodeCursor({ id: items[0].id, timestamp: items[0].date })
        : null;

    return {
      items,
      nextCursor,
      previousCursor,
      hasNextPage,
      hasPreviousPage,
      totalCount,
    };
  }

  async createTransaction(tx) {
    const cleanAmount = Number(tx.amount);
    if (isNaN(cleanAmount) || cleanAmount <= 0) {
      throw new Error('Transaction amount must be a positive number.');
    }

    if (this.isPostgresConnected && this.pool) {
      const client = await this.pool.connect();
      try {
        await client.query('BEGIN');

        // Check account ownership and lock row
        const accRes = await client.query(
          'SELECT id, name FROM accounts WHERE id = $1 AND user_id = $2 FOR UPDATE',
          [tx.accountId, tx.userId]
        );
        if (accRes.rows.length === 0) {
          throw new Error('Account not found or access denied.');
        }

        // Resolve or verify categoryId
        let categoryId = tx.categoryId || null;
        if (!categoryId && (tx.category || tx.subcategory)) {
          const catRes = await client.query(
            `SELECT id FROM categories 
             WHERE user_id = $1 
               AND (LOWER(name) = LOWER($2) OR (LOWER(name) = LOWER($3) AND $3 IS NOT NULL))
             ORDER BY parent_id NULLS LAST LIMIT 1`,
            [tx.userId, tx.subcategory || tx.category, tx.category]
          );
          if (catRes.rows.length > 0) {
            categoryId = catRes.rows[0].id;
          }
        }

        await client.query(
          `INSERT INTO transactions (id, user_id, account_id, account_name, category_id, type, category, subcategory, amount, direction, date, description, reference, counterparty, status, transfer_id, loan_id, destination_account_id, destination_account_name)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19)`,
          [
            tx.id,
            tx.userId,
            tx.accountId,
            tx.accountName || accRes.rows[0].name,
            categoryId,
            tx.type,
            tx.category || null,
            tx.subcategory || null,
            cleanAmount,
            tx.direction,
            tx.date,
            tx.description,
            tx.reference || null,
            tx.counterparty || null,
            tx.status || 'COMPLETED',
            tx.transferId || null,
            tx.loanId || null,
            tx.destinationAccountId || null,
            tx.destinationAccountName || null,
          ]
        );

        let balanceDelta = 0;
        if (tx.direction === 'INFLOW') balanceDelta = cleanAmount;
        else if (tx.direction === 'OUTFLOW') balanceDelta = -cleanAmount;

        if (balanceDelta !== 0) {
          await client.query(
            'UPDATE accounts SET current_balance = current_balance + $1, updated_at = NOW() WHERE id = $2',
            [balanceDelta, tx.accountId]
          );
        }

        await client.query('COMMIT');
        return {
          ...tx,
          categoryId,
          amount: cleanAmount,
        };
      } catch (err) {
        await client.query('ROLLBACK');
        throw err;
      } finally {
        client.release();
      }
    } else {
      this.inMemoryData.transactions.push(tx);
      let balanceDelta = 0;
      if (tx.direction === 'INFLOW') balanceDelta = cleanAmount;
      else if (tx.direction === 'OUTFLOW') balanceDelta = -cleanAmount;

      if (balanceDelta !== 0) {
        await this.updateAccountBalance(tx.accountId, balanceDelta);
      }
      this.persistLocalDb();
      return tx;
    }
  }

  async updateTransaction(id, userId, updates) {
    const txs = await this.getTransactions(userId);
    const existing = txs.find((t) => t.id === id);
    if (!existing) return null;

    const newAmount = updates.amount !== undefined ? Number(updates.amount) : existing.amount;
    const newAccountId = updates.accountId || existing.accountId;
    const accountChanged = newAccountId !== existing.accountId;
    const amountChanged = newAmount !== existing.amount;

    if (this.isPostgresConnected && this.pool) {
      const client = await this.pool.connect();
      try {
        await client.query('BEGIN');

        // 1. Rebalance accounts if account or amount changed
        if (accountChanged) {
          // Revert old transaction effect on old account
          const oldRevert = existing.direction === 'INFLOW' ? -existing.amount : existing.amount;
          await client.query(
            'UPDATE accounts SET current_balance = current_balance + $1, updated_at = NOW() WHERE id = $2',
            [oldRevert, existing.accountId]
          );
          // Apply new transaction effect on new account
          const newApply = existing.direction === 'INFLOW' ? newAmount : -newAmount;
          await client.query(
            'UPDATE accounts SET current_balance = current_balance + $1, updated_at = NOW() WHERE id = $2',
            [newApply, newAccountId]
          );
        } else if (amountChanged) {
          const diff = newAmount - existing.amount;
          const delta = existing.direction === 'INFLOW' ? diff : -diff;
          await client.query(
            'UPDATE accounts SET current_balance = current_balance + $1, updated_at = NOW() WHERE id = $2',
            [delta, existing.accountId]
          );
        }

        // 2. Build update query
        const fields = [];
        const values = [];
        let i = 1;

        if (updates.accountId !== undefined) {
          fields.push(`account_id = $${i++}`);
          values.push(updates.accountId);
        }
        if (updates.accountName !== undefined) {
          fields.push(`account_name = $${i++}`);
          values.push(updates.accountName);
        }
        if (updates.amount !== undefined) {
          fields.push(`amount = $${i++}`);
          values.push(newAmount);
        }
        if (updates.category !== undefined) {
          fields.push(`category = $${i++}`);
          values.push(updates.category);
        }
        if (updates.subcategory !== undefined) {
          fields.push(`subcategory = $${i++}`);
          values.push(updates.subcategory);
        }
        if (updates.date !== undefined) {
          fields.push(`date = $${i++}`);
          values.push(updates.date);
        }
        if (updates.description !== undefined) {
          fields.push(`description = $${i++}`);
          values.push(updates.description);
        }
        if (updates.reference !== undefined) {
          fields.push(`reference = $${i++}`);
          values.push(updates.reference);
        }

        values.push(id, userId);

        await client.query(
          `UPDATE transactions SET ${fields.join(', ')} WHERE id = $${i++} AND user_id = $${i}`,
          values
        );

        await client.query('COMMIT');
      } catch (err) {
        await client.query('ROLLBACK');
        throw err;
      } finally {
        client.release();
      }

      const updatedList = await this.getTransactions(userId);
      return updatedList.find((t) => t.id === id) || null;
    }

    // In-memory fallback
    if (accountChanged) {
      const oldRevert = existing.direction === 'INFLOW' ? -existing.amount : existing.amount;
      await this.updateAccountBalance(existing.accountId, oldRevert);
      const newDelta = existing.direction === 'INFLOW' ? newAmount : -newAmount;
      await this.updateAccountBalance(newAccountId, newDelta);
    } else if (amountChanged) {
      const diff = newAmount - existing.amount;
      const delta = existing.direction === 'INFLOW' ? diff : -diff;
      await this.updateAccountBalance(existing.accountId, delta);
    }

    const idx = this.inMemoryData.transactions.findIndex((t) => t.id === id && t.userId === userId);
    if (idx !== -1) {
      this.inMemoryData.transactions[idx] = {
        ...this.inMemoryData.transactions[idx],
        ...updates,
      };
      this.persistLocalDb();
      return this.inMemoryData.transactions[idx];
    }
    return null;
  }

  async deleteTransaction(id, userId) {
    const txs = await this.getTransactions(userId);
    const existing = txs.find((t) => t.id === id);
    if (!existing) return false;

    let reverseDelta = 0;
    if (existing.direction === 'INFLOW') reverseDelta = -existing.amount;
    else if (existing.direction === 'OUTFLOW') reverseDelta = existing.amount;

    if (this.isPostgresConnected && this.pool) {
      const client = await this.pool.connect();
      try {
        await client.query('BEGIN');
        if (reverseDelta !== 0) {
          await client.query(
            'UPDATE accounts SET current_balance = current_balance + $1, updated_at = NOW() WHERE id = $2',
            [reverseDelta, existing.accountId]
          );
        }
        await client.query('DELETE FROM transactions WHERE id = $1 AND user_id = $2', [id, userId]);
        await client.query('COMMIT');
        return true;
      } catch (err) {
        await client.query('ROLLBACK');
        throw err;
      } finally {
        client.release();
      }
    }

    if (reverseDelta !== 0) {
      await this.updateAccountBalance(existing.accountId, reverseDelta);
    }
    const idx = this.inMemoryData.transactions.findIndex((t) => t.id === id && t.userId === userId);
    if (idx !== -1) {
      this.inMemoryData.transactions.splice(idx, 1);
      this.persistLocalDb();
      return true;
    }
    return false;
  }

  // --------------------------------------------------------------------------
  // TRANSFERS OPERATIONS
  // --------------------------------------------------------------------------

  async getTransfers(userId, filters = {}) {
    let transfers = this.inMemoryData.transfers.filter((t) => t.userId === userId);

    if (this.isPostgresConnected && this.pool) {
      const res = await this.pool.query(
        'SELECT id, user_id as "userId", source_account_id as "sourceAccountId", source_account_name as "sourceAccountName", destination_account_id as "destinationAccountId", destination_account_name as "destinationAccountName", amount, transfer_fee as "transferFee", date, description, reference, created_at as "createdAt" FROM transfers WHERE user_id = $1 ORDER BY date DESC, created_at DESC',
        [userId]
      );
      transfers = res.rows.map((r) => ({
        ...r,
        amount: Number(r.amount),
        transferFee: Number(r.transferFee || 0),
        date: typeof r.date === 'string' ? r.date.slice(0, 10) : new Date(r.date).toISOString().slice(0, 10),
        createdAt: r.createdAt instanceof Date ? r.createdAt.toISOString() : (r.createdAt ? String(r.createdAt) : new Date().toISOString()),
      }));
    }

    if (filters.sourceAccountId && filters.sourceAccountId !== 'ALL') {
      transfers = transfers.filter((t) => t.sourceAccountId === filters.sourceAccountId);
    }
    if (filters.destAccountId && filters.destAccountId !== 'ALL') {
      transfers = transfers.filter((t) => t.destinationAccountId === filters.destAccountId);
    }
    if (filters.startDate) {
      transfers = transfers.filter((t) => t.date >= filters.startDate);
    }
    if (filters.endDate) {
      transfers = transfers.filter((t) => t.date <= filters.endDate);
    }
    if (filters.search && filters.search.trim()) {
      const term = filters.search.trim().toLowerCase();
      transfers = transfers.filter(
        (t) =>
          (t.description && t.description.toLowerCase().includes(term)) ||
          (t.reference && t.reference.toLowerCase().includes(term)) ||
          t.sourceAccountName.toLowerCase().includes(term) ||
          t.destinationAccountName.toLowerCase().includes(term)
      );
    }

    return transfers.sort((a, b) => {
      const dateCmp = new Date(b.date).getTime() - new Date(a.date).getTime();
      if (dateCmp !== 0) return dateCmp;
      const timeA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const timeB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return timeB - timeA;
    });
  }

  async getPaginatedTransfers(userId, options) {
    const limit = options.limit || 50;
    const direction = options.direction || 'forward';
    const transfers = await this.getTransfers(userId, options);

    const totalCount = transfers.length;
    let cursorIdx = -1;
    if (options.cursor) {
      const decoded = decodeCursor(options.cursor);
      if (decoded && decoded.id) {
        cursorIdx = transfers.findIndex((t) => t.id === decoded.id);
      }
    }

    let items = [];
    let hasNextPage = false;
    let hasPreviousPage = false;

    if (options.page !== undefined && options.page > 0) {
      const pageNum = options.page;
      const startIndex = (pageNum - 1) * limit;
      items = transfers.slice(startIndex, startIndex + limit);
      hasNextPage = startIndex + limit < transfers.length;
      hasPreviousPage = startIndex > 0;
    } else if (direction === 'forward') {
      const startIndex = cursorIdx === -1 ? 0 : cursorIdx + 1;
      items = transfers.slice(startIndex, startIndex + limit);
      hasNextPage = startIndex + limit < transfers.length;
      hasPreviousPage = startIndex > 0;
    } else {
      const endIndex = cursorIdx === -1 ? transfers.length : cursorIdx;
      const startIndex = Math.max(0, endIndex - limit);
      items = transfers.slice(startIndex, endIndex);
      hasNextPage = endIndex < transfers.length;
      hasPreviousPage = startIndex > 0;
    }

    const nextCursor =
      items.length > 0 && hasNextPage
        ? encodeCursor({ id: items[items.length - 1].id, timestamp: items[items.length - 1].date })
        : null;
    const previousCursor =
      items.length > 0 && hasPreviousPage
        ? encodeCursor({ id: items[0].id, timestamp: items[0].date })
        : null;

    return {
      items,
      nextCursor,
      previousCursor,
      hasNextPage,
      hasPreviousPage,
      totalCount,
    };
  }

  async createTransfer(transfer) {
    if (transfer.sourceAccountId === transfer.destinationAccountId) {
      throw new Error('Source and destination accounts must be different.');
    }
    const cleanAmount = Number(transfer.amount);
    if (isNaN(cleanAmount) || cleanAmount <= 0) {
      throw new Error('Transfer amount must be a positive number.');
    }
    const cleanFee = Number(transfer.transferFee || 0);
    if (isNaN(cleanFee) || cleanFee < 0) {
      throw new Error('Transfer fee cannot be negative.');
    }
    const totalOut = Number((cleanAmount + cleanFee).toFixed(2));

    if (this.isPostgresConnected && this.pool) {
      const client = await this.pool.connect();
      try {
        await client.query('BEGIN');

        // Lock and verify both accounts belong to this user
        const srcRes = await client.query('SELECT id, name FROM accounts WHERE id = $1 AND user_id = $2 FOR UPDATE', [transfer.sourceAccountId, transfer.userId]);
        const dstRes = await client.query('SELECT id, name FROM accounts WHERE id = $1 AND user_id = $2 FOR UPDATE', [transfer.destinationAccountId, transfer.userId]);
        if (srcRes.rows.length === 0 || dstRes.rows.length === 0) {
          throw new Error('Source or destination account not found or access denied.');
        }

        await client.query(
          `INSERT INTO transfers (id, user_id, source_account_id, source_account_name, destination_account_id, destination_account_name, amount, transfer_fee, date, description, reference)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
          [
            transfer.id,
            transfer.userId,
            transfer.sourceAccountId,
            transfer.sourceAccountName || srcRes.rows[0].name,
            transfer.destinationAccountId,
            transfer.destinationAccountName || dstRes.rows[0].name,
            cleanAmount,
            cleanFee,
            transfer.date,
            transfer.description || null,
            transfer.reference || null,
          ]
        );

        // Deduct from source: amount + fee
        await client.query(
          'UPDATE accounts SET current_balance = current_balance - $1, updated_at = NOW() WHERE id = $2',
          [totalOut, transfer.sourceAccountId]
        );
        // Add to destination: amount
        await client.query(
          'UPDATE accounts SET current_balance = current_balance + $1, updated_at = NOW() WHERE id = $2',
          [cleanAmount, transfer.destinationAccountId]
        );

        await client.query('COMMIT');
        return {
          ...transfer,
          amount: cleanAmount,
          transferFee: cleanFee,
        };
      } catch (err) {
        await client.query('ROLLBACK');
        throw err;
      } finally {
        client.release();
      }
    } else {
      this.inMemoryData.transfers.push(transfer);
      await this.updateAccountBalance(transfer.sourceAccountId, -totalOut);
      await this.updateAccountBalance(transfer.destinationAccountId, cleanAmount);
      this.persistLocalDb();
      return transfer;
    }
  }

  async deleteTransfer(transferId, userId) {
    if (this.isPostgresConnected && this.pool) {
      const client = await this.pool.connect();
      try {
        await client.query('BEGIN');
        const res = await client.query('SELECT * FROM transfers WHERE id = $1 AND user_id = $2 FOR UPDATE', [transferId, userId]);
        if (res.rows.length === 0) {
          await client.query('ROLLBACK');
          return false;
        }
        const existing = res.rows[0];
        const totalOut = Number((Number(existing.amount) + Number(existing.transfer_fee || 0)).toFixed(2));

        // Reverse source account: refund amount + fee
        await client.query('UPDATE accounts SET current_balance = current_balance + $1, updated_at = NOW() WHERE id = $2', [totalOut, existing.source_account_id]);
        // Reverse destination account: deduct amount
        await client.query('UPDATE accounts SET current_balance = current_balance - $1, updated_at = NOW() WHERE id = $2', [existing.amount, existing.destination_account_id]);

        await client.query('DELETE FROM transfers WHERE id = $1 AND user_id = $2', [transferId, userId]);
        await client.query('COMMIT');
        return true;
      } catch (err) {
        await client.query('ROLLBACK');
        throw err;
      } finally {
        client.release();
      }
    }

    const transfers = await this.getTransfers(userId);
    const existing = transfers.find((t) => t.id === transferId);
    if (!existing) return false;

    const totalOut = Number((existing.amount + (existing.transferFee || 0)).toFixed(2));
    await this.updateAccountBalance(existing.sourceAccountId, totalOut);
    await this.updateAccountBalance(existing.destinationAccountId, -existing.amount);

    const idx = this.inMemoryData.transfers.findIndex((t) => t.id === transferId && t.userId === userId);
    if (idx !== -1) {
      this.inMemoryData.transfers.splice(idx, 1);
      this.persistLocalDb();
      return true;
    }
    return false;
  }

  // --------------------------------------------------------------------------
  // LOANS & REPAYMENTS OPERATIONS
  // --------------------------------------------------------------------------

  async getLoans(userId, filters = {}) {
    let loans = this.inMemoryData.loans.filter((l) => l.userId === userId);

    if (this.isPostgresConnected && this.pool) {
      const res = await this.pool.query(
        'SELECT id, user_id as "userId", account_id as "accountId", account_name as "accountName", type, counterparty_name as "counterpartyName", counterparty_contact as "counterpartyContact", principal_amount as "principalAmount", outstanding_principal as "outstandingPrincipal", interest_rate as "interestRate", start_date as "startDate", due_date as "dueDate", status, notes, created_at as "createdAt", updated_at as "updatedAt" FROM loans WHERE user_id = $1 ORDER BY start_date DESC, created_at DESC',
        [userId]
      );
      loans = res.rows.map((r) => ({
        ...r,
        principalAmount: Number(r.principalAmount),
        outstandingPrincipal: Number(r.outstandingPrincipal),
        interestRate: Number(r.interestRate || 0),
        startDate: typeof r.startDate === 'string' ? r.startDate.slice(0, 10) : new Date(r.startDate).toISOString().slice(0, 10),
        dueDate: r.dueDate ? (typeof r.dueDate === 'string' ? r.dueDate.slice(0, 10) : new Date(r.dueDate).toISOString().slice(0, 10)) : undefined,
        createdAt: r.createdAt instanceof Date ? r.createdAt.toISOString() : (r.createdAt ? String(r.createdAt) : new Date().toISOString()),
      }));
    }

    if (filters.type && filters.type !== 'ALL') {
      loans = loans.filter((l) => l.type === filters.type);
    }
    if (filters.status && filters.status !== 'ALL') {
      loans = loans.filter((l) => l.status === filters.status);
    }
    if (filters.search && filters.search.trim()) {
      const term = filters.search.trim().toLowerCase();
      loans = loans.filter(
        (l) =>
          l.counterpartyName.toLowerCase().includes(term) ||
          (l.counterpartyContact && l.counterpartyContact.toLowerCase().includes(term)) ||
          (l.notes && l.notes.toLowerCase().includes(term))
      );
    }

    return loans.sort((a, b) => {
      const dateCmp = new Date(b.startDate).getTime() - new Date(a.startDate).getTime();
      if (dateCmp !== 0) return dateCmp;
      const timeA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const timeB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return timeB - timeA;
    });
  }

  async getPaginatedLoans(userId, options) {
    const limit = options.limit || 50;
    const direction = options.direction || 'forward';
    const loans = await this.getLoans(userId, options);

    const totalCount = loans.length;
    let cursorIdx = -1;
    if (options.cursor) {
      const decoded = decodeCursor(options.cursor);
      if (decoded && decoded.id) {
        cursorIdx = loans.findIndex((l) => l.id === decoded.id);
      }
    }

    let items = [];
    let hasNextPage = false;
    let hasPreviousPage = false;

    if (options.page !== undefined && options.page > 0) {
      const pageNum = options.page;
      const startIndex = (pageNum - 1) * limit;
      items = loans.slice(startIndex, startIndex + limit);
      hasNextPage = startIndex + limit < loans.length;
      hasPreviousPage = startIndex > 0;
    } else if (direction === 'forward') {
      const startIndex = cursorIdx === -1 ? 0 : cursorIdx + 1;
      items = loans.slice(startIndex, startIndex + limit);
      hasNextPage = startIndex + limit < loans.length;
      hasPreviousPage = startIndex > 0;
    } else {
      const endIndex = cursorIdx === -1 ? loans.length : cursorIdx;
      const startIndex = Math.max(0, endIndex - limit);
      items = loans.slice(startIndex, endIndex);
      hasNextPage = endIndex < loans.length;
      hasPreviousPage = startIndex > 0;
    }

    const nextCursor =
      items.length > 0 && hasNextPage
        ? encodeCursor({ id: items[items.length - 1].id, timestamp: items[items.length - 1].startDate })
        : null;
    const previousCursor =
      items.length > 0 && hasPreviousPage
        ? encodeCursor({ id: items[0].id, timestamp: items[0].startDate })
        : null;

    return {
      items,
      nextCursor,
      previousCursor,
      hasNextPage,
      hasPreviousPage,
      totalCount,
    };
  }

  async createLoan(loan) {
    const cleanPrincipal = Number(loan.principalAmount);
    if (isNaN(cleanPrincipal) || cleanPrincipal <= 0) {
      throw new Error('Principal amount must be a positive number.');
    }
    const delta = loan.type === 'LENT' ? -cleanPrincipal : cleanPrincipal;

    if (this.isPostgresConnected && this.pool) {
      const client = await this.pool.connect();
      try {
        await client.query('BEGIN');
        const accRes = await client.query('SELECT id, name FROM accounts WHERE id = $1 AND user_id = $2 FOR UPDATE', [loan.accountId, loan.userId]);
        if (accRes.rows.length === 0) {
          throw new Error('Disbursing/receiving account not found or access denied.');
        }

        await client.query(
          `INSERT INTO loans (id, user_id, account_id, account_name, type, counterparty_name, counterparty_contact, principal_amount, outstanding_principal, interest_rate, start_date, due_date, status, notes)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)`,
          [
            loan.id,
            loan.userId,
            loan.accountId,
            loan.accountName || accRes.rows[0].name,
            loan.type,
            loan.counterpartyName,
            loan.counterpartyContact || null,
            cleanPrincipal,
            cleanPrincipal,
            loan.interestRate || 0,
            loan.startDate,
            loan.dueDate || null,
            loan.status || 'ACTIVE',
            loan.notes || null,
          ]
        );

        // Adjust account balance
        await client.query(
          'UPDATE accounts SET current_balance = current_balance + $1, updated_at = NOW() WHERE id = $2',
          [delta, loan.accountId]
        );

        await client.query('COMMIT');
        return {
          ...loan,
          principalAmount: cleanPrincipal,
          outstandingPrincipal: cleanPrincipal,
        };
      } catch (err) {
        await client.query('ROLLBACK');
        throw err;
      } finally {
        client.release();
      }
    } else {
      this.inMemoryData.loans.push(loan);
      await this.updateAccountBalance(loan.accountId, delta);
      this.persistLocalDb();
      return loan;
    }
  }

  async deleteLoan(loanId, userId) {
    if (this.isPostgresConnected && this.pool) {
      const client = await this.pool.connect();
      try {
        await client.query('BEGIN');
        const loanRes = await client.query('SELECT * FROM loans WHERE id = $1 AND user_id = $2 FOR UPDATE', [loanId, userId]);
        if (loanRes.rows.length === 0) {
          await client.query('ROLLBACK');
          return false;
        }
        const existing = loanRes.rows[0];

        // Check and reverse any associated repayments
        const repsRes = await client.query('SELECT * FROM repayments WHERE loan_id = $1', [loanId]);
        for (const rep of repsRes.rows) {
          const repReverse = existing.type === 'LENT' ? -Number(rep.amount) : Number(rep.amount);
          await client.query('UPDATE accounts SET current_balance = current_balance + $1, updated_at = NOW() WHERE id = $2', [repReverse, rep.account_id]);
        }
        await client.query('DELETE FROM repayments WHERE loan_id = $1', [loanId]);

        // Reverse initial loan disbursement
        const reversePrincipal = existing.type === 'LENT' ? Number(existing.principal_amount) : -Number(existing.principal_amount);
        await client.query('UPDATE accounts SET current_balance = current_balance + $1, updated_at = NOW() WHERE id = $2', [reversePrincipal, existing.account_id]);

        await client.query('DELETE FROM loans WHERE id = $1 AND user_id = $2', [loanId, userId]);
        await client.query('COMMIT');
        return true;
      } catch (err) {
        await client.query('ROLLBACK');
        throw err;
      } finally {
        client.release();
      }
    }

    const loans = await this.getLoans(userId);
    const existing = loans.find((l) => l.id === loanId);
    if (!existing) return false;

    const reverse = existing.type === 'LENT' ? existing.principalAmount : -existing.principalAmount;
    await this.updateAccountBalance(existing.accountId, reverse);

    const idx = this.inMemoryData.loans.findIndex((l) => l.id === loanId && l.userId === userId);
    if (idx !== -1) {
      this.inMemoryData.loans.splice(idx, 1);
      this.inMemoryData.repayments = this.inMemoryData.repayments.filter((r) => r.loanId !== loanId);
      this.persistLocalDb();
      return true;
    }
    return false;
  }

  async getRepayments(userId, filters = {}) {
    let repayments = this.inMemoryData.repayments.filter((r) => r.userId === userId);

    if (this.isPostgresConnected && this.pool) {
      const res = await this.pool.query(
        'SELECT id, user_id as "userId", loan_id as "loanId", counterparty_name as "counterpartyName", loan_type as "loanType", account_id as "accountId", account_name as "accountName", amount, date, notes, created_at as "createdAt" FROM repayments WHERE user_id = $1 ORDER BY date DESC, created_at DESC',
        [userId]
      );
      repayments = res.rows.map((r) => ({
        ...r,
        amount: Number(r.amount),
        date: typeof r.date === 'string' ? r.date.slice(0, 10) : new Date(r.date).toISOString().slice(0, 10),
        createdAt: r.createdAt instanceof Date ? r.createdAt.toISOString() : (r.createdAt ? String(r.createdAt) : new Date().toISOString()),
      }));
    }

    if (filters.loanId) {
      repayments = repayments.filter((r) => r.loanId === filters.loanId);
    }
    if (filters.search && filters.search.trim()) {
      const term = filters.search.trim().toLowerCase();
      repayments = repayments.filter(
        (r) =>
          r.counterpartyName.toLowerCase().includes(term) ||
          (r.notes && r.notes.toLowerCase().includes(term))
      );
    }

    return repayments.sort((a, b) => {
      const dateCmp = new Date(b.date).getTime() - new Date(a.date).getTime();
      if (dateCmp !== 0) return dateCmp;
      const timeA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const timeB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return timeB - timeA;
    });
  }

  async getPaginatedRepayments(userId, options) {
    const limit = options.limit || 50;
    const direction = options.direction || 'forward';
    const reps = await this.getRepayments(userId, options);

    const totalCount = reps.length;
    let cursorIdx = -1;
    if (options.cursor) {
      const decoded = decodeCursor(options.cursor);
      if (decoded && decoded.id) {
        cursorIdx = reps.findIndex((r) => r.id === decoded.id);
      }
    }

    let items = [];
    let hasNextPage = false;
    let hasPreviousPage = false;

    if (options.page !== undefined && options.page > 0) {
      const pageNum = options.page;
      const startIndex = (pageNum - 1) * limit;
      items = reps.slice(startIndex, startIndex + limit);
      hasNextPage = startIndex + limit < reps.length;
      hasPreviousPage = startIndex > 0;
    } else if (direction === 'forward') {
      const startIndex = cursorIdx === -1 ? 0 : cursorIdx + 1;
      items = reps.slice(startIndex, startIndex + limit);
      hasNextPage = startIndex + limit < reps.length;
      hasPreviousPage = startIndex > 0;
    } else {
      const endIndex = cursorIdx === -1 ? reps.length : cursorIdx;
      const startIndex = Math.max(0, endIndex - limit);
      items = reps.slice(startIndex, endIndex);
      hasNextPage = endIndex < reps.length;
      hasPreviousPage = startIndex > 0;
    }

    const nextCursor =
      items.length > 0 && hasNextPage
        ? encodeCursor({ id: items[items.length - 1].id, timestamp: items[items.length - 1].date })
        : null;
    const previousCursor =
      items.length > 0 && hasPreviousPage
        ? encodeCursor({ id: items[0].id, timestamp: items[0].date })
        : null;

    return {
      items,
      nextCursor,
      previousCursor,
      hasNextPage,
      hasPreviousPage,
      totalCount,
    };
  }

  async addRepayment(repayment) {
    const cleanAmount = Number(repayment.amount);
    if (isNaN(cleanAmount) || cleanAmount <= 0) {
      throw new Error('Repayment amount must be a positive number.');
    }

    if (this.isPostgresConnected && this.pool) {
      const client = await this.pool.connect();
      try {
        await client.query('BEGIN');
        const loanRes = await client.query('SELECT * FROM loans WHERE id = $1 AND user_id = $2 FOR UPDATE', [repayment.loanId, repayment.userId]);
        if (loanRes.rows.length === 0) {
          throw new Error('Associated loan not found or access denied.');
        }
        const loan = loanRes.rows[0];
        const outstanding = Number(loan.outstanding_principal);
        if (cleanAmount > outstanding) {
          throw new Error(`Repayment amount (${cleanAmount}) cannot exceed outstanding principal (${outstanding}).`);
        }

        const newOutstanding = Number(Math.max(0, outstanding - cleanAmount).toFixed(2));
        const newStatus = newOutstanding <= 0 ? 'SETTLED' : 'PARTIALLY_REPAID';

        await client.query(
          `INSERT INTO repayments (id, user_id, loan_id, counterparty_name, loan_type, account_id, account_name, amount, date, notes)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
          [
            repayment.id,
            repayment.userId,
            repayment.loanId,
            loan.counterparty_name,
            loan.type,
            repayment.accountId,
            repayment.accountName,
            cleanAmount,
            repayment.date,
            repayment.notes || null,
          ]
        );

        await client.query(
          'UPDATE loans SET outstanding_principal = $1, status = $2, updated_at = NOW() WHERE id = $3',
          [newOutstanding, newStatus, repayment.loanId]
        );

        // Money Lent Repaid: money returned to us -> INFLOW. Money Borrowed Repaid: money paid back -> OUTFLOW.
        const delta = loan.type === 'LENT' ? cleanAmount : -cleanAmount;
        await client.query(
          'UPDATE accounts SET current_balance = current_balance + $1, updated_at = NOW() WHERE id = $2',
          [delta, repayment.accountId]
        );

        await client.query('COMMIT');
        return {
          ...repayment,
          amount: cleanAmount,
        };
      } catch (err) {
        await client.query('ROLLBACK');
        throw err;
      } finally {
        client.release();
      }
    } else {
      const loans = await this.getLoans(repayment.userId);
      const loan = loans.find((l) => l.id === repayment.loanId);
      if (!loan) return null;
      if (cleanAmount > loan.outstandingPrincipal) {
        throw new Error(`Repayment amount (${cleanAmount}) cannot exceed outstanding principal (${loan.outstandingPrincipal}).`);
      }
      const newOutstanding = Number(Math.max(0, loan.outstandingPrincipal - cleanAmount).toFixed(2));
      const newStatus = newOutstanding <= 0 ? 'SETTLED' : 'PARTIALLY_REPAID';
      this.inMemoryData.repayments.push(repayment);
      loan.outstandingPrincipal = newOutstanding;
      loan.status = newStatus;
      loan.updatedAt = new Date().toISOString();
      const delta = loan.type === 'LENT' ? cleanAmount : -cleanAmount;
      await this.updateAccountBalance(repayment.accountId, delta);
      this.persistLocalDb();
      return repayment;
    }
  }

  // --------------------------------------------------------------------------
  // BUDGETS OPERATIONS
  // --------------------------------------------------------------------------

  async getBudgets(userId) {
    if (this.isPostgresConnected && this.pool) {
      const res = await this.pool.query(
        'SELECT id, user_id as "userId", category_name as "categoryName", monthly_limit as "monthlyLimit" FROM budgets WHERE user_id = $1',
        [userId]
      );
      return res.rows.map((r) => ({ ...r, monthlyLimit: Number(r.monthlyLimit) }));
    }
    return this.inMemoryData.budgets.filter((b) => b.userId === userId);
  }

  async setBudget(userId, categoryName, monthlyLimit) {
    const id = `bgt_${userId}_${categoryName.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase()}`;
    const cleanLimit = Number(monthlyLimit);

    if (this.isPostgresConnected && this.pool) {
      await this.pool.query(
        `INSERT INTO budgets (id, user_id, category_name, monthly_limit)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (id) DO UPDATE SET monthly_limit = EXCLUDED.monthly_limit`,
        [id, userId, categoryName, cleanLimit]
      );
      return { id, userId, categoryName, monthlyLimit: cleanLimit };
    }

    const existing = this.inMemoryData.budgets.find(
      (b) => b.userId === userId && b.categoryName === categoryName
    );
    if (existing) {
      existing.monthlyLimit = cleanLimit;
      this.persistLocalDb();
      return existing;
    }
    const record = { id, userId, categoryName, monthlyLimit: cleanLimit };
    this.inMemoryData.budgets.push(record);
    this.persistLocalDb();
    return record;
  }

  async deleteBudget(userId, categoryName) {
    if (this.isPostgresConnected && this.pool) {
      await this.pool.query('DELETE FROM budgets WHERE user_id = $1 AND category_name = $2', [
        userId,
        categoryName,
      ]);
      return true;
    }
    const idx = this.inMemoryData.budgets.findIndex(
      (b) => b.userId === userId && b.categoryName === categoryName
    );
    if (idx !== -1) {
      this.inMemoryData.budgets.splice(idx, 1);
      this.persistLocalDb();
      return true;
    }
    return false;
  }

  // --------------------------------------------------------------------------
  // AUDIT LOGS & SYSTEM SETTINGS
  // --------------------------------------------------------------------------

  async addAuditLog(log) {
    const record = {
      id: `log_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
      ...log,
      createdAt: new Date().toISOString(),
    };

    if (this.isPostgresConnected && this.pool) {
      try {
        await this.pool.query(
          `INSERT INTO audit_logs (id, user_id, user_email, action, entity_type, entity_id, details, ip_address)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
          [
            record.id,
            record.userId || null,
            record.userEmail || null,
            record.action,
            record.entityType,
            record.entityId,
            record.details || null,
            record.ipAddress || null,
          ]
        );
      } catch (err) {
        logger.error('Error saving audit log to PostgreSQL:', err);
      }
      return record;
    }

    this.inMemoryData.auditLogs.unshift(record);
    if (this.inMemoryData.auditLogs.length > 500) {
      this.inMemoryData.auditLogs.pop();
    }
    this.persistLocalDb();
    return record;
  }

  async getAuditLogs(options = {}) {
    if (this.isPostgresConnected && this.pool) {
      const res = await this.pool.query(
        'SELECT id, user_id as "userId", user_email as "userEmail", action, entity_type as "entityType", entity_id as "entityId", details, ip_address as "ipAddress", created_at as "createdAt" FROM audit_logs ORDER BY created_at DESC LIMIT 500'
      );
      return res.rows;
    }
    return this.inMemoryData.auditLogs;
  }

  async getPaginatedAuditLogs(options) {
    const limit = options.limit || 50;
    const direction = options.direction || 'forward';
    let logs = await this.getAuditLogs();

    if (options.action && options.action !== 'ALL') {
      logs = logs.filter((l) => l.action === options.action);
    }
    if (options.search && options.search.trim()) {
      const term = options.search.trim().toLowerCase();
      logs = logs.filter(
        (l) =>
          l.action.toLowerCase().includes(term) ||
          l.entityType.toLowerCase().includes(term) ||
          (l.userEmail && l.userEmail.toLowerCase().includes(term)) ||
          (l.details && l.details.toLowerCase().includes(term))
      );
    }

    const totalCount = logs.length;
    let cursorIdx = -1;
    if (options.cursor) {
      const decoded = decodeCursor(options.cursor);
      if (decoded && decoded.id) {
        cursorIdx = logs.findIndex((l) => l.id === decoded.id);
      }
    }

    let items = [];
    let hasNextPage = false;
    let hasPreviousPage = false;

    if (direction === 'forward') {
      const startIndex = cursorIdx === -1 ? 0 : cursorIdx + 1;
      items = logs.slice(startIndex, startIndex + limit);
      hasNextPage = startIndex + limit < logs.length;
      hasPreviousPage = startIndex > 0;
    } else {
      const endIndex = cursorIdx === -1 ? logs.length : cursorIdx;
      const startIndex = Math.max(0, endIndex - limit);
      items = logs.slice(startIndex, endIndex);
      hasNextPage = endIndex < logs.length;
      hasPreviousPage = startIndex > 0;
    }

    const nextCursor =
      items.length > 0 && hasNextPage
        ? encodeCursor({ id: items[items.length - 1].id, timestamp: items[items.length - 1].createdAt })
        : null;
    const previousCursor =
      items.length > 0 && hasPreviousPage
        ? encodeCursor({ id: items[0].id, timestamp: items[0].createdAt })
        : null;

    return {
      items,
      nextCursor,
      previousCursor,
      hasNextPage,
      hasPreviousPage,
      totalCount,
    };
  }

  getSystemSettings() {
    return (
      this.inMemoryData.systemSettings || {
        appName: 'AccountLedger.com',
        maintenanceMode: false,
        allowUserRegistration: true,
        defaultCurrency: 'BDT',
        sessionTimeoutHours: 720,
        auditLoggingEnabled: true,
        updatedAt: new Date().toISOString(),
      }
    );
  }

  async updateSystemSettings(updates) {
    this.inMemoryData.systemSettings = {
      ...this.getSystemSettings(),
      ...updates,
      updatedAt: new Date().toISOString(),
    };
    this.persistLocalDb();
    return this.inMemoryData.systemSettings;
  }

  async getAdminStats() {
    const users = this.isPostgresConnected && this.pool
      ? (await this.pool.query('SELECT role, is_active FROM users')).rows
      : this.inMemoryData.users;

    const totalUsers = users.length;
    const activeUsers = users.filter((u) => u.is_active !== false && u.isActive !== false).length;
    const adminUsers = users.filter((u) => u.role === 'ADMIN').length;

    return {
      totalUsers,
      activeUsers,
      adminUsers,
      databaseMode: this.isPostgresConnected ? 'PostgreSQL (Neon)' : 'Local Persistent JSON',
      connectedToPostgres: this.isPostgresConnected,
    };
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

export const dbService = new DatabaseService();
