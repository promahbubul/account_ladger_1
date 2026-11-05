import React, { useState, useEffect } from 'react';
import { Modal } from '../common/Modal';
import { useFinance } from '../../context/FinanceContext';
import { formatBDT } from '../../lib/formatters';
import { Loader2 } from 'lucide-react';
import { useToast } from '../../context/ToastContext';
import { DatePicker, getDhakaTodayISO } from '../common/DatePicker';
import { getErrorMessage } from '../../lib/errors';

interface TransferModalProps {
  onClose: () => void;
}

export const TransferModal: React.FC<TransferModalProps> = ({ onClose }) => {
  const toast = useToast();
  const { accounts, addTransfer } = useFinance();

  const getTodayDate = () => getDhakaTodayISO();
  const [modalError, setModalError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [sourceAccId, setSourceAccId] = useState(accounts[0]?.id || '');
  const [destAccId, setDestAccId] = useState(accounts[1]?.id || '');
  const [transferDate, setTransferDate] = useState(getTodayDate());
  const [transferAmount, setTransferAmount] = useState('');
  const [transferDesc, setTransferDesc] = useState('');
  const [transferRef, setTransferRef] = useState('');

  useEffect(() => {
    const activeAccounts = accounts.filter((a) => a.status === 'ACTIVE');
    if (activeAccounts.length > 0) {
      if (!sourceAccId || !activeAccounts.some((a) => a.id === sourceAccId)) {
        setSourceAccId(activeAccounts[0].id);
      }
      if (!destAccId || destAccId === sourceAccId || !activeAccounts.some((a) => a.id === destAccId)) {
        const second = activeAccounts.find((a) => a.id !== (sourceAccId || activeAccounts[0].id));
        if (second) setDestAccId(second.id);
      }
    }
    setTransferDate(getTodayDate());
    setModalError(null);
    setIsSubmitting(false);
  }, [accounts]);

  // Submit Transfer
  const handleTransferSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setModalError(null);
    const amountNum = parseFloat(transferAmount);
    if (isNaN(amountNum) || amountNum <= 0) {
      toast.error('Please enter a valid transfer amount.');
      return;
    }

    if (!sourceAccId || !destAccId) {
      toast.error('Please select both source and destination accounts.');
      return;
    }

    if (sourceAccId === destAccId) {
      const err = 'Source and destination accounts must be different.';
      setModalError(err);
      toast.error(err);
      return;
    }

    setIsSubmitting(true);
    const toastId = toast.loading('Executing account transfer...');
    try {
      const res = await addTransfer({
        sourceAccountId: sourceAccId,
        destinationAccountId: destAccId,
        amount: amountNum,
        date: transferDate || getTodayDate(),
        description: transferDesc.trim() || undefined,
        reference: transferRef.trim() || undefined,
      });

      if (!res.success) {
        const err = res.error || 'Transfer failed.';
        setModalError(err);
        toast.updateToast(toastId, { type: 'error', message: err });
        return;
      }

      const fromName = accounts.find((a) => a.id === sourceAccId)?.name || 'Source';
      const toName = accounts.find((a) => a.id === destAccId)?.name || 'Destination';
      toast.updateToast(toastId, {
        type: 'success',
        message: `Transferred ${formatBDT(amountNum)} from ${fromName} to ${toName}`,
      });
      setTransferAmount('');
      setTransferDesc('');
      setTransferRef('');
      onClose();
    } catch (err: unknown) {
      const errMsg = getErrorMessage(err) || 'Network error during transfer';
      setModalError(errMsg);
      toast.updateToast(toastId, { type: 'error', message: errMsg });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen
      onClose={onClose}
      title="Transfer Money"
    >
      <form onSubmit={handleTransferSubmit} className="space-y-3">
        {modalError && (
          <div className="p-2.5 rounded bg-red-950/40 border border-red-800/60 text-xs text-red-300">
            {modalError}
          </div>
        )}

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs text-gray-300 font-medium mb-1">From Account *</label>
            <select
              value={sourceAccId}
              onChange={(e) => setSourceAccId(e.target.value)}
              className="w-full bg-app border border-line-strong rounded px-3 py-1.5 text-xs text-gray-200 focus:outline-none focus:border-blue-500"
            >
              {accounts.filter(a => a.status === 'ACTIVE').map((acc) => (
                <option key={acc.id} value={acc.id}>{acc.name} ({formatBDT(acc.currentBalance)})</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs text-gray-300 font-medium mb-1">To Account *</label>
            <select
              value={destAccId}
              onChange={(e) => setDestAccId(e.target.value)}
              className="w-full bg-app border border-line-strong rounded px-3 py-1.5 text-xs text-gray-200 focus:outline-none focus:border-blue-500"
            >
              {accounts.filter(a => a.status === 'ACTIVE').map((acc) => (
                <option key={acc.id} value={acc.id}>{acc.name} ({formatBDT(acc.currentBalance)})</option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs text-gray-300 font-medium mb-1">Transfer Date *</label>
            <DatePicker value={transferDate} onChange={setTransferDate} />
          </div>

          <div>
            <label className="block text-xs text-gray-300 font-medium mb-1">Transfer Amount (৳ BDT) *</label>
            <input
              type="number"
              step="0.01"
              required
              value={transferAmount}
              onChange={(e) => setTransferAmount(e.target.value)}
              placeholder="0.00"
              className="w-full bg-app border border-line-strong rounded px-3 py-1.5 text-xs text-gray-200 font-mono focus:outline-none focus:border-blue-500"
            />
          </div>
        </div>

        <div>
          <label className="block text-xs text-gray-300 font-medium mb-1">Description (Optional)</label>
          <input
            type="text"
            value={transferDesc}
            onChange={(e) => setTransferDesc(e.target.value)}
            className="w-full bg-app border border-line-strong rounded px-3 py-1.5 text-xs text-gray-200 focus:outline-none focus:border-blue-500"
          />
        </div>

        <div>
          <label className="block text-xs text-gray-300 font-medium mb-1">Reference (Optional)</label>
          <input
            type="text"
            value={transferRef}
            onChange={(e) => setTransferRef(e.target.value)}
            className="w-full bg-app border border-line-strong rounded px-3 py-1.5 text-xs text-gray-200 font-mono focus:outline-none focus:border-blue-500"
          />
        </div>

        <div className="flex justify-end gap-2 pt-3 border-t border-line">
          <button
            type="button"
            onClick={onClose}
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
            <span>{isSubmitting ? 'Executing Transfer...' : 'Execute Transfer'}</span>
          </button>
        </div>
      </form>
    </Modal>
  );
};
