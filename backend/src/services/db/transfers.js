// Transfers between accounts. Mixed into DatabaseService, so `this` is the service.
import { encodeCursor, decodeCursor } from '../../utils/cursor.js';
import {
  TRANSFER_SELECT,
  mapTransferRow,
  transferFilters,
} from './helpers.js';

export class TransfersMethods {
  async getTransfers(userId, filters = {}) {
    let transfers = this.inMemoryData.transfers.filter((t) => t.userId === userId);

    if (this.isPostgresConnected && this.pool) {
      const res = await this.pool.query(
        `${TRANSFER_SELECT} WHERE user_id = $1 ORDER BY date DESC, created_at DESC`,
        [userId]
      );
      transfers = res.rows.map(mapTransferRow);
    }

    if (filters.sourceAccountId && filters.sourceAccountId !== 'ALL') {
      transfers = transfers.filter((t) => t.sourceAccountId === filters.sourceAccountId);
    }
    if (filters.destAccountId && filters.destAccountId !== 'ALL') {
      transfers = transfers.filter((t) => t.destinationAccountId === filters.destAccountId);
    }
    if (filters.startDate) {
      transfers = transfers.filter((t) => t.date >= filters.startDate);
    }
    if (filters.endDate) {
      transfers = transfers.filter((t) => t.date <= filters.endDate);
    }
    if (filters.search && filters.search.trim()) {
      const term = filters.search.trim().toLowerCase();
      transfers = transfers.filter(
        (t) =>
          (t.description && t.description.toLowerCase().includes(term)) ||
          (t.reference && t.reference.toLowerCase().includes(term)) ||
          t.sourceAccountName.toLowerCase().includes(term) ||
          t.destinationAccountName.toLowerCase().includes(term)
      );
    }

    return transfers.sort((a, b) => {
      const dateCmp = new Date(b.date).getTime() - new Date(a.date).getTime();
      if (dateCmp !== 0) return dateCmp;
      const timeA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const timeB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return timeB - timeA;
    });
  }

