-- ============================================================================
-- 035 — Family XP leaderboard: SUM → AVERAGE (owner decision 2026-07-20).
--
-- Family XP now = the AVERAGE lifetime XP of the family's members (not the sum),
-- so a large family gets no unfair advantage over a small one. Friendly
-- kid-vs-kid competition is wanted, so the individual leaderboards stay as they
-- are; only this cross-family family_xp_leaderboard changes.
--
-- `tier` and the row shape ({family_id, name, tier, members, xp}) are preserved
-- exactly so the /leaderboard page and the community sidebar keep working — the
-- only change is `xp` is now avg-per-member (rounded to int) instead of a sum.
-- The window filter (all / 7d / 30d) is preserved.
-- ============================================================================

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
           -- AVERAGE of each member's lifetime (windowed) XP, rounded to int.
           coalesce(round(avg(mx.member_xp)), 0)::int as xp
    from families f
    join profiles p on p.family_id = f.id
    left join lateral (
      select coalesce(sum(x.amount), 0) as member_xp
      from xp_events x
      where x.user_id = p.id
        and (
          p_window = 'all'
          or (p_window = '7d'  and x.created_at >= now() - interval '7 days')
          or (p_window = '30d' and x.created_at >= now() - interval '30 days')
        )
    ) mx on true
    group by f.id, f.name
  ) t;
$$;

grant execute on function family_xp_leaderboard(text) to authenticated;
