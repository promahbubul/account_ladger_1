# AccountLedger Mobile App — Navigation Audit, Refactoring & Feature Completion Plan

**Author:** Senior React Native Engineer, Mobile Architect & QA Engineer  
**Date:** October 18, 2026  
**Status:** In Progress / Implementation Underway  
**Target:** React Native 0.88.0 / Expo SDK 58 (JavaScript Only)

---

## 1. Current Architecture & Identified Problems

### Existing Stack
- **Framework:** React Native 0.88.0 on Expo SDK 58 (~58.0.14)
- **Navigation:** `@react-navigation/native` (^7.5.1), `@react-navigation/bottom-tabs` (^7.21.0), `@react-navigation/native-stack` (^7.21.0)
- **Data Fetching & State:** `@tanstack/react-query` (^5.104.4)
- **Persistence:** `expo-secure-store` (~58.0.2)
- **Authentication:** Native-compatible Firebase Auth + Express backend with Firebase Admin SDK verification
- **Backend API:** Express.js REST API on `http://127.0.0.1:5001` with PostgreSQL

### Identified Issues
1. **Broken / Inconsistent Navigation Structure:**
   - `AppNavigator.js` previously defined an overcrowded 6-tab bottom bar (`DashboardTab`, `TransactionsTab`, `AccountsTab`, `LoansTab`, `ReportsTab`, `SettingsTab`).
   - Screens pushed onto the root stack lacked nested stack context, causing the bottom navigation bar to vanish unpredictably.
   - Sibling tab navigation from inside screens and cross-navigator links were misnamed or unhandled.
   - Secondary destinations in `SettingsScreen` attempted to route to nonexistent screens like `AdminDashboard`, `AdminUsers`, and `AdminLogs` within the user navigator.
2. **Missing UI Back Buttons (Trapped Navigation):**
   - Sub-screens including `IncomeScreen`, `ExpensesScreen`, `CategoriesScreen`, `TransfersScreen`, `LoansScreen`, and `BudgetsScreen` lacked `showBack` and `onBack` props in their headers, trapping users on platforms without hardware back buttons.
3. **Missing Quick-Action Entry Points on Transactions:**
   - No direct `Add Income` or `Add Expense` buttons existed on the Transactions list screen.
4. **Validation & Field Constraints in Add Income / Add Expense:**
   - The Add Income and Add Expense screens required an explicit description even when the user just wanted to record a quick category expense, causing unnecessary validation friction.
   - Default fallbacks for categories and accounts needed defensive handling when network queries were loading.
5. **Incomplete Transaction Editing:**
   - `TransactionDetailScreen` only permitted editing notes and references, preventing users from correcting transaction dates or amounts and seeing the updated chronological ordering.

---

## 2. Root Cause Analysis of Broken Navigation

1. **Flat Stack Architecture Without Encapsulated Tab Stacks:**
   - In React Navigation v7, when secondary screens are placed directly in a root stack above the tab bar rather than inside dedicated tab stacks, navigating to any detail or form screen unmounts the tab bar and makes state restoration brittle.
2. **Missing Hub Screen for Secondary Destinations:**
   - Features like Categories, Lending/Borrowing, Transfers, and Budgets were scattered without a cohesive "More" hub, resulting in a cluttered tab bar that degraded mobile ergonomics.
3. **Inconsistent Route Names:**
   - Buttons across screens used conflicting names (`AccountsTab` vs `Accounts`, `TransactionsTab` vs `Transactions`).
4. **Absence of a Global Navigation Reference:**
   - No `navigationRef.js` existed to safely handle programmatic redirects, session expiries, or deep-link routing.

---

## 3. Existing Feature Status

