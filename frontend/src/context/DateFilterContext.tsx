import React, { createContext, useContext, useState, useCallback, useMemo } from 'react';

export type DatePreset = 'all' | 'today' | 'week' | 'month' | 'year' | 'custom';

export interface DateRange {
  preset: DatePreset;
  startDate: string; // YYYY-MM-DD or ''
  endDate: string;   // YYYY-MM-DD or ''
}

export interface DateFilterContextType {
  filter: DateRange;
  dateFilter: DateRange; // Convenient alias
  setPreset: (preset: DatePreset) => void;
  setCustomRange: (start: string, end: string) => { success: boolean; error?: string };
  clearFilter: () => void;
  formattedRangeLabel: string;
}

const defaultFilterState: DateFilterContextType = {
  filter: { preset: 'all', startDate: '', endDate: '' },
  dateFilter: { preset: 'all', startDate: '', endDate: '' },
  setPreset: () => {},
  setCustomRange: () => ({ success: true }),
  clearFilter: () => {},
  formattedRangeLabel: 'All Time',
};

const DateFilterContext = createContext<DateFilterContextType>(defaultFilterState);

/**
 * Returns today's date formatted as YYYY-MM-DD in Asia/Dhaka timezone.
 */
export function getDhakaToday(): string {
  try {
    const formatter = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Dhaka',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
    return formatter.format(new Date());
  } catch {
    return new Date().toISOString().slice(0, 10);
  }
}

/**
 * Compute startDate and endDate for standard presets based on Asia/Dhaka time.
 */
export function calculateRangeForPreset(preset: DatePreset): { startDate: string; endDate: string } {
  if (preset === 'all') {
    return { startDate: '', endDate: '' };
  }

  const todayStr = getDhakaToday();
  const [yearStr, monthStr, dayStr] = todayStr.split('-');
  const y = parseInt(yearStr, 10);
  const m = parseInt(monthStr, 10) - 1; // 0-indexed month
  const d = parseInt(dayStr, 10);

  if (preset === 'today') {
    return { startDate: todayStr, endDate: todayStr };
  }

  if (preset === 'week') {
    // Current week starting from Monday
    const current = new Date(y, m, d);
    const dayOfWeek = current.getDay();
    const distanceToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
    const monday = new Date(y, m, d + distanceToMonday);
    const startStr = `${monday.getFullYear()}-${String(monday.getMonth() + 1).padStart(2, '0')}-${String(monday.getDate()).padStart(2, '0')}`;
    return { startDate: startStr, endDate: todayStr };
  }

  if (preset === 'month') {
    const start = `${yearStr}-${monthStr}-01`;
    // Last day of current month
    const lastDay = new Date(y, m + 1, 0).getDate();
    const end = `${yearStr}-${monthStr}-${String(lastDay).padStart(2, '0')}`;
    return { startDate: start, endDate: end };
  }

  if (preset === 'year') {
    return { startDate: `${yearStr}-01-01`, endDate: `${yearStr}-12-31` };
  }

  return { startDate: '', endDate: '' };
}

export const DateFilterProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [filter, setFilter] = useState<DateRange>(() => {
    const { startDate, endDate } = calculateRangeForPreset('month');
    return {
      preset: 'month',
      startDate,
      endDate,
    };
  });

  const setPreset = useCallback((preset: DatePreset) => {
    if (preset === 'custom') {
      setFilter((prev) => ({
        ...prev,
        preset: 'custom',
      }));
      return;
    }
    const { startDate, endDate } = calculateRangeForPreset(preset);
    setFilter({
      preset,
      startDate,
      endDate,
    });
  }, []);

  const setCustomRange = useCallback((start: string, end: string) => {
    if (!start || !end) {
      return { success: false, error: 'Both start and end dates are required for custom filter.' };
    }
    if (start > end) {
      return { success: false, error: 'Start date cannot be after end date.' };
    }
    setFilter({
      preset: 'custom',
      startDate: start,
      endDate: end,
    });
    return { success: true };
  }, []);

  const clearFilter = useCallback(() => {
    setFilter({
      preset: 'all',
      startDate: '',
      endDate: '',
    });
  }, []);

  const formattedRangeLabel = useMemo(() => {
    if (filter.preset === 'all') return 'All Time';
    if (!filter.startDate && !filter.endDate) return 'All Time';
    if (filter.startDate === filter.endDate) return filter.startDate;
    return `${filter.startDate} → ${filter.endDate}`;
  }, [filter]);

  const value = useMemo(
    () => ({
      filter,
      dateFilter: filter,
      setPreset,
      setCustomRange,
      clearFilter,
      formattedRangeLabel,
    }),
    [filter, setPreset, setCustomRange, clearFilter, formattedRangeLabel]
  );

  return <DateFilterContext.Provider value={value}>{children}</DateFilterContext.Provider>;
};

export function useDateFilter() {
  const ctx = useContext(DateFilterContext);
  return ctx || defaultFilterState;
}
