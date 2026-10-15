import pg from 'pg';
import { config } from '../config/env.js';

async function main() {
  const pool = new pg.Pool({
    connectionString: config.databaseUrl,
    ssl: { rejectUnauthorized: false },
  });

  try {
    console.log('--- Checking account duplicate names per user ---');
    const dupAccs = await pool.query(`
      SELECT user_id, LOWER(name) as name, count(*) 
      FROM accounts 
      GROUP BY user_id, LOWER(name) 
      HAVING count(*) > 1;
    `);
    console.log('Duplicate accounts:', dupAccs.rows);

    console.log('\n--- Checking category duplicate names per user/parent ---');
    const dupCats = await pool.query(`
      SELECT user_id, LOWER(name) as name, type, COALESCE(parent_id, '') as parent, count(*) 
      FROM categories 
      GROUP BY user_id, LOWER(name), type, COALESCE(parent_id, '') 
      HAVING count(*) > 1;
    `);
    console.log('Duplicate categories:', dupCats.rows);

    console.log('\n--- Checking transactions negative amounts ---');
    const negTxs = await pool.query('SELECT count(*) FROM transactions WHERE amount <= 0');
    console.log('Non-positive transactions:', negTxs.rows[0].count);

    console.log('\n--- Checking transfers invalid accounts or amounts ---');
    const badTrfs = await pool.query('SELECT count(*) FROM transfers WHERE amount <= 0 OR source_account_id = destination_account_id');
    console.log('Bad transfers:', badTrfs.rows[0].count);

    console.log('\n--- Checking loans non-positive principal or negative outstanding ---');
    const badLoans = await pool.query('SELECT count(*) FROM loans WHERE principal_amount <= 0 OR outstanding_principal < 0');
    console.log('Bad loans:', badLoans.rows[0].count);

    console.log('\n--- Checking repayments non-positive amount ---');
    const badReps = await pool.query('SELECT count(*) FROM repayments WHERE amount <= 0');
    console.log('Bad repayments:', badReps.rows[0].count);

    console.log('\n--- Checking null accounts fields ---');
    const nullAccs = await pool.query(`
      SELECT count(*) FROM accounts 
      WHERE opening_balance IS NULL OR current_balance IS NULL OR currency IS NULL OR status IS NULL
    `);
    console.log('Accounts with null required fields:', nullAccs.rows[0].count);

  } catch (err) {
    console.error('Error running check:', err);
  } finally {
    await pool.end();
  }
}

main();
