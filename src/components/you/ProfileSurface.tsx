"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight, Pencil, RotateCcw } from "lucide-react";

import { createClient } from "@/lib/supabase/client";
import { getUserXp, levelProgress } from "@/lib/xp";
import { beltForXp } from "@/lib/belts";
import { getBadgeState, evaluateBadges, type BadgeRow } from "@/lib/badges";
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

   Composition, top → bottom:
     · YOU masthead (display-1) + eyebrow
     · IDENTITY HERO — the one obsidian field on the surface: avatar, name,
       belt/level, XP, next-level meter, participation-streak marks
     · YOUR NUMBERS — the stat trio as a hairline measure strip
     · BADGES — the credential shelf as marks, not tiles
     · LEARNING — course progress as ledger rows with meters
     · RECENT — completed lessons as a dated ledger
     · rows: My posts · Saved · Settings

   REAL DATA ONLY. Every number is an own-user RLS read:
     profiles · xp_events (XP, level, participation streak) ·
     ticker_sentiment (tickers rated, conviction) · research_objects (research) ·
     feed_posts (posts) · family_watchlist (saved) · lesson_progress + courses.
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

interface ProfileState {
  userId: string | null;
  name: string;
  username: string | null;
  avatarUrl: string | null;
  since: string | null;
  xp: number;
  /** distinct trailing ISO-weeks carrying an xp_event */
  streakWeeks: number;
  tickersRated: number | null;
  conviction: number | null;
  research: number | null;
  posts: number | null;
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
  tickersRated: null,
  conviction: null,
  research: null,
  posts: null,
  saved: null,
  courses: [],
  recent: [],
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
    setFailed(false);
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

      const [profileRes, xp, sentimentRes, eventsRes, progressRes, coursesRes] =
        await Promise.all([
          supabase
            .from("profiles")
            .select("display_name, username, avatar_url, created_at")
            .eq("id", user.id)
            .maybeSingle(),
          getUserXp(supabase, user.id).catch(() => 0),
          supabase
            .from("ticker_sentiment")
            .select("vote")
            .eq("user_id", user.id)
            .limit(1000),
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

      // ── stat trio ────────────────────────────────────────────────────────
      // A count only becomes a number when the read actually succeeded; an RLS
      // failure or a missing table leaves it null so the strip renders "—".
      let tickersRated: number | null = null;
      let conviction: number | null = null;
      if (!sentimentRes.error && sentimentRes.data) {
        const rows = sentimentRes.data as { vote: number }[];
        tickersRated = rows.length;
        if (rows.length > 0) {
          const bull = rows.filter((r) => Number(r.vote) === 1).length;
          conviction = Math.round((bull / rows.length) * 100);
        }
      }

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
        tickersRated,
        conviction,
        research: null,
        posts: null,
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

      // ── research / posts / saved — each guarded independently, so one
      //    missing table never blanks the others. ────────────────────────────
      const [researchRes, postsRes, savedRes] = await Promise.all([
        supabase
          .from("research_objects")
          .select("id", { count: "exact", head: true })
          .eq("author_id", user.id)
          .eq("status", "published"),
        supabase
          .from("feed_posts")
          .select("id", { count: "exact", head: true })
          .eq("author_id", user.id)
          .eq("kind", "post"),
        supabase
          .from("family_watchlist")
          .select("id", { count: "exact", head: true })
          .eq("champion_id", user.id),
      ]);
      setState((s) => ({
        ...s,
        research: researchRes.error ? null : (researchRes.count ?? null),
        posts: postsRes.error ? null : (postsRes.count ?? null),
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

  return (
    <div className="mx-auto max-w-2xl space-y-10 pb-16">
      <DisplayHead
        eyebrow="Cheat Code Club"
        title="You"
        lede="Everything you've built here — your level, your reps, and the record of the work behind them."
      />

      {/* ── IDENTITY HERO — the one obsidian field on this surface ─────────
          f0-hero-field is obsidian in BOTH themes by design, so the type and
          hairlines INSIDE it are theme-invariant cream/white-alpha — the same
          rule that governs type on the orange action band. This is the only
          place on the surface where a non-token colour is correct; everything
          outside the field is ink / soft / sand / paper. */}
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
            className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-white/25 px-3.5 py-1.5 font-display text-[13px] font-bold text-[#F7F3EA] transition-colors hover:border-volt-400 hover:text-volt-300"
          >
            <Pencil className="h-3.5 w-3.5" /> Edit
          </Link>
        </div>

        <div className="relative mt-6 border-t border-white/12 pt-5">
          <div className="flex items-end justify-between gap-4">
            <div className="min-w-0">
              <p className="text-eyebrow font-display font-bold uppercase text-[#F7F3EA]/55">
                {belt.label}
              </p>
              <p className="mt-1.5 font-display text-display-2 font-extrabold text-[#F7F3EA]">
                Level {prog.current.level}
                <span className="ml-2 align-middle font-display text-[15px] font-bold text-[#F7F3EA]/70">
                  {prog.current.name}
                </span>
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
          <p className="mt-2 font-mono text-[12px] text-[#F7F3EA]/60">
            {prog.next
              ? `${prog.toNext.toLocaleString()} XP to Level ${prog.next.level} · ${prog.next.name}`
              : "Top of the ladder — every level earned"}
          </p>
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
            { label: "Tickers rated", value: dash(state.tickersRated) },
            {
              label: "Conviction",
              value: state.conviction == null ? "—" : `${state.conviction}%`,
              tone: "sentiment",
            },
            { label: "Research", value: dash(state.research) },
          ]}
        />
        <p className="text-[13px] leading-relaxed text-soft">
          Conviction is the share of your rated tickers you called bullish — the
          Club&apos;s own sentiment measure, not a market number. A measure reads
          &ldquo;—&rdquo; until you&apos;ve given it something real.
        </p>
      </section>

      {/* ── BADGES ───────────────────────────────────────────────────────── */}
      <section className="space-y-5">
        <SectionRule action={<TextAction href="/leaderboard">Leaderboard</TextAction>}>
          Credentials
        </SectionRule>
        {badges == null ? (
          <div className="flex gap-2">
            {Array.from({ length: 6 }).map((_, i) => (
              <span key={i} className="h-8 w-24 animate-pulse rounded-full bg-sand/60" />
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
                className={`inline-flex items-center gap-2 rounded-full px-3.5 py-1.5 font-display text-[13px] font-bold ${
                  b.awarded
                    ? "bg-ink text-paper"
                    : "border border-dashed border-sand text-soft"
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
                  className="f0-ledger-row group block"
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
            meta={dash(state.posts)}
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

function ProfileSkeleton() {
  return (
    <div className="mx-auto max-w-2xl animate-pulse space-y-10 pb-16">
      <div className="space-y-3">
        <div className="h-3 w-32 rounded bg-sand/60" />
        <div className="h-11 w-40 rounded bg-sand/60" />
      </div>
      <div className="h-64 rounded-[1.5rem] bg-sand/40" />
      <div className="h-20 rounded bg-sand/30" />
      <div className="h-32 rounded bg-sand/30" />
    </div>
  );
}
