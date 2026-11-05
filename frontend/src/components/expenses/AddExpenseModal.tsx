import React, { useEffect, useMemo, useState } from 'react';
import { Loader2, AlertCircle } from 'lucide-react';
import { formatBDT } from '../../lib/formatters';
import { useFinance } from '../../context/FinanceContext';
import { Transaction } from '../../mock/data';
import { Modal } from '../common/Modal';
import { DatePicker, getDhakaTodayISO } from '../common/DatePicker';
import { useToast } from '../../context/ToastContext';
import { useExpenseCategories } from './useExpenseCategories';
import { getErrorMessage } from '../../lib/errors';

interface AddExpenseModalProps {
  onClose: () => void;
  onSaved: (tx: Transaction) => Promise<void>;
}

export const AddExpenseModal: React.FC<AddExpenseModalProps> = ({ onClose, onSaved }) => {
  const { accounts, addExpense } = useFinance();
  const toast = useToast();
  const { mainExpenseCategories, getSubcategoriesForCategory } = useExpenseCategories();

  const [formValidationMsg, setFormValidationMsg] = useState<string | null>(null);
  const [isSavingAdd, setIsSavingAdd] = useState(false);
  const [singleDate, setSingleDate] = useState<string>(getDhakaTodayISO());
  const [singleCat, setSingleCat] = useState('');
  const [singleSubcat, setSingleSubcat] = useState('');
  const [singleAccount, setSingleAccount] = useState(accounts[0]?.id || '');
  const [singleAmount, setSingleAmount] = useState('');
  const [singleDesc, setSingleDesc] = useState('');
  const [singleRef, setSingleRef] = useState('');

  useEffect(() => {
    if (!singleCat && mainExpenseCategories.length > 0) {
      setSingleCat(mainExpenseCategories[0].name);
    }
  }, [mainExpenseCategories, singleCat]);

  useEffect(() => {
    if (!singleAccount && accounts.length > 0) {
      setSingleAccount(accounts[0].id);
    }
  }, [accounts, singleAccount]);

  const singleSubcategories = useMemo(
    () => getSubcategoriesForCategory(singleCat),
    [getSubcategoriesForCategory, singleCat]
  );

  const handleSaveSingleExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormValidationMsg(null);
    const amountNum = parseFloat(singleAmount);
    if (isNaN(amountNum) || amountNum <= 0) {
      setFormValidationMsg('Please enter a valid amount greater than 0.');
      return;
    }
    if (!singleDesc.trim()) {
      setFormValidationMsg('Please enter a description for the expense.');
      return;
    }

    try {
      setIsSavingAdd(true);
      const res = await addExpense({
        accountId: singleAccount || accounts[0]?.id || '',
        category: singleCat || mainExpenseCategories[0]?.name || 'Miscellaneous',
        subcategory: singleSubcat || undefined,
        amount: amountNum,
        date: singleDate,
        description: singleDesc.trim(),
        reference: singleRef.trim() || undefined,
      });

      if (!res.success || !res.transaction) {
        setFormValidationMsg(res.error || 'Failed to record expense.');
        toast.error(res.error || 'Failed to record expense.');
        return;
      }

      toast.success('Expense added successfully');
      onClose();
      await onSaved(res.transaction);
    } catch (err: unknown) {
      setFormValidationMsg(getErrorMessage(err) || 'Failed to record expense.');
      toast.error(getErrorMessage(err) || 'Failed to record expense.');
    } finally {
      setIsSavingAdd(false);
    }
  };

  return (
    <Modal
      isOpen
      onClose={onClose}
      title="Add Expense"
    >
      <form onSubmit={handleSaveSingleExpense} className="space-y-3">
        {formValidationMsg && (
          <div className="p-2.5 bg-red-950/40 border border-red-800 text-red-200 text-xs rounded flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0" />
            <span>{formValidationMsg}</span>
          </div>
        )}

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs text-gray-300 font-medium mb-1">
              Date *
            </label>
            <DatePicker value={singleDate} onChange={setSingleDate} />
          </div>

          <div>
            <label className="block text-xs text-gray-300 font-medium mb-1">
              Amount (৳ BDT) *
            </label>
            <input
              type="number"
              step="0.01"
              required
              value={singleAmount}
              onChange={(e) => setSingleAmount(e.target.value)}
              placeholder="0.00"
              className="w-full bg-app border border-line-strong rounded px-3 py-1.5 text-xs text-gray-200 font-mono focus:outline-none focus:border-blue-500"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs text-gray-300 font-medium mb-1">
              Payment Account *
            </label>
            <select
              value={singleAccount}
              onChange={(e) => setSingleAccount(e.target.value)}
              className="w-full bg-app border border-line-strong rounded px-3 py-1.5 text-xs text-gray-200 focus:outline-none focus:border-blue-500"
            >
              {accounts.filter(a => a.status === 'ACTIVE').map((acc) => (
                <option key={acc.id} value={acc.id}>{acc.name} ({formatBDT(acc.currentBalance)})</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs text-gray-300 font-medium mb-1">
              Main Category *
            </label>
            <select
              value={singleCat}
              onChange={(e) => {
                setSingleCat(e.target.value);
                setSingleSubcat('');
              }}
              className="w-full bg-app border border-line-strong rounded px-3 py-1.5 text-xs text-gray-200 focus:outline-none focus:border-blue-500"
            >
              {mainExpenseCategories.map((cat) => (
                <option key={cat.id} value={cat.name}>{cat.name}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Subcategory Dropdown (if selected main category has subcategories) */}
        {singleSubcategories.length > 0 && (
          <div>
            <label className="block text-xs text-gray-300 font-medium mb-1">
              Subcategory (Optional)
            </label>
            <select
              value={singleSubcat}
              onChange={(e) => setSingleSubcat(e.target.value)}
              className="w-full bg-app border border-line-strong rounded px-3 py-1.5 text-xs text-gray-200 focus:outline-none focus:border-blue-500"
            >
              <option value="">No subcategory</option>
              {singleSubcategories.map((sub, idx) => (
                <option key={idx} value={sub}>{sub}</option>
              ))}
            </select>
          </div>
        )}

        <div>
          <label className="block text-xs text-gray-300 font-medium mb-1">
            Description *
          </label>
          <input
            type="text"
            required
            value={singleDesc}
            onChange={(e) => setSingleDesc(e.target.value)}
            className="w-full bg-app border border-line-strong rounded px-3 py-1.5 text-xs text-gray-200 focus:outline-none focus:border-blue-500"
          />
        </div>

        <div>
          <label className="block text-xs text-gray-300 font-medium mb-1">
            Reference Number (Optional)
          </label>
          <input
            type="text"
            value={singleRef}
            onChange={(e) => setSingleRef(e.target.value)}
            className="w-full bg-app border border-line-strong rounded px-3 py-1.5 text-xs text-gray-200 focus:outline-none focus:border-blue-500"
          />
        </div>

        <div className="flex justify-end gap-2 pt-3 border-t border-line">
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-1.5 bg-surface-hover hover:bg-surface-raised text-gray-300 rounded text-xs transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={isSavingAdd}
            className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded text-xs font-medium transition-colors flex items-center gap-1.5"
          >
            {isSavingAdd && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            <span>Save Expense</span>
          </button>
        </div>
      </form>
    </Modal>
  );
};
