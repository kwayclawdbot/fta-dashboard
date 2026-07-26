-- 153 — SOCIAL OBJECTS S1: per-ticker debate extension.
-- SOCIAL-OBJECTS.md object #3 — extends the live debates v1 (migration 139) to
-- ticker-scoped debates with a THREE-WAY stance (BULL / BEAR / UNDECIDED), a top
-- voted argument per side, and a one-reason capture after voting.
--
-- Additive over 139:
--   • debates          gains `ticker` + `kind` ('yesno' | 'ticker').
--   • debate_votes     `choice` widened to include bull/bear/undecided; gains an
--                      optional `reason` (the one-reason capture after voting).
--   • debate_arguments — bull/bear cases members write; upvoted; top per side.
--   • debate_argument_votes — one upvote per member per argument.
--
-- The existing YES/NO Home debate is UNAFFECTED: club_debate_state() is redefined
-- to only auto-pick kind='yesno' debates, so a live ticker debate never hijacks
-- the Home donut. Kid-wall (viewer_is_kid, 137) enforced in every write RPC AND
-- the ticker-state read RPC — debates are kid-walled per the S1 spec.

-- ── schema extensions ────────────────────────────────────────────────────────
alter table debates
  add column if not exists ticker text,
  add column if not exists kind text not null default 'yesno';

do $$ begin
  alter table debates add constraint debates_kind_check check (kind in ('yesno', 'ticker'));
exception when duplicate_object then null; end $$;

create index if not exists idx_debates_ticker on debates(upper(ticker)) where kind = 'ticker';

-- Widen the vote vocabulary (yes/no keeps working; add three-way stance) + reason.
alter table debate_votes drop constraint if exists debate_votes_choice_check;
do $$ begin
  alter table debate_votes add constraint debate_votes_choice_check
    check (choice in ('yes', 'no', 'bull', 'bear', 'undecided'));
exception when duplicate_object then null; end $$;

alter table debate_votes
  add column if not exists reason text;

create table if not exists debate_arguments (
  id         uuid primary key default gen_random_uuid(),
  debate_id  uuid not null references debates(id) on delete cascade,
  user_id    uuid not null references profiles(id) on delete cascade,
  side       text not null check (side in ('bull', 'bear')),
  body       text not null,
  created_at timestamptz not null default now()
);
create index if not exists idx_debate_arguments_debate on debate_arguments(debate_id, side);

create table if not exists debate_argument_votes (
  argument_id uuid not null references debate_arguments(id) on delete cascade,
  user_id     uuid not null references profiles(id) on delete cascade,
  created_at  timestamptz not null default now(),
  primary key (argument_id, user_id)
);

alter table debate_arguments enable row level security;
alter table debate_argument_votes enable row level security;

-- Arguments are readable by every member; the counts are aggregate. Writes flow
-- through the kid-walled RPCs only (no direct insert policy on arguments); upvotes
-- go through the RPC too (own-row delete allowed for un-voting via the RPC path).
drop policy if exists "Read debate arguments" on debate_arguments;
create policy "Read debate arguments" on debate_arguments
  for select to authenticated using (true);
drop policy if exists "Delete own debate arguments" on debate_arguments;
create policy "Delete own debate arguments" on debate_arguments
  for delete to authenticated using (
    user_id = auth.uid()
    or (select role from public.profiles where id = auth.uid()) = 'admin'
  );

drop policy if exists "Read own argument vote" on debate_argument_votes;
create policy "Read own argument vote" on debate_argument_votes
  for select to authenticated using (user_id = auth.uid());

-- ── redefine club_debate_state — pin the Home auto-pick to kind='yesno' ───────
create or replace function public.club_debate_state(p_debate_id uuid default null)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_debate debates%rowtype;
  v_yes int;
  v_no int;
  v_mine text;
begin
  if p_debate_id is null then
    select * into v_debate from debates
    where status = 'live' and kind = 'yesno'      -- never auto-pick a ticker debate
    order by created_at desc limit 1;
  else
    select * into v_debate from debates where id = p_debate_id;
  end if;
  if v_debate.id is null then
    return null;
  end if;

  select
    count(*) filter (where choice = 'yes'),
    count(*) filter (where choice = 'no')
  into v_yes, v_no
  from debate_votes where debate_id = v_debate.id;

  select choice into v_mine
  from debate_votes where debate_id = v_debate.id and user_id = auth.uid();

  return jsonb_build_object(
    'id', v_debate.id,
    'question', v_debate.question,
    'status', v_debate.status,
    'yes', coalesce(v_yes, 0),
    'no', coalesce(v_no, 0),
    'total', coalesce(v_yes, 0) + coalesce(v_no, 0),
    'userVote', v_mine
  );
