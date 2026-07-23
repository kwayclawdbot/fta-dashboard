-- ============================================================================
-- 098 — Retire Team Picks into the Community Watchlist.
--
-- The seeded real AAPL moat pick's CONTENT is migrated verbatim into
-- community_watchlist as an admin ("our research") entry. The owner's stray
-- draft ("this is the pick") is deleted. fic_picks + the old AAPL row are left
-- in place (no longer surfaced; /picks redirects) so no history is lost and the
-- 092 pick triggers stay valid. pick_comments count was 0 → nothing to migrate.
--
-- The admin-pick notification trigger (097) is disabled around the insert so
-- migrating existing content does NOT blast a "New research pick: AAPL" push to
-- every paying member.
-- ============================================================================

alter table community_watchlist disable trigger trg_community_admin_pick_notify;

-- Migrate the real AAPL active pick → admin community entry (idempotent).
insert into community_watchlist (
  ticker, company_name, kind, headline, thesis, blurb, status,
  snapshot_price, snapshot_at, created_at, promoted_by
)
select
  p.ticker,
  p.company_name,
  'admin',
  p.headline,
  p.thesis_long,
  p.thesis_short,
  case when p.status in ('active', 'watching', 'closed') then p.status else 'active' end,
  p.picked_price,
  p.created_at,
  p.created_at,
  p.created_by
from fic_picks p
where p.id = '0f9b5e1f-c23c-45cb-ba9c-c29e202b61ec'
  and not exists (
    select 1 from community_watchlist c
    where c.kind = 'admin' and c.ticker = p.ticker
  );

alter table community_watchlist enable trigger trg_community_admin_pick_notify;

-- Delete the owner's stray draft pick ("this is the pick").
delete from fic_picks where id = '7e54a380-e234-43d1-b39b-6470daa9a57d';
