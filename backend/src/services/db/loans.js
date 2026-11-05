// Loans and their repayments. Mixed into DatabaseService, so `this` is the service.
import { encodeCursor, decodeCursor } from '../../utils/cursor.js';
import {
  LOAN_SELECT,
  mapLoanRow,
  REPAYMENT_SELECT,
  mapRepaymentRow,
  loanFilters,
  repaymentFilters,
} from './helpers.js';

export class LoansMethods {
  async getLoans(userId, filters = {}) {
    let loans = this.inMemoryData.loans.filter((l) => l.userId === userId);

    if (this.isPostgresConnected && this.pool) {
      const res = await this.pool.query(
        `${LOAN_SELECT} WHERE user_id = $1 ORDER BY start_date DESC, created_at DESC`,
        [userId]
      );
      loans = res.rows.map(mapLoanRow);
    }

    if (filters.type && filters.type !== 'ALL') {
      loans = loans.filter((l) => l.type === filters.type);
    }
    if (filters.status && filters.status !== 'ALL') {
      loans = loans.filter((l) => l.status === filters.status);
    }
    if (filters.search && filters.search.trim()) {
      const term = filters.search.trim().toLowerCase();
      loans = loans.filter(
        (l) =>
          l.counterpartyName.toLowerCase().includes(term) ||
          (l.counterpartyContact && l.counterpartyContact.toLowerCase().includes(term)) ||
          (l.notes && l.notes.toLowerCase().includes(term))
      );
    }

    return loans.sort((a, b) => {
      const dateCmp = new Date(b.startDate).getTime() - new Date(a.startDate).getTime();
      if (dateCmp !== 0) return dateCmp;
      const timeA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const timeB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return timeB - timeA;
    });
  }

  async getLoanById(userId, loanId) {
    if (this.isPostgresConnected && this.pool) {
      const res = await this.pool.query(`${LOAN_SELECT} WHERE user_id = $1 AND id = $2`, [userId, loanId]);
      return res.rows[0] ? mapLoanRow(res.rows[0]) : null;
    }
    return this.inMemoryData.loans.find((l) => l.userId === userId && l.id === loanId) || null;
  }

