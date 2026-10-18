import { apiClient } from './client';

export const userApi = {
  updateProfile: async (data) => {
    return apiClient('/api/user/profile', {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },
};
