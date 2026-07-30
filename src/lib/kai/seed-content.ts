import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { TRENDING_DISCLAIMER } from "@/lib/club/score";
import { signedPct } from "@/lib/news/types";

/**
 * KAI FEED SEED — deriving Kai's daily Club posts from data that already exists.
 *
 * The Club launches into a cold-start network: an empty feed and empty Circles
 * read as a dead product. Kai's job here is NOT to manufacture activity — it is
 * to SAY OUT LOUD what the pipelines already computed, so a member arriving on
 * day one finds a room where something observable happened.
 *
 * THE RULE THAT GOVERNS EVERY LINE IN THIS FILE. A number in a Kai post is only
 * ever a value read out of a table in this module. Nothing is estimated, no
 * range is widened for effect, and the language model — when it is reachable at
 * all — is given finished sentences and allowed to rephrase them, never to
 * compute. Anything the model returns that has lost one of those values is
 * discarded in favour of the sentence we wrote (see `applyPolish`).
 *
 * SOURCES, all pre-existing:
 *   • news_articles (migration 117)            — the newsroom crons' output
 *   • ticker_intel_snapshots                   — the canonical club-attention
 *                                                ledger read by pulse/trending
 *   • screener_metrics                         — the daily price/volume table
 *   • club_circles / club_circle_members (191) — the Circle layer
 *
 * COMPLIANCE. Every post is observational. No recommendation, no price target,
 * no performance claim — `assertObservational()` is a hard gate that runs on
 * BOTH the derived sentence and any polished rewrite, and a line that fails it
 * is dropped rather than softened. Attention-derived posts close on
 * TRENDING_DISCLAIMER verbatim, the same line the Trending surface must render.
 */

/* eslint-disable-next-line @typescript-eslint/no-explicit-any */
type DB = SupabaseClient<any, "public", any>;

/** How far back a "today" source may reach, in days, before it is stale. */
export const DEFAULT_LOOKBACK_DAYS = 1;
/** A Circle's bound ticker must have moved at least this much to be worth a note. */
export const CIRCLE_MOVE_PCT = 4;
/** Fewer joins than this in the window is not news. */
export const CIRCLE_JOIN_MIN = 2;
/** The feed never takes more than this many Kai posts in one day. */
export const MAX_POSTS_PER_DAY = 3;

export type KaiPostType =
  | "market_wrap"
  | "ticker_event"
  | "watcher_growth"
  | "sentiment_shift";

export interface KaiSeedPost {
  /**
   * Deterministic identity: `<type>:<scope>:<YYYY-MM-DD>`. Stored on the row and
   * re-derived on every run, which is the whole idempotency mechanism — see
   * `existingPostKeys()`.
   */
  key: string;
  type: KaiPostType;
  /** The derived sentence. Survives verbatim whenever the model is unreachable. */
  body: string;
  /** `feed_posts.ticker_tags`. */
  tickers: string[];
  /**
   * Every substring a rewrite MUST still contain — the computed values and the
   * compliance line. This is the lock: a polished body missing any of these is
   * thrown away.
   */
  locked: string[];
  /**
   * False when the copy is quoted from another row (a newsroom headline is
   * already edited text and is not ours to rephrase).
   */
  polishable: boolean;
  /** Provenance, written onto the row so any figure can be traced back. */
  source: Record<string, string | number | null>;
}

export interface KaiSeedNote {
  circleId: string;
  circleSlug: string;
  body: string;
  locked: string[];
  source: Record<string, string | number | null>;
}

/* ── compliance gate ────────────────────────────────────────────────────────
   Advice-shaped and performance-shaped language, as PATTERNS rather than bare
   words: "long" and "short" are ordinary English ("long-term", "short window")
   and banning the words outright would reject honest sentences, so only the
   imperative constructions are caught. TRENDING_DISCLAIMER is exempted before
   the scan because it contains the word "recommendation" by design. */
const BANNED: RegExp[] = [
  /\b(buy|sell|short|long|add|trim|scale)\s+(it|this|that|these|now|here|the\s+dip|into|before)\b/i,
  /\b(should|must|need\s+to|ought\s+to)\s+(buy|sell|own|hold|add|trim|watch\s+out|get\s+in|get\s+out)\b/i,
  /\bprice\s+targets?\b/i,
  /\bguarantee(d|s)?\b/i,
  /\b(under|over)valued\b/i,
  /\brecommend(s|ed|ation|ations)?\b/i,
  /\b(easy|free)\s+money\b/i,
  /\bsure\s+thing\b/i,
  /\b(will|going\s+to)\s+(rip|moon|soar|crash|double|tank)\b/i,
  /\b\d+(\.\d+)?%\s*(gain|return|profit|win)\b/i,
  /\bbeat\s+the\s+market\b/i,
  /\b(our|my|the)\s+(pick|call|play)\b/i,
];

