import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Plus,
  FileSpreadsheet,
  Trash2,
  Search,
  Eye,
  Pencil,
  AlertTriangle,
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

interface ExpensesViewProps {
  onOpenSingleExpenseModal?: () => void;
  onSuccessNotification: (msg: string) => void;
}

export const ExpensesView: React.FC<ExpensesViewProps> = ({
  onSuccessNotification,
}) => {
  const {
    accounts,
    categories,
    addExpense,
    editTransaction,
    addBulkExpenses,
    deleteTransaction,
    authFetch,
  } = useFinance();
  const { filter: dateFilter } = useDateFilter();
  const toast = useToast();

  const [activeTab, setActiveTab] = useState<'RECORDS' | 'BULK_ENTRY'>('RECORDS');

  // Search & Filter
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('ALL');
  const [accountFilter, setAccountFilter] = useState('ALL');

  // Modals
  const [isAddExpenseOpen, setIsAddExpenseOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [selectedTx, setSelectedTx] = useState<Transaction | null>(null);
  const [txToDelete, setTxToDelete] = useState<Transaction | null>(null);
  const [editingTx, setEditingTx] = useState<Transaction | null>(null);

  // Error feedback
  const [formValidationMsg, setFormValidationMsg] = useState<string | null>(null);
  const [editErrorMsg, setEditErrorMsg] = useState<string | null>(null);
  const [isSavingEdit, setIsSavingEdit] = useState(false);
  const [isSavingAdd, setIsSavingAdd] = useState(false);

  // Add Single Expense Form State
  const [singleDate, setSingleDate] = useState<string>(getDhakaTodayISO());
  const [singleCat, setSingleCat] = useState('');
  const [singleSubcat, setSingleSubcat] = useState('');
  const [singleAccount, setSingleAccount] = useState(accounts[0]?.id || '');
  const [singleAmount, setSingleAmount] = useState('');
  const [singleDesc, setSingleDesc] = useState('');
  const [singleRef, setSingleRef] = useState('');

  // Edit Expense Form State
  const [editDate, setEditDate] = useState<string>(getDhakaTodayISO());
  const [editCat, setEditCat] = useState('');
  const [editSubcat, setEditSubcat] = useState('');
  const [editAccount, setEditAccount] = useState('');
  const [editAmount, setEditAmount] = useState('');
  const [editDesc, setEditDesc] = useState('');
  const [editRef, setEditRef] = useState('');

  // Daily Bulk Entry State
  const [bulkDate, setBulkDate] = useState<string>(getDhakaTodayISO());
  const [bulkAccount, setBulkAccount] = useState(accounts[0]?.id || '');
  const [bulkRows, setBulkRows] = useState([
    { id: '1', category: 'Food & Dining', desc: 'Lunch', amount: 180 },
    { id: '2', category: 'Transportation', desc: 'Commute', amount: 60 },
    { id: '3', category: 'Food & Dining', desc: 'Groceries', amount: 450 },
    { id: '4', category: 'Housing & Utilities', desc: 'Mobile recharge', amount: 100 },
  ]);

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

  // Filter all expense categories
  const allExpenseCategories = useMemo(
    () => categories.filter((c) => c.type === 'EXPENSE'),
    [categories]
  );

  // Main (parent) expense categories
  const mainExpenseCategories = useMemo(
    () => allExpenseCategories.filter((c) => !c.parentId),
    [allExpenseCategories]
  );

  // Helper to extract subcategories for a given main category name
  const getSubcategoriesForCategory = useCallback(
    (mainCatName: string): string[] => {
      const parent = allExpenseCategories.find((c) => c.name === mainCatName && !c.parentId);
      if (!parent) return [];

      const childCategories = allExpenseCategories
        .filter((c) => c.parentId === parent.id)
        .map((c) => c.name);

      const arraySubs = parent.subcategories || [];
      const combined = Array.from(new Set([...childCategories, ...arraySubs]));
      return combined;
    },
    [allExpenseCategories]
  );

  // Set default category when categories load
  useEffect(() => {
    if (!singleCat && mainExpenseCategories.length > 0) {
      setSingleCat(mainExpenseCategories[0].name);
    }
  }, [mainExpenseCategories, singleCat]);

  // Set default account when accounts load
  useEffect(() => {
    if (!singleAccount && accounts.length > 0) {
      setSingleAccount(accounts[0].id);
    }
    if (!bulkAccount && accounts.length > 0) {
      setBulkAccount(accounts[0].id);
    }
  }, [accounts, singleAccount, bulkAccount]);

  // Available subcategories for Add Single Expense Form
  const singleSubcategories = useMemo(
    () => getSubcategoriesForCategory(singleCat),
    [getSubcategoriesForCategory, singleCat]
  );

  // Available subcategories for Edit Expense Form
  const editSubcategories = useMemo(
    () => getSubcategoriesForCategory(editCat),
    [getSubcategoriesForCategory, editCat]
  );

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
    } catch (err: any) {
      console.error('Fetch expenses error:', err);
      setErrorMsg(err.message || 'Error loading expenses');
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

  // Bulk Entry Handlers
  const bulkGrandTotal = bulkRows.reduce((sum, r) => sum + (Number(r.amount) || 0), 0);

  const handleAddBulkRow = () => {
    setBulkRows([
      ...bulkRows,
      { id: Date.now().toString(), category: mainExpenseCategories[0]?.name || 'Food & Dining', desc: '', amount: 0 },
    ]);
  };

  const handleRemoveBulkRow = (id: string) => {
    if (bulkRows.length > 1) {
      setBulkRows(bulkRows.filter((r) => r.id !== id));
    }
  };

  const handleBulkRowChange = (id: string, field: string, value: any) => {
    setBulkRows(
      bulkRows.map((r) => (r.id === id ? { ...r, [field]: value } : r))
    );
  };

  const handleSaveBulkBatch = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormValidationMsg(null);
    if (!bulkAccount) {
      setFormValidationMsg('Please select a payment account.');
      return;
    }

    const validRows = bulkRows.filter((r) => Number(r.amount) > 0 && r.desc.trim().length > 0);
    if (validRows.length === 0) {
      setFormValidationMsg('Please enter at least one expense with a valid description and amount.');
      return;
    }

    await addBulkExpenses({
      accountId: bulkAccount,
      date: bulkDate,
      items: validRows.map((r) => ({
        category: r.category,
        amount: Number(r.amount),
        desc: r.desc.trim(),
      })),
    });

    const accName = accounts.find((a) => a.id === bulkAccount)?.name || 'Account';
    onSuccessNotification(`Recorded ${validRows.length} daily expenses totaling ${formatBDT(bulkGrandTotal)} from ${accName}.`);
    setActiveTab('RECORDS');
    resetPagination();
    fetchExpenses();
  };

  // Add Single Expense Handler
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

      const newTx = res.transaction;
      if (matchesActiveFilters(newTx)) {
        setItems((prev) => sortTransactions([newTx, ...prev]));
      }
      setTotalCount((prev) => prev + 1);

      toast.success('Expense added successfully');
      setIsAddExpenseOpen(false);
      setSingleAmount('');
      setSingleDesc('');
      setSingleRef('');
      setSingleSubcat('');

      await fetchExpenses();
    } catch (err: any) {
      setFormValidationMsg(err.message || 'Failed to record expense.');
      toast.error(err.message || 'Failed to record expense.');
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
    setEditCat(tx.category || mainExpenseCategories[0]?.name || 'Miscellaneous');
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
        setEditErrorMsg(res.error || 'Failed to update expense.');
        toast.error(res.error || 'Failed to save changes');
        return;
      }

      const updated = res.transaction;
      const matches = matchesActiveFilters(updated);

      if (matches) {
        // Immediate local state update with deterministic date-based sorting
        setItems((prev) => {
          const replaced = prev.map((t) => (t.id === updated.id ? { ...t, ...updated } : t));
          return sortTransactions(replaced);
        });
      } else {
        // Record moved outside active date range or filters: remove from current view
        setItems((prev) => prev.filter((t) => t.id !== updated.id));
        setTotalCount((prev) => Math.max(0, prev - 1));
      }

      if (selectedTx && selectedTx.id === updated.id) {
        setSelectedTx(updated);
      }

      toast.success('Expense updated successfully');
      setIsEditModalOpen(false);
      setEditingTx(null);

      // Reconcile server pagination, counts, and page boundaries with backend
      await fetchExpenses();
    } catch (err: any) {
      setEditErrorMsg(err.message || 'Failed to save changes.');
      toast.error(err.message || 'Failed to save changes');
    } finally {
      setIsSavingEdit(false);
    }
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
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 flex-shrink-0">
        <div>
          <h2 className="text-base font-semibold text-gray-100">Expenses</h2>
          <p className="text-xs text-gray-400">Track and categorize expenditures with hierarchical categorization</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setActiveTab(activeTab === 'RECORDS' ? 'BULK_ENTRY' : 'RECORDS')}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-[#1b1e25] hover:bg-[#222631] text-gray-300 rounded text-xs border border-[#2b2e38] transition-colors"
          >
            <FileSpreadsheet className="w-3.5 h-3.5" />
            <span>{activeTab === 'RECORDS' ? 'Daily Bulk Entry' : 'View Records'}</span>
          </button>
          <button
            onClick={() => {
              setIsAddExpenseOpen(true);
              setFormValidationMsg(null);
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded text-xs font-medium transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Expense</span>
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-[#22252c] text-xs flex-shrink-0">
        <button
          onClick={() => setActiveTab('RECORDS')}
          className={`py-2 px-4 font-medium transition-colors border-b-2 -mb-px ${
            activeTab === 'RECORDS'
              ? 'border-blue-500 text-blue-400 bg-[#16181d]'
              : 'border-transparent text-gray-400 hover:text-gray-200'
          }`}
        >
          Expense Records
        </button>
        <button
          onClick={() => setActiveTab('BULK_ENTRY')}
          className={`py-2 px-4 font-medium transition-colors border-b-2 -mb-px flex items-center gap-1.5 ${
            activeTab === 'BULK_ENTRY'
              ? 'border-blue-500 text-blue-400 bg-[#16181d]'
              : 'border-transparent text-gray-400 hover:text-gray-200'
          }`}
        >
          <FileSpreadsheet className="w-3.5 h-3.5" />
          <span>Daily Bulk Entry</span>
        </button>
      </div>

      {activeTab === 'RECORDS' ? (
        <>
          {/* Search & Filter Toolbar */}
          <div className="bg-[#16181d] border border-[#22252c] rounded p-2.5 flex flex-col md:flex-row items-center justify-between gap-2.5 flex-shrink-0">
            <div className="relative w-full md:w-72">
              <Search className="w-3.5 h-3.5 text-gray-400 absolute left-2.5 top-2.5" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => handleSearchChange(e.target.value)}
                placeholder="Search expense records..."
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
                {allExpenseCategories.map((c) => (
                  <option key={c.id} value={c.name}>
                    {c.parentId ? `↳ ${c.name}` : c.name}
                  </option>
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

          {/* Seamless Table Section with Integrated Pinned Footer */}
          <div className="bg-[#16181d] border border-[#22252c] rounded overflow-hidden flex-1 min-h-0 flex flex-col">
            <div className="flex-1 min-h-0 overflow-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="sticky top-0 z-10 bg-[#121417] shadow-sm">
                  <tr className="border-b border-[#22252c] text-gray-400 font-medium uppercase tracking-wider text-[10px]">
                    <th className="py-2.5 px-3">Date</th>
                    <th className="py-2.5 px-3">Description</th>
                    <th className="py-2.5 px-3">Category & Subcategory</th>
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
                          : 'No expenses recorded yet. Click "Add Expense" to log your first expenditure.'
                      }
                      action={{
                        label: 'Add Expense',
                        onClick: () => setIsAddExpenseOpen(true),
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
                          <div className="flex flex-col gap-0.5">
                            <span className="px-1.5 py-0.5 rounded bg-[#111317] border border-[#242730] text-[11px] text-gray-300 w-max">
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
                              onClick={() => handleOpenEdit(tx)}
                              title="Edit Expense"
                              className="p-1 text-gray-400 hover:text-blue-400 hover:bg-[#22252e] rounded"
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
      ) : (
        /* Daily Bulk Entry Grid */
        <div className="space-y-4 flex-1 min-h-0 overflow-y-auto">
          {formValidationMsg && (
            <div className="p-3 bg-amber-950/40 border border-amber-800 text-amber-200 text-xs rounded flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-400 flex-shrink-0" />
              <span>{formValidationMsg}</span>
            </div>
          )}

          <form onSubmit={handleSaveBulkBatch} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-[#16181d] border border-[#22252c] rounded p-3">
              <div>
                <label className="block text-xs text-gray-300 font-medium mb-1">
                  Transaction Date *
                </label>
                <DatePicker value={bulkDate} onChange={setBulkDate} />
              </div>

              <div>
                <label className="block text-xs text-gray-300 font-medium mb-1">
                  Payment Account *
                </label>
                <select
                  value={bulkAccount}
                  onChange={(e) => setBulkAccount(e.target.value)}
                  className="w-full bg-[#111317] border border-[#262932] rounded px-3 py-1.5 text-xs text-gray-200 focus:outline-none focus:border-blue-500"
                >
                  {accounts.map((acc) => (
                    <option key={acc.id} value={acc.id}>
                      {acc.name} ({formatBDT(acc.currentBalance)})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="border border-[#22252c] rounded bg-[#16181d] overflow-hidden">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-[#22252c] bg-[#121417] text-gray-400 font-medium text-[10px] uppercase">
                    <th className="py-2.5 px-3">Category</th>
                    <th className="py-2.5 px-3">Description / Item</th>
                    <th className="py-2.5 px-3 text-right">Amount (৳)</th>
                    <th className="py-2.5 px-3 text-center w-12">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#20232a]">
                  {bulkRows.map((row) => (
                    <tr key={row.id}>
                      <td className="py-2 px-3 w-48">
                        <select
                          value={row.category}
                          onChange={(e) => handleBulkRowChange(row.id, 'category', e.target.value)}
                          className="w-full bg-[#111317] border border-[#262932] rounded px-2 py-1 text-xs text-gray-200 focus:outline-none focus:border-blue-500"
                        >
                          {mainExpenseCategories.map((cat) => (
                            <option key={cat.id} value={cat.name}>{cat.name}</option>
                          ))}
                        </select>
                      </td>
                      <td className="py-2 px-3">
                        <input
                          type="text"
                          value={row.desc}
                          onChange={(e) => handleBulkRowChange(row.id, 'desc', e.target.value)}
                          placeholder="e.g. Lunch or Metro fare"
                          className="w-full bg-[#111317] border border-[#262932] rounded px-2.5 py-1 text-xs text-gray-200 focus:outline-none focus:border-blue-500"
                        />
                      </td>
                      <td className="py-2 px-3 text-right">
                        <input
                          type="number"
                          step="0.01"
                          value={row.amount || ''}
                          onChange={(e) => handleBulkRowChange(row.id, 'amount', e.target.value)}
                          placeholder="0.00"
                          className="w-full bg-[#111317] border border-[#262932] rounded px-2.5 py-1 text-xs text-gray-200 text-right font-mono focus:outline-none focus:border-blue-500"
                        />
                      </td>
                      <td className="py-2 px-3 text-center">
                        <button
                          type="button"
                          onClick={() => handleRemoveBulkRow(row.id)}
                          className="p-1 text-gray-500 hover:text-red-400 rounded"
                          disabled={bulkRows.length <= 1}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <div className="p-3 border-t border-[#22252c] bg-[#121417] flex items-center justify-between">
                <button
                  type="button"
                  onClick={handleAddBulkRow}
                  className="px-3 py-1.5 bg-[#1b1e25] hover:bg-[#222631] text-gray-300 rounded text-xs border border-[#2b2e38] transition-colors"
                >
                  + Add Row
                </button>
                <div className="text-right">
                  <span className="text-xs text-gray-400 mr-2">Batch Total:</span>
                  <span className="text-sm font-bold font-mono text-gray-100">{formatBDT(bulkGrandTotal)}</span>
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setActiveTab('RECORDS')}
                className="px-4 py-2 bg-[#1a1d24] hover:bg-[#222631] text-gray-300 rounded text-xs transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded text-xs font-medium transition-colors"
              >
                Save All Expenses ({formatBDT(bulkGrandTotal)})
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Add Single Expense Modal */}
      <Modal
        isOpen={isAddExpenseOpen}
        onClose={() => setIsAddExpenseOpen(false)}
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
                className="w-full bg-[#111317] border border-[#262932] rounded px-3 py-1.5 text-xs text-gray-200 font-mono focus:outline-none focus:border-blue-500"
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
                value={singleCat}
                onChange={(e) => {
                  setSingleCat(e.target.value);
                  setSingleSubcat('');
                }}
                className="w-full bg-[#111317] border border-[#262932] rounded px-3 py-1.5 text-xs text-gray-200 focus:outline-none focus:border-blue-500"
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
                className="w-full bg-[#111317] border border-[#262932] rounded px-3 py-1.5 text-xs text-gray-200 focus:outline-none focus:border-blue-500"
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
              placeholder="e.g. Groceries at supermarket"
              className="w-full bg-[#111317] border border-[#262932] rounded px-3 py-1.5 text-xs text-gray-200 focus:outline-none focus:border-blue-500"
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
              placeholder="e.g. Receipt #1234 or Transaction ID"
              className="w-full bg-[#111317] border border-[#262932] rounded px-3 py-1.5 text-xs text-gray-200 focus:outline-none focus:border-blue-500"
            />
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-[#22252c]">
            <button
              type="button"
              onClick={() => setIsAddExpenseOpen(false)}
              className="px-3 py-1.5 bg-[#1a1d24] hover:bg-[#222631] text-gray-300 rounded text-xs transition-colors"
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

      {/* Edit Expense Modal */}
      <Modal
        isOpen={isEditModalOpen}
        onClose={() => {
          setIsEditModalOpen(false);
          setEditingTx(null);
        }}
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
                className="w-full bg-[#111317] border border-[#262932] rounded px-3 py-1.5 text-xs text-gray-200 font-mono focus:outline-none focus:border-blue-500"
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
                className="w-full bg-[#111317] border border-[#262932] rounded px-3 py-1.5 text-xs text-gray-200 focus:outline-none focus:border-blue-500"
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
              placeholder="e.g. Groceries at supermarket"
              className="w-full bg-[#111317] border border-[#262932] rounded px-3 py-1.5 text-xs text-gray-200 focus:outline-none focus:border-blue-500"
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
              placeholder="e.g. Receipt #1234"
              className="w-full bg-[#111317] border border-[#262932] rounded px-3 py-1.5 text-xs text-gray-200 focus:outline-none focus:border-blue-500"
            />
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-[#22252c]">
            <button
              type="button"
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
              className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded text-xs font-medium transition-colors flex items-center gap-1.5"
            >
              {isSavingEdit && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              <span>Save Changes</span>
            </button>
          </div>
        </form>
      </Modal>

      {/* Details Modal */}
      <Modal
        isOpen={Boolean(selectedTx)}
        onClose={() => setSelectedTx(null)}
        title="Expense Details"
      >
        {selectedTx && (
          <div className="space-y-3 text-xs">
            <div className="grid grid-cols-2 gap-2 bg-[#111317] border border-[#22252c] p-3 rounded">
              <div>
                <span className="text-gray-500 text-[10px] uppercase font-mono block">Date</span>
                <span className="font-semibold text-gray-200">{selectedTx.date}</span>
              </div>
              <div>
                <span className="text-gray-500 text-[10px] uppercase font-mono block">Amount</span>
                <span className="font-semibold text-rose-400 font-mono text-sm">-{formatBDT(selectedTx.amount)}</span>
              </div>
              <div>
                <span className="text-gray-500 text-[10px] uppercase font-mono block">Category</span>
                <span className="text-gray-200">{selectedTx.category}</span>
                {selectedTx.subcategory && (
                  <span className="text-blue-400 font-mono text-[10px] block">↳ {selectedTx.subcategory}</span>
                )}
              </div>
              <div>
                <span className="text-gray-500 text-[10px] uppercase font-mono block">Account</span>
                <span className="text-gray-200">{selectedTx.accountName}</span>
              </div>
            </div>

            <div>
              <span className="text-gray-500 text-[10px] uppercase font-mono block mb-1">Description</span>
              <p className="p-2.5 bg-[#111317] border border-[#22252c] rounded text-gray-300">{selectedTx.description}</p>
            </div>

            {selectedTx.reference && (
              <div>
                <span className="text-gray-500 text-[10px] uppercase font-mono block mb-1">Reference</span>
                <p className="p-2 bg-[#111317] border border-[#22252c] rounded font-mono text-gray-400">{selectedTx.reference}</p>
              </div>
            )}

            <div className="flex justify-end pt-2">
              <button
                onClick={() => setSelectedTx(null)}
                className="px-3 py-1.5 bg-[#1a1d24] hover:bg-[#222631] text-gray-300 rounded transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        )}
      </Modal>

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
    </div>
  );
};
