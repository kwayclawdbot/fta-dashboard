/**
 * Emits migration 202 from the TYPED, tsc-checked authored lesson module.
 *
 * The overview's rule: authoring lessons as SQL heredocs does not survive
 * review — author them as linted files that GENERATE the migration. This is
 * that generator. The lesson JSON is never hand-typed into SQL; it is
 * serialised here, dollar-quoted, and validated against the runtime guards in
 * schema.ts before a single byte is written.
 *
 *   node scripts/build-pilot-lesson.mjs
 *
 * Re-running it is safe and idempotent: the migration it writes is itself
 * idempotent (stable uuids + on conflict do update).
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, "..");

const { ADULT_D03 } = await import(
  join(ROOT, "src/lib/learn/curriculum/adult-d03.ts")
);

/* ── AUDIO-FIRST mode ────────────────────────────────────────────────────
   `--audio-migration` emits 206 instead of 202: the same generated JSON, now
   carrying the narration assets, applied to the ALREADY-LIVE pilot row with a
   guarded UPDATE. 202 stays exactly as it shipped — it is applied to prod and
   is not rewritten under a deployed database. */
const AUDIO_MODE = process.argv.includes("--audio-migration");
const narrated = { applied: 0, ms: 0 };
const ALLOW_PLACEHOLDER = process.argv.includes("--allow-placeholder");

let manifest = null;
if (AUDIO_MODE) {
  const mp = join(ROOT, "public/lessons/audio/adult-d03/manifest.json");
  if (!existsSync(mp)) {
    console.error(
      "No audio manifest. Run: node scripts/build-lesson-audio.mjs"
    );
    process.exit(1);
  }
  manifest = JSON.parse(readFileSync(mp, "utf8"));
  const REAL_PROVIDERS = new Set(["voicebox", "openai"]);
  if (!REAL_PROVIDERS.has(manifest.provider) && !ALLOW_PLACEHOLDER) {
    console.error(
      `REFUSING: manifest provider is "${manifest.provider}".\n` +
        "The shipped voice is Voicebox (profile Kway), with OpenAI as the\n" +
        "fallback. Regenerate with\n" +
        "  node scripts/build-lesson-audio.mjs --force\n" +
        "or pass --allow-placeholder to emit a migration whose durations are\n" +
        "provisional (urls + script are final either way)."
    );
    process.exit(1);
  }

  const { applyNarration, narratedMs } = await import(
    join(ROOT, "src/lib/learn/narration.ts")
  );
  const assets = {};
  for (const [file, seg] of Object.entries(manifest.segments ?? {})) {
    assets[file] = {
      url: seg.url,
      durationMs: seg.durationMs,
      say: seg.say,
    };
  }
  narrated.applied = applyNarration(ADULT_D03, assets);
  narrated.ms = narratedMs(ADULT_D03);
}

/* ── validate before we write ─────────────────────────────────────────── */

const GRADED = new Set(["multiple_choice", "true_false", "match_pairs", "prediction"]);
const KNOWN = new Set([...GRADED, "explainer", "real_world"]);

const problems = [];
const push = (m) => problems.push(m);

if (ADULT_D03.schema !== 1) push("schema must be 1");
if (!ADULT_D03.title) push("missing title");
if (!Array.isArray(ADULT_D03.steps) || ADULT_D03.steps.length === 0)
  push("no steps");

