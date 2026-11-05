// Users, password reset tokens and email verification codes. Mixed into DatabaseService, so `this` is the service.
import { encodeCursor, decodeCursor } from '../../utils/cursor.js';
import {
  USER_SELECT,
  userFilters,
} from './helpers.js';

export class UsersMethods {
  async getUserById(id) {
    if (this.isPostgresConnected && this.pool) {
      const res = await this.pool.query(
        'SELECT id, username, email, password_hash as "passwordHash", token_version as "tokenVersion", firebase_uid as "firebaseUid", auth_provider as "authProvider", avatar_url as "avatarUrl", full_name as "fullName", role, is_active as "isActive", email_verified as "emailVerified", currency, timezone, date_format as "dateFormat", created_at as "createdAt", updated_at as "updatedAt" FROM users WHERE id = $1',
        [id]
      );
      return res.rows[0] || null;
    }
    return this.inMemoryData.users.find((u) => u.id === id) || null;
  }

  async getUserByUsernameOrEmail(identifier) {
    const clean = identifier.trim().toLowerCase();
    if (this.isPostgresConnected && this.pool) {
      const res = await this.pool.query(
        'SELECT id, username, email, password_hash as "passwordHash", token_version as "tokenVersion", firebase_uid as "firebaseUid", auth_provider as "authProvider", avatar_url as "avatarUrl", full_name as "fullName", role, is_active as "isActive", email_verified as "emailVerified", currency, timezone, date_format as "dateFormat", created_at as "createdAt", updated_at as "updatedAt" FROM users WHERE LOWER(username) = $1 OR LOWER(email) = $1',
        [clean]
      );
      return res.rows[0] || null;
    }
    return (
      this.inMemoryData.users.find(
        (u) => u.username.toLowerCase() === clean || u.email.toLowerCase() === clean
      ) || null
    );
  }

  async getUserByEmail(email) {
    const clean = email.trim().toLowerCase();
    if (this.isPostgresConnected && this.pool) {
      const res = await this.pool.query(
        'SELECT id, username, email, password_hash as "passwordHash", token_version as "tokenVersion", firebase_uid as "firebaseUid", auth_provider as "authProvider", avatar_url as "avatarUrl", full_name as "fullName", role, is_active as "isActive", email_verified as "emailVerified", currency, timezone, date_format as "dateFormat", created_at as "createdAt", updated_at as "updatedAt" FROM users WHERE LOWER(email) = $1',
        [clean]
      );
      return res.rows[0] || null;
    }
    return this.inMemoryData.users.find((u) => u.email.toLowerCase() === clean) || null;
  }

  async getUserByFirebaseUid(firebaseUid) {
    if (!firebaseUid) return null;
    if (this.isPostgresConnected && this.pool) {
      const res = await this.pool.query(
        'SELECT id, username, email, password_hash as "passwordHash", token_version as "tokenVersion", firebase_uid as "firebaseUid", auth_provider as "authProvider", avatar_url as "avatarUrl", full_name as "fullName", role, is_active as "isActive", email_verified as "emailVerified", currency, timezone, date_format as "dateFormat", created_at as "createdAt", updated_at as "updatedAt" FROM users WHERE firebase_uid = $1',
        [firebaseUid]
      );
      return res.rows[0] || null;
    }
    return this.inMemoryData.users.find((u) => u.firebaseUid === firebaseUid) || null;
  }

  async createUser(user) {
    if (this.isPostgresConnected && this.pool) {
      await this.pool.query(
        `INSERT INTO users (id, username, email, password_hash, full_name, role, is_active, email_verified, currency, timezone, date_format, firebase_uid, auth_provider, avatar_url)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)`,
        [
          user.id,
          user.username,
          user.email,
          user.passwordHash,
          user.fullName || null,
          user.role || 'USER',
          user.isActive !== false,
          user.emailVerified === true,
          user.currency || 'BDT',
          user.timezone || 'Asia/Dhaka',
          user.dateFormat || 'DD MMM YYYY',
          user.firebaseUid || null,
          user.authProvider || 'LOCAL',
          user.avatarUrl || null,
        ]
      );
      return user;
    }
    this.inMemoryData.users.push(user);
    this.persistLocalDb();
    return user;
  }

