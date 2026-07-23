-- ============================================================================
-- 105 — Stock Screener (LANE 6).
--
-- Members discover new picks in-app; the screener feeds the community-watchlist
-- pipeline (row actions: Add to family watchlist / Suggest to community /
-- Research). Zero per-user Polygon load: a nightly Vercel cron
-- (/api/cron/refresh-screener, CRON_SECRET) computes every metric ONCE into
-- screener_metrics; the UI just SELECTs + filters the table → instant.
--
-- Three tables:
--   1. screener_metrics  — one row per universe ticker; everything the UI reads.
--   2. screener_history  — compact daily {close, volume} per ticker; the raw
--      series the indicator math (chg windows, RSI14, EMA20/50, range hi/lo)
--      is recomputed from. Steady-state the cron appends ONE day (from a single
--      grouped-daily call) and recomputes; bootstrap fills ~70 days.
--   3. screener_meta      — single-row refresh metadata (last run, universe size,
--      how many rows were excluded for unknown mcap, bootstrap flag, note).
--
-- RLS posture (mirrors ticker_snapshots in 097): authenticated SELECT on all
-- three; NO authenticated write policy — only the cron (service role, bypasses
-- RLS) writes. Free tier is gated in the UI (LockedState), never queried here.
-- Purely additive: no existing object is altered or dropped.
-- ============================================================================

-- ── 1. screener_metrics — the queryable screen surface ───────────────────────
-- dist_52w_high / dist_52w_low are % distance from the trailing-window high/low
-- (negative below high / positive above low). The window is whatever history
-- has accumulated: ~48 trading days after a 70-calendar-day bootstrap, extending
-- toward a true 52-week high/low as the daily cron accrues rows (history is
-- retained up to ~260 trading days). Honestly labelled in the UI.
-- ema20_state / ema50_state: 'above' | 'below' | 'unknown' — price vs the EMA.
create table if not exists screener_metrics (
  ticker         text primary key,
  name           text,
  sector         text,
  mcap           numeric,          -- market cap (USD) from ticker details
  price          numeric,          -- latest daily close
  chg_1d         numeric,          -- % vs prior close
  chg_5d         numeric,          -- % vs 5 trading days ago
  chg_1m         numeric,          -- % vs ~21 trading days ago
  chg_3m         numeric,          -- % vs ~63 trading days ago
  vol            bigint,           -- latest daily volume
  avg_vol_20     numeric,          -- mean volume, last 20 trading days
  vol_ratio      numeric,          -- vol / avg_vol_20 (surge detector)
  dist_52w_high  numeric,          -- % from trailing-window high (<= 0 near high)
  dist_52w_low   numeric,          -- % above trailing-window low (>= 0)
  rsi14          numeric,          -- Wilder RSI(14) on closes
  ema20_state    text,             -- 'above' | 'below' | 'unknown'
  ema50_state    text,             -- 'above' | 'below' | 'unknown'
  gap_pct        numeric,          -- % latest open vs prior close
  updated_at     timestamptz not null default now()
);

-- Filter/sort helpers (the presets lean on these).
create index if not exists idx_screener_mcap        on screener_metrics(mcap desc);
create index if not exists idx_screener_sector      on screener_metrics(sector);
create index if not exists idx_screener_chg_1d      on screener_metrics(chg_1d desc);
create index if not exists idx_screener_chg_1m      on screener_metrics(chg_1m desc);
create index if not exists idx_screener_vol_ratio   on screener_metrics(vol_ratio desc);
create index if not exists idx_screener_rsi         on screener_metrics(rsi14);
create index if not exists idx_screener_dist_high   on screener_metrics(dist_52w_high desc);

alter table screener_metrics enable row level security;
-- Read: any authenticated member (free tier gated in-app). Only the cron writes.
drop policy if exists "Read screener metrics" on screener_metrics;
create policy "Read screener metrics" on screener_metrics
  for select to authenticated using (true);

-- ── 2. screener_history — compact daily series for the indicator math ────────
create table if not exists screener_history (
  ticker     text not null,
  as_of      date not null,
  close      numeric not null,
  volume     bigint,
  created_at timestamptz not null default now(),
  primary key (ticker, as_of)
);
create index if not exists idx_screener_history_ticker
  on screener_history(ticker, as_of desc);
create index if not exists idx_screener_history_asof
  on screener_history(as_of);

alter table screener_history enable row level security;
-- History is an internal computation substrate; members never need it, but a
-- benign authenticated SELECT keeps posture uniform. Only the cron writes.
drop policy if exists "Read screener history" on screener_history;
create policy "Read screener history" on screener_history
  for select to authenticated using (true);

-- ── 3. screener_meta — single-row refresh metadata ──────────────────────────
-- id is a constant true so there is exactly one row (upsert on conflict).
create table if not exists screener_meta (
  id                     boolean primary key default true,
  last_run_at            timestamptz,
  last_trading_day       date,
  universe_count         integer,
  unknown_mcap_excluded  integer,
  history_days           integer,        -- trailing-window depth (trading days)
  bootstrap_done         boolean not null default false,
  note                   text,
  constraint screener_meta_singleton check (id = true)
);

alter table screener_meta enable row level security;
drop policy if exists "Read screener meta" on screener_meta;
create policy "Read screener meta" on screener_meta
  for select to authenticated using (true);

insert into screener_meta (id, note)
  values (true, 'awaiting first bootstrap')
  on conflict (id) do nothing;