  async getPaginatedLoans(userId, options) {
    if (this.isPostgresConnected && this.pool) {
      return this.queryPage({
        table: 'loans',
        select: LOAN_SELECT,
        filters: loanFilters(userId, options),
        dateColumn: 'start_date',
        options,
        mapRow: mapLoanRow,
        cursorField: 'startDate',
      });
    }
    const limit = options.limit || 50;
    const direction = options.direction || 'forward';
    const loans = await this.getLoans(userId, options);

    const totalCount = loans.length;
    let cursorIdx = -1;
    if (options.cursor) {
      const decoded = decodeCursor(options.cursor);
      if (decoded && decoded.id) {
        cursorIdx = loans.findIndex((l) => l.id === decoded.id);
      }
    }

    let items = [];
    let hasNextPage = false;
    let hasPreviousPage = false;

    if (options.page !== undefined && options.page > 0) {
      const pageNum = options.page;
      const startIndex = (pageNum - 1) * limit;
      items = loans.slice(startIndex, startIndex + limit);
      hasNextPage = startIndex + limit < loans.length;
      hasPreviousPage = startIndex > 0;
    } else if (direction === 'forward') {
      const startIndex = cursorIdx === -1 ? 0 : cursorIdx + 1;
      items = loans.slice(startIndex, startIndex + limit);
      hasNextPage = startIndex + limit < loans.length;
      hasPreviousPage = startIndex > 0;
    } else {
      const endIndex = cursorIdx === -1 ? loans.length : cursorIdx;
      const startIndex = Math.max(0, endIndex - limit);
      items = loans.slice(startIndex, endIndex);
      hasNextPage = endIndex < loans.length;
      hasPreviousPage = startIndex > 0;
    }

    const nextCursor =
      items.length > 0 && hasNextPage
        ? encodeCursor({ id: items[items.length - 1].id, timestamp: items[items.length - 1].startDate })
        : null;
    const previousCursor =
      items.length > 0 && hasPreviousPage
        ? encodeCursor({ id: items[0].id, timestamp: items[0].startDate })
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

  async createLoan(loan) {
    const cleanPrincipal = Number(loan.principalAmount);
    if (isNaN(cleanPrincipal) || cleanPrincipal <= 0) {
      throw new Error('Principal amount must be a positive number.');
    }
    const delta = loan.type === 'LENT' ? -cleanPrincipal : cleanPrincipal;

    if (this.isPostgresConnected && this.pool) {
      const client = await this.pool.connect();
      try {
        await client.query('BEGIN');
        const accRes = await client.query('SELECT id, name FROM accounts WHERE id = $1 AND user_id = $2 FOR UPDATE', [loan.accountId, loan.userId]);
        if (accRes.rows.length === 0) {
          throw new Error('Disbursing/receiving account not found or access denied.');
        }

        await client.query(
          `INSERT INTO loans (id, user_id, account_id, account_name, type, counterparty_name, counterparty_contact, principal_amount, outstanding_principal, interest_rate, start_date, due_date, status, notes)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)`,
          [
            loan.id,
            loan.userId,
            loan.accountId,
            loan.accountName || accRes.rows[0].name,
            loan.type,
            loan.counterpartyName,
            loan.counterpartyContact || null,
            cleanPrincipal,
            cleanPrincipal,
            loan.interestRate || 0,
            loan.startDate,
            loan.dueDate || null,
            loan.status || 'ACTIVE',
            loan.notes || null,
          ]
        );

        // Adjust account balance
        await client.query(
          'UPDATE accounts SET current_balance = current_balance + $1, updated_at = NOW() WHERE id = $2',
          [delta, loan.accountId]
        );

        await client.query('COMMIT');
        return {
          ...loan,
          principalAmount: cleanPrincipal,
          outstandingPrincipal: cleanPrincipal,
        };
      } catch (err) {
        await client.query('ROLLBACK');
        throw err;
      } finally {
        client.release();
      }
    } else {
      this.inMemoryData.loans.push(loan);
      await this.updateAccountBalance(loan.accountId, delta);
      this.persistLocalDb();
      return loan;
    }
  }

  async deleteLoan(loanId, userId) {
    if (this.isPostgresConnected && this.pool) {
      const client = await this.pool.connect();
      try {
        await client.query('BEGIN');
        const loanRes = await client.query('SELECT * FROM loans WHERE id = $1 AND user_id = $2 FOR UPDATE', [loanId, userId]);
        if (loanRes.rows.length === 0) {
          await client.query('ROLLBACK');
          return false;
        }
        const existing = loanRes.rows[0];

        // Check and reverse any associated repayments
        const repsRes = await client.query('SELECT * FROM repayments WHERE loan_id = $1', [loanId]);
        for (const rep of repsRes.rows) {
          const repReverse = existing.type === 'LENT' ? -Number(rep.amount) : Number(rep.amount);
          await client.query('UPDATE accounts SET current_balance = current_balance + $1, updated_at = NOW() WHERE id = $2', [repReverse, rep.account_id]);
        }
        await client.query('DELETE FROM repayments WHERE loan_id = $1', [loanId]);

        // Reverse initial loan disbursement
        const reversePrincipal = existing.type === 'LENT' ? Number(existing.principal_amount) : -Number(existing.principal_amount);
        await client.query('UPDATE accounts SET current_balance = current_balance + $1, updated_at = NOW() WHERE id = $2', [reversePrincipal, existing.account_id]);

        await client.query('DELETE FROM loans WHERE id = $1 AND user_id = $2', [loanId, userId]);
        await client.query('COMMIT');
        return true;
      } catch (err) {
        await client.query('ROLLBACK');
        throw err;
      } finally {
        client.release();
      }
    }

    const loans = await this.getLoans(userId);
    const existing = loans.find((l) => l.id === loanId);
    if (!existing) return false;

    const reverse = existing.type === 'LENT' ? existing.principalAmount : -existing.principalAmount;
    await this.updateAccountBalance(existing.accountId, reverse);

    const idx = this.inMemoryData.loans.findIndex((l) => l.id === loanId && l.userId === userId);
    if (idx !== -1) {
      this.inMemoryData.loans.splice(idx, 1);
      this.inMemoryData.repayments = this.inMemoryData.repayments.filter((r) => r.loanId !== loanId);
      this.persistLocalDb();
      return true;
    }
    return false;
  }

  async getRepayments(userId, filters = {}) {
    let repayments = this.inMemoryData.repayments.filter((r) => r.userId === userId);

    if (this.isPostgresConnected && this.pool) {
      const res = await this.pool.query(
        `${REPAYMENT_SELECT} WHERE user_id = $1 ORDER BY date DESC, created_at DESC`,
        [userId]
      );
      repayments = res.rows.map(mapRepaymentRow);
    }

    if (filters.loanId) {
      repayments = repayments.filter((r) => r.loanId === filters.loanId);
    }
    if (filters.search && filters.search.trim()) {
      const term = filters.search.trim().toLowerCase();
      repayments = repayments.filter(
        (r) =>
          r.counterpartyName.toLowerCase().includes(term) ||
          (r.notes && r.notes.toLowerCase().includes(term))
      );
    }

    return repayments.sort((a, b) => {
      const dateCmp = new Date(b.date).getTime() - new Date(a.date).getTime();
      if (dateCmp !== 0) return dateCmp;
      const timeA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const timeB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return timeB - timeA;
    });
  }

  async getPaginatedRepayments(userId, options) {
    if (this.isPostgresConnected && this.pool) {
      return this.queryPage({
        table: 'repayments',
        select: REPAYMENT_SELECT,
        filters: repaymentFilters(userId, options),
        dateColumn: 'date',
        options,
        mapRow: mapRepaymentRow,
        cursorField: 'date',
      });
    }
    const limit = options.limit || 50;
    const direction = options.direction || 'forward';
    const reps = await this.getRepayments(userId, options);

    const totalCount = reps.length;
    let cursorIdx = -1;
    if (options.cursor) {
      const decoded = decodeCursor(options.cursor);
      if (decoded && decoded.id) {
        cursorIdx = reps.findIndex((r) => r.id === decoded.id);
      }
    }

    let items = [];
    let hasNextPage = false;
    let hasPreviousPage = false;

    if (options.page !== undefined && options.page > 0) {
      const pageNum = options.page;
      const startIndex = (pageNum - 1) * limit;
      items = reps.slice(startIndex, startIndex + limit);
      hasNextPage = startIndex + limit < reps.length;
      hasPreviousPage = startIndex > 0;
    } else if (direction === 'forward') {
      const startIndex = cursorIdx === -1 ? 0 : cursorIdx + 1;
      items = reps.slice(startIndex, startIndex + limit);
      hasNextPage = startIndex + limit < reps.length;
      hasPreviousPage = startIndex > 0;
    } else {
      const endIndex = cursorIdx === -1 ? reps.length : cursorIdx;
      const startIndex = Math.max(0, endIndex - limit);
      items = reps.slice(startIndex, endIndex);
      hasNextPage = endIndex < reps.length;
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

  async addRepayment(repayment) {
    const cleanAmount = Number(repayment.amount);
    if (isNaN(cleanAmount) || cleanAmount <= 0) {
      throw new Error('Repayment amount must be a positive number.');
    }

    if (this.isPostgresConnected && this.pool) {
      const client = await this.pool.connect();
      try {
        await client.query('BEGIN');
        const loanRes = await client.query('SELECT * FROM loans WHERE id = $1 AND user_id = $2 FOR UPDATE', [repayment.loanId, repayment.userId]);
        if (loanRes.rows.length === 0) {
          throw new Error('Associated loan not found or access denied.');
        }
        const loan = loanRes.rows[0];
        const outstanding = Number(loan.outstanding_principal);
        if (cleanAmount > outstanding) {
          throw new Error(`Repayment amount (${cleanAmount}) cannot exceed outstanding principal (${outstanding}).`);
        }

        const newOutstanding = Number(Math.max(0, outstanding - cleanAmount).toFixed(2));
        const newStatus = newOutstanding <= 0 ? 'SETTLED' : 'PARTIALLY_REPAID';

        await client.query(
          `INSERT INTO repayments (id, user_id, loan_id, counterparty_name, loan_type, account_id, account_name, amount, date, notes)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
          [
            repayment.id,
            repayment.userId,
            repayment.loanId,
            loan.counterparty_name,
            loan.type,
            repayment.accountId,
            repayment.accountName,
            cleanAmount,
            repayment.date,
            repayment.notes || null,
          ]
        );

        await client.query(
          'UPDATE loans SET outstanding_principal = $1, status = $2, updated_at = NOW() WHERE id = $3',
          [newOutstanding, newStatus, repayment.loanId]
        );

        // Money Lent Repaid: money returned to us -> INFLOW. Money Borrowed Repaid: money paid back -> OUTFLOW.
        const delta = loan.type === 'LENT' ? cleanAmount : -cleanAmount;
        await client.query(
          'UPDATE accounts SET current_balance = current_balance + $1, updated_at = NOW() WHERE id = $2',
          [delta, repayment.accountId]
        );

        await client.query('COMMIT');
        return {
          ...repayment,
          amount: cleanAmount,
        };
      } catch (err) {
        await client.query('ROLLBACK');
        throw err;
      } finally {
        client.release();
      }
    } else {
      const loans = await this.getLoans(repayment.userId);
      const loan = loans.find((l) => l.id === repayment.loanId);
      if (!loan) return null;
      if (cleanAmount > loan.outstandingPrincipal) {
        throw new Error(`Repayment amount (${cleanAmount}) cannot exceed outstanding principal (${loan.outstandingPrincipal}).`);
      }
      const newOutstanding = Number(Math.max(0, loan.outstandingPrincipal - cleanAmount).toFixed(2));
      const newStatus = newOutstanding <= 0 ? 'SETTLED' : 'PARTIALLY_REPAID';
      this.inMemoryData.repayments.push(repayment);
      loan.outstandingPrincipal = newOutstanding;
      loan.status = newStatus;
      loan.updatedAt = new Date().toISOString();
      const delta = loan.type === 'LENT' ? cleanAmount : -cleanAmount;
      await this.updateAccountBalance(repayment.accountId, delta);
      this.persistLocalDb();
      return repayment;
    }
  }

  // --------------------------------------------------------------------------
  // BUDGETS OPERATIONS
  // --------------------------------------------------------------------------
}
