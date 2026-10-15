-- Migration: 20261015_normalized_architecture
-- AccountLedger.com Database Normalization, Integrity & Constraints Refactoring

BEGIN;

-- 1. USERS CONSTRAINTS
ALTER TABLE users DROP CONSTRAINT IF EXISTS chk_users_role;
ALTER TABLE users ADD CONSTRAINT chk_users_role CHECK (role IN ('ADMIN', 'USER'));

-- 2. ACCOUNTS CONSTRAINTS & INDEXES
ALTER TABLE accounts DROP CONSTRAINT IF EXISTS chk_accounts_type;
ALTER TABLE accounts ADD CONSTRAINT chk_accounts_type CHECK (type IN ('CASH', 'BANK', 'MOBILE_BANKING'));

ALTER TABLE accounts DROP CONSTRAINT IF EXISTS chk_accounts_status;
ALTER TABLE accounts ADD CONSTRAINT chk_accounts_status CHECK (status IN ('ACTIVE', 'ARCHIVED'));

ALTER TABLE accounts ALTER COLUMN opening_balance SET NOT NULL;
ALTER TABLE accounts ALTER COLUMN current_balance SET NOT NULL;
ALTER TABLE accounts ALTER COLUMN currency SET NOT NULL;
ALTER TABLE accounts ALTER COLUMN status SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_accounts_user_name ON accounts(user_id, LOWER(name));

-- 3. CATEGORIES NORMALIZATION & CONSTRAINTS
ALTER TABLE categories ADD COLUMN IF NOT EXISTS parent_id VARCHAR(64) REFERENCES categories(id) ON DELETE SET NULL;

ALTER TABLE categories DROP CONSTRAINT IF EXISTS chk_categories_parent_not_self;
ALTER TABLE categories ADD CONSTRAINT chk_categories_parent_not_self CHECK (parent_id IS NULL OR parent_id <> id);

ALTER TABLE categories DROP CONSTRAINT IF EXISTS chk_categories_type;
ALTER TABLE categories ADD CONSTRAINT chk_categories_type CHECK (type IN ('INCOME', 'EXPENSE'));

CREATE INDEX IF NOT EXISTS idx_categories_parent_id ON categories(parent_id);
CREATE INDEX IF NOT EXISTS idx_categories_user_type ON categories(user_id, type);
CREATE UNIQUE INDEX IF NOT EXISTS uq_categories_user_name_parent ON categories(user_id, LOWER(name), type, COALESCE(parent_id, ''));

-- 4. MIGRATE JSONB SUBCATEGORIES TO FIRST-CLASS CHILD CATEGORY ROWS (1NF)
INSERT INTO categories (id, user_id, parent_id, name, type, icon, color, subcategories, is_archived, is_system, created_at, updated_at)
SELECT 
  'cat_sub_' || SUBSTRING(MD5(c.id || '_' || sub.val) FROM 1 FOR 16) AS id,
  c.user_id,
  c.id AS parent_id,
  sub.val AS name,
  c.type,
  c.icon,
  c.color,
  '[]'::jsonb AS subcategories,
  false AS is_archived,
  c.is_system,
  c.created_at,
  NOW() AS updated_at
FROM categories c
CROSS JOIN LATERAL jsonb_array_elements_text(c.subcategories) AS sub(val)
WHERE c.parent_id IS NULL
  AND jsonb_array_length(c.subcategories) > 0
  AND NOT EXISTS (
    SELECT 1 FROM categories existing
    WHERE existing.user_id = c.user_id
      AND existing.parent_id = c.id
      AND LOWER(existing.name) = LOWER(sub.val)
  );

-- 5. TRANSFERS CONSTRAINTS, INDEXES & SAFE FOREIGN KEYS
ALTER TABLE transfers DROP CONSTRAINT IF EXISTS transfers_source_account_id_fkey;
ALTER TABLE transfers ADD CONSTRAINT transfers_source_account_id_fkey FOREIGN KEY (source_account_id) REFERENCES accounts(id) ON DELETE RESTRICT;

ALTER TABLE transfers DROP CONSTRAINT IF EXISTS transfers_destination_account_id_fkey;
ALTER TABLE transfers ADD CONSTRAINT transfers_destination_account_id_fkey FOREIGN KEY (destination_account_id) REFERENCES accounts(id) ON DELETE RESTRICT;

