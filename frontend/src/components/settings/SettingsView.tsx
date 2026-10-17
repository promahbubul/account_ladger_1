import React, { useState, useEffect } from 'react';
import {
  Download,
  Upload,
  RefreshCw,
  Server,
  User,
  Coins,
} from 'lucide-react';
import { useFinance } from '../../context/FinanceContext';
import { useAuth } from '../../context/AuthContext';

export const SettingsView: React.FC = () => {
  const { user, updateProfile } = useAuth();
  const { exportData, importData, refreshData } = useFinance();

  const [selectedCurrency, setSelectedCurrency] = useState(user?.currency || 'BDT');
  const [isSavingCurrency, setIsSavingCurrency] = useState(false);

  useEffect(() => {
    if (user?.currency) {
      setSelectedCurrency(user.currency);
    }
  }, [user?.currency]);

  const [importJsonText, setImportJsonText] = useState('');
  const [importStatus, setImportStatus] = useState<{ success?: boolean; message?: string } | null>(null);

  const handleSaveCurrency = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingCurrency(true);
    const res = await updateProfile({ currency: selectedCurrency });
    setIsSavingCurrency(false);
    if (res.success) {
      await refreshData();
      setImportStatus({ success: true, message: `Currency successfully updated to ${selectedCurrency}.` });
    } else {
      setImportStatus({ success: false, message: res.error || 'Failed to update currency.' });
    }
  };

  const handleDownloadBackup = async () => {
    const jsonStr = await exportData();
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `accountladger_backup_${Date.now()}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleImportSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const parsed = JSON.parse(importJsonText);
      const ok = await importData(parsed);
      if (ok) {
        setImportStatus({ success: true, message: 'Data backup successfully restored.' });
        setImportJsonText('');
      } else {
        setImportStatus({ success: false, message: 'Invalid data format.' });
      }
    } catch (err: any) {
      setImportStatus({ success: false, message: `JSON syntax error: ${err.message}` });
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      const content = event.target?.result as string;
      try {
        const parsed = JSON.parse(content);
        const ok = await importData(parsed);
        if (ok) {
          setImportStatus({ success: true, message: `Backup file "${file.name}" restored.` });
        } else {
          setImportStatus({ success: false, message: 'Invalid file format.' });
        }
      } catch (err: any) {
        setImportStatus({ success: false, message: `Error parsing file: ${err.message}` });
      }
    };
    reader.readAsText(file);
  };

  const handleSyncDatabase = async () => {
    await refreshData();
    setImportStatus({ success: true, message: 'Database state synchronized.' });
  };

  return (
    <div className="space-y-4 w-full min-w-0">
      {/* Status banner */}
      {importStatus && (
        <div
          className={`p-3 rounded text-xs flex items-center justify-between ${
            importStatus.success
              ? 'bg-emerald-950/40 border border-emerald-900/60 text-emerald-300'
              : 'bg-red-950/40 border border-red-900/60 text-red-300'
          }`}
        >
          <span>{importStatus.message}</span>
          <button onClick={() => setImportStatus(null)} className="text-gray-400 hover:text-white">
            Dismiss
          </button>
        </div>
      )}

      {/* Database Connection */}
      <div className="bg-[#16181d] border border-[#22252c] rounded p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
        <div className="font-medium text-gray-200 flex items-center gap-2">
          <Server className="w-4 h-4 text-emerald-400" />
          <span>Database Connection</span>
          <span className="px-1.5 py-0.5 rounded text-[10px] bg-emerald-950 text-emerald-300 border border-emerald-800">
            Active
          </span>
        </div>
        <button
          onClick={handleSyncDatabase}
          className="px-3 py-1.5 bg-[#1b1e25] hover:bg-[#232833] border border-[#2c313e] text-xs text-gray-200 rounded flex items-center gap-1.5 transition-colors self-start sm:self-auto"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          <span>Sync State</span>
        </button>
      </div>

      {/* User Profile */}
      <div className="bg-[#16181d] border border-[#22252c] rounded p-3.5 flex items-center justify-between text-xs">
        <div className="space-y-0.5">
          <div className="font-medium text-gray-200 flex items-center gap-2">
            <User className="w-4 h-4 text-gray-400" />
            <span>{user?.fullName} (@{user?.username})</span>
            <span
              className={`px-1.5 py-0.5 rounded text-[10px] border ${
                user?.role === 'ADMIN'
                  ? 'bg-purple-950 text-purple-300 border-purple-800'
                  : 'bg-gray-800 text-gray-300 border-gray-700'
              }`}
            >
              {user?.role}
            </span>
          </div>
          <div className="text-gray-400 text-[11px]">{user?.email}</div>
        </div>
        <div className="text-xs font-mono text-gray-400">
          {user?.currency || 'BDT'}
        </div>
      </div>

      {/* Currency & Preferences */}
      <div className="bg-[#16181d] border border-[#22252c] rounded p-3.5 space-y-3 text-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div className="font-medium text-gray-200 flex items-center gap-2">
            <Coins className="w-4 h-4 text-amber-400" />
            <span>Currency & Preferences</span>
          </div>
          <span className="px-2 py-0.5 rounded text-[11px] font-mono bg-[#1b1e25] text-amber-300 border border-[#2b2f3a] self-start sm:self-auto">
            Current: {user?.currency || 'BDT'}
          </span>
        </div>

        <form onSubmit={handleSaveCurrency} className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 pt-1">
          <select
            value={selectedCurrency}
            onChange={(e) => setSelectedCurrency(e.target.value)}
            className="flex-1 bg-[#111317] border border-[#262932] rounded px-3 py-1.5 text-xs text-white focus:outline-none focus:border-blue-500 transition-colors"
          >
            <option value="BDT">BDT (৳) - Bangladeshi Taka (Default)</option>
            <option value="USD">USD ($) - US Dollar</option>
            <option value="EUR">EUR (€) - Euro</option>
            <option value="GBP">GBP (£) - British Pound</option>
            <option value="INR">INR (₹) - Indian Rupee</option>
            <option value="SAR">SAR (﷼) - Saudi Riyal</option>
            <option value="AED">AED (د.إ) - UAE Dirham</option>
            <option value="CAD">CAD (C$) - Canadian Dollar</option>
            <option value="JPY">JPY (¥) - Japanese Yen</option>
          </select>
          <button
            type="submit"
            disabled={isSavingCurrency || selectedCurrency === user?.currency}
            className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white rounded text-xs font-medium transition-colors"
          >
            {isSavingCurrency ? 'Saving...' : 'Save Currency'}
          </button>
        </form>
      </div>

      {/* Backup Export */}
      <div className="bg-[#16181d] border border-[#22252c] rounded p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
        <div className="font-medium text-gray-200">Export Backup</div>
        <button
          onClick={handleDownloadBackup}
          className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded flex items-center gap-1.5 transition-colors self-start sm:self-auto font-medium"
        >
          <Download className="w-3.5 h-3.5" />
          <span>Download Backup</span>
        </button>
      </div>

      {/* Backup Import */}
      <div className="bg-[#16181d] border border-[#22252c] rounded p-3.5 space-y-3 text-xs">
        <div className="font-medium text-gray-200">Restore Backup</div>

        <div className="flex items-center gap-2">
          <label className="cursor-pointer px-3 py-1.5 bg-[#1b1e25] hover:bg-[#232833] border border-[#2c313e] text-gray-200 rounded flex items-center gap-1.5 transition-colors">
            <Upload className="w-3.5 h-3.5" />
            <span>Upload Backup</span>
            <input
              type="file"
              accept=".json"
              onChange={handleFileUpload}
              className="hidden"
            />
          </label>
        </div>

        <form onSubmit={handleImportSubmit} className="space-y-2 pt-2">
          <textarea
            rows={3}
            value={importJsonText}
            onChange={(e) => setImportJsonText(e.target.value)}
            placeholder="Paste backup JSON..."
            className="w-full bg-[#111317] border border-[#262932] rounded p-2 text-xs text-gray-200 font-mono focus:outline-none focus:border-blue-500"
          />
          <div className="flex justify-end">
            <button
              type="submit"
              disabled={!importJsonText.trim()}
              className="px-3 py-1.5 bg-[#1b1e25] hover:bg-[#232833] disabled:opacity-40 border border-[#2c313e] text-gray-200 rounded transition-colors"
            >
              Restore Backup
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
