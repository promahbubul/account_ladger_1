/**
 * Cursor Pagination Helpers for AccountLedger
 * Base64 URL-safe encoding/decoding and strict limit validation.
 */

export function encodeCursor(data) {
  try {
    return Buffer.from(JSON.stringify(data)).toString('base64url');
  } catch {
    return '';
  }
}

export function decodeCursor(cursor) {
  if (!cursor || typeof cursor !== 'string') return null;
  try {
    const json = Buffer.from(cursor.trim(), 'base64url').toString('utf-8');
    return JSON.parse(json);
  } catch {
    return null;
  }
}

// 50, 70 and 100 are the page sizes lists offer; 5 and 10 serve short "recent" lists such as a dashboard.
const ALLOWED_LIMITS = [5, 10, 50, 70, 100];

export function validateLimit(limitRaw) {
  if (limitRaw === undefined || limitRaw === null || limitRaw === '') {
    return 50;
  }
  const n = Number(limitRaw);
  if (ALLOWED_LIMITS.includes(n)) {
    return n;
  }
  throw new Error('Invalid limit: only 5, 10, 50, 70, or 100 records per page are permitted.');
}
