import React, { useRef } from 'react';
import { Plus, Trash2, X } from 'lucide-react';
import { formatBDT, parseAmount } from '../../lib/formatters';

interface ExpenseCategory {
  id: string;
  name: string;
  subcategories?: string[];
  parentId?: string | null;
  isArchived?: boolean;
}

export interface ExpenseRow {
  key: string;
  subcategory: string;
  description: string;
  amount: string;
}

export interface ExpenseGroup {
  key: string;
  categoryId: string;
  rows: ExpenseRow[];
}

const newKey = () => `${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
const newRow = (): ExpenseRow => ({ key: newKey(), subcategory: '', description: '', amount: '' });
export const newExpenseGroups = (): ExpenseGroup[] => [{ key: newKey(), categoryId: '', rows: [newRow()] }];

const isBlankRow = (row: ExpenseRow) => !row.amount.trim() && !row.description.trim() && !row.subcategory;
const groupTotal = (group: ExpenseGroup) => group.rows.reduce((sum, row) => sum + (parseAmount(row.amount) || 0), 0);

export const expenseGroupsTotal = (groups: ExpenseGroup[]) => groups.reduce((sum, group) => sum + groupTotal(group), 0);

export const selectableExpenseCategories = (categories: ExpenseCategory[]) =>
  categories.filter((c) => !c.parentId && !c.isArchived);

// Turns the form into API items, or explains the first thing that stops it being saved.
export const buildExpenseItems = (groups: ExpenseGroup[], categories: ExpenseCategory[]) => {
  const items: { category: string; subcategory?: string; description: string; desc: string; amount: number }[] = [];
  for (const group of groups) {
    const filled = group.rows.filter((row) => !isBlankRow(row));
    if (filled.length === 0) continue;
    const category = categories.find((c) => c.id === group.categoryId);
    if (!category) return { items: [], error: 'Please select a category for every group that has expenses.' };
    for (const row of filled) {
      const amount = parseAmount(row.amount);
      if (amount === null) return { items: [], error: `Enter a valid amount for every ${category.name} expense.` };
      const description = row.description.trim() || `${category.name} Expense`;
      items.push({ category: category.name, subcategory: row.subcategory || undefined, description, desc: description, amount });
    }
  }
  if (items.length === 0) return { items: [], error: 'Please add at least one expense with an amount.' };
  return { items, error: null };
};

// One id per distinct payload, so resending after a lost response cannot save the batch twice.
export const useBatchId = () => {
  const ref = useRef({ signature: '', id: '' });
  return (payload: unknown) => {
    const signature = JSON.stringify(payload);
    if (ref.current.signature !== signature) ref.current = { signature, id: newKey() };
    return ref.current.id;
  };
};

const FIELD = 'w-full bg-app border border-line-strong rounded px-2.5 py-1.5 text-xs text-gray-200 focus:outline-none focus:border-blue-500';

export const CategoryExpenseGroups: React.FC<{
  groups: ExpenseGroup[];
  onChange: (groups: ExpenseGroup[]) => void;
  categories: ExpenseCategory[];
}> = ({ groups, onChange, categories }) => {
  const updateGroup = (key: string, changes: Partial<ExpenseGroup>) =>
    onChange(groups.map((group) => (group.key === key ? { ...group, ...changes } : group)));
  const updateRow = (group: ExpenseGroup, rowKey: string, changes: Partial<ExpenseRow>) =>
    updateGroup(group.key, { rows: group.rows.map((row) => (row.key === rowKey ? { ...row, ...changes } : row)) });

  return (
    <div className="space-y-3">
      {groups.map((group) => {
        const usedElsewhere = groups.filter((g) => g.key !== group.key).map((g) => g.categoryId);
        const options = categories.filter((c) => !usedElsewhere.includes(c.id));
        const subcategories = categories.find((c) => c.id === group.categoryId)?.subcategories || [];

        return (
          <div key={group.key} className="border border-line rounded bg-surface">
            <div className="flex items-center gap-2 p-3 border-b border-line bg-surface-sunken">
              <select
                aria-label="Category"
                value={group.categoryId}
                onChange={(e) =>
                  updateGroup(group.key, {
                    categoryId: e.target.value,
                    // Subcategories belong to the previous category, so they cannot carry over.
                    rows: group.rows.map((row) => ({ ...row, subcategory: '' })),
                  })
                }
                className={`${FIELD} sm:max-w-xs font-medium`}
              >
                <option value="">Select a category</option>
                {options.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
              <span className="ml-auto text-xs text-gray-400 whitespace-nowrap">
                Subtotal: <span className="font-mono font-semibold text-gray-100">{formatBDT(groupTotal(group))}</span>
              </span>
              {groups.length > 1 && (
                <button
                  type="button"
                  aria-label="Remove category"
                  onClick={() => onChange(groups.filter((g) => g.key !== group.key))}
                  className="p-1 text-gray-500 hover:text-red-400 rounded"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            <div className="divide-y divide-divider">
              {group.rows.map((row) => (
                <div key={row.key} className="grid grid-cols-12 gap-2 p-2.5 items-center">
                  <input
                    type="text"
                    aria-label="Description"
                    placeholder="Description"
                    value={row.description}
                    onChange={(e) => updateRow(group, row.key, { description: e.target.value })}
                    className={`${FIELD} col-span-12 ${subcategories.length > 0 ? 'sm:col-span-5' : 'sm:col-span-8'}`}
                  />
                  {subcategories.length > 0 && (
                    <select
                      aria-label="Subcategory"
                      value={row.subcategory}
                      onChange={(e) => updateRow(group, row.key, { subcategory: e.target.value })}
                      className={`${FIELD} col-span-12 sm:col-span-3`}
                    >
                      <option value="">Subcategory (optional)</option>
                      {subcategories.map((name) => (
                        <option key={name} value={name}>{name}</option>
                      ))}
                    </select>
                  )}
                  <input
                    type="text"
                    inputMode="decimal"
                    aria-label="Amount"
                    placeholder="0.00"
                    value={row.amount}
                    onChange={(e) => updateRow(group, row.key, { amount: e.target.value })}
                    className={`${FIELD} col-span-10 sm:col-span-3 font-mono text-right`}
                  />
                  <button
                    type="button"
                    aria-label="Remove expense"
                    disabled={group.rows.length <= 1}
                    onClick={() => updateGroup(group.key, { rows: group.rows.filter((r) => r.key !== row.key) })}
                    className="col-span-2 sm:col-span-1 justify-self-center p-1 text-gray-500 hover:text-red-400 rounded disabled:opacity-30"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>

            <div className="p-2.5 border-t border-line">
              <button
                type="button"
                onClick={() => updateGroup(group.key, { rows: [...group.rows, newRow()] })}
                className="inline-flex items-center gap-1 text-xs font-medium text-blue-400 hover:text-blue-300"
              >
                <Plus className="w-3.5 h-3.5" />
                Add expense
              </button>
            </div>
          </div>
        );
      })}

      <div className="flex items-center justify-between">
        <button
          type="button"
          disabled={groups.length >= categories.length}
          onClick={() => onChange([...groups, { key: newKey(), categoryId: '', rows: [newRow()] }])}
          className="px-3 py-1.5 bg-field hover:bg-surface-raised disabled:opacity-40 text-gray-300 rounded text-xs border border-field-line"
        >
          + Add Another Category
        </button>
        <div className="text-right">
          <span className="text-xs text-gray-400 mr-2">Total:</span>
          <span className="text-sm font-bold font-mono text-gray-100">{formatBDT(expenseGroupsTotal(groups))}</span>
        </div>
      </div>
    </div>
  );
};
