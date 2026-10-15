import React, { useState } from 'react';
import {
  Menu,
  Plus,
  ChevronDown,
  Wallet,
  Shield,
  Activity,
} from 'lucide-react';
import { formatBDT } from '../../lib/formatters';
import { useFinance } from '../../context/FinanceContext';
import { useAuth } from '../../context/AuthContext';

interface HeaderProps {
  title: string;
  onOpenMobileSidebar: () => void;
  selectedPeriod: string;
  setSelectedPeriod: (period: string) => void;
  onOpenQuickAction: (actionType: 'income' | 'expense' | 'transfer' | 'loan' | 'daily_bulk') => void;
}

export const Header: React.FC<HeaderProps> = ({
  title,
  onOpenMobileSidebar,
  selectedPeriod,
  setSelectedPeriod,
  onOpenQuickAction,
}) => {
  const { user } = useAuth();
  const isAdmin = user?.role === 'ADMIN';
  const { accounts } = useFinance();
  const [isActionsOpen, setIsActionsOpen] = useState(false);

  const totalBalance = accounts.reduce((acc, a) => acc + a.currentBalance, 0);

  const periods = [
    { id: 'today', label: 'Today' },
    { id: 'week', label: 'This Week' },
    { id: 'month', label: 'This Month' },
    { id: 'year', label: 'This Year' },
  ];

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
          <h1 className="text-base font-semibold tracking-tight text-gray-100">
            {title}
          </h1>
        </div>

        {/* Right side */}
        {isAdmin ? (
          <div className="flex items-center gap-2.5">
            <div className="flex items-center gap-1.5 px-2.5 py-1 bg-[#171a20] border border-[#262a34] rounded text-xs text-purple-400">
              <Shield className="w-3.5 h-3.5 text-purple-400" />
              <span className="font-medium text-[11px]">System Administration Mode</span>
            </div>
            <div className="flex items-center gap-1.5 px-2.5 py-1 bg-[#171a20] border border-[#262a34] rounded text-xs text-emerald-400">
              <Activity className="w-3.5 h-3.5 text-emerald-400" />
              <span className="text-[11px] font-medium">Services Operational</span>
            </div>
          </div>
        ) : (
          <div className="flex items-center flex-wrap gap-2">
            {/* Period Selector */}
            <div className="flex items-center bg-[#171a20] border border-[#242730] rounded p-0.5 text-xs">
              {periods.map((p) => (
                <button
                  key={p.id}
                  onClick={() => setSelectedPeriod(p.id)}
                  className={`px-2.5 py-1 rounded text-xs font-medium transition-colors ${
                    selectedPeriod === p.id
                      ? 'bg-[#262a34] text-gray-100 shadow-sm'
                      : 'text-gray-400 hover:text-gray-200'
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>

            {/* Liquid Balance Summary */}
            <div className="hidden md:flex items-center gap-2 px-3 py-1 bg-[#171a20] border border-[#242730] rounded text-xs">
              <Wallet className="w-3.5 h-3.5 text-gray-400" />
              <span className="text-gray-400">Total Liquid:</span>
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
