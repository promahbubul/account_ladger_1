# Financial Integrity, Accounting Models & Concurrency Architecture
**Application:** AccountLedger.com  
**Engine:** PostgreSQL 16 & Prisma  
**Timezone Standard:** `Asia/Dhaka` (UTC+6)  
**Monetary Precision:** `DECIMAL(14, 2)` (PostgreSQL `NUMERIC`)  
**Date:** October 2026

---

## 1. Authoritative Accounting & Balance Model

AccountLedger.com uses a **Transaction-Based Balance Model with Reconciled Cached Acceleration**.

### The Source of Truth
The immutable source of financial truth is the chronological stream of validated financial events stored in:
1. `transactions` (Operational Income, Expenses, Opening Balances)
2. `transfers` (Account-to-account movements and fees)
3. `loans` and `loan_repayments` (Asset/Liability disbursements and principal settlements)

### Mathematical Reconciliation Equation
For any given account $A_i$, its authoritative balance $B(A_i)$ is formally defined as:

$$B(A_i) = \text{OpeningBalance}(A_i) + \sum \text{Inflows}(A_i) - \sum \text{Outflows}(A_i) - \sum \text{TransfersOut}(A_i) - \sum \text{TransferFees}(A_i) + \sum \text{TransfersIn}(A_i) + \Delta \text{LoanMovements}(A_i)$$

Where $\Delta \text{LoanMovements}(A_i)$ accounts for:
* **Borrowed Loan Disbursed:** $+ \text{Principal}$ (Cash increases, liability increases)
* **Lent Loan Disbursed:** $- \text{Principal}$ (Cash decreases, asset/receivable increases)
* **Repayment Received (on Lent Loan):** $+ \text{Repayment Amount}$ (Cash increases, receivable decreases)
* **Repayment Paid (on Borrowed Loan):** $- \text{Repayment Amount}$ (Cash decreases, liability decreases)

### Automated Drift Healing Service
The backend service `reconcileAccountBalance(accountId)` executes the authoritative aggregation query with atomic locking:
```javascript
// Sample authoritative aggregation query in backend/src/services/db.service.js
const res = await client.query(`
  SELECT 
    COALESCE(SUM(CASE WHEN type IN ('INCOME', 'TRANSFER_IN', 'LOAN_DISBURSEMENT_RECEIVED', 'LOAN_REPAYMENT_RECEIVED') THEN amount ELSE 0 END), 0) -
    COALESCE(SUM(CASE WHEN type IN ('EXPENSE', 'TRANSFER_OUT', 'LOAN_DISBURSEMENT_GIVEN', 'LOAN_REPAYMENT_MADE') THEN amount ELSE 0 END), 0) AS net_transactions
  FROM transactions
  WHERE account_id = $1 AND status = 'COMPLETED'
`, [accountId]);
```
If any divergence is detected between `accounts.current_balance` and the computed ledger sum, the cached balance is healed and logged in `audit_logs`.

---

## 2. Transfer Lifecycle & Integrity Rules

Account-to-account transfers represent balance movements between liquidity accounts owned by the same user.

### Fundamental Invariants
1. **Source & Destination Differentiation:** Enforced by PostgreSQL constraint `chk_transfers_diff_accounts`:
   $$\text{source\_account\_id} \neq \text{destination\_account\_id}$$
2. **Positive Quantities:** Both transfer amount and transfer fee must satisfy `amount > 0` and `transfer_fee >= 0`.
3. **Atomic Multi-Account Mutation:** Transfer creation requires debiting the source account, crediting the destination account, and inserting the transfer record. This operation is strictly wrapped in a `BEGIN ... COMMIT` transaction with `SELECT ... FOR UPDATE` locks on both accounts to prevent race conditions or partial balance updates.
4. **Reversal on Deletion:** Deleting a transfer safely reverses its effects:
   * Source account is credited back `amount + transfer_fee`.
   * Destination account is debited `amount`.
   * The transfer record and its linked counter-leg transactions are cleanly removed.
5. **No Double-Counting in P&L Reports:** Transfers are excluded from Income and Expense totals in financial summary queries; only genuine operational categories contribute to profit and loss.

---

## 3. Lending, Borrowing & Repayment Rules

Loans track counterpart receivables (Money Lent) and liabilities (Money Borrowed).

### Overpayment Prevention
A critical accounting risk in loan management is overpayment (paying more than the remaining debt). The application prevents this at both the database and service levels:

$$\text{Repayment Amount} \leq \text{Outstanding Principal}$$

If a repayment exceeds the outstanding balance, the API rejects the request with HTTP 400:
```javascript
if (parseFloat(amount) > parseFloat(loan.outstanding_principal)) {
  const err = new Error(`Repayment amount (${amount}) exceeds outstanding principal (${loan.outstanding_principal})`);
  err.statusCode = 400;
  throw err;
}
```

### Automatic Loan Status Transitions
Upon adding a repayment inside an atomic database transaction:
* If $\text{New Outstanding Principal} = 0.00$, the loan status transitions to `SETTLED`.
* If $\text{New Outstanding Principal} > 0.00$, the loan status transitions to `PARTIALLY_REPAID`.
* Cash account balances are adjusted concurrently under a row-level lock.

---

## 4. Monetary Precision & Date Handling

### Monetary Representation
* **Database Layer:** Standardized to `NUMERIC(14, 2)` / `DECIMAL(14, 2)`. This stores up to 999,999,999,999.99 BDT with exact decimal precision, entirely avoiding IEEE 754 binary floating-point representation bugs (such as `0.1 + 0.2 = 0.30000000000000004`).
* **Prisma Layer:** Mapped to Prisma's built-in `Decimal` object (backed by `decimal.js`).
* **API Serialization:** All amounts are parsed through `toFixed(2)` or formatted strings at API boundaries, ensuring clients receive clean two-decimal-place monetary figures.

### Timezone & Date Consistency
* **Application Timezone:** Standardized to `Asia/Dhaka` (UTC+6).
* **Calendar Dates vs Instants:**
  * Business dates (the date a transaction or expense occurred) are stored in PostgreSQL native `DATE` format (e.g. `2026-10-15`). Storing business dates as `DATE` eliminates UTC date shifting (where midnight UTC+6 shifts to the previous day in UTC).
  * System timestamps (`created_at`, `updated_at`, `audit_logs`) use `TIMESTAMP WITH TIME ZONE` to track real chronological instants.
* **Date Filtering:** Reporting and dashboard queries parse date boundaries using `Asia/Dhaka` calendar limits (00:00:00.000 to 23:59:59.999).

---

## 5. Concurrency Control & Row-Level Locking

In multi-user or high-frequency environments, concurrent updates to the same account could result in lost updates (e.g., two rapid expenses checking the same opening balance and overwriting each other).

To guarantee strict serializability and data integrity:

```sql
-- Pattern implemented in db.service.js for all financial operations
BEGIN;

-- Lock the account row against concurrent reads or mutations
SELECT id, current_balance 
FROM accounts 
WHERE id = $1 
FOR UPDATE;

-- Update balance based on verified locked state
UPDATE accounts 
SET current_balance = current_balance - $2, updated_at = NOW() 
WHERE id = $1;

-- Insert transaction
INSERT INTO transactions (...) VALUES (...);

COMMIT;
```

If any step fails, the connection pool automatically triggers `ROLLBACK`, guaranteeing that orphaned transactions or half-applied balance adjustments are physically impossible.
