export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import { Bell } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getClubTier } from "@/lib/tier";
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
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, age_group, track, display_name, family_id")
    .eq("id", user.id)
    .single();

  const register = deriveRegister(profile);
  if (register !== "adult") redirect("/dashboard"); // kids/teens never see alerts

  const tier = await getClubTier(supabase, profile?.family_id);

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

  // Solo verdict → briefing default (individual/club ON, family-adult opt-in).
  let isSolo = false;
  if (profile?.family_id && (profile.role === "parent" || profile.role === "admin")) {
    const { data: fp } = await supabase
      .from("family_profiles")
      .select("household, completed_at")
      .eq("family_id", profile.family_id)
      .maybeSingle();
    isSolo = isSoloProfile(fp);
  }

  // Parallel fetch: broadcasts, own events, own rules, strategy, prefs.
  const [
    { data: alertsData },
    { data: eventsData },
    { data: rulesData },
    { data: stratData },
    { data: prefsData },
  ] = await Promise.all([
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
      .select("briefing_enabled, digest, daily_cap, quiet_hours")
      .eq("user_id", user.id)
      .maybeSingle(),
  ]);

  const broadcasts = (alertsData || []) as TradeAlert[];
  const events = (eventsData || []) as AlertEvent[];
  const rules = (rulesData || []) as AlertRule[];

  // Current prices for perf-since-issue (reuse screener_metrics — zero API load).
  const feedTickers = [
    ...new Set([
      ...broadcasts.map((b) => b.ticker),
      ...events.map((e) => e.ticker).filter(Boolean),
    ]),
  ];
  const priceMap: Record<string, number> = {};
  if (feedTickers.length > 0) {
    const { data: mx } = await supabase
      .from("screener_metrics")
      .select("ticker, price")
      .in("ticker", feedTickers);
    for (const r of (mx || []) as { ticker: string; price: number | null }[]) {
      if (r.price != null) priceMap[r.ticker] = r.price;
    }
  }

  // This week's newsroom ticker-events as tasteful "market events" filler when
  // the broadcast feed is still empty (Railway side not posting yet).
  let marketEvents: { ticker: string; title: string; dek: string | null; slug: string }[] = [];
  if (broadcasts.length === 0) {
    const { data: news } = await supabase
      .from("news_articles")
      .select("slug, title, dek, tickers")
      .eq("kind", "ticker_event")
      .eq("published", true)
      .order("generated_at", { ascending: false })
      .limit(6);
    marketEvents = ((news || []) as { slug: string; title: string; dek: string | null; tickers: string[] | null }[]).map(
      (n) => ({
        ticker: (n.tickers && n.tickers[0]) || "",
        title: n.title,
        dek: n.dek,
        slug: n.slug,
      })
    );
  }

  // ── SAMPLE alert (directive 1) — built from REAL nightly screener data, never
  // written to the DB (so it is excluded from the track record + never fanned
  // out). Pick a large-cap pressing its 52-week high in a healthy trend; fall
  // back to AAPL if the smart query returns nothing.
  let sampleAlert: SampleAlert | null = null;
  {
    type SampleMx = {
      ticker: string;
      name: string | null;
      price: number | null;
      rsi14: number | null;
      dist_52w_high: number | null;
    };
    let sm: SampleMx | null = null;
    const { data: cand } = await supabase
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
      .maybeSingle();
    sm = (cand as unknown as SampleMx | null) ?? null;
    if (!sm) {
      const { data: fb } = await supabase
        .from("screener_metrics")
        .select("ticker, name, price, rsi14, dist_52w_high")
        .eq("ticker", "AAPL")
        .maybeSingle();
      sm = (fb as unknown as SampleMx | null) ?? null;
    }
    if (sm?.price != null) {
      const { data: hist } = await supabase
        .from("screener_history")
        .select("close")
        .eq("ticker", sm.ticker)
        .order("as_of", { ascending: false })
        .limit(20);
      const closes = ((hist || []) as { close: number }[]).map((h) => h.close);
      sampleAlert = buildSampleAlert(sm, closes);
    }
  }

  // ── Track record (directive 2) — past Kai briefing alerts graded by peak
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
  {
    const { data: histAlerts } = await supabase
      .from("trade_alerts")
      .select("id, ticker, direction, setup_label, snapshot_price, entry, issued_at, source")
      .order("issued_at", { ascending: false })
      .limit(120);
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
      const earliest = inputs.reduce(
        (min, a) => (a.issued_at < min ? a.issued_at : min),
        inputs[0].issued_at
      );
      const histTickers = [...new Set(inputs.map((a) => a.ticker))];
      const closeRows: DailyClose[] = [];
      for (let i = 0; i < histTickers.length; i += 200) {
        const chunk = histTickers.slice(i, i + 200);
        const { data: closes } = await supabase
          .from("screener_history")
          .select("ticker, as_of, close")
          .in("ticker", chunk)
          .gte("as_of", earliest.slice(0, 10));
        for (const c of (closes || []) as DailyClose[]) closeRows.push(c);
      }
      trackRecord = buildTrackRecord(inputs, closeRows);
    }
  }

  // ── Member's watchlist tickers (directive 3) — the pool the strategy-play
  // picker draws from. Read-only; the watchlist lane owns writes.
  let watchlistTickers: { ticker: string; company_name: string }[] = [];
  if (profile?.family_id) {
    const { data: wl } = await supabase
      .from("family_watchlist")
      .select("ticker, company_name, created_at")
      .eq("family_id", profile.family_id)
      .order("created_at", { ascending: false });
    const seen = new Set<string>();
    for (const w of (wl || []) as { ticker: string; company_name: string }[]) {
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

  return (
    <AlertsClient
      userId={user.id}
      isSolo={isSolo}
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
    />
  );
}
