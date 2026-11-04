import React, { createContext, useContext, useState, useEffect, useCallback, useLayoutEffect, useMemo, useRef } from 'react';
import {
  Account,
  Transaction,
  Loan,
  LoanRepayment,
  Category,
} from '../mock/data';
import { useAuth } from './AuthContext';
import { API_BASE_URL, parseResponseJson } from '../services/api';
import type { DataStatus } from '../components/common/StateViews';
import { sortTransactions } from '../lib/sorting';

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

interface FinanceContextType {
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
  }) => Promise<{ success: boolean; transfer?: any; error?: string }>;
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
  importData: (jsonData: any) => boolean;
  authFetch: (url: string, options?: RequestInit) => Promise<Response>;
}

const FinanceContext = createContext<FinanceContextType | undefined>(undefined);

const pad2 = (n: number) => String(n).padStart(2, '0');

// The current month in the user's local calendar, as the server's date filter expects it.
const currentMonthRange = () => {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;
  const lastDay = new Date(year, month, 0).getDate();
  return {
    startDate: `${year}-${pad2(month)}-01`,
    endDate: `${year}-${pad2(month)}-${pad2(lastDay)}`,
  };
};

export const FinanceProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, token } = useAuth();

  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loans, setLoans] = useState<Loan[]>([]);
  const [repayments, setRepayments] = useState<LoanRepayment[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [budgets, setBudgets] = useState<CategoryBudget[]>([]);
  const [budgetAlerts, setBudgetAlerts] = useState<BudgetAlert[]>([]);
  const [monthCategorySpend, setMonthCategorySpend] = useState<Record<string, number>>({});
  const [ledgerVersion, setLedgerVersion] = useState(0);
  const bumpLedger = useCallback(() => setLedgerVersion((v) => v + 1), []);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  // Stays 'ready' during later refreshes, so existing figures do not flash back to a skeleton.
  const [hasLoadedData, setHasLoadedData] = useState<boolean>(false);
  const [dataLoadFailed, setDataLoadFailed] = useState<boolean>(false);
  const dataStatus: DataStatus = hasLoadedData ? 'ready' : dataLoadFailed ? 'error' : 'loading';

  // Auth fetch helper
  const authFetch = useCallback(
    async (url: string, options: RequestInit = {}) => {
      const fullUrl = url.startsWith('http')
        ? url
        : url.startsWith('/api')
          ? `${API_BASE_URL}${url.slice(4)}`
          : `${API_BASE_URL}${url.startsWith('/') ? '' : '/'}${url}`;
      const headers = new Headers(options.headers || {});
      if (token) {
        headers.set('Authorization', `Bearer ${token}`);
      }
      const res = await fetch(fullUrl, { ...options, headers });
      res.json = () => parseResponseJson(res);
      return res;
    },
    [token]
  );

  // Recalculate budget warnings
  const recalculateBudgetAlerts = useCallback(
    (currentBudgets: CategoryBudget[], categorySpending: Record<string, number>) => {
      const alerts: BudgetAlert[] = [];
      currentBudgets.forEach(b => {
        const spent = categorySpending[b.categoryName] || 0;
        const percentage = b.monthlyLimit > 0 ? (spent / b.monthlyLimit) * 100 : 0;

        if (spent > b.monthlyLimit) {
          alerts.push({
            categoryName: b.categoryName,
            spent,
            limit: b.monthlyLimit,
            exceededBy: spent - b.monthlyLimit,
            percentage,
            status: 'EXCEEDED',
          });
        } else if (percentage >= 85) {
          alerts.push({
            categoryName: b.categoryName,
            spent,
            limit: b.monthlyLimit,
            exceededBy: 0,
            percentage,
            status: 'WARNING',
          });
        }
      });

      setBudgetAlerts(alerts);
    },
    []
  );

  // Returns null when the server could not be reached, leaving the last known figures in place.
  const fetchMonthCategorySpend = useCallback(async (): Promise<Record<string, number> | null> => {
    const { startDate, endDate } = currentMonthRange();
    const res = await authFetch(`/api/reports/analytics?startDate=${startDate}&endDate=${endDate}`);
    if (!res.ok) return null;
    const data = await res.json();
    const spend: Record<string, number> = {};
    for (const row of data.byCategory || []) spend[row.name] = Number(row.amount);
    setMonthCategorySpend(spend);
    return spend;
  }, [authFetch]);

  // After an expense changes, reload this month's spend and the alerts that depend on it.
  const refreshBudgetSpend = async (currentBudgets: CategoryBudget[] = budgets) => {
    try {
      const spend = await fetchMonthCategorySpend();
      if (spend) recalculateBudgetAlerts(currentBudgets, spend);
      return spend;
    } catch (err) {
      console.error('[FinanceContext] Error refreshing budget spend:', err);
      return null;
    }
  };

  // Refresh all state from REST API
  const refreshData = useCallback(async () => {
    if (!token || !user || user.role === 'ADMIN') {
      setAccounts([]);
      setLoans([]);
      setRepayments([]);
      setCategories([]);
      setBudgets([]);
      setBudgetAlerts([]);
      setMonthCategorySpend({});
      setHasLoadedData(false);
      setDataLoadFailed(false);
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      setDataLoadFailed(false);
      // Transactions are not loaded here: each screen asks the server for the page or totals it shows.
      const [accRes, loanRes, catRes, bgtRes, fetchedSpend] = await Promise.all([
        authFetch('/api/accounts'),
        authFetch('/api/loans?all=true'),
        authFetch('/api/categories'),
        authFetch('/api/budgets'),
        fetchMonthCategorySpend(),
      ]);

      let fetchedBudgets: CategoryBudget[] = [];

      if (accRes.ok) {
        const data = await accRes.json();
        setAccounts(data.accounts || []);
      }

      if (loanRes.ok) {
        const data = await loanRes.json();
        setLoans(data.loans || []);
        setRepayments(data.repayments || []);
      }

      if (catRes.ok) {
        const data = await catRes.json();
        setCategories(data.categories || []);
      }

      if (bgtRes.ok) {
        const data = await bgtRes.json();
        fetchedBudgets = (data.budgets || []).map((b: any) => ({
          categoryName: b.categoryName,
          monthlyLimit: Number(b.monthlyLimit),
        }));
        setBudgets(fetchedBudgets);
      }

      recalculateBudgetAlerts(fetchedBudgets, fetchedSpend || {});

      if ([accRes, loanRes, catRes, bgtRes].every((res) => res.ok) && fetchedSpend) {
        setHasLoadedData(true);
      } else {
        setDataLoadFailed(true);
      }
    } catch (err) {
      console.error('[FinanceContext] Error fetching financial data:', err);
      setDataLoadFailed(true);
    } finally {
      setIsLoading(false);
      bumpLedger();
    }
  }, [token, user, authFetch, recalculateBudgetAlerts, fetchMonthCategorySpend, bumpLedger]);

  // Load data when user/token changes
  useEffect(() => {
    refreshData();
  }, [refreshData]);

  // Balances after an edit or delete come from the server, since the old row is no longer held here.
  const refreshAccounts = async () => {
    try {
      const res = await authFetch('/api/accounts');
      if (!res.ok) return;
      const data = await res.json();
      setAccounts(data.accounts || []);
    } catch (err) {
      console.error('[FinanceContext] Error refreshing accounts:', err);
    }
  };

  // ACCOUNTS
  const addAccount = async (newAcc: Omit<Account, 'id' | 'updatedAt'>): Promise<{ success: boolean; account?: Account; error?: string }> => {
    try {
      const res = await authFetch('/api/accounts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newAcc),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        return { success: false, error: data.error || 'Failed to create account.' };
      }
      setAccounts((prev) => [data.account, ...prev]);
      return { success: true, account: data.account };
    } catch (err: any) {
      console.error('Error adding account:', err);
      return { success: false, error: err.message || 'Error creating account' };
    }
  };

  const editAccount = async (id: string, updates: Partial<Account>): Promise<{ success: boolean; account?: Account; error?: string }> => {
    try {
      const res = await authFetch(`/api/accounts/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        return { success: false, error: data.error || 'Failed to update account.' };
      }
      setAccounts((prev) => prev.map((a) => (a.id === id ? { ...a, ...data.account } : a)));
      return { success: true, account: data.account };
    } catch (err: any) {
      console.error('Error updating account:', err);
      return { success: false, error: err.message || 'Error updating account' };
    }
  };

  const toggleArchiveAccount = async (id: string): Promise<{ success: boolean; account?: Account; error?: string }> => {
    try {
      const res = await authFetch(`/api/accounts/${id}/archive`, { method: 'PATCH' });
      const data = await res.json();
      if (!res.ok || !data.success) {
        return { success: false, error: data.error || 'Failed to archive account.' };
      }
      setAccounts((prev) => prev.map((a) => (a.id === id ? { ...a, ...data.account } : a)));
      return { success: true, account: data.account };
    } catch (err: any) {
      console.error('Error archiving account:', err);
      return { success: false, error: err.message || 'Error archiving account' };
    }
  };

  // The server refuses to delete an account that has history, with a message saying why.
  const deleteAccount = async (id: string): Promise<{ success: boolean; error?: string }> => {
    try {
      const res = await authFetch(`/api/accounts/${id}`, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok || !data.success) {
        return { success: false, error: data.error || 'Failed to delete account.' };
      }
      setAccounts((prev) => prev.filter((a) => a.id !== id));
      return { success: true };
    } catch (err: any) {
      console.error('Error deleting account:', err);
      return { success: false, error: err.message || 'Error deleting account' };
    }
  };

  // INCOME
  const addIncome = async (income: {
    accountId: string;
    categoryId?: string;
    category?: string;
    subcategory?: string;
    amount: number;
    date: string;
    description: string;
    reference?: string;
  }): Promise<{ success: boolean; transaction?: Transaction; error?: string }> => {
    try {
      const res = await authFetch('/api/transactions/income', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(income),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        return { success: false, error: data.error || 'Failed to record income.' };
      }
      const createdTx: Transaction = data.transaction;
      setAccounts((prev) =>
        prev.map((a) =>
          a.id === income.accountId ? { ...a, currentBalance: a.currentBalance + income.amount, updatedAt: 'Just now' } : a
        )
      );
      bumpLedger();
      return { success: true, transaction: createdTx };
    } catch (err: any) {
      console.error('Error recording income:', err);
      return { success: false, error: err.message || 'Error recording income' };
    }
  };

  // EXPENSE
  const addExpense = async (expense: {
    accountId: string;
    category: string;
    subcategory?: string;
    amount: number;
    date: string;
    description: string;
    reference?: string;
  }): Promise<{ success: boolean; transaction?: Transaction; error?: string; overBudgetAlert?: BudgetAlert }> => {
    try {
      const res = await authFetch('/api/transactions/expense', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(expense),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        return { success: false, error: data.error || 'Failed to record expense.' };
      }
      const createdTx: Transaction = data.transaction;
      setAccounts((prev) =>
        prev.map((a) =>
          a.id === expense.accountId ? { ...a, currentBalance: a.currentBalance - expense.amount, updatedAt: 'Just now' } : a
        )
      );
      bumpLedger();
      const spend = await refreshBudgetSpend();

      const targetBudget = budgets.find((b) => b.categoryName === expense.category);
      let alert: BudgetAlert | undefined = undefined;
      if (targetBudget && spend) {
        const monthSpent = spend[expense.category] || 0;

        if (monthSpent > targetBudget.monthlyLimit) {
          alert = {
            categoryName: targetBudget.categoryName,
            spent: monthSpent,
            limit: targetBudget.monthlyLimit,
            exceededBy: monthSpent - targetBudget.monthlyLimit,
            percentage: (monthSpent / targetBudget.monthlyLimit) * 100,
            status: 'EXCEEDED',
          };
        }
      }

      return { success: true, transaction: createdTx, overBudgetAlert: alert };
    } catch (err: any) {
      console.error('Error recording expense:', err);
      return { success: false, error: err.message || 'Error recording expense' };
    }
  };

  // BULK EXPENSES
  const addBulkExpenses = async (bulk: {
    accountId: string;
    date: string;
    batchId?: string;
    items: { category: string; desc?: string; description?: string; amount: number; subcategory?: string }[];
  }): Promise<{ success: boolean; error?: string; overBudgetAlerts?: BudgetAlert[] }> => {
    const normalizedItems = bulk.items.map(item => ({
      ...item,
      desc: (item.desc || item.description || '').trim(),
      description: (item.description || item.desc || '').trim(),
    }));

    const total = normalizedItems.reduce((sum, item) => sum + item.amount, 0);
    setAccounts(prev =>
      prev.map(a =>
        a.id === bulk.accountId
          ? { ...a, currentBalance: a.currentBalance - total, updatedAt: 'Just now' }
          : a
      )
    );

    try {
      const res = await authFetch('/api/transactions/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          accountId: bulk.accountId,
          date: bulk.date,
          items: normalizedItems,
          batchId: bulk.batchId,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.success) {
        await refreshData();
        return { success: false, error: data.error || 'Failed to record bulk expenses.' };
      }
      bumpLedger();
      await refreshBudgetSpend();
      return { success: true };
    } catch (err) {
      console.error('Error saving bulk expenses:', err);
      await refreshData();
      return { success: false, error: err.message || 'Error saving bulk expenses' };
    }
  };

  // TRANSACTIONS
  const deleteTransaction = async (id: string): Promise<{ success: boolean; error?: string }> => {
    try {
      const res = await authFetch(`/api/transactions/${id}`, { method: 'DELETE' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.success) {
        return { success: false, error: data.error || 'Failed to delete transaction.' };
      }
      bumpLedger();
      await Promise.all([refreshAccounts(), refreshBudgetSpend()]);
      return { success: true };
    } catch (err: any) {
      console.error('Error deleting transaction:', err);
      return { success: false, error: err.message || 'Error deleting transaction' };
    }
  };

  const editTransaction = async (
    id: string,
    updates: Partial<Transaction>
  ): Promise<{ success: boolean; transaction?: Transaction; error?: string }> => {
    try {
      const res = await authFetch(`/api/transactions/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        return { success: false, error: data.error || 'Failed to update transaction.' };
      }

      const updated: Transaction = data.transaction;
      bumpLedger();
      await Promise.all([refreshAccounts(), refreshBudgetSpend()]);
      return { success: true, transaction: updated };
    } catch (err: any) {
      console.error('Error editing transaction:', err);
      return { success: false, error: err.message || 'Error updating transaction' };
    }
  };

  // TRANSFERS
  const addTransfer = async (transfer: {
    sourceAccountId: string;
    destinationAccountId: string;
    amount: number;
    transferFee?: number;
    description?: string;
    reference?: string;
    date?: string;
  }): Promise<{ success: boolean; transfer?: any; error?: string }> => {
    if (transfer.sourceAccountId === transfer.destinationAccountId) {
      return { success: false, error: 'Source and destination accounts must be different.' };
    }

    const src = accounts.find((a) => a.id === transfer.sourceAccountId);
    const dst = accounts.find((a) => a.id === transfer.destinationAccountId);
    if (!src || !dst) {
      return { success: false, error: 'Invalid accounts selected.' };
    }

    try {
      const res = await authFetch('/api/transfers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(transfer),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        return { success: false, error: data.error || 'Failed to record transfer.' };
      }

      const fee = transfer.transferFee || 0;
      setAccounts((prev) =>
        prev.map((a) => {
          if (a.id === transfer.sourceAccountId) {
            return { ...a, currentBalance: a.currentBalance - (transfer.amount + fee), updatedAt: 'Just now' };
          }
          if (a.id === transfer.destinationAccountId) {
            return { ...a, currentBalance: a.currentBalance + transfer.amount, updatedAt: 'Just now' };
          }
          return a;
        })
      );

      return { success: true, transfer: data.transfer };
    } catch (err: any) {
      console.error('Error recording transfer:', err);
      return { success: false, error: err.message || 'Error recording transfer' };
    }
  };

  const deleteTransfer = async (id: string): Promise<{ success: boolean; error?: string }> => {
    try {
      const res = await authFetch(`/api/transfers/${id}`, { method: 'DELETE' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.success) {
        return { success: false, error: data.error || 'Failed to delete transfer' };
      }
      // Deleting a transfer moves the money back on the server.
      await refreshAccounts();
      return { success: true };
    } catch (err: any) {
      console.error('Error deleting transfer:', err);
      return { success: false, error: err.message || 'Error deleting transfer' };
    }
  };

  // LOANS
  const addLoan = async (loan: {
    type: 'LENT' | 'BORROWED';
    counterpartyName: string;
    counterpartyContact?: string;
    principalAmount: number;
    accountId: string;
    startDate: string;
    dueDate?: string;
    notes?: string;
    interestRate?: number;
  }): Promise<{ success: boolean; loan?: Loan; error?: string }> => {
    const acc = accounts.find((a) => a.id === loan.accountId);
    if (!acc) return { success: false, error: 'Account not found.' };

    try {
      const res = await authFetch('/api/loans', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(loan),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        return { success: false, error: data.error || 'Failed to save loan' };
      }

      const created: Loan = data.loan;
      setLoans((prev) => [created, ...prev]);

      const delta = loan.type === 'LENT' ? -loan.principalAmount : loan.principalAmount;
      setAccounts((prev) =>
        prev.map((a) => (a.id === loan.accountId ? { ...a, currentBalance: a.currentBalance + delta } : a))
      );

      return { success: true, loan: created };
    } catch (err: any) {
      console.error('Error creating loan:', err);
      return { success: false, error: err.message || 'Error creating loan' };
    }
  };

  const deleteLoan = async (id: string): Promise<{ success: boolean; error?: string }> => {
    try {
      const target = loans.find((l) => l.id === id);
      const res = await authFetch(`/api/loans/${id}`, { method: 'DELETE' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.success) {
        return { success: false, error: data.error || 'Failed to delete loan' };
      }

      setLoans((prev) => prev.filter((l) => l.id !== id));
      if (target) {
        const reverse = target.type === 'LENT' ? target.principalAmount : -target.principalAmount;
        setAccounts((prev) =>
          prev.map((a) => (a.id === target.accountId ? { ...a, currentBalance: a.currentBalance + reverse } : a))
        );
      }
      return { success: true };
    } catch (err: any) {
      console.error('Error deleting loan:', err);
      return { success: false, error: err.message || 'Error deleting loan' };
    }
  };

  const recordRepayment = async (repayment: {
    loanId: string;
    accountId: string;
    amount: number;
    date: string;
    notes?: string;
  }): Promise<{ success: boolean; repayment?: LoanRepayment; error?: string }> => {
    const loan = loans.find((l) => l.id === repayment.loanId);
    const acc = accounts.find((a) => a.id === repayment.accountId);
    if (!loan || !acc) return { success: false, error: 'Loan or Account not found.' };

    try {
      const res = await authFetch(`/api/loans/${repayment.loanId}/repayments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(repayment),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        return { success: false, error: data.error || 'Failed to record repayment' };
      }

      const repObj: LoanRepayment = data.repayment || {
        id: `rep_${Date.now()}`,
        loanId: loan.id,
        counterpartyName: loan.counterpartyName,
        loanType: loan.type,
        amount: repayment.amount,
        date: repayment.date,
        accountName: acc.name,
        notes: repayment.notes,
      };

      setRepayments((prev) => [repObj, ...prev]);

      // Update loan balance
      setLoans((prev) =>
        prev.map((l) => {
          if (l.id === repayment.loanId) {
            const newOutstanding = Math.max(0, l.outstandingPrincipal - repayment.amount);
            return {
              ...l,
              outstandingPrincipal: newOutstanding,
              status: newOutstanding <= 0 ? 'SETTLED' : 'PARTIALLY_REPAID',
            };
          }
          return l;
        })
      );

      // Update account balance
      const delta = loan.type === 'LENT' ? repayment.amount : -repayment.amount;
      setAccounts((prev) =>
        prev.map((a) => (a.id === repayment.accountId ? { ...a, currentBalance: a.currentBalance + delta } : a))
      );

      return { success: true, repayment: repObj };
    } catch (err: any) {
      console.error('Error recording repayment:', err);
      return { success: false, error: err.message || 'Error recording repayment' };
    }
  };

  // CATEGORIES
  const addCategory = async (cat: Omit<Category, 'id'>): Promise<{ success: boolean; category?: Category; error?: string }> => {
    try {
      const res = await authFetch('/api/categories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(cat),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        return { success: false, error: data.error || 'Failed to create category' };
      }
      setCategories((prev) => [...prev, data.category]);
      return { success: true, category: data.category };
    } catch (err: any) {
      console.error('Error creating category:', err);
      return { success: false, error: err.message || 'Error creating category' };
    }
  };

  const editCategory = async (id: string, updates: Partial<Category>): Promise<{ success: boolean; category?: Category; error?: string }> => {
    try {
      const res = await authFetch(`/api/categories/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        return { success: false, error: data.error || 'Failed to update category' };
      }
      setCategories((prev) => prev.map((c) => (c.id === id ? { ...c, ...data.category } : c)));
      // A rename also moves past transactions and budgets to the new name on the server.
      if (updates.name !== undefined) await refreshData();
      return { success: true, category: data.category };
    } catch (err: any) {
      console.error('Error updating category:', err);
      return { success: false, error: err.message || 'Error updating category' };
    }
  };

  const addSubcategory = async (categoryId: string, subcategoryName: string): Promise<{ success: boolean; subcategories?: string[]; error?: string }> => {
    try {
      const res = await authFetch(`/api/categories/${categoryId}/subcategories`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subcategory: subcategoryName }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        return { success: false, error: data.error || 'Failed to add subcategory' };
      }
      setCategories((prev) =>
        prev.map((c) => (c.id === categoryId ? { ...c, subcategories: data.subcategories } : c))
      );
      return { success: true, subcategories: data.subcategories };
    } catch (err: any) {
      console.error('Error adding subcategory:', err);
      return { success: false, error: err.message || 'Error adding subcategory' };
    }
  };

  const toggleArchiveCategory = async (id: string): Promise<{ success: boolean; category?: Category; error?: string }> => {
    try {
      const res = await authFetch(`/api/categories/${id}/archive`, { method: 'PATCH' });
      const data = await res.json();
      if (!res.ok || !data.success) {
        return { success: false, error: data.error || 'Failed to archive category' };
      }
      setCategories((prev) =>
        prev.map((c) => (c.id === id ? { ...c, ...data.category } : c))
      );
      return { success: true, category: data.category };
    } catch (err: any) {
      console.error('Error archiving category:', err);
      return { success: false, error: err.message || 'Error archiving category' };
    }
  };

  const deleteCategory = async (id: string): Promise<{ success: boolean; error?: string }> => {
    try {
      const res = await authFetch(`/api/categories/${id}`, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok || !data.success) {
        return { success: false, error: data.error || 'Failed to delete category' };
      }
      setCategories((prev) => prev.filter((c) => c.id !== id));
      return { success: true };
    } catch (err: any) {
      console.error('Error deleting category:', err);
      return { success: false, error: err.message || 'Error deleting category' };
    }
  };

  // BUDGETS
  const setCategoryBudget = (categoryName: string, monthlyLimit: number) => {
    setBudgets(prev => {
      const existing = prev.find(b => b.categoryName === categoryName);
      let next;
      if (existing) {
        next = prev.map(b => (b.categoryName === categoryName ? { ...b, monthlyLimit } : b));
      } else {
        next = [...prev, { categoryName, monthlyLimit }];
      }
      recalculateBudgetAlerts(next, monthCategorySpend);
      return next;
    });

    authFetch('/api/budgets', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ categoryName, monthlyLimit }),
    }).catch(err => console.error('Error setting budget:', err));
  };

  const deleteBudget = (categoryName: string) => {
    setBudgets(prev => {
      const next = prev.filter(b => b.categoryName !== categoryName);
      recalculateBudgetAlerts(next, monthCategorySpend);
      return next;
    });
    authFetch(`/api/budgets/${encodeURIComponent(categoryName)}`, { method: 'DELETE' }).catch(err =>
      console.error('Error deleting budget:', err)
    );
  };

  const resetToDefaults = () => {
    refreshData();
  };

  // The full ledger is only read when the user asks for a backup.
  const exportData = async (): Promise<string> => {
    const res = await authFetch('/api/transactions?all=true');
    if (!res.ok) throw new Error('Could not load transactions for the backup.');
    const { transactions = [] } = await res.json();
    return JSON.stringify(
      {
        app: 'AccountLedger',
        user: { email: user?.email, username: user?.username },
        exportedAt: new Date().toISOString(),
        data: { accounts, transactions: sortTransactions(transactions), loans, repayments, categories, budgets },
      },
      null,
      2
    );
  };

  const importData = (jsonData: any): boolean => {
    if (jsonData && jsonData.data) {
      if (jsonData.data.accounts) setAccounts(jsonData.data.accounts);
      if (jsonData.data.loans) setLoans(jsonData.data.loans);
      if (jsonData.data.categories) setCategories(jsonData.data.categories);
      return true;
    }
    return false;
  };

  // refreshData and authFetch are left out: they are already memoized and change with the session,
  // which screens rely on to refetch.
  const actions = useStableActions({
    addAccount,
        editAccount,
        toggleArchiveAccount,
        deleteAccount,
        addIncome,
        addExpense,
        addBulkExpenses,
        deleteTransaction,
        editTransaction,
        addTransfer,
        deleteTransfer,
        addLoan,
        deleteLoan,
        recordRepayment,
        addCategory,
        editCategory,
        addSubcategory,
        toggleArchiveCategory,
        deleteCategory,
        setCategoryBudget,
        deleteBudget,
    resetToDefaults,
    exportData,
    importData,
  });

  // Only a change of state gives consumers a new value; the actions keep their identity.
  const value = useMemo<FinanceContextType>(
    () => ({
      accounts,
      loans,
      repayments,
      categories,
      budgets,
      budgetAlerts,
      monthCategorySpend,
      ledgerVersion,
      isLoading,
      dataStatus,
      refreshData,
      authFetch,
      ...actions,
    }),
    [accounts, loans, repayments, categories, budgets, budgetAlerts, monthCategorySpend, ledgerVersion, isLoading, dataStatus, refreshData, authFetch, actions]
  );

  return <FinanceContext.Provider value={value}>{children}</FinanceContext.Provider>;
};

// Wraps each action so its identity never changes while it still calls the latest version,
// which reads the latest state.
function useStableActions<T extends Record<string, (...args: any[]) => any>>(latest: T): T {
  const ref = useRef(latest);
  useLayoutEffect(() => {
    ref.current = latest;
  });
  return useMemo(() => {
    const stable = {} as T;
    for (const key of Object.keys(ref.current) as (keyof T)[]) {
      stable[key] = ((...args: any[]) => ref.current[key](...args)) as T[keyof T];
    }
    return stable;
  }, []);
}

export const useFinance = () => {
  const context = useContext(FinanceContext);
  if (!context) {
    throw new Error('useFinance must be used within a FinanceProvider');
  }
  return context;
};
