"use client";

import {
  useCallback,
  useEffect,
  useState,
  useSyncExternalStore,
} from "react";
import { m, useReducedMotion } from "@/lib/motion";
import { Video, Play, Lock, ExternalLink, Check, CalendarCheck } from "lucide-react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { XP, awardXp, hasXpForRef } from "@/lib/xp";
import {
  canAccessSessionEffective,
  getFamilyTierState,
  type FamilyTier,
  type SessionTier,
} from "@/lib/tier";
import RecordingPlayerModal from "@/components/live/RecordingPlayerModal";
import { resolveRecordingKind, type RecordingKind } from "@/lib/recordings";
import V2Surface from "@/components/clubhome/v2/V2Surface";
import { ScriptTitle, Kicker, Card } from "@/components/cc/ui";

/* ══════════════════════════════════════════════════════════════════════════
   LIVE · boards L1 (Schedule) + L2 (Replay Library) — the v2 (cc canvas) render.

   This is the design-v2 branch of the live-sessions route. It renders the SAME
   real reads as the v1 surface (LiveSessionsSurface) — live_sessions +
   session_rsvps + profiles + the family tier — re-drawn to the L1/L2 canvas
   notes: the ON-AIR hero when a session is genuinely live, TODAY/TOMORROW
   mono-kicker day groups off the real scheduled_at, session rows with a time
   column + host chip + real RSVP count + Going✓/RSVP wired to the SAME RSVP
   write (which still awards XP.RSVP and nudges push), and the replay grid with
   the real FTA/track entitlement gate.

   EVERY WRITE + FLOW IS SHARED VERBATIM WITH v1:
   • toggleRsvp → session_rsvps insert/delete + awardXp(RSVP) + fic:notify-intent
   • Join → the Zoom join URL, opened exactly as today (no SDK embed — that is a
     later owner-gated build; board 05's in-room stage is out of scope here)
   • Watch → RecordingPlayerModal (owns its own watch XP)

   HONEST-DATA DECISIONS (canvas fiction NOT reproduced):
   • "2.3K in room" → the real RSVP count, labelled "N RSVP'd" (there is no
     attendance table; RSVP is the number we actually hold).
   • Event badges ("TSLA DELIVERIES") → OMITTED. Sessions carry a class_type
     category, not a ticker-event tag, so no yellow event chip is fabricated.
   • Calendar-sync strip → OMITTED. v1 has no calendar-add affordance (it nudges
     push enrolment on RSVP, which is preserved); a "sync calendar" link with no
     write behind it would be a lie.
   • Replay Pro-gate → the REAL entitlement: FTA (academy) sessions lock to
     non-FTA members via the central access matrix; the upsell points at the
     real 6-week cohort (/upgrade), NOT the canvas's "$99/mo · 214 replays" vault.
   • Watched / resume state → OMITTED. No watch-progress read is loaded, so no
     "✓ WATCHED" / "resume 27:04" is invented.
   ══════════════════════════════════════════════════════════════════════════ */

// ── Types (mirror v1) ──
type Track = "kids" | "teens" | "adults" | "all";

interface LiveSession {
  id: string;
  title: string;
  description: string;
  host: string | null;
  hostTitle: string | null;
  hostAvatarUrl: string | null;
  scheduledIso: string | null;
  durationMin: number;
  track: Track;
  status: "live" | "upcoming" | "completed";
  minTier: SessionTier;
  zoomUrl?: string;
  recordingUrl?: string;
  recordingPath?: string;
  recordingKind: RecordingKind | null;
}

interface Access {
  isChild: boolean;
  userTrack: Track;
  tier: FamilyTier;
  clubLapsed: boolean;
}

interface RosterMember {
  id: string;
  name: string;
  initials: string;
}

const TRACK_LABEL: Record<Track, string> = {
  kids: "Kids Corner",
  teens: "Teens",
  adults: "Parents & Adults",
  all: "Whole Family",
};

function initialsOf(name: string): string {
  return (
    name
      .trim()
      .split(/\s+/)
      .map((w) => w[0])
      .join("")
      .toUpperCase()
      .slice(0, 2) || "M"
  );
}

