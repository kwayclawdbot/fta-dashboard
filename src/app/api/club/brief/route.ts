import { NextResponse, type NextRequest } from "next/server";
import { unstable_cache } from "next/cache";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { CLUB_TTL_SECONDS } from "@/lib/club/club-cache";
import { resolveClubCtx, type ClubCtx, type CoreResult } from "@/lib/club/home-context";

/**
 * GET /api/club/brief
 *   → { updatedAt, items: [{ticker?, text, kind}], source: "derived"|"live" }
 *
 * "Here's what changed since your last check-in." LLM-OPTIONAL by design: the
 * DERIVED path is primary and always returns good content from real deltas
 * (research velocity, watcher growth, sentiment shift, fresh alerts, newsroom).
 * If ANTHROPIC_API_KEY is live at runtime, a short polish pass rewrites the item
 * copy (source:"live"); any failure — including dead credits — silently falls
 * back to the derived copy (source:"derived"). No fabricated numbers.
 *
 * The body is `briefCore(ctx)` — shared verbatim with GET /api/club/home. Free
 * tier is walled (403) exactly as before; the batched assembler maps that wall
 * to a null section (client parity: a 403 read is a null section).
 */
export const runtime = "nodejs";
export const maxDuration = 30;

interface BriefItem {
  ticker?: string;
  text: string;
  kind: string;
}

export async function briefCore(ctx: ClubCtx): Promise<CoreResult> {
  // ENTITLEMENT (MONETIZATION-GATES.md): Kai Brief / "what changed since I left"
  // is the flagship paid retention feature (free = ❌). Server-authoritative.
  const tier = await ctx.getTier();
  if (tier === "free") {
    return {
      status: 403,
      body: { error: "members_only", walled: true, feature: "kai_brief" },
    };
  }

  // IDENTICAL FOR EVERY MEMBER; 60s revalidate — see getCachedBrief.
  return { body: await getCachedBrief() };
}

/**
 * THE BRIEF, COMPUTED ONCE PER MINUTE FOR THE WHOLE CLUB.
 *
 * `deriveItems` takes nothing but the service-role client and `maybePolish`
 * takes nothing but the derived items, so the ENTIRE body of this endpoint is a
 * pure function of the database at a point in time — the same five sentences
 * for every member, tier and register. It was nonetheless being recomputed from
 * scratch on every single page view: five service-role reads AND, whenever
 * ANTHROPIC_API_KEY is live, an uncached ~2.9s call out to api.anthropic.com.
 * That is one LLM request per member per pageview for a paragraph that does not
 * vary by member.
 *
 * Wrapping derive+polish together (not just the reads) is the point: the polish
 * is the expensive half, and polishing a cached derive would still pay for it
 * every time. With this in place the club makes AT MOST ONE Anthropic call per
 * minute in total, and the "Today in 30 seconds" field stops being the home
 * board's long pole for everyone but the one unlucky request that misses.
 *
 * `updatedAt` moved INSIDE the cache deliberately — it must state when the copy
 * was computed, not when it was served, or a cached brief would advertise a
 * freshness it does not have.
 *
 * The entitlement wall stays OUTSIDE, on the per-request path: free tier is
 * still 403'd before this is ever consulted, so nothing cached here can leak
 * past a gate.
 */
const getCachedBrief = unstable_cache(
  async () => {
    const admin = createAdminClient();
    const items = await deriveItems(admin);
    const updatedAt = new Date().toISOString();

    // Optional LLM polish — never required, never blocking beyond a short timeout.
    const polished = await maybePolish(items);
    return {
      updatedAt,
      items: polished ?? items,
      source: polished ? "live" : "derived",
    };
  },
  ["club:brief"],
  { revalidate: CLUB_TTL_SECONDS, tags: ["club-brief"] }
);

export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const ctx = await resolveClubCtx(supabase, req);
  if (!ctx) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { status, body } = await briefCore(ctx);
  return NextResponse.json(body, status ? { status } : undefined);
}

