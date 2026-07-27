"use client";

import { useCallback, useEffect, useState } from "react";
import { RotateCcw } from "lucide-react";

import { createClient } from "@/lib/supabase/client";
import {
  LEVELS,
  XP,
  COMMUNITY_DAILY_CAP,
  GAME_PASS_RATIO,
  levelProgress,
  type Level,
  type XpKind,
} from "@/lib/xp";
import {
  BELTS,
  BELT_ORDER,
  beltForLevel,
  beltForXp,
  beltProgress,
  type Belt,
  type BeltKey,
} from "@/lib/belts";
import {
  DisplayHead,
  SectionRule,
  Ledger,
  MeasureStrip,
  Meter,
  EmptyLine,
  TextAction,
  dash,
} from "@/components/f0/parts";

/* ══════════════════════════════════════════════════════════════════════════
   BELTS — the rank ladder (canvas v2, App board 22). Route: /belts.

   THE LADDER IS THE CODE'S, NOT THE CANVAS'S. The canvas draws six belts
   (White · Yellow · Green · Blue · Purple · Black) gated on graded-call
   ACCURACY ("10 graded calls · 50%+ accuracy"). Neither ships:

     1. src/lib/belts.ts is the shipped ladder and it is FIVE belts —
        White → Yellow → Blue → Purple → Black — mapped onto the seven XP
        levels in src/lib/xp.ts, with degrees inside a belt (Blue I / Blue II).
        There is no Green. This screen DERIVES every threshold from those two
        modules; it does not restate them, so the ladder can never drift.
     2. Accuracy gates are a member-performance claim (plan §0.1). Belts are
        earned from XP — reps — and this screen says exactly that. What it
        shows instead is PARTICIPATION (XP, weeks active) and CONVICTION (the
        member's own bull share), which are contributions, not returns.

   PURPLE. Purple is dropped from UI chrome. The purple BELT is a belt colour —
   intrinsic, theme-independent, drawn from BELTS.purple.hex via inline style
   exactly like every other belt swatch. It appears on the band and nowhere
   else; no purple enters the surrounding chrome.

   NO GAUGE. The canvas draws belt progress as an arc. Plan §1.5: the club
   sentiment dial is the only gauge in the app. Progress here is a bar and a
   numeral — and the belt's own DEGREE is drawn as stripes on the belt tip,
   which is what a real belt does.

   REAL DATA ONLY.
     · lifetime XP                      → xp_for_users (one grouped SUM, exact)
     · per-source breakdown             → own rows of `xp_events`
     · weeks active                     → trailing weeks carrying an xp_event
     · conviction                       → own rows of `ticker_sentiment`
     · club belt distribution           → xp_leaderboard_individuals (mig. 099)
   FOUNDING STATE: production is a handful of members, all of them White. The
   distribution renders that truth — empty belts read "—", and the surface says
   out loud that the ladder is empty on purpose.
   ══════════════════════════════════════════════════════════════════════════ */

/* ── the ladder, derived ─────────────────────────────────────────────────── */

interface Rung {
  belt: Belt;
  levels: Level[];
  /** Lifetime XP at which this belt begins. */
  minXp: number;
}

/** Built from LEVELS + beltForLevel, so this file holds no copy of the map. */
const RUNGS: Rung[] = (() => {
  const byBelt = new Map<BeltKey, Level[]>();
  for (const l of LEVELS) {
    const key = beltForLevel(l).belt.key;
    byBelt.set(key, [...(byBelt.get(key) ?? []), l]);
  }
  return BELT_ORDER.filter((k) => (byBelt.get(k) ?? []).length > 0).map((k) => {
    const levels = (byBelt.get(k) ?? []).sort((a, b) => a.level - b.level);
    return { belt: BELTS[k], levels, minXp: levels[0].min };
  });
})();

