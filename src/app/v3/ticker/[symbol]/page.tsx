import { notFound } from "next/navigation";
import { getTickerOverview, normalizeRange, normalizeTicker } from "@/ui-v3/ticker-data";
import TickerOverviewScreen from "@/ui-v3/components/ticker/TickerOverviewScreen";

/**
 * /v3/ticker/[symbol] — "03 Ticker NVDA", the overview tab.
 *
 * All data access happens in getTickerOverview(); the screen is pure
 * presentation. A malformed symbol 404s before a query runs, and an unknown one
 * 404s the moment the data layer answers with nothing — both land on the v3
 * not-found page, which keeps the member inside v3.
 *
 * `?r=` selects the chart range. It is a search param rather than client state
 * because the series is a server read either way, and a range a member picked
 * should survive a share or a reload.
 */
export const dynamic = "force-dynamic";

export default async function V3TickerPage({
  params,
  searchParams,
}: {
  params: Promise<{ symbol: string }>;
  searchParams: Promise<{ r?: string }>;
}) {
  const { symbol: raw } = await params;
  const { r } = await searchParams;

  const symbol = normalizeTicker(raw);
  if (!symbol) notFound();

  const model = await getTickerOverview(symbol, normalizeRange(r));
  if (!model) notFound();

  return <TickerOverviewScreen model={model} />;
}