  async updateUser(id, updates) {
    if (this.isPostgresConnected && this.pool) {
      const fields = [];
      const values = [];
      let i = 1;

      if (updates.fullName !== undefined) {
        fields.push(`full_name = $${i++}`);
        values.push(updates.fullName);
      }
      if (updates.email !== undefined) {
        fields.push(`email = $${i++}`);
        values.push(updates.email);
      }
      if (updates.passwordHash !== undefined) {
        fields.push(`password_hash = $${i++}`);
        values.push(updates.passwordHash);
        fields.push('token_version = token_version + 1');
      }
      if (updates.firebaseUid !== undefined) {
        fields.push(`firebase_uid = $${i++}`);
        values.push(updates.firebaseUid);
      }
      if (updates.authProvider !== undefined) {
        fields.push(`auth_provider = $${i++}`);
        values.push(updates.authProvider);
      }
      if (updates.avatarUrl !== undefined) {
        fields.push(`avatar_url = $${i++}`);
        values.push(updates.avatarUrl);
      }
      if (updates.role !== undefined) {
        fields.push(`role = $${i++}`);
        values.push(updates.role);
      }
      if (updates.isActive !== undefined) {
        fields.push(`is_active = $${i++}`);
        values.push(updates.isActive);
      }
      if (updates.emailVerified !== undefined) {
        fields.push(`email_verified = $${i++}`);
        values.push(updates.emailVerified === true);
      }
      if (updates.currency !== undefined) {
        fields.push(`currency = $${i++}`);
        values.push(updates.currency);
      }
      if (updates.timezone !== undefined) {
        fields.push(`timezone = $${i++}`);
        values.push(updates.timezone);
      }
      if (updates.dateFormat !== undefined) {
        fields.push(`date_format = $${i++}`);
        values.push(updates.dateFormat);
      }

      fields.push(`updated_at = NOW()`);
      values.push(id);

      await this.pool.query(
        `UPDATE users SET ${fields.join(', ')} WHERE id = $${i}`,
        values
      );
      return this.getUserById(id);
    }

    const idx = this.inMemoryData.users.findIndex((u) => u.id === id);
    if (idx !== -1) {
      const current = this.inMemoryData.users[idx];
      this.inMemoryData.users[idx] = {
        ...current,
        ...updates,
        tokenVersion: (current.tokenVersion || 0) + (updates.passwordHash !== undefined ? 1 : 0),
        updatedAt: new Date().toISOString(),
      };
      this.persistLocalDb();
      return this.inMemoryData.users[idx];
    }
    return null;
  }

  async deleteUser(id) {
    if (this.isPostgresConnected && this.pool) {
      await this.pool.query('DELETE FROM users WHERE id = $1', [id]);
      return true;
    }
    const idx = this.inMemoryData.users.findIndex((u) => u.id === id);
    if (idx !== -1) {
      this.inMemoryData.users.splice(idx, 1);
      // Cascade delete user data in local store
      this.inMemoryData.accounts = this.inMemoryData.accounts.filter((a) => a.userId !== id);
      this.inMemoryData.categories = this.inMemoryData.categories.filter((c) => c.userId !== id);
      this.inMemoryData.transactions = this.inMemoryData.transactions.filter((t) => t.userId !== id);
      this.inMemoryData.transfers = this.inMemoryData.transfers.filter((t) => t.userId !== id);
      this.inMemoryData.loans = this.inMemoryData.loans.filter((l) => l.userId !== id);
      this.inMemoryData.repayments = this.inMemoryData.repayments.filter((r) => r.userId !== id);
      this.inMemoryData.budgets = this.inMemoryData.budgets.filter((b) => b.userId !== id);
      this.inMemoryData.passwordResetTokens = (this.inMemoryData.passwordResetTokens || []).filter((p) => p.userId !== id);
      this.inMemoryData.emailVerificationCodes = (this.inMemoryData.emailVerificationCodes || []).filter((c) => c.userId !== id);
      this.persistLocalDb();
      return true;
    }
    return false;
  }