// ── Viewer clock, hour-bucketed (same external-store pattern as v1) ──
const HOUR_MS = 3_600_000;
const CLOCK_SUBSCRIBE = () => () => {};
const CLOCK_CLIENT = () => Math.floor(Date.now() / HOUR_MS);
const CLOCK_SERVER = () => null;

function startOfLocalDay(d: Date): number {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

/** Day kicker: TODAY / TOMORROW / "Wed Jul 30" from the real scheduled_at. */
function dayGroupOf(iso: string | null, nowHour: number | null): { key: string; label: string } {
  if (!iso) return { key: "tba", label: "Time to be announced" };
  const d = new Date(iso);
  if (nowHour != null) {
    const days = Math.round(
      (startOfLocalDay(d) - startOfLocalDay(new Date(nowHour * HOUR_MS))) / 86_400_000,
    );
    if (days === 0) return { key: "today", label: "Today" };
    if (days === 1) return { key: "tomorrow", label: "Tomorrow" };
  }
  const label = d
    .toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })
    .replace(",", "");
  return { key: label, label };
}

/** The time column: "9:30" + "AM ET"-style zone line. */
function splitTime(iso: string | null): { time: string; zone: string } {
  if (!iso) return { time: "—", zone: "TBA" };
  const d = new Date(iso);
  const time = d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
  const [clock, ampm] = time.split(" ");
  const zoneName =
    d
      .toLocaleTimeString("en-US", { timeZoneName: "short" })
      .split(" ")
      .pop() ?? "";
  return { time: clock, zone: `${ampm ?? ""} ${zoneName}`.trim() };
}

function startedAt(iso: string | null): string {
  if (!iso) return "";
  return new Date(iso).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
}

