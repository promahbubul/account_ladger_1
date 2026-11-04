# Performance ও Structure Plan

শেষ হালনাগাদ: 2026-11-05

এই ফাইল দেখে যেকোনো PC থেকে কাজ চালানো যাবে। Claude Code-কে বলুন:

> `docs/performance-plan.md` পড়ো, আর পরের বাকি ধাপটা plan অনুযায়ী করো।

**কাজ করার নিয়ম**

- ধাপগুলো ক্রমানুসারে করুন। একবারে একটা ধাপ।
- প্রতিটা ধাপের শেষে test চালান, তারপর push-এর আগে মালিককে জিজ্ঞেস করুন।
- ধাপ শেষে এই ফাইলের অবস্থা হালনাগাদ করুন।
- Line number বদলায়, তাই এখানে ফাইল আর function-এর নাম দেওয়া আছে। কাজের আগে code মিলিয়ে নিন।

## অবস্থা এক নজরে

| ধাপ | কাজ | অবস্থা |
|---|---|---|
| 1 | Backend: আসল SQL paging, index, gzip | ✅ শেষ (`2b1e3a2`) |
| 2 | Web: login-এ সব transaction আনা বন্ধ | ✅ শেষ (branch `perf/web-stop-loading-all-transactions`) |
| 3 | Mobile: admin paging, list-এর গতি | ✅ শেষ |
| 4 | Backend: ছোট বাকি কাজ | 🟡 1-2 শেষ; 3-4 পরে, 5 মালিকের সিদ্ধান্ত |
| 5 | Test ও CI | ⬜ পরের কাজ |
| 6 | Structure পরিষ্কার | ⬜ বাকি, সবচেয়ে কম জরুরি |

## কেন এই plan

আগে প্রায় সব list প্রথমে সব row এনে তারপর ৫০টা কেটে পাঠাত। আজ data কম বলে টের পাওয়া যায় না, কিন্তু data বাড়লে app ধীর হবে। নিচের সময় throwaway database-এ এক user-এর ৫০,০০০ transaction দিয়ে মাপা। Database একই PC-তে ছিল, তাই Neon আর network-এ সময় আরও বেশি হবে।

| কাজ | ধাপ 1-এর আগে | ধাপ 1-এর পরে |
|---|---|---|
| প্রথম পাতা | 536 ms | 6 ms |
| Web login-এর transaction ডেটা | 21 MB (দুবার পাঠানো হতো, তাই আসলে প্রায় 42 MB) | 21 MB, gzip-এর আগে; ধাপ 2 এটাই সরাবে |

## ধাপ 1: Backend paging ✅ শেষ

- Transactions, Transfers, Loans, Repayments, Audit log এখন `queryPage` (`backend/src/services/db.service.js`) দিয়ে SQL-এ পাতা পড়ে।
- নতুন `*_feed` index, আর `backend/src/middleware/compress-json.js`-এ gzip।
- Paged response-এ শুধু `items`। `all=true` response-এ শুধু নামওয়ালা key (`transactions`, `loans` ইত্যাদি)।
- Test: `backend/tests/pagination.test.js`।

এই ধাপে ইচ্ছা করে যা রাখা হয়েছে: Audit log-এ `items` আর `logs` দুটোই আছে, কারণ web `items` পড়ে আর mobile `logs` পড়ে। Users list এখনো পুরোনো পদ্ধতিতে চলে (ধাপ 4)।

## ধাপ 2: Web login-এ সব transaction আনা বন্ধ ✅ শেষ

**যা হয়েছে:**

- `getReportAnalytics` এখন `totals` (direction ধরে inflow/outflow) আর `byAccount` পাঠায়। পুরোনো `TRANSFER` row আগের মতোই উৎসের outflow আর গন্তব্যের inflow ধরা হয়। Test: `backend/tests/project.test.js`।
- `FinanceContext`-এ আর `transactions` state নেই। Login-এ `all=true` চলে না। `monthCategorySpend` (এই মাসের category খরচ) আর `ledgerVersion` (transaction বদলালে বাড়ে) যোগ হয়েছে। Screen-গুলো `ledgerVersion` বদলালে আবার আনে।
- Budgets ও budget alert: `monthCategorySpend`। Dashboard: `/api/reports/summary` আর `/api/transactions?limit=50`। Accounts-এর বিস্তারিত: `accountId` দিয়ে paged, Load More সহ। Reports: একটাই `/api/reports/analytics` call।
- Edit/delete-এর পর balance `/api/accounts` থেকে আবার আনা হয়। Transfer delete-এর পর আগে balance বদলাত না, এখন বদলায়।
- Backup download (`exportData`) শুধু চাপলে `all=true` আনে, CSV export-এর মতো।
- `FinanceContext`-এর `value` এখন `useMemo`, action-গুলো `useStableActions` দিয়ে স্থির।
- আগে-পরে মিলানো: local JSON store-এ দুই account, তিন মাস, transfer সহ data দিয়ে Dashboard, Reports, Accounts-এর ৩০টা সংখ্যা আর তালিকা হুবহু মিলেছে।

