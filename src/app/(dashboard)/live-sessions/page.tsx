"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Video,
  Play,
  Clock,
  Calendar,
  Lock,
  Users,
  MessageCircle,
  Mic,
  MicOff,
  VideoOff,
  Monitor,
  Hand,
  ChevronDown,
  ExternalLink,
  BookOpen,
  Filter,
} from "lucide-react";
import Link from "next/link";

// ── Types ──

type Track = "stocks-options" | "forex" | "futures" | "crypto" | "all";

interface LiveSession {
  id: string;
  title: string;
  description: string;
  host: string;
  hostAvatar: string;
  scheduledAt: string;
  scheduledDate: string;
  durationMin: number;
  track: Track;
  status: "live" | "upcoming" | "completed";
  attendees?: number;
  maxAttendees?: number;
  zoomUrl?: string;
  recordingId?: string;
  thumbnail?: string;
  tags: string[];
}

// ── Track Config ──

const TRACK_CONFIG: Record<Track, { label: string; color: string; bgColor: string }> = {
  "stocks-options": { label: "Stocks & Options", color: "text-blue-400", bgColor: "bg-blue-400/10" },
  forex: { label: "Forex", color: "text-emerald-400", bgColor: "bg-emerald-400/10" },
  futures: { label: "Futures", color: "text-purple-400", bgColor: "bg-purple-400/10" },
  crypto: { label: "Crypto", color: "text-orange-400", bgColor: "bg-orange-400/10" },
  all: { label: "All Tracks", color: "text-midnight-300", bgColor: "bg-midnight-700/50" },
};

// User's purchased tracks (mock — would come from Supabase enrollment data)
const USER_TRACKS: Track[] = ["stocks-options"];

// ── Mock Data ──

const MOCK_SESSIONS: LiveSession[] = [
  // LIVE NOW
  {
    id: "s1",
    title: "Weekly Market Breakdown: What to Watch This Week",
    description: "Live analysis of the week's key chart setups, earnings plays, and macro events. Bring your questions!",
    host: "Coach Marcus",
    hostAvatar: "CM",
    scheduledAt: "LIVE NOW",
    scheduledDate: "Today",
    durationMin: 60,
    track: "stocks-options",
    status: "live",
    attendees: 34,
    maxAttendees: 100,
    zoomUrl: "#",
    tags: ["Weekly Review", "Q&A", "Chart Analysis"],
  },
  // UPCOMING
  {
    id: "s2",
    title: "5-Day Challenge: Stocks & Options Fundamentals — Day 3",
    description: "Reading candlestick patterns and identifying support/resistance on real charts. Paper trade assignment included.",
    host: "Coach Marcus",
    hostAvatar: "CM",
    scheduledAt: "Tomorrow, 7:00 PM ET",
    scheduledDate: "Mar 13",
    durationMin: 45,
    track: "stocks-options",
    status: "upcoming",
    tags: ["5-Day Challenge", "Candlesticks", "Hands-on"],
  },
  {
    id: "s3",
    title: "Forex Fundamentals: Understanding Currency Pairs",
    description: "Deep dive into major, minor, and exotic pairs. Learn how to read forex quotes and calculate pip values.",
    host: "Coach Aisha",
    hostAvatar: "CA",
    scheduledAt: "Thu, 8:00 PM ET",
    scheduledDate: "Mar 14",
    durationMin: 45,
    track: "forex",
    status: "upcoming",
    tags: ["5-Day Challenge", "Currency Pairs", "Beginners"],
  },
  {
    id: "s4",
    title: "Crypto 101: Blockchain & Bitcoin for Families",
    description: "Family-friendly intro to blockchain technology, wallets, and why Bitcoin matters for generational wealth.",
    host: "Coach Devon",
    hostAvatar: "CD",
    scheduledAt: "Fri, 7:00 PM ET",
    scheduledDate: "Mar 15",
    durationMin: 45,
    track: "crypto",
    status: "upcoming",
    tags: ["5-Day Challenge", "Blockchain", "Family"],
  },
  {
    id: "s5",
    title: "Futures Trading: Margin, Leverage & Risk",
    description: "Understanding how futures margin works, calculating position sizes, and managing leverage safely.",
    host: "Coach Marcus",
    hostAvatar: "CM",
    scheduledAt: "Sat, 11:00 AM ET",
    scheduledDate: "Mar 16",
    durationMin: 60,
    track: "futures",
    status: "upcoming",
    tags: ["5-Day Challenge", "Risk Management"],
  },
  // RECORDINGS
  {
    id: "r1",
    title: "5-Day Challenge: Stocks & Options — Day 1: What is the Stock Market?",
    description: "Recording from the first day of the Stocks & Options 5-Day Challenge. Covers market basics and account setup.",
    host: "Coach Marcus",
    hostAvatar: "CM",
    scheduledAt: "Mar 10",
    scheduledDate: "Mar 10",
    durationMin: 48,
    track: "stocks-options",
    status: "completed",
    recordingId: "rec_001",
    attendees: 67,
    tags: ["5-Day Challenge", "Day 1", "Fundamentals"],
  },
  {
    id: "r2",
    title: "5-Day Challenge: Stocks & Options — Day 2: How Markets Move",
    description: "Understanding supply & demand, order flow, and why prices move. Plus: intro to chart types.",
    host: "Coach Marcus",
    hostAvatar: "CM",
    scheduledAt: "Mar 11",
    scheduledDate: "Mar 11",
    durationMin: 52,
    track: "stocks-options",
    status: "completed",
    recordingId: "rec_002",
    attendees: 58,
    tags: ["5-Day Challenge", "Day 2", "Price Action"],
  },
  {
    id: "r3",
    title: "Forex Fundamentals: What is Forex? (Recording)",
    description: "Intro session covering the forex market structure, trading sessions, and why forex is the largest market.",
    host: "Coach Aisha",
    hostAvatar: "CA",
    scheduledAt: "Mar 9",
    scheduledDate: "Mar 9",
    durationMin: 44,
    track: "forex",
    status: "completed",
    recordingId: "rec_003",
    attendees: 41,
    tags: ["5-Day Challenge", "Day 1", "Forex Basics"],
  },
  {
    id: "r4",
    title: "Crypto for Families: Getting Started Safely",
    description: "How to set up wallets, buy your first crypto, and avoid common scams. Family security checklist included.",
    host: "Coach Devon",
    hostAvatar: "CD",
    scheduledAt: "Mar 8",
    scheduledDate: "Mar 8",
    durationMin: 51,
    track: "crypto",
    status: "completed",
    recordingId: "rec_004",
    attendees: 35,
    tags: ["5-Day Challenge", "Day 1", "Security"],
  },
];