| Feature | Current State | Target State |
|---|---|---|
| **Dashboard (Home)** | Working with KPIs and recent transactions | Refactored with clean navigation to nested stacks |
| **Transactions List** | Working with pagination and type filters | Add prominent Income & Expense action buttons |
| **Transaction Details** | Working view, delete, limited edit | Support editing Date, Amount, Description, Category, Reference |
| **Add Income** | Working API, but strict description requirement | Auto-default description to category; smooth return & query invalidation |
| **Add Expense** | Working API, but strict description requirement | Auto-default description to category; smooth return & query invalidation |
| **Accounts List & Details** | Working CRUD and archiving | Encapsulated in AccountsStack |
| **Transfers** | Working list and creation form | Linked into AccountsStack and More hub |
| **Categories** | Working list and creation form | Add back button, link into More hub |
| **Lending & Borrowing** | Working loans and repayments | Move from primary tab to More hub, add back button |
| **Reports** | Working KPI breakdown and export | Encapsulated in ReportsStack |
| **Settings & Profile** | Working settings list | Separate user profile & settings into More hub |
| **More Hub** | Missing | Create dedicated `MoreScreen` with organized feature grid |

---

## 4. Proposed Navigation Hierarchy & Screen Map

```text
RootNavigator
 ├── AuthNavigator (Unauthenticated)
 │    ├── LoginScreen
 │    ├── RegisterScreen
 │    ├── VerifyEmailScreen
 │    ├── ForgotPasswordScreen
 │    └── ResetPasswordScreen
 ├── AdminNavigator (User Role === 'ADMIN')
 │    ├── AdminDashboardScreen
 │    ├── AdminUsersScreen
 │    ├── AdminLogsScreen
 │    └── AdminSettingsScreen
 └── AppNavigator (User Role === 'USER')
      └── MainTabNavigator (5 Primary Destinations)
           ├── HomeTab (HomeStack)
           │    ├── DashboardScreen (Home)
           │    ├── AddIncomeScreen
           │    ├── AddExpenseScreen
           │    ├── BulkExpenseScreen
           │    ├── IncomeScreen (Filtered list)
           │    ├── ExpensesScreen (Filtered list)
           │    ├── TransactionDetailScreen
           │    ├── AccountDetailScreen
           │    └── CreateTransferScreen
           ├── TransactionsTab (TransactionsStack)
           │    ├── TransactionsScreen
           │    ├── TransactionDetailScreen
           │    ├── AddIncomeScreen
           │    ├── AddExpenseScreen
           │    └── BulkExpenseScreen
           ├── AccountsTab (AccountsStack)
           │    ├── AccountsScreen
           │    ├── AccountDetailScreen
           │    ├── CreateAccountScreen
           │    ├── CreateTransferScreen
           │    └── TransfersScreen
           ├── ReportsTab (ReportsStack)
           │    └── ReportsScreen
           └── MoreTab (MoreStack)
                ├── MoreScreen (Central Feature Hub)
                ├── CategoriesScreen
                ├── CreateCategoryScreen
                ├── LoansScreen (Lending & Borrowing)
                ├── CreateLoanScreen
                ├── AddRepaymentScreen
                ├── TransfersScreen
                ├── CreateTransferScreen
                ├── BudgetsScreen
                └── ProfileScreen
```

---

## 5. Bottom Tab Bar Design & Feature Placement

The bottom tab bar is streamlined to the 5 requested core destinations:

1. **Home** — Dashboard, balance summary, net worth, quick actions, recent transactions (`home` / `home-outline`).
2. **Transactions** — Full searchable ledger, type filtering, date range, pagination, direct Add Income / Add Expense buttons (`receipt` / `receipt-outline`).
3. **Accounts** — Cash, bank, mobile banking accounts, balances, account details (`wallet` / `wallet-outline`).
4. **Reports** — Net cash flow, asset breakdown, receivables/payables summary, backup export (`bar-chart` / `bar-chart-outline`).
5. **More** — Clean menu for Categories, Loans, Transfers, Budgets, Profile & Preferences, Sign Out (`grid` / `grid-outline`).

### Styling & Ergonomics
- Dark-neutral palette (`COLORS.surface`: `#13161B`, `COLORS.border`: `#262B34`).
- Compact height (60px) with safe-area insets padding for modern Android and iOS navigation bars.
- Clear active tint (`COLORS.primary`: `#3B82F6`) and inactive tint (`COLORS.textMuted`: `#64748B`).

