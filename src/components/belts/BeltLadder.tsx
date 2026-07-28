"use client";

import { useCallback, useEffect, useState } from "react";
import { RotateCcw } from "lucide-react";

import { createClient } from "@/lib/supabase/client";
import {
  LEVELS,
  XP,
  COMMUNITY_DAILY_CAP,
  GAME_PASS_RATIO,
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
  BoardMast,
  Card,
  WarmCard,
  ListHead,
  RowCard,
  BeltChip,
  EmptyCard,
  TextAction,
} from "@/components/you/parts";
// The drawn belt. Aliased because `Belt` is already the belt TYPE from
// lib/belts in this file, and the object and its data shape both deserve the
// obvious name in their own layer.
import { Belt as BeltObject, EmptyBeltOnPeg, EmptyStateNote } from "@/components/art";
import { XpLevelObject } from "@/components/canvas2";

/* ══════════════════════════════════════════════════════════════════════════
   BELTS — the rank ladder. Route: /belts. Built to App Light board 22
   "Belts · Rank System": the "belts" wordmark with a back chevron, the stack of
   rung cards each with a belt disc / name / gate line / share-of-club figure,
   the current rung as a warm glowing card with a star pip and "— YOU ARE HERE",
   the "HOW BELTS SHOW UP" explainer card. The board's footer "Next:" bar is
   deliberately not built: its three numbers are the hero object's three
   numbers, and the hero is where a member looks first.

   ── WHAT EACH DRAWN FIGURE ACTUALLY SHOWS ─────────────────────────────────
   drawn                              ships
   ─────────────────────────────────  ──────────────────────────────────────
   six rungs incl. a Green Belt       FIVE rungs — White → Yellow → Blue →
                                      Purple → Black — derived from LEVELS +
                                      beltForLevel, so the ladder can never
                                      drift from src/lib/belts.ts. There is no
                                      Green and no test gate.
   "10 graded calls · 50%+ accuracy"  the belt's real XP range and how many
   "40 calls · 58%+ · 1 sector top"   level degrees sit inside it. Gating a
   "500+ calls · 70%+"                belt on a member's hit rate is a
                                      performance claim; belts are earned from
                                      reps and this screen says exactly that.
   "62% OF CLUB" / "21%" / "0.4%"     the REAL share of ranked members sitting
                                      on that rung, from the XP leaderboard
                                      RPC — demoted to a quiet mono line, and
                                      SUPPRESSED ENTIRELY when it would be
                                      noise. This used to be the loudest figure
                                      on the page, which made the screen about
                                      the club's shape rather than the member's
                                      own position; the hero object below the
                                      mast is the answer to "where am I", and
                                      the share is a footnote to it.
   "Next: Red-stripe Black Belt /     the real next belt or degree, the real XP
    Keep 70%+ accuracy for 2 months"  remaining, and the real progress bar.
   named example members              the same three-row explainer card, but
   (Tiffany R., OptionsOG, DeShawn)   with belt objects and the mechanic rather
                                      than invented members with invented
                                      streaks — nothing on this surface is a
                                      person who does not exist.

   PURPLE is a BELT colour: intrinsic, theme-independent, drawn from
   BELTS.purple.hex via inline style exactly like every other belt. It appears
   on the rungs and nowhere else in the chrome.

   REAL DATA ONLY.
     · lifetime XP           → xp_for_users (one grouped SUM, exact)
     · per-source breakdown  → own rows of `xp_events`
     · belt distribution     → xp_leaderboard_individuals (mig. 099)
   FOUNDING STATE: production is a handful of members, all of them White. The
   distribution renders that truth — empty rungs carry no figure at all, the
   unclaimed top rung is drawn as a belt on an empty peg, and the surface says
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

/** The rung's gate line. Ranges come from the level table, never typed. */
function gateLine(i: number): string {
  const rung = RUNGS[i];
  const from = rung.minXp;
  const next = RUNGS[i + 1];
  const range = next
    ? `${from.toLocaleString()} – ${(next.minXp - 1).toLocaleString()} XP`
    : `${from.toLocaleString()} XP +`;
  const degrees =
    rung.levels.length > 1
      ? `${rung.levels.length} degrees`
      : `Level ${rung.levels[0].level}`;
  return `${range} · ${degrees}`;
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

/** Below this many ranked members a share-of-club percentage is noise wearing a
 *  number's clothes — one signup moves a rung double digits — so it is not
 *  published at all. See shareLabel(). */
const SHARE_FLOOR = 5;

const EMPTY: BeltState = {
  xp: 0,
  byKind: {},
  distribution: null,
  clubTotal: 0,
  clubCapped: false,
  breakdownCapped: false,
};

function Skeleton() {
  return (
    <div className="mx-auto max-w-2xl space-y-4" aria-busy="true">
      <div className="h-9 w-28 rounded bg-sand/60 motion-safe:animate-pulse" />
      <div className="h-8 w-full max-w-md rounded bg-sand/40 motion-safe:animate-pulse" />
      <div className="space-y-2 pt-2">
        {[0, 1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className="club-b-card h-[62px] rounded-[13px] motion-safe:animate-pulse"
          />
        ))}
      </div>
      <span className="sr-only">Loading the belt ladder</span>
    </div>
  );
}

