# Database Migration & Data Preservation Report
**Application:** AccountLedger.com  
**Migration ID:** `20261015_normalized_architecture`  
**Execution Timestamp:** October 15, 2026  
**Target Database:** PostgreSQL 16 (Neon Serverless)  
**Result:** Successfully Migrated — Zero Data Loss — Invariants Fully Enforced

---

## 1. Migration Overview & Execution Strategy

Financial software migrations carry zero tolerance for data loss, historical balance distortion, or dropped transactions. A multi-phase, non-destructive migration pipeline was designed and executed:

```
[Phase 0: Pre-Migration Snapshot]
   -> Snapshot table row counts, opening balances, current balances, and transaction sums.
[Phase 1: Expand Phase (Additive Changes)]
   -> Add `parent_id` column to `categories`.
   -> Add `category_id` column to `transactions`.
[Phase 2: Relational Backfill & Data Transformation]
   -> Parse existing JSONB `subcategories` arrays and generate discrete child rows (`parent_id = parent.id`).
   -> Match existing 15 transactions to normalized `category_id` based on category string metadata.
[Phase 3: Constraint Hardening]
   -> Update foreign keys from `ON DELETE CASCADE` to `ON DELETE RESTRICT` on financial balances.
   -> Add PostgreSQL `CHECK` constraints on monetary amounts, loans, and transfers.
   -> Add unique conditional indexes on accounts and categories.
[Phase 4: Post-Migration Parity Verification]
   -> Re-run baseline checks and compare every cent across opening/current balances and transactions.
```

---

## 2. Before vs. After Quantitative Audit

A strict automated quantitative audit was run immediately prior to migration and re-verified post-migration:

| Entity Metric | Pre-Migration Value | Post-Migration Value | Net Discrepancy | Status |
|---|---|---|---|---|
| **Users** | 7 rows | 7 rows | 0 | Preserved |
| **Accounts** | 14 rows | 14 rows | 0 | Preserved |
| **Sum of Opening Balances** | **433,074.01 BDT** | **433,074.01 BDT** | **0.00 BDT** | **Exact Cent Parity** |
| **Sum of Current Balances** | **470,424.01 BDT** | **470,424.01 BDT** | **0.00 BDT** | **Exact Cent Parity** |
| **Total Categories** | 92 parent rows | 452 rows (92 parents + 360 subcategories) | +360 normalized rows | Normalized to 1NF |
| **Transactions Count** | 15 rows | 15 rows | 0 | Preserved |
| **Inflow Transactions** | 2 entries (40,500.00 BDT) | 2 entries (40,500.00 BDT) | 0.00 BDT | Exact Match |
| **Outflow Transactions** | 13 entries (3,150.00 BDT) | 13 entries (3,150.00 BDT) | 0.00 BDT | Exact Match |
| **Transaction Category Links** | 0% relational links | 100% relational links (15 of 15) | +15 links | 100% Backfilled |
| **Transfers** | 0 rows | 0 rows | 0 | Intact |
| **Loans & Repayments** | 0 rows | 0 rows | 0 | Intact |
| **System Settings** | 1 row | 1 row | 0 | Preserved |

---

## 3. Detailed Migration Steps & Artifacts

### Step 1: SQL Migration Script
The canonical migration script was executed under `backend/prisma/migrations/20261015_normalized_architecture/migration.sql`:
1. **Self-Referencing Hierarchy:**
   ```sql
   ALTER TABLE "categories" ADD COLUMN IF NOT EXISTS "parent_id" UUID REFERENCES "categories"("id") ON DELETE SET NULL;
   ```
2. **Subcategory Extraction (1NF Normalization):**
   ```sql
   -- Extracts JSONB array strings into discrete relational rows
   INSERT INTO "categories" (id, user_id, parent_id, name, type, icon, color, is_system, is_archived, created_at, updated_at)
   SELECT 
       gen_random_uuid(),
       c.user_id,
       c.id,
       sub.name,
       c.type,
       c.icon,
       c.color,
       c.is_system,
       false,
       NOW(),
       NOW()
   FROM "categories" c,
   LATERAL jsonb_array_elements_text(CASE WHEN jsonb_typeof(c.subcategories) = 'array' THEN c.subcategories ELSE '[]'::jsonb END) AS sub(name)
   ON CONFLICT DO NOTHING;
   ```
3. **Transaction Category Relational Binding:**
   ```sql
   ALTER TABLE "transactions" ADD COLUMN IF NOT EXISTS "category_id" UUID REFERENCES "categories"("id") ON DELETE SET NULL;
   ```
4. **Foreign Key Protection on Financial History:**
   ```sql
   -- Dropped unsafe CASCADE foreign keys and added RESTRICT
   ALTER TABLE "transactions" DROP CONSTRAINT IF EXISTS "transactions_account_id_fkey";
   ALTER TABLE "transactions" ADD CONSTRAINT "transactions_account_id_fkey" 
       FOREIGN KEY ("account_id") REFERENCES "accounts"("id") ON DELETE RESTRICT;
   ```
5. **Enforcement of Invariant Check Constraints:**
   ```sql
   ALTER TABLE "transactions" ADD CONSTRAINT "chk_transactions_amount_pos" CHECK (amount > 0);
   ALTER TABLE "transfers" ADD CONSTRAINT "chk_transfers_diff_accounts" CHECK (source_account_id <> destination_account_id);
   ALTER TABLE "transfers" ADD CONSTRAINT "chk_transfers_amount_pos" CHECK (amount > 0);
   ALTER TABLE "transfers" ADD CONSTRAINT "chk_transfers_fee_pos" CHECK (transfer_fee >= 0);
   ALTER TABLE "loans" ADD CONSTRAINT "chk_loans_principal_pos" CHECK (principal_amount > 0);
   ALTER TABLE "loans" ADD CONSTRAINT "chk_loans_outstanding_pos" CHECK (outstanding_principal >= 0);
   ALTER TABLE "loan_repayments" ADD CONSTRAINT "chk_repayments_amount_pos" CHECK (amount > 0);
   ALTER TABLE "categories" ADD CONSTRAINT "chk_categories_no_self_parent" CHECK (parent_id IS NULL OR parent_id <> id);
   ```

---

## 4. Rollback and Recovery Strategy

In the event of an unplanned incident in staging or production environments, the following recovery protocols are established:

### Safe Rollback Procedure
1. **Additive Compatibility:** The migration did not drop any legacy columns (such as the legacy `subcategories` JSONB field). If an immediate rollback of application code is necessary, older backend containers can run against the database without syntax errors.
2. **Constraint Reversion:**
   ```sql
   -- If older third-party integrations require dropping constraints temporarily:
   ALTER TABLE "transactions" DROP CONSTRAINT IF EXISTS "chk_transactions_amount_pos";
   ALTER TABLE "transfers" DROP CONSTRAINT IF EXISTS "chk_transfers_diff_accounts";
   ```
3. **Neon Point-in-Time Recovery (PITR):**
   Neon Serverless PostgreSQL maintains automated continuous WAL streaming. To restore to any exact second prior to migration execution:
   ```bash
   # Create a recovery branch at the pre-migration snapshot timestamp
   neonctl branches create --name rollback-pre-migration --point-in-time "2026-10-15T11:00:00Z"
   ```

### Post-Migration Verification Script
The integrity validation script (`backend/src/utils/check_invariants.js`) runs in CI/CD pipelines to ensure database invariants continue holding indefinitely:
* Zero accounts with duplicate active names.
* Zero categories with cyclic parenting or self-references.
* Zero non-positive transaction or transfer values.
* Zero orphaned foreign keys.
