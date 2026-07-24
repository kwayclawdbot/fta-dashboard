export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import { Bell } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getClubTier } from "@/lib/tier";
import { isSoloProfile, deriveRegister } from "@/lib/register";
import LockedState from "@/components/dashboard/LockedState";
import { FIC_CHECKOUT_URL } from "@/lib/free-class";
import AlertsClient from "./AlertsClient";
import type {
  TradeAlert,
  AlertEvent,
  AlertRule,
  StrategyProfile,
  AlertPrefs,
} from "@/lib/alerts/types";

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
    />
  );
}