/**
 * True when a line is safe to publish under Kai's system identity.
 *
 * Deliberately conservative: a false reject costs one day's post (and the Club
 * simply hears nothing from Kai on that item), while a false accept puts a
 * recommendation in the mouth of the platform.
 */
export function assertObservational(text: string): boolean {
  const scanned = text.split(TRENDING_DISCLAIMER).join(" ");
  return !BANNED.some((re) => re.test(scanned));
}

/* ── helpers ────────────────────────────────────────────────────────────────── */

/** `YYYY-MM-DD` in UTC — the day-stamp inside every idempotency key. */
export function dayStamp(now: Date = new Date()): string {
  return now.toISOString().slice(0, 10);
}

/** Midnight UTC of `now`'s day. The window a per-day marker is judged against. */
export function startOfUtcDay(now: Date = new Date()): string {
  return `${dayStamp(now)}T00:00:00.000Z`;
}

function daysAgo(days: number, now: Date): string {
  return new Date(now.getTime() - days * 864e5).toISOString();
}

interface SnapshotRow {
  ticker: string;
  rank: number | null;
  provenance: {
    watchlistAdds7d?: number;
    sentiment?: { net7d?: number; bullish?: number; bearish?: number };
  } | null;
}

/* ── derivation ─────────────────────────────────────────────────────────────── */

export interface DeriveOptions {
  /** Days of freshness allowed on news rows. 1 = today only (the cron default). */
  lookbackDays?: number;
  now?: Date;
}

/**
 * Up to `MAX_POSTS_PER_DAY` posts for today, in priority order, one per ticker.
 *
 * Returns fewer — or none at all — whenever the sources have nothing new. An
 * empty result is a correct result: a Kai post about nothing is exactly the
 * filler this system exists to avoid.
 */
