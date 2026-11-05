// Accounts and their balances. Mixed into DatabaseService, so `this` is the service.
import { logger } from '../../utils/logger.js';

export class AccountsMethods {
  async getAccounts(userId) {
    if (this.isPostgresConnected && this.pool) {
      const res = await this.pool.query(
        'SELECT id, user_id as "userId", name, type, provider_name as "providerName", account_number as "accountNumber", opening_balance as "openingBalance", current_balance as "currentBalance", currency, status, created_at as "createdAt", updated_at as "updatedAt" FROM accounts WHERE user_id = $1 ORDER BY created_at DESC',
        [userId]
      );
      return res.rows.map((r) => ({
        ...r,
        openingBalance: Number(r.openingBalance),
        currentBalance: Number(r.currentBalance),
      }));
    }
    return this.inMemoryData.accounts.filter((a) => a.userId === userId);
  }

  async getAccountById(userId, accountId) {
    const accounts = await this.getAccounts(userId);
    return accounts.find((a) => a.id === accountId) || null;
  }

  async createAccount(account) {
    if (this.isPostgresConnected && this.pool) {
      await this.pool.query(
        `INSERT INTO accounts (id, user_id, name, type, provider_name, account_number, opening_balance, current_balance, currency, status)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
        [
          account.id,
          account.userId,
          account.name,
          account.type,
          account.providerName || null,
          account.accountNumber || null,
          account.openingBalance || 0,
          account.currentBalance !== undefined ? account.currentBalance : account.openingBalance || 0,
          account.currency || 'BDT',
          account.status || 'ACTIVE',
        ]
      );
      return account;
    }
    this.inMemoryData.accounts.push(account);
    this.persistLocalDb();
    return account;
  }

  async updateAccount(id, userId, updates) {
    if (this.isPostgresConnected && this.pool) {
      const fields = [];
      const values = [];
      let i = 1;

      if (updates.name !== undefined) {
        fields.push(`name = $${i++}`);
        values.push(updates.name);
      }
      if (updates.type !== undefined) {
        fields.push(`type = $${i++}`);
        values.push(updates.type);
      }
      if (updates.providerName !== undefined) {
        fields.push(`provider_name = $${i++}`);
        values.push(updates.providerName);
      }
      if (updates.accountNumber !== undefined) {
        fields.push(`account_number = $${i++}`);
        values.push(updates.accountNumber);
      }
      if (updates.currentBalance !== undefined) {
        fields.push(`current_balance = $${i++}`);
        values.push(updates.currentBalance);
      }
      if (updates.status !== undefined) {
        fields.push(`status = $${i++}`);
        values.push(updates.status);
      }

      fields.push(`updated_at = NOW()`);
      values.push(id, userId);

      await this.pool.query(
        `UPDATE accounts SET ${fields.join(', ')} WHERE id = $${i++} AND user_id = $${i}`,
        values
      );
      return this.getAccountById(userId, id);
    }

    const idx = this.inMemoryData.accounts.findIndex((a) => a.id === id && a.userId === userId);
    if (idx !== -1) {
      this.inMemoryData.accounts[idx] = {
        ...this.inMemoryData.accounts[idx],
        ...updates,
        updatedAt: new Date().toISOString(),
      };
      this.persistLocalDb();
      return this.inMemoryData.accounts[idx];
    }
    return null;
  }

  async updateAccountBalance(accountId, delta) {
    if (this.isPostgresConnected && this.pool) {
      await this.pool.query(
        'UPDATE accounts SET current_balance = current_balance + $1, updated_at = NOW() WHERE id = $2',
        [delta, accountId]
      );
      return;
    }
    const acc = this.inMemoryData.accounts.find((a) => a.id === accountId);
    if (acc) {
      acc.currentBalance = Number((acc.currentBalance + delta).toFixed(2));
      acc.updatedAt = new Date().toISOString();
      this.persistLocalDb();
    }
  }

  async reconcileAccountBalance(accountId, userId) {
    if (this.isPostgresConnected && this.pool) {
      const client = await this.pool.connect();
      try {
        await client.query('BEGIN');
        const accRes = await client.query('SELECT * FROM accounts WHERE id = $1 AND user_id = $2 FOR UPDATE', [accountId, userId]);
        if (accRes.rows.length === 0) {
          await client.query('ROLLBACK');
          return null;
        }
        const acc = accRes.rows[0];
        const opening = Number(acc.opening_balance);

        const txRes = await client.query(
          `SELECT 
             COALESCE(SUM(CASE WHEN direction = 'INFLOW' THEN amount ELSE 0 END), 0) as inflows,
             COALESCE(SUM(CASE WHEN direction = 'OUTFLOW' THEN amount ELSE 0 END), 0) as outflows
           FROM transactions 
           WHERE account_id = $1 AND user_id = $2`,
          [accountId, userId]
        );
        const inflows = Number(txRes.rows[0].inflows);
        const outflows = Number(txRes.rows[0].outflows);

        const trfOutRes = await client.query(
          `SELECT COALESCE(SUM(amount + transfer_fee), 0) as transfers_out 
           FROM transfers WHERE source_account_id = $1 AND user_id = $2`,
          [accountId, userId]
        );
        const transfersOut = Number(trfOutRes.rows[0].transfers_out);

        const trfInRes = await client.query(
          `SELECT COALESCE(SUM(amount), 0) as transfers_in 
           FROM transfers WHERE destination_account_id = $1 AND user_id = $2`,
          [accountId, userId]
        );
        const transfersIn = Number(trfInRes.rows[0].transfers_in);

        const loansRes = await client.query(
          `SELECT 
             COALESCE(SUM(CASE WHEN type = 'LENT' THEN principal_amount ELSE 0 END), 0) as lent,
             COALESCE(SUM(CASE WHEN type = 'BORROWED' THEN principal_amount ELSE 0 END), 0) as borrowed
           FROM loans WHERE account_id = $1 AND user_id = $2`,
          [accountId, userId]
        );
        const lent = Number(loansRes.rows[0].lent);
        const borrowed = Number(loansRes.rows[0].borrowed);

        const repsRes = await client.query(
          `SELECT 
             COALESCE(SUM(CASE WHEN loan_type = 'LENT' THEN amount ELSE 0 END), 0) as lent_repaid,
             COALESCE(SUM(CASE WHEN loan_type = 'BORROWED' THEN amount ELSE 0 END), 0) as borrowed_repaid
           FROM repayments WHERE account_id = $1 AND user_id = $2`,
          [accountId, userId]
        );
        const lentRepaid = Number(repsRes.rows[0].lent_repaid);
        const borrowedRepaid = Number(repsRes.rows[0].borrowed_repaid);

        const calculatedBalance = Number(
          (opening + inflows - outflows - transfersOut + transfersIn - lent + borrowed + lentRepaid - borrowedRepaid).toFixed(2)
        );
        const currentStored = Number(acc.current_balance);
        const drift = Number((currentStored - calculatedBalance).toFixed(2));

        if (drift !== 0) {
          logger.warn(`Account balance drift detected for account ${accountId}: stored=${currentStored}, calculated=${calculatedBalance}, drift=${drift}. Auto-reconciling...`);
          await client.query('UPDATE accounts SET current_balance = $1, updated_at = NOW() WHERE id = $2', [calculatedBalance, accountId]);
        }

        await client.query('COMMIT');
        return {
          accountId,
          openingBalance: opening,
          storedBalance: currentStored,
          calculatedBalance,
          drift,
          reconciled: drift !== 0,
        };
      } catch (err) {
        await client.query('ROLLBACK');
        throw err;
      } finally {
        client.release();
      }
    }
    return null;
  }

  async reconcileAllUserAccounts(userId) {
    const accounts = await this.getAccounts(userId);
    const results = [];
    for (const a of accounts) {
      const res = await this.reconcileAccountBalance(a.id, userId);
      if (res) results.push(res);
    }
    return results;
  }

  async deleteAccount(id, userId) {
    // Safety check: Cannot delete account if it has any financial history
    const txs = await this.getTransactions(userId);
    if (txs.some((t) => t.accountId === id || t.destinationAccountId === id)) {
      return { success: false, error: 'Cannot delete account with existing transactions. Please archive it instead.' };
    }
    const trfs = await this.getTransfers(userId);
    if (trfs.some((t) => t.sourceAccountId === id || t.destinationAccountId === id)) {
      return { success: false, error: 'Cannot delete account with existing transfers. Please archive it instead.' };
    }
    const loans = await this.getLoans(userId);
    if (loans.some((l) => l.accountId === id)) {
      return { success: false, error: 'Cannot delete account with associated loans. Please archive it instead.' };
    }
    const reps = await this.getRepayments(userId);
    if (reps.some((r) => r.accountId === id)) {
      return { success: false, error: 'Cannot delete account with associated repayments. Please archive it instead.' };
    }

    if (this.isPostgresConnected && this.pool) {
      await this.pool.query('DELETE FROM accounts WHERE id = $1 AND user_id = $2', [id, userId]);
      return { success: true };
    }

    const idx = this.inMemoryData.accounts.findIndex((a) => a.id === id && a.userId === userId);
    if (idx !== -1) {
      this.inMemoryData.accounts.splice(idx, 1);
      this.persistLocalDb();
      return { success: true };
    }
    return { success: false, error: 'Account not found.' };
  }

  // --------------------------------------------------------------------------
  // CATEGORIES OPERATIONS
  // --------------------------------------------------------------------------
}
