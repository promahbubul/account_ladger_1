import React, { useState, useEffect, useCallback } from 'react';
import {
  Plus,
  FileSpreadsheet,
  Trash2,
  Search,
  Eye,
  AlertTriangle,
} from 'lucide-react';
import { formatBDT } from '../../lib/formatters';
import { useFinance } from '../../context/FinanceContext';
import { Transaction } from '../../mock/data';
import { Modal, ConfirmModal } from '../common/Modal';
import { TablePagination } from '../common/TablePagination';
import { useCursorPagination } from '../../hooks/useCursorPagination';

interface ExpensesViewProps {
  onOpenSingleExpenseModal: () => void;
  onSuccessNotification: (msg: string) => void;
}

export const ExpensesView: React.FC<ExpensesViewProps> = ({
  onSuccessNotification,
}) => {
  const { accounts, categories, addExpense, addBulkExpenses, deleteTransaction, authFetch } = useFinance();

  const [activeTab, setActiveTab] = useState<'RECORDS' | 'BULK_ENTRY'>('RECORDS');

  // Search & Filter
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('ALL');
  const [accountFilter, setAccountFilter] = useState('ALL');

  // Modals
  const [isAddExpenseOpen, setIsAddExpenseOpen] = useState(false);
  const [selectedTx, setSelectedTx] = useState<Transaction | null>(null);
  const [txToDelete, setTxToDelete] = useState<Transaction | null>(null);
  const [formValidationMsg, setFormValidationMsg] = useState<string | null>(null);

  // Single Expense Form
  const [singleDate, setSingleDate] = useState('14 Oct 2026');
  const [singleCat, setSingleCat] = useState('');
  const [singleAccount, setSingleAccount] = useState(accounts[0]?.id || '');
  const [singleAmount, setSingleAmount] = useState('');
  const [singleDesc, setSingleDesc] = useState('');
  const [singleRef, setSingleRef] = useState('');

  // Daily Bulk Entry State
  const [bulkDate, setBulkDate] = useState('14 Oct 2026');
  const [bulkAccount, setBulkAccount] = useState(accounts[0]?.id || '');
  const [bulkRows, setBulkRows] = useState([
    { id: '1', category: 'Food & Dining', desc: 'Lunch', amount: 180 },
    { id: '2', category: 'Transport', desc: 'Commute', amount: 60 },
    { id: '3', category: 'Food & Dining', desc: 'Groceries', amount: 450 },
    { id: '4', category: 'Mobile & Communication', desc: 'Mobile recharge', amount: 100 },
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
    hasNextPage,
    hasPreviousPage,
    setPageSize,
    goToNextPage,
    goToPreviousPage,
    resetPagination,
    setPaginationMeta,
  } = useCursorPagination({ initialPageSize: 50 });

  const expenseCategories = categories.filter((c) => c.type === 'EXPENSE');

  const fetchExpenses = useCallback(async () => {
    try {
      setIsLoading(true);
      setErrorMsg(null);

      const params = new URLSearchParams();
      params.set('type', 'EXPENSE');
      params.set('limit', String(pageSize));
      if (cursor) params.set('cursor', cursor);
      if (searchQuery.trim()) params.set('search', searchQuery.trim());
      if (categoryFilter !== 'ALL') params.set('category', categoryFilter);
      if (accountFilter !== 'ALL') params.set('accountId', accountFilter);

      const res = await authFetch(`/api/transactions?${params.toString()}`);
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Failed to fetch expenses');
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
      console.error('Fetch expenses error:', err);
      setErrorMsg(err.message || 'Error loading expenses');
    } finally {
      setIsLoading(false);
    }
  }, [authFetch, pageSize, cursor, searchQuery, categoryFilter, accountFilter, setPaginationMeta]);

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

  const bulkGrandTotal = bulkRows.reduce((sum, r) => sum + (Number(r.amount) || 0), 0);

  const handleAddBulkRow = () => {
    setBulkRows([
      ...bulkRows,
      { id: Date.now().toString(), category: expenseCategories[0]?.name || 'Food & Dining', desc: '', amount: 0 },
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

  const handleSaveSingleExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    const amountNum = parseFloat(singleAmount);
    if (isNaN(amountNum) || amountNum <= 0) return;

    await addExpense({
      accountId: singleAccount || accounts[0]?.id || '',
      category: singleCat || expenseCategories[0]?.name || 'Other Expense',
      amount: amountNum,
      date: singleDate,
      description: singleDesc.trim() || 'Expense item',
      reference: singleRef.trim() || undefined,
    });

    const accName = accounts.find((a) => a.id === singleAccount)?.name || 'Account';
    onSuccessNotification(`Logged expense ${formatBDT(amountNum)} from ${accName}.`);
    setIsAddExpenseOpen(false);
    setSingleAmount('');
    setSingleDesc('');
    setSingleRef('');
    resetPagination();
    fetchExpenses();
  };

  const confirmDeleteExpense = async () => {
    if (!txToDelete) return;
    await deleteTransaction(txToDelete.id);
    onSuccessNotification(`Expense "${txToDelete.description}" removed. Balance restored.`);
    setTxToDelete(null);
    fetchExpenses();
  };

  return (
    <div className="h-full flex flex-col min-h-0 w-full min-w-0 space-y-3">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 flex-shrink-0">
        <div>
          <h2 className="text-base font-semibold text-gray-100">Expenses</h2>
          <p className="text-xs text-gray-400">Track and categorize expenditures</p>
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
            onClick={() => setIsAddExpenseOpen(true)}
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
                {expenseCategories.map((c) => (
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

          {errorMsg && (
            <div className="p-2.5 bg-red-950/40 border border-red-800/60 rounded text-xs text-red-300 flex-shrink-0">
              {errorMsg}
            </div>
          )}

          {/* Viewport-based Scrollable Table */}
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
                  {items.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-12 text-center text-gray-500">
                        {isLoading ? 'Loading expenses...' : 'No expense records found.'}
                      </td>
                    </tr>
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
                            {tx.category || 'General Expense'}
                          </span>
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
                <input
                  type="text"
                  required
                  value={bulkDate}
                  onChange={(e) => setBulkDate(e.target.value)}
                  className="w-full bg-[#111317] border border-[#262932] rounded px-3 py-1.5 text-xs text-gray-200 focus:outline-none focus:border-blue-500"
                />
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
                  {accounts.filter(a => a.status === 'ACTIVE').map((acc) => (
                    <option key={acc.id} value={acc.id}>
                      {acc.name} ({formatBDT(acc.currentBalance)})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="bg-[#16181d] border border-[#22252c] rounded overflow-hidden">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-[#22252c] bg-[#121417] text-gray-400 font-medium uppercase text-[10px]">
                    <th className="py-2.5 px-3 w-1/4">Category</th>
                    <th className="py-2.5 px-3 w-1/2">Description</th>
                    <th className="py-2.5 px-3 w-1/4 text-right">Amount (৳ BDT)</th>
                    <th className="py-2.5 px-3 w-12 text-center"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#20232a]">
                  {bulkRows.map((row) => (
                    <tr key={row.id}>
                      <td className="py-2 px-3">
                        <select
                          value={row.category}
                          onChange={(e) => handleBulkRowChange(row.id, 'category', e.target.value)}
                          className="w-full bg-[#111317] border border-[#262932] rounded px-2.5 py-1 text-xs text-gray-200 focus:outline-none focus:border-blue-500"
                        >
                          {expenseCategories.map((c) => (
                            <option key={c.id} value={c.name}>{c.name}</option>
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
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-gray-300 font-medium mb-1">
                Date *
              </label>
              <input
                type="text"
                required
                value={singleDate}
                onChange={(e) => setSingleDate(e.target.value)}
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
                Category *
              </label>
              <select
                value={singleCat}
                onChange={(e) => setSingleCat(e.target.value)}
                className="w-full bg-[#111317] border border-[#262932] rounded px-3 py-1.5 text-xs text-gray-200 focus:outline-none focus:border-blue-500"
              >
                {expenseCategories.map((cat) => (
                  <option key={cat.id} value={cat.name}>{cat.name}</option>
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
              placeholder="e.g. INV-1092"
              className="w-full bg-[#111317] border border-[#262932] rounded px-3 py-1.5 text-xs text-gray-200 font-mono focus:outline-none focus:border-blue-500"
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
              className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded text-xs font-medium transition-colors"
            >
              Save Expense
            </button>
          </div>
        </form>
      </Modal>

      {/* Transaction Details Modal */}
      <Modal
        isOpen={Boolean(selectedTx)}
        onClose={() => setSelectedTx(null)}
        title="Expense Details"
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
                <p className="font-mono text-gray-100 font-semibold">-{formatBDT(selectedTx.amount)}</p>
              </div>
              <div>
                <span className="text-gray-400">Category</span>
                <p className="text-gray-200">{selectedTx.category || 'Expense'}</p>
              </div>
              <div>
                <span className="text-gray-400">Account</span>
                <p className="text-gray-200">{selectedTx.accountName}</p>
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

      {/* Delete Confirmation Modal */}
      <ConfirmModal
        isOpen={Boolean(txToDelete)}
        onClose={() => setTxToDelete(null)}
        onConfirm={confirmDeleteExpense}
        title="Delete Expense Record"
        message={txToDelete ? `Delete expense "${txToDelete.description}" (${formatBDT(txToDelete.amount)})? This will restore ${formatBDT(txToDelete.amount)} back to ${txToDelete.accountName}.` : ''}
        confirmLabel="Delete"
        isDestructive={true}
      />
    </div>
  );
};
