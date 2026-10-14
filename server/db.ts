import fs from 'fs';
import path from 'path';
import pg from 'pg';
import bcrypt from 'bcryptjs';

const { Pool } = pg;

export interface UserRecord {
  id: string;
  username: string;
  email: string;
  passwordHash: string;
  fullName: string;
  role: 'ADMIN' | 'USER';
  isActive: boolean;
  currency: string;
  timezone: string;
  dateFormat: string;
  createdAt: string;
  updatedAt: string;
}

export interface AccountRecord {
  id: string;
  userId: string;
  name: string;
  type: 'CASH' | 'BANK' | 'MOBILE_BANKING';
  providerName?: string;
  accountNumber?: string;
  openingBalance: number;
  currentBalance: number;
  currency: string;
  status: 'ACTIVE' | 'ARCHIVED';
  createdAt: string;
  updatedAt: string;
}

export interface CategoryRecord {
  id: string;
  userId: string;
  name: string;
  type: 'INCOME' | 'EXPENSE';
  icon: string;
  color: string;
  subcategories: string[];
  isArchived: boolean;
  isSystem: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface TransactionRecord {
  id: string;
  userId: string;
  accountId: string;
  accountName: string;
  type: 'INCOME' | 'EXPENSE' | 'TRANSFER' | 'LOAN_LENT' | 'LOAN_BORROWED' | 'LOAN_REPAYMENT';
  category?: string;
  subcategory?: string;
  amount: number;
  direction: 'INFLOW' | 'OUTFLOW' | 'NEUTRAL';
  date: string;
  description: string;
  reference?: string;
  counterparty?: string;
  status: 'COMPLETED' | 'PENDING';
  transferId?: string;
  loanId?: string;
  destinationAccountId?: string;
  destinationAccountName?: string;
  createdAt: string;
}

export interface TransferRecord {
  id: string;
  userId: string;
  sourceAccountId: string;
  sourceAccountName: string;
  destinationAccountId: string;
  destinationAccountName: string;
  amount: number;
  transferFee: number;
  date: string;
  description?: string;
  reference?: string;
  createdAt: string;
}

export interface LoanRecord {
  id: string;
  userId: string;
  accountId: string;
  accountName: string;
  type: 'LENT' | 'BORROWED';
  counterpartyName: string;
  counterpartyContact?: string;
  principalAmount: number;
  outstandingPrincipal: number;
  interestRate: number;
  startDate: string;
  dueDate?: string;
  status: 'ACTIVE' | 'PARTIALLY_REPAID' | 'SETTLED';
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface RepaymentRecord {
  id: string;
  userId: string;
  loanId: string;
  counterpartyName: string;
  loanType: 'LENT' | 'BORROWED';
  accountId: string;
  accountName: string;
  amount: number;
  date: string;
  notes?: string;
  createdAt: string;
}

export interface BudgetRecord {
  id: string;
  userId: string;
  categoryName: string;
  monthlyLimit: number;
}

export interface AuditLogRecord {
  id: string;
  userId: string;
  userEmail?: string;
  action: string;
  entityType: string;
  entityId: string;
  details?: string;
  ipAddress?: string;
  createdAt: string;
}

export interface SystemSettingsRecord {
  appName: string;
  maintenanceMode: boolean;
  allowUserRegistration: boolean;
  defaultCurrency: string;
  sessionTimeoutHours: number;
  auditLoggingEnabled: boolean;
  updatedAt: string;
}

export interface DatabaseSchema {
  users: UserRecord[];
  accounts: AccountRecord[];
  categories: CategoryRecord[];
  transactions: TransactionRecord[];
  transfers: TransferRecord[];
  loans: LoanRecord[];
  repayments: RepaymentRecord[];
  budgets: BudgetRecord[];
  auditLogs: AuditLogRecord[];
  systemSettings?: SystemSettingsRecord;
}

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
  private pool: pg.Pool | null = null;
  private isPostgresConnected: boolean = false;
  private localDbPath: string;
  private inMemoryData: DatabaseSchema = {
    users: [],
    accounts: [],
    categories: [],
    transactions: [],
    transfers: [],
    loans: [],
    repayments: [],
    budgets: [],
    auditLogs: [],
  };

  constructor() {
    const dataDir = path.resolve(process.cwd(), 'data');
    if (!fs.existsSync(dataDir)) {
      try {
        fs.mkdirSync(dataDir, { recursive: true });
      } catch (err) {
        // ignore
      }
    }
    this.localDbPath = path.resolve(dataDir, 'hisabflow_db.json');
    this.loadLocalDb();
  }

  private loadLocalDb() {
    if (fs.existsSync(this.localDbPath)) {
      try {
        const raw = fs.readFileSync(this.localDbPath, 'utf-8');
        const parsed = JSON.parse(raw);
        this.inMemoryData = {
          users: parsed.users || [],
          accounts: (parsed.accounts || []).filter((a: any) => a.userId !== 'user_admin_mahbub'),
          categories: (parsed.categories || []).filter((c: any) => c.userId !== 'user_admin_mahbub'),
          transactions: (parsed.transactions || []).filter((t: any) => t.userId !== 'user_admin_mahbub'),
          transfers: (parsed.transfers || []).filter((t: any) => t.userId !== 'user_admin_mahbub'),
          loans: (parsed.loans || []).filter((l: any) => l.userId !== 'user_admin_mahbub'),
          repayments: (parsed.repayments || []).filter((r: any) => r.userId !== 'user_admin_mahbub'),
          budgets: (parsed.budgets || []).filter((b: any) => b.userId !== 'user_admin_mahbub'),
          auditLogs: parsed.auditLogs || [],
          systemSettings: parsed.systemSettings || {
            appName: 'HisabFlow',
            maintenanceMode: false,
            allowUserRegistration: true,
            defaultCurrency: 'BDT',
            sessionTimeoutHours: 720,
            auditLoggingEnabled: true,
            updatedAt: new Date().toISOString(),
          },
        };
        // Persist cleaned up state
        this.persistLocalDb();
      } catch (err) {
        console.error('[HisabFlow DB] Error loading local DB file, initializing fresh:', err);
      }
    } else {
      this.inMemoryData.systemSettings = {
        appName: 'HisabFlow',
        maintenanceMode: false,
        allowUserRegistration: true,
        defaultCurrency: 'BDT',
        sessionTimeoutHours: 720,
        auditLoggingEnabled: true,
        updatedAt: new Date().toISOString(),
      };
    }
  }