end;
$$;
grant execute on function public.club_debate_state(uuid) to authenticated;

-- ── club_ticker_debate_state — three-way tally + top argument per side ────────
-- Kid-walled: kids get null (debates are kid-walled in S1). Returns stance counts,
-- the caller's vote+reason, and the single most-upvoted argument on each side.
create or replace function public.club_ticker_debate_state(p_ticker text default null, p_debate_id uuid default null)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_debate debates%rowtype;
  v_bull int; v_bear int; v_und int;
  v_mine text; v_reason text;
  v_top_bull jsonb; v_top_bear jsonb;
begin
  if auth.uid() is null or coalesce(public.viewer_is_kid(), false) then
    return null;
  end if;

  if p_debate_id is not null then
    select * into v_debate from debates where id = p_debate_id and kind = 'ticker';
  elsif p_ticker is not null then
    select * into v_debate from debates
    where kind = 'ticker' and upper(ticker) = upper(p_ticker) and status = 'live'
    order by created_at desc limit 1;
  end if;
  if v_debate.id is null then
    return null;
  end if;

  select
    count(*) filter (where choice = 'bull'),
    count(*) filter (where choice = 'bear'),
    count(*) filter (where choice = 'undecided')
  into v_bull, v_bear, v_und
  from debate_votes where debate_id = v_debate.id;

  select choice, reason into v_mine, v_reason
  from debate_votes where debate_id = v_debate.id and user_id = auth.uid();

  select to_jsonb(t) into v_top_bull from (
    select a.id, a.body, a.user_id,
           (select count(*)::int from debate_argument_votes v where v.argument_id = a.id) as votes,
           p.display_name, p.username, p.avatar_url, p.role, p.age_group
    from debate_arguments a join profiles p on p.id = a.user_id
    where a.debate_id = v_debate.id and a.side = 'bull'
    order by votes desc, a.created_at asc limit 1
  ) t;

  select to_jsonb(t) into v_top_bear from (
    select a.id, a.body, a.user_id,
           (select count(*)::int from debate_argument_votes v where v.argument_id = a.id) as votes,
           p.display_name, p.username, p.avatar_url, p.role, p.age_group
    from debate_arguments a join profiles p on p.id = a.user_id
    where a.debate_id = v_debate.id and a.side = 'bear'
    order by votes desc, a.created_at asc limit 1
  ) t;

  return jsonb_build_object(
    'id', v_debate.id,
    'ticker', v_debate.ticker,
    'question', v_debate.question,
    'status', v_debate.status,
    'bull', coalesce(v_bull, 0),
    'bear', coalesce(v_bear, 0),
    'undecided', coalesce(v_und, 0),
    'total', coalesce(v_bull, 0) + coalesce(v_bear, 0) + coalesce(v_und, 0),
    'userVote', v_mine,
    'userReason', v_reason,
    'topBull', v_top_bull,
    'topBear', v_top_bear
  );
end;
$$;
grant execute on function public.club_ticker_debate_state(text, uuid) to authenticated;

