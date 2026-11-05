import React, { useState, useEffect, useCallback } from 'react';
import {
  Plus,
  FileSpreadsheet,
  Trash2,
  Search,
  Eye,
  Pencil,
} from 'lucide-react';
import { formatBDT, formatDate } from '../../lib/formatters';
import { useFinance } from '../../context/FinanceContext';
import { Transaction } from '../../mock/data';
import { ConfirmModal } from '../common/Modal';
import { TablePagination } from '../common/TablePagination';
import { useCursorPagination } from '../../hooks/useCursorPagination';
import { useDateFilter } from '../../context/DateFilterContext';
import { TableErrorRow, TableLoadingRow, TableEmptyRow } from '../common/StateViews';
import { useToast } from '../../context/ToastContext';
import { sortTransactions } from '../../lib/sorting';
import { useRouter, useSearchParams } from '../../lib/router';
import { AddExpenseModal } from './AddExpenseModal';
import { BulkEntryTab } from './BulkEntryTab';
import { EditExpenseModal } from './EditExpenseModal';
import { ExpenseDetailsModal } from './ExpenseDetailsModal';
import { QuickAccountModal } from './QuickAccountModal';
import { useExpenseCategories } from './useExpenseCategories';
import { getErrorMessage } from '../../lib/errors';

interface ExpensesViewProps {
  onOpenSingleExpenseModal?: () => void;
  onSuccessNotification: (msg: string) => void;
}

