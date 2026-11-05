import React, { useState } from 'react';
import {
  buildExpenseItems,
  CategoryExpenseGroups,
  expenseGroupsTotal,
  newExpenseGroups,
  selectableExpenseCategories,
  useBatchId,
} from '../expenses/CategoryExpenseGroups';
import { Modal } from '../common/Modal';
import { useFinance } from '../../context/FinanceContext';
import { formatBDT } from '../../lib/formatters';
import { Loader2 } from 'lucide-react';
import { useToast } from '../../context/ToastContext';
import { DatePicker, getDhakaTodayISO } from '../common/DatePicker';

interface DailyBulkModalProps {
  onClose: () => void;
  onSuccessNotification?: (msg: string) => void;
}

export const DailyBulkModal: React.FC<DailyBulkModalProps> = ({ onClose, onSuccessNotification }) => {
  const toast = useToast();
  const { accounts, categories, addBulkExpenses } = useFinance();

  const expenseCategories = categories.filter((c) => c.type === 'EXPENSE');
  const getTodayDate = () => getDhakaTodayISO();
  const [modalError, setModalError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [bulkDate, setBulkDate] = useState(getTodayDate());
  const [bulkAccount, setBulkAccount] = useState(accounts[0]?.id || '');
  const [bulkGroups, setBulkGroups] = useState(newExpenseGroups);
  const batchIdFor = useBatchId();
  const bulkCategories = selectableExpenseCategories(expenseCategories);
  const bulkTotal = expenseGroupsTotal(bulkGroups);

  // Submit Bulk Expenses
  const handleBulkSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;
    setModalError(null);
    const { items, error: itemsError } = buildExpenseItems(bulkGroups, bulkCategories);
    if (itemsError) {
      setModalError(itemsError);
      return;
    }

    const batchPayload = { accountId: bulkAccount || accounts[0]?.id || '', date: bulkDate, items };
    setIsSubmitting(true);
    const res = await addBulkExpenses({ ...batchPayload, batchId: batchIdFor(batchPayload) });
    setIsSubmitting(false);

    if (res && res.error) {
      setModalError(res.error);
      toast.error(res.error);
      return;
    }

    const overBudgetAlerts = res?.overBudgetAlerts;

    const accName = accounts.find((a) => a.id === bulkAccount)?.name || 'Account';

    if (overBudgetAlerts && overBudgetAlerts.length > 0) {
      onSuccessNotification(
        `Batch of ${items.length} expenses (${formatBDT(bulkTotal)}) saved to ${accName}. Budget alert: ${overBudgetAlerts.map((a) => `${a.categoryName} (+${formatBDT(a.exceededBy)})`).join(', ')}`
      );
    } else {
      onSuccessNotification(`Saved ${items.length} expenses (${formatBDT(bulkTotal)}) from ${accName}.`);
    }

    onClose();
  };

  return (
    <Modal
      isOpen
      onClose={onClose}
      title="Daily Expenses"
      maxWidth="max-w-2xl"
    >
      <form onSubmit={handleBulkSubmit} className="space-y-3">
        {modalError && (
          <div className="p-2.5 rounded bg-red-950/40 border border-red-800/60 text-xs text-red-300">
            {modalError}
          </div>
        )}

        <div className="grid grid-cols-2 gap-3 bg-app border border-line p-2.5 rounded">
          <div>
            <label className="block text-xs text-gray-300 font-medium mb-1">Date *</label>
            <DatePicker value={bulkDate} onChange={setBulkDate} />
          </div>

          <div>
            <label className="block text-xs text-gray-300 font-medium mb-1">Payment Account *</label>
            <select
              value={bulkAccount}
              onChange={(e) => setBulkAccount(e.target.value)}
              className="w-full bg-surface border border-line-strong rounded px-3 py-1.5 text-xs text-gray-200 focus:outline-none focus:border-blue-500"
            >
              {accounts.filter(a => a.status === 'ACTIVE').map((acc) => (
                <option key={acc.id} value={acc.id}>{acc.name} ({formatBDT(acc.currentBalance)})</option>
              ))}
            </select>
          </div>
        </div>

        <CategoryExpenseGroups groups={bulkGroups} onChange={setBulkGroups} categories={bulkCategories} />

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
            <span>{isSubmitting ? 'Saving Batch...' : `Save Batch (${formatBDT(bulkTotal)})`}</span>
          </button>
        </div>
      </form>
    </Modal>
  );
};
