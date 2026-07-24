-- ============================================================================
-- 128 — Challenge cohort email machine (Lane C8 part 3)
--
-- The 5-Day Investing Challenge cohort (marketing_leads.source='challenge',
-- enrollments.program='challenge_pass') gets a DEDICATED, owner-directed email
-- sequence that is SEPARATE from the 13B welcome drips:
--   • an instant REGISTRATION WELCOME (sent from the register route, not cron),
--   • an AUGUST activation sequence (weekly value emails),
--   • a SHOW-UP sequence (D-3 / D-1 / day-of),
--   • DAILY challenge mission emails (Sept 1-5),
--   • a CLOSE sequence (stats recap / $99+$1500 offer / warm last-call).
--
-- Pieces:
--   1. challenge_sequences — one row per (user, step). status/sent_at/resend_id
--      make the pipeline idempotent (a step sends at most once; re-running the
--      cron is safe). Scheduled on a FIXED calendar at enrollment; late signups
--      only get the still-future steps.
--   2. app_settings 'challenge_emails_enabled' (DEFAULT true) — the hard gate for
--      the WHOLE challenge machine (registration welcome + every cron step). This
--      is INTENTIONALLY separate from 'drip_enabled' (which stays false): the
--      owner has NOT approved the 13B drip visuals, but the challenge emails are
--      owner-directed and enabled. Real sends only occur as real challenge
--      signups happen — currently zero cohort members, so nothing real fires yet.
--   3. enroll_welcome_drip() gains a challenge guard — a family holding an ACTIVE
--      challenge_pass is skipped, so the cohort never double-receives the generic
--      welcome drip on top of this dedicated sequence.
--   4. admin_challenge_cohort() gains a 'sequences' block (per-step scheduled/sent
--      counts) for the /admin/crm/challenge dashboard.
--
-- Unsubscribe reuses the drip HMAC token + drip_optouts (one opt-out silences
-- BOTH the welcome drips and the challenge sequence). RLS: own-or-admin SELECT;
-- all writes via the service role (register route + cron).
-- ============================================================================

-- ── 1. challenge_sequences ───────────────────────────────────────────────────
create table if not exists challenge_sequences (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references profiles(id) on delete cascade,
  family_id    uuid references families(id) on delete cascade,
  step         text not null,                 -- see CHALLENGE_STEPS in the lib
  scheduled_at timestamptz not null,
  sent_at      timestamptz,
  resend_id    text,
  status       text not null default 'pending'
                 check (status in ('pending', 'sent', 'failed', 'skipped', 'suppressed')),
  error        text,
  created_at   timestamptz not null default now(),
  unique (user_id, step)                       -- idempotent enrollment
);

create index if not exists idx_challenge_seq_due
  on challenge_sequences (scheduled_at)
  where status = 'pending' and sent_at is null;
create index if not exists idx_challenge_seq_user on challenge_sequences (user_id);

alter table challenge_sequences enable row level security;
grant select on challenge_sequences to authenticated;

drop policy if exists "challenge_sequences own or admin read" on challenge_sequences;
create policy "challenge_sequences own or admin read" on challenge_sequences
  for select using (
    user_id = auth.uid()
    or exists (select 1 from profiles where id = auth.uid() and role = 'admin')
  );

-- ── 2. feature flag — the challenge machine's hard gate (DEFAULT true) ─────────
insert into app_settings (key, value)
values ('challenge_emails_enabled', 'true'::jsonb)
on conflict (key) do nothing;

-- ── 3. enroll_welcome_drip() — skip families holding an active challenge_pass ─
-- The cohort gets the dedicated challenge sequence INSTEAD of the generic welcome
-- drip, so we suppress the drip enrollment at the source. Everything else about
-- the function is unchanged from migration 120.
create or replace function enroll_welcome_drip()
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid     uuid := auth.uid();
  v_role    text;
  v_email   text;
  v_family  uuid;
  v_tier    text;
  v_house   jsonb;
  v_adults  int;
  v_kids    int;
  v_ranges  int;
  v_variant text;
  v_now     timestamptz := now();
  v_offsets int[] := array[0, 1, 3, 5, 7];
  v_step    int;
begin
  if v_uid is null then
    return 0;
  end if;

  -- Opted out earlier → never re-enroll.
  if exists (select 1 from drip_optouts where user_id = v_uid) then
    return 0;
  end if;

  -- Already enrolled → idempotent no-op (one welcome sequence per user ever).
  if exists (
    select 1 from email_drips where user_id = v_uid and sequence = 'welcome'
  ) then
    return 0;
  end if;

  select role, email, family_id
    into v_role, v_email, v_family
    from profiles where id = v_uid;

  -- Challenge cohort guard (Lane C8): a family holding an ACTIVE challenge_pass
  -- receives the dedicated challenge sequence, not the generic welcome drip.
  -- Suppress here so the two machines never double-send a welcome.
  if exists (
    select 1 from enrollments e
    where e.family_id = v_family
      and e.program = 'challenge_pass'
      and e.status = 'active'
  ) then
    return 0;
  end if;

  -- Adults only. Solo adults and parents are BOTH role 'parent'; kids are
  -- role 'child' and are intentionally never enrolled.
  if v_role is distinct from 'parent' then
    return 0;
  end if;
  if v_email is null or position('@' in v_email) = 0 then
    return 0;
  end if;

  -- Live tier (fta > fic > free) and household shape at completion time.
  select tier into v_tier from family_tiers where family_id = v_family;
  select household into v_house from family_profiles where family_id = v_family;

  v_adults := coalesce((v_house->>'adults')::int, 1);
  v_kids   := coalesce((v_house->>'kids')::int, 0);
  v_ranges := coalesce(jsonb_array_length(v_house->'kid_age_ranges'), 0);

  if v_tier = 'fta' then
    v_variant := 'fta';
  elsif (v_house ? 'adults') and v_adults <= 1 and v_kids = 0 and v_ranges = 0 then
    v_variant := 'solo';
  else
    v_variant := 'parent';
  end if;

  foreach v_step in array v_offsets loop
    insert into email_drips (user_id, sequence, step, variant, scheduled_at)
    values (
      v_uid, 'welcome', v_step, v_variant,
      v_now + (v_step || ' days')::interval
    )
    on conflict (user_id, sequence, step) do nothing;
  end loop;

  return array_length(v_offsets, 1);
end;
$$;

grant execute on function enroll_welcome_drip() to authenticated;

-- ── 4. admin_challenge_cohort() — add per-step sequence counts ────────────────
-- Same body as migration 126 plus a 'sequences' block: for every challenge
-- sequence step, how many are scheduled (pending) vs sent, restricted to the
-- challenge cohort's users. Admin-gated internally.
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
    'sequences', coalesce((
      select jsonb_agg(row_to_json(t) order by t.first_scheduled)
      from (
        select cs.step,
               count(*) filter (where cs.status = 'sent')                  as sent,
               count(*) filter (where cs.status = 'pending')               as pending,
               count(*) filter (where cs.status in ('failed', 'skipped', 'suppressed')) as other,
               min(cs.scheduled_at) as first_scheduled
        from challenge_sequences cs
        where cs.user_id in (select user_id from cohort where user_id is not null)
        group by cs.step
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
