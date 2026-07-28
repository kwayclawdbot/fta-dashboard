"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight, ChevronRight, RotateCcw, Settings as SettingsIcon } from "lucide-react";

import { createClient } from "@/lib/supabase/client";
import { getUserXp, levelProgress, type XpKind } from "@/lib/xp";
import { beltForXp, beltProgress } from "@/lib/belts";
import { getBadgeState, evaluateBadges, type BadgeRow } from "@/lib/badges";
import {
  BoardMast,
  Card,
  WarmCard,
  Eyebrow,
  ListHead,
  Dial,
  RingAvatar,
  StatTile,
  StatTileRow,
  BarRow,
  StreakPips,
  RowCard,
  EmptyCard,
  TextAction,
  MiniMeter,
  dash,
} from "./parts";

/* ══════════════════════════════════════════════════════════════════════════
   YOU — the member's own profile. Route: /progress.
   Built to App Light board 07 "You · Profile", object for object.

   THE BOARD, TOP → BOTTOM, AND WHAT EACH OBJECT ACTUALLY SHOWS
   ────────────────────────────────────────────────────────────────────────
   drawn                              ships
   ─────────────────────────────────  ──────────────────────────────────────
   "you" wordmark + ⚙                 same; ⚙ links to /settings
   92px conic-ring avatar             same, real avatar/initials
   name (script, orange)              real display name
   "■ Black Belt ★"                   real belt from lifetime XP (beltForXp)
   "Top 2% of 25,842 members"         "Level N · <name> · @handle" — the app
                                      computes no member percentile, and a
                                      percentile of members is a ranking claim
   87 OPINION SCORE dial              XP PROGRESS TO THE NEXT BELT. Numeral =
                                      percent into the current band, label =
                                      the belt it is progress toward. At the
                                      top of the ladder: 100 / BLACK BELT.
   "INFLUENCE 1.8x / your opinions    CONVICTION — the share of the member's
    carry 1.8x more weight"           own positions called bullish. A sentiment
                                      measure (lime by law), not a weighting of
                                      whose opinion counts more.
   "STRONGEST AREAS / Top 4%" bars    WHERE YOUR REPS COME FROM — the member's
                                      top XP sources as a share of their own
                                      XP. Percentiles against other members are
                                      not computed anywhere in this app.
   142 Opinions                       Positions taken
   71% Accuracy (green)               Research notes. Neither the accuracy nor
                                      the green ships — green is price.
   382 People Influenced              Respect received
   47 Changed Minds                   Changed minds (unchanged — a behaviour)
   6 Circles Hosted                   Club posts
   🔥 "16 days in a row" + 7 pips     REAL daily participation streak from
                                      xp_events; each pip is one of the last
                                      seven days, filled only where that day
                                      carries an award.
   RECENT CALLS · ✓ +6.4% / ✗ −2.1%   RECENT POSITIONS — the dated positions
                                      ledger: company, which way, when. No
                                      outcome, no ✓/✗, no percentage.

   Below the board the app needs three things a phone mock does not: the
   credential shelf (Club Screens board 09's BADGES object), learning progress,
   and the rows into posts / saved / settings. They are composed from the same
   card vocabulary so the surface stays one system.

   REAL DATA ONLY. profiles · xp_events (XP, streak, per-source split) ·
   member_participation + member_flips (migration 196) · ticker_stances ·
   family_watchlist · lesson_progress + courses · badges. Any measure the feed
   cannot supply renders "—". Nothing is fabricated.

   NO CLOCK IN RENDER. The streak window and every date label are resolved
   inside the load, not read from `Date.now()` during a render pass.
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
  /** Pre-formatted in the load — never derived from a clock during render. */
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
  /** Share of the member's own counted XP, 0–100. */
  pct: number;
}