async function deriveItems(admin: SupabaseClient): Promise<BriefItem[]> {
  const now = Date.now();
  const dayAgo = new Date(now - 864e5).toISOString();
  const twoDayAgo = new Date(now - 2 * 864e5).toISOString();
  const weekAgo = new Date(now - 7 * 864e5).toISOString();
  const items: BriefItem[] = [];

  // 1. Research velocity — views in the last 24h.
  const { count: rvToday } = await admin
    .from("club_events")
    .select("id", { count: "exact", head: true })
    .eq("kind", "research_view")
    .gte("created_at", dayAgo);
  if ((rvToday || 0) > 0) {
    items.push({
      kind: "research_velocity",
      text: `${rvToday} research ${rvToday === 1 ? "look" : "looks"} across the Club in the last day.`,
    });
  }

  // 2. Watcher growth — most-added ticker this week.
  const [{ data: cw }, { data: fw }] = await Promise.all([
    admin.from("community_watchlist").select("ticker").gte("created_at", weekAgo),
    admin.from("family_watchlist").select("ticker").gte("created_at", weekAgo),
  ]);
  const counts = new Map<string, number>();
  for (const r of [...(cw || []), ...(fw || [])]) {
    if (!r.ticker) continue;
    const k = r.ticker.toUpperCase();
    counts.set(k, (counts.get(k) || 0) + 1);
  }
  const topWatch = [...counts.entries()].sort((a, b) => b[1] - a[1])[0];
  if (topWatch) {
    items.push({
      kind: "watcher_growth",
      ticker: topWatch[0],
      text: `${topWatch[0]} is drawing new watchers in the Club this week.`,
    });
  }

  // 3. Sentiment shift — net bull/bear change in the last 48h.
  const { data: sent } = await admin
    .from("ticker_sentiment")
    .select("ticker, vote")
    .gte("updated_at", twoDayAgo);
  const net = new Map<string, number>();
  for (const r of sent || []) {
    if (!r.ticker) continue;
    net.set(r.ticker, (net.get(r.ticker) || 0) + (Number(r.vote) || 0));
  }
  const topSent = [...net.entries()].sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]))[0];
  if (topSent) {
    items.push({
      kind: "sentiment_shift",
      ticker: topSent[0],
      text:
        topSent[1] >= 0
          ? `Sentiment on ${topSent[0]} is turning more bullish.`
          : `The Club is getting more cautious on ${topSent[0]}.`,
    });
  }

  // 4. Fresh trade alerts / track-record events.
  const { data: alerts } = await admin
    .from("trade_alerts")
    .select("ticker, setup_label, direction, issued_at")
    .gte("issued_at", weekAgo)
    .order("issued_at", { ascending: false })
    .limit(1);
  if (alerts && alerts[0]) {
    const a = alerts[0];
    items.push({
      kind: "alert",
      ticker: a.ticker,
      text: `New ${a.direction || ""} setup flagged on ${a.ticker}${a.setup_label ? ` — ${a.setup_label}` : ""}.`.replace(/\s+/g, " ").trim(),
    });
  }

  // 5. Newsroom — most recent article.
  const { data: news } = await admin
    .from("news_articles")
    .select("title, created_at")
    .order("created_at", { ascending: false })
    .limit(1);
  if (news && news[0]?.title) {
    items.push({ kind: "newsroom", text: news[0].title });
  }

  // Founding-era fallback so the brief is never empty.
  if (items.length === 0) {
    items.push({
      kind: "founding",
      text: "The Club is quiet right now — be the first to add a watch or a note today.",
    });
  }
  return items.slice(0, 5);
}

/**
 * Optional Anthropic polish. Returns null on ANY problem (no key, dead credits,
 * timeout, malformed response) so the caller uses the derived copy. Mirrors the
 * Kai chat pattern: trimmed key, short timeout, graceful degradation.
 */
async function maybePolish(items: BriefItem[]): Promise<BriefItem[] | null> {
  const key = process.env.ANTHROPIC_API_KEY?.trim();
  if (!key || items.length === 0) return null;
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
        max_tokens: 500,
        system:
          "You polish a stock community's daily brief. Rewrite each item's `text` to be crisp, warm, and concrete. NEVER invent numbers, tickers, or facts — only rephrase what is given. Return ONLY a JSON array of {ticker?,text,kind} in the same order and length.",
        messages: [{ role: "user", content: JSON.stringify(items) }],
      }),
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { content?: { type: string; text?: string }[] };
    const raw = (data.content || []).filter((b) => b.type === "text").map((b) => b.text || "").join("").trim();
    const jsonStart = raw.indexOf("[");
    const jsonEnd = raw.lastIndexOf("]");
    if (jsonStart < 0 || jsonEnd < 0) return null;
    const parsed = JSON.parse(raw.slice(jsonStart, jsonEnd + 1)) as BriefItem[];
    if (!Array.isArray(parsed) || parsed.length !== items.length) return null;
    // Guard: keep original tickers/kinds; only accept polished text.
    return items.map((it, i) => ({
      ...it,
      text: typeof parsed[i]?.text === "string" && parsed[i].text.trim() ? parsed[i].text.trim() : it.text,
    }));
  } catch {
    return null;
  }
}
