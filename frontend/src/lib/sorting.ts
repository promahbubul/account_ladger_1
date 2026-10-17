import { Transaction } from '../mock/data';

/**
 * Deterministic comparison function for transactions:
 * 1. Primary sort: transaction date descending (YYYY-MM-DD string comparison, newest date first)
 * 2. Secondary sort: createdAt descending (tie-breaker for transactions on the same calendar day)
 * 3. Final tie-breaker: unique transaction id descending
 */
export function compareTransactions(a: Transaction, b: Transaction): number {
  const dateA = typeof a.date === 'string' ? a.date.slice(0, 10) : '';
  const dateB = typeof b.date === 'string' ? b.date.slice(0, 10) : '';

  if (dateB !== dateA) {
    return dateB.localeCompare(dateA);
  }

  const timeA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
  const timeB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
  if (timeB !== timeA) {
    return timeB - timeA;
  }

  return String(b.id || '').localeCompare(String(a.id || ''));
}

/**
 * Returns a new array of transactions sorted deterministically by date descending.
 */
export function sortTransactions(transactions: Transaction[]): Transaction[] {
  return [...transactions].sort(compareTransactions);
}
