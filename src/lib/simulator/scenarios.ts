export type Difficulty = "beginner" | "intermediate" | "advanced";
export type Decision = "buy" | "sell" | "wait";
export type PatternCategory = "chart" | "candlestick";

export interface Waypoint {
  barOffset: number;     // bars from start of pattern
  priceRatio: number;    // multiplier relative to start price (1.0 = same)
  volatilityScale?: number; // scale noise around this waypoint (default 1.0)
}

export interface ScenarioDefinition {
  id: string;
  name: string;
  category: PatternCategory;
  difficulty: Difficulty;
  correctAction: Decision;
  description: string;
  education: string;
  leadInBars: number;      // bars before pattern starts
  waypoints: Waypoint[];   // define the pattern shape
  resolutionBars: number;  // bars after decision point
  resolutionDrift: number; // price drift after pattern completes (positive = up)
}

export const SCENARIOS: ScenarioDefinition[] = [
  // ============================================================
  // CHART PATTERNS — Beginner
  // ============================================================
  {
    id: "double-top",
    name: "Double Top",
    category: "chart",
    difficulty: "beginner",
    correctAction: "sell",
    description: "Price hits a resistance level twice and fails to break above, signaling a reversal to the downside.",
    education: "A double top forms when price rallies to the same level twice but can't break through. The \"neckline\" is the support between the two peaks. When price breaks below the neckline, it typically drops by the same distance as the height of the pattern. This is a bearish reversal pattern — time to sell or go short.",
    leadInBars: 30,
    waypoints: [
      { barOffset: 0, priceRatio: 1.0 },
      { barOffset: 15, priceRatio: 1.08, volatilityScale: 0.6 },
      { barOffset: 25, priceRatio: 1.03, volatilityScale: 0.8 },
      { barOffset: 40, priceRatio: 1.08, volatilityScale: 0.6 },
      { barOffset: 50, priceRatio: 1.02, volatilityScale: 0.8 },
    ],
    resolutionBars: 20,
    resolutionDrift: -0.08,
  },
  {
    id: "double-bottom",
    name: "Double Bottom",
    category: "chart",
    difficulty: "beginner",
    correctAction: "buy",
    description: "Price hits a support level twice and bounces, signaling a reversal to the upside.",
    education: "A double bottom is the bullish mirror of a double top. Price drops to the same level twice, forming a \"W\" shape. When price breaks above the neckline (the peak between the two troughs), it signals a bullish reversal. Target the neckline-to-trough distance projected above the neckline.",
    leadInBars: 30,
    waypoints: [
      { barOffset: 0, priceRatio: 1.0 },
      { barOffset: 15, priceRatio: 0.92, volatilityScale: 0.6 },
      { barOffset: 25, priceRatio: 0.97, volatilityScale: 0.8 },
      { barOffset: 40, priceRatio: 0.92, volatilityScale: 0.6 },
      { barOffset: 50, priceRatio: 0.98, volatilityScale: 0.8 },
    ],
    resolutionBars: 20,
    resolutionDrift: 0.08,
  },
  {
    id: "bull-flag",
    name: "Bull Flag",
    category: "chart",
    difficulty: "beginner",
    correctAction: "buy",
    description: "A strong rally followed by a small downward consolidation (the flag), before continuing upward.",
    education: "Bull flags are continuation patterns. The \"pole\" is a sharp move up, and the \"flag\" is a tight downward channel. Volume typically drops during the flag and surges on the breakout. The measured move target equals the pole length added to the breakout point. These are high-probability setups when the trend is strong.",
    leadInBars: 20,
    waypoints: [
      { barOffset: 0, priceRatio: 1.0 },
      { barOffset: 10, priceRatio: 1.10, volatilityScale: 0.5 },
      { barOffset: 20, priceRatio: 1.07, volatilityScale: 0.4 },
      { barOffset: 30, priceRatio: 1.05, volatilityScale: 0.4 },
    ],
    resolutionBars: 15,
    resolutionDrift: 0.10,
  },
  {
    id: "bear-flag",
    name: "Bear Flag",
    category: "chart",
    difficulty: "beginner",
    correctAction: "sell",
    description: "A sharp drop followed by a small upward consolidation, before continuing downward.",
    education: "Bear flags are the bearish version of bull flags. After a sharp decline (the pole), price consolidates upward in a tight channel (the flag). When price breaks below the flag, it typically continues the downtrend. The target is the pole length projected downward from the breakdown point.",
    leadInBars: 20,
    waypoints: [
      { barOffset: 0, priceRatio: 1.0 },
      { barOffset: 10, priceRatio: 0.90, volatilityScale: 0.5 },
      { barOffset: 20, priceRatio: 0.93, volatilityScale: 0.4 },
      { barOffset: 30, priceRatio: 0.95, volatilityScale: 0.4 },
    ],
    resolutionBars: 15,
    resolutionDrift: -0.10,
  },

  // ============================================================
  // CHART PATTERNS — Intermediate
  // ============================================================
  {
    id: "head-and-shoulders",
    name: "Head & Shoulders",
    category: "chart",
    difficulty: "intermediate",
    correctAction: "sell",
    description: "Three peaks where the middle peak is the highest, indicating a bearish reversal.",
    education: "The head and shoulders is one of the most reliable reversal patterns. The left shoulder and right shoulder are at similar heights, while the head is higher. The neckline connects the troughs. A break below the neckline with volume confirms the reversal. Target equals head-to-neckline distance projected downward.",
    leadInBars: 25,
    waypoints: [
      { barOffset: 0, priceRatio: 1.0 },
      { barOffset: 12, priceRatio: 1.06, volatilityScale: 0.5 },
      { barOffset: 20, priceRatio: 1.02, volatilityScale: 0.6 },
      { barOffset: 32, priceRatio: 1.10, volatilityScale: 0.5 },
      { barOffset: 42, priceRatio: 1.02, volatilityScale: 0.6 },
      { barOffset: 52, priceRatio: 1.06, volatilityScale: 0.5 },
      { barOffset: 60, priceRatio: 1.01, volatilityScale: 0.7 },
    ],
    resolutionBars: 20,
    resolutionDrift: -0.10,
  },
  {
    id: "inverse-head-and-shoulders",
    name: "Inverse Head & Shoulders",
    category: "chart",
    difficulty: "intermediate",
    correctAction: "buy",
    description: "Three troughs where the middle trough is the deepest, indicating a bullish reversal.",
    education: "The inverse head and shoulders is the bullish counterpart. Three troughs form with the middle being deepest. A break above the neckline confirms the reversal. This pattern often appears at market bottoms and is considered highly reliable for bullish entries.",
    leadInBars: 25,
    waypoints: [
      { barOffset: 0, priceRatio: 1.0 },
      { barOffset: 12, priceRatio: 0.94, volatilityScale: 0.5 },
      { barOffset: 20, priceRatio: 0.98, volatilityScale: 0.6 },
      { barOffset: 32, priceRatio: 0.90, volatilityScale: 0.5 },
      { barOffset: 42, priceRatio: 0.98, volatilityScale: 0.6 },
      { barOffset: 52, priceRatio: 0.94, volatilityScale: 0.5 },
      { barOffset: 60, priceRatio: 0.99, volatilityScale: 0.7 },
    ],
    resolutionBars: 20,
    resolutionDrift: 0.10,
  },
  {
    id: "ascending-triangle",
    name: "Ascending Triangle",
    category: "chart",
    difficulty: "intermediate",
    correctAction: "buy",
    description: "Flat resistance with rising support — price squeezes into the top, typically breaking out upward.",
    education: "Ascending triangles show buyers becoming increasingly aggressive (higher lows) while sellers hold at the same level (flat top). The compression builds energy that typically resolves upward. Volume usually contracts during formation and expands on breakout. Target equals the triangle's height added to the breakout.",
    leadInBars: 20,
    waypoints: [
      { barOffset: 0, priceRatio: 1.0 },
      { barOffset: 10, priceRatio: 1.06, volatilityScale: 0.5 },
      { barOffset: 18, priceRatio: 1.02, volatilityScale: 0.4 },
      { barOffset: 26, priceRatio: 1.06, volatilityScale: 0.4 },
      { barOffset: 33, priceRatio: 1.03, volatilityScale: 0.3 },
      { barOffset: 40, priceRatio: 1.06, volatilityScale: 0.3 },
      { barOffset: 45, priceRatio: 1.05, volatilityScale: 0.3 },
    ],
    resolutionBars: 15,
    resolutionDrift: 0.08,
  },
  {
    id: "descending-triangle",
    name: "Descending Triangle",
    category: "chart",
    difficulty: "intermediate",
    correctAction: "sell",
    description: "Flat support with falling resistance — bearish continuation pattern breaking down.",
    education: "Descending triangles show sellers becoming more aggressive (lower highs) while a floor holds (flat bottom). This pattern typically resolves with a breakdown below support. It's the bearish mirror of the ascending triangle. Watch for volume expansion on the breakdown to confirm.",
    leadInBars: 20,
    waypoints: [
      { barOffset: 0, priceRatio: 1.0 },
      { barOffset: 10, priceRatio: 0.94, volatilityScale: 0.5 },
      { barOffset: 18, priceRatio: 0.98, volatilityScale: 0.4 },
      { barOffset: 26, priceRatio: 0.94, volatilityScale: 0.4 },
      { barOffset: 33, priceRatio: 0.97, volatilityScale: 0.3 },
      { barOffset: 40, priceRatio: 0.94, volatilityScale: 0.3 },
      { barOffset: 45, priceRatio: 0.95, volatilityScale: 0.3 },
    ],
    resolutionBars: 15,
    resolutionDrift: -0.08,
  },

  // ============================================================
  // CHART PATTERNS — Advanced
  // ============================================================
  {
    id: "cup-and-handle",
    name: "Cup & Handle",
    category: "chart",
    difficulty: "advanced",
    correctAction: "buy",
    description: "A rounded bottom (cup) followed by a small pullback (handle) before a bullish breakout.",
    education: "The cup and handle is a bullish continuation pattern. The cup forms as price drops gradually and rounds back up. The handle is a small pullback near the prior high. A breakout above the handle's resistance signals the buy. William O'Neil popularized this pattern — it works best in uptrending stocks with the cup depth < 33%.",
    leadInBars: 20,
    waypoints: [
      { barOffset: 0, priceRatio: 1.0 },
      { barOffset: 10, priceRatio: 0.96, volatilityScale: 0.6 },
      { barOffset: 20, priceRatio: 0.92, volatilityScale: 0.5 },
      { barOffset: 30, priceRatio: 0.92, volatilityScale: 0.5 },
      { barOffset: 40, priceRatio: 0.96, volatilityScale: 0.6 },
      { barOffset: 50, priceRatio: 1.0, volatilityScale: 0.6 },
      { barOffset: 58, priceRatio: 0.97, volatilityScale: 0.4 },
      { barOffset: 65, priceRatio: 1.0, volatilityScale: 0.4 },
    ],
    resolutionBars: 20,
    resolutionDrift: 0.10,
  },
  {
    id: "symmetrical-triangle",
    name: "Symmetrical Triangle",
    category: "chart",
    difficulty: "advanced",
    correctAction: "wait",
    description: "Converging trendlines with no clear bias — could break either way. Best to wait for confirmation.",
    education: "Symmetrical triangles are neutral patterns where both support and resistance converge. Unlike ascending/descending triangles, there's no inherent directional bias. The breakout direction determines the trade. Wait for a clear break with volume before entering. Trading before the breakout is a coin flip — patience is the key skill here.",
    leadInBars: 20,
    waypoints: [
      { barOffset: 0, priceRatio: 1.0 },
      { barOffset: 8, priceRatio: 1.05, volatilityScale: 0.5 },
      { barOffset: 16, priceRatio: 0.96, volatilityScale: 0.5 },
      { barOffset: 24, priceRatio: 1.03, volatilityScale: 0.4 },
      { barOffset: 32, priceRatio: 0.98, volatilityScale: 0.3 },
      { barOffset: 38, priceRatio: 1.01, volatilityScale: 0.3 },
      { barOffset: 42, priceRatio: 0.99, volatilityScale: 0.2 },
    ],
    resolutionBars: 15,
    resolutionDrift: 0.02,
  },
  {
    id: "rising-wedge",
    name: "Rising Wedge",
    category: "chart",
    difficulty: "advanced",
    correctAction: "sell",
    description: "Price makes higher highs and higher lows but the range narrows — bearish reversal signal.",
    education: "Rising wedges look bullish on the surface (higher highs, higher lows), but the narrowing range shows momentum is dying. When the lower trendline breaks, it often leads to a sharp sell-off. This is a deceptive pattern — the upward slope tricks many traders into thinking it's bullish.",
    leadInBars: 20,
    waypoints: [
      { barOffset: 0, priceRatio: 1.0 },
      { barOffset: 10, priceRatio: 1.06, volatilityScale: 0.5 },
      { barOffset: 16, priceRatio: 1.03, volatilityScale: 0.4 },
      { barOffset: 24, priceRatio: 1.08, volatilityScale: 0.4 },
      { barOffset: 30, priceRatio: 1.06, volatilityScale: 0.3 },
      { barOffset: 38, priceRatio: 1.09, volatilityScale: 0.3 },
      { barOffset: 44, priceRatio: 1.08, volatilityScale: 0.3 },
    ],
    resolutionBars: 15,
    resolutionDrift: -0.10,
  },
  {
    id: "falling-wedge",
    name: "Falling Wedge",
    category: "chart",
    difficulty: "advanced",
    correctAction: "buy",
    description: "Price makes lower lows and lower highs in a narrowing range — bullish reversal signal.",
    education: "Falling wedges are the bullish mirror of rising wedges. Despite making lower lows, the narrowing range indicates selling pressure is exhausting. A breakout above the upper trendline signals a bullish reversal. These often appear during pullbacks in uptrends and lead to strong recoveries.",
    leadInBars: 20,
    waypoints: [
      { barOffset: 0, priceRatio: 1.0 },
      { barOffset: 10, priceRatio: 0.94, volatilityScale: 0.5 },
      { barOffset: 16, priceRatio: 0.97, volatilityScale: 0.4 },
      { barOffset: 24, priceRatio: 0.92, volatilityScale: 0.4 },
      { barOffset: 30, priceRatio: 0.94, volatilityScale: 0.3 },
      { barOffset: 38, priceRatio: 0.91, volatilityScale: 0.3 },
      { barOffset: 44, priceRatio: 0.92, volatilityScale: 0.3 },
    ],
    resolutionBars: 15,
    resolutionDrift: 0.10,
  },

  // ============================================================
  // CANDLESTICK PATTERNS — Beginner
  // ============================================================
  {
    id: "hammer",
    name: "Hammer",
    category: "candlestick",
    difficulty: "beginner",
    correctAction: "buy",
    description: "A candle with a small body and long lower wick at the bottom of a downtrend — buyers stepping in.",
    education: "The hammer appears after a decline. Price dropped significantly during the session but buyers pushed it back up near the open, creating a long lower shadow. The body should be small (< 30% of total range) and the lower wick at least 2x the body. This signals that sellers are losing control and a reversal may be starting.",
    leadInBars: 20,
    waypoints: [
      { barOffset: 0, priceRatio: 1.0 },
      { barOffset: 8, priceRatio: 0.95, volatilityScale: 0.8 },
      { barOffset: 14, priceRatio: 0.91, volatilityScale: 0.6 },
    ],
    resolutionBars: 10,
    resolutionDrift: 0.06,
  },
  {
    id: "doji",
    name: "Doji",
    category: "candlestick",
    difficulty: "beginner",
    correctAction: "wait",
    description: "Open and close are nearly identical — market indecision. Wait for the next candle to confirm direction.",
    education: "A doji shows that neither buyers nor sellers won the session. The open and close are at nearly the same price. By itself, a doji is not a signal — it's a warning that the current trend may be losing steam. Always wait for the next candle: a bullish follow-through means buy, bearish means sell. Trading on the doji alone is premature.",
    leadInBars: 20,
    waypoints: [
      { barOffset: 0, priceRatio: 1.0 },
      { barOffset: 10, priceRatio: 1.05, volatilityScale: 0.7 },
      { barOffset: 14, priceRatio: 1.04, volatilityScale: 0.3 },
    ],
    resolutionBars: 10,
    resolutionDrift: 0.01,
  },

  // ============================================================
  // CANDLESTICK PATTERNS — Intermediate
  // ============================================================
  {
    id: "bullish-engulfing",
    name: "Bullish Engulfing",
    category: "candlestick",
    difficulty: "intermediate",
    correctAction: "buy",
    description: "A large green candle completely engulfs the previous red candle — strong buying momentum.",
    education: "A bullish engulfing pattern requires two candles. The first is a red (bearish) candle, and the second is a green (bullish) candle whose body completely engulfs the first candle's body. This shows buyers overwhelmed sellers in a single session. It's most powerful at support levels or after a downtrend.",
    leadInBars: 25,
    waypoints: [
      { barOffset: 0, priceRatio: 1.0 },
      { barOffset: 10, priceRatio: 0.94, volatilityScale: 0.7 },
      { barOffset: 16, priceRatio: 0.91, volatilityScale: 0.5 },
    ],
    resolutionBars: 12,
    resolutionDrift: 0.07,
  },
  {
    id: "bearish-engulfing",
    name: "Bearish Engulfing",
    category: "candlestick",
    difficulty: "intermediate",
    correctAction: "sell",
    description: "A large red candle engulfs the previous green candle — sellers taking control.",
    education: "The bearish engulfing is the mirror of the bullish version. A green candle is followed by a larger red candle that completely engulfs it. This shows a dramatic shift from buying to selling pressure. Most reliable at resistance levels or after an uptrend. The bigger the engulfing candle, the stronger the signal.",
    leadInBars: 25,
    waypoints: [
      { barOffset: 0, priceRatio: 1.0 },
      { barOffset: 10, priceRatio: 1.06, volatilityScale: 0.7 },
      { barOffset: 16, priceRatio: 1.09, volatilityScale: 0.5 },
    ],
    resolutionBars: 12,
    resolutionDrift: -0.07,
  },

  // ============================================================
  // CANDLESTICK PATTERNS — Advanced
  // ============================================================
  {
    id: "morning-star",
    name: "Morning Star",
    category: "candlestick",
    difficulty: "advanced",
    correctAction: "buy",
    description: "A three-candle reversal: big red → small body (star) → big green. Signals the dawn of an uptrend.",
    education: "The morning star is a three-candle bullish reversal pattern. Day 1: strong red candle confirms downtrend. Day 2: small body (gap down) shows selling exhaustion. Day 3: strong green candle (ideally closing above Day 1's midpoint) confirms the reversal. The \"star\" (Day 2) can be a doji for extra strength. Named because it appears before the \"sunrise\" of a new uptrend.",
    leadInBars: 25,
    waypoints: [
      { barOffset: 0, priceRatio: 1.0 },
      { barOffset: 12, priceRatio: 0.93, volatilityScale: 0.6 },
      { barOffset: 18, priceRatio: 0.90, volatilityScale: 0.4 },
    ],
    resolutionBars: 15,
    resolutionDrift: 0.08,
  },
  {
    id: "shooting-star",
    name: "Shooting Star",
    category: "candlestick",
    difficulty: "advanced",
    correctAction: "sell",
    description: "A candle with a long upper wick and small body at the top of an uptrend — rejection at highs.",
    education: "The shooting star appears after an uptrend. Price rallied significantly during the session but sellers pushed it back down near the open, creating a long upper shadow. It's the inverse of a hammer. The upper wick should be at least 2x the body. This shows buyers tried to push higher but were rejected — bearish reversal signal.",
    leadInBars: 25,
    waypoints: [
      { barOffset: 0, priceRatio: 1.0 },
      { barOffset: 12, priceRatio: 1.07, volatilityScale: 0.6 },
      { barOffset: 18, priceRatio: 1.10, volatilityScale: 0.4 },
    ],
    resolutionBars: 15,
    resolutionDrift: -0.08,
  },
];

export function getScenarioById(id: string): ScenarioDefinition | undefined {
  return SCENARIOS.find((s) => s.id === id);
}

export function getScenariosByCategory(category: PatternCategory): ScenarioDefinition[] {
  return SCENARIOS.filter((s) => s.category === category);
}

export function getScenariosByDifficulty(difficulty: Difficulty): ScenarioDefinition[] {
  return SCENARIOS.filter((s) => s.difficulty === difficulty);
}
