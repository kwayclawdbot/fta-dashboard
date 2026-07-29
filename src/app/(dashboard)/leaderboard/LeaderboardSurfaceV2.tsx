"use client";

import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { m, useReducedMotion } from "@/lib/motion";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { useAppMode } from "@/lib/useAppMode";
import type { FamilyTier } from "@/lib/tier";
import { beltForXp, beltProgress, type Belt } from "@/lib/belts";
import { isOffBoardIdentity } from "@/lib/leaderboardExclusions";
import V2Surface from "@/components/clubhome/v2/V2Surface";
import { ScriptTitle, Kicker, Card } from "@/components/cc/ui";

/* ══════════════════════════════════════════════════════════════════════════
   THE LADDER · boards R1 (club) + R2 (family) — the v2 (cc canvas) render.

   The design-v2 branch of the leaderboard route. It runs the SAME definer RPCs
   (xp_leaderboard_individuals / _families, migration 099) and the SAME
   staff/fixture exclusions (leaderboardExclusions) as the v1 surface, re-drawn
   to the R1/R2 canvas notes: script "the ladder", period pills over the REAL
   trailing windows, belt-ringed ranked rows with XP ⚡ mono, the pinned YOU
   row, and the family ladder (stacked member avatars, avg XP) in family mode.

   HONESTY (carried from v1, per the R1 note — nothing weakened):
   • NO "graded calls · % hit" meta. Those columns do not exist in the payload
     and would be a fabricated performance claim. Rank = XP over the window.
   • Rank MOVEMENT = the layout-FLIP travel when a window switches (the real,
     honest signal). No invented per-row "▲3 today" delta ships, because no
     rank-delta series is stored.
   • The pinned YOU row shows real rank + real XP. NO "190 ⚡ to #30"
     progress-to-next bar — the XP of the member ranked above is not in the
     returned window, so it isn't reliably computable; the notes say omit it.
   • Cohort dropdown ("Rookies ▾") is NOT rendered in club mode — v1 has no
     cohort filter there. Family mode keeps its real dimension/scope filters.

   KID VIEW: v1 does NOT differentiate under-13s on this board — kids are ranked
   inline like everyone else (kid-inclusive). Per the preserve-behaviour rule,
   v2 keeps that exactly; the canvas's "NO RANKS UNDER 13" kid-safe layout is a
   PRODUCT decision, flagged in the lane report, NOT unilaterally shipped here.
   ══════════════════════════════════════════════════════════════════════════ */

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
// Club trader-voiced windows onto the SAME trailing XP windows (no new source).
const CLUB_PERIODS: { id: Period; label: string }[] = [
  { id: "30d", label: "This week" },
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

/* ── primitives ─────────────────────────────────────────────────────────── */

/** Pill row control (period / dimension / scope). Active = orange fill. */
function PillRow<T extends string>({
  options,
  value,
  onChange,
  ariaLabel,
  size = "md",
}: {
  options: { id: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
  ariaLabel: string;
  size?: "md" | "sm";
}) {
  return (
    <div className="flex gap-1.5" role="radiogroup" aria-label={ariaLabel}>
      {options.map((o) => {
        const on = o.id === value;
        return (
          <button
            key={o.id}
            type="button"
            role="radio"
            aria-checked={on}
            onClick={() => onChange(o.id)}
            className={`flex-1 rounded-full font-semibold uppercase tracking-[0.08em] transition-colors ${
              size === "sm" ? "px-2.5 py-1.5 text-[10px]" : "px-3.5 py-2 text-[11px]"
            }`}
            style={
              on
                ? { background: "var(--cc-orange)", color: "var(--cc-orange-deep)" }
                : { background: "var(--cc-card2)", color: "var(--cc-soft)", border: "1px solid var(--cc-line)" }
            }
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

/** Belt-ringed avatar (image or initials). Black belts wear the orange live node. */
function BeltRing({
  name,
  avatarUrl,
  belt,
  size = 38,
}: {
  name: string | null;
  avatarUrl: string | null;
  belt: Belt;
  size?: number;
}) {
  const ring = belt.key === "white" || belt.key === "black" ? belt.borderHex : belt.hex;
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <span className="block h-full w-full rounded-full" style={{ padding: 2.5, background: ring }}>
        <span
          className="grid h-full w-full place-items-center overflow-hidden rounded-full"
          style={{ background: "var(--cc-card2)", border: "2px solid var(--cc-bg)" }}
        >
          {avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={avatarUrl} alt="" className="h-full w-full rounded-full object-cover" />
          ) : (
            <span className="font-extrabold" style={{ color: "var(--cc-ink)", fontSize: Math.round(size * 0.34) }}>
              {(name || "?").slice(0, 1).toUpperCase()}
            </span>
          )}
        </span>
      </span>
      {belt.key === "black" && (
        <span
          className="absolute -right-0.5 -top-0.5 rounded-full"
          style={{ width: 9, height: 9, background: "var(--cc-orange)", border: "2px solid var(--cc-bg)" }}
        />
      )}
    </div>
  );
}

function BeltChip({ belt }: { belt: Belt }) {
  return (
    <span
      className="inline-block shrink-0 rounded px-1.5 py-px text-[9.5px] font-bold uppercase tracking-[0.04em]"
      style={{ backgroundColor: belt.hex, color: belt.onHex }}
    >
      {belt.name}
    </span>
  );
}

function YouMark() {
  return (
    <span
      className="shrink-0 rounded px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-[0.12em]"
      style={{ background: "var(--cc-orange)", color: "var(--cc-orange-deep)" }}
    >
      You
    </span>
  );
}

/** One ranked row. `pinned` = the sticky self-copy (orange gradient edge). */
function LadderRow({ row, pinned = false }: { row: IndRow; pinned?: boolean }) {
  const belt = beltForXp(row.xp).belt;
  const isLead = row.rank === 1;
  // Pinned self-row carries the artboard's "progress bar to next" — but honestly:
  // the XP to the next RANK isn't in the window payload, so we show the real,
  // computable progress toward the next BELT (from the same XP ledger).
  const prog = pinned ? beltProgress(row.xp) : null;
  return (
    <div
      className="rounded-2xl px-3.5 py-3"
      style={
        pinned
          ? { background: "linear-gradient(140deg,#241009 0%,var(--cc-card) 62%)", border: "1.5px solid var(--cc-orange)" }
          : { background: "var(--cc-card)", border: "1px solid var(--cc-line)" }
      }
    >
      <div className="flex items-center gap-3">
        <span
          className="w-6 shrink-0 text-center font-[family-name:var(--font-plex-mono)] text-[15px] font-bold tabular-nums"
          style={{ color: isLead ? "var(--cc-yellow)" : "var(--cc-soft)" }}
        >
          {row.rank}
        </span>
        <Link href={row.username ? `/u/${row.username}` : "#"} className="shrink-0">
          <BeltRing name={row.display_name} avatarUrl={row.avatar_url} belt={belt} />
        </Link>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <Link
              href={row.username ? `/u/${row.username}` : "#"}
              className="max-w-[9rem] truncate text-[13.5px] font-bold sm:max-w-none"
              style={{ color: "var(--cc-ink)" }}
            >
              {row.display_name || "Member"}
            </Link>
            <BeltChip belt={belt} />
            {(row.is_me || pinned) && <YouMark />}
          </div>
          <div className="mt-0.5 truncate font-[family-name:var(--font-plex-mono)] text-[9.5px] uppercase tracking-[0.12em]" style={{ color: "var(--cc-dim)" }}>
            {row.family_name || (row.username ? `@${row.username}` : `${belt.name} belt`)}
          </div>
        </div>
        <div className="shrink-0 text-right">
          <span
            className="font-[family-name:var(--font-plex-mono)] text-[15px] font-semibold tabular-nums"
            style={{ color: isLead ? "var(--cc-yellow)" : "var(--cc-ink)" }}
          >
            {row.xp.toLocaleString()} ⚡
          </span>
        </div>
      </div>

      {/* pinned self-row: real progress toward the next belt (orange gradient bar) */}
      {prog && prog.next && (
        <div className="mt-2.5 pl-9">
          <div className="h-1.5 overflow-hidden rounded-full" style={{ background: "var(--cc-card2)" }}>
            <div
              className="h-full rounded-full"
              style={{ width: `${prog.pct}%`, background: "linear-gradient(90deg,var(--cc-orange),#FFB061)" }}
            />
          </div>
          <p className="mt-1 font-[family-name:var(--font-plex-mono)] text-[9.5px] uppercase tracking-[0.12em]" style={{ color: "var(--cc-orange-ink)" }}>
            {prog.toNext.toLocaleString()} ⚡ to {prog.next.belt.name} Belt
          </p>
        </div>
      )}
    </div>
  );
}

function EmptyNote({ title, body, action }: { title: string; body: string; action?: React.ReactNode }) {
  return (
    <Card className="p-4">
      <p className="cc-display text-[16px]" style={{ color: "var(--cc-ink)" }}>{title}</p>
      <p className="mt-1.5 max-w-md text-[13px] leading-relaxed" style={{ color: "var(--cc-soft)" }}>{body}</p>
      {action && <div className="mt-3">{action}</div>}
    </Card>
  );
}

function FoundingNote({ children }: { children: React.ReactNode }) {
  return <p className="mt-3 max-w-[62ch] text-[11px] leading-relaxed" style={{ color: "var(--cc-soft)" }}>{children}</p>;
}

function CardSkeleton() {
  return (
    <div className="space-y-2" aria-busy="true">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="h-[62px] rounded-2xl motion-safe:animate-pulse" style={{ background: "var(--cc-card2)" }} />
      ))}
      <span className="sr-only">Loading the board</span>
    </div>
  );
}

/* ── observer for self-pin (same rule as v1: state only from the callback) ── */
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
      rootMargin: "0px 0px -72px 0px",
    });
    io.observe(el);
    return () => io.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  return null;
}

