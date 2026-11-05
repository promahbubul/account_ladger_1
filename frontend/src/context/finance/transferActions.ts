import type { FinanceActionContext } from './types';
import { getErrorMessage } from '../../lib/errors';

export const createTransferActions = ({ accounts, setAccounts, authFetch, refreshAccounts }: FinanceActionContext) => {
  // TRANSFERS
  const addTransfer = async (transfer: {
    sourceAccountId: string;
    destinationAccountId: string;
    amount: number;
    transferFee?: number;
    description?: string;
    reference?: string;
    date?: string;
  }): Promise<{ success: boolean; transfer?: { id: string; date?: string }; error?: string }> => {
    if (transfer.sourceAccountId === transfer.destinationAccountId) {
      return { success: false, error: 'Source and destination accounts must be different.' };
    }

    const src = accounts.find((a) => a.id === transfer.sourceAccountId);
    const dst = accounts.find((a) => a.id === transfer.destinationAccountId);
    if (!src || !dst) {
      return { success: false, error: 'Invalid accounts selected.' };
    }

    try {
      const res = await authFetch('/api/transfers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(transfer),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        return { success: false, error: data.error || 'Failed to record transfer.' };
      }

      const fee = transfer.transferFee || 0;
      setAccounts((prev) =>
        prev.map((a) => {
          if (a.id === transfer.sourceAccountId) {
            return { ...a, currentBalance: a.currentBalance - (transfer.amount + fee), updatedAt: 'Just now' };
          }
          if (a.id === transfer.destinationAccountId) {
            return { ...a, currentBalance: a.currentBalance + transfer.amount, updatedAt: 'Just now' };
          }
          return a;
        })
      );

      return { success: true, transfer: data.transfer };
    } catch (err: unknown) {
      console.error('Error recording transfer:', err);
      return { success: false, error: getErrorMessage(err) || 'Error recording transfer' };
    }
  };

  const deleteTransfer = async (id: string): Promise<{ success: boolean; error?: string }> => {
    try {
      const res = await authFetch(`/api/transfers/${id}`, { method: 'DELETE' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.success) {
        return { success: false, error: data.error || 'Failed to delete transfer' };
      }
      // Deleting a transfer moves the money back on the server.
      await refreshAccounts();
      return { success: true };
    } catch (err: unknown) {
      console.error('Error deleting transfer:', err);
      return { success: false, error: getErrorMessage(err) || 'Error deleting transfer' };
    }
  };

  return { addTransfer, deleteTransfer };
};
