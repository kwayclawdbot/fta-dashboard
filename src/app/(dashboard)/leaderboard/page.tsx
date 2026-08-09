"use client";

import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
// `m` is the LazyMotion primitive and covers everything on this page EXCEPT
// layout animation, which the domAnimation feature bundle does not ship. The
// board re-orders itself when a window changes, and rows sliding to their new
// positions is the one moment this surface has to show that rank MOVED rather
// than that a different list appeared — so the rows use the full `motion`
// primitive imported directly. Nothing else on the page does.
import { motion } from "framer-motion";
import { m, useReducedMotion } from "@/lib/motion";
import { createClient } from "@/lib/supabase/client";
import { useAppMode } from "@/lib/useAppMode";
import type { FamilyTier } from "@/lib/tier";
import { beltForXp } from "@/lib/belts";
import Avatar from "@/components/Avatar";
import BeltBadge from "@/components/BeltBadge";
import TierBadge from "@/components/TierBadge";
import ProfileLink from "@/components/ProfileLink";
import { SegmentedRail } from "@/components/canvas2";
import { isOffBoardIdentity } from "@/lib/leaderboardExclusions";
import { BoardMast, EmptyCard, TextAction } from "@/components/you/parts";

/**
 * THE BOARD — two dimensions (Individuals | Families) × three trailing periods
 * (Last 7 days | Last 30 days | All-time). Data comes from the definer RPCs in
 * migration 099; belts + levels derive client-side from the returned XP
 * (src/lib/belts.ts). Periods are trailing/rolling and labelled honestly
 * ("Last 7 days") — never calendar buckets, so a window is always full. The
 * Individuals dimension keeps its scope switch (Everyone | My family);
 * ?scope=family still deep-links to the folded-in within-family view.
 *
 * FORM. No board in the archive draws a leaderboard, so this is composed from
 * the vocabulary the boards DO draw: the lowercase wordmark of board 07/22, and
 * board 01's ranked-card object — a card per member with the rank as a pip
 * hanging off its top-left corner, and the leader carrying the orange edge and
 * bloom (`.club-b-card-lead`). An earlier pass rebuilt this as a hairline
 * ledger with no cards at all; the owner overruled that, and the shared card
 * classes (globals.css, board 01) are what the surfaces are built from now.
 *
 * CONTROLS are the shared `SegmentedRail` (canvas v2 L0), not three hand-rolled
 * rails — one keyboard model (roving tabindex inside a radiogroup), one focus
 * ring, one underline geometry across the whole app.
 *
 * COLOUR LAW: green/red belong to PRICE and appear nowhere on this surface — a
 * leaderboard has no prices. The only accent is the mode accent (family gold /
 * club volt orange / FTA metallic) on the leader card, the rank pip and the
 * "YOU" marker, all of which are brand/action. Belt colours are intrinsic and
 * carried by <BeltBadge/>, which is theme-independent by design.
 *
 * DARK: every colour here is a semantic token or a mode-accent ramp step that
 * flips at :root[data-theme="dark"]. There is no `dark:` variant anywhere.
 *
 * HONESTY: nothing is fabricated. There is no accuracy %, no win rate, and no
 * "credibility" score, because no such column exists in the RPC payload and
 * because publishing a member's hit rate is a performance claim — the board
 * ranks XP over a window and says so. Absent rows produce a stated empty, never
 * filler rows.
 *
 * FOUNDING STATE: the canvas draws the club at 25,842 members. Production is a
 * handful, most of them on the first rung. Both below-floor shapes are DESIGNED
 * here rather than left to look broken: a board with a couple of rows carries a
 * stated line about how young it is, and a board where every single member is
 * still on White Belt says so instead of implying a ladder that has not been
 * climbed yet.
 *
 * LOADING ≠ EMPTY: `loading` is derived from whether the LOADED key still
 * matches the requested one, so switching a window shows the card skeleton
 * again rather than flashing the previous window's rows or an empty state. It
 * is also why no state is set synchronously inside an effect.
 */

type Dimension = "individuals" | "families";
type Period = "7d" | "30d" | "all";
type Scope = "all" | "family";

const PERIODS: { id: Period; label: string }[] = [
  { id: "7d", label: "7 days" },
  { id: "30d", label: "30 days" },
  { id: "all", label: "All-time" },
];

