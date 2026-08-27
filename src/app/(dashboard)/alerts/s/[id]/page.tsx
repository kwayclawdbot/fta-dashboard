export const dynamic = "force-dynamic";

import { redirect, notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getClubTier } from "@/lib/tier";
import { deriveRegister } from "@/lib/register";
import { getResearchPayload } from "@/lib/research/aggregate";
import type { AlertEvent, AlertSetup, TradeAlert } from "@/lib/alerts/types";
import SetupDetailClient from "./SetupDetailClient";

/**
 * /alerts/s/[id] — the SETUP-level alert-detail page.
 *
 * /alerts/e/[id] is the EVENT detail (one thing that fired). THIS page is the
 * alert itself: one `alert_setups` lifecycle object as a full ticker-detail-
 * style surface — masthead, the big SMS-style marked-up chart (candles +
 * ENTRY/STOP/TARGET + shaded risk/reward), the stored thesis, the plan's
 * StatGrid, the honest lifecycle record, the owning Kai briefing narrative
 * when linked, related events for the ticker, and an embedded Ask-Kai section
 * seeded with THIS setup's context.
 *
 * GATES (byte-matched to the alerts hub): kids/teens never reach the surface
 * (redirect), free tier bounces to /alerts where the funnel card lives.
 *
 * HONESTY: the DB keeps only the setup's CURRENT state + state_entered_at
 * (there is no setup state-history table) plus whatever `setup_update` events
 * were fanned out to THIS member. The lifecycle card shows exactly that —
 * never a reconstructed history.
 */
export default async function SetupDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, age_group, track, family_id")
    .eq("id", user.id)
    .single();
  if (deriveRegister(profile) !== "adult") redirect("/dashboard");

  const tier = await getClubTier(supabase, profile?.family_id);
  if (tier === "free") redirect("/alerts");

  const { data: setupData } = await supabase
    .from("alert_setups")
    .select(
      "id, alert_id, ticker, direction, thesis, entry, levels, snapshot_price, state, state_entered_at, expires_at, created_at, detail"
    )
    .eq("id", id)
    .maybeSingle();
  if (!setupData) notFound();
  const setup = setupData as AlertSetup;
  const ticker = setup.ticker;

  // Everything else depends only on the row — one parallel wave.
  const [
    { data: broadcastData },
    { data: mx },
    { data: subRows },
    { data: threadRows },
    { data: relatedRows },
    research,
  ] = await Promise.all([
    // The owning Kai briefing broadcast (narrative, label, targets) — if linked.
    setup.alert_id
      ? supabase
          .from("trade_alerts")
          .select(
            "id, ticker, direction, setup_label, entry, levels, targets, narrative, snapshot_price, issued_at, source, chart_url, created_at"
          )
          .eq("id", setup.alert_id)
          .maybeSingle()
      : Promise.resolve({ data: null }),
    // Current (nightly) price + company name — reuse screener metrics, no API.
    supabase.from("screener_metrics").select("price, name").eq("ticker", ticker).maybeSingle(),
    // Is THIS member following the setup's lifecycle thread? (RLS-scoped.)
    supabase.from("setup_subscriptions").select("setup_id").eq("setup_id", id).limit(1),
    // The lifecycle steps that were genuinely fanned out to this member.
    supabase
      .from("alert_events")
      .select("id, kind, ticker, payload, fired_at")
      .eq("kind", "setup_update")
      .contains("payload", { setup_id: id })
      .order("fired_at", { ascending: false })
      .limit(12),
    // Other recent alert activity on this ticker (this member's feed).
    supabase
      .from("alert_events")
      .select("id, kind, ticker, payload, fired_at")
      .eq("ticker", ticker)
      .order("fired_at", { ascending: false })
      .limit(8),
    // The research aggregate (company, key stats, grades) — the concise
    // ticker-detail context. A failed compose is an honest null, never a
    // blocked page. Does NOT touch the research read meter.
    getResearchPayload(ticker).catch(() => null),
  ]);

  const broadcast = (broadcastData as TradeAlert | null) ?? null;
  const current = (mx?.price as number | null) ?? null;
  const companyName = (mx?.name as string | null) ?? ticker;
  const subscribed = ((subRows || []) as { setup_id: string }[]).length > 0;
  const thread = (threadRows || []) as AlertEvent[];
  // Related feed rows, minus this setup's own lifecycle steps (shown above).
  const threadIds = new Set(thread.map((t) => t.id));
  const related = ((relatedRows || []) as AlertEvent[]).filter((e) => !threadIds.has(e.id));

  return (
    <SetupDetailClient
      setup={{ ...setup, subscribed }}
      broadcast={broadcast}
      current={current}
      companyName={companyName}
      thread={thread}
      related={related}
      research={research}
    />
  );
}
