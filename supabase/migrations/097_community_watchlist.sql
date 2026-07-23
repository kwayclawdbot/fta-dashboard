-- ============================================================================
-- 097 — Community Watchlist: the flagship communal research board.
--
-- Replaces Team Picks (retired in 098). ONE communal board shows admin-curated
-- "our research" picks + member picks that families explicitly PROMOTED from
-- their private family_watchlist. Every member researches together + comments —
-- wikipedia-like collaborative research keyed per TICKER. Full performance
-- tracker: snapshot price on every add (private/promote/admin), daily close
-- history, "% since added", per-ticker chart, Pick Record.
--
-- RLS posture (matches the repo scars):
--   * Bare/simple SELECT policies + app-level tier gating (free tier hits
--     LockedState in the UI, never queried here).
--   * Privileged member writes go through SECURITY DEFINER RPCs
--     (promote_to_community) with forge-proof auth.uid() family checks — no
--     direct member INSERT policy on community_watchlist.
--   * Admin writes use the same role='admin' direct-RLS pattern as fic_picks.
--   * ticker_snapshots has NO authenticated write policy — only the cron
--     (service role, bypasses RLS) writes daily closes.
--   * None of these tables are consumed via Realtime; every policy subqueries a
--     DIFFERENT table (profiles/families) so no self-referential recursion.
-- ============================================================================

-- ── 1. Performance snapshot on the PRIVATE family board ──────────────────────
-- Price at the moment of a private add. Set client-side from the live quote;
-- the daily cron backfills any NULL from the first available close.
alter table family_watchlist
  add column if not exists snapshot_price numeric,
  add column if not exists snapshot_at   timestamptz;

