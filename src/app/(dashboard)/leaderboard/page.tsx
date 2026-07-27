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

/**
 * THE BOARD — two dimensions (Individuals | Families) × three trailing periods
 * (Last 7 days | Last 30 days | All-time). Data comes from the definer RPCs in
 * migration 099; belts + levels derive client-side from the returned XP
 * (src/lib/belts.ts). Periods are trailing/rolling and labelled honestly
 * ("Last 7 days") — never calendar buckets, so a window is always full. The
 * Individuals dimension keeps its scope switch (Everyone | My family);
 * ?scope=family still deep-links to the folded-in within-family view.
 *
 * FORM (canvas rebuild): a ranked HAIRLINE LEDGER, not a stack of bordered
 * cards. The rank does the identity work as a LARGE numeral in the left margin
 * — top three in full ink, the rest muted — so position is legible at a glance
 * without a single box, chip, or medal. Everything else is type: name at the
 * body weight, belt/age as the only badges, and the ranked metric in mono so
 * the XP column aligns as a true column.
 *
 * COLOUR LAW: green/red belong to PRICE and appear nowhere on this surface —
 * a leaderboard has no prices. The only accent is the mode accent (family gold
 * / club volt orange / FTA metallic) on the "YOU" marker and the active tab
 * underscore, both of which are brand/action. Belt colours are intrinsic to the
 * belt and carried by <BeltBadge/>, which is theme-independent by design.
 *
 * DARK: every colour here is a semantic token (ink / soft / sand / paper) or a
 * mode-accent ramp step that flips at :root[data-theme="dark"]. There is no
 * `dark:` variant anywhere — orange TEXT uses text-gold-700 (the ramp that
 * flips), never text-volt-* (frozen across themes).
 *
 * HONESTY: nothing is fabricated. There is no accuracy %, no win rate, and no
 * "credibility" score, because no such column exists in the RPC payload — the
 * board ranks XP over a window and says so. Absent rows produce a stated empty,
 * never filler rows.
 */

type Dimension = "individuals" | "families";
type Period = "7d" | "30d" | "all";
type Scope = "all" | "family";

const PERIODS: { id: Period; label: string; short: string }[] = [
  { id: "7d", label: "Last 7 days", short: "7 days" },
  { id: "30d", label: "Last 30 days", short: "30 days" },
  { id: "all", label: "All-time", short: "All-time" },
];

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

/* ── Surface primitives ───────────────────────────────────────────────────
   Local, because the shared f0 masthead still carries a `dark:text-volt-*`
   eyebrow and volt text is frozen across themes. These use the gold ramp,
   which IS volt orange in club mode AND flips at night. */

function Masthead({
  eyebrow,
  title,
  lede,
}: {
  eyebrow: string;
  title: string;
  lede: React.ReactNode;
}) {
  return (
    <header>
      <p className="text-eyebrow font-display font-bold uppercase text-gold-700">
        {eyebrow}
      </p>
      <h1 className="mt-2 font-display text-display-1 font-extrabold uppercase text-ink">
        {title}
      </h1>
      <p className="mt-3 max-w-lg text-[15px] leading-relaxed text-soft">{lede}</p>
    </header>
  );
}

/** A hairline-underscored rail. Not a segmented pill — the labels read as
    headings and the active one is marked by weight plus an accent underscore. */
function Rail<T extends string>({
  items,
  value,
  onChange,
  ariaLabel,
  size = "lg",
}: {
  items: { id: T; label: string; short?: string }[];
  value: T;
  onChange: (id: T) => void;
  ariaLabel: string;
  size?: "lg" | "sm";
}) {
  return (
    <div
      role="tablist"
      aria-label={ariaLabel}
      className={`flex border-b border-sand ${size === "lg" ? "gap-7" : "gap-5"}`}
    >
      {items.map((t) => {
        const on = value === t.id;
        return (
          <button
            key={t.id}
            role="tab"
            type="button"
            aria-selected={on}
            onClick={() => onChange(t.id)}
            className={`relative -mb-px font-display font-extrabold uppercase transition-colors ${
              size === "lg"
                ? "pb-3 text-[15px] tracking-[0.08em]"
                : "pb-2.5 text-[12px] tracking-[0.12em]"
            } ${on ? "text-ink" : "text-soft hover:text-ink"}`}
          >
            <span className={t.short ? "sm:hidden" : ""}>{t.short ?? t.label}</span>
            {t.short && <span className="hidden sm:inline">{t.label}</span>}
            {on && (
              <span className="absolute inset-x-0 bottom-0 h-[3px] rounded-full bg-gold-500" />
            )}
          </button>
        );
      })}
    </div>
  );
}

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
    <span className="shrink-0 rounded bg-gold-500 px-1.5 py-0.5 text-[9px] font-display font-bold uppercase tracking-[0.12em] text-night-950">
      You
    </span>
  );
}

function StatedEmpty({ title, body }: { title: string; body: string }) {
  return (
    <div className="border-l-2 border-sand py-1 pl-4">
      <p className="font-display text-display-3 font-extrabold text-ink">{title}</p>
      <p className="mt-1.5 max-w-md text-[15px] leading-relaxed text-soft">{body}</p>
    </div>
  );
}

/* ── Skeleton ─────────────────────────────────────────────────────────────
   Ledger-shaped, so the wait looks like the thing that arrives. */
