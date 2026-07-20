/**
 * Class-recording helpers shared by the member player and admin upload UI.
 *
 * A completed live session can carry its recording three ways:
 *   'upload'   — file in the private `class-recordings` bucket
 *                (recording_path), streamed via short-lived signed URL
 *   'youtube'  — recording_url on YouTube, embedded privacy-enhanced
 *   'external' — any other host, opened in a new tab
 */

export type RecordingKind = "upload" | "youtube" | "external";

export const RECORDINGS_BUCKET = "class-recordings";

/** Signed URL lifetime for private recording playback (seconds). */
export const SIGNED_URL_TTL = 60 * 60; // 1 hour

const YOUTUBE_HOST_RE = /(?:^|\.)(?:youtube\.com|youtu\.be|youtube-nocookie\.com)$/i;

export function isYoutubeUrl(url: string): boolean {
  try {
    return YOUTUBE_HOST_RE.test(new URL(url).hostname);
  } catch {
    return false;
  }
}

/** Kind for a pasted recording link. */
export function detectUrlKind(url: string): RecordingKind {
  return isYoutubeUrl(url) ? "youtube" : "external";
}

/**
 * Effective kind for a session row — trusts recording_kind when set,
 * otherwise derives it (covers rows created before migration 026).
 * Returns null when the session has no recording at all.
 */
export function resolveRecordingKind(row: {
  recording_kind?: string | null;
  recording_path?: string | null;
  recording_url?: string | null;
}): RecordingKind | null {
  if (
    row.recording_kind === "upload" ||
    row.recording_kind === "youtube" ||
    row.recording_kind === "external"
  ) {
    return row.recording_kind;
  }
  if (row.recording_path) return "upload";
  if (row.recording_url) return detectUrlKind(row.recording_url);
  return null;
}

/**
 * Privacy-enhanced embed URL for a YouTube link.
 * Handles watch?v=, youtu.be/, /live/, /shorts/ and /embed/ forms.
 */
export function youtubeEmbedUrl(url: string): string | null {
  try {
    const u = new URL(url);
    if (!YOUTUBE_HOST_RE.test(u.hostname)) return null;
    let id = "";
    if (u.hostname.replace(/^www\./, "") === "youtu.be") {
      id = u.pathname.split("/").filter(Boolean)[0] || "";
    } else if (u.searchParams.get("v")) {
      id = u.searchParams.get("v") || "";
    } else {
      const m = u.pathname.match(/\/(?:live|shorts|embed)\/([^/?#]+)/);
      if (m) id = m[1];
    }
    if (!/^[A-Za-z0-9_-]{6,20}$/.test(id)) return null;
    return `https://www.youtube-nocookie.com/embed/${id}`;
  } catch {
    return null;
  }
}

/** Storage object path for a session's uploaded recording file. */
export function recordingObjectPath(sessionId: string, fileName: string): string {
  const safe = fileName.replace(/[^A-Za-z0-9._-]+/g, "_").replace(/^_+|_+$/g, "");
  return `sessions/${sessionId}/${safe || "recording.mp4"}`;
}
