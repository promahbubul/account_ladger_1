import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useFinance } from '../../context/FinanceContext';
import { RefreshCw } from 'lucide-react';
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
  // Stays empty until loaded, so the form can never save made-up values over the real ones.
  const [settings, setSettings] = useState<SystemSettings | null>(null);
  const [isStatsLoading, setIsStatsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const fetchStatsAndSettings = useCallback(async () => {
    if (!token) return;
    setIsStatsLoading(true);
    setLoadError(null);
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
      if (!statsRes.ok || !settingsRes.ok) {
        setLoadError('Some admin data could not be loaded. Use Refresh to try again.');
      }
    } catch (err) {
      console.error('Failed to load stats/settings:', err);
      setLoadError('Some admin data could not be loaded. Use Refresh to try again.');
    } finally {
      setIsStatsLoading(false);
    }
  }, [token, authFetch]);

  useEffect(() => {
    fetchStatsAndSettings();
  }, [fetchStatsAndSettings]);

  return (
    <div className="h-full flex flex-col min-h-0 w-full min-w-0 space-y-3">
      <div className="flex justify-end flex-shrink-0">
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

      {loadError && (
        <div role="alert" className="p-2.5 rounded bg-red-950/40 border border-red-800/60 text-xs text-red-300 flex-shrink-0">
          {loadError}
        </div>
      )}

      {activeSection === 'dashboard' && (
        <AdminDashboardTab
          stats={stats}
          refreshKey={refreshKey}
          onOpenUsers={() => {
            setActiveSection('users');
            if (onNavigateTab) onNavigateTab('admin-users');
          }}
          onOpenLogs={() => {
            setActiveSection('logs');
            if (onNavigateTab) onNavigateTab('admin-logs');
          }}
        />
      )}
      {activeSection === 'users' && (
        <AdminUsersTab
          refreshKey={refreshKey}
          onUsersChanged={fetchStatsAndSettings}
          onSuccessNotification={onSuccessNotification}
        />
      )}
      {activeSection === 'logs' && <AdminLogsTab refreshKey={refreshKey} />}
      {activeSection === 'settings' &&
        (settings ? (
          <AdminSettingsTab settings={settings} setSettings={setSettings} onSuccessNotification={onSuccessNotification} />
        ) : (
          !loadError && <p className="text-xs text-gray-400">Loading settings...</p>
        ))}
    </div>
  );
};
