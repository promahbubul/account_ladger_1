import pg from 'pg';
import { config } from '../config/env.js';

async function main() {
  console.log('Testing connection with databaseUrl...');
  const pool = new pg.Pool({
    connectionString: config.databaseUrl,
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 8000,
  });

  try {
    const res = await pool.query('SELECT NOW() as now, current_database() as db, current_user as user');
    console.log('Connected to PostgreSQL:', res.rows[0]);

    const tables = await pool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      ORDER BY table_name;
    `);
    console.log('\n--- Existing Tables ---');
    for (const t of tables.rows) {
      const countRes = await pool.query(`SELECT count(*) FROM "${t.table_name}"`);
      console.log(`- ${t.table_name}: ${countRes.rows[0].count} rows`);
    }

    console.log('\n--- Constraints ---');
    const constraints = await pool.query(`
      SELECT tc.table_name, tc.constraint_name, tc.constraint_type, kcu.column_name
      FROM information_schema.table_constraints tc
      LEFT JOIN information_schema.key_column_usage kcu
        ON tc.constraint_name = kcu.constraint_name
        AND tc.table_schema = kcu.table_schema
      WHERE tc.table_schema = 'public'
      ORDER BY tc.table_name, tc.constraint_type, tc.constraint_name;
    `);
    for (const c of constraints.rows) {
      console.log(`[${c.table_name}] ${c.constraint_type}: ${c.constraint_name} (col: ${c.column_name})`);
    }

    console.log('\n--- Check Constraints ---');
    const checks = await pool.query(`
      SELECT tc.table_name, tc.constraint_name, cc.check_clause
      FROM information_schema.table_constraints tc
      JOIN information_schema.check_constraints cc
        ON tc.constraint_name = cc.constraint_name
      WHERE tc.table_schema = 'public';
    `);
    for (const ch of checks.rows) {
      console.log(`[${ch.table_name}] CHECK ${ch.constraint_name}: ${ch.check_clause}`);
    }

    console.log('\n--- Table Columns ---');
    const cols = await pool.query(`
      SELECT table_name, column_name, data_type, is_nullable, column_default
      FROM information_schema.columns
      WHERE table_schema = 'public'
      ORDER BY table_name, ordinal_position;
    `);
    let currentTable = '';
    for (const c of cols.rows) {
      if (c.table_name !== currentTable) {
        currentTable = c.table_name;
        console.log(`\nTable [${currentTable}]:`);
      }
      console.log(`  - ${c.column_name}: ${c.data_type} (nullable: ${c.is_nullable}, default: ${c.column_default})`);
    }

  } catch (err) {
    console.error('Database query failed:', err);
  } finally {
    await pool.end();
  }
}

main();
