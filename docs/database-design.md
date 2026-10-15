# Database Design & Normalization Specification
**Application:** AccountLedger.com  
**Engine:** PostgreSQL 16 (Neon Serverless)  
**ORM:** Prisma Client  
**Architectural Standard:** 3NF & Boyce–Codd Normal Form (BCNF) with Controlled Cached Balancing  
**Date:** October 2026

---

## 1. Domain Entities & Functional Dependencies

### A. User Entity (`users`)
* **Primary Key:** `id` (UUIDv4)
* **Functional Dependencies:**
  * `id -> {username, email, password_hash, full_name, role, is_active, currency, timezone, date_format, created_at, updated_at}`
  * `email -> id` (Unique Candidate Key)
  * `username -> id` (Unique Candidate Key)
* **Description:** Represents authenticated application principals. Role-based isolation separates administrative system maintenance (`ADMIN`) from private financial management (`USER`).

### B. Account Entity (`accounts`)
* **Primary Key:** `id` (UUIDv4)
* **Functional Dependencies:**
  * `id -> {user_id, name, type, provider_name, account_number, opening_balance, current_balance, currency, status, created_at, updated_at}`
  * `{user_id, LOWER(name)} -> id` (Unique Candidate Key for ACTIVE accounts)
* **Foreign Keys:**
  * `user_id -> users(id)` (ON DELETE CASCADE)
* **Description:** Represents financial repositories such as Cash wallets, Bank accounts, or Mobile Financial Services (bKash, Nagad).

### C. Category Entity (`categories`)
* **Primary Key:** `id` (UUIDv4)
* **Functional Dependencies:**
  * `id -> {user_id, parent_id, name, type, icon, color, is_system, is_archived, created_at, updated_at}`
  * `{user_id, LOWER(name), type, COALESCE(parent_id, ZERO_UUID)} -> id` (Unique candidate key)
* **Foreign Keys:**
  * `user_id -> users(id)` (ON DELETE CASCADE)
  * `parent_id -> categories(id)` (Self-referencing tree, ON DELETE SET NULL)
* **Description:** Hierarchical taxonomy for classifying financial flows. Main categories have `parent_id = NULL`; subcategories reference their parent.

### D. Transaction Entity (`transactions`)
* **Primary Key:** `id` (UUIDv4)
* **Functional Dependencies:**
  * `id -> {user_id, account_id, category_id, transfer_id, loan_id, loan_repayment_id, batch_item_id, type, status, amount, date, description, reference_number, metadata, created_at, updated_at}`
* **Foreign Keys:**
  * `user_id -> users(id)` (ON DELETE CASCADE)
  * `account_id -> accounts(id)` (ON DELETE RESTRICT)
  * `category_id -> categories(id)` (ON DELETE SET NULL)
  * `transfer_id -> transfers(id)` (ON DELETE SET NULL)
  * `loan_id -> loans(id)` (ON DELETE SET NULL)
  * `loan_repayment_id -> loan_repayments(id)` (ON DELETE SET NULL)
* **Description:** Authoritative ledger of income, expense, and counterparty cash movements.

### E. Transfer Entity (`transfers`)
* **Primary Key:** `id` (UUIDv4)
* **Functional Dependencies:**
  * `id -> {user_id, source_account_id, destination_account_id, amount, transfer_fee, date, description, reference, created_at, updated_at}`
* **Foreign Keys:**
  * `user_id -> users(id)` (ON DELETE CASCADE)
  * `source_account_id -> accounts(id)` (ON DELETE RESTRICT)
  * `destination_account_id -> accounts(id)` (ON DELETE RESTRICT)
* **Constraints:** `source_account_id <> destination_account_id`, `amount > 0`, `transfer_fee >= 0`.
* **Description:** Atomic double-entry movement between two accounts owned by the same user.

### F. Loan & Repayment Entities (`loans`, `loan_repayments`)
* **Loans Primary Key:** `id` (UUIDv4)
* **Functional Dependencies:**
  * `id -> {user_id, account_id, type, counterparty_name, counterparty_contact, principal_amount, outstanding_principal, interest_rate, start_date, due_date, status, notes, created_at, updated_at}`
* **Repayments Primary Key:** `id` (UUIDv4)
* **Functional Dependencies:**
  * `id -> {loan_id, account_id, amount, interest_amount, date, notes, created_at}`
* **Foreign Keys:**
  * `loans.account_id -> accounts(id)` (ON DELETE RESTRICT)
  * `loan_repayments.loan_id -> loans(id)` (ON DELETE CASCADE)
  * `loan_repayments.account_id -> accounts(id)` (ON DELETE RESTRICT)
* **Description:** Lending and borrowing ledger tracking assets (receivables) and liabilities (payables) without distorting operating income/expense statements.

