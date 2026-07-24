import { normalizeSymbol } from "@/lib/market/polygon";
import { getResearchPayload } from "@/lib/research/aggregate";
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
 */
export const dynamic = "force-dynamic";

export default async function TickerResearchPage({
  params,
}: {
  params: Promise<{ ticker: string }>;
}) {
  const { ticker: raw } = await params;
  const ticker = normalizeSymbol(raw) ?? (raw || "").toUpperCase();
  const initialResearch = await getResearchPayload(ticker).catch(() => null);
  return <ResearchClient initialResearch={initialResearch} />;
}
