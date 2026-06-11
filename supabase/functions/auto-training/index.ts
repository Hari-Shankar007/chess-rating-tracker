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

// Lichess API puzzle themes mapping
const PUZZLE_THEMES = [
  "pin", "fork", "skewer", "discoveredAttack", "doubleAttack",
  "backRankMate", "mateIn1", "mateIn2", "mateIn3", "queenRookEndgame",
  "rookEndgame", "pawnEndgame", "knightEndgame", "bishopEndgame",
  "attraction", "deflection", "clearance", "interference",
  "lineOpening", "trappedPiece", "exchange", "capturingDefender",
  "removingTheDefender", "zugzwang", "promotion"
];

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
};

// Fetch Lichess puzzle activity
async function fetchLichessPuzzleActivity(username: string): Promise<any[]> {
  try {
    const response = await fetch(
      `https://lichess.org/api/puzzle/activity?max=100`,
      { headers: { "Accept": "application/json" } }
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

// Fetch Lichess user games for opening analysis
async function fetchLichessGames(username: string, max: number = 20): Promise<any[]> {
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

// Fetch Lichess user stats
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

// Analyze puzzle themes from activity
function analyzePuzzleThemes(puzzleActivity: any[]): Record<string, { total: number; correct: number; accuracy: number }> {
  const themeStats: Record<string, { total: number; correct: number }> = {};

  for (const activity of puzzleActivity) {
    if (!activity.puzzle || !activity.puzzle.themes) continue;
    const themes = activity.puzzle.themes;
    const correct = activity.win === true;

    for (const theme of themes) {
      if (!themeStats[theme]) {
        themeStats[theme] = { total: 0, correct: 0 };
      }
      themeStats[theme].total++;
      if (correct) themeStats[theme].correct++;
    }
  }

  // Calculate accuracy
  for (const theme of Object.keys(themeStats)) {
    const stats = themeStats[theme];
    themeStats[theme] = {
      ...stats,
      accuracy: stats.total > 0 ? (stats.correct / stats.total) * 100 : 0
    };
  }

  return themeStats as any;
}

// Analyze opening performance from games
function analyzeOpenings(games: any[], playerColor: 'white' | 'black' | null): any[] {
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

  return Object.entries(openingStats)
    .map(([name, stats]) => ({
      name,
      games_played: stats.played,
      games_won: stats.won,
      games_drawn: stats.drawn,
      games_lost: stats.lost,
      win_rate: stats.played > 0 ? (stats.won + stats.drawn * 0.5) / stats.played * 100 : 0
    }))
    .sort((a, b) => b.games_played - a.games_played);
}

// Identify weaknesses from theme stats
function identifyWeaknesses(themeStats: Record<string, any>): { theme: string; accuracy: number; strength: string }[] {
  const weaknesses: { theme: string; accuracy: number; strength: string }[] = [];

  for (const [theme, stats] of Object.entries(themeStats)) {
    if ((stats as any).total >= 3 && (stats as any).accuracy < 75) {
      let strength = 'weak';
      if ((stats as any).accuracy < 50) strength = 'critical';
      else if ((stats as any).accuracy < 65) strength = 'moderate';

      weaknesses.push({
        theme,
        accuracy: (stats as any).accuracy,
        strength
      });
    }
  }

  return weaknesses.sort((a, b) => a.accuracy - b.accuracy);
}

// Generate personalized training tasks based on weaknesses
function generateTrainingTasks(
  weaknesses: { theme: string; accuracy: number; strength: string }[],
  openingStats: any[],
  playerRating: number
): any[] {
  const tasks: any[] = [];

  // Priority 1: Focus on top weaknesses
  for (let i = 0; i < Math.min(3, weaknesses.length); i++) {
    const weakness = weaknesses[i];
    const themeCount = weakness.accuracy < 50 ? 25 :
                       weakness.accuracy < 65 ? 20 : 15;

    tasks.push({
      task_type: 'puzzle',
      task_title: `Solve ${themeCount} "${THEME_DISPLAY_NAMES[weakness.theme] || weakness.theme}" puzzles`,
      task_details: `Current accuracy: ${weakness.accuracy.toFixed(0)}%. Target: 80%`,
      weakness_reason: `Only ${weakness.accuracy.toFixed(0)}% accuracy detected (${weakness.strength} area)`,
      link: THEME_LINKS[weakness.theme] || `https://lichess.org/training/themes/${weakness.theme}`,
      priority: weakness.strength === 'critical' ? 'high' : 'medium'
    });
  }

  // Priority 2: Opening recommendations
  if (openingStats.length > 1) {
    const sortByWinRate = [...openingStats].sort((a, b) => b.win_rate - a.win_rate);
    const worstOpening = sortByWinRate[sortByWinRate.length - 1];
    const bestOpening = sortByWinRate[0];

    if (worstOpening && worstOpening.win_rate < 40 && worstOpening.games_played >= 3) {
      tasks.push({
        task_type: 'opening',
        task_title: `Consider replacing ${worstOpening.name}`,
        task_details: `Win rate: ${worstOpening.win_rate.toFixed(0)}% (${worstOpening.games_played} games)`,
        weakness_reason: `Low win rate with this opening (${worstOpening.win_rate.toFixed(0)}%)`,
        link: `https://lichess.org/analysis#explorer`,
        priority: 'medium'
      });

      if (bestOpening && bestOpening.win_rate > 50) {
        tasks.push({
          task_type: 'opening',
          task_title: `Study ${bestOpening.name} lines`,
          task_details: `Win rate: ${bestOpening.win_rate.toFixed(0)}% (${bestOpening.games_played} games) - your best opening!`,
          weakness_reason: `Stick with winning openings`,
          link: `https://lichess.org/analysis#explorer`,
          priority: 'low'
        });
      }
    }
  }

  // Priority 3: Game practice
  const gameCount = playerRating < 1500 ? 1 : 2;
  tasks.push({
    task_type: 'game',
    task_title: `Play ${gameCount} rapid game${gameCount > 1 ? 's' : ''}`,
    task_details: 'Apply the tactical patterns you practiced',
    weakness_reason: 'Practical application of training',
    link: 'https://lichess.org',
    priority: 'high'
  });

  return tasks;
}

// Generate weekly goals based on player profile
function generateWeeklyGoals(
  weaknesses: { theme: string; accuracy: number }[],
  playerRating: number,
  ratingChange: number
): any[] {
  const goals: any[] = [];

  // Weakness improvement goal
  if (weaknesses.length > 0) {
    const topWeakness = weaknesses[0];
    goals.push({
      goal_type: 'weakness_improvement',
      goal_text: `Improve ${THEME_DISPLAY_NAMES[topWeakness.theme]} accuracy to 80%`,
      target_value: 80,
      current_value: Math.round(topWeakness.accuracy)
    });
  }

  // Rating goal
  const ratingTarget = playerRating + (playerRating < 1500 ? 50 : playerRating < 1800 ? 30 : 20);
  goals.push({
    goal_type: 'rating_gain',
    goal_text: `Reach ${ratingTarget} rating`,
    target_value: ratingTarget,
    current_value: playerRating
  });

  // Puzzle volume goal
  goals.push({
    goal_type: 'puzzle_count',
    goal_text: 'Complete 100+ tactical puzzles',
    target_value: 100,
    current_value: 0
  });

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
      const { playerId, lichessUsername, action: bodyAction } = body;
      const actionType = action || bodyAction;

      if (actionType === "generate_plan") {
        // Generate training plan for a player
        const player = await supabase
          .from("players")
          .select("*")
          .eq("id", playerId)
          .single();

        if (!player.data) {
          return new Response(JSON.stringify({ error: "Player not found" }), {
            status: 404,
            headers: corsHeaders
          });
        }

        const username = lichessUsername || player.data.lichess_username;
        if (!username) {
          return new Response(JSON.stringify({ error: "No Lichess username" }), {
            status: 400,
            headers: corsHeaders
          });
        }

        // Fetch data from Lichess
        const [puzzleActivity, games, userStats] = await Promise.all([
          fetchLichessPuzzleActivity(username),
          fetchLichessGames(username, 30),
          fetchLichessUserStats(username)
        ]);

        // Analyze data
        const themeStats = analyzePuzzleThemes(puzzleActivity);
        const weaknesses = identifyWeaknesses(themeStats);
        const openingStats = analyzeOpenings(games, null);
        const playerRating = userStats?.perfs?.rapid?.rating || 1500;

        // Save puzzle performance
        for (const [theme, stats] of Object.entries(themeStats)) {
          await supabase
            .from("puzzle_performance")
            .upsert({
              player_id: playerId,
              theme,
              total: (stats as any).total,
              correct: (stats as any).correct,
              accuracy: (stats as any).accuracy,
              last_updated: new Date().toISOString()
            }, { onConflict: 'player_id,theme' });
        }

        // Save opening stats
        for (const opening of openingStats.filter(o => o.games_played >= 2)) {
          await supabase
            .from("opening_stats")
            .upsert({
              player_id: playerId,
              opening_name: opening.name,
              ...opening,
              last_updated: new Date().toISOString()
            }, { onConflict: 'player_id,opening_name' });
        }

        // Generate training tasks
        const tasks = generateTrainingTasks(weaknesses, openingStats, playerRating);
        const weeklyGoals = generateWeeklyGoals(weaknesses, playerRating, 0);

        // Clear old tasks and insert new ones
        await supabase
          .from("training_tasks")
          .delete()
          .eq("player_id", playerId)
          .eq("date", new Date().toISOString().split('T')[0]);

        for (const task of tasks) {
          await supabase
            .from("training_tasks")
            .insert({
              player_id: playerId,
              date: new Date().toISOString().split('T')[0],
              ...task
            });
        }

        // Insert weekly goals
        const weekStart = new Date();
        weekStart.setDate(weekStart.getDate() - weekStart.getDay());
        const weekStartStr = weekStart.toISOString().split('T')[0];

        for (const goal of weeklyGoals) {
          await supabase
            .from("weekly_goals")
            .upsert({
              player_id: playerId,
              week_start: weekStartStr,
              ...goal
            }, { onConflict: 'player_id,week_start,goal_type' });
        }

        // Update player with training plan
        await supabase
          .from("players")
          .update({
            training_plan: {
              weaknesses,
              themeStats,
              openingStats: openingStats.slice(0, 5),
              rating: playerRating,
              lastGenerated: new Date().toISOString()
            },
            last_auto_update: new Date().toISOString()
          })
          .eq("id", playerId);

        return new Response(JSON.stringify({
          success: true,
          message: "Training plan generated successfully",
          weaknesses: weaknesses.length,
          tasks: tasks.length,
          goals: weeklyGoals.length
        }), {
          headers: corsHeaders
        });
      }

      if (actionType === "add_player") {
        const { name, lichessUsername, chesscomUsername } = body;

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
            status: 400,
            headers: corsHeaders
          });
        }

        return new Response(JSON.stringify(data), {
          headers: corsHeaders
        });
      }

      if (actionType === "complete_task") {
        const { taskId } = body;

        await supabase
          .from("training_tasks")
          .update({
            completed: true,
            completed_at: new Date().toISOString()
          })
          .eq("id", taskId);

        return new Response(JSON.stringify({ success: true }), {
          headers: corsHeaders
        });
      }
    }

    if (req.method === "GET") {
      const playerId = url.searchParams.get("playerId");

      if (playerId) {
        // Get player with all training data
        const [player, tasks, goals, puzzlePerf, openings, streak] = await Promise.all([
          supabase.from("players").select("*").eq("id", playerId).single(),
          supabase.from("training_tasks").select("*").eq("player_id", playerId).eq("date", new Date().toISOString().split('T')[0]),
          supabase.from("weekly_goals").select("*").eq("player_id", playerId),
          supabase.from("puzzle_performance").select("*").eq("player_id", playerId).order('accuracy', { ascending: true }),
          supabase.from("opening_stats").select("*").eq("player_id", playerId).order('games_played', { ascending: false }),
          supabase.from("training_streak").select("*").eq("player_id", playerId).single()
        ]);

        return new Response(JSON.stringify({
          player: player.data,
          tasks: tasks.data || [],
          goals: goals.data || [],
          puzzlePerformance: puzzlePerf.data || [],
          openings: openings.data || [],
          streak: streak.data || { current_streak: 0, longest_streak: 0 }
        }), {
          headers: corsHeaders
        });
      }

      // Get all players
      const { data: players } = await supabase
        .from("players")
        .select("*")
        .order("created_at", { ascending: false });

      return new Response(JSON.stringify(players || []), {
        headers: corsHeaders
      });
    }

    return new Response(JSON.stringify({ error: "Invalid action" }), {
      status: 400,
      headers: corsHeaders
    });
  } catch (error) {
    console.error("Error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: corsHeaders
    });
  }
});
