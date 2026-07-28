export const dynamic = "force-dynamic";

import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Bell } from "lucide-react";
import {
  getRequestClient,
  getRequestProfile,
  getRequestTierState,
  getRequestUser,
} from "@/lib/supabase/rsc";
import { effectiveClubTier } from "@/lib/tier";
import { isSoloProfile, deriveRegister } from "@/lib/register";
import LockedState from "@/components/dashboard/LockedState";
import { FIC_CHECKOUT_URL } from "@/lib/free-class";
import AlertsClient from "./AlertsClient";
import {
  buildSampleAlert,
  type TradeAlert,
  type AlertEvent,
  type AlertRule,
  type StrategyProfile,
  type AlertPrefs,
  type SampleAlert,
} from "@/lib/alerts/types";
import {
  buildTrackRecord,
  type AlertHistoryInput,
  type DailyClose,
  type TrackRecord,
} from "@/lib/alerts/history";
import type { WatchCurrentState, AlertSetup } from "@/lib/alerts/types";
import { observationalOutcome, type ObservationalRow } from "@/lib/alerts/watch-ui";

// The tab and the wordmark now say the same thing. This board shipped under the
// word "watch", which /watchlist also prints, so two different rooms were
// indistinguishable in a tab strip. Kai Watch is the name the rail already uses
// to send a member here.
export const metadata: Metadata = {
  title: "Kai Watch",
  description:
    "Kai's personalized watch layer — your rules, what is developing, and what it has already told you.",
};

/**
 * /alerts — the Trade Alerts Hub (LANE C6).
 *
 * Gating (belt-and-suspenders with the nav, which never shows this to kids):
 *   • kids / teens  → hard redirect (never reach the surface).
 *   • free tier     → LockedState funnel card.
 *   • paying adults → full hub.
 * Mode (solo/club vs family-adult) only sets the briefing default; both see the
 * hub and the personalized engine.
 */