// ── generic host chip (real host if present, else a coach chip) ──
function HostChip({ session, size = 20 }: { session: LiveSession; size?: number }) {
  if (!session.host) {
    return (
      <span
        className="inline-flex items-center rounded-full px-2 py-0.5 font-[family-name:var(--font-plex-mono)] text-[9px] font-semibold uppercase tracking-[0.14em]"
        style={{ background: "var(--cc-card2)", border: "1px solid var(--cc-line)", color: "var(--cc-soft)" }}
      >
        Club coach
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5">
      <span
        className="grid shrink-0 place-items-center rounded-full font-semibold"
        style={{
          width: size,
          height: size,
          background: "var(--cc-card2)",
          color: "var(--cc-ink)",
          border: "1.5px solid var(--cc-line)",
          fontSize: size * 0.42,
        }}
      >
        {initialsOf(session.host)}
      </span>
      <span className="truncate text-[11.5px]" style={{ color: "var(--cc-soft)" }}>
        {session.host}
      </span>
    </span>
  );
}

// ── ON-AIR hero (board L1) ──
function OnAirHero({
  session,
  rosterTotal,
  roster,
}: {
  session: LiveSession;
  rosterTotal: number;
  roster: RosterMember[];
}) {
  const reduce = useReducedMotion();
  return (
    <m.section
      initial={reduce ? false : { opacity: 0, y: 10 }}
      animate={reduce ? undefined : { opacity: 1, y: 0 }}
      transition={{ duration: 0.45 }}
      className="cc-halo relative overflow-hidden rounded-2xl"
      style={{
        background: "linear-gradient(140deg,#241009 0%,#17141A 62%)",
        border: "1.5px solid #FF7A1A",
      }}
    >
      <div className="relative p-5 sm:p-6">
        {/* ON AIR pill */}
        <span
          className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 font-[family-name:var(--font-plex-mono)] text-[10px] font-bold uppercase tracking-[0.16em]"
          style={{ background: "var(--cc-orange)", color: "var(--cc-orange-deep)" }}
        >
          <span className="relative flex h-1.5 w-1.5">
            <span className="cc-ping absolute inline-flex h-full w-full rounded-full bg-current opacity-70" />
            <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-current" />
          </span>
          On air
        </span>

        <div className="mt-3 flex items-start gap-3">
          {/* host avatar w/ cc-ping ring */}
          <span className="relative shrink-0" style={{ width: 44, height: 44 }}>
            <span className="cc-ping absolute inset-0 rounded-full" style={{ border: "2px solid var(--cc-orange)" }} />
            <span
              className="grid h-11 w-11 place-items-center rounded-full font-extrabold"
              style={{ background: "rgba(255,255,255,0.10)", color: "#F4F0EC", border: "2px solid var(--cc-orange)", fontSize: 14 }}
            >
              {session.host ? initialsOf(session.host) : "CC"}
            </span>
          </span>
          <div className="min-w-0 flex-1">
            <h2 className="cc-display text-[20px] leading-[1.05]" style={{ color: "#F4F0EC" }}>
              {session.title}
            </h2>
            <p className="mt-1.5 font-[family-name:var(--font-plex-mono)] text-[10.5px] uppercase tracking-[0.12em]" style={{ color: "rgba(244,240,236,0.62)" }}>
              {session.host ? `${session.host} · ` : ""}
              {session.scheduledIso ? `started ${startedAt(session.scheduledIso)}` : "live now"}
              {rosterTotal > 0 ? ` · ${rosterTotal} RSVP'd` : ""}
            </p>
          </div>
        </div>

        {session.description && (
          <p className="mt-3 max-w-md text-[13px] leading-relaxed" style={{ color: "rgba(244,240,236,0.80)" }}>
            {session.description}
          </p>
        )}

        {/* the real RSVP'd roster, when we have resolved names */}
        {roster.length > 0 && (
          <div className="mt-3 flex items-center gap-2">
            <span className="flex -space-x-2">
              {roster.slice(0, 5).map((mem) => (
                <span
                  key={mem.id}
                  title={mem.name}
                  className="grid h-6 w-6 place-items-center rounded-full font-extrabold"
                  style={{ background: "rgba(255,255,255,0.15)", color: "#F4F0EC", border: "2px solid #17141A", fontSize: 9 }}
                >
                  {mem.initials}
                </span>
              ))}
            </span>
            <span className="font-[family-name:var(--font-plex-mono)] text-[10px] uppercase tracking-[0.14em]" style={{ color: "rgba(244,240,236,0.55)" }}>
              in the room
            </span>
          </div>
        )}

        <div className="mt-4">
          {session.zoomUrl ? (
            <a
              href={session.zoomUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="cc-halo inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-[14px] font-bold"
              style={{ background: "var(--cc-orange)", color: "var(--cc-orange-deep)" }}
            >
              <Video className="h-4 w-4" />
              Join
              <ExternalLink className="h-3.5 w-3.5" />
            </a>
          ) : (
            <p className="text-[13px]" style={{ color: "rgba(244,240,236,0.85)" }}>
              The join link hasn&apos;t been posted yet — refresh in a moment.
            </p>
          )}
          <p className="mt-2 font-[family-name:var(--font-plex-mono)] text-[10px] uppercase tracking-[0.14em]" style={{ color: "rgba(244,240,236,0.5)" }}>
            Opens in Zoom · the recording posts here afterwards
          </p>
        </div>
      </div>
    </m.section>
  );
}

// ── schedule row (board L1) ──
function ScheduleRow({
  session,
  locked,
  lockReason,
  rsvp,
  onRsvp,
}: {
  session: LiveSession;
  locked: boolean;
  lockReason?: string;
  rsvp?: { count: number; going: boolean };
  onRsvp?: () => void;
}) {
  const { time, zone } = splitTime(session.scheduledIso);
  const count = rsvp?.count ?? 0;
  const going = rsvp?.going ?? false;
  return (
    <Card className={`flex items-stretch gap-0 p-0 ${locked ? "opacity-60" : ""}`}>
      {/* time column */}
      <div className="flex w-[68px] shrink-0 flex-col items-center justify-center px-2 py-3 text-center">
        <span className="font-[family-name:var(--font-plex-mono)] text-[14px] font-semibold tabular-nums" style={{ color: "var(--cc-ink)" }}>
          {time}
        </span>
        <span className="mt-0.5 font-[family-name:var(--font-plex-mono)] text-[8px] uppercase tracking-[0.12em]" style={{ color: "var(--cc-dim)" }}>
          {zone}
        </span>
      </div>
      <div className="w-px shrink-0 self-stretch" style={{ background: "var(--cc-line)" }} />
      {/* body */}
      <div className="min-w-0 flex-1 px-3 py-3">
        <h4 className="text-[14px] font-bold leading-snug" style={{ color: "var(--cc-ink)" }}>
          {session.title}
        </h4>
        <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1">
          <HostChip session={session} />
          <span className="font-[family-name:var(--font-plex-mono)] text-[10px] uppercase tracking-[0.1em]" style={{ color: "var(--cc-dim)" }}>
            {session.durationMin} min
          </span>
        </div>
      </div>
      {/* right: RSVP state */}
      <div className="flex shrink-0 flex-col items-end justify-center gap-1.5 px-3 py-3">
        {locked ? (
          <span className="inline-flex items-center gap-1 font-[family-name:var(--font-plex-mono)] text-[10px] uppercase tracking-[0.1em]" style={{ color: "var(--cc-soft)" }} title={lockReason}>
            <Lock className="h-3 w-3" />
            {lockReason || "Locked"}
          </span>
        ) : onRsvp ? (
          <>
            <button
              onClick={onRsvp}
              aria-pressed={going}
              className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[12px] font-semibold transition-colors"
              style={
                going
                  ? {
                      background: "rgba(255,122,26,0.12)",
                      border: "1px solid var(--cc-orange)",
                      color: "var(--cc-orange-ink)",
                    }
                  : {
                      background: "var(--cc-card2)",
                      border: "1px solid var(--cc-line)",
                      color: "var(--cc-ink)",
                    }
              }
            >
              {going ? <Check className="h-3.5 w-3.5" /> : <CalendarCheck className="h-3.5 w-3.5" />}
              {going ? "Going" : "RSVP"}
            </button>
            {count > 0 && (
              <span className="font-[family-name:var(--font-plex-mono)] text-[9.5px] uppercase tracking-[0.1em]" style={{ color: "var(--cc-dim)" }}>
                {count} RSVP&apos;d
              </span>
            )}
          </>
        ) : (
          <span className="font-[family-name:var(--font-plex-mono)] text-[10px] uppercase tracking-[0.1em]" style={{ color: "var(--cc-dim)" }}>
            TBA
          </span>
        )}
      </div>
    </Card>
  );
}

// ── replay card (board L2) ──
const STRIPE = "repeating-linear-gradient(135deg,#221A26 0 12px,#1B1520 12px 24px)";

function ReplayCard({
  session,
  locked,
  lockReason,
  onWatch,
}: {
  session: LiveSession;
  locked: boolean;
  lockReason?: string;
  onWatch?: () => void;
}) {
  const hasRecording = session.recordingKind !== null;
  const when = session.scheduledIso
    ? new Date(session.scheduledIso)
        .toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })
        .replace(",", "")
    : "";
  const meta = [when, session.host].filter(Boolean).join(" · ");

  const external = session.recordingKind === "external" && session.recordingUrl;
  const clickable = !locked && hasRecording;

  const thumb = (
    <div className="relative h-[92px] w-full" style={{ background: STRIPE, filter: locked ? "saturate(.4)" : undefined }}>
      {/* duration chip */}
      <span
        className="absolute bottom-1.5 right-1.5 rounded px-1.5 py-0.5 font-[family-name:var(--font-plex-mono)] text-[9px] font-semibold"
        style={{ background: "rgba(0,0,0,0.7)", color: "#F4F0EC" }}
      >
        {session.durationMin} min
      </span>
      {/* center button */}
      <span className="absolute inset-0 grid place-items-center">
        {locked ? (
          <span className="grid h-8 w-8 place-items-center rounded-full" style={{ background: "rgba(0,0,0,0.55)", color: "#F4F0EC" }}>
            <Lock className="h-4 w-4" />
          </span>
        ) : hasRecording ? (
          <span className="grid h-8 w-8 place-items-center rounded-full" style={{ background: "rgba(255,122,26,0.92)", color: "var(--cc-orange-deep)" }}>
            <Play className="h-4 w-4" fill="currentColor" />
          </span>
        ) : (
          <span className="font-[family-name:var(--font-plex-mono)] text-[9px] uppercase tracking-[0.14em]" style={{ color: "rgba(244,240,236,0.6)" }}>
            soon
          </span>
        )}
      </span>
    </div>
  );

  const body = (
    <div className="px-2.5 py-2">
      <h4 className="line-clamp-2 text-[11.5px] font-bold leading-snug" style={{ color: locked ? "var(--cc-soft)" : "var(--cc-ink)" }}>
        {session.title}
      </h4>
      <p className="mt-1 font-[family-name:var(--font-plex-mono)] text-[9.5px] uppercase tracking-[0.08em]" style={{ color: locked ? "var(--cc-yellow)" : "var(--cc-dim)" }}>
        {locked ? lockReason || "Locked" : meta}
      </p>
    </div>
  );

  const inner = (
    <div className="overflow-hidden rounded-xl" style={{ background: "var(--cc-card)", border: "1px solid var(--cc-line)" }}>
      {thumb}
      {body}
    </div>
  );

  if (locked) return inner;
  if (external) {
    return (
      <a href={session.recordingUrl} target="_blank" rel="noopener noreferrer" className="block text-left">
        {inner}
      </a>
    );
  }
  if (clickable) {
    return (
      <button onClick={onWatch} className="block w-full text-left">
        {inner}
      </button>
    );
  }
  return inner;
}

