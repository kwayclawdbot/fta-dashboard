import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getClubTier } from "@/lib/tier";

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
 */
export const runtime = "nodejs";
export const maxDuration = 30;

interface BriefItem {
  ticker?: string;
  text: string;
  kind: string;
}

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  // ENTITLEMENT (MONETIZATION-GATES.md): Kai Brief / "what changed since I left"
  // is the flagship paid retention feature (free = ❌). Server-authoritative.
  const { data: prof } = await supabase
    .from("profiles")
    .select("family_id")
    .eq("id", user.id)
    .maybeSingle();
  const tier = await getClubTier(supabase, prof?.family_id);
  if (tier === "free") {
    return NextResponse.json(
      { error: "members_only", walled: true, feature: "kai_brief" },
      { status: 403 }
    );
  }

  const admin = createAdminClient();
  const items = await deriveItems(admin);
  const updatedAt = new Date().toISOString();

  // Optional LLM polish — never required, never blocking beyond a short timeout.
  const polished = await maybePolish(items);
  return NextResponse.json({
    updatedAt,
    items: polished ?? items,
    source: polished ? "live" : "derived",
  });
}

async function deriveItems(admin: ReturnType<typeof createAdminClient>): Promise<BriefItem[]> {
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
