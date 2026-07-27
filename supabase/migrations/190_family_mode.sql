-- ============================================================================
-- 190 — FAMILY MODE (Canvas v2, lane L1)
--
-- Source of truth: .planning/design-project-v2/"Cheat Code Family.dc.html"
-- (F1–F9) + CANVAS-V2-ADOPTION-PLAN.md §1.4.
--
-- THE BINDING CONSTRAINT FOR THIS MIGRATION: **guardrails must be real writes
-- with real enforcement, never a switch that persists nothing.** Everything the
-- canvas draws as a guardrail is therefore sorted into exactly one of three
-- buckets, and the bucket is stated in the schema so nobody later mistakes a
-- statement of fact for a control:
--
--   A. STRUCTURAL — already true of the product, no toggle exists because there
--      is nothing to turn off.
--        • "Paper trading only"  — the platform has no real-money order path at
--          all. The only trading surface is the simulator (003_trading_
--          simulator). A switch here would imply a real-money mode exists.
--        • "Options & margin hidden" — equities-only is a product decision
--          (adoption plan §0.1). There is no options chain, no margin, no
--          leverage surface anywhere to filter.
--      These render in the UI as locked, always-on statements.
--
--   B. ENFORCED — persisted here AND enforced by a RESTRICTIVE policy below, so
--      the door is shut server-side even if the client lies:
--        • chat_family_only   → child cannot INSERT into chat_messages /
--          feed_posts / post_comments. The family circle (family_circle_messages)
--          stays open — that is the entire point of the guardrail.
--        • downtime window    → during the window the child cannot write to
--          chat_messages, feed_posts, post_comments, sim_positions, sim_trades
--          or family_circle_messages.
--        • daily limit        → same write gate once family_activity_days says
--          the child is over the limit for the day.
--
--   C. RECORDED-ONLY — persisted and honoured by the surfaces that exist, but
--      the product has no mechanism to enforce them fully today. These are
--      flagged `enforcement = 'partial'` in the UI copy, never presented as a
--      hard lock:
--        • live_listen_only — live_events (170) is a scheduled-class object with
--          RSVP/interest only; there is no speak/raise-hand write path yet, so
--          "listen only" is currently a promise about a surface that has no
--          microphone. Recorded so it binds the day the room infra lands.
--
--   NOT SHIPPED — "Approve who they follow" (canvas F3). There is NO follow
--   graph in this product: no follows table, no follow request, no follower
--   relation anywhere in the schema. A toggle for it would control nothing, so
--   the UI states the absence instead. Building it is a separate lane.
--
-- Also here: the family-scoped objects the canvas needs that had no home —
-- the Family Circle thread (F4), the watchlist vote (F6), the guardrail audit
-- log + parent notification (F3, "Guardrail changes notify both parents"), the
-- activity meter that makes the daily limit and the digest's "time in app" a
-- real number, and three SECURITY DEFINER read RPCs (paper standings, teen
-- snapshot, weekly digest) — needed because sim_portfolios RLS is strictly
-- own-row (003), so a parent cannot otherwise see their own child's paper
-- account.
--
-- Additive only. No existing policy is dropped or narrowed; every RESTRICTIVE
-- policy added below returns TRUE for every user who has no guardrail row, so
-- the behaviour of every existing member is unchanged.
-- ============================================================================


-- ── 1. family_guardrails ────────────────────────────────────────────────────
-- One row per supervised child. Absence of a row = no guardrails (the default
-- for every account that exists today).
create table if not exists family_guardrails (
  child_id            uuid primary key references profiles(id) on delete cascade,
  family_id           uuid not null references families(id) on delete cascade,

  -- BUCKET B — enforced by the restrictive policies in §7.
  chat_family_only    boolean not null default true,
  downtime_enabled    boolean not null default false,
  downtime_start_hour smallint not null default 21 check (downtime_start_hour between 0 and 23),
  downtime_end_hour   smallint not null default 7  check (downtime_end_hour   between 0 and 23),
  daily_limit_min     int check (daily_limit_min is null or daily_limit_min between 5 and 480),

  -- BUCKET C — recorded, honoured by the Live surface, not a hard lock yet.
  live_listen_only    boolean not null default true,

  -- Household clock. Families have no timezone column anywhere else; downtime
  -- is meaningless in UTC, so it lives with the guardrail that needs it.
  tz                  text not null default 'America/New_York',

  updated_at          timestamptz not null default now(),
  updated_by          uuid references profiles(id) on delete set null
);

