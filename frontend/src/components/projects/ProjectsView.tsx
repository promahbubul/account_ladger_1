import React, { useCallback, useEffect, useState } from 'react';
import { ArrowLeft, Download, Edit2, FileText, Loader2, Plus, Trash2, X } from 'lucide-react';
import { useFinance } from '../../context/FinanceContext';
import { useToast } from '../../context/ToastContext';
import { formatBDT, formatDate, parseAmount } from '../../lib/formatters';
import { getQueryParam, updateQueryParams } from '../../lib/queryState';
import {
  exportProjectCsv,
  exportProjectPdf,
  ProjectEntry,
  ProjectSummary,
} from '../../lib/projectExport';
import { BarList } from '../charts/BarList';
import { DatePicker, getDhakaTodayISO } from '../common/DatePicker';
import { ConfirmModal, Modal } from '../common/Modal';
import {
  DataStatus,
  LoadedValue,
  PageErrorState,
  PageLoadingState,
  TableEmptyRow,
  TableErrorRow,
  TableLoadingRow,
} from '../common/StateViews';
import { useBatchId } from '../expenses/CategoryExpenseGroups';
import { getErrorMessage } from '../../lib/errors';

const FIELD = 'w-full bg-app border border-line-strong rounded px-3 py-1.5 text-xs text-gray-200 focus:outline-none focus:border-blue-500';
const LABEL = 'block text-xs text-gray-300 font-medium mb-1';
const PRIMARY = 'inline-flex items-center justify-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded text-xs font-medium';
const SECONDARY = 'inline-flex items-center justify-center gap-1.5 px-3 py-1.5 bg-field hover:bg-surface-raised disabled:opacity-50 text-gray-200 rounded text-xs font-medium border border-field-line';

type ProjectListItem = Omit<ProjectSummary, 'people' | 'heads' | 'byHead' | 'byPerson'>;

