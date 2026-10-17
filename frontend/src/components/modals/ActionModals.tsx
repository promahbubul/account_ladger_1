import React, { useState } from 'react';
import { Modal } from '../common/Modal';
import { useFinance } from '../../context/FinanceContext';
import { Loan } from '../../mock/data';
import { formatBDT } from '../../lib/formatters';
import { Trash2 } from 'lucide-react';
import { useToast } from '../../context/ToastContext';

interface ActionModalsProps {
  activeModal: 'income' | 'expense' | 'transfer' | 'loan' | 'daily_bulk' | 'repayment' | null;
  onClose: () => void;
  selectedLoanForRepayment?: Loan | null;
  onSuccessNotification?: (msg: string) => void;
}

export const ActionModals: React.FC<ActionModalsProps> = ({
  activeModal,
  onClose,
  selectedLoanForRepayment,
  onSuccessNotification,
}) => {
  const toast = useToast();
  const {
    accounts,
    categories,
    loans,
    addIncome,
    addExpense,
    addTransfer,
    addLoan,
    recordRepayment,
    addBulkExpenses,
  } = useFinance();

  const expenseCategories = categories.filter((c) => c.type === 'EXPENSE');
  const incomeCategories = categories.filter((c) => c.type === 'INCOME');

  const getTodayDate = () =>
    new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });

  const [modalError, setModalError] = useState<string | null>(null);

  // Income form state
  const [incomeAmount, setIncomeAmount] = useState('');
  const [incomeAccount, setIncomeAccount] = useState(accounts[0]?.id || '');
  const [incomeCategory, setIncomeCategory] = useState(incomeCategories[0]?.id || '');
  const [incomeDate, setIncomeDate] = useState(getTodayDate());
  const [incomeDesc, setIncomeDesc] = useState('');
  const [incomeRef, setIncomeRef] = useState('');

  // Expense form state
  const [expenseAmount, setExpenseAmount] = useState('');
  const [expenseAccount, setExpenseAccount] = useState(accounts[0]?.id || '');
  const [expenseCategory, setExpenseCategory] = useState(expenseCategories[0]?.name || 'Food & Dining');
  const [expenseDate, setExpenseDate] = useState(getTodayDate());
  const [expenseDesc, setExpenseDesc] = useState('');
  const [expenseRef, setExpenseRef] = useState('');

  // Transfer form state
  const [sourceAccId, setSourceAccId] = useState(accounts[0]?.id || '');
  const [destAccId, setDestAccId] = useState(accounts[1]?.id || '');
  const [transferAmount, setTransferAmount] = useState('');
  const [transferDesc, setTransferDesc] = useState('');
  const [transferRef, setTransferRef] = useState('');

  // Loan form state
  const [loanType, setLoanType] = useState<'LENT' | 'BORROWED'>('LENT');
  const [counterparty, setCounterparty] = useState('');
  const [loanContact, setLoanContact] = useState('');
  const [loanAmount, setLoanAmount] = useState('');
  const [loanAccount, setLoanAccount] = useState(accounts[0]?.id || '');
  const [loanStartDate, setLoanStartDate] = useState(getTodayDate());
  const [loanDueDate, setLoanDueDate] = useState('');
  const [loanNote, setLoanNote] = useState('');

  // Repayment form state
  const [repaymentAmount, setRepaymentAmount] = useState('');
  const [repaymentAccount, setRepaymentAccount] = useState(accounts[0]?.id || '');
  const [repaymentDate, setRepaymentDate] = useState(getTodayDate());
  const [repaymentNote, setRepaymentNote] = useState('');

  // Daily Bulk Expense form state
  const [bulkDate, setBulkDate] = useState(getTodayDate());
  const [bulkAccount, setBulkAccount] = useState(accounts[0]?.id || '');
  const [bulkLines, setBulkLines] = useState([
    { id: '1', category: expenseCategories[0]?.name || 'Food & Dining', desc: '', amount: 0 },
  ]);

  const bulkTotal = bulkLines.reduce((sum, item) => sum + (Number(item.amount) || 0), 0);

  const handleAddBulkLine = () => {
    setBulkLines([
      ...bulkLines,
      { id: Date.now().toString(), category: expenseCategories[0]?.name || 'Food & Dining', desc: '', amount: 0 },
    ]);
  };

  const handleRemoveBulkLine = (id: string) => {
    if (bulkLines.length > 1) {
      setBulkLines(bulkLines.filter((l) => l.id !== id));
    }
  };

  const handleUpdateBulkLine = (id: string, field: string, value: any) => {
    setBulkLines(
      bulkLines.map((l) => (l.id === id ? { ...l, [field]: value } : l))
    );
  };

  // Submit Income
  const handleIncomeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const amountNum = parseFloat(incomeAmount);
    if (isNaN(amountNum) || amountNum <= 0) return;

    const res = await addIncome({
      accountId: incomeAccount || accounts[0]?.id || '',
      categoryId: incomeCategory || incomeCategories[0]?.id,
      amount: amountNum,
      date: incomeDate,
      description: incomeDesc.trim() || 'Income deposit',
      reference: incomeRef.trim() || undefined,
    });

    if (res.success) {
      toast.success('Income added successfully');
      onClose();
    } else {
      setModalError(res.error || 'Failed to add income');
      toast.error(res.error || 'Failed to add income');
    }
  };

  // Submit Expense
  const handleExpenseSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const amountNum = parseFloat(expenseAmount);
    if (isNaN(amountNum) || amountNum <= 0) return;

    const chosenCat = expenseCategory || expenseCategories[0]?.name || 'Food & Dining';

    const res = await addExpense({
      accountId: expenseAccount || accounts[0]?.id || '',
      category: chosenCat,
      amount: amountNum,
      date: expenseDate,
      description: expenseDesc.trim() || `${chosenCat} payment`,
      reference: expenseRef.trim() || undefined,
    });

    if (res.success) {
      toast.success('Expense added successfully');
      onClose();
    } else {
      setModalError(res.error || 'Failed to add expense');
      toast.error(res.error || 'Failed to add expense');
    }
  };

  // Submit Transfer
  const handleTransferSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setModalError(null);
    const amountNum = parseFloat(transferAmount);
    if (isNaN(amountNum) || amountNum <= 0) return;

    if (sourceAccId === destAccId) {
      setModalError('Source and destination accounts must be different.');
      return;
    }

    const res = await addTransfer({
      sourceAccountId: sourceAccId,
      destinationAccountId: destAccId,
      amount: amountNum,
      description: transferDesc.trim() || undefined,
      reference: transferRef.trim() || undefined,
    });

    if (!res.success) {
      setModalError(res.error || 'Transfer failed.');
      toast.error(res.error || 'Transfer failed');
      return;
    }

    const fromName = accounts.find((a) => a.id === sourceAccId)?.name;
    const toName = accounts.find((a) => a.id === destAccId)?.name;
    toast.success(`Transferred ${formatBDT(amountNum)} from ${fromName} to ${toName}`);
    onClose();
  };

  // Submit Loan
  const handleLoanSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setModalError(null);
    const amountNum = parseFloat(loanAmount);
    if (isNaN(amountNum) || amountNum <= 0) return;
    if (!counterparty.trim()) return;

    const res = await addLoan({
      type: loanType,
      counterpartyName: counterparty.trim(),
      counterpartyContact: loanContact.trim() || undefined,
      principalAmount: amountNum,
      accountId: loanAccount || accounts[0]?.id || '',
      startDate: loanStartDate,
      dueDate: loanDueDate.trim() || undefined,
      notes: loanNote.trim() || undefined,
    });

    if (!res.success) {
      setModalError(res.error || 'Could not record loan.');
      toast.error(res.error || 'Could not record loan');
      return;
    }

    toast.success(
      `Recorded ${loanType === 'LENT' ? 'Loan Given to' : 'Loan Borrowed from'} ${counterparty}`
    );
    onClose();
  };

  // Submit Repayment
  const handleRepaymentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedLoanForRepayment) return;
    setModalError(null);
    const amountNum = parseFloat(repaymentAmount);
    if (isNaN(amountNum) || amountNum <= 0) return;

    const res = await recordRepayment({
      loanId: selectedLoanForRepayment.id,
      accountId: repaymentAccount || accounts[0]?.id || '',
      amount: amountNum,
      date: repaymentDate,
      notes: repaymentNote.trim() || undefined,
    });

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

  // Submit Bulk Expenses
  const handleBulkSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setModalError(null);
    const validLines = bulkLines.filter(l => Number(l.amount) > 0);
    if (validLines.length === 0) {
      setModalError('Please enter at least one expense with amount > 0.');
      return;
    }

    const { overBudgetAlerts } = addBulkExpenses({
      accountId: bulkAccount || accounts[0]?.id || '',
      date: bulkDate,
      items: validLines.map(l => ({
        category: l.category,
        desc: l.desc.trim() || `${l.category} expense`,
        amount: Number(l.amount),
      })),
    });

    const accName = accounts.find((a) => a.id === bulkAccount)?.name || 'Account';

    if (overBudgetAlerts && overBudgetAlerts.length > 0) {
      onSuccessNotification(
        `Batch of ${validLines.length} expenses (${formatBDT(bulkTotal)}) saved to ${accName}. Budget alert: ${overBudgetAlerts.map((a: any) => `${a.categoryName} (+${formatBDT(a.exceededBy)})`).join(', ')}`
      );
    } else {
      onSuccessNotification(`Saved ${validLines.length} expenses (${formatBDT(bulkTotal)}) from ${accName}.`);
    }

    onClose();
  };

  return (
    <>
      {/* 1. Add Income Modal */}
      <Modal
        isOpen={activeModal === 'income'}
        onClose={onClose}
        title="Add Income"
      >
        <form onSubmit={handleIncomeSubmit} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-gray-300 font-medium mb-1">Date *</label>
              <input
                type="text"
                required
                value={incomeDate}
                onChange={(e) => setIncomeDate(e.target.value)}
                className="w-full bg-[#111317] border border-[#262932] rounded px-3 py-1.5 text-xs text-gray-200 focus:outline-none focus:border-blue-500"
              />
            </div>

            <div>
              <label className="block text-xs text-gray-300 font-medium mb-1">Amount (৳ BDT) *</label>
              <input
                type="number"
                step="0.01"
                required
                value={incomeAmount}
                onChange={(e) => setIncomeAmount(e.target.value)}
                className="w-full bg-[#111317] border border-[#262932] rounded px-3 py-1.5 text-xs text-gray-200 font-mono focus:outline-none focus:border-blue-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-gray-300 font-medium mb-1">Receiving Account *</label>
              <select
                value={incomeAccount}
                onChange={(e) => setIncomeAccount(e.target.value)}
                className="w-full bg-[#111317] border border-[#262932] rounded px-3 py-1.5 text-xs text-gray-200 focus:outline-none focus:border-blue-500"
              >
                {accounts.filter(a => a.status === 'ACTIVE').map((acc) => (
                  <option key={acc.id} value={acc.id}>{acc.name} ({formatBDT(acc.currentBalance)})</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs text-gray-300 font-medium mb-1">Category *</label>
              <select
                value={incomeCategory}
                onChange={(e) => setIncomeCategory(e.target.value)}
                className="w-full bg-[#111317] border border-[#262932] rounded px-3 py-1.5 text-xs text-gray-200 focus:outline-none focus:border-blue-500"
              >
                {incomeCategories.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs text-gray-300 font-medium mb-1">Description *</label>
            <input
              type="text"
              required
              value={incomeDesc}
              onChange={(e) => setIncomeDesc(e.target.value)}
              className="w-full bg-[#111317] border border-[#262932] rounded px-3 py-1.5 text-xs text-gray-200 focus:outline-none focus:border-blue-500"
            />
          </div>

          <div>
            <label className="block text-xs text-gray-300 font-medium mb-1">Reference (Optional)</label>
            <input
              type="text"
              value={incomeRef}
              onChange={(e) => setIncomeRef(e.target.value)}
              className="w-full bg-[#111317] border border-[#262932] rounded px-3 py-1.5 text-xs text-gray-200 font-mono focus:outline-none focus:border-blue-500"
            />
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-[#22252c]">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1.5 bg-[#1a1d24] hover:bg-[#222631] text-gray-300 rounded text-xs transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded text-xs font-medium transition-colors"
            >
              Save Income
            </button>
          </div>
        </form>
      </Modal>

      {/* 2. Add Expense Modal */}
      <Modal
        isOpen={activeModal === 'expense'}
        onClose={onClose}
        title="Add Expense"
      >
        <form onSubmit={handleExpenseSubmit} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-gray-300 font-medium mb-1">Date *</label>
              <input
                type="text"
                required
                value={expenseDate}
                onChange={(e) => setExpenseDate(e.target.value)}
                className="w-full bg-[#111317] border border-[#262932] rounded px-3 py-1.5 text-xs text-gray-200 focus:outline-none focus:border-blue-500"
              />
            </div>

            <div>
              <label className="block text-xs text-gray-300 font-medium mb-1">Amount (৳ BDT) *</label>
              <input
                type="number"
                step="0.01"
                required
                value={expenseAmount}
                onChange={(e) => setExpenseAmount(e.target.value)}
                className="w-full bg-[#111317] border border-[#262932] rounded px-3 py-1.5 text-xs text-gray-200 font-mono focus:outline-none focus:border-blue-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-gray-300 font-medium mb-1">Payment Account *</label>
              <select
                value={expenseAccount}
                onChange={(e) => setExpenseAccount(e.target.value)}
                className="w-full bg-[#111317] border border-[#262932] rounded px-3 py-1.5 text-xs text-gray-200 focus:outline-none focus:border-blue-500"
              >
                {accounts.filter(a => a.status === 'ACTIVE').map((acc) => (
                  <option key={acc.id} value={acc.id}>{acc.name} ({formatBDT(acc.currentBalance)})</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs text-gray-300 font-medium mb-1">Category *</label>
              <select
                value={expenseCategory}
                onChange={(e) => setExpenseCategory(e.target.value)}
                className="w-full bg-[#111317] border border-[#262932] rounded px-3 py-1.5 text-xs text-gray-200 focus:outline-none focus:border-blue-500"
              >
                {expenseCategories.map((c) => (
                  <option key={c.id} value={c.name}>{c.name}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs text-gray-300 font-medium mb-1">Description *</label>
            <input
              type="text"
              required
              value={expenseDesc}
              onChange={(e) => setExpenseDesc(e.target.value)}
              className="w-full bg-[#111317] border border-[#262932] rounded px-3 py-1.5 text-xs text-gray-200 focus:outline-none focus:border-blue-500"
            />
          </div>

          <div>
            <label className="block text-xs text-gray-300 font-medium mb-1">Reference (Optional)</label>
            <input
              type="text"
              value={expenseRef}
              onChange={(e) => setExpenseRef(e.target.value)}
              className="w-full bg-[#111317] border border-[#262932] rounded px-3 py-1.5 text-xs text-gray-200 font-mono focus:outline-none focus:border-blue-500"
            />
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-[#22252c]">
            <button
              type="button"
              onClick={onClose}
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

      {/* 3. Transfer Money Modal */}
      <Modal
        isOpen={activeModal === 'transfer'}
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
                className="w-full bg-[#111317] border border-[#262932] rounded px-3 py-1.5 text-xs text-gray-200 focus:outline-none focus:border-blue-500"
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
                className="w-full bg-[#111317] border border-[#262932] rounded px-3 py-1.5 text-xs text-gray-200 focus:outline-none focus:border-blue-500"
              >
                {accounts.filter(a => a.status === 'ACTIVE').map((acc) => (
                  <option key={acc.id} value={acc.id}>{acc.name} ({formatBDT(acc.currentBalance)})</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs text-gray-300 font-medium mb-1">Transfer Amount (৳ BDT) *</label>
            <input
              type="number"
              step="0.01"
              required
              value={transferAmount}
              onChange={(e) => setTransferAmount(e.target.value)}
              className="w-full bg-[#111317] border border-[#262932] rounded px-3 py-1.5 text-xs text-gray-200 font-mono focus:outline-none focus:border-blue-500"
            />
          </div>

          <div>
            <label className="block text-xs text-gray-300 font-medium mb-1">Description (Optional)</label>
            <input
              type="text"
              value={transferDesc}
              onChange={(e) => setTransferDesc(e.target.value)}
              className="w-full bg-[#111317] border border-[#262932] rounded px-3 py-1.5 text-xs text-gray-200 focus:outline-none focus:border-blue-500"
            />
          </div>

          <div>
            <label className="block text-xs text-gray-300 font-medium mb-1">Reference (Optional)</label>
            <input
              type="text"
              value={transferRef}
              onChange={(e) => setTransferRef(e.target.value)}
              className="w-full bg-[#111317] border border-[#262932] rounded px-3 py-1.5 text-xs text-gray-200 font-mono focus:outline-none focus:border-blue-500"
            />
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-[#22252c]">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1.5 bg-[#1a1d24] hover:bg-[#222631] text-gray-300 rounded text-xs transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded text-xs font-medium transition-colors"
            >
              Execute Transfer
            </button>
          </div>
        </form>
      </Modal>

      {/* 4. Add Loan Modal */}
      <Modal
        isOpen={activeModal === 'loan'}
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
                onChange={(e) => setLoanType(e.target.value as any)}
                className="w-full bg-[#111317] border border-[#262932] rounded px-3 py-1.5 text-xs text-gray-200 focus:outline-none focus:border-blue-500"
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
                className="w-full bg-[#111317] border border-[#262932] rounded px-3 py-1.5 text-xs text-gray-200 font-mono focus:outline-none focus:border-blue-500"
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
                className="w-full bg-[#111317] border border-[#262932] rounded px-3 py-1.5 text-xs text-gray-200 focus:outline-none focus:border-blue-500"
              />
            </div>

            <div>
              <label className="block text-xs text-gray-300 font-medium mb-1">Contact Phone</label>
              <input
                type="text"
                value={loanContact}
                onChange={(e) => setLoanContact(e.target.value)}
                className="w-full bg-[#111317] border border-[#262932] rounded px-3 py-1.5 text-xs text-gray-200 font-mono focus:outline-none focus:border-blue-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-gray-300 font-medium mb-1">Disbursing Account *</label>
              <select
                value={loanAccount}
                onChange={(e) => setLoanAccount(e.target.value)}
                className="w-full bg-[#111317] border border-[#262932] rounded px-3 py-1.5 text-xs text-gray-200 focus:outline-none focus:border-blue-500"
              >
                {accounts.filter(a => a.status === 'ACTIVE').map((acc) => (
                  <option key={acc.id} value={acc.id}>{acc.name} ({formatBDT(acc.currentBalance)})</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs text-gray-300 font-medium mb-1">Start Date *</label>
              <input
                type="text"
                required
                value={loanStartDate}
                onChange={(e) => setLoanStartDate(e.target.value)}
                className="w-full bg-[#111317] border border-[#262932] rounded px-3 py-1.5 text-xs text-gray-200 focus:outline-none focus:border-blue-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs text-gray-300 font-medium mb-1">Due Date (Optional)</label>
            <input
              type="text"
              value={loanDueDate}
              onChange={(e) => setLoanDueDate(e.target.value)}
              className="w-full bg-[#111317] border border-[#262932] rounded px-3 py-1.5 text-xs text-gray-200 focus:outline-none focus:border-blue-500"
            />
          </div>

          <div>
            <label className="block text-xs text-gray-300 font-medium mb-1">Notes</label>
            <input
              type="text"
              value={loanNote}
              onChange={(e) => setLoanNote(e.target.value)}
              className="w-full bg-[#111317] border border-[#262932] rounded px-3 py-1.5 text-xs text-gray-200 focus:outline-none focus:border-blue-500"
            />
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-[#22252c]">
            <button
              type="button"
              onClick={onClose}
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

      {/* 5. Repayment Modal */}
      <Modal
        isOpen={activeModal === 'repayment'}
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

            <div className="p-2.5 bg-[#111317] border border-[#22252c] rounded text-xs flex justify-between">
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
                  className="w-full bg-[#111317] border border-[#262932] rounded px-3 py-1.5 text-xs text-gray-200 font-mono focus:outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs text-gray-300 font-medium mb-1">Settlement Account *</label>
                <select
                  value={repaymentAccount}
                  onChange={(e) => setRepaymentAccount(e.target.value)}
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
                <label className="block text-xs text-gray-300 font-medium mb-1">Date *</label>
                <input
                  type="text"
                  required
                  value={repaymentDate}
                  onChange={(e) => setRepaymentDate(e.target.value)}
                  className="w-full bg-[#111317] border border-[#262932] rounded px-3 py-1.5 text-xs text-gray-200 focus:outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs text-gray-300 font-medium mb-1">Notes</label>
                <input
                  type="text"
                  value={repaymentNote}
                  onChange={(e) => setRepaymentNote(e.target.value)}
                  className="w-full bg-[#111317] border border-[#262932] rounded px-3 py-1.5 text-xs text-gray-200 focus:outline-none focus:border-blue-500"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-[#22252c]">
              <button
                type="button"
                onClick={onClose}
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

      {/* 6. Daily Bulk Entry Modal */}
      <Modal
        isOpen={activeModal === 'daily_bulk'}
        onClose={onClose}
        title="Daily Expenses"
        maxWidth="max-w-2xl"
      >
        <form onSubmit={handleBulkSubmit} className="space-y-3">
          {modalError && (
            <div className="p-2.5 rounded bg-red-950/40 border border-red-800/60 text-xs text-red-300">
              {modalError}
            </div>
          )}

          <div className="grid grid-cols-2 gap-3 bg-[#111317] border border-[#22252c] p-2.5 rounded">
            <div>
              <label className="block text-xs text-gray-300 font-medium mb-1">Date *</label>
              <input
                type="text"
                required
                value={bulkDate}
                onChange={(e) => setBulkDate(e.target.value)}
                className="w-full bg-[#16181d] border border-[#262932] rounded px-3 py-1.5 text-xs text-gray-200 focus:outline-none focus:border-blue-500"
              />
            </div>

            <div>
              <label className="block text-xs text-gray-300 font-medium mb-1">Payment Account *</label>
              <select
                value={bulkAccount}
                onChange={(e) => setBulkAccount(e.target.value)}
                className="w-full bg-[#16181d] border border-[#262932] rounded px-3 py-1.5 text-xs text-gray-200 focus:outline-none focus:border-blue-500"
              >
                {accounts.filter(a => a.status === 'ACTIVE').map((acc) => (
                  <option key={acc.id} value={acc.id}>{acc.name} ({formatBDT(acc.currentBalance)})</option>
                ))}
              </select>
            </div>
          </div>

          <div className="border border-[#22252c] rounded overflow-hidden max-h-60 overflow-y-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#121417] text-gray-400 text-[10px] uppercase border-b border-[#22252c]">
                <tr>
                  <th className="py-2 px-2.5 w-1/3">Category</th>
                  <th className="py-2 px-2.5 w-1/2">Description</th>
                  <th className="py-2 px-2.5 w-1/4 text-right">Amount</th>
                  <th className="py-2 px-1 text-center w-8"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#1e2129]">
                {bulkLines.map((line) => (
                  <tr key={line.id}>
                    <td className="p-1.5">
                      <select
                        value={line.category}
                        onChange={(e) => handleUpdateBulkLine(line.id, 'category', e.target.value)}
                        className="w-full bg-[#111317] border border-[#262932] rounded px-2 py-1 text-xs text-gray-200 focus:outline-none focus:border-blue-500"
                      >
                        {expenseCategories.map((c) => (
                          <option key={c.id} value={c.name}>{c.name}</option>
                        ))}
                      </select>
                    </td>
                    <td className="p-1.5">
                      <input
                        type="text"
                        value={line.desc}
                        onChange={(e) => handleUpdateBulkLine(line.id, 'desc', e.target.value)}
                        className="w-full bg-[#111317] border border-[#262932] rounded px-2 py-1 text-xs text-gray-200 focus:outline-none focus:border-blue-500"
                      />
                    </td>
                    <td className="p-1.5 text-right">
                      <input
                        type="number"
                        step="0.01"
                        value={line.amount || ''}
                        onChange={(e) => handleUpdateBulkLine(line.id, 'amount', e.target.value)}
                        placeholder="0.00"
                        className="w-full bg-[#111317] border border-[#262932] rounded px-2 py-1 text-xs text-gray-200 text-right font-mono focus:outline-none focus:border-blue-500"
                      />
                    </td>
                    <td className="p-1.5 text-center">
                      <button
                        type="button"
                        onClick={() => handleRemoveBulkLine(line.id)}
                        className="p-1 text-gray-500 hover:text-red-400 rounded"
                        disabled={bulkLines.length <= 1}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex items-center justify-between pt-1">
            <button
              type="button"
              onClick={handleAddBulkLine}
              className="px-2.5 py-1 bg-[#1b1e25] hover:bg-[#222631] text-gray-300 rounded text-xs border border-[#2b2e38] transition-colors"
            >
              + Add Row
            </button>
            <div className="text-right">
              <span className="text-xs text-gray-400 mr-2">Total:</span>
              <span className="text-sm font-bold font-mono text-gray-100">{formatBDT(bulkTotal)}</span>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-[#22252c]">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1.5 bg-[#1a1d24] hover:bg-[#222631] text-gray-300 rounded text-xs transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded text-xs font-medium transition-colors"
            >
              Save Batch ({formatBDT(bulkTotal)})
            </button>
          </div>
        </form>
      </Modal>
    </>
  );
};