/** "0 – 149 XP" · "3,200 XP +". Ranges come from the level table, never typed. */
function rangeLabel(i: number): string {
  const from = RUNGS[i].minXp;
  const next = RUNGS[i + 1];
  if (!next) return `${from.toLocaleString()} XP +`;
  return `${from.toLocaleString()} – ${(next.minXp - 1).toLocaleString()} XP`;
}

/* ── the belt object ─────────────────────────────────────────────────────── */

/**
 * A belt, drawn as a belt: a band in the belt's own colour with the knot block
 * at the left and DEGREE STRIPES at the tip. Colours are inline because a belt
 * colour is intrinsic — a blue belt is blue in both themes and must not be
 * re-mapped by a token.
 */
function BeltBand({
  belt,
  degree,
  degreesInBelt,
  muted = false,
  height = 56,
}: {
  belt: Belt;
  degree?: number;
  degreesInBelt?: number;
  muted?: boolean;
  height?: number;
}) {
  const stripes = degreesInBelt && degreesInBelt > 1 ? degreesInBelt : 0;
  // Geometry scales off the band height so the same object reads correctly at
  // the hero size (56px) and at the ladder-row size (20px) without a variant.
  const knotLeft = Math.round(height * 0.35);
  const knotWidth = Math.max(3, Math.round(height * 0.2));
  const stripeInset = Math.max(3, Math.round(height * 0.14));
  const stripeWidth = Math.max(2, Math.round(height * 0.1));
  const stripeGap = Math.max(2, Math.round(height * 0.07));

  return (
    <div
      className="relative w-full overflow-hidden rounded-md"
      style={{
        height,
        backgroundColor: belt.hex,
        border: `1px solid ${belt.borderHex}`,
        opacity: muted ? 0.42 : 1,
      }}
      aria-hidden
    >
      {/* the knot — the block that makes a band read as a belt, not a swatch */}
      <span
        className="absolute inset-y-0"
        style={{
          left: knotLeft,
          width: knotWidth,
          backgroundColor: belt.borderHex,
          opacity: 0.85,
        }}
      />
      {stripes > 0 && (
        <span
          className="absolute inset-y-0 flex items-center"
          style={{ right: stripeInset, gap: stripeGap }}
        >
          {Array.from({ length: stripes }).map((_, i) => (
            <span
              key={i}
              className="block rounded-sm"
              style={{
                width: stripeWidth,
                height: Math.round(height * 0.5),
                backgroundColor: belt.onHex,
                opacity: degree != null && i < degree ? 0.95 : 0.22,
              }}
            />
          ))}
        </span>
      )}
    </div>
  );
}

/* ── what earns XP ───────────────────────────────────────────────────────── */

interface EarnRow {
  kind: XpKind;
  label: string;
  rule: string;
  rate: string;
  /** Bonus XP has no published rate — it is only shown once earned. */
  onlyIfEarned?: boolean;
}

const EARNS: EarnRow[] = [
  {
    kind: "lesson",
    label: "Finish a lesson",
    rule: "Every completed lesson, once each.",
    rate: `${XP.LESSON} XP`,
  },
  {
    kind: "quiz",
    label: "Pass a quiz",
    rule: `A perfect score pays ${XP.QUIZ_PERFECT_BONUS} XP more.`,
    rate: `${XP.QUIZ_PASS} XP`,
  },
  {
    kind: "flashcards",
    label: "Clear a flashcard set",
    rule: "One award per set.",
    rate: `${XP.FLASHCARDS} XP`,
  },
  {
    kind: "game",
    label: "Win a game round",
    rule: `A round under ${Math.round(GAME_PASS_RATIO * 100)}% doesn't count.`,
    rate: `${XP.GAME} XP`,
  },
  {
    kind: "community",
    label: "Contribute in the Club",
    rule: `The first ${COMMUNITY_DAILY_CAP} posts each day.`,
    rate: `${XP.COMMUNITY} XP`,
  },
  {
    kind: "rsvp",
    label: "RSVP to a live session",
    rule: "Once per session.",
    rate: `${XP.RSVP} XP`,
  },
  {
    kind: "bonus",
    label: "Bonus",
    rule: "Referrals and one-off awards.",
    rate: "Varies",
    onlyIfEarned: true,
  },
];

