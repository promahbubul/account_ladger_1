import { formatDate } from '../../lib/formatters';
import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useFinance } from '../../context/FinanceContext';
import { Search } from 'lucide-react';
import { TablePagination } from '../common/TablePagination';
import { useCursorPagination } from '../../hooks/useCursorPagination';
import { TableErrorRow, TableLoadingRow, TableEmptyRow } from '../common/StateViews';
import { AuditLog } from './types';
import { getErrorMessage } from '../../lib/errors';

export const AdminLogsTab: React.FC<{ refreshKey: number }> = ({ refreshKey }) => {
  const { token } = useAuth();
  const { authFetch } = useFinance();
  const [logSearchQuery, setLogSearchQuery] = useState('');

  // Audit logs pagination state
  const [logItems, setLogItems] = useState<AuditLog[]>([]);
  const [logTotalCount, setLogTotalCount] = useState<number>(0);
  const [logNextCursor, setLogNextCursor] = useState<string | null>(null);
  const [isLogsLoading, setIsLogsLoading] = useState(true);
  const [logError, setLogError] = useState<string | null>(null);

  const logPagination = useCursorPagination({ initialPageSize: 50, pageKey: 'logPage', pageSizeKey: 'logPageSize' });

  const fetchLogs = useCallback(async () => {
    if (!token) return;
    try {
      setIsLogsLoading(true);
      setLogError(null);

      const params = new URLSearchParams();
      params.set('limit', String(logPagination.pageSize));
      if (logPagination.cursor) params.set('cursor', logPagination.cursor);
      if (logSearchQuery.trim()) params.set('search', logSearchQuery.trim());

      const res = await authFetch(`/api/admin/audit-logs?${params.toString()}`);
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Failed to fetch audit logs');
      }

      const data = await res.json();
      setLogItems(data.items || []);
      setLogTotalCount(data.totalCount ?? (data.items || []).length);
      setLogNextCursor(data.nextCursor || null);
      logPagination.setPaginationMeta({
        hasNextPage: Boolean(data.hasNextPage),
        hasPreviousPage: Boolean(data.hasPreviousPage),
      });
    } catch (err: unknown) {
      console.error('Fetch logs error:', err);
      setLogError(getErrorMessage(err) || 'Error loading logs');
    } finally {
      setIsLogsLoading(false);
    }
  }, [token, authFetch, logPagination.pageSize, logPagination.cursor, logSearchQuery, logPagination.setPaginationMeta]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs, refreshKey]);

  const handleLogSearchChange = (val: string) => {
    setLogSearchQuery(val);
    logPagination.resetPagination();
  };

  return (
    <>
    <div className="flex-1 min-h-0 flex flex-col space-y-2.5">
      {/* Toolbar */}
      <div className="bg-surface border border-line rounded p-2.5 flex items-center justify-between flex-shrink-0">
        <div className="relative w-full md:w-80">
          <Search className="w-3.5 h-3.5 text-gray-500 absolute left-2.5 top-2.5" />
          <input
            type="text"
            value={logSearchQuery}
            onChange={(e) => handleLogSearchChange(e.target.value)}
            placeholder="Search logs..."
            className="w-full bg-app border border-line-strong rounded pl-8 pr-3 py-1.5 text-xs text-gray-200 focus:outline-none focus:border-blue-500 placeholder-gray-500"
          />
        </div>
      </div>

      {/* Viewport-based Audit Logs Table */}
      <div className="bg-surface border border-line rounded overflow-hidden flex-1 min-h-0 flex flex-col">
        <div className="flex-1 min-h-0 overflow-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead className="sticky top-0 z-10 bg-surface-sunken shadow-sm">
              <tr className="border-b border-line text-gray-400 uppercase tracking-wider text-[10px]">
                <th className="py-2.5 px-3">Timestamp</th>
                <th className="py-2.5 px-3">Action</th>
                <th className="py-2.5 px-3">User / Actor</th>
                <th className="py-2.5 px-3">Entity</th>
                <th className="py-2.5 px-3">Details</th>
                <th className="py-2.5 px-3">IP Address</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-divider">
              {logError ? (
                <TableErrorRow
                  colSpan={6}
                  title="Failed to load audit logs"
                  description={logError}
                  onRetry={fetchLogs}
                />
              ) : isLogsLoading ? (
                <TableLoadingRow
                  colSpan={6}
                  message="Loading security audit trail..."
                />
              ) : logItems.length === 0 ? (
                <TableEmptyRow
                  colSpan={6}
                  title="No audit logs recorded"
                  description={
                    logSearchQuery
                      ? 'No security logs match your search filters.'
                      : undefined
                  }
                />
              ) : (
                logItems.map((log) => (
                  <tr key={log.id} className="hover:bg-surface-hover transition-colors">
                    <td className="py-2.5 px-3 font-mono text-[11px] text-gray-400 whitespace-nowrap">
                      {formatDate(log.createdAt)}
                    </td>
                    <td className="py-2.5 px-3">
                      <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-mono font-medium ${
                        log.action === 'LOGIN'
                          ? 'bg-blue-950/70 text-blue-300 border border-blue-800/60'
                          : log.action.includes('USER')
                          ? 'bg-purple-950/70 text-purple-300 border border-purple-800/60'
                          : 'bg-gray-800 text-gray-300 border border-gray-700'
                      }`}>
                        {log.action}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-gray-200">
                      {log.userEmail || log.userId}
                    </td>
                    <td className="py-2.5 px-3 text-gray-400 font-mono text-[11px]">
                      {log.entityType}
                    </td>
                    <td className="py-2.5 px-3 text-gray-300">
                      {log.details || '-'}
                    </td>
                    <td className="py-2.5 px-3 text-gray-400 font-mono text-[11px]">
                      {log.ipAddress || '-'}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Integrated Log Pagination */}
        <TablePagination
          pageSize={logPagination.pageSize}
          onPageSizeChange={logPagination.setPageSize}
          hasNextPage={logPagination.hasNextPage}
          hasPreviousPage={logPagination.hasPreviousPage}
          onNextPage={() => logPagination.goToNextPage(logNextCursor)}
          onPreviousPage={logPagination.goToPreviousPage}
          isLoading={isLogsLoading}
          itemCount={logItems.length}
          totalCount={logTotalCount}
          pageIndex={logPagination.pageIndex}
          currentPage={logPagination.currentPage}
          maxIndexedPage={logPagination.maxIndexedPage}
          onGoToPage={logPagination.goToPage}
        />
      </div>
    </div>
    </>
  );
};
