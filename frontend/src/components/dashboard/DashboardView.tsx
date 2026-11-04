import React, { useEffect, useState } from 'react';
import {
  ArrowDownLeft,
  ArrowUpRight,
  ArrowLeftRight,
  HandCoins,
  FileSpreadsheet,
  AlertTriangle,
} from 'lucide-react';
import { formatBDT, formatDate } from '../../lib/formatters';
import { useFinance } from '../../context/FinanceContext';
import { useDateFilter } from '../../context/DateFilterContext';
import {
  DataLoadErrorBanner,
  DataStatus,
  LoadedValue,
  TableEmptyRow,
  TableErrorRow,
  TableLoadingRow,
} from '../common/StateViews';
import { Transaction } from '../../mock/data';

const RECENT_COUNT = 6;

interface PeriodLedger {
  rangeKey: string;
  totalIncome: number;
  totalExpense: number;
  recent: Transaction[];
  totalCount: number;
}

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
  const { accounts, loans, budgetAlerts, dataStatus, refreshData, authFetch, ledgerVersion } = useFinance();
  const { dateFilter } = useDateFilter();

  // Period totals and the newest rows come from the server, so the full ledger is never loaded here.
  const rangeKey = `${dateFilter.startDate || ''}|${dateFilter.endDate || ''}`;
  const [ledger, setLedger] = useState<PeriodLedger | null>(null);
  const [ledgerFailed, setLedgerFailed] = useState(false);
  useEffect(() => {
    let active = true;
    setLedgerFailed(false);
    const range = new URLSearchParams();
    if (dateFilter.startDate) range.set('startDate', dateFilter.startDate);
    if (dateFilter.endDate) range.set('endDate', dateFilter.endDate);
    const page = new URLSearchParams(range);
    page.set('limit', '10');
    Promise.all([authFetch(`/api/reports/summary?${range}`), authFetch(`/api/transactions?${page}`)])
      .then(async ([summaryRes, txRes]) => {
        if (!summaryRes.ok || !txRes.ok) throw new Error('Could not load the dashboard.');
        const [summary, txPage] = await Promise.all([summaryRes.json(), txRes.json()]);
        if (!active) return;
        setLedger({
          rangeKey,
          totalIncome: Number(summary.totalIncome) || 0,
          totalExpense: Number(summary.totalExpense) || 0,
          recent: (txPage.items || []).slice(0, RECENT_COUNT),
          totalCount: Number(txPage.totalCount) || 0,
        });
      })
      .catch(() => {
        if (active) setLedgerFailed(true);
      });
    return () => {
      active = false;
    };
  }, [authFetch, dateFilter.startDate, dateFilter.endDate, rangeKey, ledgerVersion]);

  // Figures for an older date range are never shown; a refetch after an edit keeps the current ones.
  const ledgerStatus: DataStatus = ledgerFailed ? 'error' : ledger?.rangeKey === rangeKey ? 'ready' : 'loading';
  const recentTransactions = ledgerStatus === 'ready' && ledger ? ledger.recent : [];
  const periodCount = ledgerStatus === 'ready' && ledger ? ledger.totalCount : 0;

  const totalBalance = accounts.filter(a => a.status === 'ACTIVE').reduce((sum, a) => sum + a.currentBalance, 0);
  const totalIncome = ledger?.totalIncome ?? 0;
  const totalExpense = ledger?.totalExpense ?? 0;
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

      {(dataStatus === 'error' || ledgerStatus === 'error') && (
        <DataLoadErrorBanner message="Could not load your financial data." onRetry={refreshData} />
      )}

      {/* Summary Metrics */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="bg-surface border border-line rounded p-3">
          <div className="text-xs text-gray-400">Liquid Balance</div>
          <div className="text-lg font-bold font-mono text-emerald-400 mt-1">
            <LoadedValue status={dataStatus}>{formatBDT(totalBalance)}</LoadedValue>
          </div>
        </div>

        <div className="bg-surface border border-line rounded p-3">
          <div className="text-xs text-gray-400">Total Income</div>
          <div className="text-lg font-bold font-mono text-gray-100 mt-1">
            <LoadedValue status={ledgerStatus}>+{formatBDT(totalIncome)}</LoadedValue>
          </div>
        </div>

        <div className="bg-surface border border-line rounded p-3">
          <div className="text-xs text-gray-400">Total Expenses</div>
          <div className="text-lg font-bold font-mono text-gray-200 mt-1">
            <LoadedValue status={ledgerStatus}>-{formatBDT(totalExpense)}</LoadedValue>
          </div>
        </div>

        <div className="bg-surface border border-line rounded p-3">
          <div className="text-xs text-gray-400">Net Flow</div>
          <div className={`text-lg font-bold font-mono mt-1 ${ledgerStatus !== 'ready' || netCashFlow >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
            <LoadedValue status={ledgerStatus}>{formatBDT(netCashFlow, true)}</LoadedValue>
          </div>
        </div>
      </div>

      {/* Receivables & Payables */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="bg-surface border border-line rounded p-3 flex items-center justify-between">
          <div>
            <div className="text-xs text-gray-400">Receivables (Lent)</div>
            <div className="text-base font-semibold font-mono text-emerald-400 mt-0.5">
              <LoadedValue status={dataStatus}>{formatBDT(totalReceivables)}</LoadedValue>
            </div>
          </div>
          <button
            onClick={() => onNavigateTab('loans')}
            className="text-xs text-blue-400 hover:text-blue-300 font-medium"
          >
            Loans →
          </button>
        </div>

        <div className="bg-surface border border-line rounded p-3 flex items-center justify-between">
          <div>
            <div className="text-xs text-gray-400">Payables (Borrowed)</div>
            <div className="text-base font-semibold font-mono text-gray-200 mt-0.5">
              <LoadedValue status={dataStatus}>{formatBDT(totalPayables)}</LoadedValue>
            </div>
          </div>
          <button
            onClick={() => onNavigateTab('loans')}
            className="text-xs text-blue-400 hover:text-blue-300 font-medium"
          >
            Loans →
          </button>
        </div>
      </div>

      {/* Quick Entry Actions */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
        <button
          onClick={() => onOpenQuickAction('income')}
          className="flex items-center justify-center gap-2 p-2 bg-surface hover:bg-[#1f2229] border border-[#242730] rounded text-xs text-gray-200 transition-colors"
        >
          <ArrowDownLeft className="w-3.5 h-3.5 text-emerald-400" />
          <span>Income</span>
        </button>

        <button
          onClick={() => onOpenQuickAction('expense')}
          className="flex items-center justify-center gap-2 p-2 bg-surface hover:bg-[#1f2229] border border-[#242730] rounded text-xs text-gray-200 transition-colors"
        >
          <ArrowUpRight className="w-3.5 h-3.5 text-red-400" />
          <span>Expense</span>
        </button>

        <button
          onClick={() => onOpenQuickAction('daily_bulk')}
          className="flex items-center justify-center gap-2 p-2 bg-surface hover:bg-[#1f2229] border border-[#242730] rounded text-xs text-gray-200 transition-colors"
        >
          <FileSpreadsheet className="w-3.5 h-3.5 text-blue-400" />
          <span>Daily Expenses</span>
        </button>

        <button
          onClick={() => onOpenQuickAction('transfer')}
          className="flex items-center justify-center gap-2 p-2 bg-surface hover:bg-[#1f2229] border border-[#242730] rounded text-xs text-gray-200 transition-colors"
        >
          <ArrowLeftRight className="w-3.5 h-3.5 text-blue-400" />
          <span>Transfer</span>
        </button>

        <button
          onClick={() => onOpenQuickAction('loan')}
          className="flex items-center justify-center gap-2 p-2 bg-surface hover:bg-[#1f2229] border border-[#242730] rounded text-xs text-gray-200 transition-colors col-span-2 sm:col-span-1"
        >
          <HandCoins className="w-3.5 h-3.5 text-amber-400" />
          <span>Loan</span>
        </button>
      </div>

      {/* Main Standard Tables */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Table 1: Accounts Position */}
        <div className="bg-surface border border-line rounded overflow-hidden flex flex-col">
          <div className="p-3 border-b border-line bg-surface-sunken flex items-center justify-between">
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
                <tr className="border-b border-line bg-[#14161c] text-gray-400 text-[10px]">
                  <th className="py-2 px-3">Account</th>
                  <th className="py-2 px-3">Type</th>
                  <th className="py-2 px-3 text-right">Balance</th>
                  <th className="py-2 px-3 text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-divider">
                {dataStatus === 'loading' ? (
                  <TableLoadingRow colSpan={4} message="Loading accounts..." minHeightClass="min-h-[160px]" />
                ) : dataStatus === 'error' ? (
                  <TableErrorRow colSpan={4} title="Could not load accounts" onRetry={refreshData} minHeightClass="min-h-[160px]" />
                ) : accounts.length === 0 ? (
                  <TableEmptyRow
                    colSpan={4}
                    title="No accounts found"
                    minHeightClass="min-h-[160px]"
                  />
                ) : (
                  accounts.slice(0, 6).map((acc) => (
                    <tr key={acc.id} className="hover:bg-surface-hover">
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
        <div className="bg-surface border border-line rounded overflow-hidden flex flex-col">
          <div className="p-3 border-b border-line bg-surface-sunken flex items-center justify-between">
            <div className="flex items-center gap-2">
              <h3 className="text-xs font-semibold text-gray-200 uppercase tracking-wider">
                Recent Transactions
              </h3>
              {periodCount > 0 && (
                <span className="text-[10px] text-gray-400 font-mono">
                  ({recentTransactions.length} of {periodCount})
                </span>
              )}
            </div>
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
                <tr className="border-b border-line bg-[#14161c] text-gray-400 text-[10px]">
                  <th className="py-2 px-3">Date</th>
                  <th className="py-2 px-3">Description</th>
                  <th className="py-2 px-3">Account</th>
                  <th className="py-2 px-3 text-right">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-divider">
                {ledgerStatus === 'loading' ? (
                  <TableLoadingRow colSpan={4} message="Loading transactions..." minHeightClass="min-h-[160px]" />
                ) : ledgerStatus === 'error' ? (
                  <TableErrorRow colSpan={4} title="Could not load transactions" onRetry={refreshData} minHeightClass="min-h-[160px]" />
                ) : recentTransactions.length === 0 ? (
                  <TableEmptyRow
                    colSpan={4}
                    title="No transactions recorded"
                    minHeightClass="min-h-[160px]"
                  />
                ) : (
                  recentTransactions.map((tx) => (
                    <tr key={tx.id} className="hover:bg-surface-hover">
                      <td className="py-2 px-3 text-gray-400 font-mono text-[11px] whitespace-nowrap">
                        {formatDate(tx.date)}
                      </td>
                      <td className="py-2 px-3 text-gray-300 truncate max-w-[150px]">
                        {tx.description && tx.description !== 'Daily Expense' ? tx.description : ((tx as any).desc || (tx.category ? `${tx.category} Expense` : 'Transaction'))}
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