// ── empty note ──
function EmptyNote({ title, body, action }: { title: string; body: string; action?: React.ReactNode }) {
  return (
    <Card className="p-4">
      <p className="cc-display text-[16px]" style={{ color: "var(--cc-ink)" }}>{title}</p>
      <p className="mt-1.5 max-w-md text-[13px] leading-relaxed" style={{ color: "var(--cc-soft)" }}>{body}</p>
      {action && <div className="mt-3">{action}</div>}
    </Card>
  );
}

type View = "schedule" | "replays";

export default function LiveSessionsSurfaceV2() {
  const supabase = createClient();
  const [view, setView] = useState<View>("schedule");
  const [viewTouched, setViewTouched] = useState(false);
  const [sessions, setSessions] = useState<LiveSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState("");
  const [familyId, setFamilyId] = useState<string | null>(null);
  const [access, setAccess] = useState<Access>({ isChild: false, userTrack: "adults", tier: "fic", clubLapsed: false });
  const [watching, setWatching] = useState<LiveSession | null>(null);
  const [rsvpInfo, setRsvpInfo] = useState<Record<string, { count: number; going: boolean }>>({});
  const [roster, setRoster] = useState<Record<string, RosterMember[]>>({});
  const nowHour = useSyncExternalStore(CLOCK_SUBSCRIBE, CLOCK_CLIENT, CLOCK_SERVER);
  const reduceMotion = useReducedMotion();

  // ── loads (verbatim behaviour from v1) ──
  const loadRsvps = useCallback(
    async (uid: string) => {
      const { data } = await supabase.from("session_rsvps").select("session_id, user_id, family_id");
      const rows = (data as { session_id: string; user_id: string; family_id: string | null }[]) || [];
      const map: Record<string, { fams: Set<string>; going: boolean }> = {};
      const bySession: Record<string, string[]> = {};
      rows.forEach((r) => {
        const e = map[r.session_id] || { fams: new Set<string>(), going: false };
        if (r.family_id) e.fams.add(r.family_id);
        else e.fams.add(r.user_id);
        if (r.user_id === uid) e.going = true;
        map[r.session_id] = e;
        (bySession[r.session_id] ||= []).push(r.user_id);
      });
      const out: Record<string, { count: number; going: boolean }> = {};
      Object.entries(map).forEach(([k, v]) => {
        out[k] = { count: v.fams.size, going: v.going };
      });
      setRsvpInfo(out);

      const ids = Array.from(new Set(rows.map((r) => r.user_id)));
      if (ids.length === 0) {
        setRoster({});
        return;
      }
      const { data: people } = await supabase.from("profiles").select("id, display_name").in("id", ids.slice(0, 200));
      const nameOf = new Map<string, string>();
      ((people as { id: string; display_name: string | null }[]) || []).forEach((p) => {
        if (p.display_name) nameOf.set(p.id, p.display_name);
      });
      const rosterOut: Record<string, RosterMember[]> = {};
      Object.entries(bySession).forEach(([sid, uids]) => {
        rosterOut[sid] = uids
          .filter((id) => nameOf.has(id))
          .map((id) => {
            const name = nameOf.get(id)!;
            return { id, name, initials: initialsOf(name) };
          });
      });
      setRoster(rosterOut);
    },
    [supabase],
  );

  const toggleRsvp = useCallback(
    async (sessionId: string) => {
      if (!userId) return;
      const going = rsvpInfo[sessionId]?.going;
      if (going) {
        await supabase.from("session_rsvps").delete().eq("session_id", sessionId).eq("user_id", userId);
      } else {
        await supabase.from("session_rsvps").insert({ session_id: sessionId, user_id: userId, family_id: familyId });
        const already = await hasXpForRef(supabase, userId, "rsvp", sessionId);
        if (!already) await awardXp(supabase, userId, "rsvp", XP.RSVP, sessionId);
        if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent("fic:notify-intent"));
      }
      await loadRsvps(userId);
    },
    [supabase, userId, familyId, rsvpInfo, loadRsvps],
  );

  const loadSessions = useCallback(async () => {
    const { data } = await supabase.from("live_sessions").select("*").order("scheduled_at", { ascending: true });
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
          host_name?: string | null;
          host_title?: string | null;
          host_avatar_url?: string | null;
        }) => ({
          id: s.id,
          title: s.title,
          description: s.description || "",
          host: s.host_name || null,
          hostTitle: s.host_title || null,
          hostAvatarUrl: s.host_avatar_url || null,
          scheduledIso: s.scheduled_at,
          durationMin: s.duration_min || 45,
          track: (s.track as Track) || "all",
          status: s.status === "scheduled" ? "upcoming" : (s.status as "live" | "upcoming" | "completed"),
          minTier: (s.min_tier as "challenge" | "academy") || "challenge",
          zoomUrl: s.zoom_join_url || undefined,
          recordingUrl: s.recording_url || undefined,
          recordingPath: s.recording_path || undefined,
          recordingKind: resolveRecordingKind(s),
        }),
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
      const { data: { session } } = await supabase.auth.getSession();
      const user = session?.user;
      if (!user) return;
      setUserId(user.id);
      const rsvpsP = loadRsvps(user.id);
      const { data: profile } = await supabase
        .from("profiles")
        .select("role, age_group, track, family_id")
        .eq("id", user.id)
        .single();
      const userTrack = (profile?.age_group || profile?.track || "adults") as Track;
      const isChild = profile?.role === "child";
      setFamilyId(profile?.family_id ?? null);
      const { tier, clubLapsed } = await getFamilyTierState(supabase, profile?.family_id);
      setAccess({ isChild, userTrack, tier, clubLapsed });
      await rsvpsP;
    }
    loadUser();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── gating (verbatim from v1) ──
  const isTrackLocked = (track: Track) => access.isChild && track !== "all" && track !== access.userTrack;
  const isTierLocked = (session: LiveSession) => !canAccessSessionEffective(access.tier, access.clubLapsed, session.minTier);
  const sessionLock = (session: LiveSession) => {
    if (isTrackLocked(session.track)) return { locked: true, reason: TRACK_LABEL[session.track] };
    if (isTierLocked(session)) return { locked: true, reason: "FTA members" };
    return { locked: false, reason: undefined as string | undefined };
  };

  const liveSession = sessions.find((s) => s.status === "live");
  const liveLock = liveSession ? sessionLock(liveSession) : null;
  const liveShown = liveSession && !liveLock?.locked ? liveSession : null;

  const upcoming = sessions.filter(
    (s) =>
      s.status === "upcoming" &&
      (nowHour == null || !s.scheduledIso || new Date(s.scheduledIso).getTime() + s.durationMin * 60_000 >= nowHour * HOUR_MS),
  );
  const recordings = sessions
    .filter((s) => s.status === "completed")
    .sort((a, b) => new Date(b.scheduledIso || 0).getTime() - new Date(a.scheduledIso || 0).getTime());

  // land on first non-empty view (until touched)
  useEffect(() => {
    if (loading || viewTouched) return;
    if (!liveSession && upcoming.length === 0 && recordings.length > 0) setView("replays");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, sessions.length]);

  // group upcoming by day
  const dayGroups = (() => {
    const groups: { key: string; label: string; items: LiveSession[] }[] = [];
    for (const s of upcoming) {
      const g = dayGroupOf(s.scheduledIso, nowHour);
      let bucket = groups.find((x) => x.key === g.key);
      if (!bucket) {
        bucket = { key: g.key, label: g.label, items: [] };
        groups.push(bucket);
      }
      bucket.items.push(s);
    }
    return groups;
  })();

  const goTo = (v: View) => {
    setViewTouched(true);
    setView(v);
  };

  const liveCount = liveShown ? 1 : 0;

  if (loading) {
    return (
      <V2Surface className="min-h-screen">
        <div className="mx-auto w-full max-w-2xl px-4 pb-16 pt-6" aria-busy="true">
          <div className="h-9 w-32 animate-pulse rounded-lg" style={{ background: "var(--cc-card2)" }} />
          <div className="mt-5 h-44 animate-pulse rounded-2xl" style={{ background: "var(--cc-card2)" }} />
          <div className="mt-4 space-y-2">
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-20 animate-pulse rounded-2xl" style={{ background: "var(--cc-card2)" }} />
            ))}
          </div>
          <span className="sr-only">Loading the live schedule</span>
        </div>
      </V2Surface>
    );
  }

  return (
    <V2Surface className="min-h-screen">
      <div className="mx-auto w-full max-w-2xl px-4 pb-20 pt-6">
        {/* ── header: script "live" + ON-AIR pill + replay link ────────────── */}
        <m.header
          initial={reduceMotion ? false : { opacity: 0, y: -8 }}
          animate={reduceMotion ? undefined : { opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="flex items-center justify-between gap-3"
        >
          <div className="flex items-center gap-3">
            <ScriptTitle>live</ScriptTitle>
            {liveCount > 0 && (
              <span
                className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 font-[family-name:var(--font-plex-mono)] text-[10px] font-bold uppercase tracking-[0.14em]"
                style={{ background: "var(--cc-orange)", color: "var(--cc-orange-deep)" }}
              >
                <span className="relative flex h-1.5 w-1.5">
                  <span className="cc-ping absolute inline-flex h-full w-full rounded-full bg-current opacity-70" />
                  <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-current" />
                </span>
                {liveCount} on air
              </span>
            )}
          </div>
          <button
            type="button"
            onClick={() => goTo(view === "replays" ? "schedule" : "replays")}
            className="shrink-0 text-[12px] font-semibold"
            style={{ color: "var(--cc-orange-ink)" }}
          >
            {view === "replays" ? "Schedule ›" : "Replay library ›"}
          </button>
        </m.header>

        {/* entitlement line (honest, from real tier) */}
        <p className="mt-2 max-w-xl text-[12.5px] leading-relaxed" style={{ color: "var(--cc-soft)" }}>
          {access.isChild ? (
            <>Your track: {TRACK_LABEL[access.userTrack] || access.userTrack}, plus every whole-family session.</>
          ) : access.tier === "fta" ? (
            <>FTA member — every class and every recording is open to you.</>
          ) : (
            <>
              Family classes are open to you. Sessions marked{" "}
              <span className="font-semibold" style={{ color: "var(--cc-orange-ink)" }}>FTA</span>{" "}
              are part of the 6-week live program.{" "}
              <Link href="/upgrade" className="font-semibold" style={{ color: "var(--cc-orange-ink)" }}>
                Join the next cohort →
              </Link>
            </>
          )}
        </p>

        {/* ── SCHEDULE view ────────────────────────────────────────────────── */}
        {view === "schedule" && (
          <div className="mt-5 space-y-6">
            {liveShown ? (
              <OnAirHero
                session={liveShown}
                rosterTotal={rsvpInfo[liveShown.id]?.count ?? 0}
                roster={roster[liveShown.id] ?? []}
              />
            ) : liveSession && liveLock?.locked ? (
              <EmptyNote
                title={isTierLocked(liveSession) ? "Part of the FTA 6-week program" : `Reserved for the ${TRACK_LABEL[liveSession.track]} track`}
                body="A class is on air right now, but this one isn't part of your membership."
                action={
                  isTierLocked(liveSession) ? (
                    <Link href="/upgrade" className="text-[13px] font-semibold" style={{ color: "var(--cc-orange-ink)" }}>
                      Join the next cohort →
                    </Link>
                  ) : undefined
                }
              />
            ) : null}

            {dayGroups.length === 0 && !liveShown ? (
              <EmptyNote
                title="The room is quiet right now"
                body="When a class goes live it takes over this page. New sessions are posted here as they're scheduled, with the host and the time on the record."
                action={
                  recordings.length > 0 ? (
                    <button onClick={() => goTo("replays")} className="text-[13px] font-semibold" style={{ color: "var(--cc-orange-ink)" }}>
                      Watch a recording →
                    </button>
                  ) : undefined
                }
              />
            ) : (
              dayGroups.map((group) => (
                <section key={group.key}>
                  <div className="mb-2">
                    <Kicker tone={group.key === "today" ? "orange" : "soft"}>{group.label}</Kicker>
                  </div>
                  <div className="space-y-2">
                    {group.items.map((session) => {
                      const lock = sessionLock(session);
                      return (
                        <ScheduleRow
                          key={session.id}
                          session={session}
                          locked={lock.locked}
                          lockReason={lock.reason}
                          rsvp={rsvpInfo[session.id]}
                          onRsvp={lock.locked ? undefined : () => toggleRsvp(session.id)}
                        />
                      );
                    })}
                  </div>
                </section>
              ))
            )}
          </div>
        )}

        {/* ── REPLAYS view (board L2) ──────────────────────────────────────── */}
        {view === "replays" && (
          <div className="mt-5 space-y-5">
            {recordings.length === 0 ? (
              <EmptyNote
                title="The shelf is empty"
                body="Every live class lands here once it's been processed. Nothing is hidden behind this screen."
              />
            ) : (
              <>
                <div className="grid grid-cols-2 gap-3">
                  {recordings.map((session) => {
                    const lock = sessionLock(session);
                    return (
                      <ReplayCard
                        key={session.id}
                        session={session}
                        locked={lock.locked}
                        lockReason={lock.reason}
                        onWatch={lock.locked ? undefined : () => setWatching(session)}
                      />
                    );
                  })}
                </div>

                {/* upsell — REAL entitlement copy (not the canvas's $99/mo vault) */}
                {access.tier !== "fta" && !access.isChild && (
                  <Card
                    className="cc-halo-soft flex items-center gap-3 p-4"
                    style={{ background: "linear-gradient(140deg,#241009 0%,var(--cc-card) 62%)", borderColor: "var(--cc-orange)" }}
                  >
                    <span className="shrink-0 text-[20px]" aria-hidden>🔓</span>
                    <div className="min-w-0 flex-1">
                      <p className="text-[13px] font-semibold" style={{ color: "var(--cc-ink)" }}>
                        FTA sessions + their recordings
                      </p>
                      <p className="mt-0.5 text-[12px] leading-relaxed" style={{ color: "var(--cc-soft)" }}>
                        The 6-week live program unlocks every FTA class and its replay.
                      </p>
                    </div>
                    <Link
                      href="/upgrade"
                      className="shrink-0 rounded-full px-4 py-2 text-[13px] font-bold"
                      style={{ background: "var(--cc-orange)", color: "var(--cc-orange-deep)" }}
                    >
                      Join
                    </Link>
                  </Card>
                )}

                <p className="font-[family-name:var(--font-plex-mono)] text-[10px] uppercase tracking-[0.1em]" style={{ color: "var(--cc-dim)" }}>
                  Every live class is posted here after it airs.
                </p>
              </>
            )}
          </div>
        )}
      </div>

      {watching && (
        <RecordingPlayerModal
          session={{
            id: watching.id,
            title: watching.title,
            durationMin: watching.durationMin,
            recordingKind: watching.recordingKind,
            recordingUrl: watching.recordingUrl,
            recordingPath: watching.recordingPath,
            scheduledAt: watching.scheduledIso ?? "",
            trackLabel: TRACK_LABEL[watching.track],
          }}
          userId={userId}
          onClose={() => setWatching(null)}
        />
      )}
    </V2Surface>
  );
}
