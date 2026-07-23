-- 107_tour_version.sql — App Tour v2 versioning (Lane 7B).
--
-- The app was substantially redesigned (full-width Community + Club Chat drawer,
-- Community Watchlist, Screener, Leaderboard + belts, Ask Kai, Practice/Simbot,
-- the FTA section). The old tour (v1, migration 041) walked the pre-redesign
-- nav, so every member who completed it should see the refreshed tour ONCE with
-- "see what's new" framing.
--
-- tour_completed_at (041) is kept as-is. tour_version records WHICH tour a member
-- has seen: brand-new members start at 0, the v2 tour writes 2 on completion.
-- AppTour re-fires for members whose tour_completed_at is set but tour_version < 2,
-- exactly once, then stamps 2 so it never re-imposes.
--
-- profiles UPDATE-own-row policy (039) already covers the write.

alter table public.profiles
  add column if not exists tour_version int not null default 0;

comment on column public.profiles.tour_version is
  'Highest AppTour version the member has completed. 0 = never / pre-v2 (041 tour). Bumped to the current tour version on completion so redesigns can re-fire the tour once.';