interface ProfileState {
  name: string;
  username: string | null;
  avatarUrl: string | null;
  since: string | null;
  xp: number;
  /** Trailing run of days carrying an xp_event, ending today or yesterday. */
  streakDays: number;
  /** Oldest → newest, one entry per day for the last seven days. */
  streakWindow: boolean[];
  /** Top XP sources for the "strongest areas" object. Empty until read. */
  sources: SourceLine[];
  /** null until the participation RPC answers — "—" until then, never 0. */
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

/** Board labels for the XP sources. Keyed off the shipped XpKind union so a new
    award kind cannot appear here as an unlabelled bar. */
const SOURCE_LABEL: Record<XpKind, string> = {
  lesson: "Lessons",
  quiz: "Quizzes",
  flashcards: "Flashcards",
  game: "Games",
  community: "Club posts",
  rsvp: "Live sessions",
  bonus: "Bonuses",
};

/** Local-calendar day key. Local, not UTC: a streak is a human-day streak, and
    a member in UTC-8 posting at 6pm must not have it counted as tomorrow. */
function dayKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate()
  ).padStart(2, "0")}`;
}

function shiftDays(d: Date, n: number): Date {
  const t = new Date(d);
  t.setDate(t.getDate() + n);
  return t;
}

function monthDay(iso: string): string {
  return new Date(iso).toLocaleString("en-US", { month: "short", day: "numeric" });
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

      // ── streak — trailing run of DAYS carrying an award, plus the seven-day
      //    window the board's pips render. Today with nothing yet does not
      //    break a streak, so the run may end today or yesterday.
      const days = new Set(events.map((e) => dayKey(new Date(e.created_at))));
      const today = new Date();
      const streakWindow: boolean[] = [];
      for (let i = 6; i >= 0; i -= 1) streakWindow.push(days.has(dayKey(shiftDays(today, -i))));
      let streakDays = 0;
      let cursor = days.has(dayKey(today)) ? today : shiftDays(today, -1);
      while (days.has(dayKey(cursor))) {
        streakDays += 1;
        cursor = shiftDays(cursor, -1);
      }

      // ── where the reps come from — the member's own XP split by source.
      //    A share of their own record, never a percentile against anyone.
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

      // ── learning ledger from the single nested course query ───────────────
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

      // Core content is in — paint. Everything below fills in behind it.
      settled = true;
      clearTimeout(timeout);
      setLoading(false);

      // ── participation, positions, saved ───────────────────────────────────
      // member_participation is the authority on the counts: feed_posts SELECT
      // is family-scoped, so counting posts from the client undercounts and
      // then prints the undercount as a total. Each read is guarded on its own,
      // so one missing table never blanks the others — a failed read leaves the
      // measure null and the tile renders "—".
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
        <EmptyCard
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
              <RotateCcw className="h-3.5 w-3.5" /> Try again
            </TextAction>
          }
        />
      </div>
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

  // THE DIAL. Never an opinion score: the sweep and the numeral are XP progress
  // into the current belt band, and the label names the belt it is progress
  // toward. At the top of the ladder there is nothing to be progress toward, so
  // it reads the earned belt at a full sweep rather than an invented target.
  const dialLabel: [string, string] = bp.next
    ? ["TO", bp.next.belt.name.toUpperCase()]
    : [belt.belt.name.toUpperCase(), "BELT"];

  return (
    <div className="mx-auto max-w-2xl space-y-4 pb-16">
      <BoardMast
        word="you"
        action={
          <Link
            href="/settings"
            aria-label="Settings"
            className="f0-focus f0-press inline-grid h-9 w-9 place-items-center rounded-full text-soft transition-colors hover:text-ink"
          >
            <SettingsIcon className="h-[18px] w-[18px]" />
          </Link>
        }
      />

      {/* ── IDENTITY ────────────────────────────────────────────────────────
          Avatar · name · belt · dial, laid out as drawn. */}
      <section className="flex items-center gap-4 pt-2 sm:gap-5">
        <RingAvatar name={state.name} avatarUrl={state.avatarUrl} />

        <div className="min-w-0 flex-1">
          <h2 className="truncate font-display text-[24px] font-extrabold leading-tight tracking-[-0.02em] text-gold-700">
            {state.name}
          </h2>
          {/* The belt line. Belt colour is intrinsic — a blue belt is blue in
              both themes — so the swatch is an inline style, not a token, and
              purple is legal here and nowhere else in the chrome. */}
          <p className="mt-1.5 flex items-center gap-1.5">
            <span
              aria-hidden
              className="h-3.5 w-3.5 shrink-0 rounded-[3px]"
              style={{
                backgroundColor: belt.belt.hex,
                boxShadow: `inset 0 0 0 1px ${belt.belt.borderHex}`,
              }}
            />
            <span className="font-display text-[12.5px] font-bold text-ink">{belt.label}</span>
            <span className="text-[12px] text-gold-700" aria-hidden>
              ★
            </span>
          </p>
          <p className="mt-1 truncate text-[11px] text-soft">
            Level {lvl.current.level} · {lvl.current.name}
            {state.username ? ` · @${state.username}` : ""}
          </p>
        </div>

        <Dial pct={bp.pct} value={String(bp.pct)} label={dialLabel} />
      </section>

      {/* ── CONVICTION + WHERE YOUR REPS COME FROM ──────────────────────────
          The board's two-card row: a single big measure on the left, a stack of
          labelled bars on the right. */}
      <section className="flex flex-col gap-3 sm:flex-row">
        <Card className="rounded-[16px] p-3.5 sm:flex-1">
          <Eyebrow>Conviction</Eyebrow>
          {/* Lime is the community-sentiment colour by law, and conviction is
              the Club's own sentiment measure — the share of this member's
              positions they called bullish. It is not a market number and not a
              score of whether they were right. */}
          <p className="mt-2 font-display text-[26px] font-extrabold leading-none tracking-[-0.02em] text-sentiment">
            {conviction == null ? "—" : `${conviction}%`}
          </p>
          <p className="mt-1.5 text-[10px] leading-[1.45] text-soft">
            The share of your positions you&apos;ve called bullish
          </p>
        </Card>

        <Card className="rounded-[16px] p-3.5 sm:flex-[1.5]">
          <Eyebrow>Where your reps come from</Eyebrow>
          {state.sources.length === 0 ? (
            <p className="mt-2.5 text-[10.5px] leading-relaxed text-soft">
              Nothing has earned XP yet. Finish a lesson or post in the Club and this
              fills in with your own split.
            </p>
          ) : (
            <div className="mt-2.5 space-y-2.5">
              {state.sources.map((s) => (
                <BarRow
                  key={s.label}
                  label={s.label}
                  meta={`${s.pct}%`}
                  pct={s.pct}
                />
              ))}
            </div>
          )}
        </Card>
      </section>

      {/* ── THE FIVE MEASURES ───────────────────────────────────────────────
          Board tiles, board order. Accuracy is gone; the rest are counts of
          things the member did. */}
      <section>
        <StatTileRow>
          <StatTile value={dash(part?.stances)} label="Positions" loading={part == null} />
          <StatTile value={dash(part?.research)} label="Research notes" loading={part == null} />
          <StatTile value={dash(part?.respect)} label="Respect" loading={part == null} />
          <StatTile value={dash(part?.flips)} label="Changed Minds" loading={part == null} />
          <StatTile value={dash(part?.posts)} label="Club posts" loading={part == null} />
        </StatTileRow>
      </section>

      {/* ── STREAK ──────────────────────────────────────────────────────────
          The board's warm card. The pips are the last seven days and are filled
          only where that day carries a real award, so a quiet week looks quiet. */}
      <WarmCard className="flex items-center gap-3.5 px-4 py-3.5">
        <span className="text-[26px] leading-none" aria-hidden>
          🔥
        </span>
        <div className="min-w-0 flex-1">
          <Eyebrow charged>Your streak</Eyebrow>
          <p className="mt-1 font-display text-[19px] font-extrabold leading-none text-ink">
            {state.streakDays}{" "}
            <span className="font-display text-[12px] font-semibold text-soft">
              {state.streakDays === 1 ? "day in a row" : "days in a row"}
            </span>
          </p>
        </div>
        <StreakPips days={state.streakWindow} />
      </WarmCard>

      {/* ── RECENT POSITIONS ────────────────────────────────────────────────
          The board's "Recent calls" object, minus the verdict. Direction is
          carried by the WORD, never by hue: bull/bear in green/red would put
          the price ramp on a community object, and there is no price on this
          row to justify it. The right-hand column is the DATE the position was
          last set — not a return, not a ✓, not an ✗. */}
      <section className="space-y-2.5 pt-2">
        <ListHead action={<TextAction href="/discover">See all</TextAction>}>
          Recent positions
        </ListHead>
        {state.part == null ? (
          <div className="space-y-2" aria-busy="true">
            {[0, 1].map((i) => (
              <div
                key={i}
                className="club-b-card h-[46px] rounded-[12px] motion-safe:animate-pulse"
              />
            ))}
          </div>
        ) : state.positions.length === 0 ? (
          <EmptyCard
            title="No positions yet"
            body="Take a position on a company you've actually looked at — bullish, bearish or neutral. It lands here, and you can change it any time."
            action={
              <TextAction href="/discover">
                Browse companies <ArrowRight className="h-3 w-3" />
              </TextAction>
            }
          />
        ) : (
          <div className="space-y-2">
            {state.positions.map((p) => (
              <RowCard
                key={p.ticker}
                href={`/research/${encodeURIComponent(p.ticker)}`}
                lead={
                  <span className="font-mono text-[11px] font-semibold text-ink">
                    {p.ticker}
                  </span>
                }
                title={<span className="text-[11.5px] font-normal text-soft">{p.stance}</span>}
                value={
                  <span className="font-mono text-[11px] tabular-nums text-soft">{p.when}</span>
                }
              />
            ))}
          </div>
        )}
      </section>

      {/* ── CREDENTIALS — Club Screens board 09's BADGES shelf ─────────────── */}
      <section className="space-y-2.5 pt-2">
        <ListHead action={<TextAction href="/leaderboard">Leaderboard</TextAction>}>
          Badges
        </ListHead>
        {badges == null ? (
          <div className="flex gap-2" aria-busy="true">
            {[0, 1, 2, 3].map((i) => (
              <div
                key={i}
                className="club-b-card h-[86px] w-[92px] shrink-0 rounded-[14px] motion-safe:animate-pulse"
              />
            ))}
          </div>
        ) : awarded.length === 0 ? (
          <EmptyCard
            title="No badges yet"
            body="Badges are earned, not granted — research a company, show up to a class, finish a lesson. The first one you earn appears here."
            action={
              <TextAction href="/discover">
                Find something to research <ArrowRight className="h-3 w-3" />
              </TextAction>
            }
          />
        ) : (
          <div className="club2-track flex gap-2 overflow-x-auto pb-1">
            {(badges ?? []).map((b) => (
              <div
                key={b.slug}
                title={b.subtitle ?? undefined}
                className={`club-b-card flex w-[92px] shrink-0 flex-col items-center gap-2 rounded-[14px] px-2 py-3 text-center ${
                  b.awarded ? "" : "opacity-45"
                }`}
              >
                <span
                  className="grid h-8 w-8 place-items-center rounded-full font-display text-[13px] font-extrabold"
                  style={
                    b.awarded
                      ? { background: "var(--accent-solid)", color: "var(--accent-on)" }
                      : { background: "var(--sand)", color: "var(--soft)" }
                  }
                  aria-hidden
                >
                  {b.title.slice(0, 1).toUpperCase()}
                </span>
                <span className="font-display text-[10px] font-bold leading-tight text-ink">
                  {b.title}
                </span>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* ── LEARNING ────────────────────────────────────────────────────────
          The board's card row with the mini meter on the right (board 22's
          footer object at list scale). */}
      <section className="space-y-2.5 pt-2">
        <ListHead action={<TextAction href="/courses">Learn</TextAction>}>Learning</ListHead>
        {state.courses.length === 0 ? (
          <EmptyCard
            title="No path started"
            body="Your course progress shows up here the moment you open a lesson."
            action={
              <TextAction href="/courses">
                Browse the library <ArrowRight className="h-3 w-3" />
              </TextAction>
            }
          />
        ) : (
          <div className="space-y-2">
            {state.courses.map((c) => {
              const pct = c.total > 0 ? Math.round((c.done / c.total) * 100) : 0;
              return (
                <RowCard
                  key={c.slug}
                  href={`/courses/${c.slug}`}
                  title={c.title}
                  sub={`${c.done} of ${c.total} lessons`}
                  value={
                    <span className="flex items-center gap-2.5">
                      <span className="font-mono text-[11px] tabular-nums text-soft">
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

      {/* ── YOURS ───────────────────────────────────────────────────────── */}
      <section className="space-y-2.5 pt-2">
        <ListHead charged={false}>Yours</ListHead>
        <div className="space-y-2">
          <RowCard
            href={postsHref}
            title="My posts"
            sub={
              state.username
                ? "Your public profile and everything you've said in the Club"
                : "Pick a handle in Settings to get a public profile"
            }
            value={
              <span className="flex items-center gap-2">
                <span className="font-mono text-[11px] tabular-nums text-soft">
                  {dash(part?.posts)}
                </span>
                <ChevronRight className="h-3.5 w-3.5 text-soft" />
              </span>
            }
          />
          <RowCard
            href="/watchlist"
            title="Saved"
            sub="Companies you champion on the watchlist"
            value={
              <span className="flex items-center gap-2">
                <span className="font-mono text-[11px] tabular-nums text-soft">
                  {dash(state.saved)}
                </span>
                <ChevronRight className="h-3.5 w-3.5 text-soft" />
              </span>
            }
          />
          <RowCard
            href="/belts"
            title="The belt ladder"
            sub={
              bp.next
                ? `${bp.toNext.toLocaleString()} XP to ${bp.next.label}`
                : "Top of the ladder — every belt earned"
            }
            value={<ChevronRight className="h-3.5 w-3.5 text-soft" />}
          />
          <RowCard
            href="/settings"
            title="Settings"
            sub="Profile, theme, notifications, membership"
            value={<ChevronRight className="h-3.5 w-3.5 text-soft" />}
          />
        </div>
      </section>

      <p className="pt-1 text-[11px] leading-relaxed text-soft">
        {state.since ? `Member since ${state.since}. ` : ""}
        Every number here is a count of something you did. We don&apos;t publish member
        accuracy or win rates, so nothing on this page is a claim about returns — a measure
        reads &ldquo;—&rdquo; until you&apos;ve given it something real.
      </p>
    </div>
  );
}

/* LOADING ≠ EMPTY: this is the shape of the surface arriving, not the surface's
   founding state. The founding states are the designed EmptyCard copy in each
   section above, which only renders once a read has actually answered. */
function ProfileSkeleton() {
  return (
    <div className="mx-auto max-w-2xl space-y-4 pb-16" aria-busy="true">
      <div className="h-9 w-24 rounded bg-sand/60 motion-safe:animate-pulse" />
      <div className="flex items-center gap-4 pt-2">
        <div className="h-[92px] w-[92px] shrink-0 rounded-full bg-sand/60 motion-safe:animate-pulse" />
        <div className="min-w-0 flex-1 space-y-2.5">
          <div className="h-6 w-40 rounded bg-sand/60 motion-safe:animate-pulse" />
          <div className="h-3.5 w-28 rounded bg-sand/50 motion-safe:animate-pulse" />
          <div className="h-3 w-36 rounded bg-sand/40 motion-safe:animate-pulse" />
        </div>
        <div className="h-16 w-16 shrink-0 rounded-full bg-sand/60 motion-safe:animate-pulse" />
      </div>
      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="club-b-card h-[104px] rounded-[16px] motion-safe:animate-pulse sm:flex-1" />
        <div className="club-b-card h-[104px] rounded-[16px] motion-safe:animate-pulse sm:flex-[1.5]" />
      </div>
      <div className="flex flex-wrap gap-2">
        {[0, 1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className="club-b-card h-[52px] min-w-[64px] flex-1 rounded-[13px] motion-safe:animate-pulse"
          />
        ))}
      </div>
      <div className="club-b-card h-[68px] rounded-[16px] motion-safe:animate-pulse" />
      <span className="sr-only">Loading your profile</span>
    </div>
  );
}
