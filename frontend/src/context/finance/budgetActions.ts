import type { FinanceActionContext } from './types';

export const createBudgetActions = ({ setBudgets, authFetch, recalculateBudgetAlerts, monthCategorySpend }: FinanceActionContext) => {
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

  return { setCategoryBudget, deleteBudget };
};
