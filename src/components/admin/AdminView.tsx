import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import {
  UserPlus,
  KeyRound,
  Edit2,
  Trash2,
  Search,
  RefreshCw,
  Shield,
  Activity,
  Server,
  Database,
  Users,
  FileText,
  Sliders,
  CheckCircle2,
  AlertCircle,
  Clock,
  Globe,
} from 'lucide-react';
import { Modal, ConfirmModal } from '../common/Modal';

interface ManagedUser {
  id: string;
  username: string;
  email: string;
  fullName: string;
  role: 'ADMIN' | 'USER';
  isActive: boolean;
  currency: string;
  createdAt: string;
}

interface AdminStats {
  status: {
    connectedToNeon: boolean;
    mode: string;
    storageFile: string;
    userCount: number;
    accountCount: number;
    transactionCount: number;
  };
  totalUsers: number;
  activeUsers: number;
  adminCount: number;
}

interface AuditLog {
  id: string;
  userId: string;
  userEmail?: string;
  action: string;
  entityType: string;
  entityId: string;
  details?: string;
  ipAddress?: string;
  createdAt: string;
}

interface SystemSettings {
  appName: string;
  maintenanceMode: boolean;
  allowUserRegistration: boolean;
  defaultCurrency: string;
  sessionTimeoutHours: number;
  auditLoggingEnabled: boolean;
  updatedAt: string;
}

interface AdminViewProps {
  initialSection?: 'dashboard' | 'users' | 'logs' | 'settings';
  onSuccessNotification: (msg: string) => void;
  onNavigateTab?: (tab: any) => void;
}

