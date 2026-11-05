import React, { useState } from 'react';
import { Modal } from '../common/Modal';
import { useFinance } from '../../context/FinanceContext';
import { formatBDT } from '../../lib/formatters';
import { Loader2 } from 'lucide-react';
import { useToast } from '../../context/ToastContext';
import { DatePicker, getDhakaTodayISO } from '../common/DatePicker';
import { getErrorMessage } from '../../lib/errors';

interface LoanModalProps {
  onClose: () => void;
}

export const LoanModal: React.FC<LoanModalProps> = ({ onClose }) => {
  const toast = useToast();
  const { accounts, addLoan } = useFinance();

  const getTodayDate = () => getDhakaTodayISO();
  const [modalError, setModalError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [loanType, setLoanType] = useState<'LENT' | 'BORROWED'>('LENT');
  const [counterparty, setCounterparty] = useState('');
  const [loanContact, setLoanContact] = useState('');
  const [loanAmount, setLoanAmount] = useState('');
  const [loanAccount, setLoanAccount] = useState(accounts[0]?.id || '');
  const [loanStartDate, setLoanStartDate] = useState(getTodayDate());
  const [loanDueDate, setLoanDueDate] = useState('');
  const [loanNote, setLoanNote] = useState('');

  // Submit Loan
  const handleLoanSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setModalError(null);
    const amountNum = parseFloat(loanAmount);
    if (isNaN(amountNum) || amountNum <= 0) {
      toast.error('Please enter a valid principal amount.');
      return;
    }
    if (!counterparty.trim()) {
      toast.error('Please enter counterparty name.');
      return;
    }
    const accId = loanAccount || accounts[0]?.id;
    if (!accId) {
      toast.error('Please select an account.');
      return;
    }

    setIsSubmitting(true);
    const toastId = toast.loading('Recording loan transaction...');
    try {
      const res = await addLoan({
        type: loanType,
        counterpartyName: counterparty.trim(),
        counterpartyContact: loanContact.trim() || undefined,
        principalAmount: amountNum,
        accountId: accId,
        startDate: loanStartDate,
        dueDate: loanDueDate.trim() || undefined,
        notes: loanNote.trim() || undefined,
      });

      if (!res.success) {
        const err = res.error || 'Could not record loan.';
        setModalError(err);
        toast.updateToast(toastId, { type: 'error', message: err });
        return;
      }

      toast.updateToast(toastId, {
        type: 'success',
        message: `Recorded ${loanType === 'LENT' ? 'Loan Given to' : 'Loan Borrowed from'} ${counterparty}`,
      });
      setCounterparty('');
      setLoanContact('');
      setLoanAmount('');
      setLoanDueDate('');
      setLoanNote('');
      onClose();
    } catch (err: unknown) {
      const errMsg = getErrorMessage(err) || 'Network error while recording loan';
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
      title="Add Loan"
    >
      <form onSubmit={handleLoanSubmit} className="space-y-3">
        {modalError && (
          <div className="p-2.5 rounded bg-red-950/40 border border-red-800/60 text-xs text-red-300">
            {modalError}
          </div>
        )}

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs text-gray-300 font-medium mb-1">Loan Type *</label>
            <select
              value={loanType}
              onChange={(e) => setLoanType(e.target.value as 'LENT' | 'BORROWED')}
              className="w-full bg-app border border-line-strong rounded px-3 py-1.5 text-xs text-gray-200 focus:outline-none focus:border-blue-500"
            >
              <option value="LENT">Money Lent (Receivable)</option>
              <option value="BORROWED">Money Borrowed (Payable)</option>
            </select>
          </div>

          <div>
            <label className="block text-xs text-gray-300 font-medium mb-1">Principal Amount (৳ BDT) *</label>
            <input
              type="number"
              step="0.01"
              required
              value={loanAmount}
              onChange={(e) => setLoanAmount(e.target.value)}
              placeholder="0.00"
              className="w-full bg-app border border-line-strong rounded px-3 py-1.5 text-xs text-gray-200 font-mono focus:outline-none focus:border-blue-500"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs text-gray-300 font-medium mb-1">Counterparty Name *</label>
            <input
              type="text"
              required
              value={counterparty}
              onChange={(e) => setCounterparty(e.target.value)}
              className="w-full bg-app border border-line-strong rounded px-3 py-1.5 text-xs text-gray-200 focus:outline-none focus:border-blue-500"
            />
          </div>

          <div>
            <label className="block text-xs text-gray-300 font-medium mb-1">Contact Phone</label>
            <input
              type="text"
              value={loanContact}
              onChange={(e) => setLoanContact(e.target.value)}
              className="w-full bg-app border border-line-strong rounded px-3 py-1.5 text-xs text-gray-200 font-mono focus:outline-none focus:border-blue-500"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs text-gray-300 font-medium mb-1">Disbursing Account *</label>
            <select
              value={loanAccount}
              onChange={(e) => setLoanAccount(e.target.value)}
              className="w-full bg-app border border-line-strong rounded px-3 py-1.5 text-xs text-gray-200 focus:outline-none focus:border-blue-500"
            >
              {accounts.filter(a => a.status === 'ACTIVE').map((acc) => (
                <option key={acc.id} value={acc.id}>{acc.name} ({formatBDT(acc.currentBalance)})</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs text-gray-300 font-medium mb-1">Start Date *</label>
            <DatePicker value={loanStartDate} onChange={setLoanStartDate} />
          </div>
        </div>

        <div>
          <label className="block text-xs text-gray-300 font-medium mb-1">Due Date (Optional)</label>
          <DatePicker value={loanDueDate} onChange={setLoanDueDate} placeholder="Optional due date" />
        </div>

        <div>
          <label className="block text-xs text-gray-300 font-medium mb-1">Notes</label>
          <input
            type="text"
            value={loanNote}
            onChange={(e) => setLoanNote(e.target.value)}
            className="w-full bg-app border border-line-strong rounded px-3 py-1.5 text-xs text-gray-200 focus:outline-none focus:border-blue-500"
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
            <span>{isSubmitting ? 'Saving Loan...' : 'Save Loan'}</span>
          </button>
        </div>
      </form>
    </Modal>
  );
};