---

## 6. Required Screen & Component Changes

1. **Create `navigationRef.js`**:
   - Provide safe navigation without prop-drilling or unhandled dispatch errors.
2. **Create `MoreScreen.js`**:
   - Implement categorized grid/card layout for Categories, Loans, Transfers, Budgets, Profile, and Sign Out.
3. **Refactor `MainTabNavigator.js` & `AppNavigator.js`**:
   - Implement the 5-tab structure with nested stacks.
   - Expose root-level modal routes (`AddIncome`, `AddExpense`, `TransactionDetail`) so cross-stack navigation never fails.
4. **Update `TransactionsScreen.js`**:
   - Add top quick-action buttons for `+ Income` and `- Expense` to provide immediate transaction entry.
5. **Update `AddIncomeScreen.js` and `AddExpenseScreen.js`**:
   - Make description auto-populate with category name if left blank by user.
   - Validate account and category selections reliably.
   - Comprehensive query invalidation on save (`transactionsList`, `incomeList`, `expensesList`, `reportsSummary`, `accountsOverview`, `recentTransactions`).
6. **Update `TransactionDetailScreen.js`**:
   - Expand the edit modal to allow updating Date, Amount, Description, Category, and Reference.
   - Ensure updated transactions are immediately re-sorted chronologically.
7. **Add Back Buttons (`showBack` + `onBack`)**:
   - Add to `IncomeScreen`, `ExpensesScreen`, `CategoriesScreen`, `TransfersScreen`, `LoansScreen`, `BudgetsScreen`.

---

## 7. Backend & API Dependencies

All mobile features utilize existing, verified Express endpoints:
- `GET /api/transactions` (Pagination, type filter, date filter, search)
- `POST /api/transactions/income`
- `POST /api/transactions/expense`
- `POST /api/transactions/bulk`
- `PUT /api/transactions/:id`
- `DELETE /api/transactions/:id`
- `GET /api/accounts`, `POST /api/accounts`, `PUT /api/accounts/:id`, `PATCH /api/accounts/:id/archive`, `DELETE /api/accounts/:id`
- `GET /api/categories`, `POST /api/categories`
- `GET /api/transfers`, `POST /api/transfers`
- `GET /api/loans`, `POST /api/loans`, `GET /api/loans/repayments`, `POST /api/loans/:id/repayments`
- `GET /api/budgets`, `POST /api/budgets`
- `GET /api/reports/summary`, `GET /api/reports/export`
- `GET /api/user/profile`, `PUT /api/user/profile`

---

## 8. Authentication & Session Requirements

- Session tokens and user profiles remain securely stored in `expo-secure-store`.
- Unverified users remain blocked from financial APIs (HTTP 403) and must complete 6-digit email verification.
- Verified Google users bypass code verification.
- Signing out clears secure store and automatically resets navigation state to `AuthNavigator`.

---

## 9. Performance & Bundle Optimization

- Virtualized lists (`FlatList`) with key extractors for all list screens.
- TanStack Query caching and granular invalidation to avoid redundant network payloads.
- Zero TypeScript overhead; strictly clean modern JavaScript.
- Avoid bulky unneeded dependencies; leverage installed Expo SDK 58 modules.

---

## 10. Testing Strategy & Acceptance Criteria

1. **Expo Doctor & Compilation Check:** 20/20 checks passed with zero issues.
2. **Backend Authentication & Data Isolation:** All 82 backend test cases passing.
3. **Mobile End-to-End Suite:** All existing and new mobile integration tests passing.
4. **Navigation Flow Verification:**
   - Navigating between all 5 bottom tabs is smooth and responsive.
   - Pressing Add Income and Add Expense from Home opens the correct screen and returns smoothly.
   - Pressing Add Income and Add Expense from Transactions opens the correct screen and returns smoothly.
   - Saving an income or expense creates the record in the backend database and updates dashboard balances and ledger history.
   - Editing a transaction's date re-orders the transaction chronologically.
   - All sub-screens have accessible back buttons.
   - Logging out immediately resets state and blocks financial screens.