-- ── 2. community_watchlist — the public board (one row per card/entry) ────────
create table if not exists community_watchlist (
  id                 uuid primary key default gen_random_uuid(),
  ticker             text not null,
  company_name       text not null,
  kind               text not null check (kind in ('admin', 'member')),
  source_watchlist_id uuid references family_watchlist(id) on delete set null,
  family_id          uuid references families(id) on delete set null,
  promoted_by        uuid references profiles(id) on delete set null,
  promoter_age_group text,
  headline           text,   -- admin "our research" headline
  thesis             text,   -- admin long thesis
  blurb              text,   -- short "why" (member: why_we_picked / what_they_sell)
  status             text not null default 'active'
                       check (status in ('active', 'watching', 'closed', 'archived')),
  snapshot_price     numeric,
  snapshot_at        timestamptz not null default now(),
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

-- A family pick can be promoted to the board exactly once (idempotent promote).
create unique index if not exists uq_community_source
  on community_watchlist(source_watchlist_id)
  where source_watchlist_id is not null;
create index if not exists idx_community_kind    on community_watchlist(kind);
create index if not exists idx_community_ticker  on community_watchlist(ticker);
create index if not exists idx_community_status  on community_watchlist(status);
create index if not exists idx_community_created on community_watchlist(created_at desc);

create or replace function public.community_watchlist_touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end;
$$;
drop trigger if exists trg_community_watchlist_touch on community_watchlist;
create trigger trg_community_watchlist_touch
  before update on community_watchlist
  for each row execute function public.community_watchlist_touch_updated_at();

alter table community_watchlist enable row level security;

-- Read: any authenticated member sees the board (free tier gated in-app).
drop policy if exists "Read community watchlist" on community_watchlist;
create policy "Read community watchlist" on community_watchlist
  for select to authenticated using (true);

-- Admin direct writes (create/edit/close admin "our research" picks).
drop policy if exists "Admins insert community picks" on community_watchlist;
create policy "Admins insert community picks" on community_watchlist
  for insert to authenticated
  with check (
    kind = 'admin'
    and (select role from public.profiles where id = auth.uid()) = 'admin'
  );

drop policy if exists "Admins update community" on community_watchlist;
create policy "Admins update community" on community_watchlist
  for update to authenticated
  using ((select role from public.profiles where id = auth.uid()) = 'admin')
  with check ((select role from public.profiles where id = auth.uid()) = 'admin');

-- Delete: the member who promoted an entry can de-promote it; admins can remove
-- any entry. (Member promotion INSERT is via the SECURITY DEFINER RPC only.)
drop policy if exists "Delete own or admin community entry" on community_watchlist;
create policy "Delete own or admin community entry" on community_watchlist
  for delete to authenticated
  using (
    promoted_by = auth.uid()
    or (select role from public.profiles where id = auth.uid()) = 'admin'
  );

-- ── 3. community_ticker_comments — collaborative research per TICKER ──────────
-- Comments key on ticker (not on a board entry) so all promotions + the admin
-- pick of the same ticker share ONE research thread (the wiki model).
create table if not exists community_ticker_comments (
  id         uuid primary key default gen_random_uuid(),
  ticker     text not null,
  user_id    uuid references profiles(id) on delete set null,
  body       text not null,
  created_at timestamptz not null default now()
);
create index if not exists idx_community_comments_ticker
  on community_ticker_comments(ticker, created_at);

alter table community_ticker_comments enable row level security;

drop policy if exists "Read ticker comments" on community_ticker_comments;
create policy "Read ticker comments" on community_ticker_comments
  for select to authenticated using (true);

drop policy if exists "Author own ticker comment" on community_ticker_comments;
create policy "Author own ticker comment" on community_ticker_comments
  for insert to authenticated with check (user_id = auth.uid());

drop policy if exists "Delete own or admin ticker comment" on community_ticker_comments;
create policy "Delete own or admin ticker comment" on community_ticker_comments
  for delete to authenticated
  using (
    user_id = auth.uid()
    or (select role from public.profiles where id = auth.uid()) = 'admin'
  );

-- ── 4. ticker_snapshots — daily close history (shared by every surface) ──────
create table if not exists ticker_snapshots (
  ticker     text not null,
  as_of      date not null,
  close      numeric not null,
  created_at timestamptz not null default now(),
  primary key (ticker, as_of)
);
create index if not exists idx_ticker_snapshots_ticker
  on ticker_snapshots(ticker, as_of desc);

alter table ticker_snapshots enable row level security;
-- Read-only to members; only the cron (service role) writes.
drop policy if exists "Read ticker snapshots" on ticker_snapshots;
create policy "Read ticker snapshots" on ticker_snapshots
  for select to authenticated using (true);

-- ── 5. get_community_board() — one round-trip board read ─────────────────────
-- SECURITY DEFINER so attribution (family name + promoter display_name across
-- families) resolves without widening families/profiles RLS. Free tier is
-- gated in the UI (LockedState), so this is only ever called by members.
create or replace function public.get_community_board()
returns jsonb
language sql
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'entries', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', e.id,
        'ticker', e.ticker,
        'company_name', e.company_name,
        'kind', e.kind,
        'status', e.status,
        'headline', e.headline,
        'thesis', e.thesis,
        'blurb', e.blurb,
        'family_id', e.family_id,
        'family_name', f.name,
        'promoted_by', e.promoted_by,
        'promoter_name', p.display_name,
        'promoter_age_group', e.promoter_age_group,
        'source_watchlist_id', e.source_watchlist_id,
        'snapshot_price', e.snapshot_price,
        'snapshot_at', e.snapshot_at,
        'created_at', e.created_at,
        'latest_close', lc.close,
        'comment_count', (
          select count(*) from community_ticker_comments c where c.ticker = e.ticker
        )
      ) order by (e.kind = 'admin') desc, e.created_at desc)
      from community_watchlist e
      left join families f on f.id = e.family_id
      left join profiles p on p.id = e.promoted_by
      left join lateral (
        select s.close from ticker_snapshots s
        where s.ticker = e.ticker order by s.as_of desc limit 1
      ) lc on true
      where e.status <> 'archived'
    ), '[]'::jsonb)
  );
$$;
grant execute on function public.get_community_board() to authenticated;