export async function deriveKaiPosts(
  db: DB,
  opts: DeriveOptions = {}
): Promise<KaiSeedPost[]> {
  const now = opts.now ?? new Date();
  const stamp = dayStamp(now);
  const since = daysAgo(opts.lookbackDays ?? DEFAULT_LOOKBACK_DAYS, now);

  const [wrapRes, eventRes, snapRes] = await Promise.all([
    db
      .from("news_articles")
      .select("slug, title, dek, tickers, created_at")
      .eq("kind", "market_wrap")
      .eq("published", true)
      .gte("created_at", since)
      .order("created_at", { ascending: false })
      .limit(1),
    db
      .from("news_articles")
      .select("slug, title, dek, tickers, created_at")
      .eq("kind", "ticker_event")
      .eq("published", true)
      .gte("created_at", since)
      .order("created_at", { ascending: false })
      .limit(30),
    db
      .from("ticker_intel_snapshots")
      .select("ticker, rank, provenance")
      .order("rank", { ascending: true })
      .limit(30),
  ]);

  const snapshots = ((snapRes.data ?? []) as SnapshotRow[]).map((s) => ({
    ticker: s.ticker.toUpperCase(),
    rank: s.rank,
    prov: s.provenance ?? {},
  }));

  const posts: KaiSeedPost[] = [];
  const usedTickers = new Set<string>();

  // 1. THE DAY'S MARKET WRAP — news_articles(kind='market_wrap').
  //    The headline and dek are quoted, not rewritten: they are already edited,
  //    already compliance-screened copy from the newsroom cron. Kai's own words
  //    are only the framing around them.
  const wrap = (wrapRes.data ?? [])[0] as
    | { slug: string; title: string; dek: string | null; tickers: string[] }
    | undefined;
  if (wrap) {
    const body = wrap.dek
      ? `Today's market wrap is up in the Newsroom — "${wrap.title}." ${wrap.dek}`
      : `Today's market wrap is up in the Newsroom — "${wrap.title}."`;
    push(posts, usedTickers, {
      key: `market_wrap:${wrap.slug}:${stamp}`,
      type: "market_wrap",
      body,
      tickers: (wrap.tickers ?? []).slice(0, 4),
      locked: [wrap.title],
      polishable: false,
      source: { table: "news_articles", slug: wrap.slug },
    });
  }

  // 2. A TICKER EVENT ON A NAME THE CLUB IS ALREADY ON.
  //    The newsroom writes 6-8 events a night across the whole market; the only
  //    ones worth a feed post are the ones that land on a ticker the Club is
  //    already looking at, which is exactly what the snapshot ledger records.
  //    The move itself comes from screener_metrics, never from the headline.
  const clubRank = new Map(snapshots.map((s) => [s.ticker, s.rank]));
  const events = (eventRes.data ?? []) as {
    slug: string;
    title: string;
    tickers: string[];
  }[];
  const hit = events
    .map((e) => ({ e, ticker: (e.tickers ?? [])[0]?.toUpperCase() ?? "" }))
    .filter((x) => x.ticker && clubRank.has(x.ticker) && !usedTickers.has(x.ticker))
    .sort((a, b) => (clubRank.get(a.ticker) ?? 99) - (clubRank.get(b.ticker) ?? 99))[0];
  if (hit) {
    const { data: metric } = await db
      .from("screener_metrics")
      .select("ticker, chg_1d")
      .eq("ticker", hit.ticker)
      .maybeSingle();
    const chg = (metric as { chg_1d: number | null } | null)?.chg_1d ?? null;
    const rank = clubRank.get(hit.ticker) ?? null;
    if (chg != null && rank != null) {
      const move = signedPct(chg);
      const body =
        `${hit.ticker} sits at #${rank} on the Club's attention list and closed the last ` +
        `session ${move}. The Newsroom wrote it up: "${hit.e.title}." ${TRENDING_DISCLAIMER}`;
      push(posts, usedTickers, {
        key: `ticker_event:${hit.e.slug}:${stamp}`,
        type: "ticker_event",
        body,
        tickers: [hit.ticker],
        locked: [move, `#${rank}`, hit.e.title, TRENDING_DISCLAIMER],
        polishable: true,
        source: {
          table: "news_articles+screener_metrics+ticker_intel_snapshots",
          slug: hit.e.slug,
          ticker: hit.ticker,
          chg_1d: chg,
          rank,
        },
      });
    }
  }

  // 3. NEW WATCHERS — provenance.watchlistAdds7d, the same field the pulse
  //    "new_watchers" signal reads. Pulse states it as scale-aware copy; here
  //    the count itself is the point, so it is printed.
  const watch = snapshots
    .filter((s) => !usedTickers.has(s.ticker))
    .map((s) => ({ ticker: s.ticker, n: s.prov.watchlistAdds7d ?? 0 }))
    .filter((s) => s.n > 0)
    .sort((a, b) => b.n - a.n)[0];
  if (watch) {
    const noun = watch.n === 1 ? "watcher" : "watchers";
    const body =
      `${watch.ticker} drew ${watch.n} new Club ${noun} this week. ${TRENDING_DISCLAIMER}`;
    push(posts, usedTickers, {
      key: `watcher_growth:${watch.ticker}:${stamp}`,
      type: "watcher_growth",
      body,
      tickers: [watch.ticker],
      locked: [String(watch.n), TRENDING_DISCLAIMER],
      polishable: true,
      source: {
        table: "ticker_intel_snapshots.provenance.watchlistAdds7d",
        ticker: watch.ticker,
        watchlistAdds7d: watch.n,
      },
    });
  }

  // 4. SENTIMENT SHIFT — provenance.sentiment, again the pulse field. Stated as
  //    the raw split so the reader can see how small a founding-era sample is,
  //    rather than a percentage that would flatter it.
  const sent = snapshots
    .filter((s) => !usedTickers.has(s.ticker))
    .map((s) => ({
      ticker: s.ticker,
      net: s.prov.sentiment?.net7d ?? 0,
      bull: s.prov.sentiment?.bullish ?? 0,
      bear: s.prov.sentiment?.bearish ?? 0,
    }))
    .filter((s) => s.net !== 0)
    .sort((a, b) => Math.abs(b.net) - Math.abs(a.net))[0];
  if (sent) {
    const lean = sent.net > 0 ? "bullish" : "cautious";
    const body =
      `Members who have staked a view on ${sent.ticker} this week stand at ` +
      `${sent.bull} bullish and ${sent.bear} bearish — a net ${sent.net > 0 ? "+" : ""}${sent.net} ` +
      `leaning ${lean}. ${TRENDING_DISCLAIMER}`;
    push(posts, usedTickers, {
      key: `sentiment_shift:${sent.ticker}:${stamp}`,
      type: "sentiment_shift",
      body,
      tickers: [sent.ticker],
      locked: [
        String(sent.bull),
        String(sent.bear),
        `${sent.net > 0 ? "+" : ""}${sent.net}`,
        TRENDING_DISCLAIMER,
      ],
      polishable: true,
      source: {
        table: "ticker_intel_snapshots.provenance.sentiment",
        ticker: sent.ticker,
        net7d: sent.net,
        bullish: sent.bull,
        bearish: sent.bear,
      },
    });
  }

  return posts.slice(0, MAX_POSTS_PER_DAY);
}

