"use client";

import { useEffect, useState } from "react";
import { m } from "@/lib/motion";
import { Play, Film, Lock, ExternalLink } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useFtaViewer } from "@/components/fta/useFtaViewer";
import FtaHubHeader from "@/components/fta/FtaHubHeader";
import LockedState from "@/components/dashboard/LockedState";
import RecordingPlayerModal, {
  type RecordingPlayable,
} from "@/components/live/RecordingPlayerModal";
import { resolveRecordingKind, type RecordingKind } from "@/lib/recordings";
import { BoardSection } from "@/components/clubhome/board";

/**
 * /fta/recordings — the FTA shelf, built from the reference board.
 *
 * WHAT CHANGED (board rebuild): the previous pass rendered the shelf as a
 * hairline LEDGER — `f0-ledger` rows under `f0-section-rule` headings, with a
 * mono date column. That was the previous version's structure. The board is
 * card-based, so each recording is now a white `.club-b-card` led by the board's
 * 34px tile (the thumbnail's stand-in — there are no real thumbnails on
 * live_sessions, and inventing one would be decoration pretending to be data),
 * with a chip meta row carrying the date and the runtime, under `BoardSection`
 * marks per class series.
 *
 * FTA IS THE PREMIUM TIER: data-mode="fta" re-points --accent-*, so the watch
 * affordance is metallic here and orange in the Club with no fork.
 *
 * WIRING UNTOUCHED: the same live_sessions query filtered to min_tier='academy',
 * the same resolveRecordingKind, and the same shared RecordingPlayerModal —
 * which owns the signed-URL / youtube-nocookie handling AND the watch-XP write.
 * That XP path is not duplicated here and was not touched.
 */

type ClassType =
  | "weekly_class" | "guest_speaker" | "orientation"
  | "parent_qa" | "kids_money_lab" | "market_recap";

const CLASS_TYPE_LABEL: Record<ClassType, string> = {
  weekly_class: "Weekly Family Stock Class",
  kids_money_lab: "Kids Money Lab",
  parent_qa: "Parent Q&A",
  guest_speaker: "Guest Speaker",
  market_recap: "Market Recap",
  orientation: "Orientation",
};
const CLASS_TYPE_ORDER: ClassType[] = [
  "weekly_class", "kids_money_lab", "parent_qa", "guest_speaker", "market_recap", "orientation",
];

interface Rec extends RecordingPlayable {
  description: string;
  scheduledIso: string | null;
  classType: ClassType | null;
}

function fmt(dateStr: string | null): string {
  if (!dateStr) return "";
  return new Date(dateStr).toLocaleDateString("en-US", {
    weekday: "short", month: "short", day: "numeric", year: "numeric",
  });
}

