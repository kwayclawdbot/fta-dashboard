"use client";

import { useState, useEffect, useCallback } from "react";
import { m } from "@/lib/motion";
import {
  Video,
  Play,
  Clock,
  Lock,
  Users,
  BookOpen,
  Check,
  CalendarCheck,
  ExternalLink,
  Sparkles,
} from "lucide-react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { XP, awardXp, hasXpForRef } from "@/lib/xp";
import {
  canAccessSessionEffective,
  getFamilyTierState,
  type FamilyTier,
  type SessionTier,
} from "@/lib/tier";
import TierBadge from "@/components/TierBadge";
import Tabs from "@/components/ui/Tabs";
import RecordingPlayerModal from "@/components/live/RecordingPlayerModal";
import {
  resolveRecordingKind,
  type RecordingKind,
} from "@/lib/recordings";

/**
 * LIVE CLASSES — canvas rebuild (light-primary club system).
 *
 * COMPOSITION LAW: the schedule is a LEDGER, not a stack of cards. Every class
 * used to render as a bordered mini-card in a vertical list, which flattened a
 * live broadcast, a class three weeks out and a year-old recording into three
 * identical boxes. Now: one hairline-ruled ledger, grouped by class type with
 * section rules — and the ONE dark object on the surface is reserved for a class
 * that is actually ON AIR, which is the only moment on this page that deserves
 * to dominate.
 *
 * COLOUR LAW on this surface: green/red are PRICE colours and appear nowhere
 * here. "On air" is carried by the ACCENT ramp (gold in Family Mode, volt orange
 * in Club, metallic on the FTA desk) so the live signal is mode-correct for free.
 *
 * Wiring is untouched: the Zoom join link, RSVP writes + XP award + the push
 * enrolment nudge, the Supabase session/RSVP reads, tier + track gating via the
 * central access matrix, and the recording player (which owns its own XP award).
 */

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
  clubLapsed: boolean;
}

/** Track labels only — the old per-track colour chips added four accent ramps to
 *  a surface that needs one. Track now reads as a mono label in the row meta. */
const TRACK_LABEL: Record<Track, string> = {
  kids: "Kids Corner",
  teens: "Teens",
  adults: "Parents & Adults",
  all: "Whole Family",
};

// ── Bits ──

/** Section marker — charged tick + eyebrow + hairline to the edge. */
function SectionRule({
  label,
  meta,
}: {
  label: string;
  meta?: React.ReactNode;
}) {
  return (
    <div className="mb-1 flex items-center gap-3">
      <h3 className="f0-section-rule flex-1">
        <span className="font-display text-eyebrow font-bold uppercase text-ink">
          {label}
        </span>
      </h3>
      {meta}
    </div>
  );
}

/** The date column of a ledger row — mono, tabular, two lines. */
function WhenColumn({ session }: { session: LiveSession }) {
  const iso = session.scheduledIso;
  if (!iso) {
    return (
      <div className="w-[4.75rem] shrink-0 self-start">
        <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.1em] text-soft/70">
          TBA
        </p>
      </div>
    );
  }
  const d = new Date(iso);
  const day = d
    .toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })
    .replace(",", "");
  const time = d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
  return (
    <div className="w-[4.75rem] shrink-0 self-start">
      <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.08em] text-ink">
        {day}
      </p>
      <p className="font-mono text-[10.5px] tabular-nums text-soft/80">{time}</p>
    </div>
  );
}

/**
 * ON AIR — the one dark object on this surface. Host identity leads, the join
 * action is the single filled control on the page, and the copy stays honest:
 * joining happens in Zoom (no simulated stage), and the recording is promised
 * only because it genuinely gets posted here afterwards.
 */
