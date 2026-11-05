import React, { useState } from 'react';
import { Loader2, AlertCircle } from 'lucide-react';
import { Modal } from '../common/Modal';
import { useFinance } from '../../context/FinanceContext';
import { useToast } from '../../context/ToastContext';
import { getErrorMessage } from '../../lib/errors';

interface QuickAccountModalProps {
  onClose: () => void;
  onCreated: (accountId: string) => void;
}

export const QuickAccountModal: React.FC<QuickAccountModalProps> = ({ onClose, onCreated }) => {
  const { addAccount } = useFinance();
  const toast = useToast();
  const [quickAccName, setQuickAccName] = useState('');
  const [quickAccType, setQuickAccType] = useState<'BANK' | 'CASH' | 'MOBILE_BANKING'>('BANK');
  const [quickAccBalance, setQuickAccBalance] = useState('0');
  const [isSavingQuickAccount, setIsSavingQuickAccount] = useState(false);
  const [quickAccountError, setQuickAccountError] = useState<string | null>(null);

  const handleCreateQuickAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    setQuickAccountError(null);
    if (!quickAccName.trim()) {
      setQuickAccountError('Account name is required.');
      return;
    }
    setIsSavingQuickAccount(true);
    try {
      const initialBal = parseFloat(quickAccBalance) || 0;
      const res = await addAccount({
        name: quickAccName.trim(),
        type: quickAccType,
        openingBalance: initialBal,
        currentBalance: initialBal,
        currency: 'BDT',
        status: 'ACTIVE',
      });
      if (res.success && res.account) {
        toast.success(`Account "${res.account.name}" created and selected!`);
        onCreated(res.account.id);
      } else {
        setQuickAccountError(res.error || 'Failed to create account.');
      }
    } catch (err: unknown) {
      setQuickAccountError(getErrorMessage(err) || 'Error creating account');
    } finally {
      setIsSavingQuickAccount(false);
    }
  };

  return (
    <Modal
      isOpen
      onClose={onClose}
      title="Add New Account"
    >
      <form onSubmit={handleCreateQuickAccount} className="space-y-3 text-xs">
        {quickAccountError && (
          <div className="p-2.5 bg-red-950/40 border border-red-800 text-red-300 rounded flex items-center gap-2">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>{quickAccountError}</span>
          </div>
        )}

        <div>
          <label className="block text-gray-400 mb-1 font-medium">Account Name *</label>
          <input
            type="text"
            required
            value={quickAccName}
            onChange={(e) => setQuickAccName(e.target.value)}
            placeholder="e.g. City Bank Salary, bKash Personal"
            className="w-full bg-app border border-line-strong rounded px-3 py-1.5 text-xs text-gray-200 focus:outline-none focus:border-blue-500"
          />
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="block text-gray-400 mb-1 font-medium">Account Type</label>
            <select
              value={quickAccType}
              onChange={(e) => setQuickAccType(e.target.value as 'CASH' | 'BANK' | 'MOBILE_BANKING')}
              className="w-full bg-app border border-line-strong rounded px-3 py-1.5 text-xs text-gray-200 focus:outline-none focus:border-blue-500"
            >
              <option value="BANK">Bank Account</option>
              <option value="MOBILE_BANKING">Mobile Banking (bKash/Nagad)</option>
              <option value="CASH">Cash in Hand</option>
            </select>
          </div>

          <div>
            <label className="block text-gray-400 mb-1 font-medium">Opening Balance (৳)</label>
            <input
              type="number"
              step="0.01"
              value={quickAccBalance}
              onChange={(e) => setQuickAccBalance(e.target.value)}
              placeholder="0.00"
              className="w-full bg-app border border-line-strong rounded px-3 py-1.5 text-xs text-gray-200 font-mono focus:outline-none focus:border-blue-500"
            />
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 pt-2 border-t border-line">
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-1.5 bg-[#1e2129] hover:bg-[#262a34] text-gray-300 rounded text-xs transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={isSavingQuickAccount}
            className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded font-medium text-xs flex items-center gap-1.5 transition-colors"
          >
            {isSavingQuickAccount && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            <span>{isSavingQuickAccount ? 'Creating...' : 'Create & Select'}</span>
          </button>
        </div>
      </form>
    </Modal>
  );
};
