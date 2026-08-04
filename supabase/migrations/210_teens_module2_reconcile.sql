-- 210_teens_module2_reconcile.sql
-- Teens Foundations Module 2 (Charts 101) reconciliation (Lane H, owner call:
-- ADOPT the granular 9-part sequence).
--
-- State before: prod already pointed all nine Week-2 lesson rows at the granular
-- on-disk assets (w2l1-market ... w2l9-role-reversal), BUT the first two rows
-- still carried stale titles from the retired terse pair — including a visible
-- em-dash ("Reading Candles — One Battle at a Time") that also does not match
-- the asset it loads (the market/supply-demand intro).
--
-- This migration makes the DB titles agree with the assets they serve, so the
-- module reads as one clean, ordered micro-course. It re-asserts all nine rows
-- idempotently (title + asset path), keyed by lesson id, so re-running is safe
-- and the sequence is deterministic. Lesson count is unchanged (9). The orphaned
-- terse assets on disk (w2l1/, w2l2/) are removed in the same commit; nothing in
-- code or migrations referenced them.

update lessons set
  title = 'The Stock Market: How Buying & Selling Works',
  video_provider = 'html',
  video_id = '/lessons/SI/fic-teens-foundations/w2l1-market/index.html',
  node_kind = 'lesson', retired = false, sort_order = 0
where id = 'f1c00000-0002-0002-0001-000000000001';

update lessons set
  title = 'What Moves a Price: Supply & Demand',
  video_provider = 'html',
  video_id = '/lessons/SI/fic-teens-foundations/w2l2-supply-demand/index.html',
  node_kind = 'lesson', retired = false, sort_order = 1
where id = 'f1c00000-0002-0002-0002-000000000001';

update lessons set
  title = 'Technical Analysis: The Big Idea',
  video_provider = 'html',
  video_id = '/lessons/SI/fic-teens-foundations/w2l3-ta-big-idea/index.html',
  node_kind = 'lesson', retired = false, sort_order = 2
where id = 'f1c00000-0002-0002-0003-000000000001';

update lessons set
  title = 'Anatomy of a Candlestick',
  video_provider = 'html',
  video_id = '/lessons/SI/fic-teens-foundations/w2l4-candle-anatomy/index.html',
  node_kind = 'lesson', retired = false, sort_order = 3
where id = 'f1c00000-0002-0002-0004-000000000001';

update lessons set
  title = 'Reading a Candle: Who Won?',
  video_provider = 'html',
  video_id = '/lessons/SI/fic-teens-foundations/w2l5-reading-candles/index.html',
  node_kind = 'lesson', retired = false, sort_order = 4
where id = 'f1c00000-0002-0002-0005-000000000001';

update lessons set
  title = 'From Candles to Charts: Chart Types & Timeframes',
  video_provider = 'html',
  video_id = '/lessons/SI/fic-teens-foundations/w2l6-charts-timeframes/index.html',
  node_kind = 'lesson', retired = false, sort_order = 5
where id = 'f1c00000-0002-0002-0006-000000000001';

update lessons set
  title = 'Trend Structure: Higher Highs & Higher Lows',
  video_provider = 'html',
  video_id = '/lessons/SI/fic-teens-foundations/w2l7-trend-structure/index.html',
  node_kind = 'lesson', retired = false, sort_order = 6
where id = 'f1c00000-0002-0002-0007-000000000001';

update lessons set
  title = 'Support & Resistance: The Floor and the Ceiling',
  video_provider = 'html',
  video_id = '/lessons/SI/fic-teens-foundations/w2l8-support-resistance/index.html',
  node_kind = 'lesson', retired = false, sort_order = 7
where id = 'f1c00000-0002-0002-0008-000000000001';

update lessons set
  title = 'When Levels Break: Role Reversal & Breakouts',
  video_provider = 'html',
  video_id = '/lessons/SI/fic-teens-foundations/w2l9-role-reversal/index.html',
  node_kind = 'lesson', retired = false, sort_order = 8
where id = 'f1c00000-0002-0002-0009-000000000001';
