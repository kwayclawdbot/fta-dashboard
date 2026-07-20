/**
 * App-level profanity / keyword filter for community posts + comments.
 *
 * HONEST SCOPE: this is a client/app-level wordlist check that runs on submit.
 * It blocks the obvious cases with a friendly message so a kid never sees the
 * worst words, but it is NOT an unbypassable filter — a determined user can
 * evade it (spacing, unicode look-alikes, novel spellings), and it does not run
 * server-side. It is the "automated first filter" of the moderation model
 * (COMMUNITY-EXPERIENCE-STUDY §4.5); admin delete + reporting remain the real
 * backstop. Keep the list conservative to avoid the Scunthorpe problem
 * (substring false-positives) — we match whole words only.
 */

// Whole-word blocklist (lowercase). Kept intentionally short + high-confidence.
const BLOCKED = [
  "fuck", "fucker", "fucking", "motherfucker", "shit", "bullshit", "bitch",
  "bastard", "asshole", "dickhead", "cunt", "slut", "whore", "faggot", "fag",
  "nigger", "nigga", "retard", "retarded", "cock", "pussy", "dick", "prick",
  "wanker", "twat", "jackass", "dumbass", "goddamn",
];

// Light leetspeak fold so "sh1t" / "f_u_c_k" style dodges still catch common cases.
function normalize(text: string): string {
  return text
    .toLowerCase()
    .replace(/[@4]/g, "a")
    .replace(/[$5]/g, "s")
    .replace(/[1!|]/g, "i")
    .replace(/0/g, "o")
    .replace(/3/g, "e")
    .replace(/7/g, "t")
    .replace(/[^a-z\s]/g, " "); // strip separators so f-u-c-k → f u c k collapses below
}

export interface ProfanityResult {
  ok: boolean;
  word?: string;
}

/**
 * Returns { ok: false, word } if the text trips the filter. Matches whole
 * words on a normalized copy, plus a de-spaced pass to catch "f u c k".
 */
export function checkClean(text: string): ProfanityResult {
  if (!text) return { ok: true };
  const normalized = normalize(text);
  const words = new Set(normalized.split(/\s+/).filter(Boolean));
  const collapsed = normalized.replace(/\s+/g, "");

  for (const bad of BLOCKED) {
    if (words.has(bad)) return { ok: false, word: bad };
    // de-spaced pass: only for longer tokens to avoid short-word false hits
    if (bad.length >= 4 && collapsed.includes(bad)) return { ok: false, word: bad };
  }
  return { ok: true };
}

export const PROFANITY_MESSAGE =
  "Let's keep it kind — kids are in the club too. Please reword that and try again.";
