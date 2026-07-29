/**
 * BUILD LESSON AUDIO — the voice of the curriculum, generated once, ahead of time.
 *
 *   node scripts/build-lesson-audio.mjs [--lesson adult-d03] [--force] [--sample]
 *
 * Reads a typed lesson module, enumerates every line that can reach a member's
 * ears (src/lib/learn/narration.ts — the single list), and renders each one to
 * its own mp3 with OpenAI `gpt-4o-mini-tts`, voice `ash`.
 *
 * WHY PRE-GENERATED, NEVER RUNTIME TTS:
 *   • Cost is paid once for 180 lessons, not once per member per replay.
 *   • Latency is a static file off the CDN, not a model round-trip mid-sentence.
 *   • The lesson sounds IDENTICAL for every member, forever — which is the same
 *     promise the hand-written prices make. A lesson is a published artifact.
 *   • Nothing a member hears was invented at runtime. Zero LLM in the flow.
 *
 * IDEMPOTENT. Each segment is keyed by a hash of (text + voice + model +
 * instructions). Unchanged lines are skipped, so re-running after an edit costs
 * only the lines that actually changed. `--force` re-renders everything.
 *
 * Output:
 *   public/lessons/audio/<slug>/<step-id>[-variant].mp3
 *   public/lessons/audio/<slug>/manifest.json   ← durations + hashes + script
 *
 * The manifest is what scripts/build-pilot-lesson.mjs folds back into the
 * lesson JSON, so the migration always ships the durations of the exact files
 * that are on disk.
 */
import {
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, "..");

/* ── config ───────────────────────────────────────────────────────────── */

/* ── Voicebox (LOCAL) — the owner's chosen provider, 2026-07-28 ─────────
   A local MLX/Metal server at http://localhost:17493 holding a 1.7B voice
   model and a set of cloned profiles. It is the shipped voice because it costs
   nothing per lesson, runs offline, and the Kway profile already IS the house
   voice — the same one the reels use. The OpenAI path below is retained as the
   fallback for a machine without the server.

   Contract, discovered from ~/voicebox/backend (there is no /api prefix):
     POST /generate  { profile_id, text, language, seed, instruct } → { id, duration }
     GET  /audio/{id}                                               → audio/wav
   The wav is transcoded to mp3 here; the browser wants one small file. */
const VOICEBOX_URL = process.env.VOICEBOX_URL || "http://localhost:17493";
/** Kai's voice. `Kway` is the house profile; the server also holds kyle, aiden,
 *  vivian and ryan — see --sample for the owner's ear check. */
const VOICEBOX_PROFILE = "2cd42fda-3482-4eb4-a79a-6abc64802e24";
const VOICEBOX_ALT_PROFILE = "a0d76292-5bd1-46fd-8649-67672360890d"; // ryan
/** Fixed, so a re-render of an unchanged line is the same performance. */
const VOICEBOX_SEED = 7;
/** The model takes a short style note, not a paragraph (500 char cap). */
const VOICEBOX_INSTRUCT =
  "Calm, warm investing coach talking one-to-one with an adult beginner. " +
  "Plain and unhurried, like a knowledgeable friend at a kitchen table. " +
  "Land the full stops. Never a hype narrator.";

const MODEL = "gpt-4o-mini-tts";
/** KAI'S REGISTER. `ash` is the warm, level, unhurried coach — an adult talking
 *  to an adult. The curriculum's voice note is "never the excitable narrator,
 *  never the soothing meditation app". A `coral` sample is generated alongside
 *  (--sample) so the owner can hear the alternative before we commit 180
 *  lessons to one voice. */
const VOICE = "ash";
const SAMPLE_VOICE = "coral";
const INSTRUCTIONS = [
  "You are Kai, a calm, warm investing coach talking one-to-one with an adult beginner.",
  "Speak plainly and unhurried, like a knowledgeable friend explaining something at a kitchen table.",
  "Land the full stops. Take a real beat at paragraph breaks and before a number.",
  "Never sound like an advertisement, a hype narrator, or a meditation app.",
  "Read dollar amounts naturally. Do not spell out punctuation.",
].join(" ");

