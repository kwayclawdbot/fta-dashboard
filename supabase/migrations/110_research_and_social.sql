-- ============================================================================
-- 110 — Robust Ticker Research pages + Social-first layer (LANE 9).
--
-- Two concerns, one migration (they ship together per the plan):
--
--   A. research_fundamentals — a 24h-TTL cache of Polygon fundamentals per
--      ticker (income / balance / cash-flow highlights + a computed valuation
--      snapshot). The /api/research/[ticker] aggregate route fills it lazily
--      (service role) on first visit and re-reads it for 24h → zero repeat
--      Polygon spend. Grades are computed from this + screener_metrics.
--      A tiny definer RPC exposes in-house PE medians (sector + market) drawn
--      from whatever tickers we've already analysed — the PE-vs-Industry-vs-
--      Market chart is honestly "based on N companies we've studied", no vendor.
--
--   B. Social-first layer — one vote per member per ticker (forge-proof),
--      precomputed net-like counts (instant screener ♥ column + board
--      favourites), a typed-contribution chip on the canonical wiki thread,
--      and deduped like-milestone activity cards ("the club is warming up").
--
-- RLS posture (mirrors the repo scars): simple authenticated SELECT + app
-- gating; owner-only writes forced by `user_id = auth.uid()`; cross-surface
-- aggregation via SECURITY DEFINER RPCs / precomputed counters — never N+1.
-- Purely additive: no existing object is dropped.
-- ============================================================================

-- ─────────────────────────────────────────────────────────────────────────────
-- A. research_fundamentals — 24h-cached fundamentals + valuation snapshot
-- ─────────────────────────────────────────────────────────────────────────────
-- `data` jsonb holds the chart-ready arrays the model never touches:
--   { quarterly: [{label, revenue, netIncome, grossProfit, operatingIncome,
--                  eps, assets, liabilities, equity, currentAssets,
--                  currentLiabilities, opCashFlow}],
--     annual:    [{label, revenue, netIncome, eps}],
--     dividends: [{exDate, cashAmount}],
--     ttm: { revenue, netIncome, eps } }
-- The flat columns (pe/ps/pb/peg/div_yield/eps_ttm/rev_ttm/ni_ttm/equity) are
-- lifted out so the median RPC and key-stats read them without unpacking jsonb.
-- Valuation is computed from mcap AT FETCH TIME (stable within the 24h window);
-- the page labels market data delayed. `insufficient` flags a ticker whose
-- financials Polygon does not serve (many small-caps / ETFs) so the UI shows an
-- honest "not enough data" state instead of faking grades.
create table if not exists research_fundamentals (
  ticker        text primary key,
  company_name  text,
  sector        text,
  exchange      text,
  homepage      text,
  address       text,
  employees     bigint,
  list_date     date,
  mcap          numeric,
  price         numeric,          -- delayed quote captured at fetch (for reference)
  pe            numeric,          -- mcap / TTM net income   (null if not computable)
  ps            numeric,          -- mcap / TTM revenue
  pb            numeric,          -- mcap / total equity
  peg           numeric,          -- pe / earnings-growth %  (null if not computable)
  div_yield     numeric,          -- trailing 12m dividends / price (%)
  eps_ttm       numeric,
  rev_ttm       numeric,
  ni_ttm        numeric,
  equity        numeric,
  insufficient  boolean not null default false, -- true = Polygon served no usable financials
  data          jsonb   not null default '{}'::jsonb,
  grade_version integer,          -- src/lib/research/grades.ts GRADE_VERSION at fetch
  fetched_at    timestamptz not null default now()
);

-- Median RPC scans by sector; freshness sweep picks the stalest first.
create index if not exists idx_research_fund_sector  on research_fundamentals(sector);
create index if not exists idx_research_fund_fetched  on research_fundamentals(fetched_at);
create index if not exists idx_research_fund_pe
  on research_fundamentals(pe) where pe is not null;