function riseProps(reduce: boolean) {
  if (reduce) return { initial: { opacity: 0 }, animate: { opacity: 1 }, transition: { duration: 0.12 } } as const;
  return {
    initial: { opacity: 0, y: 12 },
    animate: { opacity: 1, y: 0 },
    transition: { type: "spring" as const, stiffness: 300, damping: 24 },
  };
}

/* ── Individuals board ──────────────────────────────────────────────────── */
const TAIL_FOLD_MIN = 3;

function IndividualsBoard({
  ind,
  meInRows,
  periodLabel,
  scope,
  meOffBoard = false,
}: {
  ind: { rows: IndRow[]; me: IndRow | null };
  meInRows: boolean;
  periodLabel: string;
  scope: Scope;
  meOffBoard?: boolean;
}) {
  const reduce = useReducedMotion() ?? false;
  const [showTail, setShowTail] = useState(false);
  const selfRef = useRef<HTMLDivElement | null>(null);
  const [selfVisible, setSelfVisible] = useState(true);

  if (ind.rows.length === 0) {
    return (
      <EmptyNote
        title={scope === "family" ? "No family XP in this window" : "No XP yet in this window"}
        body={`Complete a lesson, play a game, or review your Daily 5 to appear on the ${periodLabel.toLowerCase()} board.`}
        action={
          <Link href="/courses" className="text-[13px] font-semibold" style={{ color: "var(--cc-orange-ink)" }}>
            Earn your first XP →
          </Link>
        }
      />
    );
  }

  const everyoneFirstRung = ind.rows.every((r) => beltForXp(r.xp).belt.key === "white");
  const thin = ind.rows.length < 4;

  let cut = ind.rows.length;
  while (cut > 0 && ind.rows[cut - 1].xp === 0) cut--;
  const tailCount = cut === 0 ? 0 : ind.rows.length - cut;
  const folded = tailCount >= TAIL_FOLD_MIN && !showTail;
  const visible = folded ? ind.rows.slice(0, cut) : ind.rows;

  const myRow = ind.rows.find((r) => r.is_me) ?? ind.me;
  const selfOnScreen = !!myRow && visible.some((r) => r.id === myRow.id) && selfVisible;

  return (
    <div>
      <div className="space-y-2">
        {visible.map((row) => (
          <motion.div
            key={row.id}
            layout
            {...riseProps(reduce)}
            ref={myRow && row.id === myRow.id ? selfRef : undefined}
          >
            <LadderRow row={row} />
          </motion.div>
        ))}
      </div>

      {folded && (
        <div className="pt-3">
          <button
            type="button"
            onClick={() => setShowTail(true)}
            className="text-[12px] font-semibold"
            style={{ color: "var(--cc-orange-ink)" }}
          >
            Show all {ind.rows.length.toLocaleString()} — {tailCount.toLocaleString()} member
            {tailCount === 1 ? "" : "s"} earned no XP in this window
          </button>
        </div>
      )}

      {everyoneFirstRung ? (
        <FoundingNote>
          Everyone on this board is still on White Belt. The ladder is real and nobody has climbed it yet — the first
          member to finish a course changes that.{" "}
          <Link href="/belts" className="font-semibold" style={{ color: "var(--cc-orange-ink)" }}>See the belts</Link>
        </FoundingNote>
      ) : thin ? (
        <FoundingNote>
          {ind.rows.length === 1 ? "One member has" : `${ind.rows.length} members have`} earned XP in the{" "}
          {periodLabel.toLowerCase()} window. The board fills out as the Club does.
        </FoundingNote>
      ) : null}

      {meOffBoard && (
        <FoundingNote>Staff and test accounts are kept off the public board, so this account has no rank on it.</FoundingNote>
      )}

      {myRow && !selfOnScreen && (
        <div className="sticky bottom-2 z-20 mt-3 [filter:drop-shadow(0_6px_16px_rgba(0,0,0,0.28))]">
          <LadderRow row={myRow} pinned={!meInRows} />
        </div>
      )}

      <SelfObserver targetRef={selfRef} onChange={setSelfVisible} deps={[visible.length, myRow?.id]} />
    </div>
  );
}

