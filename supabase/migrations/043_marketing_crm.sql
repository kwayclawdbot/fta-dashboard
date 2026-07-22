-- 043 — Marketing CRM module (leads, events, campaigns, sends)
--
-- Lives inside the admin CRM. Follows the exact security posture of migration
-- 037: every table has RLS ENABLED with NO client policies, and all access is
-- routed through SECURITY DEFINER functions that gate on profiles.role='admin'
-- internally (bypassing table RLS without loosening it), OR through server
-- routes using the service role. Base-table RLS is never loosened.
--
-- Postgres gotcha honored: `::date day` bareword fails in plpgsql — always
-- alias `as day`. (No date-truncation is needed here, but noted for edits.)

create extension if not exists citext;

-- ════════════════════════════════════════════════════════════════════════════
-- Tables
-- ════════════════════════════════════════════════════════════════════════════

create table if not exists marketing_leads (
  id                   uuid primary key default gen_random_uuid(),
  email                citext not null,
  phone                text,
  first_name           text,
  last_name            text,
  source               text not null default 'manual'
                         check (source in ('csv','facebook','manual','referral')),
  stage                text not null default 'new'
                         check (stage in ('new','contacted','engaged','nurture','converted','cold','unsubscribed')),
  tags                 text[] not null default '{}',
  notes                text,
  custom               jsonb not null default '{}'::jsonb,
  consent_source       text,
  converted_profile_id uuid references profiles(id) on delete set null,
  last_activity_at     timestamptz not null default now(),
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),
  -- "unique-ish per source": the same email may arrive from csv AND facebook,
  -- but never twice from the same source.
  unique (email, source)
);
create index if not exists idx_mkt_leads_stage   on marketing_leads (stage);
create index if not exists idx_mkt_leads_email   on marketing_leads (email);
create index if not exists idx_mkt_leads_lastact on marketing_leads (last_activity_at desc);

