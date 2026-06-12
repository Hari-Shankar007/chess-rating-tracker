-- Allow public access for all operations on all tables
-- This is needed for the anon key to work without authentication

-- Players table
CREATE POLICY "Allow public select on players" ON players FOR SELECT USING (true);
CREATE POLICY "Allow public insert on players" ON players FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update on players" ON players FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "Allow public delete on players" ON players FOR DELETE USING (true);

-- Rating history
CREATE POLICY "Allow public select on rating_history" ON rating_history FOR SELECT USING (true);
CREATE POLICY "Allow public insert on rating_history" ON rating_history FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update on rating_history" ON rating_history FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "Allow public delete on rating_history" ON rating_history FOR DELETE USING (true);

-- Puzzle performance
CREATE POLICY "Allow public select on puzzle_performance" ON puzzle_performance FOR SELECT USING (true);
CREATE POLICY "Allow public insert on puzzle_performance" ON puzzle_performance FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update on puzzle_performance" ON puzzle_performance FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "Allow public delete on puzzle_performance" ON puzzle_performance FOR DELETE USING (true);

-- Opening stats
CREATE POLICY "Allow public select on opening_stats" ON opening_stats FOR SELECT USING (true);
CREATE POLICY "Allow public insert on opening_stats" ON opening_stats FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update on opening_stats" ON opening_stats FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "Allow public delete on opening_stats" ON opening_stats FOR DELETE USING (true);

-- Training tasks
CREATE POLICY "Allow public select on training_tasks" ON training_tasks FOR SELECT USING (true);
CREATE POLICY "Allow public insert on training_tasks" ON training_tasks FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update on training_tasks" ON training_tasks FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "Allow public delete on training_tasks" ON training_tasks FOR DELETE USING (true);

-- Weekly goals
CREATE POLICY "Allow public select on weekly_goals" ON weekly_goals FOR SELECT USING (true);
CREATE POLICY "Allow public insert on weekly_goals" ON weekly_goals FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update on weekly_goals" ON weekly_goals FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "Allow public delete on weekly_goals" ON weekly_goals FOR DELETE USING (true);

-- Training streak
CREATE POLICY "Allow public select on training_streak" ON training_streak FOR SELECT USING (true);
CREATE POLICY "Allow public insert on training_streak" ON training_streak FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update on training_streak" ON training_streak FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "Allow public delete on training_streak" ON training_streak FOR DELETE USING (true);

-- Game phase stats
CREATE POLICY "Allow public select on game_phase_stats" ON game_phase_stats FOR SELECT USING (true);
CREATE POLICY "Allow public insert on game_phase_stats" ON game_phase_stats FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update on game_phase_stats" ON game_phase_stats FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "Allow public delete on game_phase_stats" ON game_phase_stats FOR DELETE USING (true);

-- Puzzle attempts
CREATE POLICY "Allow public select on puzzle_attempts" ON puzzle_attempts FOR SELECT USING (true);
CREATE POLICY "Allow public insert on puzzle_attempts" ON puzzle_attempts FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update on puzzle_attempts" ON puzzle_attempts FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "Allow public delete on puzzle_attempts" ON puzzle_attempts FOR DELETE USING (true);

-- Game analysis
CREATE POLICY "Allow public select on game_analysis" ON game_analysis FOR SELECT USING (true);
CREATE POLICY "Allow public insert on game_analysis" ON game_analysis FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update on game_analysis" ON game_analysis FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "Allow public delete on game_analysis" ON game_analysis FOR DELETE USING (true);

-- Daily puzzle summary
CREATE POLICY "Allow public select on daily_puzzle_summary" ON daily_puzzle_summary FOR SELECT USING (true);
CREATE POLICY "Allow public insert on daily_puzzle_summary" ON daily_puzzle_summary FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update on daily_puzzle_summary" ON daily_puzzle_summary FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "Allow public delete on daily_puzzle_summary" ON daily_puzzle_summary FOR DELETE USING (true);

-- Goal progress history
CREATE POLICY "Allow public select on goal_progress_history" ON goal_progress_history FOR SELECT USING (true);
CREATE POLICY "Allow public insert on goal_progress_history" ON goal_progress_history FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update on goal_progress_history" ON goal_progress_history FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "Allow public delete on goal_progress_history" ON goal_progress_history FOR DELETE USING (true);
