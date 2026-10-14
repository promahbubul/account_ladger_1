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

interface IncomeViewProps {
  onOpenAddIncomeModal: () => void;
  onSuccessNotification: (msg: string) => void;
}

export const IncomeView: React.FC<IncomeViewProps> = ({
  onOpenAddIncomeModal,
  onSuccessNotification,
}) => {
  const { transactions, categories, accounts, deleteTransaction, addIncome } = useFinance();

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('ALL');
  const [accountFilter, setAccountFilter] = useState('ALL');

  // Modals
  const [isRecordModalOpen, setIsRecordModalOpen] = useState(false);
  const [selectedTx, setSelectedTx] = useState<Transaction | null>(null);
  const [txToDelete, setTxToDelete] = useState<Transaction | null>(null);

  // Form state
  const [formDate, setFormDate] = useState('14 Oct 2026');
  const [formCatId, setFormCatId] = useState('');
  const [formAccId, setFormAccId] = useState(accounts[0]?.id || '');
  const [formAmount, setFormAmount] = useState('');
  const [formDesc, setFormDesc] = useState('');
  const [formRef, setFormRef] = useState('');

  const incomeTx = transactions.filter((t) => t.type === 'INCOME');

  const filteredIncome = incomeTx.filter((t) => {
    const matchesSearch =
      t.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (t.category && t.category.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (t.reference && t.reference.toLowerCase().includes(searchQuery.toLowerCase()));

    const matchesCat = categoryFilter === 'ALL' || t.category === categoryFilter;
    const matchesAcc = accountFilter === 'ALL' || t.accountId === accountFilter;

    return matchesSearch && matchesCat && matchesAcc;
  });

  const totalIncome = filteredIncome.reduce((sum, t) => sum + t.amount, 0);
  const salaryTotal = incomeTx
    .filter((t) => t.category?.toLowerCase().includes('salary'))
    .reduce((sum, t) => sum + t.amount, 0);
  const freelanceTotal = incomeTx
    .filter((t) => t.category?.toLowerCase().includes('freelance') || t.category?.toLowerCase().includes('consulting'))
    .reduce((sum, t) => sum + t.amount, 0);

  const incomeCategories = categories.filter((c) => c.type === 'INCOME');

  const confirmDelete = () => {
    if (!txToDelete) return;
    deleteTransaction(txToDelete.id);
    onSuccessNotification(`Income transaction deleted and ${formatBDT(txToDelete.amount)} deducted from ${txToDelete.accountName}.`);
    setTxToDelete(null);
  };

  const handleSaveIncome = (e: React.FormEvent) => {
    e.preventDefault();
    const amountNum = parseFloat(formAmount);
    if (isNaN(amountNum) || amountNum <= 0) return;

    addIncome({
      accountId: formAccId || accounts[0]?.id || '',
      categoryId: formCatId || incomeCategories[0]?.id,
      amount: amountNum,
      date: formDate,
      description: formDesc.trim() || 'Income deposit',
      reference: formRef.trim() || undefined,
    });

    const accName = accounts.find((a) => a.id === formAccId)?.name || 'Account';
    onSuccessNotification(`Credited ${formatBDT(amountNum)} to ${accName}.`);
    setIsRecordModalOpen(false);
    setFormAmount('');
    setFormDesc('');
    setFormRef('');
  };

  return (
    <div className="space-y-4">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <h2 className="text-base font-semibold text-gray-100">Income</h2>
        <button
          onClick={() => setIsRecordModalOpen(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded text-xs font-medium self-start sm:self-auto transition-colors"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>Record Income</span>
        </button>
      </div>

      {/* Summary Row */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
        <div className="bg-[#16181d] border border-[#22252c] rounded p-3">
          <div className="text-xs text-gray-400">Total Income (Filtered)</div>
          <div className="text-lg font-semibold font-mono text-emerald-400 mt-0.5">
            {formatBDT(totalIncome)}
          </div>
        </div>

        <div className="bg-[#16181d] border border-[#22252c] rounded p-3">
          <div className="text-xs text-gray-400">Salary & Corporate</div>
          <div className="text-lg font-semibold font-mono text-gray-200 mt-0.5">
            {formatBDT(salaryTotal)}
          </div>
        </div>

        <div className="bg-[#16181d] border border-[#22252c] rounded p-3 col-span-2 lg:col-span-1">
          <div className="text-xs text-gray-400">Freelance & Consulting</div>
          <div className="text-lg font-semibold font-mono text-gray-200 mt-0.5">
            {formatBDT(freelanceTotal)}
          </div>
        </div>
      </div>

      {/* Search & Filter Toolbar */}
      <div className="bg-[#16181d] border border-[#22252c] rounded p-2.5 flex flex-col md:flex-row items-center justify-between gap-2.5">
        <div className="relative w-full md:w-72">
          <Search className="w-3.5 h-3.5 text-gray-400 absolute left-2.5 top-2.5" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search income records..."
            className="w-full bg-[#111317] border border-[#262932] rounded pl-8 pr-3 py-1.5 text-xs text-gray-200 focus:outline-none focus:border-blue-500"
          />
        </div>

        <div className="flex items-center gap-2 w-full md:w-auto text-xs">
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="bg-[#111317] border border-[#262932] rounded px-2.5 py-1.5 text-xs text-gray-300 focus:outline-none focus:border-blue-500"
          >
            <option value="ALL">All Categories</option>
            {incomeCategories.map((c) => (
              <option key={c.id} value={c.name}>{c.name}</option>
            ))}
          </select>

          <select
            value={accountFilter}
            onChange={(e) => setAccountFilter(e.target.value)}
            className="bg-[#111317] border border-[#262932] rounded px-2.5 py-1.5 text-xs text-gray-300 focus:outline-none focus:border-blue-500"
          >
            <option value="ALL">All Accounts</option>
            {accounts.map((a) => (
              <option key={a.id} value={a.id}>{a.name}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Main Income Table */}
      <div className="bg-[#16181d] border border-[#22252c] rounded overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-[#22252c] bg-[#121417] text-gray-400 font-medium uppercase tracking-wider text-[10px]">
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
              {filteredIncome.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-gray-500">
                    No income records found.
                  </td>
                </tr>
              ) : (
                filteredIncome.map((tx) => (
                  <tr key={tx.id} className="hover:bg-[#1a1d24] transition-colors">
                    <td className="py-2.5 px-3 text-gray-400 font-mono text-[11px] whitespace-nowrap">
                      {tx.date}
                    </td>
                    <td className="py-2.5 px-3 font-medium text-gray-200">
                      {tx.description}
                    </td>
                    <td className="py-2.5 px-3 text-gray-400">
                      <span className="px-1.5 py-0.5 rounded bg-[#111317] border border-[#242730] text-[11px]">
                        {tx.category || 'General Income'}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-gray-300">
                      {tx.accountName}
                    </td>
                    <td className="py-2.5 px-3 text-gray-500 font-mono text-[11px]">
                      {tx.reference || '-'}
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono font-semibold text-emerald-400 whitespace-nowrap">
                      +{formatBDT(tx.amount)}
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

        {/* Footer */}
        <div className="py-2 px-3 border-t border-[#22252c] bg-[#121417] text-gray-400 text-xs flex justify-between items-center">
          <span>Showing {filteredIncome.length} of {incomeTx.length} records</span>
          <span className="font-mono text-emerald-400">Total: +{formatBDT(totalIncome)}</span>
        </div>
      </div>

      {/* Record Income Modal */}
      <Modal
        isOpen={isRecordModalOpen}
        onClose={() => setIsRecordModalOpen(false)}
        title="Record Income"
      >
        <form onSubmit={handleSaveIncome} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-gray-300 font-medium mb-1">
                Date *
              </label>
              <input
                type="text"
                required
                value={formDate}
                onChange={(e) => setFormDate(e.target.value)}
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
                value={formAmount}
                onChange={(e) => setFormAmount(e.target.value)}
                placeholder="0.00"
                className="w-full bg-[#111317] border border-[#262932] rounded px-3 py-1.5 text-xs text-gray-200 font-mono focus:outline-none focus:border-blue-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-gray-300 font-medium mb-1">
                Receiving Account *
              </label>
              <select
                value={formAccId}
                onChange={(e) => setFormAccId(e.target.value)}
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
                value={formCatId}
                onChange={(e) => setFormCatId(e.target.value)}
                className="w-full bg-[#111317] border border-[#262932] rounded px-3 py-1.5 text-xs text-gray-200 focus:outline-none focus:border-blue-500"
              >
                {incomeCategories.map((cat) => (
                  <option key={cat.id} value={cat.id}>{cat.name}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs text-gray-300 font-medium mb-1">
              Description / Source *
            </label>
            <input
              type="text"
              required
              value={formDesc}
              onChange={(e) => setFormDesc(e.target.value)}
              placeholder="e.g. Monthly Salary Deposit or Client Consulting"
              className="w-full bg-[#111317] border border-[#262932] rounded px-3 py-1.5 text-xs text-gray-200 focus:outline-none focus:border-blue-500"
            />
          </div>

          <div>
            <label className="block text-xs text-gray-300 font-medium mb-1">
              Reference Number (Optional)
            </label>
            <input
              type="text"
              value={formRef}
              onChange={(e) => setFormRef(e.target.value)}
              placeholder="e.g. TXN987216"
              className="w-full bg-[#111317] border border-[#262932] rounded px-3 py-1.5 text-xs text-gray-200 font-mono focus:outline-none focus:border-blue-500"
            />
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-[#22252c]">
            <button
              type="button"
              onClick={() => setIsRecordModalOpen(false)}
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

      {/* Transaction Details Modal */}
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
                <p className="font-mono text-emerald-400 font-semibold">+{formatBDT(selectedTx.amount)}</p>
              </div>
              <div>
                <span className="text-gray-400">Category</span>
                <p className="text-gray-200">{selectedTx.category || 'Income'}</p>
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
        onConfirm={confirmDelete}
        title="Delete Income Record"
        message={txToDelete ? `Delete income record "${txToDelete.description}" (${formatBDT(txToDelete.amount)})? This will reverse the balance in ${txToDelete.accountName}.` : ''}
        confirmLabel="Delete"
        isDestructive={true}
      />
    </div>
  );
};
