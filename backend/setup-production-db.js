/**
 * NBI Smart Attendance — Production Database Setup
 *
 * Runs all migrations and seeds the essential accounts.
 * Safe to run multiple times — all operations are idempotent.
 *
 * Usage (against Render DB):
 *   node setup-production-db.js <DATABASE_URL>
 *
 * Or set DATABASE_URL in .env and run:
 *   node setup-production-db.js
 */

require('dotenv').config();
const { Pool } = require('pg');
const bcrypt   = require('bcryptjs');

/* ------------------------------------------------------------------ */
/*  Connection                                                          */
/* ------------------------------------------------------------------ */

const connectionString = process.argv[2] || process.env.DATABASE_URL;

let pool;
if (connectionString) {
  pool = new Pool({
    connectionString,
    ssl: { rejectUnauthorized: false }, // required for Render
  });
} else {
  pool = new Pool({
    host:     process.env.DB_HOST,
    port:     Number(process.env.DB_PORT),
    user:     process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
  });
}

/* ------------------------------------------------------------------ */
/*  Migrations                                                          */
/* ------------------------------------------------------------------ */

async function runMigrations(client) {
  console.log('\n── Running migrations ──────────────────────────────────');

  // ── 001: Core tables ────────────────────────────────────────────────
  // Create user_role enum only if it doesn't exist
  await client.query(`
    DO $$ BEGIN
      CREATE TYPE user_role AS ENUM ('admin', 'lecturer', 'student');
    EXCEPTION WHEN duplicate_object THEN NULL;
    END $$;
  `);

  await client.query(`
    CREATE TABLE IF NOT EXISTS users (
      id                   SERIAL PRIMARY KEY,
      email                TEXT        NOT NULL UNIQUE,
      name                 TEXT        NOT NULL,
      role                 user_role   NOT NULL,
      password_hash        TEXT,
      temp_password_used   BOOLEAN     NOT NULL DEFAULT FALSE,
      is_verified          BOOLEAN     NOT NULL DEFAULT FALSE,
      verification_code    CHAR(6),
      verification_sent_at TIMESTAMPTZ,
      linked_id            INTEGER,
      is_active            BOOLEAN     NOT NULL DEFAULT TRUE,
      created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  console.log('  ✓  users table');

  await client.query(`
    CREATE TABLE IF NOT EXISTS students (
      id             SERIAL PRIMARY KEY,
      student_number VARCHAR(50) NOT NULL UNIQUE,
      full_name      VARCHAR(255) NOT NULL,
      email          VARCHAR(255) NOT NULL UNIQUE,
      programme      VARCHAR(255) NOT NULL,
      created_at     TIMESTAMP DEFAULT NOW()
    )
  `);
  console.log('  ✓  students table');

  await client.query(`
    CREATE TABLE IF NOT EXISTS lecturers (
      id               SERIAL PRIMARY KEY,
      lecturer_number  VARCHAR(50) NOT NULL UNIQUE,
      full_name        VARCHAR(255) NOT NULL,
      email            VARCHAR(255) NOT NULL UNIQUE,
      department       VARCHAR(255) NOT NULL,
      created_at       TIMESTAMP DEFAULT NOW()
    )
  `);
  console.log('  ✓  lecturers table');

  await client.query(`
    CREATE TABLE IF NOT EXISTS courses (
      id           SERIAL PRIMARY KEY,
      course_code  VARCHAR(50) NOT NULL UNIQUE,
      course_name  VARCHAR(255) NOT NULL,
      programme    VARCHAR(255) NOT NULL,
      lecturer_id  INTEGER REFERENCES lecturers(id) ON DELETE SET NULL,
      created_at   TIMESTAMP DEFAULT NOW()
    )
  `);
  console.log('  ✓  courses table');

  await client.query(`
    CREATE TABLE IF NOT EXISTS sessions (
      id                     SERIAL PRIMARY KEY,
      course_id              INTEGER NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
      session_date           DATE NOT NULL,
      start_time             TIME NOT NULL,
      end_time               TIME NOT NULL,
      qr_token               VARCHAR(255),
      is_active              BOOLEAN DEFAULT TRUE,
      qr_generated_at        TIMESTAMP,
      present_window_minutes INTEGER DEFAULT 10,
      created_at             TIMESTAMP DEFAULT NOW()
    )
  `);
  console.log('  ✓  sessions table');

  await client.query(`
    CREATE TABLE IF NOT EXISTS attendance (
      id            SERIAL PRIMARY KEY,
      session_id    INTEGER NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
      student_id    INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
      status        VARCHAR(20) NOT NULL DEFAULT 'absent',
      check_in_time TIMESTAMP,
      created_at    TIMESTAMP DEFAULT NOW(),
      UNIQUE(session_id, student_id)
    )
  `);
  console.log('  ✓  attendance table');

  await client.query(`
    CREATE TABLE IF NOT EXISTS student_courses (
      student_id INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
      course_id  INTEGER NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
      PRIMARY KEY (student_id, course_id)
    )
  `);
  console.log('  ✓  student_courses table');

  // ── 002: Reset token columns ─────────────────────────────────────────
  await client.query(`
    ALTER TABLE users
      ADD COLUMN IF NOT EXISTS reset_token_hash    TEXT,
      ADD COLUMN IF NOT EXISTS reset_token_expires TIMESTAMPTZ
  `);
  console.log('  ✓  migration 002 (reset_token columns)');

  // ── 003: System settings ─────────────────────────────────────────────
  await client.query(`
    CREATE TABLE IF NOT EXISTS system_settings (
      key        TEXT PRIMARY KEY,
      value      JSONB NOT NULL,
      updated_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  await client.query(`
    INSERT INTO system_settings (key, value)
    VALUES
      ('attendance_rules', '{"present_window_minutes":10,"late_threshold_minutes":10,"session_duration_minutes":60}'),
      ('institute', '{"name":"NBI Institute","short_name":"NBI","email":"","phone":"","address":""}')
    ON CONFLICT (key) DO NOTHING
  `);
  console.log('  ✓  migration 003 (system_settings)');

  // ── 004: Account activation ───────────────────────────────────────────
  await client.query(`
    ALTER TABLE users ALTER COLUMN password_hash DROP NOT NULL
  `).catch(() => {}); // already nullable — ignore

  await client.query(`
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'users' AND column_name = 'account_status'
      ) THEN
        ALTER TABLE users
          ADD COLUMN account_status TEXT NOT NULL DEFAULT 'pending_activation'
          CHECK (account_status IN ('pending_activation','active'));
      END IF;
    END$$;
  `);
  await client.query(`
    UPDATE users
    SET account_status = CASE
      WHEN is_verified = TRUE AND password_hash IS NOT NULL THEN 'active'
      ELSE 'pending_activation'
    END
    WHERE account_status = 'pending_activation'
  `);
  console.log('  ✓  migration 004 (account_status)');

  // ── 005: Lecturer updated_at ──────────────────────────────────────────
  await client.query(`
    ALTER TABLE lecturers ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW()
  `);
  console.log('  ✓  migration 005 (lecturers.updated_at)');
}

/* ------------------------------------------------------------------ */
/*  Seed accounts                                                       */
/* ------------------------------------------------------------------ */

async function seedAccounts(client) {
  console.log('\n── Seeding accounts ────────────────────────────────────');

  const PASSWORD = '000000';
  const hash = await bcrypt.hash(PASSWORD, 12);

  // ── Admin ─────────────────────────────────────────────────────────────
  await client.query(`
    INSERT INTO users (email, name, role, password_hash, is_verified, is_active,
                       temp_password_used, account_status)
    VALUES ($1, 'System Administrator', 'admin', $2, TRUE, TRUE, FALSE, 'active')
    ON CONFLICT (email) DO UPDATE
      SET password_hash  = EXCLUDED.password_hash,
          is_verified    = TRUE,
          is_active      = TRUE,
          account_status = 'active',
          updated_at     = NOW()
  `, ['admin@nbi.edu.gh', hash]);
  console.log('  ✓  admin@nbi.edu.gh  (password: 000000)');

  // ── Test Lecturer A — okoro (linked_id=4, MAT201) ─────────────────────
  // First ensure the lecturer row exists
  const lecAResult = await client.query(`
    INSERT INTO lecturers (id, lecturer_number, full_name, email, department)
    VALUES (4, 'LEC004', 'Dr. Okoro', 'okoro8995@gmail.com', 'Mathematics')
    ON CONFLICT (id) DO UPDATE
      SET email = EXCLUDED.email, full_name = EXCLUDED.full_name
    RETURNING id
  `);
  const lecAId = lecAResult.rows[0].id;

  await client.query(`
    INSERT INTO users (email, name, role, password_hash, is_verified, is_active,
                       temp_password_used, account_status, linked_id)
    VALUES ($1, 'Dr. Okoro', 'lecturer', $2, TRUE, TRUE, FALSE, 'active', $3)
    ON CONFLICT (email) DO UPDATE
      SET password_hash  = EXCLUDED.password_hash,
          is_verified    = TRUE,
          is_active      = TRUE,
          account_status = 'active',
          linked_id      = EXCLUDED.linked_id,
          updated_at     = NOW()
  `, ['okoro8995@gmail.com', hash, lecAId]);
  console.log('  ✓  okoro8995@gmail.com  (Lecturer A, linked_id=4, password: 000000)');

  // ── Test Lecturer B — john.doe (linked_id=1, CSC101) ──────────────────
  const lecBResult = await client.query(`
    INSERT INTO lecturers (id, lecturer_number, full_name, email, department)
    VALUES (1, 'LEC001', 'Dr. John Doe', 'john.doe@nbi.test', 'Computer Science')
    ON CONFLICT (id) DO UPDATE
      SET email = EXCLUDED.email, full_name = EXCLUDED.full_name
    RETURNING id
  `);
  const lecBId = lecBResult.rows[0].id;

  await client.query(`
    INSERT INTO users (email, name, role, password_hash, is_verified, is_active,
                       temp_password_used, account_status, linked_id)
    VALUES ($1, 'Dr. John Doe', 'lecturer', $2, TRUE, TRUE, FALSE, 'active', $3)
    ON CONFLICT (email) DO UPDATE
      SET password_hash  = EXCLUDED.password_hash,
          is_verified    = TRUE,
          is_active      = TRUE,
          account_status = 'active',
          linked_id      = EXCLUDED.linked_id,
          updated_at     = NOW()
  `, ['john.doe@nbi.test', hash, lecBId]);
  console.log('  ✓  john.doe@nbi.test  (Lecturer B, linked_id=1, password: 000000)');

  // ── Seed courses so lecturers have something assigned ─────────────────
  await client.query(`
    INSERT INTO courses (course_code, course_name, programme, lecturer_id)
    VALUES ('MAT201', 'Mathematics II', 'BSc Mathematics', 4)
    ON CONFLICT (course_code) DO UPDATE SET lecturer_id = EXCLUDED.lecturer_id
  `);
  await client.query(`
    INSERT INTO courses (course_code, course_name, programme, lecturer_id)
    VALUES ('CSC101', 'Intro to Computer Science', 'BSc Computer Science', 1)
    ON CONFLICT (course_code) DO UPDATE SET lecturer_id = EXCLUDED.lecturer_id
  `);
  console.log('  ✓  courses seeded (MAT201 → Lecturer A, CSC101 → Lecturer B)');
}

/* ------------------------------------------------------------------ */
/*  Run                                                                 */
/* ------------------------------------------------------------------ */

async function run() {
  const client = await pool.connect();
  try {
    console.log('Connected to database.');
    await client.query('BEGIN');
    await runMigrations(client);
    await seedAccounts(client);
    await client.query('COMMIT');
    console.log('\n✓  Setup complete.\n');
    console.log('Login credentials:');
    console.log('  Admin:      admin@nbi.edu.gh     / 000000');
    console.log('  Lecturer A: okoro8995@gmail.com  / 000000');
    console.log('  Lecturer B: john.doe@nbi.test    / 000000');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('\nSetup failed — rolled back.', err.message);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

run();
