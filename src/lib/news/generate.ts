/**
 * Club Newsroom — server-side generation (LANE 10). SERVER ONLY (uses the
 * Polygon key + Anthropic key + service-role client). Reuses the proven Kai
 * pattern from src/app/api/admin/kai-report/route.ts: pull real data
 * server-side, ground a structured-output call, store the article. The model
 * writes prose; the generation lib assembles the data-driven blocks so figures
 * are exact and never hallucinated.
 *
 * Idempotent per slug: each article's slug is stable per (kind, day[, slot]),
 * so re-running a cron slot skips work that already landed — safe to retry and
 * cheap ($1-3/day: one sonnet market-wrap per slot + <=8 haiku ticker notes).
 */

import { getQuotes, getNews, type NewsItem } from "@/lib/market/polygon";
import {
  MARKET_WRAP_MODEL,
  MARKET_WRAP_SCHEMA,
  marketWrapSystemPrompt,
  TICKER_EVENT_MODEL,
  TICKER_EVENT_SCHEMA,
  tickerEventSystemPrompt,
  type MarketWrapSections,
  type TickerEventSections,
} from "@/lib/news/prompts";
import { signedPct, type MoverItem, type NewsBlock, type NewsKind } from "@/lib/news/types";
import type { SupabaseClient } from "@supabase/supabase-js";

type Db = SupabaseClient;

/** UTC day stamp used in slugs (crons fire at fixed UTC times). */
function dayStamp(d = new Date()): string {
  return d.toISOString().slice(0, 10);
}

/* ─────────────────────────── Anthropic call ─────────────────────────── */

async function callJson<T>(
  model: string,
  system: string,
  grounding: string,
  schema: unknown,
  maxTokens: number
): Promise<T | null> {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) throw new Error("ANTHROPIC_API_KEY missing");
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": key,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model,
      max_tokens: maxTokens,
      thinking: { type: "disabled" },
      system,
      output_config: { format: { type: "json_schema", schema } },
      messages: [{ role: "user", content: grounding }],
    }),
    signal: AbortSignal.timeout(55_000),
  });
  const data = await res.json();
  if (!res.ok) {
    console.error(`[news] anthropic ${model} error:`, data?.error || res.status);
    return null;
  }
  const text: string =
    data.content?.find((b: { type: string }) => b.type === "text")?.text || "";
  try {
    return JSON.parse(text) as T;
  } catch {
    console.error(`[news] ${model} returned unparseable JSON`);
    return null;
  }
}

/* ─────────────────────────── DB helpers ─────────────────────────── */

async function slugExists(db: Db, slug: string): Promise<boolean> {
  const { data } = await db.from("news_articles").select("id").eq("slug", slug).maybeSingle();
  return !!data;
}

async function insertArticle(
  db: Db,
  row: {
    slug: string;
    kind: NewsKind;
    title: string;
    dek: string;
    blocks: NewsBlock[];
    tickers: string[];
    model: string;
  }
): Promise<{ ok: boolean; slug: string; title: string }> {
  const { error } = await db.from("news_articles").insert({
    slug: row.slug,
    kind: row.kind,
    title: row.title,
    dek: row.dek,
    sections: { blocks: row.blocks },
    tickers: row.tickers,
    model: row.model,
    published: true,
  });
  if (error) {
    // A concurrent slot may have inserted the same slug (unique) — treat as done.
    if (error.code === "23505") return { ok: false, slug: row.slug, title: row.title };
    console.error("[news] insert failed:", error.message);
    return { ok: false, slug: row.slug, title: row.title };
  }
  return { ok: true, slug: row.slug, title: row.title };
}

/* ─────────────────────────── Screener reads ─────────────────────────── */

interface MetricRow {
  ticker: string;
  name: string | null;
  sector: string | null;
  price: number | null;
  chg_1d: number | null;
  vol_ratio: number | null;
  dist_52w_high: number | null;
  dist_52w_low: number | null;
  mcap: number | null;
}

const METRIC_COLS = "ticker,name,sector,price,chg_1d,vol_ratio,dist_52w_high,dist_52w_low,mcap";

