import React, { useEffect, useMemo, useState } from 'react';
import {
  buildExpenseItems,
  CategoryExpenseGroups,
  expenseGroupsTotal,
  newExpenseGroups,
  selectableExpenseCategories,
  useBatchId,
} from './CategoryExpenseGroups';
import { AlertTriangle } from 'lucide-react';
import { formatBDT } from '../../lib/formatters';
import { useFinance } from '../../context/FinanceContext';
import { DatePicker, getDhakaTodayISO } from '../common/DatePicker';
import { useToast } from '../../context/ToastContext';
import { useExpenseCategories } from './useExpenseCategories';

interface BulkEntryTabProps {
  preferredAccountId: string;
  onAddAccount: () => void;
  onCancel: () => void;
  onSaved: () => void;
  onSuccessNotification: (msg: string) => void;
}

export const BulkEntryTab: React.FC<BulkEntryTabProps> = ({
  preferredAccountId,
  onAddAccount,
  onCancel,
  onSaved,
  onSuccessNotification,
}) => {
  const { accounts, addBulkExpenses } = useFinance();
  const toast = useToast();
  const { mainExpenseCategories } = useExpenseCategories();

  const [formValidationMsg, setFormValidationMsg] = useState<string | null>(null);
  const [bulkDate, setBulkDate] = useState<string>(getDhakaTodayISO());
  const [bulkAccount, setBulkAccount] = useState(accounts[0]?.id || '');
  const [bulkGroups, setBulkGroups] = useState(newExpenseGroups);
  const [isSavingBulk, setIsSavingBulk] = useState(false);
  const batchIdFor = useBatchId();

  useEffect(() => {
    if (!bulkAccount && accounts.length > 0) {
      setBulkAccount(accounts[0].id);
    }
  }, [accounts, bulkAccount]);

  // An account created from the "+ Add" link becomes the selected one.
  useEffect(() => {
    if (preferredAccountId) setBulkAccount(preferredAccountId);
  }, [preferredAccountId]);

  const bulkCategories = useMemo(() => selectableExpenseCategories(mainExpenseCategories), [mainExpenseCategories]);
  const bulkGrandTotal = expenseGroupsTotal(bulkGroups);

  const handleSaveBulkBatch = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormValidationMsg(null);
    if (!bulkAccount) {
      setFormValidationMsg('Please select a payment account.');
      return;
    }

    if (isSavingBulk) return;
    const { items, error: itemsError } = buildExpenseItems(bulkGroups, bulkCategories);
    if (itemsError) {
      setFormValidationMsg(itemsError);
      return;
    }

    setIsSavingBulk(true);
    const batchPayload = { accountId: bulkAccount, date: bulkDate, items };
    const res = await addBulkExpenses({ ...batchPayload, batchId: batchIdFor(batchPayload) });
    setIsSavingBulk(false);

    if (res && res.success === false) {
      setFormValidationMsg(res.error || 'Failed to record bulk expenses.');
      toast.error(res.error || 'Failed to record bulk expenses.');
      return;
    }

    const accName = accounts.find((a) => a.id === bulkAccount)?.name || 'Account';
    onSuccessNotification(`Recorded ${items.length} daily expenses totaling ${formatBDT(bulkGrandTotal)} from ${accName}.`);

    // Reset to a clean form so the user can immediately enter another batch.
    setBulkGroups(newExpenseGroups());
    setBulkDate(getDhakaTodayISO());
    onSaved();
  };

  return (
    <div className="space-y-4 flex-1 min-h-0 overflow-y-auto">
      {formValidationMsg && (
        <div className="p-3 bg-amber-950/40 border border-amber-800 text-amber-200 text-xs rounded flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-amber-400 flex-shrink-0" />
          <span>{formValidationMsg}</span>
        </div>
      )}

      <form onSubmit={handleSaveBulkBatch} className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-surface border border-line rounded p-3">
          <div>
            <label className="block text-xs text-gray-300 font-medium mb-1">
              Transaction Date *
            </label>
            <DatePicker value={bulkDate} onChange={setBulkDate} />
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-xs text-gray-300 font-medium">
                Payment Account *
              </label>
              <button
                type="button"
                onClick={onAddAccount}
                className="text-[11px] text-blue-400 hover:text-blue-300 font-medium transition-colors"
              >
                + Add Bank / Account
              </button>
            </div>
            <select
              value={bulkAccount}
              onChange={(e) => setBulkAccount(e.target.value)}
              className="w-full bg-app border border-line-strong rounded px-3 py-1.5 text-xs text-gray-200 focus:outline-none focus:border-blue-500"
            >
              {accounts.map((acc) => (
                <option key={acc.id} value={acc.id}>
                  {acc.name} ({formatBDT(acc.currentBalance)})
                </option>
              ))}
            </select>
          </div>
        </div>

        <CategoryExpenseGroups groups={bulkGroups} onChange={setBulkGroups} categories={bulkCategories} />

        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 bg-surface-hover hover:bg-surface-raised text-gray-300 rounded text-xs transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={isSavingBulk}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded text-xs font-medium transition-colors"
          >
            Save All Expenses ({formatBDT(bulkGrandTotal)})
          </button>
        </div>
      </form>
    </div>
  );
};