const seen = new Set();
for (const [i, s] of ADULT_D03.steps.entries()) {
  const at = `step ${i + 1} (${s.id ?? "no id"})`;
  if (!s.id) push(`${at}: missing id`);
  if (seen.has(s.id)) push(`${at}: duplicate id`);
  seen.add(s.id);
  if (!KNOWN.has(s.type)) push(`${at}: unknown type "${s.type}"`);

  if (s.type === "multiple_choice") {
    if (!Array.isArray(s.options) || s.options.length < 2)
      push(`${at}: needs >= 2 options`);
    if (typeof s.correctIndex !== "number" || !s.options?.[s.correctIndex])
      push(`${at}: correctIndex out of range`);
    if (s.framing && !s.question.includes(s.framing))
      push(`${at}: framing "${s.framing}" is not present in the question`);
    if (s.wrongFeedback) {
      if (s.wrongFeedback.length !== s.options.length)
        push(`${at}: wrongFeedback must be parallel to options`);
      if (s.wrongFeedback[s.correctIndex])
        push(`${at}: wrongFeedback set on the CORRECT option`);
    }
  }
  if (s.type === "true_false" && typeof s.answer !== "boolean")
    push(`${at}: answer must be boolean`);
  if (s.type === "prediction") {
    if (!s.options?.some((o) => o.value === s.outcomeValue))
      push(`${at}: outcomeValue matches no option`);
    if (s.guideOn && !s.options.some((o) => o.value === s.guideOn.value))
      push(`${at}: guideOn.value matches no option`);
    const sc = s.reveal?.scene;
    if (sc) {
      if (!Array.isArray(sc.points) || sc.points.length < 2)
        push(`${at}: scene needs >= 2 points`);
      if (sc.points.some((p) => p < 0 || p > 1))
        push(`${at}: scene points must be normalised 0–1`);
      if (sc.eventIndex < 0 || sc.eventIndex >= sc.points.length)
        push(`${at}: scene eventIndex out of range`);
    }
  }
  if (s.type === "real_world") {
    if (!["save_watchlist", "research_ticker"].includes(s.action))
      push(`${at}: unknown real-world action`);
    if (!s.ticker || !s.company) push(`${at}: needs ticker + company`);
  }
  if (s.type === "explainer" && Array.isArray(s.beats)) {
    const seenBeat = new Set();
    for (const b of s.beats) {
      if (!b.id) push(`${at}: a beat has no id`);
      if (seenBeat.has(b.id)) push(`${at}: duplicate beat id "${b.id}"`);
      seenBeat.add(b.id);
      if (!b.say?.trim()) push(`${at}: beat ${b.id} has nothing to say`);
      // AUDIO-FIRST: the beat's narration must be the authored prose, not new
      // copy invented for the voice. Every beat has to be findable inside a
      // paragraph of `body`, which is what makes the split reviewable.
      const inBody = (s.body ?? []).some((p) =>
        p.replace(/\s+/g, " ").includes(b.say.replace(/\s+/g, " "))
      );
      if (!inBody)
        push(
          `${at}: beat ${b.id} narration is not a verbatim slice of body — ` +
            "the script may only be SPLIT, never rewritten"
        );
      if (b.headline && b.headline.length > 60)
        push(`${at}: beat ${b.id} headline is a paragraph (${b.headline.length} chars)`);
    }
    if (AUDIO_MODE && s.beats.some((b) => !b.audio?.url))
      push(`${at}: beats without audio in --audio-migration mode`);
  }
  if (s.type === "explainer" && !s.beats?.length)
    push(`${at}: an explainer with no beats is a wall of text — author beats`);

  const ill = s.illustration;
  if (ill) {
    if (ill.kind !== "order_book") push(`${at}: unknown illustration kind`);
    if (!ill.bids?.length || !ill.asks?.length)
      push(`${at}: illustration needs both sides of the book`);
    if (ill.mode === "before_after" && !ill.after)
      push(`${at}: before_after illustration has no "after" state`);
    if (ill.mode === "walk_up" && !ill.walkPrices?.length)
      push(`${at}: walk_up illustration has no walkPrices`);
  }
}

// The XP note has to have a graded step to ride on.
if (!ADULT_D03.steps.some((s) => GRADED.has(s.type)))
  push("lesson has no graded step to carry the XP note");

const json = JSON.stringify(ADULT_D03, null, 2);
if (json.includes("$json$")) push("content collides with the dollar-quote tag");

if (problems.length) {
  console.error("REFUSING TO WRITE — the authored lesson did not validate:");
  for (const p of problems) console.error("  • " + p);
  process.exit(1);
}

/* ── stable ids so the migration is idempotent ────────────────────────── */
const COURSE_ID = "c0d3f1a0-0000-4000-8000-000000000001";
const MODULE_ID = "c0d3f1a0-0000-4000-8000-000000000002";
const LESSON_ID = "c0d3f1a0-0000-4000-8000-000000000003";

