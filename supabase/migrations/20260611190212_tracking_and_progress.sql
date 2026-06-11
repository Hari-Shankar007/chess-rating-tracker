-- Track individual puzzle attempts for detailed analysis
CREATE TABLE puzzle_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id UUID REFERENCES players(id) ON DELETE CASCADE,
  puzzle_id TEXT NOT NULL,
  theme TEXT NOT NULL,
  success BOOLEAN NOT NULL,
  time_seconds INT,
  rating_before INT,
  rating_after INT,
  attempted_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(puzzle_id, player_id, attempted_at)
);

-- Track games analyzed for opening/endgame performance
CREATE TABLE game_analysis (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id UUID REFERENCES players(id) ON DELETE CASCADE,
  game_id TEXT NOT NULL,
  opening TEXT,
  result TEXT NOT NULL, -- 'win', 'loss', 'draw'
  player_color TEXT NOT NULL, -- 'white', 'black'
  opening_accuracy INT, -- percentage
  middlegame_accuracy INT,
  endgame_accuracy INT,
  critical_moments JSONB, -- key mistakes/blunders
  played_at TIMESTAMPTZ,
  analyzed_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(game_id, player_id)
);

-- Update training_tasks to track actual progress
ALTER TABLE training_tasks ADD COLUMN IF NOT EXISTS target_count INT DEFAULT 0;
ALTER TABLE training_tasks ADD COLUMN IF NOT EXISTS current_count INT DEFAULT 0;
ALTER TABLE training_tasks ADD COLUMN IF NOT EXISTS theme TEXT;

-- Create a daily puzzle summary for quick lookups
CREATE TABLE daily_puzzle_summary (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id UUID REFERENCES players(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  total_puzzles INT DEFAULT 0,
  correct_puzzles INT DEFAULT 0,
  themes_practiced JSONB DEFAULT '{}', -- {theme: {total: X, correct: Y}}
  UNIQUE(player_id, date)
);

-- Track weekly goal progress with history
CREATE TABLE goal_progress_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  goal_id UUID REFERENCES weekly_goals(id) ON DELETE CASCADE,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  previous_value INT,
  new_value INT,
  increment INT
);

-- Enable RLS
ALTER TABLE puzzle_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE game_analysis ENABLE ROW LEVEL SECURITY;
ALTER TABLE daily_puzzle_summary ENABLE ROW LEVEL SECURITY;
ALTER TABLE goal_progress_history ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "public_all_puzzle_attempts" ON puzzle_attempts FOR ALL USING (true);
CREATE POLICY "public_all_game_analysis" ON game_analysis FOR ALL USING (true);
CREATE POLICY "public_all_daily_summary" ON daily_puzzle_summary FOR ALL USING (true);
CREATE POLICY "public_all_goal_history" ON goal_progress_history FOR ALL USING (true);

-- Function to update weekly goal progress automatically
CREATE OR REPLACE FUNCTION update_goal_progress()
RETURNS TRIGGER AS $$
DECLARE
  goal RECORD;
  week_start DATE;
BEGIN
  -- Get the start of current week
  week_start := date_trunc('week', CURRENT_DATE);
  
  -- Update puzzle count goals
  FOR goal IN 
    SELECT id, goal_type, target_value, current_value
    FROM weekly_goals 
    WHERE player_id = NEW.player_id 
    AND week_start = week_start_date
    AND goal_type = 'puzzle_count'
  LOOP
    UPDATE weekly_goals 
    SET current_value = (
      SELECT COALESCE(SUM(total_puzzles), 0)
      FROM daily_puzzle_summary
      WHERE player_id = NEW.player_id
      AND date >= week_start
    ),
    achieved = (
      SELECT COALESCE(SUM(total_puzzles), 0) >= target_value
      FROM daily_puzzle_summary
      WHERE player_id = NEW.player_id
      AND date >= week_start
    )
    WHERE id = goal.id;
  END LOOP;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to update goals when daily summary changes
CREATE TRIGGER trigger_update_goals_on_puzzles
AFTER INSERT OR UPDATE ON daily_puzzle_summary
FOR EACH ROW
EXECUTE FUNCTION update_goal_progress();

-- Function to update training task progress
CREATE OR REPLACE FUNCTION update_task_progress()
RETURNS TRIGGER AS $$
BEGIN
  -- Update any matching training tasks for this theme
  UPDATE training_tasks
  SET current_count = current_count + 1
  WHERE player_id = NEW.player_id
  AND theme = NEW.theme
  AND date = CURRENT_DATE
  AND completed = false;
  
  -- Check if task is now complete
  UPDATE training_tasks
  SET completed = true, completed_at = NOW()
  WHERE player_id = NEW.player_id
  AND date = CURRENT_DATE
  AND current_count >= target_count
  AND target_count > 0;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-update task progress
CREATE TRIGGER trigger_update_task_on_puzzle
AFTER INSERT ON puzzle_attempts
FOR EACH ROW
EXECUTE FUNCTION update_task_progress();

-- Index for quick progress lookups
CREATE INDEX idx_puzzle_attempts_player_date ON puzzle_attempts(player_id, attempted_at DESC);
CREATE INDEX idx_daily_summary_player_date ON daily_puzzle_summary(player_id, date DESC);