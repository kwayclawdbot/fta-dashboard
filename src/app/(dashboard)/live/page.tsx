"use client";

import { motion } from "framer-motion";
import {
  Video,
  Calendar,
  Clock,
  User,
  ExternalLink,
  Play,
  ChevronRight,
} from "lucide-react";

// --- Placeholder data ---

interface LiveSessionData {
  id: string;
  title: string;
  description?: string;
  hostName: string;
  scheduledAt: string;
  durationMinutes: number;
  joinUrl?: string;
  recordingUrl?: string;
  status: "scheduled" | "live" | "completed";
}

const UPCOMING_SESSIONS: LiveSessionData[] = [
  {
    id: "s1",
    title: "Market Open Walkthrough",
    description:
      "Watch how we analyze pre-market data and plan our trades for the day. Live Q&A included.",
    hostName: "Coach K",
    scheduledAt: "2026-03-14T14:30:00Z",
    durationMinutes: 60,
    joinUrl: "#",
    status: "scheduled",
  },
  {
    id: "s2",
    title: "Options Strategy Deep Dive",
    description:
      "Covering credit spreads, iron condors, and when to use each strategy.",
    hostName: "Coach K",
    scheduledAt: "2026-03-17T18:00:00Z",
    durationMinutes: 90,
    joinUrl: "#",
    status: "scheduled",
  },
  {
    id: "s3",
    title: "Family Trading Q&A Session",
    description: "Bring your questions. No topic is off limits.",
    hostName: "Coach K",
    scheduledAt: "2026-03-21T15:00:00Z",
    durationMinutes: 45,
    joinUrl: "#",
    status: "scheduled",
  },
];

const PAST_SESSIONS: LiveSessionData[] = [
  {
    id: "p1",
    title: "Chart Reading Masterclass",
    hostName: "Coach K",
    scheduledAt: "2026-03-07T14:30:00Z",
    durationMinutes: 75,
    recordingUrl: "#",
    status: "completed",
  },
  {
    id: "p2",
    title: "Risk Management Workshop",
    hostName: "Coach K",
    scheduledAt: "2026-03-03T18:00:00Z",
    durationMinutes: 60,
    recordingUrl: "#",
    status: "completed",
  },
];

