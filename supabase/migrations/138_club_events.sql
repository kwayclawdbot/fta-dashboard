-- 138 — club_events: the ONE new event table for ClubHome v2 (Lane: DATA).
--
-- ClubHome v2 ("The Collective") derives its collective-intelligence surfaces
-- (Live Pulse, Trending, Collective, Brief) from community ATTENTION. Almost all
-- of that attention is ALREADY captured in existing tables:
--   • watchlist adds       → community_watchlist / family_watchlist
--   • reactions / comments → post_likes / post_comments / community_ticker_comments
--   • sentiment (bull/bear)→ ticker_sentiment
--   • posts                → feed_posts (ticker_tags)
-- The only member actions with NO durable home are the three this table adds:
--   • 'search'        — a member searched the Club for a ticker
--   • 'research_view' — a member opened a ticker's research page
--   • 'kai_question'  — a member asked Kai about a ticker
--   • 'save'          — a member saved a piece of research/post (client-tracked)
-- Instrumentation is server-side where a server route exists (research API, Kai
-- chat API, market search API) and client-side via POST /api/club/track for
-- surfaces that act purely in the browser.
--
-- RLS contract (per CLUBHOME-V2-PLAN §DATA CONTRACT): insert-own, read-own.
-- Aggregate reads happen through the service-role refresh (refresh_club_metrics,
-- migration 140) which bypasses RLS and precomputes cached tables — so no
-- endpoint ever fans out over raw club_events at request time.

create table if not exists club_events (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null references profiles(id) on delete cascade,
  kind text not null check (kind in ('search', 'research_view', 'kai_question', 'save')),
  ticker text,
  meta jsonb,
  created_at timestamptz not null default now()
);

-- Aggregation is always "recent window, grouped by ticker/kind/member" — these
-- three indexes serve the refresh scans and any own-row reads.
create index if not exists idx_club_events_created on club_events(created_at desc);
create index if not exists idx_club_events_ticker_created on club_events(ticker, created_at desc) where ticker is not null;
create index if not exists idx_club_events_member_created on club_events(member_id, created_at desc);
create index if not exists idx_club_events_kind_created on club_events(kind, created_at desc);

alter table club_events enable row level security;

-- Insert-own: the member_id must be the caller. Forge-proof — a client can only
-- ever log its own activity. Kids CAN log search/research_view/save (safe
-- subset); kai_question is gated upstream (Kai is not a kid surface) but the
-- table stays permissive since aggregate reads never expose per-member rows.
drop policy if exists "Insert own club event" on club_events;
create policy "Insert own club event" on club_events
  for insert to authenticated with check (member_id = auth.uid());

-- Read-own only. Collective aggregates are served from the cached tables in
-- migration 140 (world-readable, no PII), never from this table directly.
drop policy if exists "Read own club events" on club_events;
create policy "Read own club events" on club_events
  for select to authenticated using (member_id = auth.uid());
