import test from 'node:test';
import assert from 'node:assert/strict';
import { dbService } from '../src/services/db.service.js';
import { config } from '../src/config/env.js';

test('Old audit logs are removed', async (t) => {
  await dbService.initialize();
  t.after(async () => {
    if (dbService.pool) await dbService.pool.end();
  });

  const unique = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`;
  const addLog = (entityId) =>
    dbService.addAuditLog({ action: 'RETENTION_TEST', entityType: 'test', entityId: `${unique}_${entityId}`, details: unique });
  const ageLog = async (id, days) => {
    if (dbService.isPostgresConnected && dbService.pool) {
      await dbService.pool.query(`UPDATE audit_logs SET created_at = NOW() - make_interval(days => $1) WHERE id = $2`, [days, id]);
      return;
    }
    const log = dbService.inMemoryData.auditLogs.find((l) => l.id === id);
    log.createdAt = new Date(Date.now() - days * 86400000).toISOString();
  };
  const remaining = async () => {
    const { items } = await dbService.getPaginatedAuditLogs({ limit: 100, search: unique });
    return items.map((l) => l.entityId).sort();
  };

  const recent = await addLog('recent');
  const inside = await addLog('inside');
  const outside = await addLog('outside');
  await ageLog(inside.id, 364);
  await ageLog(outside.id, 366);
  assert.ok(recent.id);

  await t.test('the default keeps one year', () => {
    assert.equal(config.auditLogRetentionDays, 365);
  });

  await t.test('a bad setting deletes nothing', async () => {
    for (const days of [0, -5, NaN, undefined]) {
      assert.equal(await dbService.deleteOldAuditLogs(days), 0);
    }
    assert.equal((await remaining()).length, 3);
  });

  await t.test('only logs older than the limit go', async () => {
    assert.ok((await dbService.deleteOldAuditLogs(365)) >= 1);
    assert.deepEqual(await remaining(), [`${unique}_inside`, `${unique}_recent`]);
  });
});