// ── Components ──

function TrackBadge({ track }: { track: Track }) {
  const cfg = TRACK_CONFIG[track];
  return (
    <span className={`text-[10px] font-mono font-bold uppercase tracking-wider px-1.5 py-0.5 rounded ${cfg.color} ${cfg.bgColor}`}>
      {cfg.label}
    </span>
  );
}

function HostAvatar({ initials }: { initials: string }) {
  return (
    <div className="w-8 h-8 rounded-full bg-gold-400/20 text-gold-400 ring-1 ring-gold-400/30 flex items-center justify-center text-[10px] font-display font-bold shrink-0">
      {initials}
    </div>
  );
}

function LiveRoom({ session }: { session: LiveSession }) {
  const [muted, setMuted] = useState(true);
  const [videoOn, setVideoOn] = useState(false);
  const [handRaised, setHandRaised] = useState(false);
  const [chatOpen, setChatOpen] = useState(true);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="rounded-lg border border-red-500/30 bg-midnight-900/60 overflow-hidden"
    >
      {/* Live indicator bar */}
      <div className="flex items-center justify-between px-4 py-2 bg-red-500/10 border-b border-red-500/20">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
          <span className="text-xs font-mono font-bold text-red-400 uppercase">Live Now</span>
          <span className="text-[10px] font-mono text-midnight-400">|</span>
          <TrackBadge track={session.track} />
        </div>
        <div className="flex items-center gap-2 text-[10px] font-mono text-midnight-400">
          <Users className="w-3 h-3" />
          {session.attendees}/{session.maxAttendees}
        </div>
      </div>

      <div className="flex flex-col lg:flex-row">
        {/* Video area */}
        <div className="flex-1 min-w-0">
          <div className="relative aspect-video bg-midnight-950">
            {/* Simulated Zoom-style view */}
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="text-center">
                <div className="w-20 h-20 rounded-full bg-gold-400/20 text-gold-400 ring-2 ring-gold-400/30 flex items-center justify-center text-2xl font-display font-bold mx-auto mb-3">
                  {session.hostAvatar}
                </div>
                <p className="text-sm font-display font-semibold text-midnight-100">{session.host}</p>
                <p className="text-[10px] text-midnight-500 font-mono mt-1">Speaking...</p>
              </div>
            </div>

            {/* Self view (small) */}
            <div className="absolute bottom-3 right-3 w-32 h-24 rounded-lg bg-midnight-800 border border-midnight-700 flex items-center justify-center">
              {videoOn ? (
                <p className="text-[10px] text-midnight-500 font-mono">Camera On</p>
              ) : (
                <div className="text-center">
                  <div className="w-8 h-8 rounded-full bg-midnight-700 text-midnight-400 flex items-center justify-center text-[10px] font-display font-bold mx-auto">
                    KC
                  </div>
                  <p className="text-[9px] text-midnight-600 font-mono mt-1">You</p>
                </div>
              )}
            </div>

            {/* Participant count overlay */}
            <div className="absolute top-3 left-3 flex items-center gap-1.5 px-2 py-1 rounded bg-midnight-950/80 text-[10px] font-mono text-midnight-300">
              <Users className="w-3 h-3" />
              {session.attendees} watching
            </div>
          </div>

          {/* Controls bar */}
          <div className="flex items-center justify-center gap-2 px-4 py-3 bg-midnight-900/80 border-t border-midnight-800/60">
            <button
              onClick={() => setMuted(!muted)}
              className={`p-2.5 rounded-full transition-colors ${muted ? "bg-red-500/20 text-red-400" : "bg-midnight-700 text-midnight-200"}`}
            >
              {muted ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
            </button>
            <button
              onClick={() => setVideoOn(!videoOn)}
              className={`p-2.5 rounded-full transition-colors ${!videoOn ? "bg-red-500/20 text-red-400" : "bg-midnight-700 text-midnight-200"}`}
            >
              {videoOn ? <Video className="w-4 h-4" /> : <VideoOff className="w-4 h-4" />}
            </button>
            <button className="p-2.5 rounded-full bg-midnight-700 text-midnight-200 hover:bg-midnight-600 transition-colors">
              <Monitor className="w-4 h-4" />
            </button>
            <button
              onClick={() => setHandRaised(!handRaised)}
              className={`p-2.5 rounded-full transition-colors ${handRaised ? "bg-gold-400/20 text-gold-400" : "bg-midnight-700 text-midnight-200"}`}
            >
              <Hand className="w-4 h-4" />
            </button>
            <button
              onClick={() => setChatOpen(!chatOpen)}
              className={`p-2.5 rounded-full transition-colors ${chatOpen ? "bg-gold-400/20 text-gold-400" : "bg-midnight-700 text-midnight-200"}`}
            >
              <MessageCircle className="w-4 h-4" />
            </button>
            <div className="w-px h-6 bg-midnight-700 mx-1" />
            <button className="px-4 py-2 rounded-full bg-red-500 text-white text-xs font-display font-semibold hover:bg-red-400 transition-colors">
              Leave
            </button>
          </div>
        </div>

        {/* Chat sidebar */}
        <AnimatePresence>
          {chatOpen && (
            <motion.div
              initial={{ width: 0, opacity: 0 }}
              animate={{ width: 300, opacity: 1 }}
              exit={{ width: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="border-l border-midnight-800/60 flex flex-col overflow-hidden shrink-0"
              style={{ height: "calc(100%)" }}
            >
              <div className="px-3 py-2.5 border-b border-midnight-800/60">
                <p className="text-xs font-mono font-bold text-midnight-300 uppercase">Live Chat</p>
              </div>
              <div className="flex-1 overflow-y-auto p-3 space-y-2.5">
                {[
                  { name: "Sarah T.", msg: "Can you zoom in on that AAPL chart?", time: "2m" },
                  { name: "Coach Marcus", msg: "Sure, let me pull that up...", time: "2m", coach: true },
                  { name: "Mike D.", msg: "That hammer on the daily is textbook", time: "1m" },
                  { name: "Kway Jr", msg: "Is that a doji on the 4hr?", time: "1m" },
                  { name: "Coach Marcus", msg: "Great eye! Yes, that's a dragonfly doji. Notice the long lower wick.", time: "30s", coach: true },
                  { name: "Ava D.", msg: "This is so cool, learning so much!", time: "10s" },
                ].map((chat, i) => (
                  <div key={i} className="flex gap-2">
                    <span className={`text-[10px] font-mono font-bold shrink-0 ${chat.coach ? "text-gold-400" : "text-midnight-400"}`}>
                      {chat.name}
                    </span>
                    <p className="text-[11px] font-body text-midnight-300 flex-1">{chat.msg}</p>
                  </div>
                ))}
              </div>
              <div className="p-2 border-t border-midnight-800/60">
                <input
                  type="text"
                  placeholder="Type a message..."
                  className="w-full bg-midnight-800/50 border border-midnight-700/50 rounded px-3 py-1.5 text-xs text-midnight-200 placeholder:text-midnight-600 font-body focus:outline-none focus:border-gold-400/40"
                />
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Session info */}
      <div className="px-4 py-3 border-t border-midnight-800/60">
        <h3 className="font-display text-sm font-semibold text-midnight-100">{session.title}</h3>
        <p className="text-xs text-midnight-400 font-body mt-1">{session.description}</p>
      </div>
    </motion.div>
  );
}

function SessionCard({ session, locked }: { session: LiveSession; locked: boolean }) {
  const isRecording = session.status === "completed";

  return (
    <div className={`rounded-lg border bg-midnight-900/40 p-4 transition-colors ${
      locked ? "border-midnight-800/40 opacity-50" : "border-midnight-800/60 hover:border-midnight-700"
    }`}>
      <div className="flex items-start gap-3">
        <HostAvatar initials={session.hostAvatar} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <TrackBadge track={session.track} />
            {session.tags.slice(0, 2).map((tag) => (
              <span key={tag} className="text-[9px] font-mono text-midnight-500 bg-midnight-800/50 px-1.5 py-0.5 rounded">{tag}</span>
            ))}
          </div>
          <h4 className="font-display text-sm font-semibold text-midnight-100 mb-0.5">{session.title}</h4>
          <p className="text-xs text-midnight-500 font-body line-clamp-2">{session.description}</p>
          <div className="flex items-center gap-3 mt-2 text-[10px] font-mono text-midnight-500">
            <span className="flex items-center gap-1">
              {isRecording ? <Play className="w-3 h-3" /> : <Calendar className="w-3 h-3" />}
              {session.scheduledAt}
            </span>
            <span className="flex items-center gap-1">
              <Clock className="w-3 h-3" />
              {session.durationMin} min
            </span>
            {session.attendees && (
              <span className="flex items-center gap-1">
                <Users className="w-3 h-3" />
                {session.attendees} attended
              </span>
            )}
            <span>{session.host}</span>
          </div>
        </div>
        <div className="shrink-0">
          {locked ? (
            <div className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-midnight-800 text-midnight-500 text-xs font-mono">
              <Lock className="w-3 h-3" />
              Locked
            </div>
          ) : isRecording ? (
            <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-midnight-800 text-midnight-200 text-xs font-mono hover:bg-midnight-700 transition-colors">
              <Play className="w-3 h-3" />
              Watch
            </button>
          ) : (
            <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gold-400/10 text-gold-400 text-xs font-mono hover:bg-gold-400/20 transition-colors border border-gold-400/20">
              <Calendar className="w-3 h-3" />
              RSVP
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Main Page ──

type TabType = "live" | "upcoming" | "recordings";

export default function LiveSessionsPage() {
  const [tab, setTab] = useState<TabType>("live");
  const [trackFilter, setTrackFilter] = useState<Track>("all");

  const liveSession = MOCK_SESSIONS.find((s) => s.status === "live");
  const upcoming = MOCK_SESSIONS.filter((s) => s.status === "upcoming");
  const recordings = MOCK_SESSIONS.filter((s) => s.status === "completed");

  const filterByTrack = (sessions: LiveSession[]) =>
    trackFilter === "all" ? sessions : sessions.filter((s) => s.track === trackFilter);

  const isTrackLocked = (track: Track) => track !== "all" && !USER_TRACKS.includes(track);

  const tabs: { id: TabType; label: string; count: number }[] = [
    { id: "live", label: "Live Now", count: liveSession ? 1 : 0 },
    { id: "upcoming", label: "Upcoming", count: upcoming.length },
    { id: "recordings", label: "Recordings", count: recordings.length },
  ];

  const trackFilters: Track[] = ["all", "stocks-options", "forex", "futures", "crypto"];

  return (
    <div className="max-w-5xl mx-auto">
      {/* Header */}
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.3 }} className="mb-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="font-display text-2xl font-bold text-midnight-100">Live Sessions</h2>
            <p className="text-midnight-400 text-sm mt-1 font-body">Live Q&A, coaching calls, and 5-Day Challenge sessions</p>
          </div>
          {liveSession && (
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-red-500/10 border border-red-500/20">
              <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
              <span className="text-xs font-mono font-bold text-red-400">1 LIVE NOW</span>
            </div>
          )}
        </div>
      </motion.div>

      {/* Track gating notice */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.05 }}
        className="mb-4 flex items-center gap-3 px-4 py-2.5 rounded-lg border border-midnight-800/60 bg-midnight-900/40 text-xs"
      >
        <BookOpen className="w-4 h-4 text-gold-400 shrink-0" />
        <p className="font-body text-midnight-400">
          <span className="text-midnight-200">Your tracks:</span>{" "}
          {USER_TRACKS.map((t) => TRACK_CONFIG[t].label).join(", ")}.{" "}
          <Link href="/courses" className="text-gold-400 hover:text-gold-300 transition-colors">
            Unlock more tracks
          </Link>
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
                ? "text-gold-400 border-gold-400"
                : "text-midnight-500 border-transparent hover:text-midnight-300"
            }`}
          >
            {t.id === "live" && <div className={`w-1.5 h-1.5 rounded-full ${t.count > 0 ? "bg-red-500 animate-pulse" : "bg-midnight-600"}`} />}
            {t.label}
            {t.count > 0 && (
              <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded-full ${
                tab === t.id ? "bg-gold-400/10 text-gold-400" : "bg-midnight-800 text-midnight-500"
              }`}>
                {t.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Track filter (for upcoming + recordings) */}
      {tab !== "live" && (
        <div className="flex items-center gap-1.5 mb-4">
          <Filter className="w-3.5 h-3.5 text-midnight-500 mr-1" />
          {trackFilters.map((t) => (
            <button
              key={t}
              onClick={() => setTrackFilter(t)}
              className={`px-2.5 py-1 rounded text-[11px] font-mono transition-colors ${
                trackFilter === t
                  ? `${TRACK_CONFIG[t].bgColor} ${TRACK_CONFIG[t].color} border border-current/20`
                  : "text-midnight-500 hover:text-midnight-300"
              }`}
            >
              {TRACK_CONFIG[t].label}
              {isTrackLocked(t) && <Lock className="w-2.5 h-2.5 inline ml-1" />}
            </button>
          ))}
        </div>
      )}

      {/* Content */}
      {tab === "live" && (
        <div>
          {liveSession ? (
            isTrackLocked(liveSession.track) ? (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="rounded-lg border border-midnight-800/60 bg-midnight-900/40 p-8 text-center">
                <Lock className="w-8 h-8 text-midnight-500 mx-auto mb-3" />
                <h3 className="font-display text-lg font-semibold text-midnight-200 mb-1">Session Locked</h3>
                <p className="text-sm text-midnight-400 font-body mb-4">
                  This live session is part of the {TRACK_CONFIG[liveSession.track].label} track.
                </p>
                <Link href="/courses" className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-gold-400 text-midnight-950 text-sm font-display font-semibold hover:bg-gold-300 transition-colors">
                  Unlock Track
                </Link>
              </motion.div>
            ) : (
              <LiveRoom session={liveSession} />
            )
          ) : (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="rounded-lg border border-midnight-800/60 bg-midnight-900/40 p-8 text-center">
              <Video className="w-8 h-8 text-midnight-500 mx-auto mb-3" />
              <h3 className="font-display text-lg font-semibold text-midnight-200 mb-1">No Live Session Right Now</h3>
              <p className="text-sm text-midnight-400 font-body mb-4">Check the upcoming schedule or watch a recording.</p>
              <button onClick={() => setTab("upcoming")} className="text-sm text-gold-400 hover:text-gold-300 font-body transition-colors">
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
              <p className="text-sm text-midnight-400 font-body">No upcoming sessions for this track.</p>
            </div>
          ) : (
            filterByTrack(upcoming).map((session, i) => (
              <motion.div
                key={session.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
              >
                <SessionCard session={session} locked={isTrackLocked(session.track)} />
              </motion.div>
            ))
          )}
        </div>
      )}

      {tab === "recordings" && (
        <div className="space-y-3">
          {filterByTrack(recordings).length === 0 ? (
            <div className="text-center py-8">
              <Play className="w-6 h-6 text-midnight-500 mx-auto mb-2" />
              <p className="text-sm text-midnight-400 font-body">No recordings for this track yet.</p>
            </div>
          ) : (
            filterByTrack(recordings).map((session, i) => (
              <motion.div
                key={session.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
              >
                <SessionCard session={session} locked={isTrackLocked(session.track)} />
              </motion.div>
            ))
          )}
        </div>
      )}

    </div>
  );
}
