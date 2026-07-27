"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { m } from "@/lib/motion";
import { createClient } from "@/lib/supabase/client";
import { useAppMode } from "@/lib/useAppMode";
import type { FamilyTier } from "@/lib/tier";
import { beltForXp } from "@/lib/belts";
import Avatar from "@/components/Avatar";
import BeltBadge from "@/components/BeltBadge";
import AgeBadge from "@/components/community/AgeBadge";
import TierBadge from "@/components/TierBadge";
import ProfileLink from "@/components/ProfileLink";
import { SegmentedRail } from "@/components/canvas2";
import { DisplayHead, EmptyLine, TextAction } from "@/components/f0/parts";

/**
 * THE BOARD — two dimensions (Individuals | Families) × three trailing periods
 * (Last 7 days | Last 30 days | All-time). Data comes from the definer RPCs in
 * migration 099; belts + levels derive client-side from the returned XP
 * (src/lib/belts.ts). Periods are trailing/rolling and labelled honestly
 * ("Last 7 days") — never calendar buckets, so a window is always full. The
 * Individuals dimension keeps its scope switch (Everyone | My family);
 * ?scope=family still deep-links to the folded-in within-family view.
 *
 * FORM (canvas v2): a ranked HAIRLINE LEDGER, not a stack of bordered cards.
 * The rank does the identity work as a LARGE numeral in the left margin — top
 * three in full ink, the rest muted — so position is legible at a glance without
 * a single box, chip, or medal. Everything else is type: name at the body
 * weight, belt/age as the only badges, and the ranked metric in mono so the XP
 * column aligns as a true column.
 *
 * CONTROLS are the shared `SegmentedRail` (canvas v2 L0), not three hand-rolled
 * rails. Every one-of-N control in the app now has one keyboard model (roving
 * tabindex inside a radiogroup), one focus ring, and one underline geometry —
 * these three were previously a local re-implementation that drifted from it.
 *
 * COLOUR LAW: green/red belong to PRICE and appear nowhere on this surface —
 * a leaderboard has no prices. The only accent is the mode accent (family gold
 * / club volt orange / FTA metallic) on the "YOU" marker and the active rail
 * bar, both of which are brand/action. Belt colours are intrinsic to the belt
 * and carried by <BeltBadge/>, which is theme-independent by design.
 *
 * DARK: every colour here is a semantic token (ink / soft / sand / paper) or a
 * mode-accent ramp step that flips at :root[data-theme="dark"]. There is no
 * `dark:` variant anywhere — orange TEXT uses text-gold-700 (the ramp that
 * flips), never text-volt-* (frozen across themes).
 *
 * HONESTY: nothing is fabricated. There is no accuracy %, no win rate, and no
 * "credibility" score, because no such column exists in the RPC payload and
 * because publishing a member's hit rate is a performance claim — the board
 * ranks XP over a window and says so. Absent rows produce a stated empty, never
 * filler rows.
 *
 * FOUNDING STATE (plan §0.5): the canvas draws this board at 25,842 members.
 * Production is a handful, most of them on the first rung. Both below-floor
 * shapes are DESIGNED here rather than left to look broken: a board with a
 * couple of rows carries a stated line about how young it is, and a board where
 * every single member is still on White Belt says so instead of implying a
 * ladder that has not been climbed yet.
 *
 * LOADING ≠ EMPTY: `loading` is derived from whether the LOADED key still
 * matches the requested one, so switching a window shows the ledger skeleton
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

/** The rank numeral — the identity object of every row. Large, tabular, and
    muted except for the podium, which earns full ink. No medal, no box. */
function Rank({ n }: { n: number }) {
  return (
    <span
      className={`w-9 shrink-0 self-center text-right font-display text-display-3 font-extrabold tabular-nums sm:w-12 ${
        n <= 3 ? "text-ink" : "text-soft"
      }`}
    >
      <span className="sr-only">Rank </span>
      {n}
    </span>
  );
}

/** The "this is you" marker. Accent = brand, and it sits on a fill, so the
    label is night-950 (never text-ink, which flips near-white at night). */
function YouMark() {
  return (
    <span className="shrink-0 rounded bg-accent px-1.5 py-0.5 text-[9px] font-display font-bold uppercase tracking-[0.12em] text-night-950">
      You
    </span>
  );
}

/** A stated line beneath the ledger when the board is below the scale it was
    drawn at. Not an error and not an empty — the board is real, it is just
    young, and saying so is more honest than a ladder of two. */
function FoundingNote({ children }: { children: React.ReactNode }) {
  return (
    <p className="f0-rule-top mt-6 max-w-[62ch] pt-4 text-[13px] leading-relaxed text-soft">
      {children}
    </p>
  );
}

