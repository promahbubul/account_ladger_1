import React from 'react';
import {
  ArrowDownLeft,
  ArrowUpRight,
  ArrowLeftRight,
  HandCoins,
  FileSpreadsheet,
  AlertTriangle,
} from 'lucide-react';
import { formatBDT } from '../../lib/formatters';
import { useFinance } from '../../context/FinanceContext';
import { useDateFilter } from '../../context/DateFilterContext';
import { TableEmptyRow } from '../common/StateViews';

interface DashboardViewProps {
  onOpenQuickAction: (actionType: 'income' | 'expense' | 'transfer' | 'loan' | 'daily_bulk') => void;
  onNavigateTab: (tab: any) => void;
  selectedPeriod?: string;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  onOpenQuickAction,
  onNavigateTab,
  selectedPeriod,
}) => {
  const { accounts, transactions, loans, budgetAlerts } = useFinance();
  const { dateFilter } = useDateFilter();

  const filteredTransactions = React.useMemo(() => {
    return transactions.filter(t => {
      if (dateFilter.startDate && t.date < dateFilter.startDate) return false;
      if (dateFilter.endDate && t.date > dateFilter.endDate) return false;
      return true;
    });
  }, [transactions, dateFilter.startDate, dateFilter.endDate]);

  const totalBalance = accounts.filter(a => a.status === 'ACTIVE').reduce((sum, a) => sum + a.currentBalance, 0);
  const totalIncome = filteredTransactions.filter(t => t.type === 'INCOME').reduce((sum, t) => sum + t.amount, 0);
  const totalExpense = filteredTransactions.filter(t => t.type === 'EXPENSE').reduce((sum, t) => sum + t.amount, 0);
  const netCashFlow = totalIncome - totalExpense;

  const totalReceivables = loans
    .filter((l) => l.type === 'LENT')
    .reduce((sum, l) => sum + l.outstandingPrincipal, 0);

  const totalPayables = loans
    .filter((l) => l.type === 'BORROWED')
    .reduce((sum, l) => sum + l.outstandingPrincipal, 0);

  const overBudgetCategories = budgetAlerts.filter(b => b.status === 'EXCEEDED');

  return (
    <div className="space-y-4 w-full min-w-0">
      {/* Budget Alert Banner */}
      {overBudgetCategories.length > 0 && (
        <div className="bg-[#1f1618] border border-red-900/80 rounded p-3 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
          <div className="flex items-start sm:items-center gap-2.5">
            <AlertTriangle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5 sm:mt-0" />
            <div>
              <span className="font-semibold text-red-200">
                Budget Alert: {overBudgetCategories.length} {overBudgetCategories.length === 1 ? 'category has' : 'categories have'} exceeded limits.
              </span>
              <span className="text-gray-300 ml-2 hidden sm:inline">
                ({overBudgetCategories.map(b => `${b.categoryName} +${formatBDT(b.exceededBy)}`).join(', ')})
              </span>
            </div>
          </div>
          <button
            onClick={() => onNavigateTab('budgets')}
            className="px-2.5 py-1 bg-red-950 hover:bg-red-900 text-red-200 border border-red-800 rounded text-xs font-medium self-start sm:self-auto transition-colors"
          >
            Review Budgets
          </button>
        </div>
      )}

      {/* Summary Metrics */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="bg-[#16181d] border border-[#22252c] rounded p-3">
          <div className="text-xs text-gray-400">Total Liquid Balance</div>
          <div className="text-lg font-bold font-mono text-emerald-400 mt-1">
            {formatBDT(totalBalance)}
          </div>
        </div>

        <div className="bg-[#16181d] border border-[#22252c] rounded p-3">
          <div className="text-xs text-gray-400">Total Income</div>
          <div className="text-lg font-bold font-mono text-gray-100 mt-1">
            +{formatBDT(totalIncome)}
          </div>
        </div>

        <div className="bg-[#16181d] border border-[#22252c] rounded p-3">
          <div className="text-xs text-gray-400">Total Expenses</div>
          <div className="text-lg font-bold font-mono text-gray-200 mt-1">
            -{formatBDT(totalExpense)}
          </div>
        </div>

        <div className="bg-[#16181d] border border-[#22252c] rounded p-3">
          <div className="text-xs text-gray-400">Net Flow</div>
          <div className={`text-lg font-bold font-mono mt-1 ${netCashFlow >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
            {formatBDT(netCashFlow, true)}
          </div>
        </div>
      </div>

      {/* Receivables & Payables */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="bg-[#16181d] border border-[#22252c] rounded p-3 flex items-center justify-between">
          <div>
            <div className="text-xs text-gray-400">Loans Given (Receivables)</div>
            <div className="text-base font-semibold font-mono text-emerald-400 mt-0.5">
              {formatBDT(totalReceivables)}
            </div>
          </div>
          <button
            onClick={() => onNavigateTab('loans')}
            className="text-xs text-blue-400 hover:text-blue-300 font-medium"
          >
            Manage Loans →
          </button>
        </div>

        <div className="bg-[#16181d] border border-[#22252c] rounded p-3 flex items-center justify-between">
          <div>
            <div className="text-xs text-gray-400">Loans Borrowed (Payables)</div>
            <div className="text-base font-semibold font-mono text-gray-200 mt-0.5">
              {formatBDT(totalPayables)}
            </div>
          </div>
          <button
            onClick={() => onNavigateTab('loans')}
            className="text-xs text-blue-400 hover:text-blue-300 font-medium"
          >
            View Payables →
          </button>
        </div>
      </div>

      {/* Quick Entry Actions */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
        <button
          onClick={() => onOpenQuickAction('income')}
          className="flex items-center justify-center gap-2 p-2 bg-[#16181d] hover:bg-[#1f2229] border border-[#242730] rounded text-xs text-gray-200 transition-colors"
        >
          <ArrowDownLeft className="w-3.5 h-3.5 text-emerald-400" />
          <span>Income</span>
        </button>

        <button
          onClick={() => onOpenQuickAction('expense')}
          className="flex items-center justify-center gap-2 p-2 bg-[#16181d] hover:bg-[#1f2229] border border-[#242730] rounded text-xs text-gray-200 transition-colors"
        >
          <ArrowUpRight className="w-3.5 h-3.5 text-red-400" />
          <span>Expense</span>
        </button>

        <button
          onClick={() => onOpenQuickAction('daily_bulk')}
          className="flex items-center justify-center gap-2 p-2 bg-[#16181d] hover:bg-[#1f2229] border border-[#242730] rounded text-xs text-gray-200 transition-colors"
        >
          <FileSpreadsheet className="w-3.5 h-3.5 text-blue-400" />
          <span>Daily Expenses</span>
        </button>

        <button
          onClick={() => onOpenQuickAction('transfer')}
          className="flex items-center justify-center gap-2 p-2 bg-[#16181d] hover:bg-[#1f2229] border border-[#242730] rounded text-xs text-gray-200 transition-colors"
        >
          <ArrowLeftRight className="w-3.5 h-3.5 text-blue-400" />
          <span>Transfer</span>
        </button>

        <button
          onClick={() => onOpenQuickAction('loan')}
          className="flex items-center justify-center gap-2 p-2 bg-[#16181d] hover:bg-[#1f2229] border border-[#242730] rounded text-xs text-gray-200 transition-colors col-span-2 sm:col-span-1"
        >
          <HandCoins className="w-3.5 h-3.5 text-amber-400" />
          <span>Loan</span>
        </button>
      </div>

      {/* Main Standard Tables */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Table 1: Accounts Position */}
        <div className="bg-[#16181d] border border-[#22252c] rounded overflow-hidden flex flex-col">
          <div className="p-3 border-b border-[#22252c] bg-[#121417] flex items-center justify-between">
            <h3 className="text-xs font-semibold text-gray-200 uppercase tracking-wider">
              Accounts Position
            </h3>
            <button
              onClick={() => onNavigateTab('accounts')}
              className="text-[11px] text-blue-400 hover:text-blue-300"
            >
              All Accounts →
            </button>
          </div>
          <div className="overflow-x-auto flex-1">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-[#22252c] bg-[#14161c] text-gray-400 text-[10px]">
                  <th className="py-2 px-3">Account</th>
                  <th className="py-2 px-3">Type</th>
                  <th className="py-2 px-3 text-right">Balance</th>
                  <th className="py-2 px-3 text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#20232a]">
                {accounts.length === 0 ? (
                  <TableEmptyRow
                    colSpan={4}
                    title="No accounts found"
                    description="No liquid accounts configured in the ledger."
                    minHeightClass="min-h-[160px]"
                  />
                ) : (
                  accounts.slice(0, 6).map((acc) => (
                    <tr key={acc.id} className="hover:bg-[#1a1d24]">
                      <td className="py-2 px-3 font-medium text-gray-200">
                        {acc.name}
                      </td>
                      <td className="py-2 px-3 text-gray-400">
                        {acc.type}
                      </td>
                      <td className="py-2 px-3 text-right font-mono font-semibold text-gray-100">
                        {formatBDT(acc.currentBalance)}
                      </td>
                      <td className="py-2 px-3 text-center">
                        <span className="inline-block px-1.5 py-0.5 rounded text-[10px] bg-gray-800 text-gray-300 border border-gray-700">
                          {acc.status}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Table 2: Recent Transactions */}
        <div className="bg-[#16181d] border border-[#22252c] rounded overflow-hidden flex flex-col">
          <div className="p-3 border-b border-[#22252c] bg-[#121417] flex items-center justify-between">
            <h3 className="text-xs font-semibold text-gray-200 uppercase tracking-wider">
              Recent Transactions
            </h3>
            <button
              onClick={() => onNavigateTab('transactions')}
              className="text-[11px] text-blue-400 hover:text-blue-300"
            >
              Full Ledger →
            </button>
          </div>
          <div className="overflow-x-auto flex-1">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-[#22252c] bg-[#14161c] text-gray-400 text-[10px]">
                  <th className="py-2 px-3">Date</th>
                  <th className="py-2 px-3">Description</th>
                  <th className="py-2 px-3">Account</th>
                  <th className="py-2 px-3 text-right">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#20232a]">
                {filteredTransactions.length === 0 ? (
                  <TableEmptyRow
                    colSpan={4}
                    title="No transactions recorded"
                    description="No ledger activity found for the selected period."
                    minHeightClass="min-h-[160px]"
                  />
                ) : (
                  filteredTransactions.slice(0, 6).map((tx) => (
                    <tr key={tx.id} className="hover:bg-[#1a1d24]">
                      <td className="py-2 px-3 text-gray-400 font-mono text-[11px] whitespace-nowrap">
                        {tx.date}
                      </td>
                      <td className="py-2 px-3 text-gray-300 truncate max-w-[150px]">
                        {tx.description}
                      </td>
                      <td className="py-2 px-3 text-gray-400 truncate max-w-[120px]">
                        {tx.accountName}
                      </td>
                      <td className={`py-2 px-3 text-right font-mono font-medium whitespace-nowrap ${
                        tx.direction === 'INFLOW' ? 'text-emerald-400' : tx.direction === 'OUTFLOW' ? 'text-gray-100' : 'text-blue-400'
                      }`}>
                        {tx.direction === 'INFLOW' ? `+${formatBDT(tx.amount)}` : tx.direction === 'OUTFLOW' ? `-${formatBDT(tx.amount)}` : formatBDT(tx.amount)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};
