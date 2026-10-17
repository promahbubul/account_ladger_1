import React, { useState, useEffect, useCallback } from 'react';
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
import { Account } from '../../mock/data';
import { Modal, ConfirmModal } from '../common/Modal';
import { TablePagination } from '../common/TablePagination';
import { useCursorPagination } from '../../hooks/useCursorPagination';
import { TableErrorRow, TableLoadingRow, TableEmptyRow } from '../common/StateViews';
import { useToast } from '../../context/ToastContext';

interface AccountsViewProps {
  onOpenTransferModal: (accountId?: string) => void;
  onNavigateTab: (tab: any) => void;
  onSuccessNotification?: (msg: string) => void;
}

export const AccountsView: React.FC<AccountsViewProps> = ({
  onOpenTransferModal,
  onSuccessNotification,
}) => {
  const toast = useToast();
  const { transactions, addAccount, editAccount, toggleArchiveAccount, deleteAccount, authFetch } = useFinance();
  
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

  // Pagination state
  const [items, setItems] = useState<Account[]>([]);
  const [totalCount, setTotalCount] = useState<number>(0);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
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

  const fetchAccounts = useCallback(async () => {
    try {
      setIsLoading(true);
      setErrorMsg(null);

      const params = new URLSearchParams();
      params.set('paginate', 'true');
      params.set('limit', String(pageSize));
      if (cursor) {
        params.set('cursor', cursor);
      } else if (currentPage > 1) {
        params.set('page', String(currentPage));
      }
      if (searchQuery.trim()) params.set('search', searchQuery.trim());
      if (filterType !== 'ALL') params.set('type', filterType);
      if (filterStatus !== 'ALL') params.set('status', filterStatus);

      const res = await authFetch(`/api/accounts?${params.toString()}`);
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Failed to load accounts');
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
      console.error('Fetch accounts error:', err);
      setErrorMsg(err.message || 'Error fetching accounts');
    } finally {
      setIsLoading(false);
    }
  }, [authFetch, pageSize, cursor, currentPage, searchQuery, filterType, filterStatus, setPaginationMeta]);

  useEffect(() => {
    fetchAccounts();
  }, [fetchAccounts]);

  const handleSearchChange = (val: string) => {
    setSearchQuery(val);
    resetPagination();
  };

  const handleTypeChange = (val: 'ALL' | 'CASH' | 'BANK' | 'MOBILE_BANKING') => {
    setFilterType(val);
    resetPagination();
  };

  const handleStatusChange = (val: 'ALL' | 'ACTIVE' | 'ARCHIVED') => {
    setFilterStatus(val);
    resetPagination();
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) return;

    const opBal = parseFloat(newOpeningBalance) || 0;
    const res = await addAccount({
      name: newName.trim(),
      type: newType,
      providerName: newProvider.trim() || (newType === 'BANK' ? 'Bank' : newType === 'MOBILE_BANKING' ? 'MFS' : 'Physical Cash'),
      accountNumber: newNumber.trim() ? (newNumber.startsWith('••••') ? newNumber : `•••• ${newNumber.slice(-4)}`) : undefined,
      openingBalance: opBal,
      currentBalance: opBal,
      currency: 'BDT',
      status: 'ACTIVE',
    });

    if (res.success && res.account) {
      const created = res.account;
      const matchesType = filterType === 'ALL' || filterType === created.type;
      const matchesStatus = filterStatus === 'ALL' || filterStatus === 'ACTIVE';
      if (matchesType && matchesStatus) {
        setItems((prev) => [created, ...prev]);
      }
      setTotalCount((prev) => prev + 1);
      toast.success(`Account "${newName}" created successfully`);
      setIsAddOpen(false);
      setNewName('');
      setNewProvider('');
      setNewNumber('');
      setNewOpeningBalance('0');
    } else {
      toast.error(res.error || 'Failed to create account');
    }
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editAccountState) return;

    const res = await editAccount(editAccountState.id, {
      name: editAccountState.name,
      type: editAccountState.type,
      providerName: editAccountState.providerName,
      accountNumber: editAccountState.accountNumber,
      status: editAccountState.status,
    });

    if (res.success && res.account) {
      const updated = res.account;
      setItems((prev) => prev.map((a) => (a.id === updated.id ? updated : a)));
      toast.success(`Account "${updated.name}" updated successfully`);
      setEditAccountState(null);
    } else {
      toast.error(res.error || 'Failed to update account');
    }
  };

  const handleToggleArchive = async (id: string, currentStatus: string) => {
    const res = await toggleArchiveAccount(id);
    if (res.success && res.account) {
      const updated = res.account;
      if (filterStatus !== 'ALL') {
        setItems((prev) => prev.filter((a) => a.id !== id));
        setTotalCount((prev) => Math.max(0, prev - 1));
      } else {
        setItems((prev) => prev.map((a) => (a.id === id ? updated : a)));
      }
      toast.success(updated.status === 'ACTIVE' ? 'Account restored to active status' : 'Account archived successfully');
    } else {
      toast.error(res.error || 'Failed to update account status');
    }
  };

  const confirmDelete = async () => {
    if (!accountToDelete) return;
    const deletedId = accountToDelete.id;
    const res = await deleteAccount(deletedId);
    if (!res.success) {
      setActionError(res.error || 'Failed to delete account.');
      toast.error(res.error || 'Failed to delete account');
      return;
    }

    setItems((prev) => prev.filter((a) => a.id !== deletedId));
    setTotalCount((prev) => Math.max(0, prev - 1));
    toast.success(`Account "${accountToDelete.name}" deleted successfully`);
    setAccountToDelete(null);
    setActionError(null);
  };

  const getTypeLabel = (type: string) => {
    switch (type) {
      case 'BANK': return 'Bank Account';
      case 'MOBILE_BANKING': return 'Mobile Banking';
      case 'CASH': return 'Physical Cash';
      default: return type;
    }
  };

  return (
    <div className="h-full flex flex-col min-h-0 w-full min-w-0 space-y-3">
      {/* Actions */}
      <div className="flex items-center justify-end gap-2 flex-shrink-0">
        <button
          onClick={() => onOpenTransferModal()}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-[#1b1e25] hover:bg-[#222631] text-gray-300 rounded text-xs border border-[#2b2e38] transition-colors"
        >
          <ArrowRightLeft className="w-3.5 h-3.5" />
          <span>Transfer Funds</span>
        </button>
        <button
          onClick={() => setIsAddOpen(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded text-xs font-medium transition-colors"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>Add Account</span>
        </button>
      </div>

      {/* Search & Filter Toolbar */}
      <div className="bg-[#16181d] border border-[#22252c] rounded p-2.5 flex flex-col md:flex-row items-center justify-between gap-2.5 flex-shrink-0">
        <div className="relative w-full md:w-72">
          <Search className="w-3.5 h-3.5 text-gray-400 absolute left-2.5 top-2.5" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => handleSearchChange(e.target.value)}
            placeholder="Search accounts..."
            className="w-full bg-[#111317] border border-[#262932] rounded pl-8 pr-3 py-1.5 text-xs text-gray-200 focus:outline-none focus:border-blue-500 placeholder-gray-500"
          />
        </div>

        <div className="flex items-center gap-2 w-full md:w-auto text-xs">
          <select
            value={filterType}
            onChange={(e) => handleTypeChange(e.target.value as any)}
            className="bg-[#111317] border border-[#262932] rounded px-2.5 py-1.5 text-xs text-gray-300 focus:outline-none focus:border-blue-500"
          >
            <option value="ALL">All Account Types</option>
            <option value="BANK">Bank Accounts</option>
            <option value="MOBILE_BANKING">Mobile Banking (MFS)</option>
            <option value="CASH">Cash Wallets</option>
          </select>

          <select
            value={filterStatus}
            onChange={(e) => handleStatusChange(e.target.value as any)}
            className="bg-[#111317] border border-[#262932] rounded px-2.5 py-1.5 text-xs text-gray-300 focus:outline-none focus:border-blue-500"
          >
            <option value="ACTIVE">Active Accounts</option>
            <option value="ARCHIVED">Archived Accounts</option>
            <option value="ALL">All Statuses</option>
          </select>
        </div>
      </div>

      {actionError && (
        <div className="p-2.5 bg-red-950/40 border border-red-800/60 rounded text-xs text-red-300 flex-shrink-0">
          {actionError}
        </div>
      )}

      {/* Main Standard Table */}
      <div className="bg-[#16181d] border border-[#22252c] rounded overflow-hidden flex-1 min-h-0 flex flex-col">
        <div className="flex-1 min-h-0 overflow-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead className="sticky top-0 z-10 bg-[#121417] shadow-sm">
              <tr className="border-b border-[#22252c] text-gray-400 font-medium uppercase tracking-wider text-[10px]">
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
              {errorMsg ? (
                <TableErrorRow
                  colSpan={8}
                  title="Failed to load accounts"
                  description={errorMsg}
                  onRetry={fetchAccounts}
                />
              ) : isLoading ? (
                <TableLoadingRow
                  colSpan={8}
                  message="Loading accounts..."
                />
              ) : items.length === 0 ? (
                <TableEmptyRow
                  colSpan={8}
                  title="No accounts found"
                  description={
                    searchQuery || filterType !== 'ALL' || filterStatus !== 'ALL'
                      ? 'No accounts match the selected filters.'
                      : 'No financial accounts created yet. Add cash or bank accounts to get started.'
                  }
                  action={{
                    label: 'Create Account',
                    onClick: () => setIsAddOpen(true),
                  }}
                />
              ) : (
                items.map((acc) => (
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
                          onClick={() => handleToggleArchive(acc.id, acc.status)}
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
