import React, { useState } from 'react';
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

export const TransactionsView: React.FC = () => {
  const { transactions, accounts, deleteTransaction } = useFinance();

  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState('ALL');
  const [accountFilter, setAccountFilter] = useState('ALL');
  const [selectedTx, setSelectedTx] = useState<Transaction | null>(null);
  const [txToDelete, setTxToDelete] = useState<Transaction | null>(null);

  const filteredTransactions = transactions.filter((t) => {
    const matchesSearch =
      t.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (t.category && t.category.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (t.counterparty && t.counterparty.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (t.reference && t.reference.toLowerCase().includes(searchQuery.toLowerCase()));

    const matchesType = typeFilter === 'ALL' || t.type === typeFilter;
    const matchesAccount =
      accountFilter === 'ALL' ||
      t.accountId === accountFilter ||
      t.destinationAccountId === accountFilter;

    return matchesSearch && matchesType && matchesAccount;
  });

  const totalInflow = filteredTransactions
    .filter((t) => t.direction === 'INFLOW')
    .reduce((sum, t) => sum + t.amount, 0);

  const totalOutflow = filteredTransactions
    .filter((t) => t.direction === 'OUTFLOW')
    .reduce((sum, t) => sum + t.amount, 0);

  const netBalance = totalInflow - totalOutflow;

  const confirmDelete = () => {
    if (!txToDelete) return;
    deleteTransaction(txToDelete.id);
    setTxToDelete(null);
  };

  const handleExportCSV = () => {
    const headers = ['Date', 'Type', 'Account', 'Destination Account', 'Category', 'Description', 'Reference', 'Amount', 'Direction', 'Status'];
    const rows = filteredTransactions.map((t) => [
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
  };

  const handleExportJSON = () => {
    const jsonContent = JSON.stringify(filteredTransactions, null, 2);
    const blob = new Blob([jsonContent], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `hisabflow_transactions_${Date.now()}.json`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const getTypeBadge = (type: string) => {
    switch (type) {
      case 'INCOME':
        return <span className="px-1.5 py-0.5 rounded text-[10px] bg-emerald-950/80 text-emerald-400 border border-emerald-800/60">INCOME</span>;
      case 'EXPENSE':
        return <span className="px-1.5 py-0.5 rounded text-[10px] bg-gray-800 text-gray-300 border border-gray-700">EXPENSE</span>;
      case 'TRANSFER':
        return <span className="px-1.5 py-0.5 rounded text-[10px] bg-blue-950/70 text-blue-300 border border-blue-800/60">TRANSFER</span>;
      case 'LOAN_LENT':
        return <span className="px-1.5 py-0.5 rounded text-[10px] bg-amber-950/70 text-amber-300 border border-amber-800/60">LOAN GIVEN</span>;
      case 'LOAN_BORROWED':
        return <span className="px-1.5 py-0.5 rounded text-[10px] bg-purple-950/70 text-purple-300 border border-purple-800/60">BORROWED</span>;
      case 'LOAN_REPAYMENT':
        return <span className="px-1.5 py-0.5 rounded text-[10px] bg-teal-950/70 text-teal-300 border border-teal-800/60">REPAYMENT</span>;
      default:
        return <span className="px-1.5 py-0.5 rounded text-[10px] bg-gray-800 text-gray-400">{type}</span>;
    }
  };

  return (
    <div className="space-y-4">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <h2 className="text-base font-semibold text-gray-100">Transactions</h2>
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

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="bg-[#16181d] border border-[#22252c] rounded p-3">
          <div className="text-xs text-gray-400">Total Inflow (Filtered)</div>
          <div className="text-lg font-semibold font-mono text-emerald-400 mt-0.5">
            +{formatBDT(totalInflow)}
          </div>
        </div>

        <div className="bg-[#16181d] border border-[#22252c] rounded p-3">
          <div className="text-xs text-gray-400">Total Outflow (Filtered)</div>
          <div className="text-lg font-semibold font-mono text-gray-200 mt-0.5">
            -{formatBDT(totalOutflow)}
          </div>
        </div>

        <div className="bg-[#16181d] border border-[#22252c] rounded p-3">
          <div className="text-xs text-gray-400">Net Balance (Inflow - Outflow)</div>
          <div className={`text-lg font-semibold font-mono mt-0.5 ${netBalance >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
            {formatBDT(netBalance, true)}
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
            placeholder="Search description, category, reference..."
            className="w-full bg-[#111317] border border-[#262932] rounded pl-8 pr-3 py-1.5 text-xs text-gray-200 focus:outline-none focus:border-blue-500"
          />
        </div>

        <div className="flex items-center gap-2 w-full md:w-auto text-xs">
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
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

      {/* Main Ledger Table */}
      <div className="bg-[#16181d] border border-[#22252c] rounded overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-[#22252c] bg-[#121417] text-gray-400 font-medium uppercase tracking-wider text-[10px]">
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
              {filteredTransactions.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-gray-500">
                    No transactions match criteria.
                  </td>
                </tr>
              ) : (
                filteredTransactions.map((tx) => (
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

        {/* Footer */}
        <div className="py-2 px-3 border-t border-[#22252c] bg-[#121417] text-gray-400 text-xs flex justify-between items-center">
          <span>Showing {filteredTransactions.length} of {transactions.length} transactions</span>
        </div>
      </div>

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