**ইচ্ছা করে যা বদলেছে:**

- Budgets-এর "Spent to Date" আগে সব সময়ের খরচ দেখাত, এখন শুধু এই মাসের, যাতে মাসিক limit আর alert-এর সাথে মেলে।
- Category খালি থাকলে Reports-এ নাম আগে "Other Expenses" ছিল, এখন server-এর "Uncategorized"। নতুন transaction-এ category খালি থাকে না।
- Accounts-এর বিস্তারিত থেকে পুরোনো `TRANSFER` row-এর গন্তব্য-দিক বাদ পড়ে, কারণ server-এর `accountId` filter শুধু `account_id` দেখে। নতুন transfer `transfers` table-এ থাকে, তাই এখানে আগেও দেখা যেত না।
- Transfer করার পর Dashboard-এর Recent Transactions-এ আর নকল "Internal Transfer" row আসে না; আগে page reload করলেই ওটা চলে যেত।

**বাকি যাচাই:** Postgres mode-এর test CI-তে চলবে (এই PC-তে Docker নেই)। Live-এ login করে network tab-এ `all=true` নেই কিনা দেখা।

**কেন:** `FinanceContext.refreshData` login-এই `/api/transactions?all=true` আনে, কোনো সীমা ছাড়া। `ReportsView` আবার আলাদা করে আনে। সবচেয়ে বড় ডেটা খরচ এখানেই। এটা ঝুঁকির কাজও, কারণ অনেক screen এই list-এর উপর চলে।

**কে `transactions` ব্যবহার করে, আর কী দিয়ে বদলাবে:**

| জায়গা | এখন | বদলে |
|---|---|---|
| `DashboardView` | সময়কাল ধরে filter করে যোগ করে | `/api/reports/summary` আর `/api/transactions?limit=` |
| `BudgetsView` | এই মাসে category-র খরচ যোগ করে | `/api/reports/analytics`-এর `byCategory` (এই মাসের তারিখ দিয়ে) |
| `FinanceContext.recalculateBudgetAlerts` | একই হিসাব | একই `byCategory` |
| `AccountsView`-এর account বিস্তারিত | `accountId` দিয়ে filter করে | `/api/transactions?accountId=&limit=`, Load More সহ |
| `ReportsView` | `all=true` এনে যোগ করে | `byCategory` আর summary; account-এর হিসাবের জন্য নতুন aggregate দরকার |

**কীভাবে করবেন (এই ক্রমে):**

1. Backend: `getReportAnalytics`-এ account ধরে inflow ও outflow যোগ করুন, কারণ Reports-এর "Account Balances & Flows" table এখন list থেকে হিসাব করে। Test লিখুন।
2. একটা করে screen বদলান: Budgets, Dashboard, Accounts, তারপর Reports। প্রতিটার পর Chrome-এ দেখুন।
3. Transaction add, edit, delete, bulk save-এর পর এই নতুন data আবার আনার ব্যবস্থা করুন। `FinanceContext`-এর optimistic update-গুলো এখন `transactions` state বদলায়, ওগুলো সরাতে হবে।
4. সব screen বদলানোর পর `refreshData` থেকে `all=true` আর `transactions` state সরান।
5. `FinanceContext`-এর `value`-কে `useMemo` করুন, যাতে একটা পরিবর্তনে সব screen আবার render না হয়।

**সাবধান:**

- CSV export-এ (`TransactionsView.handleExportCSV`) `all=true` থাকবে, ওটা শুধু ব্যবহারকারী চাইলে চলে।
- হিসাবের ফল আগের সাথে হুবহু মিলতে হবে। আগে-পরে একই data-য় মোট টাকা মিলিয়ে দেখুন। Reports-এর category, Dashboard-এর সময়কাল, আর Budgets-এর এই-মাস নিয়ে বিশেষ নজর দিন।

**শেষ বোঝার উপায়:** Web login-এর network tab-এ `all=true` নেই, আর সব screen-এর সংখ্যা আগের সমান।

## ধাপ 3: Mobile ✅ শেষ

**যা হয়েছে:**

