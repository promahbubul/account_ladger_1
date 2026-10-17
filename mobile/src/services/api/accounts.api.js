import { apiClient } from './client';

export const accountsApi = {
  getAccounts: async (params = {}) => {
    const query = new URLSearchParams();
    if (params.type && params.type !== 'ALL') query.set('type', params.type);
    if (params.status && params.status !== 'ALL') query.set('status', params.status);
    if (params.search) query.set('search', params.search);
    if (params.paginate) {
      query.set('paginate', 'true');
      if (params.limit) query.set('limit', String(params.limit));
      if (params.page) query.set('page', String(params.page));
    }
    const qStr = query.toString() ? `?${query.toString()}` : '';
    return apiClient(`/api/accounts${qStr}`);
  },

  createAccount: async (data) => {
    return apiClient('/api/accounts', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  updateAccount: async (id, data) => {
    return apiClient(`/api/accounts/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },

  archiveAccount: async (id) => {
    return apiClient(`/api/accounts/${id}/archive`, {
      method: 'PATCH',
    });
  },

  deleteAccount: async (id) => {
    return apiClient(`/api/accounts/${id}`, {
      method: 'DELETE',
    });
  },
};