/* ── Families board (R2 family ladder) ──────────────────────────────────── */
function FamiliesBoard({ fams, myFamilyId, periodLabel }: { fams: FamRow[]; myFamilyId: string; periodLabel: string }) {
  const reduce = useReducedMotion() ?? false;
  if (fams.length === 0) {
    return (
      <EmptyNote
        title="No family XP in this window"
        body={`Families appear here once a member earns XP in the ${periodLabel.toLowerCase()} window.`}
      />
    );
  }
  return (
    <div>
      <div className="space-y-2">
        {fams.map((row, i) => {
          const rank = i + 1;
          const mine = row.family_id === myFamilyId;
          const isLead = rank === 1;
          return (
            <motion.div key={row.family_id} layout {...riseProps(reduce)}>
              <div
                className="flex items-center gap-3 rounded-2xl px-3.5 py-3"
                style={
                  mine
                    ? { background: "linear-gradient(140deg,#241009 0%,var(--cc-card) 62%)", border: "1.5px solid var(--cc-orange)" }
                    : { background: "var(--cc-card)", border: "1px solid var(--cc-line)" }
                }
              >
                <span
                  className="w-6 shrink-0 text-center font-[family-name:var(--font-plex-mono)] text-[15px] font-bold tabular-nums"
                  style={{ color: isLead ? "var(--cc-yellow)" : "var(--cc-soft)" }}
                >
                  {rank}
                </span>
                {/* stacked member avatars, belt-ringed */}
                <span className="flex shrink-0 -space-x-2">
                  {row.avatars.slice(0, 4).map((a, j) => (
                    <BeltRing key={j} name={a.display_name} avatarUrl={a.avatar_url} belt={beltForXp(a.xp).belt} size={30} />
                  ))}
                  {row.members > 4 && (
                    <span
                      className="grid h-[30px] w-[30px] place-items-center rounded-full font-[family-name:var(--font-plex-mono)] text-[10px] font-bold"
                      style={{ background: "var(--cc-card2)", color: "var(--cc-soft)", border: "2px solid var(--cc-bg)" }}
                    >
                      +{row.members - 4}
                    </span>
                  )}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    <span className="truncate text-[13.5px] font-bold" style={{ color: "var(--cc-ink)" }}>{row.name}</span>
                    {mine && <YouMark />}
                  </div>
                  <div className="mt-0.5 font-[family-name:var(--font-plex-mono)] text-[9.5px] uppercase tracking-[0.12em]" style={{ color: "var(--cc-dim)" }}>
                    {row.members} member{row.members === 1 ? "" : "s"}
                  </div>
                </div>
                <div className="shrink-0 text-right">
                  <span
                    className="block font-[family-name:var(--font-plex-mono)] text-[15px] font-semibold tabular-nums"
                    style={{ color: isLead ? "var(--cc-yellow)" : "var(--cc-ink)" }}
                  >
                    {row.xp.toLocaleString()} ⚡
                  </span>
                  <span className="mt-0.5 block text-[8px] font-bold uppercase tracking-[0.14em]" style={{ color: "var(--cc-dim)" }}>
                    avg
                  </span>
                </div>
              </div>
            </motion.div>
          );
        })}
      </div>
      {fams.length < 4 && (
        <FoundingNote>
          {fams.length === 1 ? "One family is" : `${fams.length} families are`} on the board for the{" "}
          {periodLabel.toLowerCase()} window. Every family that earns XP joins it.
        </FoundingNote>
      )}
    </div>
  );
}

