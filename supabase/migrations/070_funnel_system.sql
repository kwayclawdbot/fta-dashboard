-- 070 — Funnel system (multi-page free-class funnel: sessions, events, analytics)
--
-- Replaces the single-page free-class quiz's fire-once-at-the-end data model
-- with a resumable, fully-tracked funnel. Two tables carry the run
-- (funnel_sessions = one visitor's journey; funnel_events = every step
-- view/answer/submit/back/exit_intent), the moment an email is captured it is
-- swept into marketing_leads as a partial lead, and admin-gated SECURITY DEFINER
-- RPCs power the /admin/crm/funnel analytics page.
--
-- Security posture mirrors migration 043 (marketing CRM): base tables have RLS
-- ENABLED with NO client policies. All writes go through the service role in
-- server routes; all admin reads go through SECURITY DEFINER RPCs that gate on
-- profiles.role='admin' internally. Base-table RLS is never loosened.

create extension if not exists citext;

-- ── 1. marketing_leads.source gains 'free_class' ─────────────────────────────
-- The marketing module (043) is complete; widening its source CHECK here is the
-- narrow cross-module add the funnel needs so partial leads carry a real source
-- instead of being mislabeled 'manual'. Existing values are unaffected.
alter table marketing_leads drop constraint if exists marketing_leads_source_check;
alter table marketing_leads add constraint marketing_leads_source_check
  check (source in ('csv','facebook','manual','referral','free_class'));

