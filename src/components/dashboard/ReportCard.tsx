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

function olderThanDays(iso: string | null, days: number): boolean {
  if (!iso) return true;
  return Date.now() - new Date(iso).getTime() > days * 86400000;
}

function buildNeedsWork(s: Stats): string[] {
  const out: string[] = [];
  if (s.behind_count > 0)
    out.push(
      `Behind pace — ${s.behind_count} unlocked lesson${
        s.behind_count === 1 ? "" : "s"
      } still open`
    );
  if (s.quiz_low > 0)
    out.push(
      `${s.quiz_low} quiz${s.quiz_low === 1 ? "" : "zes"} below 70% — retake suggested`
    );
  if (olderThanDays(s.last_practice_at, 7))
    out.push("No pattern or game practice in the last 7 days");
  if (olderThanDays(s.last_flashcard_at, 7))
    out.push("No flashcard reviews in the last 7 days");
  return out;
}

export default function ReportCard({
  childId,
  childName,
}: {
  childId: string;
  childName: string;
}) {
  const supabase = createClient();
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [note, setNote] = useState("");
  const [noteLoading, setNoteLoading] = useState(false);

  const fetchNote = useCallback(
    async (s: Stats, refresh: boolean) => {
      setNoteLoading(true);
      const needsWork = buildNeedsWork(s);
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
              needsWork,
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
      setLoading(false);
      if (s && !s.error) fetchNote(s, false);
    }
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [childId]);

  if (loading) {
    return (
      <div className="py-6 animate-pulse">
        <div className="h-5 w-40 bg-sand/70 rounded mb-4" />
        <div className="h-3 w-full bg-sand/50 rounded mb-2" />
        <div className="h-3 w-2/3 bg-sand/50 rounded" />
      </div>
    );
  }

  if (!stats || stats.error) return null;

  const level = levelForXp(stats.xp);
  const needsWork = buildNeedsWork(stats);
  const foundPct =
    stats.foundations_total > 0
      ? Math.round((stats.foundations_done / stats.foundations_total) * 100)
      : 0;

  return (
    /* A LEDGER ENTRY, not a card. The old treatment was a paper-card wrapping
       three more boxed panels (stat tiles / needs-work / coach note) — cards
       inside cards, the pattern the brand register bans. Hierarchy now comes
       from the display scale and hairline rules; every colour is unchanged
       family gold. */
    <div className="py-7 first:pt-5">
      {/* Header */}
      <div className="flex items-center gap-3 mb-5 flex-wrap">
        <div className="w-10 h-10 rounded-full bg-gold-400/20 flex items-center justify-center text-gold-700 font-display font-bold shrink-0">
          {(childName || "?")[0]?.toUpperCase()}
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-display text-display-3 font-bold text-ink truncate">{childName}</p>
          <p className="text-xs text-soft capitalize">
            {stats.track} track
            {stats.cohort_week ? ` · Week ${stats.cohort_week}` : ""}
          </p>
        </div>
        <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-chip-amber text-gold-800 text-xs font-semibold shrink-0">
          <Zap className="w-3.5 h-3.5" />
          {level.name} · {stats.xp} XP
        </span>
      </div>

      {/* Foundations */}
      <div className="mb-5">
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-sm font-medium text-ink flex items-center gap-1.5">
            <BookOpen className="w-4 h-4 text-gold-600" />
            Foundations
          </span>
          <span className="text-xs text-soft">
            {stats.foundations_done}/{stats.foundations_total} lessons
          </span>
        </div>
        <div className="w-full h-2 rounded-full bg-sand overflow-hidden mb-2">
          <div
            className="h-full rounded-full bg-gold-500"
            style={{ width: `${foundPct}%` }}
          />
        </div>
        {stats.weeks.length > 0 && (
          <div className="flex items-center gap-1.5">
            {stats.weeks.map((w) => {
              const complete = w.total > 0 && w.done >= w.total;
              return (
                <div
                  key={w.week}
                  title={`Week ${w.week}: ${w.done}/${w.total}${
                    w.unlocked ? "" : " (locked)"
                  }`}
                  className={`flex-1 h-6 rounded flex items-center justify-center text-[10px] font-bold ${
                    !w.unlocked
                      ? "bg-sand/50 text-soft"
                      : complete
                        ? "bg-chip-green text-green-700"
                        : w.done > 0
                          ? "bg-chip-amber text-gold-800"
                          : "bg-midnight-900 border border-sand text-soft"
                  }`}
                >
                  {complete ? <Check className="w-3 h-3" /> : `W${w.week}`}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Quiz + Practice + Badges — a ruled stat row (hairline dividers), not
          three boxed tiles. */}
      <div className="flex items-stretch py-4 mb-5 border-y border-sand">
        <Stat
          label="Quiz avg"
          value={stats.quiz_avg == null ? "—" : `${stats.quiz_avg}%`}
          sub={
            stats.quiz_low > 0
              ? `${stats.quiz_low} to retake`
              : `${stats.quiz_count} taken`
          }
          warn={stats.quiz_low > 0}
        />
        <Stat
          label="Practice"
          value={
            stats.practice_count + stats.game_count > 0
              ? `${stats.game_count > 0 ? stats.game_best : stats.practice_best}`
              : "—"
          }
          sub={`${stats.practice_count + stats.game_count} sessions`}
        />
        <Stat
          label="Badges"
          value={`${stats.badges_count}`}
          sub={`${level.name}`}
        />
      </div>

      {/* Needs work — carried by a gold edge rule instead of a full box. */}
      {needsWork.length > 0 && (
        <div className="mb-5 border-l-2 border-gold-400 pl-4">
          <p className="flex items-center gap-1.5 text-eyebrow font-display font-bold uppercase text-gold-800 mb-2">
            <AlertTriangle className="w-3.5 h-3.5" />
            Needs work
          </p>
          <ul className="space-y-1.5">
            {needsWork.map((n) => (
              <li key={n} className="text-sm text-midnight-200 flex gap-2">
                <span className="text-gold-600">•</span>
                {n}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Coach note — a quoted passage under a hairline, not a nested panel. */}
      <div className="border-t border-sand pt-4">
        <div className="flex items-center justify-between mb-2">
          <p className="flex items-center gap-1.5 text-eyebrow font-display font-bold uppercase text-soft">
            <Sparkles className="w-3.5 h-3.5 text-gold-600" />
            Coach&apos;s note
          </p>
          <button
            onClick={() => stats && fetchNote(stats, true)}
            disabled={noteLoading}
            className="inline-flex items-center gap-1 text-xs text-gold-700 hover:text-gold-800 disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${noteLoading ? "animate-spin" : ""}`} />
            Refresh
          </button>
        </div>
        {noteLoading && !note ? (
          <p className="text-sm text-soft">Writing a note…</p>
        ) : (
          <p className="text-sm text-midnight-200 leading-relaxed">
            {note || "No note yet."}
          </p>
        )}
      </div>
    </div>
  );
}

function Stat({
  label,
  value,
  sub,
  warn,
}: {
  label: string;
  value: string;
  sub: string;
  warn?: boolean;
}) {
  return (
    <div className="flex-1 min-w-0 px-4 first:pl-0 last:pr-0 border-l border-sand first:border-l-0">
      <p className="text-eyebrow text-soft flex items-center gap-1">
        {label === "Practice" && <Target className="w-3 h-3 shrink-0" />}
        {label === "Badges" && <Award className="w-3 h-3 shrink-0" />}
        <span className="truncate uppercase">{label}</span>
      </p>
      <p
        className={`font-display text-display-3 font-bold mt-1.5 ${
          warn ? "text-red-600" : "text-ink"
        }`}
      >
        {value}
      </p>
      <p className="text-[11px] text-soft mt-1 truncate">{sub}</p>
    </div>
  );
}