create table if not exists marketing_lead_events (
  id         uuid primary key default gen_random_uuid(),
  lead_id    uuid not null references marketing_leads(id) on delete cascade,
  type       text not null
               check (type in ('imported','emailed','smsed','opened','clicked','replied','stage_changed','converted')),
  meta       jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists idx_mkt_events_lead on marketing_lead_events (lead_id, created_at desc);

create table if not exists marketing_campaigns (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  channel    text not null check (channel in ('email','sms')),
  subject    text,
  body       text not null,
  segment    jsonb not null default '{}'::jsonb,   -- { stages: [...], tags: [...] }
  status     text not null default 'draft'
               check (status in ('draft','sending','sent','failed')),
  created_by uuid references profiles(id) on delete set null,
  sent_at    timestamptz,
  stats      jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists idx_mkt_campaigns_created on marketing_campaigns (created_at desc);

create table if not exists marketing_sends (
  id          uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references marketing_campaigns(id) on delete cascade,
  lead_id     uuid not null references marketing_leads(id) on delete cascade,
  status      text not null check (status in ('queued','sent','failed','skipped')),
  error       text,
  sent_at     timestamptz,
  created_at  timestamptz not null default now()
);
create index if not exists idx_mkt_sends_campaign on marketing_sends (campaign_id);
create index if not exists idx_mkt_sends_lead     on marketing_sends (lead_id);

-- RLS ON, NO client policies. Reachable only via SECURITY DEFINER RPCs below
-- (admin-gated) or the service role in server routes.
alter table marketing_leads       enable row level security;
alter table marketing_lead_events enable row level security;
alter table marketing_campaigns   enable row level security;
alter table marketing_sends       enable row level security;

-- ════════════════════════════════════════════════════════════════════════════
-- Helper: admin gate (raises if caller is not an admin)
-- ════════════════════════════════════════════════════════════════════════════
create or replace function _mkt_require_admin()
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

-- ════════════════════════════════════════════════════════════════════════════
-- admin_marketing_leads() — full lead list with event counts + cold flag.
-- A lead is "cold" when it is not converted/unsubscribed and has had no
-- activity for 21+ days.
-- ════════════════════════════════════════════════════════════════════════════
create or replace function admin_marketing_leads()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare v_result jsonb;
begin
  perform _mkt_require_admin();

  select coalesce(jsonb_agg(row_to_json(t) order by t.last_activity_at desc), '[]'::jsonb)
  into v_result
  from (
    select
      l.id, l.email::text as email, l.phone, l.first_name, l.last_name,
      l.source, l.stage, l.tags, l.notes, l.consent_source,
      l.converted_profile_id, l.last_activity_at, l.created_at,
      coalesce(ev.event_count, 0) as event_count,
      ev.last_event_at,
      ev.last_event_type,
      (
        l.stage not in ('converted','unsubscribed')
        and l.last_activity_at < now() - interval '21 days'
      ) as is_cold
    from marketing_leads l
    left join lateral (
      select count(*) as event_count,
             max(e.created_at) as last_event_at,
             (select e2.type from marketing_lead_events e2
                where e2.lead_id = l.id order by e2.created_at desc limit 1) as last_event_type
        from marketing_lead_events e where e.lead_id = l.id
    ) ev on true
  ) t;

  return v_result;
end;
$$;
grant execute on function admin_marketing_leads() to authenticated;

-- ════════════════════════════════════════════════════════════════════════════
-- admin_marketing_lead_detail(p_lead_id) — one lead + its event timeline.
-- ════════════════════════════════════════════════════════════════════════════
create or replace function admin_marketing_lead_detail(p_lead_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare v_result jsonb;
begin
  perform _mkt_require_admin();

  select jsonb_build_object(
    'lead', (
      select row_to_json(x) from (
        select l.id, l.email::text as email, l.phone, l.first_name, l.last_name,
               l.source, l.stage, l.tags, l.notes, l.custom, l.consent_source,
               l.converted_profile_id, l.last_activity_at, l.created_at, l.updated_at
        from marketing_leads l where l.id = p_lead_id
      ) x
    ),
    'events', (
      select coalesce(jsonb_agg(row_to_json(e) order by e.created_at desc), '[]'::jsonb)
      from (
        select id, type, meta, created_at
        from marketing_lead_events where lead_id = p_lead_id
      ) e
    )
  ) into v_result;

  return v_result;
end;
$$;
grant execute on function admin_marketing_lead_detail(uuid) to authenticated;

-- ════════════════════════════════════════════════════════════════════════════
-- admin_marketing_import(p_leads, p_source) — bulk upsert from CSV / manual.
-- p_leads: jsonb array of { email, first_name, last_name, phone, tags[] }.
-- Dedupe by (email, source): existing leads keep their stage; only fill blank
-- name/phone. New leads inserted at stage 'new' with an 'imported' event.
-- Returns { imported, updated, skipped }.
-- ════════════════════════════════════════════════════════════════════════════
create or replace function admin_marketing_import(p_leads jsonb, p_source text default 'csv')
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  rec        jsonb;
  v_email    citext;
  v_source   text;
  v_id       uuid;
  v_existing marketing_leads%rowtype;
  v_imported int := 0;
  v_updated  int := 0;
  v_skipped  int := 0;
  v_tags     text[];
begin
  perform _mkt_require_admin();

  v_source := case when p_source in ('csv','facebook','manual','referral') then p_source else 'csv' end;

  for rec in select * from jsonb_array_elements(coalesce(p_leads, '[]'::jsonb))
  loop
    v_email := nullif(trim(coalesce(rec->>'email','')), '')::citext;
    if v_email is null then
      v_skipped := v_skipped + 1;
      continue;
    end if;

    v_tags := case
      when jsonb_typeof(rec->'tags') = 'array'
      then array(select jsonb_array_elements_text(rec->'tags'))
      else '{}'::text[]
    end;

    select * into v_existing from marketing_leads
      where email = v_email and source = v_source limit 1;

    if found then
      update marketing_leads set
        first_name = coalesce(nullif(first_name,''), nullif(rec->>'first_name','')),
        last_name  = coalesce(nullif(last_name,''),  nullif(rec->>'last_name','')),
        phone      = coalesce(nullif(phone,''),      nullif(rec->>'phone','')),
        tags       = case when array_length(v_tags,1) is null then tags
                          else (select array(select distinct unnest(tags || v_tags))) end,
        updated_at = now()
      where id = v_existing.id;
      v_updated := v_updated + 1;
    else
      insert into marketing_leads (email, first_name, last_name, phone, tags, source, consent_source)
      values (
        v_email,
        nullif(rec->>'first_name',''),
        nullif(rec->>'last_name',''),
        nullif(rec->>'phone',''),
        v_tags,
        v_source,
        nullif(rec->>'consent_source','')
      )
      returning id into v_id;
      insert into marketing_lead_events (lead_id, type, meta)
      values (v_id, 'imported', jsonb_build_object('source', v_source));
      v_imported := v_imported + 1;
    end if;
  end loop;

  return jsonb_build_object('imported', v_imported, 'updated', v_updated, 'skipped', v_skipped);
end;
$$;
grant execute on function admin_marketing_import(jsonb, text) to authenticated;

-- ════════════════════════════════════════════════════════════════════════════
-- admin_marketing_add_lead(...) — single manual add. Returns the new/updated id.
-- ════════════════════════════════════════════════════════════════════════════
create or replace function admin_marketing_add_lead(
  p_email text, p_first_name text default null, p_last_name text default null,
  p_phone text default null, p_tags text[] default '{}', p_source text default 'manual',
  p_notes text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_email  citext;
  v_source text;
  v_id     uuid;
  v_new    boolean := false;
begin
  perform _mkt_require_admin();
  v_email := nullif(trim(coalesce(p_email,'')), '')::citext;
  if v_email is null then raise exception 'email required'; end if;
  v_source := case when p_source in ('csv','facebook','manual','referral') then p_source else 'manual' end;

  select id into v_id from marketing_leads where email = v_email and source = v_source limit 1;
  if v_id is null then
    insert into marketing_leads (email, first_name, last_name, phone, tags, source, notes)
    values (v_email, nullif(p_first_name,''), nullif(p_last_name,''), nullif(p_phone,''),
            coalesce(p_tags,'{}'), v_source, nullif(p_notes,''))
    returning id into v_id;
    insert into marketing_lead_events (lead_id, type, meta)
    values (v_id, 'imported', jsonb_build_object('source', v_source, 'manual', true));
    v_new := true;
  else
    update marketing_leads set
      first_name = coalesce(nullif(p_first_name,''), first_name),
      last_name  = coalesce(nullif(p_last_name,''),  last_name),
      phone      = coalesce(nullif(p_phone,''),      phone),
      notes      = coalesce(nullif(p_notes,''),      notes),
      updated_at = now()
    where id = v_id;
  end if;

  return jsonb_build_object('id', v_id, 'created', v_new);
end;
$$;
grant execute on function admin_marketing_add_lead(text, text, text, text, text[], text, text) to authenticated;

-- ════════════════════════════════════════════════════════════════════════════
-- admin_marketing_set_stage(p_lead_id, p_stage) — change stage + log event.
-- Moving to 'converted' also attempts to bind converted_profile_id by email.
-- ════════════════════════════════════════════════════════════════════════════
create or replace function admin_marketing_set_stage(p_lead_id uuid, p_stage text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_old   text;
  v_email citext;
  v_pid   uuid;
begin
  perform _mkt_require_admin();
  if p_stage not in ('new','contacted','engaged','nurture','converted','cold','unsubscribed') then
    raise exception 'invalid stage %', p_stage;
  end if;

  select stage, email into v_old, v_email from marketing_leads where id = p_lead_id;
  if not found then raise exception 'lead not found'; end if;

  if p_stage = 'converted' then
    select id into v_pid from profiles where lower(email) = lower(v_email::text) limit 1;
  end if;

  update marketing_leads set
    stage = p_stage,
    converted_profile_id = case when p_stage = 'converted' then coalesce(v_pid, converted_profile_id) else converted_profile_id end,
    last_activity_at = now(),
    updated_at = now()
  where id = p_lead_id;

  insert into marketing_lead_events (lead_id, type, meta)
  values (p_lead_id, 'stage_changed', jsonb_build_object('from', v_old, 'to', p_stage));

  if p_stage = 'converted' then
    insert into marketing_lead_events (lead_id, type, meta)
    values (p_lead_id, 'converted', jsonb_build_object('profile_id', v_pid, 'manual', true));
  end if;

  return jsonb_build_object('ok', true, 'stage', p_stage, 'converted_profile_id', v_pid);
end;
$$;
grant execute on function admin_marketing_set_stage(uuid, text) to authenticated;

-- ════════════════════════════════════════════════════════════════════════════
-- admin_marketing_update_lead(p_lead_id, p_notes, p_tags) — edit notes/tags.
-- ════════════════════════════════════════════════════════════════════════════
create or replace function admin_marketing_update_lead(
  p_lead_id uuid, p_notes text default null, p_tags text[] default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  perform _mkt_require_admin();
  update marketing_leads set
    notes = coalesce(p_notes, notes),
    tags  = coalesce(p_tags, tags),
    updated_at = now()
  where id = p_lead_id;
  return jsonb_build_object('ok', true);
end;
$$;
grant execute on function admin_marketing_update_lead(uuid, text, text[]) to authenticated;

-- ════════════════════════════════════════════════════════════════════════════
-- admin_marketing_sync_conversions() — match lead emails against existing
-- profiles; any non-converted/unsubscribed lead whose email now has a profile
-- becomes 'converted' with converted_profile_id set + a 'converted' event.
-- Returns { converted, ids: [...] }.
-- ════════════════════════════════════════════════════════════════════════════
create or replace function admin_marketing_sync_conversions()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  r       record;
  v_ids   uuid[] := '{}';
  v_count int := 0;
begin
  perform _mkt_require_admin();

  for r in
    select l.id as lead_id, p.id as profile_id
    from marketing_leads l
    join profiles p on lower(p.email) = lower(l.email::text)
    where l.stage not in ('converted','unsubscribed')
  loop
    update marketing_leads set
      stage = 'converted',
      converted_profile_id = r.profile_id,
      last_activity_at = now(),
      updated_at = now()
    where id = r.lead_id;

    insert into marketing_lead_events (lead_id, type, meta)
    values (r.lead_id, 'converted', jsonb_build_object('profile_id', r.profile_id, 'auto', true));

    v_ids := v_ids || r.lead_id;
    v_count := v_count + 1;
  end loop;

  return jsonb_build_object('converted', v_count, 'ids', to_jsonb(v_ids));
end;
$$;
grant execute on function admin_marketing_sync_conversions() to authenticated;

-- ════════════════════════════════════════════════════════════════════════════
-- Campaigns
-- ════════════════════════════════════════════════════════════════════════════

-- admin_marketing_campaigns() — list campaigns with send tallies.
create or replace function admin_marketing_campaigns()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare v_result jsonb;
begin
  perform _mkt_require_admin();
  select coalesce(jsonb_agg(row_to_json(t) order by t.created_at desc), '[]'::jsonb)
  into v_result
  from (
    select c.id, c.name, c.channel, c.subject, c.body, c.segment, c.status,
           c.sent_at, c.stats, c.created_at,
           coalesce(s.total, 0) as sends_total,
           coalesce(s.sent, 0)  as sends_sent,
           coalesce(s.failed, 0) as sends_failed,
           coalesce(s.skipped, 0) as sends_skipped
    from marketing_campaigns c
    left join lateral (
      select count(*) total,
             count(*) filter (where status='sent') sent,
             count(*) filter (where status='failed') failed,
             count(*) filter (where status='skipped') skipped
      from marketing_sends where campaign_id = c.id
    ) s on true
  ) t;
  return v_result;
end;
$$;
grant execute on function admin_marketing_campaigns() to authenticated;

-- admin_marketing_create_campaign(...) — returns new campaign id.
create or replace function admin_marketing_create_campaign(
  p_name text, p_channel text, p_body text,
  p_subject text default null, p_segment jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare v_id uuid;
begin
  perform _mkt_require_admin();
  if p_channel not in ('email','sms') then raise exception 'invalid channel'; end if;
  insert into marketing_campaigns (name, channel, subject, body, segment, created_by)
  values (p_name, p_channel, p_subject, p_body, coalesce(p_segment,'{}'::jsonb), auth.uid())
  returning id into v_id;
  return jsonb_build_object('id', v_id);
end;
$$;
grant execute on function admin_marketing_create_campaign(text, text, text, text, jsonb) to authenticated;

-- admin_marketing_segment_leads(p_segment) — resolve a segment to its leads.
-- Segment: { stages: text[], tags: text[] }. Always excludes 'unsubscribed'.
-- Empty stages => all stages (except unsubscribed). Empty tags => no tag filter.
create or replace function admin_marketing_segment_leads(p_segment jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_stages text[];
  v_tags   text[];
  v_result jsonb;
begin
  perform _mkt_require_admin();

  v_stages := case when jsonb_typeof(p_segment->'stages') = 'array'
                   then array(select jsonb_array_elements_text(p_segment->'stages'))
                   else '{}'::text[] end;
  v_tags := case when jsonb_typeof(p_segment->'tags') = 'array'
                 then array(select jsonb_array_elements_text(p_segment->'tags'))
                 else '{}'::text[] end;

  select coalesce(jsonb_agg(row_to_json(t) order by t.last_activity_at desc), '[]'::jsonb)
  into v_result
  from (
    select l.id, l.email::text as email, l.first_name, l.last_name, l.phone, l.stage, l.tags
    from marketing_leads l
    where l.stage <> 'unsubscribed'
      and (array_length(v_stages,1) is null or l.stage = any(v_stages))
      and (array_length(v_tags,1) is null or l.tags && v_tags)
  ) t;

  return v_result;
end;
$$;
grant execute on function admin_marketing_segment_leads(jsonb) to authenticated;
