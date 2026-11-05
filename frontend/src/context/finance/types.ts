import type React from 'react';
import { Account, Transaction, Loan, LoanRepayment, Category } from '../../mock/data';
import type { DataStatus } from '../../components/common/StateViews';

export interface CategoryBudget {
  categoryName: string;
  monthlyLimit: number;
}

export interface BudgetAlert {
  categoryName: string;
  spent: number;
  limit: number;
  exceededBy: number;
  percentage: number;
  status: 'EXCEEDED' | 'WARNING';
}

export interface FinanceContextType {
  accounts: Account[];
  loans: Loan[];
  repayments: LoanRepayment[];
  categories: Category[];
  budgets: CategoryBudget[];
  budgetAlerts: BudgetAlert[];
  // Expense per category name in the current calendar month, summed by the server.
  monthCategorySpend: Record<string, number>;
  // Goes up whenever transactions may have changed, so screens that read them from the server refetch.
  ledgerVersion: number;
  isLoading: boolean;
  dataStatus: DataStatus;
  refreshData: () => Promise<void>;
  
  // Actions
  addAccount: (account: Omit<Account, 'id' | 'updatedAt'>) => Promise<{ success: boolean; account?: Account; error?: string }>;
  editAccount: (id: string, updates: Partial<Account>) => Promise<{ success: boolean; account?: Account; error?: string }>;
  toggleArchiveAccount: (id: string) => Promise<{ success: boolean; account?: Account; error?: string }>;
  deleteAccount: (id: string) => Promise<{ success: boolean; error?: string }>;
  addIncome: (income: {
    accountId: string;
    categoryId?: string;
    category?: string;
    subcategory?: string;
    amount: number;
    date: string;
    description: string;
    reference?: string;
  }) => Promise<{ success: boolean; transaction?: Transaction; error?: string }>;
  addExpense: (expense: {
    accountId: string;
    category: string;
    subcategory?: string;
    amount: number;
    date: string;
    description: string;
    reference?: string;
  }) => Promise<{ success: boolean; transaction?: Transaction; error?: string; overBudgetAlert?: BudgetAlert }>;
  addBulkExpenses: (bulk: {
    accountId: string;
    date: string;
    batchId?: string;
    items: { category: string; desc?: string; description?: string; amount: number; subcategory?: string }[];
  }) => Promise<{ success: boolean; error?: string; overBudgetAlerts?: BudgetAlert[] }>;
  deleteTransaction: (id: string) => Promise<{ success: boolean; error?: string }>;
  editTransaction: (id: string, updates: Partial<Transaction>) => Promise<{ success: boolean; transaction?: Transaction; error?: string }>;
  addTransfer: (transfer: {
    sourceAccountId: string;
    destinationAccountId: string;
    amount: number;
    transferFee?: number;
    description?: string;
    reference?: string;
    date?: string;
  }) => Promise<{ success: boolean; transfer?: { id: string; date?: string }; error?: string }>;
  deleteTransfer: (id: string) => Promise<{ success: boolean; error?: string }>;
  addLoan: (loan: {
    type: 'LENT' | 'BORROWED';
    counterpartyName: string;
    counterpartyContact?: string;
    principalAmount: number;
    accountId: string;
    startDate: string;
    dueDate?: string;
    notes?: string;
    interestRate?: number;
  }) => Promise<{ success: boolean; loan?: Loan; error?: string }>;
  deleteLoan: (id: string) => Promise<{ success: boolean; error?: string }>;
  recordRepayment: (repayment: {
    loanId: string;
    accountId: string;
    amount: number;
    date: string;
    notes?: string;
  }) => Promise<{ success: boolean; repayment?: LoanRepayment; error?: string }>;
  addCategory: (category: Omit<Category, 'id'>) => Promise<{ success: boolean; category?: Category; error?: string }>;
  editCategory: (id: string, updates: Partial<Category>) => Promise<{ success: boolean; category?: Category; error?: string }>;
  addSubcategory: (categoryId: string, subcategoryName: string) => Promise<{ success: boolean; subcategories?: string[]; error?: string }>;
  toggleArchiveCategory: (id: string) => Promise<{ success: boolean; category?: Category; error?: string }>;
  deleteCategory: (id: string) => Promise<{ success: boolean; error?: string }>;
  setCategoryBudget: (categoryName: string, monthlyLimit: number) => void;
  deleteBudget: (categoryName: string) => void;
  resetToDefaults: () => void;
  exportData: () => Promise<string>;
  importData: (jsonData: BackupFile) => boolean;
  authFetch: (url: string, options?: RequestInit) => Promise<Response>;
}

// A restored backup file. Every part is optional because the file comes from the user.
export interface BackupFile {
  data?: {
    accounts?: Account[];
    loans?: Loan[];
    categories?: Category[];
  };
}

// What the action files in this folder need from the provider.
export interface FinanceActionContext {
  accounts: Account[];
  loans: Loan[];
  repayments: LoanRepayment[];
  categories: Category[];
  budgets: CategoryBudget[];
  setAccounts: React.Dispatch<React.SetStateAction<Account[]>>;
  setLoans: React.Dispatch<React.SetStateAction<Loan[]>>;
  setRepayments: React.Dispatch<React.SetStateAction<LoanRepayment[]>>;
  setCategories: React.Dispatch<React.SetStateAction<Category[]>>;
  setBudgets: React.Dispatch<React.SetStateAction<CategoryBudget[]>>;
  bumpLedger: () => void;
  authFetch: (url: string, options?: RequestInit) => Promise<Response>;
  refreshData: () => Promise<void>;
  refreshAccounts: () => Promise<void>;
  refreshBudgetSpend: (currentBudgets?: CategoryBudget[]) => Promise<Record<string, number> | null>;
  recalculateBudgetAlerts: (currentBudgets: CategoryBudget[], categorySpending: Record<string, number>) => void;
  monthCategorySpend: Record<string, number>;
}
