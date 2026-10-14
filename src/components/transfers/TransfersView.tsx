import React, { useState } from 'react';
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

interface TransfersViewProps {
  onOpenTransferModal: () => void;
  onSuccessNotification: (msg: string) => void;
}

export const TransfersView: React.FC<TransfersViewProps> = ({
  onOpenTransferModal,
  onSuccessNotification,
}) => {
  const { transactions, accounts, addTransfer, deleteTransaction } = useFinance();

  const [searchQuery, setSearchQuery] = useState('');
  const [sourceFilter, setSourceFilter] = useState('ALL');
  const [destFilter, setDestFilter] = useState('ALL');

  // Modals
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedTx, setSelectedTx] = useState<Transaction | null>(null);
  const [txToReverse, setTxToReverse] = useState<Transaction | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Transfer form
  const [fromAccId, setFromAccId] = useState(accounts[0]?.id || '');
  const [toAccId, setToAccId] = useState(accounts[1]?.id || '');
  const [amount, setAmount] = useState('');
  const [desc, setDesc] = useState('');
  const [refNum, setRefNum] = useState('');

  const transfers = transactions.filter((t) => t.type === 'TRANSFER');

  const filteredTransfers = transfers.filter((t) => {
    const matchesSearch =
      t.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (t.reference && t.reference.toLowerCase().includes(searchQuery.toLowerCase()));

    const matchesSource = sourceFilter === 'ALL' || t.accountId === sourceFilter;
    const matchesDest = destFilter === 'ALL' || t.destinationAccountId === destFilter;

    return matchesSearch && matchesSource && matchesDest;
  });

  const totalVolume = filteredTransfers.reduce((sum, t) => sum + t.amount, 0);

  const handleCreateTransfer = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    const amountNum = parseFloat(amount);
    if (isNaN(amountNum) || amountNum <= 0) return;

    if (fromAccId === toAccId) {
      setErrorMessage('Source and destination accounts must be different.');
      return;
    }

    const res = addTransfer({
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
    } else {
      setErrorMessage(res.error || 'Failed to complete transfer.');
    }
  };

  const confirmReverseTransfer = () => {
    if (!txToReverse) return;
    deleteTransaction(txToReverse.id);
    onSuccessNotification(`Transfer reversed successfully.`);
    setTxToReverse(null);
  };

  return (
    <div className="space-y-4">
      {/* Error Banner */}
      {errorMessage && (
        <div className="p-3 bg-red-950/40 border border-red-900/60 rounded text-xs text-red-300 flex items-center justify-between">
          <span>{errorMessage}</span>
          <button onClick={() => setErrorMessage(null)} className="text-red-400 hover:text-red-200">Dismiss</button>
        </div>
      )}

      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <h2 className="text-base font-semibold text-gray-100">Transfers</h2>
        <button
          onClick={() => setIsModalOpen(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded text-xs font-medium self-start sm:self-auto transition-colors"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>New Transfer</span>
        </button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="bg-[#16181d] border border-[#22252c] rounded p-3">
          <div className="text-xs text-gray-400">Total Transferred Volume</div>
          <div className="text-lg font-semibold font-mono text-gray-100 mt-0.5">
            {formatBDT(totalVolume)}
          </div>
        </div>

        <div className="bg-[#16181d] border border-[#22252c] rounded p-3">
          <div className="text-xs text-gray-400">Transfer Count</div>
          <div className="text-lg font-semibold font-mono text-gray-200 mt-0.5">
            {filteredTransfers.length}
          </div>
        </div>
      </div>

      {/* Search and Filters */}
      <div className="bg-[#16181d] border border-[#22252c] rounded p-2.5 flex flex-col md:flex-row items-center justify-between gap-2.5">
        <div className="relative w-full md:w-72">
          <Search className="w-3.5 h-3.5 text-gray-400 absolute left-2.5 top-2.5" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search transfers or reference..."
            className="w-full bg-[#111317] border border-[#262932] rounded pl-8 pr-3 py-1.5 text-xs text-gray-200 focus:outline-none focus:border-blue-500"
          />
        </div>

        <div className="flex items-center gap-2 w-full md:w-auto text-xs">
          <select
            value={sourceFilter}
            onChange={(e) => setSourceFilter(e.target.value)}
            className="bg-[#111317] border border-[#262932] rounded px-2.5 py-1.5 text-xs text-gray-300 focus:outline-none focus:border-blue-500"
          >
            <option value="ALL">All Source Accounts</option>
            {accounts.map((a) => (
              <option key={a.id} value={a.id}>From: {a.name}</option>
            ))}
          </select>

          <select
            value={destFilter}
            onChange={(e) => setDestFilter(e.target.value)}
            className="bg-[#111317] border border-[#262932] rounded px-2.5 py-1.5 text-xs text-gray-300 focus:outline-none focus:border-blue-500"
          >
            <option value="ALL">All Destination Accounts</option>
            {accounts.map((a) => (
              <option key={a.id} value={a.id}>To: {a.name}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Transfers Table */}
      <div className="bg-[#16181d] border border-[#22252c] rounded overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-[#22252c] bg-[#121417] text-gray-400 font-medium uppercase tracking-wider text-[10px]">
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
              {filteredTransfers.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-gray-500">
                    No transfers found.
                  </td>
                </tr>
              ) : (
                filteredTransfers.map((tx) => (
                  <tr key={tx.id} className="hover:bg-[#1a1d24] transition-colors">
                    <td className="py-2.5 px-3 text-gray-400 font-mono text-[11px] whitespace-nowrap">
                      {tx.date}
                    </td>
                    <td className="py-2.5 px-3 font-medium text-gray-200">
                      {tx.description}
                    </td>
                    <td className="py-2.5 px-3 text-gray-300">
                      {tx.accountName}
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
                          onClick={() => setSelectedTx(tx)}
                          title="View Details"
                          className="p-1 text-gray-400 hover:text-gray-200 hover:bg-[#22252e] rounded"
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => setTxToReverse(tx)}
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

        <div className="py-2 px-3 border-t border-[#22252c] bg-[#121417] text-gray-400 text-xs flex justify-between items-center">
          <span>Showing {filteredTransfers.length} of {transfers.length} transfers</span>
          <span className="font-mono text-gray-200">Volume: {formatBDT(totalVolume)}</span>
        </div>
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
                <p className="text-gray-200">{selectedTx.accountName}</p>
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
        message={txToReverse ? `Reverse transfer of ${formatBDT(txToReverse.amount)} between ${txToReverse.accountName} and ${txToReverse.destinationAccountName}?` : ''}
        confirmLabel="Reverse"
        isDestructive={true}
      />
    </div>
  );
};
