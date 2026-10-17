import { apiClient } from './client';

export const budgetsApi = {
  getBudgets: async () => {
    return apiClient('/api/budgets');
  },

  setBudget: async (categoryName, monthlyLimit) => {
    return apiClient('/api/budgets', {
      method: 'POST',
      body: JSON.stringify({ categoryName, monthlyLimit }),
    });
  },

  deleteBudget: async (categoryName) => {
    return apiClient(`/api/budgets/${encodeURIComponent(categoryName)}`, {
      method: 'DELETE',
    });
  },
};
