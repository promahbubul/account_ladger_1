import React, { useState } from 'react';
import { Loader2 } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { Link } from '../../lib/router';

const Row: React.FC<{ label: string; value?: string }> = ({ label, value }) => (
  <div className="flex items-center justify-between gap-4 py-2.5 text-xs">
    <span className="text-gray-400">{label}</span>
    <span className="text-gray-200 truncate">{value || '-'}</span>
  </div>
);

export const ProfileView: React.FC = () => {
  const { user, updateProfile, logout } = useAuth();
  const toast = useToast();
  const [fullName, setFullName] = useState(user?.fullName || '');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (saving) return;
    setError('');
    setSaving(true);
    const res = await updateProfile({ fullName: fullName.trim() });
    setSaving(false);
    if (!res.success) {
      setError(res.error || 'Could not save your name.');
      return;
    }
    toast.success('Profile updated.');
  };

  return (
    <div className="max-w-xl space-y-3 w-full min-w-0">
      <form onSubmit={handleSave} className="bg-surface border border-line rounded p-3.5 space-y-3">
        {error && <div className="p-2.5 rounded bg-red-950/40 border border-red-800/60 text-xs text-red-200">{error}</div>}
        <div>
          <label htmlFor="profile-name" className="block text-xs text-gray-300 font-medium mb-1">Full Name</label>
          <input
            id="profile-name"
            type="text"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            className="w-full bg-app border border-line-strong rounded px-3 py-1.5 text-xs text-gray-200 focus:outline-none focus:border-blue-500"
          />
        </div>
        <button
          type="submit"
          disabled={saving || fullName.trim() === (user?.fullName || '')}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded text-xs font-medium"
        >
          {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
          Save
        </button>
      </form>

      <div className="bg-surface border border-line rounded px-3.5 divide-y divide-divider">
        <Row label="Email" value={user?.email} />
        <Row label="Username" value={user?.username} />
        <Row label="Account type" value={user?.role === 'ADMIN' ? 'Admin' : 'User'} />
      </div>

      <div className="flex items-center justify-between text-xs">
        {user?.role === 'ADMIN' ? <span /> : (
          <Link href="/settings" className="text-blue-400 hover:text-blue-300 font-medium">
            Currency, timezone and date format
          </Link>
        )}
        <button type="button" onClick={logout} className="text-red-400 hover:text-red-300 font-medium">
          Sign out
        </button>
      </div>
    </div>
  );
};
