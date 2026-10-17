// HisabFlow Data Models & Types
// Production Schema (No Mock Financial Records)

export interface Account {
  id: string;
  name: string;
  type: 'CASH' | 'BANK' | 'MOBILE_BANKING';
  providerName?: string;
  accountNumber?: string;
  currentBalance: number;
  openingBalance: number;
  currency: string;
  status: 'ACTIVE' | 'ARCHIVED';
  updatedAt: string;
}

export interface Category {
  id: string;
  name: string;
  type: 'INCOME' | 'EXPENSE';
  icon: string;
  color: string;
  subcategories: string[];
  parentId?: string | null;
  isArchived?: boolean;
}

export interface Transaction {
  id: string;
  date: string;
  type: 'INCOME' | 'EXPENSE' | 'TRANSFER' | 'LOAN_LENT' | 'LOAN_BORROWED' | 'LOAN_REPAYMENT';
  category?: string;
  subcategory?: string;
  accountId: string;
  accountName: string;
  destinationAccountId?: string;
  destinationAccountName?: string;
  amount: number;
  direction: 'INFLOW' | 'OUTFLOW' | 'NEUTRAL';
  description: string;
  reference?: string;
  counterparty?: string;
  status: 'COMPLETED' | 'PENDING';
  createdAt?: string;
}

export interface Loan {
  id: string;
  type: 'LENT' | 'BORROWED'; // LENT = Receivable, BORROWED = Payable
  counterpartyName: string;
  counterpartyContact?: string;
  principalAmount: number;
  outstandingPrincipal: number;
  interestRate: number;
  startDate: string;
  dueDate?: string;
  status: 'ACTIVE' | 'PARTIALLY_REPAID' | 'SETTLED';
  accountId: string;
  accountName: string;
  notes?: string;
}

export interface LoanRepayment {
  id: string;
  loanId: string;
  counterpartyName: string;
  loanType: 'LENT' | 'BORROWED';
  amount: number;
  date: string;
  accountName: string;
  notes?: string;
}

// Clean Slate: No Demo Financial Records
export const MOCK_ACCOUNTS: Account[] = [];
export const MOCK_TRANSACTIONS: Transaction[] = [];
export const MOCK_LOANS: Loan[] = [];
export const MOCK_REPAYMENTS: LoanRepayment[] = [];
export const MOCK_CATEGORIES: Category[] = [];
