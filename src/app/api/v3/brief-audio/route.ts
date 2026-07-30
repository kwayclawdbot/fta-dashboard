import { NextResponse, type NextRequest } from "next/server";
import { createHash } from "node:crypto";
import { createClient } from "@/lib/supabase/server";
import { resolveClubCtx } from "@/lib/club/home-context";
import { briefCore } from "@/app/api/club/brief/route";
import { briefSpokenText } from "@/ui-v3/home-data";

/**
 * GET /api/v3/brief-audio
 *   → audio/mpeg, Kai reading today's brief. 204 when there is no brief to read.
 *
 * The ▶ on "TODAY IN 30 SECONDS" was a drawn triangle. This is what it plays.
 *
 * WHY RUNTIME TTS HERE, WHEN LESSONS ARE PRE-GENERATED. scripts/build-lesson-audio.mjs
 * argues hard against runtime synthesis, and it is right — for lessons. A lesson
 * is a published artifact: fixed text, 180 of them, read identically by every
 * member forever, so paying once at build time is strictly better. The brief is
 * the opposite object. Its text is derived from today's deltas and is different
 * tomorrow, so there is no build step that could have rendered it. What carries
 * over from that script is everything else: the same model, the same voice, the
 * same instructions, and the same content-hash keying — so the cost is paid once
 * PER BRIEF instead of once per lesson.
 *
 * THE CACHE is keyed by a hash of the exact string sent to the model. Two
 * members opening the same brief hit the same entry; a member replaying it hits
 * it again; a brief that has not changed since this morning costs nothing. It is
 * in-memory and therefore per-instance and lost on redeploy, which is the right
 * trade for an object whose lifetime is one day — nothing here is worth a
 * storage bucket and a cleanup job. (Lesson audio, which IS worth that, lives on
 * disk under public/lessons/audio and is served as a static file.)
 *
 * FAILURE IS SILENT AND TOTAL. No key, no brief, a model error, a timeout — all
 * of them return a status with no body, and the button quietly goes back to
 * being idle. A brief is a nicety; it never breaks Home.
 */
export const runtime = "nodejs";
export const maxDuration = 60;

/** Same model, voice and register as the curriculum — Kai has one voice. */
const MODEL = "gpt-4o-mini-tts";
const VOICE = "ash";
const INSTRUCTIONS = [
  "You are Kai, a calm, warm investing coach talking one-to-one with an adult.",
  "This is a short daily market briefing. Speak plainly and unhurried.",
  "Land the full stops. Take a real beat before a number and between items.",
  "Never sound like an advertisement, a hype narrator, or a meditation app.",
  "Read dollar amounts and percentages naturally. Do not spell out punctuation.",
].join(" ");

/** How long to wait on the model before giving the member their button back. */
const TTS_TIMEOUT_MS = 25_000;

/**
 * Renders in flight and rendered, keyed by content hash.
 *
 * Storing the PROMISE, not the buffer, is what makes the first morning cheap:
 * every member arrives within the same few minutes and would otherwise each
 * start their own synthesis of an identical brief. They now all await one.
 * A rejected entry is evicted so the next caller retries rather than inheriting
 * a failure.
 */
const CACHE = new Map<string, Promise<ArrayBuffer>>();
/** Small because the key space is "today's brief", not "every brief ever". */
const CACHE_MAX = 8;

function remember(key: string, value: Promise<ArrayBuffer>) {
  CACHE.set(key, value);
  value.catch(() => CACHE.delete(key));
  while (CACHE.size > CACHE_MAX) {
    const oldest = CACHE.keys().next().value;
    if (oldest === undefined) break;
    CACHE.delete(oldest);
  }
}

async function synthesize(text: string, key: string): Promise<ArrayBuffer> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TTS_TIMEOUT_MS);
  try {
    const res = await fetch("https://api.openai.com/v1/audio/speech", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: MODEL,
        voice: VOICE,
        input: text,
        instructions: INSTRUCTIONS,
        response_format: "mp3",
      }),
      signal: controller.signal,
    });
    if (!res.ok) throw new Error(`tts ${res.status}`);
    return await res.arrayBuffer();
  } finally {
    clearTimeout(timer);
  }
}

export async function GET(req: NextRequest) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return new NextResponse(null, { status: 204 });

  const supabase = await createClient();
  const ctx = await resolveClubCtx(supabase, req);
  if (!ctx) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  // The brief, through its own core — the same body Home rendered, entitlement
  // wall and all. A walled tier gets 403 here exactly as it does on the panel.
  const { status, body } = await briefCore(ctx);
  if (status && status !== 200) return new NextResponse(null, { status });

  const text = briefSpokenText(body);
  // No brief, or only the degenerate activity tallies Home already refuses to
  // print. Nothing to read — and the button is not drawn in that state anyway.
  if (!text) return new NextResponse(null, { status: 204 });

  const hash = createHash("sha256")
    .update(`${MODEL}|${VOICE}|${INSTRUCTIONS}|${text}`)
    .digest("hex");

  let audio: ArrayBuffer;
  try {
    let pending = CACHE.get(hash);
    if (!pending) {
      pending = synthesize(text, apiKey);
      remember(hash, pending);
    }
    audio = await pending;
  } catch (err) {
    console.error("[v3/brief-audio] synthesis failed:", err);
    return new NextResponse(null, { status: 204 });
  }

  return new NextResponse(audio, {
    status: 200,
    headers: {
      "Content-Type": "audio/mpeg",
      "Content-Length": String(audio.byteLength),
      // Private: the brief is entitlement-gated, so no shared cache may hold it.
      // The ETag lets a replay revalidate instead of re-downloading.
      "Cache-Control": "private, max-age=900",
      ETag: `"${hash.slice(0, 32)}"`,
    },
  });
}