const PERIOD_LONG: Record<Period, string> = {
  "7d": "Last 7 days",
  "30d": "Last 30 days",
  all: "All-time",
};

// Club register: trader-voiced windows that map onto the SAME trailing XP
// windows the family board uses — no new data source. "Rookies" is the recent
// (7-day) window, where new members surface fastest.
const CLUB_PERIODS: { id: Period; label: string }[] = [
  { id: "30d", label: "This month" },
  { id: "all", label: "All time" },
  { id: "7d", label: "Rookies" },
];

interface IndRow {
  rank: number;
  id: string;
  display_name: string | null;
  username: string | null;
  avatar_url: string | null;
  age_group: string | null;
  role: string | null;
  family_id: string | null;
  family_name: string | null;
  tier: FamilyTier;
  xp: number;
  is_me: boolean;
  is_my_family: boolean;
}

interface FamAvatar {
  display_name: string | null;
  avatar_url: string | null;
  username: string | null;
  xp: number;
}
interface FamRow {
  family_id: string;
  name: string;
  tier: FamilyTier;
  members: number;
  xp: number;
  avatars: FamAvatar[];
}

/* ── Surface primitives ─────────────────────────────────────────────────── */

/**
 * The board's ranked card. Board 01 hangs the rank off the top-left corner as a
 * pip and gives the #1 object an orange edge plus a soft bloom; both come from
 * the shared `.club-b-pip` / `.club-b-card-lead` rules rather than being
 * re-invented here.
 */
function RankedCard({
  rank,
  lead = false,
  children,
}: {
  rank: number;
  lead?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="relative pt-1.5">
      <span
        className={`club-b-pip absolute left-2 top-0 z-10 ${lead ? "club-b-pip-lead" : ""}`}
        style={{ width: 18, height: 18, fontSize: 10 }}
      >
        <span className="sr-only">Rank </span>
        {rank}
      </span>
      <div
        className={`club-b-card flex items-center gap-3 rounded-[14px] px-3.5 py-3 ${
          lead ? "club-b-card-lead" : ""
        }`}
      >
        {children}
      </div>
    </div>
  );
}

/* ── CLUB TERMINAL LEDGER (.planning/CLUB-TERMINAL-STYLE.md, 2026-08-09) ──
   The club branch renders the board as a hairline-separated ledger inside one
   dark card — mono two-digit ranks, Sora names, intrinsic belt chips, mono XP
   right-rail — instead of the family's ranked-card podium. Same RPC rows, same
   exclusions, same fold/pin/founding logic; only the skin branches. Rank #1
   carries the accent on its numeral (brand/action — never green/red, a board
   has no prices). Family/kid render below is untouched. */

/** One ledger line. `pinned` restyles it as a floating card for the
    bottom-of-viewport self pin, where a bare ledger row has no ground. */
function ClubLedgerRow({ row, pinned = false }: { row: IndRow; pinned?: boolean }) {
  const belt = beltForXp(row.xp);
  const lead = row.rank === 1;
  return (
    <div
      className={`flex items-center gap-3 px-3 py-[11px] ${
        pinned ? "rounded-[12px] border border-sand bg-card" : ""
      }`}
    >
      <span
        className={`w-7 shrink-0 font-mono text-[12px] font-semibold tabular-nums ${
          lead ? "text-accent" : "text-soft"
        }`}
      >
        <span className="sr-only">Rank </span>
        {String(row.rank).padStart(2, "0")}
      </span>
      <ProfileLink username={row.username} variant="avatar" className="shrink-0 self-center">
        <Avatar name={row.display_name} avatarUrl={row.avatar_url} xp={row.xp} size="sm" />
      </ProfileLink>
      <span className="min-w-0 flex-1 self-center">
        <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <ProfileLink
            username={row.username}
            className="max-w-[9rem] truncate font-display text-[13px] font-bold text-ink sm:max-w-none"
          >
            {row.display_name || "Member"}
          </ProfileLink>
          <BeltBadge rank={belt} size="xs" />
          {(row.is_me || pinned) && <YouMark />}
        </span>
      </span>
      <span className="shrink-0 self-center text-right">
        <span className="block font-mono text-[14px] font-semibold tabular-nums text-ink">
          {row.xp.toLocaleString()}
        </span>
        <span className="mt-0.5 block font-mono text-[8px] font-semibold uppercase tracking-[0.14em] text-soft">
          XP
        </span>
      </span>
    </div>
  );
}

