-- ============================================================================
-- 099 — XP Leaderboards (belts era): windowed individual + family boards.
--
-- Lane 2 rebuilds /leaderboard into ONE feature with two dimensions × three
-- periods: Families | Individuals × Weekly | Monthly | All-time. This migration
-- ships the DATA layer — two SECURITY DEFINER RPCs consistent with the existing
-- family_xp_leaderboard (035): jsonb aggregates, trailing windows over
-- xp_events.created_at, family score = AVERAGE of CURRENT members' windowed XP.
--
-- Windows are trailing/rolling (7d/30d), NOT calendar buckets, so a period is
-- always full and honest — the UI labels them "Last 7 days" / "Last 30 days".
--
-- RLS posture (matches the repo scars): the community is auth-gated; these RPCs
-- are definer + require auth.uid(), returning only safe display fields. Belts +
-- levels are derived CLIENT-SIDE from the returned xp (src/lib/belts.ts is the
-- single source of truth), so the SQL never duplicates the ladder.
--
-- NOTE: idx_xp_events_created on xp_events(created_at) already exists (checked
-- against the live DB); the CREATE below is a documented no-op via IF NOT EXISTS.
-- No public.schema_migrations table exists in this project — migrations are
-- tracked by the numbered files in supabase/migrations/ (see 097/098).
-- ============================================================================

create index if not exists idx_xp_events_created on public.xp_events (created_at);

-- ── window helper (inlined per-RPC to keep them self-contained) ──────────────
-- A member's XP within the requested trailing window. 'all' = lifetime.

-- ── 1. Individuals board ─────────────────────────────────────────────────────
-- p_scope 'all'    → the global top 100 by windowed XP, PLUS the caller's own
--                    ranked row (so "Me" can be pinned when outside the top N).
-- p_scope 'family' → every current member of the caller's family, ranked within
--                    the family (this folds in the old /family/leaderboard view).
-- Returns { rows: [...], me: {...}|null }. Each row carries the age band (kids/
-- teens/adults, resolved exactly like feed.ageGroupOf), family name, and tier so
-- the UI can render Avatar + belt + AgeBadge + family without an N+1.

create or replace function public.xp_leaderboard_individuals(
  p_window text default 'all',
  p_scope  text default 'all'
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_me        uuid := auth.uid();
  v_my_family uuid;
  v_rows      jsonb;
  v_me_row    jsonb;
begin
  if v_me is null then
    return jsonb_build_object('rows', '[]'::jsonb, 'me', null);
  end if;

  select family_id into v_my_family from public.profiles where id = v_me;

  with base as (
    select
      p.id,
      p.display_name,
      p.username,
      p.avatar_url,
      p.role,
      p.family_id,
      case
        when p.age_group in ('kids','teens','adults') then p.age_group
        when p.role = 'child' then 'teens'
        else 'adults'
      end as age_band,
      f.name as family_name,
      coalesce(ft.tier, 'fic') as tier,
      coalesce(mx.member_xp, 0)::int as xp
    from public.profiles p
    left join public.families f on f.id = p.family_id
    left join public.family_tiers ft on ft.family_id = p.family_id
    left join lateral (
      select sum(x.amount) as member_xp
      from public.xp_events x
      where x.user_id = p.id
        and (
          p_window = 'all'
          or (p_window = '7d'  and x.created_at >= now() - interval '7 days')
          or (p_window = '30d' and x.created_at >= now() - interval '30 days')
        )
    ) mx on true
    where p_scope <> 'family' or p.family_id = v_my_family
  ),
  ranked as (
    select
      b.*,
      row_number() over (order by b.xp desc, lower(coalesce(b.display_name, 'zz')), b.id) as rank
    from base b
  ),
  shaped as (
    select
      r.rank, r.id, r.display_name, r.username, r.avatar_url,
      r.age_band as age_group, r.role, r.family_id, r.family_name, r.tier, r.xp,
      (r.id = v_me) as is_me,
      (r.family_id is not null and r.family_id = v_my_family) as is_my_family
    from ranked r
  )
  select
    coalesce(jsonb_agg(row_to_json(s) order by s.rank) filter (
      where p_scope = 'family' or s.rank <= 100
    ), '[]'::jsonb),
    (select row_to_json(s2) from shaped s2 where s2.is_me limit 1)
  into v_rows, v_me_row
  from shaped s;

  return jsonb_build_object('rows', v_rows, 'me', v_me_row);
end $$;

grant execute on function public.xp_leaderboard_individuals(text, text) to authenticated;

-- ── 2. Families board ────────────────────────────────────────────────────────
-- Family score = AVERAGE of every CURRENT member's windowed XP (owner rule,
-- applied per window). Same avg-per-member semantics as family_xp_leaderboard
-- (035); this variant also returns a capped member-avatar cluster (top 6 by
-- windowed XP, each with their own windowed XP so the Avatar can show a belt
-- dot) for the row's avatar stack. Row shape stays superset-compatible with 035
-- ({family_id, name, tier, members, xp}).

create or replace function public.xp_leaderboard_families(p_window text default 'all')
returns jsonb
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  with mem as (
    select
      p.id, p.family_id, p.display_name, p.username, p.avatar_url,
      coalesce(mx.member_xp, 0)::int as xp
    from public.profiles p
    join public.families f on f.id = p.family_id
    left join lateral (
      select sum(x.amount) as member_xp
      from public.xp_events x
      where x.user_id = p.id
        and (
          p_window = 'all'
          or (p_window = '7d'  and x.created_at >= now() - interval '7 days')
          or (p_window = '30d' and x.created_at >= now() - interval '30 days')
        )
    ) mx on true
    where auth.uid() is not null
  )
  select coalesce(jsonb_agg(row_to_json(t) order by t.xp desc, t.name), '[]'::jsonb)
  from (
    select
      f.id as family_id,
      f.name,
      coalesce(ft.tier, 'fic') as tier,
      count(m.id) as members,
      coalesce(round(avg(m.xp)), 0)::int as xp,
      (
        select coalesce(jsonb_agg(jsonb_build_object(
          'display_name', a.display_name,
          'avatar_url',   a.avatar_url,
          'username',     a.username,
          'xp',           a.xp
        ) order by a.xp desc), '[]'::jsonb)
        from (
          select * from mem m2 where m2.family_id = f.id order by m2.xp desc limit 6
        ) a
      ) as avatars
    from public.families f
    join mem m on m.family_id = f.id
    left join public.family_tiers ft on ft.family_id = f.id
    group by f.id, f.name, ft.tier
  ) t;
$$;

grant execute on function public.xp_leaderboard_families(text) to authenticated;
