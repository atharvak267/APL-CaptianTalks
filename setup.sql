-- ============================================================
-- Captain Talks — Supabase Database Setup
-- Run this entire script in your Supabase SQL Editor
-- (Dashboard → SQL Editor → New Query → Paste → Run)
-- ============================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ──────────────────────────────────────────────
-- 1. Match Sessions
-- ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS match_sessions (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  team_batting TEXT NOT NULL,
  team_bowling TEXT NOT NULL,
  venue TEXT,
  innings INTEGER DEFAULT 1,
  match_context JSONB,
  captain_persona TEXT DEFAULT 'auto'
);

-- ──────────────────────────────────────────────
-- 2. AI Decisions
-- ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS ai_decisions (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  session_id UUID REFERENCES match_sessions(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  match_state JSONB,
  decision TEXT NOT NULL,
  reasoning TEXT,
  decision_type TEXT,
  field_placement JSONB
);

-- ──────────────────────────────────────────────
-- 3. Chat Messages
-- ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS chat_messages (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  session_id UUID REFERENCES match_sessions(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
  content TEXT NOT NULL
);

-- ──────────────────────────────────────────────
-- 4. Indexes for performance
-- ──────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_decisions_session ON ai_decisions(session_id);
CREATE INDEX IF NOT EXISTS idx_chat_session ON chat_messages(session_id);
CREATE INDEX IF NOT EXISTS idx_sessions_created ON match_sessions(created_at DESC);

-- ──────────────────────────────────────────────
-- 5. Row Level Security (open for prototyping)
-- ──────────────────────────────────────────────
ALTER TABLE match_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_decisions ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all on match_sessions" ON match_sessions
  FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Allow all on ai_decisions" ON ai_decisions
  FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Allow all on chat_messages" ON chat_messages
  FOR ALL USING (true) WITH CHECK (true);