export default function BeltLadder() {
  const [state, setState] = useState<BeltState>(EMPTY);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);

  // NOTE: no setState runs synchronously in this callback's body. The first
  // statement used to be `setFailed(false)`, which — because the mount effect
  // calls `load()` directly — is a synchronous setState inside an effect and a
  // cascading render (react-hooks/set-state-in-effect). Clearing the failure
  // belongs to the retry handler, which is where a failure can actually exist.
  const load = useCallback(async () => {
    const supabase = createClient();
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        setLoading(false);
        return;
      }

      const [totalRes, eventsRes, boardRes] = await Promise.all([
        // Lifetime XP as ONE grouped SUM in the database. A client-side sum over
        // xp_events is capped by PostgREST's max-rows and would quietly
        // under-report a long-standing member's belt — the one number on this
        // screen that must be exact.
        supabase.rpc("xp_for_users", { p_user_ids: [user.id] }),
        supabase
          .from("xp_events")
          .select("amount, kind")
          .eq("user_id", user.id)
          .order("created_at", { ascending: false })
          .limit(EVENT_PAGE),
        supabase.rpc("xp_leaderboard_individuals", { p_window: "all", p_scope: "all" }),
      ]);

      // ── own XP, by kind, from the real event rows ─────────────────────────
      const events = (eventsRes.data ?? []) as { amount: number; kind: XpKind }[];
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

      setState({ xp, byKind, distribution, clubTotal, clubCapped, breakdownCapped });
      setLoading(false);
    } catch {
      setFailed(true);
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // Deferred to a microtask on purpose: the effect body must not reach a
    // setState synchronously, or the mount is a cascading render
    // (react-hooks/set-state-in-effect). Same pattern the leaderboard uses.
    void Promise.resolve().then(() => load());
  }, [load]);

  if (loading) return <Skeleton />;

  if (failed) {
    return (
      <div className="mx-auto max-w-2xl py-16">
        <EmptyCard
          title="The ladder didn't load"
          body="Something hiccuped on our end — nothing you've earned is affected. Give it another go."
          action={
            <TextAction
              onClick={() => {
                setFailed(false);
                setLoading(true);
                void load();
              }}
            >
              <RotateCcw className="h-3.5 w-3.5" /> Try again
            </TextAction>
          }
        />
      </div>
    );
  }

  const prog = beltProgress(state.xp);
  const currentIndex = RUNGS.findIndex((r) => r.belt.key === prog.current.belt.key);
  const dist = state.distribution;

  // The founding read, stated rather than dressed up: when every ranked member
  // sits on the first rung, that IS the club today.
  const everyoneOnFirstRung =
    !!dist && state.clubTotal > 0 && dist[RUNGS[0].belt.key] === state.clubTotal;

  /**
   * Real share of ranked members on a rung, or NOTHING.
   *
   * The old version returned "—" for an empty rung, which put a placeholder
   * glyph on four of five rungs at founding scale and made the column look
   * broken rather than young. Worse, a percentage computed over three people is
   * arithmetic, not information: one member joining swings a rung by 33 points.
   * So the figure only exists when it can survive being read — a non-empty rung
   * counted across at least SHARE_FLOOR ranked members. Everything else renders
   * no element at all, and the paragraph under the ladder carries the truth.
   */
  function shareLabel(key: BeltKey): string | null {
    if (!dist || state.clubTotal < SHARE_FLOOR) return null;
    const n = dist[key];
    if (!n) return null;
    const pct = (n / state.clubTotal) * 100;
    return `${pct >= 10 ? Math.round(pct) : pct.toFixed(1)}% of club`;
  }

  return (
    <div className="mx-auto max-w-2xl space-y-4 pb-16">
      <BoardMast
        word="belts"
        back={{ href: "/progress", label: "Back to your profile" }}
        lede="Rank is earned from reps, not follower counts. Your belt travels with you everywhere in the Club."
      />

      {/* ── WHERE YOU STAND ─────────────────────────────────────────────────
          The page used to open on the ladder, which meant the first thing a
          member read was somebody else's rung and a share-of-club percentage.
          The hero is now the member's own position, drawn with the canonical XP
          object (canvas2/LevelObject): their belt at a size you can actually
          see, the belt they hold, how much of it is behind them, and — as the
          loudest figure on the screen — what the next belt costs. Every number
          in it comes from the same beltProgress() call the footer used to make,
          so nothing new is computed and nothing can drift. */}
      <XpLevelObject
        xp={state.xp}
        ladder="belt"
        leading={<BeltObject rank={prog.current} size={64} title={prog.current.label} />}
        className="pt-1"
      />

      {/* ── THE LADDER ──────────────────────────────────────────────────────
          One card per rung, as drawn. The rung the member stands on is the warm
          card with the orange edge and "— YOU ARE HERE".

          Each rung wears the DRAWN belt rather than the old coloured lozenge.
          Degree follows the member's real standing: a rung already behind them
          shows every notch that belt carries, the rung they stand on shows the
          degree they actually hold, and a rung ahead is drawn locked — the same
          belt in line only, so the ladder reads as one object photographed at
          five stages rather than five unrelated chips. */}
      <section className="space-y-2 pt-1">
        {RUNGS.map((rung, i) => {
          const isCurrent = i === currentIndex;
          const earned = i <= currentIndex;
          const share = shareLabel(rung.belt.key);
          const degree = isCurrent
            ? prog.current.degree
            : earned
              ? rung.levels.length
              : 1;
          const disc = (
            <BeltObject
              belt={rung.belt.key}
              degree={degree}
              size={38}
              locked={!earned}
            />
          );

          const title = (
            <span className="flex flex-wrap items-baseline gap-x-2">
              <span
                className={`font-display text-[13px] ${
                  isCurrent ? "font-extrabold text-ink" : earned ? "font-bold text-ink" : "font-bold text-soft"
                }`}
              >
                {rung.belt.name} Belt
              </span>
              {isCurrent && (
                <span className="font-display text-[9px] font-semibold uppercase tracking-[0.1em] text-gold-700">
                  — You are here
                </span>
              )}
            </span>
          );
          // Quiet, and absent when it has nothing to say. No accent colour: the
          // share is a footnote, and a footnote in gold is not a footnote.
          const value = share ? (
            <span className="font-mono text-[10.5px] tabular-nums text-soft">{share}</span>
          ) : undefined;

          if (isCurrent) {
            return (
              <WarmCard key={rung.belt.key} glow className="flex items-center gap-3 px-3.5 py-2.5">
                <span className="shrink-0">{disc}</span>
                <span className="min-w-0 flex-1">
                  {title}
                  <span className="mt-0.5 block truncate text-[9.5px] text-soft">
                    {gateLine(i)}
                  </span>
                </span>
                {value ? <span className="shrink-0">{value}</span> : null}
              </WarmCard>
            );
          }

          return (
            <RowCard
              key={rung.belt.key}
              className={`rounded-[13px] ${earned ? "" : "opacity-85"}`}
              lead={disc}
              title={title}
              sub={gateLine(i)}
              value={value}
            />
          );
        })}
      </section>

      {/* THE TOP RUNG, EMPTY — drawn rather than stated.
          "No Black Belts yet" as a line of text reads like a missing feature.
          The belt on the peg says the same thing as a picture: the rank exists,
          the peg is hung, nobody has taken it down. Shown only once there IS a
          club to be absent from — with nobody ranked at all, the paragraph
          below already carries it. */}
      {dist && state.clubTotal > 0 && dist[RUNGS[RUNGS.length - 1].belt.key] === 0 && (
        <EmptyStateNote
          art={<EmptyBeltOnPeg size={72} />}
          title={`No ${RUNGS[RUNGS.length - 1].belt.name} Belts yet`}
        >
          The top rung is unclaimed. It takes {RUNGS[RUNGS.length - 1].minXp.toLocaleString()} XP
          of real reps to reach, and nobody in the Club has put them in — so the peg stays empty
          until somebody does.
        </EmptyStateNote>
      )}

      {/* The distribution, told honestly at the scale it actually has. */}
      <p className="text-[11px] leading-relaxed text-soft">
        {dist == null ? (
          "The club-wide share couldn't be read just now, so no rung carries a percentage — we'd rather show you nothing than a number we can't stand behind."
        ) : state.clubTotal === 0 ? (
          "Nobody is ranked yet. The shares fill in as members earn their first XP."
        ) : state.clubTotal < SHARE_FLOOR ? (
          <>
            {state.clubTotal === 1 ? "One member is" : `${state.clubTotal} members are`} ranked so
            far — too few for a share-of-club percentage to mean anything, so the ladder carries
            none. It starts showing shares once the board passes{" "}
            {SHARE_FLOOR.toLocaleString()} ranked members.
          </>
        ) : everyoneOnFirstRung ? (
          <>
            All {state.clubTotal.toLocaleString()} ranked{" "}
            {state.clubTotal === 1 ? "member is a" : "members are"} {RUNGS[0].belt.name} Belt
            {state.clubTotal === 1 ? "" : "s"} today. The rungs above are empty on purpose —
            nobody has put in the reps yet, and we&apos;d rather show you an empty ladder than
            a full one that isn&apos;t true.
          </>
        ) : (
          <>
            Shares are counted across {state.clubTotal.toLocaleString()} ranked member
            {state.clubTotal === 1 ? "" : "s"}
            {state.clubCapped ? " (the top 100 by lifetime XP)" : ""}. A rung with nobody on it
            carries no figure at all. No belt is gated on accuracy or a win rate — we don&apos;t
            publish either.
          </>
        )}
      </p>

      {/* ── HOW BELTS SHOW UP ───────────────────────────────────────────────
          The board's explainer card: three hairline-separated rows inside one
          card. The board casts invented members in them; the mechanic is what
          the rows are actually for, so the belt objects play themselves. */}
      <section className="space-y-2.5 pt-2">
        <ListHead>How belts show up</ListHead>
        <Card className="rounded-[14px] px-3.5 py-3">
          <div className="f0-ledger">
            <div className="flex items-center gap-2.5 py-2.5">
              <BeltObject belt="blue" degree={2} size={40} />
              <div className="min-w-0 flex-1">
                <p className="font-display text-[12px] font-bold text-ink">
                  Your avatar ring
                </p>
                <p className="mt-0.5 text-[10px] text-soft">
                  Belt colour rides the corner of your avatar, everywhere
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2.5 py-2.5">
              <BeltObject belt="black" size={40} />
              <div className="min-w-0 flex-1">
                <p className="flex flex-wrap items-center gap-1.5 font-display text-[12px] font-bold text-ink">
                  Beside your name
                  <BeltChip
                    hex={BELTS.black.hex}
                    onHex={BELTS.black.onHex}
                    label="Black Belt"
                  />
                </p>
                <p className="mt-0.5 text-[10px] text-soft">
                  The belt chip sits next to your name on every post
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2.5 py-2.5">
              <BeltObject belt="yellow" size={40} />
              <div className="min-w-0 flex-1">
                <p className="font-display text-[12px] font-bold text-ink">
                  On the leaderboard
                </p>
                <p className="mt-0.5 text-[10px] text-soft">
                  Your belt is spelled out beside your rank
                </p>
              </div>
            </div>
          </div>
        </Card>
      </section>

      {/* ── WHAT EARNS XP ───────────────────────────────────────────────── */}
      <section className="space-y-2.5 pt-2">
        <ListHead>What earns XP</ListHead>
        <div className="space-y-2">
          {EARNS.filter((e) => !e.onlyIfEarned || (state.byKind[e.kind] ?? 0) > 0).map((e) => {
            const mine = state.byKind[e.kind] ?? 0;
            return (
              <RowCard
                key={e.kind}
                title={e.label}
                sub={e.rule}
                value={
                  <span className="block">
                    <span className="block font-mono text-[11px] font-semibold tabular-nums text-ink">
                      {e.rate}
                    </span>
                    <span className="mt-0.5 block text-[8.5px] font-semibold uppercase tracking-[0.1em] text-soft">
                      {mine > 0 ? `${mine.toLocaleString()} earned` : "None yet"}
                    </span>
                  </span>
                }
              />
            );
          })}
        </div>
        <p className="text-[11px] leading-relaxed text-soft">
          Rates are the ones the app actually awards — this list is generated from the same
          constants the award calls use, so it can&apos;t drift from what you get paid. Your own
          totals come straight from your XP ledger
          {state.breakdownCapped
            ? `, covering your most recent ${EVENT_PAGE.toLocaleString()} awards`
            : ""}
          .
        </p>
      </section>

      {/* The board's footer "Next:" bar is GONE. It carried the same three
          numbers as the hero object at the top of the page — belt, remaining
          XP, progress — which meant the screen asked and answered "where am I"
          twice, once in 9.5px at the bottom where nobody was looking. One
          object, at the top, is the whole point of LevelObject existing. */}

      <div className="flex flex-wrap gap-x-6 gap-y-2 pt-3">
        <TextAction href="/progress">Your profile</TextAction>
        <TextAction href="/leaderboard">Leaderboard</TextAction>
        <TextAction href="/missions">Ways to earn today</TextAction>
      </div>
    </div>
  );
}
