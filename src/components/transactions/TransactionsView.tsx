import React, { useState, useEffect, useCallback } from 'react';
import {
  Search,
  Eye,
  Trash2,
  Download,
} from 'lucide-react';
import { formatBDT } from '../../lib/formatters';
import { useFinance } from '../../context/FinanceContext';
import { Transaction } from '../../mock/data';
import { Modal, ConfirmModal } from '../common/Modal';
import { TablePagination } from '../common/TablePagination';
import { useCursorPagination } from '../../hooks/useCursorPagination';

export const TransactionsView: React.FC = () => {
  const { accounts, deleteTransaction, authFetch } = useFinance();

  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState('ALL');
  const [accountFilter, setAccountFilter] = useState('ALL');
  const [selectedTx, setSelectedTx] = useState<Transaction | null>(null);
  const [txToDelete, setTxToDelete] = useState<Transaction | null>(null);

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

  const fetchTransactions = useCallback(async () => {
    try {
      setIsLoading(true);
      setErrorMsg(null);

      const params = new URLSearchParams();
      params.set('limit', String(pageSize));
      if (cursor) params.set('cursor', cursor);
      if (searchQuery.trim()) params.set('search', searchQuery.trim());
      if (typeFilter !== 'ALL') params.set('type', typeFilter);
      if (accountFilter !== 'ALL') params.set('accountId', accountFilter);

      const res = await authFetch(`/api/transactions?${params.toString()}`);
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Failed to fetch transactions');
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
      console.error('Fetch transactions error:', err);
      setErrorMsg(err.message || 'Error loading transactions');
    } finally {
      setIsLoading(false);
    }
  }, [authFetch, pageSize, cursor, searchQuery, typeFilter, accountFilter, setPaginationMeta]);

  useEffect(() => {
    fetchTransactions();
  }, [fetchTransactions]);

  const confirmDelete = async () => {
    if (!txToDelete) return;
    await deleteTransaction(txToDelete.id);
    setTxToDelete(null);
    fetchTransactions();
  };

  const handleExportCSV = async () => {
    try {
      const params = new URLSearchParams();
      params.set('all', 'true');
      if (searchQuery.trim()) params.set('search', searchQuery.trim());
      if (typeFilter !== 'ALL') params.set('type', typeFilter);
      if (accountFilter !== 'ALL') params.set('accountId', accountFilter);

      const res = await authFetch(`/api/transactions?${params.toString()}`);
      const data = await res.json();
      const exportList: Transaction[] = data.transactions || items;

      const headers = ['Date', 'Type', 'Account', 'Destination Account', 'Category', 'Description', 'Reference', 'Amount', 'Direction', 'Status'];
      const rows = exportList.map((t) => [
        `"${t.date}"`,
        `"${t.type}"`,
        `"${t.accountName}"`,
        `"${t.destinationAccountName || ''}"`,
        `"${t.category || t.counterparty || ''}"`,
        `"${t.description.replace(/"/g, '""')}"`,
        `"${t.reference || ''}"`,
        t.amount,
        `"${t.direction}"`,
        `"${t.status}"`,
      ]);

      const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.setAttribute('href', url);
      link.setAttribute('download', `hisabflow_transactions_${Date.now()}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err) {
      console.error('Export CSV error:', err);
    }
  };

  const handleExportJSON = async () => {
    try {
      const params = new URLSearchParams();
      params.set('all', 'true');
      if (searchQuery.trim()) params.set('search', searchQuery.trim());
      if (typeFilter !== 'ALL') params.set('type', typeFilter);
      if (accountFilter !== 'ALL') params.set('accountId', accountFilter);

      const res = await authFetch(`/api/transactions?${params.toString()}`);
      const data = await res.json();
      const exportList: Transaction[] = data.transactions || items;

      const jsonContent = JSON.stringify(exportList, null, 2);
      const blob = new Blob([jsonContent], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.setAttribute('href', url);
      link.setAttribute('download', `hisabflow_transactions_${Date.now()}.json`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err) {
      console.error('Export JSON error:', err);
    }
  };

  const getTypeBadge = (type: string) => {
    switch (type) {
      case 'INCOME':
        return <span className="px-1.5 py-0.5 rounded text-[10px] bg-emerald-950/80 text-emerald-400 border border-emerald-800/60 font-medium">INCOME</span>;
      case 'EXPENSE':
        return <span className="px-1.5 py-0.5 rounded text-[10px] bg-gray-800 text-gray-300 border border-gray-700 font-medium">EXPENSE</span>;
      case 'TRANSFER':
        return <span className="px-1.5 py-0.5 rounded text-[10px] bg-blue-950/70 text-blue-300 border border-blue-800/60 font-medium">TRANSFER</span>;
      case 'LOAN_LENT':
        return <span className="px-1.5 py-0.5 rounded text-[10px] bg-amber-950/70 text-amber-300 border border-amber-800/60 font-medium">LOAN GIVEN</span>;
      case 'LOAN_BORROWED':
        return <span className="px-1.5 py-0.5 rounded text-[10px] bg-purple-950/70 text-purple-300 border border-purple-800/60 font-medium">BORROWED</span>;
      case 'LOAN_REPAYMENT':
        return <span className="px-1.5 py-0.5 rounded text-[10px] bg-teal-950/70 text-teal-300 border border-teal-800/60 font-medium">REPAYMENT</span>;
      default:
        return <span className="px-1.5 py-0.5 rounded text-[10px] bg-gray-800 text-gray-400 font-medium">{type}</span>;
    }
  };

  return (
    <div className="h-full flex flex-col min-h-0 w-full min-w-0 space-y-3">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 flex-shrink-0">
        <div>
          <h2 className="text-base font-semibold text-gray-100">Transactions Ledger</h2>
          <p className="text-xs text-gray-400">Deterministic cursor pagination & full-height view</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleExportCSV}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-[#1e222a] hover:bg-[#262b35] text-gray-200 rounded text-xs font-medium border border-[#2e323d] transition-colors"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export CSV</span>
          </button>
          <button
            onClick={handleExportJSON}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-[#1e222a] hover:bg-[#262b35] text-gray-200 rounded text-xs font-medium border border-[#2e323d] transition-colors"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export JSON</span>
          </button>
        </div>
      </div>

      {/* Search & Filter Toolbar */}
      <div className="bg-[#16181d] border border-[#22252c] rounded p-2.5 flex flex-col md:flex-row items-center justify-between gap-2.5 flex-shrink-0">
        <div className="relative w-full md:w-80">
          <Search className="w-3.5 h-3.5 text-gray-400 absolute left-2.5 top-2.5" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => handleSearchChange(e.target.value)}
            placeholder="Search description, category, reference..."
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

      {errorMsg && (
        <div className="p-2.5 bg-red-950/40 border border-red-800/60 rounded text-xs text-red-300 flex-shrink-0">
          {errorMsg}
        </div>
      )}

      {/* Viewport-based Scrollable Table Container */}
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
              {items.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-gray-500">
                    {isLoading ? 'Loading transactions...' : 'No transactions match criteria.'}
                  </td>
                </tr>
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
                      {tx.category || tx.counterparty || '-'}
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
