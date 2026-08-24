-- =============================================================
-- NBI Smart Attendance System
-- Migration 002 — Add password-reset token columns to users
--
-- Run once:
--   psql -U postgres -d nbi_attendance -f 002_add_reset_token.sql
--
-- Adds two new nullable columns that hold a bcrypt-hashed
-- short-lived reset token, issued ONLY after a valid OTP is
-- submitted.  This token gates the final "set new password"
-- step so the backend never trusts "the frontend says the OTP
-- was correct" — it trusts only its own signed artefact.
--
-- Flow:
--   POST /api/auth/request-password-reset  → stores plain OTP in verification_code
--   POST /api/auth/verify-reset-otp        → validates OTP, issues reset_token_hash
--   POST /api/auth/reset-password          → validates reset_token_hash, sets password
-- =============================================================

ALTER TABLE users
    ADD COLUMN IF NOT EXISTS reset_token_hash    TEXT,
    ADD COLUMN IF NOT EXISTS reset_token_expires TIMESTAMPTZ;

-- Revoke the reset token whenever the password changes so it
-- cannot be replayed if somehow intercepted.
-- (The application layer also clears these, but belt-and-suspenders.)

COMMENT ON COLUMN users.reset_token_hash    IS 'bcrypt hash of the short-lived password-reset token issued after OTP verification. NULL when not in a reset flow.';
COMMENT ON COLUMN users.reset_token_expires IS 'Expiry timestamp for the reset token. Token is invalid after this time.';
