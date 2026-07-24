-- 130 — Challenge cohort source attribution (Lane C7 funnel follow-ups)
--
-- The register route now stamps the funnel `src` param (e.g. ?src=funnel from
-- the club-site challenge CTAs) onto marketing_leads.custom.src. This migration
-- teaches admin_challenge_cohort to surface the funnel-vs-organic split so the
-- /admin/crm/challenge dashboard can segment cohort acquisition:
--   • a new `signups_by_source` aggregate ({ source, signups }[]) and
--   • a `src` field on every member row.
--
-- Pure read-side change — same shape as migration 128's RPC, plus the two new
-- keys. Everything else (activation / engagement / conversion) is unchanged.

create or replace function admin_challenge_cohort()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  result jsonb;
begin
  if not exists (select 1 from profiles where id = auth.uid() and role = 'admin') then
    raise exception 'admin only';
  end if;

  with cohort as (
    select l.id as lead_id,
           l.email,
           l.first_name,
           l.created_at,
           l.converted_profile_id as user_id,
           -- Attribution: empty / null src ⇒ 'organic'; otherwise the raw src
           -- value (e.g. 'funnel'). Trimmed + lowercased for stable grouping.
           coalesce(nullif(lower(trim(l.custom->>'src')), ''), 'organic') as src,
           p.family_id,
           p.onboarding_complete,
           ft.tier,
           e.expires_at,
           e.status as pass_status
    from marketing_leads l
    left join profiles p on p.id = l.converted_profile_id
    left join family_tiers ft on ft.family_id = p.family_id
    left join enrollments e
      on e.family_id = p.family_id and e.program = 'challenge_pass'
    where l.source = 'challenge'
  ),
  eng as (
    select c.lead_id,
           coalesce((select sum(x.amount) from xp_events x where x.user_id = c.user_id), 0) as xp,
           coalesce((select count(*) from alert_rules ar where ar.user_id = c.user_id), 0) as alert_rules,
           coalesce((select count(*) from feed_posts fp where fp.author_id = c.user_id), 0) as posts
    from cohort c
  )
  select jsonb_build_object(
    'total', (select count(*) from cohort),
    'activated', (select count(*) from cohort where onboarding_complete),
    'engaged', (select count(*) from eng where xp > 0 or alert_rules > 0 or posts > 0),
    'converted_paid', (select count(*) from cohort where tier in ('fic', 'fta')
                        and not exists (
                          select 1 from enrollments e2
                          where e2.family_id = cohort.family_id and e2.program = 'challenge_pass'
                            and e2.status = 'active' and (e2.expires_at is null or e2.expires_at > now())
                        )),
    'pass_active', (select count(*) from cohort where expires_at is not null and expires_at > now()),
    'downgraded_free', (select count(*) from cohort where tier = 'free'),
    'signups_by_day', coalesce((
      select jsonb_agg(row_to_json(t) order by t.day)
      from (
        select to_char(date_trunc('day', created_at), 'YYYY-MM-DD') as day, count(*) as signups
        from cohort group by 1
      ) t
    ), '[]'::jsonb),
    'signups_by_source', coalesce((
      select jsonb_agg(row_to_json(t) order by t.signups desc, t.source)
      from (
        select src as source, count(*) as signups
        from cohort group by src
      ) t
    ), '[]'::jsonb),
    'members', coalesce((
      select jsonb_agg(row_to_json(t) order by t.created_at desc)
      from (
        select c.email, c.first_name, c.created_at, c.user_id, c.onboarding_complete,
               c.tier, c.expires_at, c.src,
               e.xp, e.alert_rules, e.posts
        from cohort c join eng e on e.lead_id = c.lead_id
      ) t
    ), '[]'::jsonb)
  ) into result;

  return result;
end;
$$;
grant execute on function admin_challenge_cohort() to authenticated;