/** The "this is you" marker. Accent = brand, and it sits on a fill, so the
    label is the declared on-accent colour and can never invert into it. */
function YouMark() {
  return (
    <span
      className="shrink-0 rounded px-1.5 py-0.5 text-[9px] font-display font-bold uppercase tracking-[0.12em]"
      style={{ background: "var(--accent-solid)", color: "var(--accent-on)" }}
    >
      You
    </span>
  );
}

/** A stated line beneath the board when it is below the scale it was drawn at.
    Not an error and not an empty — the board is real, it is just young, and
    saying so is more honest than a ladder of two. */
function FoundingNote({ children }: { children: React.ReactNode }) {
  return (
    <p className="mt-4 max-w-[62ch] text-[11px] leading-relaxed text-soft">{children}</p>
  );
}

/* ── Skeleton ─────────────────────────────────────────────────────────────
   Card-shaped, so the wait looks like the thing that arrives. */
function CardSkeleton() {
  return (
    <div className="space-y-2" aria-busy="true">
      {Array.from({ length: 6 }).map((_, i) => (
        <div
          key={i}
          className="club-b-card h-[62px] rounded-[14px] motion-safe:animate-pulse"
        />
      ))}
      <span className="sr-only">Loading the board</span>
    </div>
  );
}

function LeaderboardInner() {
  const supabase = createClient();
  const searchParams = useSearchParams();
  const router = useRouter();
  const isClub = useAppMode() === "club";

  // ?scope=family deep-links to the within-family view (old /family/leaderboard).
  const initialScope: Scope = searchParams.get("scope") === "family" ? "family" : "all";
  const [dimension, setDimension] = useState<Dimension>("individuals");
  const [period, setPeriod] = useState<Period>("7d");
  const [scope, setScope] = useState<Scope>(initialScope);

  const [ind, setInd] = useState<{ rows: IndRow[]; me: IndRow | null }>({ rows: [], me: null });
  /** The viewer is staff or a fixture — say so instead of hiding their rank
      with no explanation. */
  const [meOffBoard, setMeOffBoard] = useState(false);
  const [fams, setFams] = useState<FamRow[]>([]);
  const [myFamilyId, setMyFamilyId] = useState<string>("");

  // LOADING IS DERIVED, not set. Comparing the loaded key with the requested key
  // gives the same behaviour with no synchronous effect write — and it fixes the
  // stale-window flash for free, because a key that has not been loaded yet is
  // loading by definition.
  const queryKey = `${dimension}|${period}|${scope}`;
  const [loadedKey, setLoadedKey] = useState<string | null>(null);
  const loading = loadedKey !== queryKey;

  // Resolve my family once (for highlighting the Families dimension).
  useEffect(() => {
    (async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase
        .from("profiles")
        .select("family_id")
        .eq("id", user.id)
        .maybeSingle();
      setMyFamilyId(data?.family_id || "");
    })();
  }, [supabase]);

  const load = useCallback(
    async (key: string, alive: () => boolean) => {
      if (dimension === "individuals") {
        const { data } = await supabase.rpc("xp_leaderboard_individuals", {
          p_window: period,
          p_scope: scope,
        });
        if (!alive()) return;
        const payload = (data as { rows: IndRow[]; me: IndRow | null }) || { rows: [], me: null };

        // STAFF + FIXTURES OFF THE PUBLIC BOARD (src/lib/leaderboardExclusions).
        // Filtered here rather than in the RPC so the rule is one readable,
        // reviewable list instead of a predicate buried in SQL — and so the
        // within-family view (?scope=family), which is a household's own board,
        // gets the same treatment for free. Ranks are RE-NUMBERED after the
        // filter: a board that opens at #4 has visibly had rows removed, and a
        // rank is a position on the board you are looking at.
        const raw = payload.rows || [];
        const rows = raw
          .filter((r) => !isOffBoardIdentity(r))
          .map((r, i) => ({ ...r, rank: i + 1 }));

        const rawMe = payload.me || null;
        const meOnBoard = rawMe && !isOffBoardIdentity(rawMe) ? rawMe : null;
        // The pinned me-row keeps its server rank, less the excluded rows above
        // it — the only correction available, since rows beyond the returned
        // window are not visible from here.
        const me =
          meOnBoard && !rows.some((r) => r.id === meOnBoard.id)
            ? {
                ...meOnBoard,
                rank: Math.max(
                  1,
                  meOnBoard.rank -
                    raw.filter((r) => isOffBoardIdentity(r) && r.rank < meOnBoard.rank).length
                ),
              }
            : meOnBoard;

        setMeOffBoard(!!rawMe && !meOnBoard);
        setInd({ rows, me });
      } else {
        const { data } = await supabase.rpc("xp_leaderboard_families", { p_window: period });
        if (!alive()) return;
        setFams(((data as FamRow[]) || []).filter((f) => f.members > 0));
      }
      setLoadedKey(key);
    },
    [supabase, dimension, period, scope]
  );

  useEffect(() => {
    const controller = new AbortController();
    // Deferred to a microtask on purpose: the effect body itself must not run
    // anything that can reach a setState synchronously, or the whole render is
    // a cascading one (react-hooks/set-state-in-effect). Every write inside
    // `load` is also guarded by the abort signal, so a fast window switch drops
    // the older response instead of racing it to the state.
    void Promise.resolve().then(() => load(queryKey, () => !controller.signal.aborted));
    return () => controller.abort();
  }, [load, queryKey]);

  // Keep the URL honest so the view is shareable/back-navigable.
  function chooseScope(next: Scope) {
    setScope(next);
    const qs = next === "family" ? "?scope=family" : "";
    router.replace(`/leaderboard${qs}`, { scroll: false });
  }

  const periodLabel = PERIOD_LONG[period];
  // Is "me" already visible in the rows? If not, pin the me-row at the bottom.
  const meInRows = ind.me ? ind.rows.some((r) => r.id === ind.me!.id) : false;

  return (
    <div className="mx-auto max-w-2xl space-y-4 pb-16">
      <m.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }}>
        {isClub ? (
          /* Terminal masthead — caps, the loudest type on the screen. */
          <header>
            <h1 className="font-display text-[clamp(28px,8vw,34px)] font-black uppercase leading-[0.9] tracking-[-0.04em] text-ink">
              Leaderboard
            </h1>
            <p className="mt-2.5 max-w-[52ch] text-[13px] leading-relaxed text-soft">
              Ranked by the reps you put in — conviction, not luck. Every rated call,
              lesson, and rep earns XP.
            </p>
          </header>
        ) : (
          <BoardMast
            word="leaderboard"
            lede={
              dimension === "families"
                ? "A family's score is the average XP of its members, so families of every size compete fairly."
                : "Every lesson, quiz, card, and game earns XP and moves your belt. Climb the belts — friendly kid-vs-kid competition welcome."
            }
          />
        )}
      </m.div>

      {/* Controls. Club gets the trader-voiced window rail; family gets the
          dimension rail plus a quieter period/scope pair beneath it. All three
          are the same primitive — one keyboard model across the surface. */}
      <div className="space-y-3">
        {isClub ? (
          <SegmentedRail
            options={CLUB_PERIODS}
            value={period}
            onChange={setPeriod}
            ariaLabel="Leaderboard window"
            barClassName="bg-accent"
            fill
          />
        ) : (
          <>
            <SegmentedRail
              options={[
                { id: "individuals" as Dimension, label: "Individuals" },
                { id: "families" as Dimension, label: "Families" },
              ]}
              value={dimension}
              onChange={setDimension}
              ariaLabel="Leaderboard dimension"
              barClassName="bg-accent"
              fill
            />
            <div className="grid gap-3 sm:grid-cols-[3fr_2fr]">
              <SegmentedRail
                options={PERIODS}
                value={period}
                onChange={setPeriod}
                ariaLabel="Leaderboard period"
                barClassName="bg-accent"
                size="sm"
                fill
              />
              {dimension === "individuals" && (
                <SegmentedRail
                  options={[
                    { id: "all" as Scope, label: "Everyone" },
                    { id: "family" as Scope, label: "My family" },
                  ]}
                  value={scope}
                  onChange={chooseScope}
                  ariaLabel="Leaderboard scope"
                  barClassName="bg-accent"
                  size="sm"
                  fill
                />
              )}
            </div>
          </>
        )}
      </div>

      {loading ? (
        <CardSkeleton />
      ) : dimension === "individuals" ? (
        <IndividualsBoard
          ind={ind}
          meInRows={meInRows}
          periodLabel={periodLabel}
          scope={scope}
          meOffBoard={meOffBoard}
          club={isClub}
        />
      ) : (
        <FamiliesBoard fams={fams} myFamilyId={myFamilyId} periodLabel={periodLabel} />
      )}

      {/* How rank works — honest about the XP that actually drives rank today.
          No accuracy %, no win rate: neither exists in the payload, and neither
          may be added to it. */}
      {isClub && (
        <section className="space-y-2.5 pt-3">
          {/* Terminal section head — white bold caps, never tiny gray mono. */}
          <h2 className="text-[13px] font-bold uppercase tracking-[0.06em] text-ink">
            How rank works
          </h2>
          <p className="max-w-[62ch] text-[11.5px] leading-relaxed text-soft">
            Rank is your XP over the selected window — earned by rating calls, finishing
            lessons, and showing up in the room. It rewards consistent reps over one lucky
            week, so a loud one-off never outranks a steady operator. Windows are trailing,
            so every board is always a full period.
          </p>
          <div className="flex flex-wrap gap-x-6 gap-y-2">
            <TextAction href="/belts">The belt ladder</TextAction>
            <TextAction href="/progress">Your profile</TextAction>
          </div>
        </section>
      )}
    </div>
  );
}

