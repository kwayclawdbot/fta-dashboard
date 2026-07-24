-- 132 — Community feed: ticker tags + bull/neutral/bear positioning (LANE R5)
--
-- Additive only. A member post can now be tagged with one or more tickers and
-- carry an optional positioning stance. This powers the R5 Community tabs:
--   • Research     — posts that tag a ticker (typed contributions stream)
--   • Discussions  — ticker threads (grouped by tag)
-- and the ticker research-page community aggregation header
-- (N watching · discussions this week · % bullish).
--
-- Positioning is EDUCATION-FIRST sentiment ("how the family is leaning"), never
-- a trade instruction. Kept off price/performance data (owner teal rule is
-- unaffected — this is a stance chip, not a price color).

alter table feed_posts
  add column if not exists ticker_tags text[] not null default '{}';

alter table feed_posts
  add column if not exists position text
  check (position is null or position in ('bull', 'neutral', 'bear'));

-- GIN index so "posts tagging $TICKER" (contains / @>) stays cheap as the feed
-- grows — used by Discussions grouping and the per-ticker discussion count.
create index if not exists idx_feed_posts_ticker_tags
  on feed_posts using gin (ticker_tags);

comment on column feed_posts.ticker_tags is
  'Uppercase tickers this post references (R5). Drives Research/Discussions tabs and per-ticker discussion counts.';
comment on column feed_posts.position is
  'Optional education-first stance: bull | neutral | bear. Never a trade instruction; never price-colored.';

-- Per-ticker community aggregation for the research-page header (R5).
-- Counts sit on top of ticker_sentiment (👍/👎 net) + ticker-tagged feed posts.
-- SECURITY DEFINER so counts are consistent regardless of the caller's RLS view
-- of individual rows; returns only aggregates, never row content.
create or replace function public.get_ticker_community_stats(p_ticker text)
returns table (
  watching int,          -- distinct 👍 voters (interest proxy)
  discussions_week int,  -- ticker-tagged posts in the last 7 days
  bull int,              -- positioned posts (all-time) leaning bull
  neutral int,
  bear int,
  positioned int         -- bull+neutral+bear (denominator for % bullish)
)
language sql
stable
security definer
set search_path = public
as $$
  with tk as (select upper(p_ticker) as t)
  select
    coalesce((
      select count(*)::int
      from ticker_sentiment ts, tk
      where upper(ts.ticker) = tk.t and ts.vote = 1
    ), 0) as watching,
    coalesce((
      select count(*)::int
      from feed_posts fp, tk
      where tk.t = any (array(select upper(x) from unnest(fp.ticker_tags) x))
        and fp.created_at >= now() - interval '7 days'
    ), 0) as discussions_week,
    coalesce((
      select count(*)::int from feed_posts fp, tk
      where fp.position = 'bull'
        and tk.t = any (array(select upper(x) from unnest(fp.ticker_tags) x))
    ), 0) as bull,
    coalesce((
      select count(*)::int from feed_posts fp, tk
      where fp.position = 'neutral'
        and tk.t = any (array(select upper(x) from unnest(fp.ticker_tags) x))
    ), 0) as neutral,
    coalesce((
      select count(*)::int from feed_posts fp, tk
      where fp.position = 'bear'
        and tk.t = any (array(select upper(x) from unnest(fp.ticker_tags) x))
    ), 0) as bear,
    coalesce((
      select count(*)::int from feed_posts fp, tk
      where fp.position is not null
        and tk.t = any (array(select upper(x) from unnest(fp.ticker_tags) x))
    ), 0) as positioned;
$$;

grant execute on function public.get_ticker_community_stats(text) to authenticated, anon;