/** Adds a post if it clears the compliance gate, and claims its tickers. */
function push(out: KaiSeedPost[], used: Set<string>, post: KaiSeedPost): void {
  if (!assertObservational(post.body)) return;
  out.push(post);
  for (const t of post.tickers) used.add(t.toUpperCase());
}

/* ── circle notes ───────────────────────────────────────────────────────────── */

export interface DeriveNotesOptions {
  /** Window for "members joined recently", in days. 1 = the last day. */
  joinWindowDays?: number;
  now?: Date;
}

/**
 * At most one note per OPEN Circle, and only where something measurable
 * happened: the Circle's bound ticker moved at least CIRCLE_MOVE_PCT in the
 * last session, or at least CIRCLE_JOIN_MIN members joined inside the window.
 *
 * A Circle with neither gets nothing. Silence beats filler — a daily "no change
 * today" from Kai in every room would train members to scroll past the rooms.
 *
 * Kai never carries a `stance`. Staking bull/bear inside a member's room would
 * be the platform taking a position, which is the one thing this identity is
 * not allowed to do.
 */
export async function deriveKaiCircleNotes(
  db: DB,
  opts: DeriveNotesOptions = {}
): Promise<KaiSeedNote[]> {
  const now = opts.now ?? new Date();
  const joinSince = daysAgo(opts.joinWindowDays ?? 1, now);

  const { data: circleData, error } = await db
    .from("club_circles")
    .select("id, slug, title, ticker, expires_at")
    .gt("expires_at", now.toISOString());
  if (error) return [];

  const circles = (circleData ?? []) as {
    id: string;
    slug: string;
    title: string;
    ticker: string | null;
    expires_at: string;
  }[];
  if (circles.length === 0) return [];

  const tickers = [...new Set(circles.map((c) => c.ticker).filter((t): t is string => !!t))];

  const [metricRes, joinRes] = await Promise.all([
    tickers.length
      ? db.from("screener_metrics").select("ticker, chg_1d").in("ticker", tickers)
      : Promise.resolve({ data: [] }),
    db
      .from("club_circle_members")
      .select("circle_id")
      .in(
        "circle_id",
        circles.map((c) => c.id)
      )
      .gte("joined_at", joinSince),
  ]);

  const chgByTicker = new Map<string, number>();
  for (const m of (metricRes.data ?? []) as { ticker: string; chg_1d: number | null }[]) {
    if (m.chg_1d != null) chgByTicker.set(m.ticker.toUpperCase(), m.chg_1d);
  }
  const joinsByCircle = new Map<string, number>();
  for (const j of (joinRes.data ?? []) as { circle_id: string }[]) {
    joinsByCircle.set(j.circle_id, (joinsByCircle.get(j.circle_id) ?? 0) + 1);
  }

  const notes: KaiSeedNote[] = [];
  for (const c of circles) {
    const clauses: string[] = [];
    const locked: string[] = [];
    const source: Record<string, string | number | null> = { circle: c.slug };

    const chg = c.ticker ? chgByTicker.get(c.ticker.toUpperCase()) : undefined;
    if (chg != null && Math.abs(chg) >= CIRCLE_MOVE_PCT) {
      const move = signedPct(chg);
      clauses.push(`$${c.ticker} closed the last session ${move}.`);
      locked.push(move);
      source.ticker = c.ticker;
      source.chg_1d = chg;
    }

    const joined = joinsByCircle.get(c.id) ?? 0;
    if (joined >= CIRCLE_JOIN_MIN) {
      clauses.push(`${joined} members joined this Circle since yesterday.`);
      locked.push(String(joined));
      source.joined = joined;
    }

    if (clauses.length === 0) continue;
    const body = clauses.join(" ");
    if (!assertObservational(body)) continue;
    notes.push({ circleId: c.id, circleSlug: c.slug, body, locked, source });
  }
  return notes;
}

/* ── idempotency ────────────────────────────────────────────────────────────── */

/**
 * The keys Kai has ALREADY published, read straight off the rows.
 *
 * This is the whole mechanism, and it is deliberately not a new table: the key
 * lives in `feed_posts.activity_payload.kai_seed.key` — a jsonb column that
 * already exists and is invisible to every reader — and a re-run simply
 * re-derives the same deterministic key and finds it here. A retry, a manual
 * re-hit of the route, and a duplicated cron delivery all collapse to a no-op.
 *
 * The window is three days, which comfortably covers a key that is stamped with
 * today's date while keeping the read to a handful of rows.
 */
