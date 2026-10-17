# AccountLedger Mobile App

Production-ready native mobile application for **AccountLedger.com** (`hisabflow`), built with React Native and Expo (SDK 58).

---

## 🚀 Features

- **100% Feature Parity with Web**:
  - **Authentication**: Email/Password Login, Registration, 6-digit Email Verification, Forgot/Reset Password, Google Sign-in integration, Secure Token Restoration.
  - **Dashboard**: Real-time Total Balance, Income, Expenses, Cash Balance, Recent Transactions, and Quick Actions.
  - **Account Management**: List, Create, Update, Delete accounts, Bank/Cash/Mobile Banking types, Opening balance, Authoritative balances.
  - **Income & Expense**: Individual Income/Expense logging, Bulk Expense entry, Category & Subcategory selection, Payment account deduction.
  - **Transfers**: Inter-account balance transfers with atomic backend updates and transfer history.
  - **Lending & Borrowing (Debt Book)**: Track money lent/borrowed, person details, due dates, partial/full repayments.
  - **Unified Transactions**: Full transaction history with search, date-range filters, category filters, and detailed views.
  - **Budgets & Categories**: Custom categories with subcategories, monthly category budgets with progress tracking.
  - **Reports & Analytics**: Income vs Expense summaries, category-wise breakdowns, date-range exports.
  - **Profile & Settings**: Security settings, password change, profile update, cache clearing, secure logout.
  - **Admin Control**: System admin dashboard, user management, audit logs, and system settings.

- **Mobile Architecture**:
  - **JavaScript Only** (Zero TypeScript).
  - **TanStack Query (v5)** for resilient caching, background refetching, and automatic cache invalidation.
  - **Platform-Secure Storage** via `expo-secure-store` for bearer auth tokens.
  - **Restrained Dark Theme** matching AccountLedger.com web design with custom StyleSheet tokens.
  - **Standard Date Format**: Consistent `DD/MM/YYYY` formatting across all screens.
  - **Zero-balance Defaults**: Genuine empty states with no fake demo numbers.

---

## 🛠️ Tech Stack

- **Framework**: React Native 0.88, Expo SDK 58
- **Language**: JavaScript (ES6+)
- **Navigation**: React Navigation 7 (Native Stack + Bottom Tabs)
- **State & Caching**: TanStack Query (React Query v5)
- **Forms & Validation**: React Hook Form + Zod
- **Storage**: Expo SecureStore
- **Icons**: Expo Vector Icons (Feather, Ionicons)

---

## 📱 Getting Started

### 1. Prerequisites
- Node.js 18+
- Expo CLI (`npx expo`)
- Android Studio / Android Emulator or Expo Go app on a physical device

### 2. Configure Backend URL
Copy `.env.example` to `.env` (or configure via `src/constants/config.js`):
```bash
# Android Emulator (default host mapping)
EXPO_PUBLIC_API_URL=http://10.0.2.2:5001/api

# Physical Device on same Wi-Fi
# EXPO_PUBLIC_API_URL=http://<YOUR_LOCAL_IP>:5001/api

# Production
# EXPO_PUBLIC_API_URL=https://api.accountledger.com/api
```

### 3. Start Development Server
```bash
npm start
```
- Press `a` to launch on Android Emulator.
- Press `i` to launch on iOS Simulator.
- Scan QR code with Expo Go on your mobile device.

---

## 📦 Production Builds (EAS)

The project includes pre-configured `eas.json` and `app.json`:

### Generate Android APK for Testing
```bash
npx eas-cli build -p android --profile preview
```

### Generate Production Android AAB (Google Play)
```bash
npx eas-cli build -p android --profile production
```

### Generate Production iOS IPA (App Store)
```bash
npx eas-cli build -p ios --profile production
```
