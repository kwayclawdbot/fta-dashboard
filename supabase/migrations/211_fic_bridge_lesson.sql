-- 211_fic_bridge_lesson.sql
-- Bridge lesson (Lane G): "How to Read a Business (Before You Read a Chart)".
--
-- Adult Foundations jumped from w1l2 "What a Stock Is" straight to candlesticks,
-- with nothing that teaches how to actually understand a company — the exact
-- skill the Company-of-the-Week loop is built on. This inserts that lesson at
-- the top of Module 2 (Reading Charts), so it sits AFTER "what a stock is" and
-- BEFORE candles; no prerequisite is taught out of order.
--
-- Asset: public/lessons/SI/fic-adult-foundations/w2l0/index.html (concept-first,
-- five questions, Costco worked example, quiz, +50 XP). Same html provider and
-- path shape as every other adult lesson.
--
-- Sort: the new lesson takes sort_order 0; the two existing chart lessons shift
-- to 1 and 2. Idempotent — safe to re-run.

-- Shift the existing Module 2 lessons down first (so 0 is free for the bridge).
update lessons set sort_order = 1
  where id = 'f1c00000-0001-0002-0001-000000000001';
update lessons set sort_order = 2
  where id = 'f1c00000-0001-0002-0002-000000000001';

-- Insert the bridge lesson at the top of Module 2.
insert into lessons (
  id, module_id, title, description,
  video_provider, video_id, video_duration_sec,
  drip_week, has_quiz, sort_order, is_free, est_minutes, lesson_xp, node_kind, retired
) values (
  'f1c00000-0001-0002-0000-0000000000b0',
  'f1c00000-0001-0002-0000-000000000001',
  'How to Read a Business (Before You Read a Chart)',
  'The five questions that decode any company, in plain English, before a single candlestick. Run a real company through all five, the exact method behind the Company of the Week.',
  'html', '/lessons/SI/fic-adult-foundations/w2l0/index.html', 300,
  2, true, 0, false, 5, 50, 'lesson', false
)
on conflict (id) do update set
  title = excluded.title,
  description = excluded.description,
  video_provider = excluded.video_provider,
  video_id = excluded.video_id,
  sort_order = excluded.sort_order,
  has_quiz = excluded.has_quiz,
  est_minutes = excluded.est_minutes,
  lesson_xp = excluded.lesson_xp,
  node_kind = excluded.node_kind,
  retired = false;
