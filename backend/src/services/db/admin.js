// Audit logs, system settings and admin stats. Mixed into DatabaseService, so `this` is the service.
import { logger } from '../../utils/logger.js';
import { encodeCursor, decodeCursor } from '../../utils/cursor.js';
import {
  AUDIT_SELECT,
  auditFilters,
} from './helpers.js';

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

  getSystemSettings() {
    return (
      this.inMemoryData.systemSettings || {
        appName: 'AccountLedger.com',
        maintenanceMode: false,
        allowUserRegistration: true,
        defaultCurrency: 'BDT',
        sessionTimeoutHours: 720,
        auditLoggingEnabled: true,
        updatedAt: new Date().toISOString(),
      }
    );
  }

  async updateSystemSettings(updates) {
    this.inMemoryData.systemSettings = {
      ...this.getSystemSettings(),
      ...updates,
      updatedAt: new Date().toISOString(),
    };
    this.persistLocalDb();
    return this.inMemoryData.systemSettings;
  }

  async getAdminStats() {
    const users = this.isPostgresConnected && this.pool
      ? (await this.pool.query('SELECT role, is_active FROM users')).rows
      : this.inMemoryData.users;

    const totalUsers = users.length;
    const activeUsers = users.filter((u) => u.is_active !== false && u.isActive !== false).length;
    const adminUsers = users.filter((u) => u.role === 'ADMIN').length;

    return {
      totalUsers,
      activeUsers,
      adminUsers,
      databaseMode: this.isPostgresConnected ? 'PostgreSQL (Neon)' : 'Local Persistent JSON',
      connectedToPostgres: this.isPostgresConnected,
    };
  }
}