alter table research_fundamentals enable row level security;
-- Read: any authenticated member (free tier gated in-app). Only the aggregate
-- route (service role, bypasses RLS) writes.
drop policy if exists "Read research fundamentals" on research_fundamentals;
create policy "Read research fundamentals" on research_fundamentals
  for select to authenticated using (true);

-- In-house PE medians for the PE-vs-Industry-vs-Market chart. SECURITY DEFINER
-- so it can aggregate across every analysed ticker regardless of who visited it.
-- Sanity-bounded (0 < pe < 1000) so a single outlier can't distort the median.
-- Honest sample sizes returned so the UI can say "based on N companies".
create or replace function public.research_pe_medians(p_sector text)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'sector_median', (
      select percentile_cont(0.5) within group (order by pe)
      from research_fundamentals
      where sector is not distinct from p_sector and pe > 0 and pe < 1000
    ),
    'sector_n', (
      select count(*) from research_fundamentals
      where sector is not distinct from p_sector and pe > 0 and pe < 1000
    ),
    'market_median', (
      select percentile_cont(0.5) within group (order by pe)
      from research_fundamentals where pe > 0 and pe < 1000
    ),
    'market_n', (
      select count(*) from research_fundamentals where pe > 0 and pe < 1000
    )
  );
$$;
grant execute on function public.research_pe_medians(text) to authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- B1. ticker_sentiment — one forge-proof vote per member per ticker
-- ─────────────────────────────────────────────────────────────────────────────
-- vote: 1 = 👍 "Like" · -1 = 👎 "Not for me". Composite PK (user_id, ticker)
-- makes a second vote physically impossible; the owner-check policies force
-- user_id = auth.uid() on every write so a vote can never be forged for another
-- member. Changeable (update) + removable (delete) by the owner. No XP anywhere.
create table if not exists ticker_sentiment (
  user_id    uuid not null references profiles(id) on delete cascade,
  ticker     text not null,
  vote       smallint not null check (vote in (-1, 1)),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, ticker)
);
create index if not exists idx_ticker_sentiment_ticker on ticker_sentiment(ticker);
-- 7-day "warming up" window reads recent likes by created_at.
create index if not exists idx_ticker_sentiment_recent
  on ticker_sentiment(ticker, created_at) where vote = 1;

alter table ticker_sentiment enable row level security;
drop policy if exists "Read ticker sentiment" on ticker_sentiment;
create policy "Read ticker sentiment" on ticker_sentiment
  for select to authenticated using (true);
drop policy if exists "Insert own ticker sentiment" on ticker_sentiment;
create policy "Insert own ticker sentiment" on ticker_sentiment
  for insert to authenticated with check (user_id = auth.uid());
drop policy if exists "Update own ticker sentiment" on ticker_sentiment;
create policy "Update own ticker sentiment" on ticker_sentiment
  for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
drop policy if exists "Delete own ticker sentiment" on ticker_sentiment;
create policy "Delete own ticker sentiment" on ticker_sentiment
  for delete to authenticated using (user_id = auth.uid());

-- ─────────────────────────────────────────────────────────────────────────────
-- B2. ticker_like_counts — the precomputed aggregate (instant reads everywhere)
-- ─────────────────────────────────────────────────────────────────────────────
-- Authoritative net-like counter, maintained by a trigger on ticker_sentiment.
-- Every surface (screener column mirror, board favourites strip, research page)
-- reads counts from here — never a per-row aggregate over ticker_sentiment.
create table if not exists ticker_like_counts (
  ticker     text primary key,
  likes      integer not null default 0,
  unlikes    integer not null default 0,
  net        integer not null default 0,   -- likes - unlikes
  updated_at timestamptz not null default now()
);
create index if not exists idx_ticker_like_counts_net on ticker_like_counts(net desc);

alter table ticker_like_counts enable row level security;
drop policy if exists "Read ticker like counts" on ticker_like_counts;
create policy "Read ticker like counts" on ticker_like_counts
  for select to authenticated using (true);

