import { useState, useCallback, useRef } from 'react';

export type PageSize = 50 | 70 | 100;

export interface UseCursorPaginationOptions {
  initialPageSize?: PageSize;
}

export interface CursorPaginationState {
  pageSize: PageSize;
  cursor: string | null;
  cursorStack: (string | null)[];
  hasNextPage: boolean;
  hasPreviousPage: boolean;
  pageIndex: number; // 0-indexed
  currentPage: number; // 1-indexed
  maxIndexedPage: number;
  setPageSize: (size: PageSize) => void;
  goToNextPage: (nextCursor: string | null) => void;
  goToPreviousPage: () => void;
  goToPage: (page: number) => boolean;
  resetPagination: () => void;
  setPaginationMeta: (meta: { hasNextPage: boolean; hasPreviousPage?: boolean; nextCursor?: string | null }) => void;
}

export function useCursorPagination(options: UseCursorPaginationOptions = {}): CursorPaginationState {
  const [pageSize, setPageSizeState] = useState<PageSize>(options.initialPageSize || 50);
  const [cursor, setCursor] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [cursorStack, setCursorStack] = useState<(string | null)[]>([]);
  const [hasNextPage, setHasNextPage] = useState<boolean>(false);
  const [serverHasPrev, setServerHasPrev] = useState<boolean>(false);

  // pageCursorMap stores cursor for each 1-indexed page: page 1 -> null, page 2 -> cursor2, etc.
  const pageCursorMapRef = useRef<Record<number, string | null>>({ 1: null });

  const resetPagination = useCallback(() => {
    setCursor(null);
    setCurrentPage(1);
    setCursorStack([]);
    setHasNextPage(false);
    setServerHasPrev(false);
    pageCursorMapRef.current = { 1: null };
  }, []);

  const setPageSize = useCallback((size: PageSize) => {
    setPageSizeState(size);
    resetPagination();
  }, [resetPagination]);

  const setPaginationMeta = useCallback(
    (meta: { hasNextPage: boolean; hasPreviousPage?: boolean; nextCursor?: string | null }) => {
      setHasNextPage(meta.hasNextPage);
      if (meta.hasPreviousPage !== undefined) {
        setServerHasPrev(meta.hasPreviousPage);
      }
      if (meta.hasNextPage && meta.nextCursor) {
        pageCursorMapRef.current[currentPage + 1] = meta.nextCursor;
      }
    },
    [currentPage]
  );

  const goToNextPage = useCallback((nextCursor: string | null) => {
    if (!nextCursor && !hasNextPage) return;
    const nextPageNum = currentPage + 1;
    if (nextCursor) {
      pageCursorMapRef.current[nextPageNum] = nextCursor;
    }
    setCursorStack((prev) => [...prev, cursor]);
    setCursor(nextCursor);
    setCurrentPage(nextPageNum);
  }, [cursor, currentPage, hasNextPage]);

  const goToPreviousPage = useCallback(() => {
    if (currentPage <= 1) return;
    const prevPageNum = currentPage - 1;
    setCursorStack((prev) => {
      if (prev.length === 0) return prev;
      const nextStack = [...prev];
      const prevCursor = nextStack.pop() ?? null;
      setCursor(prevCursor);
      return nextStack;
    });
    setCurrentPage(prevPageNum);
  }, [currentPage]);

  const maxIndexedPage = Object.keys(pageCursorMapRef.current).reduce(
    (max, p) => Math.max(max, Number(p)),
    1
  );

  const goToPage = useCallback(
    (targetPage: number): boolean => {
      if (targetPage < 1) return false;
      if (targetPage === currentPage) return true;

      // Reconstruct or clear cursor for direct page navigation
      if (targetPage in pageCursorMapRef.current) {
        const targetCursor = pageCursorMapRef.current[targetPage];
        const newStack: (string | null)[] = [];
        for (let p = 1; p < targetPage; p++) {
          newStack.push(pageCursorMapRef.current[p] ?? null);
        }
        setCursorStack(newStack);
        setCursor(targetCursor);
      } else {
        // Direct server-supported page request
        setCursor(null);
        setCursorStack([]);
      }

      setCurrentPage(targetPage);
      return true;
    },
    [currentPage]
  );

  const hasPrevious = currentPage > 1 || cursorStack.length > 0 || serverHasPrev;

  return {
    pageSize,
    cursor,
    cursorStack,
    hasNextPage,
    hasPreviousPage: hasPrevious,
    pageIndex: currentPage - 1,
    currentPage,
    maxIndexedPage,
    setPageSize,
    goToNextPage,
    goToPreviousPage,
    goToPage,
    resetPagination,
    setPaginationMeta,
  };
}
