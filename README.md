# HisabFlow — Personal Accounting Ledger & Money Manager

HisabFlow is a modern, production-grade personal financial accounting engine designed for tracking income, expenses, accounts, transfers, and loans in BDT. The application is cleanly structured into two independent services: a frontend Single Page Application (`frontend/`) and a dedicated Express.js REST API service with PostgreSQL & Prisma (`backend/`).

---

## 1. Project Architecture

```text
HisabFlow/
├── frontend/
│   ├── public/
│   ├── src/
│   │   ├── app/
│   │   ├── components/
│   │   ├── context/
│   │   ├── hooks/
│   │   ├── lib/
│   │   ├── services/
│   │   ├── styles/
│   │   ├── types/
│   │   ├── App.tsx
│   │   └── main.tsx
│   ├── .env.example
│   ├── .gitignore
│   ├── index.html
│   ├── package.json
│   ├── tsconfig.json
│   └── vite.config.js
│
├── backend/
│   ├── src/
│   │   ├── config/
│   │   ├── controllers/
│   │   ├── middleware/
│   │   ├── routes/
│   │   ├── services/
│   │   ├── utils/
│   │   ├── validators/
│   │   └── app.js
│   ├── prisma/
│   │   ├── schema.prisma
│   │   └── seed.js
│   ├── tests/
│   │   ├── api.test.js
│   │   ├── auth.test.js
│   │   └── cursor.test.js
│   ├── data/
│   │   └── hisabflow_db.json
│   ├── .env.example
│   ├── .gitignore
│   ├── package.json
│   └── server.js
│
├── README.md
├── .gitignore
└── package.json
```

---

## 2. Security & Role Architecture

- **`SYSTEM_ADMIN`**:
  - Manages the software, user activation/deactivation, password resets, system configuration, and audit logs.
  - **Invariant:** System administrators do not have personal financial accounts and cannot access, view, modify, or delete any user's private financial records.
- **`USER`**:
  - Owns and manages their personal accounts, income, expenses, transfers, loans, repayments, and budget limits.
  - All records are strictly scoped to the authenticated `userId`.

---

## 3. Getting Started

### Prerequisites
- Node.js (v18+ or v20+)
- npm (v9+)
- PostgreSQL (optional: if omitted, the backend runs in resilient Local Persistent JSON mode)

---

### Backend Setup (`backend/`)

1. **Navigate to the backend directory:**
   ```bash
   cd backend
   ```

2. **Configure environment variables:**
   ```bash
   copy .env.example .env
   ```
   *(Update `DATABASE_URL` and `JWT_SECRET` as needed.)*

3. **Install dependencies:**
   ```bash
   npm install
   ```

4. **Run database migrations & Prisma client generation:**
   ```bash
   npm run prisma:generate
   ```

5. **Seed initial system state (safe & idempotent):**
   ```bash
   npm run seed
   ```

6. **Run backend test suite:**
   ```bash
   npm test
   ```

7. **Start Express API server (port 5001):**
   ```bash
   npm run dev
   ```

---

### Frontend Setup (`frontend/`)

1. **Navigate to the frontend directory:**
   ```bash
   cd frontend
   ```

2. **Configure environment variables:**
   ```bash
   copy .env.example .env
   ```
   *(Ensure `NEXT_PUBLIC_API_URL=http://localhost:5001/api` is configured.)*

3. **Install dependencies:**
   ```bash
   npm install
   ```

4. **Start Vite development server (port 5000):**
   ```bash
   npm run dev
   ```

5. **Build for production:**
   ```bash
   npm run build
   ```

---

## 4. Root Convenience Scripts

From the repository root, you can manage both services:

- `npm run dev:backend` — Starts the Express backend on port 5001
- `npm run dev:frontend` — Starts the frontend on port 5000
- `npm run test:backend` — Executes backend test suite
- `npm run build:frontend` — Creates production bundle in `frontend/dist/`
