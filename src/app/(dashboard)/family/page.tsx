export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import Avatar from "@/components/Avatar";
import { beltForXp } from "@/lib/belts";
import { levelForXp, levelProgress } from "@/lib/xp";
import {
  getFamilyContext,
  getPaperStandings,
  getBenchmarkReturn,
  getFamilyWatchlist,
  getWeeklyXp,
  getGuardrailsForKids,
  type FamilyMember,
} from "@/lib/family/queries";
import { guardrailSummary } from "@/lib/family/guardrails";
import { ageGroupLabel } from "@/lib/age-label";
import {
  FamilySurface,
  FamilyMast,
  FamilyCard,
  RowCard,
  Row,
  FamilyLink,
  SectionLabel,
  Eyebrow,
  Chip,
  Bar,
  XpTag,
  KaiNote,
  TextAction,
  FoundingState,
  AbsenceNote,
  pct,
} from "@/components/family/canvas";
import FamilyActivityPing from "@/components/family/FamilyActivityPing";

/**
 * F1 · FAMILY HOME — board tile "F1 Family Home".
 *
 * Built exactly as drawn: the greeting, the family-level card with its bar and
 * its "to next level" line, the household as a row of ringed avatar orbs (the
 * teen carrying the PAPER tag), the warm family-challenge card with one bar per
 * member and the benchmark beneath them, the "Watching together" cards, and the
 * Kai note.
 *
 * Server-rendered end to end — the family arrives with its household, challenge
 * and watchlist already resolved, so there is no window in which a real family
 * sees the founding state.
 *
 * WHAT THE BOARD DRAWS THAT IS NOT INVENTED HERE: "Week 30", "3d left" and the
 * "126 families" scale. There is no challenge-week object and no countdown in
 * this schema, so the card carries the challenge without a fabricated clock.
 */
