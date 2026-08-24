-- =============================================================
-- NBI Smart Attendance System
-- Migration 001 — Users / Authentication Table
--
-- Run once against the nbi_attendance database:
--   psql -U postgres -d nbi_attendance -f 001_create_users.sql
--
-- This table stores all authentication accounts for every role.
-- A user row is separate from the domain rows in `students` /
-- `lecturers` so the attendance schema stays unchanged.
-- The `linked_id` column points to the domain record once one
-- has been created (students.id for students, future
-- lecturers.id for lecturers, NULL for admins).
-- =============================================================

CREATE TYPE user_role AS ENUM ('admin', 'lecturer', 'student');

CREATE TABLE IF NOT EXISTS users (
    id                  SERIAL PRIMARY KEY,

    -- Identity
    email               TEXT        NOT NULL UNIQUE,
    name                TEXT        NOT NULL,
    role                user_role   NOT NULL,

    -- Authentication
    password_hash       TEXT        NOT NULL,
    -- Whether the user signed in at least once and changed their
    -- temporary password.  False until they use the temp password
    -- successfully, at which point they will be prompted to set
    -- a permanent password (future enhancement).
    temp_password_used  BOOLEAN     NOT NULL DEFAULT FALSE,

    -- Email verification
    is_verified         BOOLEAN     NOT NULL DEFAULT FALSE,
    -- 6-digit numeric code, NULL once verified
    verification_code   CHAR(6),
    -- Expire codes after 24 hours
    verification_sent_at TIMESTAMPTZ,

    -- Link to domain record (students.id or lecturers.id)
    linked_id           INTEGER,

    -- Account state
    is_active           BOOLEAN     NOT NULL DEFAULT TRUE,

    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for fast email lookup on every login
CREATE INDEX IF NOT EXISTS idx_users_email ON users (email);

-- Convenience view: expose non-sensitive columns to the app layer
CREATE OR REPLACE VIEW user_profiles AS
    SELECT
        id,
        email,
        name,
        role,
        is_verified,
        is_active,
        temp_password_used,
        linked_id,
        created_at
    FROM users;

-- =============================================================
-- Seed: one default administrator account
-- Password is the 6-digit temp code: 000000 (bcrypt hash below)
-- IMPORTANT: change this immediately after first login.
-- To regenerate a hash:
--   node -e "const b=require('bcryptjs');console.log(b.hashSync('000000',12))"
-- =============================================================
INSERT INTO users (email, name, role, password_hash, is_verified, is_active)
VALUES (
    'admin@nbi.edu.gh',
    'System Administrator',
    'admin',
    -- bcrypt hash of '000000', cost factor 12
    '$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewdBPj/o8xMzqSCq',
    TRUE,   -- admin accounts are pre-verified
    TRUE
)
ON CONFLICT (email) DO NOTHING;
