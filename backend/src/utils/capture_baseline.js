import pg from 'pg';
import { config } from '../config/env.js';

async function main() {
  const pool = new pg.Pool({
    connectionString: config.databaseUrl,
    ssl: { rejectUnauthorized: false },
  });

  try {
    console.log('=== BEFORE MIGRATION BASELINE ===');
    const tables = ['users', 'accounts', 'categories', 'transactions', 'transfers', 'loans', 'repayments', 'budgets', 'audit_logs', 'system_settings'];
    for (const t of tables) {
      const res = await pool.query(`SELECT count(*) as count FROM "${t}"`);
      console.log(`Table ${t}: ${res.rows[0].count} rows`);
    }

    const txTotals = await pool.query(`
      SELECT 
        direction,
        count(*) as count,
        COALESCE(SUM(amount), 0) as total_amount
      FROM transactions
      GROUP BY direction;
    `);
    console.log('\nTransaction totals by direction:', txTotals.rows);

    const accBalances = await pool.query(`
      SELECT 
        count(*) as count,
        COALESCE(SUM(opening_balance), 0) as sum_opening,
        COALESCE(SUM(current_balance), 0) as sum_current
      FROM accounts;
    `);
    console.log('\nAccount balances total:', accBalances.rows[0]);

  } catch (err) {
    console.error('Error getting baseline:', err);
  } finally {
    await pool.end();
  }
}

main();
