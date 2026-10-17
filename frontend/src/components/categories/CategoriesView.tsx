import React, { useState, useEffect, useCallback } from 'react';
import {
  Plus,
  Search,
  Edit2,
  Archive,
  ArchiveRestore,
  Trash2,
  FolderPlus,
  AlertCircle,
} from 'lucide-react';
import { useFinance } from '../../context/FinanceContext';
import { formatBDT } from '../../lib/formatters';
import { getQueryParam, updateQueryParams } from '../../lib/queryState';
import { Category } from '../../mock/data';
import { Modal, ConfirmModal } from '../common/Modal';
import { TablePagination } from '../common/TablePagination';
import { useCursorPagination } from '../../hooks/useCursorPagination';
import { TableErrorRow, TableLoadingRow, TableEmptyRow } from '../common/StateViews';
import { useToast } from '../../context/ToastContext';

interface CategoriesViewProps {
  onSuccessNotification?: (msg: string) => void;
}

export const CategoriesView: React.FC<CategoriesViewProps> = ({ onSuccessNotification }) => {
  const toast = useToast();
  const {
    categories,
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
  const [modalError, setModalError] = useState<string | null>(null);

  // Add category form
  const [newCatName, setNewCatName] = useState('');
  const [newCatType, setNewCatType] = useState<'EXPENSE' | 'INCOME'>('EXPENSE');
  const [newCatParentId, setNewCatParentId] = useState<string>('');
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
    currentPage,
    maxIndexedPage,
    hasNextPage,
    hasPreviousPage,
    setPageSize,
    goToNextPage,
    goToPreviousPage,
    goToPage,
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
      if (cursor) {
        params.set('cursor', cursor);
      } else if (currentPage > 1) {
        params.set('page', String(currentPage));
      }
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
        nextCursor: data.nextCursor || null,
      });
    } catch (err: any) {
      console.error('Fetch categories error:', err);
      setErrorMsg(err.message || 'Error fetching categories');
    } finally {
      setIsLoading(false);
    }
  }, [authFetch, pageSize, cursor, currentPage, searchQuery, typeFilter, statusFilter, setPaginationMeta]);

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
    setModalError(null);
    if (!newCatName.trim()) {
      setModalError('Category name is required.');
      return;
    }

    const subArr = initialSubcats
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);

    const res = await addCategory({
      name: newCatName.trim(),
      type: newCatType,
      parentId: newCatParentId ? newCatParentId : null,
      icon: 'Tag',
      color: '#4B5563',
      subcategories: subArr,
      isArchived: false,
    });

    if (!res.success || !res.category) {
      setModalError(res.error || 'Failed to add category.');
      return;
    }

    if (newCatType === 'EXPENSE' && initialBudget && parseFloat(initialBudget) > 0) {
      await setCategoryBudget(newCatName.trim(), parseFloat(initialBudget));
    }

    const created = res.category;
    const matchesType = typeFilter === 'ALL' || typeFilter === created.type;
    const matchesStatus = statusFilter === 'ALL' || statusFilter === 'ACTIVE';
    if (matchesType && matchesStatus) {
      setItems((prev) => [created, ...prev]);
    }
    setTotalCount((prev) => prev + 1);
    toast.success(`Category "${newCatName}" added successfully`);
    setIsAddCatOpen(false);
    setNewCatName('');
    setNewCatParentId('');
    setInitialSubcats('');
    setInitialBudget('');
  };

  const handleUpdateCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    setModalError(null);
    if (!editCat || !editCat.name.trim()) {
      setModalError('Category name is required.');
      return;
    }

    const res = await editCategory(editCat.id, {
      name: editCat.name.trim(),
      type: editCat.type,
      parentId: editCat.parentId ? editCat.parentId : null,
      color: editCat.color,
      icon: editCat.icon,
      subcategories: editCat.subcategories,
    });

    if (!res.success || !res.category) {
      setModalError(res.error || 'Failed to update category.');
      return;
    }

    const updated = res.category;
    setItems((prev) => prev.map((c) => (c.id === updated.id ? updated : c)));
    toast.success(`Category "${updated.name}" updated successfully`);
    setEditCat(null);
  };

  const handleAddSubcat = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!subcatModalCat || !newSubcatName.trim()) return;

    const res = await addSubcategory(subcatModalCat.id, newSubcatName.trim());
    if (res.success && res.subcategories) {
      const subs = res.subcategories;
      setItems((prev) =>
        prev.map((c) => (c.id === subcatModalCat.id ? { ...c, subcategories: subs } : c))
      );
      toast.success(`Subcategory "${newSubcatName.trim()}" added to "${subcatModalCat.name}"`);
    } else {
      toast.error(res.error || 'Failed to add subcategory');
    }
    setSubcatModalCat(null);
    setNewSubcatName('');
  };

  const handleToggleArchive = async (cat: Category) => {
    const res = await toggleArchiveCategory(cat.id);
    if (res.success && res.category) {
      const updated = res.category;
      if (statusFilter !== 'ALL') {
        setItems((prev) => prev.filter((c) => c.id !== cat.id));
        setTotalCount((prev) => Math.max(0, prev - 1));
      } else {
        setItems((prev) => prev.map((c) => (c.id === cat.id ? updated : c)));
      }
      toast.success(`Category "${cat.name}" ${updated.isArchived ? 'archived' : 'restored'}`);
    } else {
      toast.error(res.error || 'Failed to update category status');
    }
  };

  const confirmDelete = async () => {
    if (!catToDelete) return;
    setActionError(null);
    const deletedId = catToDelete.id;
    const res = await deleteCategory(deletedId);
    if (!res.success) {
      setActionError(res.error || 'Cannot delete category.');
      toast.error(res.error || 'Cannot delete category');
      return;
    }
    setItems((prev) => prev.filter((c) => c.id !== deletedId));
    setTotalCount((prev) => Math.max(0, prev - 1));
    toast.success(`Category "${catToDelete.name}" deleted successfully`);
    setCatToDelete(null);
  };

  // Eligible parent categories for Add form (Main categories of matching type)
  const availableParentsForAdd = categories.filter((c) => c.type === newCatType && !c.parentId);

  // Eligible parent categories for Edit form (Main categories of matching type, excluding self)
  const availableParentsForEdit = categories.filter(
    (c) => c.type === editCat?.type && !c.parentId && c.id !== editCat?.id
  );

  // Helper map for fast parent category name lookup
  const categoryMap = new Map<string, Category>();
  categories.forEach((c) => categoryMap.set(c.id, c));

  return (
    <div className="h-full flex flex-col min-h-0 w-full min-w-0 space-y-3">
      {/* Actions */}
      <div className="flex items-center justify-end gap-2 flex-shrink-0">
        <button
          onClick={() => {
            setIsAddCatOpen(true);
            setModalError(null);
          }}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded text-xs font-medium transition-colors"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>Add Category</span>
        </button>
      </div>

      {actionError && (
        <div className="p-2.5 bg-red-950/40 border border-red-800 text-red-200 text-xs rounded flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0" />
            <span>{actionError}</span>
          </div>
          <button onClick={() => setActionError(null)} className="text-xs text-red-400 hover:text-red-200 ml-2">
            Dismiss
          </button>
        </div>
      )}

      {/* Search & Filter Toolbar */}
      <div className="bg-[#16181d] border border-[#22252c] rounded p-2.5 flex flex-col md:flex-row items-center justify-between gap-2.5 flex-shrink-0">
        <div className="relative w-full md:w-80">
          <Search className="w-3.5 h-3.5 text-gray-400 absolute left-2.5 top-2.5" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => handleSearchChange(e.target.value)}
            placeholder="Search categories..."
            className="w-full bg-[#111317] border border-[#262932] rounded pl-8 pr-3 py-1.5 text-xs text-gray-200 focus:outline-none focus:border-blue-500 placeholder-gray-500"
          />
        </div>

        <div className="flex items-center gap-2 w-full md:w-auto text-xs">
          <select
            value={typeFilter}
            onChange={(e) => handleTypeChange(e.target.value as any)}
            className="bg-[#111317] border border-[#262932] rounded px-2.5 py-1.5 text-xs text-gray-300 focus:outline-none focus:border-blue-500"
          >
            <option value="ALL">All Types</option>
            <option value="EXPENSE">Expenses Only</option>
            <option value="INCOME">Income Only</option>
          </select>

          <select
            value={statusFilter}
            onChange={(e) => handleStatusChange(e.target.value as any)}
            className="bg-[#111317] border border-[#262932] rounded px-2.5 py-1.5 text-xs text-gray-300 focus:outline-none focus:border-blue-500"
          >
            <option value="ALL">All Status</option>
            <option value="ACTIVE">Active Only</option>
            <option value="ARCHIVED">Archived Only</option>
          </select>
        </div>
      </div>

      {/* Seamless Table Section with Integrated Pinned Footer */}
      <div className="bg-[#16181d] border border-[#22252c] rounded overflow-hidden flex-1 min-h-0 flex flex-col">
        <div className="flex-1 min-h-0 overflow-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead className="sticky top-0 z-10 bg-[#121417] shadow-sm">
              <tr className="border-b border-[#22252c] text-gray-400 font-medium uppercase tracking-wider text-[10px]">
                <th className="py-2.5 px-3">Category Name & Hierarchy</th>
                <th className="py-2.5 px-3">Type</th>
                <th className="py-2.5 px-3">Subcategories</th>
                <th className="py-2.5 px-3">Monthly Budget</th>
                <th className="py-2.5 px-3">Status</th>
                <th className="py-2.5 px-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#20232a]">
              {errorMsg ? (
                <TableErrorRow
                  colSpan={6}
                  title="Failed to load categories"
                  description={errorMsg}
                  onRetry={fetchCategories}
                />
              ) : isLoading ? (
                <TableLoadingRow colSpan={6} message="Loading categories..." />
              ) : items.length === 0 ? (
                <TableEmptyRow
                  colSpan={6}
                  title="No categories found"
                  description={
                    searchQuery || typeFilter !== 'ALL' || statusFilter !== 'ALL'
                      ? 'No categories match your filters.'
                      : 'No categories created yet.'
                  }
                  action={{
                    label: 'Add Category',
                    onClick: () => setIsAddCatOpen(true),
                  }}
                />
              ) : (
                items.map((c) => {
                  const b = budgets.find((bg) => bg.categoryName === c.name);
                  const parentCat = c.parentId ? categoryMap.get(c.parentId) : null;
                  const isSub = Boolean(c.parentId);

                  return (
                    <tr key={c.id} className="hover:bg-[#1a1d24] transition-colors">
                      <td className="py-2.5 px-3">
                        <div className="flex items-center gap-2">
                          <span
                            className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                            style={{ backgroundColor: c.color || '#3b82f6' }}
                          />
                          <div>
                            <span className="font-medium text-gray-200">{c.name}</span>
                            {parentCat ? (
                              <div className="text-[10px] text-gray-500 flex items-center gap-1 mt-0.5 font-mono">
                                <span>↳ Subcategory of</span>
                                <span className="text-blue-400 font-semibold">{parentCat.name}</span>
                              </div>
                            ) : (
                              <div className="text-[10px] text-gray-500 mt-0.5">
                                Main Category
                              </div>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="py-2.5 px-3">
                        <span
                          className={`px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wider ${
                            c.type === 'INCOME'
                              ? 'bg-emerald-950/60 text-emerald-400 border border-emerald-800/60'
                              : 'bg-rose-950/60 text-rose-400 border border-rose-800/60'
                          }`}
                        >
                          {c.type}
                        </span>
                      </td>
                      <td className="py-2.5 px-3">
                        <div className="flex flex-wrap items-center gap-1 max-w-xs">
                          {c.subcategories && c.subcategories.length > 0 ? (
                            c.subcategories.map((sub, idx) => (
                              <span
                                key={idx}
                                className="px-1.5 py-0.2 rounded bg-[#111317] border border-[#262932] text-gray-300 text-[11px]"
                              >
                                {sub}
                              </span>
                            ))
                          ) : isSub ? (
                            <span className="text-gray-500 text-[11px] italic">Child category</span>
                          ) : (
                            <span className="text-gray-600 text-[11px] italic">None</span>
                          )}
                          {!isSub && (
                            <button
                              onClick={() => setSubcatModalCat(c)}
                              title="Add Subcategory"
                              className="p-0.5 text-gray-400 hover:text-blue-400 hover:bg-[#22252e] rounded ml-1"
                            >
                              <FolderPlus className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </td>
                      <td className="py-2.5 px-3 font-mono text-gray-300">
                        {b && b.monthlyLimit > 0 ? formatBDT(b.monthlyLimit) : '-'}
                      </td>
                      <td className="py-2.5 px-3">
                        <span
                          className={`text-[10px] px-1.5 py-0.5 rounded ${
                            c.isArchived
                              ? 'bg-gray-800 text-gray-400'
                              : 'bg-emerald-950/40 text-emerald-300 border border-emerald-800/40'
                          }`}
                        >
                          {c.isArchived ? 'Archived' : 'Active'}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => {
                              setEditCat({
                                ...c,
                                parentId: c.parentId || '',
                              });
                              setModalError(null);
                            }}
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

        {/* Pinned Pagination Controls Integrated with Table */}
        <TablePagination
          pageSize={pageSize}
          onPageSizeChange={setPageSize}
          hasNextPage={hasNextPage}
          hasPreviousPage={hasPreviousPage}
          onNextPage={() => goToNextPage(nextCursor)}
          onPreviousPage={goToPreviousPage}
          onGoToPage={goToPage}
          currentPage={currentPage}
          maxIndexedPage={maxIndexedPage}
          isLoading={isLoading}
          itemCount={items.length}
          totalCount={totalCount}
          onErrorToast={toast.error}
        />
      </div>

      {/* Add Category Modal */}
      <Modal
        isOpen={isAddCatOpen}
        onClose={() => setIsAddCatOpen(false)}
        title="Add Category"
      >
        <form onSubmit={handleCreateCategory} className="space-y-3">
          {modalError && (
            <div className="p-2.5 bg-red-950/40 border border-red-800 text-red-200 text-xs rounded flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0" />
              <span>{modalError}</span>
            </div>
          )}

          <div>
            <label className="block text-xs text-gray-300 font-medium mb-1">
              Category Name *
            </label>
            <input
              type="text"
              required
              value={newCatName}
              onChange={(e) => setNewCatName(e.target.value)}
              className="w-full bg-[#111317] border border-[#262932] rounded px-3 py-1.5 text-xs text-gray-200 focus:outline-none focus:border-blue-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-gray-300 font-medium mb-1">
                Category Type *
              </label>
              <select
                value={newCatType}
                onChange={(e) => {
                  setNewCatType(e.target.value as any);
                  setNewCatParentId('');
                }}
                className="w-full bg-[#111317] border border-[#262932] rounded px-3 py-1.5 text-xs text-gray-200 focus:outline-none focus:border-blue-500"
              >
                <option value="EXPENSE">Expense Category</option>
                <option value="INCOME">Income Category</option>
              </select>
            </div>

            <div>
              <label className="block text-xs text-gray-300 font-medium mb-1">
                Parent Category
              </label>
              <select
                value={newCatParentId}
                onChange={(e) => setNewCatParentId(e.target.value)}
                className="w-full bg-[#111317] border border-[#262932] rounded px-3 py-1.5 text-xs text-gray-200 focus:outline-none focus:border-blue-500"
              >
                <option value="">No Parent Category (Main Category)</option>
                {availableParentsForAdd.map((parent) => (
                  <option key={parent.id} value={parent.id}>
                    {parent.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs text-gray-300 font-medium mb-1">
              Initial Subcategories (Optional, comma-separated)
            </label>
            <input
              type="text"
              value={initialSubcats}
              onChange={(e) => setInitialSubcats(e.target.value)}
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
            {modalError && (
              <div className="p-2.5 bg-red-950/40 border border-red-800 text-red-200 text-xs rounded flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0" />
                <span>{modalError}</span>
              </div>
            )}

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

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-gray-300 font-medium mb-1">
                  Category Type
                </label>
                <select
                  value={editCat.type}
                  disabled
                  className="w-full bg-[#111317]/60 border border-[#262932] rounded px-3 py-1.5 text-xs text-gray-400 cursor-not-allowed"
                >
                  <option value="EXPENSE">Expense Category</option>
                  <option value="INCOME">Income Category</option>
                </select>
              </div>

              <div>
                <label className="block text-xs text-gray-300 font-medium mb-1">
                  Parent Category
                </label>
                <select
                  value={editCat.parentId || ''}
                  onChange={(e) => setEditCat({ ...editCat, parentId: e.target.value || null })}
                  className="w-full bg-[#111317] border border-[#262932] rounded px-3 py-1.5 text-xs text-gray-200 focus:outline-none focus:border-blue-500"
                >
                  <option value="">No Parent Category (Main Category)</option>
                  {availableParentsForEdit.map((parent) => (
                    <option key={parent.id} value={parent.id}>
                      {parent.name}
                    </option>
                  ))}
                </select>
              </div>
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
        message={catToDelete ? `Are you sure you want to delete category "${catToDelete.name}"? Categories linked to existing transactions or with subcategories cannot be deleted.` : ''}
        confirmLabel="Delete"
        isDestructive={true}
      />
    </div>
  );
};
