import { apiClient } from './client';

export const transactionsApi = {
  getTransactions: async (params = {}) => {
    const query = new URLSearchParams();
    if (params.type && params.type !== 'ALL') query.set('type', params.type);
    if (params.accountId && params.accountId !== 'ALL') query.set('accountId', params.accountId);
    if (params.category && params.category !== 'ALL') query.set('category', params.category);
    if (params.startDate) query.set('startDate', params.startDate);
    if (params.endDate) query.set('endDate', params.endDate);
    if (params.search) query.set('search', params.search);
    if (params.cursor) query.set('cursor', params.cursor);
    if (params.page && params.page > 1) query.set('page', String(params.page));
    
    const validLimits = [50, 70, 100];
    const requestedLimit = Number(params.limit);
    if (requestedLimit && validLimits.includes(requestedLimit)) {
      query.set('limit', String(requestedLimit));
    } else if (params.limit) {
      query.set('limit', '50');
    }

    if (params.all) query.set('all', 'true');

    const qStr = query.toString() ? `?${query.toString()}` : '';
    return apiClient(`/api/transactions${qStr}`);
  },

  createIncome: async (data) => {
    return apiClient('/api/transactions/income', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  createExpense: async (data) => {
    return apiClient('/api/transactions/expense', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  createBulkExpense: async (data) => {
    return apiClient('/api/transactions/bulk', {
      method: 'POST',
      body: JSON.stringify(data),
      timeout: 30000,
    });
  },

  updateTransaction: async (id, data) => {
    return apiClient(`/api/transactions/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },

  deleteTransaction: async (id) => {
    return apiClient(`/api/transactions/${id}`, {
      method: 'DELETE',
    });
  },
};