const sql = `-- 202 — CURRICULUM RESET + the first lesson of the new curriculum.
--
-- ═══════════════════════════════════════════════════════════════════════════
-- PART 1 — RETIRE EVERYTHING THAT IS THERE NOW.
--
-- The audit: 36 live lessons are one 6-step template repeated 36 times, 65 more
-- are empty shells, and 4 teach options contracts to teenagers. The owner's
-- call is to remove all of it before the new curriculum lands.
--
-- NOTHING IS DELETED. lesson_progress and xp_events both reference lessons by
-- id; dropping rows would silently destroy every member's XP audit trail and
-- their completion history. So the old catalogue is HIDDEN, not destroyed:
--
--   • courses.published = false on every existing course. RLS on courses,
--     modules and lessons all key off that one flag (migration 039), so a
--     single write takes the whole old catalogue off every member surface at
--     once — no client can read past it even if a query forgets a filter.
--   • lessons.retired = true, a new per-lesson flag. It exists because
--     publication is COURSE-level and the new curriculum will need to retire
--     individual days inside a live course without unpublishing the course
--     around them. It is also the only defence available to the service-role
--     search path, which bypasses RLS entirely.
--   • The lessons RLS policy now excludes retired rows, so "retired" is
--     enforced by the database rather than by every caller remembering.
--
-- Flashcards, games and missions are untouched — they are not lessons.
-- Reversible in one line: set published = true / retired = false.
-- ═══════════════════════════════════════════════════════════════════════════

alter table lessons add column if not exists retired boolean not null default false;

comment on column lessons.retired is
  'Curriculum reset (202): the lesson is withdrawn from member surfaces but its rows are kept so lesson_progress / xp_events history stays intact. Enforced in the lessons RLS policy.';

create index if not exists idx_lessons_retired on lessons(retired) where retired = false;

-- Every lesson that exists at this moment is old-curriculum. The pilot below is
-- inserted AFTER this statement, so it is never caught by it.
update lessons set retired = true where retired = false;

-- And the courses they live in come off the shelf.
update courses set published = false, updated_at = now() where published = true;

-- Retirement is enforced by the database, not by callers remembering a filter.
drop policy if exists "Members read lessons of published courses" on public.lessons;
drop policy if exists "Members read live lessons of published courses" on public.lessons;
create policy "Members read live lessons of published courses" on public.lessons
  for select to authenticated
  using (
    retired = false
    and module_id in (
      select m.id from public.modules m
      join public.courses c on c.id = m.course_id
      where c.published = true
    )
  );

-- ═══════════════════════════════════════════════════════════════════════════
-- PART 2 — THE PILOT: Adults · Day 3, "Why the price moves at all".
--
-- Phase 1 · FIND, block 1. Eight steps, ~7 minutes, difficulty 2, flat 50 XP
-- de-duped by lesson id like every other lesson — there is no second XP path.
--
-- The step JSON below is GENERATED from src/lib/learn/curriculum/adult-d03.ts
-- by scripts/build-pilot-lesson.mjs. It is tsc-checked against schema.ts and
-- then re-validated by the generator (option/answer ranges, framing present in
-- its own question, scene points normalised, wrongFeedback parallel to options)
-- before this file is written. Do not hand-edit the JSON here — edit the typed
-- module and re-run the generator.
--
-- Compliance: education, never advice. No one is told to buy or sell anything.
-- Equities only. No performance claims. Every price is hand-written and dated
-- illustrative (NKE, 2025-Q3), never a live quote.
--
-- Idempotent: fixed uuids + on conflict do update, so re-running is a no-op.
-- ═══════════════════════════════════════════════════════════════════════════

insert into courses (id, slug, title, description, min_tier, program, sort_order, published)
values (
  '${COURSE_ID}',
  'investing-explained-simply',
  'Investing, Explained Simply',
  'The decision cycle, one day at a time — find, evaluate, size, manage, sell. Plain language, no jargon, one concept a day.',
  'challenge',
  'fic',
  0,
  true
)
on conflict (id) do update set
  slug        = excluded.slug,
  title       = excluded.title,
  description = excluded.description,
  min_tier    = excluded.min_tier,
  program     = excluded.program,
  sort_order  = excluded.sort_order,
  published   = excluded.published,
  updated_at  = now();

-- track = 'adults' so LearnSurface's own-track filter and get_home_state's
-- (m.track is null or m.track = v_track) both resolve it for an adult member.
insert into modules (id, course_id, track, title, description, sort_order)
values (
  '${MODULE_ID}',
  '${COURSE_ID}',
  'adults',
  'Phase 1 · FIND',
  'Where do good picks come from, and how do you get from nothing to a shortlist?',
  0
)
on conflict (id) do update set
  course_id   = excluded.course_id,
  track       = excluded.track,
  title       = excluded.title,
  description = excluded.description,
  sort_order  = excluded.sort_order;

insert into lessons (
  id, module_id, title, description,
  drip_week, has_quiz, sort_order, is_free,
  node_kind, est_minutes, lesson_xp, retired, steps
)
values (
  '${LESSON_ID}',
  '${MODULE_ID}',
  ${sqlStr(ADULT_D03.title)},
  'Nobody sets the price. It is two lines of people haggling — what buyers are offering, what sellers are asking, and whoever gave in last.',
  0,
  false,
  0,
  true,
  'lesson',
  ${ADULT_D03.duration_minutes},
  ${ADULT_D03.xp},
  false,
  $json$
${json}
$json$::jsonb
)
on conflict (id) do update set
  module_id   = excluded.module_id,
  title       = excluded.title,
  description = excluded.description,
  drip_week   = excluded.drip_week,
  has_quiz    = excluded.has_quiz,
  sort_order  = excluded.sort_order,
  is_free     = excluded.is_free,
  node_kind   = excluded.node_kind,
  est_minutes = excluded.est_minutes,
  lesson_xp   = excluded.lesson_xp,
  retired     = false,
  steps       = excluded.steps;
`;

