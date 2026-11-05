import { Category } from '../../mock/data';
import type { FinanceActionContext } from './types';
import { getErrorMessage } from '../../lib/errors';

export const createCategoryActions = ({ setCategories, authFetch, refreshData }: FinanceActionContext) => {
  // CATEGORIES
  const addCategory = async (cat: Omit<Category, 'id'>): Promise<{ success: boolean; category?: Category; error?: string }> => {
    try {
      const res = await authFetch('/api/categories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(cat),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        return { success: false, error: data.error || 'Failed to create category' };
      }
      setCategories((prev) => [...prev, data.category]);
      return { success: true, category: data.category };
    } catch (err: unknown) {
      console.error('Error creating category:', err);
      return { success: false, error: getErrorMessage(err) || 'Error creating category' };
    }
  };

  const editCategory = async (id: string, updates: Partial<Category>): Promise<{ success: boolean; category?: Category; error?: string }> => {
    try {
      const res = await authFetch(`/api/categories/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        return { success: false, error: data.error || 'Failed to update category' };
      }
      setCategories((prev) => prev.map((c) => (c.id === id ? { ...c, ...data.category } : c)));
      // A rename also moves past transactions and budgets to the new name on the server.
      if (updates.name !== undefined) await refreshData();
      return { success: true, category: data.category };
    } catch (err: unknown) {
      console.error('Error updating category:', err);
      return { success: false, error: getErrorMessage(err) || 'Error updating category' };
    }
  };

  const addSubcategory = async (categoryId: string, subcategoryName: string): Promise<{ success: boolean; subcategories?: string[]; error?: string }> => {
    try {
      const res = await authFetch(`/api/categories/${categoryId}/subcategories`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subcategory: subcategoryName }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        return { success: false, error: data.error || 'Failed to add subcategory' };
      }
      setCategories((prev) =>
        prev.map((c) => (c.id === categoryId ? { ...c, subcategories: data.subcategories } : c))
      );
      return { success: true, subcategories: data.subcategories };
    } catch (err: unknown) {
      console.error('Error adding subcategory:', err);
      return { success: false, error: getErrorMessage(err) || 'Error adding subcategory' };
    }
  };

  const toggleArchiveCategory = async (id: string): Promise<{ success: boolean; category?: Category; error?: string }> => {
    try {
      const res = await authFetch(`/api/categories/${id}/archive`, { method: 'PATCH' });
      const data = await res.json();
      if (!res.ok || !data.success) {
        return { success: false, error: data.error || 'Failed to archive category' };
      }
      setCategories((prev) =>
        prev.map((c) => (c.id === id ? { ...c, ...data.category } : c))
      );
      return { success: true, category: data.category };
    } catch (err: unknown) {
      console.error('Error archiving category:', err);
      return { success: false, error: getErrorMessage(err) || 'Error archiving category' };
    }
  };

  const deleteCategory = async (id: string): Promise<{ success: boolean; error?: string }> => {
    try {
      const res = await authFetch(`/api/categories/${id}`, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok || !data.success) {
        return { success: false, error: data.error || 'Failed to delete category' };
      }
      setCategories((prev) => prev.filter((c) => c.id !== id));
      return { success: true };
    } catch (err: unknown) {
      console.error('Error deleting category:', err);
      return { success: false, error: getErrorMessage(err) || 'Error deleting category' };
    }
  };

  return { addCategory, editCategory, addSubcategory, toggleArchiveCategory, deleteCategory };
};
