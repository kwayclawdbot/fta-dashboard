"use client";

import { useCallback, useEffect, useState } from "react";
import {
  BookOpen,
  Target,
  Zap,
  Award,
  AlertTriangle,
  RefreshCw,
  Check,
  Sparkles,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { levelForXp } from "@/lib/xp";
import { BoardSection } from "@/components/clubhome/board";
import { Meter, dash } from "@/components/f0/parts";
import { buildNeedsWork, type NeedsWorkFlag } from "@/lib/family/report-card-flags";

/**
 * REPORT CARD — a child's week, as a board object.
 *
 * WHAT DIED: the hairline-ledger treatment (a bare ruled entry with a nested
 * MeasureStrip-style stat row), the raw `midnight-*` body text, the `chip-green`
 * completed-week tile and the `text-red-600` warning numeral. WHAT REPLACED
 * THEM: one white `club-b-card` per child, `BoardSection` marks inside it, the
 * shared `Meter` for lesson progress, and mono tabular numerals for every stat.
 *
 * FAMILY REGISTER: warm and premium, never childish, and NO PURPLE — the family
 * accent is the mode's own gold, which arrives through `bg-accent` / `text-gold-*`
 * so the object re-skins by mode with no branch here.
 *
 * COLOUR LAW: green/red are PRICE colours and a quiz score is not a price, so a
 * flagged stat reads in the action ramp and by its sub-line, never in red. A
 * completed week reads as the accent fill plus a tick.
 *
 * HONEST ABSENCE: every stat routes through `dash()` or an explicit "—" so a
 * missing figure is stated, never invented. Loading keeps the card's shape.
 *
 * NO CLOCK IN RENDER: `buildNeedsWork` calls `Date.now()` (it asks "has this
 * child practised in the last 7 days"). It used to be called straight from the
 * render body, which is an impure read React may repeat. It now runs once, in
 * the load effect, and its result lives in state.
 */

interface WeekTick {
  week: number;
  total: number;
  done: number;
  unlocked: boolean;
}

interface Stats {
  track: string;
  cohort_week: number | null;
  foundations_total: number;
  foundations_done: number;
  weeks: WeekTick[];
  behind_count: number;
  quiz_count: number;
  quiz_avg: number | null;
  quiz_low: number;
  practice_count: number;
  practice_best: number;
  practice_avg: number;
  game_count: number;
  game_best: number;
  game_avg: number;
  last_practice_at: string | null;
  last_flashcard_at: string | null;
  xp: number;
  badges_count: number;
  error?: string;
}

/* `buildNeedsWork` moved to lib/family/report-card-flags.ts, where each flag
   now carries BOTH the bullet a parent reads and the imperative the coach's
   note needs — see that file for why the note used to say "the best next step
   is to No pattern or game practice in the last 7 days." */

export default function ReportCard({
  childId,
  childName,
}: {
  childId: string;
  childName: string;
}) {
  const supabase = createClient();
  const [stats, setStats] = useState<Stats | null>(null);
  const [needsWork, setNeedsWork] = useState<NeedsWorkFlag[]>([]);
  const [loading, setLoading] = useState(true);
  const [note, setNote] = useState("");
  const [noteLoading, setNoteLoading] = useState(false);

  const fetchNote = useCallback(
    async (s: Stats, refresh: boolean) => {
      setNoteLoading(true);
      const work = buildNeedsWork(s);
      try {
        const res = await fetch("/api/report-card", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            child_id: childId,
            week: s.cohort_week ?? 0,
            refresh,
            stats: {
              name: childName,
              track: s.track,
              week: s.cohort_week ?? 0,
              lessonsDone: s.foundations_done,
              lessonsTotal: s.foundations_total,
              quizAvg: s.quiz_avg,
              quizCount: s.quiz_count,
              lowQuizzes: s.quiz_low,
              practiceCount: s.practice_count + s.game_count,
              gamesBest: s.game_count > 0 ? s.game_best : null,
              xp: s.xp,
              level: levelForXp(s.xp).name,
              // Both halves travel: the diagnoses the model may cite, and the
              // imperatives the deterministic fallback sentence needs.
              needsWork: work.map((f) => f.label),
              nextSteps: work.map((f) => f.nextStep),
            },
          }),
        });
        if (res.ok) {
          const data = await res.json();
          setNote(data.note || "");
        }
      } catch {
        /* leave note empty */
      }
      setNoteLoading(false);
    },
    [childId, childName]
  );

  useEffect(() => {
    async function load() {
      const { data } = await supabase.rpc("child_report_stats", {
        p_child: childId,
      });
      const s = data as Stats;
      setStats(s);
      // The clock read lives HERE, not in render (see the header).
      if (s && !s.error) setNeedsWork(buildNeedsWork(s));
      setLoading(false);
      if (s && !s.error) fetchNote(s, false);
    }
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [childId]);

  /* LOADING ≠ EMPTY — the card keeps its footprint and shimmers its contents,
     so the fill is a swap rather than a reflow. */
  if (loading) {
    return (
      <Shell>
        <div className="motion-safe:animate-pulse" aria-busy="true">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 shrink-0 rounded-full bg-sand/70" />
            <div className="min-w-0 flex-1 space-y-2">
              <div className="h-4 w-40 max-w-full rounded bg-sand/70" />
              <div className="h-3 w-24 rounded bg-sand/50" />
            </div>
          </div>
          <div className="mt-5 h-1.5 w-full rounded-full bg-sand/60" />
          <div className="mt-5 h-3 w-2/3 rounded bg-sand/50" />
          <span className="sr-only">Loading this report card</span>
        </div>
      </Shell>
    );
  }

  if (!stats || stats.error) return null;

  const level = levelForXp(stats.xp);
  const foundPct =
    stats.foundations_total > 0
      ? Math.round((stats.foundations_done / stats.foundations_total) * 100)
      : 0;
  const practiceSessions = stats.practice_count + stats.game_count;
  const practiceBest =
    practiceSessions > 0
      ? String(stats.game_count > 0 ? stats.game_best : stats.practice_best)
      : "—";

  return (
    <Shell>
      {/* ── Who ──────────────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-3">
        <span
          className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-gold-400/20 font-display font-bold text-gold-700"
          aria-hidden
        >
          {(childName || "?")[0]?.toUpperCase()}
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate font-display text-[19px] font-extrabold text-ink">
            {childName}
          </p>
          <p className="mt-0.5 font-mono text-[10px] uppercase tracking-[0.14em] text-soft tabular-nums">
            {stats.track} track
            {stats.cohort_week ? ` · Week ${stats.cohort_week}` : ""}
          </p>
        </div>
        <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-chip-amber px-3 py-1.5 font-mono text-[11px] font-semibold text-gold-800 tabular-nums">
          <Zap className="h-3.5 w-3.5" aria-hidden />
          {level.name} · {dash(stats.xp)} XP
        </span>
      </div>

      {/* ── Foundations ──────────────────────────────────────────────────── */}
      <div className="mt-6">
        <div className="flex items-baseline justify-between gap-3">
          <p className="flex items-center gap-1.5 font-mono text-[9.5px] font-semibold uppercase tracking-[0.16em] text-ink">
            <BookOpen className="h-3.5 w-3.5 text-soft" aria-hidden />
            Foundations
          </p>
          <span className="shrink-0 font-mono text-[12px] font-semibold text-soft tabular-nums">
            {stats.foundations_total > 0
              ? `${stats.foundations_done}/${stats.foundations_total}`
              : "—"}{" "}
            lessons
          </span>
        </div>
        <Meter pct={foundPct} className="mt-2.5" />

        {stats.weeks.length > 0 && (
          <div className="mt-2.5 flex items-center gap-1.5">
            {stats.weeks.map((w) => {
              const complete = w.total > 0 && w.done >= w.total;
              return (
                <div
                  key={w.week}
                  title={`Week ${w.week}: ${w.done}/${w.total}${
                    w.unlocked ? "" : " (locked)"
                  }`}
                  className={`grid h-6 flex-1 place-items-center rounded-[6px] font-mono text-[10px] font-bold tabular-nums ${
                    !w.unlocked
                      ? "border border-sand bg-paper text-soft/60"
                      : complete
                        ? "bg-accent text-[color:var(--accent-on)]"
                        : w.done > 0
                          ? "bg-chip-amber text-gold-800"
                          : "border border-sand bg-card text-soft"
                  }`}
                >
                  {complete ? (
                    <Check className="h-3 w-3" aria-hidden />
                  ) : (
                    `W${w.week}`
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── The three measures — mono numerals on hairlines, no nested box ── */}
      <div className="mt-6 flex items-stretch border-y border-sand py-4">
        <Stat
          label="Quiz avg"
          value={stats.quiz_avg == null ? "—" : `${stats.quiz_avg}%`}
          sub={
            stats.quiz_low > 0
              ? `${stats.quiz_low} to retake`
              : `${stats.quiz_count} taken`
          }
          flag={stats.quiz_low > 0}
        />
        <Stat
          label="Practice"
          value={practiceBest}
          sub={`${practiceSessions} sessions`}
        />
        <Stat label="Badges" value={dash(stats.badges_count)} sub={level.name} />
      </div>

      {/* ── Needs work ───────────────────────────────────────────────────── */}
      {needsWork.length > 0 && (
        <div className="mt-6">
          <BoardSection id={`rc-work-${childId}`} label="Needs" mark="work">
            <ul className="mt-2.5 space-y-1.5">
              {needsWork.map((n) => (
                <li key={n.label} className="flex gap-2 text-[13.5px] leading-snug text-ink">
                  <AlertTriangle
                    className="mt-0.5 h-3.5 w-3.5 shrink-0 text-gold-600"
                    aria-hidden
                  />
                  {n.label}
                </li>
              ))}
            </ul>
          </BoardSection>
        </div>
      )}

      {/* ── Coach's note ─────────────────────────────────────────────────── */}
      <div className="mt-6">
        <BoardSection
          id={`rc-note-${childId}`}
          label="Coach's"
          mark="note"
          action={
            <button
              type="button"
              onClick={() => stats && fetchNote(stats, true)}
              disabled={noteLoading}
              className="f0-focus f0-press inline-flex items-center gap-1 font-display text-[12px] font-bold text-gold-700 transition-colors hover:text-gold-600 disabled:opacity-50"
            >
              <RefreshCw
                className={`h-3.5 w-3.5 ${noteLoading ? "animate-spin" : ""}`}
                aria-hidden
              />
              Refresh
            </button>
          }
        >
          {noteLoading && !note ? (
            <p className="mt-2.5 flex items-center gap-1.5 text-[13.5px] text-soft">
              <Sparkles className="h-3.5 w-3.5 text-gold-600" aria-hidden />
              Writing a note…
            </p>
          ) : (
            <p className="mt-2.5 max-w-[62ch] text-[14px] leading-relaxed text-ink">
              {note || "No note yet."}
            </p>
          )}
        </BoardSection>
      </div>
    </Shell>
  );
}

/* The card itself. The host (family/overview) still stacks report cards inside
   an `.f0-ledger`, whose `> * + *` rule would draw a hairline directly above
   each card's own border. The inline `borderTop: none` cancels exactly that one
   declaration without touching the host, and is inert once the host drops the
   ledger. */
function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="py-3 first:pt-0" style={{ borderTop: "none" }}>
      <article className="club-b-card px-5 py-5">{children}</article>
    </div>
  );
}

function Stat({
  label,
  value,
  sub,
  flag,
}: {
  label: string;
  /** Pre-formatted; "—" for an honest absence. */
  value: string;
  sub: string;
  /** Wants attention. Reads in the ACTION ramp — never red (colour law). */
  flag?: boolean;
}) {
  return (
    <div className="min-w-0 flex-1 border-l border-sand px-4 first:border-l-0 first:pl-0 last:pr-0">
      <p className="flex items-center gap-1 font-mono text-[9px] font-semibold uppercase tracking-[0.14em] text-soft">
        {label === "Practice" && <Target className="h-3 w-3 shrink-0" aria-hidden />}
        {label === "Badges" && <Award className="h-3 w-3 shrink-0" aria-hidden />}
        <span className="truncate">{label}</span>
      </p>
      <p
        className={`mt-1.5 font-mono text-[22px] font-semibold leading-none tabular-nums ${
          flag ? "text-gold-700" : "text-ink"
        }`}
      >
        {value}
      </p>
      <p className="mt-1.5 truncate text-[11px] text-soft">{sub}</p>
    </div>
  );
}