function formatDate(dateStr: string) {
  const date = new Date(dateStr);
  return date.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

function formatTime(dateStr: string) {
  const date = new Date(dateStr);
  return date.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

function formatDuration(minutes: number) {
  if (minutes < 60) return `${minutes}min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m > 0 ? `${h}h ${m}min` : `${h}h`;
}

export default function LiveSessionsPage() {
  return (
    <div className="max-w-4xl mx-auto space-y-10">
      {/* Page title */}
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
      >
        <h1 className="font-display text-2xl font-bold text-midnight-100">
          Live Sessions
        </h1>
        <p className="text-sm text-midnight-400 font-body mt-1">
          Join live coaching sessions and watch past recordings
        </p>
      </motion.div>

      {/* Upcoming dates row */}
      {UPCOMING_SESSIONS.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.1 }}
          className="flex gap-3 overflow-x-auto pb-1"
        >
          {UPCOMING_SESSIONS.map((session) => (
            <a
              key={session.id}
              href={`#session-${session.id}`}
              className="shrink-0 flex flex-col items-center px-4 py-3 rounded-lg border border-midnight-800 hover:border-gold-400/20 transition-colors"
            >
              <span className="text-xs text-midnight-500 font-body uppercase">
                {new Date(session.scheduledAt).toLocaleDateString("en-US", {
                  weekday: "short",
                })}
              </span>
              <span className="text-lg font-display font-bold text-midnight-100">
                {new Date(session.scheduledAt).getDate()}
              </span>
              <span className="text-xs text-midnight-500 font-body">
                {new Date(session.scheduledAt).toLocaleDateString("en-US", {
                  month: "short",
                })}
              </span>
            </a>
          ))}
        </motion.div>
      )}

      {/* Upcoming sessions */}
      <motion.section
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.15 }}
      >
        <h2 className="font-display text-lg font-semibold text-midnight-100 mb-4">
          Upcoming
        </h2>

        {UPCOMING_SESSIONS.length === 0 ? (
          <div className="py-10 text-center border border-midnight-800 rounded-lg">
            <Calendar className="w-8 h-8 text-midnight-600 mx-auto mb-3" />
            <p className="text-sm text-midnight-400 font-body">
              No upcoming sessions scheduled
            </p>
            <p className="text-xs text-midnight-600 font-body mt-1">
              Check back soon for new live sessions
            </p>
          </div>
        ) : (
          <div className="space-y-0">
            {UPCOMING_SESSIONS.map((session, i) => (
              <div
                key={session.id}
                id={`session-${session.id}`}
                className="flex flex-col sm:flex-row sm:items-center gap-4 py-5 border-b border-midnight-800/50 last:border-0"
              >
                {/* Date/time */}
                <div className="sm:w-32 shrink-0">
                  <p className="text-sm font-display font-semibold text-midnight-200">
                    {formatDate(session.scheduledAt)}
                  </p>
                  <p className="text-xs text-midnight-500 font-body flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {formatTime(session.scheduledAt)}
                  </p>
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <h3 className="text-sm font-display font-semibold text-midnight-100">
                    {session.title}
                  </h3>
                  {session.description && (
                    <p className="text-xs text-midnight-400 font-body mt-1 line-clamp-2">
                      {session.description}
                    </p>
                  )}
                  <div className="flex items-center gap-3 mt-2 text-xs text-midnight-500 font-body">
                    <span className="flex items-center gap-1">
                      <User className="w-3 h-3" />
                      {session.hostName}
                    </span>
                    <span>{formatDuration(session.durationMinutes)}</span>
                  </div>
                </div>

                {/* Join button */}
                <div className="shrink-0">
                  {session.status === "live" ? (
                    <a
                      href={session.joinUrl}
                      className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-red-500 text-white text-sm font-display font-semibold hover:bg-red-400 transition-colors"
                    >
                      <span className="w-2 h-2 rounded-full bg-white animate-pulse" />
                      Join Live
                    </a>
                  ) : (
                    <a
                      href={session.joinUrl}
                      className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-gold-400/20 text-gold-400 text-sm font-body hover:bg-gold-400/5 transition-colors"
                    >
                      <Calendar className="w-3.5 h-3.5" />
                      Set Reminder
                    </a>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </motion.section>

      {/* Past recordings */}
      <motion.section
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.2 }}
      >
        <h2 className="font-display text-lg font-semibold text-midnight-100 mb-4">
          Past Recordings
        </h2>

        {PAST_SESSIONS.length === 0 ? (
          <div className="py-10 text-center border border-midnight-800 rounded-lg">
            <Video className="w-8 h-8 text-midnight-600 mx-auto mb-3" />
            <p className="text-sm text-midnight-400 font-body">
              No recordings available yet
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {PAST_SESSIONS.map((session) => (
              <a
                key={session.id}
                href={session.recordingUrl || "#"}
                className="group block"
              >
                {/* Thumbnail placeholder */}
                <div className="relative aspect-video bg-midnight-900 rounded-lg overflow-hidden border border-midnight-800 group-hover:border-midnight-700 transition-colors mb-2">
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="w-10 h-10 rounded-full bg-midnight-800 flex items-center justify-center group-hover:bg-gold-400/20 transition-colors">
                      <Play className="w-4 h-4 text-midnight-400 group-hover:text-gold-400 ml-0.5 transition-colors" />
                    </div>
                  </div>
                  {/* Duration badge */}
                  <div className="absolute bottom-2 right-2 px-2 py-0.5 rounded bg-midnight-950/80 text-xs text-midnight-300 font-body">
                    {formatDuration(session.durationMinutes)}
                  </div>
                </div>
                <h3 className="text-sm font-body text-midnight-200 group-hover:text-midnight-100 transition-colors">
                  {session.title}
                </h3>
                <p className="text-xs text-midnight-500 font-body mt-0.5">
                  {session.hostName} &middot;{" "}
                  {formatDate(session.scheduledAt)}
                </p>
              </a>
            ))}
          </div>
        )}
      </motion.section>
    </div>
  );
}
