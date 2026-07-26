-- ============================================================================
-- 171 — Seed the FIVE Sept 2–6 challenge webinars as the first live_events.
--
-- The five daily LIVE sessions of the 5-Day Investing Challenge run
--   Wed Sept 2 → Sun Sept 6, 2026, 7:00 PM ET each evening.
-- September is EDT (UTC-4), so 7:00 PM ET == 23:00 UTC (verified). Titles mirror
-- the challenge-sequence email calendar (src/lib/server/challenge-sequence-emails.ts):
--   Day 1 — Your first practice watchlist
--   Day 2 — Research with Kai
--   Day 3 — The Community Watchlist
--   Day 4 — Screener & practice
--   Day 5 — Putting it all together
--
-- room_type 'class'. join_url is NULL by design — the owner supplies the webinar
-- links later; the card renders a graceful "Link coming" state until then.
-- Replays are a VIP-only perk (C9-VIP-TICKET-PLAN, ratified) — noted in each
-- description. Fixed UUIDs make this seed idempotent (ON CONFLICT DO NOTHING).
-- ============================================================================

insert into live_events
  (id, status, room_type, title, description, tickers, host_name, starts_at, duration_min)
values
  ('a5100000-0000-4000-8000-000000000001', 'scheduled', 'class',
   'Day 1 — Your first practice watchlist',
   'Night one of the 5-Day Investing Challenge. We go live together at 7:00 PM ET and build something real you keep: your very first practice watchlist — a short list of companies you want to follow. No experience needed; we learn in the room. Replay available to VIP members.',
   '{}', 'Cheat Code Club', '2026-09-02 23:00:00+00', 60),

  ('a5100000-0000-4000-8000-000000000002', 'scheduled', 'class',
   'Day 2 — Research with Kai',
   'Day two, live at 7:00 PM ET. We get to know one company together — with Kai — so you learn how to actually read a stock instead of guessing. Bring the watchlist you built on Day 1. Replay available to VIP members.',
   '{}', 'Cheat Code Club', '2026-09-03 23:00:00+00', 60),

  ('a5100000-0000-4000-8000-000000000003', 'scheduled', 'class',
   'Day 3 — The Community Watchlist',
   'Day three, live at 7:00 PM ET. We plug into what the whole room is watching and learn to lean on the community watchlist — the smartest-together edge of the Club. Replay available to VIP members.',
   '{}', 'Cheat Code Club', '2026-09-04 23:00:00+00', 60),

  ('a5100000-0000-4000-8000-000000000004', 'scheduled', 'class',
   'Day 4 — Screener & practice',
   'Day four, live at 7:00 PM ET. So far we researched names you already knew — tonight we learn to FIND new ones with the screener and practice acting on an idea with zero real money at risk. Replay available to VIP members.',
   '{}', 'Cheat Code Club', '2026-09-05 23:00:00+00', 60),

  ('a5100000-0000-4000-8000-000000000005', 'scheduled', 'class',
   'Day 5 — Putting it all together',
   'The finale, live at 7:00 PM ET. We connect the five nights into one repeatable routine you keep for good — watchlist, research, community, screening, practice. Replay available to VIP members.',
   '{}', 'Cheat Code Club', '2026-09-06 23:00:00+00', 60)
on conflict (id) do nothing;
