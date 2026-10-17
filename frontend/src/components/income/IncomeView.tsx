import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Plus,
  Search,
  Eye,
  Trash2,
  Pencil,
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

interface IncomeViewProps {
  onOpenAddIncomeModal?: () => void;
  onSuccessNotification: (msg: string) => void;
}

export const IncomeView: React.FC<IncomeViewProps> = ({
  onSuccessNotification,
}) => {
  const { categories, accounts, deleteTransaction, addIncome, editTransaction, authFetch } = useFinance();
  const { filter: dateFilter } = useDateFilter();
  const toast = useToast();

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('ALL');
  const [accountFilter, setAccountFilter] = useState('ALL');

  // Modals
  const [isRecordModalOpen, setIsRecordModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [selectedTx, setSelectedTx] = useState<Transaction | null>(null);
  const [txToDelete, setTxToDelete] = useState<Transaction | null>(null);
  const [editingTx, setEditingTx] = useState<Transaction | null>(null);

  // Form state (Add Income)
  const [formDate, setFormDate] = useState<string>(getDhakaTodayISO());
  const [formCat, setFormCat] = useState('');
  const [formSubcat, setFormSubcat] = useState('');
  const [formAccId, setFormAccId] = useState(accounts[0]?.id || '');
  const [formAmount, setFormAmount] = useState('');
  const [formDesc, setFormDesc] = useState('');
  const [formRef, setFormRef] = useState('');
  const [formValidationMsg, setFormValidationMsg] = useState<string | null>(null);
  const [isSavingAdd, setIsSavingAdd] = useState(false);

  // Form state (Edit Income)
  const [editDate, setEditDate] = useState<string>(getDhakaTodayISO());
  const [editCat, setEditCat] = useState('');
  const [editSubcat, setEditSubcat] = useState('');
  const [editAccount, setEditAccount] = useState('');
  const [editAmount, setEditAmount] = useState('');
  const [editDesc, setEditDesc] = useState('');
  const [editRef, setEditRef] = useState('');
  const [editErrorMsg, setEditErrorMsg] = useState<string | null>(null);
  const [isSavingEdit, setIsSavingEdit] = useState(false);

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

  // Filter all income categories
  const allIncomeCategories = useMemo(
    () => categories.filter((c) => c.type === 'INCOME'),
    [categories]
  );

  // Main (parent) income categories
  const mainIncomeCategories = useMemo(
    () => allIncomeCategories.filter((c) => !c.parentId),
    [allIncomeCategories]
  );

  // Helper to extract subcategories for a given main category name
  const getSubcategoriesForCategory = useCallback(
    (mainCatName: string): string[] => {
      const parent = allIncomeCategories.find((c) => c.name === mainCatName && !c.parentId);
      if (!parent) return [];

      const childCategories = allIncomeCategories
        .filter((c) => c.parentId === parent.id)
        .map((c) => c.name);

      const arraySubs = parent.subcategories || [];
      return Array.from(new Set([...childCategories, ...arraySubs]));
    },
    [allIncomeCategories]
  );

  // Set default category when categories load
  useEffect(() => {
    if (!formCat && mainIncomeCategories.length > 0) {
      setFormCat(mainIncomeCategories[0].name);
    }
  }, [mainIncomeCategories, formCat]);

  // Set default account when accounts load
  useEffect(() => {
    if (!formAccId && accounts.length > 0) {
      setFormAccId(accounts[0].id);
    }
  }, [accounts, formAccId]);

  // Available subcategories for Add Income Form
  const formSubcategories = useMemo(
    () => getSubcategoriesForCategory(formCat),
    [getSubcategoriesForCategory, formCat]
  );

  // Available subcategories for Edit Income Form
  const editSubcategories = useMemo(
    () => getSubcategoriesForCategory(editCat),
    [getSubcategoriesForCategory, editCat]
  );

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
        throw new Error(data.error || 'Failed to load income records');
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
    } catch (err: any) {
      console.error('Fetch income error:', err);
      setErrorMsg(err.message || 'Error fetching income');
    } finally {
      setIsLoading(false);
    }
  }, [authFetch, pageSize, cursor, currentPage, searchQuery, categoryFilter, accountFilter, dateFilter.startDate, dateFilter.endDate, setPaginationMeta]);

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

  const confirmDelete = async () => {
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
    await fetchIncome();
  };

  const handleSaveIncome = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormValidationMsg(null);
    const amountNum = parseFloat(formAmount);
    if (isNaN(amountNum) || amountNum <= 0) {
      setFormValidationMsg('Please enter a valid amount greater than 0.');
      return;
    }
    if (!formDesc.trim()) {
      setFormValidationMsg('Please enter a description for the income.');
      return;
    }

    try {
      setIsSavingAdd(true);
      const res = await addIncome({
        accountId: formAccId || accounts[0]?.id || '',
        category: formCat || mainIncomeCategories[0]?.name || 'General Income',
        subcategory: formSubcat || undefined,
        amount: amountNum,
        date: formDate,
        description: formDesc.trim(),
        reference: formRef.trim() || undefined,
      });

      if (!res.success || !res.transaction) {
        setFormValidationMsg(res.error || 'Failed to record income.');
        toast.error(res.error || 'Failed to record income.');
        return;
      }

      const newTx = res.transaction;
      if (matchesActiveFilters(newTx)) {
        setItems((prev) => sortTransactions([newTx, ...prev]));
      }
      setTotalCount((prev) => prev + 1);

      toast.success('Income added successfully');
      setIsRecordModalOpen(false);
      setFormAmount('');
      setFormDesc('');
      setFormRef('');
      setFormSubcat('');

      await fetchIncome();
    } catch (err: any) {
      setFormValidationMsg(err.message || 'Failed to record income.');
      toast.error(err.message || 'Failed to record income.');
    } finally {
      setIsSavingAdd(false);
    }
  };

  // Open Edit Modal with prefilled values
  const handleOpenEdit = (tx: Transaction) => {
    setEditingTx(tx);
    setEditDate(normalizeToISODate(tx.date));
    setEditAmount(String(tx.amount));
    setEditAccount(tx.accountId);
    setEditCat(tx.category || mainIncomeCategories[0]?.name || 'General Income');
    setEditSubcat(tx.subcategory || '');
    setEditDesc(tx.description);
    setEditRef(tx.reference || '');
    setEditErrorMsg(null);
    setIsEditModalOpen(true);
  };

  // Save Edit Handler with immediate deterministic re-sort and server pagination reconciliation
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
        setEditErrorMsg(res.error || 'Failed to update income record.');
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

      if (selectedTx && selectedTx.id === updated.id) {
        setSelectedTx(updated);
      }

      toast.success('Income updated successfully');
      setIsEditModalOpen(false);
      setEditingTx(null);

      await fetchIncome();
    } catch (err: any) {
      setEditErrorMsg(err.message || 'Failed to save changes.');
      toast.error(err.message || 'Failed to save changes');
    } finally {
      setIsSavingEdit(false);
    }
  };

  return (
    <div className="h-full flex flex-col min-h-0 w-full min-w-0 space-y-3">
      {/* Actions */}
      <div className="flex items-center justify-end gap-2 flex-shrink-0">
        <button
          onClick={() => {
            setFormDate(getDhakaTodayISO());
            setFormValidationMsg(null);
            setIsRecordModalOpen(true);
          }}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded text-xs font-medium transition-colors"
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
            placeholder="Search income..."
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
            {incomeCategoriesList(allIncomeCategories).map((c) => (
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

      {/* Main Income Table with Integrated Pagination Footer */}
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
                    onClick: () => {
                      setFormDate(getDhakaTodayISO());
                      setFormValidationMsg(null);
                      setIsRecordModalOpen(true);
                    },
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
                      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-[#111317] border border-[#242730] text-[11px]">
                        <span>{tx.category || 'General Income'}</span>
                        {tx.subcategory && (
                          <>
                            <span className="text-gray-500 font-normal">›</span>
                            <span className="text-blue-300 font-normal">{tx.subcategory}</span>
                          </>
                        )}
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
                          onClick={() => handleOpenEdit(tx)}
                          title="Edit Income"
                          className="p-1 text-gray-400 hover:text-blue-400 hover:bg-[#22252e] rounded transition-colors"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
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

        {/* Integrated Pagination Footer attached directly beneath the table */}
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

      {/* Record Income Modal */}
      <Modal
        isOpen={isRecordModalOpen}
        onClose={() => setIsRecordModalOpen(false)}
        title="Record Income"
      >
        <form onSubmit={handleSaveIncome} className="space-y-3">
          {formValidationMsg && (
            <div className="p-2.5 bg-red-950/40 border border-red-800/60 rounded flex items-center gap-2 text-xs text-red-300">
              <AlertCircle className="w-4 h-4 flex-shrink-0 text-red-400" />
              <span>{formValidationMsg}</span>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <DatePicker
                value={formDate}
                onChange={setFormDate}
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
                Main Category *
              </label>
              <select
                value={formCat}
                onChange={(e) => {
                  setFormCat(e.target.value);
                  setFormSubcat('');
                }}
                className="w-full bg-[#111317] border border-[#262932] rounded px-3 py-1.5 text-xs text-gray-200 focus:outline-none focus:border-blue-500"
              >
                {mainIncomeCategories.map((cat) => (
                  <option key={cat.id} value={cat.name}>{cat.name}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Subcategory (Only shown if main category has subcategories) */}
          {formSubcategories.length > 0 && (
            <div>
              <label className="block text-xs text-gray-300 font-medium mb-1">
                Subcategory (Optional)
              </label>
              <select
                value={formSubcat}
                onChange={(e) => setFormSubcat(e.target.value)}
                className="w-full bg-[#111317] border border-[#262932] rounded px-3 py-1.5 text-xs text-gray-200 focus:outline-none focus:border-blue-500"
              >
                <option value="">No Subcategory</option>
                {formSubcategories.map((sub) => (
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
              value={formDesc}
              onChange={(e) => setFormDesc(e.target.value)}
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
              className="w-full bg-[#111317] border border-[#262932] rounded px-3 py-1.5 text-xs text-gray-200 focus:outline-none focus:border-blue-500"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              disabled={isSavingAdd}
              onClick={() => setIsRecordModalOpen(false)}
              className="px-3 py-1.5 bg-[#1a1d24] hover:bg-[#222631] text-gray-300 rounded text-xs transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSavingAdd}
              className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded text-xs font-medium transition-colors flex items-center gap-1.5"
            >
              {isSavingAdd && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              <span>{isSavingAdd ? 'Saving...' : 'Save Income'}</span>
            </button>
          </div>
        </form>
      </Modal>

      {/* Edit Income Modal */}
      <Modal
        isOpen={isEditModalOpen}
        onClose={() => {
          if (!isSavingEdit) {
            setIsEditModalOpen(false);
            setEditingTx(null);
          }
        }}
        title="Edit Income Record"
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
                Receiving Account *
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
                className="w-full bg-[#111317] border border-[#262932] rounded px-3 py-1.5 text-xs text-gray-200 focus:outline-none focus:border-blue-500"
              >
                {mainIncomeCategories.map((cat) => (
                  <option key={cat.id} value={cat.name}>{cat.name}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Subcategory (Only shown if main category has subcategories) */}
          {editSubcategories.length > 0 && (
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
                {editSubcategories.map((sub) => (
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
                <p className="text-gray-200">
                  {selectedTx.category || 'General Income'}
                  {selectedTx.subcategory && ` › ${selectedTx.subcategory}`}
                </p>
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

// Helper to list categories with subcategories indented
function incomeCategoriesList(allCats: any[]) {
  const main = allCats.filter(c => !c.parentId);
  return main;
}
