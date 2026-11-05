import React, { useState } from 'react';
import { Modal } from '../common/Modal';
import { useFinance } from '../../context/FinanceContext';
import { formatBDT } from '../../lib/formatters';
import { Loader2 } from 'lucide-react';
import { useToast } from '../../context/ToastContext';
import { DatePicker, getDhakaTodayISO } from '../common/DatePicker';
import { getErrorMessage } from '../../lib/errors';

interface ExpenseModalProps {
  onClose: () => void;
}

export const ExpenseModal: React.FC<ExpenseModalProps> = ({ onClose }) => {
  const toast = useToast();
  const { accounts, addExpense, categories } = useFinance();

  const expenseCategories = categories.filter((c) => c.type === 'EXPENSE');
  const getTodayDate = () => getDhakaTodayISO();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [expenseAmount, setExpenseAmount] = useState('');
  const [expenseAccount, setExpenseAccount] = useState(accounts[0]?.id || '');
  const [expenseCategory, setExpenseCategory] = useState(expenseCategories[0]?.name || 'Food & Dining');
  const [expenseDate, setExpenseDate] = useState(getTodayDate());
  const [expenseDesc, setExpenseDesc] = useState('');
  const [expenseRef, setExpenseRef] = useState('');

  // Submit Expense
  const handleExpenseSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const amountNum = parseFloat(expenseAmount);
    if (isNaN(amountNum) || amountNum <= 0) {
      toast.error('Please enter a valid expense amount.');
      return;
    }
    const accId = expenseAccount || accounts[0]?.id;
    if (!accId) {
      toast.error('Please select an account.');
      return;
    }

    const chosenCat = expenseCategory || expenseCategories[0]?.name || 'Food & Dining';

    setIsSubmitting(true);
    const toastId = toast.loading('Recording expense...');
    try {
      const res = await addExpense({
        accountId: accId,
        category: chosenCat,
        amount: amountNum,
        date: expenseDate,
        description: expenseDesc.trim() || `${chosenCat} payment`,
        reference: expenseRef.trim() || undefined,
      });

      if (res.success) {
        toast.updateToast(toastId, { type: 'success', message: 'Expense recorded successfully.' });
        setExpenseAmount('');
        setExpenseDesc('');
        setExpenseRef('');
        onClose();
      } else {
        const err = res.error || 'Failed to add expense';
        toast.updateToast(toastId, { type: 'error', message: err });
      }
    } catch (err: unknown) {
      const errMsg = getErrorMessage(err) || 'Network error while recording expense';
      toast.updateToast(toastId, { type: 'error', message: errMsg });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen
      onClose={onClose}
      title="Add Expense"
    >
      <form onSubmit={handleExpenseSubmit} className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs text-gray-300 font-medium mb-1">Date *</label>
            <DatePicker value={expenseDate} onChange={setExpenseDate} />
          </div>

          <div>
            <label className="block text-xs text-gray-300 font-medium mb-1">Amount (৳ BDT) *</label>
            <input
              type="number"
              step="0.01"
              required
              value={expenseAmount}
              onChange={(e) => setExpenseAmount(e.target.value)}
              className="w-full bg-app border border-line-strong rounded px-3 py-1.5 text-xs text-gray-200 font-mono focus:outline-none focus:border-blue-500"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs text-gray-300 font-medium mb-1">Payment Account *</label>
            <select
              value={expenseAccount}
              onChange={(e) => setExpenseAccount(e.target.value)}
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
              value={expenseCategory}
              onChange={(e) => setExpenseCategory(e.target.value)}
              className="w-full bg-app border border-line-strong rounded px-3 py-1.5 text-xs text-gray-200 focus:outline-none focus:border-blue-500"
            >
              {expenseCategories.map((c) => (
                <option key={c.id} value={c.name}>{c.name}</option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <label className="block text-xs text-gray-300 font-medium mb-1">Description *</label>
          <input
            type="text"
            required
            value={expenseDesc}
            onChange={(e) => setExpenseDesc(e.target.value)}
            className="w-full bg-app border border-line-strong rounded px-3 py-1.5 text-xs text-gray-200 focus:outline-none focus:border-blue-500"
          />
        </div>

        <div>
          <label className="block text-xs text-gray-300 font-medium mb-1">Reference (Optional)</label>
          <input
            type="text"
            value={expenseRef}
            onChange={(e) => setExpenseRef(e.target.value)}
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
            <span>{isSubmitting ? 'Saving Expense...' : 'Save Expense'}</span>
          </button>
        </div>
      </form>
    </Modal>
  );
};
