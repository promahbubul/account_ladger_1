import { CURRENCY_SYMBOLS } from '../../lib/formatters';
import React, { useState } from 'react';
import { useFinance } from '../../context/FinanceContext';
import { Sliders } from 'lucide-react';
import { SystemSettings } from './types';

interface AdminSettingsTabProps {
  settings: SystemSettings;
  setSettings: React.Dispatch<React.SetStateAction<SystemSettings>>;
  onSuccessNotification: (msg: string) => void;
}

export const AdminSettingsTab: React.FC<AdminSettingsTabProps> = ({ settings, setSettings, onSuccessNotification }) => {
  const { authFetch } = useFinance();
  const [isSavingSettings, setIsSavingSettings] = useState(false);

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingSettings(true);
    try {
      const res = await authFetch(`/api/admin/settings`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(settings),
      });

      if (res.ok) {
        onSuccessNotification('System settings saved successfully.');
      }
    } catch (err) {
      console.error('Error saving settings:', err);
    } finally {
      setIsSavingSettings(false);
    }
  };

  return (
    <>
    <form onSubmit={handleSaveSettings} className="space-y-4 w-full min-w-0 overflow-y-auto flex-1 min-h-0">
      <div className="bg-surface border border-line rounded p-4 space-y-4">
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
            className="w-full bg-app border border-line-strong rounded px-3 py-1.5 text-xs text-white focus:outline-none focus:border-blue-500"
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-line">
          <div>
            <label className="block text-xs font-medium text-gray-300 mb-1">
              Default Currency
            </label>
            <select
              value={settings.defaultCurrency}
              onChange={(e) => setSettings({ ...settings, defaultCurrency: e.target.value })}
              className="w-full bg-app border border-line-strong rounded px-3 py-1.5 text-xs text-white focus:outline-none focus:border-blue-500"
            >
              {Object.entries(CURRENCY_SYMBOLS).map(([code, symbol]) => (
                <option key={code} value={code}>{code} ({symbol})</option>
              ))}
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
              className="w-full bg-app border border-line-strong rounded px-3 py-1.5 text-xs text-white focus:outline-none focus:border-blue-500"
            />
          </div>
        </div>

        <div className="space-y-3 pt-3 border-t border-line">
          <label className="flex items-center justify-between p-2.5 rounded bg-app border border-line cursor-pointer hover:bg-[#14161c]">
            <div>
              <div className="text-xs font-medium text-gray-200">Public User Registration</div>
            </div>
            <input
              type="checkbox"
              checked={settings.allowUserRegistration}
              onChange={(e) => setSettings({ ...settings, allowUserRegistration: e.target.checked })}
              className="w-4 h-4 rounded text-blue-600 focus:ring-0 bg-[#1e2129] border-field-line"
            />
          </label>

          <label className="flex items-center justify-between p-2.5 rounded bg-app border border-line cursor-pointer hover:bg-[#14161c]">
            <div>
              <div className="text-xs font-medium text-gray-200">Maintenance Mode</div>
              <div className="text-[11px] text-gray-400">Display maintenance advisory to non-admin users</div>
            </div>
            <input
              type="checkbox"
              checked={settings.maintenanceMode}
              onChange={(e) => setSettings({ ...settings, maintenanceMode: e.target.checked })}
              className="w-4 h-4 rounded text-blue-600 focus:ring-0 bg-[#1e2129] border-field-line"
            />
          </label>

          <label className="flex items-center justify-between p-2.5 rounded bg-app border border-line cursor-pointer hover:bg-[#14161c]">
            <div>
              <div className="text-xs font-medium text-gray-200">Security Audit Logging</div>
            </div>
            <input
              type="checkbox"
              checked={settings.auditLoggingEnabled}
              onChange={(e) => setSettings({ ...settings, auditLoggingEnabled: e.target.checked })}
              className="w-4 h-4 rounded text-blue-600 focus:ring-0 bg-[#1e2129] border-field-line"
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
    </>
  );
};
