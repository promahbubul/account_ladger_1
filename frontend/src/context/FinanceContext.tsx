import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import {
  Account,
  Transaction,
  Loan,
  LoanRepayment,
  Category,
} from '../mock/data';
import { useAuth } from './AuthContext';
import { API_BASE_URL } from '../services/api';
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
  transactions: Transaction[];
  loans: Loan[];
  repayments: LoanRepayment[];
  categories: Category[];
  budgets: CategoryBudget[];
  budgetAlerts: BudgetAlert[];
  isLoading: boolean;
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
    items: { category: string; desc: string; amount: number; subcategory?: string }[];
  }) => { overBudgetAlerts?: BudgetAlert[] };
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
  exportData: () => string;
  importData: (jsonData: any) => boolean;
  authFetch: (url: string, options?: RequestInit) => Promise<Response>;
}

const FinanceContext = createContext<FinanceContextType | undefined>(undefined);

export const FinanceProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, token } = useAuth();

  const [accounts, setAccounts] = useState<Account[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loans, setLoans] = useState<Loan[]>([]);
  const [repayments, setRepayments] = useState<LoanRepayment[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [budgets, setBudgets] = useState<CategoryBudget[]>([]);
  const [budgetAlerts, setBudgetAlerts] = useState<BudgetAlert[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);

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
      return fetch(fullUrl, { ...options, headers });
    },
    [token]
  );

  // Recalculate budget warnings
  const recalculateBudgetAlerts = useCallback(
    (currentBudgets: CategoryBudget[], currentTransactions: Transaction[]) => {
      const now = new Date();
      const currentMonth = now.toISOString().slice(0, 7); // YYYY-MM

      const currentMonthExpenses = currentTransactions.filter(
        t => t.type === 'EXPENSE' && t.date.startsWith(currentMonth) && t.category
      );

      const categorySpending: Record<string, number> = {};
      currentMonthExpenses.forEach(tx => {
        if (!tx.category) return;
        categorySpending[tx.category] = (categorySpending[tx.category] || 0) + tx.amount;
      });

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

  // Refresh all state from REST API
  const refreshData = useCallback(async () => {
    if (!token || !user || user.role === 'ADMIN') {
      setAccounts([]);
      setTransactions([]);
      setLoans([]);
      setRepayments([]);
      setCategories([]);
      setBudgets([]);
      setBudgetAlerts([]);
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      const [accRes, txRes, loanRes, catRes, bgtRes] = await Promise.all([
        authFetch('/api/accounts'),
        authFetch('/api/transactions?all=true'),
        authFetch('/api/loans?all=true'),
        authFetch('/api/categories'),
        authFetch('/api/budgets'),
      ]);

      let fetchedAccounts: Account[] = [];
      let fetchedTransactions: Transaction[] = [];
      let fetchedBudgets: CategoryBudget[] = [];

      if (accRes.ok) {
        const data = await accRes.json();
        fetchedAccounts = data.accounts || [];
        setAccounts(fetchedAccounts);
      }

      if (txRes.ok) {
        const data = await txRes.json();
        fetchedTransactions = sortTransactions(data.transactions || []);
        setTransactions(fetchedTransactions);
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

      recalculateBudgetAlerts(fetchedBudgets, fetchedTransactions);
    } catch (err) {
      console.error('[FinanceContext] Error fetching financial data:', err);
    } finally {
      setIsLoading(false);
    }
  }, [token, user, authFetch, recalculateBudgetAlerts]);

  // Load data when user/token changes
  useEffect(() => {
    refreshData();
  }, [refreshData]);

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

  const deleteAccount = async (id: string): Promise<{ success: boolean; error?: string }> => {
    const hasTx = transactions.some((t) => t.accountId === id || t.destinationAccountId === id);
    if (hasTx) {
      return { success: false, error: 'Cannot delete account with existing transactions. Please archive it instead.' };
    }

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
      setTransactions((prev) => sortTransactions([createdTx, ...prev]));
      setAccounts((prev) =>
        prev.map((a) =>
          a.id === income.accountId ? { ...a, currentBalance: a.currentBalance + income.amount, updatedAt: 'Just now' } : a
        )
      );
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
      const nextTxs = sortTransactions([createdTx, ...transactions]);
      setTransactions(nextTxs);
      setAccounts((prev) =>
        prev.map((a) =>
          a.id === expense.accountId ? { ...a, currentBalance: a.currentBalance - expense.amount, updatedAt: 'Just now' } : a
        )
      );
      recalculateBudgetAlerts(budgets, nextTxs);

      const targetBudget = budgets.find((b) => b.categoryName === expense.category);
      let alert: BudgetAlert | undefined = undefined;
      if (targetBudget) {
        const now = new Date();
        const currentMonth = now.toISOString().slice(0, 7);
        const monthSpent = nextTxs
          .filter((t) => t.type === 'EXPENSE' && t.category === expense.category && t.date.startsWith(currentMonth))
          .reduce((sum, t) => sum + t.amount, 0);

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
  const addBulkExpenses = (bulk: {
    accountId: string;
    date: string;
    items: { category: string; desc: string; amount: number; subcategory?: string }[];
  }): { overBudgetAlerts?: BudgetAlert[] } => {
    const acc = accounts.find(a => a.id === bulk.accountId);
    const newTxs: Transaction[] = bulk.items.map((item, idx) => ({
      id: `tx_${Date.now()}_${idx}`,
      date: bulk.date,
      type: 'EXPENSE',
      category: item.category,
      subcategory: item.subcategory,
      accountId: bulk.accountId,
      accountName: acc?.name || 'Account',
      amount: item.amount,
      direction: 'OUTFLOW',
      description: item.desc,
      status: 'COMPLETED',
    }));

    const total = newTxs.reduce((sum, t) => sum + t.amount, 0);
    const nextTxs = sortTransactions([...newTxs, ...transactions]);
    setTransactions(nextTxs);
    setAccounts(prev =>
      prev.map(a =>
        a.id === bulk.accountId
          ? { ...a, currentBalance: a.currentBalance - total, updatedAt: 'Just now' }
          : a
      )
    );

    recalculateBudgetAlerts(budgets, nextTxs);

    authFetch('/api/transactions/bulk', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(bulk),
    }).catch(err => console.error('Error saving bulk expenses:', err));

    return {};
  };

  // TRANSACTIONS
  const deleteTransaction = async (id: string): Promise<{ success: boolean; error?: string }> => {
    try {
      const target = transactions.find((t) => t.id === id);
      const res = await authFetch(`/api/transactions/${id}`, { method: 'DELETE' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.success) {
        return { success: false, error: data.error || 'Failed to delete transaction.' };
      }
      if (target) {
        const delta = target.direction === 'INFLOW' ? -target.amount : target.direction === 'OUTFLOW' ? target.amount : 0;
        if (delta !== 0) {
          setAccounts((prev) =>
            prev.map((a) => (a.id === target.accountId ? { ...a, currentBalance: a.currentBalance + delta } : a))
          );
        }
      }
      const next = transactions.filter((t) => t.id !== id);
      setTransactions(next);
      recalculateBudgetAlerts(budgets, next);
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
      const old = transactions.find((t) => t.id === id);

      // Targeted balance recalculation without full table refetch
      if (old) {
        const oldEffect = old.direction === 'INFLOW' ? old.amount : old.direction === 'OUTFLOW' ? -old.amount : 0;
        const newEffect = updated.direction === 'INFLOW' ? updated.amount : updated.direction === 'OUTFLOW' ? -updated.amount : 0;

        if (old.accountId === updated.accountId) {
          const netDelta = newEffect - oldEffect;
          if (netDelta !== 0) {
            setAccounts((prev) =>
              prev.map((a) =>
                a.id === updated.accountId ? { ...a, currentBalance: a.currentBalance + netDelta, updatedAt: 'Just now' } : a
              )
            );
          }
        } else {
          setAccounts((prev) =>
            prev.map((a) => {
              if (a.id === old.accountId) {
                return { ...a, currentBalance: a.currentBalance - oldEffect, updatedAt: 'Just now' };
              }
              if (a.id === updated.accountId) {
                return { ...a, currentBalance: a.currentBalance + newEffect, updatedAt: 'Just now' };
              }
              return a;
            })
          );
        }
      }

      setTransactions((prev) => {
        const next = prev.map((t) => (t.id === id ? { ...t, ...updated } : t));
        const sorted = sortTransactions(next);
        recalculateBudgetAlerts(budgets, sorted);
        return sorted;
      });
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

      const tx: Transaction = {
        id: data.transfer?.id || `tx_trf_${Date.now()}`,
        date: transfer.date || new Date().toISOString().split('T')[0],
        type: 'TRANSFER',
        category: 'Internal Transfer',
        accountId: transfer.sourceAccountId,
        accountName: src.name,
        destinationAccountId: transfer.destinationAccountId,
        destinationAccountName: dst.name,
        amount: transfer.amount,
        direction: 'NEUTRAL',
        description: transfer.description || `Transfer to ${dst.name}`,
        reference: transfer.reference,
        status: 'COMPLETED',
      };
      setTransactions((prev) => [tx, ...prev]);

      return { success: true, transfer: data.transfer || tx };
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
      setTransactions((prev) => prev.filter((t) => t.id !== id));
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
      recalculateBudgetAlerts(next, transactions);
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
      recalculateBudgetAlerts(next, transactions);
      return next;
    });
    authFetch(`/api/budgets/${encodeURIComponent(categoryName)}`, { method: 'DELETE' }).catch(err =>
      console.error('Error deleting budget:', err)
    );
  };

  const resetToDefaults = () => {
    refreshData();
  };

  const exportData = (): string => {
    return JSON.stringify(
      {
        app: 'Account Ladger',
        user: { email: user?.email, username: user?.username },
        exportedAt: new Date().toISOString(),
        data: { accounts, transactions, loans, repayments, categories, budgets },
      },
      null,
      2
    );
  };

  const importData = (jsonData: any): boolean => {
    if (jsonData && jsonData.data) {
      if (jsonData.data.accounts) setAccounts(jsonData.data.accounts);
      if (jsonData.data.transactions) setTransactions(jsonData.data.transactions);
      if (jsonData.data.loans) setLoans(jsonData.data.loans);
      if (jsonData.data.categories) setCategories(jsonData.data.categories);
      return true;
    }
    return false;
  };

  return (
    <FinanceContext.Provider
      value={{
        accounts,
        transactions,
        loans,
        repayments,
        categories,
        budgets,
        budgetAlerts,
        isLoading,
        refreshData,
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
        authFetch,
      }}
    >
      {children}
    </FinanceContext.Provider>
  );
};

export const useFinance = () => {
  const context = useContext(FinanceContext);
  if (!context) {
    throw new Error('useFinance must be used within a FinanceProvider');
  }
  return context;
};
