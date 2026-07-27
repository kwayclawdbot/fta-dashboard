"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { m } from "@/lib/motion";
import { Crown, Trophy, Users, Zap, Info } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useAppMode } from "@/lib/useAppMode";
import Tabs, { type TabItem } from "@/components/ui/Tabs";
import type { FamilyTier } from "@/lib/tier";
import { beltForXp } from "@/lib/belts";
import Avatar from "@/components/Avatar";
import BeltBadge from "@/components/BeltBadge";
import AgeBadge from "@/components/community/AgeBadge";
import TierBadge from "@/components/TierBadge";
import ProfileLink from "@/components/ProfileLink";

/**
 * THE leaderboard — two dimensions (Families | Individuals) × three trailing
 * periods (Last 7 days | Last 30 days | All-time). Replaces the three old boards
 * (cross-family /leaderboard, within-family /family/leaderboard, and the deleted
 * sim board). Data comes from the definer RPCs in migration 099; belts + levels
 * derive client-side from the returned XP (src/lib/belts.ts).
 *
 * Periods are trailing/rolling and labelled honestly ("Last 7 days") — never
 * calendar buckets, so a window is always full. The Individuals dimension has a
 * scope switch (Everyone | My family); ?scope=family deep-links straight to the
 * folded-in within-family view (the old /family/leaderboard target).
 */

type Dimension = "individuals" | "families";
type Period = "7d" | "30d" | "all";
type Scope = "all" | "family";

const PERIODS: { id: Period; label: string; short: string }[] = [
  { id: "7d", label: "Last 7 days", short: "7 days" },
  { id: "30d", label: "Last 30 days", short: "30 days" },
  { id: "all", label: "All-time", short: "All-time" },
];