-- ── 2. funnel_sessions — one visitor's resumable journey ─────────────────────
create table if not exists funnel_sessions (
  id         uuid primary key default gen_random_uuid(),
  funnel     text not null default 'free_class',
  -- utm_source/medium/campaign/content + referrer + landing_at, captured on the
  -- landing view and never overwritten once set.
  utm        jsonb not null default '{}'::jsonb,
  answers    jsonb not null default '{}'::jsonb,   -- accumulates quiz answers
  email      citext,
  phone      text,
  sms_optin  boolean not null default false,
  status     text not null default 'started'
               check (status in ('started','engaged','email_captured','registered','abandoned')),
  user_id    uuid references profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_funnel_sessions_status  on funnel_sessions (status);
create index if not exists idx_funnel_sessions_email   on funnel_sessions (email);
create index if not exists idx_funnel_sessions_created on funnel_sessions (created_at desc);
create index if not exists idx_funnel_sessions_funnel  on funnel_sessions (funnel);

-- ── 3. funnel_events — every step interaction ────────────────────────────────
create table if not exists funnel_events (
  id         uuid primary key default gen_random_uuid(),
  session_id uuid not null references funnel_sessions(id) on delete cascade,
  step       text not null,     -- 'landing','q1'..'qN','save','result','register'
  event      text not null
               check (event in ('view','answer','submit','back','exit_intent')),
  meta       jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists idx_funnel_events_session on funnel_events (session_id, created_at);
create index if not exists idx_funnel_events_step    on funnel_events (step, event);
create index if not exists idx_funnel_events_created on funnel_events (created_at desc);

-- RLS ON, NO client policies. Written by the service role in server routes;
-- read by admins only through the RPCs below.
alter table funnel_sessions enable row level security;
alter table funnel_events   enable row level security;

-- ── 4. app_settings — configurable seat count (honest urgency) ───────────────
-- null value => the "X seats left" band is hidden. Admin sets a real number to
-- show honest scarcity. Seeded null so nothing fake ever shows by default.
insert into app_settings (key, value)
values ('free_class_seats_left', 'null'::jsonb)
on conflict (key) do nothing;

-- ── 5. admin gate helper (funnel-local; same shape as _mkt_require_admin) ────
create or replace function _funnel_require_admin()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (select 1 from profiles where id = auth.uid() and role = 'admin') then
    raise exception 'admin only';
  end if;
end;
$$;

-- ── 6. admin_funnel_analytics — per-step chart + source breakdown + totals ───
-- Returns everything the /admin/crm/funnel page renders, for one funnel over a
-- date range: ordered step view-counts (distinct sessions), status milestones,
-- and a per-source table. Step order is canonical for the free-class funnel.
create or replace function admin_funnel_analytics(
  p_funnel text default 'free_class',
  p_from   timestamptz default (now() - interval '30 days'),
  p_to     timestamptz default now()
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_steps   jsonb;
  v_sources jsonb;
  v_totals  jsonb;
  v_sids    uuid[];
begin
  perform _funnel_require_admin();

  -- sessions in range for this funnel
  select coalesce(array_agg(id), '{}') into v_sids
  from funnel_sessions
  where funnel = p_funnel and created_at >= p_from and created_at <= p_to;

  -- per-step distinct-session view counts, in canonical order
  select coalesce(jsonb_agg(row_to_json(t) order by t.ord), '[]'::jsonb)
  into v_steps
  from (
    select s.step,
           s.ord,
           count(distinct e.session_id) as sessions
    from (values
      ('landing',1),('q1',2),('q2',3),('q3',4),
      ('save',5),('result',6),('register',7)
    ) as s(step, ord)
    left join funnel_events e
      on e.step = s.step and e.event = 'view' and e.session_id = any(v_sids)
    group by s.step, s.ord
  ) t;

  -- per-source breakdown from the sessions themselves
  select coalesce(jsonb_agg(row_to_json(t) order by t.sessions desc), '[]'::jsonb)
  into v_sources
  from (
    select coalesce(nullif(fs.utm->>'utm_source',''), 'direct') as source,
           count(*)                                              as sessions,
           count(*) filter (where fs.email is not null)          as email_captured,
           count(*) filter (where fs.status = 'registered')      as registered
    from funnel_sessions fs
    where fs.funnel = p_funnel and fs.created_at >= p_from and fs.created_at <= p_to
    group by 1
  ) t;

  -- status totals
  select jsonb_build_object(
    'sessions',        count(*),
    'engaged',         count(*) filter (where status in ('engaged','email_captured','registered')),
    'email_captured',  count(*) filter (where email is not null),
    'registered',      count(*) filter (where status = 'registered')
  ) into v_totals
  from funnel_sessions fs
  where fs.funnel = p_funnel and fs.created_at >= p_from and fs.created_at <= p_to;

  return jsonb_build_object(
    'steps',   v_steps,
    'sources', v_sources,
    'totals',  coalesce(v_totals, jsonb_build_object('sessions',0,'engaged',0,'email_captured',0,'registered',0))
  );
end;
$$;
grant execute on function admin_funnel_analytics(text, timestamptz, timestamptz) to authenticated;

-- ── 7. admin_funnel_partial_leads — email captured but not registered ────────
-- The money list: everyone who gave an email mid-funnel and did NOT complete.
create or replace function admin_funnel_partial_leads(
  p_funnel text default 'free_class',
  p_from   timestamptz default (now() - interval '30 days'),
  p_to     timestamptz default now()
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare v_result jsonb;
begin
  perform _funnel_require_admin();

  select coalesce(jsonb_agg(row_to_json(t) order by t.created_at desc), '[]'::jsonb)
  into v_result
  from (
    select fs.id,
           fs.email::text                       as email,
           fs.phone,
           fs.sms_optin,
           fs.status,
           fs.answers,
           coalesce(fs.utm->>'utm_source','direct') as utm_source,
           fs.utm->>'utm_campaign'               as utm_campaign,
           fs.created_at,
           fs.updated_at
    from funnel_sessions fs
    where fs.funnel = p_funnel
      and fs.email is not null
      and fs.status <> 'registered'
      and fs.created_at >= p_from and fs.created_at <= p_to
  ) t;

  return v_result;
end;
$$;
grant execute on function admin_funnel_partial_leads(text, timestamptz, timestamptz) to authenticated;
