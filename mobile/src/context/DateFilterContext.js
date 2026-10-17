import React, { createContext, useContext, useState, useCallback, useMemo } from 'react';
import { getTodayISO } from '../utils/formatters';

const DateFilterContext = createContext(null);

export const calculateRangeForPreset = (preset) => {
  if (preset === 'all') {
    return { startDate: '', endDate: '' };
  }

  const todayStr = getTodayISO();
  const [yearStr, monthStr, dayStr] = todayStr.split('-');
  const y = parseInt(yearStr, 10);
  const m = parseInt(monthStr, 10) - 1;
  const d = parseInt(dayStr, 10);

  if (preset === 'today') {
    return { startDate: todayStr, endDate: todayStr };
  }

  if (preset === 'week') {
    const current = new Date(y, m, d);
    const dayOfWeek = current.getDay();
    const distanceToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
    const monday = new Date(y, m, d + distanceToMonday);
    const startStr = `${monday.getFullYear()}-${String(monday.getMonth() + 1).padStart(2, '0')}-${String(monday.getDate()).padStart(2, '0')}`;
    return { startDate: startStr, endDate: todayStr };
  }

  if (preset === 'month') {
    const start = `${yearStr}-${monthStr}-01`;
    const lastDay = new Date(y, m + 1, 0).getDate();
    const end = `${yearStr}-${monthStr}-${String(lastDay).padStart(2, '0')}`;
    return { startDate: start, endDate: end };
  }

  if (preset === 'year') {
    return { startDate: `${yearStr}-01-01`, endDate: `${yearStr}-12-31` };
  }

  return { startDate: '', endDate: '' };
};

export const DateFilterProvider = ({ children }) => {
  const [preset, setPresetState] = useState('month');
  const [range, setRange] = useState(() => calculateRangeForPreset('month'));

  const setPreset = useCallback((newPreset) => {
    setPresetState(newPreset);
    if (newPreset !== 'custom') {
      setRange(calculateRangeForPreset(newPreset));
    }
  }, []);

  const setCustomRange = useCallback((startDate, endDate) => {
    setPresetState('custom');
    setRange({ startDate, endDate });
  }, []);

  const clearFilter = useCallback(() => {
    setPresetState('all');
    setRange({ startDate: '', endDate: '' });
  }, []);

  const formattedRangeLabel = useMemo(() => {
    if (preset === 'all') return 'All Time';
    if (preset === 'today') return 'Today';
    if (preset === 'week') return 'This Week';
    if (preset === 'month') return 'This Month';
    if (preset === 'year') return 'This Year';
    if (!range.startDate && !range.endDate) return 'All Time';
    return `${range.startDate} → ${range.endDate}`;
  }, [preset, range]);

  const value = {
    preset,
    startDate: range.startDate,
    endDate: range.endDate,
    setPreset,
    setCustomRange,
    clearFilter,
    formattedRangeLabel,
  };

  return <DateFilterContext.Provider value={value}>{children}</DateFilterContext.Provider>;
};

export const useDateFilter = () => {
  const context = useContext(DateFilterContext);
  if (!context) {
    throw new Error('useDateFilter must be used within DateFilterProvider');
  }
  return context;
};