  async getPaginatedTransfers(userId, options) {
    if (this.isPostgresConnected && this.pool) {
      return this.queryPage({
        table: 'transfers',
        select: TRANSFER_SELECT,
        filters: transferFilters(userId, options),
        dateColumn: 'date',
        options,
        mapRow: mapTransferRow,
        cursorField: 'date',
      });
    }
    const limit = options.limit || 50;
    const direction = options.direction || 'forward';
    const transfers = await this.getTransfers(userId, options);

    const totalCount = transfers.length;
    let cursorIdx = -1;
    if (options.cursor) {
      const decoded = decodeCursor(options.cursor);
      if (decoded && decoded.id) {
        cursorIdx = transfers.findIndex((t) => t.id === decoded.id);
      }
    }

    let items = [];
    let hasNextPage = false;
    let hasPreviousPage = false;

    if (options.page !== undefined && options.page > 0) {
      const pageNum = options.page;
      const startIndex = (pageNum - 1) * limit;
      items = transfers.slice(startIndex, startIndex + limit);
      hasNextPage = startIndex + limit < transfers.length;
      hasPreviousPage = startIndex > 0;
    } else if (direction === 'forward') {
      const startIndex = cursorIdx === -1 ? 0 : cursorIdx + 1;
      items = transfers.slice(startIndex, startIndex + limit);
      hasNextPage = startIndex + limit < transfers.length;
      hasPreviousPage = startIndex > 0;
    } else {
      const endIndex = cursorIdx === -1 ? transfers.length : cursorIdx;
      const startIndex = Math.max(0, endIndex - limit);
      items = transfers.slice(startIndex, endIndex);
      hasNextPage = endIndex < transfers.length;
      hasPreviousPage = startIndex > 0;
    }

    const nextCursor =
      items.length > 0 && hasNextPage
        ? encodeCursor({ id: items[items.length - 1].id, timestamp: items[items.length - 1].date })
        : null;
    const previousCursor =
      items.length > 0 && hasPreviousPage
        ? encodeCursor({ id: items[0].id, timestamp: items[0].date })
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

  async createTransfer(transfer) {
    if (transfer.sourceAccountId === transfer.destinationAccountId) {
      throw new Error('Source and destination accounts must be different.');
    }
    const cleanAmount = Number(transfer.amount);
    if (isNaN(cleanAmount) || cleanAmount <= 0) {
      throw new Error('Transfer amount must be a positive number.');
    }
    const cleanFee = Number(transfer.transferFee || 0);
    if (isNaN(cleanFee) || cleanFee < 0) {
      throw new Error('Transfer fee cannot be negative.');
    }
    const totalOut = Number((cleanAmount + cleanFee).toFixed(2));

    if (this.isPostgresConnected && this.pool) {
      const client = await this.pool.connect();
      try {
        await client.query('BEGIN');

        // Lock and verify both accounts belong to this user
        const srcRes = await client.query('SELECT id, name FROM accounts WHERE id = $1 AND user_id = $2 FOR UPDATE', [transfer.sourceAccountId, transfer.userId]);
        const dstRes = await client.query('SELECT id, name FROM accounts WHERE id = $1 AND user_id = $2 FOR UPDATE', [transfer.destinationAccountId, transfer.userId]);
        if (srcRes.rows.length === 0 || dstRes.rows.length === 0) {
          throw new Error('Source or destination account not found or access denied.');
        }

        await client.query(
          `INSERT INTO transfers (id, user_id, source_account_id, source_account_name, destination_account_id, destination_account_name, amount, transfer_fee, date, description, reference)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
          [
            transfer.id,
            transfer.userId,
            transfer.sourceAccountId,
            transfer.sourceAccountName || srcRes.rows[0].name,
            transfer.destinationAccountId,
            transfer.destinationAccountName || dstRes.rows[0].name,
            cleanAmount,
            cleanFee,
            transfer.date,
            transfer.description || null,
            transfer.reference || null,
          ]
        );

        // Deduct from source: amount + fee
        await client.query(
          'UPDATE accounts SET current_balance = current_balance - $1, updated_at = NOW() WHERE id = $2',
          [totalOut, transfer.sourceAccountId]
        );
        // Add to destination: amount
        await client.query(
          'UPDATE accounts SET current_balance = current_balance + $1, updated_at = NOW() WHERE id = $2',
          [cleanAmount, transfer.destinationAccountId]
        );

        await client.query('COMMIT');
        return {
          ...transfer,
          amount: cleanAmount,
          transferFee: cleanFee,
        };
      } catch (err) {
        await client.query('ROLLBACK');
        throw err;
      } finally {
        client.release();
      }
    } else {
      this.inMemoryData.transfers.push(transfer);
      await this.updateAccountBalance(transfer.sourceAccountId, -totalOut);
      await this.updateAccountBalance(transfer.destinationAccountId, cleanAmount);
      this.persistLocalDb();
      return transfer;
    }
  }

  async deleteTransfer(transferId, userId) {
    if (this.isPostgresConnected && this.pool) {
      const client = await this.pool.connect();
      try {
        await client.query('BEGIN');
        const res = await client.query('SELECT * FROM transfers WHERE id = $1 AND user_id = $2 FOR UPDATE', [transferId, userId]);
        if (res.rows.length === 0) {
          await client.query('ROLLBACK');
          return false;
        }
        const existing = res.rows[0];
        const totalOut = Number((Number(existing.amount) + Number(existing.transfer_fee || 0)).toFixed(2));

        // Reverse source account: refund amount + fee
        await client.query('UPDATE accounts SET current_balance = current_balance + $1, updated_at = NOW() WHERE id = $2', [totalOut, existing.source_account_id]);
        // Reverse destination account: deduct amount
        await client.query('UPDATE accounts SET current_balance = current_balance - $1, updated_at = NOW() WHERE id = $2', [existing.amount, existing.destination_account_id]);

        await client.query('DELETE FROM transfers WHERE id = $1 AND user_id = $2', [transferId, userId]);
        await client.query('COMMIT');
        return true;
      } catch (err) {
        await client.query('ROLLBACK');
        throw err;
      } finally {
        client.release();
      }
    }

    const transfers = await this.getTransfers(userId);
    const existing = transfers.find((t) => t.id === transferId);
    if (!existing) return false;

    const totalOut = Number((existing.amount + (existing.transferFee || 0)).toFixed(2));
    await this.updateAccountBalance(existing.sourceAccountId, totalOut);
    await this.updateAccountBalance(existing.destinationAccountId, -existing.amount);

    const idx = this.inMemoryData.transfers.findIndex((t) => t.id === transferId && t.userId === userId);
    if (idx !== -1) {
      this.inMemoryData.transfers.splice(idx, 1);
      this.persistLocalDb();
      return true;
    }
    return false;
  }

  // --------------------------------------------------------------------------
  // LOANS & REPAYMENTS OPERATIONS
  // --------------------------------------------------------------------------
}