/* ── Individuals ──────────────────────────────────────────────────────────

   THE PODIUM. A board's top three are the reason anyone opens a leaderboard,
   and rendering them as "the first three rows of a list" throws that away. So
   the top three leave the list and become a podium object: 2nd and 3rd flank a
   1st place that sits physically higher, each drawn vertically — face, name,
   belt, number — the way a podium actually reads.

   THE RISE. On first paint the three rise into place from the BOTTOM of the
   podium up: 3rd, then 2nd, then 1st, 100ms apart. The order is the point. A
   top-down reveal walks the eye off the winner; this one walks it up and lands
   on them. Spring 300/22 — quick, one small settle, no bounce that would read
   as a toy.

   REDUCED MOTION collapses every one of these to a 120ms opacity fade with no
   delay and no travel, here and in the rows below.
   ───────────────────────────────────────────────────────────────────────── */

/** The rise, shared by the podium and the rows so one preference check governs
    the whole board. `place` is 1-based from the top of the podium. */
function riseProps(reduce: boolean, place = 1) {
  if (reduce) {
    return {
      initial: { opacity: 0 },
      animate: { opacity: 1 },
      transition: { duration: 0.12 },
    } as const;
  }
  return {
    initial: { opacity: 0, y: 16 },
    animate: { opacity: 1, y: 0 },
    transition: {
      type: "spring" as const,
      stiffness: 300,
      damping: 22,
      delay: (3 - place) * 0.1,
    },
  };
}

