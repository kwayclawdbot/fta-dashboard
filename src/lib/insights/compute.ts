import type { SupabaseClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";
import { KAI_SUMMARY_MODEL } from "@/lib/kai/persona";
import { friendlySector } from "@/lib/insights/sectors";

/**
 * The "HOW THEY INVEST" data layer.
 *
 * computeUserInsights(userId) derives a member's profile digest — favorite
 * tickers, bull/bear lean, favorite sectors, trading style — from their own
 * on-app behaviour and writes it to `user_insights` through the service role.
 * Everything here is DETERMINISTIC and works with the LLM completely offline:
 * the optional one-line `kai_read` narrative is best-effort and degrades to
 * NULL the instant the model call fails (e.g. the credit outage). The row is
 * always useful without it.
 *
 * getUserInsights(userId) is the read side the profile page calls. It reads the
 * already-computed row (RLS: readable by any authenticated member); it never
 * triggers a recompute, so rendering a profile is a single cheap select.
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type DB = SupabaseClient<any, "public", any>;

export interface FavoriteTicker {
  ticker: string;
  /** Normalised 0–1 share of the member's attention across their top tickers. */
  weight: number;
}
export interface FavoriteSector {
  sector: string;
  /** 0–100 share of the member's favorite-ticker weight in this sector. */
  pct: number;
}
export interface TradingStyle {
  risk_posture: string | null;
  timeframe: string | null;
  setups: string[];
}
export interface UserInsights {
  user_id: string;
  favorite_tickers: FavoriteTicker[];
  /** 0–100 % of stances called bullish, or null when they hold no stances. */
  bull_lean: number | null;
  favorite_sectors: FavoriteSector[];
  trading_style: TradingStyle;
  kai_read: string | null;
  computed_at: string;
}

// ── weighting ────────────────────────────────────────────────────────────────
// A member's engagement with a ticker arrives through three channels; each adds
// weight. A TAKEN STANCE is the strongest signal (they committed a direction);
// a WATCHLIST hold and a POSITIVE sentiment vote are softer follows; a NEGATIVE
// vote is still tracked attention but weakly (they're watching, not rooting).
const W_STANCE = 2.0; // has a bull/bear/neutral stance on it
const W_WATCH = 1.5; // champions it on a family watchlist
const W_VOTE_UP = 1.5; // liked it (+1)
const W_VOTE_DOWN = 0.5; // disliked it (-1) — still on their radar

const TOP_TICKERS = 5;
const TOP_SECTORS = 4;

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/**
 * Recompute and persist a member's insight digest. Returns the computed shape.
 * Uses the service role (bypasses RLS) so it can read every source table and
 * write `user_insights`.
 */
export async function computeUserInsights(userId: string): Promise<UserInsights> {
  const admin = createAdminClient();

  const [stanceRes, voteRes, watchRes, styleRes] = await Promise.all([
    admin.from("ticker_stances").select("ticker, stance").eq("user_id", userId),
    admin.from("ticker_sentiment").select("ticker, vote").eq("user_id", userId),
    admin.from("family_watchlist").select("ticker").eq("champion_id", userId),
    admin
      .from("strategy_profiles")
      .select("risk_posture, timeframe, setup_prefs")
      .eq("user_id", userId)
      .maybeSingle(),
  ]);

  const stances = (stanceRes.data ?? []) as { ticker: string; stance: string }[];
  const votes = (voteRes.data ?? []) as { ticker: string; vote: number }[];
  const watches = (watchRes.data ?? []) as { ticker: string }[];
  const style = (styleRes.data ?? null) as {
    risk_posture: string | null;
    timeframe: string | null;
    setup_prefs: string[] | null;
  } | null;

  // ── favorite tickers (weighted) ────────────────────────────────────────────
  const norm = (t: string) => t.trim().toUpperCase();
  const weights = new Map<string, number>();
  const bump = (t: string, w: number) => {
    const k = norm(t);
    if (!k) return;
    weights.set(k, (weights.get(k) ?? 0) + w);
  };

  for (const s of stances) bump(s.ticker, W_STANCE);
  for (const w of watches) bump(w.ticker, W_WATCH);
  for (const v of votes) bump(v.ticker, v.vote >= 0 ? W_VOTE_UP : W_VOTE_DOWN);

  const ranked = [...weights.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, TOP_TICKERS);

  const totalW = ranked.reduce((sum, [, w]) => sum + w, 0);
  const favorite_tickers: FavoriteTicker[] = ranked.map(([ticker, w]) => ({
    ticker,
    weight: totalW > 0 ? round2(w / totalW) : 0,
  }));

  // ── bull lean — the profile's CONVICTION measure ───────────────────────────
  // Share of taken stances that are bullish. Neutral counts against the bull
  // share (it isn't bullish), matching how the /u page frames conviction as
  // "the share of positions called bullish". NULL when they hold no stances.
  const bull_lean =
    stances.length > 0
      ? Math.round(
          (stances.filter((s) => s.stance === "bull").length / stances.length) * 100
        )
      : null;

  // ── favorite sectors — map favorite tickers → sector, weighted ─────────────
  let favorite_sectors: FavoriteSector[] = [];
  const favTickers = ranked.map(([t]) => t);
  if (favTickers.length > 0) {
    const { data: metrics } = await admin
      .from("screener_metrics")
      .select("ticker, sector")
      .in("ticker", favTickers);

    const sectorByTicker = new Map<string, string | null>();
    for (const m of (metrics ?? []) as { ticker: string; sector: string | null }[]) {
      sectorByTicker.set(norm(m.ticker), m.sector);
    }

    const sectorWeight = new Map<string, number>();
    for (const [ticker, w] of ranked) {
      const label = friendlySector(sectorByTicker.get(ticker));
      sectorWeight.set(label, (sectorWeight.get(label) ?? 0) + w);
    }

    const sectorTotal = [...sectorWeight.values()].reduce((s, w) => s + w, 0);
    favorite_sectors = [...sectorWeight.entries()]
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .slice(0, TOP_SECTORS)
      .map(([sector, w]) => ({
        sector,
        pct: sectorTotal > 0 ? Math.round((w / sectorTotal) * 100) : 0,
      }));
  }

  // ── trading style — structured if declared, else sparse ────────────────────
  // We only assert what the member actually told us. With no strategy_profiles
  // row we leave the fields null / empty rather than infer confident claims;
  // the profile renders "not set yet" rather than a fabricated style.
  const trading_style: TradingStyle = {
    risk_posture: style?.risk_posture ?? null,
    timeframe: style?.timeframe ?? null,
    setups: Array.isArray(style?.setup_prefs) ? style!.setup_prefs! : [],
  };

  // ── optional Kai narrative (best-effort, NEVER blocks) ─────────────────────
  const kai_read = await generateKaiRead({
    favorite_tickers,
    bull_lean,
    favorite_sectors,
    trading_style,
  });

  const computed_at = new Date().toISOString();

  await admin.from("user_insights").upsert(
    {
      user_id: userId,
      favorite_tickers,
      bull_lean,
      favorite_sectors,
      trading_style,
      kai_read,
      computed_at,
    },
    { onConflict: "user_id" }
  );

  return {
    user_id: userId,
    favorite_tickers,
    bull_lean,
    favorite_sectors,
    trading_style,
    kai_read,
    computed_at,
  };
}