-- ── 6. promote_to_community — forge-proof member promotion ───────────────────
-- Verifies the source family_watchlist row belongs to the caller's family,
-- snapshots price + attribution from the caller's profile, idempotent on the
-- source id. Members never INSERT into community_watchlist directly.
create or replace function public.promote_to_community(
  p_watchlist_id uuid,
  p_snapshot_price numeric default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid    uuid := auth.uid();
  v_family uuid;
  v_age    text;
  v_row    family_watchlist%rowtype;
  v_id     uuid;
begin
  if v_uid is null then
    raise exception 'authentication required';
  end if;

  select family_id, age_group into v_family, v_age
  from profiles where id = v_uid;

  select * into v_row from family_watchlist where id = p_watchlist_id;
  if not found then
    raise exception 'watchlist item not found';
  end if;
  if v_row.family_id is distinct from v_family then
    raise exception 'not your family''s pick';
  end if;

  -- Idempotent: already promoted → return the existing entry.
  select id into v_id from community_watchlist
  where source_watchlist_id = p_watchlist_id;
  if v_id is not null then
    return v_id;
  end if;

  insert into community_watchlist (
    ticker, company_name, kind, source_watchlist_id, family_id, promoted_by,
    promoter_age_group, blurb, status, snapshot_price, snapshot_at
  ) values (
    v_row.ticker, v_row.company_name, 'member', p_watchlist_id, v_family, v_uid,
    v_age,
    coalesce(nullif(btrim(v_row.why_we_picked), ''), nullif(btrim(v_row.what_they_sell), '')),
    'active', p_snapshot_price, now()
  )
  returning id into v_id;

  return v_id;
end;
$$;
grant execute on function public.promote_to_community(uuid, numeric) to authenticated;

-- ── 7. Notifications (reuse the 092 pipe + notif_audience_ids) ────────────────

-- (a) New ADMIN community pick → paying members. type 'new_pick', deduped.
create or replace function public.notify_on_community_admin_pick()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_body text;
  v_link text;
begin
  if new.kind <> 'admin' then
    return new;
  end if;
  if exists (select 1 from notifications where ref_id = new.id and type = 'new_pick') then
    return new;
  end if;

  v_body := 'New research pick: ' || new.ticker || ' — see why';
  v_link := '/research/' || new.ticker;

  insert into notifications (user_id, actor_id, type, body, link, ref_id)
  select a.user_id, new.promoted_by, 'new_pick', v_body, v_link, new.id
  from public.notif_audience_ids('fic') a
  where new.promoted_by is null or a.user_id <> new.promoted_by;

  return new;
exception when others then
  return new;
end;
$$;
drop trigger if exists trg_community_admin_pick_notify on community_watchlist;
create trigger trg_community_admin_pick_notify
  after insert on community_watchlist
  for each row execute function public.notify_on_community_admin_pick();

-- (b) New ticker research comment → earlier commenters + the people who put the
--     ticker on the board (promoters/admin authors), capped 20, self-skipped.
create or replace function public.notify_on_ticker_comment()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_snippet text;
  v_link    text;
begin
  v_snippet := coalesce(nullif(left(coalesce(new.body, ''), 140), ''), '[comment]');
  v_link := '/research/' || new.ticker;

  insert into notifications (user_id, actor_id, type, body, link, ref_id)
  select uid, new.user_id, 'reply', v_snippet, v_link, new.id
  from (
    select distinct u.uid
    from (
      -- earlier distinct commenters on this ticker
      select cc.user_id as uid
      from community_ticker_comments cc
      where cc.ticker = new.ticker and cc.id <> new.id and cc.user_id is not null
      union
      -- people who put this ticker on the board
      select cw.promoted_by as uid
      from community_watchlist cw
      where cw.ticker = new.ticker and cw.promoted_by is not null
    ) u
    where u.uid is not null and u.uid <> new.user_id
    limit 20
  ) targets;

  return new;
exception when others then
  return new;
end;
$$;
drop trigger if exists trg_ticker_comment_notify on community_ticker_comments;
create trigger trg_ticker_comment_notify
  after insert on community_ticker_comments
  for each row execute function public.notify_on_ticker_comment();
