import React, { useState, useRef, useEffect } from 'react';
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight, X } from 'lucide-react';

interface DatePickerProps {
  value: string; // ISO date string: YYYY-MM-DD
  onChange: (date: string) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
  id?: string;
  required?: boolean;
  label?: string;
}

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

const DAY_NAMES = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

/**
 * Returns today's date formatted as YYYY-MM-DD in Asia/Dhaka timezone.
 */
export function getDhakaTodayISO(): string {
  try {
    return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Dhaka' }).format(new Date());
  } catch {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  }
}

/**
 * Normalizes any date string (ISO or human formatted) into YYYY-MM-DD.
 */
export function normalizeToISODate(dateStr?: string): string {
  if (!dateStr || typeof dateStr !== 'string') return getDhakaTodayISO();
  const trimmed = dateStr.trim();

  // If already YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    return trimmed;
  }

  // If ISO string like 2026-10-15T...
  if (trimmed.length >= 10 && /^\d{4}-\d{2}-\d{2}/.test(trimmed)) {
    return trimmed.slice(0, 10);
  }

  // Parse "15 Oct 2026" or "15 October 2026"
  const match = trimmed.match(/^(\d{1,2})\s+([A-Za-z]+)\s+(\d{4})$/);
  if (match) {
    const day = parseInt(match[1], 10);
    const monthName = match[2].toLowerCase();
    const year = parseInt(match[3], 10);
    const monthIdx = MONTH_NAMES.findIndex((m) => m.toLowerCase().startsWith(monthName.slice(0, 3)));
    if (monthIdx !== -1) {
      return `${year}-${String(monthIdx + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    }
  }

  // Fallback to Date parsing
  const d = new Date(trimmed);
  if (!isNaN(d.getTime())) {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }

  return getDhakaTodayISO();
}

/**
 * Formats YYYY-MM-DD into "DD MMM YYYY" (e.g. "15 Oct 2026") without timezone shifting.
 */
export function formatDisplayDate(dateStr?: string): string {
  if (!dateStr) return '';
  const iso = normalizeToISODate(dateStr);
  const parts = iso.split('-');
  if (parts.length === 3) {
    const year = parseInt(parts[0], 10);
    const monthIdx = parseInt(parts[1], 10) - 1;
    const day = parseInt(parts[2], 10);
    if (!isNaN(year) && monthIdx >= 0 && monthIdx < 12 && !isNaN(day)) {
      const monthShort = MONTH_NAMES[monthIdx].slice(0, 3);
      return `${String(day).padStart(2, '0')} ${monthShort} ${year}`;
    }
  }
  return dateStr;
}

export const DatePicker: React.FC<DatePickerProps> = ({
  value,
  onChange,
  placeholder = 'Select date',
  className = '',
  disabled = false,
  id,
  required = false,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Normalized selected ISO date
  const selectedISO = normalizeToISODate(value);
  const todayISO = getDhakaTodayISO();

  // Calendar view year and month
  const initialYear = parseInt(selectedISO.slice(0, 4), 10) || new Date().getFullYear();
  const initialMonth = (parseInt(selectedISO.slice(5, 7), 10) - 1) || 0;

  const [viewYear, setViewYear] = useState<number>(initialYear);
  const [viewMonth, setViewMonth] = useState<number>(initialMonth);

  // Sync view when value changes
  useEffect(() => {
    const iso = normalizeToISODate(value);
    const y = parseInt(iso.slice(0, 4), 10);
    const m = parseInt(iso.slice(5, 7), 10) - 1;
    if (!isNaN(y) && !isNaN(m)) {
      setViewYear(y);
      setViewMonth(m);
    }
  }, [value]);

  // Click outside listener
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const prevMonth = () => {
    if (viewMonth === 0) {
      setViewMonth(11);
      setViewYear((prev) => prev - 1);
    } else {
      setViewMonth((prev) => prev - 1);
    }
  };

  const nextMonth = () => {
    if (viewMonth === 11) {
      setViewMonth(0);
      setViewYear((prev) => prev + 1);
    } else {
      setViewMonth((prev) => prev + 1);
    }
  };

  const selectDate = (year: number, month: number, day: number) => {
    const iso = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    onChange(iso);
    setIsOpen(false);
  };

  const handleSelectToday = () => {
    const today = getDhakaTodayISO();
    onChange(today);
    setIsOpen(false);
  };

  // Generate calendar grid (days in month, leading and trailing cells)
  const firstDayOfWeek = new Date(viewYear, viewMonth, 1).getDay(); // 0 is Sunday
  const daysInCurrentMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const daysInPrevMonth = new Date(viewYear, viewMonth, 0).getDate();

  const cells = [];
  // Leading days from previous month
  for (let i = firstDayOfWeek - 1; i >= 0; i--) {
    const day = daysInPrevMonth - i;
    cells.push({
      day,
      month: viewMonth === 0 ? 11 : viewMonth - 1,
      year: viewMonth === 0 ? viewYear - 1 : viewYear,
      isCurrentMonth: false,
    });
  }

  // Days in current month
  for (let i = 1; i <= daysInCurrentMonth; i++) {
    cells.push({
      day: i,
      month: viewMonth,
      year: viewYear,
      isCurrentMonth: true,
    });
  }

  // Trailing days from next month
  const remainingCells = 42 - cells.length; // 6 rows * 7 columns
  for (let i = 1; i <= remainingCells; i++) {
    cells.push({
      day: i,
      month: viewMonth === 11 ? 0 : viewMonth + 1,
      year: viewMonth === 11 ? viewYear + 1 : viewYear,
      isCurrentMonth: false,
    });
  }

  return (
    <div className={`relative ${className}`} ref={containerRef}>
      {/* Trigger Button */}
      <button
        type="button"
        id={id}
        disabled={disabled}
        onClick={() => !disabled && setIsOpen(!isOpen)}
        className={`w-full bg-[#111317] border border-[#262932] hover:border-[#383d4a] focus:border-blue-500 rounded px-3 py-1.5 flex items-center justify-between text-xs transition-colors ${
          disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'
        } ${isOpen ? 'border-blue-500 ring-1 ring-blue-500/30' : ''}`}
        aria-haspopup="dialog"
        aria-expanded={isOpen}
      >
        <span className={value ? 'text-gray-100 font-mono' : 'text-gray-500'}>
          {value ? formatDisplayDate(value) : placeholder}
        </span>
        <CalendarIcon className="w-3.5 h-3.5 text-gray-400 flex-shrink-0 ml-2" />
      </button>

      {/* Popover Calendar */}
      {isOpen && (
        <div
          className="absolute z-50 mt-1 bg-[#16181d] border border-[#262932] rounded-lg shadow-2xl p-3 w-64 select-none animate-in fade-in zoom-in-95 duration-100"
          style={{ minWidth: '16rem' }}
          role="dialog"
          aria-label="Calendar date picker"
        >
          {/* Header with Month/Year Navigation */}
          <div className="flex items-center justify-between mb-2 pb-2 border-b border-[#22252c]">
            <button
              type="button"
              onClick={prevMonth}
              className="p-1 text-gray-400 hover:text-gray-100 hover:bg-[#20232a] rounded transition-colors"
              title="Previous month"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <div className="text-xs font-semibold text-gray-100 font-mono">
              {MONTH_NAMES[viewMonth]} {viewYear}
            </div>
            <button
              type="button"
              onClick={nextMonth}
              className="p-1 text-gray-400 hover:text-gray-100 hover:bg-[#20232a] rounded transition-colors"
              title="Next month"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          {/* Weekday headers */}
          <div className="grid grid-cols-7 gap-1 text-center mb-1">
            {DAY_NAMES.map((name) => (
              <span key={name} className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider">
                {name}
              </span>
            ))}
          </div>

          {/* Days Grid */}
          <div className="grid grid-cols-7 gap-1 text-center">
            {cells.map((cell, idx) => {
              const cellISO = `${cell.year}-${String(cell.month + 1).padStart(2, '0')}-${String(cell.day).padStart(2, '0')}`;
              const isSelected = cellISO === selectedISO;
              const isToday = cellISO === todayISO;

              return (
                <button
                  key={idx}
                  type="button"
                  onClick={() => selectDate(cell.year, cell.month, cell.day)}
                  className={`h-7 w-7 text-xs rounded flex items-center justify-center font-mono transition-colors ${
                    isSelected
                      ? 'bg-blue-600 text-white font-bold shadow-sm'
                      : cell.isCurrentMonth
                      ? 'text-gray-200 hover:bg-[#222631] hover:text-white'
                      : 'text-gray-600 hover:bg-[#1a1d24] hover:text-gray-400'
                  } ${isToday && !isSelected ? 'border border-blue-500/70 text-blue-400 font-semibold' : ''}`}
                >
                  {cell.day}
                </button>
              );
            })}
          </div>

          {/* Footer Quick Actions */}
          <div className="flex items-center justify-between pt-2.5 mt-2 border-t border-[#22252c] text-[11px]">
            <button
              type="button"
              onClick={handleSelectToday}
              className="px-2 py-1 rounded bg-[#1e222a] hover:bg-[#272c37] text-blue-400 font-medium transition-colors"
            >
              Today
            </button>
            <span className="text-[10px] text-gray-500 font-mono">Asia/Dhaka</span>
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="px-2 py-1 rounded text-gray-400 hover:text-gray-200 hover:bg-[#20232a] transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