function sqlStr(s) {
  return "'" + String(s).replace(/'/g, "''") + "'";
}

/* ── 206 — the audio-first presentation of the SAME lesson ─────────────── */

const audioSql = `-- 206 — PILOT LESSON, AUDIO-FIRST.
--
-- ═══════════════════════════════════════════════════════════════════════════
-- The owner rejected the text-heavy pilot outright: "it should be audio
-- speaking the words with images or animations or interactions on screen, not
-- read like a book — again we are going for duolingo experience."
--
-- This migration replaces the PRESENTATION of the Day 3 pilot and nothing else.
-- Same eight steps, same ids, same questions, same correct answers, same skills,
-- same 50 XP, same lesson row. Not one member's lesson_progress, quiz_attempts
-- or xp_events row changes meaning, because none of the things those reference
-- moved. What changed is inside \`steps\`:
--
--   • Each explainer now carries a \`beats\` array — the SAME approved prose,
--     split on sentence boundaries into 1–3 sentence spoken beats, each with
--     the visual state that holds while it is spoken. The generator refuses to
--     write this file unless every beat is a verbatim slice of the paragraph it
--     came from, so the curriculum voice can be split but never rewritten.
--   • Every line that can reach a member's ears — question prompts, per-option
--     wrong feedback, reinforcements, the re-ask, the reveal walk-up, the guide
--     lines, the real-world instruction, the intro and the outro — carries an
--     \`audio\` entry: { url, durationMs, say }.
--
-- THE AUDIO IS STATIC. Pre-generated by scripts/build-lesson-audio.mjs with
-- Voicebox, the local MLX voice server, profile "Kway"
-- (2cd42fda-3482-4eb4-a79a-6abc64802e24) — the same voice the reels use — and
-- served from
-- /lessons/audio/adult-d03/*.mp3. There is NO runtime TTS and no LLM anywhere
-- in this path: what a member hears is a published artifact, identical for
-- everyone, forever — the same promise the hand-written prices make.
--
-- Compliance rails unchanged: education, never advice; equities only; no
-- performance claims; every price hand-written and dated illustrative
-- (NKE, 2025-Q3), never a live quote.
--
-- GUARDED + IDEMPOTENT. It updates exactly one row, by id, and only if that row
-- is still the pilot; re-running is a no-op. A rollback is re-applying 202.
--
-- Generated by: node scripts/build-pilot-lesson.mjs --audio-migration
-- Do NOT hand-edit the JSON below — edit the typed module and regenerate.
--${
  manifest && !["voicebox", "openai"].includes(manifest.provider)
    ? `
-- ⚠ PROVISIONAL DURATIONS. The OpenAI account was out of quota
-- (insufficient_quota) when this was generated, so \`durationMs\` was measured
-- from a placeholder local render. The urls and the spoken script are final;
-- the engine advances on the audio element's own \`ended\` event and never reads
-- durationMs, so this is metadata only. Refresh it with:
--   node scripts/build-lesson-audio.mjs --provider openai --force
--   node scripts/build-pilot-lesson.mjs --audio-migration
--`
    : ""
}
-- ═══════════════════════════════════════════════════════════════════════════

update lessons
set
  steps       = $json$
${json}
$json$::jsonb,
  est_minutes = ${ADULT_D03.duration_minutes},
  updated_at  = now()
where id = '${LESSON_ID}'
  and module_id = '${MODULE_ID}'
  and retired = false;
`;

const target = AUDIO_MODE
  ? join(ROOT, "supabase/migrations/206_pilot_audio.sql")
  : join(ROOT, "supabase/migrations/202_curriculum_reset.sql");

writeFileSync(target, AUDIO_MODE ? audioSql : sql, "utf8");

const beatCount = ADULT_D03.steps.reduce(
  (n, s) => n + (s.beats?.length ?? 0),
  0
);
console.log(
  `wrote ${target}\n  steps: ${ADULT_D03.steps.length}` +
    `\n  types: ${[...new Set(ADULT_D03.steps.map((s) => s.type))].join(", ")}` +
    `\n  beats: ${beatCount}` +
    (AUDIO_MODE
      ? `\n  audio: ${narrated.applied} segments · ${(narrated.ms / 60000).toFixed(2)} min` +
        `\n  voice: ${manifest.model} · ${manifest.voice} (provider: ${manifest.provider})`
      : "") +
    `\n  json:  ${json.length} bytes`
);
