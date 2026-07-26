-- 162 — Learning World P2: native interactive lessons (additive, non-destructive)
--
-- The LessonEngine change (FIC-LEARNING-WORLD §1): the interactive step
-- sequence IS the lesson; video becomes one block type. A lesson with a non-null
-- `steps` renders in <LessonEngine>; a lesson with null `steps` renders in the
-- legacy video/html/iframe viewer UNCHANGED. Pure column additions — no data is
-- moved, no existing lesson changes behaviour until it is authored with steps.
--
-- lesson_progress / quiz_attempts / xp_events / belts are all preserved as-is:
-- the engine writes the SAME three intents (section progress, graded result,
-- complete) the iframe bridge writes today, so every downstream surface
-- (leaderboards, belts, report cards, home state, badges) keeps working.

-- The lesson body as a JSON step sequence. NULL = legacy render.
alter table lessons add column if not exists steps jsonb;

-- Optional per-lesson overrides the engine reads (falls back to
-- video_duration_sec / XP.LESSON when null).
alter table lessons add column if not exists est_minutes int;
alter table lessons add column if not exists lesson_xp int;

-- node_kind lets a "lesson" row stand in for a game / challenge / boss / mission
-- node on the journey path (games-as-nodes, §7) without a parallel structure.
-- Existing rows default to 'lesson' — no behaviour change.
alter table lessons
  add column if not exists node_kind text not null default 'lesson'
    check (node_kind in ('lesson', 'game', 'challenge', 'boss', 'mission'));

comment on column lessons.steps is
  'Learning World P2: JSON step sequence (schema in src/lib/learn/schema.ts). Non-null => rendered by <LessonEngine>; null => legacy viewer.';
