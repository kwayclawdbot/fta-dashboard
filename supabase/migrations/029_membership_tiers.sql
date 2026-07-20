-- 029 — Membership tier separation: FIC (foundations, $99/mo) vs FTA (premium, $2,997)
--
-- Source of truth stays the existing `enrollments` table (family-level,
-- program 'fic'|'fta', status 'active'). Tier = 'fta' when the family has an
-- active FTA enrollment, else 'fic'. Kids inherit the family tier via
-- profiles.family_id.
--
-- a) family_tiers — a deliberately security-definer view (owner bypasses the
--    "read own family only" RLS on enrollments) exposing ONLY family_id + tier,
--    so any member can render tier badges for other families (community feed,
--    leaderboard) without widening enrollments RLS. No policies on realtime
--    tables are touched (see 018/019 for why that matters).
create or replace view family_tiers as
  select f.id as family_id,
         case when exists (
           select 1 from enrollments e
           where e.family_id = f.id
             and e.program = 'fta'
             and e.status = 'active'
         ) then 'fta' else 'fic' end as tier
  from families f;

grant select on family_tiers to authenticated;

-- b) Leaderboard rows carry the family tier (function is already SECURITY
--    DEFINER and returns aggregate-level data only).
create or replace function family_xp_leaderboard(p_window text default 'all')
returns jsonb
language sql
security definer
set search_path = public
as $$
  select coalesce(jsonb_agg(row_to_json(t) order by t.xp desc, t.name), '[]'::jsonb)
  from (
    select f.id as family_id,
           f.name,
           case when exists (
             select 1 from enrollments e
             where e.family_id = f.id
               and e.program = 'fta'
               and e.status = 'active'
           ) then 'fta' else 'fic' end as tier,
           count(distinct p.id) as members,
           coalesce(sum(x.amount), 0)::int as xp
    from families f
    join profiles p on p.family_id = f.id
    left join xp_events x on x.user_id = p.id
      and (
        p_window = 'all'
        or (p_window = '7d'  and x.created_at >= now() - interval '7 days')
        or (p_window = '30d' and x.created_at >= now() - interval '30 days')
      )
    group by f.id, f.name
  ) t;
$$;
grant execute on function family_xp_leaderboard(text) to authenticated;

-- c) Admin tier setter — enrollment is manual today (admin flips it after a
--    Stripe payment-link checkout). Upserts/cancels enrollments rows and keeps
--    the legacy families.plan_tier column in sync so nothing drifts.
create or replace function admin_set_family_tier(p_family_id uuid, p_tier text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_cohort uuid;
begin
  if not exists (select 1 from profiles where id = auth.uid() and role = 'admin') then
    raise exception 'admin only';
  end if;
  if p_tier not in ('fic', 'fta') then
    raise exception 'invalid tier %', p_tier;
  end if;

  if p_tier = 'fta' then
    -- attach the newest FTA cohort so drip weeks resolve (kept if already set)
    select id into v_cohort
    from cohorts where program = 'fta'
    order by start_date desc limit 1;

    insert into enrollments (family_id, program, cohort_id, status)
    values (p_family_id, 'fta', v_cohort, 'active')
    on conflict (family_id, program)
    do update set status = 'active',
                  cohort_id = coalesce(enrollments.cohort_id, excluded.cohort_id);

    update families set plan_tier = 'academy', updated_at = now()
    where id = p_family_id;
  else
    update enrollments set status = 'cancelled'
    where family_id = p_family_id and program = 'fta' and status = 'active';

    insert into enrollments (family_id, program, status)
    values (p_family_id, 'fic', 'active')
    on conflict (family_id, program) do update set status = 'active';

    update families set plan_tier = 'challenge', updated_at = now()
    where id = p_family_id;
  end if;
end;
$$;
grant execute on function admin_set_family_tier(uuid, text) to authenticated;