/** One plinth. Vertical, because a podium is vertical. */
function PodiumCard({ row, place, reduce }: { row: IndRow; place: number; reduce: boolean }) {
  const belt = beltForXp(row.xp);
  const lead = place === 1;
  return (
    <motion.div
      layout
      {...riseProps(reduce, place)}
      // DOM order stays 1-2-3 so reading and tab order match rank; only the
      // painted order is the podium's 2-1-3.
      className={`relative pt-1.5 ${
        lead ? "sm:order-2 sm:-mt-3" : place === 2 ? "sm:order-1" : "sm:order-3"
      }`}
    >
      <span
        className={`club-b-pip absolute left-2 top-0 z-10 ${lead ? "club-b-pip-lead" : ""}`}
        style={{ width: 18, height: 18, fontSize: 10 }}
      >
        <span className="sr-only">Rank </span>
        {place}
      </span>
      <div
        className={`club-b-card flex h-full flex-col items-center gap-1.5 rounded-[14px] px-3 pb-3.5 text-center ${
          lead ? "club-b-card-lead pt-6" : "pt-5"
        }`}
      >
        <ProfileLink username={row.username} variant="avatar" className="shrink-0">
          <Avatar
            name={row.display_name}
            avatarUrl={row.avatar_url}
            xp={row.xp}
            size={lead ? "xl" : "lg"}
          />
        </ProfileLink>
        <ProfileLink
          username={row.username}
          className="mt-0.5 max-w-full truncate font-display text-[13px] font-bold text-ink"
        >
          {row.display_name || "Member"}
        </ProfileLink>
        <span className="flex flex-wrap items-center justify-center gap-1.5">
          <BeltBadge rank={belt} size="xs" />
          {row.is_me && <YouMark />}
        </span>
        <span className="mt-0.5">
          <span
            className={`block font-mono font-semibold tabular-nums text-ink ${
              lead ? "text-[20px]" : "text-[16px]"
            }`}
          >
            {row.xp.toLocaleString()}
          </span>
          <span className="mt-0.5 block font-display text-[8px] font-bold uppercase tracking-[0.14em] text-soft">
            XP
          </span>
        </span>
      </div>
    </motion.div>
  );
}

