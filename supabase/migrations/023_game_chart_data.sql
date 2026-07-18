-- 023_game_chart_data.sql
-- Adds a deterministic, data-true chart path to each game_items round so the
-- games can animate a real candle (candle-battle) or a real mini candlestick
-- chart (trend-or-trap) instead of showing text-only prompts.
--
-- Shape of chart_data (jsonb):
--   candle-battle:  { "kind":"candle", "o":num,"h":num,"l":num,"c":num,
--                     "path":[num,...], "decisionAt":0..1 }
--   trend-or-trap:  { "kind":"series",
--                     "candles":[{"o":,"h":,"l":,"c":},...],
--                     "decisionIndex":int }
-- Paths are generated offline by scripts/seed-chart-data.mjs (seeded PRNG from
-- the item id) and written by 023_chart_data_seed.sql. This migration only adds
-- the nullable column; the client falls back to a generated path if ever null.

alter table public.game_items
  add column if not exists chart_data jsonb;
