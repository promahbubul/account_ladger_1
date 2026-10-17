import React, { useState } from 'react';
import {
  Menu,
  Plus,
  ChevronDown,
  Wallet,
  Shield,
  Activity,
  Calendar,
  X,
} from 'lucide-react';
import { formatBDT } from '../../lib/formatters';
import { useFinance } from '../../context/FinanceContext';
import { useAuth } from '../../context/AuthContext';
import { useDateFilter, DatePreset } from '../../context/DateFilterContext';

interface HeaderProps {
  title: string;
  onOpenMobileSidebar: () => void;
  selectedPeriod?: string;
  setSelectedPeriod?: (period: string) => void;
  onOpenQuickAction: (actionType: 'income' | 'expense' | 'transfer' | 'loan' | 'daily_bulk') => void;
}

export const Header: React.FC<HeaderProps> = ({
  title,
  onOpenMobileSidebar,
  onOpenQuickAction,
}) => {
  const { user } = useAuth();
  const isAdmin = user?.role === 'ADMIN';
  const { accounts } = useFinance();
  const { filter, setPreset, setCustomRange, clearFilter, formattedRangeLabel } = useDateFilter();

  const [isActionsOpen, setIsActionsOpen] = useState(false);
  const [isCustomDateOpen, setIsCustomDateOpen] = useState(false);
  const [customStart, setCustomStart] = useState(filter.startDate || '');
  const [customEnd, setCustomEnd] = useState(filter.endDate || '');
  const [dateError, setDateError] = useState<string | null>(null);

  const totalBalance = accounts.reduce((acc, a) => acc + a.currentBalance, 0);

  const presets: { id: DatePreset; label: string }[] = [
    { id: 'today', label: 'Today' },
    { id: 'week', label: 'Week' },
    { id: 'month', label: 'Month' },
    { id: 'year', label: 'Year' },
    { id: 'all', label: 'All' },
  ];

  const handleApplyCustom = (e: React.FormEvent) => {
    e.preventDefault();
    setDateError(null);
    const result = setCustomRange(customStart, customEnd);
    if (!result.success) {
      setDateError(result.error || 'Invalid date range');
      return;
    }
    setIsCustomDateOpen(false);
  };

  return (
    <header className="sticky top-0 z-30 bg-[#121417] border-b border-[#22252c] px-4 lg:px-6 py-2.5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
        {/* Left side: Mobile Toggle & Page Title */}
        <div className="flex items-center gap-2.5">
          <button
            onClick={onOpenMobileSidebar}
            className="lg:hidden p-1.5 text-gray-400 hover:text-white rounded hover:bg-[#1c1f26]"
            aria-label="Open navigation"
          >
            <Menu className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-2">
            <h1 className="text-base font-semibold tracking-tight text-gray-100">
              {title}
            </h1>
            {!isAdmin && filter.preset !== 'all' && (
              <span className="hidden sm:inline-flex items-center gap-1 px-2 py-0.5 rounded bg-blue-950/60 text-blue-300 border border-blue-800/60 text-[10px] font-mono">
                <Calendar className="w-3 h-3 text-blue-400" />
                {formattedRangeLabel}
              </span>
            )}
          </div>
        </div>

        {/* Right side */}
        {isAdmin ? (
          <div className="flex items-center gap-2.5">
            <div className="flex items-center gap-1.5 px-2.5 py-1 bg-[#171a20] border border-[#262a34] rounded text-xs text-purple-400">
              <Shield className="w-3.5 h-3.5 text-purple-400" />
              <span className="font-medium text-[11px]">Admin Mode</span>
            </div>
            <div className="flex items-center gap-1.5 px-2.5 py-1 bg-[#171a20] border border-[#262a34] rounded text-xs text-emerald-400">
              <Activity className="w-3.5 h-3.5 text-emerald-400" />
              <span className="text-[11px] font-medium">Services Operational</span>
            </div>
          </div>
        ) : (
          <div className="flex items-center flex-wrap gap-2">
            {/* Unified Date Range Presets */}
            <div className="flex items-center bg-[#171a20] border border-[#242730] rounded p-0.5 text-xs">
              {presets.map((p) => {
                const isActive = filter.preset === p.id;
                return (
                  <button
                    key={p.id}
                    onClick={() => {
                      setPreset(p.id);
                      setIsCustomDateOpen(false);
                    }}
                    className={`px-2 py-1 rounded text-xs font-medium transition-colors ${
                      isActive
                        ? 'bg-[#262a34] text-blue-400 shadow-sm'
                        : 'text-gray-400 hover:text-gray-200'
                    }`}
                  >
                    {p.label}
                  </button>
                );
              })}

              {/* Custom Date Trigger */}
              <div className="relative">
                <button
                  onClick={() => setIsCustomDateOpen(!isCustomDateOpen)}
                  className={`flex items-center gap-1 px-2 py-1 rounded text-xs font-medium transition-colors ${
                    filter.preset === 'custom'
                      ? 'bg-[#262a34] text-blue-400 shadow-sm'
                      : 'text-gray-400 hover:text-gray-200'
                  }`}
                  title="Custom Date Range"
                >
                  <Calendar className="w-3 h-3" />
                  <span>Custom</span>
                </button>

                {/* Custom Date Picker Popover */}
                {isCustomDateOpen && (
                  <>
                    <div
                      className="fixed inset-0 z-40"
                      onClick={() => setIsCustomDateOpen(false)}
                    />
                    <div className="absolute right-0 mt-2 w-72 bg-[#181a20] border border-[#2b2e37] rounded-lg shadow-2xl p-3.5 z-50 text-xs">
                      <div className="flex items-center justify-between pb-2 mb-2 border-b border-[#262933]">
                        <span className="font-semibold text-gray-200 text-xs flex items-center gap-1.5">
                          <Calendar className="w-3.5 h-3.5 text-blue-400" />
                          Custom Date Range
                        </span>
                        <button
                          onClick={() => setIsCustomDateOpen(false)}
                          className="text-gray-400 hover:text-gray-200"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      <form onSubmit={handleApplyCustom} className="space-y-2.5">
                        <div>
                          <label className="block text-[11px] text-gray-400 mb-1">
                            Start Date
                          </label>
                          <input
                            type="date"
                            value={customStart}
                            onChange={(e) => setCustomStart(e.target.value)}
                            required
                            className="w-full bg-[#121417] border border-[#2a2d36] rounded px-2.5 py-1.5 text-gray-100 text-xs focus:outline-none focus:border-blue-500"
                          />
                        </div>

                        <div>
                          <label className="block text-[11px] text-gray-400 mb-1">
                            End Date
                          </label>
                          <input
                            type="date"
                            value={customEnd}
                            onChange={(e) => setCustomEnd(e.target.value)}
                            required
                            className="w-full bg-[#121417] border border-[#2a2d36] rounded px-2.5 py-1.5 text-gray-100 text-xs focus:outline-none focus:border-blue-500"
                          />
                        </div>

                        {dateError && (
                          <p className="text-[11px] text-red-400 font-medium">{dateError}</p>
                        )}

                        <div className="flex items-center justify-end gap-2 pt-1">
                          <button
                            type="button"
                            onClick={() => {
                              clearFilter();
                              setIsCustomDateOpen(false);
                            }}
                            className="px-2.5 py-1 bg-[#20232b] hover:bg-[#282c37] text-gray-300 rounded text-xs transition-colors"
                          >
                            Clear
                          </button>
                          <button
                            type="submit"
                            className="px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded font-medium text-xs transition-colors"
                          >
                            Apply
                          </button>
                        </div>
                      </form>
                    </div>
                  </>
                )}
              </div>

              {/* Clear Filter Action */}
              {filter.preset !== 'all' && (
                <button
                  onClick={clearFilter}
                  title="Clear Date Filter"
                  className="px-1.5 py-1 text-gray-500 hover:text-red-400 transition-colors ml-0.5"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Liquid Balance Summary */}
            <div className="hidden md:flex items-center gap-2 px-3 py-1 bg-[#171a20] border border-[#242730] rounded text-xs">
              <Wallet className="w-3.5 h-3.5 text-gray-400" />
              <span className="text-gray-400">Liquid:</span>
              <span className="font-semibold text-gray-200 font-mono">
                {formatBDT(totalBalance)}
              </span>
            </div>

            {/* Quick Action Dropdown */}
            <div className="relative">
              <button
                onClick={() => setIsActionsOpen(!isActionsOpen)}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white font-medium text-xs rounded transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>New Entry</span>
                <ChevronDown className="w-3 h-3 ml-0.5" />
              </button>

              {isActionsOpen && (
                <>
                  <div
                    className="fixed inset-0 z-30"
                    onClick={() => setIsActionsOpen(false)}
                  />
                  <div className="absolute right-0 mt-1 w-44 bg-[#181a20] border border-[#2b2e37] rounded shadow-lg py-1 z-40 text-xs">
                    <button
                      onClick={() => {
                        onOpenQuickAction('income');
                        setIsActionsOpen(false);
                      }}
                      className="w-full text-left px-3 py-2 text-gray-200 hover:bg-[#222631] transition-colors"
                    >
                      Add Income
                    </button>
                    <button
                      onClick={() => {
                        onOpenQuickAction('expense');
                        setIsActionsOpen(false);
                      }}
                      className="w-full text-left px-3 py-2 text-gray-200 hover:bg-[#222631] transition-colors"
                    >
                      Add Expense
                    </button>
                    <button
                      onClick={() => {
                        onOpenQuickAction('daily_bulk');
                        setIsActionsOpen(false);
                      }}
                      className="w-full text-left px-3 py-2 text-gray-200 hover:bg-[#222631] transition-colors"
                    >
                      Daily Expenses
                    </button>
                    <button
                      onClick={() => {
                        onOpenQuickAction('transfer');
                        setIsActionsOpen(false);
                      }}
                      className="w-full text-left px-3 py-2 text-gray-200 hover:bg-[#222631] transition-colors border-t border-[#252832]"
                    >
                      Transfer Money
                    </button>
                    <button
                      onClick={() => {
                        onOpenQuickAction('loan');
                        setIsActionsOpen(false);
                      }}
                      className="w-full text-left px-3 py-2 text-gray-200 hover:bg-[#222631] transition-colors"
                    >
                      Add Loan
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </header>
  );
};
