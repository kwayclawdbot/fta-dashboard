-- ════════════════════════════════════════════════════════════════════════════
-- 212 · MEMBER INSIGHTS + FOLLOWS — the "HOW THEY INVEST" data layer
--
-- Two additive tables. Nothing existing is touched.
--
-- user_insights — a per-member, PRE-COMPUTED profile digest that powers the
-- "HOW THEY INVEST" section of /u/[username]: favorite tickers (by weight),
-- bull/bear lean, favorite sectors, and trading style. It is DERIVED entirely
-- from the member's own on-app behaviour (ticker_stances, ticker_sentiment,
-- family_watchlist, strategy_profiles), recomputed server-side by
-- computeUserInsights() behind the service role. The optional `kai_read` is a
-- one-line LLM narrative that stays NULL whenever the model is unavailable —
-- it is never required for the row to be useful.
--
-- WHY SERVICE-ROLE WRITE ONLY. These columns are an aggregate view over a
-- member's behaviour. Letting the browser write them would let a member
-- hand-author their own "trading style" / "bull lean" — the exact
-- self-reported claim the deterministic computation exists to avoid. So the
-- row is READABLE by any authenticated member (it is public profile context,
-- same visibility as the stances and watchlist it summarises) but WRITABLE
-- only by the service role, which bypasses RLS. No insert/update grant is
-- given to `authenticated`.
--
-- follows — a member follows another member. Self-managed: a user inserts and
-- deletes only rows where they are the follower (follower_id = auth.uid());
-- rows are readable so follower / following counts can be shown on a profile.
-- ════════════════════════════════════════════════════════════════════════════

-- ── user_insights ───────────────────────────────────────────────────────────
create table if not exists user_insights (
  user_id          uuid primary key references profiles(id) on delete cascade,
  -- [{ ticker, weight }] — top ~5, weights normalised to sum ~1.
  favorite_tickers jsonb       not null default '[]'::jsonb,
  -- 0–100: share of this member's stances called bullish (mirrors the
  -- profile's CONVICTION measure). NULL when they hold no stances.
  bull_lean        numeric,
  -- [{ sector, pct }] — top 3–4 friendly sectors, pct 0–100.
  favorite_sectors jsonb       not null default '[]'::jsonb,
  -- { risk_posture, timeframe, setups: [] } — from strategy_profiles or a
  -- behaviour-inferred default. Sparse by design; never fabricated.
  trading_style    jsonb       not null default '{}'::jsonb,
  -- Optional one-line Kai narrative. NULL when the LLM path is unavailable
  -- (e.g. the credit outage) — the deterministic fields above never depend
  -- on it.
  kai_read         text,
  computed_at      timestamptz not null default now()
);

alter table user_insights enable row level security;

-- Readable by any signed-in member; the whole app is auth-gated, and this is
-- the same footprint the profile already exposes. No write grant to
-- authenticated — computeUserInsights() writes through the service role.
grant select on user_insights to authenticated;

drop policy if exists "Insights are public to members" on user_insights;
create policy "Insights are public to members" on user_insights
  for select to authenticated
  using (true);

comment on table user_insights is
  'Pre-computed "HOW THEY INVEST" digest per member (favorite tickers/sectors, bull lean, trading style, optional Kai narrative). Derived from own behaviour; written only by the service role via computeUserInsights().';

-- ── follows ─────────────────────────────────────────────────────────────────
create table if not exists follows (
  follower_id uuid        not null references profiles(id) on delete cascade,
  followee_id uuid        not null references profiles(id) on delete cascade,
  created_at  timestamptz not null default now(),
  primary key (follower_id, followee_id),
  constraint follows_no_self check (follower_id <> followee_id)
);

create index if not exists idx_follows_followee on follows(followee_id);
create index if not exists idx_follows_follower on follows(follower_id);

alter table follows enable row level security;

grant select, insert, delete on follows to authenticated;

-- Counts (followers / following) are public to members.
drop policy if exists "Follows are readable" on follows;
create policy "Follows are readable" on follows
  for select to authenticated
  using (true);

-- A member manages only their OWN follows — they can follow/unfollow as
-- themselves and never on behalf of anyone else.
drop policy if exists "Follow as yourself" on follows;
create policy "Follow as yourself" on follows
  for insert to authenticated
  with check (follower_id = auth.uid());

drop policy if exists "Unfollow as yourself" on follows;
create policy "Unfollow as yourself" on follows
  for delete to authenticated
  using (follower_id = auth.uid());

comment on table follows is
  'Member-to-member follow graph. Self-managed: a user inserts/deletes only rows where follower_id = auth.uid(); rows are readable so follower/following counts can be shown.';
