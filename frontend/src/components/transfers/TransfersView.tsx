import React, { useState, useEffect, useCallback } from 'react';
import {
  Plus,
  Search,
  Eye,
  Trash2,
  Loader2,
} from 'lucide-react';
import { formatBDT, formatDate } from '../../lib/formatters';
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
import { DatePicker, getDhakaTodayISO } from '../common/DatePicker';
import { TablePagination } from '../common/TablePagination';
import { useCursorPagination } from '../../hooks/useCursorPagination';
import { TableErrorRow, TableLoadingRow, TableEmptyRow } from '../common/StateViews';
import { useToast } from '../../context/ToastContext';

interface TransfersViewProps {
  onOpenTransferModal: () => void;
  onSuccessNotification?: (msg: string) => void;
}

export const TransfersView: React.FC<TransfersViewProps> = ({
  onSuccessNotification,
}) => {
  const toast = useToast();
  const { accounts, addTransfer, deleteTransfer, authFetch } = useFinance();

  const [searchQuery, setSearchQuery] = useState('');
  const [sourceFilter, setSourceFilter] = useState('ALL');
  const [destFilter, setDestFilter] = useState('ALL');

  // Modals
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedTx, setSelectedTx] = useState<any | null>(null);
  const [txToReverse, setTxToReverse] = useState<any | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Transfer form
  const [fromAccId, setFromAccId] = useState(accounts[0]?.id || '');
  const [toAccId, setToAccId] = useState(accounts[1]?.id || '');
  const [transferDate, setTransferDate] = useState(getDhakaTodayISO());
  const [amount, setAmount] = useState('');
  const [desc, setDesc] = useState('');
  const [refNum, setRefNum] = useState('');

  // Pagination state
  const [items, setItems] = useState<TransferItem[]>([]);
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

  const fetchTransfers = useCallback(async () => {
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
  }, [authFetch, pageSize, cursor, currentPage, searchQuery, sourceFilter, destFilter, setPaginationMeta]);

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
    if (isNaN(amountNum) || amountNum <= 0) {
      toast.error('Please enter a valid transfer amount.');
      return;
    }

    if (!fromAccId || !toAccId) {
      toast.error('Please select both source and destination accounts.');
      return;
    }

    if (fromAccId === toAccId) {
      const err = 'Source and destination accounts must be different.';
      setErrorMessage(err);
      toast.error(err);
      return;
    }

    setIsSubmitting(true);
    const toastId = toast.loading('Transferring funds between accounts...');
    try {
      const res = await addTransfer({
        sourceAccountId: fromAccId,
        destinationAccountId: toAccId,
        amount: amountNum,
        date: transferDate || getDhakaTodayISO(),
        description: desc.trim() || undefined,
        reference: refNum.trim() || undefined,
      });

      if (res.success && res.transfer) {
        const fromName = accounts.find((a) => a.id === fromAccId)?.name || 'Source';
        const toName = accounts.find((a) => a.id === toAccId)?.name || 'Destination';
        const newTransfer: TransferItem = {
          id: res.transfer.id,
          sourceAccountId: fromAccId,
          sourceAccountName: fromName,
          destinationAccountId: toAccId,
          destinationAccountName: toName,
          amount: amountNum,
          date: res.transfer.date || transferDate || getDhakaTodayISO(),
          description: desc.trim() || undefined,
          reference: refNum.trim() || undefined,
        };

        const matchesSource = sourceFilter === 'ALL' || sourceFilter === fromAccId;
        const matchesDest = destFilter === 'ALL' || destFilter === toAccId;
        if (matchesSource && matchesDest) {
          setItems((prev) => [newTransfer, ...prev]);
        }
        setTotalCount((prev) => prev + 1);
        toast.updateToast(toastId, {
          type: 'success',
          message: `Transferred ${formatBDT(amountNum)} from ${fromName} to ${toName}`,
        });
        setIsModalOpen(false);
        setAmount('');
        setDesc('');
        setRefNum('');
      } else {
        const err = res.error || 'Failed to complete transfer.';
        setErrorMessage(err);
        toast.updateToast(toastId, { type: 'error', message: err });
      }
    } catch (err: any) {
      const errMsg = err?.message || 'Network error while transferring funds';
      setErrorMessage(errMsg);
      toast.updateToast(toastId, { type: 'error', message: errMsg });
    } finally {
      setIsSubmitting(false);
    }
  };

  const confirmReverseTransfer = async () => {
    if (!txToReverse) return;
    const deletedId = txToReverse.id;
    const res = await deleteTransfer(deletedId);
    if (res.success) {
      setItems((prev) => prev.filter((t) => t.id !== deletedId));
      setTotalCount((prev) => Math.max(0, prev - 1));
      toast.success('Record deleted successfully');
    } else {
      toast.error(res.error || 'Failed to reverse transfer');
    }
    setTxToReverse(null);
  };

  return (
    <div className="h-full flex flex-col min-h-0 w-full min-w-0 space-y-3">
      {/* Actions */}
      <div className="flex items-center justify-end gap-2 flex-shrink-0">
        <button
          onClick={() => setIsModalOpen(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded text-xs font-medium transition-colors"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>New Transfer</span>
        </button>
      </div>

      {/* Search and Filters */}
      <div className="bg-surface border border-line rounded p-2.5 flex flex-col md:flex-row items-center justify-between gap-2.5 flex-shrink-0">
        <div className="relative w-full md:w-72">
          <Search className="w-3.5 h-3.5 text-gray-400 absolute left-2.5 top-2.5" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => handleSearchChange(e.target.value)}
            placeholder="Search transfers..."
            className="w-full bg-app border border-line-strong rounded pl-8 pr-3 py-1.5 text-xs text-gray-200 focus:outline-none focus:border-blue-500 placeholder-gray-500"
          />
        </div>

        <div className="flex items-center gap-2 w-full md:w-auto text-xs">
          <select
            value={sourceFilter}
            onChange={(e) => handleSourceFilterChange(e.target.value)}
            className="bg-app border border-line-strong rounded px-2.5 py-1.5 text-xs text-gray-300 focus:outline-none focus:border-blue-500"
          >
            <option value="ALL">All Source Accounts</option>
            {accounts.map((a) => (
              <option key={a.id} value={a.id}>From: {a.name}</option>
            ))}
          </select>

          <select
            value={destFilter}
            onChange={(e) => handleDestFilterChange(e.target.value)}
            className="bg-app border border-line-strong rounded px-2.5 py-1.5 text-xs text-gray-300 focus:outline-none focus:border-blue-500"
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
      <div className="bg-surface border border-line rounded overflow-hidden flex-1 min-h-0 flex flex-col">
        <div className="flex-1 min-h-0 overflow-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead className="sticky top-0 z-10 bg-surface-sunken shadow-sm">
              <tr className="border-b border-line text-gray-400 font-medium uppercase tracking-wider text-[10px]">
                <th className="py-2.5 px-3">Date</th>
                <th className="py-2.5 px-3">Description</th>
                <th className="py-2.5 px-3">From Account</th>
                <th className="py-2.5 px-3">To Account</th>
                <th className="py-2.5 px-3">Reference</th>
                <th className="py-2.5 px-3 text-right">Amount</th>
                <th className="py-2.5 px-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-divider">
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
                      : undefined
                  }
                  action={{
                    label: 'New Transfer',
                    onClick: () => setIsModalOpen(true),
                  }}
                />
              ) : (
                items.map((tx) => (
                  <tr key={tx.id} className="hover:bg-surface-hover transition-colors">
                    <td className="py-2.5 px-3 text-gray-400 font-mono text-[11px] whitespace-nowrap">
                      {formatDate(tx.date)}
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
                          className="p-1 text-gray-400 hover:text-gray-200 hover:bg-line-soft rounded"
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

        {/* Integrated Pagination Controls */}
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
                className="w-full bg-app border border-line-strong rounded px-3 py-1.5 text-xs text-gray-200 focus:outline-none focus:border-blue-500"
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
                className="w-full bg-app border border-line-strong rounded px-3 py-1.5 text-xs text-gray-200 focus:outline-none focus:border-blue-500"
              >
                {accounts.filter(a => a.status === 'ACTIVE').map((acc) => (
                  <option key={acc.id} value={acc.id}>
                    {acc.name} ({formatBDT(acc.currentBalance)})
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-gray-300 font-medium mb-1">
                Transfer Date *
              </label>
              <DatePicker value={transferDate} onChange={setTransferDate} />
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
                className="w-full bg-app border border-line-strong rounded px-3 py-1.5 text-xs text-gray-200 font-mono focus:outline-none focus:border-blue-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs text-gray-300 font-medium mb-1">
              Description (Optional)
            </label>
            <input
              type="text"
              value={desc}
              onChange={(e) => setDesc(e.target.value)}
              className="w-full bg-app border border-line-strong rounded px-3 py-1.5 text-xs text-gray-200 focus:outline-none focus:border-blue-500"
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
              className="w-full bg-app border border-line-strong rounded px-3 py-1.5 text-xs text-gray-200 font-mono focus:outline-none focus:border-blue-500"
            />
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-line">
            <button
              type="button"
              onClick={() => setIsModalOpen(false)}
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
              <span>{isSubmitting ? 'Transferring...' : 'Transfer Funds'}</span>
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
            <div className="grid grid-cols-2 gap-2 bg-app border border-line p-3 rounded">
              <div>
                <span className="text-gray-400">Date</span>
                <p className="font-mono text-gray-200">{formatDate(selectedTx.date)}</p>
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
                className="px-3 py-1.5 bg-surface-hover hover:bg-surface-raised text-gray-300 rounded text-xs transition-colors"
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