/* ── inner ──────────────────────────────────────────────────────────────── */
function LeaderboardInnerV2() {
  const supabase = createClient();
  const searchParams = useSearchParams();
  const router = useRouter();
  const isClub = useAppMode() === "club";

  const initialScope: Scope = searchParams.get("scope") === "family" ? "family" : "all";
  const [dimension, setDimension] = useState<Dimension>("individuals");
  const [period, setPeriod] = useState<Period>("7d");
  const [scope, setScope] = useState<Scope>(initialScope);

  const [ind, setInd] = useState<{ rows: IndRow[]; me: IndRow | null }>({ rows: [], me: null });
  const [meOffBoard, setMeOffBoard] = useState(false);
  const [fams, setFams] = useState<FamRow[]>([]);
  const [myFamilyId, setMyFamilyId] = useState<string>("");

  const queryKey = `${dimension}|${period}|${scope}`;
  const [loadedKey, setLoadedKey] = useState<string | null>(null);
  const loading = loadedKey !== queryKey;

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase.from("profiles").select("family_id").eq("id", user.id).maybeSingle();
      setMyFamilyId(data?.family_id || "");
    })();
  }, [supabase]);

  const load = useCallback(
    async (key: string, alive: () => boolean) => {
      if (dimension === "individuals") {
        const { data } = await supabase.rpc("xp_leaderboard_individuals", { p_window: period, p_scope: scope });
        if (!alive()) return;
        const payload = (data as { rows: IndRow[]; me: IndRow | null }) || { rows: [], me: null };
        const raw = payload.rows || [];
        const rows = raw.filter((r) => !isOffBoardIdentity(r)).map((r, i) => ({ ...r, rank: i + 1 }));
        const rawMe = payload.me || null;
        const meOnBoard = rawMe && !isOffBoardIdentity(rawMe) ? rawMe : null;
        const me =
          meOnBoard && !rows.some((r) => r.id === meOnBoard.id)
            ? {
                ...meOnBoard,
                rank: Math.max(
                  1,
                  meOnBoard.rank - raw.filter((r) => isOffBoardIdentity(r) && r.rank < meOnBoard.rank).length,
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
    [supabase, dimension, period, scope],
  );

  useEffect(() => {
    const controller = new AbortController();
    void Promise.resolve().then(() => load(queryKey, () => !controller.signal.aborted));
    return () => controller.abort();
  }, [load, queryKey]);

  function chooseScope(next: Scope) {
    setScope(next);
    const qs = next === "family" ? "?scope=family" : "";
    router.replace(`/leaderboard${qs}`, { scroll: false });
  }

  const periodLabel = PERIOD_LONG[period];
  const meInRows = ind.me ? ind.rows.some((r) => r.id === ind.me!.id) : false;

  return (
    <V2Surface className="min-h-screen">
      <div className="mx-auto max-w-2xl space-y-4 px-4 pb-20 pt-6">
        {/* ── masthead ─────────────────────────────────────────────────────── */}
        <m.header initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} className="flex items-end justify-between gap-3">
          <div>
            <ScriptTitle>{isClub ? "the ladder" : dimension === "families" ? "family ladder" : "the ladder"}</ScriptTitle>
            <div className="mt-1">
              <Kicker tone="soft">
                {isClub ? "reps you put in — not luck" : dimension === "families" ? "average XP of every member" : "climb the belts"}
              </Kicker>
            </div>
          </div>
          <Link href="/belts" className="shrink-0 pb-1 text-[12px] font-semibold" style={{ color: "var(--cc-orange-ink)" }}>
            How ranking works ›
          </Link>
        </m.header>

        {/* ── controls ─────────────────────────────────────────────────────── */}
        <div className="space-y-2.5">
          {isClub ? (
            <PillRow options={CLUB_PERIODS} value={period} onChange={setPeriod} ariaLabel="Leaderboard window" />
          ) : (
            <>
              <PillRow
                options={[
                  { id: "individuals" as Dimension, label: "Individuals" },
                  { id: "families" as Dimension, label: "Families" },
                ]}
                value={dimension}
                onChange={setDimension}
                ariaLabel="Leaderboard dimension"
              />
              <div className="grid gap-2 sm:grid-cols-[3fr_2fr]">
                <PillRow options={PERIODS} value={period} onChange={setPeriod} ariaLabel="Leaderboard period" size="sm" />
                {dimension === "individuals" && (
                  <PillRow
                    options={[
                      { id: "all" as Scope, label: "Everyone" },
                      { id: "family" as Scope, label: "My family" },
                    ]}
                    value={scope}
                    onChange={chooseScope}
                    ariaLabel="Leaderboard scope"
                    size="sm"
                  />
                )}
              </div>
            </>
          )}
        </div>

        {loading ? (
          <CardSkeleton />
        ) : dimension === "individuals" ? (
          <IndividualsBoard ind={ind} meInRows={meInRows} periodLabel={periodLabel} scope={scope} meOffBoard={meOffBoard} />
        ) : (
          <FamiliesBoard fams={fams} myFamilyId={myFamilyId} periodLabel={periodLabel} />
        )}

        {/* ── how rank works (honest) ──────────────────────────────────────── */}
        {isClub && (
          <section className="space-y-2.5 pt-3">
            <Kicker tone="orange">How rank works</Kicker>
            <p className="max-w-[62ch] text-[12px] leading-relaxed" style={{ color: "var(--cc-soft)" }}>
              Rank is your XP over the selected window — earned by rating calls, finishing lessons, and showing up in the
              room. It rewards consistent reps over one lucky week, so a loud one-off never outranks a steady operator.
              Windows are trailing, so every board is always a full period.
            </p>
            <div className="flex flex-wrap gap-x-6 gap-y-2 text-[12px] font-semibold">
              <Link href="/belts" style={{ color: "var(--cc-orange-ink)" }}>The belt ladder</Link>
              <Link href="/progress" style={{ color: "var(--cc-orange-ink)" }}>Your profile</Link>
            </div>
          </section>
        )}
      </div>
    </V2Surface>
  );
}

export default function LeaderboardSurfaceV2() {
  return (
    <Suspense
      fallback={
        <V2Surface className="min-h-screen">
          <div className="mx-auto max-w-2xl px-4 pt-6">
            <CardSkeleton />
          </div>
        </V2Surface>
      }
    >
      <LeaderboardInnerV2 />
    </Suspense>
  );
}
