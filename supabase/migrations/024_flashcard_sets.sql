-- 024_flashcard_sets.sql — flashcard SETS + visual card fronts.
-- Adds a set grouping to every flashcard and an optional visual payload
-- (hand-crafted OHLC + S/R levels) used to DRAW pattern cards on the client.
--
-- The 306 existing cards all become set_slug='foundations' (still week-organized
-- within the set). Two new visual sets — 'candlestick-patterns' and
-- 'chart-patterns' — are seeded by scripts/seed-flashcard-sets.mjs
-- (recorded in 025_seed_flashcard_visual_sets.sql).
alter table public.flashcards
  add column if not exists set_slug text not null default 'foundations',
  add column if not exists visual jsonb;

create index if not exists idx_flashcards_set on public.flashcards(set_slug, track, week);

-- All existing cards belong to the Foundations set (still week-organized).
update public.flashcards set set_slug = 'foundations' where set_slug is null;
