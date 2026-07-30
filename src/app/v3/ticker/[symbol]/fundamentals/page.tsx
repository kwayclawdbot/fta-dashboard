import { notFound } from "next/navigation";
import { getTickerFundamentals, normalizeTicker } from "@/ui-v3/ticker-data";
import TickerFundamentalsScreen from "@/ui-v3/components/ticker/TickerFundamentalsScreen";

/** /v3/ticker/[symbol]/fundamentals — "13 Ticker Fundamentals". */
export const dynamic = "force-dynamic";

export default async function V3TickerFundamentalsPage({
  params,
}: {
  params: Promise<{ symbol: string }>;
}) {
  const { symbol: raw } = await params;
  const symbol = normalizeTicker(raw);
  if (!symbol) notFound();

  const model = await getTickerFundamentals(symbol);
  if (!model) notFound();

  return <TickerFundamentalsScreen model={model} />;
}
