import { Transaction } from '../../mock/data';
import type { FinanceActionContext, BudgetAlert } from './types';
import { getErrorMessage } from '../../lib/errors';

export const createTransactionActions = ({ budgets, setAccounts, bumpLedger, authFetch, refreshData, refreshAccounts, refreshBudgetSpend }: FinanceActionContext) => {
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
    } catch (err: unknown) {
      console.error('Error recording income:', err);
      return { success: false, error: getErrorMessage(err) || 'Error recording income' };
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
    } catch (err: unknown) {
      console.error('Error recording expense:', err);
      return { success: false, error: getErrorMessage(err) || 'Error recording expense' };
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
      return { success: false, error: getErrorMessage(err) || 'Error saving bulk expenses' };
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
    } catch (err: unknown) {
      console.error('Error deleting transaction:', err);
      return { success: false, error: getErrorMessage(err) || 'Error deleting transaction' };
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
    } catch (err: unknown) {
      console.error('Error editing transaction:', err);
      return { success: false, error: getErrorMessage(err) || 'Error updating transaction' };
    }
  };

  return { addIncome, addExpense, addBulkExpenses, deleteTransaction, editTransaction };
};