function IndividualRow({ row, pinned }: { row: IndRow; pinned?: boolean }) {
  const belt = beltForXp(row.xp);
  return (
    <RankedCard rank={row.rank} lead={row.rank === 1}>
      <ProfileLink username={row.username} variant="avatar" className="shrink-0 self-center">
        <Avatar name={row.display_name} avatarUrl={row.avatar_url} xp={row.xp} size="md" />
      </ProfileLink>
      <span className="min-w-0 flex-1 self-center">
        <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <ProfileLink
            username={row.username}
            className="max-w-[9rem] truncate font-display text-[13px] font-bold text-ink sm:max-w-none"
          >
            {row.display_name || "Member"}
          </ProfileLink>
          {/* The grey person-icon chip that used to sit here is GONE. It was a
              lucide glyph in a neutral lozenge repeating what the avatar and
              the name already said, and on a rank board the reader is scanning
              for a belt and a number — a second grey chip in that scan path is
              pure interference. Age stays where it belongs: on posts and
              comments, where it is a safety cue. */}
          <BeltBadge rank={belt} size="sm" />
          {(row.is_me || pinned) && <YouMark />}
        </span>
        <span className="mt-0.5 block truncate font-mono text-[9.5px] uppercase tracking-[0.12em] text-soft">
          {row.family_name || (row.username ? `@${row.username}` : belt.label)}
        </span>
      </span>
      <span className="shrink-0 self-center text-right">
        <span className="block font-mono text-[15px] font-semibold tabular-nums text-ink">
          {row.xp.toLocaleString()}
        </span>
        <span className="mt-0.5 block text-[8px] font-display font-bold uppercase tracking-[0.14em] text-soft">
          XP
        </span>
      </span>
    </RankedCard>
  );
}

/** How many trailing zero-XP rows it takes before hiding them is worth a
    control. Below this the fold costs more attention than it saves. */
const TAIL_FOLD_MIN = 3;

