import { redirect, notFound } from "next/navigation";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import ChallengeShell from "@/components/challenge/ChallengeShell";
import DayMission from "@/components/challenge/days/DayMission";
import { BRAND_TICKERS, type CohortArtifact, type DaySeed, type DoPayload, type Quote, type RoomEntry } from "@/components/challenge/days/data";
import { fetchChallengeState, joinChallenge } from "@/lib/challenge/state";
import { CLUB_CONTINUE_URL, FTA_CHALLENGE_URL } from "@/lib/server/challenge-emails";

export const dynamic = "force-dynamic";

/**
 * /challenge/days/[day] — ONE of the five day missions.
 *
 * WHAT THIS FILE IS FOR: every number the boards render comes from a real table,
 * read here on the server, so the client board never has to invent one and never
 * paints an empty state while a fetch is in flight.
 *
 *   screener_metrics ..... prices, one-month moves, the Day-4 screen universe
 *   community_watchlist .. the room's board on Day 3
 *   challenge_artifacts .. the cohort's work, and the Day-3 vote tallies (there
 *                          is no separate vote table — a vote IS an artifact)
 *   challenge_step_completions … the member's own saved `do` payload, so the
 *                          share screen re-hydrates work done on another device
 *
 * WHAT THIS FILE NEVER DOES: decide whether a day is open. `day.state` arrives
 * already derived from Postgres and is passed straight through.
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type DB = SupabaseClient<any, "public", any>;

interface MetricsRow {
  ticker: string;
  name: string | null;
  price: number | null;
  chg_1d: number | null;
  chg_1m?: number | null;
  chg_3m?: number | null;
  dist_52w_high?: number | null;
  rsi14?: number | null;
  sector?: string | null;
  mcap?: number | null;
  ema50_state?: string | null;
  vol_ratio?: number | null;
}

const METRIC_COLS =
  "ticker, name, price, chg_1d, chg_1m, chg_3m, dist_52w_high, rsi14, sector, mcap, ema50_state, vol_ratio";

function toQuote(m: MetricsRow): Quote {
  return {
    ticker: m.ticker.toUpperCase(),
    name: m.name ?? null,
    price: m.price ?? null,
    // null, never 0 — an absent reading renders "—" downstream.
    chg: m.chg_1d ?? null,
    chg1m: m.chg_1m ?? null,
    chg3m: m.chg_3m ?? null,
    distHigh: m.dist_52w_high ?? null,
    rsi: m.rsi14 ?? null,
    sector: m.sector ?? null,
    mcap: m.mcap ?? null,
    ema50: m.ema50_state ?? null,
    volRatio: m.vol_ratio ?? null,
  };
}

interface ArtifactRow {
  user_id: string;
  day_no: number;
  ticker: string | null;
  company_name: string | null;
  body: string | null;
  payload: Record<string, unknown> | null;
}

/** Every ticker an artifact touched, whatever day shape produced it. */
function artifactTickers(a: ArtifactRow): string[] {
  const p = (a.payload ?? {}) as {
    picks?: { ticker?: string }[];
    votes?: { ticker?: string }[];
  };
  if (Array.isArray(p.picks)) {
    return p.picks.map((x) => (x?.ticker ?? "").toUpperCase()).filter(Boolean);
  }
  if (Array.isArray(p.votes)) {
    return p.votes.map((x) => (x?.ticker ?? "").toUpperCase()).filter(Boolean);
  }
  return a.ticker ? [a.ticker.toUpperCase()] : [];
}

export default async function ChallengeDayPage({
  params,
}: {
  params: Promise<{ day: string }>;
}) {
  const { day: dayParam } = await params;
  const dayNo = Number(dayParam);
  if (!Number.isInteger(dayNo) || dayNo < 1 || dayNo > 5) notFound();

  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth?.user) redirect(`/login?next=/challenge/days/${dayNo}`);

  await joinChallenge(supabase);
  const state = await fetchChallengeState(supabase);
  if (!state) redirect("/dashboard");

  const day = state.days.find((d) => d.day_no === dayNo);
  if (!day) notFound();

  const uid = auth.user.id;
  const seed = await seedDay(supabase, uid, dayNo);

  return (
    <ChallengeShell>
      <DayMission
        day={day}
        state={state}
        seed={seed}
        clubUrl={CLUB_CONTINUE_URL}
        ftaUrl={FTA_CHALLENGE_URL}
      />
    </ChallengeShell>
  );
}

