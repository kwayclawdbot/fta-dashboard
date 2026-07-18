#!/usr/bin/env node
/**
 * seed-flashcard-sets.mjs
 * ------------------------------------------------------------------
 * Seeds the two VISUAL flashcard sets (idempotent, fixed ids,
 * ON CONFLICT DO NOTHING):
 *   - candlestick-patterns : 14 patterns × 3 tracks, FRONT is the pattern
 *     DRAWN large from a hand-crafted, textbook-correct OHLC array (stored
 *     in flashcards.visual); BACK is the name + what it signals, per track.
 *   - chart-patterns       : 10 patterns × 3 tracks, FRONT is a mini chart
 *     drawn from a hand-crafted close series WITH support/resistance level
 *     lines; BACK is name + signal, per track.
 *
 * Track voices: adults = precise; teens = direct; kids = deck-voice
 * (green team / red team, tug-of-war). No emojis.
 *
 * Usage:  node scripts/seed-flashcard-sets.mjs [--dry]
 *   Reads .env.local, inserts rows (skipping any existing id), and writes
 *   supabase/migrations/025_seed_flashcard_visual_sets.sql as the record.
 * ------------------------------------------------------------------
 */
import { readFileSync, writeFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

function loadEnv() {
  const raw = readFileSync(new URL("../.env.local", import.meta.url), "utf8");
  const env = {};
  for (const line of raw.split("\n")) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m) env[m[1]] = m[2].trim().replace(/^["']|["']$/g, "");
  }
  return env;
}
const r2 = (n) => Math.round(n * 100) / 100;

/* Clean, deterministic OHLC from a close series (no noise — textbook charts).
 * o = previous close; wicks are a fixed fraction of the bar range. */
function chartCandles(closes) {
  const out = [];
  let prev = closes[0] - (closes[1] - closes[0]) * 0.5;
  for (const cl of closes) {
    const o = prev;
    const c = cl;
    const top = Math.max(o, c);
    const bot = Math.min(o, c);
    const range = Math.max(Math.abs(c - o), 0.6);
    out.push({
      o: r2(o),
      h: r2(top + range * 0.32),
      l: r2(bot - range * 0.32),
      c: r2(c),
    });
    prev = c;
  }
  return out;
}

const FRONT = {
  candlestick: {
    adults: "Which candlestick pattern is shown?",
    teens: "Name this candlestick pattern.",
    kids: "Which pattern is this?",
  },
  chart: {
    adults: "Which chart pattern is shown?",
    teens: "Name this chart pattern.",
    kids: "Which pattern is this?",
  },
};

/* =================================================================
 * CANDLESTICK PATTERNS — hand-crafted, textbook-correct OHLC
 * ================================================================= */
const CANDLESTICKS = [
  {
    slug: "doji",
    name: "Doji",
    tag: "Indecision",
    candles: [{ o: 100, h: 103.2, l: 96.8, c: 100.1 }],
    back: {
      adults:
        "Open and close are nearly equal — buyers and sellers finished even. Signals indecision and a possible turning point, especially after a strong move.",
      teens: "Buyers and sellers tied. Nobody won, so the trend might be about to change.",
      kids: "The green team and red team pulled the rope to a dead tie. Nobody won this battle.",
    },
  },
  {
    slug: "hammer",
    name: "Hammer",
    tag: "Bullish reversal",
    candles: [{ o: 99.4, h: 100.6, l: 95.4, c: 100.2 }],
    back: {
      adults:
        "A small body up top with a long lower wick: sellers pushed price down but buyers slammed it back by the close. A bullish reversal signal after a downtrend.",
      teens: "Long tail on the bottom — sellers tried to drop it, buyers won it back. A bounce is likely.",
      kids: "The red team yanked the rope way down, but the green team hauled it back up. Green team wins the next move.",
    },
  },
  {
    slug: "inverted-hammer",
    name: "Inverted Hammer",
    tag: "Bullish reversal",
    candles: [{ o: 99.6, h: 104.6, l: 99.35, c: 100.15 }],
    back: {
      adults:
        "A small body at the bottom with a long upper wick after a downtrend: buyers tested higher. A bullish reversal warning that needs confirmation next candle.",
      teens: "Long wick on top after a drop — buyers are starting to push up. A bounce could be coming.",
      kids: "The green team stretched the rope way up high. They didn't win yet, but they're getting stronger.",
    },
  },
  {
    slug: "shooting-star",
    name: "Shooting Star",
    tag: "Bearish reversal",
    candles: [{ o: 100.4, h: 104.6, l: 99.4, c: 99.65 }],
    back: {
      adults:
        "A small body at the bottom with a long upper wick after an uptrend: buyers pushed high but sellers rejected it by the close. A bearish reversal signal.",
      teens: "Long wick on top after a run-up — buyers ran out of gas and sellers slapped it back. Watch for a drop.",
      kids: "The green team shot the rope up high, but the red team pulled it all the way back down. Red team is taking over.",
    },
  },
  {
    slug: "bullish-engulfing",
    name: "Bullish Engulfing",
    tag: "Bullish reversal",
    candles: [
      { o: 101, h: 101.4, l: 99.2, c: 99.5 },
      { o: 99.2, h: 101.9, l: 99.0, c: 101.6 },
    ],
    back: {
      adults:
        "A big green candle fully engulfs the prior red candle: buyers overwhelmed sellers in a single session. A strong bullish reversal.",
      teens: "A big green candle swallows the red one before it. Buyers just took control.",
      kids: "The green team's win was so big it swallowed the red team's whole last win. Green team is in charge now.",
    },
  },
  {
    slug: "bearish-engulfing",
    name: "Bearish Engulfing",
    tag: "Bearish reversal",
    candles: [
      { o: 99.5, h: 101.3, l: 99.3, c: 101 },
      { o: 101.4, h: 101.6, l: 98.7, c: 99.0 },
    ],
    back: {
      adults:
        "A big red candle fully engulfs the prior green candle: sellers overwhelmed buyers in a single session. A strong bearish reversal.",
      teens: "A big red candle swallows the green one before it. Sellers just took control.",
      kids: "The red team's win was so big it swallowed the green team's whole last win. Red team is in charge now.",
    },
  },
  {
    slug: "spinning-top",
    name: "Spinning Top",
    tag: "Indecision",
    candles: [{ o: 100, h: 102.4, l: 97.7, c: 100.5 }],
    back: {
      adults:
        "A small body with wicks on both sides: a battle with no clear winner. Signals indecision and a possible loss of momentum.",
      teens: "Tiny body, wicks both ways — a close fight with no real winner. Momentum is fading.",
      kids: "A small win with the rope wiggling both ways. Nobody really took charge this round.",
    },
  },
  {
    slug: "bull-marubozu",
    name: "Bull Marubozu",
    tag: "Strong bullish",
    candles: [{ o: 97, h: 103, l: 97, c: 103 }],
    back: {
      adults:
        "A full green body with no wicks — price opened at the low and closed at the high. Total buyer control; strongly bullish.",
      teens: "All green, no wicks. Buyers owned the entire session.",
      kids: "The green team pulled from the very bottom to the very top with no slipping. A total green-team blowout.",
    },
  },
  {
    slug: "bear-marubozu",
    name: "Bear Marubozu",
    tag: "Strong bearish",
    candles: [{ o: 103, h: 103, l: 97, c: 97 }],
    back: {
      adults:
        "A full red body with no wicks — price opened at the high and closed at the low. Total seller control; strongly bearish.",
      teens: "All red, no wicks. Sellers owned the entire session.",
      kids: "The red team pulled from the very top to the very bottom with no slipping. A total red-team blowout.",
    },
  },
  {
    slug: "long-legged-doji",
    name: "Long-Legged Doji",
    tag: "Indecision",
    candles: [{ o: 100, h: 105.6, l: 94.4, c: 100.2 }],
    back: {
      adults:
        "A small body with long wicks on both ends: price swung far up and far down before finishing near the open. Deep indecision, often at turning points.",
      teens: "Big swings both ways, tiny body. A wild fight with no winner — a turn could be coming.",
      kids: "The fight swung far both ways — way up, then way down — but ended in a tie. Nobody won.",
    },
  },
  {
    slug: "morning-star",
    name: "Morning Star",
    tag: "Bullish reversal",
    candles: [
      { o: 103, h: 103.3, l: 98.9, c: 99.2 },
      { o: 98.6, h: 99.0, l: 97.9, c: 98.4 },
      { o: 99.3, h: 102.9, l: 99.1, c: 102.6 },
    ],
    back: {
      adults:
        "Three candles — a big red, a small-bodied pause, then a big green. Marks a bottom and a bullish reversal.",
      teens: "Red, then a tiny pause, then a strong green. The bottom is in — buyers are back.",
      kids: "The red team won, then everyone rested, then the green team charged. Morning's here — up we go.",
    },
  },
  {
    slug: "evening-star",
    name: "Evening Star",
    tag: "Bearish reversal",
    candles: [
      { o: 98, h: 102.1, l: 97.8, c: 101.8 },
      { o: 102.4, h: 103.1, l: 102.2, c: 102.6 },
      { o: 101.7, h: 101.9, l: 97.9, c: 98.2 },
    ],
    back: {
      adults:
        "Three candles — a big green, a small-bodied pause, then a big red. Marks a top and a bearish reversal.",
      teens: "Green, then a tiny pause, then a strong red. The top is in — sellers take over.",
      kids: "The green team won, then everyone rested, then the red team charged. Evening's here — down we go.",
    },
  },
  {
    slug: "three-white-soldiers",
    name: "Three White Soldiers",
    tag: "Bullish",
    candles: [
      { o: 98, h: 100.3, l: 97.8, c: 100 },
      { o: 99.3, h: 101.7, l: 99.1, c: 101.4 },
      { o: 100.6, h: 103.1, l: 100.4, c: 102.8 },
    ],
    back: {
      adults:
        "Three tall green candles in a row, each closing higher with small wicks. Strong, steady bullish momentum.",
      teens: "Three big green candles marching up. Buyers are firmly in control.",
      kids: "The green team won three battles in a row, each one higher. Green team is on a roll.",
    },
  },
  {
    slug: "three-black-crows",
    name: "Three Black Crows",
    tag: "Bearish",
    candles: [
      { o: 102, h: 102.2, l: 99.7, c: 100 },
      { o: 100.7, h: 100.9, l: 98.3, c: 98.6 },
      { o: 99.4, h: 99.6, l: 96.9, c: 97.2 },
    ],
    back: {
      adults:
        "Three tall red candles in a row, each closing lower with small wicks. Strong, steady bearish momentum.",
      teens: "Three big red candles marching down. Sellers are firmly in control.",
      kids: "The red team won three battles in a row, each one lower. Red team is on a roll.",
    },
  },
];

/* =================================================================
 * CHART PATTERNS — mini chart from a close series + S/R levels
 * ================================================================= */
const CHARTS = [
  {
    slug: "head-shoulders",
    name: "Head and Shoulders",
    tag: "Bearish reversal",
    closes: [100, 104, 101, 107, 101, 104.5, 101, 98, 95, 92],
    levels: [{ price: 101, kind: "support", label: "Neckline" }],
    back: {
      adults:
        "Three peaks — a higher middle 'head' between two 'shoulders' — then a break below the neckline. A classic bearish reversal.",
      teens: "Three bumps, the middle one tallest, then it breaks the neckline down. The trend flips to falling.",
      kids: "Three hills, the middle one biggest. When price drops below the neckline, the red team takes over.",
    },
  },
  {
    slug: "double-top",
    name: "Double Top",
    tag: "Bearish reversal",
    closes: [99, 104, 101, 104, 100, 96, 93],
    levels: [{ price: 104, kind: "resistance", label: "Resistance" }],
    back: {
      adults:
        "Two peaks at about the same resistance level, then a break down. A bearish reversal — buyers failed twice.",
      teens: "Two tops at the same ceiling, then a drop. Buyers tried twice and quit — it's falling.",
      kids: "Price hit the same ceiling twice and couldn't break it. The red team wins — down it goes.",
    },
  },
  {
    slug: "double-bottom",
    name: "Double Bottom",
    tag: "Bullish reversal",
    closes: [101, 96, 100, 96, 100, 104, 107],
    levels: [
      { price: 96, kind: "support", label: "Support" },
      { price: 100, kind: "resistance", label: "Neckline" },
    ],
    back: {
      adults:
        "Two troughs at about the same support level, then a break up. A bullish reversal — sellers failed twice.",
      teens: "Two bottoms at the same floor, then a pop up. Sellers tried twice and quit — it's climbing.",
      kids: "Price hit the same floor twice and wouldn't break it. The green team wins — up it goes.",
    },
  },
  {
    slug: "bull-flag",
    name: "Bull Flag",
    tag: "Bullish continuation",
    closes: [97, 101, 105, 108, 107, 106, 105.5, 108, 112, 115],
    levels: [{ price: 108, kind: "resistance", label: "Resistance" }],
    back: {
      adults:
        "A sharp rally (the pole), a small downward drift (the flag), then a breakout higher. A bullish continuation.",
      teens: "Big jump, a quick rest that drifts down, then it breaks out up again. The uptrend continues.",
      kids: "The green team ran up fast, took a short breather, then charged again. Still climbing.",
    },
  },
  {
    slug: "falling-wedge",
    name: "Falling Wedge",
    tag: "Bullish reversal",
    closes: [105, 101, 103, 99, 101, 98, 99.5, 103, 106],
    levels: [{ price: 101, kind: "resistance", label: "Resistance" }],
    back: {
      adults:
        "Lower highs and lower lows squeezing into a narrowing wedge, then a breakout up. A bullish reversal setup.",
      teens: "Price squeezes down into a point, then breaks out up. A bounce is coming.",
      kids: "The rope tightens as it drifts down, then the green team snaps it upward. Up next.",
    },
  },
  {
    slug: "ascending-triangle",
    name: "Ascending Triangle",
    tag: "Bullish continuation",
    closes: [100, 104, 101.5, 104, 102.5, 104, 103.5, 104, 108, 111],
    levels: [{ price: 104, kind: "resistance", label: "Resistance" }],
    back: {
      adults:
        "A flat resistance ceiling with rising lows pushing beneath it, then a breakout up. A bullish continuation.",
      teens: "Flat top, higher lows pressing into it, then it breaks up. Buyers win.",
      kids: "Price keeps pushing a flat ceiling with higher and higher tries, then the green team busts through.",
    },
  },
  {
    slug: "support-bounce",
    name: "Support Bounce",
    tag: "Bullish",
    closes: [106, 102, 99.2, 99, 99.3, 103, 107],
    levels: [{ price: 99, kind: "support", label: "Support" }],
    back: {
      adults:
        "Price falls to a tested support floor and rebounds. Buyers defend the level — bullish while support holds.",
      teens: "Price drops to the floor and bounces. Buyers are defending it — up from here.",
      kids: "Price fell to the floor and the green team caught it and pushed back up. The floor held.",
    },
  },
  {
    slug: "resistance-rejection",
    name: "Resistance Rejection",
    tag: "Bearish",
    closes: [94, 98, 101.8, 102, 101.7, 98, 94],
    levels: [{ price: 102, kind: "resistance", label: "Resistance" }],
    back: {
      adults:
        "Price rises to a tested resistance ceiling and is turned away. Sellers defend the level — bearish while resistance holds.",
      teens: "Price hits the ceiling and gets knocked back. Sellers are defending it — down from here.",
      kids: "Price rose to the ceiling and the red team shoved it back down. The ceiling held.",
    },
  },
  {
    slug: "breakout-retest",
    name: "Breakout and Retest",
    tag: "Bullish",
    closes: [98, 100, 99.8, 103, 101, 100.2, 101, 105, 108],
    levels: [{ price: 100, kind: "resistance", label: "Resistance" }],
    back: {
      adults:
        "Price breaks above resistance, pulls back to retest that level as new support, then continues up. A high-quality bullish entry.",
      teens: "Price breaks the ceiling, comes back to tap it, then goes higher. The old ceiling is now a floor.",
      kids: "The green team broke through the ceiling, came back to check it was solid, then kept climbing. The old ceiling is now their floor.",
    },
  },
  {
    slug: "uptrend-staircase",
    name: "Uptrend Staircase",
    tag: "Bullish trend",
    closes: [98, 101, 99.5, 103, 101, 105, 103.5, 107, 109],
    levels: [],
    back: {
      adults:
        "Higher highs and higher lows, step by step. A healthy uptrend — buyers keep winning.",
      teens: "Every high and every low is higher than the last. A steady climb — buyers in control.",
      kids: "Each peak and each dip is higher than the one before. The green team keeps winning, step by step.",
    },
  },
];

const TRACKS = ["adults", "teens", "kids"];

function buildRows() {
  const rows = [];
  for (const p of CANDLESTICKS) {
    const visual = { name: p.name, candles: p.candles };
    for (const track of TRACKS) {
      rows.push({
        id: `cs-${p.slug}-${track}`,
        set_slug: "candlestick-patterns",
        week: null,
        track,
        front: FRONT.candlestick[track],
        back: p.back[track],
        source: p.tag,
        visual,
      });
    }
  }
  for (const p of CHARTS) {
    const candles = chartCandles(p.closes);
    const visual = { name: p.name, candles };
    if (p.levels && p.levels.length) visual.levels = p.levels;
    for (const track of TRACKS) {
      rows.push({
        id: `cp-${p.slug}-${track}`,
        set_slug: "chart-patterns",
        week: null,
        track,
        front: FRONT.chart[track],
        back: p.back[track],
        source: p.tag,
        visual,
      });
    }
  }
  return rows;
}

async function main() {
  const env = loadEnv();
  const url = env.NEXT_PUBLIC_SUPABASE_URL;
  const key = env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Missing Supabase env in .env.local");
  const dry = process.argv.includes("--dry");
  const supabase = createClient(url, key, { auth: { persistSession: false } });

  const rows = buildRows();

  // SQL record (idempotent inserts)
  const sqlLines = [
    "-- 025_seed_flashcard_visual_sets.sql — generated by scripts/seed-flashcard-sets.mjs",
    "-- Visual flashcard sets: candlestick-patterns (14) + chart-patterns (10), each x3 tracks.",
    "-- Idempotent: skips any id that already exists.",
    "",
  ];
  const esc = (s) => (s == null ? "null" : `'${String(s).replace(/'/g, "''")}'`);
  for (const r of rows) {
    sqlLines.push(
      `insert into public.flashcards (id, set_slug, week, track, front, back, source, visual) values (` +
        `${esc(r.id)}, ${esc(r.set_slug)}, ${r.week == null ? "null" : r.week}, ${esc(r.track)}, ` +
        `${esc(r.front)}, ${esc(r.back)}, ${esc(r.source)}, ${esc(JSON.stringify(r.visual))}::jsonb) ` +
        `on conflict (id) do nothing;`
    );
  }
  writeFileSync(
    new URL("../supabase/migrations/025_seed_flashcard_visual_sets.sql", import.meta.url),
    sqlLines.join("\n") + "\n"
  );

  let inserted = 0;
  if (!dry) {
    // insert with ON CONFLICT DO NOTHING (ignoreDuplicates)
    const { error, count } = await supabase
      .from("flashcards")
      .upsert(rows, { onConflict: "id", ignoreDuplicates: true, count: "exact" });
    if (error) throw error;
    inserted = count ?? 0;
  }

  const bySet = rows.reduce((m, r) => ((m[r.set_slug] = (m[r.set_slug] || 0) + 1), m), {});
  console.log(
    `Prepared ${rows.length} rows: ${Object.entries(bySet)
      .map(([k, v]) => `${k}=${v}`)
      .join(", ")}`
  );
  console.log(dry ? "(dry run — no writes)" : `Upserted (new rows inserted: ${inserted}).`);
  console.log("SQL record: supabase/migrations/025_seed_flashcard_visual_sets.sql");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