function IndividualsBoard({
  ind,
  meInRows,
  periodLabel,
  scope,
  meOffBoard = false,
  club = false,
}: {
  ind: { rows: IndRow[]; me: IndRow | null };
  meInRows: boolean;
  periodLabel: string;
  scope: Scope;
  meOffBoard?: boolean;
  /** Club terminal skin: hairline ledger, no podium. Family cards untouched. */
  club?: boolean;
}) {
  const reduce = useReducedMotion() ?? false;
  const [showTail, setShowTail] = useState(false);

  // SELF-VISIBILITY. The member's own row is the one row they came to find, and
  // on a full board it is usually below the fold. An observer on the real row
  // tells us when it has scrolled away; while it has, a copy of it pins to the
  // bottom of the viewport. No polling, no scroll handler, and the pin is never
  // on screen at the same time as the row it duplicates.
  const selfRef = useRef<HTMLDivElement | null>(null);
  const [selfVisible, setSelfVisible] = useState(true);

  if (ind.rows.length === 0) {
    return (
      <EmptyCard
        title={scope === "family" ? "No family XP in this window" : "No XP yet in this window"}
        body={`Complete a lesson, play a game, or review your Daily 5 to appear on the ${periodLabel.toLowerCase()} board.`}
        action={<TextAction href="/courses">Earn your first XP</TextAction>}
      />
    );
  }

  // FOUNDING STATE. Two below-floor shapes, both real and both designed.
  const everyoneFirstRung = ind.rows.every((r) => beltForXp(r.xp).belt.key === "white");
  const thin = ind.rows.length < 4;

  // THE ZERO TAIL. A window's board ends in a run of members who earned nothing
  // in it. Those rows are true and they belong to real people, so they are not
  // dropped — but a screen of 0s buries the part of the board that has movement
  // in it, so the run folds behind a control that says exactly how many. If
  // EVERY row is a zero the fold is skipped: that is not a tail, that is the
  // whole board, and hiding it would leave nothing.
  let cut = ind.rows.length;
  while (cut > 0 && ind.rows[cut - 1].xp === 0) cut--;
  const tailCount = cut === 0 ? 0 : ind.rows.length - cut;
  const folded = tailCount >= TAIL_FOLD_MIN && !showTail;
  const visible = folded ? ind.rows.slice(0, cut) : ind.rows;

  // The podium only exists once there are three to stand on it. Below that the
  // board is a short list and should look like one. The CLUB terminal skin
  // never builds one — its board is a ledger, and rank lives in the mono rail.
  const hasPodium = !club && visible.length >= 3;
  const podium = hasPodium ? visible.slice(0, 3) : [];
  const rest = hasPodium ? visible.slice(3) : visible;

  const myRow = ind.rows.find((r) => r.is_me) ?? ind.me;
  // The observed element is wherever the member actually is — their row, or the
  // podium block when they are standing on it. Without this second case a top-3
  // member scrolls past themselves and never gets the pin.
  const myInPodium = !!myRow && podium.some((r) => r.id === myRow.id);
  const selfOnScreen = !!myRow && visible.some((r) => r.id === myRow.id) && selfVisible;

  return (
    <div>
      {hasPodium && (
        <div className="grid gap-2 sm:grid-cols-3 sm:items-end" ref={myInPodium ? selfRef : undefined}>
          {podium.map((row, i) => (
            <PodiumCard key={row.id} row={row} place={i + 1} reduce={reduce} />
          ))}
        </div>
      )}

      {club ? (
        /* THE LEDGER — one dark card, hairline-separated rows (.f0-ledger),
           mono ranks and XP. Same FLIP layout animation as the family rows so
           a rank CHANGE still travels instead of teleporting. */
        <div className="rounded-[14px] border border-sand bg-card px-1 py-0.5">
          <div className="f0-ledger">
            {rest.map((row) => (
              <motion.div
                key={row.id}
                layout
                {...riseProps(reduce)}
                ref={myRow && row.id === myRow.id ? selfRef : undefined}
              >
                <ClubLedgerRow row={row} />
              </motion.div>
            ))}
          </div>
        </div>
      ) : (
        <div className={hasPodium ? "mt-2 space-y-2" : "space-y-2"}>
          {rest.map((row) => (
            <motion.div
              key={row.id}
              // FLIP. `layout` is what makes a rank CHANGE legible: when the
              // window switches and a member moves from 9th to 4th, the row
              // travels there instead of teleporting.
              layout
              {...riseProps(reduce)}
              ref={myRow && row.id === myRow.id ? selfRef : undefined}
            >
              <IndividualRow row={row} />
            </motion.div>
          ))}
        </div>
      )}

      {folded && (
        <div className="pt-3">
          <TextAction onClick={() => setShowTail(true)}>
            Show all {ind.rows.length.toLocaleString()} — {tailCount.toLocaleString()} member
            {tailCount === 1 ? "" : "s"} earned no XP in this window
          </TextAction>
        </div>
      )}

      {everyoneFirstRung ? (
        <FoundingNote>
          Everyone on this board is still on White Belt. The ladder is real and nobody has
          climbed it yet — the first member to finish a course changes that.{" "}
          <TextAction href="/belts">See the belts</TextAction>
        </FoundingNote>
      ) : thin ? (
        <FoundingNote>
          {ind.rows.length === 1 ? "One member has" : `${ind.rows.length} members have`} earned
          XP in the {periodLabel.toLowerCase()} window. The board fills out as the Club does.
        </FoundingNote>
      ) : null}

      {/* A staff or fixture account has no rank here BY DESIGN. Saying so beats
          a missing row the viewer has to guess at. */}
      {meOffBoard && (
        <FoundingNote>
          Staff and test accounts are kept off the public board, so this account has no
          rank on it.
        </FoundingNote>
      )}

      {/* THE PIN. Sticky to the bottom of the viewport for as long as the real
          row is out of sight — including the case where the member is off the
          returned window entirely and has no real row at all, which is exactly
          when knowing your rank matters most. */}
      {myRow && !selfOnScreen && (
        <div className="sticky bottom-2 z-20 mt-3 [filter:drop-shadow(0_6px_16px_rgba(0,0,0,0.18))]">
          {club ? (
            <ClubLedgerRow row={myRow} pinned />
          ) : (
            <IndividualRow row={myRow} pinned={!meInRows} />
          )}
        </div>
      )}

      <SelfObserver targetRef={selfRef} onChange={setSelfVisible} deps={[visible.length, myRow?.id, myInPodium]} />
    </div>
  );
}