function OnAirField({
  session,
  familiesGoing,
}: {
  session: LiveSession;
  familiesGoing: number;
}) {
  return (
    <m.section
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45 }}
      className="f0-hero-field f0-grain px-5 py-7 sm:px-8 sm:py-8"
    >
      <div className="flex flex-wrap items-center gap-2.5">
        <span className="relative flex h-2.5 w-2.5 items-center justify-center">
          <span className="absolute inline-flex h-2.5 w-2.5 rounded-full bg-volt-400/60 motion-safe:animate-ping" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-volt-400" />
        </span>
        <span className="font-mono text-eyebrow font-semibold uppercase text-volt-300">
          On air now
        </span>
        <span className="font-mono text-[10px] uppercase tracking-[0.14em] opacity-55">
          {TRACK_LABEL[session.track]}
        </span>
      </div>

      <h2 className="mt-3.5 max-w-2xl font-display text-display-2 font-extrabold uppercase">
        {session.title}
      </h2>

      {session.description && (
        <p className="mt-3 max-w-lg text-[13.5px] leading-relaxed opacity-75">
          {session.description}
        </p>
      )}

      {/* host identity + the honest instrument line */}
      <div className="mt-6 flex flex-wrap items-center gap-x-6 gap-y-3">
        <span className="flex items-center gap-2.5">
          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-white/12 font-display text-[12px] font-extrabold">
            {session.hostAvatar}
          </span>
          <span>
            <span className="block font-mono text-[10px] uppercase tracking-[0.14em] opacity-55">
              Hosted by
            </span>
            <span className="block text-[13.5px] font-semibold">{session.host}</span>
          </span>
        </span>
        <span className="font-mono text-[11px] uppercase tracking-[0.12em] opacity-65">
          {session.durationMin} min
        </span>
        {familiesGoing > 0 && (
          <span className="inline-flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-[0.12em] opacity-65">
            <Users className="h-3.5 w-3.5" />
            {familiesGoing} RSVP&apos;d
          </span>
        )}
      </div>

      <div className="mt-6">
        {session.zoomUrl ? (
          <a
            href={session.zoomUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 rounded-full bg-volt-500 px-6 py-3 font-display text-[14px] font-bold text-white transition hover:brightness-110"
          >
            <Video className="h-4 w-4" />
            Join the class
            <ExternalLink className="h-3.5 w-3.5" />
          </a>
        ) : (
          <p className="text-[13.5px] leading-relaxed opacity-80">
            The join link hasn&apos;t been posted yet — refresh in a moment or
            check your email.
          </p>
        )}
        <p className="mt-2.5 font-mono text-[10px] uppercase tracking-[0.14em] opacity-50">
          Opens in Zoom · the recording is posted here afterwards
        </p>
      </div>
    </m.section>
  );
}

