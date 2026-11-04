import { useMemo } from 'react';
import { useInfiniteQuery } from '@tanstack/react-query';

// Accumulates pages of a list endpoint, so "Load More" adds to the list instead of replacing it.
export const usePagedQuery = ({ queryKey, fetchPage, enabled = true }) => {
  const query = useInfiniteQuery({
    queryKey,
    enabled,
    initialPageParam: 1,
    queryFn: ({ pageParam }) => fetchPage(pageParam),
    getNextPageParam: (lastPage, allPages) => (lastPage?.hasNextPage ? allPages.length + 1 : undefined),
  });

  const items = useMemo(
    () => (query.data?.pages || []).flatMap((page) => page?.items || []),
    [query.data]
  );

  return { ...query, items };
};