/* ── state ───────────────────────────────────────────────────────────────── */

interface BeltState {
  xp: number;
  byKind: Partial<Record<XpKind, number>>;
  weeks: number;
  conviction: number | null;
  rated: number | null;
  /** Real club-wide belt distribution. null when the board read failed. */
  distribution: Record<BeltKey, number> | null;
  clubTotal: number;
  /** The board returns the top 100 — true when we are up against that cap. */
  clubCapped: boolean;
  /** True when the per-source breakdown covers only the page we could read. */
  breakdownCapped: boolean;
}

/** One page of XP events — PostgREST caps a select, so we read a page and say
 *  so when the page is full rather than pretending it is the whole ledger. */
const EVENT_PAGE = 1000;

const EMPTY: BeltState = {
  xp: 0,
  byKind: {},
  weeks: 0,
  conviction: null,
  rated: null,
  distribution: null,
  clubTotal: 0,
  clubCapped: false,
  breakdownCapped: false,
};

/** Monday-anchored week key, matching the participation streak on /progress. */
function weekKey(d: Date): string {
  const t = new Date(d);
  t.setHours(0, 0, 0, 0);
  t.setDate(t.getDate() - ((t.getDay() + 6) % 7));
  return t.toISOString().slice(0, 10);
}

function Skeleton() {
  return (
    <div className="mx-auto max-w-2xl space-y-10" aria-busy="true">
      <div className="space-y-3">
        <span className="block h-2.5 w-28 animate-pulse rounded bg-sand" />
        <span className="block h-9 w-40 animate-pulse rounded bg-sand" />
        <span className="block h-4 w-72 animate-pulse rounded bg-sand" />
      </div>
      <span className="block h-14 w-full animate-pulse rounded-md bg-sand" />
      <div className="f0-ledger">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="f0-ledger-row">
            <span className="h-5 w-12 shrink-0 animate-pulse rounded-sm bg-sand" />
            <span className="min-w-0 flex-1 space-y-2">
              <span className="block h-3.5 w-28 animate-pulse rounded bg-sand" />
              <span className="block h-2.5 w-36 animate-pulse rounded bg-sand" />
            </span>
            <span className="h-4 w-10 shrink-0 animate-pulse rounded bg-sand" />
          </div>
        ))}
      </div>
    </div>
  );
}

