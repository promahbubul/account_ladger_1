import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import pg from 'pg';
import { config } from '../src/config/env.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function run() {
  console.log('Applying 20261015_add_firebase_auth migration...');
  const pool = new pg.Pool({
    connectionString: config.databaseUrl,
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 15000,
  });

  const client = await pool.connect();
  try {
    const migrationFile = path.resolve(__dirname, 'migrations/20261015_add_firebase_auth/migration.sql');
    const sql = fs.readFileSync(migrationFile, 'utf-8');
    await client.query(sql);
    console.log('Migration applied successfully!');

    const res = await client.query(`
      SELECT column_name, data_type, is_nullable, column_default 
      FROM information_schema.columns 
      WHERE table_name = 'users' AND column_name IN ('firebase_uid', 'auth_provider', 'avatar_url')
    `);
    console.log('Verified columns in users table:', res.rows);
  } finally {
    client.release();
    await pool.end();
  }
}

run().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
