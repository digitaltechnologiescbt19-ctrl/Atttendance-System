-- =============================================================
-- NBI Smart Attendance System
-- Migration 004 — Account Activation Workflow
--
-- Run once:
--   psql -U postgres -d nbi_attendance -f 004_account_activation.sql
--
-- Changes:
--   1. Makes password_hash nullable so a pre-registered person
--      can exist in users without a password until they activate.
--   2. Adds account_status column to track the lifecycle:
--        pending_activation → active → (deactivated handled by is_active)
--   3. Existing rows are patched: anyone with is_verified=true and
--      a password_hash gets status='active'.  Anyone with
--      is_verified=false gets 'pending_activation'.
-- =============================================================

-- 1. Allow password_hash to be NULL (pending accounts have no password yet)
ALTER TABLE users
    ALTER COLUMN password_hash DROP NOT NULL;

-- 2. Add account_status with sensible default
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'users' AND column_name = 'account_status'
    ) THEN
        ALTER TABLE users
            ADD COLUMN account_status TEXT NOT NULL DEFAULT 'pending_activation'
            CHECK (account_status IN ('pending_activation', 'active'));
    END IF;
END$$;

-- 3. Backfill existing rows so they are consistent
--    (all current users are verified admins, so set them active)
UPDATE users
SET account_status = CASE
    WHEN is_verified = TRUE AND password_hash IS NOT NULL THEN 'active'
    ELSE 'pending_activation'
END;

-- 4. Ensure students table has a unique email constraint if absent
--    (already present from earlier migration — idempotent)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE table_name = 'students'
          AND constraint_type = 'UNIQUE'
          AND constraint_name = 'students_email_key'
    ) THEN
        ALTER TABLE students ADD CONSTRAINT students_email_key UNIQUE (email);
    END IF;
END$$;

-- 5. Ensure lecturers table has a unique email constraint if absent
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE table_name = 'lecturers'
          AND constraint_type = 'UNIQUE'
          AND constraint_name = 'lecturers_email_key'
    ) THEN
        ALTER TABLE lecturers ADD CONSTRAINT lecturers_email_key UNIQUE (email);
    END IF;
END$$;

COMMENT ON COLUMN users.account_status IS
  'pending_activation: pre-registered, no password yet. active: fully activated.';
COMMENT ON COLUMN users.password_hash IS
  'NULL for pending_activation accounts. bcrypt hash once activated.';
