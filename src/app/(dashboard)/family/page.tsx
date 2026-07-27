export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { SectionRule } from "@/components/f0/parts";
import { TickerTile, TickerTileStrip } from "@/components/canvas2";
import Avatar from "@/components/Avatar";
import { beltForXp } from "@/lib/belts";
import { levelForXp, levelProgress } from "@/lib/xp";
import {
  getFamilyContext,
  getPaperStandings,
  getBenchmarkReturn,
  getFamilyWatchlist,
  getWeeklyXp,
} from "@/lib/family/queries";
import {
  FamilySurface,
  FamilyMast,
  FamilyLink,
  FoundingState,
  AbsenceNote,
  Bar,
  XpTag,
  pct,
  priceTone,
} from "@/components/family/canvas";
import FamilyActivityPing from "@/components/family/FamilyActivityPing";

/**
 * F1 · FAMILY HOME — .planning/design-project-v2/"Cheat Code Family.dc.html".
 *
 * A supervised layer on the same brand: the belts and streaks still work, so
 * learning still feels like winning. Server-rendered end to end — the family
 * arrives with its household, its challenge and its watchlist already resolved,
 * so there is no window in which a real family sees the founding state (§0.4).
 *
 * Every screen in this lane carries a designed below-floor state (§0.5). The
 * canvas draws a household at week 30 with three funded paper accounts; a real
 * one on day one has none of that, and each section here says so in its own
 * voice rather than printing a row of zeroes.
 */
