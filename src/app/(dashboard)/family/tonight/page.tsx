export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  getFamilyContext,
  getFamilyWatchlist,
  getVotes,
  getWatchlistResearch,
} from "@/lib/family/queries";
import { getResearchPayload } from "@/lib/research/aggregate";
import { familyNightQuestions, ONE_PAGER_QUESTION } from "@/lib/family/parent-corner";
import { FAMILY_NIGHT_XP, familyNightRef } from "@/lib/family/night";
import FamilyNight, { type NightBrief, type NightNumber } from "@/components/family/FamilyNight";
import FamilyActivityPing from "@/components/family/FamilyActivityPing";
import { FamilySurface, FamilyMast, BackLine } from "@/components/family/canvas";

/**
 * RUN FAMILY NIGHT — the whole evening on one route.
 *
 * Everything the flow needs is resolved HERE, on the server, before any markup
 * exists: tonight's votes and their winner, the one-pager for that winner, the
 * four questions, and who has already been paid for tonight. The stepper is a
 * client component only because stepping is interaction — it never fetches its
 * own data, so there is no moment where a household with a decided pick sees
 * the "no vote yet" state (the defect this codebase keeps rediscovering).
 *
 * THE CLOCK IS READ ONCE, ON THIS LINE, ON THE SERVER. `night` is passed down
 * and used as the vote key, the XP ref and the transcript key, so every write
 * tonight agrees about which night it is. No component below calls Date.now().
 */
