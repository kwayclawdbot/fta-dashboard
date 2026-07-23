"use client";

import { useEffect, useState } from "react";
import { m } from "@/lib/motion";
import { Clock, Play, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { XP, awardXp, hasXpForRef } from "@/lib/xp";
import {
  RECORDINGS_BUCKET, SIGNED_URL_TTL, youtubeEmbedUrl, type RecordingKind,
} from "@/lib/recordings";

/**
 * Shared in-app class-recording player, extracted from the live-sessions page so
 * the FTA Recordings hub reuses the exact same signed-URL / youtube-nocookie
 * playback + one-time watch XP (no fork).
 *   upload   → signed URL from the private class-recordings bucket
 *   youtube  → privacy-enhanced youtube-nocookie embed
 */

export interface RecordingPlayable {
  id: string;
  title: string;
  durationMin: number;
  recordingKind: RecordingKind | null;
  recordingUrl?: string;
  recordingPath?: string;
  scheduledAt?: string;
  trackLabel?: string;
}

export default function RecordingPlayerModal({
  session,
  userId,
  onClose,
}: {
  session: RecordingPlayable;
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
      if (userId) {
        const ref = `recording:${session.id}`;
        const already = await hasXpForRef(supabase, userId, "bonus", ref);
        if (!already && !cancelled) {
          await awardXp(supabase, userId, "bonus", XP.RECORDING, ref);
        }
      }
    }
    setup();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session.id]);

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4" onClick={onClose}>
      <m.div
        initial={{ opacity: 0, scale: 0.97 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-midnight-900 rounded-xl border border-midnight-800 shadow-lift w-full max-w-3xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-midnight-800">
          <div className="flex items-center gap-2 min-w-0">
            <Play className="w-4 h-4 text-gold-600 shrink-0" />
            <h3 className="font-display text-sm font-semibold text-midnight-100 truncate">{session.title}</h3>
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
                <p className="text-sm text-midnight-600 font-body text-center">{error}</p>
              </div>
            ) : videoUrl ? (
              <video src={videoUrl} controls autoPlay playsInline className="w-full h-full" />
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
              <p className="text-sm text-midnight-600 font-body text-center">This recording can&apos;t be played in-app.</p>
            </div>
          )}
        </div>

        <div className="px-4 py-3 flex items-center gap-3 text-[11px] text-midnight-500">
          <span className="flex items-center gap-1">
            <Clock className="w-3 h-3" />
            {session.durationMin} min
          </span>
          {session.trackLabel && (
            <span className="px-1.5 py-0.5 rounded bg-gold-400/10 text-gold-700 border border-gold-400/20 font-semibold">
              {session.trackLabel}
            </span>
          )}
          {session.scheduledAt && <span>Recorded {session.scheduledAt}</span>}
        </div>
      </m.div>
    </div>
  );
}