export default async function FamilyHomePage() {
  const db = await createClient();
  const ctx = await getFamilyContext(db);
  if (!ctx) redirect("/dashboard");

  const [standings, benchmark, watchlist, weeklyXp] = await Promise.all([
    getPaperStandings(db, ctx.familyId),
    getBenchmarkReturn(db),
    getFamilyWatchlist(db, ctx.familyId),
    getWeeklyXp(db, ctx.members.map((m) => m.id)),
  ]);

  const familyLevel = levelForXp(ctx.familyXp);
  const progress = levelProgress(ctx.familyXp);

  // Only members who actually have a paper account can be in the challenge.
  const inChallenge = standings.filter((s) => s.return_pct != null);
  const leader = inChallenge[0] ?? null;

  const greeting = ctx.familyName ? `GM, ${ctx.familyName}` : "GM";

  return (
    <FamilySurface className="pb-16">
      <FamilyActivityPing active={!ctx.isParent} />

      <FamilyMast
        eyebrow="Family Mode"
        title={greeting}
        lede="Everyone's learning. Nobody's margin-called."
      />

      {/* ── Family level ─────────────────────────────────────────────────
          One ladder, shared. The XP is the same xp_events every member already
          earns — no separate family currency was invented for this screen. */}
      <section className="mt-10">
        <SectionRule>Family level</SectionRule>
        <div className="mt-4 flex flex-wrap items-end justify-between gap-4">
          <div className="min-w-0">
            <p className="font-display text-display-2 font-extrabold text-ink">
              Level {familyLevel.level} · {familyLevel.name}
            </p>
            <p className="mt-1 text-[13px] text-soft">
              {ctx.familyXp.toLocaleString()} XP together
              {progress.next && (
                <> · {progress.toNext.toLocaleString()} XP to Level {progress.next.level}</>
              )}
            </p>
          </div>
          <XpTag amount={weeklyXp} prefix="+" className="shrink-0" />
        </div>
        <div className="mt-4">
          <Bar pct={progress.pct} />
        </div>
      </section>

      {/* ── The household ────────────────────────────────────────────────
          A ledger of people, not a grid of avatar cards. Supervised members
          carry a PAPER mark and lead to their own account. */}
      <section className="mt-12">
        <SectionRule>The household</SectionRule>
        <div className="f0-ledger mt-2">
          {ctx.members.map((m) => {
            const belt = beltForXp(m.xp);
            const isKid = m.role === "child";
            const body = (
              <>
                <Avatar
                  name={m.display_name}
                  avatarUrl={m.avatar_url}
                  role={m.role}
                  xp={m.xp}
                  size="md"
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-display text-[15px] font-bold text-ink">
                    {m.display_name || "Member"}
                    {isKid && (
                      <span className="ml-2 align-middle text-eyebrow font-display font-bold uppercase tracking-[0.1em] text-gold-700">
                        Paper
                      </span>
                    )}
                  </p>
                  <p className="mt-0.5 text-[13px] text-soft">
                    {belt.label} · {m.role === "parent" ? "Admin" : "Member"}
                  </p>
                </div>
                <span className="shrink-0 self-center font-display text-[13px] font-bold tabular-nums text-soft">
                  {m.xp.toLocaleString()} XP
                </span>
              </>
            );

            return isKid ? (
              <Link key={m.id} href={`/family/teen/${m.id}`} className="f0-ledger-row f0-focus">
                {body}
              </Link>
            ) : (
              <div key={m.id} className="f0-ledger-row">
                {body}
              </div>
            );
          })}
        </div>
      </section>

      {/* ── The family challenge ─────────────────────────────────────────
          Stakes that are not money. The prize is Friday dinner. */}
      <section className="mt-12">
        <SectionRule>Family challenge</SectionRule>
        <p className="mt-3 font-display text-display-3 font-extrabold text-ink">
          Beat the S&amp;P — paper portfolios only
        </p>
        <p className="mt-1.5 text-[15px] leading-relaxed text-soft">
          Nobody is risking a cent. The winner picks Friday dinner.
        </p>

        {inChallenge.length === 0 ? (
          <div className="mt-6">
            <FoundingState
              title="Nobody has opened a paper account yet"
              body="The challenge starts the moment two of you have one. Practice money only, no real money anywhere near it — then the standings fill in on their own."
              action={
                <Link
                  href="/simulator"
                  className="f0-focus f0-press inline-flex items-center gap-1.5 font-display text-[14px] font-bold text-gold-700"
                >
                  Open a paper account →
                </Link>
              }
            />
          </div>
        ) : (
          <>
            <div className="f0-ledger mt-5">
              {inChallenge.map((s, i) => (
                <div key={s.user_id} className="f0-ledger-row">
                  <span className="w-5 shrink-0 self-center font-display text-[13px] font-bold tabular-nums text-soft">
                    {i + 1}
                  </span>
                  <Avatar
                    name={s.display_name}
                    avatarUrl={s.avatar_url}
                    role={s.role}
                    size="sm"
                  />
                  <p className="min-w-0 flex-1 self-center truncate font-display text-[15px] font-bold text-ink">
                    {s.display_name || "Member"}
                  </p>
                  <span
                    className={`shrink-0 self-center font-display text-[15px] font-extrabold tabular-nums ${
                      priceTone(s.return_pct) === "price-up" ? "text-price-up" : "text-price-down"
                    }`}
                  >
                    {pct(s.return_pct)}
                  </span>
                </div>
              ))}
              <div className="f0-ledger-row">
                <span className="w-5 shrink-0" aria-hidden />
                <p className="min-w-0 flex-1 self-center font-display text-[15px] font-bold text-soft">
                  S&amp;P 500
                </p>
                <span
                  className={`shrink-0 self-center font-display text-[15px] font-extrabold tabular-nums ${
                    benchmark == null
                      ? "text-soft"
                      : benchmark >= 0
                        ? "text-price-up"
                        : "text-price-down"
                  }`}
                >
                  {pct(benchmark)}
                </span>
              </div>
            </div>

            {benchmark == null && (
              <AbsenceNote>
                No S&amp;P reading yet — the index close cache has nothing to
                compare this week against, so the benchmark stays blank rather
                than showing a number we did not measure.
              </AbsenceNote>
            )}

            {leader?.display_name && (
              <p className="mt-4 text-[15px] text-soft">
                <span className="font-display font-bold text-ink">{leader.display_name}</span>{" "}
                leads — winner picks Friday dinner. <XpTag amount={50} />
              </p>
            )}
          </>
        )}
      </section>

      {/* ── Watching together ────────────────────────────────────────────
          The household watchlist as identity tiles. Deltas are honestly absent:
          nothing in this lane quotes a live price, so every tile reads "—"
          rather than a fabricated 0.00%. */}
      <section className="mt-12">
        <SectionRule
          action={
            <Link
              href="/family/watchlist"
              className="f0-focus f0-press font-display text-[13px] font-bold text-gold-700"
            >
              Vote tonight →
            </Link>
          }
        >
          Watching together
        </SectionRule>

        {watchlist.length === 0 ? (
          <div className="mt-5">
            <FoundingState
              title="Nothing on the family watchlist yet"
              body="Start with a company somebody in the house already loves — the shoes they wear, the console they play on. One name is enough to run a whole discussion night."
              action={
                <Link
                  href="/family/watchlist"
                  className="f0-focus f0-press inline-flex items-center gap-1.5 font-display text-[14px] font-bold text-gold-700"
                >
                  Add the first company →
                </Link>
              }
            />
          </div>
        ) : (
          <>
            <div className="mt-5">
              <TickerTileStrip minSlots={4}>
                {watchlist.slice(0, 6).map((w) => (
                  <TickerTile
                    key={w.id}
                    ticker={w.ticker}
                    changePct={null}
                    href={`/research/${encodeURIComponent(w.ticker)}`}
                  />
                ))}
              </TickerTileStrip>
            </div>
            <p className="mt-4 text-[13px] text-soft">
              {watchlist.length} {watchlist.length === 1 ? "company" : "companies"} the family
              is following.
            </p>
          </>
        )}
      </section>

      {/* ── Everything else in Family Mode ───────────────────────────────
          In-page destinations so every family surface is reachable while the
          shell nav is wired separately. */}
      <section className="mt-12">
        <SectionRule>Family Mode</SectionRule>
        <div className="f0-ledger mt-2">
          <FamilyLink
            href="/family/circle"
            label="Family Circle"
            sub="The private household thread — never expires"
          />
          <FamilyLink
            href="/family/learn"
            label="Family Learn"
            sub="Build skills. Build confidence. Build wealth."
          />
          <FamilyLink
            href="/family/watchlist"
            label="Family watchlist"
            sub="Which company should we learn about tonight?"
          />
          <FamilyLink
            href="/family/live"
            label="Family live class"
            sub="Classes for the whole household"
          />
          {ctx.isParent && (
            <FamilyLink
              href="/family/corner"
              label="Parent Corner"
              sub="Conversation starters, age-banded tips, family missions"
            />
          )}
          <FamilyLink
            href="/family/overview"
            label="Progress & report cards"
            sub="Lessons, streaks and per-member progress"
          />
        </div>
      </section>
    </FamilySurface>
  );
}
