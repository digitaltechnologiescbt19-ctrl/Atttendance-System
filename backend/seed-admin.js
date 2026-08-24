/**
 * NBI Smart Attendance — Admin Account Seed Script
 * Run: node seed-admin.js
 *
 * Uses bcrypt cost 10 (faster, still secure for development).
 * Production accounts should use cost 12 via the /api/auth/register endpoint.
 */

require('dotenv').config();
const { Pool } = require('pg');
const bcrypt   = require('bcryptjs');

const pool = new Pool({
  host:     process.env.DB_HOST,
  port:     Number(process.env.DB_PORT),
  user:     process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
});

async function run() {
  console.log('DB:', process.env.DB_NAME, '@', process.env.DB_HOST);

  const PASSWORD    = '000000';
  const COST_FACTOR = 10;

  console.log('Hashing password with cost', COST_FACTOR, '...');
  const hash = await bcrypt.hash(PASSWORD, COST_FACTOR);
  console.log('Hash OK. Length:', hash.length, '| Prefix:', hash.slice(0, 7));

  const selfCheck = await bcrypt.compare(PASSWORD, hash);
  if (!selfCheck) { console.error('FATAL: hash self-check failed'); process.exit(1); }

  const result = await pool.query(
    `INSERT INTO users (email, name, role, password_hash, is_verified, is_active, temp_password_used)
     VALUES ($1, $2, 'admin', $3, TRUE, TRUE, FALSE)
     ON CONFLICT (email) DO UPDATE
       SET password_hash = EXCLUDED.password_hash,
           is_verified   = TRUE,
           is_active     = TRUE,
           updated_at    = NOW()
     RETURNING id, email, name, role, is_verified, is_active`,
    ['admin@nbi.edu.gh', 'System Administrator', hash]
  );

  const row = result.rows[0];
  console.log('\nAdmin account saved:');
  console.log('  ID:       ', row.id);
  console.log('  Email:    ', row.email);
  console.log('  Role:     ', row.role);
  console.log('  Verified: ', row.is_verified);
  console.log('  Active:   ', row.is_active);

  // Final read-back verification
  const check = await pool.query(
    'SELECT password_hash FROM users WHERE email = $1',
    ['admin@nbi.edu.gh']
  );
  const storedHash  = check.rows[0].password_hash;
  const finalMatch  = await bcrypt.compare(PASSWORD, storedHash);
  console.log('\nStored hash length:', storedHash.length);
  console.log('Final verify "000000" against stored hash:', finalMatch ? 'PASS' : 'FAIL');

  if (!finalMatch) {
    console.error('ERROR: stored hash does not match. The DB may have encoding issues.');
    process.exit(1);
  }

  console.log('\nLogin credentials:');
  console.log('  Email:    admin@nbi.edu.gh');
  console.log('  Password: 000000');
}

run()
  .catch(e => { console.error('Error:', e.message); process.exit(1); })
  .finally(() => pool.end());