export default async function FamilyHomePage() {
  const db = await createClient();
  const ctx = await getFamilyContext(db);
  if (!ctx) redirect("/dashboard");

  const [standings, benchmark, watchlist, weeklyXp, guardrails] = await Promise.all([
    getPaperStandings(db, ctx.familyId),
    getBenchmarkReturn(db),
    getFamilyWatchlist(db, ctx.familyId),
    getWeeklyXp(db, ctx.members.map((m) => m.id)),
    // Batched with everything else the page already waits on, so making the
    // guardrails visible costs no extra round trip in the critical path.
    getGuardrailsForKids(db, ctx.familyId, ctx.kids.map((k) => k.id)),
  ]);

  const familyLevel = levelForXp(ctx.familyXp);
  const progress = levelProgress(ctx.familyXp);

  // Only members who actually have a paper account can be in the challenge.
  const inChallenge = standings.filter((s) => s.return_pct != null);
  const leader = inChallenge[0] ?? null;
  const best = Math.max(1, ...inChallenge.map((s) => Math.abs(s.return_pct ?? 0)));

  const greeting = ctx.familyName ? `GM, ${ctx.familyName}` : "GM";

  return (
    <FamilySurface className="pb-16">
      <FamilyActivityPing active={!ctx.isParent} />

      <FamilyMast
        eyebrow="Family Mode"
        title={greeting}
        lede="Everyone's learning. Nobody's margin-called."
        aside={<Chip tone="accent">🛡 Family</Chip>}
      />

      {/* ── Run family night ─────────────────────────────────────────────
          THE ONE ACTION ON THIS PAGE. Everything else here is a reading —
          levels, standings, a watchlist — and a household that only reads
          never actually sits down together. Family night was already possible
          in four separate errands (vote, research, find questions, and then
          nothing at all for attendance because no write path existed for it);
          /family/tonight is that evening as one flow, and it pays the XP the
          watchlist card has been promising. It sits above the ladder because
          doing the thing outranks looking at the score for it. */}
      <Link
        href="/family/tonight"
        className="f0-focus f0-press mt-6 block rounded-xl"
        aria-label="Run family night"
      >
        <FamilyCard tone="lead">
          <div className="flex items-center gap-4">
            <span className="shrink-0 text-[26px] leading-none" aria-hidden>
              🕖
            </span>
            <div className="min-w-0 flex-1">
              <Eyebrow tone="accent">Tonight</Eyebrow>
              <p className="mt-1 font-display text-[19px] font-extrabold leading-snug text-ink">
                Run family night
              </p>
              <p className="mt-1 text-[12px] leading-relaxed text-soft">
                One pick, one page in plain English, four questions — then
                everybody who showed up gets the credit for it.
              </p>
            </div>
            <span
              aria-hidden
              className="shrink-0 font-mono text-[13px] font-bold text-gold-700"
            >
              &rarr;
            </span>
          </div>
        </FamilyCard>
      </Link>

      {/* ── Family level ─────────────────────────────────────────────────
          One ladder, shared. The XP is the same xp_events every member already
          earns — no separate family currency was invented for this screen. */}
      <FamilyCard className="mt-6">
        <div className="flex items-baseline justify-between gap-3">
          <Eyebrow tone="accent">
            Family level {familyLevel.level} · {familyLevel.name}
          </Eyebrow>
          <XpTag amount={weeklyXp} className="shrink-0" suffix=" XP this week" />
        </div>
        <Bar pct={progress.pct} className="mt-3" />
        <div className="mt-2 flex items-baseline justify-between gap-3 text-[11px] text-soft">
          <span className="font-mono tabular-nums">
            {ctx.familyXp.toLocaleString()}
            {progress.next ? ` / ${progress.next.min.toLocaleString()}` : ""} XP
          </span>
          {progress.next && (
            <span className="font-mono font-bold tabular-nums text-gold-700">
              {progress.toNext.toLocaleString()} XP to Level {progress.next.level}
            </span>
          )}
        </div>
      </FamilyCard>

      {/* ── The household ────────────────────────────────────────────────
          The board's orb row: a belt-ringed avatar per member, the supervised
          one marked PAPER, each with their name, belt and lifetime XP. */}
      <div className="mt-5 flex flex-wrap gap-4">
        {ctx.members.map((m) => (
          <MemberOrb key={m.id} member={m} />
        ))}
      </div>

      {/* ── What each supervised member is fenced by ─────────────────────
          The guardrails were REAL but INVISIBLE: they were only legible after
          two taps into /family/teen/<id>/guardrails, so the parent who set
          them up in onboarding had no way to confirm from the household screen
          that anything was actually on. This states the live settings — read
          for the whole roster in ONE query and merged with the documented
          defaults, so a child with no row yet shows what is genuinely enforced
          rather than a blank.

          Every chip is a true statement (see guardrailSummary): downtime prints
          its window ONLY when it is enabled, and says so plainly when it is
          not. A reassuring line that is not backed by a setting is worse than
          no line at all. */}
      {ctx.kids.length > 0 && (
        <>
          <SectionLabel className="mt-6">Guardrails</SectionLabel>
          <RowCard className="mt-3">
            {ctx.kids.map((k) => {
              const g = guardrails.get(k.id);
              return (
                <Row
                  key={k.id}
                  icon="🛡"
                  label={k.display_name || "Member"}
                  right={
                    ctx.isParent ? (
                      <TextAction href={`/family/teen/${k.id}/guardrails`}>
                        Change
                      </TextAction>
                    ) : undefined
                  }
                >
                  <div className="mt-1.5 flex flex-wrap gap-1.5">
                    {(g ? guardrailSummary(g) : []).map((s) => (
                      <Chip key={s}>{s}</Chip>
                    ))}
                  </div>
                </Row>
              );
            })}
          </RowCard>
        </>
      )}

      {/* ── The family challenge ─────────────────────────────────────────
          Stakes that are not money. The prize is Friday dinner. */}
      <FamilyCard tone="warm" className="mt-6">
        <div className="flex items-baseline justify-between gap-3">
          <Eyebrow tone="accent">Family challenge</Eyebrow>
          <Chip tone="accent">Win = ⚡ +50</Chip>
        </div>
        <p className="mt-2 font-display text-[17px] font-extrabold text-ink">
          Beat the S&amp;P — paper portfolios only
        </p>

        {inChallenge.length === 0 ? (
          <div className="mt-4">
            <FoundingState
              title="Nobody has opened a paper account yet"
              body="The challenge starts the moment two of you have one. Practice money only, no real money anywhere near it — then the standings fill in on their own."
              action={<TextAction href="/simulator">Open a paper account →</TextAction>}
            />
          </div>
        ) : (
          <>
            <div className="mt-4 flex flex-col gap-2">
              {inChallenge.map((s) => (
                <div key={s.user_id} className="flex items-center gap-3">
                  <span className="w-14 shrink-0 truncate text-[12px] font-display font-bold text-ink">
                    {s.display_name || "Member"}
                  </span>
                  <Bar
                    pct={(Math.abs(s.return_pct ?? 0) / best) * 100}
                    height={9}
                    className="flex-1"
                  />
                  <span
                    className={`w-14 shrink-0 text-right font-mono text-[11px] font-semibold tabular-nums ${
                      (s.return_pct ?? 0) >= 0 ? "text-price-up" : "text-price-down"
                    }`}
                  >
                    {pct(s.return_pct)}
                  </span>
                </div>
              ))}

              <div className="flex items-center gap-3 opacity-75">
                <span className="w-14 shrink-0 text-[12px] font-display font-bold text-soft">
                  S&amp;P
                </span>
                <div className="h-[9px] flex-1 overflow-hidden rounded-full bg-sand">
                  {benchmark != null && (
                    <div
                      className="h-full rounded-full bg-soft/60"
                      style={{
                        width: `${Math.min(100, (Math.abs(benchmark) / best) * 100)}%`,
                      }}
                    />
                  )}
                </div>
                <span className="w-14 shrink-0 text-right font-mono text-[11px] tabular-nums text-soft">
                  {pct(benchmark)}
                </span>
              </div>
            </div>

            {benchmark == null && (
              <AbsenceNote>
                No S&amp;P reading yet — we don&apos;t have this week&apos;s
                index close to compare against, so the benchmark stays blank
                rather than showing a number we did not measure.
              </AbsenceNote>
            )}

            {leader?.display_name && (
              <p className="mt-3 text-[11.5px] text-soft">
                🏆 <span className="font-display font-bold text-ink">{leader.display_name}</span>{" "}
                leads — winner picks Friday dinner.
              </p>
            )}
          </>
        )}
      </FamilyCard>

      {/* ── Watching together ────────────────────────────────────────────
          The household watchlist as the board's row cards.

          NO TRAILING DASH. This lane quotes no live price, so every row used to
          end in "—" and the section read as a column of failures. But a dash is
          for "we measured and got nothing"; here nothing was ever measured, and
          the honest thing is to say so ONCE, under the list, instead of six
          times inside it. Each row now ends in the way IN to the price — the
          research page it already links to. */}
      <SectionLabel
        className="mt-7"
        action={<TextAction href="/family/watchlist">Edit</TextAction>}
      >
        Watching together
      </SectionLabel>

      {watchlist.length === 0 ? (
        <div className="mt-3">
          <FoundingState
            title="Nothing on the family watchlist yet"
            body="Start with a company somebody in the house already loves — the shoes they wear, the console they play on. One name is enough to run a whole discussion night."
            action={
              <TextAction href="/family/watchlist">Add the first company →</TextAction>
            }
          />
        </div>
      ) : (
        <div className="mt-3 flex flex-col gap-2">
          {watchlist.slice(0, 6).map((w) => (
            <Link
              key={w.id}
              href={`/research/${encodeURIComponent(w.ticker)}`}
              className="f0-focus f0-press flex items-center gap-3 rounded-xl border border-sand bg-card px-3 py-2.5 shadow-soft"
            >
              <span className="f0-tile-field grid h-7 w-7 shrink-0 place-items-center rounded-lg font-display text-[12px] font-black">
                {w.ticker.slice(0, 1)}
              </span>
              <span className="shrink-0 font-mono text-[12px] font-semibold text-ink">
                {w.ticker}
              </span>
              <span className="min-w-0 flex-1 truncate text-[11.5px] text-soft">
                {w.company_name}
              </span>
              <span
                aria-hidden
                className="shrink-0 font-mono text-[11px] font-semibold text-soft/70"
              >
                &rarr;
              </span>
            </Link>
          ))}
          <p className="pt-0.5 text-[11px] leading-relaxed text-soft/80">
            Prices live on each company&apos;s research page — open one to see
            where it stands today.
          </p>
        </div>
      )}

      {/* ── Kai for kids ─────────────────────────────────────────────────
          The board puts a Kai one-liner here. No kid-tip generator exists, so
          rather than print a quote Kai never said, the card is what it truly
          is: the way in to Kai, explained at the household's level. */}
      <div className="mt-4">
        <KaiNote action={<TextAction href="/kai">Ask →</TextAction>}>
          <strong className="text-kai-blue">Kai for kids:</strong> ask anything about a
          company in plain language — Kai answers at the age of whoever is asking.
        </KaiNote>
      </div>

      {/* ── Everything else in Family Mode ───────────────────────────────*/}
      <SectionLabel className="mt-7">Family Mode</SectionLabel>
      <RowCard className="mt-3">
        <FamilyLink
          href="/family/circle"
          icon="🏠"
          label="Family Circle"
          sub="The private household thread — never expires"
        />
        <FamilyLink
          href="/family/learn"
          icon="📚"
          label="Family Learn"
          sub="Build skills. Build confidence. Build wealth."
        />
        <FamilyLink
          href="/family/watchlist"
          icon="🗳"
          label="Family watchlist"
          sub="Which company should we learn about tonight?"
        />
        <FamilyLink
          href="/family/live"
          icon="((·))"
          label="Family live class"
          sub="Classes for the whole household"
        />
        {ctx.isParent && (
          <FamilyLink
            href="/family/corner"
            icon="🧭"
            label="Parent Corner"
            sub="Conversation starters, age-banded tips, family missions"
          />
        )}
        <FamilyLink
          href="/family/overview"
          icon="📈"
          label="Progress & report cards"
          sub="Lessons, streaks and per-member progress"
        />
      </RowCard>
    </FamilySurface>
  );
}

