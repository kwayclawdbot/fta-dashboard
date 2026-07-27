-- ============================================================================
-- 195 — WATCH / ALERTS canvas adoption (lane M3). Two real gaps, both of which
-- the canvas boards demand and neither of which had any backing data.
--
--   A. "3 NEW"  (canvas board 18 · Watch · Kai Alerts)
--      The hub had NO notion of what a member had already seen. The badge could
--      only ever have been a decoration. This adds ONE watermark column to the
--      per-member prefs row the hub already reads and writes — not a per-event
--      read receipt, because the honest question the badge answers is "what has
--      landed since I last opened this", which one timestamp answers exactly.
--
--   B. "Opinion Changes · N tickers shifted today"  (canvas board 06 · Watch)
--      ticker_sentiment already records a member CHANGING their mind (updated_at
--      moves past created_at on an UPDATE), but nothing could read it: there was
--      no index on updated_at and no aggregate. A per-ticker aggregate is added
--      as a SECURITY DEFINER function so the surface can say how many companies
--      the club re-thought without ever exposing WHO changed their vote.
--
-- No table is created and no policy is widened. Both additions are read paths
-- over data the app already stores.
-- ============================================================================

-- ── A. hub watermark ─────────────────────────────────────────────────────────
-- NULL = never opened the hub, which the UI must render as "everything is new
-- to you", not as zero. Owner RLS on alert_prefs ("Own alert prefs", FOR ALL)
-- already covers the write; the member can only ever stamp their own row.
alter table alert_prefs
  add column if not exists hub_seen_at timestamptz;

comment on column alert_prefs.hub_seen_at is
  'Last time this member opened the Kai Watch hub. Drives the honest "N new" count on /alerts; NULL means never opened.';

-- ── B. opinion changes ───────────────────────────────────────────────────────
-- The 24h window scans by updated_at, which had no index (the two existing
-- indexes are on ticker and on created_at).
create index if not exists idx_ticker_sentiment_updated
  on ticker_sentiment(updated_at desc);

-- Tickers the club RE-THOUGHT inside the window: rows whose updated_at has moved
-- past created_at (a vote that was changed, never a first vote). Returns counts
-- only — no user_id, no per-member vote, nothing that could out an individual's
-- position. STABLE + SECURITY DEFINER so it reads the whole table regardless of
-- the caller, and EXECUTE is granted to authenticated members only.
create or replace function public.get_stance_shifts(p_hours int default 24)
returns table (ticker text, shifts bigint, net_now bigint)
language sql
stable
security definer
set search_path = public
as $$
  select
    s.ticker,
    count(*)                                   as shifts,
    coalesce(sum(s.vote)::bigint, 0)           as net_now
  from ticker_sentiment s
  where s.updated_at >= now() - make_interval(hours => greatest(1, least(168, p_hours)))
    and s.updated_at > s.created_at + interval '1 second'
  group by s.ticker
  order by count(*) desc, s.ticker
  limit 25;
$$;

revoke all on function public.get_stance_shifts(int) from public, anon;
grant execute on function public.get_stance_shifts(int) to authenticated;

comment on function public.get_stance_shifts(int) is
  'Aggregate-only read of members changing their mind on a ticker within the window. Counts, never identities.';
