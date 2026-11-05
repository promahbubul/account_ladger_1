// Income and expense transactions. Mixed into DatabaseService, so `this` is the service.
import { encodeCursor, decodeCursor } from '../../utils/cursor.js';
import {
  formatToISODate,
  TRANSACTION_SELECT,
  mapTransactionRow,
  transactionFilters,
} from './helpers.js';

export class TransactionsMethods {
  async getTransactions(userId, filters = {}) {
    let txs = [];

    if (this.isPostgresConnected && this.pool) {
      const { where, values } = transactionFilters(userId, filters);
      const res = await this.pool.query(
        `${TRANSACTION_SELECT} WHERE ${where.join(' AND ')} ORDER BY date DESC, created_at DESC NULLS LAST, id DESC`,
        values
      );
      txs = res.rows.map(mapTransactionRow);
    } else {
      txs = this.inMemoryData.transactions.filter((t) => t.userId === userId);
      if (filters.type && filters.type !== 'ALL') {
        txs = txs.filter((t) => t.type === filters.type);
      }
      if (filters.accountId && filters.accountId !== 'ALL') {
        txs = txs.filter((t) => t.accountId === filters.accountId);
      }
      if (filters.category && filters.category !== 'ALL') {
        txs = txs.filter((t) => t.category === filters.category);
      }
      if (filters.startDate) {
        txs = txs.filter((t) => t.date >= filters.startDate);
      }
      if (filters.endDate) {
        txs = txs.filter((t) => t.date <= filters.endDate);
      }
      if (filters.search && filters.search.trim()) {
        const term = filters.search.trim().toLowerCase();
        txs = txs.filter(
          (t) =>
            t.description.toLowerCase().includes(term) ||
            (t.reference && t.reference.toLowerCase().includes(term)) ||
            (t.counterparty && t.counterparty.toLowerCase().includes(term)) ||
            (t.category && t.category.toLowerCase().includes(term))
        );
      }
    }

    return txs.sort((a, b) => {
      const dateA = formatToISODate(a.date);
      const dateB = formatToISODate(b.date);
      if (dateB !== dateA) return dateB.localeCompare(dateA);
      const timeA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const timeB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      if (timeB !== timeA) return timeB - timeA;
      return String(b.id || '').localeCompare(String(a.id || ''));
    });
  }

  async hasTransactionsInCategory(userId, categoryName) {
    if (this.isPostgresConnected && this.pool) {
      const res = await this.pool.query('SELECT 1 FROM transactions WHERE user_id = $1 AND category = $2 LIMIT 1', [userId, categoryName]);
      return res.rows.length > 0;
    }
    return this.inMemoryData.transactions.some((t) => t.userId === userId && t.category === categoryName);
  }

