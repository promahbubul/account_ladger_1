import React, { useState, useEffect } from 'react';
import {
  Download,
  Calendar,
} from 'lucide-react';
import { formatBDT } from '../../lib/formatters';
import { useFinance } from '../../context/FinanceContext';
import { useDateFilter } from '../../context/DateFilterContext';
import { Transaction } from '../../mock/data';
import { TableLoadingRow, TableEmptyRow } from '../common/StateViews';

export const ReportsView: React.FC = () => {
  const { transactions, accounts, budgets, authFetch } = useFinance();
  const { dateFilter } = useDateFilter();
  const [selectedPeriod, setSelectedPeriod] = useState<'MONTH' | 'LAST_MONTH' | 'YTD' | 'ALL'>('MONTH');
  const [reportTransactions, setReportTransactions] = useState<Transaction[]>(transactions);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    let active = true;
    const fetchReportData = async () => {
      try {
        setIsLoading(true);
        const params = new URLSearchParams();
        params.set('all', 'true');
        if (dateFilter.startDate) params.set('startDate', dateFilter.startDate);
        if (dateFilter.endDate) params.set('endDate', dateFilter.endDate);

        const res = await authFetch(`/api/transactions?${params.toString()}`);
        if (res.ok) {
          const data = await res.json();
          if (active) {
            setReportTransactions(data.items || data.transactions || []);
          }
        }
      } catch (err) {
        console.error('ReportsView fetch error:', err);
      } finally {
        if (active) setIsLoading(false);
      }
    };

    fetchReportData();
    return () => {
      active = false;
    };
  }, [authFetch, dateFilter.startDate, dateFilter.endDate]);

  const totalInflow = reportTransactions
    .filter((t) => t.direction === 'INFLOW')
    .reduce((sum, t) => sum + t.amount, 0);

  const totalOutflow = reportTransactions
    .filter((t) => t.direction === 'OUTFLOW')
    .reduce((sum, t) => sum + t.amount, 0);

  const netCashFlow = totalInflow - totalOutflow;
  const savingsRate = totalInflow > 0 ? ((netCashFlow / totalInflow) * 100).toFixed(1) : '0';

  // Category expense breakdown
  const expenseCatMap: Record<string, { count: number; spent: number }> = {};
  reportTransactions
    .filter((t) => t.type === 'EXPENSE')
    .forEach((t) => {
      const cat = t.category || 'Other Expenses';
      if (!expenseCatMap[cat]) expenseCatMap[cat] = { count: 0, spent: 0 };
      expenseCatMap[cat].count += 1;
      expenseCatMap[cat].spent += t.amount;
    });

  const expenseBreakdown = Object.entries(expenseCatMap)
    .map(([category, data]) => {
      const budget = budgets.find((b) => b.categoryName === category);
      const budgetLimit = budget ? budget.monthlyLimit : 0;
      const variance = budgetLimit > 0 ? budgetLimit - data.spent : 0;
      const percentage = totalOutflow > 0 ? ((data.spent / totalOutflow) * 100).toFixed(1) : '0';

      return {
        category,
        count: data.count,
        spent: data.spent,
        percentage,
        budgetLimit,
        variance,
      };
    })
    .sort((a, b) => b.spent - a.spent);

  // Account position table
  const accountBreakdown = accounts.map((acc) => {
    const accInflows = reportTransactions
      .filter((t) => t.accountId === acc.id && t.direction === 'INFLOW')
      .reduce((sum, t) => sum + t.amount, 0);

    const accOutflows = reportTransactions
      .filter((t) => t.accountId === acc.id && t.direction === 'OUTFLOW')
      .reduce((sum, t) => sum + t.amount, 0);

    const transfersIn = reportTransactions
      .filter((t) => t.type === 'TRANSFER' && t.destinationAccountId === acc.id)
      .reduce((sum, t) => sum + t.amount, 0);

    const transfersOut = reportTransactions
      .filter((t) => t.type === 'TRANSFER' && t.accountId === acc.id)
      .reduce((sum, t) => sum + t.amount, 0);

    const netChange = (accInflows + transfersIn) - (accOutflows + transfersOut);

    return {
      name: acc.name,
      type: acc.type,
      openingBalance: acc.openingBalance,
      inflows: accInflows + transfersIn,
      outflows: accOutflows + transfersOut,
      netChange,
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
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <h2 className="text-base font-semibold text-gray-100">Reports</h2>
          {dateFilter.formattedRangeLabel && (
            <span className="flex items-center gap-1 px-2 py-0.5 bg-blue-950/60 border border-blue-800 text-blue-300 rounded text-[11px] font-mono">
              <Calendar className="w-3 h-3" />
              {dateFilter.formattedRangeLabel}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center bg-[#16181d] border border-[#22252c] rounded p-0.5 text-xs">
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

      {/* Summary Row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="bg-[#16181d] border border-[#22252c] rounded p-3">
          <div className="text-xs text-gray-400">Total Inflows</div>
          <div className="text-lg font-semibold font-mono text-emerald-400 mt-0.5">
            +{formatBDT(totalInflow)}
          </div>
        </div>

        <div className="bg-[#16181d] border border-[#22252c] rounded p-3">
          <div className="text-xs text-gray-400">Total Outflows</div>
          <div className="text-lg font-semibold font-mono text-gray-200 mt-0.5">
            -{formatBDT(totalOutflow)}
          </div>
        </div>

        <div className="bg-[#16181d] border border-[#22252c] rounded p-3">
          <div className="text-xs text-gray-400">Net Surplus / Flow</div>
          <div className={`text-lg font-semibold font-mono mt-0.5 ${netCashFlow >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
            {formatBDT(netCashFlow, true)}
          </div>
        </div>

        <div className="bg-[#16181d] border border-[#22252c] rounded p-3">
          <div className="text-xs text-gray-400">Savings Margin</div>
          <div className="text-lg font-semibold font-mono text-blue-400 mt-0.5">
            {savingsRate}%
          </div>
        </div>
      </div>

      {/* Expense Category Breakdown Table */}
      <div className="bg-[#16181d] border border-[#22252c] rounded overflow-hidden">
        <div className="p-3 border-b border-[#22252c] bg-[#121417]">
          <h3 className="text-xs font-semibold text-gray-200 uppercase tracking-wider">
            Expense Category Breakdown
          </h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-[#22252c] bg-[#14161c] text-gray-400 text-[10px] uppercase">
                <th className="py-2.5 px-3">Category</th>
                <th className="py-2.5 px-3 text-right">Transactions</th>
                <th className="py-2.5 px-3 text-right">Total Spent</th>
                <th className="py-2.5 px-3 text-right">Share of Outflow</th>
                <th className="py-2.5 px-3 text-right">Monthly Budget</th>
                <th className="py-2.5 px-3 text-right">Variance</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#20232a]">
              {isLoading ? (
                <TableLoadingRow
                  colSpan={6}
                  message="Compiling report data..."
                />
              ) : expenseBreakdown.length === 0 ? (
                <TableEmptyRow
                  colSpan={6}
                  title="No expense records available"
                  description="No expenditures found for this period to display in the breakdown."
                />
              ) : (
                expenseBreakdown.map((row) => (
                  <tr key={row.category} className="hover:bg-[#1a1d24]">
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
      <div className="bg-[#16181d] border border-[#22252c] rounded overflow-hidden">
        <div className="p-3 border-b border-[#22252c] bg-[#121417]">
          <h3 className="text-xs font-semibold text-gray-200 uppercase tracking-wider">
            Account Balances & Flow Movements
          </h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-[#22252c] bg-[#14161c] text-gray-400 text-[10px] uppercase">
                <th className="py-2.5 px-3">Account</th>
                <th className="py-2.5 px-3">Type</th>
                <th className="py-2.5 px-3 text-right">Opening Balance</th>
                <th className="py-2.5 px-3 text-right">Inflows & Transfers In</th>
                <th className="py-2.5 px-3 text-right">Outflows & Transfers Out</th>
                <th className="py-2.5 px-3 text-right">Net Change</th>
                <th className="py-2.5 px-3 text-right">Current Balance</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#20232a]">
              {accountBreakdown.map((row) => (
                <tr key={row.name} className="hover:bg-[#1a1d24]">
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