function LedgerSkeleton() {
  return (
    <div className="f0-ledger">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="f0-ledger-row">
          <span className="h-5 w-9 shrink-0 animate-pulse rounded bg-sand sm:w-12" />
          <span className="h-9 w-9 shrink-0 animate-pulse rounded-full bg-sand" />
          <span className="min-w-0 flex-1 space-y-2">
            <span className="block h-3.5 w-32 animate-pulse rounded bg-sand" />
            <span className="block h-2.5 w-20 animate-pulse rounded bg-sand" />
          </span>
          <span className="h-4 w-12 shrink-0 animate-pulse rounded bg-sand" />
        </div>
      ))}
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
  const [loading, setLoading] = useState(true);

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

  const load = useCallback(async () => {
    setLoading(true);
    if (dimension === "individuals") {
      const { data } = await supabase.rpc("xp_leaderboard_individuals", {
        p_window: period,
        p_scope: scope,
      });
      const payload = (data as { rows: IndRow[]; me: IndRow | null }) || { rows: [], me: null };
      setInd({ rows: payload.rows || [], me: payload.me || null });
    } else {
      const { data } = await supabase.rpc("xp_leaderboard_families", { p_window: period });
      setFams(((data as FamRow[]) || []).filter((f) => f.members > 0));
    }
    setLoading(false);
  }, [supabase, dimension, period, scope]);

  useEffect(() => {
    load();
  }, [load]);

  // Keep the URL honest so the view is shareable/back-navigable.
  function chooseScope(next: Scope) {
    setScope(next);
    const qs = next === "family" ? "?scope=family" : "";
    router.replace(`/leaderboard${qs}`, { scroll: false });
  }

  const periodLabel = PERIODS.find((p) => p.id === period)!.label;
  // Is "me" already visible in the rows? If not, pin the me-row at the bottom.
  const meInRows = ind.me ? ind.rows.some((r) => r.id === ind.me!.id) : false;

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <m.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }}>
        <Masthead
          eyebrow={isClub ? "Where you stand" : "Standing"}
          title="Leaderboard"
          lede={
            isClub ? (
              <>
                Ranked by the reps you put in —{" "}
                <span className="font-semibold text-ink">conviction, not luck</span>. Every
                rated call, lesson, and rep earns XP.
              </>
            ) : dimension === "families" ? (
              <>
                A family&apos;s score is the{" "}
                <span className="font-semibold text-ink">average XP of its members</span>, so
                families of every size compete fairly.
              </>
            ) : (
              <>
                Every lesson, quiz, card, and game earns XP and moves your belt. Climb the
                belts — friendly kid-vs-kid competition welcome.
              </>
            )
          }
        />
      </m.div>

      {/* Controls. Club gets the trader-voiced window rail; family gets the
          dimension rail plus a quieter period/scope rail beneath it. */}
      <div className="space-y-4">
        {isClub ? (
          <Rail
            items={CLUB_PERIODS}
            value={period}
            onChange={setPeriod}
            ariaLabel="Leaderboard window"
          />
        ) : (
          <>
            <Rail
              items={[
                { id: "individuals" as Dimension, label: "Individuals" },
                { id: "families" as Dimension, label: "Families" },
              ]}
              value={dimension}
              onChange={setDimension}
              ariaLabel="Leaderboard dimension"
            />
            <div className="flex flex-wrap items-end gap-x-8 gap-y-3">
              <Rail
                items={PERIODS}
                value={period}
                onChange={setPeriod}
                ariaLabel="Leaderboard period"
                size="sm"
              />
              {dimension === "individuals" && (
                <Rail
                  items={[
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
        <LedgerSkeleton />
      ) : dimension === "individuals" ? (
        <IndividualsBoard ind={ind} meInRows={meInRows} periodLabel={periodLabel} scope={scope} />
      ) : (
        <FamiliesBoard fams={fams} myFamilyId={myFamilyId} periodLabel={periodLabel} />
      )}

      {/* How rank works — honest about the XP that actually drives rank today.
          No accuracy %, no win rate: neither exists in the payload. */}
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
      <StatedEmpty
        title={scope === "family" ? "No family XP in this window" : "No XP yet in this window"}
        body={`Complete a lesson, play a game, or review your Daily 5 to appear on the ${periodLabel.toLowerCase()} board.`}
      />
    );
  }
  return (
    <div>
      <div className="f0-ledger f0-stagger">
        {ind.rows.map((row, i) => (
          <div key={row.id} style={{ "--i": Math.min(i, 12) } as React.CSSProperties}>
            <IndividualRow row={row} />
          </div>
        ))}
      </div>
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
      <StatedEmpty
        title="No family XP in this window"
        body={`Families appear here once a member earns XP in the ${periodLabel.toLowerCase()} window.`}
      />
    );
  }
  return (
    <div className="f0-ledger f0-stagger">
      {fams.map((row, i) => {
        const rank = i + 1;
        const mine = row.family_id === myFamilyId;
        return (
          <div key={row.family_id} style={{ "--i": Math.min(i, 12) } as React.CSSProperties}>
            <div className="f0-ledger-row">
              <Rank n={rank} />
              {/* Avatar cluster — the family's identity object. */}
              <span className="flex shrink-0 self-center -space-x-2">
                {row.avatars.slice(0, 4).map((a, j) => (
                  <Avatar
                    key={j}
                    name={a.display_name}
                    avatarUrl={a.avatar_url}
                    xp={a.xp}
                    size="sm"
                    className="ring-2 ring-paper"
                  />
                ))}
                {row.members > 4 && (
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-sand font-mono text-[10px] font-bold text-soft ring-2 ring-paper">
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
