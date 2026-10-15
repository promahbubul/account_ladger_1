import { useState, useCallback } from 'react';

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
  pageIndex: number;
  setPageSize: (size: PageSize) => void;
  goToNextPage: (nextCursor: string | null) => void;
  goToPreviousPage: () => void;
  resetPagination: () => void;
  setPaginationMeta: (meta: { hasNextPage: boolean; hasPreviousPage?: boolean; nextCursor?: string | null }) => void;
}

export function useCursorPagination(options: UseCursorPaginationOptions = {}): CursorPaginationState {
  const [pageSize, setPageSizeState] = useState<PageSize>(options.initialPageSize || 50);
  const [cursor, setCursor] = useState<string | null>(null);
  const [cursorStack, setCursorStack] = useState<(string | null)[]>([]);
  const [hasNextPage, setHasNextPage] = useState<boolean>(false);
  const [serverHasPrev, setServerHasPrev] = useState<boolean>(false);

  const resetPagination = useCallback(() => {
    setCursor(null);
    setCursorStack([]);
    setHasNextPage(false);
    setServerHasPrev(false);
  }, []);

  const setPageSize = useCallback((size: PageSize) => {
    setPageSizeState(size);
    resetPagination();
  }, [resetPagination]);

  const goToNextPage = useCallback((nextCursor: string | null) => {
    if (!nextCursor) return;
    setCursorStack((prev) => [...prev, cursor]);
    setCursor(nextCursor);
  }, [cursor]);

  const goToPreviousPage = useCallback(() => {
    setCursorStack((prev) => {
      if (prev.length === 0) return prev;
      const nextStack = [...prev];
      const prevCursor = nextStack.pop() ?? null;
      setCursor(prevCursor);
      return nextStack;
    });
  }, []);

  const setPaginationMeta = useCallback((meta: { hasNextPage: boolean; hasPreviousPage?: boolean }) => {
    setHasNextPage(meta.hasNextPage);
    if (meta.hasPreviousPage !== undefined) {
      setServerHasPrev(meta.hasPreviousPage);
    }
  }, []);

  const hasPreviousPage = cursorStack.length > 0 || serverHasPrev;

  return {
    pageSize,
    cursor,
    cursorStack,
    hasNextPage,
    hasPreviousPage,
    pageIndex: cursorStack.length,
    setPageSize,
    goToNextPage,
    goToPreviousPage,
    resetPagination,
    setPaginationMeta,
  };
}
