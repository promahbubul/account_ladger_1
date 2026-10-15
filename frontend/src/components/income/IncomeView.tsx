import React, { useState, useEffect, useCallback } from 'react';
import {
  Plus,
  Search,
  Eye,
  Trash2,
} from 'lucide-react';
import { formatBDT } from '../../lib/formatters';
import { useFinance } from '../../context/FinanceContext';
import { Transaction } from '../../mock/data';
import { Modal, ConfirmModal } from '../common/Modal';
import { TablePagination } from '../common/TablePagination';
import { useCursorPagination } from '../../hooks/useCursorPagination';
import { useDateFilter } from '../../context/DateFilterContext';
import { TableErrorRow, TableLoadingRow, TableEmptyRow } from '../common/StateViews';

interface IncomeViewProps {
  onOpenAddIncomeModal: () => void;
  onSuccessNotification: (msg: string) => void;
}

export const IncomeView: React.FC<IncomeViewProps> = ({
  onSuccessNotification,
}) => {
  const { categories, accounts, deleteTransaction, addIncome, authFetch } = useFinance();
  const { dateFilter } = useDateFilter();

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('ALL');
  const [accountFilter, setAccountFilter] = useState('ALL');

  // Modals
  const [isRecordModalOpen, setIsRecordModalOpen] = useState(false);
  const [selectedTx, setSelectedTx] = useState<Transaction | null>(null);
  const [txToDelete, setTxToDelete] = useState<Transaction | null>(null);

  // Form state
  const [formDate, setFormDate] = useState('14 Oct 2026');
  const [formCatId, setFormCatId] = useState('');
  const [formAccId, setFormAccId] = useState(accounts[0]?.id || '');
  const [formAmount, setFormAmount] = useState('');
  const [formDesc, setFormDesc] = useState('');
  const [formRef, setFormRef] = useState('');

  // Pagination state
  const [items, setItems] = useState<Transaction[]>([]);
  const [totalCount, setTotalCount] = useState<number>(0);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const {
    pageSize,
    cursor,
    pageIndex,
    hasNextPage,
    hasPreviousPage,
    setPageSize,
    goToNextPage,
    goToPreviousPage,
    resetPagination,
    setPaginationMeta,
  } = useCursorPagination({ initialPageSize: 50 });

  const incomeCategories = categories.filter((c) => c.type === 'INCOME');

  // Reset pagination when date filter changes
  useEffect(() => {
    resetPagination();
  }, [dateFilter.startDate, dateFilter.endDate, dateFilter.preset, resetPagination]);

  const fetchIncome = useCallback(async () => {
    try {
      setIsLoading(true);
      setErrorMsg(null);

      const params = new URLSearchParams();
      params.set('type', 'INCOME');
      params.set('limit', String(pageSize));
      if (cursor) params.set('cursor', cursor);
      if (searchQuery.trim()) params.set('search', searchQuery.trim());
      if (categoryFilter !== 'ALL') params.set('category', categoryFilter);
      if (accountFilter !== 'ALL') params.set('accountId', accountFilter);
      if (dateFilter.startDate) params.set('startDate', dateFilter.startDate);
      if (dateFilter.endDate) params.set('endDate', dateFilter.endDate);

      const res = await authFetch(`/api/transactions?${params.toString()}`);
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Failed to load income records');
      }

      const data = await res.json();
      setItems(data.items || []);
      setTotalCount(data.totalCount ?? (data.items || []).length);
      setNextCursor(data.nextCursor || null);
      setPaginationMeta({
        hasNextPage: Boolean(data.hasNextPage),
        hasPreviousPage: Boolean(data.hasPreviousPage),
      });
    } catch (err: any) {
      console.error('Fetch income error:', err);
      setErrorMsg(err.message || 'Error fetching income');
    } finally {
      setIsLoading(false);
    }
  }, [authFetch, pageSize, cursor, searchQuery, categoryFilter, accountFilter, dateFilter.startDate, dateFilter.endDate, setPaginationMeta]);

  useEffect(() => {
    fetchIncome();
  }, [fetchIncome]);

  const handleSearchChange = (val: string) => {
    setSearchQuery(val);
    resetPagination();
  };

  const handleCategoryChange = (val: string) => {
    setCategoryFilter(val);
    resetPagination();
  };

  const handleAccountChange = (val: string) => {
    setAccountFilter(val);
    resetPagination();
  };

  const confirmDelete = async () => {
    if (!txToDelete) return;
    await deleteTransaction(txToDelete.id);
    onSuccessNotification(`Income transaction deleted and ${formatBDT(txToDelete.amount)} deducted from ${txToDelete.accountName}.`);
    setTxToDelete(null);
    fetchIncome();
  };

  const handleSaveIncome = async (e: React.FormEvent) => {
    e.preventDefault();
    const amountNum = parseFloat(formAmount);
    if (isNaN(amountNum) || amountNum <= 0) return;

    await addIncome({
      accountId: formAccId || accounts[0]?.id || '',
      categoryId: formCatId || incomeCategories[0]?.id,
      amount: amountNum,
      date: formDate,
      description: formDesc.trim() || 'Income deposit',
      reference: formRef.trim() || undefined,
    });

    const accName = accounts.find((a) => a.id === formAccId)?.name || 'Account';
    onSuccessNotification(`Credited ${formatBDT(amountNum)} to ${accName}.`);
    setIsRecordModalOpen(false);
    setFormAmount('');
    setFormDesc('');
    setFormRef('');
    resetPagination();
    fetchIncome();
  };

  const pageIncomeTotal = items.reduce((sum, t) => sum + t.amount, 0);

  return (
    <div className="h-full flex flex-col min-h-0 w-full min-w-0 space-y-3">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 flex-shrink-0">
        <div>
          <h2 className="text-base font-semibold text-gray-100">Income Records</h2>
          <p className="text-xs text-gray-400">Track incoming revenue and credits</p>
        </div>
        <button
          onClick={() => setIsRecordModalOpen(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded text-xs font-medium self-start sm:self-auto transition-colors"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>Record Income</span>
        </button>
      </div>

      {/* Search & Filter Toolbar */}
      <div className="bg-[#16181d] border border-[#22252c] rounded p-2.5 flex flex-col md:flex-row items-center justify-between gap-2.5 flex-shrink-0">
        <div className="relative w-full md:w-72">
          <Search className="w-3.5 h-3.5 text-gray-400 absolute left-2.5 top-2.5" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => handleSearchChange(e.target.value)}
            placeholder="Search income records..."
            className="w-full bg-[#111317] border border-[#262932] rounded pl-8 pr-3 py-1.5 text-xs text-gray-200 focus:outline-none focus:border-blue-500 placeholder-gray-500"
          />
        </div>

        <div className="flex items-center gap-2 w-full md:w-auto text-xs">
          <select
            value={categoryFilter}
            onChange={(e) => handleCategoryChange(e.target.value)}
            className="bg-[#111317] border border-[#262932] rounded px-2.5 py-1.5 text-xs text-gray-300 focus:outline-none focus:border-blue-500"
          >
            <option value="ALL">All Categories</option>
            {incomeCategories.map((c) => (
              <option key={c.id} value={c.name}>{c.name}</option>
            ))}
          </select>

          <select
            value={accountFilter}
            onChange={(e) => handleAccountChange(e.target.value)}
            className="bg-[#111317] border border-[#262932] rounded px-2.5 py-1.5 text-xs text-gray-300 focus:outline-none focus:border-blue-500"
          >
            <option value="ALL">All Accounts</option>
            {accounts.map((a) => (
              <option key={a.id} value={a.id}>{a.name}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Main Income Table */}
      <div className="bg-[#16181d] border border-[#22252c] rounded overflow-hidden flex-1 min-h-0 flex flex-col">
        <div className="flex-1 min-h-0 overflow-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead className="sticky top-0 z-10 bg-[#121417] shadow-sm">
              <tr className="border-b border-[#22252c] text-gray-400 font-medium uppercase tracking-wider text-[10px]">
                <th className="py-2.5 px-3">Date</th>
                <th className="py-2.5 px-3">Description</th>
                <th className="py-2.5 px-3">Category</th>
                <th className="py-2.5 px-3">Account</th>
                <th className="py-2.5 px-3">Reference</th>
                <th className="py-2.5 px-3 text-right">Amount</th>
                <th className="py-2.5 px-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#20232a]">
              {errorMsg ? (
                <TableErrorRow
                  colSpan={7}
                  title="Failed to load income records"
                  description={errorMsg}
                  onRetry={fetchIncome}
                />
              ) : isLoading ? (
                <TableLoadingRow
                  colSpan={7}
                  message="Loading income records..."
                />
              ) : items.length === 0 ? (
                <TableEmptyRow
                  colSpan={7}
                  title="No income records found"
                  description={
                    searchQuery || categoryFilter !== 'ALL' || accountFilter !== 'ALL' || dateFilter.startDate
                      ? 'No income transactions match your filters or selected date range.'
                      : 'No income logged yet. Click "Record Income" to deposit funds.'
                  }
                  action={{
                    label: 'Record Income',
                    onClick: () => setIsRecordModalOpen(true),
                  }}
                />
              ) : (
                items.map((tx) => (
                  <tr key={tx.id} className="hover:bg-[#1a1d24] transition-colors">
                    <td className="py-2.5 px-3 text-gray-400 font-mono text-[11px] whitespace-nowrap">
                      {tx.date}
                    </td>
                    <td className="py-2.5 px-3 font-medium text-gray-200">
                      {tx.description}
                    </td>
                    <td className="py-2.5 px-3 text-gray-400">
                      <span className="px-1.5 py-0.5 rounded bg-[#111317] border border-[#242730] text-[11px]">
                        {tx.category || 'General Income'}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-gray-300">
                      {tx.accountName}
                    </td>
                    <td className="py-2.5 px-3 text-gray-500 font-mono text-[11px]">
                      {tx.reference || '-'}
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono font-semibold text-emerald-400 whitespace-nowrap">
                      +{formatBDT(tx.amount)}
                    </td>
                    <td className="py-2.5 px-3 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => setSelectedTx(tx)}
                          title="View Details"
                          className="p-1 text-gray-400 hover:text-gray-200 hover:bg-[#22252e] rounded"
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => setTxToDelete(tx)}
                          title="Delete Record"
                          className="p-1 text-gray-400 hover:text-red-400 hover:bg-[#22252e] rounded"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pinned Pagination Controls */}
      <TablePagination
        pageSize={pageSize}
        onPageSizeChange={setPageSize}
        hasNextPage={hasNextPage}
        hasPreviousPage={hasPreviousPage}
        onNextPage={() => goToNextPage(nextCursor)}
        onPreviousPage={goToPreviousPage}
        isLoading={isLoading}
        itemCount={items.length}
        totalCount={totalCount}
        pageIndex={pageIndex}
      />

      {/* Record Income Modal */}
      <Modal
        isOpen={isRecordModalOpen}
        onClose={() => setIsRecordModalOpen(false)}
        title="Record Income"
      >
        <form onSubmit={handleSaveIncome} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-gray-300 font-medium mb-1">
                Date *
              </label>
              <input
                type="text"
                required
                value={formDate}
                onChange={(e) => setFormDate(e.target.value)}
                placeholder="14 Oct 2026"
                className="w-full bg-[#111317] border border-[#262932] rounded px-3 py-1.5 text-xs text-gray-200 focus:outline-none focus:border-blue-500"
              />
            </div>

            <div>
              <label className="block text-xs text-gray-300 font-medium mb-1">
                Amount (৳ BDT) *
              </label>
              <input
                type="number"
                step="0.01"
                required
                value={formAmount}
                onChange={(e) => setFormAmount(e.target.value)}
                placeholder="0.00"
                className="w-full bg-[#111317] border border-[#262932] rounded px-3 py-1.5 text-xs text-gray-200 font-mono focus:outline-none focus:border-blue-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-gray-300 font-medium mb-1">
                Receiving Account *
              </label>
              <select
                value={formAccId}
                onChange={(e) => setFormAccId(e.target.value)}
                className="w-full bg-[#111317] border border-[#262932] rounded px-3 py-1.5 text-xs text-gray-200 focus:outline-none focus:border-blue-500"
              >
                {accounts.filter(a => a.status === 'ACTIVE').map((acc) => (
                  <option key={acc.id} value={acc.id}>{acc.name} ({formatBDT(acc.currentBalance)})</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs text-gray-300 font-medium mb-1">
                Category
              </label>
              <select
                value={formCatId}
                onChange={(e) => setFormCatId(e.target.value)}
                className="w-full bg-[#111317] border border-[#262932] rounded px-3 py-1.5 text-xs text-gray-200 focus:outline-none focus:border-blue-500"
              >
                {incomeCategories.map((cat) => (
                  <option key={cat.id} value={cat.id}>{cat.name}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs text-gray-300 font-medium mb-1">
              Description *
            </label>
            <input
              type="text"
              required
              value={formDesc}
              onChange={(e) => setFormDesc(e.target.value)}
              placeholder="e.g. October Client Retainer"
              className="w-full bg-[#111317] border border-[#262932] rounded px-3 py-1.5 text-xs text-gray-200 focus:outline-none focus:border-blue-500"
            />
          </div>

          <div>
            <label className="block text-xs text-gray-300 font-medium mb-1">
              Reference / Note
            </label>
            <input
              type="text"
              value={formRef}
              onChange={(e) => setFormRef(e.target.value)}
              placeholder="e.g. Inv #9021"
              className="w-full bg-[#111317] border border-[#262932] rounded px-3 py-1.5 text-xs text-gray-200 focus:outline-none focus:border-blue-500"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setIsRecordModalOpen(false)}
              className="px-3 py-1.5 bg-[#1a1d24] hover:bg-[#222631] text-gray-300 rounded text-xs transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded text-xs font-medium transition-colors"
            >
              Save Income
            </button>
          </div>
        </form>
      </Modal>

      {/* Details Modal */}
      <Modal
        isOpen={Boolean(selectedTx)}
        onClose={() => setSelectedTx(null)}
        title="Income Details"
      >
        {selectedTx && (
          <div className="space-y-3 text-xs">
            <div className="grid grid-cols-2 gap-2 bg-[#111317] border border-[#22252c] p-3 rounded">
              <div>
                <span className="text-gray-400">Date</span>
                <p className="font-mono text-gray-200">{selectedTx.date}</p>
              </div>
              <div>
                <span className="text-gray-400">Amount</span>
                <p className="font-mono font-semibold text-emerald-400">
                  +{formatBDT(selectedTx.amount)}
                </p>
              </div>
              <div>
                <span className="text-gray-400">Account</span>
                <p className="text-gray-200">{selectedTx.accountName}</p>
              </div>
              <div>
                <span className="text-gray-400">Category</span>
                <p className="text-gray-200">{selectedTx.category || 'General Income'}</p>
              </div>
              <div className="col-span-2">
                <span className="text-gray-400">Description</span>
                <p className="text-gray-200">{selectedTx.description}</p>
              </div>
              {selectedTx.reference && (
                <div className="col-span-2">
                  <span className="text-gray-400">Reference</span>
                  <p className="font-mono text-gray-300">{selectedTx.reference}</p>
                </div>
              )}
            </div>

            <div className="flex justify-end pt-2">
              <button
                type="button"
                onClick={() => setSelectedTx(null)}
                className="px-3 py-1.5 bg-[#1a1d24] hover:bg-[#222631] text-gray-300 rounded text-xs transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* Delete Confirmation */}
      <ConfirmModal
        isOpen={Boolean(txToDelete)}
        onClose={() => setTxToDelete(null)}
        onConfirm={confirmDelete}
        title="Delete Income Record"
        message={txToDelete ? `Are you sure you want to delete "${txToDelete.description}" (${formatBDT(txToDelete.amount)})? This will reverse the account credit.` : ''}
        confirmLabel="Delete"
        isDestructive={true}
      />
    </div>
  );
};