### G. Audit Log Entity (`audit_logs`)
* **Primary Key:** `id` (UUIDv4)
* **Functional Dependencies:**
  * `id -> {user_id, entity_type, entity_id, action, previous_data, new_data, ip_address, user_agent, created_at}`
* **Description:** Immutable record of critical administrative or financial state transitions.

---

## 2. Normalization Analysis

### First Normal Form (1NF)
* **Requirement:** Each attribute must contain only atomic values; no repeating groups or multivalued arrays.
* **Pre-Migration Violation:** `categories.subcategories` contained JSON arrays such as `["Groceries", "Dining Out", "Snacks"]`.
* **Normalized Structure:** All subcategories were transformed into discrete tuples in the `categories` table with a foreign key `parent_id` pointing to their parent category. Each record represents exactly one categorical concept with an atomic name.

### Second Normal Form (2NF)
* **Requirement:** Must be in 1NF and have no partial dependencies on candidate keys (every non-key attribute must depend on the whole candidate key).
* **Evaluation:** All tables utilize surrogate UUID primary keys. Where composite natural keys exist (e.g. `{user_id, name}` in accounts, or `{user_id, name, parent_id}` in categories), all attributes depend strictly on the complete key. No partial dependencies exist.

### Third Normal Form (3NF)
* **Requirement:** Must be in 2NF and have no transitive dependencies (non-key attributes must depend only on candidate keys, not on other non-key attributes).
* **Refactoring:** 
  * Prior to normalization, transactions stored redundant category and subcategory string labels alongside amounts, creating transitive dependency `transaction_id -> category_id -> category_name`.
  * The schema was refactored so `transactions` store foreign keys (`category_id`, `account_id`) referencing normalized tables. Descriptive metadata (account type, provider name, category color/icon) resides solely within the parent entity.

### Boyce–Codd Normal Form (BCNF)
* **Requirement:** For every functional dependency $X \rightarrow Y$, $X$ must be a superkey.
* **Evaluation:** In every entity (`users`, `accounts`, `categories`, `transactions`, `transfers`, `loans`), the left side of every non-trivial functional dependency is either the primary key UUID or an enforced unique constraint (e.g. `email` or `{user_id, name, parent_id}`). The schema satisfies BCNF.

---

## 3. Justified Intentional Denormalization

### Cached Account Balance (`accounts.current_balance`)
* **Denormalized Attribute:** `accounts.current_balance` (Stores the current net balance).
* **Rationale:** Real-time dashboards, transaction validation forms, and account selector dropdowns require immediate access to account balances across multiple accounts. Recomputing balances on every read would require aggregating the entire lifetime of transactions, transfers, loans, and repayments, generating high I/O overhead on Neon serverless PostgreSQL.
* **Consistency & Integrity Guarantees:**
  1. **Atomic Mutation:** Every operation that alters an account balance (transaction creation/edit/deletion, transfer, loan repayment) is executed inside a PostgreSQL `BEGIN ... COMMIT` transaction with `SELECT ... FOR UPDATE` row-level locks on the affected account rows.
  2. **Authoritative Reconciliation Service:** A specialized reconciliation engine (`reconcileAccountBalance(accountId)` and `reconcileAllUserAccounts(userId)`) was implemented. It calculates:
     $$\text{Calculated Balance} = \text{Opening Balance} + \sum \text{Inflows} - \sum \text{Outflows} - \sum \text{Transfers Out} + \sum \text{Transfers In} \pm \text{Loan Adjustments}$$
     Any drift caused by legacy operations is automatically detected and healed with atomic `UPDATE accounts SET current_balance = ...`.

---

## 4. Entity Cardinality Matrix

| Parent Entity | Child Entity | Cardinality | Deletion Rule | Description |
|---|---|---|---|---|
| `users` | `accounts` | 1 : N | CASCADE | User accounts deleted if user profile is purged. |
| `users` | `categories` | 1 : N | CASCADE | Categories deleted if user is purged. |
| `users` | `transactions` | 1 : N | CASCADE | Financial history deleted if user profile is purged. |
| `categories` | `categories` (Sub) | 1 : N | SET NULL | If parent category is deleted, subcategories become root categories or are archived. |
| `accounts` | `transactions` | 1 : N | **RESTRICT** | **Crucial:** Accounts with transactions cannot be deleted. History is protected. |
| `accounts` | `transfers` (Source) | 1 : N | **RESTRICT** | Source accounts cannot be dropped while transfer history exists. |
| `accounts` | `transfers` (Dest) | 1 : N | **RESTRICT** | Destination accounts cannot be dropped while transfer history exists. |
| `categories` | `transactions` | 1 : N | SET NULL | Deleting a category retains the transaction and unlinks the category ID. |
| `loans` | `loan_repayments` | 1 : N | CASCADE | Repayments belong strictly to their parent loan. |
| `transfers` | `transactions` | 1 : 2 | SET NULL | Transfer optionally links out/in ledger counterpart transactions. |
