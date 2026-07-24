-- ============================================================================
-- 117 — In-house News section: "Club Newsroom" (LANE 10).
--
-- Grounded market-data narration + curated external links — NOT journalism.
-- Every article is honestly labelled AI-generated and carries an
-- educational-not-advice footer (enforced in the UI, not the schema).
--
-- Inputs already owned: Polygon news (Ask Kai's news_headlines plumbing),
-- screener_metrics / screener_history deltas (movers / vol-surges / 52w
-- crossings across the full universe), and the Lane-4 Kai generation pipeline
-- (grounded structured output). Two article families:
--
--   * market_wrap  — 2x/day (pre-open + post-close), one sonnet-5 article:
--     indices, sector rotation (computed from our own universe), top movers.
--   * ticker_event — daily post-close, top 6-8 notable events ranked from
--     screener deltas, each a short haiku-4.5 note grounded in the metric +
--     any matching Polygon headline. One row per event, tickers[]-tagged.
--   * sector_spotlight — reserved (weekly, phase 2). Enum allows it now.
--
-- RLS posture (mirrors the repo scars): any AUTHENTICATED member READS
-- (the newsroom is free-visible funnel-bait — free members are authenticated,
-- so no per-tier gate here; research-page deep links hit existing gates).
-- No member WRITE policy: articles are written by the CRON_SECRET-gated
-- generation routes using the service role, which bypasses RLS.
-- Purely additive: no existing object is dropped.
-- ============================================================================

create table if not exists news_articles (
  id            uuid primary key default gen_random_uuid(),
  slug          text not null unique,          -- stable per (kind, day[, slot])
  kind          text not null
                  check (kind in ('market_wrap', 'ticker_event', 'sector_spotlight')),
  title         text not null,
  dek           text,                          -- one-line summary under the title
  sections      jsonb not null default '{}'::jsonb,  -- { blocks: [...] } — see src/lib/news
  tickers       text[] not null default '{}',  -- uppercase symbols this story is about
  model         text,                          -- provenance: which model wrote it
  published     boolean not null default true,
  generated_at  timestamptz not null default now(),
  created_at    timestamptz not null default now()
);

-- Feed ordering: newest published first.
create index if not exists idx_news_published
  on news_articles(published, generated_at desc);
-- Kind filter chips on the feed.
create index if not exists idx_news_kind
  on news_articles(kind, generated_at desc);
-- "From the Club Newsroom" per-ticker group on the research page + ticker filter.
create index if not exists idx_news_tickers
  on news_articles using gin(tickers);

alter table news_articles enable row level security;

-- Read: any authenticated member (free tier included — newsroom is funnel-bait).
drop policy if exists "Read news articles" on news_articles;
create policy "Read news articles" on news_articles
  for select to authenticated using (published);
-- No INSERT/UPDATE/DELETE policy: generation is service-role only (cron routes).

-- ─────────────────────────────────────────────────────────────────────────────
-- news_sector_rotation() — sector-average day move across the large-cap
-- universe, computed IN-HOUSE from screener_metrics (no vendor). Feeds the
-- market-wrap generation's "sector rotation" grounding. Definer so the whole
-- universe is aggregated in one instant SQL group-by (never N+1 client-side).
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.news_sector_rotation()
returns table(sector text, avg_chg numeric, n bigint)
language sql
stable
security definer
set search_path = public
as $$
  select sector, round(avg(chg_1d)::numeric, 2) as avg_chg, count(*) as n
  from screener_metrics
  where type = 'common'
    and mcap >= 1e9
    and chg_1d is not null
    and sector is not null
  group by sector
  having count(*) >= 3
  order by avg(chg_1d) desc
$$;

grant execute on function public.news_sector_rotation() to authenticated, service_role;