  private persistLocalDb() {
    try {
      fs.writeFileSync(this.localDbPath, JSON.stringify(this.inMemoryData, null, 2), 'utf-8');
    } catch (err) {
      console.error('[HisabFlow DB] Error persisting local DB:', err);
    }
  }

  public async initialize() {
    const dbUrl = process.env.DATABASE_URL;
    if (dbUrl && !dbUrl.includes('YOUR_ROTATED_NEON_DATABASE_URL')) {
      try {
        console.log('[HisabFlow DB] Connecting to Neon PostgreSQL...');
        this.pool = new Pool({
          connectionString: dbUrl,
          ssl: {
            rejectUnauthorized: false,
          },
          max: 10,
          connectionTimeoutMillis: 10000,
        });

        // Test connection
        const client = await this.pool.connect();
        const res = await client.query('SELECT NOW()');
        client.release();
        this.isPostgresConnected = true;
        console.log('[HisabFlow DB] Connected to Neon PostgreSQL successfully at', res.rows[0].now);

        // Run PostgreSQL schema migration/tables creation
        await this.initPostgresSchema();
      } catch (err: any) {
        console.warn('[HisabFlow DB] Could not connect to Neon PostgreSQL:', err.message);
        console.warn('[HisabFlow DB] Running in Local Persistent Mode (data/hisabflow_db.json).');
        this.isPostgresConnected = false;
      }
    } else {
      console.log('[HisabFlow DB] No DATABASE_URL provided. Operating in Local Persistent Mode.');
      this.isPostgresConnected = false;
    }

    // Always seed initial admin & users if empty
    await this.seedInitialSystemState();
  }

  private async initPostgresSchema() {
    if (!this.pool) return;
    const client = await this.pool.connect();
    try {
      await client.query(`
        CREATE TABLE IF NOT EXISTS users (
          id VARCHAR(64) PRIMARY KEY,
          username VARCHAR(64) UNIQUE NOT NULL,
          email VARCHAR(128) UNIQUE NOT NULL,
          password_hash VARCHAR(255) NOT NULL,
          full_name VARCHAR(128) NOT NULL,
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
          opening_balance NUMERIC(14, 2) DEFAULT 0.00,
          current_balance NUMERIC(14, 2) DEFAULT 0.00,
          currency VARCHAR(10) DEFAULT 'BDT',
          status VARCHAR(20) DEFAULT 'ACTIVE',
          created_at TIMESTAMPTZ DEFAULT NOW(),
          updated_at TIMESTAMPTZ DEFAULT NOW()
        );

        CREATE TABLE IF NOT EXISTS categories (
          id VARCHAR(64) PRIMARY KEY,
          user_id VARCHAR(64) REFERENCES users(id) ON DELETE CASCADE,
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
          account_id VARCHAR(64) REFERENCES accounts(id) ON DELETE CASCADE,
          account_name VARCHAR(128),
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
          source_account_id VARCHAR(64) REFERENCES accounts(id) ON DELETE CASCADE,
          source_account_name VARCHAR(128),
          destination_account_id VARCHAR(64) REFERENCES accounts(id) ON DELETE CASCADE,
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
          account_id VARCHAR(64) REFERENCES accounts(id) ON DELETE CASCADE,
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
          loan_id VARCHAR(64) REFERENCES loans(id) ON DELETE CASCADE,
          counterparty_name VARCHAR(128) NOT NULL,
          loan_type VARCHAR(20) NOT NULL,
          account_id VARCHAR(64) REFERENCES accounts(id) ON DELETE CASCADE,
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
          user_id VARCHAR(64) NOT NULL,
          user_email VARCHAR(128),
          action VARCHAR(64) NOT NULL,
          entity_type VARCHAR(64) NOT NULL,
          entity_id VARCHAR(64) NOT NULL,
          details TEXT,
          ip_address VARCHAR(64),
          created_at TIMESTAMPTZ DEFAULT NOW()
        );
      `);
      console.log('[HisabFlow DB] Neon PostgreSQL schema verified & ready.');
    } finally {
      client.release();
    }
  }

