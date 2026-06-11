import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const supabase = createClient(supabaseUrl, supabaseKey);

const THEME_DISPLAY_NAMES: Record<string, string> = {
  "pin": "Pins",
  "fork": "Forks",
  "skewer": "Skewers",
  "discoveredAttack": "Discovered Attacks",
  "doubleAttack": "Double Attacks",
  "backRankMate": "Back Rank Mates",
  "mateIn1": "Mate in 1",
  "mateIn2": "Mate in 2",
  "mateIn3": "Mate in 3+",
  "queenRookEndgame": "Queen + Rook Endgames",
  "rookEndgame": "Rook Endgames",
  "pawnEndgame": "Pawn Endgames",
  "knightEndgame": "Knight Endgames",
  "bishopEndgame": "Bishop Endgames",
  "attraction": "Attraction",
  "deflection": "Deflection",
  "clearance": "Clearance",
  "interference": "Interference",
  "lineOpening": "Line Opening",
  "trappedPiece": "Trapped Pieces",
  "exchange": "Exchanges",
  "capturingDefender": "Capturing the Defender",
  "removingTheDefender": "Removing the Defender",
  "zugzwang": "Zugzwang",
  "promotion": "Pawn Promotion"
};

const THEME_LINKS: Record<string, string> = {
  "pin": "https://lichess.org/training/themes/pin",
  "fork": "https://lichess.org/training/themes/fork",
  "skewer": "https://lichess.org/training/themes/skewer",
  "discoveredAttack": "https://lichess.org/training/themes/discoveredAttack",
  "backRankMate": "https://lichess.org/training/themes/backRankMate",
  "mateIn1": "https://lichess.org/training/themes/mateIn1",
  "mateIn2": "https://lichess.org/training/themes/mateIn2",
  "rookEndgame": "https://lichess.org/practice/rook-endgames",
  "pawnEndgame": "https://lichess.org/practice/pawn-endgames",
  "knightEndgame": "https://lichess.org/practice/knight-vs-pieces",
  "bishopEndgame": "https://lichess.org/practice/bishop-vs-pieces",
};

// Fetch Lichess puzzle activity - returns real puzzle attempts with themes
async function fetchLichessPuzzleActivity(username: string, max: number = 100): Promise<any[]> {
  try {
    const response = await fetch(
      `https://lichess.org/api/puzzle/activity?max=${max}`,
      { headers: { "Accept": "application/x-ndjson" } }
    );
    if (!response.ok) return [];
    const text = await response.text();
    return text.split('\n')
      .filter(line => line.trim())
      .map(line => JSON.parse(line));
  } catch (error) {
    console.error('Puzzle activity error:', error);
    return [];
  }
}

// Fetch recent games from Lichess
async function fetchLichessGames(username: string, max: number = 50): Promise<any[]> {
  try {
    const response = await fetch(
      `https://lichess.org/api/games/user/${username}?max=${max}&tags=true&clocks=false&evals=false&opening=true`,
      { headers: { "Accept": "application/x-ndjson" } }
    );
    if (!response.ok) return [];
    const text = await response.text();
    return text.split('\n\n').filter(g => g.trim()).map(game => {
      const lines = game.split('\n');
      const result: any = {};
      lines.forEach(line => {
        if (line.startsWith('[')) {
          const match = line.match(/\[([^\s]+)\s+"([^"]+)"\]/);
          if (match) result[match[1]] = match[2];
        }
      });
      return result;
    });
  } catch (error) {
    console.error('Games fetch error:', error);
    return [];
  }
}

// Get user stats from Lichess
async function fetchLichessUserStats(username: string): Promise<any> {
  try {
    const response = await fetch(`https://lichess.org/api/user/${username}`);
    if (!response.ok) return null;
    return await response.json();
  } catch (error) {
    console.error('User stats error:', error);
    return null;
  }
}