-- like_count mirror on screener_metrics so the ♥ column sorts natively (native
-- indexed column beats a join for a wide result set). Kept in sync by the same
-- trigger; a nightly reconciliation also lives in the screener cron.
alter table screener_metrics
  add column if not exists like_count integer not null default 0;
create index if not exists idx_screener_like_count on screener_metrics(like_count desc);

-- Dedup ledger for like-milestone activity cards (10 / 25 / 50 net, once each).
create table if not exists ticker_like_milestones (
  ticker    text not null,
  milestone integer not null,      -- 10 | 25 | 50
  fired_at  timestamptz not null default now(),
  primary key (ticker, milestone)
);
alter table ticker_like_milestones enable row level security;
drop policy if exists "Read ticker like milestones" on ticker_like_milestones;
create policy "Read ticker like milestones" on ticker_like_milestones
  for select to authenticated using (true);

-- ── Trigger: recompute counts, mirror to screener, fire deduped milestones ────
create or replace function public.ticker_sentiment_sync()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ticker   text := coalesce(new.ticker, old.ticker);
  v_likes    integer;
  v_unlikes  integer;
  v_net      integer;
  v_company  text;
  v_ms       integer;
begin
  select
    count(*) filter (where vote = 1),
    count(*) filter (where vote = -1)
  into v_likes, v_unlikes
  from ticker_sentiment where ticker = v_ticker;

  v_net := v_likes - v_unlikes;

  insert into ticker_like_counts (ticker, likes, unlikes, net, updated_at)
    values (v_ticker, v_likes, v_unlikes, v_net, now())
  on conflict (ticker) do update
    set likes = excluded.likes, unlikes = excluded.unlikes,
        net = excluded.net, updated_at = now();

  -- Mirror onto the screener row if the ticker is in the screen universe.
  update screener_metrics set like_count = greatest(v_net, 0) where ticker = v_ticker;

  -- Deduped like-milestone activity card. Only fires crossing UP through a
  -- threshold; each threshold fires at most once ever (ledger PK).
  for v_ms in select unnest(array[10, 25, 50]) loop
    if v_net >= v_ms
       and not exists (select 1 from ticker_like_milestones m
                        where m.ticker = v_ticker and m.milestone = v_ms) then
      insert into ticker_like_milestones (ticker, milestone) values (v_ticker, v_ms);

      select coalesce(
        (select company_name from research_fundamentals where ticker = v_ticker),
        (select company_name from community_watchlist where ticker = v_ticker
           order by created_at limit 1),
        (select name from screener_metrics where ticker = v_ticker),
        v_ticker
      ) into v_company;

      insert into feed_posts (author_id, family_id, kind, body, activity_payload)
      values (
        null, null, 'activity',
        'The club is warming up to ' || v_ticker,
        jsonb_build_object(
          'type', 'ticker_like_milestone',
          'icon', 'heart',
          'ticker', v_ticker,
          'company_name', v_company,
          'net', v_net,
          'milestone', v_ms,
          'actor_name', 'The club',
          'family_name', null
        )
      );
    end if;
  end loop;

  return coalesce(new, old);
exception when others then
  -- Never let counter/feed bookkeeping fail a member's vote.
  return coalesce(new, old);
end;
$$;

drop trigger if exists trg_ticker_sentiment_sync on ticker_sentiment;
create trigger trg_ticker_sentiment_sync
  after insert or update or delete on ticker_sentiment
  for each row execute function public.ticker_sentiment_sync();

-- ── B3. typed contribution chip on the canonical wiki thread ──────────────────
-- Additive column on the EXISTING per-ticker research thread (097). Never a
-- parallel comment system — one thread per ticker everywhere. Default 'note'.
alter table community_ticker_comments
  add column if not exists contribution_type text not null default 'note'
    check (contribution_type in ('note', 'thesis', 'risk', 'news', 'chart', 'question'));

