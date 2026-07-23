-- ============================================================================
-- 106 — Screener: FULL UNIVERSE (Lane 6 rebuild).
--
-- v1 (migration 105) filtered the universe to mcap ≥ $300M + a $10M dollar-volume
-- liquidity gate → 1,163 rows, 337 dropped for unknown mcap. Owner verdict: the
-- screener "feels too preset vs real screener" and "needs to search all stocks on
-- NYSE, AMEX and NASDAQ". This migration turns screener_metrics into a REAL
-- screen surface: every common stock (+ labeled ETFs) that trades on
-- XNYS / XNAS / XASE (plus ETF venues NYSE Arca / Cboe) lands here — ~8-11k rows.
--
-- Nothing is excluded for unknown market cap. mcap stays nullable: a row with an
-- unknown mcap simply can't match an mcap filter and renders "—". Market cap is
-- expensive (one ticker-details call each), so it is filled by a nightly
-- round-robin (oldest mcap_updated_at first, ~1500/night) rather than thousands
-- of calls in one shot — staleness is tracked honestly in mcap_updated_at.
--
-- Additive only: adds columns/indexes to the three existing tables. No data is
-- dropped by the migration itself (the cron/backfill repopulates the rows).
-- ============================================================================

-- ── screener_metrics: exchange, type, mcap staleness ─────────────────────────
alter table screener_metrics
  add column if not exists exchange        text,   -- 'NYSE' | 'NASDAQ' | 'AMEX' | 'NYSE Arca' | 'Cboe'
  add column if not exists type            text,   -- 'common' | 'etf'
  add column if not exists mcap_updated_at timestamptz; -- when mcap was last resolved (NULL = never)

create index if not exists idx_screener_exchange on screener_metrics(exchange);
create index if not exists idx_screener_type     on screener_metrics(type);
-- Round-robin enrichment picks the starest rows: oldest mcap_updated_at first,
-- NULLs (never enriched) ahead of everything.
create index if not exists idx_screener_mcap_updated
  on screener_metrics(mcap_updated_at asc nulls first);

-- ── screener_meta: report the universe by class ──────────────────────────────
alter table screener_meta
  add column if not exists common_count  integer,  -- rows where type = 'common'
  add column if not exists etf_count     integer,  -- rows where type = 'etf'
  add column if not exists mcap_count    integer;  -- rows with a resolved mcap (coverage numerator)
