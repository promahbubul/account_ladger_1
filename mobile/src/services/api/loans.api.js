import { apiClient } from './client';

export const loansApi = {
  getLoans: async (params = {}) => {
    const query = new URLSearchParams();
    if (params.type && params.type !== 'ALL') query.set('type', params.type);
    if (params.status && params.status !== 'ALL') query.set('status', params.status);
    if (params.search) query.set('search', params.search);
    if (params.cursor) query.set('cursor', params.cursor);
    if (params.page && params.page > 1) query.set('page', String(params.page));
    if (params.limit) query.set('limit', String(params.limit));

    const qStr = query.toString() ? `?${query.toString()}` : '';
    return apiClient(`/api/loans${qStr}`);
  },

  getRepayments: async (params = {}) => {
    const query = new URLSearchParams();
    if (params.search) query.set('search', params.search);
    if (params.cursor) query.set('cursor', params.cursor);
    if (params.page && params.page > 1) query.set('page', String(params.page));
    if (params.limit) query.set('limit', String(params.limit));

    const qStr = query.toString() ? `?${query.toString()}` : '';
    return apiClient(`/api/loans/repayments${qStr}`);
  },

  createLoan: async (data) => {
    return apiClient('/api/loans', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  deleteLoan: async (id) => {
    return apiClient(`/api/loans/${id}`, {
      method: 'DELETE',
    });
  },

  addRepayment: async (loanId, data) => {
    return apiClient(`/api/loans/${loanId}/repayments`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },
};
