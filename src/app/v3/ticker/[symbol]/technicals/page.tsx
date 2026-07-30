import { notFound } from "next/navigation";
import { getTickerTechnicals, normalizeTicker } from "@/ui-v3/ticker-data";
import TickerTechnicalsScreen from "@/ui-v3/components/ticker/TickerTechnicalsScreen";

/** /v3/ticker/[symbol]/technicals — "12 Ticker Technicals". */
export const dynamic = "force-dynamic";

export default async function V3TickerTechnicalsPage({
  params,
}: {
  params: Promise<{ symbol: string }>;
}) {
  const { symbol: raw } = await params;
  const symbol = normalizeTicker(raw);
  if (!symbol) notFound();

  const model = await getTickerTechnicals(symbol);
  if (!model) notFound();

  return <TickerTechnicalsScreen model={model} />;
}