// Store puzzle attempts in database
async function storePuzzleAttempts(playerId: string, puzzleActivity: any[]) {
  const attempts = [];
  const themeAggregates: Record<string, { total: number; correct: number }> = {};

  for (const activity of puzzleActivity) {
    if (!activity.puzzle) continue;

    const themes = activity.puzzle.themes || [];
    const success = activity.win === true;
    const puzzleId = activity.puzzle.id;
    const attemptedAt = new Date(activity.date || Date.now()).toISOString();

    // Track each theme this puzzle had
    for (const theme of themes) {
      if (!themeAggregates[theme]) {
        themeAggregates[theme] = { total: 0, correct: 0 };
      }
      themeAggregates[theme].total++;
      if (success) themeAggregates[theme].correct++;

      attempts.push({
        player_id: playerId,
        puzzle_id: puzzleId,
        theme,
        success,
        time_seconds: activity.puzzle?.time,
        rating_before: activity.puzzle?.rating?.before,
        rating_after: activity.puzzle?.rating?.after,
        attempted_at: attemptedAt
      });
    }
  }

  // Store individual attempts (upsert to avoid duplicates)
  if (attempts.length > 0) {
    for (const attempt of attempts) {
      await supabase
        .from("puzzle_attempts")
        .upsert(attempt, { onConflict: 'puzzle_id,player_id,attempted_at' });
    }
  }

  // Update puzzle_performance table with latest aggregates
  for (const [theme, stats] of Object.entries(themeAggregates)) {
    const accuracy = stats.total > 0 ? (stats.correct / stats.total) * 100 : 0;
    await supabase
      .from("puzzle_performance")
      .upsert({
        player_id: playerId,
        theme,
        total: stats.total,
        correct: stats.correct,
        accuracy,
        last_updated: new Date().toISOString()
      }, { onConflict: 'player_id,theme' });
  }

  // Update daily summary
  const today = new Date().toISOString().split('T')[0];
  const todayAttempts = attempts.filter(a => a.attempted_at.startsWith(today));

  if (todayAttempts.length > 0) {
    const todayThemes: Record<string, { total: number; correct: number }> = {};
    for (const attempt of todayAttempts) {
      if (!todayThemes[attempt.theme]) {
        todayThemes[attempt.theme] = { total: 0, correct: 0 };
      }
      todayThemes[attempt.theme].total++;
      if (attempt.success) todayThemes[attempt.theme].correct++;
    }

    await supabase
      .from("daily_puzzle_summary")
      .upsert({
        player_id: playerId,
        date: today,
        total_puzzles: new Set(todayAttempts.map(a => a.puzzle_id)).size,
        correct_puzzles: new Set(todayAttempts.filter(a => a.success).map(a => a.puzzle_id)).size,
        themes_practiced: todayThemes
      }, { onConflict: 'player_id,date' });
  }

  return { attemptsCount: attempts.length, themesCount: Object.keys(themeAggregates).length };
}

// Store opening performance from games
async function storeOpeningStats(playerId: string, games: any[]) {
  const openingStats: Record<string, { played: number; won: number; drawn: number; lost: number }> = {};

  for (const game of games) {
    if (!game.Opening) continue;
    const opening = game.Opening.split(':')[0].trim();
    if (!openingStats[opening]) {
      openingStats[opening] = { played: 0, won: 0, drawn: 0, lost: 0 };
    }
    openingStats[opening].played++;

    if (game.Result === '1-0') openingStats[opening].won++;
    else if (game.Result === '0-1') openingStats[opening].lost++;
    else if (game.Result === '1/2-1/2') openingStats[opening].drawn++;
  }

  for (const [name, stats] of Object.entries(openingStats)) {
    const winRate = stats.played > 0 ? ((stats.won + stats.drawn * 0.5) / stats.played) * 100 : 0;
    await supabase
      .from("opening_stats")
      .upsert({
        player_id: playerId,
        opening_name: name,
        games_played: stats.played,
        games_won: stats.won,
        games_drawn: stats.drawn,
        games_lost: stats.lost,
        win_rate: winRate,
        last_updated: new Date().toISOString()
      }, { onConflict: 'player_id,opening_name' });
  }

  return Object.keys(openingStats).length;
}

// Calculate weaknesses from stored puzzle performance
async function calculateWeaknesses(playerId: string): Promise<any[]> {
  const { data: performance } = await supabase
    .from("puzzle_performance")
    .select("*")
    .eq("player_id", playerId)
    .gte("total", 3) // Only themes with at least 3 attempts
    .order("accuracy", { ascending: true });

  if (!performance || performance.length === 0) return [];

  const weaknesses = [];
  for (const perf of performance) {
    if (perf.accuracy < 75) {
      let strength = 'weak';
      if (perf.accuracy < 50) strength = 'critical';
      else if (perf.accuracy < 65) strength = 'moderate';

      weaknesses.push({
        theme: perf.theme,
        accuracy: perf.accuracy,
        total: perf.total,
        correct: perf.correct,
        strength
      });
    }
  }

  return weaknesses;
}

