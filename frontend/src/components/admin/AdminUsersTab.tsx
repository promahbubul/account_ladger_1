import { formatDate, CURRENCY_SYMBOLS } from '../../lib/formatters';
import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useFinance } from '../../context/FinanceContext';
import { UserPlus, KeyRound, Edit2, Trash2, Search } from 'lucide-react';
import { Modal, ConfirmModal } from '../common/Modal';
import { TablePagination } from '../common/TablePagination';
import { useCursorPagination } from '../../hooks/useCursorPagination';
import { TableErrorRow, TableLoadingRow, TableEmptyRow } from '../common/StateViews';
import { ManagedUser } from './types';
import { getErrorMessage } from '../../lib/errors';

interface AdminUsersTabProps {
  refreshKey: number;
  onUsersChanged: () => void;
  onSuccessNotification: (msg: string) => void;
}

export const AdminUsersTab: React.FC<AdminUsersTabProps> = ({ refreshKey, onUsersChanged, onSuccessNotification }) => {
  const { user: currentUser, token } = useAuth();
  const { authFetch } = useFinance();
  const [userSearchQuery, setUserSearchQuery] = useState('');

  // Modals state
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [editUser, setEditUser] = useState<ManagedUser | null>(null);
  const [resetPasswordUser, setResetPasswordUser] = useState<ManagedUser | null>(null);
  const [deleteConfirmUser, setDeleteConfirmUser] = useState<ManagedUser | null>(null);

  // Form states
  const [createForm, setCreateForm] = useState({
    username: '',
    email: '',
    fullName: '',
    password: '',
    role: 'USER' as 'ADMIN' | 'USER',
    currency: 'BDT',
  });
  const [newPassword, setNewPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // User management pagination state
  const [userItems, setUserItems] = useState<ManagedUser[]>([]);
  const [userTotalCount, setUserTotalCount] = useState<number>(0);
  const [userNextCursor, setUserNextCursor] = useState<string | null>(null);
  const [isUsersLoading, setIsUsersLoading] = useState(true);
  const [userError, setUserError] = useState<string | null>(null);

  const userPagination = useCursorPagination({ initialPageSize: 50, pageKey: 'userPage', pageSizeKey: 'userPageSize' });

  const fetchUsers = useCallback(async () => {
    if (!token) return;
    try {
      setIsUsersLoading(true);
      setUserError(null);

      const params = new URLSearchParams();
      params.set('limit', String(userPagination.pageSize));
      if (userPagination.cursor) params.set('cursor', userPagination.cursor);
      if (userSearchQuery.trim()) params.set('search', userSearchQuery.trim());

      const res = await authFetch(`/api/admin/users?${params.toString()}`);
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Failed to fetch users');
      }

      const data = await res.json();
      setUserItems(data.items || []);
      setUserTotalCount(data.totalCount ?? (data.items || []).length);
      setUserNextCursor(data.nextCursor || null);
      userPagination.setPaginationMeta({
        hasNextPage: Boolean(data.hasNextPage),
        hasPreviousPage: Boolean(data.hasPreviousPage),
      });
    } catch (err: unknown) {
      console.error('Fetch users error:', err);
      setUserError(getErrorMessage(err) || 'Error loading users');
    } finally {
      setIsUsersLoading(false);
    }
  }, [token, authFetch, userPagination.pageSize, userPagination.cursor, userSearchQuery, userPagination.setPaginationMeta]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers, refreshKey]);

  const handleUserSearchChange = (val: string) => {
    setUserSearchQuery(val);
    userPagination.resetPagination();
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setIsSubmitting(true);

    try {
      const res = await authFetch(`/api/admin/users`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(createForm),
      });

      const data = await res.json();
      if (!res.ok) {
        setFormError(data.error || 'Failed to create user.');
      } else {
        setIsCreateModalOpen(false);
        setCreateForm({
          username: '',
          email: '',
          fullName: '',
          password: '',
          role: 'USER',
          currency: 'BDT',
        });
        onSuccessNotification(`User ${data.user.username} created.`);
        userPagination.resetPagination();
        fetchUsers();
        onUsersChanged();
      }
    } catch (err) {
      setFormError('Network error creating user.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUpdateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editUser) return;
    setFormError(null);
    setIsSubmitting(true);

    try {
      const res = await authFetch(`/api/admin/users/${editUser.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          fullName: editUser.fullName,
          email: editUser.email,
          role: editUser.role,
          currency: editUser.currency,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setFormError(data.error || 'Failed to update user.');
      } else {
        setEditUser(null);
        onSuccessNotification(`User ${editUser.username} updated.`);
        fetchUsers();
      }
    } catch (err) {
      setFormError('Network error updating user.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleToggleActive = async (u: ManagedUser) => {
    if (u.id === currentUser?.id) {
      alert('You cannot deactivate your own account.');
      return;
    }

    try {
      const res = await authFetch(`/api/admin/users/${u.id}/status`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ isActive: !u.isActive }),
      });
      if (res.ok) {
        const nextState = !u.isActive;
        onSuccessNotification(`User @${u.username} is now ${nextState ? 'Active' : 'Deactivated'}.`);
        fetchUsers();
        onUsersChanged();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resetPasswordUser || !newPassword) return;
    setFormError(null);
    setIsSubmitting(true);

    try {
      const res = await authFetch(`/api/admin/users/${resetPasswordUser.id}/reset-password`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ newPassword }),
      });

      const data = await res.json();
      if (!res.ok) {
        setFormError(data.error || 'Failed to reset password.');
      } else {
        setResetPasswordUser(null);
        setNewPassword('');
        onSuccessNotification(`Password for @${resetPasswordUser.username} updated.`);
      }
    } catch (err) {
      setFormError('Network error resetting password.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteUser = async () => {
    if (!deleteConfirmUser) return;
    try {
      const res = await authFetch(`/api/admin/users/${deleteConfirmUser.id}`, {
        method: 'DELETE',
      });
      if (res.ok) {
        onSuccessNotification(`User @${deleteConfirmUser.username} was permanently deleted.`);
        setDeleteConfirmUser(null);
        fetchUsers();
        onUsersChanged();
      }
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <>
    <div className="flex-1 min-h-0 flex flex-col space-y-2.5">
      {/* Toolbar */}
      <div className="bg-surface border border-line rounded p-2.5 flex flex-col md:flex-row items-center justify-between gap-2.5 flex-shrink-0">
        <div className="relative w-full md:w-80">
          <Search className="w-3.5 h-3.5 text-gray-500 absolute left-2.5 top-2.5" />
          <input
            type="text"
            value={userSearchQuery}
            onChange={(e) => handleUserSearchChange(e.target.value)}
            placeholder="Search users..."
            className="w-full bg-app border border-line-strong rounded pl-8 pr-3 py-1.5 text-xs text-gray-200 focus:outline-none focus:border-blue-500 placeholder-gray-500"
          />
        </div>

        <div className="flex items-center gap-3 w-full md:w-auto justify-between md:justify-end">
          <button
            onClick={() => setIsCreateModalOpen(true)}
            className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-xs text-white font-medium rounded flex items-center gap-1.5 transition-colors"
          >
            <UserPlus className="w-3.5 h-3.5" />
            <span>Create User</span>
          </button>
        </div>
      </div>

      {/* Viewport-based Users Table */}
      <div className="bg-surface border border-line rounded overflow-hidden flex-1 min-h-0 flex flex-col">
        <div className="flex-1 min-h-0 overflow-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead className="sticky top-0 z-10 bg-surface-sunken shadow-sm">
              <tr className="border-b border-line text-gray-400 uppercase tracking-wider text-[10px]">
                <th className="py-2.5 px-3">User</th>
                <th className="py-2.5 px-3">Email</th>
                <th className="py-2.5 px-3">Role</th>
                <th className="py-2.5 px-3">Status</th>
                <th className="py-2.5 px-3">Currency</th>
                <th className="py-2.5 px-3">Created</th>
                <th className="py-2.5 px-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-divider">
              {userError ? (
                <TableErrorRow
                  colSpan={7}
                  title="Failed to load users"
                  description={userError}
                  onRetry={fetchUsers}
                />
              ) : isUsersLoading ? (
                <TableLoadingRow
                  colSpan={7}
                  message="Loading system users..."
                />
              ) : userItems.length === 0 ? (
                <TableEmptyRow
                  colSpan={7}
                  title="No users found"
                  description={
                    userSearchQuery
                      ? 'No users match your search query.'
                      : undefined
                  }
                  action={{
                    label: 'Create User',
                    onClick: () => {
                      setCreateForm({
                        username: '',
                        email: '',
                        fullName: '',
                        password: '',
                        role: 'USER',
                        currency: 'BDT',
                      });
                      setIsCreateModalOpen(true);
                    },
                  }}
                />
              ) : (
                userItems.map((u) => {
                  const isCurrent = u.id === currentUser?.id;
                  return (
                    <tr key={u.id} className="hover:bg-surface-hover transition-colors">
                      <td className="py-2.5 px-3">
                        <div className="font-medium text-gray-200 flex items-center gap-1.5">
                          {u.fullName}
                          {isCurrent && (
                            <span className="px-1.5 py-0.2 text-[9px] bg-blue-900/60 text-blue-300 border border-blue-700/60 rounded">
                              You
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] text-gray-500">@{u.username}</div>
                      </td>
                      <td className="py-2.5 px-3 text-gray-300">{u.email}</td>
                      <td className="py-2.5 px-3">
                        <span
                          className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-medium ${
                            u.role === 'ADMIN'
                              ? 'bg-purple-950/70 text-purple-300 border border-purple-800/60'
                              : 'bg-gray-800 text-gray-300 border border-gray-700'
                          }`}
                        >
                          {u.role}
                        </span>
                      </td>
                      <td className="py-2.5 px-3">
                        <button
                          onClick={() => handleToggleActive(u)}
                          disabled={isCurrent}
                          title={isCurrent ? 'Cannot deactivate self' : 'Toggle status'}
                          className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-medium transition-colors ${
                            u.isActive
                              ? 'bg-emerald-950/70 text-emerald-400 border border-emerald-800/60'
                              : 'bg-red-950/70 text-red-400 border border-red-800/60'
                          } ${isCurrent ? 'cursor-not-allowed opacity-80' : 'cursor-pointer hover:opacity-80'}`}
                        >
                          {u.isActive ? 'ACTIVE' : 'DEACTIVATED'}
                        </button>
                      </td>
                      <td className="py-2.5 px-3 font-mono text-gray-400">{u.currency}</td>
                      <td className="py-2.5 px-3 text-gray-400 text-[11px] whitespace-nowrap">
                        {u.createdAt ? formatDate(u.createdAt) : '-'}
                      </td>
                      <td className="py-2.5 px-3 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => {
                              setEditUser(u);
                              setFormError(null);
                            }}
                            title="Edit User"
                            className="p-1 text-gray-400 hover:text-gray-200 hover:bg-line-soft rounded"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => {
                              setResetPasswordUser(u);
                              setNewPassword('');
                              setFormError(null);
                            }}
                            title="Reset Password"
                            className="p-1 text-gray-400 hover:text-blue-400 hover:bg-line-soft rounded"
                          >
                            <KeyRound className="w-3.5 h-3.5" />
                          </button>
                          {!isCurrent && (
                            <button
                              onClick={() => setDeleteConfirmUser(u)}
                              title="Delete User"
                              className="p-1 text-gray-400 hover:text-red-400 hover:bg-line-soft rounded"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Integrated User Pagination */}
        <TablePagination
          pageSize={userPagination.pageSize}
          onPageSizeChange={userPagination.setPageSize}
          hasNextPage={userPagination.hasNextPage}
          hasPreviousPage={userPagination.hasPreviousPage}
          onNextPage={() => userPagination.goToNextPage(userNextCursor)}
          onPreviousPage={userPagination.goToPreviousPage}
          isLoading={isUsersLoading}
          itemCount={userItems.length}
          totalCount={userTotalCount}
          pageIndex={userPagination.pageIndex}
          currentPage={userPagination.currentPage}
          maxIndexedPage={userPagination.maxIndexedPage}
          onGoToPage={userPagination.goToPage}
        />
      </div>
    </div>

      {/* Create User Modal */}
      <Modal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        title="Create User"
      >
        <form onSubmit={handleCreateUser} className="space-y-3">
          {formError && (
            <div className="p-2.5 rounded bg-red-950/40 border border-red-800/60 text-xs text-red-300">
              {formError}
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-gray-300 mb-1">Full Name *</label>
            <input
              type="text"
              required
              value={createForm.fullName}
              onChange={(e) => setCreateForm({ ...createForm, fullName: e.target.value })}
              className="w-full bg-field border border-field-line rounded px-3 py-1.5 text-xs text-white focus:outline-none focus:border-blue-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-xs font-medium text-gray-300 mb-1">Username *</label>
              <input
                type="text"
                required
                value={createForm.username}
                onChange={(e) => setCreateForm({ ...createForm, username: e.target.value })}
                className="w-full bg-field border border-field-line rounded px-3 py-1.5 text-xs text-white focus:outline-none focus:border-blue-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-300 mb-1">Role *</label>
              <select
                value={createForm.role}
                onChange={(e) => setCreateForm({ ...createForm, role: e.target.value as 'ADMIN' | 'USER' })}
                className="w-full bg-field border border-field-line rounded px-3 py-1.5 text-xs text-white focus:outline-none focus:border-blue-500"
              >
                <option value="USER">Normal User</option>
                <option value="ADMIN">System Admin</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-300 mb-1">Email Address *</label>
            <input
              type="email"
              required
              value={createForm.email}
              onChange={(e) => setCreateForm({ ...createForm, email: e.target.value })}
              className="w-full bg-field border border-field-line rounded px-3 py-1.5 text-xs text-white focus:outline-none focus:border-blue-500"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-300 mb-1">Initial Password *</label>
            <input
              type="password"
              required
              value={createForm.password}
              onChange={(e) => setCreateForm({ ...createForm, password: e.target.value })}
              placeholder="At least 6 characters"
              className="w-full bg-field border border-field-line rounded px-3 py-1.5 text-xs text-white focus:outline-none focus:border-blue-500"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-300 mb-1">Currency</label>
            <select
              value={createForm.currency}
              onChange={(e) => setCreateForm({ ...createForm, currency: e.target.value })}
              className="w-full bg-field border border-field-line rounded px-3 py-1.5 text-xs text-white focus:outline-none focus:border-blue-500"
            >
              {Object.entries(CURRENCY_SYMBOLS).map(([code, symbol]) => (
                <option key={code} value={code}>{code} ({symbol})</option>
              ))}
            </select>
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-line">
            <button
              type="button"
              onClick={() => setIsCreateModalOpen(false)}
              className="px-3 py-1.5 text-xs text-gray-400 hover:text-white"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-xs font-medium text-white rounded"
            >
              {isSubmitting ? 'Creating...' : 'Create User'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Edit User Modal */}
      <Modal
        isOpen={!!editUser}
        onClose={() => setEditUser(null)}
        title="Edit User"
      >
        {editUser && (
          <form onSubmit={handleUpdateUser} className="space-y-3">
            {formError && (
              <div className="p-2.5 rounded bg-red-950/40 border border-red-800/60 text-xs text-red-300">
                {formError}
              </div>
            )}

            <div>
              <label className="block text-xs font-medium text-gray-300 mb-1">Full Name</label>
              <input
                type="text"
                required
                value={editUser.fullName}
                onChange={(e) => setEditUser({ ...editUser, fullName: e.target.value })}
                className="w-full bg-field border border-field-line rounded px-3 py-1.5 text-xs text-white focus:outline-none focus:border-blue-500"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-300 mb-1">Email</label>
              <input
                type="email"
                required
                value={editUser.email}
                onChange={(e) => setEditUser({ ...editUser, email: e.target.value })}
                className="w-full bg-field border border-field-line rounded px-3 py-1.5 text-xs text-white focus:outline-none focus:border-blue-500"
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-xs font-medium text-gray-300 mb-1">Role</label>
                <select
                  value={editUser.role}
                  disabled={editUser.id === currentUser?.id}
                  onChange={(e) => setEditUser({ ...editUser, role: e.target.value as 'ADMIN' | 'USER' })}
                  className="w-full bg-field border border-field-line rounded px-3 py-1.5 text-xs text-white focus:outline-none focus:border-blue-500 disabled:opacity-60"
                >
                  <option value="USER">Normal User</option>
                  <option value="ADMIN">System Admin</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-300 mb-1">Currency</label>
                <select
                  value={editUser.currency}
                  onChange={(e) => setEditUser({ ...editUser, currency: e.target.value })}
                  className="w-full bg-field border border-field-line rounded px-3 py-1.5 text-xs text-white focus:outline-none focus:border-blue-500"
                >
                  {Object.entries(CURRENCY_SYMBOLS).map(([code, symbol]) => (
                    <option key={code} value={code}>{code} ({symbol})</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-line">
              <button
                type="button"
                onClick={() => setEditUser(null)}
                className="px-3 py-1.5 text-xs text-gray-400 hover:text-white"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-xs font-medium text-white rounded"
              >
                {isSubmitting ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </form>
        )}
      </Modal>

      {/* Reset Password Modal */}
      <Modal
        isOpen={!!resetPasswordUser}
        onClose={() => setResetPasswordUser(null)}
        title="Reset Password"
      >
        {resetPasswordUser && (
          <form onSubmit={handleResetPassword} className="space-y-3">
            {formError && (
              <div className="p-2.5 rounded bg-red-950/40 border border-red-800/60 text-xs text-red-300">
                {formError}
              </div>
            )}

            <p className="text-xs text-gray-300">
              Resetting password for user <span className="font-semibold text-white">@{resetPasswordUser.username}</span> ({resetPasswordUser.email}).
            </p>

            <div>
              <label className="block text-xs font-medium text-gray-300 mb-1">New Password *</label>
              <input
                type="password"
                required
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="At least 6 characters"
                className="w-full bg-field border border-field-line rounded px-3 py-1.5 text-xs text-white focus:outline-none focus:border-blue-500"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-line">
              <button
                type="button"
                onClick={() => setResetPasswordUser(null)}
                className="px-3 py-1.5 text-xs text-gray-400 hover:text-white"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-xs font-medium text-white rounded"
              >
                {isSubmitting ? 'Updating...' : 'Set New Password'}
              </button>
            </div>
          </form>
        )}
      </Modal>

      {/* Delete User Confirm Modal */}
      <ConfirmModal
        isOpen={!!deleteConfirmUser}
        onClose={() => setDeleteConfirmUser(null)}
        onConfirm={handleDeleteUser}
        title="Delete User"
        message={`Are you sure you want to permanently remove user @${deleteConfirmUser?.username}? All associated data will be removed.`}
        confirmLabel="Delete User"
        isDestructive={true}
      />
    </>
  );
};
