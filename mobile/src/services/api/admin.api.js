import { apiClient } from './client';

export const adminApi = {
  getStats: async () => {
    return apiClient('/api/admin/stats');
  },

  getDbStatus: async () => {
    return apiClient('/api/admin/db-status');
  },

  getUsers: async (params = {}) => {
    const query = new URLSearchParams();
    if (params.search) query.set('search', params.search);
    if (params.cursor) query.set('cursor', params.cursor);
    if (params.page) query.set('page', String(params.page));
    const validLimits = [50, 70, 100];
    const requestedLimit = Number(params.limit);
    if (requestedLimit && validLimits.includes(requestedLimit)) {
      query.set('limit', String(requestedLimit));
    } else if (params.limit) {
      query.set('limit', '50');
    }
    const qStr = query.toString() ? `?${query.toString()}` : '';
    return apiClient(`/api/admin/users${qStr}`);
  },

  createUser: async (data) => {
    return apiClient('/api/admin/users', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  updateUser: async (id, data) => {
    return apiClient(`/api/admin/users/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },

  toggleUserStatus: async (id) => {
    return apiClient(`/api/admin/users/${id}/status`, {
      method: 'PATCH',
    });
  },

  resetUserPassword: async (id, newPassword) => {
    return apiClient(`/api/admin/users/${id}/reset-password`, {
      method: 'POST',
      body: JSON.stringify({ newPassword }),
    });
  },

  deleteUser: async (id) => {
    return apiClient(`/api/admin/users/${id}`, {
      method: 'DELETE',
    });
  },

  getAuditLogs: async (params = {}) => {
    const query = new URLSearchParams();
    if (params.search) query.set('search', params.search);
    if (params.cursor) query.set('cursor', params.cursor);
    if (params.page) query.set('page', String(params.page));
    const validLimits = [50, 70, 100];
    const requestedLimit = Number(params.limit);
    if (requestedLimit && validLimits.includes(requestedLimit)) {
      query.set('limit', String(requestedLimit));
    } else if (params.limit) {
      query.set('limit', '50');
    }
    const qStr = query.toString() ? `?${query.toString()}` : '';
    return apiClient(`/api/admin/audit-logs${qStr}`);
  },

  getSettings: async () => {
    return apiClient('/api/admin/settings');
  },

  updateSettings: async (settings) => {
    return apiClient('/api/admin/settings', {
      method: 'PUT',
      body: JSON.stringify(settings),
    });
  },
};