/** Published price, gpt-4o-mini-tts: $0.60 / 1M input tokens (~$0.015/min). */
const USD_PER_1M_INPUT_TOKENS = 0.6;

/* ── args ─────────────────────────────────────────────────────────────── */

const args = process.argv.slice(2);
const flag = (name) => args.includes(`--${name}`);
const opt = (name, dflt) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 && args[i + 1] ? args[i + 1] : dflt;
};

const LESSON_KEY = opt("lesson", "adult-d03");
/**
 * PROVIDER. `openai` is the real one and the only one whose output ships.
 *
 * `voicebox` is the shipped provider (owner's call, 2026-07-28) — a local
 * server, so the curriculum's voice costs nothing and needs no vendor account.
 * `openai` is retained as the fallback for a machine without it.
 *
 * `local` exists because on 2026-07-28 the OpenAI account hit
 * `insufficient_quota` mid-build and the whole audio-first rebuild would
 * otherwise have been unverifiable. It renders the SAME script, to the SAME
 * paths, with the same manifest shape, using the OS speech synthesiser — so the
 * engine, the sync, the captions and the muted path can all be exercised for
 * real today. It is a PLACEHOLDER: the manifest records `provider: "local"`,
 * the files are git-ignored, and re-running with credits restored replaces
 * every one of them (`--provider openai --force`).
 */
const PROVIDER = opt("provider", "voicebox");
const FORCE = flag("force");
const SAMPLE = flag("sample");
const DRY = flag("dry");

/* ── env ──────────────────────────────────────────────────────────────── */

