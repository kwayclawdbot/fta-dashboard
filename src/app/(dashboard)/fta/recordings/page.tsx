"use client";

import { useEffect, useState } from "react";
import { m } from "@/lib/motion";
import { Play, Clock, Calendar, Film, Lock, ExternalLink, Sparkles } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useFtaViewer } from "@/components/fta/useFtaViewer";
import FtaHubHeader from "@/components/fta/FtaHubHeader";
import LockedState from "@/components/dashboard/LockedState";
import RecordingPlayerModal, {
  type RecordingPlayable,
} from "@/components/live/RecordingPlayerModal";
import { resolveRecordingKind, type RecordingKind } from "@/lib/recordings";

/**
 * /fta/recordings — a recordings-first, FTA-scoped view of the class library.
 * It reuses the exact live-sessions recording query + the shared
 * RecordingPlayerModal (signed URL / youtube-nocookie + watch XP), filtered to
 * the FTA program (min_tier = 'academy'), grouped by class series, newest
 * first. The shared /live-sessions page stays for everyone (FIC classes etc.).
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

  return (
    <div className="max-w-4xl mx-auto space-y-5 pb-12">
      <FtaHubHeader
        title="Recordings"
        subtitle="Every FTA class, always waiting — newest first, grouped by series."
      />

      {loading ? (
        <FtaRecordingsListSkeleton />
      ) : recordings.length === 0 ? (
        <div className="paper-card p-10 text-center">
          <Sparkles className="w-7 h-7 text-ftagold-500 mx-auto mb-3" />
          <p className="font-display text-base font-semibold text-ink mb-1">No recordings yet</p>
          <p className="text-sm text-soft max-w-sm mx-auto">
            Your FTA class recordings land here right after each live session.
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {groups.map((group) => (
            <div key={group.key}>
              {group.label && (
                <h2 className="font-display text-xs font-bold uppercase tracking-wider text-ftagold-700 mb-2">
                  {group.label}
                </h2>
              )}
              <div className="space-y-2.5">
                {group.items.map((rec, i) => (
                  <m.div
                    key={rec.id}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: Math.min(i * 0.04, 0.2) }}
                  >
                    <RecordingRow
                      rec={rec}
                      onWatch={() => setWatching(rec)}
                    />
                  </m.div>
                ))}
              </div>
            </div>
          ))}
        </div>
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

function RecordingRow({ rec, onWatch }: { rec: Rec; onWatch: () => void }) {
  const external = rec.recordingKind === "external" && rec.recordingUrl;
  return (
    <div className="flex items-start gap-3 rounded-xl border border-ftagold-400/30 bg-gradient-to-br from-ftagold-400/[0.06] to-transparent p-4 hover:border-ftagold-400/60 transition-colors">
      <div className="w-10 h-10 rounded-lg bg-gradient-to-b from-ftagold-400 to-ftagold-600 text-white flex items-center justify-center shrink-0 shadow-soft">
        <Play className="w-5 h-5" />
      </div>
      <div className="flex-1 min-w-0">
        <h3 className="font-display text-sm font-semibold text-ink leading-snug">{rec.title}</h3>
        {rec.description && <p className="text-xs text-soft mt-0.5 line-clamp-2">{rec.description}</p>}
        <div className="flex items-center gap-3 mt-1.5 text-[11px] text-soft">
          <span className="flex items-center gap-1"><Calendar className="w-3 h-3" />{rec.scheduledAt}</span>
          <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{rec.durationMin} min</span>
        </div>
      </div>
      {external ? (
        <a
          href={rec.recordingUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-ftagold-400/15 text-ftagold-700 border border-ftagold-400/30 text-xs font-semibold hover:bg-ftagold-400/25 transition-colors shrink-0"
        >
          <Play className="w-3 h-3" /> Watch <ExternalLink className="w-3 h-3" />
        </a>
      ) : (
        <button
          onClick={onWatch}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-ftagold-400/15 text-ftagold-700 border border-ftagold-400/30 text-xs font-semibold hover:bg-ftagold-400/25 transition-colors shrink-0"
        >
          <Play className="w-3 h-3" /> Watch
        </button>
      )}
    </div>
  );
}

function FtaRecordingsSkeleton() {
  return (
    <div className="max-w-4xl mx-auto space-y-5 animate-pulse">
      <div className="h-32 rounded-2xl bg-sand/40" />
      <FtaRecordingsListSkeleton />
    </div>
  );
}
function FtaRecordingsListSkeleton() {
  return (
    <div className="space-y-2.5">
      {[0, 1, 2].map((i) => (
        <div key={i} className="h-20 rounded-xl bg-sand/30 animate-pulse" />
      ))}
    </div>
  );
}
