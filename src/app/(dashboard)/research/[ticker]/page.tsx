import { normalizeSymbol } from "@/lib/market/polygon";
import { getResearchPayload } from "@/lib/research/aggregate";
import { createClient } from "@/lib/supabase/server";
import ContextualWall from "@/components/entitlements/ContextualWall";
import type { KaiReport } from "@/lib/kai/report";
import ResearchClient from "./ResearchClient";

/**
 * /research/[ticker] — server-first shell (Lane 12C speed pass).
 *
 * The aggregate (fundamentals + grades) is fetched on the SERVER and handed to
 * the client component as `initialResearch`, so the hero + scorecard paint on
 * first paint instead of after hydrate → auth chain → client fetch. Auth is
 * already enforced by the (dashboard) layout, so this page composes directly;
 * a failed compose just passes null and the client fetches/degrades honestly.
 * All interactivity (tabs, social, comments, charts, news, Kai) stays in the
 * client — this only pre-seeds the paint-critical payload.
 *
 * The Kai report is seeded here too (canvas v2 L3). It is one indexed RPC and it
 * runs IN PARALLEL with the aggregate, so it costs the page nothing — and it is
 * what lets the Kai Report tab know on first paint whether a report exists.
 * Without the seed the tab would have to guess during the client read, and
 * guessing is exactly how "loading" turned into "empty" the first time round.
 * `reportSeeded` reports whether the READ COMPLETED, which is a different fact
 * from whether a report came back: a completed read that returns nothing is a
 * resolved absence, a failed read is not.
 */
export const dynamic = "force-dynamic";

export default async function TickerResearchPage({
  params,
}: {
  params: Promise<{ ticker: string }>;
}) {
  const { ticker: raw } = await params;
  const ticker = normalizeSymbol(raw) ?? (raw || "").toUpperCase();

  // Research premium-read METER — server-authoritative. Free tier: 3 reads/week,
  // then the "you've used your weekly research passes" wall. Club/FTA unlimited.
  // Idempotent per (user, ticker, week) so re-opening the same name is free.
  const supabase = await createClient();
  const { data: meter } = await supabase.rpc("consume_research_read", {
    p_ticker: ticker,
  });
  if ((meter as { allowed?: boolean } | null)?.allowed === false) {
    return (
      <div className="mx-auto w-full max-w-2xl px-4 py-10">
        <ContextualWall feature="research_unlimited" />
      </div>
    );
  }

  const [initialResearch, kai] = await Promise.all([
    getResearchPayload(ticker).catch(() => null),
    supabase
      .rpc("get_latest_kai_report", { p_ticker: ticker })
      .then(({ data, error }) => ({
        report: error ? null : ((data as KaiReport | null) ?? null),
        seeded: !error,
      }))
      .then((r) => r, () => ({ report: null, seeded: false })),
  ]);

  return (
    <ResearchClient
      initialResearch={initialResearch}
      initialReport={kai.report}
      reportSeeded={kai.seeded}
    />
  );
}
