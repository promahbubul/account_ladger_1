import React, { useState, useEffect, useCallback } from 'react';
import {
  Plus,
  Search,
  Edit2,
  Archive,
  ArchiveRestore,
  Trash2,
  FolderPlus,
} from 'lucide-react';
import { useFinance } from '../../context/FinanceContext';
import { formatBDT } from '../../lib/formatters';
import { Category } from '../../mock/data';
import { Modal, ConfirmModal } from '../common/Modal';
import { TablePagination } from '../common/TablePagination';
import { useCursorPagination } from '../../hooks/useCursorPagination';

interface CategoriesViewProps {
  onSuccessNotification: (msg: string) => void;
}

export const CategoriesView: React.FC<CategoriesViewProps> = ({ onSuccessNotification }) => {
  const {
    transactions,
    budgets,
    addCategory,
    editCategory,
    addSubcategory,
    toggleArchiveCategory,
    deleteCategory,
    setCategoryBudget,
    authFetch,
  } = useFinance();

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<'ALL' | 'EXPENSE' | 'INCOME'>('ALL');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'ACTIVE' | 'ARCHIVED'>('ACTIVE');

  // Modals
  const [isAddCatOpen, setIsAddCatOpen] = useState(false);
  const [editCat, setEditCat] = useState<Category | null>(null);
  const [subcatModalCat, setSubcatModalCat] = useState<Category | null>(null);
  const [newSubcatName, setNewSubcatName] = useState('');
  const [catToDelete, setCatToDelete] = useState<Category | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  // Add category form
  const [newCatName, setNewCatName] = useState('');
  const [newCatType, setNewCatType] = useState<'EXPENSE' | 'INCOME'>('EXPENSE');
  const [initialSubcats, setInitialSubcats] = useState('');
  const [initialBudget, setInitialBudget] = useState('');

  // Pagination state
  const [items, setItems] = useState<Category[]>([]);
  const [totalCount, setTotalCount] = useState<number>(0);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const {
    pageSize,
    cursor,
    pageIndex,
    hasNextPage,
    hasPreviousPage,
    setPageSize,
    goToNextPage,
    goToPreviousPage,
    resetPagination,
    setPaginationMeta,
  } = useCursorPagination({ initialPageSize: 50 });

  const fetchCategories = useCallback(async () => {
    try {
      setIsLoading(true);
      setErrorMsg(null);

      const params = new URLSearchParams();
      params.set('paginate', 'true');
      params.set('limit', String(pageSize));
      if (cursor) params.set('cursor', cursor);
      if (searchQuery.trim()) params.set('search', searchQuery.trim());
      if (typeFilter !== 'ALL') params.set('type', typeFilter);
      if (statusFilter !== 'ALL') params.set('status', statusFilter);

      const res = await authFetch(`/api/categories?${params.toString()}`);
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Failed to load categories');
      }

      const data = await res.json();
      setItems(data.items || []);
      setTotalCount(data.totalCount ?? (data.items || []).length);
      setNextCursor(data.nextCursor || null);
      setPaginationMeta({
        hasNextPage: Boolean(data.hasNextPage),
        hasPreviousPage: Boolean(data.hasPreviousPage),
      });
    } catch (err: any) {
      console.error('Fetch categories error:', err);
      setErrorMsg(err.message || 'Error fetching categories');
    } finally {
      setIsLoading(false);
    }
  }, [authFetch, pageSize, cursor, searchQuery, typeFilter, statusFilter, setPaginationMeta]);

  useEffect(() => {
    fetchCategories();
  }, [fetchCategories]);

  const handleSearchChange = (val: string) => {
    setSearchQuery(val);
    resetPagination();
  };

  const handleTypeChange = (val: 'ALL' | 'EXPENSE' | 'INCOME') => {
    setTypeFilter(val);
    resetPagination();
  };

  const handleStatusChange = (val: 'ALL' | 'ACTIVE' | 'ARCHIVED') => {
    setStatusFilter(val);
    resetPagination();
  };

  const handleCreateCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCatName.trim()) return;

    const subArr = initialSubcats
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);

    await addCategory({
      name: newCatName.trim(),
      type: newCatType,
      icon: 'Tag',
      color: '#4B5563',
      subcategories: subArr,
      isArchived: false,
    });

    if (newCatType === 'EXPENSE' && initialBudget && parseFloat(initialBudget) > 0) {
      await setCategoryBudget(newCatName.trim(), parseFloat(initialBudget));
    }

    onSuccessNotification(`Category "${newCatName}" added.`);
    setIsAddCatOpen(false);
    setNewCatName('');
    setInitialSubcats('');
    setInitialBudget('');
    resetPagination();
    fetchCategories();
  };

  const handleUpdateCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editCat) return;

    await editCategory(editCat.id, {
      name: editCat.name,
      type: editCat.type,
      color: editCat.color,
      icon: editCat.icon,
      subcategories: editCat.subcategories,
    });

    onSuccessNotification(`Category "${editCat.name}" updated.`);
    setEditCat(null);
    fetchCategories();
  };

  const handleAddSubcat = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!subcatModalCat || !newSubcatName.trim()) return;

    await addSubcategory(subcatModalCat.id, newSubcatName.trim());
    onSuccessNotification(`Added "${newSubcatName}" to ${subcatModalCat.name}.`);
    setSubcatModalCat(null);
    setNewSubcatName('');
    fetchCategories();
  };

  const handleToggleArchive = async (cat: Category) => {
    await toggleArchiveCategory(cat.id);
    onSuccessNotification(cat.isArchived ? `Restored category "${cat.name}".` : `Archived category "${cat.name}".`);
    fetchCategories();
  };

  const confirmDelete = async () => {
    if (!catToDelete) return;
    const res = await deleteCategory(catToDelete.id);
    if (!res.success) {
      setActionError(res.error || 'Failed to delete category.');
      return;
    }

    onSuccessNotification(`Category "${catToDelete.name}" deleted.`);
    setCatToDelete(null);
    setActionError(null);
    fetchCategories();
  };

  return (
    <div className="h-full flex flex-col min-h-0 space-y-3">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 flex-shrink-0">
        <div>
          <h2 className="text-base font-semibold text-gray-100">Categories & Taxonomies</h2>
          <p className="text-xs text-gray-400">Classify inflows and outflows across your ledger</p>
        </div>
        <button
          onClick={() => setIsAddCatOpen(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded text-xs font-medium self-start sm:self-auto transition-colors"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>Add Category</span>
        </button>
      </div>

      {/* Toolbar */}
      <div className="bg-[#16181d] border border-[#22252c] rounded p-2.5 flex flex-col md:flex-row items-center justify-between gap-2.5 flex-shrink-0">
        <div className="relative w-full md:w-72">
          <Search className="w-3.5 h-3.5 text-gray-400 absolute left-2.5 top-2.5" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => handleSearchChange(e.target.value)}
            placeholder="Search categories or subcategories..."
            className="w-full bg-[#111317] border border-[#262932] rounded pl-8 pr-3 py-1.5 text-xs text-gray-200 focus:outline-none focus:border-blue-500 placeholder-gray-500"
          />
        </div>

        <div className="flex items-center gap-2 w-full md:w-auto text-xs">
          <select
            value={typeFilter}
            onChange={(e) => handleTypeChange(e.target.value as any)}
            className="bg-[#111317] border border-[#262932] rounded px-2.5 py-1.5 text-xs text-gray-300 focus:outline-none focus:border-blue-500"
          >
            <option value="ALL">All Categories</option>
            <option value="EXPENSE">Expense Categories</option>
            <option value="INCOME">Income Categories</option>
          </select>

          <select
            value={statusFilter}
            onChange={(e) => handleStatusChange(e.target.value as any)}
            className="bg-[#111317] border border-[#262932] rounded px-2.5 py-1.5 text-xs text-gray-300 focus:outline-none focus:border-blue-500"
          >
            <option value="ACTIVE">Active Categories</option>
            <option value="ARCHIVED">Archived Categories</option>
            <option value="ALL">All Statuses</option>
          </select>
        </div>
      </div>

      {actionError && (
        <div className="p-2.5 bg-red-950/40 border border-red-800/60 rounded text-xs text-red-300 flex-shrink-0">
          {actionError}
        </div>
      )}

      {errorMsg && (
        <div className="p-2.5 bg-red-950/40 border border-red-800/60 rounded text-xs text-red-300 flex-shrink-0">
          {errorMsg}
        </div>
      )}

      {/* Categories Table */}
      <div className="bg-[#16181d] border border-[#22252c] rounded overflow-hidden flex-1 min-h-0 flex flex-col">
        <div className="flex-1 min-h-0 overflow-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead className="sticky top-0 z-10 bg-[#121417] shadow-sm">
              <tr className="border-b border-[#22252c] text-gray-400 font-medium uppercase tracking-wider text-[10px]">
                <th className="py-2.5 px-3">Category Name</th>
                <th className="py-2.5 px-3">Type</th>
                <th className="py-2.5 px-3">Subcategories</th>
                <th className="py-2.5 px-3 text-right">Monthly Budget</th>
                <th className="py-2.5 px-3 text-right">Transactions</th>
                <th className="py-2.5 px-3 text-right">Volume</th>
                <th className="py-2.5 px-3 text-center">Status</th>
                <th className="py-2.5 px-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#20232a]">
              {items.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-gray-500">
                    {isLoading ? 'Loading categories...' : 'No categories found.'}
                  </td>
                </tr>
              ) : (
                items.map((c) => {
                  const txList = transactions.filter((t) => t.category === c.name);
                  const txCount = txList.length;
                  const totalVolume = txList.reduce((sum, t) => sum + t.amount, 0);
                  const budget = budgets.find((b) => b.categoryName === c.name);

                  return (
                    <tr key={c.id} className="hover:bg-[#1a1d24] transition-colors">
                      <td className="py-2.5 px-3 font-medium text-gray-200">
                        {c.name}
                      </td>
                      <td className="py-2.5 px-3">
                        <span
                          className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-medium ${
                            c.type === 'INCOME'
                              ? 'bg-emerald-950/80 text-emerald-400 border border-emerald-800/60'
                              : 'bg-gray-800 text-gray-300 border border-gray-700'
                          }`}
                        >
                          {c.type}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-gray-400">
                        <div className="flex flex-wrap items-center gap-1 max-w-xs">
                          {c.subcategories && c.subcategories.length > 0 ? (
                            c.subcategories.map((sub, idx) => (
                              <span
                                key={idx}
                                className="px-1.5 py-0.5 rounded bg-[#111317] border border-[#242730] text-[11px] text-gray-300"
                              >
                                {sub}
                              </span>
                            ))
                          ) : (
                            <span className="text-gray-500 text-[11px]">None</span>
                          )}
                        </div>
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono text-gray-300">
                        {budget ? formatBDT(budget.monthlyLimit) : '-'}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono text-gray-400">
                        {txCount}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono text-gray-200 font-medium">
                        {formatBDT(totalVolume)}
                      </td>
                      <td className="py-2.5 px-3 text-center">
                        <span
                          className={`inline-block px-1.5 py-0.5 rounded text-[10px] ${
                            c.isArchived
                              ? 'bg-gray-800 text-gray-500'
                              : 'bg-gray-800 text-gray-300'
                          }`}
                        >
                          {c.isArchived ? 'ARCHIVED' : 'ACTIVE'}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => setSubcatModalCat(c)}
                            title="Add Subcategory"
                            className="p-1 text-gray-400 hover:text-blue-400 hover:bg-[#22252e] rounded"
                          >
                            <FolderPlus className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => setEditCat(c)}
                            title="Edit Category"
                            className="p-1 text-gray-400 hover:text-gray-200 hover:bg-[#22252e] rounded"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleToggleArchive(c)}
                            title={c.isArchived ? 'Restore Category' : 'Archive Category'}
                            className="p-1 text-gray-400 hover:text-amber-400 hover:bg-[#22252e] rounded"
                          >
                            {c.isArchived ? (
                              <ArchiveRestore className="w-3.5 h-3.5" />
                            ) : (
                              <Archive className="w-3.5 h-3.5" />
                            )}
                          </button>
                          <button
                            onClick={() => setCatToDelete(c)}
                            title="Delete Category"
                            className="p-1 text-gray-400 hover:text-red-400 hover:bg-[#22252e] rounded"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pinned Pagination Controls */}
      <TablePagination
        pageSize={pageSize}
        onPageSizeChange={setPageSize}
        hasNextPage={hasNextPage}
        hasPreviousPage={hasPreviousPage}
        onNextPage={() => goToNextPage(nextCursor)}
        onPreviousPage={goToPreviousPage}
        isLoading={isLoading}
        itemCount={items.length}
        totalCount={totalCount}
        pageIndex={pageIndex}
      />

      {/* Add Category Modal */}
      <Modal
        isOpen={isAddCatOpen}
        onClose={() => setIsAddCatOpen(false)}
        title="Add Category"
      >
        <form onSubmit={handleCreateCategory} className="space-y-3">
          <div>
            <label className="block text-xs text-gray-300 font-medium mb-1">
              Category Name *
            </label>
            <input
              type="text"
              required
              value={newCatName}
              onChange={(e) => setNewCatName(e.target.value)}
              placeholder="e.g. Healthcare or Software Subscriptions"
              className="w-full bg-[#111317] border border-[#262932] rounded px-3 py-1.5 text-xs text-gray-200 focus:outline-none focus:border-blue-500"
            />
          </div>

          <div>
            <label className="block text-xs text-gray-300 font-medium mb-1">
              Category Type *
            </label>
            <select
              value={newCatType}
              onChange={(e) => setNewCatType(e.target.value as any)}
              className="w-full bg-[#111317] border border-[#262932] rounded px-3 py-1.5 text-xs text-gray-200 focus:outline-none focus:border-blue-500"
            >
              <option value="EXPENSE">Expense Category</option>
              <option value="INCOME">Income Category</option>
            </select>
          </div>

          <div>
            <label className="block text-xs text-gray-300 font-medium mb-1">
              Subcategories (Comma separated)
            </label>
            <input
              type="text"
              value={initialSubcats}
              onChange={(e) => setInitialSubcats(e.target.value)}
              placeholder="e.g. Medicine, Doctor visit, Tests"
              className="w-full bg-[#111317] border border-[#262932] rounded px-3 py-1.5 text-xs text-gray-200 focus:outline-none focus:border-blue-500"
            />
          </div>

          {newCatType === 'EXPENSE' && (
            <div>
              <label className="block text-xs text-gray-300 font-medium mb-1">
                Initial Monthly Budget Limit (৳ BDT)
              </label>
              <input
                type="number"
                step="0.01"
                value={initialBudget}
                onChange={(e) => setInitialBudget(e.target.value)}
                placeholder="Optional, e.g. 15000"
                className="w-full bg-[#111317] border border-[#262932] rounded px-3 py-1.5 text-xs text-gray-200 font-mono focus:outline-none focus:border-blue-500"
              />
            </div>
          )}

          <div className="flex justify-end gap-2 pt-3 border-t border-[#22252c]">
            <button
              type="button"
              onClick={() => setIsAddCatOpen(false)}
              className="px-3 py-1.5 bg-[#1a1d24] hover:bg-[#222631] text-gray-300 rounded text-xs transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded text-xs font-medium transition-colors"
            >
              Save Category
            </button>
          </div>
        </form>
      </Modal>

      {/* Edit Category Modal */}
      <Modal
        isOpen={Boolean(editCat)}
        onClose={() => setEditCat(null)}
        title="Edit Category"
      >
        {editCat && (
          <form onSubmit={handleUpdateCategory} className="space-y-3">
            <div>
              <label className="block text-xs text-gray-300 font-medium mb-1">
                Category Name *
              </label>
              <input
                type="text"
                required
                value={editCat.name}
                onChange={(e) => setEditCat({ ...editCat, name: e.target.value })}
                className="w-full bg-[#111317] border border-[#262932] rounded px-3 py-1.5 text-xs text-gray-200 focus:outline-none focus:border-blue-500"
              />
            </div>

            <div>
              <label className="block text-xs text-gray-300 font-medium mb-1">
                Category Type
              </label>
              <select
                value={editCat.type}
                onChange={(e) => setEditCat({ ...editCat, type: e.target.value as any })}
                className="w-full bg-[#111317] border border-[#262932] rounded px-3 py-1.5 text-xs text-gray-200 focus:outline-none focus:border-blue-500"
              >
                <option value="EXPENSE">Expense Category</option>
                <option value="INCOME">Income Category</option>
              </select>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-[#22252c]">
              <button
                type="button"
                onClick={() => setEditCat(null)}
                className="px-3 py-1.5 bg-[#1a1d24] hover:bg-[#222631] text-gray-300 rounded text-xs transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded text-xs font-medium transition-colors"
              >
                Save Changes
              </button>
            </div>
          </form>
        )}
      </Modal>

      {/* Add Subcategory Modal */}
      <Modal
        isOpen={Boolean(subcatModalCat)}
        onClose={() => setSubcatModalCat(null)}
        title={subcatModalCat ? `Add Subcategory to "${subcatModalCat.name}"` : 'Add Subcategory'}
      >
        <form onSubmit={handleAddSubcat} className="space-y-3">
          <div>
            <label className="block text-xs text-gray-300 font-medium mb-1">
              Subcategory Name *
            </label>
            <input
              type="text"
              required
              value={newSubcatName}
              onChange={(e) => setNewSubcatName(e.target.value)}
              placeholder="e.g. Fuel, Dental, Course Fee"
              className="w-full bg-[#111317] border border-[#262932] rounded px-3 py-1.5 text-xs text-gray-200 focus:outline-none focus:border-blue-500"
            />
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-[#22252c]">
            <button
              type="button"
              onClick={() => setSubcatModalCat(null)}
              className="px-3 py-1.5 bg-[#1a1d24] hover:bg-[#222631] text-gray-300 rounded text-xs transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded text-xs font-medium transition-colors"
            >
              Add Subcategory
            </button>
          </div>
        </form>
      </Modal>

      {/* Delete Confirmation Modal */}
      <ConfirmModal
        isOpen={Boolean(catToDelete)}
        onClose={() => setCatToDelete(null)}
        onConfirm={confirmDelete}
        title="Delete Category"
        message={catToDelete ? `Are you sure you want to delete category "${catToDelete.name}"? Categories linked to existing transactions cannot be deleted.` : ''}
        confirmLabel="Delete"
        isDestructive={true}
      />
    </div>
  );
};
