import React, { useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight, Loader2 } from 'lucide-react';
import { PageSize } from '../../hooks/useCursorPagination';

export interface TablePaginationProps {
  pageSize: PageSize;
  onPageSizeChange: (newSize: PageSize) => void;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
  onNextPage: () => void;
  onPreviousPage: () => void;
  onGoToPage?: (page: number) => boolean | void;
  currentPage?: number;
  maxIndexedPage?: number;
  isLoading?: boolean;
  itemCount: number;
  totalCount?: number;
  pageIndex?: number;
  onErrorToast?: (msg: string) => void;
}

export const TablePagination: React.FC<TablePaginationProps> = ({
  pageSize,
  onPageSizeChange,
  hasNextPage,
  hasPreviousPage,
  onNextPage,
  onPreviousPage,
  onGoToPage,
  currentPage,
  maxIndexedPage = 1,
  isLoading = false,
  itemCount,
  totalCount,
  pageIndex = 0,
  onErrorToast,
}) => {
  const activePage = currentPage !== undefined ? currentPage : pageIndex + 1;
  const [inputVal, setInputVal] = useState<string>(String(activePage));

  const totalPages =
    totalCount !== undefined && totalCount > 0
      ? Math.max(1, Math.ceil(totalCount / pageSize))
      : totalCount === 0
      ? 1
      : undefined;

  // Sync input value whenever active page changes
  useEffect(() => {
    setInputVal(String(activePage));
  }, [activePage]);

  const handleCommitPage = () => {
    const trimmed = inputVal.trim();
    if (!trimmed) {
      setInputVal(String(activePage));
      return;
    }

    // Accept positive integers only (reject decimals, negatives, etc.)
    if (!/^\d+$/.test(trimmed)) {
      if (onErrorToast) onErrorToast('Please enter a valid page number.');
      setInputVal(String(activePage));
      return;
    }

    const parsed = parseInt(trimmed, 10);
    if (parsed < 1) {
      if (onErrorToast) onErrorToast('Page number must be at least 1.');
      setInputVal(String(activePage));
      return;
    }

    if (totalPages !== undefined && parsed > totalPages) {
      if (onErrorToast) onErrorToast(`Page ${parsed} is out of range. Total pages: ${totalPages}.`);
      setInputVal(String(activePage));
      return;
    }

    if (parsed === activePage) return;

    if (onGoToPage) {
      const ok = onGoToPage(parsed);
      if (ok === false) {
        if (onErrorToast) onErrorToast(`Unable to reach page ${parsed}.`);
        setInputVal(String(activePage));
      }
    } else {
      if (parsed > activePage && hasNextPage) onNextPage();
      else if (parsed < activePage && hasPreviousPage) onPreviousPage();
      else setInputVal(String(activePage));
    }
  };

  const isPrevDisabled = !hasPreviousPage || isLoading || activePage <= 1;
  const isNextDisabled = !hasNextPage || isLoading || (totalPages !== undefined && activePage >= totalPages);

  return (
    <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-3.5 py-2 bg-[#121417] border-t border-[#22252c] text-xs text-gray-400 select-none flex-shrink-0">
      {/* Left side: Rows per page selector */}
      <div className="flex items-center gap-1.5">
        <label htmlFor="rows-per-page-select" className="text-gray-400 font-medium whitespace-nowrap text-[11px]">
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
          className="bg-[#16181d] border border-[#262932] rounded px-2 py-0.5 text-xs text-gray-200 focus:outline-none focus:border-blue-500 cursor-pointer disabled:opacity-50"
        >
          <option value={50}>50</option>
          <option value={70}>70</option>
          <option value={100}>100</option>
        </select>
      </div>

      {/* Middle: Integrated layout: ‹ Page [ 2 ] of 12 › */}
      <div className="flex items-center gap-1.5">
        <button
          id="table-pagination-prev-btn"
          type="button"
          onClick={onPreviousPage}
          disabled={isPrevDisabled}
          className={`p-1 rounded text-xs transition-colors border ${
            isPrevDisabled
              ? 'text-gray-600 border-[#1f2229] bg-[#14161b]/50 cursor-not-allowed'
              : 'text-gray-200 hover:text-white hover:bg-[#20242e] border-[#2b2f3a] cursor-pointer'
          }`}
          aria-label="Previous page"
          title="Previous page"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>

        <div className="flex items-center gap-1 px-1 font-mono text-xs">
          <span className="text-gray-400 font-sans text-xs">Page</span>
          <input
            id="table-page-number-input"
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            value={inputVal}
            onChange={(e) => setInputVal(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                handleCommitPage();
              }
            }}
            onBlur={handleCommitPage}
            disabled={isLoading}
            className="w-12 text-center bg-[#16181d] border border-[#262932] rounded py-0.5 px-1 font-mono text-xs text-gray-100 focus:outline-none focus:border-blue-500 disabled:opacity-50"
            title="Type page number and press Enter"
            aria-label="Current page number"
          />
          {totalPages !== undefined && (
            <span className="text-gray-400 font-sans text-xs">of {totalPages}</span>
          )}
        </div>

        <button
          id="table-pagination-next-btn"
          type="button"
          onClick={onNextPage}
          disabled={isNextDisabled}
          className={`p-1 rounded text-xs transition-colors border ${
            isNextDisabled
              ? 'text-gray-600 border-[#1f2229] bg-[#14161b]/50 cursor-not-allowed'
              : 'text-gray-200 hover:text-white hover:bg-[#20242e] border-[#2b2f3a] cursor-pointer'
          }`}
          aria-label="Next page"
          title="Next page"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>

      {/* Right side: Record count / loading indicator */}
      <div className="text-gray-400 font-mono text-[11px] whitespace-nowrap">
        {isLoading ? (
          <span className="flex items-center gap-1.5 text-blue-400">
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
            <span>Loading...</span>
          </span>
        ) : (
          <span>
            Showing{' '}
            <strong className="text-gray-200 font-semibold">
              {itemCount === 0 ? 0 : (activePage - 1) * pageSize + 1}
            </strong>
            –
            <strong className="text-gray-200 font-semibold">
              {(activePage - 1) * pageSize + itemCount}
            </strong>
            {totalCount !== undefined && (
              <>
                {' '}of <strong className="text-gray-200 font-semibold">{totalCount}</strong>
              </>
            )}
          </span>
        )}
      </div>
    </div>
  );
};
