import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import {
  Account,
  Transaction,
  Loan,
  LoanRepayment,
  Category,
} from '../mock/data';
import { useAuth } from './AuthContext';

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
  addAccount: (account: Omit<Account, 'id' | 'updatedAt'>) => void;
  editAccount: (id: string, updates: Partial<Account>) => void;
  toggleArchiveAccount: (id: string) => void;
  deleteAccount: (id: string) => { success: boolean; error?: string };
  addIncome: (income: {
    accountId: string;
    categoryId?: string;
    category?: string;
    subcategory?: string;
    amount: number;
    date: string;
    description: string;
    reference?: string;
  }) => void;
  addExpense: (expense: {
    accountId: string;
    category: string;
    subcategory?: string;
    amount: number;
    date: string;
    description: string;
    reference?: string;
  }) => { overBudgetAlert?: BudgetAlert };
  addBulkExpenses: (bulk: {
    accountId: string;
    date: string;
    items: { category: string; desc: string; amount: number; subcategory?: string }[];
  }) => { overBudgetAlerts?: BudgetAlert[] };
  deleteTransaction: (id: string) => void;
  editTransaction: (id: string, updates: Partial<Transaction>) => void;
  addTransfer: (transfer: {
    sourceAccountId: string;
    destinationAccountId: string;
    amount: number;
    transferFee?: number;
    description?: string;
    reference?: string;
    date?: string;
  }) => { success: boolean; error?: string };
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
  }) => { success: boolean; error?: string };
  deleteLoan: (id: string) => void;
  recordRepayment: (repayment: {
    loanId: string;
    accountId: string;
    amount: number;
    date: string;
    notes?: string;
  }) => { success: boolean; error?: string };
  addCategory: (category: Omit<Category, 'id'>) => void;
  editCategory: (id: string, updates: Partial<Category>) => void;
  addSubcategory: (categoryId: string, subcategoryName: string) => void;
  toggleArchiveCategory: (id: string) => void;
  deleteCategory: (id: string) => { success: boolean; error?: string };
  setCategoryBudget: (categoryName: string, monthlyLimit: number) => void;
  deleteBudget: (categoryName: string) => void;
  resetToDefaults: () => void;
  exportData: () => string;
  importData: (jsonData: any) => boolean;
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
      const headers = new Headers(options.headers || {});
      if (token) {
        headers.set('Authorization', `Bearer ${token}`);
      }
      return fetch(url, { ...options, headers });
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
        authFetch('/api/transactions'),
        authFetch('/api/loans'),
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
        fetchedTransactions = data.transactions || [];
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
  const addAccount = (newAcc: Omit<Account, 'id' | 'updatedAt'>) => {
    const tempId = `acc_${Date.now()}`;
    const accObj: Account = {
      ...newAcc,
      id: tempId,
      currentBalance: newAcc.openingBalance,
      currency: newAcc.currency || user?.currency || 'BDT',
      status: 'ACTIVE',
      updatedAt: 'Just now',
    };
    setAccounts(prev => [accObj, ...prev]);

    authFetch('/api/accounts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newAcc),
    })
      .then(res => res.json())
      .then(data => {
        if (data.account) {
          setAccounts(prev => prev.map(a => (a.id === tempId ? data.account : a)));
        }
      })
      .catch(err => console.error('Error adding account:', err));
  };

  const editAccount = (id: string, updates: Partial<Account>) => {
    setAccounts(prev => prev.map(a => (a.id === id ? { ...a, ...updates, updatedAt: 'Just now' } : a)));
    authFetch(`/api/accounts/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates),
    }).catch(err => console.error('Error updating account:', err));
  };

  const toggleArchiveAccount = (id: string) => {
    setAccounts(prev =>
      prev.map(a => (a.id === id ? { ...a, status: a.status === 'ACTIVE' ? 'ARCHIVED' : 'ACTIVE' } : a))
    );
    authFetch(`/api/accounts/${id}/archive`, { method: 'PATCH' }).catch(err =>
      console.error('Error archiving account:', err)
    );
  };

  const deleteAccount = (id: string): { success: boolean; error?: string } => {
    const hasTx = transactions.some(t => t.accountId === id || t.destinationAccountId === id);
    if (hasTx) {
      return { success: false, error: 'Cannot delete account with existing transactions. Please archive it instead.' };
    }

    setAccounts(prev => prev.filter(a => a.id !== id));
    authFetch(`/api/accounts/${id}`, { method: 'DELETE' }).catch(err =>
      console.error('Error deleting account:', err)
    );
    return { success: true };
  };

  // INCOME
  const addIncome = (income: {
    accountId: string;
    categoryId?: string;
    category?: string;
    subcategory?: string;
    amount: number;
    date: string;
    description: string;
    reference?: string;
  }) => {
    const acc = accounts.find(a => a.id === income.accountId);
    const txObj: Transaction = {
      id: `tx_${Date.now()}`,
      date: income.date,
      type: 'INCOME',
      category: income.category || 'Income',
      subcategory: income.subcategory,
      accountId: income.accountId,
      accountName: acc?.name || 'Account',
      amount: income.amount,
      direction: 'INFLOW',
      description: income.description,
      reference: income.reference,
      status: 'COMPLETED',
    };

    setTransactions(prev => [txObj, ...prev]);
    setAccounts(prev =>
      prev.map(a =>
        a.id === income.accountId
          ? { ...a, currentBalance: a.currentBalance + income.amount, updatedAt: 'Just now' }
          : a
      )
    );

    authFetch('/api/transactions/income', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(income),
    }).catch(err => console.error('Error recording income:', err));
  };

  // EXPENSE
  const addExpense = (expense: {
    accountId: string;
    category: string;
    subcategory?: string;
    amount: number;
    date: string;
    description: string;
    reference?: string;
  }): { overBudgetAlert?: BudgetAlert } => {
    const acc = accounts.find(a => a.id === expense.accountId);
    const txObj: Transaction = {
      id: `tx_${Date.now()}`,
      date: expense.date,
      type: 'EXPENSE',
      category: expense.category,
      subcategory: expense.subcategory,
      accountId: expense.accountId,
      accountName: acc?.name || 'Account',
      amount: expense.amount,
      direction: 'OUTFLOW',
      description: expense.description,
      reference: expense.reference,
      status: 'COMPLETED',
    };

    const nextTxs = [txObj, ...transactions];
    setTransactions(nextTxs);
    setAccounts(prev =>
      prev.map(a =>
        a.id === expense.accountId
          ? { ...a, currentBalance: a.currentBalance - expense.amount, updatedAt: 'Just now' }
          : a
      )
    );

    recalculateBudgetAlerts(budgets, nextTxs);

    authFetch('/api/transactions/expense', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(expense),
    }).catch(err => console.error('Error recording expense:', err));

    const targetBudget = budgets.find(b => b.categoryName === expense.category);
    if (targetBudget) {
      const now = new Date();
      const currentMonth = now.toISOString().slice(0, 7);
      const monthSpent = nextTxs
        .filter(t => t.type === 'EXPENSE' && t.category === expense.category && t.date.startsWith(currentMonth))
        .reduce((sum, t) => sum + t.amount, 0);

      if (monthSpent > targetBudget.monthlyLimit) {
        return {
          overBudgetAlert: {
            categoryName: targetBudget.categoryName,
            spent: monthSpent,
            limit: targetBudget.monthlyLimit,
            exceededBy: monthSpent - targetBudget.monthlyLimit,
            percentage: (monthSpent / targetBudget.monthlyLimit) * 100,
            status: 'EXCEEDED',
          },
        };
      }
    }

    return {};
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
    const nextTxs = [...newTxs, ...transactions];
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
  const deleteTransaction = (id: string) => {
    const target = transactions.find(t => t.id === id);
    if (target) {
      const delta = target.direction === 'INFLOW' ? -target.amount : target.direction === 'OUTFLOW' ? target.amount : 0;
      if (delta !== 0) {
        setAccounts(prev =>
          prev.map(a => (a.id === target.accountId ? { ...a, currentBalance: a.currentBalance + delta } : a))
        );
      }
    }
    const next = transactions.filter(t => t.id !== id);
    setTransactions(next);
    recalculateBudgetAlerts(budgets, next);

    authFetch(`/api/transactions/${id}`, { method: 'DELETE' }).catch(err =>
      console.error('Error deleting transaction:', err)
    );
  };

  const editTransaction = (id: string, updates: Partial<Transaction>) => {
    setTransactions(prev => prev.map(t => (t.id === id ? { ...t, ...updates } : t)));
    authFetch(`/api/transactions/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates),
    }).catch(err => console.error('Error editing transaction:', err));
  };

  // TRANSFERS
  const addTransfer = (transfer: {
    sourceAccountId: string;
    destinationAccountId: string;
    amount: number;
    transferFee?: number;
    description?: string;
    reference?: string;
    date?: string;
  }): { success: boolean; error?: string } => {
    if (transfer.sourceAccountId === transfer.destinationAccountId) {
      return { success: false, error: 'Source and destination accounts must be different.' };
    }

    const src = accounts.find(a => a.id === transfer.sourceAccountId);
    const dst = accounts.find(a => a.id === transfer.destinationAccountId);
    if (!src || !dst) {
      return { success: false, error: 'Invalid accounts selected.' };
    }

    const fee = transfer.transferFee || 0;
    setAccounts(prev =>
      prev.map(a => {
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
      id: `tx_trf_${Date.now()}`,
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
    setTransactions(prev => [tx, ...prev]);

    authFetch('/api/transfers', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(transfer),
    }).catch(err => console.error('Error recording transfer:', err));

    return { success: true };
  };

  // LOANS
  const addLoan = (loan: {
    type: 'LENT' | 'BORROWED';
    counterpartyName: string;
    counterpartyContact?: string;
    principalAmount: number;
    accountId: string;
    startDate: string;
    dueDate?: string;
    notes?: string;
    interestRate?: number;
  }): { success: boolean; error?: string } => {
    const acc = accounts.find(a => a.id === loan.accountId);
    if (!acc) return { success: false, error: 'Account not found.' };

    const newLoan: Loan = {
      id: `loan_${Date.now()}`,
      type: loan.type,
      counterpartyName: loan.counterpartyName,
      counterpartyContact: loan.counterpartyContact,
      principalAmount: loan.principalAmount,
      outstandingPrincipal: loan.principalAmount,
      interestRate: loan.interestRate || 0,
      startDate: loan.startDate,
      dueDate: loan.dueDate,
      status: 'ACTIVE',
      accountId: loan.accountId,
      accountName: acc.name,
      notes: loan.notes,
    };

    setLoans(prev => [newLoan, ...prev]);

    const delta = loan.type === 'LENT' ? -loan.principalAmount : loan.principalAmount;
    setAccounts(prev =>
      prev.map(a => (a.id === loan.accountId ? { ...a, currentBalance: a.currentBalance + delta } : a))
    );

    authFetch('/api/loans', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(loan),
    }).catch(err => console.error('Error creating loan:', err));

    return { success: true };
  };

  const deleteLoan = (id: string) => {
    setLoans(prev => prev.filter(l => l.id !== id));
    authFetch(`/api/loans/${id}`, { method: 'DELETE' }).catch(err =>
      console.error('Error deleting loan:', err)
    );
  };

  const recordRepayment = (repayment: {
    loanId: string;
    accountId: string;
    amount: number;
    date: string;
    notes?: string;
  }): { success: boolean; error?: string } => {
    const loan = loans.find(l => l.id === repayment.loanId);
    const acc = accounts.find(a => a.id === repayment.accountId);
    if (!loan || !acc) return { success: false, error: 'Loan or Account not found.' };

    const repObj: LoanRepayment = {
      id: `rep_${Date.now()}`,
      loanId: loan.id,
      counterpartyName: loan.counterpartyName,
      loanType: loan.type,
      amount: repayment.amount,
      date: repayment.date,
      accountName: acc.name,
      notes: repayment.notes,
    };

    setRepayments(prev => [repObj, ...prev]);

    // Update loan balance
    setLoans(prev =>
      prev.map(l => {
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
    setAccounts(prev =>
      prev.map(a => (a.id === repayment.accountId ? { ...a, currentBalance: a.currentBalance + delta } : a))
    );

    authFetch(`/api/loans/${repayment.loanId}/repayments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(repayment),
    }).catch(err => console.error('Error recording repayment:', err));

    return { success: true };
  };

  // CATEGORIES
  const addCategory = (cat: Omit<Category, 'id'>) => {
    const tempId = `cat_${Date.now()}`;
    const newCat: Category = { ...cat, id: tempId };
    setCategories(prev => [...prev, newCat]);

    authFetch('/api/categories', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(cat),
    }).catch(err => console.error('Error creating category:', err));
  };

  const editCategory = (id: string, updates: Partial<Category>) => {
    setCategories(prev => prev.map(c => (c.id === id ? { ...c, ...updates } : c)));
    authFetch(`/api/categories/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates),
    }).catch(err => console.error('Error updating category:', err));
  };

  const addSubcategory = (categoryId: string, subcategoryName: string) => {
    setCategories(prev =>
      prev.map(c =>
        c.id === categoryId ? { ...c, subcategories: [...c.subcategories, subcategoryName] } : c
      )
    );
    authFetch(`/api/categories/${categoryId}/subcategories`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: subcategoryName }),
    }).catch(err => console.error('Error adding subcategory:', err));
  };

  const toggleArchiveCategory = (id: string) => {
    setCategories(prev =>
      prev.map(c => (c.id === id ? { ...c, isArchived: !c.isArchived } : c))
    );
    authFetch(`/api/categories/${id}/archive`, { method: 'PATCH' }).catch(err =>
      console.error('Error archiving category:', err)
    );
  };

  const deleteCategory = (id: string): { success: boolean; error?: string } => {
    setCategories(prev => prev.filter(c => c.id !== id));
    authFetch(`/api/categories/${id}`, { method: 'DELETE' }).catch(err =>
      console.error('Error deleting category:', err)
    );
    return { success: true };
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
        app: 'HisabFlow',
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
