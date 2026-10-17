import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Search,
  Eye,
  Trash2,
  Pencil,
  Download,
  Loader2,
  AlertCircle,
} from 'lucide-react';
import { formatBDT } from '../../lib/formatters';
import { useFinance } from '../../context/FinanceContext';
import { Transaction } from '../../mock/data';
import { Modal, ConfirmModal } from '../common/Modal';
import { TablePagination } from '../common/TablePagination';
import { useCursorPagination } from '../../hooks/useCursorPagination';
import { useDateFilter } from '../../context/DateFilterContext';
import { TableErrorRow, TableLoadingRow, TableEmptyRow } from '../common/StateViews';
import { DatePicker, getDhakaTodayISO, normalizeToISODate } from '../common/DatePicker';
import { useToast } from '../../context/ToastContext';
import { sortTransactions } from '../../lib/sorting';

export const TransactionsView: React.FC = () => {
  const { accounts, categories, deleteTransaction, editTransaction, authFetch } = useFinance();
  const { filter: dateFilter } = useDateFilter();
  const toast = useToast();

  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState('ALL');
  const [accountFilter, setAccountFilter] = useState('ALL');
  const [selectedTx, setSelectedTx] = useState<Transaction | null>(null);
  const [txToDelete, setTxToDelete] = useState<Transaction | null>(null);

  // Edit State
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingTx, setEditingTx] = useState<Transaction | null>(null);
  const [editDate, setEditDate] = useState<string>(getDhakaTodayISO());
  const [editAmount, setEditAmount] = useState('');
  const [editAccount, setEditAccount] = useState('');
  const [editCat, setEditCat] = useState('');
  const [editSubcat, setEditSubcat] = useState('');
  const [editDesc, setEditDesc] = useState('');
  const [editRef, setEditRef] = useState('');
  const [editErrorMsg, setEditErrorMsg] = useState<string | null>(null);
  const [isSavingEdit, setIsSavingEdit] = useState(false);

  // Paginated state
  const [items, setItems] = useState<Transaction[]>([]);
  const [totalCount, setTotalCount] = useState<number>(0);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
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

  // Reset pagination whenever filters or search query change
  const handleSearchChange = (val: string) => {
    setSearchQuery(val);
    resetPagination();
  };

  const handleTypeChange = (val: string) => {
    setTypeFilter(val);
    resetPagination();
  };

  const handleAccountChange = (val: string) => {
    setAccountFilter(val);
    resetPagination();
  };

  // Filter categories for the currently editing transaction type
  const editingAvailableCategories = useMemo(() => {
    if (!editingTx) return [];
    return categories.filter((c) => c.type === editingTx.type && !c.parentId);
  }, [categories, editingTx]);

  const editingSubcategories = useMemo(() => {
    if (!editingTx || !editCat) return [];
    const parent = categories.find((c) => c.type === editingTx.type && c.name === editCat && !c.parentId);
    if (!parent) return [];
    const childCats = categories.filter((c) => c.parentId === parent.id).map((c) => c.name);
    const arraySubs = parent.subcategories || [];
    return Array.from(new Set([...childCats, ...arraySubs]));
  }, [categories, editingTx, editCat]);

  const fetchTransactions = useCallback(async () => {
    try {
      setIsLoading(true);
      setErrorMsg(null);

      const params = new URLSearchParams();
      params.set('limit', String(pageSize));
      if (cursor) {
        params.set('cursor', cursor);
      } else if (currentPage > 1) {
        params.set('page', String(currentPage));
      }
      if (searchQuery.trim()) params.set('search', searchQuery.trim());
      if (typeFilter !== 'ALL') params.set('type', typeFilter);
      if (accountFilter !== 'ALL') params.set('accountId', accountFilter);
      if (dateFilter.startDate) params.set('startDate', dateFilter.startDate);
      if (dateFilter.endDate) params.set('endDate', dateFilter.endDate);

      const res = await authFetch(`/api/transactions?${params.toString()}`);
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Failed to fetch transactions');
      }

      const data = await res.json();
      const serverItems = data.items || [];
      const serverTotal = data.totalCount ?? serverItems.length;
      if (currentPage > 1 && serverItems.length === 0 && serverTotal > 0) {
        goToPreviousPage();
        return;
      }
      setItems(sortTransactions(serverItems));
      setTotalCount(data.totalCount ?? (data.items || []).length);
      setNextCursor(data.nextCursor || null);
      setPaginationMeta({
        hasNextPage: Boolean(data.hasNextPage),
        hasPreviousPage: Boolean(data.hasPreviousPage),
      });
    } catch (err: any) {
      console.error('Fetch transactions error:', err);
      setErrorMsg(err.message || 'Error loading transactions');
    } finally {
      setIsLoading(false);
    }
  }, [authFetch, pageSize, cursor, currentPage, searchQuery, typeFilter, accountFilter, dateFilter.startDate, dateFilter.endDate, setPaginationMeta]);

  useEffect(() => {
    fetchTransactions();
  }, [fetchTransactions]);

  // Check if a transaction matches active filters
  const matchesActiveFilters = useCallback(
    (tx: Transaction) => {
      const txDate = (tx.date || '').slice(0, 10);
      const matchesType = typeFilter === 'ALL' || tx.type === typeFilter;
      const matchesAcc = accountFilter === 'ALL' || tx.accountId === accountFilter;
      const matchesDate =
        (!dateFilter.startDate || txDate >= dateFilter.startDate) &&
        (!dateFilter.endDate || txDate <= dateFilter.endDate);
      const sTerm = searchQuery.trim().toLowerCase();
      const matchesSearch =
        !sTerm ||
        (tx.description && tx.description.toLowerCase().includes(sTerm)) ||
        (tx.reference && tx.reference.toLowerCase().includes(sTerm));
      return Boolean(matchesType && matchesAcc && matchesDate && matchesSearch);
    },
    [typeFilter, accountFilter, dateFilter.startDate, dateFilter.endDate, searchQuery]
  );

  const confirmDelete = async () => {
    if (!txToDelete) return;
    const deletedId = txToDelete.id;
    const res = await deleteTransaction(deletedId);
    if (res.success) {
      setItems((prev) => prev.filter((t) => t.id !== deletedId));
      setTotalCount((prev) => Math.max(0, prev - 1));
      toast.success('Record deleted successfully');
      setTxToDelete(null);
      await fetchTransactions();
    } else {
      toast.error(res.error || 'Failed to delete transaction');
      setTxToDelete(null);
    }
  };

  const handleOpenEdit = (tx: Transaction) => {
    setEditingTx(tx);
    setEditDate(normalizeToISODate(tx.date));
    setEditAmount(String(tx.amount));
    setEditAccount(tx.accountId);
    setEditCat(tx.category || '');
    setEditSubcat(tx.subcategory || '');
    setEditDesc(tx.description);
    setEditRef(tx.reference || '');
    setEditErrorMsg(null);
    setIsEditModalOpen(true);
  };

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
        category: editCat || undefined,
        subcategory: editSubcat || undefined,
        description: editDesc.trim(),
        reference: editRef.trim() || undefined,
      });

      if (!res.success || !res.transaction) {
        setEditErrorMsg(res.error || 'Failed to update transaction.');
        toast.error(res.error || 'Failed to save changes');
        return;
      }

      const updated = res.transaction;
      const matches = matchesActiveFilters(updated);

      if (matches) {
        setItems((prev) => {
          const replaced = prev.map((t) => (t.id === updated.id ? { ...t, ...updated } : t));
          return sortTransactions(replaced);
        });
      } else {
        setItems((prev) => prev.filter((t) => t.id !== updated.id));
        setTotalCount((prev) => Math.max(0, prev - 1));
      }

      toast.success('Transaction updated successfully');
      setIsEditModalOpen(false);
      setEditingTx(null);

      await fetchTransactions();
    } catch (err: any) {
      setEditErrorMsg(err.message || 'Failed to save changes.');
      toast.error(err.message || 'Failed to save changes');
    } finally {
      setIsSavingEdit(false);
    }
  };

  const handleExportCSV = async () => {
    try {
      const params = new URLSearchParams();
      params.set('all', 'true');
      if (searchQuery.trim()) params.set('search', searchQuery.trim());
      if (typeFilter !== 'ALL') params.set('type', typeFilter);
      if (accountFilter !== 'ALL') params.set('accountId', accountFilter);
      if (dateFilter.startDate) params.set('startDate', dateFilter.startDate);
      if (dateFilter.endDate) params.set('endDate', dateFilter.endDate);

      const res = await authFetch(`/api/transactions?${params.toString()}`);
      if (!res.ok) throw new Error('Failed to export transactions');
      const data = await res.json();
      const exportList: Transaction[] = data.transactions || [];

      const headers = ['Date', 'Type', 'Description', 'Category', 'Account', 'Destination Account', 'Amount', 'Direction', 'Reference'];
      const rows = exportList.map(t => [
        t.date,
        t.type,
        `"${(t.description || '').replace(/"/g, '""')}"`,
        `"${(t.category || '').replace(/"/g, '""')}"`,
        `"${(t.accountName || '').replace(/"/g, '""')}"`,
        `"${(t.destinationAccountName || '').replace(/"/g, '""')}"`,
        t.amount,
        t.direction,
        `"${(t.reference || '').replace(/"/g, '""')}"`,
      ]);

      const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
      const encodedUri = encodeURI(csvContent);
      const link = document.createElement('a');
      link.setAttribute('href', encodedUri);
      link.setAttribute('download', `AccountLadger_Transactions_${new Date().toISOString().slice(0, 10)}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err) {
      console.error('CSV export failed:', err);
    }
  };

  const getTypeBadge = (type: string) => {
    switch (type) {
      case 'INCOME':
        return <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-emerald-950 text-emerald-300 border border-emerald-800">Income</span>;
      case 'EXPENSE':
        return <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-rose-950 text-rose-300 border border-rose-800">Expense</span>;
      case 'TRANSFER':
        return <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-blue-950 text-blue-300 border border-blue-800">Transfer</span>;
      case 'LOAN_LENT':
        return <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-purple-950 text-purple-300 border border-purple-800">Loan Lent</span>;
      case 'LOAN_BORROWED':
        return <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-amber-950 text-amber-300 border border-amber-800">Borrowed</span>;
      case 'LOAN_REPAYMENT':
        return <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-teal-950 text-teal-300 border border-teal-800">Repayment</span>;
      default:
        return <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-gray-800 text-gray-300">{type}</span>;
    }
  };

  return (
    <div className="h-full flex flex-col min-h-0 w-full min-w-0 space-y-3">
      {/* Actions */}
      <div className="flex items-center justify-end gap-2 flex-shrink-0">
        <button
          onClick={handleExportCSV}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-[#1a1d24] hover:bg-[#222631] text-gray-300 border border-[#2a2e39] rounded text-xs transition-colors"
        >
          <Download className="w-3.5 h-3.5" />
          <span>Export CSV</span>
        </button>
      </div>

      {/* Search & Filter Bar */}
      <div className="bg-[#16181d] border border-[#22252c] rounded p-2.5 flex flex-col md:flex-row items-center justify-between gap-2.5 flex-shrink-0">
        <div className="relative w-full md:w-72">
          <Search className="w-3.5 h-3.5 text-gray-400 absolute left-2.5 top-2.5" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => handleSearchChange(e.target.value)}
            placeholder="Search transactions..."
            className="w-full bg-[#111317] border border-[#262932] rounded pl-8 pr-3 py-1.5 text-xs text-gray-200 focus:outline-none focus:border-blue-500 placeholder-gray-500"
          />
        </div>

        <div className="flex items-center gap-2 w-full md:w-auto text-xs">
          <select
            value={typeFilter}
            onChange={(e) => handleTypeChange(e.target.value)}
            className="bg-[#111317] border border-[#262932] rounded px-2.5 py-1.5 text-xs text-gray-300 focus:outline-none focus:border-blue-500"
          >
            <option value="ALL">All Types</option>
            <option value="INCOME">Income</option>
            <option value="EXPENSE">Expense</option>
            <option value="TRANSFER">Transfer</option>
            <option value="LOAN_LENT">Loan Given</option>
            <option value="LOAN_BORROWED">Loan Borrowed</option>
            <option value="LOAN_REPAYMENT">Loan Repayment</option>
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

      {/* Viewport-based Scrollable Table Container with Integrated Pagination Footer */}
      <div className="bg-[#16181d] border border-[#22252c] rounded overflow-hidden flex-1 min-h-0 flex flex-col">
        <div className="flex-1 min-h-0 overflow-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead className="sticky top-0 z-10 bg-[#121417] shadow-sm">
              <tr className="border-b border-[#22252c] text-gray-400 font-medium uppercase tracking-wider text-[10px]">
                <th className="py-2.5 px-3">Date</th>
                <th className="py-2.5 px-3">Type</th>
                <th className="py-2.5 px-3">Description</th>
                <th className="py-2.5 px-3">Category / Entity</th>
                <th className="py-2.5 px-3">Account</th>
                <th className="py-2.5 px-3">Reference</th>
                <th className="py-2.5 px-3 text-right">Amount</th>
                <th className="py-2.5 px-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#20232a]">
              {errorMsg ? (
                <TableErrorRow
                  colSpan={8}
                  title="Failed to load transactions"
                  description={errorMsg}
                  onRetry={fetchTransactions}
                />
              ) : isLoading ? (
                <TableLoadingRow
                  colSpan={8}
                  message="Loading transactions ledger..."
                />
              ) : items.length === 0 ? (
                <TableEmptyRow
                  colSpan={8}
                  title="No transactions found"
                  description={
                    searchQuery || typeFilter !== 'ALL' || accountFilter !== 'ALL' || dateFilter.startDate
                      ? 'No transactions match the selected filters or date range.'
                      : 'No transactions recorded yet.'
                  }
                />
              ) : (
                items.map((tx) => (
                  <tr key={tx.id} className="hover:bg-[#1a1d24] transition-colors">
                    <td className="py-2.5 px-3 text-gray-400 font-mono text-[11px] whitespace-nowrap">
                      {tx.date}
                    </td>
                    <td className="py-2.5 px-3 whitespace-nowrap">
                      {getTypeBadge(tx.type)}
                    </td>
                    <td className="py-2.5 px-3 font-medium text-gray-200">
                      {tx.description}
                    </td>
                    <td className="py-2.5 px-3 text-gray-400">
                      {tx.category ? (
                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-[#111317] border border-[#242730] text-[11px]">
                          <span>{tx.category}</span>
                          {tx.subcategory && (
                            <>
                              <span className="text-gray-500 font-normal">›</span>
                              <span className="text-blue-300 font-normal">{tx.subcategory}</span>
                            </>
                          )}
                        </span>
                      ) : (
                        tx.counterparty || '-'
                      )}
                    </td>
                    <td className="py-2.5 px-3 text-gray-300">
                      {tx.accountName}
                      {tx.destinationAccountName && (
                        <span className="text-gray-500"> → {tx.destinationAccountName}</span>
                      )}
                    </td>
                    <td className="py-2.5 px-3 text-gray-500 font-mono text-[11px]">
                      {tx.reference || '-'}
                    </td>
                    <td className={`py-2.5 px-3 text-right font-mono font-semibold whitespace-nowrap ${
                      tx.direction === 'INFLOW'
                        ? 'text-emerald-400'
                        : tx.direction === 'OUTFLOW'
                        ? 'text-gray-100'
                        : 'text-blue-400'
                    }`}>
                      {tx.direction === 'INFLOW' ? `+${formatBDT(tx.amount)}` : tx.direction === 'OUTFLOW' ? `-${formatBDT(tx.amount)}` : formatBDT(tx.amount)}
                    </td>
                    <td className="py-2.5 px-3 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        {(tx.type === 'INCOME' || tx.type === 'EXPENSE') && (
                          <button
                            onClick={() => handleOpenEdit(tx)}
                            title="Edit Record"
                            className="p-1 text-gray-400 hover:text-blue-400 hover:bg-[#22252e] rounded transition-colors"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                        )}
                        <button
                          onClick={() => setSelectedTx(tx)}
                          title="View Details"
                          className="p-1 text-gray-400 hover:text-gray-200 hover:bg-[#22252e] rounded"
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => setTxToDelete(tx)}
                          title="Reverse Transaction"
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

        {/* Integrated Pagination Footer directly attached below the table body */}
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
          currentPage={currentPage}
          maxIndexedPage={maxIndexedPage}
          onGoToPage={goToPage}
          onErrorToast={toast.error}
        />
      </div>

      {/* Edit Modal for Income / Expense */}
      <Modal
        isOpen={isEditModalOpen}
        onClose={() => {
          if (!isSavingEdit) {
            setIsEditModalOpen(false);
            setEditingTx(null);
          }
        }}
        title={`Edit ${editingTx?.type === 'INCOME' ? 'Income' : 'Expense'} Transaction`}
      >
        <form onSubmit={handleSaveEdit} className="space-y-3">
          {editErrorMsg && (
            <div className="p-2.5 bg-red-950/40 border border-red-800/60 rounded flex items-center gap-2 text-xs text-red-300">
              <AlertCircle className="w-4 h-4 flex-shrink-0 text-red-400" />
              <span>{editErrorMsg}</span>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <DatePicker
                value={editDate}
                onChange={setEditDate}
                label="Date *"
                required
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
                value={editAmount}
                onChange={(e) => setEditAmount(e.target.value)}
                placeholder="0.00"
                className="w-full bg-[#111317] border border-[#262932] rounded px-3 py-1.5 text-xs text-gray-200 font-mono focus:outline-none focus:border-blue-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-gray-300 font-medium mb-1">
                Account *
              </label>
              <select
                value={editAccount}
                onChange={(e) => setEditAccount(e.target.value)}
                className="w-full bg-[#111317] border border-[#262932] rounded px-3 py-1.5 text-xs text-gray-200 focus:outline-none focus:border-blue-500"
              >
                {accounts.map((acc) => (
                  <option key={acc.id} value={acc.id}>
                    {acc.name} ({formatBDT(acc.currentBalance)})
                  </option>
                ))}
              </select>
            </div>

            {editingAvailableCategories.length > 0 && (
              <div>
                <label className="block text-xs text-gray-300 font-medium mb-1">
                  Category
                </label>
                <select
                  value={editCat}
                  onChange={(e) => {
                    setEditCat(e.target.value);
                    setEditSubcat('');
                  }}
                  className="w-full bg-[#111317] border border-[#262932] rounded px-3 py-1.5 text-xs text-gray-200 focus:outline-none focus:border-blue-500"
                >
                  <option value="">Select Category</option>
                  {editingAvailableCategories.map((c) => (
                    <option key={c.id} value={c.name}>{c.name}</option>
                  ))}
                </select>
              </div>
            )}
          </div>

          {editingSubcategories.length > 0 && (
            <div>
              <label className="block text-xs text-gray-300 font-medium mb-1">
                Subcategory (Optional)
              </label>
              <select
                value={editSubcat}
                onChange={(e) => setEditSubcat(e.target.value)}
                className="w-full bg-[#111317] border border-[#262932] rounded px-3 py-1.5 text-xs text-gray-200 focus:outline-none focus:border-blue-500"
              >
                <option value="">No Subcategory</option>
                {editingSubcategories.map((sub) => (
                  <option key={sub} value={sub}>{sub}</option>
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
              className="w-full bg-[#111317] border border-[#262932] rounded px-3 py-1.5 text-xs text-gray-200 focus:outline-none focus:border-blue-500"
            />
          </div>

          <div>
            <label className="block text-xs text-gray-300 font-medium mb-1">
              Reference / Note
            </label>
            <input
              type="text"
              value={editRef}
              onChange={(e) => setEditRef(e.target.value)}
              className="w-full bg-[#111317] border border-[#262932] rounded px-3 py-1.5 text-xs text-gray-200 focus:outline-none focus:border-blue-500"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              disabled={isSavingEdit}
              onClick={() => {
                setIsEditModalOpen(false);
                setEditingTx(null);
              }}
              className="px-3 py-1.5 bg-[#1a1d24] hover:bg-[#222631] text-gray-300 rounded text-xs transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSavingEdit}
              className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded text-xs font-medium transition-colors flex items-center gap-1.5"
            >
              {isSavingEdit && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              <span>{isSavingEdit ? 'Saving Changes...' : 'Save Changes'}</span>
            </button>
          </div>
        </form>
      </Modal>

      {/* Details Modal */}
      <Modal
        isOpen={Boolean(selectedTx)}
        onClose={() => setSelectedTx(null)}
        title="Transaction Details"
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
                <p className={`font-mono font-semibold ${selectedTx.direction === 'INFLOW' ? 'text-emerald-400' : 'text-gray-100'}`}>
                  {formatBDT(selectedTx.amount)}
                </p>
              </div>
              <div>
                <span className="text-gray-400">Type</span>
                <p className="text-gray-200">{selectedTx.type}</p>
              </div>
              <div>
                <span className="text-gray-400">Account</span>
                <p className="text-gray-200">{selectedTx.accountName}</p>
              </div>
              {selectedTx.category && (
                <div className="col-span-2">
                  <span className="text-gray-400">Category</span>
                  <p className="text-gray-200">
                    {selectedTx.category}
                    {selectedTx.subcategory && ` › ${selectedTx.subcategory}`}
                  </p>
                </div>
              )}
              {selectedTx.destinationAccountName && (
                <div className="col-span-2">
                  <span className="text-gray-400">Destination Account</span>
                  <p className="text-gray-200">{selectedTx.destinationAccountName}</p>
                </div>
              )}
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

      {/* Delete/Reverse Confirmation */}
      <ConfirmModal
        isOpen={Boolean(txToDelete)}
        onClose={() => setTxToDelete(null)}
        onConfirm={confirmDelete}
        title="Reverse Transaction"
        message={txToDelete ? `Reverse transaction "${txToDelete.description}" (${formatBDT(txToDelete.amount)})? This will adjust account balances.` : ''}
        confirmLabel="Reverse"
        isDestructive={true}
      />
    </div>
  );
};
