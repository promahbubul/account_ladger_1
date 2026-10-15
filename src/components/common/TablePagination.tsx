import React from 'react';
import { ChevronLeft, ChevronRight, Loader2 } from 'lucide-react';
import { PageSize } from '../../hooks/useCursorPagination';

export interface TablePaginationProps {
  pageSize: PageSize;
  onPageSizeChange: (newSize: PageSize) => void;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
  onNextPage: () => void;
  onPreviousPage: () => void;
  isLoading?: boolean;
  itemCount: number;
  totalCount?: number;
  pageIndex?: number;
}

export const TablePagination: React.FC<TablePaginationProps> = ({
  pageSize,
  onPageSizeChange,
  hasNextPage,
  hasPreviousPage,
  onNextPage,
  onPreviousPage,
  isLoading = false,
  itemCount,
  totalCount,
  pageIndex = 0,
}) => {
  const pageNum = pageIndex + 1;
  const startRecord = itemCount === 0 ? 0 : pageIndex * pageSize + 1;
  const endRecord = pageIndex * pageSize + itemCount;

  return (
    <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-3.5 py-2.5 bg-[#16181d] border border-[#22252c] rounded text-xs text-gray-400 flex-shrink-0 select-none">
      {/* Left side: Rows per page selector */}
      <div className="flex items-center gap-2">
        <label htmlFor="rows-per-page-select" className="text-gray-400 font-medium whitespace-nowrap">
          Rows per page:
        </label>
        <select
          id="rows-per-page-select"
          value={pageSize}
          onChange={(e) => {
            const val = Number(e.target.value) as PageSize;
            if (val === 50 || val === 70 || val === 100) {
              onPageSizeChange(val);
            }
          }}
          disabled={isLoading}
          className="bg-[#111317] border border-[#262932] rounded px-2 py-1 text-xs text-gray-200 focus:outline-none focus:border-blue-500 cursor-pointer disabled:opacity-50"
        >
          <option value={50}>50</option>
          <option value={70}>70</option>
          <option value={100}>100</option>
        </select>
      </div>

      {/* Middle: Truthful record count and page indicator */}
      <div className="text-gray-400 text-center font-mono text-[11px]">
        {isLoading ? (
          <span className="flex items-center gap-1.5 text-blue-400">
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
            <span>Loading records...</span>
          </span>
        ) : totalCount !== undefined ? (
          <span>
            Showing <strong className="text-gray-200 font-semibold">{itemCount === 0 ? 0 : `${startRecord}–${endRecord}`}</strong> of{' '}
            <strong className="text-gray-200 font-semibold">{totalCount}</strong> records
            {totalCount > pageSize && <span className="text-gray-500 ml-1.5">(Page {pageNum})</span>}
          </span>
        ) : (
          <span>
            Showing <strong className="text-gray-200 font-semibold">{itemCount}</strong> records
            <span className="text-gray-500 ml-1.5">(Page {pageNum})</span>
          </span>
        )}
      </div>

      {/* Right side: Previous & Next cursor navigation buttons */}
      <div className="flex items-center gap-1.5">
        <button
          type="button"
          onClick={onPreviousPage}
          disabled={!hasPreviousPage || isLoading}
          className={`flex items-center gap-1 px-2.5 py-1.5 rounded text-xs font-medium border transition-colors ${
            !hasPreviousPage || isLoading
              ? 'bg-[#121417]/60 text-gray-600 border-[#1f2229] cursor-not-allowed'
              : 'bg-[#1e222a] hover:bg-[#282d37] text-gray-200 border-[#2e323d] cursor-pointer'
          }`}
          aria-label="Previous page"
        >
          <ChevronLeft className="w-3.5 h-3.5" />
          <span>Previous</span>
        </button>

        <button
          type="button"
          onClick={onNextPage}
          disabled={!hasNextPage || isLoading}
          className={`flex items-center gap-1 px-2.5 py-1.5 rounded text-xs font-medium border transition-colors ${
            !hasNextPage || isLoading
              ? 'bg-[#121417]/60 text-gray-600 border-[#1f2229] cursor-not-allowed'
              : 'bg-[#1e222a] hover:bg-[#282d37] text-gray-200 border-[#2e323d] cursor-pointer'
          }`}
          aria-label="Next page"
        >
          <span>Next</span>
          <ChevronRight className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
};
