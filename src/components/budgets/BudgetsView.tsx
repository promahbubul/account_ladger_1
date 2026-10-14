import React, { useState } from 'react';
import {
  Plus,
  AlertTriangle,
  Edit2,
  Trash2,
} from 'lucide-react';
import { useFinance } from '../../context/FinanceContext';
import { formatBDT } from '../../lib/formatters';
import { Modal, ConfirmModal } from '../common/Modal';

interface BudgetsViewProps {
  onSuccessNotification: (msg: string) => void;
  onNavigateTab: (tab: any) => void;
}

export const BudgetsView: React.FC<BudgetsViewProps> = ({
  onSuccessNotification,
  onNavigateTab,
}) => {
  const { budgets, transactions, categories, setCategoryBudget, deleteBudget } = useFinance();

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState('');
  const [budgetLimitInput, setBudgetLimitInput] = useState('');
  const [budgetToDelete, setBudgetToDelete] = useState<string | null>(null);

  const expenseCategories = categories.filter((c) => c.type === 'EXPENSE');

  // Compute spend metrics for all budgets
  const budgetDetails = budgets.map((b) => {
    const spent = transactions
      .filter((t) => t.type === 'EXPENSE' && t.category === b.categoryName)
      .reduce((sum, t) => sum + t.amount, 0);

    const percentage = b.monthlyLimit > 0 ? (spent / b.monthlyLimit) * 100 : 0;
    const remaining = b.monthlyLimit - spent;
    const isOver = spent > b.monthlyLimit;
    const isWarning = !isOver && percentage >= 80;

    return {
      categoryName: b.categoryName,
      limit: b.monthlyLimit,
      spent,
      remaining: Math.max(0, remaining),
      exceededBy: Math.max(0, spent - b.monthlyLimit),
      percentage,
      isOver,
      isWarning,
    };
  });

  const totalMonthlyBudget = budgets.reduce((acc, b) => acc + b.monthlyLimit, 0);
  const totalBudgetedSpent = budgetDetails.reduce((acc, b) => acc + b.spent, 0);
  const overBudgetCategories = budgetDetails.filter((b) => b.isOver);

  const handleOpenEdit = (categoryName: string, currentLimit: number) => {
    setSelectedCategory(categoryName);
    setBudgetLimitInput(currentLimit.toString());
    setIsModalOpen(true);
  };

  const handleOpenNew = () => {
    const defaultCat = expenseCategories[0]?.name || 'Food & Dining';
    setSelectedCategory(defaultCat);
    setBudgetLimitInput('10000');
    setIsModalOpen(true);
  };

  const handleSaveBudget = (e: React.FormEvent) => {
    e.preventDefault();
    const limit = parseFloat(budgetLimitInput);
    if (isNaN(limit) || limit <= 0) return;

    setCategoryBudget(selectedCategory, limit);
    onSuccessNotification(`Monthly budget for "${selectedCategory}" set to ${formatBDT(limit)}.`);
    setIsModalOpen(false);
  };

  const confirmDeleteBudget = () => {
    if (!budgetToDelete) return;
    deleteBudget(budgetToDelete);
    onSuccessNotification(`Budget for "${budgetToDelete}" removed.`);
    setBudgetToDelete(null);
  };

  return (
    <div className="space-y-4">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <h2 className="text-base font-semibold text-gray-100">Budgets</h2>
        <button
          onClick={handleOpenNew}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded text-xs font-medium self-start sm:self-auto transition-colors"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>Set Budget</span>
        </button>
      </div>

      {/* Active Over-Budget Alert Banner */}
      {overBudgetCategories.length > 0 && (
        <div className="bg-[#1f1618] border border-red-900/80 rounded p-3 text-xs flex items-start gap-2.5">
          <AlertTriangle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <span className="font-semibold text-red-200">
              Budget Alert: {overBudgetCategories.length} {overBudgetCategories.length === 1 ? 'Category Exceeded' : 'Categories Exceeded'} Allocated Monthly Limit
            </span>
            <div className="mt-1 space-y-1 text-gray-300">
              {overBudgetCategories.map((b) => (
                <div key={b.categoryName} className="flex items-center gap-2">
                  <span className="font-medium text-red-300">• {b.categoryName}:</span>
                  <span>Spent {formatBDT(b.spent)} of {formatBDT(b.limit)}</span>
                  <span className="font-mono text-red-400">(+{formatBDT(b.exceededBy)} over limit, {b.percentage.toFixed(0)}%)</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="bg-[#16181d] border border-[#22252c] rounded p-3">
          <div className="text-xs text-gray-400">Total Monthly Budget</div>
          <div className="text-lg font-semibold font-mono text-gray-100 mt-0.5">
            {formatBDT(totalMonthlyBudget)}
          </div>
        </div>

        <div className="bg-[#16181d] border border-[#22252c] rounded p-3">
          <div className="text-xs text-gray-400">Total Budgeted Spent</div>
          <div className="text-lg font-semibold font-mono text-gray-200 mt-0.5">
            {formatBDT(totalBudgetedSpent)}
          </div>
        </div>

        <div className="bg-[#16181d] border border-[#22252c] rounded p-3">
          <div className="text-xs text-gray-400">Categories Over Limit</div>
          <div className={`text-lg font-semibold font-mono mt-0.5 ${overBudgetCategories.length > 0 ? 'text-red-400' : 'text-emerald-400'}`}>
            {overBudgetCategories.length}
          </div>
        </div>
      </div>

      {/* Budgets Table */}
      <div className="bg-[#16181d] border border-[#22252c] rounded overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-[#22252c] bg-[#121417] text-gray-400 font-medium uppercase tracking-wider text-[10px]">
                <th className="py-2.5 px-3">Category</th>
                <th className="py-2.5 px-3 text-right">Monthly Limit</th>
                <th className="py-2.5 px-3 text-right">Spent to Date</th>
                <th className="py-2.5 px-3 text-right">Remaining / Over</th>
                <th className="py-2.5 px-3">Utilization</th>
                <th className="py-2.5 px-3 text-center">Status</th>
                <th className="py-2.5 px-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#20232a]">
              {budgetDetails.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-gray-500">
                    No category budgets defined yet.
                  </td>
                </tr>
              ) : (
                budgetDetails.map((b) => (
                  <tr key={b.categoryName} className="hover:bg-[#1a1d24] transition-colors">
                    <td className="py-2.5 px-3 font-medium text-gray-200">
                      {b.categoryName}
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono text-gray-300">
                      {formatBDT(b.limit)}
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono text-gray-200 font-medium">
                      {formatBDT(b.spent)}
                    </td>
                    <td className={`py-2.5 px-3 text-right font-mono font-medium ${
                      b.isOver ? 'text-red-400' : 'text-emerald-400'
                    }`}>
                      {b.isOver ? `+${formatBDT(b.exceededBy)}` : formatBDT(b.remaining)}
                    </td>
                    <td className="py-2.5 px-3 w-40">
                      <div className="flex items-center gap-2">
                        <div className="flex-1 bg-[#121417] h-1.5 rounded-full overflow-hidden border border-[#242730]">
                          <div
                            className={`h-full rounded-full ${
                              b.isOver ? 'bg-red-500' : b.isWarning ? 'bg-amber-400' : 'bg-blue-500'
                            }`}
                            style={{ width: `${Math.min(100, b.percentage)}%` }}
                          />
                        </div>
                        <span className="text-[11px] font-mono text-gray-400 w-8 text-right">
                          {b.percentage.toFixed(0)}%
                        </span>
                      </div>
                    </td>
                    <td className="py-2.5 px-3 text-center">
                      <span
                        className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-medium ${
                          b.isOver
                            ? 'bg-red-950/80 text-red-400 border border-red-800/60'
                            : b.isWarning
                            ? 'bg-amber-950/80 text-amber-300 border border-amber-800/60'
                            : 'bg-emerald-950/80 text-emerald-400 border border-emerald-800/60'
                        }`}
                      >
                        {b.isOver ? 'EXCEEDED' : b.isWarning ? 'WARNING' : 'HEALTHY'}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => handleOpenEdit(b.categoryName, b.limit)}
                          title="Edit Budget"
                          className="p-1 text-gray-400 hover:text-gray-200 hover:bg-[#22252e] rounded"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => setBudgetToDelete(b.categoryName)}
                          title="Remove Budget"
                          className="p-1 text-gray-400 hover:text-red-400 hover:bg-[#22252e] rounded"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="py-2 px-3 border-t border-[#22252c] bg-[#121417] text-gray-400 text-xs flex justify-between items-center">
          <span>{budgets.length} budgeted categories</span>
        </div>
      </div>

      {/* Set Budget Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title="Set Category Budget"
      >
        <form onSubmit={handleSaveBudget} className="space-y-3">
          <div>
            <label className="block text-xs text-gray-300 font-medium mb-1">
              Category *
            </label>
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="w-full bg-[#111317] border border-[#262932] rounded px-3 py-1.5 text-xs text-gray-200 focus:outline-none focus:border-blue-500"
            >
              {expenseCategories.map((c) => (
                <option key={c.id} value={c.name}>{c.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs text-gray-300 font-medium mb-1">
              Monthly Limit (৳ BDT) *
            </label>
            <input
              type="number"
              step="0.01"
              required
              value={budgetLimitInput}
              onChange={(e) => setBudgetLimitInput(e.target.value)}
              placeholder="e.g. 15000"
              className="w-full bg-[#111317] border border-[#262932] rounded px-3 py-1.5 text-xs text-gray-200 font-mono focus:outline-none focus:border-blue-500"
            />
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-[#22252c]">
            <button
              type="button"
              onClick={() => setIsModalOpen(false)}
              className="px-3 py-1.5 bg-[#1a1d24] hover:bg-[#222631] text-gray-300 rounded text-xs transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded text-xs font-medium transition-colors"
            >
              Save Budget
            </button>
          </div>
        </form>
      </Modal>

      {/* Delete Confirmation Modal */}
      <ConfirmModal
        isOpen={Boolean(budgetToDelete)}
        onClose={() => setBudgetToDelete(null)}
        onConfirm={confirmDeleteBudget}
        title="Remove Budget Limit"
        message={budgetToDelete ? `Remove the monthly budget limit for "${budgetToDelete}"?` : ''}
        confirmLabel="Remove"
        isDestructive={true}
      />
    </div>
  );
};
