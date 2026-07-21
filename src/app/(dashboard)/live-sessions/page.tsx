"use client";

import { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import {
  Video,
  Play,
  Clock,
  Calendar,
  Lock,
  Users,
  BookOpen,
  Filter,
  Check,
  CalendarCheck,
  ExternalLink,
  X,
  Sparkles,
} from "lucide-react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { XP, awardXp, hasXpForRef } from "@/lib/xp";
import {
  canAccessSession,
  getFamilyTier,
  type FamilyTier,
  type SessionTier,
} from "@/lib/tier";
import TierBadge from "@/components/TierBadge";
import {
  RECORDINGS_BUCKET,
  SIGNED_URL_TTL,
  resolveRecordingKind,
  youtubeEmbedUrl,
  type RecordingKind,
} from "@/lib/recordings";

// ── Types ──

type Track = "kids" | "teens" | "adults" | "all";

interface LiveSession {
  id: string;
  title: string;
  description: string;
  host: string;
  hostAvatar: string;
  scheduledAt: string;
  scheduledIso: string | null;
  durationMin: number;
  track: Track;
  status: "live" | "upcoming" | "completed";
  minTier: SessionTier;
  zoomUrl?: string;
  recordingUrl?: string;
  recordingPath?: string;
  recordingKind: RecordingKind | null;
  classType: ClassType | null;
  worksheetUrl?: string;
  assignment?: string;
}

type ClassType =
  | "weekly_class"
  | "guest_speaker"
  | "orientation"
  | "parent_qa"
  | "kids_money_lab"
  | "market_recap";

// FIC class-type grouping/labels. Order here drives the grouped UI order.
const CLASS_TYPE_CONFIG: Record<ClassType, { label: string }> = {
  weekly_class: { label: "Weekly Family Stock Class" },
  kids_money_lab: { label: "Kids Money Lab" },
  parent_qa: { label: "Parent Q&A" },
  guest_speaker: { label: "Guest Speaker" },
  market_recap: { label: "Market Recap" },
  orientation: { label: "Orientation" },
};

const CLASS_TYPE_ORDER: ClassType[] = [
  "weekly_class",
  "kids_money_lab",
  "parent_qa",
  "guest_speaker",
  "market_recap",
  "orientation",
];

interface Access {
  isChild: boolean;
  userTrack: Track;
  tier: FamilyTier;
}

// ── Track Config (matches the courses catalog: kids / teens / adults) ──

const TRACK_CONFIG: Record<
  Track,
  { label: string; color: string; bgColor: string }
> = {
  kids: {
    label: "Kids Corner",
    color: "text-sky-800",
    bgColor: "bg-chip-sky",
  },
  teens: {
    label: "Teens",
    color: "text-purple-700",
    bgColor: "bg-purple-400/10",
  },
  adults: {
    label: "Parents & Adults",
    color: "text-gold-800",
    bgColor: "bg-chip-amber",
  },
  all: {
    label: "Whole Family",
    color: "text-midnight-300",
    bgColor: "bg-midnight-700/50",
  },
};

// ── Components ──

function TrackBadge({ track }: { track: Track }) {
  const cfg = TRACK_CONFIG[track] || TRACK_CONFIG["all"];
  return (
    <span
      className={`text-[11px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded ${cfg.color} ${cfg.bgColor}`}
    >
      {cfg.label}
    </span>
  );
}

function HostAvatar({ initials }: { initials: string }) {
  return (
    <div className="w-8 h-8 rounded-full bg-gold-400/20 text-gold-700 ring-1 ring-gold-400/30 flex items-center justify-center text-[11px] font-display font-bold shrink-0">
      {initials}
    </div>
  );
}

/**
 * Honest live-session card. Zoom SDK creds are pending, so joining happens
 * in Zoom itself — this card shows the real session info + real RSVP count
 * and hands members the join link. No simulated mic/camera/chat.
 */
function LiveNowCard({
  session,
  familiesGoing,
}: {
  session: LiveSession;
  familiesGoing: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="rounded-lg border border-red-500/30 bg-midnight-900/60 overflow-hidden"
    >
      <div className="flex items-center justify-between px-4 py-2 bg-red-500/10 border-b border-red-500/20">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
          <span className="text-xs font-bold text-red-500 uppercase">
            Live Now
          </span>
          <span className="text-[11px] text-midnight-400">|</span>
          <TrackBadge track={session.track} />
        </div>
        {familiesGoing > 0 && (
          <div className="flex items-center gap-1.5 text-[11px] text-midnight-400">
            <Users className="w-3 h-3" />
            {familiesGoing} famil{familiesGoing === 1 ? "y" : "ies"} RSVP&apos;d
          </div>
        )}
      </div>

      <div className="p-6">
        <div className="flex items-start gap-3">
          <HostAvatar initials={session.hostAvatar} />
          <div className="flex-1 min-w-0">
            <h3 className="font-display text-lg font-bold text-midnight-100">
              {session.title}
            </h3>
            {session.description && (
              <p className="text-sm text-midnight-400 font-body mt-1 leading-relaxed">
                {session.description}
              </p>
            )}
            <div className="flex items-center gap-3 mt-2 text-[11px] text-midnight-500">
              <span className="flex items-center gap-1">
                <Clock className="w-3 h-3" />
                {session.durationMin} min
              </span>
              <span>{session.host}</span>
            </div>
          </div>
        </div>

        <div className="mt-5">
          {session.zoomUrl ? (
            <a
              href={session.zoomUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-red-500 text-white text-sm font-display font-semibold hover:bg-red-600 transition-colors shadow-soft"
            >
              <Video className="w-4 h-4" />
              Join Live Class
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          ) : (
            <p className="text-sm text-midnight-400 font-body">
              The join link hasn&apos;t been posted yet — refresh in a moment
              or check your email.
            </p>
          )}
          <p className="text-[11px] text-midnight-500 font-body mt-2">
            Opens in Zoom. A recording will be posted here after class.
          </p>
        </div>
      </div>
    </motion.div>
  );
}

/**
 * In-app recording player.
 *   upload   → signed URL from the private class-recordings bucket
 *   youtube  → privacy-enhanced youtube-nocookie embed
 *   (external recordings never open this modal — they link out directly)
 */
function RecordingPlayerModal({
  session,
  userId,
  onClose,
}: {
  session: LiveSession;
  userId: string;
  onClose: () => void;
}) {
  const supabase = createClient();
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const embedUrl =
    session.recordingKind === "youtube" && session.recordingUrl
      ? youtubeEmbedUrl(session.recordingUrl)
      : null;

  useEffect(() => {
    let cancelled = false;

    async function setup() {
      if (session.recordingKind === "upload" && session.recordingPath) {
        const { data, error: err } = await supabase.storage
          .from(RECORDINGS_BUCKET)
          .createSignedUrl(session.recordingPath, SIGNED_URL_TTL);
        if (cancelled) return;
        if (err || !data?.signedUrl) {
          setError("Couldn't load this recording. Please try again shortly.");
        } else {
          setVideoUrl(data.signedUrl);
        }
      }

      // One-time XP for watching this class recording.
      if (userId) {
        const ref = `recording:${session.id}`;
        const already = await hasXpForRef(supabase, userId, "bonus", ref);
        if (!already && !cancelled) {
          await awardXp(supabase, userId, "bonus", XP.RECORDING, ref);
        }
      }
    }
    setup();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session.id]);

  return (
    <div
      className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.97 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-midnight-900 rounded-xl border border-midnight-800 shadow-lift w-full max-w-3xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-midnight-800">
          <div className="flex items-center gap-2 min-w-0">
            <Play className="w-4 h-4 text-gold-600 shrink-0" />
            <h3 className="font-display text-sm font-semibold text-midnight-100 truncate">
              {session.title}
            </h3>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-midnight-400 hover:text-midnight-100 hover:bg-midnight-800 transition-colors"
            aria-label="Close player"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="aspect-video bg-night-950">
          {session.recordingKind === "upload" ? (
            error ? (
              <div className="w-full h-full flex items-center justify-center px-6">
                <p className="text-sm text-midnight-600 font-body text-center">
                  {error}
                </p>
              </div>
            ) : videoUrl ? (
              <video
                src={videoUrl}
                controls
                autoPlay
                playsInline
                className="w-full h-full"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <div className="w-6 h-6 border-2 border-gold-400/30 border-t-gold-400 rounded-full animate-spin" />
              </div>
            )
          ) : embedUrl ? (
            <iframe
              src={embedUrl}
              title={session.title}
              className="w-full h-full"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center px-6">
              <p className="text-sm text-midnight-600 font-body text-center">
                This recording can&apos;t be played in-app.
              </p>
            </div>
          )}
        </div>

        <div className="px-4 py-3 flex items-center gap-3 text-[11px] text-midnight-500">
          <span className="flex items-center gap-1">
            <Clock className="w-3 h-3" />
            {session.durationMin} min
          </span>
          <TrackBadge track={session.track} />
          {session.scheduledAt && <span>Recorded {session.scheduledAt}</span>}
        </div>
      </motion.div>
    </div>
  );
}

function SessionCard({
  session,
  locked,
  lockReason,
  rsvp,
  onRsvp,
  onWatch,
}: {
  session: LiveSession;
  locked: boolean;
  lockReason?: string;
  rsvp?: { count: number; going: boolean };
  onRsvp?: () => void;
  onWatch?: () => void;
}) {
  const isRecording = session.status === "completed";
  const families = rsvp?.count ?? 0;
  const going = rsvp?.going ?? false;
  const hasRecording = session.recordingKind !== null;

  return (
    <div
      className={`rounded-lg border bg-midnight-900/40 p-4 transition-colors ${
        locked
          ? "border-midnight-800/40 opacity-50"
          : "border-midnight-800/60 hover:border-midnight-700"
      }`}
    >
      <div className="flex items-start gap-3">
        <HostAvatar initials={session.hostAvatar} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <TrackBadge track={session.track} />
            {session.classType && (
              <span className="text-[11px] font-semibold px-1.5 py-0.5 rounded bg-gold-400/10 text-gold-700 border border-gold-400/20">
                {CLASS_TYPE_CONFIG[session.classType].label}
              </span>
            )}
            {session.minTier === "academy" && <TierBadge tier="fta" />}
          </div>
          <h4 className="font-display text-sm font-semibold text-midnight-100 mb-0.5">
            {session.title}
          </h4>
          <p className="text-xs text-midnight-500 font-body line-clamp-2">
            {session.description}
          </p>
          <div className="flex items-center gap-3 mt-2 text-[11px] text-midnight-500">
            <span className="flex items-center gap-1">
              {isRecording ? (
                <Play className="w-3 h-3" />
              ) : (
                <Calendar className="w-3 h-3" />
              )}
              {session.scheduledAt}
            </span>
            <span className="flex items-center gap-1">
              <Clock className="w-3 h-3" />
              {session.durationMin} min
            </span>
            {!isRecording && onRsvp ? (
              <span className="flex items-center gap-1 text-gold-700">
                <Users className="w-3 h-3" />
                {families} famil{families === 1 ? "y" : "ies"} going
              </span>
            ) : null}
            <span>{session.host}</span>
          </div>
          {(session.worksheetUrl || session.assignment) && (
            <div className="mt-2 space-y-1">
              {session.worksheetUrl && (
                <a
                  href={session.worksheetUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-[11px] font-medium text-gold-700 hover:text-gold-800"
                >
                  <BookOpen className="w-3 h-3" />
                  Worksheet
                  <ExternalLink className="w-2.5 h-2.5" />
                </a>
              )}
              {session.assignment && (
                <p className="text-[11px] text-midnight-500 leading-relaxed">
                  <span className="font-semibold text-midnight-400">
                    Assignment:
                  </span>{" "}
                  {session.assignment}
                </p>
              )}
            </div>
          )}
        </div>
        <div className="shrink-0">
          {locked ? (
            <div
              className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-midnight-800 text-midnight-500 text-xs"
              title={lockReason}
            >
              <Lock className="w-3 h-3" />
              {lockReason || "Locked"}
            </div>
          ) : isRecording ? (
            hasRecording ? (
              session.recordingKind === "external" && session.recordingUrl ? (
                <a
                  href={session.recordingUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gold-400/10 text-gold-700 border border-gold-400/30 text-xs font-medium hover:bg-gold-400/20 transition-colors"
                >
                  <Play className="w-3 h-3" />
                  Watch
                  <ExternalLink className="w-3 h-3" />
                </a>
              ) : (
                <button
                  onClick={onWatch}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gold-400/10 text-gold-700 border border-gold-400/30 text-xs font-medium hover:bg-gold-400/20 transition-colors"
                >
                  <Play className="w-3 h-3" />
                  Watch
                </button>
              )
            ) : (
              <span className="text-[11px] text-midnight-500">
                Recording coming soon
              </span>
            )
          ) : onRsvp ? (
            <button
              onClick={onRsvp}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors border ${
                going
                  ? "bg-chip-green text-green-700 border-green-500/30"
                  : "bg-gold-400/10 text-gold-700 hover:bg-gold-400/20 border-gold-400/30"
              }`}
            >
              {going ? (
                <>
                  <Check className="w-3 h-3" />
                  Going
                </>
              ) : (
                <>
                  <CalendarCheck className="w-3 h-3" />
                  RSVP
                </>
              )}
            </button>
          ) : (
            <span className="text-[11px] text-midnight-500">TBA</span>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Main Page ──

type TabType = "live" | "upcoming" | "recordings";

function formatScheduledAt(dateStr: string | null, status: string): string {
  if (!dateStr) return "";
  if (status === "live") return "LIVE NOW";
  const d = new Date(dateStr);
  return d.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export default function LiveSessionsPage() {
  const supabase = createClient();
  const [tab, setTab] = useState<TabType>("live");
  const [trackFilter, setTrackFilter] = useState<Track>("all");
  const [sessions, setSessions] = useState<LiveSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState("");
  const [familyId, setFamilyId] = useState<string | null>(null);
  const [access, setAccess] = useState<Access>({
    isChild: false,
    userTrack: "adults",
    tier: "fic",
  });
  const [watching, setWatching] = useState<LiveSession | null>(null);
  const [rsvpInfo, setRsvpInfo] = useState<
    Record<string, { count: number; going: boolean }>
  >({});

  const loadRsvps = useCallback(
    async (uid: string) => {
      const { data } = await supabase
        .from("session_rsvps")
        .select("session_id, user_id, family_id");
      const map: Record<string, { fams: Set<string>; going: boolean }> = {};
      (data || []).forEach(
        (r: { session_id: string; user_id: string; family_id: string | null }) => {
          const e = map[r.session_id] || { fams: new Set<string>(), going: false };
          if (r.family_id) e.fams.add(r.family_id);
          else e.fams.add(r.user_id); // no family → count the individual
          if (r.user_id === uid) e.going = true;
          map[r.session_id] = e;
        }
      );
      const out: Record<string, { count: number; going: boolean }> = {};
      Object.entries(map).forEach(([k, v]) => {
        out[k] = { count: v.fams.size, going: v.going };
      });
      setRsvpInfo(out);
    },
    [supabase]
  );

  const toggleRsvp = useCallback(
    async (sessionId: string) => {
      if (!userId) return;
      const going = rsvpInfo[sessionId]?.going;
      if (going) {
        await supabase
          .from("session_rsvps")
          .delete()
          .eq("session_id", sessionId)
          .eq("user_id", userId);
      } else {
        await supabase
          .from("session_rsvps")
          .insert({ session_id: sessionId, user_id: userId, family_id: familyId });
        const already = await hasXpForRef(supabase, userId, "rsvp", sessionId);
        if (!already) await awardXp(supabase, userId, "rsvp", XP.RSVP, sessionId);
      }
      await loadRsvps(userId);
    },
    [supabase, userId, familyId, rsvpInfo, loadRsvps]
  );

  const loadSessions = useCallback(async () => {
    const { data } = await supabase
      .from("live_sessions")
      .select("*")
      .order("scheduled_at", { ascending: true });

    if (data && data.length > 0) {
      const mapped: LiveSession[] = data.map(
        (s: {
          id: string;
          title: string;
          description: string | null;
          scheduled_at: string | null;
          duration_min: number | null;
          zoom_join_url: string | null;
          recording_url: string | null;
          recording_path: string | null;
          recording_kind: string | null;
          status: string;
          track: string | null;
          min_tier: string | null;
          class_type: string | null;
          worksheet_url: string | null;
          assignment: string | null;
        }) => ({
          id: s.id,
          title: s.title,
          description: s.description || "",
          host: "Coach",
          hostAvatar: "C",
          scheduledAt: formatScheduledAt(s.scheduled_at, s.status),
          scheduledIso: s.scheduled_at,
          durationMin: s.duration_min || 45,
          track: (s.track as Track) || "all",
          status:
            s.status === "scheduled"
              ? "upcoming"
              : (s.status as "live" | "upcoming" | "completed"),
          minTier: (s.min_tier as "challenge" | "academy") || "challenge",
          zoomUrl: s.zoom_join_url || undefined,
          recordingUrl: s.recording_url || undefined,
          recordingPath: s.recording_path || undefined,
          recordingKind: resolveRecordingKind(s),
          classType: (s.class_type as ClassType) || null,
          worksheetUrl: s.worksheet_url || undefined,
          assignment: s.assignment || undefined,
        })
      );
      setSessions(mapped);
    }
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    loadSessions();
  }, [loadSessions]);

  useEffect(() => {
    async function loadUser() {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const user = session?.user;
      if (!user) return;
      setUserId(user.id);

      // RSVP counts only need the user id — run them in parallel with the
      // profile + tier lookup instead of after it.
      const rsvpsP = loadRsvps(user.id);

      // Same access derivation as the courses page: profile track/age_group
      // + the family membership tier (kids inherit the family's tier).
      const { data: profile } = await supabase
        .from("profiles")
        .select("role, age_group, track, family_id")
        .eq("id", user.id)
        .single();

      const userTrack = (profile?.age_group ||
        profile?.track ||
        "adults") as Track;
      const isChild = profile?.role === "child";
      setFamilyId(profile?.family_id ?? null);

      const tier = await getFamilyTier(supabase, profile?.family_id);
      setAccess({ isChild, userTrack, tier });

      await rsvpsP;
    }
    loadUser();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Kids see their own track + whole-family sessions; parents/teens see all
  // family tracks (mirrors the courses page's family-library behavior).
  const isTrackLocked = (track: Track) =>
    access.isChild && track !== "all" && track !== access.userTrack;

  // Tier gating comes from the central access matrix (src/lib/tier.ts):
  // 'academy' sessions are part of the FTA live program.
  const isTierLocked = (session: LiveSession) =>
    !canAccessSession(access.tier, session.minTier);

  const sessionLock = (session: LiveSession) => {
    if (isTrackLocked(session.track))
      return { locked: true, reason: TRACK_CONFIG[session.track].label };
    if (isTierLocked(session)) return { locked: true, reason: "FTA members" };
    return { locked: false, reason: undefined };
  };

  const now = Date.now();
  const liveSession = sessions.find((s) => s.status === "live");
  // Only genuinely future (or in-progress) classes count as upcoming —
  // stale past-dated rows shouldn't masquerade as a schedule.
  const upcoming = sessions.filter(
    (s) =>
      s.status === "upcoming" &&
      (!s.scheduledIso ||
        new Date(s.scheduledIso).getTime() + s.durationMin * 60_000 >= now)
  );
  const recordings = sessions
    .filter((s) => s.status === "completed")
    .sort(
      (a, b) =>
        new Date(b.scheduledIso || 0).getTime() -
        new Date(a.scheduledIso || 0).getTime()
    );

  const filterByTrack = (list: LiveSession[]) =>
    trackFilter === "all" ? list : list.filter((s) => s.track === trackFilter);

  // Group a list by FIC class type (with a labeled header per group). Legacy
  // rows without a class type render flat, so nothing breaks pre-tagging.
  const groupSessions = (list: LiveSession[]) => {
    const hasTypes = list.some((s) => s.classType);
    if (!hasTypes)
      return [{ key: "all", label: null as string | null, items: list }];
    const groups: { key: string; label: string | null; items: LiveSession[] }[] =
      [];
    for (const t of CLASS_TYPE_ORDER) {
      const items = list.filter((s) => s.classType === t);
      if (items.length)
        groups.push({ key: t, label: CLASS_TYPE_CONFIG[t].label, items });
    }
    const other = list.filter((s) => !s.classType);
    if (other.length)
      groups.push({ key: "other", label: "Other classes", items: other });
    return groups;
  };

  const tabs: { id: TabType; label: string; count: number }[] = [
    { id: "live", label: "Live Now", count: liveSession ? 1 : 0 },
    { id: "upcoming", label: "Upcoming", count: upcoming.length },
    { id: "recordings", label: "Recordings", count: recordings.length },
  ];

  const trackFilters: Track[] = ["all", "kids", "teens", "adults"];

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-6 h-6 border-2 border-gold-400/30 border-t-gold-400 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.3 }}
        className="mb-6"
      >
        <div className="flex items-center justify-between">
          <div>
            <h2 className="font-display text-2xl font-bold text-midnight-100">
              Live Classes
            </h2>
            <p className="text-midnight-400 text-sm mt-1 font-body">
              Live coaching calls, Q&A, and class recordings
            </p>
          </div>
          {liveSession && (
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-red-500/10 border border-red-500/20">
              <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
              <span className="text-xs font-bold text-red-500">1 LIVE NOW</span>
            </div>
          )}
        </div>
      </motion.div>

      {/* Access notice */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.05 }}
        className="mb-4 flex items-center gap-3 px-4 py-2.5 rounded-lg border border-midnight-800/60 bg-midnight-900/40 text-xs"
      >
        <BookOpen className="w-4 h-4 text-gold-600 shrink-0" />
        <p className="font-body text-midnight-400">
          {access.isChild ? (
            <>
              <span className="text-midnight-200">Your track:</span>{" "}
              {TRACK_CONFIG[access.userTrack]?.label || access.userTrack} +
              whole-family sessions.
            </>
          ) : access.tier === "fta" ? (
            <>
              <span className="text-midnight-200">FTA member</span> — you have
              access to every class and recording.
            </>
          ) : (
            <>
              <span className="text-midnight-200">Foundations member</span> —
              family classes are open to you. Sessions marked{" "}
              <span className="text-gold-700 font-semibold">FTA</span> are part
              of the 6-week live program.{" "}
              <Link
                href="/upgrade"
                className="text-gold-700 hover:text-gold-800 transition-colors font-semibold"
              >
                Join the next cohort
              </Link>
            </>
          )}
        </p>
      </motion.div>

      {/* Tabs */}
      <div className="flex items-center gap-1 mb-4 border-b border-midnight-800/50">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex items-center gap-1.5 px-4 py-2.5 text-xs font-body transition-colors border-b-2 ${
              tab === t.id
                ? "text-gold-700 border-gold-500"
                : "text-midnight-500 border-transparent hover:text-midnight-300"
            }`}
          >
            {t.id === "live" && (
              <div
                className={`w-1.5 h-1.5 rounded-full ${
                  t.count > 0 ? "bg-red-500 animate-pulse" : "bg-midnight-600"
                }`}
              />
            )}
            {t.label}
            {t.count > 0 && (
              <span
                className={`text-[11px] px-1.5 py-0.5 rounded-full ${
                  tab === t.id
                    ? "bg-gold-400/10 text-gold-700"
                    : "bg-midnight-800 text-midnight-500"
                }`}
              >
                {t.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Track filter */}
      {tab !== "live" && (
        <div className="flex items-center gap-1.5 mb-4">
          <Filter className="w-3.5 h-3.5 text-midnight-500 mr-1" />
          {trackFilters.map((t) => (
            <button
              key={t}
              onClick={() => setTrackFilter(t)}
              className={`px-2.5 py-1 rounded text-[11px] transition-colors ${
                trackFilter === t
                  ? `${TRACK_CONFIG[t].bgColor} ${TRACK_CONFIG[t].color} border border-current/20`
                  : "text-midnight-500 hover:text-midnight-300"
              }`}
            >
              {t === "all" ? "All" : TRACK_CONFIG[t].label}
            </button>
          ))}
        </div>
      )}

      {/* Content */}
      {tab === "live" && (
        <div>
          {liveSession ? (
            sessionLock(liveSession).locked ? (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="rounded-lg border border-midnight-800/60 bg-midnight-900/40 p-8 text-center"
              >
                <Lock className="w-8 h-8 text-midnight-500 mx-auto mb-3" />
                <h3 className="font-display text-lg font-semibold text-midnight-200 mb-1">
                  Session Locked
                </h3>
                <p className="text-sm text-midnight-400 font-body mb-4">
                  {isTierLocked(liveSession)
                    ? "This live class is part of the FTA 6-week program."
                    : `This live class is for the ${
                        TRACK_CONFIG[liveSession.track].label
                      } track.`}
                </p>
                {isTierLocked(liveSession) && (
                  <Link
                    href="/upgrade"
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-gold-500 text-white text-sm font-display font-semibold hover:bg-gold-600 transition-colors"
                  >
                    <Sparkles className="w-4 h-4" />
                    Join the next cohort
                  </Link>
                )}
              </motion.div>
            ) : (
              <LiveNowCard
                session={liveSession}
                familiesGoing={rsvpInfo[liveSession.id]?.count ?? 0}
              />
            )
          ) : (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="rounded-lg border border-midnight-800/60 bg-midnight-900/40 p-8 text-center"
            >
              <Video className="w-8 h-8 text-midnight-500 mx-auto mb-3" />
              <h3 className="font-display text-lg font-semibold text-midnight-200 mb-1">
                No Live Class Right Now
              </h3>
              <p className="text-sm text-midnight-400 font-body mb-4">
                Check the upcoming schedule or watch a recording.
              </p>
              <button
                onClick={() => setTab("upcoming")}
                className="text-sm text-gold-700 hover:text-gold-800 font-body transition-colors"
              >
                View upcoming sessions
              </button>
            </motion.div>
          )}
        </div>
      )}

      {tab === "upcoming" && (
        <div className="space-y-3">
          {filterByTrack(upcoming).length === 0 ? (
            <div className="text-center py-8">
              <Calendar className="w-6 h-6 text-midnight-500 mx-auto mb-2" />
              <p className="text-sm text-midnight-400 font-body">
                No upcoming sessions
                {trackFilter !== "all" ? " for this track" : ""}.
              </p>
            </div>
          ) : (
            groupSessions(filterByTrack(upcoming)).map((group) => (
              <div key={group.key} className="space-y-3">
                {group.label && (
                  <h3 className="text-xs font-bold uppercase tracking-wider text-midnight-500 mt-5 mb-1">
                    {group.label}
                  </h3>
                )}
                {group.items.map((session, i) => {
                  const lock = sessionLock(session);
                  return (
                    <motion.div
                      key={session.id}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.05 }}
                    >
                      <SessionCard
                        session={session}
                        locked={lock.locked}
                        lockReason={lock.reason}
                        rsvp={rsvpInfo[session.id]}
                        onRsvp={
                          lock.locked ? undefined : () => toggleRsvp(session.id)
                        }
                      />
                    </motion.div>
                  );
                })}
              </div>
            ))
          )}
        </div>
      )}

      {tab === "recordings" && (
        <div className="space-y-3">
          {filterByTrack(recordings).length === 0 ? (
            <div className="text-center py-8">
              <Play className="w-6 h-6 text-midnight-500 mx-auto mb-2" />
              <p className="text-sm text-midnight-400 font-body">
                No recordings
                {trackFilter !== "all" ? " for this track" : ""} yet.
              </p>
            </div>
          ) : (
            groupSessions(filterByTrack(recordings)).map((group) => (
              <div key={group.key} className="space-y-3">
                {group.label && (
                  <h3 className="text-xs font-bold uppercase tracking-wider text-midnight-500 mt-5 mb-1">
                    {group.label}
                  </h3>
                )}
                {group.items.map((session, i) => {
                  const lock = sessionLock(session);
                  return (
                    <motion.div
                      key={session.id}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.05 }}
                    >
                      <SessionCard
                        session={session}
                        locked={lock.locked}
                        lockReason={lock.reason}
                        onWatch={
                          lock.locked ? undefined : () => setWatching(session)
                        }
                      />
                    </motion.div>
                  );
                })}
              </div>
            ))
          )}
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
