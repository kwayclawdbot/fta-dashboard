-- 126 — Challenge pass mechanics (Lane C7)
--
-- The 5-Day Investing Challenge (owner 2026-07-24): NO card at signup, IMMEDIATE
-- full Club access, access lasts until the challenge END, then the member pays
-- $99/mo to continue or drops to the free tier automatically.
--
-- TIER MECHANISM (least-invasive, reuses the ONE derivation in family_tiers):
--   Rather than a parallel challenge_passes table, we extend the existing
--   enrollments table exactly as migration 060 did for 'free':
--     • a new program value 'challenge_pass'
--     • a nullable expires_at column (only challenge_pass uses it)
--   The family_tiers view then resolves an ACTIVE, UNEXPIRED challenge_pass to
--   'fic' (full Club, fic-equivalent) and an EXPIRED one to 'free'. Because the
--   view is DERIVED, expiry needs no row mutation — the pass row stays
--   status='active' forever and time alone flips the tier. The app's existing
--   free-tier LockedStates then take over with zero extra wiring.

-- ── 1. enrollments.expires_at (null = never expires) ─────────────────────────
alter table enrollments add column if not exists expires_at timestamptz;

-- ── 2. enrollments.program gains 'challenge_pass' ────────────────────────────
alter table enrollments drop constraint if exists enrollments_program_check;
alter table enrollments add constraint enrollments_program_check
  check (program in ('fic', 'fta', 'free', 'challenge_pass'));

-- ── 3. family_tiers — challenge_pass folded into the priority ladder ──────────
-- Priority (unchanged for fta/fic/free/default; two challenge_pass branches
-- inserted): fta > fic > (unexpired challenge_pass ⇒ fic) > free >
-- (expired challenge_pass ⇒ free) > default fic. A challenge signup carries ONLY
-- a challenge_pass row, so it reads 'fic' until expires_at, then 'free'.
create or replace view family_tiers as
  select f.id as family_id,
         case
           when exists (
             select 1 from enrollments e
             where e.family_id = f.id and e.program = 'fta' and e.status = 'active'
           ) then 'fta'
           when exists (
             select 1 from enrollments e
             where e.family_id = f.id and e.program = 'fic' and e.status = 'active'
           ) then 'fic'
           when exists (
             select 1 from enrollments e
             where e.family_id = f.id and e.program = 'challenge_pass'
               and e.status = 'active'
               and (e.expires_at is null or e.expires_at > now())
           ) then 'fic'
           when exists (
             select 1 from enrollments e
             where e.family_id = f.id and e.program = 'free' and e.status = 'active'
           ) then 'free'
           when exists (
             select 1 from enrollments e
             where e.family_id = f.id and e.program = 'challenge_pass' and e.status = 'active'
           ) then 'free'
           else 'fic'
         end as tier
  from families f;

grant select on family_tiers to authenticated;

-- ── 4. app_settings — challenge window (public-readable, non-sensitive) ───────
-- challenge_start / challenge_end drive the signup framing and the pass
-- expires_at. Stored as ISO strings (jsonb text) like free_class_video_url.
insert into app_settings (key, value) values
  ('challenge_start', to_jsonb('2026-09-01T00:00:00Z'::text)),
  ('challenge_end',   to_jsonb('2026-09-06T00:00:00Z'::text))
on conflict (key) do nothing;

-- ── 5. index for the daily expiry cron scan ──────────────────────────────────
create index if not exists idx_enrollments_challenge_expiry
  on enrollments (expires_at)
  where program = 'challenge_pass' and status = 'active';

-- ── 5b. marketing_leads.source gains 'challenge' (cohort tagging) ─────────────
alter table marketing_leads drop constraint if exists marketing_leads_source_check;
alter table marketing_leads add constraint marketing_leads_source_check
  check (source in ('csv', 'facebook', 'manual', 'referral', 'free_class', 'challenge'));

-- ── 6. challenge_pass_notices — de-dupe warning / expiry emails ───────────────
-- One row per (enrollment, kind) so the cron never re-sends the same notice.
-- Written by the service role from the cron; admin-readable for the dashboard.
create table if not exists challenge_pass_notices (
  enrollment_id uuid not null references enrollments(id) on delete cascade,
  kind text not null check (kind in ('warn_3d', 'warn_1d', 'expired')),
  sent_at timestamptz not null default now(),
  resend_id text,
  primary key (enrollment_id, kind)
);

alter table challenge_pass_notices enable row level security;
grant select on challenge_pass_notices to authenticated;

drop policy if exists "challenge_pass_notices admin read" on challenge_pass_notices;
create policy "challenge_pass_notices admin read" on challenge_pass_notices
  for select to authenticated
  using (exists (select 1 from profiles where id = auth.uid() and role = 'admin'));

-- ── 7. admin_challenge_cohort — one SECURITY DEFINER RPC for the dashboard ────
-- Aggregates the challenge cohort from marketing_leads (source='challenge') +
-- their converted profiles/families: signups over time, activation (wizard done
-- = onboarding_complete), engagement (xp / alert rules / community posts), and
-- post-challenge conversion (paid fic|fta vs downgraded free vs still-active
-- pass). Admin-gated internally so the (admin) route is the only caller.
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
    'members', coalesce((
      select jsonb_agg(row_to_json(t) order by t.created_at desc)
      from (
        select c.email, c.first_name, c.created_at, c.user_id, c.onboarding_complete,
               c.tier, c.expires_at,
               e.xp, e.alert_rules, e.posts
        from cohort c join eng e on e.lead_id = c.lead_id
      ) t
    ), '[]'::jsonb)
  ) into result;

  return result;
end;
$$;
grant execute on function admin_challenge_cohort() to authenticated;