ALTER TABLE transfers DROP CONSTRAINT IF EXISTS chk_transfers_amount_positive;
ALTER TABLE transfers ADD CONSTRAINT chk_transfers_amount_positive CHECK (amount > 0);

ALTER TABLE transfers DROP CONSTRAINT IF EXISTS chk_transfers_fee_non_negative;
ALTER TABLE transfers ADD CONSTRAINT chk_transfers_fee_non_negative CHECK (transfer_fee >= 0);

ALTER TABLE transfers DROP CONSTRAINT IF EXISTS chk_transfers_diff_accounts;
ALTER TABLE transfers ADD CONSTRAINT chk_transfers_diff_accounts CHECK (source_account_id <> destination_account_id);

CREATE INDEX IF NOT EXISTS idx_transfers_user_date ON transfers(user_id, date DESC, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_transfers_source_account ON transfers(source_account_id);
CREATE INDEX IF NOT EXISTS idx_transfers_destination_account ON transfers(destination_account_id);

-- 6. LOANS CONSTRAINTS, INDEXES & SAFE FOREIGN KEYS
ALTER TABLE loans DROP CONSTRAINT IF EXISTS loans_account_id_fkey;
ALTER TABLE loans ADD CONSTRAINT loans_account_id_fkey FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE RESTRICT;

ALTER TABLE loans DROP CONSTRAINT IF EXISTS chk_loans_principal_positive;
ALTER TABLE loans ADD CONSTRAINT chk_loans_principal_positive CHECK (principal_amount > 0);

ALTER TABLE loans DROP CONSTRAINT IF EXISTS chk_loans_outstanding_non_negative;
ALTER TABLE loans ADD CONSTRAINT chk_loans_outstanding_non_negative CHECK (outstanding_principal >= 0);

ALTER TABLE loans DROP CONSTRAINT IF EXISTS chk_loans_interest_non_negative;
ALTER TABLE loans ADD CONSTRAINT chk_loans_interest_non_negative CHECK (interest_rate >= 0);

ALTER TABLE loans DROP CONSTRAINT IF EXISTS chk_loans_type;
ALTER TABLE loans ADD CONSTRAINT chk_loans_type CHECK (type IN ('LENT', 'BORROWED'));

ALTER TABLE loans DROP CONSTRAINT IF EXISTS chk_loans_status;
ALTER TABLE loans ADD CONSTRAINT chk_loans_status CHECK (status IN ('ACTIVE', 'PARTIALLY_REPAID', 'SETTLED', 'DEFAULTED', 'WRITTEN_OFF'));

CREATE INDEX IF NOT EXISTS idx_loans_user_type_status ON loans(user_id, type, status);
CREATE INDEX IF NOT EXISTS idx_loans_account_id ON loans(account_id);

-- 7. REPAYMENTS CONSTRAINTS, INDEXES & SAFE FOREIGN KEYS
ALTER TABLE repayments DROP CONSTRAINT IF EXISTS repayments_account_id_fkey;
ALTER TABLE repayments ADD CONSTRAINT repayments_account_id_fkey FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE RESTRICT;

ALTER TABLE repayments DROP CONSTRAINT IF EXISTS repayments_loan_id_fkey;
ALTER TABLE repayments ADD CONSTRAINT repayments_loan_id_fkey FOREIGN KEY (loan_id) REFERENCES loans(id) ON DELETE RESTRICT;

ALTER TABLE repayments DROP CONSTRAINT IF EXISTS chk_repayments_amount_positive;
ALTER TABLE repayments ADD CONSTRAINT chk_repayments_amount_positive CHECK (amount > 0);

ALTER TABLE repayments DROP CONSTRAINT IF EXISTS chk_repayments_loan_type;
ALTER TABLE repayments ADD CONSTRAINT chk_repayments_loan_type CHECK (loan_type IN ('LENT', 'BORROWED'));

CREATE INDEX IF NOT EXISTS idx_repayments_loan_id ON repayments(loan_id);
CREATE INDEX IF NOT EXISTS idx_repayments_account_id ON repayments(account_id);

-- 8. TRANSACTIONS NORMALIZATION, CONSTRAINTS, INDEXES & SAFE FOREIGN KEYS
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS category_id VARCHAR(64) REFERENCES categories(id) ON DELETE SET NULL;

ALTER TABLE transactions DROP CONSTRAINT IF EXISTS transactions_account_id_fkey;
ALTER TABLE transactions ADD CONSTRAINT transactions_account_id_fkey FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE RESTRICT;

ALTER TABLE transactions DROP CONSTRAINT IF EXISTS transactions_transfer_id_fkey;
ALTER TABLE transactions ADD CONSTRAINT transactions_transfer_id_fkey FOREIGN KEY (transfer_id) REFERENCES transfers(id) ON DELETE SET NULL;

ALTER TABLE transactions DROP CONSTRAINT IF EXISTS transactions_loan_id_fkey;
ALTER TABLE transactions ADD CONSTRAINT transactions_loan_id_fkey FOREIGN KEY (loan_id) REFERENCES loans(id) ON DELETE SET NULL;

ALTER TABLE transactions DROP CONSTRAINT IF EXISTS chk_transactions_amount_positive;
ALTER TABLE transactions ADD CONSTRAINT chk_transactions_amount_positive CHECK (amount > 0);

ALTER TABLE transactions DROP CONSTRAINT IF EXISTS chk_transactions_direction;
ALTER TABLE transactions ADD CONSTRAINT chk_transactions_direction CHECK (direction IN ('INFLOW', 'OUTFLOW'));

ALTER TABLE transactions DROP CONSTRAINT IF EXISTS chk_transactions_type;
ALTER TABLE transactions ADD CONSTRAINT chk_transactions_type CHECK (type IN ('INCOME', 'EXPENSE', 'TRANSFER_OUT', 'TRANSFER_IN', 'LOAN_DISBURSEMENT_GIVEN', 'LOAN_DISBURSEMENT_RECEIVED', 'LOAN_REPAYMENT_RECEIVED', 'LOAN_REPAYMENT_MADE', 'OPENING_BALANCE'));

ALTER TABLE transactions DROP CONSTRAINT IF EXISTS chk_transactions_status;
ALTER TABLE transactions ADD CONSTRAINT chk_transactions_status CHECK (status IN ('COMPLETED', 'PENDING', 'REVERSED', 'FAILED'));

CREATE INDEX IF NOT EXISTS idx_transactions_category_id ON transactions(category_id);
CREATE INDEX IF NOT EXISTS idx_transactions_user_account_date ON transactions(user_id, account_id, date DESC, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_transactions_user_type_date ON transactions(user_id, type, date DESC);

-- Populate category_id for existing transactions by matching subcategory child rows first, then parent rows
UPDATE transactions t
SET category_id = c.id
FROM categories c
WHERE t.category_id IS NULL
  AND t.user_id = c.user_id
  AND t.subcategory IS NOT NULL
  AND LOWER(c.name) = LOWER(t.subcategory);

UPDATE transactions t
SET category_id = c.id
FROM categories c
WHERE t.category_id IS NULL
  AND t.user_id = c.user_id
  AND LOWER(c.name) = LOWER(t.category);

-- For any generic "Income" transactions without exact match, match with "Other Income" or first user income category
UPDATE transactions t
SET category_id = c.id
FROM categories c
WHERE t.category_id IS NULL
  AND t.user_id = c.user_id
  AND LOWER(t.category) = 'income'
  AND (LOWER(c.name) = 'other income' OR (c.type = 'INCOME' AND c.parent_id IS NULL));

-- 9. AUDIT LOGS FOREIGN KEY & INDEXES
ALTER TABLE audit_logs DROP CONSTRAINT IF EXISTS audit_logs_user_id_fkey;
ALTER TABLE audit_logs ADD CONSTRAINT audit_logs_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_audit_logs_user_entity ON audit_logs(user_id, entity_type, entity_id);

-- 10. SYSTEM SETTINGS
INSERT INTO system_settings (id, app_name, maintenance_mode, allow_user_registration, default_currency, session_timeout_hours, audit_logging_enabled, updated_at)
VALUES (1, 'AccountLedger.com', false, true, 'BDT', 720, true, NOW())
ON CONFLICT (id) DO NOTHING;

COMMIT;