/**
 * One-line "Kai's read" narrative. BEST-EFFORT ONLY: returns null on any
 * failure — no API key, a non-2xx response (the 400 credit error during the
 * outage), a timeout, or a thrown error. It must never throw and never block
 * the deterministic insight above.
 */
export async function generateKaiRead(input: {
  favorite_tickers: FavoriteTicker[];
  bull_lean: number | null;
  favorite_sectors: FavoriteSector[];
  trading_style: TradingStyle;
}): Promise<string | null> {
  const key = process.env.ANTHROPIC_API_KEY?.trim();
  if (!key) return null;
  // Nothing to narrate about a member with no behaviour yet.
  if (input.favorite_tickers.length === 0 && input.bull_lean == null) return null;

  const facts = [
    input.favorite_tickers.length
      ? `Favorite tickers: ${input.favorite_tickers.map((t) => t.ticker).join(", ")}.`
      : null,
    input.bull_lean != null ? `${input.bull_lean}% bullish across their positions.` : null,
    input.favorite_sectors.length
      ? `Leans into ${input.favorite_sectors.map((s) => s.sector).join(", ")}.`
      : null,
    input.trading_style.risk_posture || input.trading_style.timeframe
      ? `Style: ${[input.trading_style.risk_posture, input.trading_style.timeframe]
          .filter(Boolean)
          .join(" / ")}.`
      : null,
  ]
    .filter(Boolean)
    .join(" ");

  const system =
    "You are Kai, a warm, sharp investing coach in a family investing club. " +
    "In ONE sentence (max 22 words), describe how this member invests, based only on the facts given. " +
    "No hype, no predictions, no financial advice, no emojis. Plain, human, specific.";

  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": key,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: KAI_SUMMARY_MODEL,
        max_tokens: 80,
        system,
        messages: [{ role: "user", content: facts }],
      }),
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) return null; // 400 credit error, 401 bad key, 429, 5xx — all → null
    const data = (await res.json()) as { content?: { type: string; text?: string }[] };
    const text = (data.content || [])
      .filter((b) => b.type === "text")
      .map((b) => b.text || "")
      .join("")
      .trim();
    return text || null;
  } catch {
    // network / timeout / abort — stay null, never block the insight
    return null;
  }
}

/**
 * Read a member's pre-computed insight digest for the profile page. Returns
 * null when it has not been computed yet (the caller renders an empty state).
 * Accepts any supabase client — an RLS-scoped server client is fine, since
 * user_insights is readable by any authenticated member.
 */
export async function getUserInsights(
  db: DB,
  userId: string
): Promise<UserInsights | null> {
  const { data, error } = await db
    .from("user_insights")
    .select(
      "user_id, favorite_tickers, bull_lean, favorite_sectors, trading_style, kai_read, computed_at"
    )
    .eq("user_id", userId)
    .maybeSingle();
  if (error || !data) return null;
  return data as UserInsights;
}