export const AdminView: React.FC<AdminViewProps> = ({
  initialSection = 'dashboard',
  onSuccessNotification,
  onNavigateTab,
}) => {
  const { user: currentUser, token } = useAuth();
  const [activeSection, setActiveSection] = useState<'dashboard' | 'users' | 'logs' | 'settings'>(initialSection);

  useEffect(() => {
    setActiveSection(initialSection);
  }, [initialSection]);

  const [users, setUsers] = useState<ManagedUser[]>([]);
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [settings, setSettings] = useState<SystemSettings>({
    appName: 'HisabFlow',
    maintenanceMode: false,
    allowUserRegistration: true,
    defaultCurrency: 'BDT',
    sessionTimeoutHours: 720,
    auditLoggingEnabled: true,
    updatedAt: new Date().toISOString(),
  });

  const [isLoading, setIsLoading] = useState(true);
  const [isSavingSettings, setIsSavingSettings] = useState(false);
  const [userSearchQuery, setUserSearchQuery] = useState('');
  const [logSearchQuery, setLogSearchQuery] = useState('');

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

  const fetchAdminData = async () => {
    if (!token) return;
    setIsLoading(true);
    try {
      const [usersRes, statsRes, logsRes, settingsRes] = await Promise.all([
        fetch('/api/admin/users', { headers: { Authorization: `Bearer ${token}` } }),
        fetch('/api/admin/stats', { headers: { Authorization: `Bearer ${token}` } }),
        fetch('/api/admin/audit-logs', { headers: { Authorization: `Bearer ${token}` } }),
        fetch('/api/admin/settings', { headers: { Authorization: `Bearer ${token}` } }),
      ]);

      if (usersRes.ok) {
        const uData = await usersRes.json();
        setUsers(uData.users || []);
      }
      if (statsRes.ok) {
        const sData = await statsRes.json();
        setStats(sData);
      }
      if (logsRes.ok) {
        const lData = await logsRes.json();
        setAuditLogs(lData.logs || []);
      }
      if (settingsRes.ok) {
        const cfgData = await settingsRes.json();
        if (cfgData.settings) {
          setSettings(cfgData.settings);
        }
      }
    } catch (err) {
      console.error('Failed to load admin data:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchAdminData();
  }, [token]);

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setIsSubmitting(true);

    try {
      const res = await fetch('/api/admin/users', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
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
        fetchAdminData();
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
      const res = await fetch(`/api/admin/users/${editUser.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
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
        fetchAdminData();
      }
    } catch (err) {
      setFormError('Network error updating user.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleToggleActive = async (userToToggle: ManagedUser) => {
    if (userToToggle.id === currentUser?.id) {
      onSuccessNotification('Safeguard: You cannot deactivate your own administrator account.');
      return;
    }

    try {
      const res = await fetch(`/api/admin/users/${userToToggle.id}/status`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ isActive: !userToToggle.isActive }),
      });

      if (res.ok) {
        onSuccessNotification(`User ${userToToggle.username} status updated.`);
        fetchAdminData();
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
      const res = await fetch(`/api/admin/users/${resetPasswordUser.id}/reset-password`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ newPassword }),
      });

      const data = await res.json();
      if (!res.ok) {
        setFormError(data.error || 'Failed to reset password.');
      } else {
        setResetPasswordUser(null);
        setNewPassword('');
        onSuccessNotification(data.message || 'Password reset successfully.');
      }
    } catch (err) {
      setFormError('Network error resetting password.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteUser = async () => {
    if (!deleteConfirmUser) return;
    if (deleteConfirmUser.id === currentUser?.id) {
      onSuccessNotification('Safeguard: You cannot delete your own active administrator account.');
      setDeleteConfirmUser(null);
      return;
    }

    try {
      const res = await fetch(`/api/admin/users/${deleteConfirmUser.id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });

      if (res.ok) {
        onSuccessNotification(`User ${deleteConfirmUser.username} removed.`);
        setDeleteConfirmUser(null);
        fetchAdminData();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingSettings(true);
    try {
      const res = await fetch('/api/admin/settings', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(settings),
      });

      if (res.ok) {
        onSuccessNotification('System settings saved successfully.');
        fetchAdminData();
      }
    } catch (err) {
      console.error('Failed to save settings:', err);
    } finally {
      setIsSavingSettings(false);
    }
  };

  const filteredUsers = users.filter((u) => {
    const q = userSearchQuery.toLowerCase();
    return (
      u.fullName.toLowerCase().includes(q) ||
      u.username.toLowerCase().includes(q) ||
      u.email.toLowerCase().includes(q) ||
      u.role.toLowerCase().includes(q)
    );
  });

  const filteredLogs = auditLogs.filter((log) => {
    const q = logSearchQuery.toLowerCase();
    return (
      log.action.toLowerCase().includes(q) ||
      (log.userEmail && log.userEmail.toLowerCase().includes(q)) ||
      (log.details && log.details.toLowerCase().includes(q)) ||
      (log.ipAddress && log.ipAddress.toLowerCase().includes(q))
    );
  });

  const activeCount = users.filter((u) => u.isActive).length;
  const deactivatedCount = users.filter((u) => !u.isActive).length;

  return (
    <div className="space-y-4">
      {/* Admin Section Tabs */}
      <div className="flex border-b border-[#22252c] gap-1 pb-px overflow-x-auto">
        <button
          onClick={() => {
            setActiveSection('dashboard');
            if (onNavigateTab) onNavigateTab('admin-dashboard');
          }}
          className={`flex items-center gap-2 px-3 py-2 text-xs font-medium border-b-2 transition-colors whitespace-nowrap ${
            activeSection === 'dashboard'
              ? 'text-purple-400 border-purple-500 bg-[#16181d]'
              : 'text-gray-400 border-transparent hover:text-gray-200 hover:bg-[#14161c]'
          }`}
        >
          <Activity className="w-3.5 h-3.5" />
          <span>System Dashboard</span>
        </button>

        <button
          onClick={() => {
            setActiveSection('users');
            if (onNavigateTab) onNavigateTab('admin-users');
          }}
          className={`flex items-center gap-2 px-3 py-2 text-xs font-medium border-b-2 transition-colors whitespace-nowrap ${
            activeSection === 'users'
              ? 'text-purple-400 border-purple-500 bg-[#16181d]'
              : 'text-gray-400 border-transparent hover:text-gray-200 hover:bg-[#14161c]'
          }`}
        >
          <Users className="w-3.5 h-3.5" />
          <span>User Management</span>
          <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-[#22252e] text-gray-300">
            {users.length}
          </span>
        </button>

        <button
          onClick={() => {
            setActiveSection('logs');
            if (onNavigateTab) onNavigateTab('admin-logs');
          }}
          className={`flex items-center gap-2 px-3 py-2 text-xs font-medium border-b-2 transition-colors whitespace-nowrap ${
            activeSection === 'logs'
              ? 'text-purple-400 border-purple-500 bg-[#16181d]'
              : 'text-gray-400 border-transparent hover:text-gray-200 hover:bg-[#14161c]'
          }`}
        >
          <FileText className="w-3.5 h-3.5" />
          <span>Audit & Security Logs</span>
        </button>

        <button
          onClick={() => {
            setActiveSection('settings');
            if (onNavigateTab) onNavigateTab('admin-settings');
          }}
          className={`flex items-center gap-2 px-3 py-2 text-xs font-medium border-b-2 transition-colors whitespace-nowrap ${
            activeSection === 'settings'
              ? 'text-purple-400 border-purple-500 bg-[#16181d]'
              : 'text-gray-400 border-transparent hover:text-gray-200 hover:bg-[#14161c]'
          }`}
        >
          <Sliders className="w-3.5 h-3.5" />
          <span>System Settings</span>
        </button>

        <div className="ml-auto flex items-center pr-1">
          <button
            onClick={fetchAdminData}
            disabled={isLoading}
            className="px-2.5 py-1 text-xs text-gray-400 hover:text-white bg-[#171a20] hover:bg-[#20242e] border border-[#2b2f3a] rounded flex items-center gap-1.5 transition-colors"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* ========================================================= */}
      {/* 1. SYSTEM DASHBOARD & HEALTH                              */}
      {/* ========================================================= */}
      {activeSection === 'dashboard' && (
        <div className="space-y-4">
          {/* Key Metrics */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="bg-[#16181d] border border-[#22252c] rounded p-3">
              <div className="flex items-center justify-between text-xs text-gray-400">
                <span>Total Users</span>
                <Users className="w-4 h-4 text-gray-500" />
              </div>
              <div className="text-xl font-bold font-mono text-gray-100 mt-1">
                {stats?.totalUsers ?? users.length}
              </div>
              <div className="text-[11px] text-gray-400 mt-1">
                {activeCount} active · {deactivatedCount} deactivated
              </div>
            </div>

            <div className="bg-[#16181d] border border-[#22252c] rounded p-3">
              <div className="flex items-center justify-between text-xs text-gray-400">
                <span>Administrators</span>
                <Shield className="w-4 h-4 text-purple-400" />
              </div>
              <div className="text-xl font-bold font-mono text-purple-400 mt-1">
                {stats?.adminCount ?? users.filter((u) => u.role === 'ADMIN').length}
              </div>
              <div className="text-[11px] text-gray-400 mt-1">
                Strict administrative privileges
              </div>
            </div>

            <div className="bg-[#16181d] border border-[#22252c] rounded p-3">
              <div className="flex items-center justify-between text-xs text-gray-400">
                <span>Database Engine</span>
                <Database className="w-4 h-4 text-emerald-400" />
              </div>
              <div className="text-sm font-semibold text-emerald-400 mt-1 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                <span>{stats?.status?.connectedToNeon ? 'Neon PostgreSQL' : 'Local Storage'}</span>
              </div>
              <div className="text-[11px] text-gray-400 mt-1">
                {stats?.status?.connectedToNeon ? 'Cloud Connection Active' : 'Fallback File Mode'}
              </div>
            </div>

            <div className="bg-[#16181d] border border-[#22252c] rounded p-3">
              <div className="flex items-center justify-between text-xs text-gray-400">
                <span>Security Events</span>
                <FileText className="w-4 h-4 text-blue-400" />
              </div>
              <div className="text-xl font-bold font-mono text-blue-400 mt-1">
                {auditLogs.length}
              </div>
              <div className="text-[11px] text-gray-400 mt-1">
                Recorded security audit actions
              </div>
            </div>
          </div>

          {/* System Health & Architecture Status */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="bg-[#16181d] border border-[#22252c] rounded p-4 space-y-3">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-300 flex items-center gap-2">
                <Server className="w-4 h-4 text-blue-400" />
                Application Health & Environment
              </h3>
              <div className="space-y-2 text-xs">
                <div className="flex items-center justify-between py-1.5 border-b border-[#20232a]">
                  <span className="text-gray-400">System Status</span>
                  <span className="text-emerald-400 font-medium flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    Operational
                  </span>
                </div>
                <div className="flex items-center justify-between py-1.5 border-b border-[#20232a]">
                  <span className="text-gray-400">Application Name</span>
                  <span className="text-gray-200 font-medium">{settings.appName}</span>
                </div>
                <div className="flex items-center justify-between py-1.5 border-b border-[#20232a]">
                  <span className="text-gray-400">Server Architecture</span>
                  <span className="text-gray-200 font-mono">Express.js REST API</span>
                </div>
                <div className="flex items-center justify-between py-1.5 border-b border-[#20232a]">
                  <span className="text-gray-400">Maintenance Mode</span>
                  <span className={`font-medium ${settings.maintenanceMode ? 'text-amber-400' : 'text-gray-300'}`}>
                    {settings.maintenanceMode ? 'Enabled' : 'Disabled'}
                  </span>
                </div>
                <div className="flex items-center justify-between py-1.5">
                  <span className="text-gray-400">Public User Registration</span>
                  <span className={`font-medium ${settings.allowUserRegistration ? 'text-emerald-400' : 'text-red-400'}`}>
                    {settings.allowUserRegistration ? 'Allowed' : 'Disabled'}
                  </span>
                </div>
              </div>
            </div>

            <div className="bg-[#16181d] border border-[#22252c] rounded p-4 space-y-3">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-300 flex items-center gap-2">
                <Shield className="w-4 h-4 text-purple-400" />
                Role & Security Boundary Policy
              </h3>
              <div className="space-y-2 text-xs text-gray-300">
                <div className="p-2.5 rounded bg-[#101216] border border-[#22252c]">
                  <p className="font-semibold text-purple-300 mb-0.5">Strict Admin Separation</p>
                  <p className="text-gray-400 leading-relaxed text-[11px]">
                    System Administrators manage software configuration, security audit logs, and user access.
                    Administrators have no personal financial accounts and cannot view or manipulate users&apos; private balances or transactions.
                  </p>
                </div>
                <div className="flex items-center justify-between py-1.5 border-b border-[#20232a]">
                  <span className="text-gray-400">Default Currency</span>
                  <span className="font-mono text-gray-200">{settings.defaultCurrency}</span>
                </div>
                <div className="flex items-center justify-between py-1.5">
                  <span className="text-gray-400">Session Validity</span>
                  <span className="font-mono text-gray-200">{settings.sessionTimeoutHours} Hours</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* 2. USER MANAGEMENT                                        */}
      {/* ========================================================= */}
      {activeSection === 'users' && (
        <div className="space-y-3">
          {/* Toolbar */}
          <div className="bg-[#16181d] border border-[#22252c] rounded p-2.5 flex flex-col md:flex-row items-center justify-between gap-2.5">
            <div className="relative w-full md:w-72">
              <Search className="w-3.5 h-3.5 text-gray-500 absolute left-2.5 top-2.5" />
              <input
                type="text"
                value={userSearchQuery}
                onChange={(e) => setUserSearchQuery(e.target.value)}
                placeholder="Search users by name, username, or email..."
                className="w-full bg-[#111317] border border-[#262932] rounded pl-8 pr-3 py-1.5 text-xs text-gray-200 focus:outline-none focus:border-blue-500"
              />
            </div>

            <div className="flex items-center gap-3 w-full md:w-auto justify-between md:justify-end">
              <span className="text-xs text-gray-400">
                {filteredUsers.length} of {users.length} users
              </span>
              <button
                onClick={() => setIsCreateModalOpen(true)}
                className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-xs text-white font-medium rounded flex items-center gap-1.5 transition-colors"
              >
                <UserPlus className="w-3.5 h-3.5" />
                <span>Create User</span>
              </button>
            </div>
          </div>

          {/* Users Table */}
          <div className="bg-[#16181d] border border-[#22252c] rounded overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-[#22252c] bg-[#121417] text-gray-400 uppercase tracking-wider text-[10px]">
                    <th className="py-2.5 px-3">User</th>
                    <th className="py-2.5 px-3">Email</th>
                    <th className="py-2.5 px-3">Role</th>
                    <th className="py-2.5 px-3">Status</th>
                    <th className="py-2.5 px-3">Currency</th>
                    <th className="py-2.5 px-3">Created</th>
                    <th className="py-2.5 px-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#20232a]">
                  {filteredUsers.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="text-center py-8 text-gray-500">
                        No users matching criteria.
                      </td>
                    </tr>
                  ) : (
                    filteredUsers.map((u) => {
                      const isCurrent = u.id === currentUser?.id;
                      return (
                        <tr key={u.id} className="hover:bg-[#1a1d24] transition-colors">
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
                            {u.createdAt ? new Date(u.createdAt).toLocaleDateString() : '-'}
                          </td>
                          <td className="py-2.5 px-3 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              <button
                                onClick={() => {
                                  setEditUser(u);
                                  setFormError(null);
                                }}
                                title="Edit User"
                                className="p-1 text-gray-400 hover:text-gray-200 hover:bg-[#22252e] rounded"
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
                                className="p-1 text-gray-400 hover:text-blue-400 hover:bg-[#22252e] rounded"
                              >
                                <KeyRound className="w-3.5 h-3.5" />
                              </button>
                              {!isCurrent && (
                                <button
                                  onClick={() => setDeleteConfirmUser(u)}
                                  title="Delete User"
                                  className="p-1 text-gray-400 hover:text-red-400 hover:bg-[#22252e] rounded"
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
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* 3. AUDIT & SECURITY LOGS                                  */}
      {/* ========================================================= */}
      {activeSection === 'logs' && (
        <div className="space-y-3">
          {/* Toolbar */}
          <div className="bg-[#16181d] border border-[#22252c] rounded p-2.5 flex flex-col md:flex-row items-center justify-between gap-2.5">
            <div className="relative w-full md:w-80">
              <Search className="w-3.5 h-3.5 text-gray-500 absolute left-2.5 top-2.5" />
              <input
                type="text"
                value={logSearchQuery}
                onChange={(e) => setLogSearchQuery(e.target.value)}
                placeholder="Search audit logs by action, user, or IP..."
                className="w-full bg-[#111317] border border-[#262932] rounded pl-8 pr-3 py-1.5 text-xs text-gray-200 focus:outline-none focus:border-blue-500"
              />
            </div>

            <div className="text-xs text-gray-400">
              Showing {filteredLogs.length} events
            </div>
          </div>

          {/* Audit Logs Table */}
          <div className="bg-[#16181d] border border-[#22252c] rounded overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-[#22252c] bg-[#121417] text-gray-400 uppercase tracking-wider text-[10px]">
                    <th className="py-2.5 px-3">Timestamp</th>
                    <th className="py-2.5 px-3">Action</th>
                    <th className="py-2.5 px-3">User / Actor</th>
                    <th className="py-2.5 px-3">Entity</th>
                    <th className="py-2.5 px-3">Details</th>
                    <th className="py-2.5 px-3">IP Address</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#20232a]">
                  {filteredLogs.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="text-center py-8 text-gray-500">
                        No security audit logs recorded yet.
                      </td>
                    </tr>
                  ) : (
                    filteredLogs.map((log) => (
                      <tr key={log.id} className="hover:bg-[#1a1d24] transition-colors">
                        <td className="py-2.5 px-3 font-mono text-[11px] text-gray-400 whitespace-nowrap">
                          {new Date(log.createdAt).toLocaleString()}
                        </td>
                        <td className="py-2.5 px-3">
                          <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-mono font-medium ${
                            log.action === 'LOGIN'
                              ? 'bg-blue-950/70 text-blue-300 border border-blue-800/60'
                              : log.action.includes('USER')
                              ? 'bg-purple-950/70 text-purple-300 border border-purple-800/60'
                              : 'bg-gray-800 text-gray-300 border border-gray-700'
                          }`}>
                            {log.action}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-gray-200">
                          {log.userEmail || log.userId}
                        </td>
                        <td className="py-2.5 px-3 text-gray-400 font-mono text-[11px]">
                          {log.entityType}
                        </td>
                        <td className="py-2.5 px-3 text-gray-300">
                          {log.details || '-'}
                        </td>
                        <td className="py-2.5 px-3 text-gray-400 font-mono text-[11px]">
                          {log.ipAddress || '-'}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* 4. SYSTEM SETTINGS                                        */}
      {/* ========================================================= */}
      {activeSection === 'settings' && (
        <form onSubmit={handleSaveSettings} className="space-y-4 max-w-2xl">
          <div className="bg-[#16181d] border border-[#22252c] rounded p-4 space-y-4">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-300 flex items-center gap-2">
              <Sliders className="w-4 h-4 text-purple-400" />
              Global System Configuration
            </h3>

            <div>
              <label className="block text-xs font-medium text-gray-300 mb-1">
                Application Name
              </label>
              <input
                type="text"
                value={settings.appName}
                onChange={(e) => setSettings({ ...settings, appName: e.target.value })}
                className="w-full bg-[#111317] border border-[#262932] rounded px-3 py-1.5 text-xs text-white focus:outline-none focus:border-blue-500"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-[#22252c]">
              <div>
                <label className="block text-xs font-medium text-gray-300 mb-1">
                  Default Currency
                </label>
                <select
                  value={settings.defaultCurrency}
                  onChange={(e) => setSettings({ ...settings, defaultCurrency: e.target.value })}
                  className="w-full bg-[#111317] border border-[#262932] rounded px-3 py-1.5 text-xs text-white focus:outline-none focus:border-blue-500"
                >
                  <option value="BDT">BDT (৳)</option>
                  <option value="USD">USD ($)</option>
                  <option value="EUR">EUR (€)</option>
                  <option value="GBP">GBP (£)</option>
                  <option value="INR">INR (₹)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-300 mb-1">
                  Session Validity (Hours)
                </label>
                <input
                  type="number"
                  min="1"
                  max="8760"
                  value={settings.sessionTimeoutHours}
                  onChange={(e) => setSettings({ ...settings, sessionTimeoutHours: Number(e.target.value) })}
                  className="w-full bg-[#111317] border border-[#262932] rounded px-3 py-1.5 text-xs text-white focus:outline-none focus:border-blue-500"
                />
              </div>
            </div>

            <div className="space-y-3 pt-3 border-t border-[#22252c]">
              <label className="flex items-center justify-between p-2.5 rounded bg-[#111317] border border-[#22252c] cursor-pointer hover:bg-[#14161c]">
                <div>
                  <div className="text-xs font-medium text-gray-200">Public User Registration</div>
                  <div className="text-[11px] text-gray-400">Allow new visitors to self-register accounts</div>
                </div>
                <input
                  type="checkbox"
                  checked={settings.allowUserRegistration}
                  onChange={(e) => setSettings({ ...settings, allowUserRegistration: e.target.checked })}
                  className="w-4 h-4 rounded text-blue-600 focus:ring-0 bg-[#1e2129] border-[#2b2f3a]"
                />
              </label>

              <label className="flex items-center justify-between p-2.5 rounded bg-[#111317] border border-[#22252c] cursor-pointer hover:bg-[#14161c]">
                <div>
                  <div className="text-xs font-medium text-gray-200">Maintenance Mode</div>
                  <div className="text-[11px] text-gray-400">Display maintenance advisory to non-admin users</div>
                </div>
                <input
                  type="checkbox"
                  checked={settings.maintenanceMode}
                  onChange={(e) => setSettings({ ...settings, maintenanceMode: e.target.checked })}
                  className="w-4 h-4 rounded text-blue-600 focus:ring-0 bg-[#1e2129] border-[#2b2f3a]"
                />
              </label>

              <label className="flex items-center justify-between p-2.5 rounded bg-[#111317] border border-[#22252c] cursor-pointer hover:bg-[#14161c]">
                <div>
                  <div className="text-xs font-medium text-gray-200">Security Audit Logging</div>
                  <div className="text-[11px] text-gray-400">Log all logins, password updates, and account edits</div>
                </div>
                <input
                  type="checkbox"
                  checked={settings.auditLoggingEnabled}
                  onChange={(e) => setSettings({ ...settings, auditLoggingEnabled: e.target.checked })}
                  className="w-4 h-4 rounded text-blue-600 focus:ring-0 bg-[#1e2129] border-[#2b2f3a]"
                />
              </label>
            </div>
          </div>

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={isSavingSettings}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-xs font-semibold text-white rounded transition-colors"
            >
              {isSavingSettings ? 'Saving...' : 'Save Settings'}
            </button>
          </div>
        </form>
      )}

      {/* ========================================================= */}
      {/* MODALS: CREATE, EDIT, RESET PASSWORD, DELETE             */}
      {/* ========================================================= */}
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
              placeholder="e.g. Mahbub Alam"
              className="w-full bg-[#1b1e25] border border-[#2b2f3a] rounded px-3 py-1.5 text-xs text-white focus:outline-none focus:border-blue-500"
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
                placeholder="e.g. mahbub"
                className="w-full bg-[#1b1e25] border border-[#2b2f3a] rounded px-3 py-1.5 text-xs text-white focus:outline-none focus:border-blue-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-300 mb-1">Role *</label>
              <select
                value={createForm.role}
                onChange={(e) => setCreateForm({ ...createForm, role: e.target.value as 'ADMIN' | 'USER' })}
                className="w-full bg-[#1b1e25] border border-[#2b2f3a] rounded px-3 py-1.5 text-xs text-white focus:outline-none focus:border-blue-500"
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
              placeholder="e.g. user@hisabflow.com"
              className="w-full bg-[#1b1e25] border border-[#2b2f3a] rounded px-3 py-1.5 text-xs text-white focus:outline-none focus:border-blue-500"
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
              className="w-full bg-[#1b1e25] border border-[#2b2f3a] rounded px-3 py-1.5 text-xs text-white focus:outline-none focus:border-blue-500"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-300 mb-1">Currency</label>
            <select
              value={createForm.currency}
              onChange={(e) => setCreateForm({ ...createForm, currency: e.target.value })}
              className="w-full bg-[#1b1e25] border border-[#2b2f3a] rounded px-3 py-1.5 text-xs text-white focus:outline-none focus:border-blue-500"
            >
              <option value="BDT">BDT (৳)</option>
              <option value="USD">USD ($)</option>
              <option value="EUR">EUR (€)</option>
              <option value="GBP">GBP (£)</option>
              <option value="INR">INR (₹)</option>
            </select>
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-[#22252c]">
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
                className="w-full bg-[#1b1e25] border border-[#2b2f3a] rounded px-3 py-1.5 text-xs text-white focus:outline-none focus:border-blue-500"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-300 mb-1">Email</label>
              <input
                type="email"
                required
                value={editUser.email}
                onChange={(e) => setEditUser({ ...editUser, email: e.target.value })}
                className="w-full bg-[#1b1e25] border border-[#2b2f3a] rounded px-3 py-1.5 text-xs text-white focus:outline-none focus:border-blue-500"
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-xs font-medium text-gray-300 mb-1">Role</label>
                <select
                  value={editUser.role}
                  disabled={editUser.id === currentUser?.id}
                  onChange={(e) => setEditUser({ ...editUser, role: e.target.value as 'ADMIN' | 'USER' })}
                  className="w-full bg-[#1b1e25] border border-[#2b2f3a] rounded px-3 py-1.5 text-xs text-white focus:outline-none focus:border-blue-500 disabled:opacity-60"
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
                  className="w-full bg-[#1b1e25] border border-[#2b2f3a] rounded px-3 py-1.5 text-xs text-white focus:outline-none focus:border-blue-500"
                >
                  <option value="BDT">BDT (৳)</option>
                  <option value="USD">USD ($)</option>
                  <option value="EUR">EUR (€)</option>
                  <option value="GBP">GBP (£)</option>
                  <option value="INR">INR (₹)</option>
                </select>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-[#22252c]">
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
                className="w-full bg-[#1b1e25] border border-[#2b2f3a] rounded px-3 py-1.5 text-xs text-white focus:outline-none focus:border-blue-500"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-[#22252c]">
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
    </div>
  );
};