- Admin Users ও Logs এখন `usePagedQuery` আর `LoadMoreFooter` দিয়ে চলে। এই দুই endpoint `page` নেয় না, শুধু cursor নেয়, তাই `usePagedQuery`-তে `paging: 'cursor'` যোগ হয়েছে (আগের পরের পাতার `nextCursor` পাঠায়)।
- `validateLimit` এখন 5 আর 10-ও নেয়। Mobile Dashboard `limit=5`, web Dashboard `limit=10` আনে। পুরোনো APK 50 পাঠায়, সেটাও চলে।
- `AccountRow`, `LoanRow`, `TransactionRow`, `TransferRow` এখন `React.memo`, আর `onPress`-কে নিজের row দিয়ে ডাকে। Transactions, Expenses, Income, Loans, Accounts, Transfers screen একটা স্থির `renderRow` দেয়, সাথে `initialNumToRender={12}` আর `windowSize={7}`।
- যাচাই: mobile test 23/23, `expo export --platform android` পাস, lint-এ নতুন error নেই। Phone-এ scroll হাতে দেখা বাকি।

**সাবধান:** নতুন APK `limit=5` পাঠায়। Backend-এর এই বদল production-এ যাওয়ার আগে নতুন APK চালালে Dashboard-এর recent list 400 পাবে। `main`-এ একসাথে গেলে backend আগে deploy হয়, কারণ EAS build অনেক সময় নেয়।

1. **Admin Users ও Logs:** শুধু প্রথম পাতা আনে, Load More নেই, তাই ৫০-এর পরের data দেখা যায় না। `AdminUsersScreen` আর `AdminLogsScreen`-এ `useQuery` বদলে `usePagedQuery` আর `LoadMoreFooter` দিন। `usePagedQuery` `items` পড়ে, আর Users ও Logs দুটোই `items` পাঠায়।
2. **Dashboard:** ৫০টা আনে, দেখায় ৫টা। `DashboardScreen`-এ `limit` কমানো যায় না, কারণ `validateLimit` শুধু 50, 70, 100 নেয়। হয় এই নিয়মে ছোট limit যোগ করুন (যেমন 5), নয়তো আলাদা "recent" endpoint দিন।
3. **List-এর গতি:** `TransactionRow`, `TransferRow`-এর মতো row-গুলোতে `React.memo` দিন, আর লম্বা `FlatList`-এ `windowSize` ও `initialNumToRender` ঠিক করুন।

**শেষ বোঝার উপায়:** ৫০-এর বেশি user ও log থাকলে mobile admin থেকে সব দেখা যায়। Phone-এ list scroll মসৃণ হয়।

## ধাপ 4: Backend-এর ছোট কাজ 🟡

**যা হয়েছে:**

- 1: Accounts আর Categories-এর `paginate=true` এখন `validateLimit` ব্যবহার করে, ভুল limit-এ 400 দেয়। `page=abc` আর `NaN` হয় না।
- 2: `getPaginatedUsers` Postgres-এ `queryPage` দিয়ে চলে (`USER_SELECT`, `userFilters`)। Role, status, search SQL-এ। Password hash কখনো select হয় না।
- Test: `backend/tests/pagination.test.js`-এ admin users cursor paging, filter, 403, আর accounts/categories limit।

**যা বাকি, কেন:**

- 3 (Project paging): plan অনুযায়ী জরুরি নয়।
- 4 (`pg_trgm`): ৫০,০০০ row-এ এখন 42 ms। Data বাড়লে, আর Neon-এ extension চলে কি না দেখে করুন।
- 5 (Audit log মেয়াদ): মালিক কত দিন রাখবেন বললে করা হবে।

1. **Limit যাচাই:** `account.controller.js` আর `category.controller.js`-এ `Number(req.query.limit) || 50` আছে, মানে যেকোনো সংখ্যা চলে। `validateLimit` দিন।
2. **Users list:** `getPaginatedUsers` এখনো সব এনে কাটে। `queryPage` ব্যবহার করুন।
3. **Project list:** Web ও mobile-এ paging নেই। সংখ্যা কম হয়, তাই জরুরি নয়।
4. **Search:** `LOWER(...) LIKE '%x%'`-এ index কাজ করে না। `pg_trgm` extension আর GIN index দিন। ৫০,০০০ row-এ এখন 42 ms, তাই data বাড়লে করুন। Neon-এ extension চালু করা যায় কি না আগে দেখুন।
5. **Audit log-এর মেয়াদ:** পুরোনো log মোছার নিয়ম নেই, table শুধু বাড়ে। কত দিন রাখবেন, সেটা মালিকের সিদ্ধান্ত।

## ধাপ 5: Test ও CI

