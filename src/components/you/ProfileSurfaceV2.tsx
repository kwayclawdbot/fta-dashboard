"use client";

import { useCallback, useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { ChevronRight, RotateCcw, Settings as SettingsIcon } from "lucide-react";

import { createClient } from "@/lib/supabase/client";
import { getUserXp, levelProgress, type XpKind } from "@/lib/xp";
import { beltForXp, beltProgress, BELT_ORDER, BELTS, type Belt } from "@/lib/belts";
import { computeStreak } from "@/lib/streak";
import { getBadgeState, evaluateBadges, type BadgeRow } from "@/lib/badges";
import V2Surface from "@/components/clubhome/v2/V2Surface";
import {
  ScriptTitle,
  Card,
  TickerBadge,
  Ring,
  StatRow,
  LevelLadder,
  type LadderRung,
} from "@/components/cc/ui";

/* ══════════════════════════════════════════════════════════════════════════
   YOU · BOARD 07 — the v2 (cc canvas) render of the member's profile.

   This is the design-v2 branch of ProfileSurface. It renders the SAME board
   07 objects from the SAME real reads as the v1 surface, re-drawn in the cc
   canvas (warm-black / paper twin, mono kickers, Kaushan "you", belt-ringed
   avatar, rings + ladders + stat rows). Data loading is a faithful copy of the
   v1 load so the two paths read identically member-for-member.

   HONEST DATA — CARRIED OVER FROM v1, NOT WEAKENED:
   • The XP ring (board 07's "87 OPINION SCORE" dial) is XP progress toward the
     next belt — the numeral is percent-into-band, labelled with the belt it
     reaches. A participation measure, never a scored opinion.
   • Conviction is the member's own bull share (sentiment / up-green), not a
     weighting of whose opinion counts.
   • The five tiles are counts of things the member DID (positions, research,
     respect, changed minds, posts). Accuracy is not built and does not ship.
   • Recent positions carry NO ✓/✗/return — direction is the word, the right
     column is the date.
   • OMITTED entirely (backend missing, no fake numbers): percentile
     ("Top 2% of 25,842"), influence multiplier ("1.8x"), accuracy ("71%"),
     people-influenced-as-a-score. Nothing new is fabricated.
   ══════════════════════════════════════════════════════════════════════════ */

interface CourseLine {
  slug: string;
  title: string;
  done: number;
  total: number;
}

interface PositionLine {
  ticker: string;
  stance: string;
  when: string;
}

interface Participation {
  stances: number;
  bullStances: number;
  flips: number;
  respect: number;
  research: number;
  posts: number;
  weeksActive: number;
}

interface SourceLine {
  label: string;
  xp: number;
  pct: number;
}

interface ProfileState {
  name: string;
  username: string | null;
  avatarUrl: string | null;
  since: string | null;
  xp: number;
  streakDays: number;
  streakWindow: boolean[];
  sources: SourceLine[];
  part: Participation | null;
  positions: PositionLine[];
  saved: number | null;
  courses: CourseLine[];
}

const EMPTY: ProfileState = {
  name: "",
  username: null,
  avatarUrl: null,
  since: null,
  xp: 0,
  streakDays: 0,
  streakWindow: [false, false, false, false, false, false, false],
  sources: [],
  part: null,
  positions: [],
  saved: null,
  courses: [],
};

const STANCE_WORD: Record<string, string> = {
  bull: "Bullish",
  bear: "Bearish",
  neutral: "Neutral",
};

const SOURCE_LABEL: Record<XpKind, string> = {
  lesson: "Lessons",
  quiz: "Quizzes",
  flashcards: "Flashcards",
  game: "Games",
  community: "Club posts",
  rsvp: "Live sessions",
  bonus: "Bonuses",
};

function monthDay(iso: string): string {
  return new Date(iso).toLocaleString("en-US", { month: "short", day: "numeric" });
}

/** "—" for a not-yet-answered measure — never a fabricated stand-in. */
function dash(n: number | null | undefined): string {
  return n == null ? "—" : n.toLocaleString();
}

export default function ProfileSurfaceV2() {
  const [state, setState] = useState<ProfileState>(EMPTY);
  const [badges, setBadges] = useState<BadgeRow[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);

  // ── LOAD — a faithful copy of the v1 surface's read path (same tables, same
  //    guards, same honest nulls). No clock is read during render; the streak
  //    window and every date label are resolved inside this load.
  const load = useCallback(async () => {
    const supabase = createClient();
    let settled = false;
    const timeout = setTimeout(() => {
      if (!settled) {
        setFailed(true);
        setLoading(false);
      }
    }, 10000);

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        settled = true;
        clearTimeout(timeout);
        setLoading(false);
        return;
      }

      const [profileRes, xp, eventsRes, progressRes, coursesRes] = await Promise.all([
        supabase
          .from("profiles")
          .select("display_name, username, avatar_url, created_at")
          .eq("id", user.id)
          .maybeSingle(),
        getUserXp(supabase, user.id).catch(() => 0),
        supabase
          .from("xp_events")
          .select("amount, kind, created_at")
          .eq("user_id", user.id)
          .order("created_at", { ascending: false })
          .limit(500),
        supabase
          .from("lesson_progress")
          .select("lesson_id")
          .eq("user_id", user.id)
          .eq("status", "completed"),
        supabase
          .from("courses")
          .select("slug, title, modules(lessons(id))")
          .in("program", ["fic", "fta"])
          .eq("published", true)
          .order("sort_order"),
      ]);

      const profile = profileRes.data;
      const events = (eventsRes.data ?? []) as {
        amount: number;
        kind: XpKind;
        created_at: string;
      }[];

      const { days: streakDays, window7: streakWindow } = computeStreak(
        events.map((e) => e.created_at),
        Date.now()
      );

      const byKind = new Map<XpKind, number>();
      let countedXp = 0;
      for (const e of events) {
        const amt = Number(e.amount) || 0;
        if (amt <= 0) continue;
        countedXp += amt;
        byKind.set(e.kind, (byKind.get(e.kind) ?? 0) + amt);
      }
      const sources: SourceLine[] = [...byKind.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
        .map(([kind, amount]) => ({
          label: SOURCE_LABEL[kind] ?? kind,
          xp: amount,
          pct: countedXp > 0 ? Math.round((amount / countedXp) * 100) : 0,
        }));

      const completedIds = new Set(
        ((progressRes.data ?? []) as { lesson_id: string }[]).map((p) => p.lesson_id)
      );
      type NestedCourse = {
        slug: string;
        title: string;
        modules: { lessons: { id: string }[] | null }[] | null;
      };
      const courses: CourseLine[] = [];
      for (const c of (coursesRes.data ?? []) as unknown as NestedCourse[]) {
        const lessons = (c.modules ?? []).flatMap((m) => m.lessons ?? []);
        if (lessons.length === 0) continue;
        courses.push({
          slug: c.slug,
          title: c.title,
          total: lessons.length,
          done: lessons.filter((l) => completedIds.has(l.id)).length,
        });
      }

      setState({
        name:
          (profile?.display_name as string | null) || user.email?.split("@")[0] || "Member",
        username: (profile?.username as string | null) ?? null,
        avatarUrl: (profile?.avatar_url as string | null) ?? null,
        since: profile?.created_at
          ? new Date(profile.created_at as string).toLocaleString("en-US", {
              month: "short",
              year: "numeric",
            })
          : null,
        xp,
        streakDays,
        streakWindow,
        sources,
        part: null,
        positions: [],
        saved: null,
        courses,
      });

      settled = true;
      clearTimeout(timeout);
      setLoading(false);

      const [partRes, stanceRes, savedRes] = await Promise.all([
        supabase.rpc("member_participation", { p_user_id: user.id }),
        supabase
          .from("ticker_stances")
          .select("ticker, stance, updated_at")
          .eq("user_id", user.id)
          .order("updated_at", { ascending: false })
          .limit(6),
        supabase
          .from("family_watchlist")
          .select("id", { count: "exact", head: true })
          .eq("champion_id", user.id),
      ]);

      const p = partRes.error
        ? null
        : (partRes.data as {
            stances: number;
            bull_stances: number;
            flips: number;
            respect: number;
            research: number;
            posts: number;
            weeks_active: number;
          } | null);

      setState((s) => ({
        ...s,
        part: p
          ? {
              stances: p.stances,
              bullStances: p.bull_stances,
              flips: p.flips,
              respect: p.respect,
              research: p.research,
              posts: p.posts,
              weeksActive: p.weeks_active,
            }
          : null,
        positions: stanceRes.error
          ? []
          : ((stanceRes.data ?? []) as {
              ticker: string;
              stance: string;
              updated_at: string;
            }[]).map((r) => ({
              ticker: r.ticker.toUpperCase(),
              stance: STANCE_WORD[r.stance] ?? r.stance,
              when: monthDay(r.updated_at),
            })),
        saved: savedRes.error ? null : (savedRes.count ?? null),
      }));

      await evaluateBadges(supabase, user.id);
      setBadges(await getBadgeState(supabase, user.id));
    } catch {
      if (!settled) {
        setFailed(true);
        setLoading(false);
      }
    } finally {
      settled = true;
      clearTimeout(timeout);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading) {
    return (
      <V2Surface className="min-h-screen">
        <ProfileSkeletonV2 />
      </V2Surface>
    );
  }

  if (failed) {
    return (
      <V2Surface className="min-h-screen">
        <div className="mx-auto max-w-2xl px-4 py-16">
          <Card className="p-5">
            <div className="cc-display text-[22px]" style={{ color: "var(--cc-ink)" }}>
              Your profile didn&apos;t load
            </div>
            <p className="mt-2 text-[13px] leading-relaxed" style={{ color: "var(--cc-soft)" }}>
              Something hiccuped on our end — nothing you&apos;ve earned is affected. Give it
              another go.
            </p>
            <div className="mt-4">
              <button
                type="button"
                onClick={() => {
                  setFailed(false);
                  setLoading(true);
                  void load();
                }}
                className="inline-flex items-center gap-1.5 rounded-full border px-5 py-2.5 text-[14px] font-semibold"
                style={{
                  borderColor: "var(--cc-line)",
                  background: "var(--cc-card2)",
                  color: "var(--cc-ink)",
                }}
              >
                <RotateCcw className="h-3.5 w-3.5" /> Try again
              </button>
            </div>
          </Card>
        </div>
      </V2Surface>
    );
  }

  const lvl = levelProgress(state.xp);
  const belt = beltForXp(state.xp);
  const bp = beltProgress(state.xp);
  const part = state.part;
  const conviction =
    part && part.stances > 0 ? Math.round((part.bullStances / part.stances) * 100) : null;
  const awarded = (badges ?? []).filter((b) => b.awarded);
  const postsHref = state.username ? `/u/${state.username}` : "/community";

  // THE RING. XP progress into the current belt band — numeral = percent, label
  // = the belt it reaches. At the top of the ladder it reads the earned belt at
  // a full sweep instead of an invented target.
  const ringLabel = bp.next ? `to ${bp.next.belt.name}` : `${belt.belt.name} belt`;

  const beltRungs = beltLadderRungs(belt.belt.key);

  return (
    <V2Surface className="min-h-screen">
      <div className="mx-auto max-w-2xl space-y-4 px-4 pb-20 pt-4">
        {/* ── MASTHEAD — script "you" 34px + a quiet ⚙ (board 07) ──────────── */}
        <header className="flex items-center justify-between gap-4">
          <ScriptTitle>you</ScriptTitle>
          <Link href="/settings" aria-label="Settings" style={{ color: "var(--cc-soft)" }}>
            <SettingsIcon className="h-[15px] w-[15px]" />
          </Link>
        </header>

        {/* ── IDENTITY — belt-ringed avatar · name · belt chip · XP ring ────── */}
        <section className="flex items-center gap-4 pt-1">
          <BeltRingAvatar name={state.name} avatarUrl={state.avatarUrl} belt={belt.belt} />

          <div className="min-w-0 flex-1">
            <h2
              className="cc-script truncate text-[24px] leading-[1.1]"
              style={{ color: "var(--cc-orange-ink)" }}
            >
              {state.name}
            </h2>
            <div className="mt-1.5 flex items-center gap-1.5">
              <BeltChip belt={belt.belt} label={belt.label} />
              {belt.belt.key === "black" && (
                <span aria-hidden style={{ color: "var(--cc-orange-ink)", fontSize: 12 }}>
                  ★
                </span>
              )}
            </div>
            <p
              className="mt-1 truncate font-[family-name:var(--font-plex-mono)] text-[11px]"
              style={{ color: "var(--cc-soft)" }}
            >
              Level {lvl.current.level} · {lvl.current.name}
              {state.username ? ` · @${state.username}` : ""}
            </p>
          </div>

          {/* White ring = XP / score (spec §4). The readout below spells it out. */}
          <Ring value={bp.pct} size={64} stroke={6} color="var(--cc-ink)">
            <div className="text-center">
              <div
                className="font-[family-name:var(--font-plex-mono)] text-[16px] font-bold leading-none"
                style={{ color: "var(--cc-ink)" }}
              >
                {bp.pct}
              </div>
              <div
                className="mt-0.5 font-[family-name:var(--font-plex-mono)] text-[6.5px] uppercase tracking-[0.08em]"
                style={{ color: "var(--cc-dim)" }}
              >
                {ringLabel}
              </div>
            </div>
          </Ring>
        </section>

        {/* ── XP READOUT — the honest figures behind the ring ──────────────── */}
        <Card className="px-3.5 py-3">
          <StatRow
            stats={[
              { label: "XP lifetime", value: state.xp.toLocaleString() },
              { label: "Level", value: lvl.current.level },
              {
                label: bp.next ? "XP to next belt" : "Belts",
                value: bp.next ? bp.toNext.toLocaleString() : "Maxed",
                tone: "orange",
              },
              { label: "Day streak", value: state.streakDays },
            ]}
          />
        </Card>

        {/* ── BELT LADDER — board 22's club-rank ladder, real standing ─────── */}
        <Card className="p-4">
          <CardLabel>the belt ladder · you are here</CardLabel>
          <div className="mt-2">
            <LevelLadder rungs={beltRungs} height={210} />
          </div>
          <div className="mt-1">
            <Link
              href="/belts"
              className="font-[family-name:var(--font-plex-mono)] text-[11px] font-semibold"
              style={{ color: "var(--cc-orange-ink)" }}
            >
              {bp.next ? "Every belt, and what each takes →" : "Top of the ladder — every belt earned →"}
            </Link>
          </div>
        </Card>

        {/* ── CONVICTION + WHERE YOUR REPS COME FROM (board 07 two-up) ─────── */}
        <section className="flex gap-3">
          <Card className="flex-1 p-3.5">
            <CardLabel>conviction</CardLabel>
            {/* Up-green is community sentiment by law; conviction is the Club's
                own sentiment — the share of this member's positions called
                bullish. Not a market number, not a score of being right. */}
            <p
              className="mt-2 text-[26px] font-extrabold leading-none tracking-[-0.02em]"
              style={{ color: "var(--cc-up)" }}
            >
              {conviction == null ? "—" : `${conviction}%`}
            </p>
            <p className="mt-1.5 text-[10px] leading-[1.45]" style={{ color: "var(--cc-soft)" }}>
              The share of your positions you&apos;ve called bullish
            </p>
          </Card>

          <Card className="flex-[1.5] p-3.5">
            <CardLabel>where your reps come from</CardLabel>
            {state.sources.length === 0 ? (
              <p className="mt-2.5 text-[10.5px] leading-relaxed" style={{ color: "var(--cc-soft)" }}>
                Nothing has earned XP yet. Finish a lesson or post in the Club and this fills
                in with your own split.
              </p>
            ) : (
              <div className="mt-2.5 space-y-2">
                {state.sources.map((s) => (
                  <RepBar key={s.label} label={s.label} pct={s.pct} />
                ))}
              </div>
            )}
          </Card>
        </section>

        {/* ── THE FIVE MEASURES — board 07's five boxed count tiles ────────── */}
        <div className="flex gap-2">
          {[
            { label: "Positions", value: dash(part?.stances) },
            { label: "Research", value: dash(part?.research) },
            { label: "Respect", value: dash(part?.respect) },
            { label: "Changed minds", value: dash(part?.flips) },
            { label: "Club posts", value: dash(part?.posts) },
          ].map((m) => (
            <div
              key={m.label}
              className="flex-1 rounded-[13px] border px-1.5 py-[11px] text-center"
              style={{ borderColor: "var(--cc-line)", background: "var(--cc-card)" }}
            >
              <div
                className="font-[family-name:var(--font-plex-mono)] text-[15px] font-semibold"
                style={{ color: "var(--cc-ink)" }}
              >
                {m.value}
              </div>
              <div className="mt-[3px] text-[8px] leading-tight" style={{ color: "var(--cc-dim)" }}>
                {m.label}
              </div>
            </div>
          ))}
        </div>

        {/* ── STREAK — warm orange-wash card, 🔥 flair + seven-day pips ─────── */}
        <div
          className="flex items-center gap-3.5 rounded-2xl border px-4 py-3.5"
          style={{
            background:
              "linear-gradient(120deg, color-mix(in srgb, var(--cc-orange) 14%, var(--cc-card)) 0%, var(--cc-card) 65%)",
            borderColor: "color-mix(in srgb, var(--cc-orange) 30%, var(--cc-line))",
          }}
        >
          <span aria-hidden className="text-[26px] leading-none">
            🔥
          </span>
          <div className="min-w-0 flex-1">
            <div
              className="font-[family-name:var(--font-plex-mono)] text-[8.5px] font-semibold uppercase tracking-[0.14em]"
              style={{ color: "var(--cc-orange-ink)" }}
            >
              your streak
            </div>
            <p className="mt-[3px] leading-none" style={{ color: "var(--cc-ink)" }}>
              <span className="text-[19px] font-extrabold">{state.streakDays}</span>{" "}
              <span className="text-[12px]" style={{ color: "var(--cc-soft)" }}>
                {state.streakDays === 1 ? "day in a row" : "days in a row"}
              </span>
            </p>
          </div>
          <StreakPips days={state.streakWindow} />
        </div>

        {/* ── RECENT POSITIONS — dated ledger, NO verdict / ✓ / % ──────────── */}
        <section className="space-y-2.5 pt-1">
          <SectionHead action={<TextLink href="/discover">See all</TextLink>}>
            recent positions
          </SectionHead>
          {state.part == null ? (
            <div className="space-y-2" aria-busy="true">
              {[0, 1].map((i) => (
                <div
                  key={i}
                  className="h-[48px] rounded-2xl motion-safe:animate-pulse"
                  style={{ background: "var(--cc-card)" }}
                />
              ))}
            </div>
          ) : state.positions.length === 0 ? (
            <EmptyStateV2
              title="No positions yet"
              body="Take a position on a company you've actually looked at — bullish, bearish or neutral. It lands here, and you can change it any time."
              href="/discover"
              cta="Browse companies"
            />
          ) : (
            <div className="space-y-2">
              {state.positions.map((p) => (
                <Link
                  key={p.ticker}
                  href={`/research/${encodeURIComponent(p.ticker)}`}
                  className="flex items-center gap-2.5 rounded-xl border px-3 py-2.5"
                  style={{ borderColor: "var(--cc-line)", background: "var(--cc-card)" }}
                >
                  <TickerBadge symbol={p.ticker} size={28} />
                  <span className="min-w-0 flex-1">
                    <span
                      className="block font-[family-name:var(--font-plex-mono)] text-[11px] font-semibold"
                      style={{ color: "var(--cc-ink)" }}
                    >
                      {p.ticker}
                    </span>
                    <span className="block text-[11.5px]" style={{ color: "var(--cc-soft)" }}>
                      {p.stance}
                    </span>
                  </span>
                  <span
                    className="shrink-0 font-[family-name:var(--font-plex-mono)] text-[11px] tabular-nums"
                    style={{ color: "var(--cc-soft)" }}
                  >
                    {p.when}
                  </span>
                </Link>
              ))}
            </div>
          )}
        </section>

        {/* ── BADGES — the credential shelf, cc-skinned ────────────────────── */}
        <section className="space-y-2.5 pt-1">
          <SectionHead action={<TextLink href="/leaderboard">Leaderboard</TextLink>}>
            badges
          </SectionHead>
          {badges == null ? (
            <div className="flex gap-2" aria-busy="true">
              {[0, 1, 2, 3].map((i) => (
                <div
                  key={i}
                  className="h-[88px] w-[92px] shrink-0 rounded-2xl motion-safe:animate-pulse"
                  style={{ background: "var(--cc-card)" }}
                />
              ))}
            </div>
          ) : awarded.length === 0 ? (
            <EmptyStateV2
              title="No badges yet"
              body="Badges are earned, not granted — research a company, show up to a class, finish a lesson. The first one you earn appears here."
              href="/discover"
              cta="Find something to research"
            />
          ) : (
            <div className="no-scrollbar flex gap-2 overflow-x-auto pb-1">
              {(badges ?? []).map((b) => (
                <div
                  key={b.slug}
                  title={b.subtitle ?? undefined}
                  className="flex w-[92px] shrink-0 flex-col items-center gap-2 rounded-2xl border px-2 py-3 text-center"
                  style={{
                    borderColor: "var(--cc-line)",
                    background: "var(--cc-card)",
                    opacity: b.awarded ? 1 : 0.45,
                  }}
                >
                  <span
                    className="grid h-8 w-8 place-items-center rounded-full text-[13px] font-extrabold"
                    style={
                      b.awarded
                        ? { background: "var(--cc-orange)", color: "var(--cc-orange-deep)" }
                        : { background: "var(--cc-card2)", color: "var(--cc-soft)" }
                    }
                    aria-hidden
                  >
                    {b.title.slice(0, 1).toUpperCase()}
                  </span>
                  <span
                    className="text-[10px] font-bold leading-tight"
                    style={{ color: "var(--cc-ink)" }}
                  >
                    {b.title}
                  </span>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* ── LEARNING — course progress with mini meters ──────────────────── */}
        <section className="space-y-2.5 pt-1">
          <SectionHead action={<TextLink href="/courses">Learn</TextLink>}>learning</SectionHead>
          {state.courses.length === 0 ? (
            <EmptyStateV2
              title="No path started"
              body="Your course progress shows up here the moment you open a lesson."
              href="/courses"
              cta="Browse the library"
            />
          ) : (
            <div className="space-y-2">
              {state.courses.map((c) => {
                const pct = c.total > 0 ? Math.round((c.done / c.total) * 100) : 0;
                return (
                  <YoursRow
                    key={c.slug}
                    href={`/courses/${c.slug}`}
                    title={c.title}
                    sub={`${c.done} of ${c.total} lessons`}
                    value={
                      <span className="flex items-center gap-2.5">
                        <span
                          className="font-[family-name:var(--font-plex-mono)] text-[11px] tabular-nums"
                          style={{ color: "var(--cc-soft)" }}
                        >
                          {pct}%
                        </span>
                        <MiniMeter pct={pct} />
                      </span>
                    }
                  />
                );
              })}
            </div>
          )}
        </section>

        {/* ── YOURS — doors into posts / saved / belts / settings ──────────── */}
        <section className="space-y-2.5 pt-1">
          <SectionHead charged={false}>yours</SectionHead>
          <div className="space-y-2">
            <YoursRow
              href={postsHref}
              title="My posts"
              sub={
                state.username
                  ? "Your public profile and everything you've said in the Club"
                  : "Pick a handle in Settings to get a public profile"
              }
              value={
                <span className="flex items-center gap-2">
                  <span
                    className="font-[family-name:var(--font-plex-mono)] text-[11px] tabular-nums"
                    style={{ color: "var(--cc-soft)" }}
                  >
                    {dash(part?.posts)}
                  </span>
                  <ChevronRight className="h-3.5 w-3.5" style={{ color: "var(--cc-soft)" }} />
                </span>
              }
            />
            <YoursRow
              href="/watchlist"
              title="Saved"
              sub="Companies you champion on the watchlist"
              value={
                <span className="flex items-center gap-2">
                  <span
                    className="font-[family-name:var(--font-plex-mono)] text-[11px] tabular-nums"
                    style={{ color: "var(--cc-soft)" }}
                  >
                    {dash(state.saved)}
                  </span>
                  <ChevronRight className="h-3.5 w-3.5" style={{ color: "var(--cc-soft)" }} />
                </span>
              }
            />
            <YoursRow
              href="/belts"
              title="The belt ladder"
              sub={bp.next ? "Every belt, and what each one takes" : "Top of the ladder — every belt earned"}
              value={<ChevronRight className="h-3.5 w-3.5" style={{ color: "var(--cc-soft)" }} />}
            />
            <YoursRow
              href="/settings"
              title="Settings"
              sub="Profile, theme, notifications, membership"
              value={<ChevronRight className="h-3.5 w-3.5" style={{ color: "var(--cc-soft)" }} />}
            />
          </div>
        </section>

        {/* ── COMPLIANCE FOOTER — honest numbers, typeset ──────────────────── */}
        <p className="pt-1 text-[11px] leading-relaxed" style={{ color: "var(--cc-soft)" }}>
          {state.since ? `Member since ${state.since}. ` : ""}
          Every number here is a count of something you did. We don&apos;t publish member
          accuracy or win rates, so nothing on this page is a claim about returns — a measure
          reads &ldquo;—&rdquo; until you&apos;ve given it something real.
        </p>
      </div>
    </V2Surface>
  );
}

/* ══════════════════════════════════════════════════════════════════════════
   LOCAL cc PARTS — small pieces board 07 needs that have no cc primitive.
   Belt colours are INTRINSIC (real hex from BELTS), never a cc token.
   ══════════════════════════════════════════════════════════════════════════ */

/** Board 07's 92px identity disc, ringed in the member's real belt colour. */
function BeltRingAvatar({
  name,
  avatarUrl,
  belt,
  size = 92,
}: {
  name: string;
  avatarUrl?: string | null;
  belt: Belt;
  size?: number;
}) {
  // White (#E8EAF0) and Black (#1F2430) each vanish against a ground, so both
  // fall back to their border hex for a visible ring in either theme.
  const ring =
    belt.key === "white" || belt.key === "black" ? belt.borderHex : belt.hex;
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <span
        className="block h-full w-full rounded-full p-[3px]"
        style={{ background: ring }}
      >
        <span
          className="grid h-full w-full place-items-center overflow-hidden rounded-full"
          style={{ background: "var(--cc-card2)", border: "3px solid var(--cc-bg)" }}
        >
          {avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={avatarUrl} alt="" className="h-full w-full rounded-full object-cover" />
          ) : (
            <span
              className="font-extrabold"
              style={{ color: "var(--cc-ink)", fontSize: Math.round(size * 0.3) }}
            >
              {(name || "?").slice(0, 1).toUpperCase()}
            </span>
          )}
        </span>
      </span>
      {/* Worn status: the orange live-node is a Black-Belt-only mark (spec §4). */}
      {belt.key === "black" && (
        <span
          className="absolute -right-0.5 -top-0.5 h-3 w-3 rounded-full"
          style={{ background: "var(--cc-orange)", border: "2px solid var(--cc-bg)" }}
        />
      )}
    </div>
  );
}

/** Belt mark — a 14px swatch in the belt's own colour + its name (board 07). */
function BeltChip({ belt, label }: { belt: Belt; label: string }) {
  return (
    <span className="inline-flex shrink-0 items-center gap-1.5">
      <span
        aria-hidden
        className="inline-block h-[14px] w-[14px] rounded-[3px]"
        style={{ backgroundColor: belt.hex }}
      />
      <span className="text-[12.5px] font-bold" style={{ color: "var(--cc-ink)" }}>
        {label}
      </span>
    </span>
  );
}

/** 8.5px mono card-label — the in-card section voice (INFLUENCE, STREAK…). */
function CardLabel({ children, tone = "soft" }: { children: ReactNode; tone?: "soft" | "orange" }) {
  return (
    <div
      className="font-[family-name:var(--font-plex-mono)] text-[8.5px] font-semibold uppercase tracking-[0.14em]"
      style={{ color: tone === "orange" ? "var(--cc-orange-ink)" : "var(--cc-soft)" }}
    >
      {children}
    </div>
  );
}

/** "Where your reps come from" bar — a share of the member's OWN XP, labelled. */
function RepBar({ label, pct }: { label: string; pct: number }) {
  const w = Math.max(0, Math.min(100, pct));
  return (
    <div>
      <div className="flex items-baseline justify-between gap-3 text-[10.5px]">
        <span className="min-w-0 truncate" style={{ color: "var(--cc-ink)" }}>
          {label}
        </span>
        <span
          className="shrink-0 font-[family-name:var(--font-plex-mono)] tabular-nums"
          style={{ color: "var(--cc-soft)" }}
        >
          {pct}%
        </span>
      </div>
      <div
        className="mt-1 h-1 overflow-hidden rounded-full"
        style={{ background: "var(--cc-card2)" }}
        role="progressbar"
        aria-valuenow={w}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <div className="h-full rounded-full" style={{ width: `${w}%`, background: "var(--cc-orange)" }} />
      </div>
    </div>
  );
}

/** Seven-day streak pips — filled only where that day carries a real award. */
function StreakPips({ days }: { days: boolean[] }) {
  return (
    <div className="flex shrink-0 items-center gap-1" aria-hidden>
      {days.map((on, i) => (
        <span
          key={i}
          className="block h-[22px] w-2 rounded-[4px]"
          style={{
            background: on
              ? "var(--cc-orange)"
              : "color-mix(in srgb, var(--cc-orange) 16%, var(--cc-card2))",
          }}
        />
      ))}
    </div>
  );
}

/** 40×6 progress meter — board 22's footer bar, cc-skinned. */
function MiniMeter({ pct, width = 40 }: { pct: number; width?: number }) {
  const w = Math.max(0, Math.min(100, pct));
  return (
    <span
      className="block h-1.5 shrink-0 overflow-hidden rounded-full"
      style={{ width, background: "var(--cc-card2)" }}
      role="progressbar"
      aria-valuenow={w}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <span className="block h-full rounded-full" style={{ width: `${w}%`, background: "var(--cc-orange)" }} />
    </span>
  );
}

/** Section header — mono kicker + a quiet right-hand action. */
function SectionHead({
  children,
  action,
  charged = true,
}: {
  children: ReactNode;
  action?: ReactNode;
  charged?: boolean;
}) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <div
        className="font-[family-name:var(--font-plex-mono)] text-[9.5px] font-semibold uppercase tracking-[0.16em]"
        style={{ color: charged ? "var(--cc-orange-ink)" : "var(--cc-soft)" }}
      >
        {children}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}

/** Quiet orange text link — the board's "See all" affordance. */
function TextLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link
      href={href}
      className="font-[family-name:var(--font-plex-mono)] text-[11px] font-semibold"
      style={{ color: "var(--cc-orange-ink)" }}
    >
      {children}
    </Link>
  );
}

/** A door row — mono/display title, sub, right-hand value. */
function YoursRow({
  href,
  title,
  sub,
  value,
}: {
  href: string;
  title: ReactNode;
  sub?: ReactNode;
  value?: ReactNode;
}) {
  return (
    <Link
      href={href}
      className="flex items-center gap-3 rounded-2xl border px-3 py-2.5"
      style={{ borderColor: "var(--cc-line)", background: "var(--cc-card)" }}
    >
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[13px] font-bold" style={{ color: "var(--cc-ink)" }}>
          {title}
        </span>
        {sub && (
          <span className="mt-0.5 block truncate text-[10.5px] leading-snug" style={{ color: "var(--cc-soft)" }}>
            {sub}
          </span>
        )}
      </span>
      {value && <span className="shrink-0 text-right">{value}</span>}
    </Link>
  );
}

/** Honest empty — a stated absence with a way out. */
function EmptyStateV2({
  title,
  body,
  href,
  cta,
}: {
  title: string;
  body: string;
  href: string;
  cta: string;
}) {
  return (
    <Card className="px-4 py-5">
      <p className="text-[15px] font-extrabold" style={{ color: "var(--cc-ink)" }}>
        {title}
      </p>
      <p className="mt-1.5 max-w-[52ch] text-[13px] leading-relaxed" style={{ color: "var(--cc-soft)" }}>
        {body}
      </p>
      <div className="mt-3">
        <TextLink href={href}>{cta} →</TextLink>
      </div>
    </Card>
  );
}

/** Belt ladder rungs (board 22) — five belts, member's belt marked current. */
function beltLadderRungs(currentKey: string): LadderRung[] {
  // Evenly spaced up the column, White lowest → Black at the top.
  const at: Record<number, number> = { 0: 8, 1: 30, 2: 52, 3: 74, 4: 96 };
  return BELT_ORDER.map((key) => {
    const b = BELTS[key];
    const current = key === currentKey;
    return {
      at: at[b.order] ?? 50,
      label: current ? `${b.name} — you` : b.name,
      current,
      tone: b.key === "white" || b.key === "black" ? b.borderHex : b.hex,
    } as LadderRung;
  });
}

/* LOADING ≠ EMPTY — the shape of the surface arriving, in cc tokens. */
function ProfileSkeletonV2() {
  return (
    <div className="mx-auto max-w-2xl space-y-4 px-4 pb-20 pt-4" aria-busy="true">
      <div className="h-9 w-24 rounded" style={{ background: "var(--cc-card2)" }} />
      <div className="flex items-center gap-4 pt-1">
        <div
          className="h-[92px] w-[92px] shrink-0 rounded-full motion-safe:animate-pulse"
          style={{ background: "var(--cc-card2)" }}
        />
        <div className="min-w-0 flex-1 space-y-2.5">
          <div className="h-6 w-40 rounded motion-safe:animate-pulse" style={{ background: "var(--cc-card2)" }} />
          <div className="h-3.5 w-28 rounded motion-safe:animate-pulse" style={{ background: "var(--cc-card2)" }} />
          <div className="h-3 w-36 rounded motion-safe:animate-pulse" style={{ background: "var(--cc-card2)" }} />
        </div>
        <div
          className="h-16 w-16 shrink-0 rounded-full motion-safe:animate-pulse"
          style={{ background: "var(--cc-card2)" }}
        />
      </div>
      <div className="h-[64px] rounded-2xl motion-safe:animate-pulse" style={{ background: "var(--cc-card)" }} />
      <div className="h-[240px] rounded-2xl motion-safe:animate-pulse" style={{ background: "var(--cc-card)" }} />
      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="h-[120px] rounded-2xl motion-safe:animate-pulse sm:flex-1" style={{ background: "var(--cc-card)" }} />
        <div className="h-[120px] rounded-2xl motion-safe:animate-pulse sm:flex-[1.5]" style={{ background: "var(--cc-card)" }} />
      </div>
      <div className="h-[64px] rounded-2xl motion-safe:animate-pulse" style={{ background: "var(--cc-card)" }} />
      <span className="sr-only">Loading your profile</span>
    </div>
  );
}
