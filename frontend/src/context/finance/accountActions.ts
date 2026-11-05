import { Account } from '../../mock/data';
import type { FinanceActionContext } from './types';
import { getErrorMessage } from '../../lib/errors';

export const createAccountActions = ({ setAccounts, authFetch }: FinanceActionContext) => {
  // ACCOUNTS
  const addAccount = async (newAcc: Omit<Account, 'id' | 'updatedAt'>): Promise<{ success: boolean; account?: Account; error?: string }> => {
    try {
      const res = await authFetch('/api/accounts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newAcc),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        return { success: false, error: data.error || 'Failed to create account.' };
      }
      setAccounts((prev) => [data.account, ...prev]);
      return { success: true, account: data.account };
    } catch (err: unknown) {
      console.error('Error adding account:', err);
      return { success: false, error: getErrorMessage(err) || 'Error creating account' };
    }
  };

  const editAccount = async (id: string, updates: Partial<Account>): Promise<{ success: boolean; account?: Account; error?: string }> => {
    try {
      const res = await authFetch(`/api/accounts/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        return { success: false, error: data.error || 'Failed to update account.' };
      }
      setAccounts((prev) => prev.map((a) => (a.id === id ? { ...a, ...data.account } : a)));
      return { success: true, account: data.account };
    } catch (err: unknown) {
      console.error('Error updating account:', err);
      return { success: false, error: getErrorMessage(err) || 'Error updating account' };
    }
  };

  const toggleArchiveAccount = async (id: string): Promise<{ success: boolean; account?: Account; error?: string }> => {
    try {
      const res = await authFetch(`/api/accounts/${id}/archive`, { method: 'PATCH' });
      const data = await res.json();
      if (!res.ok || !data.success) {
        return { success: false, error: data.error || 'Failed to archive account.' };
      }
      setAccounts((prev) => prev.map((a) => (a.id === id ? { ...a, ...data.account } : a)));
      return { success: true, account: data.account };
    } catch (err: unknown) {
      console.error('Error archiving account:', err);
      return { success: false, error: getErrorMessage(err) || 'Error archiving account' };
    }
  };

  // The server refuses to delete an account that has history, with a message saying why.
  const deleteAccount = async (id: string): Promise<{ success: boolean; error?: string }> => {
    try {
      const res = await authFetch(`/api/accounts/${id}`, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok || !data.success) {
        return { success: false, error: data.error || 'Failed to delete account.' };
      }
      setAccounts((prev) => prev.filter((a) => a.id !== id));
      return { success: true };
    } catch (err: unknown) {
      console.error('Error deleting account:', err);
      return { success: false, error: getErrorMessage(err) || 'Error deleting account' };
    }
  };

  return { addAccount, editAccount, toggleArchiveAccount, deleteAccount };
};
