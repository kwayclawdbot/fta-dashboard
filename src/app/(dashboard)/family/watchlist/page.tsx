export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { SectionRule } from "@/components/f0/parts";
import {
  getFamilyContext,
  getFamilyWatchlist,
  getVotes,
} from "@/lib/family/queries";
import WatchlistVote from "@/components/family/WatchlistVote";
import FamilyActivityPing from "@/components/family/FamilyActivityPing";
import {
  FamilySurface,
  FamilyMast,
  BackLine,
  FoundingState,
  XpTag,
} from "@/components/family/canvas";

/**
 * F6 · FAMILY WATCHLIST — "Which company should we learn about tonight?"
 *
 * One vote per member per night, persisted. The ballot is built from the
 * household's own watchlist, so the household is always voting on names it
 * already cares about rather than on a list somebody else chose.
 *
 * The Kai one-pager is described as what it is — a scheduled promise about
 * tonight — and no synthetic summary is rendered in its place. Writing a
 * "kid-friendly one-pager" the model never produced would be the exact kind of
 * fabricated content this build refuses.
 */
export default async function FamilyWatchlistPage() {
  const db = await createClient();
  const ctx = await getFamilyContext(db);
  if (!ctx) redirect("/dashboard");

  const night = new Date().toISOString().slice(0, 10);
  const [watchlist, votes] = await Promise.all([
    getFamilyWatchlist(db, ctx.familyId),
    getVotes(db, ctx.familyId, night),
  ]);

  const tally = new Map<string, number>();
  for (const v of votes) tally.set(v.ticker, (tally.get(v.ticker) ?? 0) + 1);
  const winner =
    [...tally.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;

  // "Recently discussed" — names that have already had their night.
  const discussed = watchlist.filter((w) => w.status === "study" || w.status === "favorite");

  return (
    <FamilySurface className="pb-16">
      <FamilyActivityPing active={!ctx.isParent} />

      <div className="mb-6">
        <BackLine href="/family" label="Family" />
      </div>

      <FamilyMast
        eyebrow="Family watchlist"
        title="Which company should we"
        mark="learn about"
        markStyle="circle"
        lede="Explore. Discuss. Decide together — one vote each, tonight only."
      />

      <div className="mt-10">
        <WatchlistVote
          familyId={ctx.familyId}
          viewerId={ctx.userId}
          members={ctx.members}
          options={watchlist}
          seed={votes}
          night={night}
        />
      </div>

      {/* ── Tonight ──────────────────────────────────────────────────────*/}
      <section className="mt-14">
        <SectionRule>Tonight</SectionRule>
        <p className="mt-3 font-display text-display-3 font-extrabold text-ink">
          Family discussion: {winner ? `the winning pick — ${winner}` : "the winning pick"}
        </p>
        <p className="mt-2 max-w-lg text-[15px] leading-relaxed text-soft">
          Kai preps a kid-friendly one-pager an hour before the discussion. It is
          not written yet — it will appear here when it is, and nothing stands in
          for it in the meantime. <XpTag amount={20} /> each for showing up.
        </p>
        {winner && (
          <p className="mt-4">
            <Link
              href={`/research/${encodeURIComponent(winner)}`}
              className="f0-focus f0-press inline-flex items-center gap-1.5 font-display text-[14px] font-bold text-gold-700"
            >
              Read up on {winner} first →
            </Link>
          </p>
        )}
      </section>

      {/* ── Recently discussed ───────────────────────────────────────────*/}
      <section className="mt-12">
        <SectionRule>Recently discussed</SectionRule>
        {discussed.length === 0 ? (
          <div className="mt-5">
            <FoundingState
              title="No discussion nights behind you yet"
              body="After the first one, every company the family has been through lands here — a running record of what the household actually knows."
            />
          </div>
        ) : (
          <div className="f0-ledger mt-2">
            {discussed.map((w) => (
              <Link
                key={w.id}
                href={`/research/${encodeURIComponent(w.ticker)}`}
                className="f0-ledger-row f0-focus justify-between"
              >
                <div className="min-w-0 flex-1">
                  <p className="font-display text-[15px] font-bold text-ink">{w.ticker}</p>
                  <p className="mt-0.5 truncate text-[13px] text-soft">{w.company_name}</p>
                </div>
                <span className="shrink-0 self-center text-[13px] text-soft">
                  {new Date(w.updated_at).toLocaleDateString(undefined, {
                    month: "short",
                    day: "numeric",
                  })}
                </span>
              </Link>
            ))}
          </div>
        )}
      </section>
    </FamilySurface>
  );
}
