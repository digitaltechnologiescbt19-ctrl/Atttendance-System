-- =============================================================
-- NBI Smart Attendance System
-- Migration 003 — System Settings Table
--
-- Run once:
--   psql -U postgres -d nbi_attendance -f 003_create_settings.sql
--
-- Key/value store for system-wide configuration that should
-- persist in the database rather than each browser's localStorage.
-- Each row is a named setting group stored as JSONB so the
-- schema does not need to change when new settings are added.
-- =============================================================

CREATE TABLE IF NOT EXISTS system_settings (
    key        TEXT    PRIMARY KEY,    -- e.g. 'institute', 'attendance_rules'
    value      JSONB   NOT NULL,
    updated_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Seed default attendance rules so a fresh install has sensible values
INSERT INTO system_settings (key, value)
VALUES (
    'attendance_rules',
    '{
        "present_window_minutes":   10,
        "late_threshold_minutes":   10,
        "session_duration_minutes": 60
    }'::jsonb
)
ON CONFLICT (key) DO NOTHING;

-- Seed default institute information
INSERT INTO system_settings (key, value)
VALUES (
    'institute',
    '{
        "name":       "NBI Institute",
        "short_name": "NBI",
        "email":      "",
        "phone":      "",
        "address":    ""
    }'::jsonb
)
ON CONFLICT (key) DO NOTHING;