  public async seedInitialSystemState() {
    const adminPassword = process.env.ADMIN_INITIAL_PASSWORD || '123456';
    const hashedAdminPassword = await bcrypt.hash(adminPassword, 10);
    const standardUserPassword = '123456';
    const hashedStandardPassword = await bcrypt.hash(standardUserPassword, 10);

    // 1. Ensure SYSTEM_ADMIN: admin@example.com
    let adminUser = await this.getUserByEmail('admin@example.com');
    if (!adminUser) {
      // Check if username 'admin' exists
      const adminByUsername = await this.getUserByUsernameOrEmail('admin');
      if (adminByUsername && adminByUsername.role === 'ADMIN') {
        await this.updateUser(adminByUsername.id, {
          email: 'admin@example.com',
          passwordHash: hashedAdminPassword,
          role: 'ADMIN',
          isActive: true,
        });
        adminUser = await this.getUserById(adminByUsername.id);
      } else {
        const newAdmin: UserRecord = {
          id: 'user_admin_example',
          username: 'admin',
          email: 'admin@example.com',
          passwordHash: hashedAdminPassword,
          fullName: 'System Administrator',
          role: 'ADMIN',
          isActive: true,
          currency: 'BDT',
          timezone: 'Asia/Dhaka',
          dateFormat: 'DD MMM YYYY',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        await this.insertUser(newAdmin);
        adminUser = newAdmin;
        console.log('[HisabFlow DB] Created admin user: admin@example.com.');
      }
    } else {
      await this.updateUser(adminUser.id, {
        passwordHash: hashedAdminPassword,
        role: 'ADMIN',
        isActive: true,
      });
    }

    // 2. Ensure REGULAR USER: user@example.com / password: 123456
    let standardUser = await this.getUserByEmail('user@example.com');
    if (!standardUser) {
      const userByUsername = await this.getUserByUsernameOrEmail('user');
      if (userByUsername && userByUsername.role === 'USER') {
        await this.updateUser(userByUsername.id, {
          email: 'user@example.com',
          passwordHash: hashedStandardPassword,
          role: 'USER',
          isActive: true,
        });
        standardUser = await this.getUserById(userByUsername.id);
      } else {
        const newUser: UserRecord = {
          id: 'user_regular_example',
          username: 'user',
          email: 'user@example.com',
          passwordHash: hashedStandardPassword,
          fullName: 'Standard User',
          role: 'USER',
          isActive: true,
          currency: 'BDT',
          timezone: 'Asia/Dhaka',
          dateFormat: 'DD MMM YYYY',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        await this.insertUser(newUser);
        standardUser = newUser;
        console.log('[HisabFlow DB] Created regular user: user@example.com (password: 123456).');
      }
    } else {
      await this.updateUser(standardUser.id, {
        passwordHash: hashedStandardPassword,
        role: 'USER',
        isActive: true,
      });
    }

    // Seed default categories & default starter accounts for user@example.com
    if (standardUser) {
      await this.seedDefaultCategories(standardUser.id);
      await this.seedDefaultAccounts(standardUser.id);
    }

    // 3. Ensure mahbub@gmail.com / mahbub (Admin)
    let mahbubUser = await this.getUserByEmail('mahbub@gmail.com');
    if (!mahbubUser) {
      mahbubUser = await this.getUserByUsernameOrEmail('mahbub');
    }
    if (mahbubUser) {
      await this.updateUser(mahbubUser.id, {
        passwordHash: hashedAdminPassword,
        role: 'ADMIN',
        isActive: true,
      });
    } else {
      const newMahbub: UserRecord = {
        id: 'user_admin_mahbub',
        username: 'mahbub',
        email: 'mahbub@gmail.com',
        passwordHash: hashedAdminPassword,
        fullName: 'Mahbub Alam',
        role: 'ADMIN',
        isActive: true,
        currency: 'BDT',
        timezone: 'Asia/Dhaka',
        dateFormat: 'DD MMM YYYY',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      await this.insertUser(newMahbub);
      mahbubUser = newMahbub;
      console.log('[HisabFlow DB] Created admin user: mahbub@gmail.com.');
    }

    // Strict Admin Separation: Ensure administrator accounts NEVER have personal financial records
    const adminIds = ['user_admin_example', 'user_admin_mahbub', ...(adminUser ? [adminUser.id] : [])];
    for (const adminId of adminIds) {
      this.inMemoryData.categories = this.inMemoryData.categories.filter(c => c.userId !== adminId);
      this.inMemoryData.accounts = this.inMemoryData.accounts.filter(a => a.userId !== adminId);
      this.inMemoryData.transactions = this.inMemoryData.transactions.filter(t => t.userId !== adminId);
      this.inMemoryData.transfers = this.inMemoryData.transfers.filter(t => t.userId !== adminId);
      this.inMemoryData.loans = this.inMemoryData.loans.filter(l => l.userId !== adminId);
      this.inMemoryData.repayments = this.inMemoryData.repayments.filter(r => r.userId !== adminId);
      this.inMemoryData.budgets = this.inMemoryData.budgets.filter(b => b.userId !== adminId);
    }
    this.persistLocalDb();
  }

  public async seedDefaultAccounts(userId: string) {
    const existing = await this.getAccounts(userId);
    if (existing.length > 0) return;

    await this.createAccount({
      id: `acc_cash_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      userId,
      name: 'Cash Wallet',
      type: 'CASH',
      openingBalance: 15000,
      currentBalance: 15000,
      currency: 'BDT',
      status: 'ACTIVE',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    await this.createAccount({
      id: `acc_bank_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      userId,
      name: 'City Bank Account',
      type: 'BANK',
      providerName: 'City Bank Ltd',
      accountNumber: '1102938475',
      openingBalance: 85000,
      currentBalance: 85000,
      currency: 'BDT',
      status: 'ACTIVE',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    await this.createAccount({
      id: `acc_mfs_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
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
    });
  }

  public async seedDefaultCategories(userId: string) {
    const existing = await this.getCategories(userId);
    if (existing.length > 0) return;

    for (const cat of DEFAULT_INCOME_CATEGORIES) {
      await this.createCategory({
        id: `cat_inc_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
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
        id: `cat_exp_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
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

  // STATUS & HEALTH
  public getStatus() {
    return {
      connectedToNeon: this.isPostgresConnected,
      mode: this.isPostgresConnected ? 'Neon PostgreSQL' : 'Local Persistent Storage',
      storageFile: this.isPostgresConnected ? 'Neon Cloud' : 'data/hisabflow_db.json',
      userCount: this.inMemoryData.users.length,
      accountCount: this.inMemoryData.accounts.length,
      transactionCount: this.inMemoryData.transactions.length,
    };
  }

  // USER CRUD
  public async getUserById(id: string): Promise<UserRecord | null> {
    if (this.isPostgresConnected && this.pool) {
      const res = await this.pool.query(
        'SELECT id, username, email, password_hash as "passwordHash", full_name as "fullName", role, is_active as "isActive", currency, timezone, date_format as "dateFormat", created_at as "createdAt", updated_at as "updatedAt" FROM users WHERE id = $1',
        [id]
      );
      return res.rows[0] || null;
    }
    return this.inMemoryData.users.find(u => u.id === id) || null;
  }

  public async getUserByEmail(email: string): Promise<UserRecord | null> {
    if (this.isPostgresConnected && this.pool) {
      const res = await this.pool.query(
        'SELECT id, username, email, password_hash as "passwordHash", full_name as "fullName", role, is_active as "isActive", currency, timezone, date_format as "dateFormat", created_at as "createdAt", updated_at as "updatedAt" FROM users WHERE LOWER(email) = LOWER($1)',
        [email]
      );
      return res.rows[0] || null;
    }
    return this.inMemoryData.users.find(u => u.email.toLowerCase() === email.toLowerCase()) || null;
  }

  public async getUserByUsernameOrEmail(identifier: string): Promise<UserRecord | null> {
    const clean = identifier.trim().toLowerCase();
    if (this.isPostgresConnected && this.pool) {
      const res = await this.pool.query(
        'SELECT id, username, email, password_hash as "passwordHash", full_name as "fullName", role, is_active as "isActive", currency, timezone, date_format as "dateFormat", created_at as "createdAt", updated_at as "updatedAt" FROM users WHERE LOWER(email) = $1 OR LOWER(username) = $1',
        [clean]
      );
      return res.rows[0] || null;
    }
    return this.inMemoryData.users.find(u => u.email.toLowerCase() === clean || u.username.toLowerCase() === clean) || null;
  }

  public async insertUser(user: UserRecord): Promise<UserRecord> {
    if (this.isPostgresConnected && this.pool) {
      await this.pool.query(
        `INSERT INTO users (id, username, email, password_hash, full_name, role, is_active, currency, timezone, date_format, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
        [
          user.id,
          user.username,
          user.email,
          user.passwordHash,
          user.fullName,
          user.role,
          user.isActive,
          user.currency,
          user.timezone,
          user.dateFormat,
          user.createdAt,
          user.updatedAt,
        ]
      );
    }
    // Update local cache
    this.inMemoryData.users = this.inMemoryData.users.filter(u => u.id !== user.id);
    this.inMemoryData.users.push(user);
    this.persistLocalDb();
    return user;
  }

  public async getAllUsers(): Promise<Omit<UserRecord, 'passwordHash'>[]> {
    if (this.isPostgresConnected && this.pool) {
      const res = await this.pool.query(
        'SELECT id, username, email, full_name as "fullName", role, is_active as "isActive", currency, timezone, date_format as "dateFormat", created_at as "createdAt", updated_at as "updatedAt" FROM users ORDER BY created_at ASC'
      );
      return res.rows;
    }
    return this.inMemoryData.users.map(({ passwordHash, ...rest }) => rest);
  }

  public async updateUser(id: string, updates: Partial<UserRecord>): Promise<UserRecord | null> {
    const existing = await this.getUserById(id);
    if (!existing) return null;

    const updated: UserRecord = {
      ...existing,
      ...updates,
      updatedAt: new Date().toISOString(),
    };

    if (this.isPostgresConnected && this.pool) {
      await this.pool.query(
        `UPDATE users SET
          username = $1,
          email = $2,
          password_hash = $3,
          full_name = $4,
          role = $5,
          is_active = $6,
          currency = $7,
          updated_at = $8
         WHERE id = $9`,
        [
          updated.username,
          updated.email,
          updated.passwordHash,
          updated.fullName,
          updated.role,
          updated.isActive,
          updated.currency,
          updated.updatedAt,
          id,
        ]
      );
    }

    const idx = this.inMemoryData.users.findIndex(u => u.id === id);
    if (idx !== -1) {
      this.inMemoryData.users[idx] = updated;
      this.persistLocalDb();
    }
    return updated;
  }

  public async deleteUser(id: string): Promise<boolean> {
    if (this.isPostgresConnected && this.pool) {
      await this.pool.query('DELETE FROM users WHERE id = $1', [id]);
    }
    this.inMemoryData.users = this.inMemoryData.users.filter(u => u.id !== id);
    this.inMemoryData.accounts = this.inMemoryData.accounts.filter(a => a.userId !== id);
    this.inMemoryData.categories = this.inMemoryData.categories.filter(c => c.userId !== id);
    this.inMemoryData.transactions = this.inMemoryData.transactions.filter(t => t.userId !== id);
    this.inMemoryData.transfers = this.inMemoryData.transfers.filter(t => t.userId !== id);
    this.inMemoryData.loans = this.inMemoryData.loans.filter(l => l.userId !== id);
    this.inMemoryData.repayments = this.inMemoryData.repayments.filter(r => r.userId !== id);
    this.inMemoryData.budgets = this.inMemoryData.budgets.filter(b => b.userId !== id);
    this.persistLocalDb();
    return true;
  }

  // ACCOUNTS CRUD
  public async getAccounts(userId: string): Promise<AccountRecord[]> {
    if (this.isPostgresConnected && this.pool) {
      const res = await this.pool.query(
        'SELECT id, user_id as "userId", name, type, provider_name as "providerName", account_number as "accountNumber", opening_balance::float as "openingBalance", current_balance::float as "currentBalance", currency, status, created_at as "createdAt", updated_at as "updatedAt" FROM accounts WHERE user_id = $1 ORDER BY created_at DESC',
        [userId]
      );
      return res.rows;
    }
    return this.inMemoryData.accounts.filter(a => a.userId === userId);
  }

  public async createAccount(account: AccountRecord): Promise<AccountRecord> {
    if (this.isPostgresConnected && this.pool) {
      await this.pool.query(
        `INSERT INTO accounts (id, user_id, name, type, provider_name, account_number, opening_balance, current_balance, currency, status, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
        [
          account.id,
          account.userId,
          account.name,
          account.type,
          account.providerName || null,
          account.accountNumber || null,
          account.openingBalance,
          account.currentBalance,
          account.currency,
          account.status,
          account.createdAt,
          account.updatedAt,
        ]
      );
    }
    this.inMemoryData.accounts.unshift(account);
    this.persistLocalDb();
    return account;
  }

  public async updateAccount(id: string, userId: string, updates: Partial<AccountRecord>): Promise<AccountRecord | null> {
    const existing = (await this.getAccounts(userId)).find(a => a.id === id);
    if (!existing) return null;

    const updated: AccountRecord = {
      ...existing,
      ...updates,
      updatedAt: new Date().toISOString(),
    };

    if (this.isPostgresConnected && this.pool) {
      await this.pool.query(
        `UPDATE accounts SET
          name = $1,
          type = $2,
          provider_name = $3,
          account_number = $4,
          opening_balance = $5,
          current_balance = $6,
          status = $7,
          updated_at = $8
         WHERE id = $9 AND user_id = $10`,
        [
          updated.name,
          updated.type,
          updated.providerName || null,
          updated.accountNumber || null,
          updated.openingBalance,
          updated.currentBalance,
          updated.status,
          updated.updatedAt,
          id,
          userId,
        ]
      );
    }

    const idx = this.inMemoryData.accounts.findIndex(a => a.id === id && a.userId === userId);
    if (idx !== -1) {
      this.inMemoryData.accounts[idx] = updated;
      this.persistLocalDb();
    }
    return updated;
  }

  public async deleteAccount(id: string, userId: string): Promise<{ success: boolean; error?: string }> {
    // Check if account has transactions
    const hasTx = this.inMemoryData.transactions.some(t => (t.accountId === id || t.destinationAccountId === id) && t.userId === userId);
    if (hasTx) {
      return { success: false, error: 'Cannot delete account with existing transactions. Please archive it instead or remove transactions first.' };
    }

    if (this.isPostgresConnected && this.pool) {
      await this.pool.query('DELETE FROM accounts WHERE id = $1 AND user_id = $2', [id, userId]);
    }
    this.inMemoryData.accounts = this.inMemoryData.accounts.filter(a => !(a.id === id && a.userId === userId));
    this.persistLocalDb();
    return { success: true };
  }

  public async updateAccountBalance(accountId: string, delta: number) {
    if (this.isPostgresConnected && this.pool) {
      await this.pool.query(
        'UPDATE accounts SET current_balance = current_balance + $1, updated_at = NOW() WHERE id = $2',
        [delta, accountId]
      );
    }
    const acc = this.inMemoryData.accounts.find(a => a.id === accountId);
    if (acc) {
      acc.currentBalance += delta;
      acc.updatedAt = new Date().toISOString();
      this.persistLocalDb();
    }
  }

  // CATEGORIES CRUD
  public async getCategories(userId: string): Promise<CategoryRecord[]> {
    if (this.isPostgresConnected && this.pool) {
      const res = await this.pool.query(
        'SELECT id, user_id as "userId", name, type, icon, color, subcategories, is_archived as "isArchived", is_system as "isSystem", created_at as "createdAt", updated_at as "updatedAt" FROM categories WHERE user_id = $1 ORDER BY name ASC',
        [userId]
      );
      return res.rows;
    }
    return this.inMemoryData.categories.filter(c => c.userId === userId);
  }

  public async createCategory(category: CategoryRecord): Promise<CategoryRecord> {
    if (this.isPostgresConnected && this.pool) {
      await this.pool.query(
        `INSERT INTO categories (id, user_id, name, type, icon, color, subcategories, is_archived, is_system, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
        [
          category.id,
          category.userId,
          category.name,
          category.type,
          category.icon,
          category.color,
          JSON.stringify(category.subcategories),
          category.isArchived,
          category.isSystem,
          category.createdAt,
          category.updatedAt,
        ]
      );
    }
    this.inMemoryData.categories.push(category);
    this.persistLocalDb();
    return category;
  }

  public async updateCategory(id: string, userId: string, updates: Partial<CategoryRecord>): Promise<CategoryRecord | null> {
    const existing = this.inMemoryData.categories.find(c => c.id === id && c.userId === userId);
    if (!existing) return null;

    const updated: CategoryRecord = {
      ...existing,
      ...updates,
      updatedAt: new Date().toISOString(),
    };

    if (this.isPostgresConnected && this.pool) {
      await this.pool.query(
        `UPDATE categories SET
          name = $1,
          icon = $2,
          color = $3,
          subcategories = $4,
          is_archived = $5,
          updated_at = $6
         WHERE id = $7 AND user_id = $8`,
        [
          updated.name,
          updated.icon,
          updated.color,
          JSON.stringify(updated.subcategories),
          updated.isArchived,
          updated.updatedAt,
          id,
          userId,
        ]
      );
    }

    const idx = this.inMemoryData.categories.findIndex(c => c.id === id && c.userId === userId);
    if (idx !== -1) {
      this.inMemoryData.categories[idx] = updated;
      this.persistLocalDb();
    }
    return updated;
  }

  public async deleteCategory(id: string, userId: string): Promise<{ success: boolean; error?: string }> {
    if (this.isPostgresConnected && this.pool) {
      await this.pool.query('DELETE FROM categories WHERE id = $1 AND user_id = $2', [id, userId]);
    }
    this.inMemoryData.categories = this.inMemoryData.categories.filter(c => !(c.id === id && c.userId === userId));
    this.persistLocalDb();
    return { success: true };
  }

  // TRANSACTIONS CRUD
  public async getTransactions(userId: string): Promise<TransactionRecord[]> {
    if (this.isPostgresConnected && this.pool) {
      const res = await this.pool.query(
        'SELECT id, user_id as "userId", account_id as "accountId", account_name as "accountName", type, category, subcategory, amount::float, direction, to_char(date, \'YYYY-MM-DD\') as date, description, reference, counterparty, status, transfer_id as "transferId", loan_id as "loanId", destination_account_id as "destinationAccountId", destination_account_name as "destinationAccountName", created_at as "createdAt" FROM transactions WHERE user_id = $1 ORDER BY date DESC, created_at DESC',
        [userId]
      );
      return res.rows;
    }
    return this.inMemoryData.transactions
      .filter(t => t.userId === userId)
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }

  public async createTransaction(tx: TransactionRecord): Promise<TransactionRecord> {
    if (this.isPostgresConnected && this.pool) {
      await this.pool.query(
        `INSERT INTO transactions (id, user_id, account_id, account_name, type, category, subcategory, amount, direction, date, description, reference, counterparty, status, transfer_id, loan_id, destination_account_id, destination_account_name, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19)`,
        [
          tx.id,
          tx.userId,
          tx.accountId,
          tx.accountName,
          tx.type,
          tx.category || null,
          tx.subcategory || null,
          tx.amount,
          tx.direction,
          tx.date,
          tx.description,
          tx.reference || null,
          tx.counterparty || null,
          tx.status,
          tx.transferId || null,
          tx.loanId || null,
          tx.destinationAccountId || null,
          tx.destinationAccountName || null,
          tx.createdAt,
        ]
      );
    }
    this.inMemoryData.transactions.unshift(tx);

    // Adjust account balance
    const balanceDelta = tx.direction === 'INFLOW' ? tx.amount : tx.direction === 'OUTFLOW' ? -tx.amount : 0;
    if (balanceDelta !== 0) {
      await this.updateAccountBalance(tx.accountId, balanceDelta);
    }

    this.persistLocalDb();
    return tx;
  }

  public async updateTransaction(id: string, userId: string, updates: Partial<TransactionRecord>): Promise<TransactionRecord | null> {
    let existing = this.inMemoryData.transactions.find(t => t.id === id && t.userId === userId);
    if (!existing && this.isPostgresConnected && this.pool) {
      const res = await this.pool.query('SELECT * FROM transactions WHERE id = $1 AND user_id = $2', [id, userId]);
      if (res.rows.length > 0) {
        existing = res.rows[0];
      }
    }
    if (!existing) return null;

    const newAmount = updates.amount !== undefined ? updates.amount : existing.amount;
    const newAccountId = updates.accountId || existing.accountId;
    let newAccountName = existing.accountName;

    if (newAccountId !== existing.accountId) {
      const accounts = await this.getAccounts(userId);
      const acc = accounts.find(a => a.id === newAccountId);
      if (acc) {
        newAccountName = acc.name;
      }
    }

    // Handle financial integrity / balance adjustment
    if (newAccountId === existing.accountId) {
      if (newAmount !== existing.amount) {
        const oldDelta = existing.direction === 'INFLOW' ? existing.amount : -existing.amount;
        const newDelta = existing.direction === 'INFLOW' ? newAmount : -newAmount;
        await this.updateAccountBalance(existing.accountId, newDelta - oldDelta);
      }
    } else {
      // Account changed: reverse old account effect and apply new effect on new account
      const reverseOld = existing.direction === 'INFLOW' ? -existing.amount : existing.amount;
      await this.updateAccountBalance(existing.accountId, reverseOld);

      const applyNew = existing.direction === 'INFLOW' ? newAmount : -newAmount;
      await this.updateAccountBalance(newAccountId, applyNew);
    }

    const updated: TransactionRecord = {
      ...existing,
      ...updates,
      accountId: newAccountId,
      accountName: newAccountName,
      amount: newAmount,
    };

    if (this.isPostgresConnected && this.pool) {
      await this.pool.query(
        `UPDATE transactions SET
          account_id = $1,
          account_name = $2,
          description = $3,
          amount = $4,
          date = $5,
          category = $6,
          subcategory = $7,
          reference = $8
         WHERE id = $9 AND user_id = $10`,
        [
          updated.accountId,
          updated.accountName,
          updated.description,
          updated.amount,
          updated.date,
          updated.category || null,
          updated.subcategory || null,
          updated.reference || null,
          id,
          userId,
        ]
      );
    }

    const idx = this.inMemoryData.transactions.findIndex(t => t.id === id && t.userId === userId);
    if (idx !== -1) {
      this.inMemoryData.transactions[idx] = updated;
    } else {
      this.inMemoryData.transactions.unshift(updated);
    }
    this.persistLocalDb();
    return updated;
  }

  public async deleteTransaction(id: string, userId: string): Promise<boolean> {
    const existing = this.inMemoryData.transactions.find(t => t.id === id && t.userId === userId);
    if (!existing) return false;

    // Reverse balance effect
    const reverseDelta = existing.direction === 'INFLOW' ? -existing.amount : existing.direction === 'OUTFLOW' ? existing.amount : 0;
    if (reverseDelta !== 0) {
      await this.updateAccountBalance(existing.accountId, reverseDelta);
    }

    if (this.isPostgresConnected && this.pool) {
      await this.pool.query('DELETE FROM transactions WHERE id = $1 AND user_id = $2', [id, userId]);
    }

    this.inMemoryData.transactions = this.inMemoryData.transactions.filter(t => !(t.id === id && t.userId === userId));
    this.persistLocalDb();
    return true;
  }

  // TRANSFERS
  public async getTransfers(userId: string): Promise<TransferRecord[]> {
    if (this.isPostgresConnected && this.pool) {
      const res = await this.pool.query(
        'SELECT id, user_id as "userId", source_account_id as "sourceAccountId", source_account_name as "sourceAccountName", destination_account_id as "destinationAccountId", destination_account_name as "destinationAccountName", amount::float, transfer_fee::float as "transferFee", to_char(date, \'YYYY-MM-DD\') as date, description, reference, created_at as "createdAt" FROM transfers WHERE user_id = $1 ORDER BY date DESC',
        [userId]
      );
      return res.rows;
    }
    return this.inMemoryData.transfers.filter(t => t.userId === userId);
  }

  public async createTransfer(transfer: TransferRecord): Promise<TransferRecord> {
    if (this.isPostgresConnected && this.pool) {
      await this.pool.query(
        `INSERT INTO transfers (id, user_id, source_account_id, source_account_name, destination_account_id, destination_account_name, amount, transfer_fee, date, description, reference, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
        [
          transfer.id,
          transfer.userId,
          transfer.sourceAccountId,
          transfer.sourceAccountName,
          transfer.destinationAccountId,
          transfer.destinationAccountName,
          transfer.amount,
          transfer.transferFee,
          transfer.date,
          transfer.description || null,
          transfer.reference || null,
          transfer.createdAt,
        ]
      );
    }

    this.inMemoryData.transfers.unshift(transfer);

    // Update both account balances
    await this.updateAccountBalance(transfer.sourceAccountId, -(transfer.amount + transfer.transferFee));
    await this.updateAccountBalance(transfer.destinationAccountId, transfer.amount);

    // Also record standard ledger transaction for audit
    const txOut: TransactionRecord = {
      id: `tx_trf_${transfer.id}`,
      userId: transfer.userId,
      accountId: transfer.sourceAccountId,
      accountName: transfer.sourceAccountName,
      destinationAccountId: transfer.destinationAccountId,
      destinationAccountName: transfer.destinationAccountName,
      type: 'TRANSFER',
      category: 'Internal Transfer',
      amount: transfer.amount,
      direction: 'NEUTRAL',
      date: transfer.date,
      description: transfer.description || `Transfer to ${transfer.destinationAccountName}`,
      reference: transfer.reference,
      status: 'COMPLETED',
      transferId: transfer.id,
      createdAt: transfer.createdAt,
    };
    this.inMemoryData.transactions.unshift(txOut);

    this.persistLocalDb();
    return transfer;
  }

  public async deleteTransfer(transferId: string, userId: string): Promise<boolean> {
    const existing = this.inMemoryData.transfers.find(t => t.id === transferId && t.userId === userId);
    if (!existing) return false;

    // Reverse balances
    await this.updateAccountBalance(existing.sourceAccountId, existing.amount + existing.transferFee);
    await this.updateAccountBalance(existing.destinationAccountId, -existing.amount);

    if (this.isPostgresConnected && this.pool) {
      await this.pool.query('DELETE FROM transfers WHERE id = $1 AND user_id = $2', [transferId, userId]);
      await this.pool.query('DELETE FROM transactions WHERE transfer_id = $1 AND user_id = $2', [transferId, userId]);
    }

    this.inMemoryData.transfers = this.inMemoryData.transfers.filter(t => !(t.id === transferId && t.userId === userId));
    this.inMemoryData.transactions = this.inMemoryData.transactions.filter(t => !(t.transferId === transferId && t.userId === userId));
    this.persistLocalDb();
    return true;
  }

  // LOANS & REPAYMENTS
  public async getLoans(userId: string): Promise<LoanRecord[]> {
    if (this.isPostgresConnected && this.pool) {
      const res = await this.pool.query(
        'SELECT id, user_id as "userId", account_id as "accountId", account_name as "accountName", type, counterparty_name as "counterpartyName", counterparty_contact as "counterpartyContact", principal_amount::float as "principalAmount", outstanding_principal::float as "outstandingPrincipal", interest_rate::float as "interestRate", to_char(start_date, \'YYYY-MM-DD\') as "startDate", to_char(due_date, \'YYYY-MM-DD\') as "dueDate", status, notes, created_at as "createdAt", updated_at as "updatedAt" FROM loans WHERE user_id = $1 ORDER BY start_date DESC',
        [userId]
      );
      return res.rows;
    }
    return this.inMemoryData.loans.filter(l => l.userId === userId);
  }

  public async createLoan(loan: LoanRecord): Promise<LoanRecord> {
    if (this.isPostgresConnected && this.pool) {
      await this.pool.query(
        `INSERT INTO loans (id, user_id, account_id, account_name, type, counterparty_name, counterparty_contact, principal_amount, outstanding_principal, interest_rate, start_date, due_date, status, notes, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)`,
        [
          loan.id,
          loan.userId,
          loan.accountId,
          loan.accountName,
          loan.type,
          loan.counterpartyName,
          loan.counterpartyContact || null,
          loan.principalAmount,
          loan.outstandingPrincipal,
          loan.interestRate,
          loan.startDate,
          loan.dueDate || null,
          loan.status,
          loan.notes || null,
          loan.createdAt,
          loan.updatedAt,
        ]
      );
    }
    this.inMemoryData.loans.unshift(loan);

    // Adjust account balance
    const delta = loan.type === 'LENT' ? -loan.principalAmount : loan.principalAmount;
    await this.updateAccountBalance(loan.accountId, delta);

    // Ledger transaction
    const tx: TransactionRecord = {
      id: `tx_loan_${loan.id}`,
      userId: loan.userId,
      accountId: loan.accountId,
      accountName: loan.accountName,
      type: loan.type === 'LENT' ? 'LOAN_LENT' : 'LOAN_BORROWED',
      category: loan.type === 'LENT' ? 'Loan Given (Receivable)' : 'Loan Taken (Liability)',
      amount: loan.principalAmount,
      direction: loan.type === 'LENT' ? 'OUTFLOW' : 'INFLOW',
      date: loan.startDate,
      description: loan.type === 'LENT' ? `Loan disbursed to ${loan.counterpartyName}` : `Loan received from ${loan.counterpartyName}`,
      counterparty: loan.counterpartyName,
      status: 'COMPLETED',
      loanId: loan.id,
      createdAt: loan.createdAt,
    };
    this.inMemoryData.transactions.unshift(tx);

    this.persistLocalDb();
    return loan;
  }

  public async deleteLoan(loanId: string, userId: string): Promise<boolean> {
    const loan = this.inMemoryData.loans.find(l => l.id === loanId && l.userId === userId);
    if (!loan) return false;

    // Reverse initial loan disbursement balance
    const reverseDelta = loan.type === 'LENT' ? loan.principalAmount : -loan.principalAmount;
    await this.updateAccountBalance(loan.accountId, reverseDelta);

    if (this.isPostgresConnected && this.pool) {
      await this.pool.query('DELETE FROM loans WHERE id = $1 AND user_id = $2', [loanId, userId]);
      await this.pool.query('DELETE FROM repayments WHERE loan_id = $1 AND user_id = $2', [loanId, userId]);
      await this.pool.query('DELETE FROM transactions WHERE loan_id = $1 AND user_id = $2', [loanId, userId]);
    }

    this.inMemoryData.loans = this.inMemoryData.loans.filter(l => !(l.id === loanId && l.userId === userId));
    this.inMemoryData.repayments = this.inMemoryData.repayments.filter(r => !(r.loanId === loanId && r.userId === userId));
    this.inMemoryData.transactions = this.inMemoryData.transactions.filter(t => !(t.loanId === loanId && t.userId === userId));
    this.persistLocalDb();
    return true;
  }

  public async getRepayments(userId: string): Promise<RepaymentRecord[]> {
    if (this.isPostgresConnected && this.pool) {
      const res = await this.pool.query(
        'SELECT id, user_id as "userId", loan_id as "loanId", counterparty_name as "counterpartyName", loan_type as "loanType", account_id as "accountId", account_name as "accountName", amount::float, to_char(date, \'YYYY-MM-DD\') as date, notes, created_at as "createdAt" FROM repayments WHERE user_id = $1 ORDER BY date DESC',
        [userId]
      );
      return res.rows;
    }
    return this.inMemoryData.repayments.filter(r => r.userId === userId);
  }

  public async addRepayment(repayment: RepaymentRecord): Promise<RepaymentRecord | null> {
    const loan = this.inMemoryData.loans.find(l => l.id === repayment.loanId && l.userId === repayment.userId);
    if (!loan) return null;

    if (this.isPostgresConnected && this.pool) {
      await this.pool.query(
        `INSERT INTO repayments (id, user_id, loan_id, counterparty_name, loan_type, account_id, account_name, amount, date, notes, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
        [
          repayment.id,
          repayment.userId,
          repayment.loanId,
          repayment.counterpartyName,
          repayment.loanType,
          repayment.accountId,
          repayment.accountName,
          repayment.amount,
          repayment.date,
          repayment.notes || null,
          repayment.createdAt,
        ]
      );
    }
    this.inMemoryData.repayments.unshift(repayment);

    // Update loan outstanding
    const newOutstanding = Math.max(0, loan.outstandingPrincipal - repayment.amount);
    loan.outstandingPrincipal = newOutstanding;
    loan.status = newOutstanding <= 0 ? 'SETTLED' : 'PARTIALLY_REPAID';
    loan.updatedAt = new Date().toISOString();

    // Adjust account balance:
    // If loan was LENT (receivable), repayment received means INFLOW to account.
    // If loan was BORROWED (payable), repayment made means OUTFLOW from account.
    const delta = repayment.loanType === 'LENT' ? repayment.amount : -repayment.amount;
    await this.updateAccountBalance(repayment.accountId, delta);

    // Add ledger transaction
    const tx: TransactionRecord = {
      id: `tx_rep_${repayment.id}`,
      userId: repayment.userId,
      accountId: repayment.accountId,
      accountName: repayment.accountName,
      type: 'LOAN_REPAYMENT',
      category: repayment.loanType === 'LENT' ? 'Loan Repayment Received' : 'Loan Repayment Paid',
      amount: repayment.amount,
      direction: repayment.loanType === 'LENT' ? 'INFLOW' : 'OUTFLOW',
      date: repayment.date,
      description: repayment.loanType === 'LENT' ? `Repayment received from ${repayment.counterpartyName}` : `Repayment paid to ${repayment.counterpartyName}`,
      counterparty: repayment.counterpartyName,
      status: 'COMPLETED',
      loanId: loan.id,
      createdAt: repayment.createdAt,
    };
    this.inMemoryData.transactions.unshift(tx);

    this.persistLocalDb();
    return repayment;
  }

  // BUDGETS
  public async getBudgets(userId: string): Promise<BudgetRecord[]> {
    if (this.isPostgresConnected && this.pool) {
      const res = await this.pool.query(
        'SELECT id, user_id as "userId", category_name as "categoryName", monthly_limit::float as "monthlyLimit" FROM budgets WHERE user_id = $1',
        [userId]
      );
      return res.rows;
    }
    return this.inMemoryData.budgets.filter(b => b.userId === userId);
  }

  public async setBudget(userId: string, categoryName: string, monthlyLimit: number): Promise<BudgetRecord> {
    const existing = this.inMemoryData.budgets.find(b => b.userId === userId && b.categoryName === categoryName);
    if (existing) {
      existing.monthlyLimit = monthlyLimit;
      if (this.isPostgresConnected && this.pool) {
        await this.pool.query(
          'UPDATE budgets SET monthly_limit = $1 WHERE user_id = $2 AND category_name = $3',
          [monthlyLimit, userId, categoryName]
        );
      }
      this.persistLocalDb();
      return existing;
    }

    const newBudget: BudgetRecord = {
      id: `bgt_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      userId,
      categoryName,
      monthlyLimit,
    };

    if (this.isPostgresConnected && this.pool) {
      await this.pool.query(
        'INSERT INTO budgets (id, user_id, category_name, monthly_limit) VALUES ($1, $2, $3, $4)',
        [newBudget.id, newBudget.userId, newBudget.categoryName, newBudget.monthlyLimit]
      );
    }

    this.inMemoryData.budgets.push(newBudget);
    this.persistLocalDb();
    return newBudget;
  }

  public async deleteBudget(userId: string, categoryName: string): Promise<boolean> {
    if (this.isPostgresConnected && this.pool) {
      await this.pool.query('DELETE FROM budgets WHERE user_id = $1 AND category_name = $2', [userId, categoryName]);
    }
    this.inMemoryData.budgets = this.inMemoryData.budgets.filter(b => !(b.userId === userId && b.categoryName === categoryName));
    this.persistLocalDb();
    return true;
  }

  // AUDIT LOGS
  public async addAuditLog(log: Omit<AuditLogRecord, 'id' | 'createdAt'>): Promise<AuditLogRecord> {
    const record: AuditLogRecord = {
      ...log,
      id: `log_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      createdAt: new Date().toISOString(),
    };

    if (this.isPostgresConnected && this.pool) {
      try {
        await this.pool.query(
          'INSERT INTO audit_logs (id, user_id, user_email, action, entity_type, entity_id, details, ip_address, created_at) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)',
          [
            record.id,
            record.userId,
            record.userEmail || null,
            record.action,
            record.entityType,
            record.entityId,
            record.details || null,
            record.ipAddress || null,
            record.createdAt,
          ]
        );
      } catch (err) {
        // ignore log error
      }
    }

    this.inMemoryData.auditLogs.unshift(record);
    if (this.inMemoryData.auditLogs.length > 500) {
      this.inMemoryData.auditLogs.pop();
    }
    this.persistLocalDb();
    return record;
  }

  public async getAuditLogs(): Promise<AuditLogRecord[]> {
    if (this.isPostgresConnected && this.pool) {
      try {
        const res = await this.pool.query(
          'SELECT id, user_id as "userId", user_email as "userEmail", action, entity_type as "entityType", entity_id as "entityId", details, ip_address as "ipAddress", created_at as "createdAt" FROM audit_logs ORDER BY created_at DESC LIMIT 100'
        );
        return res.rows;
      } catch (err) {
        // fallback
      }
    }
    return this.inMemoryData.auditLogs.slice(0, 100);
  }

  // GLOBAL SYSTEM SETTINGS
  public getSystemSettings(): SystemSettingsRecord {
    if (!this.inMemoryData.systemSettings) {
      this.inMemoryData.systemSettings = {
        appName: 'HisabFlow',
        maintenanceMode: false,
        allowUserRegistration: true,
        defaultCurrency: 'BDT',
        sessionTimeoutHours: 720,
        auditLoggingEnabled: true,
        updatedAt: new Date().toISOString(),
      };
      this.persistLocalDb();
    }
    return this.inMemoryData.systemSettings;
  }

  public async updateSystemSettings(updates: Partial<SystemSettingsRecord>): Promise<SystemSettingsRecord> {
    const current = this.getSystemSettings();
    const updated: SystemSettingsRecord = {
      ...current,
      ...updates,
      updatedAt: new Date().toISOString(),
    };
    this.inMemoryData.systemSettings = updated;
    this.persistLocalDb();
    return updated;
  }
}

export const dbService = new DatabaseService();
