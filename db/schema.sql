-- =============================================================================
-- Live Event Voting System - Database Schema
-- Generic / White-Label Production Schema for PostgreSQL (Neon Serverless)
-- =============================================================================

-- Enable pgcrypto for gen_random_uuid() if needed
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 1. Event Settings (Singleton table, id = 1)
CREATE TABLE IF NOT EXISTS event_settings (
  id INT PRIMARY KEY DEFAULT 1,
  event_title VARCHAR(255) NOT NULL DEFAULT 'Live Event Voting',
  event_subtitle VARCHAR(255) NOT NULL DEFAULT 'Audience Choice Award',
  organizer_label VARCHAR(255) NOT NULL DEFAULT 'Event Committee',
  status VARCHAR(20) NOT NULL DEFAULT 'WAITING',
  require_pin BOOLEAN NOT NULL DEFAULT true,
  room_pin VARCHAR(10) NOT NULL DEFAULT '2026',
  timer_minutes INT NOT NULL DEFAULT 5,
  ends_at TIMESTAMPTZ NULL
);

-- Seed default row if not exists
INSERT INTO event_settings (id, event_title, event_subtitle, organizer_label, status, require_pin, room_pin, timer_minutes)
VALUES (1, 'Live Event Voting', 'Audience Choice Award', 'Event Committee', 'WAITING', true, '2026', 5)
ON CONFLICT (id) DO NOTHING;

-- 2. Candidates
CREATE TABLE IF NOT EXISTS candidates (
  id SERIAL PRIMARY KEY,
  number INT UNIQUE NOT NULL,
  name VARCHAR(255) NOT NULL,
  category VARCHAR(100) DEFAULT 'Participant',
  costume_theme VARCHAR(255),
  photo_data TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_candidates_number ON candidates (number);
CREATE INDEX IF NOT EXISTS idx_candidates_is_active ON candidates (is_active);

-- 3. Votes
CREATE TABLE IF NOT EXISTS votes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  candidate_id INT NOT NULL REFERENCES candidates(id) ON DELETE CASCADE,
  voter_token VARCHAR(255) UNIQUE NOT NULL,
  ip_hash VARCHAR(64),
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_votes_candidate_id ON votes (candidate_id);
CREATE INDEX IF NOT EXISTS idx_votes_voter_token ON votes (voter_token);
CREATE INDEX IF NOT EXISTS idx_votes_ip_hash ON votes (ip_hash);
