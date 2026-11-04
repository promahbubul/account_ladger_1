import { useMemo } from 'react';
import { useInfiniteQuery } from '@tanstack/react-query';

// Accumulates pages of a list endpoint, so "Load More" adds to the list instead of replacing it.
// paging 'page' passes page numbers to fetchPage; 'cursor' passes the previous page's nextCursor
// (null for the first page), for endpoints that only page by cursor.
export const usePagedQuery = ({ queryKey, fetchPage, enabled = true, paging = 'page' }) => {
  const byCursor = paging === 'cursor';
  const query = useInfiniteQuery({
    queryKey,
    enabled,
    initialPageParam: byCursor ? null : 1,
    queryFn: ({ pageParam }) => fetchPage(pageParam),
    getNextPageParam: (lastPage, allPages) => {
      if (!lastPage?.hasNextPage) return undefined;
      if (byCursor) return lastPage.nextCursor || undefined;
      return allPages.length + 1;
    },
  });

  const items = useMemo(
    () => (query.data?.pages || []).flatMap((page) => page?.items || []),
    [query.data]
  );

  return { ...query, items };
};
