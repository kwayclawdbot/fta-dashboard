export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getFamilyContext, getFamilyWatchlist, getVotes } from "@/lib/family/queries";
import WatchlistVote from "@/components/family/WatchlistVote";
import FamilyActivityPing from "@/components/family/FamilyActivityPing";
import Ticker from "@/components/ui/Ticker";
import {
  FamilySurface,
  FamilyMast,
  BackLine,
  FamilyCard,
  SectionLabel,
  Eyebrow,
  TextAction,
  FoundingState,
  XpTag,
} from "@/components/family/canvas";

/**
 * F6 · FAMILY WATCHLIST — board tile "F6 Family Watchlist".
 *
 * Drawn as the board draws it: the masthead, the centred question with its
 * accent underline, the vote constellation, the "cast your vote" roster card,
 * the recently-discussed row, and the warm "tonight" card.
 *
 * One vote per member per night, persisted. The ballot is built from the
 * household's own watchlist, so the household is always voting on names it
 * already cares about rather than on a list somebody else chose.
 *
 * The board prints "Tonight · 7:00 PM" and a "Remind us" button. There is no
 * scheduled-discussion object and no reminder write path, so the card carries
 * the night without a fabricated clock and offers the one real action there is:
 * reading up on the winning pick. The Kai one-pager is described as what it is —
 * a promise about tonight — and no synthetic summary stands in for it.
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
  const winner = [...tally.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;

  // "Recently discussed" — names that have already had their night.
  const discussed = watchlist.filter((w) => w.status === "study" || w.status === "favorite");

  return (
    <FamilySurface className="pb-16">
      <FamilyActivityPing active={!ctx.isParent} />

      <div className="mb-5">
        <BackLine href="/family" label="Family" />
      </div>

      <FamilyMast
        title="Family"
        mark="watchlist"
        lede="Explore. Discuss. Decide together."
      />

      <p className="mt-7 text-center font-display text-[20px] font-extrabold leading-snug text-ink">
        Which company should we learn about{" "}
        <span className="f0-underline-mark">tonight?</span>
      </p>

      <div className="mt-4">
        <WatchlistVote
          familyId={ctx.familyId}
          viewerId={ctx.userId}
          members={ctx.members}
          options={watchlist}
          seed={votes}
          night={night}
        />
      </div>

      {/* ── Recently discussed ───────────────────────────────────────────*/}
      <SectionLabel
        className="mt-6"
        action={<TextAction href="/watchlist">See all</TextAction>}
      >
        Recently discussed
      </SectionLabel>

      {discussed.length === 0 ? (
        <div className="mt-3">
          <FoundingState
            title="No discussion nights behind you yet"
            body="After the first one, every company the family has been through lands here — a running record of what the household actually knows."
          />
        </div>
      ) : (
        <div className="mt-3 flex gap-2">
          {discussed.slice(0, 4).map((w) => (
            <Link
              key={w.id}
              href={`/research/${encodeURIComponent(w.ticker)}`}
              className="f0-focus f0-press min-w-0 flex-1 rounded-xl border border-sand bg-card px-2 py-3 text-center shadow-soft"
            >
              {/* Logo tile (or warm-gold monogram when the company has no
                  branding image) — never the bare first initial. */}
              <span className="flex justify-center">
                <Ticker
                  symbol={w.ticker}
                  variant="logo-only"
                  size="md"
                  tone="family"
                />
              </span>
              <p className="mt-1.5 truncate font-mono text-[10px] text-ink">{w.ticker}</p>
              <p className="mt-1 truncate text-[9px] text-soft">
                {new Date(w.updated_at).toLocaleDateString(undefined, {
                  month: "short",
                  day: "numeric",
                })}
              </p>
            </Link>
          ))}
        </div>
      )}

      {/* ── Tonight ──────────────────────────────────────────────────────*/}
      <FamilyCard tone="warm" className="mt-4">
        <div className="flex items-start gap-3">
          <span className="shrink-0 text-[22px] leading-none" aria-hidden>
            🕖
          </span>
          <div className="min-w-0 flex-1">
            <Eyebrow tone="accent">Tonight</Eyebrow>
            <p className="mt-1 font-display text-[13.5px] font-bold text-ink">
              Family discussion: {winner ? `the winning pick — ${winner}` : "the winning pick"}
            </p>
            <p className="mt-1 text-[11px] leading-relaxed text-soft">
              Kai preps a kid-friendly one-pager an hour before. It is not written yet —
              it will appear here when it is, and nothing stands in for it in the
              meantime. <XpTag amount={20} suffix="" /> each for showing up.
            </p>
            {winner && (
              <div className="mt-2.5">
                <TextAction href={`/research/${encodeURIComponent(winner)}`}>
                  Read up on {winner} first →
                </TextAction>
              </div>
            )}
          </div>
        </div>
      </FamilyCard>
    </FamilySurface>
  );
}
