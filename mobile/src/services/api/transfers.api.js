import { apiClient } from './client';

export const transfersApi = {
  getTransfers: async (params = {}) => {
    const query = new URLSearchParams();
    if (params.sourceAccountId && params.sourceAccountId !== 'ALL') query.set('sourceAccountId', params.sourceAccountId);
    if (params.destAccountId && params.destAccountId !== 'ALL') query.set('destAccountId', params.destAccountId);
    if (params.search) query.set('search', params.search);
    if (params.cursor) query.set('cursor', params.cursor);
    if (params.page && params.page > 1) query.set('page', String(params.page));
    if (params.limit) query.set('limit', String(params.limit));

    const qStr = query.toString() ? `?${query.toString()}` : '';
    return apiClient(`/api/transfers${qStr}`);
  },

  createTransfer: async (data) => {
    return apiClient('/api/transfers', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  deleteTransfer: async (id) => {
    return apiClient(`/api/transfers/${id}`, {
      method: 'DELETE',
    });
  },
};
