-- RESTORE the pre-overhaul FIC/FTA video-lesson curriculum (2026-07-31)
-- Reverses migration 202's DATA effect only. Schema (retired column, index, RLS) stays.
-- Everything here is reversible; nothing is deleted. Run as ONE transaction via
--   psql -1 (transaction pooler drops pg_temp without -1 — per standing note).
--
-- Decisions encoded (owner can override before running):
--   * The 11 courses 202 unpublished come back. The 28 courses already
--     unpublished since March stay down.
--   * ALL lessons 202 retired come back EXCEPT the two teen Week-4 options
--     lessons (compliance: 202's own rationale cited options-to-teens).
--     Adult options lessons DO come back.
--   * The 24 interactive HTML lessons get steps=NULL so the viewer falls
--     through to the full-bleed video/HTML path (steps_draft untouched;
--     live steps snapshotted below).
--   * Kids Corner keeps its step lessons (it never had video; nulling steps
--     would leave kids a dead track).
--   * The pilot audio lesson + course are retired/unpublished (challenge_beats
--     verified: all four lesson beats href "/courses", none names the pilot).

BEGIN;

-- 0. Snapshot for rollback.
CREATE TABLE IF NOT EXISTS _restore_20260731_steps AS
SELECT id, steps, retired FROM lessons WHERE steps IS NOT NULL OR retired = true;

-- 1. Republish exactly the 11 courses 202 took down (202's own write timestamp).
--    Expect: UPDATE 11
UPDATE courses
   SET published = true, updated_at = now()
 WHERE updated_at = timestamptz '2026-07-28 15:54:32.662641+00'
   AND published = false;

-- 2. Un-retire every lesson 202 retired.  Expect: UPDATE 101
UPDATE lessons SET retired = false WHERE retired = true;

-- 3. Compliance carve-out: teen Week-4 options lessons stay hidden.
--    Expect: UPDATE 2
UPDATE lessons SET retired = true
 WHERE id IN ('f1c00000-0002-0004-0001-000000000001',  -- Calls & Puts Explained
              'f1c00000-0002-0004-0002-000000000001'); -- Why Options Can Grow (or Vaporize) Fast

-- 4. Hand the interactive HTML lessons back to the video path.
--    Expect: UPDATE 24
UPDATE lessons
   SET steps = NULL
 WHERE video_provider = 'html'
   AND video_id IS NOT NULL
   AND steps IS NOT NULL;

-- 5. Retire the pilot (nothing deleted; progress/XP rows survive by FK).
UPDATE lessons SET retired = true
 WHERE id = 'c0d3f1a0-0000-4000-8000-000000000003';
UPDATE courses SET published = false, updated_at = now()
 WHERE id = 'c0d3f1a0-0000-4000-8000-000000000001';

COMMIT;

-- VERIFY (run after commit):
-- SELECT count(*) FROM courses WHERE published;                                  -- expect 11
-- SELECT count(*) FROM lessons WHERE NOT retired;                                -- expect 99
-- SELECT count(*) FROM lessons WHERE video_provider='html' AND steps IS NULL;    -- expect 40
-- SELECT count(*) FROM lesson_progress;                                          -- expect 22 (unchanged)
-- SELECT count(*) FROM xp_events;                                                -- expect 91 (unchanged)
-- SELECT count(*) FROM quiz_attempts;                                            -- expect 15 (unchanged)

-- FULL ROLLBACK (returns to the 2026-07-30 state exactly):
-- BEGIN;
-- UPDATE lessons l SET steps = s.steps, retired = s.retired
--   FROM _restore_20260731_steps s WHERE s.id = l.id;
-- UPDATE courses SET published = false, updated_at = now()
--  WHERE id <> 'c0d3f1a0-0000-4000-8000-000000000001';
-- UPDATE courses SET published = true, updated_at = now()
--  WHERE id = 'c0d3f1a0-0000-4000-8000-000000000001';
-- UPDATE lessons SET retired = false WHERE id = 'c0d3f1a0-0000-4000-8000-000000000003';
-- COMMIT;
