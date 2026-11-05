import React, { useMemo, useState } from 'react';
import { Loader2, AlertCircle } from 'lucide-react';
import { formatBDT } from '../../lib/formatters';
import { useFinance } from '../../context/FinanceContext';
import { Transaction } from '../../mock/data';
import { Modal } from '../common/Modal';
import { DatePicker, normalizeToISODate } from '../common/DatePicker';
import { useToast } from '../../context/ToastContext';
import { useExpenseCategories } from './useExpenseCategories';
import { getErrorMessage } from '../../lib/errors';

interface EditExpenseModalProps {
  tx: Transaction;
  onClose: () => void;
  onSaved: (tx: Transaction) => Promise<void>;
}

export const EditExpenseModal: React.FC<EditExpenseModalProps> = ({ tx, onClose, onSaved }) => {
  const { accounts, editTransaction } = useFinance();
  const toast = useToast();
  const { mainExpenseCategories, getSubcategoriesForCategory } = useExpenseCategories();
  const editingTx = tx;

  const [editErrorMsg, setEditErrorMsg] = useState<string | null>(null);
  const [isSavingEdit, setIsSavingEdit] = useState(false);
  const [editDate, setEditDate] = useState<string>(normalizeToISODate(tx.date));
  const [editCat, setEditCat] = useState(tx.category || mainExpenseCategories[0]?.name || 'Miscellaneous');
  const [editSubcat, setEditSubcat] = useState(tx.subcategory || '');
  const [editAccount, setEditAccount] = useState(tx.accountId);
  const [editAmount, setEditAmount] = useState(String(tx.amount));
  const [editDesc, setEditDesc] = useState(tx.description && tx.description !== 'Daily Expense' ? tx.description : (tx.desc || (tx.category ? `${tx.category} Expense` : '')));
  const [editRef, setEditRef] = useState(tx.reference || '');

  const editSubcategories = useMemo(
    () => getSubcategoriesForCategory(editCat),
    [getSubcategoriesForCategory, editCat]
  );

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingTx || isSavingEdit) return;
    setEditErrorMsg(null);

    const amountNum = parseFloat(editAmount);
    if (isNaN(amountNum) || amountNum <= 0) {
      setEditErrorMsg('Please enter a valid positive amount.');
      return;
    }
    if (!editDesc.trim()) {
      setEditErrorMsg('Description cannot be empty.');
      return;
    }

    try {
      setIsSavingEdit(true);
      const res = await editTransaction(editingTx.id, {
        accountId: editAccount,
        amount: amountNum,
        date: editDate,
        category: editCat,
        subcategory: editSubcat || undefined,
        description: editDesc.trim(),
        reference: editRef.trim() || undefined,
      });

      if (!res.success || !res.transaction) {
        setEditErrorMsg(res.error || 'Failed to update expense.');
        toast.error(res.error || 'Failed to save changes');
        return;
      }

      toast.success('Expense updated successfully');
      onClose();
      await onSaved(res.transaction);
    } catch (err: unknown) {
      setEditErrorMsg(getErrorMessage(err) || 'Failed to save changes.');
      toast.error(getErrorMessage(err) || 'Failed to save changes');
    } finally {
      setIsSavingEdit(false);
    }
  };

  return (
    <Modal
      isOpen
      onClose={onClose}
      title="Edit Expense"
    >
      <form onSubmit={handleSaveEdit} className="space-y-3">
        {editErrorMsg && (
          <div className="p-2.5 bg-red-950/40 border border-red-800 text-red-200 text-xs rounded flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0" />
            <span>{editErrorMsg}</span>
          </div>
        )}

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs text-gray-300 font-medium mb-1">
              Date *
            </label>
            <DatePicker value={editDate} onChange={setEditDate} />
          </div>

          <div>
            <label className="block text-xs text-gray-300 font-medium mb-1">
              Amount (৳ BDT) *
            </label>
            <input
              type="number"
              step="0.01"
              required
              value={editAmount}
              onChange={(e) => setEditAmount(e.target.value)}
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
              value={editAccount}
              onChange={(e) => setEditAccount(e.target.value)}
              className="w-full bg-app border border-line-strong rounded px-3 py-1.5 text-xs text-gray-200 focus:outline-none focus:border-blue-500"
            >
              {accounts.map((acc) => (
                <option key={acc.id} value={acc.id}>
                  {acc.name} ({formatBDT(acc.currentBalance)})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs text-gray-300 font-medium mb-1">
              Main Category *
            </label>
            <select
              value={editCat}
              onChange={(e) => {
                setEditCat(e.target.value);
                setEditSubcat('');
              }}
              className="w-full bg-app border border-line-strong rounded px-3 py-1.5 text-xs text-gray-200 focus:outline-none focus:border-blue-500"
            >
              {mainExpenseCategories.map((cat) => (
                <option key={cat.id} value={cat.name}>{cat.name}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Subcategory Dropdown for Edit */}
        {editSubcategories.length > 0 && (
          <div>
            <label className="block text-xs text-gray-300 font-medium mb-1">
              Subcategory (Optional)
            </label>
            <select
              value={editSubcat}
              onChange={(e) => setEditSubcat(e.target.value)}
              className="w-full bg-app border border-line-strong rounded px-3 py-1.5 text-xs text-gray-200 focus:outline-none focus:border-blue-500"
            >
              <option value="">No subcategory</option>
              {editSubcategories.map((sub, idx) => (
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
            value={editDesc}
            onChange={(e) => setEditDesc(e.target.value)}
            className="w-full bg-app border border-line-strong rounded px-3 py-1.5 text-xs text-gray-200 focus:outline-none focus:border-blue-500"
          />
        </div>

        <div>
          <label className="block text-xs text-gray-300 font-medium mb-1">
            Reference Number (Optional)
          </label>
          <input
            type="text"
            value={editRef}
            onChange={(e) => setEditRef(e.target.value)}
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
            disabled={isSavingEdit}
            className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded text-xs font-medium transition-colors flex items-center gap-1.5"
          >
            {isSavingEdit && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            <span>Save Changes</span>
          </button>
        </div>
      </form>
    </Modal>
  );
};