// Club register (canvas artboard 11): trader-voiced tabs that map onto the SAME
// trailing XP windows the family board uses — no new data source. "Rookies" is
// the recent (7-day) window where new members surface fastest.
const CLUB_TABS: TabItem<Period>[] = [
  { key: "30d", label: "This month" },
  { key: "all", label: "All time" },
  { key: "7d", label: "Rookies" },
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

function rankColor(rank: number) {
  if (rank === 1) return "text-gold-600";
  if (rank === 2) return "text-midnight-400";
  if (rank === 3) return "text-amber-700";
  return "text-soft";
}

/* ── row skeleton (in-page, for tab switches) ─────────────────────────────── */
function RowSkeleton() {
  return (
    <div className="flex items-center gap-4 p-4 rounded-xl border border-sand paper-card">
      <span className="w-7 h-6 rounded bg-sand animate-pulse" />
      <span className="w-9 h-9 rounded-full bg-sand animate-pulse shrink-0" />
      <div className="flex-1 space-y-2">
        <span className="block h-3.5 w-32 rounded bg-sand animate-pulse" />
        <span className="block h-2.5 w-20 rounded bg-sand animate-pulse" />
      </div>
      <span className="w-12 h-5 rounded bg-sand animate-pulse" />
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
  // Both entry points land on the Individuals dimension; ?scope=family just
  // preselects the within-family view (the folded-in /family/leaderboard).
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
    <div className="max-w-3xl mx-auto">
      {/* Header — club register reframes the same board around conviction/reps */}
      <m.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mb-5">
        <div className="flex items-center gap-2 mb-1">
          <Trophy className="w-5 h-5 text-gold-600" />
          <h1 className="font-display text-2xl font-bold text-ink">Leaderboard</h1>
        </div>
        <p className="text-soft text-sm">
          {isClub ? (
            <>Ranked by the reps you put in — <span className="font-semibold text-ink">conviction, not luck</span>. Every rated call, lesson, and rep earns XP.</>
          ) : (
            <>
              Every lesson, quiz, card, and game earns XP and moves your belt.{" "}
              {dimension === "families" ? (
                <>A family&apos;s score is the <span className="font-semibold text-ink">average XP of its members</span>, so families of every size compete fairly.</>
              ) : (
                <>Climb the belts — friendly kid-vs-kid competition welcome.</>
              )}
            </>
          )}
        </p>
      </m.div>

      {/* Club: canvas tabs (This month / All time / Rookies) over the same XP windows */}
      {isClub && (
        <div className="mb-5">
          <Tabs
            tabs={CLUB_TABS}
            active={period}
            onSelect={setPeriod}
            ariaLabel="Leaderboard window"
          />
        </div>
      )}

      {/* Dimension toggle — family only (a solo club member has no family board) */}
      {!isClub && (
        <div className="inline-flex gap-1 mb-3 bg-chip-amber/40 border border-sand rounded-xl p-1">
          {(["individuals", "families"] as Dimension[]).map((d) => (
            <button
              key={d}
              onClick={() => setDimension(d)}
              className={`px-4 py-1.5 rounded-lg text-sm font-semibold transition-colors ${
                dimension === d ? "bg-chip-amber text-gold-800 shadow-soft" : "text-soft hover:text-ink"
              }`}
            >
              {d === "individuals" ? "Individuals" : "Families"}
            </button>
          ))}
        </div>
      )}

      {/* Period + scope controls — family only (club uses the Tabs strip above) */}
      <div className={`flex-wrap items-center gap-3 mb-6 ${isClub ? "hidden" : "flex"}`}>
        <div className="inline-flex gap-1 bg-white/60 dark:bg-transparent border border-sand rounded-xl p-1">
          {PERIODS.map((p) => (
            <button
              key={p.id}
              onClick={() => setPeriod(p.id)}
              className={`px-3 py-1.5 rounded-lg text-[13px] font-medium transition-colors ${
                period === p.id ? "bg-chip-amber text-gold-800" : "text-soft hover:text-ink"
              }`}
            >
              <span className="sm:hidden">{p.short}</span>
              <span className="hidden sm:inline">{p.label}</span>
            </button>
          ))}
        </div>

        {dimension === "individuals" && (
          <div className="inline-flex gap-1 border border-sand rounded-xl p-1">
            {(["all", "family"] as Scope[]).map((s) => (
              <button
                key={s}
                onClick={() => chooseScope(s)}
                className={`px-3 py-1.5 rounded-lg text-[13px] font-medium transition-colors ${
                  scope === s ? "bg-chip-amber text-gold-800" : "text-soft hover:text-ink"
                }`}
              >
                {s === "all" ? "Everyone" : "My family"}
              </button>
            ))}
          </div>
        )}
      </div>

      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <RowSkeleton key={i} />
          ))}
        </div>
      ) : dimension === "individuals" ? (
        <IndividualsBoard ind={ind} meInRows={meInRows} periodLabel={periodLabel} scope={scope} />
      ) : (
        <FamiliesBoard fams={fams} myFamilyId={myFamilyId} periodLabel={periodLabel} />
      )}

      {/* Club: How rank works — honest about the XP that actually drives rank
          today (no fabricated accuracy %; conviction grading rolls out later). */}
      {isClub && (
        <div className="mt-6 rounded-2xl border border-sand bg-chip-amber/30 p-5">
          <div className="mb-2 flex items-center gap-2">
            <Info className="h-4 w-4 text-gold-700" />
            <p className="font-display text-sm font-bold text-ink">How rank works</p>
          </div>
          <p className="text-sm leading-relaxed text-soft">
            Rank is your XP over the selected window — earned by rating calls,
            finishing lessons, and showing up in the room. It rewards
            consistent reps over one lucky week, so a loud one-off never
            outranks a steady operator. Windows are trailing, so every board is
            always a full period.
          </p>
        </div>
      )}
    </div>
  );
}

