import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useFinance } from '../../context/FinanceContext';
import { RefreshCw, Activity, Users, FileText, Sliders } from 'lucide-react';
import { AdminDashboardTab } from './AdminDashboardTab';
import { AdminUsersTab } from './AdminUsersTab';
import { AdminLogsTab } from './AdminLogsTab';
import { AdminSettingsTab } from './AdminSettingsTab';
import { AdminStats, SystemSettings } from './types';
import type { NavTab } from '../layout/Sidebar';

interface AdminViewProps {
  initialSection?: 'dashboard' | 'users' | 'logs' | 'settings';
  onSuccessNotification: (msg: string) => void;
  onNavigateTab?: (tab: NavTab) => void;
}

export const AdminView: React.FC<AdminViewProps> = ({
  initialSection = 'dashboard',
  onSuccessNotification,
  onNavigateTab,
}) => {
  const { token } = useAuth();
  const { authFetch } = useFinance();
  const [activeSection, setActiveSection] = useState<'dashboard' | 'users' | 'logs' | 'settings'>(initialSection);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    setActiveSection(initialSection);
  }, [initialSection]);

  const [stats, setStats] = useState<AdminStats | null>(null);
  const [settings, setSettings] = useState<SystemSettings>({
    appName: 'Account Ledger',
    maintenanceMode: false,
    allowUserRegistration: true,
    defaultCurrency: 'BDT',
    sessionTimeoutHours: 720,
    auditLoggingEnabled: true,
    updatedAt: new Date().toISOString(),
  });
  const [isStatsLoading, setIsStatsLoading] = useState(false);

  const fetchStatsAndSettings = useCallback(async () => {
    if (!token) return;
    setIsStatsLoading(true);
    try {
      const [statsRes, settingsRes] = await Promise.all([
        authFetch(`/api/admin/stats`),
        authFetch(`/api/admin/settings`),
      ]);
      if (statsRes.ok) {
        setStats(await statsRes.json());
      }
      if (settingsRes.ok) {
        const cfgData = await settingsRes.json();
        if (cfgData.settings) setSettings(cfgData.settings);
      }
    } catch (err) {
      console.error('Failed to load stats/settings:', err);
    } finally {
      setIsStatsLoading(false);
    }
  }, [token, authFetch]);

  useEffect(() => {
    fetchStatsAndSettings();
  }, [fetchStatsAndSettings]);

  return (
    <div className="h-full flex flex-col min-h-0 w-full min-w-0 space-y-3">
      {/* Admin Section Tabs */}
      <div className="flex border-b border-line gap-1 pb-px overflow-x-auto flex-shrink-0">
        <button
          onClick={() => {
            setActiveSection('dashboard');
            if (onNavigateTab) onNavigateTab('admin-dashboard');
          }}
          className={`flex items-center gap-2 px-3 py-2 text-xs font-medium border-b-2 transition-colors whitespace-nowrap ${
            activeSection === 'dashboard'
              ? 'text-purple-400 border-purple-500 bg-surface'
              : 'text-gray-400 border-transparent hover:text-gray-200 hover:bg-surface'
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
              ? 'text-purple-400 border-purple-500 bg-surface'
              : 'text-gray-400 border-transparent hover:text-gray-200 hover:bg-surface'
          }`}
        >
          <Users className="w-3.5 h-3.5" />
          <span>User Management</span>
          {stats?.totalUsers !== undefined && (
            <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-line-soft text-gray-300">
              {stats.totalUsers}
            </span>
          )}
        </button>

        <button
          onClick={() => {
            setActiveSection('logs');
            if (onNavigateTab) onNavigateTab('admin-logs');
          }}
          className={`flex items-center gap-2 px-3 py-2 text-xs font-medium border-b-2 transition-colors whitespace-nowrap ${
            activeSection === 'logs'
              ? 'text-purple-400 border-purple-500 bg-surface'
              : 'text-gray-400 border-transparent hover:text-gray-200 hover:bg-surface'
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
              ? 'text-purple-400 border-purple-500 bg-surface'
              : 'text-gray-400 border-transparent hover:text-gray-200 hover:bg-surface'
          }`}
        >
          <Sliders className="w-3.5 h-3.5" />
          <span>System Settings</span>
        </button>

        <div className="ml-auto flex items-center pr-1">
          <button
            onClick={() => {
              fetchStatsAndSettings();
              setRefreshKey((key) => key + 1);
            }}
            disabled={isStatsLoading}
            className="px-2.5 py-1 text-xs text-gray-400 hover:text-ink bg-surface-hover hover:bg-surface-raised border border-field-line rounded flex items-center gap-1.5 transition-colors"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isStatsLoading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {activeSection === 'dashboard' && <AdminDashboardTab stats={stats} />}
      {activeSection === 'users' && (
        <AdminUsersTab
          refreshKey={refreshKey}
          onUsersChanged={fetchStatsAndSettings}
          onSuccessNotification={onSuccessNotification}
        />
      )}
      {activeSection === 'logs' && <AdminLogsTab refreshKey={refreshKey} />}
      {activeSection === 'settings' && (
        <AdminSettingsTab settings={settings} setSettings={setSettings} onSuccessNotification={onSuccessNotification} />
      )}
    </div>
  );
};
