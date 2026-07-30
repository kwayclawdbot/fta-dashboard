import { notFound } from "next/navigation";
import { getTickerKai, normalizeTicker } from "@/ui-v3/ticker-data";
import TickerKaiScreen from "@/ui-v3/components/ticker/TickerKaiScreen";

/** /v3/ticker/[symbol]/kai — "14 Kai Report". */
export const dynamic = "force-dynamic";

export default async function V3TickerKaiPage({
  params,
}: {
  params: Promise<{ symbol: string }>;
}) {
  const { symbol: raw } = await params;
  const symbol = normalizeTicker(raw);
  if (!symbol) notFound();

  const model = await getTickerKai(symbol);
  if (!model) notFound();

  return <TickerKaiScreen model={model} />;
}
