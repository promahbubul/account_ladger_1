import React, { useState, useEffect } from 'react';
import { BarList } from '../charts/BarList';
import { MonthlyBars, MonthTotals } from '../charts/MonthlyBars';
import {
  Download,
  Calendar,
} from 'lucide-react';
import { formatBDT } from '../../lib/formatters';
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

interface ReportAnalytics {
  byCategory: { name: string; amount: number; count: number }[];
  totals: { inflow: number; outflow: number };
  byAccount: { accountId: string; inflow: number; outflow: number }[];
  monthly: MonthTotals[];
}

export const ReportsView: React.FC = () => {
  const { accounts, budgets, authFetch, dataStatus, refreshData, ledgerVersion } = useFinance();
  const { dateFilter, formattedRangeLabel } = useDateFilter();
  const [selectedPeriod, setSelectedPeriod] = useState<'MONTH' | 'LAST_MONTH' | 'YTD' | 'ALL'>('MONTH');
  const [analytics, setAnalytics] = useState<ReportAnalytics | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [reportFailed, setReportFailed] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  // Every figure on this page is summed by the server for the selected period. The 12-month trend
  // ends at the period's end.
  useEffect(() => {
    let active = true;
    setIsLoading(true);
    setReportFailed(false);
    const params = new URLSearchParams();
    if (dateFilter.startDate) params.set('startDate', dateFilter.startDate);
    if (dateFilter.endDate) params.set('endDate', dateFilter.endDate);
    authFetch(`/api/reports/analytics?${params.toString()}`)
      .then(async (res) => {
        if (!res.ok) throw new Error('Could not load the report.');
        const data = await res.json();
        if (active) setAnalytics(data);
      })
      .catch((err) => {
        console.error('ReportsView fetch error:', err);
        if (active) setReportFailed(true);
      })
      .finally(() => {
        if (active) setIsLoading(false);
      });
    return () => {
      active = false;
    };
  }, [authFetch, dateFilter.startDate, dateFilter.endDate, reloadKey, ledgerVersion]);

  const reportStatus: DataStatus = isLoading ? 'loading' : reportFailed ? 'error' : 'ready';
  const monthlyTotals = analytics?.monthly || [];
  const monthlyStatus = reportStatus;
  // The account table also needs the accounts held in the finance context.
  const accountTableStatus: DataStatus =
    reportStatus === 'ready' ? dataStatus : reportStatus;
  const retryReport = () => {
    setReloadKey((key) => key + 1);
    if (dataStatus === 'error') refreshData();
  };

  const totalInflow = analytics?.totals?.inflow ?? 0;
  const totalOutflow = analytics?.totals?.outflow ?? 0;

  const netCashFlow = totalInflow - totalOutflow;
  const savingsRate = totalInflow > 0 ? ((netCashFlow / totalInflow) * 100).toFixed(1) : '0';

  // Category expense breakdown, already sorted by amount on the server
  const expenseBreakdown = (analytics?.byCategory || []).map((row) => {
    const budget = budgets.find((b) => b.categoryName === row.name);
    const budgetLimit = budget ? budget.monthlyLimit : 0;
    const variance = budgetLimit > 0 ? budgetLimit - row.amount : 0;
    const percentage = totalOutflow > 0 ? ((row.amount / totalOutflow) * 100).toFixed(1) : '0';

    return {
      category: row.name,
      count: row.count,
      spent: row.amount,
      percentage,
      budgetLimit,
      variance,
    };
  });

  // Account position table. The server's inflow and outflow already include legacy transfer rows.
  const flowsByAccount = new Map((analytics?.byAccount || []).map((row) => [row.accountId, row]));
  const accountBreakdown = accounts.map((acc) => {
    const flows = flowsByAccount.get(acc.id);
    const inflows = flows?.inflow ?? 0;
    const outflows = flows?.outflow ?? 0;

    return {
      name: acc.name,
      type: acc.type,
      openingBalance: acc.openingBalance,
      inflows,
      outflows,
      netChange: inflows - outflows,
      endingBalance: acc.currentBalance,
    };
  });

  const handleExportCSVReport = () => {
    let csv = '=== ACCOUNT LADGER FINANCIAL REPORT ===\n';
    csv += `Period: ${selectedPeriod}\nGenerated: ${new Date().toLocaleDateString()}\n\n`;

    csv += '--- CASH FLOW SUMMARY ---\n';
    csv += `Total Inflows,${totalInflow}\nTotal Outflows,${totalOutflow}\nNet Cash Flow,${netCashFlow}\nSavings Margin,${savingsRate}%\n\n`;

    csv += '--- EXPENSE CATEGORY BREAKDOWN ---\nCategory,Tx Count,Total Spent,Percent of Total,Monthly Budget,Variance\n';
    expenseBreakdown.forEach((e) => {
      csv += `"${e.category}",${e.count},${e.spent},${e.percentage}%,${e.budgetLimit},${e.variance}\n`;
    });

    csv += '\n--- ACCOUNT BALANCES POSITION ---\nAccount Name,Type,Opening Balance,Total Inflow,Total Outflow,Net Change,Ending Balance\n';
    accountBreakdown.forEach((a) => {
      csv += `"${a.name}","${a.type}",${a.openingBalance},${a.inflows},${a.outflows},${a.netChange},${a.endingBalance}\n`;
    });

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `accountladger_financial_report_${Date.now()}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-4 w-full min-w-0">
      {/* Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 flex-shrink-0">
        <div>
          {formattedRangeLabel && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-950/60 border border-blue-800 text-blue-300 rounded text-[11px] font-mono">
              <Calendar className="w-3 h-3" />
              {formattedRangeLabel}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center bg-surface border border-line rounded p-0.5 text-xs">
            {(['MONTH', 'LAST_MONTH', 'YTD', 'ALL'] as const).map((p) => (
              <button
                key={p}
                onClick={() => setSelectedPeriod(p)}
                className={`px-2.5 py-1 rounded text-xs transition-colors ${
                  selectedPeriod === p
                    ? 'bg-[#252934] text-gray-100 font-medium'
                    : 'text-gray-400 hover:text-gray-200'
                }`}
              >
                {p === 'MONTH' && 'This Month'}
                {p === 'LAST_MONTH' && 'Last Month'}
                {p === 'YTD' && 'Year to Date'}
                {p === 'ALL' && 'All Time'}
              </button>
            ))}
          </div>

          <button
            onClick={handleExportCSVReport}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-[#1e222a] hover:bg-[#262b35] text-gray-200 rounded text-xs font-medium border border-[#2e323d] transition-colors"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export CSV</span>
          </button>
        </div>
      </div>

      {(reportStatus === 'error' || dataStatus === 'error') && (
        <DataLoadErrorBanner message="Could not load this report." onRetry={retryReport} />
      )}

      {/* Summary Row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="bg-surface border border-line rounded p-3">
          <div className="text-xs text-gray-400">Total Inflows</div>
          <div className="text-lg font-semibold font-mono text-emerald-400 mt-0.5">
            <LoadedValue status={reportStatus}>+{formatBDT(totalInflow)}</LoadedValue>
          </div>
        </div>

        <div className="bg-surface border border-line rounded p-3">
          <div className="text-xs text-gray-400">Total Outflows</div>
          <div className="text-lg font-semibold font-mono text-gray-200 mt-0.5">
            <LoadedValue status={reportStatus}>-{formatBDT(totalOutflow)}</LoadedValue>
          </div>
        </div>

        <div className="bg-surface border border-line rounded p-3">
          <div className="text-xs text-gray-400">Net Flow</div>
          <div className={`text-lg font-semibold font-mono mt-0.5 ${reportStatus !== 'ready' || netCashFlow >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
            <LoadedValue status={reportStatus}>{formatBDT(netCashFlow, true)}</LoadedValue>
          </div>
        </div>

        <div className="bg-surface border border-line rounded p-3">
          <div className="text-xs text-gray-400">Savings Margin</div>
          <div className="text-lg font-semibold font-mono text-blue-400 mt-0.5">
            <LoadedValue status={reportStatus}>{savingsRate}%</LoadedValue>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        <div className="bg-surface border border-line rounded p-3">
          <h3 className="text-xs font-semibold text-gray-200 uppercase tracking-wider mb-3">Expense by Category</h3>
          {reportStatus === 'error' ? (
            <p className="text-xs text-gray-500 py-2">—</p>
          ) : (
            <BarList
              rows={expenseBreakdown.map((row) => ({ key: row.category, label: row.category, value: row.spent }))}
              isLoading={reportStatus === 'loading'}
              emptyMessage="No expenses in this period."
            />
          )}
        </div>
        <div className="bg-surface border border-line rounded p-3">
          <h3 className="text-xs font-semibold text-gray-200 uppercase tracking-wider mb-3">Income vs Expense, Last 12 Months</h3>
          {monthlyStatus === 'error' ? (
            <button type="button" onClick={retryReport} className="text-xs font-medium text-blue-400 hover:text-blue-300">
              Could not load this chart. Retry
            </button>
          ) : (
            <MonthlyBars months={monthlyTotals} isLoading={monthlyStatus === 'loading'} />
          )}
        </div>
      </div>

      {/* Expense Category Breakdown Table */}
      <div className="bg-surface border border-line rounded overflow-hidden">
        <div className="p-3 border-b border-line bg-surface-sunken">
          <h3 className="text-xs font-semibold text-gray-200 uppercase tracking-wider">
            Expense Categories
          </h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-line bg-[#14161c] text-gray-400 text-[10px] uppercase">
                <th className="py-2.5 px-3">Category</th>
                <th className="py-2.5 px-3 text-right">Transactions</th>
                <th className="py-2.5 px-3 text-right">Total Spent</th>
                <th className="py-2.5 px-3 text-right">Share of Outflow</th>
                <th className="py-2.5 px-3 text-right">Monthly Budget</th>
                <th className="py-2.5 px-3 text-right">Variance</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-divider">
              {isLoading ? (
                <TableLoadingRow
                  colSpan={6}
                  message="Compiling report data..."
                />
              ) : reportFailed ? (
                <TableErrorRow colSpan={6} title="Could not load expenses" onRetry={retryReport} />
              ) : expenseBreakdown.length === 0 ? (
                <TableEmptyRow
                  colSpan={6}
                  title="No expense records available"
                />
              ) : (
                expenseBreakdown.map((row) => (
                  <tr key={row.category} className="hover:bg-surface-hover">
                    <td className="py-2.5 px-3 font-medium text-gray-200">
                      {row.category}
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono text-gray-400">
                      {row.count}
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono font-semibold text-gray-100">
                      {formatBDT(row.spent)}
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono text-gray-300">
                      {row.percentage}%
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono text-gray-400">
                      {row.budgetLimit > 0 ? formatBDT(row.budgetLimit) : '-'}
                    </td>
                    <td className={`py-2.5 px-3 text-right font-mono ${
                      row.variance < 0 ? 'text-red-400 font-semibold' : 'text-gray-400'
                    }`}>
                      {row.budgetLimit > 0 ? formatBDT(row.variance) : '-'}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Account Positions Table */}
      <div className="bg-surface border border-line rounded overflow-hidden">
        <div className="p-3 border-b border-line bg-surface-sunken">
          <h3 className="text-xs font-semibold text-gray-200 uppercase tracking-wider">
            Account Balances & Flows
          </h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-line bg-[#14161c] text-gray-400 text-[10px] uppercase">
                <th className="py-2.5 px-3">Account</th>
                <th className="py-2.5 px-3">Type</th>
                <th className="py-2.5 px-3 text-right">Opening Balance</th>
                <th className="py-2.5 px-3 text-right">Total Inflows</th>
                <th className="py-2.5 px-3 text-right">Total Outflows</th>
                <th className="py-2.5 px-3 text-right">Net Change</th>
                <th className="py-2.5 px-3 text-right">Current Balance</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-divider">
              {accountTableStatus === 'loading' ? (
                <TableLoadingRow colSpan={7} message="Loading account positions..." />
              ) : accountTableStatus === 'error' ? (
                <TableErrorRow colSpan={7} title="Could not load account positions" onRetry={retryReport} />
              ) : accountBreakdown.map((row) => (
                <tr key={row.name} className="hover:bg-surface-hover">
                  <td className="py-2.5 px-3 font-medium text-gray-200">
                    {row.name}
                  </td>
                  <td className="py-2.5 px-3 text-gray-400">
                    {row.type}
                  </td>
                  <td className="py-2.5 px-3 text-right font-mono text-gray-400">
                    {formatBDT(row.openingBalance)}
                  </td>
                  <td className="py-2.5 px-3 text-right font-mono text-emerald-400">
                    +{formatBDT(row.inflows)}
                  </td>
                  <td className="py-2.5 px-3 text-right font-mono text-gray-200">
                    -{formatBDT(row.outflows)}
                  </td>
                  <td className={`py-2.5 px-3 text-right font-mono font-medium ${
                    row.netChange >= 0 ? 'text-emerald-400' : 'text-red-400'
                  }`}>
                    {formatBDT(row.netChange, true)}
                  </td>
                  <td className="py-2.5 px-3 text-right font-mono font-bold text-gray-100">
                    {formatBDT(row.endingBalance)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