// Calculate strengths from stored puzzle performance
async function calculateStrengths(playerId: string): Promise<any[]> {
  const { data: performance } = await supabase
    .from("puzzle_performance")
    .select("*")
    .eq("player_id", playerId)
    .gte("total", 3)
    .gte("accuracy", 80)
    .order("accuracy", { ascending: false });

  if (!performance || performance.length === 0) return [];

  return performance.map(p => ({
    theme: p.theme,
    accuracy: p.accuracy,
    total: p.total
  }));
}

// Generate training tasks based on actual weaknesses
async function generateTrainingTasks(playerId: string, playerRating: number): Promise<any[]> {
  const weaknesses = await calculateWeaknesses(playerId);
  const { data: openings } = await supabase
    .from("opening_stats")
    .select("*")
    .eq("player_id", playerId)
    .order("games_played", { ascending: false })
    .limit(10);

  const tasks = [];

  // Priority 1: Focus on TOP weaknesses (lowest accuracy first)
  for (let i = 0; i < Math.min(3, weaknesses.length); i++) {
    const weakness = weaknesses[i];
    const themeCount = weakness.accuracy < 50 ? 25 :
                       weakness.accuracy < 65 ? 20 : 15;

    tasks.push({
      player_id: playerId,
      date: new Date().toISOString().split('T')[0],
      task_type: 'puzzle',
      task_title: `Solve ${themeCount} "${THEME_DISPLAY_NAMES[weakness.theme] || weakness.theme}" puzzles`,
      task_details: `Target: 80% accuracy | Current: ${weakness.accuracy.toFixed(0)}% | Difficulty: ${Math.max(1000, playerRating - 100)}-${playerRating + 100}`,
      weakness_reason: `WEAKNESS: Only ${weakness.accuracy.toFixed(0)}% accuracy (${weakness.correct}/${weakness.total} correct) - ${weakness.strength.toUpperCase()} area`,
      link: THEME_LINKS[weakness.theme] || `https://lichess.org/training`,
      priority: weakness.strength === 'critical' ? 'high' : weakness.strength === 'moderate' ? 'high' : 'medium',
      theme: weakness.theme,
      target_count: themeCount,
      current_count: 0,
      completed: false
    });
  }

  // Priority 2: Opening recommendations based on ACTUAL win rates
  if (openings && openings.length >= 2) {
    const sortedByWinRate = [...openings].sort((a, b) => b.win_rate - a.win_rate);
    const worstOpening = sortedByWinRate[sortedByWinRate.length - 1];
    const bestOpening = sortedByWinRate[0];

    // Recommend replacing bad opening
    if (worstOpening && worstOpening.win_rate < 40 && worstOpening.games_played >= 3) {
      tasks.push({
        player_id: playerId,
        date: new Date().toISOString().split('T')[0],
        task_type: 'opening',
        task_title: `Consider replacing: ${worstOpening.opening_name}`,
        task_details: `Study alternative openings or deepen knowledge of other systems`,
        weakness_reason: `WEAK OPENING: Only ${worstOpening.win_rate.toFixed(0)}% win rate (${worstOpening.games_played} games) - Try alternatives`,
        link: 'https://lichess.org/analysis#explorer',
        priority: 'medium',
        theme: null,
        target_count: 1,
        current_count: 0,
        completed: false
      });
    }

    // Reinforce good opening
    if (bestOpening && bestOpening.win_rate > 50 && bestOpening.games_played >= 3) {
      tasks.push({
        player_id: playerId,
        date: new Date().toISOString().split('T')[0],
        task_type: 'opening',
        task_title: `Continue mastering: ${bestOpening.opening_name}`,
        task_details: `Your strongest opening - study deeper lines and plans`,
        weakness_reason: `STRENGTH: ${bestOpening.win_rate.toFixed(0)}% win rate (${bestOpening.games_played} games) - Keep using this!`,
        link: 'https://lichess.org/analysis#explorer',
        priority: 'low',
        theme: null,
        target_count: 1,
        current_count: 0,
        completed: false
      });
    }
  }

  // Priority 3: Game practice (to apply tactics)
  const gameCount = playerRating < 1500 ? 1 : 2;
  tasks.push({
    player_id: playerId,
    date: new Date().toISOString().split('T')[0],
    task_type: 'game',
    task_title: `Play ${gameCount} rapid game${gameCount > 1 ? 's' : ''} (15+10)`,
    task_details: 'Apply the tactical patterns you practiced in real games',
    weakness_reason: 'PRACTICE: Apply your training in actual games',
    link: 'https://lichess.org',
    priority: 'high',
    theme: null,
    target_count: gameCount,
    current_count: 0,
    completed: false
  });

  // Clear old tasks and insert new ones
  await supabase
    .from("training_tasks")
    .delete()
    .eq("player_id", playerId);

  for (const task of tasks) {
    await supabase
      .from("training_tasks")
      .insert(task);
  }

  return tasks;
}

