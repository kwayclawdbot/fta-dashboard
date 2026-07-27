"use client";

import { useEffect, useRef, useState } from "react";
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
 *
 * CANVAS V2 PASS. Two things were wrong beyond styling:
 *
 * 1. It wrote against the RAW `midnight-*` ramp (bg-midnight-900,
 *    text-midnight-100, text-midnight-500…). That ramp INVERTS between themes,
 *    so the player described a dark app that no longer exists — the same defect
 *    the help surface was rebuilt off. A video player legitimately wants dark
 *    chrome, so it now pins the constant `night-*` stops rather than borrowing a
 *    ramp that flips underneath it.
 *
 * 2. It was a modal with NO keyboard escape and no focus containment: the only
 *    way out was a mouse click on the scrim or the ✕. Escape now closes it and
 *    the dialog takes focus on open, which is the minimum for a full-screen
 *    overlay. It is also correctly announced (role="dialog" + aria-modal +
 *    aria-labelledby) — it previously announced as nothing at all.
 *
 * Body scroll is locked while it is open, so the page behind cannot scroll away
 * under the video.
 *
 * THE XP WRITE IS UNTOUCHED: still `hasXpForRef(..., "bonus", "recording:<id>")`
 * guarding a single `awardXp(..., "bonus", XP.RECORDING, ref)` in the same
 * effect, with the same cancellation guard.
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
  const dialogRef = useRef<HTMLDivElement>(null);

  // Escape to close + body-scroll lock + initial focus. A full-screen overlay
  // with no keyboard exit is a trap; this is the minimum contract for one.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    dialogRef.current?.focus();
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [onClose]);

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
    <div
      className="bg-scrim fixed inset-0 z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <m.div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="recording-player-title"
        tabIndex={-1}
        initial={{ opacity: 0, scale: 0.97 }}
        animate={{ opacity: 1, scale: 1 }}
        className="w-full max-w-3xl overflow-hidden rounded-2xl bg-night-950 shadow-lift focus:outline-none"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-3 border-b border-night-800 px-4 py-3">
          <div className="flex min-w-0 items-center gap-2.5">
            <Play className="h-3.5 w-3.5 shrink-0 text-accent" aria-hidden />
            <h3
              id="recording-player-title"
              className="truncate font-display text-[14px] font-extrabold uppercase tracking-[0.06em] text-night-50"
            >
              {session.title}
            </h3>
          </div>
          <button
            onClick={onClose}
            className="f0-focus f0-press shrink-0 rounded-lg p-1.5 text-night-300 transition-colors hover:text-night-50"
            aria-label="Close player"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="aspect-video bg-night-950">
          {session.recordingKind === "upload" ? (
            error ? (
              <div className="flex h-full w-full items-center justify-center px-6">
                <p className="text-center text-sm text-night-300">{error}</p>
              </div>
            ) : videoUrl ? (
              <video src={videoUrl} controls autoPlay playsInline className="w-full h-full" />
            ) : (
              /* LOADING ≠ EMPTY (§0.4): a signed URL is being minted, which is
                 a genuine wait, and it is labelled as one rather than left as a
                 bare spinner that could equally mean "nothing to play". */
              <div className="flex h-full w-full flex-col items-center justify-center gap-3">
                <div className="h-6 w-6 animate-spin rounded-full border-2 border-night-700 border-t-accent" />
                <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-night-300">
                  Opening the recording
                </p>
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
            <div className="flex h-full w-full items-center justify-center px-6">
              <p className="text-center text-sm text-night-300">This recording can&apos;t be played in-app.</p>
            </div>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 px-4 py-3 font-mono text-[10px] uppercase tracking-[0.14em] text-night-300">
          <span className="flex items-center gap-1.5">
            <Clock className="h-3 w-3" />
            {session.durationMin} min
          </span>
          {session.trackLabel && <span className="text-accent">{session.trackLabel}</span>}
          {session.scheduledAt && <span>Recorded {session.scheduledAt}</span>}
        </div>
      </m.div>
    </div>
  );
}