export default async function AlertsPage() {
  // SPEED — this page opened with FOUR sequential round trips before it read a
  // single alert (getUser → profiles → family_tiers → family_profiles) and then
  // ran another ELEVEN awaits one after another. The gates below are unchanged;
  // only the fetching is restructured (see the wave comments further down).
  //
  // Session, profile and tier are the request-scoped shared reads, so the shell
  // has already paid for them — this page adds none of its own.
  const [supabase, user, profile] = await Promise.all([
    getRequestClient(),
    getRequestUser(),
    getRequestProfile(),
  ]);
  if (!user) redirect("/login");

  const register = deriveRegister(profile);
  if (register !== "adult") redirect("/dashboard"); // kids/teens never see alerts

  const tierState = await getRequestTierState(profile?.family_id);
  const tier = effectiveClubTier(tierState.tier, tierState.clubLapsed);

  if (tier === "free") {
    return (
      <div className="mx-auto w-full max-w-2xl px-4 py-8">
        <LockedState
          icon={Bell}
          eyebrow="Cheat Code Club"
          title="Trade alerts are a member feature"
          body="Join the Club to get Kai's daily briefing alerts plus your own price, volume and screen alerts — delivered as push, framed as education, never as advice."
          cta={{ label: "Join the Club", href: FIC_CHECKOUT_URL, external: true }}
        />
      </div>
    );
  }

  /* ── WAVE 1 — everything that depends on nothing but the session ──────────
   * Eleven of the reads on this page were issued one after another even though
   * only a handful of them actually depend on an earlier result. These do not:
   * every input is `user.id` or `profile.family_id`, both already known. So
   * they go out together as ONE round trip instead of eleven.
   *
   * Two of them used to be issued conditionally (`marketEvents` only when the
   * broadcast feed is empty, the watchlist only for a family). Running them in
   * the batch does not change what the page SHOWS — the conditions still gate
   * the results below — it just stops the page paying a round trip to discover
   * the condition. */
  const [
    fpRes,
    { data: alertsData },
    { data: eventsData },
    { data: rulesData },
    { data: stratData },
    { data: prefsData },
    { data: setupRows },
    { data: histAlerts },
    { data: newsRows },
    { data: sampleCandidate },
    { data: watchlistRows },
  ] = await Promise.all([
    // Solo verdict → briefing default (individual/club ON, family-adult opt-in).
    profile?.family_id && (profile.role === "parent" || profile.role === "admin")
      ? supabase
          .from("family_profiles")
          .select("household, completed_at")
          .eq("family_id", profile.family_id)
          .maybeSingle()
      : Promise.resolve({ data: null }),
    supabase
      .from("trade_alerts")
      .select("*")
      .order("issued_at", { ascending: false })
      .limit(30),
    supabase
      .from("alert_events")
      .select("*")
      .order("fired_at", { ascending: false })
      .limit(60),
    supabase
      .from("alert_rules")
      .select("*")
      .order("created_at", { ascending: false }),
    supabase
      .from("strategy_profiles")
      .select("timeframe, setup_prefs, risk_posture")
      .eq("user_id", user.id)
      .maybeSingle(),
    supabase
      .from("alert_prefs")
      .select("briefing_enabled, digest, daily_cap, quiet_hours, hub_seen_at")
      .eq("user_id", user.id)
      .maybeSingle(),
    // Kai Daily SETUP lifecycle objects.
    supabase
      .from("alert_setups")
      .select(
        "id, alert_id, ticker, direction, thesis, entry, levels, snapshot_price, state, state_entered_at, expires_at, created_at"
      )
      .order("created_at", { ascending: false })
      .limit(40),
    // Track-record source: past Kai briefing alerts.
    supabase
      .from("trade_alerts")
      .select("id, ticker, direction, setup_label, snapshot_price, entry, issued_at, source")
      .order("issued_at", { ascending: false })
      .limit(120),
    // This week's newsroom ticker-events — used ONLY when the broadcast feed is
    // still empty (gated below, exactly as before).
    supabase
      .from("news_articles")
      .select("slug, title, dek, tickers")
      .eq("kind", "ticker_event")
      .eq("published", true)
      .order("generated_at", { ascending: false })
      .limit(6),
    // SAMPLE alert candidate — a large-cap pressing its 52-week high in a
    // healthy trend, from the REAL nightly screener data. Never written to the
    // DB, so it is excluded from the track record and never fanned out.
    supabase
      .from("screener_metrics")
      .select("ticker, name, price, rsi14, dist_52w_high, ema20_state, ema50_state, mcap")
      .gte("dist_52w_high", -1.5)
      .gte("rsi14", 45)
      .lte("rsi14", 72)
      .eq("ema20_state", "above")
      .eq("ema50_state", "above")
      .not("mcap", "is", null)
      .not("price", "is", null)
      .order("mcap", { ascending: false })
      .limit(1)
      .maybeSingle(),
    // Member's watchlist tickers (directive 3) — the pool the strategy-play
    // picker draws from. Read-only; the watchlist lane owns writes.
    profile?.family_id
      ? supabase
          .from("family_watchlist")
          .select("ticker, company_name, created_at")
          .eq("family_id", profile.family_id)
          .order("created_at", { ascending: false })
      : Promise.resolve({ data: null }),
  ]);

  const isSolo = isSoloProfile(fpRes?.data ?? null);
  const broadcasts = (alertsData || []) as TradeAlert[];
  const events = (eventsData || []) as AlertEvent[];
  const rules = (rulesData || []) as AlertRule[];
  const setupRowsTyped = (setupRows || []) as AlertSetup[];
  const rawAlerts = (histAlerts || []) as {
    id: string;
    ticker: string;
    direction: "long" | "short" | "watch";
    setup_label: string | null;
    snapshot_price: number | null;
    entry: number | null;
    issued_at: string;
    source: string;
  }[];

  /* ── WAVE 2 — the reads that genuinely needed wave 1's answers ────────────
   * Prices for the feed, watch state for the member's rules, their follow set
   * for the setups, and the stored daily closes behind both follow-through
   * boards. Each of these was its own sequential await; they depend on wave 1
   * but not on each other, so they now go out together. The two close-history
   * reads also fetched their 200-ticker chunks in a serial for-loop — those
   * chunks are independent, so they are fanned out too. */

  // Current prices for perf-since-issue (reuse screener_metrics — zero API load).
  const feedTickers = [
    ...new Set([
      ...broadcasts.map((b) => b.ticker),
      ...events.map((e) => e.ticker).filter(Boolean),
    ]),
  ];

  const ruleIds = rules.map((r) => r.id);

  // Observational follow-through (track-record honest split): the member's OWN
  // fired personal alerts have no graded levels, so they are NEVER W/L — instead
  // we show "what happened after" from stored daily closes.
  const obsEvents = events.filter(
    (e) => e.kind === "rule" && e.payload?.snapshot_price != null
  );

  const chunkedCloses = async (
    tickers: string[],
    since: string
  ): Promise<DailyClose[]> => {
    if (!tickers.length) return [];
    const chunks: string[][] = [];
    for (let i = 0; i < tickers.length; i += 200) chunks.push(tickers.slice(i, i + 200));
    const results = await Promise.all(
      chunks.map((chunk) =>
        supabase
          .from("screener_history")
          .select("ticker, as_of, close")
          .in("ticker", chunk)
          .gte("as_of", since)
          .then(({ data }) => (data || []) as DailyClose[], () => [] as DailyClose[])
      )
    );
    return results.flat();
  };

  const obsEarliest = obsEvents.length
    ? obsEvents.reduce((min, e) => (e.fired_at < min ? e.fired_at : min), obsEvents[0].fired_at)
    : null;
  const histEarliest = rawAlerts.length
    ? rawAlerts.reduce((min, a) => (a.issued_at < min ? a.issued_at : min), rawAlerts[0].issued_at)
    : null;

  // The sample alert may need a second hop (the AAPL fallback) before its close
  // history — kept as its own chain so the rare fallback never delays the rest.
  type SampleMx = {
    ticker: string;
    name: string | null;
    price: number | null;
    rsi14: number | null;
    dist_52w_high: number | null;
  };
  const sampleAlertPromise: Promise<SampleAlert | null> = (async () => {
    let sm = (sampleCandidate as unknown as SampleMx | null) ?? null;
    if (!sm) {
      const { data: fb } = await supabase
        .from("screener_metrics")
        .select("ticker, name, price, rsi14, dist_52w_high")
        .eq("ticker", "AAPL")
        .maybeSingle();
      sm = (fb as unknown as SampleMx | null) ?? null;
    }
    if (sm?.price == null) return null;
    const { data: hist } = await supabase
      .from("screener_history")
      .select("close")
      .eq("ticker", sm.ticker)
      .order("as_of", { ascending: false })
      .limit(20);
    const closes = ((hist || []) as { close: number }[]).map((h) => h.close);
    return buildSampleAlert(sm, closes);
  })();

  const [
    { data: priceRows },
    { data: watchStateRows },
    { data: subs },
    obsCloses,
    histCloses,
    sampleAlert,
  ] = await Promise.all([
    feedTickers.length
      ? supabase.from("screener_metrics").select("ticker, price").in("ticker", feedTickers)
      : Promise.resolve({ data: null }),
    // Current machine-state per active watch (Lane A watch_current_state view;
    // security_invoker RLS scopes it to the member's own rules). This is what
    // makes the "N watches active · what Kai sees right now" board honest.
    ruleIds.length
      ? supabase
          .from("watch_current_state")
          .select("rule_id, state, entered_at, detail")
          .in("rule_id", ruleIds)
      : Promise.resolve({ data: null }),
    setupRowsTyped.length
      ? supabase
          .from("setup_subscriptions")
          .select("setup_id")
          .in(
            "setup_id",
            setupRowsTyped.map((r) => r.id)
          )
      : Promise.resolve({ data: null }),
    obsEarliest ? chunkedCloses([...new Set(obsEvents.map((e) => e.ticker))], obsEarliest.slice(0, 10)) : Promise.resolve([] as DailyClose[]),
    histEarliest ? chunkedCloses([...new Set(rawAlerts.map((a) => a.ticker))], histEarliest.slice(0, 10)) : Promise.resolve([] as DailyClose[]),
    sampleAlertPromise,
  ]);

  const priceMap: Record<string, number> = {};
  for (const r of (priceRows || []) as { ticker: string; price: number | null }[]) {
    if (r.price != null) priceMap[r.ticker] = r.price;
  }

  const watchStates = (watchStateRows || []) as WatchCurrentState[];

  const subSet = new Set(((subs || []) as { setup_id: string }[]).map((s) => s.setup_id));
  const setups: AlertSetup[] = setupRowsTyped.map((r) => ({
    ...r,
    subscribed: subSet.has(r.id),
  }));

  const obsByTicker = new Map<string, { as_of: string; close: number }[]>();
  for (const c of obsCloses) {
    const arr = obsByTicker.get(c.ticker) || [];
    arr.push({ as_of: c.as_of, close: c.close });
    obsByTicker.set(c.ticker, arr);
  }
  const observational: ObservationalRow[] = obsEvents.map((e) => {
    const o = observationalOutcome(
      e.payload.snapshot_price ?? null,
      e.fired_at,
      obsByTicker.get(e.ticker) || []
    );
    return {
      id: e.id,
      ticker: e.ticker,
      firedAt: e.fired_at,
      message: e.payload.message || "Kai flagged something",
      ...o,
    };
  });

  // Newsroom ticker-events as tasteful "market events" filler when the
  // broadcast feed is still empty (Railway side not posting yet).
  const marketEvents: { ticker: string; title: string; dek: string | null; slug: string }[] =
    broadcasts.length === 0
      ? ((newsRows || []) as {
          slug: string;
          title: string;
          dek: string | null;
          tickers: string[] | null;
        }[]).map((n) => ({
          ticker: (n.tickers && n.tickers[0]) || "",
          title: n.title,
          dek: n.dek,
          slug: n.slug,
        }))
      : [];

  // Track record (directive 2) — past Kai briefing alerts graded by peak
  // favorable move ("peak is the win"). Reads only stored daily closes.
  let trackRecord: TrackRecord = {
    outcomes: [],
    winners: [],
    losers: [],
    total: 0,
    graded: 0,
    avgPeak: null,
    hitRate: null,
    bestPeak: null,
  };
  if (rawAlerts.length > 0) {
    const inputs: AlertHistoryInput[] = rawAlerts.map((a) => ({
      id: a.id,
      ticker: a.ticker,
      direction: a.direction,
      setup_label: a.setup_label,
      snapshot_price: a.snapshot_price ?? a.entry,
      issued_at: a.issued_at,
      source: a.source,
    }));
    trackRecord = buildTrackRecord(inputs, histCloses);
  }

  const watchlistTickers: { ticker: string; company_name: string }[] = [];
  {
    const seen = new Set<string>();
    for (const w of (watchlistRows || []) as { ticker: string; company_name: string }[]) {
      const t = (w.ticker || "").toUpperCase();
      if (!t || seen.has(t)) continue;
      seen.add(t);
      watchlistTickers.push({ ticker: t, company_name: w.company_name });
    }
  }

  const strategy = (stratData as StrategyProfile | null) ?? null;
  const prefs: AlertPrefs = {
    briefing_enabled: (prefsData?.briefing_enabled as boolean | null) ?? null,
    digest: (prefsData?.digest as boolean) ?? false,
    daily_cap: (prefsData?.daily_cap as number) ?? 10,
    quiet_hours: (prefsData?.quiet_hours as boolean) ?? true,
  };

  // ── "N new" (canvas board 18) — an HONEST count, not a decoration.
  // hub_seen_at (migration 195) is the watermark stamped when this member last
  // opened the hub. NULL means they never have, in which case nothing is marked
  // "new" retroactively: a first visit is not a pile of unread mail, it is a
  // first visit. Broadcasts count alongside personal events because both are
  // things that landed on this screen since the member last looked.
  const hubSeenAt = (prefsData?.hub_seen_at as string | null) ?? null;
  const newSinceSeen = hubSeenAt
    ? events.filter((e) => e.fired_at > hubSeenAt).length +
      broadcasts.filter((b) => b.issued_at > hubSeenAt).length
    : 0;

  return (
    <AlertsClient
      userId={user.id}
      isSolo={isSolo}
      newSinceSeen={newSinceSeen}
      hubSeenAt={hubSeenAt}
      broadcasts={broadcasts}
      events={events}
      rules={rules}
      strategy={strategy}
      prefs={prefs}
      priceMap={priceMap}
      marketEvents={marketEvents}
      sampleAlert={sampleAlert}
      trackRecord={trackRecord}
      watchlistTickers={watchlistTickers}
      watchStates={watchStates}
      setups={setups}
      observational={observational}
    />
  );
}
