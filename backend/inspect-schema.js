const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  host:     process.env.DB_HOST,
  port:     parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME,
  user:     process.env.DB_USER,
  password: process.env.DB_PASSWORD,
});

async function run() {
  // All tables
  const tables = await pool.query(
    "SELECT table_name FROM information_schema.tables WHERE table_schema='public' ORDER BY table_name"
  );
  console.log('\n=== ALL TABLES ===');
  tables.rows.forEach(r => console.log(' ', r.table_name));

  // Schema for key tables
  for (const table of ['users', 'lecturers', 'students']) {
    const r = await pool.query(
      'SELECT column_name, data_type, is_nullable FROM information_schema.columns WHERE table_name = $1 ORDER BY ordinal_position',
      [table]
    );
    console.log('\n=== ' + table.toUpperCase() + ' ===');
    r.rows.forEach(row =>
      console.log('  ' + row.column_name.padEnd(28) + row.data_type.padEnd(24) + 'nullable=' + row.is_nullable)
    );
  }
  await pool.end();
}

run().catch(e => { console.error(e.message); pool.end(); });
