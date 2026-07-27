import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import ChallengeShell from "@/components/challenge/ChallengeShell";
import FirstWinBoard from "@/components/challenge/FirstWinBoard";
import { fetchChallengeState, joinChallenge } from "@/lib/challenge/state";

export const dynamic = "force-dynamic";

/**
 * /challenge/first-win — DAY 0, the completed artifact inside thirty minutes.
 *
 * Suggestions come from `screener_metrics` (the real table the screener reads),
 * biased to household names so the "a company from your own life" framing lands.
 * A ticker with no metrics row still posts fine — `changePct: null` renders "—",
 * never a fabricated 0.00%.
 */
const SEEDS = ["AAPL", "NVDA", "AMZN", "NFLX", "MSFT", "TSLA", "DIS", "NKE", "SBUX"];

export default async function ChallengeFirstWinPage() {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth?.user) redirect("/login?next=/challenge/first-win");

  await joinChallenge(supabase);
  const state = await fetchChallengeState(supabase);
  if (!state) redirect("/dashboard");

  // The 24h boundary is measured from the SERVER's clock (state.now), never
  // from this process's — same authority the whole journey runs on.
  const since = new Date(new Date(state.now).getTime() - 86_400_000).toISOString();

  const [{ data: metrics }, { count }] = await Promise.all([
    supabase
      .from("screener_metrics")
      .select("ticker, name, price, chg_1d")
      .in("ticker", SEEDS),
    supabase
      .from("challenge_artifacts")
      .select("id", { count: "exact", head: true })
      .eq("day_no", 0)
      .gte("created_at", since),
  ]);

  const byTicker = new Map(
    (metrics || []).map((m: { ticker: string; name: string | null; price: number | null; chg_1d: number | null }) => [
      m.ticker.toUpperCase(),
      m,
    ])
  );
  const suggestions = SEEDS.map((t) => {
    const m = byTicker.get(t);
    return {
      ticker: t,
      name: m?.name ?? null,
      price: m?.price ?? null,
      // null (not 0) when we have no reading — TickerTile renders "—".
      chg: m?.chg_1d ?? null,
    };
  });

  return (
    <ChallengeShell back="/challenge/questions" backLabel="Questions">
      <FirstWinBoard
        state={state}
        suggestions={suggestions}
        todayCount={count ?? null}
      />
    </ChallengeShell>
  );
}