/** One class on the ledger — no container, hierarchy from type and rule alone. */
function SessionRow({
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
    <div className={`f0-ledger-row ${locked ? "opacity-55" : ""}`}>
      <WhenColumn session={session} />

      <div className="min-w-0 flex-1">
        <h4 className="font-display text-[15px] font-bold leading-snug tracking-tight text-ink">
          {session.title}
        </h4>
        {session.description && (
          <p className="mt-0.5 line-clamp-2 max-w-prose text-[12.5px] leading-relaxed text-soft">
            {session.description}
          </p>
        )}

        <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-[10px] uppercase tracking-[0.1em] text-soft/75">
          <span>{session.host}</span>
          <span className="inline-flex items-center gap-1">
            <Clock className="h-3 w-3" />
            {session.durationMin} min
          </span>
          <span>{TRACK_LABEL[session.track]}</span>
          {!isRecording && onRsvp && (
            <span className="inline-flex items-center gap-1 text-gold-700">
              <Users className="h-3 w-3" />
              {families} famil{families === 1 ? "y" : "ies"} going
            </span>
          )}
          {session.minTier === "academy" && <TierBadge tier="fta" size="xs" />}
        </div>

        {(session.worksheetUrl || session.assignment) && (
          <div className="mt-1.5 space-y-1">
            {session.worksheetUrl && (
              <a
                href={session.worksheetUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-[11.5px] font-semibold text-gold-700 hover:text-gold-600"
              >
                <BookOpen className="h-3 w-3" />
                Worksheet
                <ExternalLink className="h-2.5 w-2.5" />
              </a>
            )}
            {session.assignment && (
              <p className="max-w-prose text-[11.5px] leading-relaxed text-soft">
                <span className="font-semibold text-ink">Assignment: </span>
                {session.assignment}
              </p>
            )}
          </div>
        )}
      </div>

      <div className="shrink-0 self-start pt-0.5 text-right">
        {locked ? (
          <span
            className="inline-flex items-center gap-1 font-mono text-[10px] uppercase tracking-[0.1em] text-soft/70"
            title={lockReason}
          >
            <Lock className="h-3 w-3" />
            {lockReason || "Locked"}
          </span>
        ) : isRecording ? (
          hasRecording ? (
            session.recordingKind === "external" && session.recordingUrl ? (
              <a
                href={session.recordingUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-[12.5px] font-semibold text-gold-700 transition hover:text-gold-600"
              >
                <Play className="h-3.5 w-3.5" />
                Watch
              </a>
            ) : (
              <button
                onClick={onWatch}
                className="inline-flex items-center gap-1.5 text-[12.5px] font-semibold text-gold-700 transition hover:text-gold-600"
              >
                <Play className="h-3.5 w-3.5" />
                Watch
              </button>
            )
          ) : (
            <span className="font-mono text-[10px] uppercase tracking-[0.1em] text-soft/60">
              Recording soon
            </span>
          )
        ) : onRsvp ? (
          <button
            onClick={onRsvp}
            className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[12.5px] font-semibold transition ${
              going
                ? "border-gold-500 bg-gold-400/12 text-gold-700"
                : "border-sand text-soft hover:border-gold-400 hover:text-ink"
            }`}
          >
            {going ? (
              <>
                <Check className="h-3.5 w-3.5" />
                Going
              </>
            ) : (
              <>
                <CalendarCheck className="h-3.5 w-3.5" />
                RSVP
              </>
            )}
          </button>
        ) : (
          <span className="font-mono text-[10px] uppercase tracking-[0.1em] text-soft/60">
            TBA
          </span>
        )}
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
  const [tabTouched, setTabTouched] = useState(false);
  const [trackFilter, setTrackFilter] = useState<Track>("all");
  const [sessions, setSessions] = useState<LiveSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState("");
  const [familyId, setFamilyId] = useState<string | null>(null);
  const [access, setAccess] = useState<Access>({
    isChild: false,
    userTrack: "adults",
    tier: "fic",
    clubLapsed: false,
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
        // High-intent moment — nudge push enrollment (NotificationOnboard caps it).
        if (typeof window !== "undefined") {
          window.dispatchEvent(new CustomEvent("fic:notify-intent"));
        }
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

  // Open on the first tab that actually has something (audit #11): landing on an
  // empty "On air" when Upcoming/Recordings have items is a dead first view.
  // Only auto-selects until the member picks a tab themselves.
  useEffect(() => {
    if (loading || tabTouched) return;
    const hasLive = sessions.some((s) => s.status === "live");
    const hasUpcoming = sessions.some((s) => s.status === "upcoming");
    const hasRecording = sessions.some((s) => s.status === "completed");
    const first: TabType = hasLive
      ? "live"
      : hasUpcoming
        ? "upcoming"
        : hasRecording
          ? "recordings"
          : "live";
    setTab(first);
  }, [loading, sessions, tabTouched]);

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

      const { tier, clubLapsed } = await getFamilyTierState(
        supabase,
        profile?.family_id
      );
      setAccess({ isChild, userTrack, tier, clubLapsed });

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
    !canAccessSessionEffective(access.tier, access.clubLapsed, session.minTier);

  const sessionLock = (session: LiveSession) => {
    if (isTrackLocked(session.track))
      return { locked: true, reason: TRACK_LABEL[session.track] };
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

  // Group a list by FIC class type (with a labeled section rule per group).
  // Legacy rows without a class type render flat, so nothing breaks pre-tagging.
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

  const trackFilters: Track[] = ["all", "kids", "teens", "adults"];
  const liveLock = liveSession ? sessionLock(liveSession) : null;

  if (loading) {
    return (
      <div className="mx-auto w-full max-w-4xl px-4 pt-6 sm:px-6">
        <div className="h-3 w-28 animate-pulse rounded bg-sand" />
        <div className="mt-4 h-10 w-64 animate-pulse rounded bg-sand" />
        <div className="mt-8 space-y-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-16 w-full animate-pulse rounded bg-sand/60" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-4xl px-4 pb-16 pt-6 sm:px-6">
      {/* ── Masthead ─────────────────────────────────────────────────────── */}
      <m.header
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
      >
        <p className="font-mono text-eyebrow font-semibold uppercase text-soft">
          {liveSession ? "A class is on air" : "The club's classroom"}
        </p>
        <h1 className="mt-2 font-display text-display-1 font-extrabold uppercase text-ink">
          Live Classes
        </h1>
        <p className="mt-3 max-w-xl text-[14px] leading-relaxed text-soft">
          Coaching calls, Q&amp;A and workshops run live — then every one of them
          is posted back here as a recording you can study at your own pace.
        </p>

        {/* Entitlement — a stated line on a hairline, not a notice box. */}
        <p className="f0-rule-top mt-6 pt-4 text-[13px] leading-relaxed text-soft">
          {access.isChild ? (
            <>
              <span className="font-semibold text-ink">Your track:</span>{" "}
              {TRACK_LABEL[access.userTrack] || access.userTrack}, plus every
              whole-family session.
            </>
          ) : access.tier === "fta" ? (
            <>
              <span className="font-semibold text-ink">FTA member</span> — every
              class and every recording is open to you.
            </>
          ) : (
            <>
              <span className="font-semibold text-ink">Foundations member</span>{" "}
              — family classes are open to you. Sessions marked{" "}
              <span className="font-semibold text-gold-700">FTA</span> are part
              of the 6-week live program.{" "}
              <Link
                href="/upgrade"
                className="font-semibold text-gold-700 transition-colors hover:text-gold-600"
              >
                Join the next cohort →
              </Link>
            </>
          )}
        </p>
      </m.header>

      {/* ── Tabs ─────────────────────────────────────────────────────────── */}
      <Tabs
        className="mt-8"
        ariaLabel="Live class views"
        active={tab}
        onSelect={(k) => {
          setTabTouched(true);
          setTab(k);
        }}
        tabs={[
          { key: "live" as TabType, label: "On air", count: liveSession ? 1 : 0 },
          { key: "upcoming" as TabType, label: "Upcoming", count: upcoming.length },
          { key: "recordings" as TabType, label: "Recordings", count: recordings.length },
        ]}
      />

      {/* Track filter — only worth showing once a tab is crowded (>6 sessions) */}
      {tab !== "live" &&
        (tab === "upcoming" ? upcoming.length : recordings.length) > 6 && (
          <div className="mt-4 flex flex-wrap items-center gap-x-2 gap-y-2">
            <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-soft/70">
              Track
            </span>
            {trackFilters.map((t) => (
              <button
                key={t}
                onClick={() => setTrackFilter(t)}
                className={`rounded-full px-3 py-1 text-[12px] font-semibold transition ${
                  trackFilter === t
                    ? "bg-gold-500 text-night-950"
                    : "text-soft hover:text-ink"
                }`}
              >
                {t === "all" ? "All" : TRACK_LABEL[t]}
              </button>
            ))}
          </div>
        )}

      {/* ── On air ───────────────────────────────────────────────────────── */}
      {tab === "live" && (
        <div className="mt-6">
          {liveSession ? (
            liveLock?.locked ? (
              <div className="f0-rule-top py-8">
                <p className="font-mono text-eyebrow font-semibold uppercase text-soft">
                  This class isn&apos;t yours yet
                </p>
                <h2 className="mt-2.5 font-display text-display-3 font-extrabold text-ink">
                  {isTierLocked(liveSession)
                    ? "Part of the FTA 6-week program"
                    : `Reserved for the ${TRACK_LABEL[liveSession.track]} track`}
                </h2>
                {isTierLocked(liveSession) && (
                  <Link
                    href="/upgrade"
                    className="mt-4 inline-flex items-center gap-1.5 text-[13px] font-semibold text-gold-700 transition hover:text-gold-600"
                  >
                    <Sparkles className="h-4 w-4" />
                    Join the next cohort →
                  </Link>
                )}
              </div>
            ) : (
              <OnAirField
                session={liveSession}
                familiesGoing={rsvpInfo[liveSession.id]?.count ?? 0}
              />
            )
          ) : (
            <div className="f0-rule-top py-10">
              <p className="font-mono text-eyebrow font-semibold uppercase text-soft">
                Nothing on air
              </p>
              <h2 className="mt-2.5 max-w-md font-display text-display-3 font-extrabold text-ink">
                The room is quiet right now
              </h2>
              <p className="mt-2 max-w-md text-[13.5px] leading-relaxed text-soft">
                When a class goes live it takes over this page. Until then, the
                schedule and the full recording library are a tap away.
              </p>
              <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 text-[13px] font-semibold">
                <button
                  onClick={() => {
                    setTabTouched(true);
                    setTab("upcoming");
                  }}
                  className="text-gold-700 transition hover:text-gold-600"
                >
                  See what&apos;s scheduled →
                </button>
                {recordings.length > 0 && (
                  <button
                    onClick={() => {
                      setTabTouched(true);
                      setTab("recordings");
                    }}
                    className="text-soft transition hover:text-ink"
                  >
                    Watch a recording
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Upcoming ─────────────────────────────────────────────────────── */}
      {tab === "upcoming" && (
        <div className="mt-6 space-y-8">
          {filterByTrack(upcoming).length === 0 ? (
            <p className="f0-rule-top py-8 text-[13.5px] text-soft">
              No upcoming sessions
              {trackFilter !== "all" ? " for this track" : ""} on the calendar
              yet — new classes are posted as they&apos;re scheduled.
            </p>
          ) : (
            groupSessions(filterByTrack(upcoming)).map((group) => (
              <section key={group.key}>
                {group.label && (
                  <SectionRule
                    label={group.label}
                    meta={
                      <span className="font-mono text-[11px] tabular-nums text-soft/70">
                        {group.items.length}
                      </span>
                    }
                  />
                )}
                <div className="f0-ledger f0-stagger border-t border-sand/70">
                  {group.items.map((session, i) => {
                    const lock = sessionLock(session);
                    return (
                      <div key={session.id} style={{ ["--i" as string]: i }}>
                        <SessionRow
                          session={session}
                          locked={lock.locked}
                          lockReason={lock.reason}
                          rsvp={rsvpInfo[session.id]}
                          onRsvp={
                            lock.locked ? undefined : () => toggleRsvp(session.id)
                          }
                        />
                      </div>
                    );
                  })}
                </div>
              </section>
            ))
          )}
        </div>
      )}

      {/* ── Recordings ───────────────────────────────────────────────────── */}
      {tab === "recordings" && (
        <div className="mt-6 space-y-8">
          {filterByTrack(recordings).length === 0 ? (
            <p className="f0-rule-top py-8 text-[13.5px] text-soft">
              No recordings
              {trackFilter !== "all" ? " for this track" : ""} yet — every live
              class lands here once it&apos;s processed.
            </p>
          ) : (
            groupSessions(filterByTrack(recordings)).map((group) => (
              <section key={group.key}>
                {group.label && (
                  <SectionRule
                    label={group.label}
                    meta={
                      <span className="font-mono text-[11px] tabular-nums text-soft/70">
                        {group.items.length}
                      </span>
                    }
                  />
                )}
                <div className="f0-ledger f0-stagger border-t border-sand/70">
                  {group.items.map((session, i) => {
                    const lock = sessionLock(session);
                    return (
                      <div key={session.id} style={{ ["--i" as string]: i }}>
                        <SessionRow
                          session={session}
                          locked={lock.locked}
                          lockReason={lock.reason}
                          onWatch={
                            lock.locked ? undefined : () => setWatching(session)
                          }
                        />
                      </div>
                    );
                  })}
                </div>
              </section>
            ))
          )}
        </div>
      )}

      {watching && (
        <RecordingPlayerModal
          session={{
            id: watching.id,
            title: watching.title,
            durationMin: watching.durationMin,
            recordingKind: watching.recordingKind,
            recordingUrl: watching.recordingUrl,
            recordingPath: watching.recordingPath,
            scheduledAt: watching.scheduledAt,
            trackLabel: TRACK_LABEL[watching.track],
          }}
          userId={userId}
          onClose={() => setWatching(null)}
        />
      )}
    </div>
  );
}
