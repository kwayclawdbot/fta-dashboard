-- 085 — Free sampler: mark three live lessons free
--
-- The free-tier journey (owner ask 2026-07-22): free families "get the tools,
-- gate the guidance." Courses are a locked door with a small window — a THREE
-- lesson sampler that is fully playable (XP + quiz via the existing lesson
-- bridge), with the rest of the catalog visible as locked cards + upgrade CTA.
--
-- `is_free` is the ONE app-level signal. Content-read RLS is already
-- authenticated-wide (migrations 039/040), so gating stays at the app layer
-- consistent with the platform posture; the lesson route additionally enforces
-- this check server-side so deep links can't bypass it.
--
-- The three chosen (strongest, high-polish, cross-track sampler):
--   1. adult W1L1  — "Why Invest — The Power of Compounding"  (the emotional
--      hook; the strongest opener in the adult foundations track)
--   2. teen  W2    — "Anatomy of a Candlestick"               (the polished
--      visual exemplar; the required teen candlestick lesson)
--   3. adult W1L2  — "What a Stock Is & How the Market Works"  (completes the
--      adult foundations mini-arc; broad, high value, own-track for the parent)

alter table lessons add column if not exists is_free boolean not null default false;

update lessons set is_free = true
where id in (
  'f1c00000-0001-0001-0001-000000000001',  -- adult W1L1  Why Invest — Compounding
  'f1c00000-0001-0001-0002-000000000001',  -- adult W1L2  What a Stock Is
  'f1c00000-0002-0002-0004-000000000001'   -- teen  W2    Anatomy of a Candlestick
);
