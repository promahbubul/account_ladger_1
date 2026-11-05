import React from 'react';
import { Shield, Server, Database, Users, CheckCircle2 } from 'lucide-react';
import { AdminStats } from './types';

export const AdminDashboardTab: React.FC<{ stats: AdminStats | null }> = ({ stats }) => (
  <>
    <div className="space-y-4 overflow-y-auto flex-1 min-h-0">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="bg-surface border border-line rounded p-3">
          <div className="flex items-center justify-between text-xs text-gray-400">
            <span>Total Users</span>
            <Users className="w-4 h-4 text-gray-500" />
          </div>
          <div className="text-xl font-bold font-mono text-gray-100 mt-1">
            {stats?.totalUsers ?? '-'}
          </div>
        </div>

        <div className="bg-surface border border-line rounded p-3">
          <div className="flex items-center justify-between text-xs text-gray-400">
            <span>Active Accounts</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
          </div>
          <div className="text-xl font-bold font-mono text-emerald-400 mt-1">
            {stats?.activeUsers ?? '-'}
          </div>
        </div>

        <div className="bg-surface border border-line rounded p-3">
          <div className="flex items-center justify-between text-xs text-gray-400">
            <span>System Admins</span>
            <Shield className="w-4 h-4 text-purple-400" />
          </div>
          <div className="text-xl font-bold font-mono text-purple-400 mt-1">
            {stats?.adminCount ?? '-'}
          </div>
        </div>

        <div className="bg-surface border border-line rounded p-3">
          <div className="flex items-center justify-between text-xs text-gray-400">
            <span>Database Engine</span>
            <Database className="w-4 h-4 text-blue-400" />
          </div>
          <div className="text-sm font-semibold font-mono text-gray-200 mt-1">
            {stats?.status?.connectedToNeon ? 'PostgreSQL (Neon)' : 'Local Persistent'}
          </div>
        </div>
      </div>

      <div className="bg-surface border border-line rounded p-4">
        <h3 className="text-xs font-semibold text-gray-300 uppercase tracking-wider mb-2 flex items-center gap-1.5">
          <Server className="w-4 h-4 text-blue-400" />
          <span>Storage Architecture</span>
        </h3>
        <div className="text-xs text-gray-400 space-y-1">
          <p>Connection: <strong className="text-gray-200">{stats?.status?.connectedToNeon ? 'Neon Serverless Cloud Connected' : 'Local Fallback'}</strong></p>
          <p>Storage File: <span className="font-mono text-gray-300">{stats?.status?.storageFile || 'accountladger_db.json'}</span></p>
          <p>Total Ledger Rows in DB: <strong className="text-gray-200">{stats?.status?.transactionCount ?? 0}</strong></p>
        </div>
      </div>
    </div>
  </>
);