export default function BeltLadder() {
  const [state, setState] = useState<BeltState>(EMPTY);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);

  const load = useCallback(async () => {
    setFailed(false);
    const supabase = createClient();
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        setLoading(false);
        return;
      }

      const [totalRes, eventsRes, sentimentRes, boardRes] = await Promise.all([
        // Lifetime XP as ONE grouped SUM in the database. A client-side sum over
        // xp_events is capped by PostgREST's max-rows and would quietly
        // under-report a long-standing member's belt — the one number on this
        // screen that must be exact.
        supabase.rpc("xp_for_users", { p_user_ids: [user.id] }),
        supabase
          .from("xp_events")
          .select("amount, kind, created_at")
          .eq("user_id", user.id)
          .order("created_at", { ascending: false })
          .limit(EVENT_PAGE),
        supabase.from("ticker_sentiment").select("vote").eq("user_id", user.id).limit(1000),
        supabase.rpc("xp_leaderboard_individuals", { p_window: "all", p_scope: "all" }),
      ]);

      // ── own XP, by kind, from the real event rows ─────────────────────────
      const events = (eventsRes.data ?? []) as {
        amount: number;
        kind: XpKind;
        created_at: string;
      }[];
      let summed = 0;
      const byKind: Partial<Record<XpKind, number>> = {};
      for (const e of events) {
        const amt = Number(e.amount) || 0;
        summed += amt;
        byKind[e.kind] = (byKind[e.kind] ?? 0) + amt;
      }
      const totalRow = ((totalRes.data ?? []) as { user_id: string; xp: number }[])[0];
      const xp = totalRow ? Number(totalRow.xp) || 0 : summed;
      // The per-source breakdown covers the page we read. Say so when it does
      // not cover everything, rather than presenting a partial as a total.
      const breakdownCapped = events.length >= EVENT_PAGE;

      // ── participation: trailing run of weeks carrying an xp_event ─────────
      let weeks = 0;
      if (events.length > 0) {
        const seen = new Set(events.map((e) => weekKey(new Date(e.created_at))));
        let w = weekKey(new Date());
        while (seen.has(w)) {
          weeks += 1;
          const prev = new Date(w);
          prev.setDate(prev.getDate() - 7);
          w = weekKey(prev);
        }
      }

      // ── conviction: the member's own bull share. Not accuracy. ────────────
      let conviction: number | null = null;
      let rated: number | null = null;
      if (!sentimentRes.error && sentimentRes.data) {
        const rows = sentimentRes.data as { vote: number }[];
        rated = rows.length;
        if (rows.length > 0) {
          conviction = Math.round(
            (rows.filter((r) => Number(r.vote) === 1).length / rows.length) * 100
          );
        }
      }

      // ── the club's real belt distribution ─────────────────────────────────
      let distribution: Record<BeltKey, number> | null = null;
      let clubTotal = 0;
      let clubCapped = false;
      const board = (boardRes.data as { rows?: { xp: number }[] } | null)?.rows;
      if (!boardRes.error && Array.isArray(board)) {
        const counts = { white: 0, yellow: 0, blue: 0, purple: 0, black: 0 } as Record<
          BeltKey,
          number
        >;
        for (const r of board) counts[beltForXp(Number(r.xp) || 0).belt.key] += 1;
        distribution = counts;
        clubTotal = board.length;
        clubCapped = board.length >= 100;
      }

      setState({
        xp,
        byKind,
        weeks,
        conviction,
        rated,
        distribution,
        clubTotal,
        clubCapped,
        breakdownCapped,
      });
      setLoading(false);
    } catch {
      setFailed(true);
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading) return <Skeleton />;

  if (failed) {
    return (
      <div className="mx-auto max-w-2xl py-16">
        <EmptyLine
          title="The ladder didn't load"
          body="Something hiccuped on our end — nothing you've earned is affected. Give it another go."
          action={
            <TextAction
              onClick={() => {
                setLoading(true);
                void load();
              }}
            >
              <RotateCcw className="h-4 w-4" /> Try again
            </TextAction>
          }
        />
      </div>
    );
  }

  const prog = beltProgress(state.xp);
  const lvl = levelProgress(state.xp);
  const currentIndex = RUNGS.findIndex((r) => r.belt.key === prog.current.belt.key);
  const dist = state.distribution;

  // The founding read, stated rather than dressed up: when every ranked member
  // sits on the first rung, that IS the club today.
  const everyoneOnFirstRung =
    !!dist && state.clubTotal > 0 && dist[RUNGS[0].belt.key] === state.clubTotal;

  return (
    <div className="mx-auto max-w-2xl space-y-10 pb-16">
      <DisplayHead
        eyebrow="Cheat Code Club"
        title="Belts"
        lede="Rank is earned from reps, not follower counts. Your belt travels with you everywhere in the Club."
      />

      {/* ── YOUR BELT — the belt itself is the object ─────────────────────── */}
      <section>
        <BeltBand
          belt={prog.current.belt}
          degree={prog.current.degree}
          degreesInBelt={prog.current.degreesInBelt}
        />
        <div className="mt-4 flex items-end justify-between gap-4">
          <div className="min-w-0">
            <p className="text-eyebrow font-display font-bold uppercase text-gold-700">
              Your belt
            </p>
            <h2 className="mt-1.5 font-display text-display-2 font-extrabold uppercase text-ink">
              {prog.current.label}
            </h2>
            <p className="mt-1 font-mono text-[12px] uppercase tracking-[0.14em] text-soft">
              Level {prog.current.level.level} · {prog.current.level.name}
            </p>
          </div>
          <p className="shrink-0 text-right">
            <span className="font-mono text-[22px] font-semibold tabular-nums text-ink">
              {state.xp.toLocaleString()}
            </span>
            <span className="ml-1 font-display text-[12px] font-bold text-gold-700">XP</span>
          </p>
        </div>

        <Meter pct={prog.pct} className="mt-5" />
        <p className="mt-2 font-mono text-[12px] text-soft">
          {prog.next
            ? `${prog.toNext.toLocaleString()} XP to ${prog.next.label}${
                prog.nextIsNewBelt ? " — a new belt" : ""
              }`
            : "Top of the ladder — every belt earned"}
        </p>
        {lvl.next && (
          <p className="mt-1 text-[13px] leading-relaxed text-soft">
            That&apos;s {lvl.into.toLocaleString()} of the {lvl.span.toLocaleString()} XP in this
            band. Every award below moves it.
          </p>
        )}
      </section>

      {/* ── YOUR NUMBERS — participation and conviction. Never accuracy. ──── */}
      <section className="space-y-5">
        <SectionRule>Your numbers</SectionRule>
        <MeasureStrip
          items={[
            { label: "Weeks active", value: state.weeks === 0 ? "—" : String(state.weeks) },
            { label: "Tickers rated", value: dash(state.rated) },
            {
              label: "Conviction",
              value: state.conviction == null ? "—" : `${state.conviction}%`,
              tone: "sentiment",
            },
          ]}
        />
        <p className="text-[13px] leading-relaxed text-soft">
          Weeks active is the unbroken run of weeks you&apos;ve earned XP in. Conviction is the
          share of your rated tickers you called bullish — the Club&apos;s own sentiment measure,
          not a market number. We don&apos;t publish member accuracy or win rates, so no belt is
          gated on one.
        </p>
      </section>

      {/* ── THE LADDER ───────────────────────────────────────────────────── */}
      <section className="space-y-5">
        <SectionRule action={<TextAction href="/leaderboard">Leaderboard</TextAction>}>
          The ladder
        </SectionRule>

        <Ledger>
          {RUNGS.map((rung, i) => {
            const isCurrent = i === currentIndex;
            const earned = i <= currentIndex;
            const count = dist ? dist[rung.belt.key] : null;
            return (
              <div key={rung.belt.key} className="f0-ledger-row">
                <span className="w-14 shrink-0 self-center sm:w-16">
                  <BeltBand
                    belt={rung.belt}
                    degree={isCurrent ? prog.current.degree : rung.levels.length}
                    degreesInBelt={rung.levels.length}
                    muted={!earned}
                    height={20}
                  />
                </span>
                <span className="min-w-0 flex-1 self-center">
                  <span className="flex flex-wrap items-baseline gap-x-2.5 gap-y-1">
                    <span
                      className={`font-display text-[15px] font-bold ${
                        earned ? "text-ink" : "text-soft"
                      }`}
                    >
                      {rung.belt.name} Belt
                    </span>
                    {isCurrent && (
                      <span className="text-eyebrow font-display font-bold uppercase text-gold-700">
                        You are here
                      </span>
                    )}
                  </span>
                  <span className="mt-1 block font-mono text-[10.5px] uppercase tracking-[0.12em] text-soft">
                    {rangeLabel(i)}
                    {rung.levels.length > 1
                      ? ` · ${rung.levels.length} degrees`
                      : ` · Level ${rung.levels[0].level}`}
                  </span>
                </span>
                <span className="shrink-0 self-center text-right">
                  <span className="block font-mono text-[14px] font-semibold tabular-nums text-ink">
                    {count == null ? "—" : count === 0 ? "—" : count.toLocaleString()}
                  </span>
                  <span className="mt-0.5 block text-eyebrow font-display font-bold uppercase text-soft">
                    Members
                  </span>
                </span>
              </div>
            );
          })}
        </Ledger>

        {/* The distribution, told honestly at the scale it actually has. */}
        <p className="text-[13px] leading-relaxed text-soft">
          {dist == null ? (
            "The club-wide count couldn't be read just now, so every belt shows — rather than a number we can't stand behind."
          ) : state.clubTotal === 0 ? (
            "Nobody is ranked yet. The counts fill in as members earn their first XP."
          ) : everyoneOnFirstRung ? (
            <>
              All {state.clubTotal.toLocaleString()} ranked{" "}
              {state.clubTotal === 1 ? "member is a" : "members are"}{" "}
              {RUNGS[0].belt.name} Belt{state.clubTotal === 1 ? "" : "s"} today. The rungs above
              are empty on purpose — nobody has put in the reps yet, and we&apos;d rather show you
              an empty ladder than a full one that isn&apos;t true.
            </>
          ) : (
            <>
              Counted across {state.clubTotal.toLocaleString()} ranked member
              {state.clubTotal === 1 ? "" : "s"}
              {state.clubCapped ? " (the top 100 by lifetime XP)" : ""}. A belt with nobody on it
              reads &ldquo;—&rdquo;.
            </>
          )}
        </p>
      </section>

      {/* ── WHAT EARNS XP ────────────────────────────────────────────────── */}
      <section className="space-y-5">
        <SectionRule>What earns XP</SectionRule>
        <Ledger>
          {EARNS.filter((e) => !e.onlyIfEarned || (state.byKind[e.kind] ?? 0) > 0).map((e) => {
            const mine = state.byKind[e.kind] ?? 0;
            return (
              <div key={e.kind} className="f0-ledger-row justify-between">
                <div className="min-w-0 flex-1">
                  <p className="font-display text-[15px] font-bold text-ink">{e.label}</p>
                  <p className="mt-0.5 text-[13px] leading-snug text-soft">{e.rule}</p>
                </div>
                <div className="shrink-0 self-center text-right">
                  <p className="font-mono text-[14px] font-semibold tabular-nums text-ink">
                    {e.rate}
                  </p>
                  <p className="mt-0.5 text-eyebrow font-display font-bold uppercase text-soft">
                    {mine > 0 ? `${mine.toLocaleString()} earned` : "None yet"}
                  </p>
                </div>
              </div>
            );
          })}
        </Ledger>
        <p className="text-[13px] leading-relaxed text-soft">
          Rates are the ones the app actually awards — this list is generated from the same
          constants the award calls use, so it can&apos;t drift from what you get paid. Your own
          totals come straight from your XP ledger
          {state.breakdownCapped
            ? `, covering your most recent ${EVENT_PAGE.toLocaleString()} awards`
            : ""}
          .
        </p>
      </section>

      {/* ── HOW BELTS SHOW UP ────────────────────────────────────────────── */}
      <section className="space-y-4">
        <SectionRule>How your belt shows up</SectionRule>
        <p className="max-w-xl text-[14px] leading-relaxed text-soft">
          Your belt colour rides the corner of your avatar everywhere in the Club, and the
          spelled-out belt sits beside your name on the leaderboard and on your profile. It is the
          one credential here that can only be earned.
        </p>
        <div className="flex flex-wrap gap-x-6 gap-y-3">
          <TextAction href="/progress">Your profile</TextAction>
          <TextAction href="/missions">Ways to earn today</TextAction>
        </div>
      </section>
    </div>
  );
}
