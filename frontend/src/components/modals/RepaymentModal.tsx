import React, { useState } from 'react';
import { Modal } from '../common/Modal';
import { useFinance } from '../../context/FinanceContext';
import { Loan } from '../../mock/data';
import { formatBDT } from '../../lib/formatters';
import { Loader2 } from 'lucide-react';
import { useToast } from '../../context/ToastContext';
import { DatePicker, getDhakaTodayISO } from '../common/DatePicker';

interface RepaymentModalProps {
  onClose: () => void;
  selectedLoanForRepayment?: Loan | null;
}

export const RepaymentModal: React.FC<RepaymentModalProps> = ({ onClose, selectedLoanForRepayment }) => {
  const toast = useToast();
  const { accounts, recordRepayment } = useFinance();

  const getTodayDate = () => getDhakaTodayISO();
  const [modalError, setModalError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [repaymentAmount, setRepaymentAmount] = useState('');
  const [repaymentAccount, setRepaymentAccount] = useState(accounts[0]?.id || '');
  const [repaymentDate, setRepaymentDate] = useState(getTodayDate());
  const [repaymentNote, setRepaymentNote] = useState('');

  // Submit Repayment
  const handleRepaymentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedLoanForRepayment) return;
    setModalError(null);
    const amountNum = parseFloat(repaymentAmount);
    if (isNaN(amountNum) || amountNum <= 0 || isSubmitting) return;

    setIsSubmitting(true);
    const res = await recordRepayment({
      loanId: selectedLoanForRepayment.id,
      accountId: repaymentAccount || accounts[0]?.id || '',
      amount: amountNum,
      date: repaymentDate,
      notes: repaymentNote.trim() || undefined,
    });
    setIsSubmitting(false);

    if (!res.success) {
      setModalError(res.error || 'Repayment failed.');
      toast.error(res.error || 'Repayment failed');
      return;
    }

    toast.success(
      `Repayment of ${formatBDT(amountNum)} recorded for ${selectedLoanForRepayment.counterpartyName}`
    );
    onClose();
  };

  return (
    <Modal
      isOpen
      onClose={onClose}
      title={selectedLoanForRepayment ? `Repayment: ${selectedLoanForRepayment.counterpartyName}` : 'Loan Repayment'}
    >
      {selectedLoanForRepayment && (
        <form onSubmit={handleRepaymentSubmit} className="space-y-3">
          {modalError && (
            <div className="p-2.5 rounded bg-red-950/40 border border-red-800/60 text-xs text-red-300">
              {modalError}
            </div>
          )}

          <div className="p-2.5 bg-app border border-line rounded text-xs flex justify-between">
            <div>
              <span className="text-gray-400">Total Principal:</span>
              <span className="font-mono text-gray-200 ml-1.5">{formatBDT(selectedLoanForRepayment.principalAmount)}</span>
            </div>
            <div>
              <span className="text-gray-400">Outstanding:</span>
              <span className="font-mono text-emerald-400 font-semibold ml-1.5">{formatBDT(selectedLoanForRepayment.outstandingPrincipal)}</span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-gray-300 font-medium mb-1">Repayment Amount (৳ BDT) *</label>
              <input
                type="number"
                step="0.01"
                max={selectedLoanForRepayment.outstandingPrincipal}
                required
                value={repaymentAmount}
                onChange={(e) => setRepaymentAmount(e.target.value)}
                placeholder="0.00"
                className="w-full bg-app border border-line-strong rounded px-3 py-1.5 text-xs text-gray-200 font-mono focus:outline-none focus:border-blue-500"
              />
            </div>

            <div>
              <label className="block text-xs text-gray-300 font-medium mb-1">Settlement Account *</label>
              <select
                value={repaymentAccount}
                onChange={(e) => setRepaymentAccount(e.target.value)}
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
              <label className="block text-xs text-gray-300 font-medium mb-1">Date *</label>
              <DatePicker value={repaymentDate} onChange={setRepaymentDate} />
            </div>

            <div>
              <label className="block text-xs text-gray-300 font-medium mb-1">Notes</label>
              <input
                type="text"
                value={repaymentNote}
                onChange={(e) => setRepaymentNote(e.target.value)}
                className="w-full bg-app border border-line-strong rounded px-3 py-1.5 text-xs text-gray-200 focus:outline-none focus:border-blue-500"
              />
            </div>
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
              <span>{isSubmitting ? 'Recording Repayment...' : 'Record Repayment'}</span>
            </button>
          </div>
        </form>
      )}
    </Modal>
  );
};