1. **Vercel-এ test ছাড়াই deploy:** `.github/workflows/ci.yml`-এ `branches-ignore: [main]`, তাই `main`-এ CI চলে না। Backend deploy নিজে test চালায়, কিন্তু web আর mobile build চালায় না। `main`-এও CI চালান, আর mobile build-এর আগে lint দিন।
2. **Frontend test নেই:** Playwright দিয়ে browser test repo-তে যোগ করুন। এখনকার Chrome test-গুলো এক PC-র temp ফোল্ডারে আছে, repo-তে নেই, তাই আবার লিখতে হবে। ঢাকতে হবে: login, bulk expense, reports, projects, পাতা বদল।

## ধাপ 6: Structure

ধীরে ধীরে করুন, একবারে একটা, আর আচরণ না বদলে।

1. `db.service.js` (৩,০০০+ লাইন) ভাগ করুন: account, transaction, transfer, loan, admin আলাদা ফাইলে।
2. বড় view ভাগ করুন: `AdminView`, `ExpensesView`, `ActionModals`, `FinanceContext`।
3. **Schema দুই জায়গায়:** চলার সময় `CREATE TABLE` চলে, আবার `backend/prisma`-তেও schema আছে, অথচ `src`-এ Prisma ব্যবহার হয় না। একটা রাখুন। Prisma সরালে `package.json`-এর dependency-ও সরান।
4. **দুই রকম paging:** Web cursor, mobile page। ধাপ 1-এর পর দুটোই আসল SQL-এ চলে। একটায় আনুন।
5. **Web-এ দুই রকম API call:** `AdminView` সরাসরি `fetch` করে, বাকিরা `authFetch`। একটায় আনুন।
6. **Git-এ APK:** `frontend/public/AccountLedger-release.apk` (21 MB) git-এ আছে। Download link Expo বা Releases-এ নিন।
7. **Web bundle:** মূল JS 410 KB। Vite-এ `manualChunks` দিন।
8. **Type:** Frontend-এ `any` কমান।

## মালিকের নিজের কাজ

এগুলো code দিয়ে হয় না।

- [ ] Live web-এ login করে Transactions, Transfers, Loans-এর পরের পাতা দেখা।
- [ ] Live web-এ project খুলে Export PDF চালানো।
- [ ] নতুন APK install করে দেখা form-এ লেখার সময় keyboard ঘর ঢাকে কি না।
- [ ] APK ঠিক থাকলে Landing page-এর APK বদলানোর কথা জানানো।
- [ ] Admin password বদলানো।
- [ ] Production-এ পুরোনো `user@example.com` আর দ্বিতীয় admin সরানো, audit log দেখা। Claude Code-এ production database পড়া আটকানো আছে; চাইলে permission দিতে হবে, আর মোছার আগে তালিকা দেখে আলাদা সম্মতি দিতে হবে।

## কাজের সময় যা মনে রাখবেন

**Database ও test**

- Test বা test data কখনো Neon-এ নয়। `backend/.env`-এ production-এর database আছে।
- `npm test` (`backend/`) নিজে JSON store-এ চলে। Postgres-এর test-এর জন্য `TEST_DATABASE_URL` দিন:

  ```bash
  docker run --rm -d -p 55432:5432 -e POSTGRES_PASSWORD=password -e POSTGRES_DB=accountledger_test postgres:16
  TEST_DATABASE_URL=postgresql://postgres:password@localhost:55432/accountledger_test npm test
  ```

- JSON store আর Postgres দুই mode-এই test পাস হতে হবে।
- App চালিয়ে দেখার সময় backend-কে আলাদা port-এ throwaway `DATABASE_URL` দিয়ে চালান। Local `.env` দিয়ে চালানো backend Neon-এ যায়।

**API-র নিয়ম**

- Play Store-এর বাইরে দেওয়া পুরোনো APK-ও এই API ব্যবহার করে। Field সরানোর আগে পুরোনো mobile code মিলিয়ে নিন।
- Backend-এ নতুন npm package সাবধানে যোগ করুন। cPanel-এ install সব সময় হয় না, আর হলে server বন্ধ হতে পারে।

**Git ও deploy**

- `backend/**` `main`-এ গেলে production-এ deploy হয়, `mobile/**` গেলে EAS build শুরু হয়, frontend Vercel-এ যায়।
- `.cph/` মালিকের নিজের ফোল্ডার, commit করবেন না। `.env`-ও নয়।
- Windows-এ Git Bash থেকে push আটকালে: `export GIT_SSH_COMMAND="C:/Windows/System32/OpenSSH/ssh.exe"`।
- "Build Mobile App" সবুজ হওয়া মানে শুধু Expo-তে পাঠানো হয়েছে (`--no-wait`)। APK হয়েছে কি না Expo-তে দেখতে হয়।