export default function FtaRecordingsPage() {
  const { loading: viewerLoading, isFta, me } = useFtaViewer();
  const isChild = me?.role === "child";
  const [loading, setLoading] = useState(true);
  const [recordings, setRecordings] = useState<Rec[]>([]);
  const [userId, setUserId] = useState("");
  const [watching, setWatching] = useState<Rec | null>(null);

  useEffect(() => {
    if (viewerLoading || !isFta) return;
    let mounted = true;
    (async () => {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;
      if (mounted) setUserId(user.id);

      const { data } = await supabase
        .from("live_sessions")
        .select("id, title, description, scheduled_at, duration_min, recording_url, recording_path, recording_kind, status, track, min_tier, class_type")
        .eq("status", "completed")
        .eq("min_tier", "academy")
        .order("scheduled_at", { ascending: false });

      const mapped: Rec[] = (data || [])
        .map((s) => ({
          id: s.id as string,
          title: s.title as string,
          description: (s.description as string) || "",
          durationMin: (s.duration_min as number) || 45,
          scheduledIso: (s.scheduled_at as string) || null,
          scheduledAt: fmt((s.scheduled_at as string) || null),
          recordingKind: resolveRecordingKind(s as { recording_kind?: string | null; recording_path?: string | null; recording_url?: string | null }) as RecordingKind | null,
          recordingUrl: (s.recording_url as string) || undefined,
          recordingPath: (s.recording_path as string) || undefined,
          classType: (s.class_type as ClassType) || null,
          trackLabel: "FTA",
        }))
        .filter((r) => r.recordingKind !== null);

      if (mounted) {
        setRecordings(mapped);
        setLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, [viewerLoading, isFta]);

  if (viewerLoading) return <FtaRecordingsSkeleton />;

  if (!isFta) {
    return (
      <LockedState
        icon={Film}
        lockBadge
        eyebrow="FTA — Trading Academy"
        title="Unlock the Recordings"
        body={
          isChild
            ? "FTA class recordings are part of your family's Family Trading Academy. Ask a parent about joining — your family's class recordings are on the Live Classes page."
            : "Every FTA live class recording — always waiting, grouped by series — opens with the Family Trading Academy. Club class recordings stay on the Live Classes page."
        }
        cta={isChild ? undefined : { label: "Unlock FTA", href: "/upgrade", icon: Lock }}
      />
    );
  }

  // Group by class series, preserving newest-first within each group.
  const groups: { key: string; label: string | null; items: Rec[] }[] = [];
  const hasTypes = recordings.some((r) => r.classType);
  if (hasTypes) {
    for (const t of CLASS_TYPE_ORDER) {
      const items = recordings.filter((r) => r.classType === t);
      if (items.length) groups.push({ key: t, label: CLASS_TYPE_LABEL[t], items });
    }
    const other = recordings.filter((r) => !r.classType);
    if (other.length) groups.push({ key: "other", label: "Other classes", items: other });
  } else if (recordings.length) {
    groups.push({ key: "all", label: null, items: recordings });
  }

  const totalMin = recordings.reduce((s, r) => s + (r.durationMin || 0), 0);

  return (
    <div className="mx-auto w-full max-w-3xl pb-16">
      <FtaHubHeader
        title="The"
        mark="Recordings"
        subtitle="Every FTA class, always waiting — newest first, grouped by series."
      />

      {loading ? (
        <FtaListSkeleton />
      ) : recordings.length === 0 ? (
        /* FOUNDING STATE (§0.5) — an empty shelf is the REAL state before the
           first cohort session is processed. Say so. */
        <div className="club-b-card mt-11 px-4 py-5">
          <p className="font-display text-[18px] font-extrabold uppercase leading-[1.15] text-ink">
            The shelf is empty
          </p>
          <p className="mt-1.5 max-w-[52ch] text-[13.5px] leading-relaxed text-soft">
            FTA class recordings land here right after each live session, grouped
            by series. Nothing is missing — the first one simply has not been
            recorded yet.
          </p>
        </div>
      ) : (
        <>
          {/* The shelf's own measures — stated, never inferred. */}
          <p className="mt-9 font-mono text-[10px] uppercase tracking-[0.16em] text-soft">
            {recordings.length} recording{recordings.length === 1 ? "" : "s"} ·{" "}
            {Math.round(totalMin / 60)} hours on the shelf
          </p>

          <div className="mt-8 space-y-9">
            {groups.map((group) => {
              const rows = (
                <div className="f0-stagger flex flex-col gap-2.5">
                  {group.items.map((rec, i) => (
                    <m.div
                      key={rec.id}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: Math.min(i * 0.04, 0.2) }}
                      style={{ ["--i" as string]: Math.min(i, 12) }}
                    >
                      <RecordingRow rec={rec} onWatch={() => setWatching(rec)} />
                    </m.div>
                  ))}
                </div>
              );
              if (!group.label) return <section key={group.key}>{rows}</section>;
              const { head, mark } = splitMark(group.label);
              return (
                <BoardSection
                  key={group.key}
                  id={`fta-rec-${group.key}`}
                  label={head}
                  mark={mark}
                >
                  <div className="mt-3">{rows}</div>
                </BoardSection>
              );
            })}
          </div>
        </>
      )}

      {watching && (
        <RecordingPlayerModal
          session={watching}
          userId={userId}
          onClose={() => setWatching(null)}
        />
      )}
    </div>
  );
}

/** Split a series label so its LAST word can carry the board's accent mark.
 *  The visible string is unchanged — `BoardSection` renders `label` then `mark`
 *  separated by a single space, which is exactly how the label reads today. */
function splitMark(label: string): { head: string; mark?: string } {
  const parts = label.trim().split(" ");
  if (parts.length < 2) return { head: label };
  return { head: parts.slice(0, -1).join(" "), mark: parts[parts.length - 1] };
}

/** One recording on the shelf: the board's card — tile, title, chip meta row,
 *  then the watch affordance in the action colour. */
function RecordingRow({ rec, onWatch }: { rec: Rec; onWatch: () => void }) {
  const external = rec.recordingKind === "external" && rec.recordingUrl;

  const body = (
    <>
      {/* The tile stands in for a thumbnail. live_sessions carries no poster
          image, so this is the house tile with the medium's own glyph rather
          than a generated picture pretending to be a still. */}
      <span
        aria-hidden
        className="club-b-tile h-[34px] w-[34px] shrink-0 rounded-[10px]"
      >
        <Play className="h-3.5 w-3.5" />
      </span>

      <span className="min-w-0 flex-1">
        <span className="block font-display text-[15px] font-extrabold leading-snug text-ink">
          {rec.title}
        </span>
        {rec.description && (
          <span className="mt-1 line-clamp-2 block max-w-prose text-[12.5px] leading-relaxed text-soft">
            {rec.description}
          </span>
        )}

        <span className="mt-2.5 flex flex-wrap items-center gap-2">
          <span className="f0-chip inline-flex px-2 py-1 font-mono text-[9.5px] font-semibold uppercase tracking-[0.1em] text-soft">
            {rec.scheduledAt || "—"}
          </span>
          <span className="f0-chip inline-flex px-2 py-1 font-mono text-[9.5px] font-semibold uppercase tracking-[0.1em] text-soft">
            {rec.durationMin} min
          </span>
        </span>

        <span className="mt-2.5 flex items-center gap-1.5 font-display text-[12.5px] font-bold uppercase tracking-[0.08em] text-accent">
          <Play className="h-3.5 w-3.5" />
          Watch
          {external && <ExternalLink className="h-3 w-3" />}
        </span>
      </span>
    </>
  );

  const cls = "club-b-card f0-focus f0-press flex items-start gap-3 px-4 py-4";

  return external ? (
    <a
      href={rec.recordingUrl}
      target="_blank"
      rel="noopener noreferrer"
      className={cls}
    >
      {body}
    </a>
  ) : (
    <button onClick={onWatch} className={`${cls} w-full text-left`}>
      {body}
    </button>
  );
}

/* LOADING ≠ EMPTY (§0.4). */
function FtaRecordingsSkeleton() {
  return (
    <div className="mx-auto w-full max-w-3xl pb-16" aria-busy="true">
      <div className="metal-gold h-[3px] w-full rounded-full opacity-40" />
      <div className="mt-5 h-3 w-44 animate-pulse rounded bg-sand" />
      <div className="mt-3 h-11 w-72 animate-pulse rounded bg-sand" />
      <div className="mt-7 h-8 w-full animate-pulse rounded bg-sand/50" />
      <FtaListSkeleton />
    </div>
  );
}

function FtaListSkeleton() {
  return (
    <div className="mt-10 flex flex-col gap-2.5" aria-busy="true">
      {[0, 1, 2].map((i) => (
        <div key={i} className="club-b-card flex items-start gap-3 px-4 py-4">
          <div className="h-[34px] w-[34px] shrink-0 animate-pulse rounded-[10px] bg-sand/60" />
          <div className="min-w-0 flex-1 space-y-2">
            <div className="h-4 w-2/3 animate-pulse rounded bg-sand/60" />
            <div className="h-3 w-1/3 animate-pulse rounded bg-sand/40" />
            <div className="h-3 w-24 animate-pulse rounded-full bg-sand/50" />
          </div>
        </div>
      ))}
    </div>
  );
}
