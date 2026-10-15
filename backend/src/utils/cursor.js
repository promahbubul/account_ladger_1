/**
 * Cursor Pagination Helpers for HisabFlow
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

export function validateLimit(limitRaw) {
  if (limitRaw === undefined || limitRaw === null || limitRaw === '') {
    return 50;
  }
  const n = Number(limitRaw);
  if (n === 50 || n === 70 || n === 100) {
    return n;
  }
  throw new Error('Invalid limit: only 50, 70, or 100 records per page are permitted.');
}
