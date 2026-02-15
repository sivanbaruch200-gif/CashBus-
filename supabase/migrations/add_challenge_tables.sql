-- CashBus Daily Challenge Tables
-- Run this in Supabase SQL Editor

-- Daily check-ins
CREATE TABLE IF NOT EXISTS user_checkins (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) NOT NULL,
  check_date DATE NOT NULL,
  points_earned INT DEFAULT 10,
  had_incident BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, check_date)
);

-- User gamification stats
CREATE TABLE IF NOT EXISTS user_gamification (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) UNIQUE NOT NULL,
  total_points INT DEFAULT 0,
  current_streak INT DEFAULT 0,
  longest_streak INT DEFAULT 0,
  level TEXT DEFAULT 'beginner',
  achievements JSONB DEFAULT '[]',
  last_checkin_date DATE,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_user_checkins_user_date ON user_checkins(user_id, check_date);
CREATE INDEX IF NOT EXISTS idx_user_gamification_user ON user_gamification(user_id);

-- RLS policies
ALTER TABLE user_checkins ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_gamification ENABLE ROW LEVEL SECURITY;

-- Users can view their own check-ins
CREATE POLICY "Users can view own checkins"
  ON user_checkins FOR SELECT
  USING (auth.uid() = user_id);

-- Users can insert their own check-ins
CREATE POLICY "Users can insert own checkins"
  ON user_checkins FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can view their own gamification stats
CREATE POLICY "Users can view own stats"
  ON user_gamification FOR SELECT
  USING (auth.uid() = user_id);

-- Users can insert their own gamification stats
CREATE POLICY "Users can insert own stats"
  ON user_gamification FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can update their own gamification stats
CREATE POLICY "Users can update own stats"
  ON user_gamification FOR UPDATE
  USING (auth.uid() = user_id);