  async createPasswordResetToken({ userId, tokenHash, expiresAt }) {
    const id = `prt_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
    const expiresAtIso = typeof expiresAt === 'string' ? expiresAt : expiresAt.toISOString();

    if (this.isPostgresConnected && this.pool) {
      // Invalidate previous active tokens for this user
      await this.pool.query(
        'UPDATE password_reset_tokens SET used_at = NOW() WHERE user_id = $1 AND used_at IS NULL',
        [userId]
      );

      await this.pool.query(
        `INSERT INTO password_reset_tokens (id, user_id, token_hash, expires_at, created_at)
         VALUES ($1, $2, $3, $4, NOW())`,
        [id, userId, tokenHash, expiresAtIso]
      );
      return { id, userId, tokenHash, expiresAt: expiresAtIso };
    }

    this.inMemoryData.passwordResetTokens = this.inMemoryData.passwordResetTokens || [];
    this.inMemoryData.passwordResetTokens.forEach((t) => {
      if (t.userId === userId && !t.usedAt) {
        t.usedAt = new Date().toISOString();
      }
    });

    const record = {
      id,
      userId,
      tokenHash,
      expiresAt: expiresAtIso,
      usedAt: null,
      createdAt: new Date().toISOString(),
    };
    this.inMemoryData.passwordResetTokens.push(record);
    this.persistLocalDb();
    return record;
  }

  async getPasswordResetTokenByHash(tokenHash) {
    if (this.isPostgresConnected && this.pool) {
      const res = await this.pool.query(
        `SELECT id, user_id as "userId", token_hash as "tokenHash", expires_at as "expiresAt", used_at as "usedAt", created_at as "createdAt"
         FROM password_reset_tokens
         WHERE token_hash = $1`,
        [tokenHash]
      );
      return res.rows[0] || null;
    }
    this.inMemoryData.passwordResetTokens = this.inMemoryData.passwordResetTokens || [];
    return this.inMemoryData.passwordResetTokens.find((t) => t.tokenHash === tokenHash) || null;
  }

  async redeemPasswordResetToken({ tokenHash, newPasswordHash, ipAddress }) {
    if (this.isPostgresConnected && this.pool) {
      const client = await this.pool.connect();
      try {
        await client.query('BEGIN');

        // Select for update to prevent concurrent redemption race conditions
        const tokenRes = await client.query(
          `SELECT id, user_id as "userId", token_hash as "tokenHash", expires_at as "expiresAt", used_at as "usedAt"
           FROM password_reset_tokens
           WHERE token_hash = $1
           FOR UPDATE`,
          [tokenHash]
        );

        if (tokenRes.rows.length === 0) {
          await client.query('ROLLBACK');
          return { success: false, error: 'Invalid or unrecognized password reset token.' };
        }

        const tokenRecord = tokenRes.rows[0];

        if (tokenRecord.usedAt) {
          await client.query('ROLLBACK');
          return { success: false, error: 'This password reset link has already been used. Please request a new one.' };
        }

        if (new Date(tokenRecord.expiresAt) < new Date()) {
          await client.query('ROLLBACK');
          return { success: false, error: 'This password reset link has expired. Please request a new one.' };
        }

        // Verify user exists and is active
        const userRes = await client.query(
          'SELECT id, email, role, is_active FROM users WHERE id = $1 FOR UPDATE',
          [tokenRecord.userId]
        );

        if (userRes.rows.length === 0 || !userRes.rows[0].is_active) {
          await client.query('ROLLBACK');
          return { success: false, error: 'User account is inactive or not found.' };
        }

        const user = userRes.rows[0];

        // 1. Update user password hash
        await client.query(
          'UPDATE users SET password_hash = $1, token_version = token_version + 1, updated_at = NOW() WHERE id = $2',
          [newPasswordHash, user.id]
        );

        // 2. Mark this token as used atomically
        await client.query(
          'UPDATE password_reset_tokens SET used_at = NOW() WHERE id = $1',
          [tokenRecord.id]
        );

        // 3. Invalidate any other outstanding reset tokens for this user
        await client.query(
          'UPDATE password_reset_tokens SET used_at = NOW() WHERE user_id = $1 AND id <> $2 AND used_at IS NULL',
          [user.id, tokenRecord.id]
        );

        // 4. Record audit log
        await client.query(
          `INSERT INTO audit_logs (id, user_id, user_email, action, entity_type, entity_id, details, ip_address, created_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())`,
          [
            `log_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
            user.id,
            user.email,
            'PASSWORD_RESET',
            'AUTH',
            user.id,
            'Password successfully reset via email token',
            ipAddress || null,
          ]
        );

        await client.query('COMMIT');
        return { success: true, userId: user.id };
      } catch (err) {
        await client.query('ROLLBACK');
        throw err;
      } finally {
        client.release();
      }
    }

    // In-memory fallback for offline/test mode
    this.inMemoryData.passwordResetTokens = this.inMemoryData.passwordResetTokens || [];
    const tokenRecord = this.inMemoryData.passwordResetTokens.find((t) => t.tokenHash === tokenHash);
    if (!tokenRecord) {
      return { success: false, error: 'Invalid or unrecognized password reset token.' };
    }
    if (tokenRecord.usedAt) {
      return { success: false, error: 'This password reset link has already been used. Please request a new one.' };
    }
    if (new Date(tokenRecord.expiresAt) < new Date()) {
      return { success: false, error: 'This password reset link has expired. Please request a new one.' };
    }

    const user = this.inMemoryData.users.find((u) => u.id === tokenRecord.userId);
    if (!user || !user.isActive) {
      return { success: false, error: 'User account is inactive or not found.' };
    }

    user.passwordHash = newPasswordHash;
    user.tokenVersion = (user.tokenVersion || 0) + 1;
    user.updatedAt = new Date().toISOString();
    tokenRecord.usedAt = new Date().toISOString();

    // Invalidate all other tokens for this user
    this.inMemoryData.passwordResetTokens.forEach((t) => {
      if (t.userId === user.id && t.id !== tokenRecord.id && !t.usedAt) {
        t.usedAt = new Date().toISOString();
      }
    });

    this.persistLocalDb();
    return { success: true, userId: user.id };
  }

  async cleanupExpiredResetTokens() {
    if (this.isPostgresConnected && this.pool) {
      await this.pool.query(
        `DELETE FROM password_reset_tokens 
         WHERE expires_at < NOW() - INTERVAL '1 day' 
            OR (used_at IS NOT NULL AND used_at < NOW() - INTERVAL '1 day')`
      );
      return;
    }
    if (this.inMemoryData.passwordResetTokens) {
      const oneDayAgo = Date.now() - 24 * 60 * 60 * 1000;
      this.inMemoryData.passwordResetTokens = this.inMemoryData.passwordResetTokens.filter((t) => {
        const exp = new Date(t.expiresAt).getTime();
        const used = t.usedAt ? new Date(t.usedAt).getTime() : 0;
        return exp > oneDayAgo && (!used || used > oneDayAgo);
      });
      this.persistLocalDb();
    }
  }

  async createEmailVerificationCode({ userId, codeHash, expiresAt }) {
    const id = `evc_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
    const expiresAtIso = typeof expiresAt === 'string' ? expiresAt : expiresAt.toISOString();

    if (this.isPostgresConnected && this.pool) {
      // Invalidate previous active codes for this user
      await this.pool.query(
        'UPDATE email_verification_codes SET used_at = NOW() WHERE user_id = $1 AND used_at IS NULL',
        [userId]
      );

      await this.pool.query(
        `INSERT INTO email_verification_codes (id, user_id, code_hash, expires_at, attempts, created_at)
         VALUES ($1, $2, $3, $4, 0, NOW())`,
        [id, userId, codeHash, expiresAtIso]
      );
      return { id, userId, codeHash, expiresAt: expiresAtIso, attempts: 0 };
    }

    this.inMemoryData.emailVerificationCodes = this.inMemoryData.emailVerificationCodes || [];
    this.inMemoryData.emailVerificationCodes.forEach((c) => {
      if (c.userId === userId && !c.usedAt) {
        c.usedAt = new Date().toISOString();
      }
    });

    const record = {
      id,
      userId,
      codeHash,
      expiresAt: expiresAtIso,
      attempts: 0,
      usedAt: null,
      createdAt: new Date().toISOString(),
    };
    this.inMemoryData.emailVerificationCodes.push(record);
    this.persistLocalDb();
    return record;
  }

  async getLatestEmailVerificationCode(userId) {
    if (this.isPostgresConnected && this.pool) {
      const res = await this.pool.query(
        `SELECT id, user_id as "userId", code_hash as "codeHash", expires_at as "expiresAt", attempts, used_at as "usedAt", created_at as "createdAt"
         FROM email_verification_codes
         WHERE user_id = $1
         ORDER BY created_at DESC
         LIMIT 1`,
        [userId]
      );
      return res.rows[0] || null;
    }
    this.inMemoryData.emailVerificationCodes = this.inMemoryData.emailVerificationCodes || [];
    const list = this.inMemoryData.emailVerificationCodes
      .filter((c) => c.userId === userId)
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    return list[0] || null;
  }

  async verifyEmailCode({ userId, codeHash, ipAddress }) {
    if (this.isPostgresConnected && this.pool) {
      const client = await this.pool.connect();
      try {
        await client.query('BEGIN');

        const codeRes = await client.query(
          `SELECT id, user_id as "userId", code_hash as "codeHash", expires_at as "expiresAt", attempts, used_at as "usedAt"
           FROM email_verification_codes
           WHERE user_id = $1
           ORDER BY created_at DESC
           LIMIT 1
           FOR UPDATE`,
          [userId]
        );

        if (codeRes.rows.length === 0) {
          await client.query('ROLLBACK');
          return { success: false, error: 'No verification code found. Please request a new code.' };
        }

        const record = codeRes.rows[0];

        if (record.usedAt) {
          await client.query('ROLLBACK');
          return { success: false, error: 'This verification code has already been used. Please request a new code or sign in.' };
        }

        if (new Date(record.expiresAt) < new Date()) {
          await client.query('ROLLBACK');
          return { success: false, error: 'The verification code has expired. Please request a new code.' };
        }

        if (record.attempts >= 5) {
          await client.query('ROLLBACK');
          return { success: false, error: 'Maximum verification attempts exceeded. Please request a new verification code.' };
        }

        if (record.codeHash !== codeHash) {
          const newAttempts = record.attempts + 1;
          await client.query(
            'UPDATE email_verification_codes SET attempts = $1 WHERE id = $2',
            [newAttempts, record.id]
          );
          await client.query('COMMIT');
          const remaining = Math.max(0, 5 - newAttempts);
          return {
            success: false,
            error: remaining > 0
              ? `Invalid verification code. You have ${remaining} attempt${remaining === 1 ? '' : 's'} remaining.`
              : 'Maximum verification attempts exceeded. Please request a new verification code.',
            remainingAttempts: remaining,
          };
        }

        // Code matches and is valid!
        await client.query(
          'UPDATE email_verification_codes SET used_at = NOW() WHERE id = $1',
          [record.id]
        );
        await client.query(
          'UPDATE users SET email_verified = true, updated_at = NOW() WHERE id = $1',
          [userId]
        );

        await client.query('COMMIT');
        return { success: true };
      } catch (err) {
        await client.query('ROLLBACK');
        throw err;
      } finally {
        client.release();
      }
    }

    // In-memory fallback
    this.inMemoryData.emailVerificationCodes = this.inMemoryData.emailVerificationCodes || [];
    const userCodes = this.inMemoryData.emailVerificationCodes
      .filter((c) => c.userId === userId)
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    if (userCodes.length === 0) {
      return { success: false, error: 'No verification code found. Please request a new code.' };
    }

    const record = userCodes[0];
    if (record.usedAt) {
      return { success: false, error: 'This verification code has already been used. Please request a new code or sign in.' };
    }
    if (new Date(record.expiresAt) < new Date()) {
      return { success: false, error: 'The verification code has expired. Please request a new code.' };
    }
    if (record.attempts >= 5) {
      return { success: false, error: 'Maximum verification attempts exceeded. Please request a new verification code.' };
    }

    if (record.codeHash !== codeHash) {
      record.attempts += 1;
      this.persistLocalDb();
      const remaining = Math.max(0, 5 - record.attempts);
      return {
        success: false,
        error: remaining > 0
          ? `Invalid verification code. You have ${remaining} attempt${remaining === 1 ? '' : 's'} remaining.`
          : 'Maximum verification attempts exceeded. Please request a new verification code.',
        remainingAttempts: remaining,
      };
    }

    record.usedAt = new Date().toISOString();
    const user = this.inMemoryData.users.find((u) => u.id === userId);
    if (user) {
      user.emailVerified = true;
      user.updatedAt = new Date().toISOString();
    }
    this.persistLocalDb();
    return { success: true };
  }

  async markUserEmailVerified(userId) {
    if (this.isPostgresConnected && this.pool) {
      await this.pool.query('UPDATE users SET email_verified = true, updated_at = NOW() WHERE id = $1', [userId]);
      return true;
    }
    const user = this.inMemoryData.users.find((u) => u.id === userId);
    if (user) {
      user.emailVerified = true;
      user.updatedAt = new Date().toISOString();
      this.persistLocalDb();
      return true;
    }
    return false;
  }

  async getPaginatedUsers(options) {
    if (this.isPostgresConnected && this.pool) {
      return this.queryPage({
        table: 'users',
        select: USER_SELECT,
        filters: userFilters(options),
        dateColumn: null,
        options,
        mapRow: (r) => r,
        cursorField: 'createdAt',
      });
    }
    const limit = options.limit || 50;
    const direction = options.direction || 'forward';
    let users = [...this.inMemoryData.users];

    if (options.role && options.role !== 'ALL') {
      users = users.filter((u) => u.role === options.role);
    }
    if (options.status === 'UNVERIFIED') {
      users = users.filter((u) => u.emailVerified !== true);
    } else if (options.status && options.status !== 'ALL') {
      const isActive = options.status === 'ACTIVE';
      users = users.filter((u) => u.isActive === isActive);
    }
    if (options.search && options.search.trim()) {
      const term = options.search.trim().toLowerCase();
      users = users.filter(
        (u) =>
          u.username.toLowerCase().includes(term) ||
          u.email.toLowerCase().includes(term) ||
          u.fullName.toLowerCase().includes(term)
      );
    }

    const totalCount = users.length;
    let cursorIdx = -1;
    if (options.cursor) {
      const decoded = decodeCursor(options.cursor);
      if (decoded && decoded.id) {
        cursorIdx = users.findIndex((u) => u.id === decoded.id);
      }
    }

    let items = [];
    let hasNextPage = false;
    let hasPreviousPage = false;

    if (direction === 'forward') {
      const startIndex = cursorIdx === -1 ? 0 : cursorIdx + 1;
      items = users.slice(startIndex, startIndex + limit);
      hasNextPage = startIndex + limit < users.length;
      hasPreviousPage = startIndex > 0;
    } else {
      const endIndex = cursorIdx === -1 ? users.length : cursorIdx;
      const startIndex = Math.max(0, endIndex - limit);
      items = users.slice(startIndex, endIndex);
      hasNextPage = endIndex < users.length;
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
      items: items.map(({ passwordHash, ...rest }) => rest),
      nextCursor,
      previousCursor,
      hasNextPage,
      hasPreviousPage,
      totalCount,
    };
  }

  // --------------------------------------------------------------------------
  // ACCOUNTS OPERATIONS
  // --------------------------------------------------------------------------
}