// Legal / structural tokens stripped when deriving a company's "brand" word.
const NAME_STOP = new Set([
  "COMMON",
  "COMPANY",
  "HOLDINGS",
  "CLASS",
  "GROUP",
  "SHARES",
  "TRUST",
  "CORPORATION",
  "INCORPORATED",
  "LIMITED",
  "INTERNATIONAL",
]);

/**
 * Pick a RELEVANT recent headline — Polygon's per-ticker news returns anything
 * that merely *mentions* the symbol, so a listicle headlined about a bigger
 * name can come back. We only treat a headline as "matching" when its TITLE
 * actually references the company (the ticker as a whole word, or the brand
 * word from its name). Otherwise there is no matching headline and the model
 * describes the move factually without a mismatched/off-topic source card.
 */
function pickRelevantHeadline(
  news: NewsItem[],
  ticker: string,
  name: string | null
): NewsItem | null {
  if (!news.length) return null;
  const tickerRe = new RegExp(`\\b${ticker.replace(/[^A-Z0-9]/gi, "")}\\b`, "i");
  const brand =
    (name || "")
      .toUpperCase()
      .replace(/[^A-Z ]/g, " ")
      .split(/\s+/)
      .filter((w) => w.length >= 5 && !NAME_STOP.has(w))[0] || null;
  for (const h of news) {
    const title = (h.title || "").toUpperCase();
    if (tickerRe.test(h.title || "")) return h;
    if (brand && title.includes(brand)) return h;
  }
  return null;
}

/* ─────────────────────────── Market Wrap ─────────────────────────── */

const INDEX_NAMES: Record<string, string> = {
  SPY: "S&P 500",
  QQQ: "Nasdaq 100",
  DIA: "Dow Jones",
  IWM: "Small Caps (Russell 2000)",
};

