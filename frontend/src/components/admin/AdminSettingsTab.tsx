import { CURRENCY_SYMBOLS } from '../../lib/formatters';
import React, { useState } from 'react';
import { useFinance } from '../../context/FinanceContext';
import { SystemSettings } from './types';

interface AdminSettingsTabProps {
  settings: SystemSettings;
  setSettings: React.Dispatch<React.SetStateAction<SystemSettings | null>>;
  onSuccessNotification: (msg: string) => void;
}

export const AdminSettingsTab: React.FC<AdminSettingsTabProps> = ({ settings, setSettings, onSuccessNotification }) => {
  const { authFetch } = useFinance();
  const [isSavingSettings, setIsSavingSettings] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingSettings(true);
    setSaveError(null);
    try {
      const res = await authFetch(`/api/admin/settings`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          allowUserRegistration: settings.allowUserRegistration,
          defaultCurrency: settings.defaultCurrency,
        }),
      });

      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        if (data.settings) setSettings(data.settings);
        onSuccessNotification('System settings saved successfully.');
      } else {
        setSaveError(data.error || 'Could not save the settings.');
      }
    } catch (err) {
      console.error('Error saving settings:', err);
      setSaveError('Could not save the settings. Check your connection and try again.');
    } finally {
      setIsSavingSettings(false);
    }
  };

  return (
    <form onSubmit={handleSaveSettings} className="space-y-3 w-full max-w-2xl min-w-0 overflow-y-auto flex-1 min-h-0">
      {saveError && (
        <div role="alert" className="p-2.5 rounded bg-red-950/40 border border-red-800/60 text-xs text-red-300">
          {saveError}
        </div>
      )}

      <div className="bg-surface border border-line rounded p-4 space-y-4">
        <label className="flex items-center justify-between gap-4 cursor-pointer">
          <span>
            <span className="block text-xs font-medium text-gray-200">Public registration</span>
            <span className="block text-[11px] text-gray-400 mt-0.5">
              When off, new people can't create an account, including with Google. Existing users can still sign in.
            </span>
          </span>
          <input
            type="checkbox"
            checked={settings.allowUserRegistration}
            onChange={(e) => setSettings({ ...settings, allowUserRegistration: e.target.checked })}
            className="w-4 h-4 flex-shrink-0 rounded text-blue-600 focus:ring-0 bg-surface-raised border-field-line"
          />
        </label>

        <div className="pt-4 border-t border-line">
          <label htmlFor="admin-default-currency" className="block text-xs font-medium text-gray-300 mb-1">
            Currency for new users
          </label>
          <select
            id="admin-default-currency"
            value={settings.defaultCurrency}
            onChange={(e) => setSettings({ ...settings, defaultCurrency: e.target.value })}
            className="w-full sm:w-56 bg-app border border-line-strong rounded px-3 py-1.5 text-xs text-ink focus:outline-none focus:border-blue-500"
          >
            {Object.entries(CURRENCY_SYMBOLS).map(([code, symbol]) => (
              <option key={code} value={code}>{code} ({symbol})</option>
            ))}
          </select>
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
  );
};
