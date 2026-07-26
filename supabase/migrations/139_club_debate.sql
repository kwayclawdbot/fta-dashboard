-- 139 — The Debate (ClubHome v2 §8): one live YES/NO question, one vote/member.
--
-- Kid-wall: voting AND reading counts are adults+teens only, mirroring the
-- screener kid-wall (migration 137, viewer_is_kid()). Kids get a safe subset in
-- the API (no counts, no vote). The vote RPC re-checks server-side so the wall
-- can never be bypassed by hitting PostgREST directly.
--
-- Counts are served via a SECURITY DEFINER aggregate RPC (club_debate_state) so
-- the per-row debate_votes SELECT policy can stay strict (own vote only) while
-- the YES/NO tallies remain readable — no way to enumerate who voted what.

create table if not exists debates (
  id uuid primary key default gen_random_uuid(),
  question text not null,
  status text not null default 'live' check (status in ('live', 'closed')),
  created_at timestamptz not null default now()
);

create table if not exists debate_votes (
  id uuid primary key default gen_random_uuid(),
  debate_id uuid not null references debates(id) on delete cascade,
  user_id uuid not null references profiles(id) on delete cascade,
  choice text not null check (choice in ('yes', 'no')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (debate_id, user_id)               -- exactly one vote per member
);
create index if not exists idx_debate_votes_debate on debate_votes(debate_id);

alter table debates enable row level security;
alter table debate_votes enable row level security;

-- Debates are readable by every authenticated member (the API kid-walls the
-- COUNTS; the question text itself is harmless).
drop policy if exists "Read debates" on debates;
create policy "Read debates" on debates
  for select to authenticated using (true);

-- A member reads only their own vote row. Tallies come from the RPC below.
drop policy if exists "Read own debate vote" on debate_votes;
create policy "Read own debate vote" on debate_votes
  for select to authenticated using (user_id = auth.uid());
-- No direct INSERT/UPDATE policy → votes flow ONLY through club_debate_vote()
-- (SECURITY DEFINER), which enforces the kid-wall. A raw client write is denied.

-- ── Aggregate state: question + YES/NO counts + this member's vote ───────────
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
    select * into v_debate from debates where status = 'live'
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

-- ── Cast/change a vote (kid-walled) → returns updated state ──────────────────
create or replace function public.club_debate_vote(p_debate_id uuid, p_choice text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_choice text := lower(nullif(trim(p_choice), ''));
  v_live boolean;
begin
  if auth.uid() is null then
    return jsonb_build_object('ok', false, 'reason', 'no_session');
  end if;
  -- Same wall as the screener: kids may not vote or see counts.
  if coalesce(public.viewer_is_kid(), false) then
    return jsonb_build_object('ok', false, 'reason', 'kid_walled');
  end if;
  if v_choice not in ('yes', 'no') then
    return jsonb_build_object('ok', false, 'reason', 'bad_choice');
  end if;

  select (status = 'live') into v_live from debates where id = p_debate_id;
  if v_live is null then
    return jsonb_build_object('ok', false, 'reason', 'unknown_debate');
  end if;
  if not v_live then
    return jsonb_build_object('ok', false, 'reason', 'debate_closed');
  end if;

  insert into debate_votes (debate_id, user_id, choice)
  values (p_debate_id, auth.uid(), v_choice)
  on conflict (debate_id, user_id)
  do update set choice = excluded.choice, updated_at = now();

  return jsonb_build_object('ok', true, 'state', public.club_debate_state(p_debate_id));
end;
$$;
grant execute on function public.club_debate_vote(uuid, text) to authenticated;

-- ── Seed exactly one live question ───────────────────────────────────────────
insert into debates (question, status)
select 'Is Tesla still a growth stock?', 'live'
where not exists (select 1 from debates where question = 'Is Tesla still a growth stock?');
