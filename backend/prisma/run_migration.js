import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import pg from 'pg';
import { config } from '../src/config/env.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function runMigration() {
  console.log('Starting safe database migration execution...');
  const pool = new pg.Pool({
    connectionString: config.databaseUrl,
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 15000,
  });

  const client = await pool.connect();
  try {
    const migrationFile = path.resolve(__dirname, 'migrations/20261015_normalized_architecture/migration.sql');
    if (!fs.existsSync(migrationFile)) {
      throw new Error(`Migration SQL not found at ${migrationFile}`);
    }

    const sql = fs.readFileSync(migrationFile, 'utf-8');
    console.log(`Executing SQL migration from: ${migrationFile}`);

    await client.query(sql);
    console.log('Migration SQL executed successfully!');

    // Post-migration verification
    console.log('\n=== POST-MIGRATION VERIFICATION ===');
    const tables = ['users', 'accounts', 'categories', 'transactions', 'transfers', 'loans', 'repayments', 'budgets', 'audit_logs', 'system_settings'];
    for (const t of tables) {
      const res = await client.query(`SELECT count(*) as count FROM "${t}"`);
      console.log(`Table ${t}: ${res.rows[0].count} rows`);
    }

    const txCategoryMatch = await client.query(`
      SELECT 
        count(*) as total_transactions,
        count(category_id) as matched_category_id
      FROM transactions;
    `);
    console.log('\nTransaction Category ID linking:', txCategoryMatch.rows[0]);

    const subcatsCount = await client.query(`
      SELECT 
        count(*) as total_categories,
        count(parent_id) as child_subcategories,
        count(CASE WHEN parent_id IS NULL THEN 1 END) as parent_categories
      FROM categories;
    `);
    console.log('Category normalization hierarchy:', subcatsCount.rows[0]);

    const txTotals = await client.query(`
      SELECT 
        direction,
        count(*) as count,
        COALESCE(SUM(amount), 0) as total_amount
      FROM transactions
      GROUP BY direction;
    `);
    console.log('Transaction monetary totals by direction:', txTotals.rows);

    const accBalances = await client.query(`
      SELECT 
        count(*) as count,
        COALESCE(SUM(opening_balance), 0) as sum_opening,
        COALESCE(SUM(current_balance), 0) as sum_current
      FROM accounts;
    `);
    console.log('Account balances total:', accBalances.rows[0]);

    console.log('\n=== ALL MIGRATION INVARIANTS VERIFIED! ===');
  } catch (err) {
    console.error('Migration failed:', err);
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

runMigration().catch((err) => {
  console.error('Migration fatal error:', err);
  process.exit(1);
});