-- ── B4. get_ticker_social(ticker) — one round-trip social snapshot ────────────
-- Returns the counts the hero social bar + "N of M members like this" line need,
-- plus the caller's own vote. SECURITY DEFINER so contributor identity resolves
-- without widening profiles RLS. member_total = active community size for the
-- "N of M" denominator (paid members — the audience that can vote).
create or replace function public.get_ticker_social(p_ticker text)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'ticker', p_ticker,
    'likes',        coalesce((select likes   from ticker_like_counts where ticker = p_ticker), 0),
    'unlikes',      coalesce((select unlikes from ticker_like_counts where ticker = p_ticker), 0),
    'net',          coalesce((select net     from ticker_like_counts where ticker = p_ticker), 0),
    'my_vote',      (select vote from ticker_sentiment
                       where ticker = p_ticker and user_id = auth.uid()),
    'comment_count',(select count(*) from community_ticker_comments where ticker = p_ticker),
    'contributors', (select count(distinct user_id) from community_ticker_comments
                       where ticker = p_ticker and user_id is not null),
    'member_total', (select count(*) from profiles where role <> 'admin')
  );
$$;
grant execute on function public.get_ticker_social(text) to authenticated;

-- ── B5. community_favorites(window, limit) — top liked tickers strip ──────────
-- 'all'  → top by current net likes (ticker_like_counts).
-- '7d'   → top by count of NEW like votes in the trailing 7 days (fresh warmth;
--          stateful votes make a true windowed "net" ill-defined, so recent
--          enthusiasm is the honest window metric — mirrors the leaderboard
--          windowed-RPC pattern). Company name resolved cheaply from the board /
--          fundamentals / screener. SECURITY DEFINER for cross-family names.
create or replace function public.community_favorites(
  p_window text default 'all',
  p_limit  integer default 5
)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  with ranked as (
    select t.ticker, t.score
    from (
      select case when p_window = '7d' then s.ticker else c.ticker end as ticker,
             case when p_window = '7d' then s.recent_likes else c.net end as score
      from ticker_like_counts c
      full join (
        select ticker, count(*)::int as recent_likes
        from ticker_sentiment
        where vote = 1 and created_at >= now() - interval '7 days'
        group by ticker
      ) s on s.ticker = c.ticker
    ) t
    where t.score > 0
    order by t.score desc
    limit greatest(p_limit, 1)
  )
  select coalesce(jsonb_agg(jsonb_build_object(
    'ticker', r.ticker,
    'score', r.score,
    'net', coalesce((select net from ticker_like_counts where ticker = r.ticker), 0),
    'company_name', coalesce(
      (select company_name from research_fundamentals where ticker = r.ticker),
      (select company_name from community_watchlist where ticker = r.ticker order by created_at limit 1),
      (select name from screener_metrics where ticker = r.ticker),
      r.ticker
    )
  ) order by r.score desc), '[]'::jsonb)
  from ranked r;
$$;
grant execute on function public.community_favorites(text, integer) to authenticated;

-- ── B6. reconcile_screener_likes() — nightly cron safety net ──────────────────
-- The trigger keeps screener_metrics.like_count live on every vote; this makes
-- the screener column eventually-consistent even if a trigger ever no-ops or a
-- ticker enters the universe after it was already liked. One set-based UPDATE,
-- called from /api/cron/refresh-screener (service role).
create or replace function public.reconcile_screener_likes()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer;
begin
  update screener_metrics s
    set like_count = greatest(coalesce(c.net, 0), 0)
  from ticker_like_counts c
  where c.ticker = s.ticker
    and s.like_count is distinct from greatest(coalesce(c.net, 0), 0);
  get diagnostics v_count = row_count;
  -- Zero out rows whose likes were fully removed.
  update screener_metrics s set like_count = 0
  where s.like_count > 0
    and not exists (select 1 from ticker_like_counts c where c.ticker = s.ticker and c.net > 0);
  return v_count;
end;
$$;
grant execute on function public.reconcile_screener_likes() to service_role;