export default async function FamilyTonightPage() {
  const db = await createClient();
  const ctx = await getFamilyContext(db);
  if (!ctx) redirect("/dashboard");

  const night = new Date().toISOString().slice(0, 10);
  const nightLabel = new Date(`${night}T12:00:00`).toLocaleDateString(undefined, {
    weekday: "long",
    month: "short",
    day: "numeric",
  });

  const [watchlist, votes] = await Promise.all([
    getFamilyWatchlist(db, ctx.familyId),
    getVotes(db, ctx.familyId, night),
  ]);

  // Same tally + winner logic /family/watchlist uses — one definition of who won.
  const tally = new Map<string, number>();
  for (const v of votes) tally.set(v.ticker, (tally.get(v.ticker) ?? 0) + 1);
  const winner = [...tally.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;

  const brief = winner ? await buildBrief(db, ctx.familyId, winner, watchlist) : null;

  // Who has already been paid for tonight. The ledger of record is xp_events
  // itself — the same rows the API writes — so re-opening the flow shows the
  // truth rather than offering to pay somebody twice.
  const ref = familyNightRef(night);
  const { data: paidRows } = await db
    .from("xp_events")
    .select("user_id")
    .in("user_id", ctx.members.map((m) => m.id))
    .eq("kind", "community")
    .eq("ref_id", ref);
  const alreadyPaid = [
    ...new Set(((paidRows ?? []) as { user_id: string }[]).map((r) => r.user_id)),
  ];

  // The questions are tuned to the youngest supervised member in the house —
  // the level everyone can follow. With no kids on the account it falls back to
  // the middle band rather than assuming an adults-only table.
  const youngest = ctx.kids.find((k) => k.age_group === "kids") ?? ctx.kids[0] ?? null;
  const questions = familyNightQuestions(youngest?.age_group ?? null);

  return (
    <FamilySurface className="pb-16">
      <FamilyActivityPing active={!ctx.isParent} />

      <div className="mb-5">
        <BackLine href="/family" label="Family" />
      </div>

      <FamilyMast
        eyebrow="Family Mode"
        title="Run family"
        mark="night"
        lede="One pick, one page, four questions, and everybody who showed up gets credit for it."
      />

      <FamilyNight
        familyId={ctx.familyId}
        viewerId={ctx.userId}
        isParent={ctx.isParent}
        night={night}
        nightLabel={nightLabel}
        members={ctx.members}
        options={watchlist}
        seedVotes={votes}
        brief={brief}
        questions={questions}
        xpPerAttendee={FAMILY_NIGHT_XP}
        alreadyPaid={alreadyPaid}
      />
    </FamilySurface>
  );
}

/* ── The one-pager ────────────────────────────────────────────────────────
   Built in this order, and the order is the point:

   1. The HOUSEHOLD'S own words. If somebody in the house has already written
      "how they make money" on the research card, that beats anything a vendor
      can hand us — it is at the family's level by construction and it is the
      thing the kids helped write.
   2. Failing that, the company's own description from the research aggregate.
   3. Two REAL numbers, and only ones that are genuinely non-price: what the
      business took in, what it kept, how many people it employs. A price or a
      market cap would be both a minor-facing quote and the least interesting
      fact about a company at a kitchen table.

   Anything absent is NAMED, never substituted. There is no placeholder path
   through this function: a missing figure produces a line in `missing`, and a
   missing description produces `plain: null`, which the flow renders as a
   founding state with the way in to writing one. */
async function buildBrief(
  db: Awaited<ReturnType<typeof createClient>>,
  familyId: string,
  ticker: string,
  watchlist: { ticker: string; company_name: string }[]
): Promise<NightBrief> {
  const [card, payload] = await Promise.all([
    getWatchlistResearch(db, familyId, ticker),
    // The aggregate requires a normalized symbol from its caller.
    getResearchPayload(ticker.trim().toUpperCase()).catch(() => null),
  ]);

  const companyName =
    card?.company_name ||
    payload?.company.name ||
    watchlist.find((w) => w.ticker === ticker)?.company_name ||
    ticker;

  const household = [card?.how_they_make_money, card?.what_they_sell]
    .map((s) => (s ?? "").trim())
    .find((s) => s.length > 0);

  const description = (payload?.company.description ?? "").trim();

  const plain = household || description || null;
  const plainSource: NightBrief["plainSource"] = household
    ? "household"
    : description
      ? "market"
      : null;

  // Most recent full year the aggregate holds. Sorted by its own label rather
  // than trusting an array order this file does not own.
  const annual = [...(payload?.charts.annual ?? [])].sort((a, b) =>
    String(b.label).localeCompare(String(a.label))
  );
  const year = annual[0] ?? null;

  const candidates: { number: NightNumber | null; missing: string }[] = [
    {
      number:
        year && year.revenue != null
          ? {
              label: `Money customers paid them in ${year.label}`,
              value: compactMoney(year.revenue),
            }
          : null,
      missing: "what it took in last year",
    },
    {
      number:
        year && year.netIncome != null
          ? {
              label: `What was left after paying for everything (${year.label})`,
              value: compactMoney(year.netIncome),
            }
          : null,
      missing: "what it kept as profit",
    },
    {
      number:
        payload?.company.employees != null
          ? {
              label: "People who work there",
              value: Number(payload.company.employees).toLocaleString(),
            }
          : null,
      missing: "how many people work there",
    },
  ];

  const numbers = candidates
    .map((c) => c.number)
    .filter((n): n is NightNumber => n != null)
    .slice(0, 2);

  // Only name what is missing while there is still room for it — once two
  // numbers are on the page, a third absence is noise rather than honesty.
  const missing = numbers.length >= 2 ? [] : candidates.filter((c) => !c.number).map((c) => c.missing);

  return {
    ticker,
    companyName,
    plain,
    plainSource,
    numbers,
    missing,
    question: ONE_PAGER_QUESTION,
  };
}

/** 1.23e10 → "$12.3B". Business scale, never a share price. */
function compactMoney(n: number): string {
  const abs = Math.abs(n);
  const sign = n < 0 ? "−" : "";
  if (abs >= 1e12) return `${sign}$${(abs / 1e12).toFixed(1)}T`;
  if (abs >= 1e9) return `${sign}$${(abs / 1e9).toFixed(1)}B`;
  if (abs >= 1e6) return `${sign}$${(abs / 1e6).toFixed(1)}M`;
  return `${sign}$${Math.round(abs).toLocaleString()}`;
}
