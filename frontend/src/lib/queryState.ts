/**
 * Utility for persisting filter state and pagination into URL query parameters.
 * Allows filters and pagination to survive full page refreshes, back/forward navigation,
 * and direct link sharing.
 */

export function getQueryParam(key: string, defaultValue: string = ''): string {
  if (typeof window === 'undefined') return defaultValue;
  const params = new URLSearchParams(window.location.search);
  return params.get(key) || defaultValue;
}

export function updateQueryParams(
  updates: Record<string, string | number | null | undefined>,
  pathname?: string
) {
  if (typeof window === 'undefined') return;
  const currentParams = new URLSearchParams(window.location.search);

  for (const [key, value] of Object.entries(updates)) {
    if (
      value === null ||
      value === undefined ||
      value === '' ||
      value === 'ALL' ||
      (value === 'all' && key !== 'datePreset')
    ) {
      currentParams.delete(key);
    } else {
      currentParams.set(key, String(value));
    }
  }

  const newQuery = currentParams.toString() ? `?${currentParams.toString()}` : '';
  const targetPath = pathname || window.location.pathname;
  const newUrl = `${targetPath}${newQuery}`;

  if (window.location.pathname + window.location.search !== newUrl) {
    window.history.replaceState({}, '', newUrl);
    window.dispatchEvent(new PopStateEvent('popstate'));
  }
}
