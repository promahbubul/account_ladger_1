import React, { useState } from 'react';
import { Modal } from '../common/Modal';
import { useFinance } from '../../context/FinanceContext';
import { formatBDT } from '../../lib/formatters';
import { Loader2 } from 'lucide-react';
import { useToast } from '../../context/ToastContext';
import { DatePicker, getDhakaTodayISO } from '../common/DatePicker';
import { getErrorMessage } from '../../lib/errors';

interface IncomeModalProps {
  onClose: () => void;
}

export const IncomeModal: React.FC<IncomeModalProps> = ({ onClose }) => {
  const toast = useToast();
  const { accounts, addIncome, categories } = useFinance();

  const incomeCategories = categories.filter((c) => c.type === 'INCOME');
  const getTodayDate = () => getDhakaTodayISO();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [incomeAmount, setIncomeAmount] = useState('');
  const [incomeAccount, setIncomeAccount] = useState(accounts[0]?.id || '');
  const [incomeCategory, setIncomeCategory] = useState(incomeCategories[0]?.id || '');
  const [incomeDate, setIncomeDate] = useState(getTodayDate());
  const [incomeDesc, setIncomeDesc] = useState('');
  const [incomeRef, setIncomeRef] = useState('');

  // Submit Income
  const handleIncomeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const amountNum = parseFloat(incomeAmount);
    if (isNaN(amountNum) || amountNum <= 0) {
      toast.error('Please enter a valid income amount.');
      return;
    }
    const accId = incomeAccount || accounts[0]?.id;
    if (!accId) {
      toast.error('Please select an account.');
      return;
    }

    setIsSubmitting(true);
    const toastId = toast.loading('Adding income...');
    try {
      const res = await addIncome({
        accountId: accId,
        categoryId: incomeCategory || incomeCategories[0]?.id,
        amount: amountNum,
        date: incomeDate,
        description: incomeDesc.trim() || 'Income deposit',
        reference: incomeRef.trim() || undefined,
      });

      if (res.success) {
        toast.updateToast(toastId, { type: 'success', message: 'Income added successfully.' });
        setIncomeAmount('');
        setIncomeDesc('');
        setIncomeRef('');
        onClose();
      } else {
        const err = res.error || 'Failed to add income';
        toast.updateToast(toastId, { type: 'error', message: err });
      }
    } catch (err: unknown) {
      const errMsg = getErrorMessage(err) || 'Network error while adding income';
      toast.updateToast(toastId, { type: 'error', message: errMsg });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen
      onClose={onClose}
      title="Add Income"
    >
      <form onSubmit={handleIncomeSubmit} className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs text-gray-300 font-medium mb-1">Date *</label>
            <DatePicker value={incomeDate} onChange={setIncomeDate} />
          </div>

          <div>
            <label className="block text-xs text-gray-300 font-medium mb-1">Amount (৳ BDT) *</label>
            <input
              type="number"
              step="0.01"
              required
              value={incomeAmount}
              onChange={(e) => setIncomeAmount(e.target.value)}
              className="w-full bg-app border border-line-strong rounded px-3 py-1.5 text-xs text-gray-200 font-mono focus:outline-none focus:border-blue-500"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs text-gray-300 font-medium mb-1">Receiving Account *</label>
            <select
              value={incomeAccount}
              onChange={(e) => setIncomeAccount(e.target.value)}
              className="w-full bg-app border border-line-strong rounded px-3 py-1.5 text-xs text-gray-200 focus:outline-none focus:border-blue-500"
            >
              {accounts.filter(a => a.status === 'ACTIVE').map((acc) => (
                <option key={acc.id} value={acc.id}>{acc.name} ({formatBDT(acc.currentBalance)})</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs text-gray-300 font-medium mb-1">Category *</label>
            <select
              value={incomeCategory}
              onChange={(e) => setIncomeCategory(e.target.value)}
              className="w-full bg-app border border-line-strong rounded px-3 py-1.5 text-xs text-gray-200 focus:outline-none focus:border-blue-500"
            >
              {incomeCategories.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <label className="block text-xs text-gray-300 font-medium mb-1">Description *</label>
          <input
            type="text"
            required
            value={incomeDesc}
            onChange={(e) => setIncomeDesc(e.target.value)}
            className="w-full bg-app border border-line-strong rounded px-3 py-1.5 text-xs text-gray-200 focus:outline-none focus:border-blue-500"
          />
        </div>

        <div>
          <label className="block text-xs text-gray-300 font-medium mb-1">Reference (Optional)</label>
          <input
            type="text"
            value={incomeRef}
            onChange={(e) => setIncomeRef(e.target.value)}
            className="w-full bg-app border border-line-strong rounded px-3 py-1.5 text-xs text-gray-200 font-mono focus:outline-none focus:border-blue-500"
          />
        </div>

        <div className="flex justify-end gap-2 pt-3 border-t border-line">
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="px-3 py-1.5 bg-surface-hover hover:bg-surface-raised disabled:opacity-50 text-gray-300 rounded text-xs transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={isSubmitting}
            className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded text-xs font-medium transition-colors flex items-center gap-1.5"
          >
            {isSubmitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            <span>{isSubmitting ? 'Saving Income...' : 'Save Income'}</span>
          </button>
        </div>
      </form>
    </Modal>
  );
};