function loadEnvLocal() {
  const p = join(ROOT, ".env.local");
  if (!existsSync(p)) return;
  for (const line of readFileSync(p, "utf8").split("\n")) {
    const m = /^([A-Z0-9_]+)=(.*)$/.exec(line.trim());
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
}
loadEnvLocal();

const KEY = process.env.OPENAI_API_KEY;
if (!KEY && !DRY && PROVIDER === "openai") {
  console.error("OPENAI_API_KEY missing (.env.local). Refusing to run.");
  process.exit(1);
}

/* ── the lesson + its script ──────────────────────────────────────────── */

const LESSONS = {
  "adult-d03": {
    module: "src/lib/learn/curriculum/adult-d03.ts",
    export: "ADULT_D03",
    slug: "adult-d03",
  },
};

const entry = LESSONS[LESSON_KEY];
if (!entry) {
  console.error(`Unknown lesson "${LESSON_KEY}". Known: ${Object.keys(LESSONS).join(", ")}`);
  process.exit(1);
}

const mod = await import(join(ROOT, entry.module));
const lesson = mod[entry.export];
const { enumerateNarration, MAX_SEGMENT_CHARS } = await import(
  join(ROOT, "src/lib/learn/narration.ts")
);

const segments = enumerateNarration(lesson);

/* ── refuse to ship a paragraph read aloud ────────────────────────────── */

const tooLong = segments.filter((s) => s.say.length > MAX_SEGMENT_CHARS);
if (tooLong.length) {
  console.error(
    `REFUSING: ${tooLong.length} segment(s) are longer than ${MAX_SEGMENT_CHARS} chars.\n` +
      "Audio-first means 1–3 sentences per beat, each with its own visual. Split them:"
  );
  for (const s of tooLong)
    console.error(`  • ${s.file} (${s.say.length}) — ${s.say.slice(0, 70)}…`);
  process.exit(1);
}

const dupes = segments
  .map((s) => s.file)
  .filter((f, i, a) => a.indexOf(f) !== i);
if (dupes.length) {
  console.error(`REFUSING: duplicate segment filenames: ${[...new Set(dupes)].join(", ")}`);
  process.exit(1);
}

/* ── generate ─────────────────────────────────────────────────────────── */

const OUT_DIR = join(ROOT, "public/lessons/audio", entry.slug);
mkdirSync(OUT_DIR, { recursive: true });

const MANIFEST_PATH = join(OUT_DIR, "manifest.json");
const prior = existsSync(MANIFEST_PATH)
  ? JSON.parse(readFileSync(MANIFEST_PATH, "utf8"))
  : { segments: {} };

function hashOf(text, voice) {
  const recipe =
    PROVIDER === "voicebox"
      ? ["voicebox", VOICEBOX_PROFILE, VOICEBOX_SEED, VOICEBOX_INSTRUCT, text]
      : [MODEL, voice, INSTRUCTIONS, text];
  return createHash("sha256").update(recipe.join("|")).digest("hex").slice(0, 16);
}

/** Voicebox: synthesise, fetch the wav, transcode to mp3. */
async function speakVoicebox(text, outFile, profileId = VOICEBOX_PROFILE) {
  const res = await fetch(`${VOICEBOX_URL}/generate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      profile_id: profileId,
      text,
      language: "en",
      seed: VOICEBOX_SEED,
      instruct: VOICEBOX_INSTRUCT,
    }),
  });
  if (!res.ok)
    throw new Error(`voicebox ${res.status}: ${(await res.text()).slice(0, 300)}`);
  const gen = await res.json();
  const wavRes = await fetch(`${VOICEBOX_URL}/audio/${gen.id}`);
  if (!wavRes.ok) throw new Error(`voicebox audio ${wavRes.status}`);
  const wav = outFile.replace(/\.mp3$/, "") + ".wav";
  writeFileSync(wav, Buffer.from(await wavRes.arrayBuffer()));
  execFileSync("ffmpeg", [
    "-y", "-loglevel", "error", "-i", wav,
    "-codec:a", "libmp3lame", "-b:a", "64k", "-ar", "24000", "-ac", "1",
    outFile,
  ]);
  execFileSync("rm", ["-f", wav]);
  return gen;
}

/** macOS speech synthesis → mp3. Placeholder only; see PROVIDER. */
function speakLocal(text, outFile) {
  const aiff = outFile.replace(/\.mp3$/, "") + ".aiff";
  execFileSync("say", ["-v", "Samantha", "-r", "172", "-o", aiff, text]);
  execFileSync("ffmpeg", ["-y", "-loglevel", "error", "-i", aiff, "-codec:a", "libmp3lame", "-qscale:a", "5", outFile]);
  execFileSync("rm", ["-f", aiff]);
}

async function speak(text, voice) {
  const res = await fetch("https://api.openai.com/v1/audio/speech", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: MODEL,
      voice,
      input: text,
      instructions: INSTRUCTIONS,
      response_format: "mp3",
    }),
  });
  if (!res.ok) {
    throw new Error(`TTS ${res.status}: ${(await res.text()).slice(0, 300)}`);
  }
  return Buffer.from(await res.arrayBuffer());
}

/** Measured, never estimated — the engine waits on these numbers. */
function durationMs(file) {
  const out = execFileSync(
    "ffprobe",
    [
      "-v", "error",
      "-show_entries", "format=duration",
      "-of", "default=noprint_wrappers=1:nokey=1",
      file,
    ],
    { encoding: "utf8" }
  ).trim();
  const sec = Number.parseFloat(out);
  if (!Number.isFinite(sec)) throw new Error(`ffprobe gave no duration for ${file}`);
  return Math.round(sec * 1000);
}

const manifest = {
  lesson: entry.slug,
  voice:
    PROVIDER === "voicebox"
      ? "voicebox:Kway"
      : PROVIDER === "local"
        ? "os-placeholder"
        : VOICE,
  model: PROVIDER === "voicebox" ? "voicebox-1.7B (mlx)" : MODEL,
  profileId: PROVIDER === "voicebox" ? VOICEBOX_PROFILE : undefined,
  provider: PROVIDER,
  instructions: INSTRUCTIONS,
  generatedAt: new Date().toISOString(),
  segments: {},
};

let made = 0;
let skipped = 0;
let chars = 0;

for (const seg of segments) {
  const file = `${seg.file}.mp3`;
  const abs = join(OUT_DIR, file);
  const url = `/lessons/audio/${entry.slug}/${file}`;
  const hash = hashOf(seg.say, VOICE);
  const before = prior.segments?.[seg.file];

  chars += seg.say.length;

  if (!FORCE && before?.hash === hash && existsSync(abs)) {
    manifest.segments[seg.file] = { ...before, url, say: seg.say };
    skipped++;
    continue;
  }
  if (DRY) {
    manifest.segments[seg.file] = { url, hash, say: seg.say, durationMs: 0 };
    made++;
    continue;
  }

  process.stdout.write(`  ${seg.file} … `);
  if (PROVIDER === "voicebox") {
    await speakVoicebox(seg.say, abs);
  } else if (PROVIDER === "local") {
    speakLocal(seg.say, abs);
  } else {
    writeFileSync(abs, await speak(seg.say, VOICE));
  }
  const ms = durationMs(abs);
  manifest.segments[seg.file] = {
    url,
    hash,
    say: seg.say,
    durationMs: ms,
  };
  made++;
  console.log(`${(ms / 1000).toFixed(1)}s`);
  // Written after EVERY segment, not at the end. Local synthesis is ~50s a
  // line, so a 50-segment lesson is a forty-minute job — one that must survive
  // being interrupted. With the manifest on disk the content hashes let a
  // re-run pick up exactly where it stopped instead of paying for it twice.
  if (!DRY) writeFileSync(MANIFEST_PATH, JSON.stringify(manifest, null, 2) + "\n");
}

/* ── the voice sample the owner has to sign off ───────────────────────── */

if (SAMPLE && !DRY && PROVIDER === "voicebox") {
  const line = lesson.guide?.intro ?? segments[0].say;
  for (const [profile, name] of [
    [VOICEBOX_PROFILE, "sample-kway.mp3"],
    [VOICEBOX_ALT_PROFILE, "sample-ryan.mp3"],
  ]) {
    const abs = join(OUT_DIR, name);
    if (FORCE || !existsSync(abs)) {
      await speakVoicebox(line, abs, profile);
      console.log(`  sample ${name} → ${abs}`);
    }
  }
} else if (SAMPLE && !DRY && PROVIDER === "openai") {
  const line = lesson.guide?.intro ?? segments[0].say;
  for (const [voice, name] of [
    [VOICE, `sample-${VOICE}.mp3`],
    [SAMPLE_VOICE, `sample-${SAMPLE_VOICE}.mp3`],
  ]) {
    const abs = join(OUT_DIR, name);
    if (FORCE || !existsSync(abs)) {
      writeFileSync(abs, await speak(line, voice));
      console.log(`  sample ${voice} → ${abs}`);
    }
  }
}

if (!DRY) writeFileSync(MANIFEST_PATH, JSON.stringify(manifest, null, 2) + "\n");

const totalMs = Object.values(manifest.segments).reduce(
  (a, s) => a + (s.durationMs ?? 0),
  0
);
// gpt-4o-mini-tts bills the INPUT text; ~4 chars per token is the standard
// approximation and is close enough for a build-time cost line.
const cost = (chars / 4 / 1_000_000) * USD_PER_1M_INPUT_TOKENS;

console.log(
  [
    "",
    `lesson    ${entry.slug}`,
    `provider  ${PROVIDER}${PROVIDER === "local" ? "  ⚠ PLACEHOLDER — regenerate with --provider openai --force" : ""}`,
    `voice     ${MODEL} · ${VOICE}`,
    `segments  ${segments.length} (${made} generated, ${skipped} unchanged)`,
    `script    ${chars.toLocaleString()} chars`,
    `audio     ${(totalMs / 60000).toFixed(2)} min (${(totalMs / 1000).toFixed(1)}s)`,
    `cost      ~$${cost.toFixed(4)} for this run's text`,
    `out       ${OUT_DIR}`,
    "",
  ].join("\n")
);
