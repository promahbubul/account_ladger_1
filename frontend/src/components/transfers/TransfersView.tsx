import React, { useState, useEffect, useCallback } from 'react';
import {
  Plus,
  Search,
  Eye,
  Trash2,
} from 'lucide-react';
import { formatBDT } from '../../lib/formatters';
import { useFinance } from '../../context/FinanceContext';
export interface TransferItem {
  id: string;
  sourceAccountId: string;
  sourceAccountName: string;
  destinationAccountId: string;
  destinationAccountName: string;
  amount: number;
  transferFee?: number;
  date: string;
  description?: string;
  reference?: string;
  createdAt?: string;
}

import { Modal, ConfirmModal } from '../common/Modal';
import { TablePagination } from '../common/TablePagination';
import { useCursorPagination } from '../../hooks/useCursorPagination';
import { TableErrorRow, TableLoadingRow, TableEmptyRow } from '../common/StateViews';

interface TransfersViewProps {
  onOpenTransferModal: () => void;
  onSuccessNotification: (msg: string) => void;
}

export const TransfersView: React.FC<TransfersViewProps> = ({
  onSuccessNotification,
}) => {
  const { accounts, addTransfer, deleteTransaction, authFetch } = useFinance();

  const [searchQuery, setSearchQuery] = useState('');
  const [sourceFilter, setSourceFilter] = useState('ALL');
  const [destFilter, setDestFilter] = useState('ALL');

  // Modals
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedTx, setSelectedTx] = useState<any | null>(null);
  const [txToReverse, setTxToReverse] = useState<any | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Transfer form
  const [fromAccId, setFromAccId] = useState(accounts[0]?.id || '');
  const [toAccId, setToAccId] = useState(accounts[1]?.id || '');
  const [amount, setAmount] = useState('');
  const [desc, setDesc] = useState('');
  const [refNum, setRefNum] = useState('');

  // Pagination state
  const [items, setItems] = useState<TransferItem[]>([]);
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

  const fetchTransfers = useCallback(async () => {
    try {
      setIsLoading(true);
      setErrorMsg(null);

      const params = new URLSearchParams();
      params.set('limit', String(pageSize));
      if (cursor) params.set('cursor', cursor);
      if (searchQuery.trim()) params.set('search', searchQuery.trim());
      if (sourceFilter !== 'ALL') params.set('sourceAccountId', sourceFilter);
      if (destFilter !== 'ALL') params.set('destAccountId', destFilter);

      const res = await authFetch(`/api/transfers?${params.toString()}`);
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Failed to load transfers');
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
      console.error('Fetch transfers error:', err);
      setErrorMsg(err.message || 'Error fetching transfers');
    } finally {
      setIsLoading(false);
    }
  }, [authFetch, pageSize, cursor, searchQuery, sourceFilter, destFilter, setPaginationMeta]);

  useEffect(() => {
    fetchTransfers();
  }, [fetchTransfers]);

  const handleSearchChange = (val: string) => {
    setSearchQuery(val);
    resetPagination();
  };

  const handleSourceFilterChange = (val: string) => {
    setSourceFilter(val);
    resetPagination();
  };

  const handleDestFilterChange = (val: string) => {
    setDestFilter(val);
    resetPagination();
  };

  const handleCreateTransfer = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    const amountNum = parseFloat(amount);
    if (isNaN(amountNum) || amountNum <= 0) return;

    if (fromAccId === toAccId) {
      setErrorMessage('Source and destination accounts must be different.');
      return;
    }

    const res = await addTransfer({
      sourceAccountId: fromAccId,
      destinationAccountId: toAccId,
      amount: amountNum,
      description: desc.trim() || undefined,
      reference: refNum.trim() || undefined,
    });

    if (res.success) {
      const fromName = accounts.find((a) => a.id === fromAccId)?.name;
      const toName = accounts.find((a) => a.id === toAccId)?.name;
      onSuccessNotification(`Transferred ${formatBDT(amountNum)} from ${fromName} to ${toName}.`);
      setIsModalOpen(false);
      setAmount('');
      setDesc('');
      setRefNum('');
      resetPagination();
      fetchTransfers();
    } else {
      setErrorMessage(res.error || 'Failed to complete transfer.');
    }
  };

  const confirmReverseTransfer = async () => {
    if (!txToReverse) return;
    await deleteTransaction(txToReverse.id);
    onSuccessNotification(`Transfer reversed successfully.`);
    setTxToReverse(null);
    fetchTransfers();
  };

  return (
    <div className="h-full flex flex-col min-h-0 w-full min-w-0 space-y-3">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 flex-shrink-0">
        <div>
          <h2 className="text-base font-semibold text-gray-100">Transfers Ledger</h2>
          <p className="text-xs text-gray-400">Move funds between accounts and audit movement</p>
        </div>
        <button
          onClick={() => setIsModalOpen(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded text-xs font-medium transition-colors"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>New Transfer</span>
        </button>
      </div>

      {/* Search and Filters */}
      <div className="bg-[#16181d] border border-[#22252c] rounded p-2.5 flex flex-col md:flex-row items-center justify-between gap-2.5 flex-shrink-0">
        <div className="relative w-full md:w-72">
          <Search className="w-3.5 h-3.5 text-gray-400 absolute left-2.5 top-2.5" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => handleSearchChange(e.target.value)}
            placeholder="Search transfers or reference..."
            className="w-full bg-[#111317] border border-[#262932] rounded pl-8 pr-3 py-1.5 text-xs text-gray-200 focus:outline-none focus:border-blue-500 placeholder-gray-500"
          />
        </div>

        <div className="flex items-center gap-2 w-full md:w-auto text-xs">
          <select
            value={sourceFilter}
            onChange={(e) => handleSourceFilterChange(e.target.value)}
            className="bg-[#111317] border border-[#262932] rounded px-2.5 py-1.5 text-xs text-gray-300 focus:outline-none focus:border-blue-500"
          >
            <option value="ALL">All Source Accounts</option>
            {accounts.map((a) => (
              <option key={a.id} value={a.id}>From: {a.name}</option>
            ))}
          </select>

          <select
            value={destFilter}
            onChange={(e) => handleDestFilterChange(e.target.value)}
            className="bg-[#111317] border border-[#262932] rounded px-2.5 py-1.5 text-xs text-gray-300 focus:outline-none focus:border-blue-500"
          >
            <option value="ALL">All Destination Accounts</option>
            {accounts.map((a) => (
              <option key={a.id} value={a.id}>To: {a.name}</option>
            ))}
          </select>
        </div>
      </div>

      {errorMessage && (
        <div className="p-2.5 bg-red-950/40 border border-red-800/60 rounded text-xs text-red-300 flex-shrink-0">
          {errorMessage}
        </div>
      )}

      {/* Transfers Table */}
      <div className="bg-[#16181d] border border-[#22252c] rounded overflow-hidden flex-1 min-h-0 flex flex-col">
        <div className="flex-1 min-h-0 overflow-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead className="sticky top-0 z-10 bg-[#121417] shadow-sm">
              <tr className="border-b border-[#22252c] text-gray-400 font-medium uppercase tracking-wider text-[10px]">
                <th className="py-2.5 px-3">Date</th>
                <th className="py-2.5 px-3">Description</th>
                <th className="py-2.5 px-3">From Account</th>
                <th className="py-2.5 px-3">To Account</th>
                <th className="py-2.5 px-3">Reference</th>
                <th className="py-2.5 px-3 text-right">Amount</th>
                <th className="py-2.5 px-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#20232a]">
              {errorMsg ? (
                <TableErrorRow
                  colSpan={7}
                  title="Failed to load transfers"
                  description={errorMsg}
                  onRetry={fetchTransfers}
                />
              ) : isLoading ? (
                <TableLoadingRow
                  colSpan={7}
                  message="Loading transfers..."
                />
              ) : items.length === 0 ? (
                <TableEmptyRow
                  colSpan={7}
                  title="No transfers found"
                  description={
                    searchQuery || sourceFilter !== 'ALL' || destFilter !== 'ALL'
                      ? 'No transfers match the selected filters.'
                      : 'No inter-account transfers performed yet.'
                  }
                  action={{
                    label: 'New Transfer',
                    onClick: () => setIsModalOpen(true),
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
                    <td className="py-2.5 px-3 text-gray-300">
                      {tx.sourceAccountName}
                    </td>
                    <td className="py-2.5 px-3 text-gray-300">
                      {tx.destinationAccountName || '-'}
                    </td>
                    <td className="py-2.5 px-3 text-gray-500 font-mono text-[11px]">
                      {tx.reference || '-'}
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono font-semibold text-blue-400 whitespace-nowrap">
                      {formatBDT(tx.amount)}
                    </td>
                    <td className="py-2.5 px-3 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => setSelectedTx({
                            ...tx,
                            accountName: tx.sourceAccountName,
                            destinationAccountName: tx.destinationAccountName,
                          })}
                          title="View Details"
                          className="p-1 text-gray-400 hover:text-gray-200 hover:bg-[#22252e] rounded"
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => setTxToReverse({
                            ...tx,
                            accountName: tx.sourceAccountName,
                            destinationAccountName: tx.destinationAccountName,
                          })}
                          title="Reverse Transfer"
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

      {/* Transfer Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title="Internal Transfer"
      >
        <form onSubmit={handleCreateTransfer} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-gray-300 font-medium mb-1">
                Source Account (From) *
              </label>
              <select
                value={fromAccId}
                onChange={(e) => setFromAccId(e.target.value)}
                className="w-full bg-[#111317] border border-[#262932] rounded px-3 py-1.5 text-xs text-gray-200 focus:outline-none focus:border-blue-500"
              >
                {accounts.filter(a => a.status === 'ACTIVE').map((acc) => (
                  <option key={acc.id} value={acc.id}>
                    {acc.name} ({formatBDT(acc.currentBalance)})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs text-gray-300 font-medium mb-1">
                Destination Account (To) *
              </label>
              <select
                value={toAccId}
                onChange={(e) => setToAccId(e.target.value)}
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

          <div>
            <label className="block text-xs text-gray-300 font-medium mb-1">
              Transfer Amount (৳ BDT) *
            </label>
            <input
              type="number"
              step="0.01"
              required
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0.00"
              className="w-full bg-[#111317] border border-[#262932] rounded px-3 py-1.5 text-xs text-gray-200 font-mono focus:outline-none focus:border-blue-500"
            />
          </div>

          <div>
            <label className="block text-xs text-gray-300 font-medium mb-1">
              Description (Optional)
            </label>
            <input
              type="text"
              value={desc}
              onChange={(e) => setDesc(e.target.value)}
              placeholder="e.g. Bank to bKash refill"
              className="w-full bg-[#111317] border border-[#262932] rounded px-3 py-1.5 text-xs text-gray-200 focus:outline-none focus:border-blue-500"
            />
          </div>

          <div>
            <label className="block text-xs text-gray-300 font-medium mb-1">
              Reference Number (Optional)
            </label>
            <input
              type="text"
              value={refNum}
              onChange={(e) => setRefNum(e.target.value)}
              placeholder="e.g. TR-99882"
              className="w-full bg-[#111317] border border-[#262932] rounded px-3 py-1.5 text-xs text-gray-200 font-mono focus:outline-none focus:border-blue-500"
            />
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-[#22252c]">
            <button
              type="button"
              onClick={() => setIsModalOpen(false)}
              className="px-3 py-1.5 bg-[#1a1d24] hover:bg-[#222631] text-gray-300 rounded text-xs transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded text-xs font-medium transition-colors"
            >
              Transfer Funds
            </button>
          </div>
        </form>
      </Modal>

      {/* Details Modal */}
      <Modal
        isOpen={Boolean(selectedTx)}
        onClose={() => setSelectedTx(null)}
        title="Transfer Details"
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
                <p className="font-mono text-blue-400 font-semibold">{formatBDT(selectedTx.amount)}</p>
              </div>
              <div>
                <span className="text-gray-400">From</span>
                <p className="text-gray-200">{selectedTx.sourceAccountName || selectedTx.accountName}</p>
              </div>
              <div>
                <span className="text-gray-400">To</span>
                <p className="text-gray-200">{selectedTx.destinationAccountName || '-'}</p>
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

      {/* Reverse Confirmation */}
      <ConfirmModal
        isOpen={Boolean(txToReverse)}
        onClose={() => setTxToReverse(null)}
        onConfirm={confirmReverseTransfer}
        title="Reverse Transfer"
        message={txToReverse ? `Reverse transfer of ${formatBDT(txToReverse.amount)} between ${txToReverse.sourceAccountName || txToReverse.accountName} and ${txToReverse.destinationAccountName}?` : ''}
        confirmLabel="Reverse"
        isDestructive={true}
      />
    </div>
  );
};