/* ── the seed ─────────────────────────────────────────────────────────────── */

async function seedDay(db: DB, uid: string, dayNo: number): Promise<DaySeed> {
  const empty: DaySeed = {
    quotes: {},
    universe: [],
    room: [],
    cohort: [],
    postedCount: null,
    mine: {},
    doPayload: null,
    myArtifact: null,
    me: { name: "You", avatar: null },
  };

  const [
    { data: profile },
    { data: myArtifacts },
    { data: stepRow },
    { data: dayArtifacts, count: postedCount },
  ] = await Promise.all([
    db.from("profiles").select("display_name, avatar_url").eq("id", uid).maybeSingle(),
    db
      .from("challenge_artifacts")
      .select("user_id, day_no, ticker, company_name, body, payload")
      .eq("user_id", uid),
    db
      .from("challenge_step_completions")
      .select("payload")
      .eq("user_id", uid)
      .eq("day_no", dayNo)
      .eq("step", "do")
      .maybeSingle(),
    db
      .from("challenge_artifacts")
      .select("user_id, day_no, ticker, company_name, body, payload", { count: "exact" })
      .eq("day_no", dayNo)
      .order("created_at", { ascending: false })
      .limit(40),
  ]);

  const me = {
    name:
      (profile as { display_name?: string | null } | null)?.display_name?.trim() || "You",
    avatar: (profile as { avatar_url?: string | null } | null)?.avatar_url ?? null,
  };

  /* my own artifacts, keyed by day — the Day-5 recap and Day-2's candidate list */
  const mine: Record<number, CohortArtifact> = {};
  let myArtifact: CohortArtifact | null = null;
  for (const raw of (myArtifacts ?? []) as ArtifactRow[]) {
    const a: CohortArtifact = {
      userId: raw.user_id,
      name: me.name,
      avatar: me.avatar,
      ticker: raw.ticker,
      company: raw.company_name,
      body: raw.body,
      tickers: artifactTickers(raw),
      stance: ((raw.payload ?? {}) as { stance?: string }).stance ?? null,
    };
    mine[raw.day_no] = a;
    if (raw.day_no === dayNo) myArtifact = a;
  }

  /* the cohort's work on this day — names come from `profiles`, which every
     authenticated member may read. Own row filtered out: "what others made". */
  const others = ((dayArtifacts ?? []) as ArtifactRow[]).filter((a) => a.user_id !== uid);
  const authorIds = Array.from(new Set(others.map((a) => a.user_id))).slice(0, 40);
  const nameById = new Map<string, { name: string; avatar: string | null }>();
  if (authorIds.length > 0) {
    const { data: authors } = await db
      .from("profiles")
      .select("id, display_name, avatar_url")
      .in("id", authorIds);
    for (const p of (authors ?? []) as {
      id: string;
      display_name: string | null;
      avatar_url: string | null;
    }[]) {
      nameById.set(p.id, {
        name: p.display_name?.trim() || "A member",
        avatar: p.avatar_url ?? null,
      });
    }
  }
  const cohort: CohortArtifact[] = others.map((a) => ({
    userId: a.user_id,
    name: nameById.get(a.user_id)?.name ?? "A member",
    avatar: nameById.get(a.user_id)?.avatar ?? null,
    ticker: a.ticker,
    company: a.company_name,
    body: a.body,
    tickers: artifactTickers(a),
    stance: ((a.payload ?? {}) as { stance?: string }).stance ?? null,
  }));

  const base: DaySeed = {
    ...empty,
    me,
    mine,
    myArtifact,
    cohort,
    postedCount: postedCount ?? null,
    doPayload: ((stepRow as { payload?: DoPayload } | null)?.payload ?? null) as DoPayload | null,
  };

  /* ── per-day reads ─────────────────────────────────────────────────────── */

  if (dayNo === 1) {
    const { data } = await db
      .from("screener_metrics")
      .select(METRIC_COLS)
      .in("ticker", BRAND_TICKERS);
    base.quotes = byTicker((data ?? []) as MetricsRow[]);
    return base;
  }

  if (dayNo === 2) {
    // The candidate list is the member's OWN Day-1 watchlist where one exists.
    const wanted = mine[1]?.tickers?.length ? mine[1].tickers : BRAND_TICKERS.slice(0, 8);
    const { data } = await db
      .from("screener_metrics")
      .select(METRIC_COLS)
      .in("ticker", wanted);
    base.quotes = byTicker((data ?? []) as MetricsRow[]);
    // Preserve the member's own order even where a metrics row is missing.
    for (const t of wanted) {
      if (!base.quotes[t]) {
        base.quotes[t] = {
          ticker: t,
          name: null,
          price: null,
          chg: null,
        };
      }
    }
    return base;
  }

  if (dayNo === 3) {
    const { data: board } = await db
      .from("community_watchlist")
      .select("ticker, company_name, blurb, headline, created_at")
      .neq("status", "archived")
      .order("created_at", { ascending: false })
      .limit(24);

    // One row per TICKER — the board can carry the same name twice (an admin
    // pick plus a member promotion) and the room votes on names, not on rows.
    const seen = new Set<string>();
    const entries: {
      ticker: string;
      company: string;
      blurb: string | null;
    }[] = [];
    for (const r of (board ?? []) as {
      ticker: string;
      company_name: string;
      blurb: string | null;
      headline: string | null;
    }[]) {
      const t = r.ticker.toUpperCase();
      if (seen.has(t)) continue;
      seen.add(t);
      entries.push({
        ticker: t,
        company: r.company_name,
        blurb: r.headline || r.blurb || null,
      });
      if (entries.length >= 5) break;
    }

    // THE TALLY. Every Day-3 artifact already posted carries its member's votes;
    // counting them here is the only vote store this feature has, and it is a
    // count of real rows rather than a number anybody typed.
    const tally = new Map<string, { bull: number; bear: number; neutral: number }>();
    const { data: voteRows } = await db
      .from("challenge_artifacts")
      .select("user_id, payload")
      .eq("day_no", 3)
      .limit(2000);
    for (const v of (voteRows ?? []) as { user_id: string; payload: Record<string, unknown> | null }[]) {
      if (v.user_id === uid) continue; // the member's own vote is added client-side
      const votes = ((v.payload ?? {}) as { votes?: { ticker?: string; stance?: string }[] })
        .votes;
      if (!Array.isArray(votes)) continue;
      for (const one of votes) {
        const t = (one?.ticker ?? "").toUpperCase();
        const s = one?.stance;
        if (!t || (s !== "bull" && s !== "bear" && s !== "neutral")) continue;
        const cur = tally.get(t) ?? { bull: 0, bear: 0, neutral: 0 };
        cur[s] += 1;
        tally.set(t, cur);
      }
    }

    const { data: metrics } = await db
      .from("screener_metrics")
      .select(METRIC_COLS)
      .in(
        "ticker",
        entries.map((e) => e.ticker)
      );
    const quotes = byTicker((metrics ?? []) as MetricsRow[]);

    const room: RoomEntry[] = entries.map((e) => {
      const t = tally.get(e.ticker) ?? { bull: 0, bear: 0, neutral: 0 };
      return {
        ticker: e.ticker,
        company: e.company,
        blurb: e.blurb,
        quote: quotes[e.ticker] ?? null,
        bull: t.bull,
        bear: t.bear,
        neutral: t.neutral,
        votes: t.bull + t.bear + t.neutral,
      };
    });

    base.quotes = quotes;
    base.room = room;
    return base;
  }

  if (dayNo === 4) {
    // The screen's universe: the largest names we hold metrics for. Bounded so
    // the payload stays small and the filters still have something real to bite.
    const { data } = await db
      .from("screener_metrics")
      .select(METRIC_COLS)
      .not("mcap", "is", null)
      .order("mcap", { ascending: false })
      .limit(200);
    const universe = ((data ?? []) as MetricsRow[]).map(toQuote);
    base.universe = universe;
    base.quotes = byTicker((data ?? []) as MetricsRow[]);
    return base;
  }

  // Day 5 needs nothing beyond the member's own artifacts, already read above.
  return base;
}

function byTicker(rows: MetricsRow[]): Record<string, Quote> {
  const out: Record<string, Quote> = {};
  for (const r of rows) out[r.ticker.toUpperCase()] = toQuote(r);
  return out;
}
