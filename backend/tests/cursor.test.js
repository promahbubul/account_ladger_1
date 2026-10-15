import test from 'node:test';
import assert from 'node:assert/strict';
import { encodeCursor, decodeCursor, validateLimit } from '../src/utils/cursor.js';

test('Cursor Pagination Helpers', async (t) => {
  await t.test('encodeCursor and decodeCursor correctly roundtrip data', () => {
    const original = { id: 'tx_12345', timestamp: '2026-10-15T12:00:00Z' };
    const encoded = encodeCursor(original);
    assert.equal(typeof encoded, 'string');
    assert.ok(encoded.length > 0);

    const decoded = decodeCursor(encoded);
    assert.deepEqual(decoded, original);
  });

  await t.test('decodeCursor returns null for invalid or empty inputs', () => {
    assert.equal(decodeCursor(null), null);
    assert.equal(decodeCursor(''), null);
    assert.equal(decodeCursor('not-valid-base64-json!'), null);
  });

  await t.test('validateLimit permits exactly 50, 70, and 100 records per page', () => {
    assert.equal(validateLimit(undefined), 50);
    assert.equal(validateLimit(''), 50);
    assert.equal(validateLimit(50), 50);
    assert.equal(validateLimit('50'), 50);
    assert.equal(validateLimit(70), 70);
    assert.equal(validateLimit('70'), 70);
    assert.equal(validateLimit(100), 100);
    assert.equal(validateLimit('100'), 100);
  });

  await t.test('validateLimit rejects invalid limit values', () => {
    assert.throws(() => validateLimit(25), /only 50, 70, or 100 records/);
    assert.throws(() => validateLimit(200), /only 50, 70, or 100 records/);
    assert.throws(() => validateLimit('all'), /only 50, 70, or 100 records/);
  });
});