/* ── Individuals ──────────────────────────────────────────────────────────── */
function IndividualRow({ row, pinned }: { row: IndRow; pinned?: boolean }) {
  const belt = beltForXp(row.xp);
  return (
    <div
      className={`flex items-center gap-3 sm:gap-4 p-3 sm:p-4 rounded-xl border ${
        row.is_me
          ? "border-gold-400 bg-chip-amber/50 ring-1 ring-gold-300"
          : row.is_my_family
          ? "border-gold-300/60 paper-card"
          : "border-sand paper-card"
      }`}
    >
      <span className={`font-display text-base sm:text-lg font-bold w-6 sm:w-7 text-center shrink-0 ${rankColor(row.rank)}`}>
        {row.rank}
      </span>
      <ProfileLink username={row.username} variant="avatar" className="shrink-0">
        <Avatar name={row.display_name} avatarUrl={row.avatar_url} xp={row.xp} size="md" />
      </ProfileLink>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 flex-wrap">
          <ProfileLink
            username={row.username}
            className="font-display font-semibold text-ink truncate max-w-[9rem] sm:max-w-none"
          >
            {row.display_name || "Member"}
          </ProfileLink>
          <AgeBadge role={row.role} ageGroup={row.age_group} />
          <BeltBadge rank={belt} size="xs" />
          {row.rank === 1 && row.xp > 0 && <Crown className="w-4 h-4 text-gold-500 shrink-0" />}
          {pinned && (
            <span className="text-[9px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded bg-gold-500 text-white shrink-0">
              You
            </span>
          )}
        </div>
        {row.family_name && <p className="text-xs text-soft truncate">{row.family_name}</p>}
      </div>
      <div className="text-right shrink-0">
        <p className="font-display text-base sm:text-lg font-bold text-ink flex items-center gap-1 justify-end">
          <Zap className="w-4 h-4 text-gold-500" />
          {row.xp.toLocaleString()}
        </p>
        <p className="text-[10px] text-soft">XP</p>
      </div>
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
      <EmptyState
        title={scope === "family" ? "No family XP in this window" : "No XP yet in this window"}
        body={`Complete a lesson, play a game, or review your Daily 5 to appear on the ${periodLabel.toLowerCase()} board.`}
      />
    );
  }
  return (
    <div className="space-y-2">
      {ind.rows.map((row, i) => (
        <m.div
          key={row.id}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: Math.min(i * 0.02, 0.18) }}
        >
          <IndividualRow row={row} />
        </m.div>
      ))}
      {/* Pin "me" when outside the visible rows. */}
      {ind.me && !meInRows && (
        <>
          <p className="text-center text-[11px] uppercase tracking-wider text-soft pt-2">Your rank</p>
          <IndividualRow row={ind.me} pinned />
        </>
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
      <EmptyState
        title="No family XP in this window"
        body={`Families appear here once a member earns XP in the ${periodLabel.toLowerCase()} window.`}
      />
    );
  }
  return (
    <div className="space-y-2">
      {fams.map((row, i) => {
        const rank = i + 1;
        const mine = row.family_id === myFamilyId;
        return (
          <m.div
            key={row.family_id}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: Math.min(i * 0.03, 0.2) }}
            className={`flex items-center gap-3 sm:gap-4 p-3 sm:p-4 rounded-xl border ${
              mine ? "border-gold-400 bg-chip-amber/50 ring-1 ring-gold-300" : "border-sand paper-card"
            }`}
          >
            <span className={`font-display text-base sm:text-lg font-bold w-6 sm:w-7 text-center shrink-0 ${rankColor(rank)}`}>
              {rank}
            </span>
            {/* Avatar cluster */}
            <div className="flex -space-x-2 shrink-0">
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
                <span className="w-8 h-8 rounded-full bg-sand text-soft text-[10px] font-bold flex items-center justify-center ring-2 ring-paper shrink-0">
                  +{row.members - 4}
                </span>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <p className="font-display font-semibold text-ink truncate">{row.name}</p>
                <TierBadge tier={row.tier} size="xs" />
                {rank === 1 && <Crown className="w-4 h-4 text-gold-500 shrink-0" />}
                {mine && (
                  <span className="text-[9px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded bg-gold-500 text-white shrink-0">
                    You
                  </span>
                )}
              </div>
              <p className="text-xs text-soft">
                {row.members} member{row.members === 1 ? "" : "s"}
              </p>
            </div>
            <div className="text-right shrink-0">
              <p className="font-display text-base sm:text-lg font-bold text-ink flex items-center gap-1 justify-end">
                <Zap className="w-4 h-4 text-gold-500" />
                {row.xp.toLocaleString()}
              </p>
              <p className="text-[10px] text-soft">avg XP</p>
            </div>
          </m.div>
        );
      })}
    </div>
  );
}

function EmptyState({ title, body }: { title: string; body: string }) {
  return (
    <div className="paper-card p-10 text-center">
      <Users className="w-8 h-8 text-soft mx-auto mb-3" />
      <p className="font-display text-base font-semibold text-ink mb-1">{title}</p>
      <p className="text-sm text-soft max-w-sm mx-auto">{body}</p>
    </div>
  );
}

export default function LeaderboardPage() {
  return (
    <Suspense
      fallback={
        <div className="max-w-3xl mx-auto space-y-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <RowSkeleton key={i} />
          ))}
        </div>
      }
    >
      <LeaderboardInner />
    </Suspense>
  );
}
