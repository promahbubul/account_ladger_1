import { apiClient } from './client';

export const authApi = {
  login: async (identifier, password) => {
    return apiClient('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ identifier, password }),
    });
  },

  register: async (data) => {
    return apiClient('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  verifyEmail: async (email, code) => {
    return apiClient('/api/auth/verify-email', {
      method: 'POST',
      body: JSON.stringify({ email, code }),
    });
  },

  resendVerification: async (email) => {
    return apiClient('/api/auth/resend-verification', {
      method: 'POST',
      body: JSON.stringify({ email }),
    });
  },

  googleLogin: async (idToken) => {
    return apiClient('/api/auth/google', {
      method: 'POST',
      body: JSON.stringify({ idToken }),
    });
  },

  getMe: async () => {
    return apiClient('/api/auth/me');
  },

  forgotPassword: async (email) => {
    return apiClient('/api/auth/forgot-password', {
      method: 'POST',
      body: JSON.stringify({ email }),
    });
  },

  resetPassword: async (token, newPassword) => {
    return apiClient('/api/auth/reset-password', {
      method: 'POST',
      body: JSON.stringify({ token, newPassword }),
    });
  },
};