/* ── Skeleton ─────────────────────────────────────────────────────────────
   Ledger-shaped, so the wait looks like the thing that arrives. */
function LedgerSkeleton() {
  return (
    <div className="f0-ledger" aria-busy="true">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="f0-ledger-row">
          <span className="h-5 w-9 shrink-0 rounded bg-sand motion-safe:animate-pulse sm:w-12" />
          <span className="h-9 w-9 shrink-0 rounded-full bg-sand motion-safe:animate-pulse" />
          <span className="min-w-0 flex-1 space-y-2">
            <span className="block h-3.5 w-32 rounded bg-sand motion-safe:animate-pulse" />
            <span className="block h-2.5 w-20 rounded bg-sand motion-safe:animate-pulse" />
          </span>
          <span className="h-4 w-12 shrink-0 rounded bg-sand motion-safe:animate-pulse" />
        </div>
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
  const [fams, setFams] = useState<FamRow[]>([]);
  const [myFamilyId, setMyFamilyId] = useState<string>("");

  // LOADING IS DERIVED, not set. The previous version called setLoading(true)
  // synchronously from inside the effect, which is the repo-wide
  // react-hooks/set-state-in-effect pattern; comparing the loaded key with the
  // requested key gives the same behaviour with no synchronous effect write —
  // and it fixes the stale-window flash for free, because a key that has not
  // been loaded yet is loading by definition.
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
        setInd({ rows: payload.rows || [], me: payload.me || null });
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
    void Promise.resolve().then(() =>
      load(queryKey, () => !controller.signal.aborted)
    );
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
    <div className="mx-auto max-w-3xl space-y-8">
      <m.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }}>
        <DisplayHead
          eyebrow={isClub ? "Where you stand" : "Standing"}
          title="Leaderboard"
          lede={
            isClub
              ? "Ranked by the reps you put in — conviction, not luck. Every rated call, lesson, and rep earns XP."
              : dimension === "families"
                ? "A family's score is the average XP of its members, so families of every size compete fairly."
                : "Every lesson, quiz, card, and game earns XP and moves your belt. Climb the belts — friendly kid-vs-kid competition welcome."
          }
        />
      </m.div>

      {/* Controls. Club gets the trader-voiced window rail; family gets the
          dimension rail plus a quieter period/scope pair beneath it. All three
          are the same primitive — one keyboard model across the surface. */}
      <div className="space-y-4">
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
            <div className="grid gap-4 sm:grid-cols-[3fr_2fr]">
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
        <LedgerSkeleton />
      ) : dimension === "individuals" ? (
        <IndividualsBoard ind={ind} meInRows={meInRows} periodLabel={periodLabel} scope={scope} />
      ) : (
        <FamiliesBoard fams={fams} myFamilyId={myFamilyId} periodLabel={periodLabel} />
      )}

      {/* How rank works — honest about the XP that actually drives rank today.
          No accuracy %, no win rate: neither exists in the payload, and neither
          may be added to it. */}
      {isClub && (
        <section className="f0-rule-top pt-5">
          <h2 className="text-eyebrow font-display font-bold uppercase text-soft">
            How rank works
          </h2>
          <p className="mt-2.5 max-w-xl text-[14px] leading-relaxed text-soft">
            Rank is your XP over the selected window — earned by rating calls, finishing
            lessons, and showing up in the room. It rewards consistent reps over one lucky
            week, so a loud one-off never outranks a steady operator. Windows are trailing,
            so every board is always a full period.
          </p>
        </section>
      )}
    </div>
  );
}

/* ── Individuals ──────────────────────────────────────────────────────────── */
function IndividualRow({ row, pinned }: { row: IndRow; pinned?: boolean }) {
  const belt = beltForXp(row.xp);
  return (
    <div className="f0-ledger-row">
      <Rank n={row.rank} />
      <ProfileLink username={row.username} variant="avatar" className="shrink-0 self-center">
        <Avatar name={row.display_name} avatarUrl={row.avatar_url} xp={row.xp} size="md" />
      </ProfileLink>
      <span className="min-w-0 flex-1 self-center">
        <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <ProfileLink
            username={row.username}
            className="max-w-[9rem] truncate font-display text-[15px] font-bold text-ink sm:max-w-none"
          >
            {row.display_name || "Member"}
          </ProfileLink>
          <AgeBadge role={row.role} ageGroup={row.age_group} />
          <BeltBadge rank={belt} size="xs" />
          {(row.is_me || pinned) && <YouMark />}
        </span>
        <span className="mt-1 block truncate font-mono text-[10px] uppercase tracking-[0.14em] text-soft">
          {row.family_name || (row.username ? `@${row.username}` : belt.label)}
        </span>
      </span>
      <span className="shrink-0 self-center text-right">
        <span className="block font-mono text-[15px] font-semibold tabular-nums text-ink">
          {row.xp.toLocaleString()}
        </span>
        <span className="mt-0.5 block text-eyebrow font-display font-bold uppercase text-soft">
          XP
        </span>
      </span>
    </div>
  );
}