export async function generateMarketWrap(
  db: Db,
  slot: "preopen" | "postclose",
  opts: { force?: boolean } = {}
): Promise<{ generated: boolean; slug: string; title?: string; reason?: string }> {
  const slug = `market-wrap-${dayStamp()}-${slot}`;
  if (!opts.force && (await slugExists(db, slug))) {
    return { generated: false, slug, reason: "exists" };
  }

  // Indices (delayed snapshot).
  const idxSyms = Object.keys(INDEX_NAMES);
  const quotes = await getQuotes(idxSyms);
  const idxLines = idxSyms
    .map((s) => {
      const q = quotes[s];
      if (!q) return `- ${INDEX_NAMES[s]}: (no data)`;
      return `- ${INDEX_NAMES[s]}: ${signedPct(q.changePercent)} on the day`;
    })
    .join("\n");

  // Sector rotation (in-house, one instant group-by RPC).
  const { data: sectors } = await db.rpc("news_sector_rotation");
  const sectorRows = (sectors as { sector: string; avg_chg: number; n: number }[] | null) || [];
  const topSectors = sectorRows.slice(0, 3);
  const bottomSectors = sectorRows.slice(-3).reverse();
  const sectorLines =
    sectorRows.length > 0
      ? [
          "Leading sectors: " +
            topSectors.map((s) => `${s.sector} ${signedPct(s.avg_chg)}`).join(", "),
          "Lagging sectors: " +
            bottomSectors.map((s) => `${s.sector} ${signedPct(s.avg_chg)}`).join(", "),
        ].join("\n")
      : "(sector data unavailable)";

  // Top movers among recognizable (>= $2B) names: 3 up + 3 down.
  const [{ data: upRows }, { data: downRows }] = await Promise.all([
    db
      .from("screener_metrics")
      .select(METRIC_COLS)
      .eq("type", "common")
      .gte("mcap", 2e9)
      .not("chg_1d", "is", null)
      .order("chg_1d", { ascending: false })
      .limit(3),
    db
      .from("screener_metrics")
      .select(METRIC_COLS)
      .eq("type", "common")
      .gte("mcap", 2e9)
      .not("chg_1d", "is", null)
      .order("chg_1d", { ascending: true })
      .limit(3),
  ]);
  const moverRows = [...((upRows as MetricRow[]) || []), ...((downRows as MetricRow[]) || [])];

  // A matching headline per mover (bounded: <= 6 news calls).
  const moverItems: MoverItem[] = [];
  const moverGrounding: string[] = [];
  for (const r of moverRows) {
    const news = await getNews(r.ticker, 2).catch(() => [] as NewsItem[]);
    const h = pickRelevantHeadline(news, r.ticker, r.name);
    moverItems.push({
      ticker: r.ticker,
      name: r.name,
      chg: r.chg_1d,
      why: h?.title ?? null,
    });
    moverGrounding.push(
      `- ${r.name || r.ticker} (${r.ticker}): ${signedPct(r.chg_1d)}${
        h ? ` — headline: "${h.title}"${h.publisher ? ` (${h.publisher})` : ""}` : " — no matching headline"
      }`
    );
  }

  const when = slot === "preopen" ? "before the opening bell" : "after the closing bell";
  const grounding = `MARKET WRAP — ${dayStamp()}, written ${when}.

MAJOR INDEXES (delayed):
${idxLines}

SECTOR ROTATION (average move across large-cap US stocks we track):
${sectorLines}

NOTABLE MOVERS TODAY (large, recognizable companies):
${moverGrounding.join("\n")}

Write the market wrap. Ground every statement in the data above. The page will render the exact index and mover figures as chips, so interpret and teach — don't recite numbers.`;

  const sections = await callJson<MarketWrapSections>(
    MARKET_WRAP_MODEL,
    marketWrapSystemPrompt(),
    grounding,
    MARKET_WRAP_SCHEMA,
    1500
  );
  if (!sections) return { generated: false, slug, reason: "model-failed" };

  const blocks: NewsBlock[] = [
    ...splitParas(sections.overview).map((t) => ({ type: "paragraph", text: t }) as NewsBlock),
    { type: "heading", text: "Sector rotation" },
    { type: "paragraph", text: sections.sector_note },
  ];
  if (moverItems.length > 0) {
    blocks.push({ type: "heading", text: "Today's movers" });
    blocks.push({ type: "movers", items: moverItems });
    blocks.push({ type: "paragraph", text: sections.movers_note });
  }
  blocks.push({ type: "heading", text: "What this teaches" });
  blocks.push({ type: "paragraph", text: sections.what_it_teaches });

  const res = await insertArticle(db, {
    slug,
    kind: "market_wrap",
    title: sections.title,
    dek: sections.dek,
    blocks,
    tickers: moverItems.map((m) => m.ticker),
    model: MARKET_WRAP_MODEL,
  });
  return { generated: res.ok, slug, title: res.title };
}

/* ─────────────────────────── Ticker events ─────────────────────────── */

interface RankedEvent {
  row: MetricRow;
  score: number;
  trigger: string;
}

/** Rank the day's notable events from screener deltas (|chg|>=8 / vol>=3 / 52w). */
function rankEvents(rows: MetricRow[]): RankedEvent[] {
  const seen = new Set<string>();
  const out: RankedEvent[] = [];
  for (const r of rows) {
    if (seen.has(r.ticker)) continue;
    const chg = r.chg_1d;
    const vol = r.vol_ratio;
    const bigMove = chg != null && Math.abs(chg) >= 8;
    const volSurge = vol != null && vol >= 3;
    const at52High =
      r.dist_52w_high != null && r.dist_52w_high >= -0.3 && (chg ?? 0) > 0;
    const at52Low = r.dist_52w_low != null && r.dist_52w_low <= 0.3 && (chg ?? 0) < 0;
    if (!bigMove && !volSurge && !at52High && !at52Low) continue;
    seen.add(r.ticker);

    // Build a factual trigger string + a composite notability score.
    const parts: string[] = [];
    if (chg != null) parts.push(`moved ${signedPct(chg)} on the day`);
    if (volSurge && vol != null) parts.push(`traded ${vol.toFixed(1)}x its average volume`);
    if (at52High) parts.push("touched a fresh 52-week high");
    if (at52Low) parts.push("touched a fresh 52-week low");
    const score =
      (chg != null ? Math.abs(chg) : 0) +
      (vol != null ? Math.min(vol, 10) * 2 : 0) +
      (at52High || at52Low ? 15 : 0);
    out.push({ row: r, score, trigger: parts.join(", ") });
  }
  return out.sort((a, b) => b.score - a.score);
}

