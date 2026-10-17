/**
 * HisabFlow Frontend API Service Client
 * Configured to communicate with the Express.js REST API via NEXT_PUBLIC_API_URL.
 */

export const API_BASE_URL =
  (typeof process !== 'undefined' && process.env?.NEXT_PUBLIC_API_URL) ||
  (typeof import.meta !== 'undefined' && import.meta.env && (import.meta.env.NEXT_PUBLIC_API_URL || import.meta.env.VITE_API_URL)) ||
  'http://localhost:5001/api';

const TOKEN_KEY = 'hisabflow_auth_token';

export function getAuthToken() {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(TOKEN_KEY);
}

export function setAuthToken(token) {
  if (typeof window === 'undefined') return;
  if (token) {
    localStorage.setItem(TOKEN_KEY, token);
  } else {
    localStorage.removeItem(TOKEN_KEY);
  }
}

/**
 * Universal authenticated fetch helper
 */
export async function apiFetch(endpoint, options = {}) {
  const url = endpoint.startsWith('http')
    ? endpoint
    : `${API_BASE_URL.replace(/\/+$/, '')}/${endpoint.replace(/^\/+/, '')}`;

  const headers = new Headers(options.headers || {});
  const token = getAuthToken();

  if (token && !headers.has('Authorization')) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  if (options.body && !(options.body instanceof FormData) && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  return fetch(url, {
    ...options,
    headers,
  });
}

export async function parseResponseJson(res) {
  if (res.status === 204) return {};
  const contentType = res.headers.get('content-type') || '';
  const text = await res.text().catch(() => '');
  if (!contentType.includes('application/json') || text.trim().startsWith('<') || text.includes('<!DOCTYPE') || text.includes('<html')) {
    if (text.trim().startsWith('<') || text.includes('<!DOCTYPE') || text.includes('<html')) {
      throw new Error(
        'Backend server is not responding (received HTML instead of JSON). Please ensure the backend server is running on port 5001.'
      );
    }
  }
  if (!text.trim()) return {};
  try {
    return JSON.parse(text);
  } catch {
    throw new Error(text || `Server returned invalid response (status ${res.status}).`);
  }
}

// ----------------------------------------------------------------------------
// API Service Modules
// ----------------------------------------------------------------------------

export const authService = {
  login: (identifier, password) =>
    apiFetch('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ identifier, password }),
    }),
  register: (userData) =>
    apiFetch('/auth/register', {
      method: 'POST',
      body: JSON.stringify(userData),
    }),
  googleLogin: (idToken, linkPassword) =>
    apiFetch('/auth/google', {
      method: 'POST',
      body: JSON.stringify({ idToken, linkPassword }),
    }),
  getMe: () => apiFetch('/auth/me'),
  updateProfile: (profileData) =>
    apiFetch('/user/profile', {
      method: 'PUT',
      body: JSON.stringify(profileData),
    }),
};

export const accountsService = {
  getAll: () => apiFetch('/accounts'),
  create: (data) =>
    apiFetch('/accounts', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  update: (id, data) =>
    apiFetch(`/accounts/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),
  archive: (id) =>
    apiFetch(`/accounts/${id}/archive`, {
      method: 'PATCH',
    }),
  delete: (id) =>
    apiFetch(`/accounts/${id}`, {
      method: 'DELETE',
    }),
};

export const categoriesService = {
  getAll: () => apiFetch('/categories'),
  create: (data) =>
    apiFetch('/categories', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  update: (id, data) =>
    apiFetch(`/categories/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),
  addSubcategory: (id, subcategory) =>
    apiFetch(`/categories/${id}/subcategories`, {
      method: 'POST',
      body: JSON.stringify({ subcategory }),
    }),
  archive: (id) =>
    apiFetch(`/categories/${id}/archive`, {
      method: 'PATCH',
    }),
  delete: (id) =>
    apiFetch(`/categories/${id}`, {
      method: 'DELETE',
    }),
};

export const transactionsService = {
  getAll: (queryString = '') =>
    apiFetch(`/transactions${queryString ? `?${queryString}` : ''}`),
  createIncome: (data) =>
    apiFetch('/transactions/income', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  createExpense: (data) =>
    apiFetch('/transactions/expense', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  createBulk: (data) =>
    apiFetch('/transactions/bulk', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  update: (id, data) =>
    apiFetch(`/transactions/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),
  delete: (id) =>
    apiFetch(`/transactions/${id}`, {
      method: 'DELETE',
    }),
};

export const transfersService = {
  getAll: (queryString = '') =>
    apiFetch(`/transfers${queryString ? `?${queryString}` : ''}`),
  create: (data) =>
    apiFetch('/transfers', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  delete: (id) =>
    apiFetch(`/transfers/${id}`, {
      method: 'DELETE',
    }),
};

export const loansService = {
  getAll: (queryString = '') =>
    apiFetch(`/loans${queryString ? `?${queryString}` : ''}`),
  getRepayments: (queryString = '') =>
    apiFetch(`/loans/repayments${queryString ? `?${queryString}` : ''}`),
  create: (data) =>
    apiFetch('/loans', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  delete: (id) =>
    apiFetch(`/loans/${id}`, {
      method: 'DELETE',
    }),
  addRepayment: (loanId, data) =>
    apiFetch(`/loans/${loanId}/repayments`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),
};

export const budgetsService = {
  getAll: () => apiFetch('/budgets'),
  set: (categoryName, monthlyLimit) =>
    apiFetch('/budgets', {
      method: 'POST',
      body: JSON.stringify({ categoryName, monthlyLimit }),
    }),
  delete: (categoryName) =>
    apiFetch(`/budgets/${encodeURIComponent(categoryName)}`, {
      method: 'DELETE',
    }),
};

export const reportsService = {
  getSummary: () => apiFetch('/reports/summary'),
  exportData: () => apiFetch('/reports/export'),
};

export const adminService = {
  getStats: () => apiFetch('/admin/stats'),
  getDbStatus: () => apiFetch('/admin/db-status'),
  getSettings: () => apiFetch('/admin/settings'),
  updateSettings: (data) =>
    apiFetch('/admin/settings', {
      method: 'PUT',
      body: JSON.stringify(data),
    }),
  getUsers: (queryString = '') =>
    apiFetch(`/admin/users${queryString ? `?${queryString}` : ''}`),
  createUser: (data) =>
    apiFetch('/admin/users', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  updateUser: (id, data) =>
    apiFetch(`/admin/users/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),
  toggleUserStatus: (id, isActive) =>
    apiFetch(`/admin/users/${id}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ isActive }),
    }),
  resetPassword: (id, newPassword) =>
    apiFetch(`/admin/users/${id}/reset-password`, {
      method: 'POST',
      body: JSON.stringify({ newPassword }),
    }),
  deleteUser: (id) =>
    apiFetch(`/admin/users/${id}`, {
      method: 'DELETE',
    }),
  getLogs: (queryString = '') =>
    apiFetch(`/admin/audit-logs${queryString ? `?${queryString}` : ''}`),
};
