import React, { useState } from 'react';
import { formatBDT } from '../../lib/formatters';
import { ValueSkeleton } from '../common/StateViews';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export interface MonthTotals {
  month: string;
  income: number;
  expense: number;
}

const monthLabel = (month: string) => MONTHS[Number(month.slice(5, 7)) - 1];
const fullLabel = (month: string) => `${monthLabel(month)} ${month.slice(0, 4)}`;

// Two series on one shared axis. Hovering or clicking a month reads out its exact values.
export const MonthlyBars: React.FC<{ months: MonthTotals[]; isLoading?: boolean }> = ({ months, isLoading = false }) => {
  const [activeMonth, setActiveMonth] = useState<string | null>(null);
  const [showTable, setShowTable] = useState(false);

  if (isLoading) return <ValueSkeleton className="block h-40 w-full" />;

  const max = Math.max(0, ...months.flatMap((m) => [m.income, m.expense]));
  if (max === 0) return <p className="text-xs text-gray-500 py-2">No income or expenses in these 12 months.</p>;

  const active = months.find((m) => m.month === activeMonth) || months[months.length - 1];

  return (
    <div>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mb-2 text-xs text-gray-400">
        <span className="inline-flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-chart-1" />Income</span>
        <span className="inline-flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-chart-2" />Expense</span>
        <span className="sm:ml-auto text-gray-200">
          <span className="text-gray-500 mr-2">{fullLabel(active.month)}</span>
          <span className="font-mono">Income {formatBDT(active.income)} · Expense {formatBDT(active.expense)}</span>
        </span>
      </div>

      <div className="flex items-end h-40 border-b border-line-strong" onMouseLeave={() => setActiveMonth(null)}>
        {months.map((m) => (
          <button
            key={m.month}
            type="button"
            aria-label={`${fullLabel(m.month)}: income ${formatBDT(m.income)}, expense ${formatBDT(m.expense)}`}
            onMouseEnter={() => setActiveMonth(m.month)}
            onFocus={() => setActiveMonth(m.month)}
            onClick={() => setActiveMonth(m.month)}
            className={`flex-1 h-full flex items-end justify-center gap-0.5 cursor-pointer ${m.month === active.month ? 'bg-surface-hover' : ''}`}
          >
            <span className="w-2 sm:w-3 rounded-t-sm bg-chart-1" style={{ height: m.income > 0 ? `${Math.max((m.income / max) * 100, 1)}%` : 0 }} />
            <span className="w-2 sm:w-3 rounded-t-sm bg-chart-2" style={{ height: m.expense > 0 ? `${Math.max((m.expense / max) * 100, 1)}%` : 0 }} />
          </button>
        ))}
      </div>
      <div className="flex mt-1">
        {months.map((m) => (
          <span key={m.month} className={`flex-1 text-center text-[10px] ${m.month === active.month ? 'text-gray-100 font-semibold' : 'text-gray-500'}`}>
            {monthLabel(m.month)}
          </span>
        ))}
      </div>

      <button
        type="button"
        onClick={() => setShowTable((value) => !value)}
        className="mt-2 text-xs font-medium text-blue-400 hover:text-blue-300"
      >
        {showTable ? 'Hide table' : 'View as table'}
      </button>
      {showTable && (
        <table className="w-full mt-2 text-left text-xs border-collapse">
          <thead>
            <tr className="border-b border-line text-gray-400 text-[10px] uppercase">
              <th className="py-1.5 pr-3">Month</th>
              <th className="py-1.5 pr-3 text-right">Income</th>
              <th className="py-1.5 text-right">Expense</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-divider">
            {[...months].reverse().map((m) => (
              <tr key={m.month}>
                <td className="py-1.5 pr-3 text-gray-300">{fullLabel(m.month)}</td>
                <td className="py-1.5 pr-3 text-right font-mono text-gray-200">{formatBDT(m.income)}</td>
                <td className="py-1.5 text-right font-mono text-gray-200">{formatBDT(m.expense)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
};