export async function generateTickerEvents(
  db: Db,
  opts: { force?: boolean; max?: number } = {}
): Promise<{ generated: number; skipped: number; slugs: string[]; titles: string[] }> {
  const max = opts.max ?? 8;
  const day = dayStamp();

  // Candidate pool: top gainers, top losers, biggest volume surges (recognizable).
  const [{ data: up }, { data: down }, { data: vol }] = await Promise.all([
    db
      .from("screener_metrics")
      .select(METRIC_COLS)
      .eq("type", "common")
      .gte("mcap", 1e9)
      .not("chg_1d", "is", null)
      .order("chg_1d", { ascending: false })
      .limit(30),
    db
      .from("screener_metrics")
      .select(METRIC_COLS)
      .eq("type", "common")
      .gte("mcap", 1e9)
      .not("chg_1d", "is", null)
      .order("chg_1d", { ascending: true })
      .limit(30),
    db
      .from("screener_metrics")
      .select(METRIC_COLS)
      .eq("type", "common")
      .gte("mcap", 1e9)
      .not("vol_ratio", "is", null)
      .order("vol_ratio", { ascending: false })
      .limit(30),
  ]);
  const pool = [
    ...((up as MetricRow[]) || []),
    ...((down as MetricRow[]) || []),
    ...((vol as MetricRow[]) || []),
  ];
  const ranked = rankEvents(pool);

  const slugs: string[] = [];
  const titles: string[] = [];
  let generated = 0;
  let skipped = 0;

  for (const ev of ranked) {
    if (generated >= max) break;
    const t = ev.row.ticker;
    const slug = `${t.toLowerCase()}-${day}`;
    if (!opts.force && (await slugExists(db, slug))) {
      skipped++;
      continue;
    }

    const news = await getNews(t, 2).catch(() => [] as NewsItem[]);
    const h = pickRelevantHeadline(news, t, ev.row.name);
    const grounding = `TICKER NOTE — ${ev.row.name || t} (${t}), ${day}.

TRIGGER (facts, delayed data): ${ev.row.name || t} ${ev.trigger}.${
      ev.row.sector ? ` Sector: ${ev.row.sector}.` : ""
    }
${h ? `MATCHING HEADLINE: "${h.title}"${h.publisher ? ` (${h.publisher})` : ""}` : "MATCHING HEADLINE: none found — describe the move factually without guessing a cause."}

Write the short ticker note. The page renders the exact figures separately, so teach the concept — don't just recite the numbers.`;

    const sections = await callJson<TickerEventSections>(
      TICKER_EVENT_MODEL,
      tickerEventSystemPrompt(),
      grounding,
      TICKER_EVENT_SCHEMA,
      600
    );
    if (!sections) {
      skipped++;
      continue;
    }

    const blocks: NewsBlock[] = [
      { type: "movers", items: [{ ticker: t, name: ev.row.name, chg: ev.row.chg_1d }] },
      ...splitParas(sections.note).map((p) => ({ type: "paragraph", text: p }) as NewsBlock),
    ];
    if (h) {
      blocks.push({
        type: "source",
        title: h.title,
        url: h.url,
        publisher: h.publisher,
        published: h.published,
      });
    }

    const res = await insertArticle(db, {
      slug,
      kind: "ticker_event",
      title: sections.title,
      dek: sections.dek,
      blocks,
      tickers: [t],
      model: TICKER_EVENT_MODEL,
    });
    if (res.ok) {
      generated++;
      slugs.push(slug);
      titles.push(res.title);
    } else {
      skipped++;
    }
  }

  return { generated, skipped, slugs, titles };
}

/* ─────────────────────────── util ─────────────────────────── */

function splitParas(text: string | null | undefined): string[] {
  if (!text) return [];
  return text
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean);
}
