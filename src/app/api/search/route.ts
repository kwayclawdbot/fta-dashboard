import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { deriveRegister } from "@/lib/register";
import { rankTickerHits, type SearchCandidate } from "@/lib/market/ticker-search";
import { formatExchange } from "@/lib/market/exchange";

/**
 * GET /api/search?q=…  — the universal command surface (⌘K) backend.
 *
 * One authenticated read that returns grouped results across the app's real
 * entities: tickers (screener universe), members (profiles), theses (member feed
 * posts), lessons (course lessons), and the live debate. The client renders the
 * groups + an "Ask Kai about …" row (routed client-side to the Kai sheet) and can
 * deep-link Stock Finder for NL screening intents.
 *
 * Register-aware, kid-safe (PART IV): KID members get the ticker + lesson subset
 * only — no member directory, no theses, no debate (the same social walls the
 * community/debate/screener routes already enforce). No new tables, no writes.
 */
export const runtime = "nodejs";

interface SearchHit {
  id: string;
  title: string;
  subtitle?: string | null;
  href: string;
  symbol?: string; // tickers → logo chip
}

export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const q = (new URL(req.url).searchParams.get("q") || "").trim();
  if (q.length < 1) {
    return NextResponse.json({ tickers: [], members: [], theses: [], lessons: [], debates: [] });
  }
  const like = q.replace(/[%,()]/g, "");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, age_group, track")
    .eq("id", user.id)
    .maybeSingle();
  const register = deriveRegister(profile);
  const isKid = register === "kid";

  const admin = createAdminClient();

  // ── Tickers — the ranked screener universe (same source as /api/market/search).
  const tickersP = (async (): Promise<SearchHit[]> => {
    const cols = "ticker, name, exchange, type, mcap";
    const [exactRes, candRes] = await Promise.all([
      admin.from("screener_metrics").select(cols).ilike("ticker", like).limit(1),
      admin
        .from("screener_metrics")
        .select(cols)
        .or(`ticker.ilike.${like}%,name.ilike.%${like}%`)
        .not("price", "is", null)
        .order("mcap", { ascending: false, nullsFirst: false })
        .limit(40),
    ]);
    const merged = [
      ...((exactRes.data as SearchCandidate[]) ?? []),
      ...((candRes.data as SearchCandidate[]) ?? []),
    ];
    return rankTickerHits(merged, q, 5).map((h) => ({
      id: `t:${h.ticker}`,
      title: h.ticker,
      subtitle: `${h.name ?? ""}${h.name ? " · " : ""}${formatExchange(h.exchange)}`,
      href: `/research/${encodeURIComponent(h.ticker)}`,
      symbol: h.ticker,
    }));
  })();

  // ── Lessons — course lessons deep-linked to their viewer.
  const lessonsP = (async (): Promise<SearchHit[]> => {
    const { data } = await admin
      .from("lessons")
      // This client is service-role, so RLS does NOT filter it. Search was
      // therefore the one path that could surface a retired or unpublished
      // lesson's title and deep-link a member (including a kid) at it. Both
      // gates are applied explicitly here.
      .select("id, title, module_id, modules(id, courses(slug, title, published))")
      .eq("retired", false)
      .ilike("title", `%${like}%`)
      .limit(5);
    return (
      (data as unknown as {
        id: string;
        title: string;
        module_id: string;
        modules: {
          id: string;
          courses: { slug: string; title: string; published: boolean } | null;
        } | null;
      }[]) ?? []
    )
      .filter((l) => l.modules?.courses?.slug && l.modules.courses.published)
      .map((l) => ({
        id: `l:${l.id}`,
        title: l.title,
        subtitle: l.modules?.courses?.title ?? "Lesson",
        href: `/courses/${l.modules!.courses!.slug}/${l.module_id}/${l.id}`,
      }));
  })();

  // Kids stop here — no member directory, theses, or debate.
  if (isKid) {
    const [tickers, lessons] = await Promise.all([tickersP, lessonsP]);
    return NextResponse.json({ tickers, members: [], theses: [], lessons, debates: [] });
  }

  // ── Members — public profiles (non-kid, with a public handle).
  const membersP = (async (): Promise<SearchHit[]> => {
    const { data } = await admin
      .from("profiles")
      .select("id, display_name, username, role, age_group, track")
      .or(`display_name.ilike.%${like}%,username.ilike.%${like}%`)
      .not("username", "is", null)
      .limit(12);
    return (
      (data as {
        id: string;
        display_name: string | null;
        username: string | null;
        role: string | null;
        age_group: string | null;
        track: string | null;
      }[]) ?? []
    )
      .filter((p) => deriveRegister(p) !== "kid" && p.username)
      .slice(0, 5)
      .map((p) => ({
        id: `m:${p.id}`,
        title: p.display_name || p.username || "A member",
        subtitle: p.username ? `@${p.username}` : null,
        href: `/u/${encodeURIComponent(p.username!)}`,
      }));
  })();

  // ── Theses — member-authored feed posts (kind='post'); ticker-tagged posts
  //    deep-link to the ticker's research page, else to The Club feed.
  const thesesP = (async (): Promise<SearchHit[]> => {
    const { data } = await admin
      .from("feed_posts")
      .select("id, title, body, ticker_tags")
      .eq("kind", "post")
      // Kid-authored rows are family-only (214). This is the admin (service-role)
      // client, so RLS does not scope it — the filter is the wall, mirroring the
      // deriveRegister filter the members branch above already applies.
      .neq("author_register", "kid")
      .or(`title.ilike.%${like}%,body.ilike.%${like}%`)
      .order("created_at", { ascending: false })
      .limit(5);
    return (
      (data as {
        id: string;
        title: string | null;
        body: string | null;
        ticker_tags: string[] | null;
      }[]) ?? []
    ).map((p) => {
      const ticker = p.ticker_tags?.length ? String(p.ticker_tags[0]).toUpperCase() : null;
      const raw = (p.title || p.body || "Thesis").trim();
      return {
        id: `p:${p.id}`,
        title: raw.length > 80 ? raw.slice(0, 79) + "…" : raw,
        subtitle: ticker ? `$${ticker} · a member's thinking` : "A member's thinking",
        href: ticker ? `/research/${encodeURIComponent(ticker)}` : "/community",
      };
    });
  })();

  // ── Debate — the single live debate, only when the query matches its question.
  const debatesP = (async (): Promise<SearchHit[]> => {
    const { data } = await supabase.rpc("club_debate_state");
    const s = data as { id: string; question: string; total: number } | null;
    if (!s?.question) return [];
    if (!s.question.toLowerCase().includes(q.toLowerCase())) return [];
    return [
      {
        id: `d:${s.id}`,
        title: s.question,
        subtitle: "Today's debate",
        href: "/community",
      },
    ];
  })();

  const [tickers, members, theses, lessons, debates] = await Promise.all([
    tickersP,
    membersP,
    thesesP,
    lessonsP,
    debatesP,
  ]);
  return NextResponse.json({ tickers, members, theses, lessons, debates });
}
