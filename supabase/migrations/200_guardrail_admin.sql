-- ══════════════════════════════════════════════════════════════════════════
-- 200 · GUARDRAILS ACCEPT THE ADMIN ROLE
--
-- WHY. `getFamilyContext().isParent` was widened back to `parent || admin`
-- (src/lib/family/queries.ts) so an admin who belongs to a household — the
-- owner's own account is exactly this — sees the parent surfaces again. The
-- database was never widened with it, so migration 192's write path still
-- enforced `role = 'parent'` and every toggle on /family/teen/:id/guardrails
-- came back 400 P0001 "parents only" for that account: a live control the
-- server refuses. This migration closes the mismatch from the database side.
--
-- WHAT CHANGES. One predicate, in the places the guardrail surface touches:
-- `role = 'parent'` becomes `role in ('parent','admin')`. NOTHING else moves —
-- the household check (`family_id = <the child's family>`) is untouched, so an
-- admin still gets nothing unless they are IN that household. This is not a
-- staff back door into other families' data.
--
-- WHAT IS PRESERVED. The audit row into family_guardrail_events, the
-- notification to the OTHER adults in the household, the setting allow-list,
-- the per-setting cast rules and the returned row: all byte-identical to 192.
--
-- The notify recipient set is widened the same way, and only ever grows: every
-- parent who was notified before is still notified; an admin-parent in the
-- household now gets the same notice a parent would. "Guardrail changes notify
-- both parents" stays true — "both parents" now includes the household adult
-- whose role happens to be admin.
--
-- Read paths on the SAME screen move with the write path, or the screen is
-- incoherent: an account that may change a guardrail must be able to see the
-- log of the change it just made, and the weekly digest beside it. Both keep
-- their family check.
-- ══════════════════════════════════════════════════════════════════════════

-- ── 1. The write path ───────────────────────────────────────────────────────
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

  -- The child must be a child in the caller's family, and the caller an adult
  -- of that household — a parent, or an admin who belongs to it.
  select p.family_id, p.display_name into v_family, v_child_name
  from profiles p
  where p.id = p_child and p.role = 'child';

  if v_family is null then
    raise exception 'not a supervised member';
  end if;

  if not exists (
    select 1 from profiles pp
    where pp.id = v_actor
      and pp.role in ('parent', 'admin')
      and pp.family_id = v_family
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

  -- Notify the other adult(s) of the household — every one except the actor.
  select display_name into v_actor_name from profiles where id = v_actor;

  insert into notifications (user_id, actor_id, type, body)
  select pp.id, v_actor, 'guardrail',
         coalesce(v_actor_name, 'A parent') || ' changed a guardrail on '
         || coalesce(v_child_name, 'your teen') || '''s account'
  from profiles pp
  where pp.family_id = v_family
    and pp.role in ('parent', 'admin')
    and pp.id <> v_actor;

  return to_jsonb(v_row);
end;
$$;

grant execute on function public.set_family_guardrail(uuid, text, jsonb) to authenticated;


-- ── 2. The audit log the same screen renders ────────────────────────────────
-- Kids still do not read it: a child seeing "Mom raised your limit, Dad lowered
-- it" turns a guardrail into a negotiation. Only the adult set grows.
drop policy if exists "Parents read guardrail log" on family_guardrail_events;
create policy "Parents read guardrail log" on family_guardrail_events
  for select to authenticated
  using (
    family_id = public.get_my_family_id()
    and public.get_my_role() in ('parent', 'admin')
  );


-- ── 3. The two definer reads behind the same screen ─────────────────────────
-- Unchanged except for the role predicate. The family check stays, so this
-- reaches exactly one household: the caller's own.
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
    or (v_family = public.get_my_family_id()
        and public.get_my_role() in ('parent', 'admin'))
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


-- The weekly digest. Re-stated verbatim from 192 — every number, window and
-- cast is identical, including `flags` staying NULL because this product has no
-- moderation-flag store. The ONLY difference is the role predicate.
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
  if not (v_family = public.get_my_family_id()
          and public.get_my_role() in ('parent', 'admin')) then
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
