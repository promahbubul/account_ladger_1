import { apiClient } from './client';

export const categoriesApi = {
  getCategories: async () => {
    return apiClient('/api/categories');
  },

  createCategory: async (data) => {
    return apiClient('/api/categories', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  updateCategory: async (id, data) => {
    return apiClient(`/api/categories/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },

  addSubcategory: async (id, name) => {
    return apiClient(`/api/categories/${id}/subcategories`, {
      method: 'POST',
      body: JSON.stringify({ name }),
    });
  },

  archiveCategory: async (id) => {
    return apiClient(`/api/categories/${id}/archive`, {
      method: 'PATCH',
    });
  },

  deleteCategory: async (id) => {
    return apiClient(`/api/categories/${id}`, {
      method: 'DELETE',
    });
  },
};
