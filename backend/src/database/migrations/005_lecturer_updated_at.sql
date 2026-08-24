-- Migration 005 — Add updated_at to lecturers if missing

ALTER TABLE lecturers
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();
