"use client";

import { useEffect, useRef, useState } from "react";
import { m } from "@/lib/motion";
import { Clock, ListChecks, NotebookText, Play, X } from "lucide-react";
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
 * BOARD 08 REGISTER ("IN THE ROOM"). This is the only in-room/detail state the
 * live surface has, so it wears board 08's near-black ground: the sanctioned
 * `.night-island` (never a paper card — a video player on cream is a hole in the
 * page), a tracked mono `REPLAY` chip where the board puts `• LIVE`, the title in
 * Sora display caps, and the meta line in the board's mono small-caps register.
 *
 * WHY THE `night-*` STOPS STAY. The raw ramps are banned everywhere a semantic
 * token exists, with one carve-out: a deliberate dark island. This is that
 * carve-out. `--ink` / `--soft` / `--sand` INVERT between themes, and a video
 * player's chrome must not — a footer that turns cream-on-black in one theme and
 * black-on-black in the other is exactly the defect this file was rebuilt off
 * once already (it used to write against `midnight-*`). The `night-*` stops are
 * constant in both themes, which is the property this surface needs.
 *
 * KEYBOARD: Escape closes it and the dialog takes focus on open — the minimum for
 * a full-screen overlay. It is correctly announced (role="dialog" + aria-modal +
 * aria-labelledby). Body scroll is locked while it is open, so the page behind
 * cannot scroll away under the video.
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
  /** Class NOTES — multi-paragraph prose (paragraphs split on blank lines). */
  description?: string;
  /** HOMEWORK — a short plain-text list or paragraph; newlines are meaningful. */
  assignment?: string;
}

/**
 * Class NOTES + HOMEWORK for the recording being watched, in the player's own
 * dark (`night-*`) register — a mono small-caps eyebrow matching the meta line,
 * then ivory body copy. NOTES is multi-paragraph prose, split on blank lines so
 * it reads as paragraphs rather than one run-on block. HOMEWORK is a short
 * plain-text list; its newlines are preserved with `whitespace-pre-line`, and it
 * only appears when an assignment exists.
 */
function RecordingNotes({
  description,
  assignment,
}: {
  description?: string;
  assignment?: string;
}) {
  const notes = (description ?? "").trim();
  const homework = (assignment ?? "").trim();
  if (!notes && !homework) return null;

  const paragraphs = notes.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean);

  return (
    <div className="border-t border-night-700 px-4 pb-5 pt-4">
      {paragraphs.length > 0 && (
        <section>
          <p className="flex items-center gap-1.5 font-mono text-[10px] font-bold uppercase tracking-[0.16em] text-night-300">
            <NotebookText className="h-3 w-3" aria-hidden />
            Class Notes
          </p>
          <div className="mt-2.5 space-y-2.5">
            {paragraphs.map((para, i) => (
              <p
                key={i}
                className="whitespace-pre-line text-[13.5px] leading-relaxed text-night-100"
              >
                {para}
              </p>
            ))}
          </div>
        </section>
      )}

      {homework && (
        <section className={paragraphs.length > 0 ? "mt-5" : ""}>
          <p className="flex items-center gap-1.5 font-mono text-[10px] font-bold uppercase tracking-[0.16em] text-accent">
            <ListChecks className="h-3 w-3" aria-hidden />
            Homework
          </p>
          <p className="mt-2.5 whitespace-pre-line text-[13.5px] leading-relaxed text-night-100">
            {homework}
          </p>
        </section>
      )}
    </div>
  );
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
        className="night-island flex max-h-[90vh] w-full max-w-3xl flex-col shadow-lift focus:outline-none"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex shrink-0 items-start justify-between gap-3 px-4 pb-3 pt-4">
          <div className="min-w-0">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-accent px-2.5 py-1 font-mono text-[9.5px] font-bold uppercase tracking-[0.16em] text-[color:var(--accent-on)]">
              <Play className="h-2.5 w-2.5" fill="currentColor" aria-hidden />
              Replay
            </span>
            <h3
              id="recording-player-title"
              className="mt-2 truncate font-display text-[19px] font-extrabold uppercase leading-tight tracking-tight text-night-50"
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

        <div className="mx-3 aspect-video shrink-0 overflow-hidden rounded-[14px] bg-night-950">
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

        {/* Meta + notes + homework scroll under the fixed header/video so a
            long set of class notes never pushes the player past the viewport. */}
        <div className="min-h-0 flex-1 overflow-y-auto">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 px-4 pb-4 pt-3 font-mono text-[10px] uppercase tracking-[0.14em] tabular-nums text-night-300">
            <span className="flex items-center gap-1.5">
              <Clock className="h-3 w-3" />
              {session.durationMin} min
            </span>
            {session.trackLabel && (
              <>
                <span aria-hidden>·</span>
                <span className="text-accent">{session.trackLabel}</span>
              </>
            )}
            {session.scheduledAt && (
              <>
                <span aria-hidden>·</span>
                <span>Recorded {session.scheduledAt}</span>
              </>
            )}
          </div>

          <RecordingNotes
            description={session.description}
            assignment={session.assignment}
          />
        </div>
      </m.div>
    </div>
  );
}
