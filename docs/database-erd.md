# Database Entity Relationship Diagram (ERD)
**Application:** AccountLedger.com  
**Engine:** PostgreSQL 16 (Neon Serverless)  
**Schema Date:** October 2026

---

## 1. Visual Entity Relationship Diagram (Mermaid)

```mermaid
erDiagram
    users ||--o{ accounts : "owns"
    users ||--o{ categories : "defines"
    users ||--o{ transactions : "records"
    users ||--o{ transfers : "executes"
    users ||--o{ loans : "manages"
    users ||--o{ expense_batches : "creates"
    users ||--o{ audit_logs : "triggers"

    categories ||--o{ categories : "parents (subcategories)"
    categories ||--o{ transactions : "classifies"
    categories ||--o{ expense_batch_items : "tags"

    accounts ||--o{ transactions : "records entries [RESTRICT]"
    accounts ||--o{ transfers : "source account [RESTRICT]"
    accounts ||--o{ transfers : "destination account [RESTRICT]"
    accounts ||--o{ loans : "disburses/receives funds [RESTRICT]"
    accounts ||--o{ loan_repayments : "receives/pays repayment [RESTRICT]"

    transfers ||--o{ transactions : "generates leg entries"

    loans ||--o{ loan_repayments : "tracks repayments [CASCADE]"
    loans ||--o{ transactions : "initial disbursement leg"

    loan_repayments ||--o{ transactions : "repayment cash leg"

    expense_batches ||--o{ expense_batch_items : "contains [CASCADE]"
    expense_batch_items ||--o| transactions : "posts as [SET NULL]"

    users {
        uuid id PK
        varchar username UK
        varchar email UK
        varchar password_hash
        varchar full_name
        varchar role "ADMIN | USER"
        boolean is_active
        varchar currency
        varchar timezone
        varchar date_format
        timestamp created_at
        timestamp updated_at
    }

    accounts {
        uuid id PK
        uuid user_id FK
        varchar name "Unique per user"
        varchar type "CASH | BANK | MOBILE_BANKING"
        varchar provider_name
        varchar account_number
        numeric opening_balance
        numeric current_balance "Reconciled cached balance"
        varchar currency
        varchar status "ACTIVE | ARCHIVED"
        timestamp created_at
        timestamp updated_at
    }

    categories {
        uuid id PK
        uuid user_id FK
        uuid parent_id FK "Self-reference (Subcategories)"
        varchar name
        varchar type "INCOME | EXPENSE"
        varchar icon
        varchar color
        boolean is_system
        boolean is_archived
        timestamp created_at
        timestamp updated_at
    }

    transactions {
        uuid id PK
        uuid user_id FK
        uuid account_id FK "RESTRICT on delete"
        uuid category_id FK "SET NULL on delete"
        uuid transfer_id FK "Nullable"
        uuid loan_id FK "Nullable"
        uuid loan_repayment_id FK "Nullable"
        uuid batch_item_id FK "Unique, Nullable"
        varchar type "INCOME | EXPENSE | TRANSFER_OUT | TRANSFER_IN | LOAN_*"
        varchar status "COMPLETED | PENDING | REVERSED | FAILED"
        numeric amount "CHECK: amount > 0"
        date date "PostgreSQL DATE type"
        text description
        varchar reference_number
        jsonb metadata
        timestamp created_at
        timestamp updated_at
    }

    transfers {
        uuid id PK
        uuid user_id FK
        uuid source_account_id FK "RESTRICT on delete"
        uuid destination_account_id FK "RESTRICT on delete"
        numeric amount "CHECK: amount > 0"
        numeric transfer_fee "CHECK: fee >= 0"
        date date
        text description
        varchar reference
        timestamp created_at
        timestamp updated_at
    }

    loans {
        uuid id PK
        uuid user_id FK
        uuid account_id FK "RESTRICT on delete"
        varchar type "LENT | BORROWED"
        varchar counterparty_name
        varchar counterparty_contact
        numeric principal_amount "CHECK: principal > 0"
        numeric outstanding_principal "CHECK: outstanding >= 0"
        numeric interest_rate
        date start_date
        date due_date
        varchar status "ACTIVE | PARTIALLY_REPAID | SETTLED | DEFAULTED | WRITTEN_OFF"
        text notes
        timestamp created_at
        timestamp updated_at
    }

    loan_repayments {
        uuid id PK
        uuid loan_id FK "CASCADE on delete"
        uuid account_id FK "RESTRICT on delete"
        numeric amount "CHECK: amount > 0"
        numeric interest_amount
        date date
        text notes
        timestamp created_at
    }

    expense_batches {
        uuid id PK
        uuid user_id FK
        uuid account_id FK
        date date
        numeric total_amount
        integer item_count
        text notes
        timestamp created_at
    }

    expense_batch_items {
        uuid id PK
        uuid batch_id FK "CASCADE on delete"
        uuid category_id FK "RESTRICT on delete"
        text description
        numeric amount "CHECK: amount > 0"
        timestamp created_at
    }

    audit_logs {
        uuid id PK
        uuid user_id FK
        varchar entity_type
        varchar entity_id
        varchar action "CREATE | UPDATE | DELETE | REVERSE | ARCHIVE"
        jsonb previous_data
        jsonb new_data
        varchar ip_address
        varchar user_agent
        timestamp created_at
    }
```

