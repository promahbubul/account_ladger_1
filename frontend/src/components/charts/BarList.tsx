import React from 'react';
import { formatBDT } from '../../lib/formatters';
import { ValueSkeleton } from '../common/StateViews';

const MAX_ROWS = 8;

export interface BarRow {
  key: string;
  label: string;
  value: number;
}

// Ranked magnitudes for one measure: a single hue, longest bar first, each value labelled in text ink.
export const BarList: React.FC<{ rows: BarRow[]; isLoading?: boolean; emptyMessage?: string }> = ({
  rows,
  isLoading = false,
  emptyMessage = 'Nothing to show yet.',
}) => {
  if (isLoading) {
    return (
      <div className="space-y-3">
        {['w-2/3', 'w-1/2', 'w-1/3'].map((width) => (
          <ValueSkeleton key={width} className={`block h-4 ${width}`} />
        ))}
      </div>
    );
  }

  const positive = rows.filter((row) => row.value > 0).sort((a, b) => b.value - a.value);
  if (positive.length === 0) return <p className="text-xs text-gray-500 py-2">{emptyMessage}</p>;

  // Long tails fold into "Other" rather than shrinking every bar.
  const shown = positive.length > MAX_ROWS ? positive.slice(0, MAX_ROWS - 1) : positive;
  const rest = positive.slice(shown.length);
  const display = rest.length
    ? [...shown, { key: '__other', label: `Other (${rest.length})`, value: rest.reduce((sum, row) => sum + row.value, 0) }]
    : shown;
  const max = Math.max(...display.map((row) => row.value));

  return (
    <div className="space-y-3">
      {display.map((row) => (
        <div key={row.key} title={`${row.label}: ${formatBDT(row.value)}`}>
          <div className="flex items-baseline justify-between gap-3 mb-1 text-xs">
            <span className="text-gray-400 truncate">{row.label}</span>
            <span className="font-mono font-semibold text-gray-100 whitespace-nowrap">{formatBDT(row.value)}</span>
          </div>
          <div className="h-2">
            <div
              className="h-2 rounded-r bg-chart-1"
              style={{ width: `${Math.max((row.value / max) * 100, 1)}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  );
};
