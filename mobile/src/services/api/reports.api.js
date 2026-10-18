import { apiClient } from './client';

export const reportsApi = {
  getSummary: async (params = {}) => {
    const query = new URLSearchParams();
    if (params.startDate) query.set('startDate', params.startDate);
    if (params.endDate) query.set('endDate', params.endDate);
    const qStr = query.toString() ? `?${query.toString()}` : '';
    return apiClient(`/api/reports/summary${qStr}`);
  },

  exportData: async () => {
    return apiClient('/api/reports/export');
  },
};

export { userApi } from './user.api';
