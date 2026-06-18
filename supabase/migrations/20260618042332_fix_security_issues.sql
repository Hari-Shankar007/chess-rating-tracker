-- Fix mutable search_path for trigger functions
ALTER FUNCTION public.update_goal_progress() SET search_path = public;
ALTER FUNCTION public.update_task_progress() SET search_path = public;

-- Disable RLS since this app uses anon key without authentication
-- The "USING (true)" policies were just bypassing RLS anyway
ALTER TABLE public.players DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.rating_history DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.puzzle_performance DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.opening_stats DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.game_phase_stats DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.training_tasks DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.weekly_goals DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.training_streak DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.puzzle_attempts DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.game_analysis DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.daily_puzzle_summary DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.goal_progress_history DISABLE ROW LEVEL SECURITY;
