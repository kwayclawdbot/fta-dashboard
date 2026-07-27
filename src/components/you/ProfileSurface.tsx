"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight, Pencil, RotateCcw } from "lucide-react";

import { createClient } from "@/lib/supabase/client";
import { getUserXp, levelProgress } from "@/lib/xp";
import { beltForXp } from "@/lib/belts";
import { getBadgeState, evaluateBadges, type BadgeRow } from "@/lib/badges";
import { TickerTile, TickerTileStrip } from "@/components/canvas2";
import {
  DisplayHead,
  SectionRule,
  Ledger,
  LedgerLink,
  LedgerRow,
  MeasureStrip,
  Meter,
  EmptyLine,
  TextAction,
  dash,
} from "@/components/f0/parts";

/* ══════════════════════════════════════════════════════════════════════════
   YOU — the member's own profile surface (route: /progress).
   Canvas v2, App Light board 07 "You · Profile".

   Composition, top → bottom:
     · YOU masthead (display-1) + eyebrow
     · IDENTITY HERO — the one obsidian field on the surface: avatar, name,
       belt/level, XP, next-level meter, participation-streak marks
     · YOUR NUMBERS — positions / conviction / changed minds as a measure strip,
       then the rest of the participation record as a hairline ledger
     · WHERE YOU STAND — current positions as canvas ticker tiles
     · CHANGED YOUR MIND — the flip ledger; the update, not the ego
     · CREDENTIALS — the badge shelf as chips, not tiles
     · LEARNING — course progress as ledger rows with meters
     · RECENT — completed lessons as a dated ledger
     · rows: My posts · Saved · Settings

   ── WHAT THE CANVAS DRAWS HERE THAT DOES NOT SHIP ─────────────────────────
   Board 07 puts an `87 OPINION SCORE` conic dial beside the member's name, an
   `Accuracy 71%` measure in the stat row, `Influence 1.8x` ("your opinions
   carry 1.8x more weight"), `People Influenced 382`, a "Strongest areas /
   Top 4%" percentile block, and a "Recent calls" ledger scored `✓ +6.4%` /
   `✗ −2.1%`. None of it ships, and the reason is one reason: publishing a
   member's hit rate — or any score derived from it — is a performance claim on
   the most shareable surface in the app. The percentile block fails a second
   test (no percentile of anything is computed anywhere) and the dial fails a
   third (plan §1.5: the club-sentiment arc stays the only radial gauge).

   What replaces them is CONVICTION and PARTICIPATION, from
   `member_participation` (migration 196): positions taken, share of them
   bullish, minds changed in public, respect received for those updates, notes
   and posts written, weeks active — every one a behaviour the member performed
   rather than a verdict on whether they were right.

   REAL DATA ONLY. Every number is a real read: profiles · xp_events (XP, level,
   participation streak) · member_participation + member_flips RPCs ·
   ticker_stances · family_watchlist · lesson_progress + courses.
   Any measure the feed cannot supply renders "—". Nothing is fabricated.
   ══════════════════════════════════════════════════════════════════════════ */

interface CourseLine {
  slug: string;
  title: string;
  done: number;
  total: number;
}

interface RecentLine {
  lessonId: string;
  title: string;
  completedAt: string;
}

