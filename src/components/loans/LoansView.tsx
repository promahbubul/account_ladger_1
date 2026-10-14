import React, { useState } from 'react';
import {
  Plus,
  Search,
  Eye,
  Trash2,
  History,
} from 'lucide-react';
import { formatBDT } from '../../lib/formatters';
import { useFinance } from '../../context/FinanceContext';
import { Loan, LoanRepayment } from '../../mock/data';
import { Modal, ConfirmModal } from '../common/Modal';

interface LoansViewProps {
  onOpenAddLoanModal: () => void;
  onOpenRepaymentModal: (loan: Loan) => void;
  onSuccessNotification: (msg: string) => void;
}

export const LoansView: React.FC<LoansViewProps> = ({
  onOpenAddLoanModal,
  onOpenRepaymentModal,
  onSuccessNotification,
}) => {
  const { loans, repayments, accounts, addLoan, recordRepayment, deleteLoan } = useFinance();

  const [activeTab, setActiveTab] = useState<'LOANS' | 'REPAYMENTS'>('LOANS');
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<'ALL' | 'LENT' | 'BORROWED'>('ALL');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'ACTIVE' | 'SETTLED'>('ALL');

  // Modals
  const [isAddLoanOpen, setIsAddLoanOpen] = useState(false);
  const [repaymentTargetLoan, setRepaymentTargetLoan] = useState<Loan | null>(null);
  const [viewHistoryLoan, setViewHistoryLoan] = useState<Loan | null>(null);
  const [loanToDelete, setLoanToDelete] = useState<Loan | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Add loan form state
  const [loanType, setLoanType] = useState<'LENT' | 'BORROWED'>('LENT');
  const [counterparty, setCounterparty] = useState('');
  const [contact, setContact] = useState('');
  const [principal, setPrincipal] = useState('');
  const [accountId, setAccountId] = useState(accounts[0]?.id || '');
  const [startDate, setStartDate] = useState('14 Oct 2026');
  const [dueDate, setDueDate] = useState('');
  const [notes, setNotes] = useState('');

  // Repayment form state
  const [repAmount, setRepAmount] = useState('');
  const [repAccount, setRepAccount] = useState(accounts[0]?.id || '');
  const [repDate, setRepDate] = useState('14 Oct 2026');
  const [repNotes, setRepNotes] = useState('');

  // Computations
  const totalReceivables = loans
    .filter((l) => l.type === 'LENT')
    .reduce((sum, l) => sum + l.outstandingPrincipal, 0);

  const totalPayables = loans
    .filter((l) => l.type === 'BORROWED')
    .reduce((sum, l) => sum + l.outstandingPrincipal, 0);

  const activeCount = loans.filter((l) => l.status === 'ACTIVE' || l.status === 'PARTIALLY_REPAID').length;
  const settledCount = loans.filter((l) => l.status === 'SETTLED').length;

  const filteredLoans = loans.filter((l) => {
    const matchesSearch =
      l.counterpartyName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (l.counterpartyContact && l.counterpartyContact.includes(searchQuery));

    const matchesType = typeFilter === 'ALL' || l.type === typeFilter;
    const matchesStatus =
      statusFilter === 'ALL' ||
      (statusFilter === 'ACTIVE' && l.status !== 'SETTLED') ||
      (statusFilter === 'SETTLED' && l.status === 'SETTLED');

    return matchesSearch && matchesType && matchesStatus;
  });

  const handleCreateLoan = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    const amountNum = parseFloat(principal);
    if (isNaN(amountNum) || amountNum <= 0) return;
    if (!counterparty.trim()) return;

    const res = addLoan({
      type: loanType,
      counterpartyName: counterparty.trim(),
      counterpartyContact: contact.trim() || undefined,
      principalAmount: amountNum,
      accountId: accountId || accounts[0]?.id || '',
      startDate,
      dueDate: dueDate.trim() || undefined,
      notes: notes.trim() || undefined,
    });

    if (res.success) {
      onSuccessNotification(
        `Recorded ${loanType === 'LENT' ? 'Loan Given to' : 'Loan Borrowed from'} ${counterparty} of ${formatBDT(amountNum)}.`
      );
      setIsAddLoanOpen(false);
      setCounterparty('');
      setContact('');
      setPrincipal('');
      setDueDate('');
      setNotes('');
    } else {
      setErrorMessage(res.error || 'Failed to record loan.');
    }
  };

  const handleExecuteRepayment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!repaymentTargetLoan) return;
    setErrorMessage(null);
    const amountNum = parseFloat(repAmount);
    if (isNaN(amountNum) || amountNum <= 0) return;

    const res = recordRepayment({
      loanId: repaymentTargetLoan.id,
      accountId: repAccount || accounts[0]?.id || '',
      amount: amountNum,
      date: repDate,
      notes: repNotes.trim() || undefined,
    });

    if (res.success) {
      onSuccessNotification(
        `Repayment of ${formatBDT(amountNum)} recorded for ${repaymentTargetLoan.counterpartyName}.`
      );
      setRepaymentTargetLoan(null);
      setRepAmount('');
      setRepNotes('');
    } else {
      setErrorMessage(res.error || 'Failed to record repayment.');
    }
  };

  const confirmDeleteLoan = () => {
    if (!loanToDelete) return;
    deleteLoan(loanToDelete.id);
    onSuccessNotification(`Loan record with ${loanToDelete.counterpartyName} deleted.`);
    setLoanToDelete(null);
  };

  return (
    <div className="space-y-4">
      {/* Error alert */}
      {errorMessage && (
        <div className="p-3 bg-red-950/40 border border-red-900/60 rounded text-xs text-red-300 flex items-center justify-between">
          <span>{errorMessage}</span>
          <button onClick={() => setErrorMessage(null)} className="text-red-400 hover:text-red-200">Dismiss</button>
        </div>
      )}

      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <h2 className="text-base font-semibold text-gray-100">Loans</h2>
        <button
          onClick={() => setIsAddLoanOpen(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded text-xs font-medium self-start sm:self-auto transition-colors"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>Record Loan</span>
        </button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="bg-[#16181d] border border-[#22252c] rounded p-3">
          <div className="text-xs text-gray-400">Total Money Lent (Receivable)</div>
          <div className="text-lg font-semibold font-mono text-emerald-400 mt-0.5">
            {formatBDT(totalReceivables)}
          </div>
        </div>

        <div className="bg-[#16181d] border border-[#22252c] rounded p-3">
          <div className="text-xs text-gray-400">Total Borrowed (Payable)</div>
          <div className="text-lg font-semibold font-mono text-gray-200 mt-0.5">
            {formatBDT(totalPayables)}
          </div>
        </div>

        <div className="bg-[#16181d] border border-[#22252c] rounded p-3">
          <div className="text-xs text-gray-400">Net Loan Balance</div>
          <div className="text-lg font-semibold font-mono text-blue-400 mt-0.5">
            {formatBDT(totalReceivables - totalPayables)}
          </div>
        </div>

        <div className="bg-[#16181d] border border-[#22252c] rounded p-3">
          <div className="text-xs text-gray-400">Active vs Settled Loans</div>
          <div className="text-lg font-semibold font-mono text-gray-100 mt-0.5">
            {activeCount} Active <span className="text-gray-500 text-sm">/ {settledCount} Settled</span>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-[#22252c] text-xs">
        <button
          onClick={() => setActiveTab('LOANS')}
          className={`py-2 px-4 font-medium transition-colors border-b-2 -mb-px ${
            activeTab === 'LOANS'
              ? 'border-blue-500 text-blue-400 bg-[#16181d]'
              : 'border-transparent text-gray-400 hover:text-gray-200'
          }`}
        >
          Loans ({loans.length})
        </button>
        <button
          onClick={() => setActiveTab('REPAYMENTS')}
          className={`py-2 px-4 font-medium transition-colors border-b-2 -mb-px flex items-center gap-1.5 ${
            activeTab === 'REPAYMENTS'
              ? 'border-blue-500 text-blue-400 bg-[#16181d]'
              : 'border-transparent text-gray-400 hover:text-gray-200'
          }`}
        >
          <History className="w-3.5 h-3.5" />
          <span>Repayments ({repayments.length})</span>
        </button>
      </div>

      {activeTab === 'LOANS' ? (
        <>
          {/* Search & Filter Toolbar */}
          <div className="bg-[#16181d] border border-[#22252c] rounded p-2.5 flex flex-col md:flex-row items-center justify-between gap-2.5">
            <div className="relative w-full md:w-72">
              <Search className="w-3.5 h-3.5 text-gray-400 absolute left-2.5 top-2.5" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search counterparty name or contact..."
                className="w-full bg-[#111317] border border-[#262932] rounded pl-8 pr-3 py-1.5 text-xs text-gray-200 focus:outline-none focus:border-blue-500"
              />
            </div>

            <div className="flex items-center gap-2 w-full md:w-auto text-xs">
              <select
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value as any)}
                className="bg-[#111317] border border-[#262932] rounded px-2.5 py-1.5 text-xs text-gray-300 focus:outline-none focus:border-blue-500"
              >
                <option value="ALL">All Loan Types</option>
                <option value="LENT">Money Lent (Receivable)</option>
                <option value="BORROWED">Money Borrowed (Payable)</option>
              </select>

              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as any)}
                className="bg-[#111317] border border-[#262932] rounded px-2.5 py-1.5 text-xs text-gray-300 focus:outline-none focus:border-blue-500"
              >
                <option value="ALL">All Statuses</option>
                <option value="ACTIVE">Active / Unsettled</option>
                <option value="SETTLED">Settled / Closed</option>
              </select>
            </div>
          </div>

          {/* Loans Table */}
          <div className="bg-[#16181d] border border-[#22252c] rounded overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-[#22252c] bg-[#121417] text-gray-400 font-medium uppercase tracking-wider text-[10px]">
                    <th className="py-2.5 px-3">Counterparty</th>
                    <th className="py-2.5 px-3">Type</th>
                    <th className="py-2.5 px-3">Disbursed From</th>
                    <th className="py-2.5 px-3 text-right">Principal</th>
                    <th className="py-2.5 px-3 text-right">Outstanding</th>
                    <th className="py-2.5 px-3">Start Date</th>
                    <th className="py-2.5 px-3">Due Date</th>
                    <th className="py-2.5 px-3 text-center">Status</th>
                    <th className="py-2.5 px-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#20232a]">
                  {filteredLoans.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="py-8 text-center text-gray-500">
                        No loan records found.
                      </td>
                    </tr>
                  ) : (
                    filteredLoans.map((loan) => (
                      <tr key={loan.id} className="hover:bg-[#1a1d24] transition-colors">
                        <td className="py-2.5 px-3">
                          <div className="font-medium text-gray-200">{loan.counterpartyName}</div>
                          {loan.counterpartyContact && (
                            <div className="text-[11px] text-gray-500 font-mono">{loan.counterpartyContact}</div>
                          )}
                        </td>
                        <td className="py-2.5 px-3">
                          <span
                            className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-medium ${
                              loan.type === 'LENT'
                                ? 'bg-amber-950/70 text-amber-300 border border-amber-800/60'
                                : 'bg-purple-950/70 text-purple-300 border border-purple-800/60'
                            }`}
                          >
                            {loan.type === 'LENT' ? 'LENT' : 'BORROWED'}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-gray-400">
                          {loan.accountName}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono text-gray-300">
                          {formatBDT(loan.principalAmount)}
                        </td>
                        <td className={`py-2.5 px-3 text-right font-mono font-semibold ${
                          loan.outstandingPrincipal === 0 ? 'text-gray-500' : loan.type === 'LENT' ? 'text-emerald-400' : 'text-gray-100'
                        }`}>
                          {formatBDT(loan.outstandingPrincipal)}
                        </td>
                        <td className="py-2.5 px-3 text-gray-400 font-mono text-[11px] whitespace-nowrap">
                          {loan.startDate}
                        </td>
                        <td className="py-2.5 px-3 text-gray-500 font-mono text-[11px] whitespace-nowrap">
                          {loan.dueDate || '-'}
                        </td>
                        <td className="py-2.5 px-3 text-center">
                          <span
                            className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-medium ${
                              loan.status === 'SETTLED'
                                ? 'bg-emerald-950/70 text-emerald-400 border border-emerald-800/60'
                                : loan.status === 'PARTIALLY_REPAID'
                                ? 'bg-blue-950/70 text-blue-300 border border-blue-800/60'
                                : 'bg-gray-800 text-gray-300 border border-gray-700'
                            }`}
                          >
                            {loan.status}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            {loan.outstandingPrincipal > 0 && (
                              <button
                                onClick={() => setRepaymentTargetLoan(loan)}
                                className="px-2 py-0.5 bg-blue-600 hover:bg-blue-700 text-white rounded text-[11px] transition-colors"
                              >
                                Repay
                              </button>
                            )}
                            <button
                              onClick={() => setViewHistoryLoan(loan)}
                              title="Repayment History"
                              className="p-1 text-gray-400 hover:text-gray-200 hover:bg-[#22252e] rounded"
                            >
                              <Eye className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => setLoanToDelete(loan)}
                              title="Delete Loan"
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
              <span>Showing {filteredLoans.length} of {loans.length} loans</span>
            </div>
          </div>
        </>
      ) : (
        /* Repayments History Table */
        <div className="bg-[#16181d] border border-[#22252c] rounded overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-[#22252c] bg-[#121417] text-gray-400 font-medium uppercase tracking-wider text-[10px]">
                  <th className="py-2.5 px-3">Date</th>
                  <th className="py-2.5 px-3">Counterparty</th>
                  <th className="py-2.5 px-3">Account</th>
                  <th className="py-2.5 px-3">Notes</th>
                  <th className="py-2.5 px-3 text-right">Repayment Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#20232a]">
                {repayments.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-gray-500">
                      No repayments recorded yet.
                    </td>
                  </tr>
                ) : (
                  repayments.map((rep) => (
                    <tr key={rep.id} className="hover:bg-[#1a1d24]">
                      <td className="py-2.5 px-3 text-gray-400 font-mono text-[11px] whitespace-nowrap">
                        {rep.date}
                      </td>
                      <td className="py-2.5 px-3 font-medium text-gray-200">
                        {rep.counterpartyName}
                      </td>
                      <td className="py-2.5 px-3 text-gray-400">
                        {rep.accountName}
                      </td>
                      <td className="py-2.5 px-3 text-gray-500">
                        {rep.notes || '-'}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono font-semibold text-emerald-400 whitespace-nowrap">
                        +{formatBDT(rep.amount)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <div className="py-2 px-3 border-t border-[#22252c] bg-[#121417] text-gray-400 text-xs">
            Total {repayments.length} repayments processed
          </div>
        </div>
      )}

      {/* Record Loan Modal */}
      <Modal
        isOpen={isAddLoanOpen}
        onClose={() => setIsAddLoanOpen(false)}
        title="Record Loan"
      >
        <form onSubmit={handleCreateLoan} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-gray-300 font-medium mb-1">
                Loan Type *
              </label>
              <select
                value={loanType}
                onChange={(e) => setLoanType(e.target.value as any)}
                className="w-full bg-[#111317] border border-[#262932] rounded px-3 py-1.5 text-xs text-gray-200 focus:outline-none focus:border-blue-500"
              >
                <option value="LENT">Money Lent (Receivable)</option>
                <option value="BORROWED">Money Borrowed (Payable)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs text-gray-300 font-medium mb-1">
                Principal Amount (৳ BDT) *
              </label>
              <input
                type="number"
                step="0.01"
                required
                value={principal}
                onChange={(e) => setPrincipal(e.target.value)}
                placeholder="0.00"
                className="w-full bg-[#111317] border border-[#262932] rounded px-3 py-1.5 text-xs text-gray-200 font-mono focus:outline-none focus:border-blue-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-gray-300 font-medium mb-1">
                Counterparty Name *
              </label>
              <input
                type="text"
                required
                value={counterparty}
                onChange={(e) => setCounterparty(e.target.value)}
                placeholder="e.g. Farhan Karim"
                className="w-full bg-[#111317] border border-[#262932] rounded px-3 py-1.5 text-xs text-gray-200 focus:outline-none focus:border-blue-500"
              />
            </div>

            <div>
              <label className="block text-xs text-gray-300 font-medium mb-1">
                Contact / Phone
              </label>
              <input
                type="text"
                value={contact}
                onChange={(e) => setContact(e.target.value)}
                placeholder="e.g. +8801712000000"
                className="w-full bg-[#111317] border border-[#262932] rounded px-3 py-1.5 text-xs text-gray-200 font-mono focus:outline-none focus:border-blue-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-gray-300 font-medium mb-1">
                Disbursement Account *
              </label>
              <select
                value={accountId}
                onChange={(e) => setAccountId(e.target.value)}
                className="w-full bg-[#111317] border border-[#262932] rounded px-3 py-1.5 text-xs text-gray-200 focus:outline-none focus:border-blue-500"
              >
                {accounts.filter(a => a.status === 'ACTIVE').map((acc) => (
                  <option key={acc.id} value={acc.id}>{acc.name} ({formatBDT(acc.currentBalance)})</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs text-gray-300 font-medium mb-1">
                Start Date *
              </label>
              <input
                type="text"
                required
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full bg-[#111317] border border-[#262932] rounded px-3 py-1.5 text-xs text-gray-200 focus:outline-none focus:border-blue-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs text-gray-300 font-medium mb-1">
              Due Date (Optional)
            </label>
            <input
              type="text"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              placeholder="e.g. 30 Nov 2026"
              className="w-full bg-[#111317] border border-[#262932] rounded px-3 py-1.5 text-xs text-gray-200 focus:outline-none focus:border-blue-500"
            />
          </div>

          <div>
            <label className="block text-xs text-gray-300 font-medium mb-1">
              Notes
            </label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Purpose or terms"
              className="w-full bg-[#111317] border border-[#262932] rounded px-3 py-1.5 text-xs text-gray-200 focus:outline-none focus:border-blue-500"
            />
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-[#22252c]">
            <button
              type="button"
              onClick={() => setIsAddLoanOpen(false)}
              className="px-3 py-1.5 bg-[#1a1d24] hover:bg-[#222631] text-gray-300 rounded text-xs transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded text-xs font-medium transition-colors"
            >
              Save Loan
            </button>
          </div>
        </form>
      </Modal>

      {/* Record Repayment Modal */}
      <Modal
        isOpen={Boolean(repaymentTargetLoan)}
        onClose={() => setRepaymentTargetLoan(null)}
        title={repaymentTargetLoan ? `Record Repayment: ${repaymentTargetLoan.counterpartyName}` : 'Repayment'}
      >
        {repaymentTargetLoan && (
          <form onSubmit={handleExecuteRepayment} className="space-y-3">
            <div className="p-2.5 bg-[#111317] border border-[#22252c] rounded text-xs flex justify-between">
              <div>
                <span className="text-gray-400">Total Principal:</span>
                <span className="font-mono text-gray-200 ml-1.5">{formatBDT(repaymentTargetLoan.principalAmount)}</span>
              </div>
              <div>
                <span className="text-gray-400">Outstanding:</span>
                <span className="font-mono text-emerald-400 font-semibold ml-1.5">{formatBDT(repaymentTargetLoan.outstandingPrincipal)}</span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-gray-300 font-medium mb-1">
                  Repayment Amount (৳ BDT) *
                </label>
                <input
                  type="number"
                  step="0.01"
                  max={repaymentTargetLoan.outstandingPrincipal}
                  required
                  value={repAmount}
                  onChange={(e) => setRepAmount(e.target.value)}
                  placeholder="0.00"
                  className="w-full bg-[#111317] border border-[#262932] rounded px-3 py-1.5 text-xs text-gray-200 font-mono focus:outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs text-gray-300 font-medium mb-1">
                  Settlement Account *
                </label>
                <select
                  value={repAccount}
                  onChange={(e) => setRepAccount(e.target.value)}
                  className="w-full bg-[#111317] border border-[#262932] rounded px-3 py-1.5 text-xs text-gray-200 focus:outline-none focus:border-blue-500"
                >
                  {accounts.filter(a => a.status === 'ACTIVE').map((acc) => (
                    <option key={acc.id} value={acc.id}>{acc.name} ({formatBDT(acc.currentBalance)})</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-gray-300 font-medium mb-1">
                  Date *
                </label>
                <input
                  type="text"
                  required
                  value={repDate}
                  onChange={(e) => setRepDate(e.target.value)}
                  className="w-full bg-[#111317] border border-[#262932] rounded px-3 py-1.5 text-xs text-gray-200 focus:outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs text-gray-300 font-medium mb-1">
                  Notes
                </label>
                <input
                  type="text"
                  value={repNotes}
                  onChange={(e) => setRepNotes(e.target.value)}
                  placeholder="Installment remarks"
                  className="w-full bg-[#111317] border border-[#262932] rounded px-3 py-1.5 text-xs text-gray-200 focus:outline-none focus:border-blue-500"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-[#22252c]">
              <button
                type="button"
                onClick={() => setRepaymentTargetLoan(null)}
                className="px-3 py-1.5 bg-[#1a1d24] hover:bg-[#222631] text-gray-300 rounded text-xs transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded text-xs font-medium transition-colors"
              >
                Record Repayment
              </button>
            </div>
          </form>
        )}
      </Modal>

      {/* Loan History Modal */}
      <Modal
        isOpen={Boolean(viewHistoryLoan)}
        onClose={() => setViewHistoryLoan(null)}
        title={viewHistoryLoan ? `${viewHistoryLoan.counterpartyName} — Repayments` : 'Repayments'}
      >
        {viewHistoryLoan && (
          <div className="space-y-3">
            <div className="overflow-x-auto max-h-60 border border-[#22252c] rounded">
              <table className="w-full text-left text-xs">
                <thead className="bg-[#121417] text-gray-400 border-b border-[#22252c] text-[10px] uppercase">
                  <tr>
                    <th className="py-2 px-3">Date</th>
                    <th className="py-2 px-3">Account</th>
                    <th className="py-2 px-3">Notes</th>
                    <th className="py-2 px-3 text-right">Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#1e2129]">
                  {repayments.filter(r => r.loanId === viewHistoryLoan.id).length === 0 ? (
                    <tr>
                      <td colSpan={4} className="py-6 text-center text-gray-500">
                        No repayments recorded for this loan yet.
                      </td>
                    </tr>
                  ) : (
                    repayments
                      .filter(r => r.loanId === viewHistoryLoan.id)
                      .map((rep) => (
                        <tr key={rep.id} className="hover:bg-[#1a1d24]">
                          <td className="py-2 px-3 text-gray-400 font-mono text-[11px]">{rep.date}</td>
                          <td className="py-2 px-3 text-gray-300">{rep.accountName}</td>
                          <td className="py-2 px-3 text-gray-400">{rep.notes || '-'}</td>
                          <td className="py-2 px-3 text-right font-mono font-medium text-emerald-400">
                            +{formatBDT(rep.amount)}
                          </td>
                        </tr>
                      ))
                  )}
                </tbody>
              </table>
            </div>

            <div className="flex justify-end pt-2">
              <button
                type="button"
                onClick={() => setViewHistoryLoan(null)}
                className="px-3 py-1.5 bg-[#1a1d24] hover:bg-[#222631] text-gray-300 rounded text-xs transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* Delete Loan Confirmation */}
      <ConfirmModal
        isOpen={Boolean(loanToDelete)}
        onClose={() => setLoanToDelete(null)}
        onConfirm={confirmDeleteLoan}
        title="Delete Loan Record"
        message={loanToDelete ? `Are you sure you want to delete the loan record for "${loanToDelete.counterpartyName}"?` : ''}
        confirmLabel="Delete"
        isDestructive={true}
      />
    </div>
  );
};