/**
 * The observer, split out so IndividualsBoard's early return for the empty
 * board cannot sit above a hook. It renders nothing; it exists to own an
 * effect. State is only ever written from the observer callback — never
 * synchronously in the effect body — which is the same rule the data loads on
 * this page follow (react-hooks/set-state-in-effect).
 */
function SelfObserver({
  targetRef,
  onChange,
  deps,
}: {
  targetRef: React.RefObject<HTMLDivElement | null>;
  onChange: (visible: boolean) => void;
  deps: unknown[];
}) {
  useEffect(() => {
    const el = targetRef.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(([entry]) => onChange(entry.isIntersecting), {
      // A row half-under the pin still counts as gone — otherwise the pin
      // flickers in and out as the row grazes the bottom edge.
      rootMargin: "0px 0px -72px 0px",
    });
    io.observe(el);
    return () => io.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  return null;
}

/* ── Families ─────────────────────────────────────────────────────────────── */
function FamiliesBoard({
  fams,
  myFamilyId,
  periodLabel,
}: {
  fams: FamRow[];
  myFamilyId: string;
  periodLabel: string;
}) {
  if (fams.length === 0) {
    return (
      <EmptyCard
        title="No family XP in this window"
        body={`Families appear here once a member earns XP in the ${periodLabel.toLowerCase()} window.`}
      />
    );
  }
  return (
    <div>
      <div className="f0-stagger space-y-2">
        {fams.map((row, i) => {
          const rank = i + 1;
          const mine = row.family_id === myFamilyId;
          return (
            <div key={row.family_id} style={{ "--i": Math.min(i, 12) } as React.CSSProperties}>
              <RankedCard rank={rank} lead={rank === 1}>
                {/* Avatar cluster — the family's identity object. f0-stack owns
                    the overlap and the ring; the ring colour is the surface
                    BEHIND the stack, which on a card is the card colour. */}
                <span className="f0-stack shrink-0 self-center">
                  {row.avatars.slice(0, 4).map((a, j) => (
                    <Avatar
                      key={j}
                      name={a.display_name}
                      avatarUrl={a.avatar_url}
                      xp={a.xp}
                      size="sm"
                    />
                  ))}
                  {row.members > 4 && (
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-sand font-mono text-[10px] font-bold text-soft">
                      +{row.members - 4}
                    </span>
                  )}
                </span>
                <span className="min-w-0 flex-1 self-center">
                  <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    <span className="truncate font-display text-[13px] font-bold text-ink">
                      {row.name}
                    </span>
                    <TierBadge tier={row.tier} size="xs" />
                    {mine && <YouMark />}
                  </span>
                  <span className="mt-0.5 block font-mono text-[9.5px] uppercase tracking-[0.12em] text-soft">
                    {row.members} member{row.members === 1 ? "" : "s"}
                  </span>
                </span>
                <span className="shrink-0 self-center text-right">
                  <span className="block font-mono text-[15px] font-semibold tabular-nums text-ink">
                    {row.xp.toLocaleString()}
                  </span>
                  <span className="mt-0.5 block text-[8px] font-display font-bold uppercase tracking-[0.14em] text-soft">
                    Avg XP
                  </span>
                </span>
              </RankedCard>
            </div>
          );
        })}
      </div>
      {fams.length < 4 && (
        <FoundingNote>
          {fams.length === 1 ? "One family is" : `${fams.length} families are`} on the board for
          the {periodLabel.toLowerCase()} window. Every family that earns XP joins it.
        </FoundingNote>
      )}
    </div>
  );
}

export default function LeaderboardPage() {
  return (
    <Suspense
      fallback={
        <div className="mx-auto max-w-2xl">
          <CardSkeleton />
        </div>
      }
    >
      <LeaderboardInner />
    </Suspense>
  );
}
