-- Players table
CREATE TABLE players (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  lichess_username TEXT,
  chesscom_username TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  training_plan JSONB DEFAULT '{}',
  last_auto_update TIMESTAMPTZ
);

-- Rating history
CREATE TABLE rating_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id UUID REFERENCES players(id) ON DELETE CASCADE,
  timestamp TIMESTAMPTZ DEFAULT NOW(),
  lichess_rapid INT,
  lichess_puzzle INT,
  chesscom_rapid INT,
  chesscom_puzzle INT
);

-- Puzzle performance by theme (key for weakness analysis)
CREATE TABLE puzzle_performance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id UUID REFERENCES players(id) ON DELETE CASCADE,
  theme TEXT NOT NULL, -- 'pin', 'fork', 'backRankMate', etc.
  total INT DEFAULT 0,
  correct INT DEFAULT 0,
  accuracy DECIMAL(5,2) DEFAULT 0,
  last_updated TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(player_id, theme)
);

-- Opening statistics
CREATE TABLE opening_stats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id UUID REFERENCES players(id) ON DELETE CASCADE,
  opening_name TEXT NOT NULL,
  games_played INT DEFAULT 0,
  games_won INT DEFAULT 0,
  games_drawn INT DEFAULT 0,
  games_lost INT DEFAULT 0,
  win_rate DECIMAL(5,2) DEFAULT 0,
  last_updated TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(player_id, opening_name)
);

-- Game phase analysis
CREATE TABLE game_phase_stats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id UUID REFERENCES players(id) ON DELETE CASCADE,
  phase TEXT NOT NULL, -- 'opening', 'middlegame', 'endgame'
  accuracy DECIMAL(5,2) DEFAULT 0,
  games_analyzed INT DEFAULT 0,
  common_mistakes JSONB DEFAULT '[]',
  last_updated TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(player_id, phase)
);

-- Daily training tasks
CREATE TABLE training_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id UUID REFERENCES players(id) ON DELETE CASCADE,
  date DATE DEFAULT CURRENT_DATE,
  task_type TEXT NOT NULL, -- 'puzzle', 'endgame', 'opening', 'game'
  task_title TEXT NOT NULL,
  task_details TEXT,
  weakness_reason TEXT, -- Why this task was assigned
  link TEXT,
  priority TEXT DEFAULT 'medium', -- 'high', 'medium', 'low'
  completed BOOLEAN DEFAULT FALSE,
  completed_at TIMESTAMPTZ
);

-- Weekly training goals
CREATE TABLE weekly_goals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id UUID REFERENCES players(id) ON DELETE CASCADE,
  week_start DATE NOT NULL,
  goal_type TEXT NOT NULL,
  goal_text TEXT NOT NULL,
  target_value INT,
  current_value INT DEFAULT 0,
  achieved BOOLEAN DEFAULT FALSE,
  UNIQUE(player_id, week_start, goal_type)
);

-- Training streak tracking
CREATE TABLE training_streak (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id UUID REFERENCES players(id) ON DELETE CASCADE UNIQUE,
  current_streak INT DEFAULT 0,
  longest_streak INT DEFAULT 0,
  last_activity_date DATE,
  total_days_practiced INT DEFAULT 0
);

-- Enable RLS
ALTER TABLE players ENABLE ROW LEVEL SECURITY;
ALTER TABLE rating_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE puzzle_performance ENABLE ROW LEVEL SECURITY;
ALTER TABLE opening_stats ENABLE ROW LEVEL SECURITY;
ALTER TABLE game_phase_stats ENABLE ROW LEVEL SECURITY;
ALTER TABLE training_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE weekly_goals ENABLE ROW LEVEL SECURITY;
ALTER TABLE training_streak ENABLE ROW LEVEL SECURITY;

-- RLS Policies (public access for this demo)
CREATE POLICY "public_read_players" ON players FOR SELECT USING (true);
CREATE POLICY "public_insert_players" ON players FOR INSERT WITH CHECK (true);
CREATE POLICY "public_update_players" ON players FOR UPDATE USING (true);
CREATE POLICY "public_delete_players" ON players FOR DELETE USING (true);

CREATE POLICY "public_read_rating_history" ON rating_history FOR SELECT USING (true);
CREATE POLICY "public_insert_rating_history" ON rating_history FOR INSERT WITH CHECK (true);
CREATE POLICY "public_delete_rating_history" ON rating_history FOR DELETE USING (true);

CREATE POLICY "public_all_puzzle_performance" ON puzzle_performance FOR ALL USING (true);
CREATE POLICY "public_all_opening_stats" ON opening_stats FOR ALL USING (true);
CREATE POLICY "public_all_game_phase_stats" ON game_phase_stats FOR ALL USING (true);
CREATE POLICY "public_all_training_tasks" ON training_tasks FOR ALL USING (true);
CREATE POLICY "public_all_weekly_goals" ON weekly_goals FOR ALL USING (true);
CREATE POLICY "public_all_training_streak" ON training_streak FOR ALL USING (true);

-- Indexes for performance
CREATE INDEX idx_rating_history_player ON rating_history(player_id);
CREATE INDEX idx_puzzle_performance_player ON puzzle_performance(player_id);
CREATE INDEX idx_opening_stats_player ON opening_stats(player_id);
CREATE INDEX idx_training_tasks_player_date ON training_tasks(player_id, date);
CREATE INDEX idx_weekly_goals_player_week ON weekly_goals(player_id, week_start);