export async function existingPostKeys(
  db: DB,
  kaiId: string,
  now: Date = new Date()
): Promise<Set<string>> {
  const { data } = await db
    .from("feed_posts")
    .select("activity_payload")
    .eq("author_id", kaiId)
    .gte("created_at", daysAgo(3, now));
  const keys = new Set<string>();
  for (const r of (data ?? []) as { activity_payload: { kai_seed?: { key?: string } } | null }[]) {
    const k = r.activity_payload?.kai_seed?.key;
    if (typeof k === "string") keys.add(k);
  }
  return keys;
}

/**
 * The Circles Kai has already spoken in today.
 *
 * A Circle note has no jsonb column to hide a marker in, and putting one in the
 * body would print into the thread on the legacy Circle room (which renders
 * `body` raw). It does not need one: the unit of idempotency IS "one Kai note
 * per Circle per day", so the row's own (circle_id, author_id, created_at) is
 * the marker.
 */
export async function circlesNotedToday(
  db: DB,
  kaiId: string,
  now: Date = new Date()
): Promise<Set<string>> {
  const { data } = await db
    .from("club_circle_notes")
    .select("circle_id")
    .eq("author_id", kaiId)
    .gte("created_at", startOfUtcDay(now));
  return new Set(((data ?? []) as { circle_id: string }[]).map((r) => r.circle_id));
}

/* ── optional LLM polish ────────────────────────────────────────────────────── */

/**
 * Optional Anthropic polish, mirroring `maybePolish` in /api/club/brief: trimmed
 * key, one short timeout, null on ANY problem so the caller keeps the derived
 * copy. With the account's credits down this returns null on the first request
 * and the deterministic sentences ship unchanged — that is the expected path,
 * not a degraded one.
 *
 * It is also locked harder than the brief's version. The brief keeps the
 * original ticker and kind and accepts whatever text comes back; here EVERY
 * computed value and the compliance line must survive verbatim in the rewrite,
 * and the rewrite must independently clear `assertObservational`. An item that
 * fails either check silently keeps its derived body, so a model that drifts
 * costs polish, never accuracy.
 */
export async function polishKaiPosts(posts: KaiSeedPost[]): Promise<KaiSeedPost[]> {
  const targets = posts.filter((p) => p.polishable);
  if (targets.length === 0) return posts;

  const key = process.env.ANTHROPIC_API_KEY?.trim();
  if (!key) return posts;

  let parsed: { body?: string }[] | null = null;
  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": key,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5",
        max_tokens: 600,
        system:
          "You are Kai, writing one-line observations for a stock-market learning club. " +
          "Rewrite each item's `body` so it reads warmer and shorter. HARD RULES: reproduce " +
          "every string in that item's `locked` array EXACTLY as given, character for character; " +
          "never invent, round, restate or add a number, ticker, date or fact; never give advice, " +
          "a recommendation, a price target or a performance claim. Return ONLY a JSON array of " +
          "{body} objects, same order and same length as the input.",
        messages: [
          {
            role: "user",
            content: JSON.stringify(targets.map((p) => ({ body: p.body, locked: p.locked }))),
          },
        ],
      }),
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return posts;
    const data = (await res.json()) as { content?: { type: string; text?: string }[] };
    const raw = (data.content || [])
      .filter((b) => b.type === "text")
      .map((b) => b.text || "")
      .join("")
      .trim();
    const start = raw.indexOf("[");
    const end = raw.lastIndexOf("]");
    if (start < 0 || end < 0) return posts;
    const arr = JSON.parse(raw.slice(start, end + 1)) as { body?: string }[];
    if (!Array.isArray(arr) || arr.length !== targets.length) return posts;
    parsed = arr;
  } catch {
    return posts;
  }

  return applyPolish(posts, targets, parsed);
}

/**
 * The lock itself, factored out so it is testable without a network call: a
 * candidate replaces the derived body ONLY if it is a non-empty string, still
 * contains every locked substring, and still reads as an observation.
 */
export function applyPolish(
  posts: KaiSeedPost[],
  targets: KaiSeedPost[],
  parsed: { body?: string }[]
): KaiSeedPost[] {
  const replacement = new Map<string, string>();
  targets.forEach((p, i) => {
    const cand = parsed[i]?.body;
    if (typeof cand !== "string") return;
    const text = cand.trim();
    if (!text) return;
    if (!p.locked.every((tok) => text.includes(tok))) return;
    if (!assertObservational(text)) return;
    replacement.set(p.key, text);
  });
  return posts.map((p) => {
    const text = replacement.get(p.key);
    return text ? { ...p, body: text } : p;
  });
}
