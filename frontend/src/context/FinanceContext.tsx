import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import {
  Account,
  Loan,
  LoanRepayment,
  Category,
} from '../mock/data';
import { useAuth } from './AuthContext';
import { API_BASE_URL, parseResponseJson } from '../services/api';
import type { DataStatus } from '../components/common/StateViews';
import { sortTransactions } from '../lib/sorting';
import { createAccountActions } from './finance/accountActions';
import { createTransactionActions } from './finance/transactionActions';
import { createTransferActions } from './finance/transferActions';
import { createLoanActions } from './finance/loanActions';
import { createCategoryActions } from './finance/categoryActions';
import { createBudgetActions } from './finance/budgetActions';
import { useStableActions } from './finance/useStableActions';
import type { BackupFile, BudgetAlert, CategoryBudget, FinanceActionContext, FinanceContextType } from './finance/types';

export type { BudgetAlert, CategoryBudget } from './finance/types';

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
        fetchedBudgets = (data.budgets || []).map((b: { categoryName: string; monthlyLimit: number | string }) => ({
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

  const actionContext: FinanceActionContext = {
    accounts,
    loans,
    repayments,
    categories,
    budgets,
    setAccounts,
    setLoans,
    setRepayments,
    setCategories,
    setBudgets,
    bumpLedger,
    authFetch,
    refreshData,
    refreshAccounts,
    refreshBudgetSpend,
    recalculateBudgetAlerts,
    monthCategorySpend,
  };
  const { addAccount, editAccount, toggleArchiveAccount, deleteAccount } = createAccountActions(actionContext);
  const { addIncome, addExpense, addBulkExpenses, deleteTransaction, editTransaction } = createTransactionActions(actionContext);
  const { addTransfer, deleteTransfer } = createTransferActions(actionContext);
  const { addLoan, deleteLoan, recordRepayment } = createLoanActions(actionContext);
  const { addCategory, editCategory, addSubcategory, toggleArchiveCategory, deleteCategory } = createCategoryActions(actionContext);
  const { setCategoryBudget, deleteBudget } = createBudgetActions(actionContext);

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

  const importData = (jsonData: BackupFile): boolean => {
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

export const useFinance = () => {
  const context = useContext(FinanceContext);
  if (!context) {
    throw new Error('useFinance must be used within a FinanceProvider');
  }
  return context;
};