// Update weekly goals based on actual progress
async function updateWeeklyGoals(playerId: string, playerRating: number) {
  const weekStart = new Date();
  weekStart.setDate(weekStart.getDate() - weekStart.getDay());
  const weekStartStr = weekStart.toISOString().split('T')[0];

  // Get this week's puzzle count
  const { data: weeklySummary } = await supabase
    .from("daily_puzzle_summary")
    .select("total_puzzles, correct_puzzles")
    .eq("player_id", playerId)
    .gte("date", weekStartStr);

  const totalPuzzles = weeklySummary?.reduce((sum, d) => sum + d.total_puzzles, 0) || 0;
  const correctPuzzles = weeklySummary?.reduce((sum, d) => sum + d.correct_puzzles, 0) || 0;

  // Get weakness progress
  const weaknesses = await calculateWeaknesses(playerId);

  const goals = [
    {
      player_id: playerId,
      week_start: weekStartStr,
      goal_type: 'puzzle_count',
      goal_text: 'Complete 100+ tactical puzzles',
      target_value: 100,
      current_value: totalPuzzles,
      achieved: totalPuzzles >= 100
    },
    {
      player_id: playerId,
      week_start: weekStartStr,
      goal_type: 'rating_gain',
      goal_text: `Reach ${playerRating + (playerRating < 1500 ? 50 : 30)} rating`,
      target_value: playerRating + (playerRating < 1500 ? 50 : 30),
      current_value: playerRating,
      achieved: false
    },
    {
      player_id: playerId,
      week_start: weekStartStr,
      goal_type: 'accuracy',
      goal_text: `Achieve 70%+ puzzle accuracy`,
      target_value: 70,
      current_value: totalPuzzles > 0 ? Math.round((correctPuzzles / totalPuzzles) * 100) : 0,
      achieved: totalPuzzles > 0 && (correctPuzzles / totalPuzzles) >= 0.7
    }
  ];

  // Add weakness-specific goal if we have one
  if (weaknesses.length > 0) {
    const topWeakness = weaknesses[0];
    goals.push({
      player_id: playerId,
      week_start: weekStartStr,
      goal_type: 'weakness_improvement',
      goal_text: `Improve ${THEME_DISPLAY_NAMES[topWeakness.theme] || topWeakness.theme} to 75%+`,
      target_value: 75,
      current_value: Math.round(topWeakness.accuracy),
      achieved: topWeakness.accuracy >= 75
    });
  }

  // Upsert goals
  for (const goal of goals) {
    await supabase
      .from("weekly_goals")
      .upsert(goal, { onConflict: 'player_id,week_start,goal_type' });
  }

  return goals;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const action = url.searchParams.get("action");

    if (req.method === "POST") {
      const body = await req.json();
      const { playerId, lichessUsername, action: bodyAction, name, chesscomUsername } = body;
      const actionType = action || bodyAction;

      // Add new player
      if (actionType === "add_player") {
        const { data, error } = await supabase
          .from("players")
          .insert({
            name,
            lichess_username: lichessUsername || null,
            chesscom_username: chesscomUsername || null
          })
          .select()
          .single();

        if (error) {
          return new Response(JSON.stringify({ error: error.message }), {
            status: 400, headers: corsHeaders
          });
        }
        return new Response(JSON.stringify(data), { headers: corsHeaders });
      }

      // Sync puzzle data and generate plan
      if (actionType === "sync_and_plan" && playerId) {
        const { data: player } = await supabase
          .from("players")
          .select("*")
          .eq("id", playerId)
          .single();

        if (!player) {
          return new Response(JSON.stringify({ error: "Player not found" }), {
            status: 404, headers: corsHeaders
          });
        }

        const username = lichessUsername || player.lichess_username;
        if (!username) {
          return new Response(JSON.stringify({ error: "Lichess username required" }), {
            status: 400, headers: corsHeaders
          });
        }

        // Fetch all data from Lichess
        const [puzzleActivity, games, userStats] = await Promise.all([
          fetchLichessPuzzleActivity(username, 100),
          fetchLichessGames(username, 50),
          fetchLichessUserStats(username)
        ]);

        const playerRating = userStats?.perfs?.rapid?.rating || 1500;

        // Store puzzle attempts and update performance
        const puzzleResult = await storePuzzleAttempts(playerId, puzzleActivity);

        // Store opening statistics
        const openingsCount = await storeOpeningStats(playerId, games);

        // Generate training tasks based on ACTUAL weaknesses
        const tasks = await generateTrainingTasks(playerId, playerRating);

        // Update weekly goals with actual progress
        const goals = await updateWeeklyGoals(playerId, playerRating);

        // Update player record
        await supabase
          .from("players")
          .update({
            last_auto_update: new Date().toISOString(),
            training_plan: {
              lastGenerated: new Date().toISOString(),
              rating: playerRating,
              puzzlesAnalyzed: puzzleResult.attemptsCount,
              themesCount: puzzleResult.themesCount,
              openingsCount
            }
          })
          .eq("id", playerId);

        return new Response(JSON.stringify({
          success: true,
          message: "Training plan generated from real data",
          puzzlesAnalyzed: puzzleResult.attemptsCount,
          themesCount: puzzleResult.themesCount,
          openingsAnalyzed: openingsCount,
          tasksGenerated: tasks.length,
          goalsUpdated: goals.length
        }), { headers: corsHeaders });
      }

      // Mark task as complete
      if (actionType === "complete_task") {
        const { taskId } = body;
        await supabase
          .from("training_tasks")
          .update({
            completed: true,
            completed_at: new Date().toISOString()
          })
          .eq("id", taskId);

        return new Response(JSON.stringify({ success: true }), { headers: corsHeaders });
      }

      // Update rating snapshot
      if (actionType === "update_rating") {
        const { lichessRapid, lichessPuzzle, chesscomRapid, chesscomPuzzle } = body;

        await supabase
          .from("rating_history")
          .insert({
            player_id: playerId,
            lichess_rapid: lichessRapid,
            lichess_puzzle: lichessPuzzle,
            chesscom_rapid: chesscomRapid,
            chesscom_puzzle: chesscomPuzzle
          });

        return new Response(JSON.stringify({ success: true }), { headers: corsHeaders });
      }
    }

    if (req.method === "GET") {
      const playerId = url.searchParams.get("playerId");

      if (playerId) {
        // Get comprehensive player data
        const [
          player,
          tasks,
          goals,
          puzzlePerf,
          openings,
          todaySummary,
          recentAttempts,
          streak
        ] = await Promise.all([
          supabase.from("players").select("*").eq("id", playerId).single(),
          supabase.from("training_tasks").select("*").eq("player_id", playerId).eq("date", new Date().toISOString().split('T')[0]),
          supabase.from("weekly_goals").select("*").eq("player_id", playerId),
          supabase.from("puzzle_performance").select("*").eq("player_id", playerId).order('accuracy', { ascending: true }),
          supabase.from("opening_stats").select("*").eq("player_id", playerId).order('games_played', { ascending: false }),
          supabase.from("daily_puzzle_summary").select("*").eq("player_id", playerId).eq("date", new Date().toISOString().split('T')[0]).single(),
          supabase.from("puzzle_attempts").select("*").eq("player_id", playerId).order('attempted_at', { ascending: false }).limit(20),
          supabase.from("training_streak").select("*").eq("player_id", playerId).single()
        ]);

        // Calculate weaknesses with real data
        const weaknesses = puzzlePerf.data?.filter(p => p.accuracy < 75 && p.total >= 3)
          .map(p => ({
            theme: p.theme,
            accuracy: p.accuracy,
            total: p.total,
            correct: p.correct,
            strength: p.accuracy < 50 ? 'critical' : p.accuracy < 65 ? 'moderate' : 'weak'
          })) || [];

        // Calculate strengths
        const strengths = puzzlePerf.data?.filter(p => p.accuracy >= 80 && p.total >= 3)
          .map(p => ({
            theme: p.theme,
            accuracy: p.accuracy,
            total: p.total
          })) || [];

        return new Response(JSON.stringify({
          player: player.data,
          tasks: tasks.data || [],
          goals: goals.data || [],
          puzzlePerformance: puzzlePerf.data || [],
          weaknesses,
          strengths,
          openings: openings.data || [],
          todaySummary: todaySummary.data || null,
          recentAttempts: recentAttempts.data || [],
          streak: streak.data || { current_streak: 0, longest_streak: 0 }
        }), { headers: corsHeaders });
      }

      // Get all players
      const { data: players } = await supabase
        .from("players")
        .select("*")
        .order("created_at", { ascending: false });

      return new Response(JSON.stringify(players || []), { headers: corsHeaders });
    }

    return new Response(JSON.stringify({ error: "Invalid action" }), {
      status: 400, headers: corsHeaders
    });
  } catch (error) {
    console.error("Error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500, headers: corsHeaders
    });
  }
});
