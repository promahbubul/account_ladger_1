import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useColorScheme } from 'react-native';
import { setActiveTheme } from '../constants/theme';
import { getThemePreference, saveThemePreference } from '../services/storage/secureStore';

const ORDER = ['system', 'light', 'dark'];

const ThemeContext = createContext({ preference: 'system', resolved: 'dark', cycleTheme: () => {} });

export const ThemeProvider = ({ children }) => {
  const deviceScheme = useColorScheme();
  const [preference, setPreference] = useState('system');
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    let active = true;
    getThemePreference()
      .catch(() => null)
      .then((saved) => {
        if (!active) return;
        if (saved === 'light' || saved === 'dark') setPreference(saved);
        setIsReady(true);
      });
    return () => {
      active = false;
    };
  }, []);

  const resolved = preference === 'system' ? (deviceScheme === 'light' ? 'light' : 'dark') : preference;
  // Colours and styles read this while rendering, so it has to change before the children do.
  setActiveTheme(resolved);

  const cycleTheme = useCallback(() => {
    setPreference((current) => {
      const next = ORDER[(ORDER.indexOf(current) + 1) % ORDER.length];
      saveThemePreference(next).catch(() => {});
      return next;
    });
  }, []);

  const value = useMemo(() => ({ preference, resolved, cycleTheme }), [preference, resolved, cycleTheme]);

  // Waiting for the saved choice avoids showing the wrong theme for a moment.
  if (!isReady) return null;

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
};

export const useTheme = () => useContext(ThemeContext);