// Requests report failures by throwing, so callers have one error path.
const useProjectApi = () => {
  const { authFetch } = useFinance();
  return useCallback(
    async (path: string, method: string = 'GET', body?: unknown) => {
      const res = await authFetch(`/api/projects${path}`, {
        method,
        headers: body ? { 'Content-Type': 'application/json' } : undefined,
        body: body ? JSON.stringify(body) : undefined,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Project request failed.');
      return data;
    },
    [authFetch]
  );
};

const ProjectFormModal: React.FC<{
  isOpen: boolean;
  project?: ProjectSummary | null;
  onClose: () => void;
  onSaved: (project: ProjectSummary) => void;
}> = ({ isOpen, project, onClose, onSaved }) => {
  const api = useProjectApi();
  const [name, setName] = useState('');
  const [clientName, setClientName] = useState('');
  const [location, setLocation] = useState('');
  const [startDate, setStartDate] = useState('');
  const [budget, setBudget] = useState('');
  const [status, setStatus] = useState('ACTIVE');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    setName(project?.name || '');
    setClientName(project?.clientName || '');
    setLocation(project?.location || '');
    setStartDate(project?.startDate || '');
    setBudget(project?.budget != null ? String(project.budget) : '');
    setStatus(project?.status || 'ACTIVE');
    setError('');
  }, [isOpen, project]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Please enter a project name.');
      return;
    }
    const hasBudget = budget.trim() !== '' && budget.trim() !== '0';
    const budgetValue = hasBudget ? parseAmount(budget) : null;
    if (hasBudget && budgetValue === null) {
      setError('Please enter a valid budget.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      const payload = {
        name: name.trim(),
        clientName: clientName.trim() || null,
        location: location.trim() || null,
        startDate: startDate || null,
        budget: budgetValue,
        status,
      };
      const data = project ? await api(`/${project.id}`, 'PUT', payload) : await api('', 'POST', payload);
      onSaved(data.project);
    } catch (err: unknown) {
      setError(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={project ? 'Edit Project' : 'New Project'}>
      <form onSubmit={handleSubmit} className="space-y-3">
        {error && <div className="p-2.5 rounded bg-red-950/40 border border-red-800/60 text-xs text-red-200">{error}</div>}
        <div>
          <label className={LABEL} htmlFor="project-name">Project Name *</label>
          <input id="project-name" type="text" value={name} onChange={(e) => setName(e.target.value)} className={FIELD} />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className={LABEL} htmlFor="project-client">Client</label>
            <input id="project-client" type="text" value={clientName} onChange={(e) => setClientName(e.target.value)} className={FIELD} />
          </div>
          <div>
            <label className={LABEL} htmlFor="project-location">Location</label>
            <input id="project-location" type="text" value={location} onChange={(e) => setLocation(e.target.value)} className={FIELD} />
          </div>
          <div>
            <label className={LABEL}>Start Date</label>
            <DatePicker value={startDate} onChange={setStartDate} />
          </div>
          <div>
            <label className={LABEL} htmlFor="project-budget">Budget</label>
            <input id="project-budget" type="text" inputMode="decimal" placeholder="0.00" value={budget} onChange={(e) => setBudget(e.target.value)} className={`${FIELD} font-mono`} />
          </div>
        </div>
        {project && (
          <div>
            <label className={LABEL} htmlFor="project-status">Status</label>
            <select id="project-status" value={status} onChange={(e) => setStatus(e.target.value)} className={FIELD}>
              <option value="ACTIVE">Active</option>
              <option value="COMPLETED">Completed</option>
            </select>
          </div>
        )}
        <div className="flex justify-end gap-2 pt-3 border-t border-line">
          <button type="button" onClick={onClose} className={SECONDARY}>Cancel</button>
          <button type="submit" disabled={saving} className={PRIMARY}>
            {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            {project ? 'Save Changes' : 'Create Project'}
          </button>
        </div>
      </form>
    </Modal>
  );
};

interface EntryRow {
  key: string;
  headId: string;
  personId: string;
  amount: string;
  description: string;
}
const newEntryRow = (): EntryRow => ({
  key: `${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`,
  headId: '',
  personId: '',
  amount: '',
  description: '',
});
const isBlankEntry = (row: EntryRow) => !row.amount.trim() && !row.description.trim() && !row.headId && !row.personId;

// Adds one or many expenses or funds at once, and edits a single existing entry.
const EntriesModal: React.FC<{
  isOpen: boolean;
  type: 'FUND' | 'EXPENSE';
  entry?: ProjectEntry | null;
  project: ProjectSummary;
  onClose: () => void;
  onSaved: () => void;
}> = ({ isOpen, type, entry, project, onClose, onSaved }) => {
  const api = useProjectApi();
  const toast = useToast();
  const batchIdFor = useBatchId();
  const isExpense = type === 'EXPENSE';
  const noun = isExpense ? 'Expense' : 'Fund';
  // The modal is mounted fresh for each use, so its starting values come straight from the props.
  const [date, setDate] = useState(() => entry?.date || getDhakaTodayISO());
  const [rows, setRows] = useState<EntryRow[]>(() => [
    entry
      ? { key: entry.id, headId: entry.headId || '', personId: entry.personId || '', amount: String(entry.amount), description: entry.description || '' }
      : newEntryRow(),
  ]);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const updateRow = (key: string, changes: Partial<EntryRow>) =>
    setRows((prev) => prev.map((row) => (row.key === key ? { ...row, ...changes } : row)));

  const total = rows.reduce((sum, row) => sum + (parseAmount(row.amount) || 0), 0);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const filled = rows.filter((row) => !isBlankEntry(row));
    if (filled.length === 0) {
      setError(`Please add at least one ${noun.toLowerCase()} with an amount.`);
      return;
    }
    if (filled.some((row) => parseAmount(row.amount) === null)) {
      setError('Enter a valid amount for every row. Nothing has been saved.');
      return;
    }
    if (isExpense && filled.some((row) => !row.headId)) {
      setError('Select a head for every expense. Nothing has been saved.');
      return;
    }
    const entries = filled.map((row) => ({
      type,
      date,
      amount: parseAmount(row.amount),
      headId: row.headId || null,
      personId: row.personId || null,
      description: row.description.trim() || null,
    }));

    setSaving(true);
    setError('');
    try {
      if (entry) {
        await api(`/${project.id}/entries/${entry.id}`, 'PUT', entries[0]);
      } else {
        await api(`/${project.id}/entries`, 'POST', { entries, batchId: batchIdFor(entries) });
      }
      toast.success(entry ? `${noun} updated.` : `Saved ${entries.length} ${noun.toLowerCase()}${entries.length === 1 ? '' : 's'}.`);
      onSaved();
    } catch (err: unknown) {
      setError(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!entry) return;
    setConfirmDelete(false);
    try {
      await api(`/${project.id}/entries/${entry.id}`, 'DELETE');
      toast.success(`${noun} deleted.`);
      onSaved();
    } catch (err: unknown) {
      setError(getErrorMessage(err));
    }
  };

  const title = entry ? `Edit ${noun}` : isExpense ? 'Add Expenses' : 'Add Funds';

  return (
    <>
      <Modal isOpen={isOpen} onClose={onClose} title={title} maxWidth="max-w-3xl">
        <form onSubmit={handleSubmit} className="space-y-3">
          {error && <div className="p-2.5 rounded bg-red-950/40 border border-red-800/60 text-xs text-red-200">{error}</div>}
          <div className="sm:max-w-xs">
            <label className={LABEL}>Date *</label>
            <DatePicker value={date} onChange={setDate} />
          </div>

          <div className="border border-line rounded divide-y divide-divider">
            {rows.map((row) => (
              <div key={row.key} className="grid grid-cols-12 gap-2 p-2.5 items-center">
                {isExpense && (
                  <select aria-label="Head" value={row.headId} onChange={(e) => updateRow(row.key, { headId: e.target.value })} className={`${FIELD} col-span-12 sm:col-span-3`}>
                    <option value="">Select a head *</option>
                    {project.heads.map((head) => (
                      <option key={head.id} value={head.id}>{head.name}</option>
                    ))}
                  </select>
                )}
                <select
                  aria-label={isExpense ? 'Spent by' : 'Received from'}
                  value={row.personId}
                  onChange={(e) => updateRow(row.key, { personId: e.target.value })}
                  className={`${FIELD} col-span-12 sm:col-span-3`}
                >
                  <option value="">{isExpense ? 'Spent by (optional)' : 'Received from (optional)'}</option>
                  {project.people.map((person) => (
                    <option key={person.id} value={person.id}>{person.name}</option>
                  ))}
                </select>
                <input
                  type="text"
                  aria-label="Description"
                  placeholder="Description"
                  value={row.description}
                  onChange={(e) => updateRow(row.key, { description: e.target.value })}
                  className={`${FIELD} col-span-12 ${isExpense ? 'sm:col-span-3' : 'sm:col-span-6'}`}
                />
                <input
                  type="text"
                  inputMode="decimal"
                  aria-label="Amount"
                  placeholder="0.00"
                  value={row.amount}
                  onChange={(e) => updateRow(row.key, { amount: e.target.value })}
                  className={`${FIELD} col-span-10 sm:col-span-2 font-mono text-right`}
                />
                <button
                  type="button"
                  aria-label="Remove row"
                  disabled={rows.length <= 1}
                  onClick={() => setRows((prev) => prev.filter((r) => r.key !== row.key))}
                  className="col-span-2 sm:col-span-1 justify-self-center p-1 text-gray-500 hover:text-red-400 rounded disabled:opacity-30"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>

          <div className="flex items-center justify-between">
            {entry ? (
              <button type="button" onClick={() => setConfirmDelete(true)} className="text-xs font-medium text-red-400 hover:text-red-300">
                Delete {noun}
              </button>
            ) : (
              <button type="button" onClick={() => setRows((prev) => [...prev, newEntryRow()])} className={SECONDARY}>
                <Plus className="w-3.5 h-3.5" />
                Add Row
              </button>
            )}
            <div className="text-xs text-gray-400">
              Total: <span className="text-sm font-bold font-mono text-gray-100">{formatBDT(total)}</span>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-line">
            <button type="button" onClick={onClose} className={SECONDARY}>Cancel</button>
            <button type="submit" disabled={saving} className={PRIMARY}>
              {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              {entry ? 'Save Changes' : 'Save'}
            </button>
          </div>
        </form>
      </Modal>
      <ConfirmModal
        isOpen={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        onConfirm={handleDelete}
        title={`Delete ${noun}`}
        message={entry ? `Delete this ${noun.toLowerCase()} of ${formatBDT(entry.amount)}?` : ''}
        confirmLabel="Delete"
      />
    </>
  );
};

const EntriesTable: React.FC<{
  projectId: string;
  type: 'FUND' | 'EXPENSE';
  refreshKey: number;
  onEdit: (entry: ProjectEntry) => void;
  onAdd: () => void;
}> = ({ projectId, type, refreshKey, onEdit, onAdd }) => {
  const api = useProjectApi();
  const [items, setItems] = useState<ProjectEntry[]>([]);
  const [page, setPage] = useState(1);
  const [hasNext, setHasNext] = useState(false);
  const [status, setStatus] = useState<DataStatus>('loading');
  const [isFetchingMore, setIsFetchingMore] = useState(false);
  const [moreFailed, setMoreFailed] = useState(false);

  const load = useCallback(async () => {
    setStatus('loading');
    setMoreFailed(false);
    try {
      const data = await api(`/${projectId}/entries?type=${type}&page=1&limit=50`);
      setItems(data.items);
      setHasNext(data.hasNextPage);
      setPage(1);
      setStatus('ready');
    } catch {
      setStatus('error');
    }
  }, [api, projectId, type]);

  useEffect(() => {
    load();
  }, [load, refreshKey]);

  const loadMore = async () => {
    setIsFetchingMore(true);
    setMoreFailed(false);
    try {
      const data = await api(`/${projectId}/entries?type=${type}&page=${page + 1}&limit=50`);
      setItems((prev) => [...prev, ...data.items]);
      setHasNext(data.hasNextPage);
      setPage((value) => value + 1);
    } catch {
      setMoreFailed(true);
    } finally {
      setIsFetchingMore(false);
    }
  };

  const isExpense = type === 'EXPENSE';
  const columns = isExpense ? 6 : 5;

  return (
    <div className="bg-surface border border-line rounded overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs border-collapse">
          <thead>
            <tr className="border-b border-line bg-surface-sunken text-gray-400 font-medium text-[10px] uppercase">
              <th className="py-2.5 px-3">Date</th>
              {isExpense && <th className="py-2.5 px-3">Head</th>}
              <th className="py-2.5 px-3">{isExpense ? 'Spent By' : 'Received From'}</th>
              <th className="py-2.5 px-3">Description</th>
              <th className="py-2.5 px-3 text-right">Amount</th>
              <th className="py-2.5 px-3 text-center w-12">Edit</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-divider">
            {status === 'loading' ? (
              <TableLoadingRow colSpan={columns} message="Loading entries..." minHeightClass="min-h-[160px]" />
            ) : status === 'error' ? (
              <TableErrorRow colSpan={columns} title="Could not load entries" onRetry={load} minHeightClass="min-h-[160px]" />
            ) : items.length === 0 ? (
              <TableEmptyRow
                colSpan={columns}
                title={isExpense ? 'No expenses added yet' : 'No funds added yet'}
                action={{ label: isExpense ? 'Add Expenses' : 'Add Funds', onClick: onAdd }}
                minHeightClass="min-h-[160px]"
              />
            ) : (
              items.map((item) => (
                <tr key={item.id} className="hover:bg-surface-hover">
                  <td className="py-2 px-3 text-gray-400 font-mono text-[11px] whitespace-nowrap">{formatDate(item.date)}</td>
                  {isExpense && <td className="py-2 px-3 font-medium text-gray-200">{item.headName}</td>}
                  <td className="py-2 px-3 text-gray-300">{item.personName || '-'}</td>
                  <td className="py-2 px-3 text-gray-400">{item.description || '-'}</td>
                  <td className="py-2 px-3 text-right font-mono font-medium text-gray-100">{formatBDT(item.amount)}</td>
                  <td className="py-2 px-3 text-center">
                    <button type="button" aria-label={`Edit ${isExpense ? 'expense' : 'fund'}`} onClick={() => onEdit(item)} className="p-1 text-gray-400 hover:text-blue-400 rounded">
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      {status === 'ready' && (hasNext || moreFailed) && (
        <div className="p-2.5 border-t border-line text-center">
          <button type="button" disabled={isFetchingMore} onClick={loadMore} className={SECONDARY}>
            {isFetchingMore && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            {moreFailed ? 'Could not load more. Try again' : 'Load More'}
          </button>
        </div>
      )}
    </div>
  );
};

const NamedList: React.FC<{
  title: string;
  saveLabel: string;
  placeholder: string;
  withPhone?: boolean;
  items: { id: string; name: string; phone?: string | null }[];
  emptyTitle: string;
  onAdd: (data: { name: string; phone?: string | null }) => Promise<void>;
  onUpdate: (id: string, data: { name: string; phone?: string | null }) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}> = ({ title, saveLabel, placeholder, withPhone, items, emptyTitle, onAdd, onUpdate, onDelete }) => {
  const toast = useToast();
  const [editingId, setEditingId] = useState('');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || saving) return;
    setSaving(true);
    setError('');
    try {
      const data = { name: name.trim(), ...(withPhone ? { phone: phone.trim() || null } : {}) };
      if (editingId) await onUpdate(editingId, data);
      else await onAdd(data);
      setEditingId('');
      setName('');
      setPhone('');
    } catch (err: unknown) {
      setError(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await onDelete(id);
    } catch (err: unknown) {
      toast.error(getErrorMessage(err));
    }
  };

  return (
    <div className="space-y-3">
      <form onSubmit={handleAdd} className="bg-surface border border-line rounded p-3 space-y-2">
        {error && <div className="p-2 rounded bg-red-950/40 border border-red-800/60 text-xs text-red-200">{error}</div>}
        <div className="flex flex-col sm:flex-row gap-2">
          <input type="text" aria-label={title} placeholder={placeholder} value={name} onChange={(e) => setName(e.target.value)} className={FIELD} />
          {withPhone && (
            <input type="text" aria-label="Phone" placeholder="Phone (optional)" value={phone} onChange={(e) => setPhone(e.target.value)} className={FIELD} />
          )}
          <button type="submit" disabled={saving || !name.trim()} className={PRIMARY}>
            {!editingId && <Plus className="w-3.5 h-3.5" />}
            {editingId ? saveLabel : 'Add'}
          </button>
          {editingId && (
            <button
              type="button"
              onClick={() => {
                setEditingId('');
                setName('');
                setPhone('');
                setError('');
              }}
              className={SECONDARY}
            >
              Cancel
            </button>
          )}
        </div>
      </form>
      <div className="bg-surface border border-line rounded divide-y divide-divider">
        {items.length === 0 ? (
          <p className="p-4 text-center text-xs text-gray-500">{emptyTitle}</p>
        ) : (
          items.map((item) => (
            <div key={item.id} className="flex items-center justify-between gap-3 px-3 py-2 text-xs">
              <div className="min-w-0">
                <div className="font-medium text-gray-200 truncate">{item.name}</div>
                {item.phone && <div className="text-gray-500 font-mono text-[11px]">{item.phone}</div>}
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <button
                  type="button"
                  aria-label={`Edit ${item.name}`}
                  onClick={() => {
                    setEditingId(item.id);
                    setName(item.name);
                    setPhone(item.phone || '');
                    setError('');
                  }}
                  className="p-1 text-gray-500 hover:text-blue-400 rounded"
                >
                  <Edit2 className="w-3.5 h-3.5" />
                </button>
                <button type="button" aria-label={`Remove ${item.name}`} onClick={() => handleDelete(item.id)} className="p-1 text-gray-500 hover:text-red-400 rounded">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

const TABS = [
  { key: 'OVERVIEW', label: 'Overview' },
  { key: 'EXPENSE', label: 'Expenses' },
  { key: 'FUND', label: 'Funds' },
  { key: 'PEOPLE', label: 'People' },
  { key: 'HEADS', label: 'Heads' },
] as const;

const ProjectDetail: React.FC<{ projectId: string; onBack: () => void }> = ({ projectId, onBack }) => {
  const api = useProjectApi();
  const toast = useToast();
  const [project, setProject] = useState<ProjectSummary | null>(null);
  const [status, setStatus] = useState<DataStatus>('loading');
  const [tab, setTab] = useState<(typeof TABS)[number]['key']>('OVERVIEW');
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [entryModal, setEntryModal] = useState<{ type: 'FUND' | 'EXPENSE'; entry?: ProjectEntry | null } | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [exporting, setExporting] = useState('');

  const load = useCallback(async () => {
    try {
      const data = await api(`/${projectId}`);
      setProject(data.project);
      setStatus('ready');
    } catch {
      // Figures already on screen stay there if a later refresh fails.
      setStatus((current) => (current === 'ready' ? current : 'error'));
    }
  }, [api, projectId]);

  useEffect(() => {
    load();
  }, [load]);

  if (status === 'loading') return <PageLoadingState message="Loading project..." />;
  if (status === 'error' || !project) {
    return (
      <div>
        <button type="button" onClick={onBack} className={SECONDARY}><ArrowLeft className="w-3.5 h-3.5" />Projects</button>
        <PageErrorState title="Could not load this project" onRetry={load} />
      </div>
    );
  }

  const refresh = () => {
    load();
    setRefreshKey((key) => key + 1);
  };

  const handleExport = async (format: 'pdf' | 'csv') => {
    setExporting(format);
    try {
      const { items } = await api(`/${project.id}/entries?all=true`);
      if (format === 'pdf') exportProjectPdf(project, items);
      else exportProjectCsv(project, items);
    } catch (err: unknown) {
      toast.error(getErrorMessage(err) || 'Could not export this report.');
    } finally {
      setExporting('');
    }
  };

  const handleDelete = async () => {
    setDeleteOpen(false);
    try {
      await api(`/${project.id}`, 'DELETE');
      toast.success(`Deleted "${project.name}".`);
      onBack();
    } catch (err: unknown) {
      toast.error(getErrorMessage(err));
    }
  };

  const budgetUsed = project.budget && project.budget > 0 ? project.totalExpense / project.budget : null;

  return (
    <div className="space-y-4 w-full min-w-0">
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" onClick={onBack} className={SECONDARY}><ArrowLeft className="w-3.5 h-3.5" />Projects</button>
        <h2 className="text-sm font-semibold text-gray-100 truncate">{project.name}</h2>
        {project.status === 'COMPLETED' && (
          <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-field text-gray-300 border border-field-line">Completed</span>
        )}
        <div className="flex gap-2 ml-auto">
          <button type="button" onClick={() => setEntryModal({ type: 'EXPENSE' })} className={PRIMARY}>
            <Plus className="w-3.5 h-3.5" />
            Add Expenses
          </button>
          <button type="button" onClick={() => setEntryModal({ type: 'FUND' })} className={SECONDARY}>
            <Plus className="w-3.5 h-3.5" />
            Add Funds
          </button>
          <button type="button" aria-label="Edit project" onClick={() => setEditOpen(true)} className={SECONDARY}>
            <Edit2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {[
          { label: 'Total Funds', value: project.totalFunds, className: 'text-gray-100' },
          { label: 'Total Expense', value: project.totalExpense, className: 'text-gray-100' },
          { label: 'Balance', value: project.balance, className: project.balance < 0 ? 'text-red-400' : 'text-emerald-400' },
        ].map((tile) => (
          <div key={tile.label} className="bg-surface border border-line rounded p-3">
            <div className="text-xs text-gray-400">{tile.label}</div>
            <div className={`text-lg font-bold font-mono mt-1 ${tile.className}`}>
              <LoadedValue status={status}>{formatBDT(tile.value)}</LoadedValue>
            </div>
          </div>
        ))}
      </div>

      {budgetUsed !== null && (
        <div className="bg-surface border border-line rounded p-3">
          <div className="flex justify-between text-xs mb-1.5">
            <span className="text-gray-400">Budget {formatBDT(project.budget)}</span>
            <span className={budgetUsed > 1 ? 'text-red-400 font-medium' : 'text-gray-400'}>{Math.round(budgetUsed * 100)}% used</span>
          </div>
          <div className="h-2 rounded bg-surface-raised overflow-hidden">
            <div className={`h-2 rounded ${budgetUsed > 1 ? 'bg-red-500' : 'bg-chart-1'}`} style={{ width: `${Math.min(budgetUsed * 100, 100)}%` }} />
          </div>
        </div>
      )}

      <div role="tablist" className="flex flex-wrap gap-1.5">
        {TABS.map((item) => (
          <button
            key={item.key}
            type="button"
            role="tab"
            aria-selected={tab === item.key}
            onClick={() => setTab(item.key)}
            className={`px-3 py-1 rounded text-xs font-medium border ${
              tab === item.key ? 'bg-surface-raised text-gray-100 border-line-strong' : 'text-gray-400 border-line hover:text-gray-200'
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>

      {tab === 'OVERVIEW' && (
        <div className="space-y-3">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
            <div className="bg-surface border border-line rounded p-3">
              <h3 className="text-xs font-semibold text-gray-200 mb-3">Expense by head</h3>
              <BarList rows={project.byHead.map((row) => ({ key: row.id, label: row.name, value: row.amount }))} emptyMessage="No expenses added yet." />
            </div>
            <div className="bg-surface border border-line rounded p-3">
              <h3 className="text-xs font-semibold text-gray-200 mb-3">Expense by person</h3>
              <BarList rows={project.byPerson.map((row) => ({ key: row.id || 'none', label: row.name, value: row.expense }))} emptyMessage="No expenses added yet." />
            </div>
            <div className="bg-surface border border-line rounded p-3">
              <h3 className="text-xs font-semibold text-gray-200 mb-3">Funds by person</h3>
              <BarList rows={project.byPerson.map((row) => ({ key: row.id || 'none', label: row.name, value: row.funds }))} emptyMessage="No funds added yet." />
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button type="button" disabled={Boolean(exporting)} onClick={() => handleExport('pdf')} className={SECONDARY}>
              {exporting === 'pdf' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <FileText className="w-3.5 h-3.5" />}
              Export PDF
            </button>
            <button type="button" disabled={Boolean(exporting)} onClick={() => handleExport('csv')} className={SECONDARY}>
              {exporting === 'csv' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
              Export CSV
            </button>
            <button type="button" onClick={() => setDeleteOpen(true)} className="ml-auto text-xs font-medium text-red-400 hover:text-red-300">
              Delete Project
            </button>
          </div>
        </div>
      )}

      {(tab === 'EXPENSE' || tab === 'FUND') && (
        <EntriesTable
          projectId={project.id}
          type={tab}
          refreshKey={refreshKey}
          onEdit={(entry) => setEntryModal({ type: tab, entry })}
          onAdd={() => setEntryModal({ type: tab })}
        />
      )}

      {tab === 'PEOPLE' && (
        <NamedList
          title="Add person"
          saveLabel="Save"
          placeholder="Person's name"
          withPhone
          items={project.people}
          emptyTitle="No people added yet."
          onAdd={async (data) => {
            await api(`/${project.id}/people`, 'POST', data);
            await load();
          }}
          onUpdate={async (id, data) => {
            await api(`/${project.id}/people/${id}`, 'PUT', data);
            await load();
          }}
          onDelete={async (id) => {
            await api(`/${project.id}/people/${id}`, 'DELETE');
            await load();
          }}
        />
      )}

      {tab === 'HEADS' && (
        <NamedList
          title="Add head"
          saveLabel="Save"
          placeholder="Head name, e.g. Tiles"
          items={project.heads}
          emptyTitle="No heads added yet."
          onAdd={async (data) => {
            await api(`/${project.id}/heads`, 'POST', data);
            await load();
          }}
          onUpdate={async (id, data) => {
            await api(`/${project.id}/heads/${id}`, 'PUT', data);
            await load();
          }}
          onDelete={async (id) => {
            await api(`/${project.id}/heads/${id}`, 'DELETE');
            await load();
          }}
        />
      )}

      <ProjectFormModal
        isOpen={editOpen}
        project={project}
        onClose={() => setEditOpen(false)}
        onSaved={(saved) => {
          setProject(saved);
          setEditOpen(false);
        }}
      />
      {entryModal && (
        <EntriesModal
          isOpen
          type={entryModal.type}
          entry={entryModal.entry}
          project={project}
          onClose={() => setEntryModal(null)}
          onSaved={() => {
            setEntryModal(null);
            refresh();
          }}
        />
      )}
      <ConfirmModal
        isOpen={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        onConfirm={handleDelete}
        title="Delete Project"
        message={`Delete "${project.name}" with all of its expenses, funds, people, and heads? This cannot be undone.`}
        confirmLabel="Delete"
      />
    </div>
  );
};

export const ProjectsView: React.FC = () => {
  const api = useProjectApi();
  const [projects, setProjects] = useState<ProjectListItem[]>([]);
  const [status, setStatus] = useState<DataStatus>('loading');
  const [selectedId, setSelectedId] = useState(() => getQueryParam('project'));
  const [createOpen, setCreateOpen] = useState(false);

  const load = useCallback(async () => {
    setStatus('loading');
    try {
      const data = await api('');
      setProjects(data.projects);
      setStatus('ready');
    } catch {
      setStatus('error');
    }
  }, [api]);

  useEffect(() => {
    if (!selectedId) load();
  }, [load, selectedId]);

  const openProject = (id: string) => {
    setSelectedId(id);
    updateQueryParams({ project: id });
  };

  if (selectedId) {
    return (
      <ProjectDetail
        key={selectedId}
        projectId={selectedId}
        onBack={() => {
          setSelectedId('');
          updateQueryParams({ project: null });
        }}
      />
    );
  }

  return (
    <div className="space-y-4 w-full min-w-0">
      <div className="flex justify-end">
        <button type="button" onClick={() => setCreateOpen(true)} className={PRIMARY}>
          <Plus className="w-3.5 h-3.5" />
          New Project
        </button>
      </div>

      <div className="bg-surface border border-line rounded overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-line bg-surface-sunken text-gray-400 font-medium text-[10px] uppercase">
                <th className="py-2.5 px-3">Project</th>
                <th className="py-2.5 px-3">Client</th>
                <th className="py-2.5 px-3 text-right">Funds</th>
                <th className="py-2.5 px-3 text-right">Expense</th>
                <th className="py-2.5 px-3 text-right">Balance</th>
                <th className="py-2.5 px-3 text-center">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-divider">
              {status === 'loading' ? (
                <TableLoadingRow colSpan={6} message="Loading projects..." />
              ) : status === 'error' ? (
                <TableErrorRow colSpan={6} title="Could not load projects" onRetry={load} />
              ) : projects.length === 0 ? (
                <TableEmptyRow colSpan={6} title="No projects yet" action={{ label: 'Create Project', onClick: () => setCreateOpen(true) }} />
              ) : (
                projects.map((project) => (
                  <tr key={project.id} onClick={() => openProject(project.id)} className="hover:bg-surface-hover cursor-pointer">
                    <td className="py-2.5 px-3 font-medium text-gray-200">{project.name}</td>
                    <td className="py-2.5 px-3 text-gray-400">{project.clientName || '-'}</td>
                    <td className="py-2.5 px-3 text-right font-mono text-gray-200">{formatBDT(project.totalFunds)}</td>
                    <td className="py-2.5 px-3 text-right font-mono text-gray-200">{formatBDT(project.totalExpense)}</td>
                    <td className={`py-2.5 px-3 text-right font-mono font-semibold ${project.balance < 0 ? 'text-red-400' : 'text-gray-100'}`}>
                      {formatBDT(project.balance)}
                    </td>
                    <td className="py-2.5 px-3 text-center text-gray-400">{project.status === 'COMPLETED' ? 'Completed' : 'Active'}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <ProjectFormModal
        isOpen={createOpen}
        onClose={() => setCreateOpen(false)}
        onSaved={(saved) => {
          setCreateOpen(false);
          openProject(saved.id);
        }}
      />
    </div>
  );
};