  async getPaginatedTransactions(userId, options) {
    if (this.isPostgresConnected && this.pool) {
      return this.queryPage({
        table: 'transactions',
        select: TRANSACTION_SELECT,
        filters: transactionFilters(userId, options),
        dateColumn: 'date',
        options,
        mapRow: mapTransactionRow,
        cursorField: 'date',
      });
    }
    const limit = options.limit || 50;
    const direction = options.direction || 'forward';
    const txs = await this.getTransactions(userId, options);

    const totalCount = txs.length;
    let cursorIdx = -1;
    if (options.cursor) {
      const decoded = decodeCursor(options.cursor);
      if (decoded && decoded.id) {
        cursorIdx = txs.findIndex((t) => t.id === decoded.id);
        if (cursorIdx === -1 && decoded.timestamp) {
          const cursorDate = String(decoded.timestamp).slice(0, 10);
          cursorIdx = txs.findIndex((t) => {
            const tDate = String(t.date).slice(0, 10);
            return tDate <= cursorDate;
          });
        }
      }
    }

    let items = [];
    let hasNextPage = false;
    let hasPreviousPage = false;

    if (options.page !== undefined && options.page > 0) {
      const pageNum = options.page;
      const startIndex = (pageNum - 1) * limit;
      items = txs.slice(startIndex, startIndex + limit);
      hasNextPage = startIndex + limit < txs.length;
      hasPreviousPage = startIndex > 0;
    } else if (direction === 'forward') {
      const startIndex = cursorIdx === -1 ? 0 : cursorIdx + 1;
      items = txs.slice(startIndex, startIndex + limit);
      hasNextPage = startIndex + limit < txs.length;
      hasPreviousPage = startIndex > 0;
    } else {
      const endIndex = cursorIdx === -1 ? txs.length : cursorIdx;
      const startIndex = Math.max(0, endIndex - limit);
      items = txs.slice(startIndex, endIndex);
      hasNextPage = endIndex < txs.length;
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

  async createTransaction(tx) {
    const cleanAmount = Number(tx.amount);
    if (isNaN(cleanAmount) || cleanAmount <= 0) {
      throw new Error('Transaction amount must be a positive number.');
    }

    if (this.isPostgresConnected && this.pool) {
      const client = await this.pool.connect();
      try {
        await client.query('BEGIN');

        // Check account ownership and lock row
        const accRes = await client.query(
          'SELECT id, name FROM accounts WHERE id = $1 AND user_id = $2 FOR UPDATE',
          [tx.accountId, tx.userId]
        );
        if (accRes.rows.length === 0) {
          throw new Error('Account not found or access denied.');
        }

        const categoryId = await this.insertTransactionRow(client, tx, cleanAmount, accRes.rows[0].name);

        let balanceDelta = 0;
        if (tx.direction === 'INFLOW') balanceDelta = cleanAmount;
        else if (tx.direction === 'OUTFLOW') balanceDelta = -cleanAmount;

        if (balanceDelta !== 0) {
          await client.query(
            'UPDATE accounts SET current_balance = current_balance + $1, updated_at = NOW() WHERE id = $2',
            [balanceDelta, tx.accountId]
          );
        }

        await client.query('COMMIT');
        return {
          ...tx,
          categoryId,
          amount: cleanAmount,
        };
      } catch (err) {
        await client.query('ROLLBACK');
        throw err;
      } finally {
        client.release();
      }
    } else {
      this.inMemoryData.transactions.push(tx);
      let balanceDelta = 0;
      if (tx.direction === 'INFLOW') balanceDelta = cleanAmount;
      else if (tx.direction === 'OUTFLOW') balanceDelta = -cleanAmount;

      if (balanceDelta !== 0) {
        await this.updateAccountBalance(tx.accountId, balanceDelta);
      }
      this.persistLocalDb();
      return tx;
    }
  }

  async insertTransactionRow(client, tx, cleanAmount, fallbackAccountName) {
    // Resolve or verify categoryId
    let categoryId = tx.categoryId || null;
    if (!categoryId && (tx.category || tx.subcategory)) {
      const catRes = await client.query(
        `SELECT id FROM categories
         WHERE user_id = $1
           AND (LOWER(name) = LOWER($2) OR (LOWER(name) = LOWER($3) AND $3 IS NOT NULL))
         ORDER BY parent_id NULLS LAST LIMIT 1`,
        [tx.userId, tx.subcategory || tx.category, tx.category]
      );
      if (catRes.rows.length > 0) {
        categoryId = catRes.rows[0].id;
      }
    }

    await client.query(
      `INSERT INTO transactions (id, user_id, account_id, account_name, category_id, type, category, subcategory, amount, direction, date, description, reference, counterparty, status, transfer_id, loan_id, destination_account_id, destination_account_name)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19)`,
      [
        tx.id,
        tx.userId,
        tx.accountId,
        tx.accountName || fallbackAccountName,
        categoryId,
        tx.type,
        tx.category || null,
        tx.subcategory || null,
        cleanAmount,
        tx.direction,
        tx.date,
        tx.description,
        tx.reference || null,
        tx.counterparty || null,
        tx.status || 'COMPLETED',
        tx.transferId || null,
        tx.loanId || null,
        tx.destinationAccountId || null,
        tx.destinationAccountName || null,
      ]
    );
    return categoryId;
  }

  // Saves every outflow in one DB transaction: all rows and the balance change commit together or not at all.
  // If any id already exists the batch was saved by an earlier attempt, so nothing is written again.
  async createBulkExpenseTransactions(userId, accountId, txs) {
    const totalCents = txs.reduce((sum, tx) => sum + Math.round(tx.amount * 100), 0);
    const total = totalCents / 100;
    const ids = txs.map((tx) => tx.id);

    if (this.isPostgresConnected && this.pool) {
      const client = await this.pool.connect();
      try {
        await client.query('BEGIN');

        const accRes = await client.query(
          'SELECT id, name FROM accounts WHERE id = $1 AND user_id = $2 FOR UPDATE',
          [accountId, userId]
        );
        if (accRes.rows.length === 0) {
          throw new Error('Account not found or access denied.');
        }

        const existing = await client.query(
          'SELECT id FROM transactions WHERE user_id = $1 AND id = ANY($2::varchar[])',
          [userId, ids]
        );
        if (existing.rows.length > 0) {
          await client.query('ROLLBACK');
          return { transactions: existing.rows, replayed: true };
        }

        const created = [];
        for (const tx of txs) {
          const categoryId = await this.insertTransactionRow(client, tx, tx.amount, accRes.rows[0].name);
          created.push({ ...tx, categoryId });
        }

        await client.query(
          'UPDATE accounts SET current_balance = current_balance - $1, updated_at = NOW() WHERE id = $2',
          [total, accountId]
        );

        await client.query('COMMIT');
        return { transactions: created, replayed: false };
      } catch (err) {
        await client.query('ROLLBACK');
        throw err;
      } finally {
        client.release();
      }
    } else {
      const existing = this.inMemoryData.transactions.filter((t) => ids.includes(t.id));
      if (existing.length > 0) {
        return { transactions: existing, replayed: true };
      }
      this.inMemoryData.transactions.push(...txs);
      await this.updateAccountBalance(accountId, -total);
      this.persistLocalDb();
      return { transactions: txs, replayed: false };
    }
  }

  async updateTransaction(id, userId, updates) {
    const txs = await this.getTransactions(userId);
    const existing = txs.find((t) => t.id === id);
    if (!existing) return null;

    const newAmount = updates.amount !== undefined ? Number(updates.amount) : existing.amount;
    const newAccountId = updates.accountId || existing.accountId;
    const accountChanged = newAccountId !== existing.accountId;
    const amountChanged = newAmount !== existing.amount;

    if (this.isPostgresConnected && this.pool) {
      const client = await this.pool.connect();
      try {
        await client.query('BEGIN');

        // 1. Rebalance accounts if account or amount changed
        if (accountChanged) {
          // Revert old transaction effect on old account
          const oldRevert = existing.direction === 'INFLOW' ? -existing.amount : existing.amount;
          await client.query(
            'UPDATE accounts SET current_balance = current_balance + $1, updated_at = NOW() WHERE id = $2',
            [oldRevert, existing.accountId]
          );
          // Apply new transaction effect on new account
          const newApply = existing.direction === 'INFLOW' ? newAmount : -newAmount;
          await client.query(
            'UPDATE accounts SET current_balance = current_balance + $1, updated_at = NOW() WHERE id = $2',
            [newApply, newAccountId]
          );
        } else if (amountChanged) {
          const diff = newAmount - existing.amount;
          const delta = existing.direction === 'INFLOW' ? diff : -diff;
          await client.query(
            'UPDATE accounts SET current_balance = current_balance + $1, updated_at = NOW() WHERE id = $2',
            [delta, existing.accountId]
          );
        }

        // 2. Build update query
        const fields = [];
        const values = [];
        let i = 1;

        if (updates.accountId !== undefined) {
          fields.push(`account_id = $${i++}`);
          values.push(updates.accountId);
        }
        if (updates.accountName !== undefined) {
          fields.push(`account_name = $${i++}`);
          values.push(updates.accountName);
        }
        if (updates.amount !== undefined) {
          fields.push(`amount = $${i++}`);
          values.push(newAmount);
        }
        if (updates.category !== undefined) {
          fields.push(`category = $${i++}`);
          values.push(updates.category);
        }
        if (updates.subcategory !== undefined) {
          fields.push(`subcategory = $${i++}`);
          values.push(updates.subcategory);
        }
        if (updates.category !== undefined || updates.subcategory !== undefined) {
          // Keep the link in step with the name, the same way a new transaction resolves it.
          const nextCategory = updates.category !== undefined ? updates.category : existing.category;
          const nextSubcategory = updates.subcategory !== undefined ? updates.subcategory : existing.subcategory;
          const catRes = await client.query(
            `SELECT id FROM categories
             WHERE user_id = $1
               AND (LOWER(name) = LOWER($2) OR (LOWER(name) = LOWER($3) AND $3 IS NOT NULL))
             ORDER BY parent_id NULLS LAST LIMIT 1`,
            [userId, nextSubcategory || nextCategory, nextCategory]
          );
          fields.push(`category_id = $${i++}`);
          values.push(catRes.rows[0]?.id ?? null);
        }
        if (updates.date !== undefined) {
          fields.push(`date = $${i++}`);
          values.push(updates.date);
        }
        if (updates.description !== undefined) {
          fields.push(`description = $${i++}`);
          values.push(updates.description);
        }
        if (updates.reference !== undefined) {
          fields.push(`reference = $${i++}`);
          values.push(updates.reference);
        }

        values.push(id, userId);

        await client.query(
          `UPDATE transactions SET ${fields.join(', ')} WHERE id = $${i++} AND user_id = $${i}`,
          values
        );

        await client.query('COMMIT');
      } catch (err) {
        await client.query('ROLLBACK');
        throw err;
      } finally {
        client.release();
      }

      const updatedList = await this.getTransactions(userId);
      return updatedList.find((t) => t.id === id) || null;
    }

    // In-memory fallback
    if (accountChanged) {
      const oldRevert = existing.direction === 'INFLOW' ? -existing.amount : existing.amount;
      await this.updateAccountBalance(existing.accountId, oldRevert);
      const newDelta = existing.direction === 'INFLOW' ? newAmount : -newAmount;
      await this.updateAccountBalance(newAccountId, newDelta);
    } else if (amountChanged) {
      const diff = newAmount - existing.amount;
      const delta = existing.direction === 'INFLOW' ? diff : -diff;
      await this.updateAccountBalance(existing.accountId, delta);
    }

    const idx = this.inMemoryData.transactions.findIndex((t) => t.id === id && t.userId === userId);
    if (idx !== -1) {
      this.inMemoryData.transactions[idx] = {
        ...this.inMemoryData.transactions[idx],
        ...updates,
      };
      this.persistLocalDb();
      return this.inMemoryData.transactions[idx];
    }
    return null;
  }

  async deleteTransaction(id, userId) {
    const txs = await this.getTransactions(userId);
    const existing = txs.find((t) => t.id === id);
    if (!existing) return false;

    let reverseDelta = 0;
    if (existing.direction === 'INFLOW') reverseDelta = -existing.amount;
    else if (existing.direction === 'OUTFLOW') reverseDelta = existing.amount;

    if (this.isPostgresConnected && this.pool) {
      const client = await this.pool.connect();
      try {
        await client.query('BEGIN');
        if (reverseDelta !== 0) {
          await client.query(
            'UPDATE accounts SET current_balance = current_balance + $1, updated_at = NOW() WHERE id = $2',
            [reverseDelta, existing.accountId]
          );
        }
        await client.query('DELETE FROM transactions WHERE id = $1 AND user_id = $2', [id, userId]);
        await client.query('COMMIT');
        return true;
      } catch (err) {
        await client.query('ROLLBACK');
        throw err;
      } finally {
        client.release();
      }
    }

    if (reverseDelta !== 0) {
      await this.updateAccountBalance(existing.accountId, reverseDelta);
    }
    const idx = this.inMemoryData.transactions.findIndex((t) => t.id === id && t.userId === userId);
    if (idx !== -1) {
      this.inMemoryData.transactions.splice(idx, 1);
      this.persistLocalDb();
      return true;
    }
    return false;
  }

  // --------------------------------------------------------------------------
  // TRANSFERS OPERATIONS
  // --------------------------------------------------------------------------
}