-- ── club_ticker_debate_vote — cast/change a three-way stance (+ reason) ───────
create or replace function public.club_ticker_debate_vote(
  p_debate_id uuid, p_choice text, p_reason text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_choice text := lower(nullif(trim(p_choice), ''));
  v_live boolean;
  v_ticker text;
begin
  if auth.uid() is null then
    return jsonb_build_object('ok', false, 'reason', 'no_session');
  end if;
  if coalesce(public.viewer_is_kid(), false) then
    return jsonb_build_object('ok', false, 'reason', 'kid_walled');
  end if;
  if v_choice not in ('bull', 'bear', 'undecided') then
    return jsonb_build_object('ok', false, 'reason', 'bad_choice');
  end if;

  select (status = 'live'), ticker into v_live, v_ticker
  from debates where id = p_debate_id and kind = 'ticker';
  if v_live is null then
    return jsonb_build_object('ok', false, 'reason', 'unknown_debate');
  end if;
  if not v_live then
    return jsonb_build_object('ok', false, 'reason', 'debate_closed');
  end if;

  insert into debate_votes (debate_id, user_id, choice, reason)
  values (p_debate_id, auth.uid(), v_choice, nullif(trim(coalesce(p_reason, '')), ''))
  on conflict (debate_id, user_id)
  do update set choice = excluded.choice,
                reason = coalesce(excluded.reason, debate_votes.reason),
                updated_at = now();

  return jsonb_build_object('ok', true, 'state', public.club_ticker_debate_state(v_ticker, p_debate_id));
end;
$$;
grant execute on function public.club_ticker_debate_vote(uuid, text, text) to authenticated;

-- ── add_debate_argument — write a bull/bear case (kid-walled) ─────────────────
create or replace function public.add_debate_argument(
  p_debate_id uuid, p_side text, p_body text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_side text := lower(nullif(trim(p_side), ''));
  v_body text := nullif(trim(coalesce(p_body, '')), '');
  v_kind text;
  v_id uuid;
begin
  if auth.uid() is null then
    return jsonb_build_object('ok', false, 'reason', 'no_session');
  end if;
  if coalesce(public.viewer_is_kid(), false) then
    return jsonb_build_object('ok', false, 'reason', 'kid_walled');
  end if;
  if v_side not in ('bull', 'bear') or v_body is null then
    return jsonb_build_object('ok', false, 'reason', 'bad_input');
  end if;
  select kind into v_kind from debates where id = p_debate_id;
  if v_kind is distinct from 'ticker' then
    return jsonb_build_object('ok', false, 'reason', 'unknown_debate');
  end if;

  insert into debate_arguments (debate_id, user_id, side, body)
  values (p_debate_id, auth.uid(), v_side, left(v_body, 500))
  returning id into v_id;

  return jsonb_build_object('ok', true, 'id', v_id);
end;
$$;
grant execute on function public.add_debate_argument(uuid, text, text) to authenticated;

-- ── vote_debate_argument — toggle an upvote (kid-walled) ──────────────────────
create or replace function public.vote_debate_argument(p_argument_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_exists boolean;
  v_votes int;
begin
  if auth.uid() is null then
    return jsonb_build_object('ok', false, 'reason', 'no_session');
  end if;
  if coalesce(public.viewer_is_kid(), false) then
    return jsonb_build_object('ok', false, 'reason', 'kid_walled');
  end if;

  select exists(select 1 from debate_argument_votes
                where argument_id = p_argument_id and user_id = auth.uid())
    into v_exists;
  if v_exists then
    delete from debate_argument_votes where argument_id = p_argument_id and user_id = auth.uid();
  else
    insert into debate_argument_votes (argument_id, user_id)
    values (p_argument_id, auth.uid())
    on conflict do nothing;
  end if;

  select count(*)::int into v_votes from debate_argument_votes where argument_id = p_argument_id;
  return jsonb_build_object('ok', true, 'voted', not v_exists, 'votes', v_votes);
end;
$$;
grant execute on function public.vote_debate_argument(uuid) to authenticated;

-- ── list arguments for a debate (with vote counts + my votes) ─────────────────
create or replace function public.get_debate_arguments(p_debate_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(jsonb_agg(x order by x.votes desc, x.created_at asc), '[]'::jsonb)
  from (
    select a.id, a.side, a.body, a.created_at, a.user_id,
           (select count(*)::int from debate_argument_votes v where v.argument_id = a.id) as votes,
           exists(select 1 from debate_argument_votes v
                  where v.argument_id = a.id and v.user_id = auth.uid()) as voted,
           jsonb_build_object('id', p.id, 'display_name', p.display_name,
             'username', p.username, 'avatar_url', p.avatar_url,
             'role', p.role, 'age_group', p.age_group) as author
    from debate_arguments a
    join profiles p on p.id = a.user_id
    where a.debate_id = p_debate_id
  ) x;
$$;
grant execute on function public.get_debate_arguments(uuid) to authenticated;

-- ── Seed ONE ticker debate (SOCIAL-OBJECTS S1: "Seed ONE ticker debate") ──────
insert into debates (question, status, kind, ticker)
select 'Where is Nvidia''s story headed from here — bull or bear?', 'live', 'ticker', 'NVDA'
where not exists (select 1 from debates where kind = 'ticker' and upper(ticker) = 'NVDA');
