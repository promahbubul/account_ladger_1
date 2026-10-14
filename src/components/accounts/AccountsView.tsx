import React, { useState } from 'react';
import {
  Plus,
  ArrowRightLeft,
  Search,
  Eye,
  Edit2,
  Archive,
  ArchiveRestore,
  Trash2,
} from 'lucide-react';
import { formatBDT } from '../../lib/formatters';
import { useFinance } from '../../context/FinanceContext';
import { Account, Transaction } from '../../mock/data';
import { Modal, ConfirmModal } from '../common/Modal';

interface AccountsViewProps {
  onOpenTransferModal: (accountId?: string) => void;
  onNavigateTab: (tab: any) => void;
  onSuccessNotification: (msg: string) => void;
}

export const AccountsView: React.FC<AccountsViewProps> = ({
  onOpenTransferModal,
  onNavigateTab,
  onSuccessNotification,
}) => {
  const { accounts, transactions, addAccount, editAccount, toggleArchiveAccount, deleteAccount } = useFinance();
  
  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<'ALL' | 'CASH' | 'BANK' | 'MOBILE_BANKING'>('ALL');
  const [filterStatus, setFilterStatus] = useState<'ALL' | 'ACTIVE' | 'ARCHIVED'>('ACTIVE');

  // Modal states
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [viewAccount, setViewAccount] = useState<Account | null>(null);
  const [editAccountState, setEditAccountState] = useState<Account | null>(null);
  const [accountToDelete, setAccountToDelete] = useState<Account | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  // New account form
  const [newName, setNewName] = useState('');
  const [newType, setNewType] = useState<'CASH' | 'BANK' | 'MOBILE_BANKING'>('BANK');
  const [newProvider, setNewProvider] = useState('');
  const [newNumber, setNewNumber] = useState('');
  const [newOpeningBalance, setNewOpeningBalance] = useState('0');

  // Filter accounts
  const filteredAccounts = accounts.filter((acc) => {
    const matchesSearch =
      acc.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (acc.providerName && acc.providerName.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (acc.accountNumber && acc.accountNumber.includes(searchQuery));
    
    const matchesType = filterType === 'ALL' || acc.type === filterType;
    const matchesStatus = filterStatus === 'ALL' || acc.status === filterStatus;

    return matchesSearch && matchesType && matchesStatus;
  });

  // Summary figures
  const totalBalance = accounts.filter(a => a.status === 'ACTIVE').reduce((sum, a) => sum + a.currentBalance, 0);
  const bankBalance = accounts.filter(a => a.status === 'ACTIVE' && a.type === 'BANK').reduce((sum, a) => sum + a.currentBalance, 0);
  const mfsBalance = accounts.filter(a => a.status === 'ACTIVE' && a.type === 'MOBILE_BANKING').reduce((sum, a) => sum + a.currentBalance, 0);
  const cashBalance = accounts.filter(a => a.status === 'ACTIVE' && a.type === 'CASH').reduce((sum, a) => sum + a.currentBalance, 0);

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) return;

    const opBal = parseFloat(newOpeningBalance) || 0;
    addAccount({
      name: newName.trim(),
      type: newType,
      providerName: newProvider.trim() || (newType === 'BANK' ? 'Bank' : newType === 'MOBILE_BANKING' ? 'MFS' : 'Physical Cash'),
      accountNumber: newNumber.trim() ? (newNumber.startsWith('••••') ? newNumber : `•••• ${newNumber.slice(-4)}`) : undefined,
      openingBalance: opBal,
      currentBalance: opBal,
      currency: 'BDT',
      status: 'ACTIVE',
    });

    onSuccessNotification(`Account "${newName}" created.`);
    setIsAddOpen(false);
    setNewName('');
    setNewProvider('');
    setNewNumber('');
    setNewOpeningBalance('0');
  };

  const handleUpdate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editAccountState) return;

    editAccount(editAccountState.id, {
      name: editAccountState.name,
      type: editAccountState.type,
      providerName: editAccountState.providerName,
      accountNumber: editAccountState.accountNumber,
      status: editAccountState.status,
    });

    onSuccessNotification(`Account "${editAccountState.name}" updated.`);
    setEditAccountState(null);
  };

  const confirmDelete = () => {
    if (!accountToDelete) return;
    const res = deleteAccount(accountToDelete.id);
    if (res.success) {
      onSuccessNotification(`Account "${accountToDelete.name}" deleted.`);
      setActionError(null);
    } else {
      setActionError(res.error || 'Cannot delete account with existing transactions.');
    }
  };

  const getTypeLabel = (type: string) => {
    switch (type) {
      case 'BANK': return 'Bank Account';
      case 'MOBILE_BANKING': return 'Mobile Banking (MFS)';
      default: return 'Cash Wallet';
    }
  };

  return (
    <div className="space-y-4">
      {/* Action Error Banner */}
      {actionError && (
        <div className="p-3 bg-red-950/40 border border-red-900/60 rounded text-xs text-red-300 flex items-center justify-between">
          <span>{actionError}</span>
          <button onClick={() => setActionError(null)} className="text-red-400 hover:text-red-200">Dismiss</button>
        </div>
      )}

      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <h2 className="text-base font-semibold text-gray-100">Accounts</h2>
        <button
          onClick={() => setIsAddOpen(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded text-xs font-medium self-start sm:self-auto transition-colors"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>Add Account</span>
        </button>
      </div>

      {/* Summary Row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="bg-[#16181d] border border-[#22252c] rounded p-3">
          <div className="text-xs text-gray-400">Total Liquid Assets</div>
          <div className="text-lg font-semibold font-mono text-emerald-400 mt-0.5">
            {formatBDT(totalBalance)}
          </div>
        </div>

        <div className="bg-[#16181d] border border-[#22252c] rounded p-3">
          <div className="text-xs text-gray-400">Bank Accounts</div>
          <div className="text-lg font-semibold font-mono text-gray-200 mt-0.5">
            {formatBDT(bankBalance)}
          </div>
        </div>

        <div className="bg-[#16181d] border border-[#22252c] rounded p-3">
          <div className="text-xs text-gray-400">Mobile Banking (MFS)</div>
          <div className="text-lg font-semibold font-mono text-gray-200 mt-0.5">
            {formatBDT(mfsBalance)}
          </div>
        </div>

        <div className="bg-[#16181d] border border-[#22252c] rounded p-3">
          <div className="text-xs text-gray-400">Cash Reserves</div>
          <div className="text-lg font-semibold font-mono text-gray-200 mt-0.5">
            {formatBDT(cashBalance)}
          </div>
        </div>
      </div>

      {/* Search and Filter Toolbar */}
      <div className="bg-[#16181d] border border-[#22252c] rounded p-2.5 flex flex-col md:flex-row items-center justify-between gap-2.5">
        <div className="relative w-full md:w-72">
          <Search className="w-3.5 h-3.5 text-gray-400 absolute left-2.5 top-2.5" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search accounts or provider..."
            className="w-full bg-[#111317] border border-[#262932] rounded pl-8 pr-3 py-1.5 text-xs text-gray-200 focus:outline-none focus:border-blue-500"
          />
        </div>

        <div className="flex items-center gap-2 w-full md:w-auto overflow-x-auto text-xs">
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value as any)}
            className="bg-[#111317] border border-[#262932] rounded px-2.5 py-1.5 text-xs text-gray-300 focus:outline-none focus:border-blue-500"
          >
            <option value="ALL">All Account Types</option>
            <option value="BANK">Bank Accounts</option>
            <option value="MOBILE_BANKING">Mobile Banking (MFS)</option>
            <option value="CASH">Cash Wallets</option>
          </select>

          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value as any)}
            className="bg-[#111317] border border-[#262932] rounded px-2.5 py-1.5 text-xs text-gray-300 focus:outline-none focus:border-blue-500"
          >
            <option value="ACTIVE">Active Accounts</option>
            <option value="ARCHIVED">Archived Accounts</option>
            <option value="ALL">All Statuses</option>
          </select>
        </div>
      </div>

      {/* Main Standard Table */}
      <div className="bg-[#16181d] border border-[#22252c] rounded overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-[#22252c] bg-[#121417] text-gray-400 font-medium uppercase tracking-wider text-[10px]">
                <th className="py-2.5 px-3">Account Name</th>
                <th className="py-2.5 px-3">Type</th>
                <th className="py-2.5 px-3">Institution / Provider</th>
                <th className="py-2.5 px-3">Account #</th>
                <th className="py-2.5 px-3 text-right">Opening Balance</th>
                <th className="py-2.5 px-3 text-right">Current Balance</th>
                <th className="py-2.5 px-3 text-center">Status</th>
                <th className="py-2.5 px-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#20232a]">
              {filteredAccounts.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-gray-500">
                    No accounts found matching current filters.
                  </td>
                </tr>
              ) : (
                filteredAccounts.map((acc) => (
                  <tr key={acc.id} className="hover:bg-[#1a1d24] transition-colors">
                    <td className="py-2.5 px-3 font-medium text-gray-200">
                      {acc.name}
                    </td>
                    <td className="py-2.5 px-3 text-gray-400">
                      {getTypeLabel(acc.type)}
                    </td>
                    <td className="py-2.5 px-3 text-gray-400">
                      {acc.providerName || '-'}
                    </td>
                    <td className="py-2.5 px-3 text-gray-400 font-mono text-[11px]">
                      {acc.accountNumber || '-'}
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono text-gray-400">
                      {formatBDT(acc.openingBalance)}
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono font-semibold text-gray-100">
                      {formatBDT(acc.currentBalance)}
                    </td>
                    <td className="py-2.5 px-3 text-center">
                      <span
                        className={`inline-block px-2 py-0.5 rounded text-[10px] font-medium ${
                          acc.status === 'ACTIVE'
                            ? 'bg-emerald-950/80 text-emerald-400 border border-emerald-800/60'
                            : 'bg-gray-800 text-gray-400 border border-gray-700'
                        }`}
                      >
                        {acc.status}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => setViewAccount(acc)}
                          title="View Ledger"
                          className="p-1 text-gray-400 hover:text-gray-200 hover:bg-[#22252e] rounded"
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => onOpenTransferModal(acc.id)}
                          title="Transfer Funds"
                          className="p-1 text-gray-400 hover:text-blue-400 hover:bg-[#22252e] rounded"
                        >
                          <ArrowRightLeft className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => setEditAccountState(acc)}
                          title="Edit Account"
                          className="p-1 text-gray-400 hover:text-gray-200 hover:bg-[#22252e] rounded"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => toggleArchiveAccount(acc.id)}
                          title={acc.status === 'ACTIVE' ? 'Archive Account' : 'Restore Account'}
                          className="p-1 text-gray-400 hover:text-amber-400 hover:bg-[#22252e] rounded"
                        >
                          {acc.status === 'ACTIVE' ? (
                            <Archive className="w-3.5 h-3.5" />
                          ) : (
                            <ArchiveRestore className="w-3.5 h-3.5" />
                          )}
                        </button>
                        <button
                          onClick={() => setAccountToDelete(acc)}
                          title="Delete Account"
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

        {/* Table Footer */}
        <div className="py-2 px-3 border-t border-[#22252c] bg-[#121417] text-gray-400 text-xs flex justify-between items-center">
          <span>Showing {filteredAccounts.length} of {accounts.length} accounts</span>
          <span className="font-mono">Total Liquid: {formatBDT(totalBalance)}</span>
        </div>
      </div>

      {/* Add Account Modal */}
      <Modal
        isOpen={isAddOpen}
        onClose={() => setIsAddOpen(false)}
        title="Add Account"
      >
        <form onSubmit={handleCreate} className="space-y-3">
          <div>
            <label className="block text-xs text-gray-300 font-medium mb-1">
              Account Name *
            </label>
            <input
              type="text"
              required
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="e.g. City Bank Priority or bKash Personal"
              className="w-full bg-[#111317] border border-[#262932] rounded px-3 py-1.5 text-xs text-gray-200 focus:outline-none focus:border-blue-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-gray-300 font-medium mb-1">
                Account Type *
              </label>
              <select
                value={newType}
                onChange={(e) => setNewType(e.target.value as any)}
                className="w-full bg-[#111317] border border-[#262932] rounded px-3 py-1.5 text-xs text-gray-200 focus:outline-none focus:border-blue-500"
              >
                <option value="BANK">Bank Account</option>
                <option value="MOBILE_BANKING">Mobile Banking (MFS)</option>
                <option value="CASH">Cash Wallet</option>
              </select>
            </div>

            <div>
              <label className="block text-xs text-gray-300 font-medium mb-1">
                Institution / Provider
              </label>
              <input
                type="text"
                value={newProvider}
                onChange={(e) => setNewProvider(e.target.value)}
                placeholder="e.g. BRAC Bank, bKash, Cash"
                className="w-full bg-[#111317] border border-[#262932] rounded px-3 py-1.5 text-xs text-gray-200 focus:outline-none focus:border-blue-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-gray-300 font-medium mb-1">
                Account Number
              </label>
              <input
                type="text"
                value={newNumber}
                onChange={(e) => setNewNumber(e.target.value)}
                placeholder="e.g. 102938472"
                className="w-full bg-[#111317] border border-[#262932] rounded px-3 py-1.5 text-xs text-gray-200 focus:outline-none focus:border-blue-500"
              />
            </div>

            <div>
              <label className="block text-xs text-gray-300 font-medium mb-1">
                Opening Balance (৳ BDT)
              </label>
              <input
                type="number"
                step="0.01"
                value={newOpeningBalance}
                onChange={(e) => setNewOpeningBalance(e.target.value)}
                className="w-full bg-[#111317] border border-[#262932] rounded px-3 py-1.5 text-xs text-gray-200 font-mono focus:outline-none focus:border-blue-500"
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-[#22252c]">
            <button
              type="button"
              onClick={() => setIsAddOpen(false)}
              className="px-3 py-1.5 bg-[#1a1d24] hover:bg-[#222631] text-gray-300 rounded text-xs transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded text-xs font-medium transition-colors"
            >
              Save Account
            </button>
          </div>
        </form>
      </Modal>

      {/* Edit Account Modal */}
      <Modal
        isOpen={Boolean(editAccountState)}
        onClose={() => setEditAccountState(null)}
        title="Edit Account"
      >
        {editAccountState && (
          <form onSubmit={handleUpdate} className="space-y-3">
            <div>
              <label className="block text-xs text-gray-300 font-medium mb-1">
                Account Name *
              </label>
              <input
                type="text"
                required
                value={editAccountState.name}
                onChange={(e) => setEditAccountState({ ...editAccountState, name: e.target.value })}
                className="w-full bg-[#111317] border border-[#262932] rounded px-3 py-1.5 text-xs text-gray-200 focus:outline-none focus:border-blue-500"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-gray-300 font-medium mb-1">
                  Account Type
                </label>
                <select
                  value={editAccountState.type}
                  onChange={(e) => setEditAccountState({ ...editAccountState, type: e.target.value as any })}
                  className="w-full bg-[#111317] border border-[#262932] rounded px-3 py-1.5 text-xs text-gray-200 focus:outline-none focus:border-blue-500"
                >
                  <option value="BANK">Bank Account</option>
                  <option value="MOBILE_BANKING">Mobile Banking (MFS)</option>
                  <option value="CASH">Cash Wallet</option>
                </select>
              </div>

              <div>
                <label className="block text-xs text-gray-300 font-medium mb-1">
                  Institution / Provider
                </label>
                <input
                  type="text"
                  value={editAccountState.providerName || ''}
                  onChange={(e) => setEditAccountState({ ...editAccountState, providerName: e.target.value })}
                  className="w-full bg-[#111317] border border-[#262932] rounded px-3 py-1.5 text-xs text-gray-200 focus:outline-none focus:border-blue-500"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-gray-300 font-medium mb-1">
                  Account Number
                </label>
                <input
                  type="text"
                  value={editAccountState.accountNumber || ''}
                  onChange={(e) => setEditAccountState({ ...editAccountState, accountNumber: e.target.value })}
                  className="w-full bg-[#111317] border border-[#262932] rounded px-3 py-1.5 text-xs text-gray-200 focus:outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs text-gray-300 font-medium mb-1">
                  Status
                </label>
                <select
                  value={editAccountState.status}
                  onChange={(e) => setEditAccountState({ ...editAccountState, status: e.target.value as any })}
                  className="w-full bg-[#111317] border border-[#262932] rounded px-3 py-1.5 text-xs text-gray-200 focus:outline-none focus:border-blue-500"
                >
                  <option value="ACTIVE">Active</option>
                  <option value="ARCHIVED">Archived</option>
                </select>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-[#22252c]">
              <button
                type="button"
                onClick={() => setEditAccountState(null)}
                className="px-3 py-1.5 bg-[#1a1d24] hover:bg-[#222631] text-gray-300 rounded text-xs transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded text-xs font-medium transition-colors"
              >
                Save Changes
              </button>
            </div>
          </form>
        )}
      </Modal>

      {/* View Account Ledger Modal */}
      <Modal
        isOpen={Boolean(viewAccount)}
        onClose={() => setViewAccount(null)}
        title={viewAccount ? `${viewAccount.name} — Transaction History` : 'Account History'}
        maxWidth="max-w-2xl"
      >
        {viewAccount && (
          <div className="space-y-3">
            <div className="grid grid-cols-3 gap-2 p-2.5 bg-[#111317] border border-[#22252c] rounded text-xs">
              <div>
                <div className="text-gray-400">Opening Balance</div>
                <div className="font-mono text-gray-200 mt-0.5">{formatBDT(viewAccount.openingBalance)}</div>
              </div>
              <div>
                <div className="text-gray-400">Current Balance</div>
                <div className="font-mono text-emerald-400 font-semibold mt-0.5">{formatBDT(viewAccount.currentBalance)}</div>
              </div>
              <div>
                <div className="text-gray-400">Status</div>
                <div className="text-gray-200 mt-0.5">{viewAccount.status}</div>
              </div>
            </div>

            <div className="overflow-x-auto max-h-72 border border-[#22252c] rounded">
              <table className="w-full text-left text-xs">
                <thead className="bg-[#121417] text-gray-400 border-b border-[#22252c] text-[10px] uppercase">
                  <tr>
                    <th className="py-2 px-3">Date</th>
                    <th className="py-2 px-3">Description</th>
                    <th className="py-2 px-3">Type</th>
                    <th className="py-2 px-3 text-right">Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#1e2129]">
                  {transactions.filter(t => t.accountId === viewAccount.id || t.destinationAccountId === viewAccount.id).length === 0 ? (
                    <tr>
                      <td colSpan={4} className="py-6 text-center text-gray-500">
                        No transactions recorded for this account.
                      </td>
                    </tr>
                  ) : (
                    transactions
                      .filter(t => t.accountId === viewAccount.id || t.destinationAccountId === viewAccount.id)
                      .map((tx) => (
                        <tr key={tx.id} className="hover:bg-[#1a1d24]">
                          <td className="py-2 px-3 text-gray-400 font-mono text-[11px]">{tx.date}</td>
                          <td className="py-2 px-3 text-gray-200">{tx.description}</td>
                          <td className="py-2 px-3 text-gray-400 text-[10px]">{tx.type}</td>
                          <td className="py-2 px-3 text-right font-mono font-medium text-gray-100">
                            {formatBDT(tx.amount)}
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
                onClick={() => setViewAccount(null)}
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
        isOpen={Boolean(accountToDelete)}
        onClose={() => setAccountToDelete(null)}
        onConfirm={confirmDelete}
        title="Delete Account"
        message={accountToDelete ? `Are you sure you want to delete "${accountToDelete.name}"? Only accounts without posted transactions can be removed.` : ''}
        confirmLabel="Delete"
        isDestructive={true}
      />
    </div>
  );
};