function IndividualsBoard({
  ind,
  meInRows,
  periodLabel,
  scope,
}: {
  ind: { rows: IndRow[]; me: IndRow | null };
  meInRows: boolean;
  periodLabel: string;
  scope: Scope;
}) {
  if (ind.rows.length === 0) {
    return (
      <EmptyLine
        title={scope === "family" ? "No family XP in this window" : "No XP yet in this window"}
        body={`Complete a lesson, play a game, or review your Daily 5 to appear on the ${periodLabel.toLowerCase()} board.`}
        action={
          <TextAction href="/courses">Earn your first XP</TextAction>
        }
      />
    );
  }

  // FOUNDING STATE. Two below-floor shapes, both real and both designed.
  const everyoneFirstRung = ind.rows.every((r) => beltForXp(r.xp).belt.key === "white");
  const thin = ind.rows.length < 4;

  return (
    <div>
      <div className="f0-ledger f0-stagger">
        {ind.rows.map((row, i) => (
          <div key={row.id} style={{ "--i": Math.min(i, 12) } as React.CSSProperties}>
            <IndividualRow row={row} />
          </div>
        ))}
      </div>

      {everyoneFirstRung ? (
        <FoundingNote>
          Everyone on this board is still on White Belt. The ladder is real and
          nobody has climbed it yet — the first member to finish a course changes
          that. <TextAction href="/belts">See the belts</TextAction>
        </FoundingNote>
      ) : thin ? (
        <FoundingNote>
          {ind.rows.length === 1 ? "One member has" : `${ind.rows.length} members have`}{" "}
          earned XP in the {periodLabel.toLowerCase()} window. The board fills out
          as the Club does.
        </FoundingNote>
      ) : null}

      {/* Pin "me" when outside the visible rows. */}
      {ind.me && !meInRows && (
        <div className="mt-6">
          <p className="text-eyebrow font-display font-bold uppercase text-soft">Your rank</p>
          <div className="f0-ledger mt-1">
            <IndividualRow row={ind.me} pinned />
          </div>
        </div>
      )}
    </div>
  );
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
      <EmptyLine
        title="No family XP in this window"
        body={`Families appear here once a member earns XP in the ${periodLabel.toLowerCase()} window.`}
      />
    );
  }
  return (
    <div>
      <div className="f0-ledger f0-stagger">
        {fams.map((row, i) => {
          const rank = i + 1;
          const mine = row.family_id === myFamilyId;
          return (
            <div key={row.family_id} style={{ "--i": Math.min(i, 12) } as React.CSSProperties}>
              <div className="f0-ledger-row">
                <Rank n={rank} />
                {/* Avatar cluster — the family's identity object. f0-stack owns
                    the overlap and the ring; the ring colour is the surface
                    BEHIND the stack, which on a ledger row is the paper. */}
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
                    <span className="truncate font-display text-[15px] font-bold text-ink">
                      {row.name}
                    </span>
                    <TierBadge tier={row.tier} size="xs" />
                    {mine && <YouMark />}
                  </span>
                  <span className="mt-1 block font-mono text-[10px] uppercase tracking-[0.14em] text-soft">
                    {row.members} member{row.members === 1 ? "" : "s"}
                  </span>
                </span>
                <span className="shrink-0 self-center text-right">
                  <span className="block font-mono text-[15px] font-semibold tabular-nums text-ink">
                    {row.xp.toLocaleString()}
                  </span>
                  <span className="mt-0.5 block text-eyebrow font-display font-bold uppercase text-soft">
                    Avg XP
                  </span>
                </span>
              </div>
            </div>
          );
        })}
      </div>
      {fams.length < 4 && (
        <FoundingNote>
          {fams.length === 1 ? "One family is" : `${fams.length} families are`} on
          the board for the {periodLabel.toLowerCase()} window. Every family that
          earns XP joins it.
        </FoundingNote>
      )}
    </div>
  );
}

export default function LeaderboardPage() {
  return (
    <Suspense
      fallback={
        <div className="mx-auto max-w-3xl">
          <LedgerSkeleton />
        </div>
      }
    >
      <LeaderboardInner />
    </Suspense>
  );
}