create index if not exists idx_family_guardrails_family on family_guardrails(family_id);

alter table family_guardrails enable row level security;
grant select on family_guardrails to authenticated;

-- Read: anyone in the family. The child MUST be able to read their own row —
-- the teen account screen shows the guardrails that apply to it, which is the
-- honest posture (no secret restrictions).
drop policy if exists "Family reads guardrails" on family_guardrails;
create policy "Family reads guardrails" on family_guardrails
  for select to authenticated
  using (family_id = public.get_my_family_id());

-- WRITE PATH IS THE RPC ONLY (§5). No insert/update/delete grant: a guardrail
-- change must always be logged and must always notify the other parent, and a
-- direct table write would skip both.


-- ── 2. family_guardrail_events — the audit log ──────────────────────────────
-- "Only admins can change these · changes are logged" (canvas F3) + the
-- "Recent changes" ledger under the digest.
create table if not exists family_guardrail_events (
  id         uuid primary key default gen_random_uuid(),
  family_id  uuid not null references families(id) on delete cascade,
  child_id   uuid not null references profiles(id) on delete cascade,
  actor_id   uuid references profiles(id) on delete set null,
  setting    text not null,
  old_value  jsonb,
  new_value  jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_guardrail_events_child
  on family_guardrail_events(child_id, created_at desc);

alter table family_guardrail_events enable row level security;
grant select on family_guardrail_events to authenticated;

-- Parents read the log. Kids do not — a child seeing "Mom raised your limit,
-- Dad lowered it" turns a guardrail into a negotiation.
drop policy if exists "Parents read guardrail log" on family_guardrail_events;
create policy "Parents read guardrail log" on family_guardrail_events
  for select to authenticated
  using (
    family_id = public.get_my_family_id()
    and public.get_my_role() = 'parent'
  );


-- ── 3. family_activity_days — the only honest source of "time in app" ───────
-- The canvas digest reads "3h 12m · Time in app" and the daily limit needs a
-- number to compare against. Nothing in this schema measured session time, so
-- neither was expressible. This table is the meter: one row per child per local
-- day, incremented a minute at a time by family_activity_ping().
--
-- COVERAGE, STATED PLAINLY: minutes accrue while a surface that mounts the
-- ping is open. This lane mounts it on every /family route. Making it whole-app
-- takes one <FamilyActivityPing /> in the dashboard shell — a file this lane
-- does not own. Until then the digest labels the number for what it is.
create table if not exists family_activity_days (
  child_id     uuid not null references profiles(id) on delete cascade,
  day          date not null,
  minutes      int  not null default 0 check (minutes >= 0),
  last_ping_at timestamptz not null default now(),
  primary key (child_id, day)
);

alter table family_activity_days enable row level security;
grant select on family_activity_days to authenticated;

drop policy if exists "Family reads activity" on family_activity_days;
create policy "Family reads activity" on family_activity_days
  for select to authenticated
  using (
    child_id in (
      select id from profiles where family_id = public.get_my_family_id()
    )
  );

-- Writes go through the ping RPC (it owns the once-a-minute rate limit).


-- ── 4. helpers the policies read ────────────────────────────────────────────

-- Is the wall clock inside a wrapping [start, end) window in the family's tz?
create or replace function public.family_in_downtime_window(
  p_start smallint, p_end smallint, p_tz text
)
returns boolean
language sql
stable
as $$
  select case
    when p_start = p_end then false
    when p_start < p_end then
      extract(hour from (now() at time zone p_tz)) >= p_start
      and extract(hour from (now() at time zone p_tz)) < p_end
    else
      extract(hour from (now() at time zone p_tz)) >= p_start
      or extract(hour from (now() at time zone p_tz)) < p_end
  end;
$$;

-- TRUE when the caller may write. TRUE for everyone without a guardrail row —
-- this is the property that makes the restrictive policies additive.
create or replace function public.family_writes_allowed()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select not exists (
    select 1
    from family_guardrails g
    where g.child_id = auth.uid()
      and (
        (g.downtime_enabled
          and public.family_in_downtime_window(g.downtime_start_hour, g.downtime_end_hour, g.tz))
        or (
          g.daily_limit_min is not null
          and coalesce((
            select d.minutes from family_activity_days d
            where d.child_id = g.child_id
              and d.day = (now() at time zone g.tz)::date
          ), 0) >= g.daily_limit_min
        )
      )
  );
$$;

-- TRUE unless the caller is a child whose chat is scoped to the family circle.
create or replace function public.family_chat_scope_ok()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select not exists (
    select 1 from family_guardrails g
    where g.child_id = auth.uid() and g.chat_family_only
  );
$$;

grant execute on function public.family_in_downtime_window(smallint, smallint, text) to authenticated;
grant execute on function public.family_writes_allowed() to authenticated;
grant execute on function public.family_chat_scope_ok() to authenticated;


-- ── 5. set_family_guardrail — the ONLY write path ───────────────────────────
-- Verifies the caller is a parent in the child's family, writes, logs, and
-- notifies every OTHER parent in the household. That last step is the canvas
-- line "Guardrail changes notify both parents" made real.
alter table notifications drop constraint if exists notifications_type_check;
alter table notifications add constraint notifications_type_check
  check (type in (
    'reply', 'mention', 'announcement', 'support_reply',
    'mention_everyone', 'new_pick', 'new_lesson', 'recording_posted',
    'broadcast', 'alert', 'live_starting', 'guardrail'
  ));

create or replace function public.set_family_guardrail(
  p_child uuid,
  p_setting text,
  p_value jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_actor   uuid := auth.uid();
  v_family  uuid;
  v_old     jsonb;
  v_row     family_guardrails;
  v_actor_name text;
  v_child_name text;
begin
  if v_actor is null then
    raise exception 'not authenticated';
  end if;

  if p_setting not in (
    'chat_family_only', 'downtime_enabled', 'downtime_start_hour',
    'downtime_end_hour', 'daily_limit_min', 'live_listen_only', 'tz'
  ) then
    raise exception 'unknown guardrail %', p_setting;
  end if;

  -- The child must be a child in the caller's family, and the caller a parent.
  select p.family_id, p.display_name into v_family, v_child_name
  from profiles p
  where p.id = p_child and p.role = 'child';

  if v_family is null then
    raise exception 'not a supervised member';
  end if;

  if not exists (
    select 1 from profiles pp
    where pp.id = v_actor and pp.role = 'parent' and pp.family_id = v_family
  ) then
    raise exception 'parents only';
  end if;

  insert into family_guardrails (child_id, family_id, updated_by)
  values (p_child, v_family, v_actor)
  on conflict (child_id) do nothing;

  select to_jsonb(g) -> p_setting into v_old
  from family_guardrails g where g.child_id = p_child;

  update family_guardrails set
    chat_family_only    = case when p_setting = 'chat_family_only'
                            then (p_value #>> '{}')::boolean else chat_family_only end,
    downtime_enabled    = case when p_setting = 'downtime_enabled'
                            then (p_value #>> '{}')::boolean else downtime_enabled end,
    downtime_start_hour = case when p_setting = 'downtime_start_hour'
                            then (p_value #>> '{}')::smallint else downtime_start_hour end,
    downtime_end_hour   = case when p_setting = 'downtime_end_hour'
                            then (p_value #>> '{}')::smallint else downtime_end_hour end,
    daily_limit_min     = case when p_setting = 'daily_limit_min'
                            then nullif(p_value #>> '{}', '')::int else daily_limit_min end,
    live_listen_only    = case when p_setting = 'live_listen_only'
                            then (p_value #>> '{}')::boolean else live_listen_only end,
    tz                  = case when p_setting = 'tz'
                            then coalesce(nullif(p_value #>> '{}', ''), tz) else tz end,
    updated_at = now(),
    updated_by = v_actor
  where child_id = p_child
  returning * into v_row;

  insert into family_guardrail_events (family_id, child_id, actor_id, setting, old_value, new_value)
  values (v_family, p_child, v_actor, p_setting, v_old, p_value);

  -- Notify the other parent(s). "Both parents" in the canvas means every adult
  -- with the parent role in the household except the one who made the change.
  select display_name into v_actor_name from profiles where id = v_actor;

  insert into notifications (user_id, actor_id, type, body)
  select pp.id, v_actor, 'guardrail',
         coalesce(v_actor_name, 'A parent') || ' changed a guardrail on '
         || coalesce(v_child_name, 'your teen') || '''s account'
  from profiles pp
  where pp.family_id = v_family
    and pp.role = 'parent'
    and pp.id <> v_actor;

  return to_jsonb(v_row);
end;
$$;

grant execute on function public.set_family_guardrail(uuid, text, jsonb) to authenticated;


-- ── 6. family_activity_ping — the meter's write path ────────────────────────
-- Rate-limited to one minute of credit per 50s of wall clock, so a reload storm
-- or two open tabs cannot inflate the number.
create or replace function public.family_activity_ping()
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_tz  text;
  v_day date;
  v_min int;
  v_limit int;
begin
  if v_uid is null then
    return jsonb_build_object('minutes', 0, 'limit', null, 'locked', false);
  end if;

  select coalesce(g.tz, 'America/New_York'), g.daily_limit_min
    into v_tz, v_limit
  from family_guardrails g where g.child_id = v_uid;

  v_tz := coalesce(v_tz, 'America/New_York');
  v_day := (now() at time zone v_tz)::date;

  insert into family_activity_days (child_id, day, minutes, last_ping_at)
  values (v_uid, v_day, 0, now() - interval '1 minute')
  on conflict (child_id, day) do nothing;

  update family_activity_days
     set minutes = minutes + 1, last_ping_at = now()
   where child_id = v_uid and day = v_day
     and last_ping_at < now() - interval '50 seconds';

  select minutes into v_min
  from family_activity_days where child_id = v_uid and day = v_day;

  return jsonb_build_object(
    'minutes', coalesce(v_min, 0),
    'limit', v_limit,
    'locked', not public.family_writes_allowed()
  );
end;
$$;

grant execute on function public.family_activity_ping() to authenticated;


-- ── 7. THE ENFORCEMENT — restrictive policies ───────────────────────────────
-- RESTRICTIVE policies AND with the existing permissive ones, so these can only
-- ever subtract. Both predicates return TRUE for any caller with no guardrail
-- row, which is every account that exists today.

drop policy if exists "Guardrails gate chat writes" on chat_messages;
create policy "Guardrails gate chat writes" on chat_messages
  as restrictive for insert to authenticated
  with check (public.family_writes_allowed() and public.family_chat_scope_ok());

drop policy if exists "Guardrails gate feed writes" on feed_posts;
create policy "Guardrails gate feed writes" on feed_posts
  as restrictive for insert to authenticated
  with check (public.family_writes_allowed() and public.family_chat_scope_ok());

drop policy if exists "Guardrails gate comment writes" on post_comments;
create policy "Guardrails gate comment writes" on post_comments
  as restrictive for insert to authenticated
  with check (public.family_writes_allowed() and public.family_chat_scope_ok());

-- Downtime / daily limit also stop paper trading. Chat scope does NOT apply
-- here — the guardrail is about who a teen talks to, not whether they may
-- practise.
drop policy if exists "Guardrails gate sim positions" on sim_positions;
create policy "Guardrails gate sim positions" on sim_positions
  as restrictive for insert to authenticated
  with check (public.family_writes_allowed());

drop policy if exists "Guardrails gate sim trades" on sim_trades;
create policy "Guardrails gate sim trades" on sim_trades
  as restrictive for insert to authenticated
  with check (public.family_writes_allowed());


-- ── 8. family_circle_messages — F4, the private household thread ────────────
-- Deliberately NOT chat_messages. That table's SELECT policy is a bare
-- room_id IN (three constant uuids) comparison, because Supabase Realtime
-- cannot authorize a policy that subqueries another table (scars: migrations
-- 018/019/033). A per-family room needs a per-family predicate, and adding one
-- to chat_messages risks the community room's realtime authorization for every
-- member in production. A separate table carries its own policy safely.
create table if not exists family_circle_messages (
  id         uuid primary key default gen_random_uuid(),
  family_id  uuid not null references families(id) on delete cascade,
  author_id  uuid references profiles(id) on delete set null,
  kind       text not null default 'message' check (kind in ('message', 'system')),
  body       text not null check (btrim(body) <> ''),
  created_at timestamptz not null default now()
);

create index if not exists idx_family_circle_family
  on family_circle_messages(family_id, created_at desc);

alter table family_circle_messages enable row level security;
grant select, insert on family_circle_messages to authenticated;

drop policy if exists "Family reads its circle" on family_circle_messages;
create policy "Family reads its circle" on family_circle_messages
  for select to authenticated
  using (family_id = public.get_my_family_id());

-- The circle stays open under chat_family_only — that is the guardrail's whole
-- point. Downtime and the daily limit still apply.
drop policy if exists "Family writes its circle" on family_circle_messages;
create policy "Family writes its circle" on family_circle_messages
  for insert to authenticated
  with check (
    family_id = public.get_my_family_id()
    and author_id = auth.uid()
    and kind = 'message'
    and public.family_writes_allowed()
  );


-- ── 9. family_watchlist_votes — F6 ──────────────────────────────────────────
-- "Which company should we learn about tonight?" One vote per member per night.
create table if not exists family_watchlist_votes (
  id           uuid primary key default gen_random_uuid(),
  family_id    uuid not null references families(id) on delete cascade,
  user_id      uuid not null references profiles(id) on delete cascade,
  ticker       text not null,
  company_name text,
  vote_night   date not null default current_date,
  created_at   timestamptz not null default now(),
  unique (family_id, user_id, vote_night)
);

create index if not exists idx_family_votes_night
  on family_watchlist_votes(family_id, vote_night);

alter table family_watchlist_votes enable row level security;
grant select, insert, update, delete on family_watchlist_votes to authenticated;

drop policy if exists "Family reads votes" on family_watchlist_votes;
create policy "Family reads votes" on family_watchlist_votes
  for select to authenticated
  using (family_id = public.get_my_family_id());

drop policy if exists "Members cast own vote" on family_watchlist_votes;
create policy "Members cast own vote" on family_watchlist_votes
  for insert to authenticated
  with check (
    family_id = public.get_my_family_id()
    and user_id = auth.uid()
    and public.family_writes_allowed()
  );

drop policy if exists "Members change own vote" on family_watchlist_votes;
create policy "Members change own vote" on family_watchlist_votes
  for update to authenticated
  using (user_id = auth.uid() and family_id = public.get_my_family_id())
  with check (user_id = auth.uid() and family_id = public.get_my_family_id());

drop policy if exists "Members clear own vote" on family_watchlist_votes;
create policy "Members clear own vote" on family_watchlist_votes
  for delete to authenticated
  using (user_id = auth.uid() and family_id = public.get_my_family_id());


-- ── 10. read RPCs ───────────────────────────────────────────────────────────
-- sim_portfolios RLS is strictly own-row (`auth.uid() = user_id`, migration
-- 003), so a parent cannot read their own child's paper account and the family
-- challenge cannot be scored from the client. These three definer functions are
-- the sanctioned, family-scoped windows.

-- Paper standings for the Family Challenge (F1).
create or replace function public.family_paper_standings(p_family uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare v_out jsonb;
begin
  if p_family is null or p_family <> public.get_my_family_id() then
    raise exception 'forbidden';
  end if;

  -- NB: the aggregated column is `payload`, not `row` — ROW is a reserved word.
  select coalesce(jsonb_agg(payload order by return_pct desc nulls last), '[]'::jsonb)
    into v_out
  from (
    select jsonb_build_object(
             'user_id', p.id,
             'display_name', p.display_name,
             'avatar_url', p.avatar_url,
             'role', p.role,
             'balance', sp.balance,
             'starting_balance', sp.starting_balance,
             'return_pct', case
               when sp.starting_balance is null or sp.starting_balance = 0 then null
               else round(((sp.balance - sp.starting_balance) / sp.starting_balance) * 100, 2)
             end
           ) as payload,
           case
             when sp.starting_balance is null or sp.starting_balance = 0 then null
             else ((sp.balance - sp.starting_balance) / sp.starting_balance)
           end as return_pct
    from profiles p
    left join sim_portfolios sp on sp.user_id = p.id
    where p.family_id = p_family
  ) s;

  return v_out;
end;
$$;

grant execute on function public.family_paper_standings(uuid) to authenticated;

-- The teen paper account (F2) — portfolio + open positions, for the teen or a
-- parent in the same family.
create or replace function public.family_paper_account(p_child uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_family uuid;
  v_pf sim_portfolios;
  v_pos jsonb;
begin
  select family_id into v_family from profiles where id = p_child;
  if v_family is null then
    raise exception 'not found';
  end if;
  if not (
    p_child = auth.uid()
    or (v_family = public.get_my_family_id() and public.get_my_role() = 'parent')
  ) then
    raise exception 'forbidden';
  end if;

  select * into v_pf from sim_portfolios where user_id = p_child;
  if v_pf.id is null then
    return jsonb_build_object('portfolio', null, 'positions', '[]'::jsonb);
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
           'symbol', sp.symbol, 'side', sp.side, 'quantity', sp.quantity,
           'entry_price', sp.entry_price, 'opened_at', sp.opened_at
         ) order by sp.opened_at desc), '[]'::jsonb)
    into v_pos
  from sim_positions sp where sp.portfolio_id = v_pf.id;

  return jsonb_build_object('portfolio', to_jsonb(v_pf), 'positions', v_pos);
end;
$$;

grant execute on function public.family_paper_account(uuid) to authenticated;

-- The weekly digest (F3). Every number here is read from a table that something
-- else actually writes. `flags` is deliberately NULL: this product has no
-- moderation-flag store, and a hard-coded 0 would be a claim we cannot make.
create or replace function public.family_child_digest(p_child uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_family uuid;
  v_tz text;
  v_since timestamptz := now() - interval '7 days';
  v_minutes int;
  v_lessons int;
  v_xp int;
  v_pnl numeric;
  v_learn_sec int;
begin
  select family_id into v_family from profiles where id = p_child;
  if v_family is null then
    raise exception 'not found';
  end if;
  if not (v_family = public.get_my_family_id() and public.get_my_role() = 'parent') then
    raise exception 'forbidden';
  end if;

  select coalesce(g.tz, 'America/New_York') into v_tz
  from family_guardrails g where g.child_id = p_child;
  v_tz := coalesce(v_tz, 'America/New_York');

  select coalesce(sum(d.minutes), 0) into v_minutes
  from family_activity_days d
  where d.child_id = p_child
    and d.day >= ((now() at time zone v_tz)::date - 6);

  select count(*), coalesce(sum(lp.time_spent_sec), 0) into v_lessons, v_learn_sec
  from lesson_progress lp
  where lp.user_id = p_child and lp.status = 'completed'
    and lp.completed_at >= v_since;

  select coalesce(sum(x.amount), 0) into v_xp
  from xp_events x where x.user_id = p_child and x.created_at >= v_since;

  select case
    when sp.starting_balance is null or sp.starting_balance = 0 then null
    else round(((sp.balance - sp.starting_balance) / sp.starting_balance) * 100, 2)
  end into v_pnl
  from sim_portfolios sp where sp.user_id = p_child;

  return jsonb_build_object(
    'app_minutes', v_minutes,
    'learn_seconds', v_learn_sec,
    'lessons', v_lessons,
    'xp', v_xp,
    'paper_pct', v_pnl,
    'flags', null
  );
end;
$$;

grant execute on function public.family_child_digest(uuid) to authenticated;


comment on table family_guardrails is
  'Family Mode guardrails (canvas F3). chat_family_only / downtime / daily_limit_min are ENFORCED by restrictive INSERT policies on chat_messages, feed_posts, post_comments, sim_positions, sim_trades and family_circle_messages. live_listen_only is recorded only (no speak path exists yet). Paper-only and options-hidden are structural product facts, not columns. There is no follow graph, so "approve who they follow" is deliberately absent.';
comment on table family_circle_messages is
  'The private household thread (canvas F4). Separate from chat_messages because that table''s realtime-safe SELECT policy cannot carry a per-family predicate (migrations 018/019 scars).';
comment on table family_activity_days is
  'Per-child per-local-day minutes, written by family_activity_ping(). The only measured "time in app" in the schema; coverage is limited to surfaces that mount the ping.';
