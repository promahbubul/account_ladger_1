// Audit logs, system settings and admin stats. Mixed into DatabaseService, so `this` is the service.
import { logger } from '../../utils/logger.js';
import { encodeCursor, decodeCursor } from '../../utils/cursor.js';
import {
  AUDIT_SELECT,
  auditFilters,
} from './helpers.js';

const DEFAULT_SETTINGS = { allowUserRegistration: true, defaultCurrency: 'BDT' };

export class AdminMethods {
  async addAuditLog(log) {
    const record = {
      id: `log_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
      ...log,
      createdAt: new Date().toISOString(),
    };

    if (this.isPostgresConnected && this.pool) {
      try {
        await this.pool.query(
          `INSERT INTO audit_logs (id, user_id, user_email, action, entity_type, entity_id, details, ip_address)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
          [
            record.id,
            record.userId || null,
            record.userEmail || null,
            record.action,
            record.entityType,
            record.entityId,
            record.details || null,
            record.ipAddress || null,
          ]
        );
      } catch (err) {
        logger.error('Error saving audit log to PostgreSQL:', err);
      }
      return record;
    }

    this.inMemoryData.auditLogs.unshift(record);
    if (this.inMemoryData.auditLogs.length > 500) {
      this.inMemoryData.auditLogs.pop();
    }
    this.persistLocalDb();
    return record;
  }

  // Removes logs older than the limit and returns how many went.
  async deleteOldAuditLogs(retentionDays) {
    if (!Number.isFinite(retentionDays) || retentionDays <= 0) return 0;

    if (this.isPostgresConnected && this.pool) {
      const res = await this.pool.query(
        'DELETE FROM audit_logs WHERE created_at < NOW() - make_interval(days => $1)',
        [Math.floor(retentionDays)]
      );
      return res.rowCount;
    }

    const cutoff = Date.now() - retentionDays * 86400000;
    const before = this.inMemoryData.auditLogs.length;
    this.inMemoryData.auditLogs = this.inMemoryData.auditLogs.filter((l) => new Date(l.createdAt).getTime() >= cutoff);
    const removed = before - this.inMemoryData.auditLogs.length;
    if (removed > 0) this.persistLocalDb();
    return removed;
  }

  async getAuditLogs(options = {}) {
    if (this.isPostgresConnected && this.pool) {
      const res = await this.pool.query(
        'SELECT id, user_id as "userId", user_email as "userEmail", action, entity_type as "entityType", entity_id as "entityId", details, ip_address as "ipAddress", created_at as "createdAt" FROM audit_logs ORDER BY created_at DESC LIMIT 500'
      );
      return res.rows;
    }
    return this.inMemoryData.auditLogs;
  }

  async getPaginatedAuditLogs(options) {
    if (this.isPostgresConnected && this.pool) {
      return this.queryPage({
        table: 'audit_logs',
        select: AUDIT_SELECT,
        filters: auditFilters(options),
        dateColumn: null,
        options,
        mapRow: (r) => r,
        cursorField: 'createdAt',
      });
    }
    const limit = options.limit || 50;
    const direction = options.direction || 'forward';
    let logs = await this.getAuditLogs();

    if (options.action && options.action !== 'ALL') {
      logs = logs.filter((l) => l.action === options.action);
    }
    if (options.search && options.search.trim()) {
      const term = options.search.trim().toLowerCase();
      logs = logs.filter(
        (l) =>
          l.action.toLowerCase().includes(term) ||
          l.entityType.toLowerCase().includes(term) ||
          (l.userEmail && l.userEmail.toLowerCase().includes(term)) ||
          (l.details && l.details.toLowerCase().includes(term))
      );
    }

    const totalCount = logs.length;
    let cursorIdx = -1;
    if (options.cursor) {
      const decoded = decodeCursor(options.cursor);
      if (decoded && decoded.id) {
        cursorIdx = logs.findIndex((l) => l.id === decoded.id);
      }
    }

    let items = [];
    let hasNextPage = false;
    let hasPreviousPage = false;

    if (direction === 'forward') {
      const startIndex = cursorIdx === -1 ? 0 : cursorIdx + 1;
      items = logs.slice(startIndex, startIndex + limit);
      hasNextPage = startIndex + limit < logs.length;
      hasPreviousPage = startIndex > 0;
    } else {
      const endIndex = cursorIdx === -1 ? logs.length : cursorIdx;
      const startIndex = Math.max(0, endIndex - limit);
      items = logs.slice(startIndex, endIndex);
      hasNextPage = endIndex < logs.length;
      hasPreviousPage = startIndex > 0;
    }

    const nextCursor =
      items.length > 0 && hasNextPage
        ? encodeCursor({ id: items[items.length - 1].id, timestamp: items[items.length - 1].createdAt })
        : null;
    const previousCursor =
      items.length > 0 && hasPreviousPage
        ? encodeCursor({ id: items[0].id, timestamp: items[0].createdAt })
        : null;

    return {
      items,
      nextCursor,
      previousCursor,
      hasNextPage,
      hasPreviousPage,
      totalCount,
    };
  }

  async getSystemSettings() {
    if (this.isPostgresConnected && this.pool) {
      const { rows } = await this.pool.query(
        'SELECT allow_user_registration, default_currency, updated_at FROM system_settings WHERE id = 1'
      );
      if (!rows[0]) return { ...DEFAULT_SETTINGS };
      return {
        allowUserRegistration: rows[0].allow_user_registration,
        defaultCurrency: rows[0].default_currency,
        updatedAt: rows[0].updated_at,
      };
    }
    const saved = this.inMemoryData.systemSettings || {};
    return {
      allowUserRegistration: saved.allowUserRegistration !== false,
      defaultCurrency: saved.defaultCurrency || DEFAULT_SETTINGS.defaultCurrency,
      updatedAt: saved.updatedAt,
    };
  }

  async updateSystemSettings(updates) {
    const next = { ...(await this.getSystemSettings()), ...updates };
    if (this.isPostgresConnected && this.pool) {
      await this.pool.query(
        `INSERT INTO system_settings (id, allow_user_registration, default_currency, updated_at)
         VALUES (1, $1, $2, NOW())
         ON CONFLICT (id) DO UPDATE SET
           allow_user_registration = EXCLUDED.allow_user_registration,
           default_currency = EXCLUDED.default_currency,
           updated_at = NOW()`,
        [next.allowUserRegistration, next.defaultCurrency]
      );
      return this.getSystemSettings();
    }
    this.inMemoryData.systemSettings = { ...next, updatedAt: new Date().toISOString() };
    this.persistLocalDb();
    return this.getSystemSettings();
  }

  async getAdminStats() {
    if (this.isPostgresConnected && this.pool) {
      const { rows } = await this.pool.query(`
        SELECT
          (SELECT count(*)::int FROM users) AS "totalUsers",
          (SELECT count(*)::int FROM users WHERE is_active) AS "activeUsers",
          (SELECT count(*)::int FROM users WHERE role = 'ADMIN') AS "adminCount",
          (SELECT count(*)::int FROM users WHERE NOT email_verified) AS "unverifiedUsers",
          (SELECT count(*)::int FROM users WHERE created_at >= NOW() - INTERVAL '7 days') AS "newUsersThisWeek",
          (SELECT count(*)::int FROM transactions) AS "totalTransactions",
          (SELECT count(*)::int FROM accounts) AS "totalAccounts"
      `);
      return { ...rows[0], databaseConnected: true };
    }

    const { users, transactions, accounts } = this.inMemoryData;
    const weekAgo = Date.now() - 7 * 86400000;
    return {
      totalUsers: users.length,
      activeUsers: users.filter((u) => u.isActive !== false).length,
      adminCount: users.filter((u) => u.role === 'ADMIN').length,
      unverifiedUsers: users.filter((u) => u.emailVerified !== true).length,
      newUsersThisWeek: users.filter((u) => new Date(u.createdAt).getTime() >= weekAgo).length,
      totalTransactions: (transactions || []).length,
      totalAccounts: (accounts || []).length,
      databaseConnected: false,
    };
  }
}
