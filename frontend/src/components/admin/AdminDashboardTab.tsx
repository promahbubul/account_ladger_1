import React, { useEffect, useState } from 'react';
import { useFinance } from '../../context/FinanceContext';
import { formatDateTime } from '../../lib/formatters';
import { actionBadgeStyle, actionLabel } from './auditActions';
import { AdminStats, AuditLog } from './types';

const Stat: React.FC<{ label: string; value?: number; onClick?: () => void }> = ({ label, value, onClick }) => {
  const body = (
    <>
      <div className="text-xs text-gray-400">{label}</div>
      <div className="text-xl font-semibold tabular-nums text-gray-100 mt-1">{value ?? '-'}</div>
    </>
  );
  const box = 'bg-surface border border-line rounded p-3 text-left';
  return onClick ? (
    <button type="button" onClick={onClick} className={`${box} hover:bg-surface-hover transition-colors`}>{body}</button>
  ) : (
    <div className={box}>{body}</div>
  );
};

interface AdminDashboardTabProps {
  stats: AdminStats | null;
  refreshKey: number;
  onOpenUsers: () => void;
  onOpenLogs: () => void;
}

export const AdminDashboardTab: React.FC<AdminDashboardTabProps> = ({ stats, refreshKey, onOpenUsers, onOpenLogs }) => {
  const { authFetch } = useFinance();
  const [recent, setRecent] = useState<AuditLog[] | null>(null);
  const [recentFailed, setRecentFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setRecentFailed(false);
    authFetch('/api/admin/audit-logs?limit=10')
      .then(async (res) => {
        if (!res.ok) throw new Error('Failed to load activity');
        const data = await res.json();
        if (!cancelled) setRecent(data.items || []);
      })
      .catch(() => {
        if (!cancelled) setRecentFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, [authFetch, refreshKey]);

  return (
    <div className="space-y-3 overflow-y-auto flex-1 min-h-0">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Stat label="Total users" value={stats?.totalUsers} onClick={onOpenUsers} />
        <Stat label="Active users" value={stats?.activeUsers} />
        <Stat label="New this week" value={stats?.newUsersThisWeek} />
        <Stat label="Admins" value={stats?.adminCount} />
        <Stat label="Email not verified" value={stats?.unverifiedUsers} />
        <Stat label="Transactions" value={stats?.totalTransactions} />
        <Stat label="Accounts" value={stats?.totalAccounts} />
        <div className="bg-surface border border-line rounded p-3">
          <div className="text-xs text-gray-400">Database</div>
          <div className="text-sm font-semibold text-gray-100 mt-1.5">
            {stats ? (stats.databaseConnected ? 'PostgreSQL connected' : 'Local file') : '-'}
          </div>
        </div>
      </div>

      <div className="bg-surface border border-line rounded">
        <div className="flex items-center justify-between px-3 py-2.5 border-b border-line">
          <h3 className="text-xs font-semibold text-gray-200">Recent activity</h3>
          <button type="button" onClick={onOpenLogs} className="text-xs text-blue-400 hover:underline">
            View all
          </button>
        </div>
        {recentFailed ? (
          <p className="px-3 py-4 text-xs text-red-400">Couldn't load recent activity. Use Refresh to try again.</p>
        ) : recent === null ? (
          <p className="px-3 py-4 text-xs text-gray-400">Loading...</p>
        ) : recent.length === 0 ? (
          <p className="px-3 py-4 text-xs text-gray-400">Nothing recorded yet.</p>
        ) : (
          <ul className="divide-y divide-divider">
            {recent.map((log) => (
              <li key={log.id} className="px-3 py-2 text-xs grid grid-cols-[1fr_auto] sm:grid-cols-[10.5rem_11.5rem_minmax(0,1fr)] items-center gap-x-3 gap-y-1">
                <span className="text-[11px] tabular-nums text-gray-400 whitespace-nowrap">{formatDateTime(log.createdAt)}</span>
                <span className="justify-self-end sm:justify-self-start">
                  <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-medium ${actionBadgeStyle(log.action)}`}>
                    {actionLabel(log.action)}
                  </span>
                </span>
                <span className="col-span-2 sm:col-span-1 text-gray-200 break-all">{log.userEmail || '-'}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
};