/* ── The household orb ────────────────────────────────────────────────────
   The board rings each member's avatar in their belt colour and hangs a PAPER
   tag off the supervised one. The belt hex is intrinsic to the belt (a blue
   belt is blue in every theme), so it is the one place a raw colour is legal. */
function MemberOrb({ member }: { member: FamilyMember }) {
  const belt = beltForXp(member.xp);
  const isKid = member.role === "child";

  const body = (
    <>
      <div className="relative mx-auto w-fit">
        <span
          className="grid place-items-center rounded-full p-[2.5px]"
          style={{ background: belt.belt.hex }}
        >
          <span className="grid place-items-center rounded-full bg-paper p-[1.5px]">
            <Avatar
              name={member.display_name}
              avatarUrl={member.avatar_url}
              role={member.role}
              size="xl"
            />
          </span>
        </span>
        {isKid && (
          <span className="absolute -left-2 -top-1">
            <Chip tone="ink">Paper</Chip>
          </span>
        )}
      </div>
      <p className="mt-2 truncate text-[12px] font-display font-bold text-ink">
        {member.display_name || "Member"}
      </p>
      <p className="mt-0.5 truncate text-[10.5px] text-soft">
        {/* "Teen" used to be hard-coded for every child, so a nine-year-old was
            labelled a teenager here and a "Kid" two screens over. One helper
            now answers that question for the whole family surface. */}
        {belt.label} ·{" "}
        {member.role === "parent"
          ? "Admin"
          : isKid
            ? ageGroupLabel(member.role, member.age_group)
            : "Member"}
      </p>
      <XpTag amount={member.xp} prefix="" suffix="" className="mt-0.5 justify-center" />
    </>
  );

  return isKid ? (
    <Link
      href={`/family/teen/${member.id}`}
      className="f0-focus f0-press min-w-[92px] flex-1 rounded-xl text-center"
    >
      {body}
    </Link>
  ) : (
    <div className="min-w-[92px] flex-1 text-center">{body}</div>
  );
}