interface FlipLine {
  id: string;
  ticker: string;
  from_stance: string | null;
  to_stance: string;
  created_at: string;
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

interface ProfileState {
  userId: string | null;
  name: string;
  username: string | null;
  avatarUrl: string | null;
  since: string | null;
  xp: number;
  /** distinct trailing ISO-weeks carrying an xp_event */
  streakWeeks: number;
  /** null until the participation RPC answers — "—" until then, never 0 */
  part: Participation | null;
  positions: string[];
  flips: FlipLine[];
  saved: number | null;
  courses: CourseLine[];
  recent: RecentLine[];
}

const EMPTY: ProfileState = {
  userId: null,
  name: "",
  username: null,
  avatarUrl: null,
  since: null,
  xp: 0,
  streakWeeks: 0,
  part: null,
  positions: [],
  flips: [],
  saved: null,
  courses: [],
  recent: [],
};

const STANCE_WORD: Record<string, string> = {
  bull: "Bullish",
  bear: "Bearish",
  neutral: "Neutral",
};

/** Monday-anchored ISO-week key for a date. */
function weekKey(d: Date): string {
  const t = new Date(d);
  t.setHours(0, 0, 0, 0);
  t.setDate(t.getDate() - ((t.getDay() + 6) % 7));
  return t.toISOString().slice(0, 10);
}

function relative(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${Math.max(mins, 0)}m`;
  const hours = Math.floor(diff / 3600000);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(diff / 86400000);
  return days === 1 ? "1d" : `${days}d`;
}

export default function ProfileSurface() {
  const [state, setState] = useState<ProfileState>(EMPTY);
  const [badges, setBadges] = useState<BadgeRow[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);

  const load = useCallback(async () => {
    const supabase = createClient();
    // Never strand the surface on a hanging query — settle and offer a retry.
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
          .select("created_at")
          .eq("user_id", user.id)
          .order("created_at", { ascending: false })
          .limit(500),
        supabase
          .from("lesson_progress")
          .select("lesson_id, completed_at")
          .eq("user_id", user.id)
          .eq("status", "completed")
          .order("completed_at", { ascending: false }),
        supabase
          .from("courses")
          .select("slug, title, modules(lessons(id))")
          .in("program", ["fic", "fta"])
          .eq("published", true)
          .order("sort_order"),
      ]);

      const profile = profileRes.data;

      // ── participation streak — trailing run of weeks with an xp_event ─────
      let streakWeeks = 0;
      const events = (eventsRes.data ?? []) as { created_at: string }[];
      if (events.length > 0) {
        const weeks = new Set(events.map((e) => weekKey(new Date(e.created_at))));
        let w = weekKey(new Date());
        while (weeks.has(w)) {
          streakWeeks += 1;
          const prev = new Date(w);
          prev.setDate(prev.getDate() - 7);
          w = prev.toISOString().slice(0, 10);
        }
      }

      // ── learning ledger from the single nested course query ───────────────
      const completed = (progressRes.data ?? []) as {
        lesson_id: string;
        completed_at: string | null;
      }[];
      const completedIds = new Set(completed.map((p) => p.lesson_id));
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
        userId: user.id,
        name:
          (profile?.display_name as string | null) ||
          user.email?.split("@")[0] ||
          "Member",
        username: (profile?.username as string | null) ?? null,
        avatarUrl: (profile?.avatar_url as string | null) ?? null,
        since: profile?.created_at
          ? new Date(profile.created_at as string).toLocaleString("en-US", {
              month: "short",
              year: "numeric",
            })
          : null,
        xp,
        streakWeeks,
        part: null,
        positions: [],
        flips: [],
        saved: null,
        courses,
        recent: [],
      });

      // Core content is in — paint. Everything below fills in behind it.
      settled = true;
      clearTimeout(timeout);
      setLoading(false);

      // ── recent lesson titles (needs a second hop on the ids) ──────────────
      if (completed.length > 0) {
        const ids = completed.slice(0, 5).map((p) => p.lesson_id);
        const { data: lessons } = await supabase
          .from("lessons")
          .select("id, title")
          .in("id", ids);
        const titles = new Map(
          (lessons ?? []).map((l: { id: string; title: string }) => [l.id, l.title])
        );
        setState((s) => ({
          ...s,
          recent: completed
            .slice(0, 5)
            .filter((p) => p.completed_at)
            .map((p) => ({
              lessonId: p.lesson_id,
              title: titles.get(p.lesson_id) ?? "Lesson",
              completedAt: p.completed_at as string,
            })),
        }));
      }

      // ── participation, positions, flips, saved ────────────────────────────
      // member_participation is the authority on the counts: feed_posts SELECT
      // is family-scoped, so counting posts from the client undercounts and
      // then prints the undercount as a total. Each read is guarded on its own,
      // so one missing table never blanks the others — a failed read leaves the
      // measure null and the strip renders "—".
      const [partRes, stanceRes, flipRes, savedRes] = await Promise.all([
        supabase.rpc("member_participation", { p_user_id: user.id }),
        supabase
          .from("ticker_stances")
          .select("ticker, updated_at")
          .eq("user_id", user.id)
          .order("updated_at", { ascending: false })
          .limit(12),
        supabase.rpc("member_flips", { p_user_id: user.id, p_limit: 4 }),
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
          : ((stanceRes.data ?? []) as { ticker: string }[]).map((r) =>
              r.ticker.toUpperCase()
            ),
        flips: flipRes.error ? [] : ((flipRes.data ?? []) as FlipLine[]),
        saved: savedRes.error ? null : (savedRes.count ?? null),
      }));

      // ── credential shelf (self-award, then read) ──────────────────────────
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

  if (loading) return <ProfileSkeleton />;

  if (failed) {
    return (
      <div className="mx-auto max-w-2xl py-16">
        <EmptyLine
          title="Your profile didn't load"
          body="Something hiccuped on our end — nothing you've earned is affected. Give it another go."
          action={
            <TextAction
              onClick={() => {
                setFailed(false);
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

  const prog = levelProgress(state.xp);
  const belt = beltForXp(state.xp);
  const awarded = (badges ?? []).filter((b) => b.awarded);
  const postsHref = state.username ? `/u/${state.username}` : "/community";
  const part = state.part;
  const conviction =
    part && part.stances > 0
      ? Math.round((part.bullStances / part.stances) * 100)
      : null;

  return (
    <div className="mx-auto max-w-2xl space-y-10 pb-16">
      <DisplayHead
        eyebrow="Cheat Code Club"
        title="You"
        lede="Everything you've built here — your belt, your reps, and the record of the work behind them."
      />

      {/* ── IDENTITY HERO — the one obsidian field on this surface ─────────
          f0-hero-field is obsidian in BOTH themes by design, so the type and
          hairlines INSIDE it are theme-invariant cream/white-alpha — the same
          rule that governs type on the orange action band. This is the only
          place on the surface where a non-token colour is correct; everything
          outside the field is ink / soft / sand / paper.

          The canvas puts an 87 OPINION SCORE dial in the top-right of this
          block. The belt swatch takes that position instead: earned from reps,
          verifiable, and not a rating of anyone's opinions. */}
      <section className="f0-hero-field f0-grain p-6 sm:p-7">
        <div className="relative flex items-center gap-4">
          <span className="grid h-16 w-16 shrink-0 place-items-center overflow-hidden rounded-2xl bg-white/10 ring-2 ring-volt-500">
            {state.avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={state.avatarUrl}
                alt=""
                className="h-full w-full object-cover"
              />
            ) : (
              <span className="font-display text-[24px] font-extrabold text-[#F7F3EA]">
                {state.name.slice(0, 1).toUpperCase()}
              </span>
            )}
          </span>

          <div className="min-w-0 flex-1">
            <h2 className="truncate font-display text-display-3 font-extrabold text-[#F7F3EA]">
              {state.name}
            </h2>
            <p className="mt-1 font-mono text-[12px] text-[#F7F3EA]/60">
              {state.username ? `@${state.username}` : "Club member"}
              {state.since ? ` · since ${state.since}` : ""}
            </p>
          </div>

          <Link
            href="/settings"
            className="f0-focus f0-press inline-flex shrink-0 items-center gap-1.5 rounded-full border border-white/25 px-3.5 py-1.5 font-display text-[13px] font-bold text-[#F7F3EA] transition-colors hover:border-volt-400 hover:text-volt-300"
          >
            <Pencil className="h-3.5 w-3.5" /> Edit
          </Link>
        </div>

        <div className="relative mt-6 border-t border-white/12 pt-5">
          <div className="flex items-end justify-between gap-4">
            <div className="min-w-0">
              <p className="text-eyebrow font-display font-bold uppercase text-[#F7F3EA]/55">
                Your belt
              </p>
              {/* The belt swatch is intrinsic colour — a blue belt is blue in
                  every theme — so it is an inline style, not a token. Purple is
                  a legal BELT colour and appears nowhere else in the chrome. */}
              <p className="mt-1.5 flex items-center gap-2.5">
                <span
                  aria-hidden
                  className="h-5 w-5 shrink-0 rounded-[5px] ring-1 ring-white/30"
                  style={{ backgroundColor: belt.belt.hex }}
                />
                <span className="font-display text-display-2 font-extrabold text-[#F7F3EA]">
                  {belt.label}
                </span>
              </p>
              <p className="mt-1.5 font-mono text-[12px] text-[#F7F3EA]/60">
                Level {prog.current.level} · {prog.current.name}
              </p>
            </div>
            <p className="shrink-0 text-right">
              <span className="font-mono text-[22px] font-semibold tabular-nums text-[#F7F3EA]">
                {state.xp.toLocaleString()}
              </span>
              <span className="ml-1 font-display text-[12px] font-bold text-volt-400">
                XP
              </span>
            </p>
          </div>

          <Meter pct={prog.pct} onDark className="mt-4" />
          <div className="mt-2 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
            <p className="font-mono text-[12px] text-[#F7F3EA]/60">
              {prog.next
                ? `${prog.toNext.toLocaleString()} XP to Level ${prog.next.level} · ${prog.next.name}`
                : "Top of the ladder — every level earned"}
            </p>
            <Link
              href="/belts"
              className="f0-focus inline-flex items-center gap-1 rounded font-display text-[12px] font-bold text-volt-400 transition-colors hover:text-volt-300"
            >
              See the ladder <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
        </div>

        {/* participation streak — one mark per trailing week, capped at the
            8-week window the marks can honestly hold. */}
        <div className="relative mt-5 flex items-center justify-between gap-4 border-t border-white/12 pt-4">
          <div>
            <p className="text-eyebrow font-display font-bold uppercase text-[#F7F3EA]/55">
              Participation streak
            </p>
            <p className="mt-1 font-display text-[17px] font-extrabold text-[#F7F3EA]">
              {state.streakWeeks === 0
                ? "No active streak"
                : `${state.streakWeeks} ${state.streakWeeks === 1 ? "week" : "weeks"}`}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-1.5" aria-hidden>
            {Array.from({ length: 8 }).map((_, i) => (
              <span
                key={i}
                className={`h-5 w-1.5 rounded-full ${
                  i < Math.min(8, state.streakWeeks)
                    ? "bg-volt-500"
                    : "bg-white/15"
                }`}
              />
            ))}
          </div>
        </div>
      </section>

      {/* ── YOUR NUMBERS ─────────────────────────────────────────────────── */}
      <section className="space-y-5">
        <SectionRule>Your numbers</SectionRule>
        <MeasureStrip
          items={[
            { label: "Positions", value: dash(part?.stances) },
            {
              label: "Conviction",
              value: conviction == null ? "—" : `${conviction}%`,
              tone: "sentiment",
            },
            { label: "Changed minds", value: dash(part?.flips) },
          ]}
        />
        <Ledger>
          <LedgerRow label="Research notes" value={dash(part?.research)} />
          <LedgerRow label="Club posts" value={dash(part?.posts)} />
          <LedgerRow
            label="Respect received"
            sub="Members acknowledging an update you made in public"
            value={dash(part?.respect)}
          />
          <LedgerRow label="Weeks active" value={dash(part?.weeksActive)} />
        </Ledger>
        <p className="text-[13px] leading-relaxed text-soft">
          Conviction is the share of your positions you called bullish — the
          Club&apos;s own sentiment measure, not a market number, and never a
          score of whether you were right. A measure reads &ldquo;—&rdquo; until
          you&apos;ve given it something real.
        </p>
      </section>

      {/* ── WHERE YOU STAND ──────────────────────────────────────────────────
          The canvas's ticker tile at its intended density. No delta on these:
          this strip is a record of POSITIONS TAKEN, and a price beside each one
          would turn a participation record into a scoreboard. Below the floor
          the strip pads with dashed slots rather than collapsing — a member with
          two positions should look like someone getting started, not broken. */}
      <section className="space-y-4">
        <SectionRule
          action={<TextAction href="/discover">Find one</TextAction>}
        >
          Where you stand
        </SectionRule>
        {state.positions.length === 0 ? (
          <EmptyLine
            title="No positions yet"
            body="Take a position on a company you've actually looked at — bullish, bearish or neutral. It lands here, and you can change it any time."
            action={
              <TextAction href="/discover">
                Browse companies <ArrowRight className="h-3.5 w-3.5" />
              </TextAction>
            }
          />
        ) : (
          <>
            <TickerTileStrip minSlots={5} size="md">
              {state.positions.map((t) => (
                <TickerTile
                  key={t}
                  ticker={t}
                  showDelta={false}
                  href={`/research/${encodeURIComponent(t)}`}
                />
              ))}
            </TickerTileStrip>
            <p className="text-[13px] text-soft">
              Companies you&apos;ve taken a position on. Tap one to revisit the
              call.
            </p>
          </>
        )}
      </section>

      {/* ── CHANGED YOUR MIND ────────────────────────────────────────────────
          A flip is rendered as a BEHAVIOUR: which company, which way, when.
          Direction is carried by the words and by reading order — never by hue,
          because bull/bear in green/red would put the price ramp on a community
          object. Nothing here says whether the change turned out well. */}
      <section className="space-y-4">
        <SectionRule
          action={
            <TextAction href="/community/changed-my-mind">All flips</TextAction>
          }
        >
          Changed your mind
        </SectionRule>
        {state.flips.length === 0 ? (
          <EmptyLine
            title="No changes of mind yet"
            body="The Club rewards the update, not the ego. When new evidence moves you off a position, say so — it gets recorded here."
          />
        ) : (
          <Ledger>
            {state.flips.map((f) => (
              <LedgerRow
                key={f.id}
                label={
                  <span className="font-mono text-[13px] font-semibold">
                    {f.ticker.toUpperCase()}
                  </span>
                }
                sub={`${
                  f.from_stance ? STANCE_WORD[f.from_stance] ?? f.from_stance : "No position"
                } → ${STANCE_WORD[f.to_stance] ?? f.to_stance}`}
                value={relative(f.created_at)}
              />
            ))}
          </Ledger>
        )}
      </section>

      {/* ── CREDENTIALS ──────────────────────────────────────────────────── */}
      <section className="space-y-5">
        <SectionRule action={<TextAction href="/leaderboard">Leaderboard</TextAction>}>
          Credentials
        </SectionRule>
        {badges == null ? (
          <div className="flex gap-2" aria-busy="true">
            {Array.from({ length: 6 }).map((_, i) => (
              <span
                key={i}
                className="h-8 w-24 rounded-full bg-sand/60 motion-safe:animate-pulse"
              />
            ))}
          </div>
        ) : awarded.length === 0 ? (
          <EmptyLine
            title="No titles yet"
            body="Credentials are earned, not granted — research a company, show up to a class, finish a lesson. The first one you earn appears here."
            action={<TextAction href="/discover">Find something to research <ArrowRight className="h-3.5 w-3.5" /></TextAction>}
          />
        ) : (
          <div className="flex flex-wrap gap-2">
            {(badges ?? []).map((b) => (
              <span
                key={b.slug}
                title={b.subtitle ?? undefined}
                /* .f0-chip carries structure only and ships with NO padding —
                   see the report note. Padding is the caller's until it lands
                   on the primitive. */
                className={`f0-chip px-3.5 py-1.5 font-display text-[13px] font-bold ${
                  b.awarded ? "f0-chip-on" : "text-soft"
                }`}
              >
                {b.title}
              </span>
            ))}
          </div>
        )}
      </section>

      {/* ── LEARNING ─────────────────────────────────────────────────────── */}
      <section className="space-y-4">
        <SectionRule action={<TextAction href="/courses">Learn</TextAction>}>
          Learning
        </SectionRule>
        {state.courses.length === 0 ? (
          <EmptyLine
            title="No path started"
            body="Your course progress shows up here the moment you open a lesson."
            action={<TextAction href="/courses">Browse the library <ArrowRight className="h-3.5 w-3.5" /></TextAction>}
          />
        ) : (
          <Ledger>
            {state.courses.map((c) => {
              const pct = c.total > 0 ? Math.round((c.done / c.total) * 100) : 0;
              return (
                <Link
                  key={c.slug}
                  href={`/courses/${c.slug}`}
                  className="f0-ledger-row f0-focus group block"
                >
                  <div className="flex w-full items-center justify-between gap-4">
                    <p className="min-w-0 flex-1 truncate font-display text-[15px] font-bold text-ink">
                      {c.title}
                    </p>
                    <span className="shrink-0 font-mono text-[13px] font-semibold tabular-nums text-soft">
                      {c.done}/{c.total}
                    </span>
                  </div>
                  <Meter pct={pct} className="mt-2 w-full" />
                </Link>
              );
            })}
          </Ledger>
        )}
      </section>

      {/* ── RECENT ───────────────────────────────────────────────────────── */}
      {state.recent.length > 0 && (
        <section className="space-y-4">
          <SectionRule>Recently finished</SectionRule>
          <Ledger>
            {state.recent.map((r) => (
              <LedgerRow
                key={r.lessonId}
                label={r.title}
                value={relative(r.completedAt)}
              />
            ))}
          </Ledger>
        </section>
      )}

      {/* ── ROWS ─────────────────────────────────────────────────────────── */}
      <section className="space-y-4">
        <SectionRule>Yours</SectionRule>
        <Ledger>
          <LedgerLink
            href={postsHref}
            label="My posts"
            sub={
              state.username
                ? "Your public profile and everything you've said in the Club"
                : "Pick a handle in Settings to get a public profile"
            }
            meta={dash(part?.posts)}
          />
          <LedgerLink
            href="/watchlist"
            label="Saved"
            sub="Companies you champion on the watchlist"
            meta={dash(state.saved)}
          />
          <LedgerLink
            href="/settings"
            label="Settings"
            sub="Profile, theme, notifications, membership"
          />
        </Ledger>
      </section>
    </div>
  );
}

/* LOADING ≠ EMPTY (§0.4): this is the shape of the surface arriving, not the
   surface's founding state. The founding state is the designed EmptyLine copy
   in each section above, which only renders once a read has actually answered. */
function ProfileSkeleton() {
  return (
    <div className="mx-auto max-w-2xl space-y-10 pb-16" aria-busy="true">
      <div className="space-y-3">
        <div className="h-3 w-32 rounded bg-sand/60 motion-safe:animate-pulse" />
        <div className="h-11 w-40 rounded bg-sand/60 motion-safe:animate-pulse" />
      </div>
      <div className="h-64 rounded-[1.5rem] bg-sand/40 motion-safe:animate-pulse" />
      <div className="h-20 rounded bg-sand/30 motion-safe:animate-pulse" />
      <TickerTileStrip loading loadingCount={5} />
      <div className="h-32 rounded bg-sand/30 motion-safe:animate-pulse" />
      <span className="sr-only">Loading your profile</span>
    </div>
  );
}