---

## 2. Table-by-Table Schema Specification

### `users`
* **Constraints:**
  * `PK`: `id`
  * `UQ`: `username`
  * `UQ`: `email`
  * `CHECK`: `role IN ('ADMIN', 'USER')`
* **Indexes:**
  * `users_username_key` (`username`)
  * `users_email_key` (`email`)

### `accounts`
* **Constraints:**
  * `PK`: `id`
  * `FK`: `user_id` -> `users(id)` ON DELETE CASCADE
  * `UQ`: `(user_id, LOWER(name))` where `status = 'ACTIVE'`
  * `CHECK`: `type IN ('CASH', 'BANK', 'MOBILE_BANKING')`
  * `CHECK`: `status IN ('ACTIVE', 'ARCHIVED')`
* **Indexes:**
  * `idx_accounts_user_status` (`user_id`, `status`)
  * `uq_accounts_user_name` (`user_id`, `LOWER(name)`)

### `categories`
* **Constraints:**
  * `PK`: `id`
  * `FK`: `user_id` -> `users(id)` ON DELETE CASCADE
  * `FK`: `parent_id` -> `categories(id)` ON DELETE SET NULL
  * `UQ`: `(user_id, LOWER(name), type, COALESCE(parent_id, '00000000-0000-0000-0000-000000000000'::uuid))`
  * `CHECK`: `type IN ('INCOME', 'EXPENSE')`
  * `CHECK`: `parent_id IS NULL OR parent_id <> id` (Prevents self-parenting cycles)
* **Indexes:**
  * `idx_categories_user_type_archived` (`user_id`, `type`, `is_archived`)
  * `idx_categories_parent_id` (`parent_id`)

### `transactions`
* **Constraints:**
  * `PK`: `id`
  * `FK`: `user_id` -> `users(id)` ON DELETE CASCADE
  * `FK`: `account_id` -> `accounts(id)` ON DELETE RESTRICT
  * `FK`: `category_id` -> `categories(id)` ON DELETE SET NULL
  * `FK`: `transfer_id` -> `transfers(id)` ON DELETE SET NULL
  * `FK`: `loan_id` -> `loans(id)` ON DELETE SET NULL
  * `FK`: `loan_repayment_id` -> `loan_repayments(id)` ON DELETE SET NULL
  * `FK`: `batch_item_id` -> `expense_batch_items(id)` ON DELETE SET NULL
  * `CHECK`: `amount > 0`
  * `CHECK`: `type IN ('INCOME', 'EXPENSE', 'TRANSFER_OUT', 'TRANSFER_IN', 'LOAN_DISBURSEMENT_GIVEN', 'LOAN_DISBURSEMENT_RECEIVED', 'LOAN_REPAYMENT_RECEIVED', 'LOAN_REPAYMENT_MADE', 'OPENING_BALANCE')`
  * `CHECK`: `status IN ('COMPLETED', 'PENDING', 'REVERSED', 'FAILED')`
* **Indexes:**
  * `idx_transactions_user_date` (`user_id`, `date`)
  * `idx_transactions_user_account_date` (`user_id`, `account_id`, `date`)
  * `idx_transactions_user_type_date` (`user_id`, `type`, `date`)
  * `idx_transactions_user_category` (`user_id`, `category_id`)

### `transfers`
* **Constraints:**
  * `PK`: `id`
  * `FK`: `user_id` -> `users(id)` ON DELETE CASCADE
  * `FK`: `source_account_id` -> `accounts(id)` ON DELETE RESTRICT
  * `FK`: `destination_account_id` -> `accounts(id)` ON DELETE RESTRICT
  * `CHECK`: `source_account_id <> destination_account_id`
  * `CHECK`: `amount > 0`
  * `CHECK`: `transfer_fee >= 0`
* **Indexes:**
  * `idx_transfers_user_date` (`user_id`, `date`)
  * `idx_transfers_source` (`source_account_id`)
  * `idx_transfers_destination` (`destination_account_id`)

### `loans`
* **Constraints:**
  * `PK`: `id`
  * `FK`: `user_id` -> `users(id)` ON DELETE CASCADE
  * `FK`: `account_id` -> `accounts(id)` ON DELETE RESTRICT
  * `CHECK`: `type IN ('LENT', 'BORROWED')`
  * `CHECK`: `status IN ('ACTIVE', 'PARTIALLY_REPAID', 'SETTLED', 'DEFAULTED', 'WRITTEN_OFF')`
  * `CHECK`: `principal_amount > 0`
  * `CHECK`: `outstanding_principal >= 0`
* **Indexes:**
  * `idx_loans_user_type_status` (`user_id`, `type`, `status`)

### `loan_repayments`
* **Constraints:**
  * `PK`: `id`
  * `FK`: `loan_id` -> `loans(id)` ON DELETE CASCADE
  * `FK`: `account_id` -> `accounts(id)` ON DELETE RESTRICT
  * `CHECK`: `amount > 0`
  * `CHECK`: `interest_amount >= 0`
* **Indexes:**
  * `idx_repayments_loan_date` (`loan_id`, `date`)
