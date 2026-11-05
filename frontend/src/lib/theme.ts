import { useSyncExternalStore } from 'react';

export type ThemePreference = 'system' | 'light' | 'dark';

const STORAGE_KEY = 'accountledger_theme';
const ORDER: ThemePreference[] = ['system', 'light', 'dark'];
const listeners = new Set<() => void>();

const readPreference = (): ThemePreference => {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved === 'light' || saved === 'dark' ? saved : 'system';
  } catch {
    return 'system';
  }
};

let preference = readPreference();

const apply = () => {
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  const resolved = preference === 'system' ? (prefersDark ? 'dark' : 'light') : preference;
  document.documentElement.dataset.theme = resolved;
};

// The device's own setting applies live while the preference is "system".
window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', apply);
apply();

export const cycleTheme = () => {
  preference = ORDER[(ORDER.indexOf(preference) + 1) % ORDER.length];
  try {
    if (preference === 'system') localStorage.removeItem(STORAGE_KEY);
    else localStorage.setItem(STORAGE_KEY, preference);
  } catch {
    // The choice still applies until the page is closed.
  }
  apply();
  listeners.forEach((listener) => listener());
};

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

export const useThemePreference = () => useSyncExternalStore(subscribe, () => preference);