export const ExpensesView: React.FC<ExpensesViewProps> = ({
  onSuccessNotification,
}) => {
  const { accounts, deleteTransaction, authFetch } = useFinance();
  const { allExpenseCategories } = useExpenseCategories();
  const { filter: dateFilter } = useDateFilter();
  const toast = useToast();

  const router = useRouter();
  const searchParams = useSearchParams();
  const urlTab = searchParams.get('tab');
  const activeTab = urlTab === 'bulk' ? 'BULK_ENTRY' : 'RECORDS';
  const setActiveTab = (tab: 'RECORDS' | 'BULK_ENTRY') => {
    router.replace(tab === 'BULK_ENTRY' ? '/expenses?tab=bulk' : '/expenses?tab=records');
  };

  const [isAddAccountModalOpen, setIsAddAccountModalOpen] = useState(false);
  const [preferredAccountId, setPreferredAccountId] = useState('');

  // Search & Filter
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('ALL');
  const [accountFilter, setAccountFilter] = useState('ALL');

  // Modals
  const [isAddExpenseOpen, setIsAddExpenseOpen] = useState(false);
    const [selectedTx, setSelectedTx] = useState<Transaction | null>(null);
  const [txToDelete, setTxToDelete] = useState<Transaction | null>(null);
  const [editingTx, setEditingTx] = useState<Transaction | null>(null);

  // Paginated state
  const [items, setItems] = useState<Transaction[]>([]);
  const [totalCount, setTotalCount] = useState<number>(0);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const {
    pageSize,
    cursor,
    pageIndex,
    currentPage,
    maxIndexedPage,
    hasNextPage,
    hasPreviousPage,
    setPageSize,
    goToNextPage,
    goToPreviousPage,
    goToPage,
    resetPagination,
    setPaginationMeta,
  } = useCursorPagination({ initialPageSize: 50 });

  // Reset pagination when date filter changes
  useEffect(() => {
    resetPagination();
  }, [dateFilter.startDate, dateFilter.endDate, dateFilter.preset, resetPagination]);

  const fetchExpenses = useCallback(async () => {
    try {
      setIsLoading(true);
      setErrorMsg(null);

      const params = new URLSearchParams();
      params.set('type', 'EXPENSE');
      params.set('limit', String(pageSize));
      if (cursor) {
        params.set('cursor', cursor);
      } else if (currentPage > 1) {
        params.set('page', String(currentPage));
      }
      if (searchQuery.trim()) params.set('search', searchQuery.trim());
      if (categoryFilter !== 'ALL') params.set('category', categoryFilter);
      if (accountFilter !== 'ALL') params.set('accountId', accountFilter);
      if (dateFilter.startDate) params.set('startDate', dateFilter.startDate);
      if (dateFilter.endDate) params.set('endDate', dateFilter.endDate);

      const res = await authFetch(`/api/transactions?${params.toString()}`);
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Failed to fetch expenses');
      }

      const data = await res.json();
      const serverItems = data.items || [];
      const serverTotal = data.totalCount ?? serverItems.length;

      if (currentPage > 1 && serverItems.length === 0 && serverTotal > 0) {
        goToPreviousPage();
        return;
      }

      setItems(sortTransactions(serverItems));
      setTotalCount(serverTotal);
      setNextCursor(data.nextCursor || null);
      setPaginationMeta({
        hasNextPage: Boolean(data.hasNextPage),
        hasPreviousPage: Boolean(data.hasPreviousPage),
        nextCursor: data.nextCursor || null,
      });
    } catch (err: unknown) {
      console.error('Fetch expenses error:', err);
      setErrorMsg(getErrorMessage(err) || 'Error loading expenses');
    } finally {
      setIsLoading(false);
    }
  }, [
    authFetch,
    pageSize,
    cursor,
    currentPage,
    searchQuery,
    categoryFilter,
    accountFilter,
    dateFilter.startDate,
    dateFilter.endDate,
    setPaginationMeta,
  ]);

  useEffect(() => {
    fetchExpenses();
  }, [fetchExpenses]);

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

  // Check if a transaction matches active filters
  const matchesActiveFilters = useCallback(
    (tx: Transaction) => {
      const txDate = (tx.date || '').slice(0, 10);
      const matchesCat = categoryFilter === 'ALL' || tx.category === categoryFilter;
      const matchesAcc = accountFilter === 'ALL' || tx.accountId === accountFilter;
      const matchesDate =
        (!dateFilter.startDate || txDate >= dateFilter.startDate) &&
        (!dateFilter.endDate || txDate <= dateFilter.endDate);
      const sTerm = searchQuery.trim().toLowerCase();
      const matchesSearch =
        !sTerm ||
        (tx.description && tx.description.toLowerCase().includes(sTerm)) ||
        (tx.reference && tx.reference.toLowerCase().includes(sTerm));
      return Boolean(matchesCat && matchesAcc && matchesDate && matchesSearch);
    },
    [categoryFilter, accountFilter, dateFilter.startDate, dateFilter.endDate, searchQuery]
  );

  const handleExpenseAdded = async (newTx: Transaction) => {
    if (matchesActiveFilters(newTx)) {
      setItems((prev) => sortTransactions([newTx, ...prev]));
    }
    setTotalCount((prev) => prev + 1);
    await fetchExpenses();
  };

  // Immediate deterministic re-sort, then reconcile pagination, counts and page boundaries with the backend.
  const handleExpenseEdited = async (updated: Transaction) => {
    if (matchesActiveFilters(updated)) {
      setItems((prev) => sortTransactions(prev.map((t) => (t.id === updated.id ? { ...t, ...updated } : t))));
    } else {
      // Record moved outside active date range or filters: remove from current view
      setItems((prev) => prev.filter((t) => t.id !== updated.id));
      setTotalCount((prev) => Math.max(0, prev - 1));
    }
    if (selectedTx && selectedTx.id === updated.id) {
      setSelectedTx(updated);
    }
    await fetchExpenses();
  };

  const confirmDeleteExpense = async () => {
    if (!txToDelete) return;
    const targetId = txToDelete.id;
    const res = await deleteTransaction(targetId);
    if (res && res.success === false) {
      toast.error(res.error || 'Failed to delete record');
      return;
    }
    setItems((prev) => prev.filter((t) => t.id !== targetId));
    setTotalCount((prev) => Math.max(0, prev - 1));
    toast.success('Record deleted successfully');
    setTxToDelete(null);
    await fetchExpenses();
  };

  return (
    <div className="h-full flex flex-col min-h-0 w-full min-w-0 space-y-3">
      {/* Tabs & Actions */}
      <div className="flex items-center justify-between border-b border-line text-xs flex-shrink-0 gap-2">
        <div className="flex">
          <button
            onClick={() => setActiveTab('RECORDS')}
            className={`py-2 px-4 font-medium transition-colors border-b-2 -mb-px ${
              activeTab === 'RECORDS'
                ? 'border-blue-500 text-blue-400 bg-surface'
                : 'border-transparent text-gray-400 hover:text-gray-200'
            }`}
          >
            Expenses
          </button>
          <button
            onClick={() => setActiveTab('BULK_ENTRY')}
            className={`py-2 px-4 font-medium transition-colors border-b-2 -mb-px flex items-center gap-1.5 ${
              activeTab === 'BULK_ENTRY'
                ? 'border-blue-500 text-blue-400 bg-surface'
                : 'border-transparent text-gray-400 hover:text-gray-200'
            }`}
          >
            <FileSpreadsheet className="w-3.5 h-3.5" />
            <span>Daily Bulk Entry</span>
          </button>
        </div>
        <div className="pb-1 sm:pb-0">
          <button
            onClick={() => {
              setIsAddExpenseOpen(true);
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded text-xs font-medium transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Expense</span>
          </button>
        </div>
      </div>

      {activeTab === 'RECORDS' ? (
        <>
          {/* Search & Filter Toolbar */}
          <div className="bg-surface border border-line rounded p-2.5 flex flex-col md:flex-row items-center justify-between gap-2.5 flex-shrink-0">
            <div className="relative w-full md:w-72">
              <Search className="w-3.5 h-3.5 text-gray-400 absolute left-2.5 top-2.5" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => handleSearchChange(e.target.value)}
                placeholder="Search expenses..."
                className="w-full bg-app border border-line-strong rounded pl-8 pr-3 py-1.5 text-xs text-gray-200 focus:outline-none focus:border-blue-500 placeholder-gray-500"
              />
            </div>

            <div className="flex items-center gap-2 w-full md:w-auto text-xs">
              <select
                value={categoryFilter}
                onChange={(e) => handleCategoryChange(e.target.value)}
                className="bg-app border border-line-strong rounded px-2.5 py-1.5 text-xs text-gray-300 focus:outline-none focus:border-blue-500"
              >
                <option value="ALL">All Categories</option>
                {allExpenseCategories.map((c) => (
                  <option key={c.id} value={c.name}>
                    {c.parentId ? `↳ ${c.name}` : c.name}
                  </option>
                ))}
              </select>

              <select
                value={accountFilter}
                onChange={(e) => handleAccountChange(e.target.value)}
                className="bg-app border border-line-strong rounded px-2.5 py-1.5 text-xs text-gray-300 focus:outline-none focus:border-blue-500"
              >
                <option value="ALL">All Accounts</option>
                {accounts.map((a) => (
                  <option key={a.id} value={a.id}>{a.name}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Seamless Table Section with Integrated Pinned Footer */}
          <div className="bg-surface border border-line rounded overflow-hidden flex-1 min-h-0 flex flex-col">
            <div className="flex-1 min-h-0 overflow-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="sticky top-0 z-10 bg-surface-sunken shadow-sm">
                  <tr className="border-b border-line text-gray-400 font-medium uppercase tracking-wider text-[10px]">
                    <th className="py-2.5 px-3">Date</th>
                    <th className="py-2.5 px-3">Description</th>
                    <th className="py-2.5 px-3">Category & Subcategory</th>
                    <th className="py-2.5 px-3">Account</th>
                    <th className="py-2.5 px-3">Reference</th>
                    <th className="py-2.5 px-3 text-right">Amount</th>
                    <th className="py-2.5 px-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-divider">
                  {errorMsg ? (
                    <TableErrorRow
                      colSpan={7}
                      title="Failed to load expenses"
                      description={errorMsg}
                      onRetry={fetchExpenses}
                    />
                  ) : isLoading ? (
                    <TableLoadingRow
                      colSpan={7}
                      message="Loading expenses..."
                    />
                  ) : items.length === 0 ? (
                    <TableEmptyRow
                      colSpan={7}
                      title="No expenses found"
                      description={
                        searchQuery || categoryFilter !== 'ALL' || accountFilter !== 'ALL' || dateFilter.startDate
                          ? 'No expense transactions match your filters or selected date range.'
                          : undefined
                      }
                      action={{
                        label: 'Add Expense',
                        onClick: () => setIsAddExpenseOpen(true),
                      }}
                    />
                  ) : (
                    items.map((tx) => (
                      <tr key={tx.id} className="hover:bg-surface-hover transition-colors">
                        <td className="py-2.5 px-3 text-gray-400 font-mono text-[11px] whitespace-nowrap">
                          {formatDate(tx.date)}
                        </td>
                        <td className="py-2.5 px-3 font-medium text-gray-200">
                          {tx.description && tx.description !== 'Daily Expense' ? tx.description : (tx.desc || (tx.category ? `${tx.category} Expense` : 'Expense'))}
                        </td>
                        <td className="py-2.5 px-3 text-gray-400">
                          <div className="flex flex-col gap-0.5">
                            <span className="px-1.5 py-0.5 rounded bg-app border border-line-strong text-[11px] text-gray-300 w-max">
                              {tx.category || 'General Expense'}
                            </span>
                            {tx.subcategory && (
                              <span className="text-[10px] text-blue-400 font-mono">
                                ↳ {tx.subcategory}
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="py-2.5 px-3 text-gray-300">
                          {tx.accountName}
                        </td>
                        <td className="py-2.5 px-3 text-gray-500 font-mono text-[11px]">
                          {tx.reference || '-'}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono font-semibold text-gray-100 whitespace-nowrap">
                          -{formatBDT(tx.amount)}
                        </td>
                        <td className="py-2.5 px-3 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              onClick={() => setEditingTx(tx)}
                              title="Edit Expense"
                              className="p-1 text-gray-400 hover:text-blue-400 hover:bg-line-soft rounded"
                            >
                              <Pencil className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => setSelectedTx(tx)}
                              title="View Details"
                              className="p-1 text-gray-400 hover:text-gray-200 hover:bg-line-soft rounded"
                            >
                              <Eye className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => setTxToDelete(tx)}
                              title="Delete Record"
                              className="p-1 text-gray-400 hover:text-red-400 hover:bg-line-soft rounded"
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

            {/* Pinned Pagination Controls Attached to Table Body */}
            <TablePagination
              pageSize={pageSize}
              onPageSizeChange={setPageSize}
              hasNextPage={hasNextPage}
              hasPreviousPage={hasPreviousPage}
              onNextPage={() => goToNextPage(nextCursor)}
              onPreviousPage={goToPreviousPage}
              onGoToPage={goToPage}
              currentPage={currentPage}
              maxIndexedPage={maxIndexedPage}
              isLoading={isLoading}
              itemCount={items.length}
              totalCount={totalCount}
              onErrorToast={toast.error}
            />
          </div>
        </>
      ) : null}

      {/* Stays mounted so typed rows survive switching tabs. */}
      <div className={activeTab === 'BULK_ENTRY' ? 'contents' : 'hidden'}>
        <BulkEntryTab
          preferredAccountId={preferredAccountId}
          onAddAccount={() => setIsAddAccountModalOpen(true)}
          onCancel={() => setActiveTab('RECORDS')}
          onSaved={() => {
            resetPagination();
            fetchExpenses();
          }}
          onSuccessNotification={onSuccessNotification}
        />
      </div>

      {isAddExpenseOpen && <AddExpenseModal onClose={() => setIsAddExpenseOpen(false)} onSaved={handleExpenseAdded} />}

      {editingTx && <EditExpenseModal tx={editingTx} onClose={() => setEditingTx(null)} onSaved={handleExpenseEdited} />}

      {selectedTx && <ExpenseDetailsModal selectedTx={selectedTx} onClose={() => setSelectedTx(null)} />}

      {/* Delete Confirmation Modal */}
      <ConfirmModal
        isOpen={Boolean(txToDelete)}
        onClose={() => setTxToDelete(null)}
        onConfirm={confirmDeleteExpense}
        title="Delete Expense Record"
        message={txToDelete ? `Are you sure you want to delete the expense "${txToDelete.description}" of ${formatBDT(txToDelete.amount)}? The amount will be refunded back to ${txToDelete.accountName}.` : ''}
        confirmLabel="Delete"
        isDestructive={true}
      />

      {isAddAccountModalOpen && (
        <QuickAccountModal
          onClose={() => setIsAddAccountModalOpen(false)}
          onCreated={(accountId) => {
            setPreferredAccountId(accountId);
            setIsAddAccountModalOpen(false);
          }}
        />
      )}
    </div>
  );
};
