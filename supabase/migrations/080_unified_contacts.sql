-- 080 — Unified CRM contacts + per-contact comms log + merged timeline/support
-- ─────────────────────────────────────────────────────────────────────────────
-- Owner ask: "CRM leads should be added to the main CRM contact lists WITH user
-- profiles and just marked as leads; on every contact page there should be
-- buttons to email or SMS that contact individually, along with their
-- customer-support history."
--
-- This migration adds:
--   1. contact_comms          — audit log of individual 1:1 admin→member sends.
--   2. admin_contacts(...)     — ONE list = member profiles ∪ lead-only rows,
--                                each labelled by contact_kind (lead/free/fic/fta).
--   3. admin_contact_support() — a contact's help-desk tickets (by user_id, or by
--                                email for lead-only contacts that match a profile).
--   4. admin_contact_timeline()— merged chronology: member activity (reuses
--                                admin_member_timeline) + marketing lead_events
--                                (matched by email, so a CONVERTED lead shows both
--                                histories) + contact_comms.
--
-- All reads go through admin-gated SECURITY DEFINER RPCs; contact_comms carries
-- RLS with no client policies (reached only via these RPCs or the service role
-- in the /api/marketing/contacts/send route). Nothing in migrations <080 is
-- modified; marketing_leads / lead_events / help_tickets are read-only here.
-- ═════════════════════════════════════════════════════════════════════════════

-- ── 1. contact_comms — individual outbound (and future inbound) comms ─────────
create table if not exists contact_comms (
  id            uuid primary key default gen_random_uuid(),
  contact_email citext not null,
  user_id       uuid references profiles(id) on delete set null,
  channel       text not null check (channel in ('email','sms')),
  direction     text not null default 'out' check (direction in ('out','in')),
  subject       text,
  body          text not null,
  status        text not null check (status in ('sent','failed','skipped')),
  error         text,
  sent_by       uuid references profiles(id) on delete set null,
  created_at    timestamptz not null default now()
);
create index if not exists idx_contact_comms_user  on contact_comms (user_id, created_at desc);
create index if not exists idx_contact_comms_email on contact_comms (contact_email, created_at desc);

-- RLS ON, NO client policies. Written by the service role, read via the
-- SECURITY DEFINER RPCs below.
alter table contact_comms enable row level security;
revoke all on contact_comms from authenticated, anon;

-- ── shared admin gate (own copy; mirrors _mkt_require_admin from 043) ─────────
create or replace function _contacts_require_admin()
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

-- ═════════════════════════════════════════════════════════════════════════════
-- 2. admin_contacts — unified directory. Union by email of member profiles and
--    lead-only marketing_leads (leads whose email already matches a profile are
--    represented by the member row, never duplicated).
--
--    contact_kind: 'lead' | 'free' | 'fic' | 'fta' (members labelled by tier).
--    record:       'member' | 'lead' (drives detail routing on the client).
-- ═════════════════════════════════════════════════════════════════════════════
create or replace function admin_contacts(
  p_search text default null,
  p_kind   text default 'all',      -- all | lead | free | fic | fta
  p_sort   text default 'recent',   -- recent | name | created
  p_limit  int  default 1000,
  p_offset int  default 0
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare v_result jsonb;
begin
  perform _contacts_require_admin();

  with member_rows as (
    select
      p.id::text                                   as contact_id,
      'member'::text                               as record,
      coalesce(nullif(p.display_name, ''), p.email::text) as name,
      p.email::text                                as email,
      null::text                                   as phone,
      coalesce(ft.tier, 'fic')::text               as contact_kind,
      p.role::text                                 as role,
      null::text                                   as stage,
      xa.last_at                                   as last_activity,
      p.created_at                                 as created
    from profiles p
    left join family_tiers ft on ft.family_id = p.family_id
    left join lateral (
      select max(created_at) as last_at from xp_events where user_id = p.id
    ) xa on true
  ),
  lead_rows as (
    select distinct on (lower(l.email::text))
      l.id::text                                   as contact_id,
      'lead'::text                                 as record,
      coalesce(
        nullif(trim(coalesce(l.first_name, '') || ' ' || coalesce(l.last_name, '')), ''),
        l.email::text
      )                                            as name,
      l.email::text                                as email,
      l.phone                                      as phone,
      'lead'::text                                 as contact_kind,
      null::text                                   as role,
      l.stage::text                                as stage,
      l.last_activity_at                           as last_activity,
      l.created_at                                 as created
    from marketing_leads l
    where not exists (
      select 1 from profiles p where lower(p.email::text) = lower(l.email::text)
    )
    order by lower(l.email::text), l.last_activity_at desc
  ),
  all_rows as (
    select * from member_rows
    union all
    select * from lead_rows
  )
  select coalesce(jsonb_agg(row_to_json(t)), '[]'::jsonb)
  into v_result
  from (
    select r.*
    from all_rows r
    where (p_kind = 'all' or r.contact_kind = p_kind)
      and (
        p_search is null or p_search = ''
        or r.name  ilike '%' || p_search || '%'
        or r.email ilike '%' || p_search || '%'
        or coalesce(r.phone, '') ilike '%' || p_search || '%'
      )
    order by
      (case when p_sort = 'name'    then lower(r.name) else null end) asc  nulls last,
      (case when p_sort = 'created' then r.created      else null end) desc nulls last,
      (case when p_sort not in ('name','created') then r.last_activity else null end) desc nulls last,
      lower(r.name) asc
    limit greatest(p_limit, 1) offset greatest(p_offset, 0)
  ) t;

  return v_result;
end;
$$;
grant execute on function admin_contacts(text, text, text, int, int) to authenticated;

-- ═════════════════════════════════════════════════════════════════════════════
-- 3. admin_contact_support(p_user_id, p_email) — a contact's help_tickets with
--    status, message count, and a preview of the latest message. For member
--    contacts pass p_user_id; for lead-only contacts pass p_email and it resolves
--    a matching profile (a lead that converted, or shares an email with a member).
-- ═════════════════════════════════════════════════════════════════════════════
create or replace function admin_contact_support(
  p_user_id uuid default null,
  p_email   text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare v_uid uuid; v_result jsonb;
begin
  perform _contacts_require_admin();

  v_uid := coalesce(
    p_user_id,
    (select id from profiles
       where p_email is not null and lower(email::text) = lower(p_email)
       order by created_at limit 1)
  );
  if v_uid is null then
    return '[]'::jsonb;
  end if;

  select coalesce(jsonb_agg(row_to_json(t) order by t.last_message_at desc), '[]'::jsonb)
  into v_result
  from (
    select
      h.id, h.subject, h.category, h.status, h.priority,
      h.created_at, h.last_message_at,
      (select count(*) from help_messages m where m.ticket_id = h.id) as message_count,
      (select m.body   from help_messages m where m.ticket_id = h.id
         order by m.created_at desc limit 1)                          as last_message,
      (select m.sender from help_messages m where m.ticket_id = h.id
         order by m.created_at desc limit 1)                          as last_sender
    from help_tickets h
    where h.user_id = v_uid
  ) t;

  return v_result;
end;
$$;
grant execute on function admin_contact_support(uuid, text) to authenticated;

-- ═════════════════════════════════════════════════════════════════════════════
-- 4. admin_contact_timeline(p_user_id, p_email, p_limit) — merged chronology.
--    Member activity (reuses admin_member_timeline) + marketing lead_events
--    (matched by email → a CONVERTED lead surfaces its full pre-signup history)
--    + individual comms from contact_comms. One shape: {type, ts, title, meta}.
-- ═════════════════════════════════════════════════════════════════════════════
create or replace function admin_contact_timeline(
  p_user_id uuid default null,
  p_email   text default null,
  p_limit   int  default 80
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare v_result jsonb;
begin
  perform _contacts_require_admin();

  select coalesce(jsonb_agg(row_to_json(t)), '[]'::jsonb)
  into v_result
  from (
    select u.type, u.ts, u.title, u.meta
    from (
      -- member activity (reuse existing admin-gated RPC; '[]' when no user)
      select
        e->>'type'               as type,
        (e->>'ts')::timestamptz  as ts,
        e->>'title'              as title,
        e->>'meta'               as meta
      from jsonb_array_elements(
        case when p_user_id is not null
             then admin_member_timeline(p_user_id, p_limit)
             else '[]'::jsonb end
      ) e

      union all

      -- marketing lead events (by email)
      select
        'lead'::text,
        le.created_at,
        case le.type
          when 'imported'      then 'Imported as lead'
          when 'emailed'       then 'Email sent (marketing)'
          when 'smsed'         then 'SMS sent (marketing)'
          when 'opened'        then 'Opened email'
          when 'clicked'       then 'Clicked link'
          when 'replied'       then 'Replied'
          when 'stage_changed' then 'Stage changed'
          when 'converted'     then 'Converted to member'
          else le.type
        end,
        nullif(le.meta::text, '{}')
      from marketing_lead_events le
      join marketing_leads l on l.id = le.lead_id
      where p_email is not null and lower(l.email::text) = lower(p_email)

      union all

      -- individual comms (this contact only)
      select
        'comm'::text,
        cc.created_at,
        (case cc.channel when 'email' then 'Email' else 'SMS' end)
          || ' ' || cc.status
          || coalesce(' · ' || cc.subject, ''),
        left(cc.body, 140)
      from contact_comms cc
      where (p_user_id is not null and cc.user_id = p_user_id)
         or (p_email is not null and lower(cc.contact_email::text) = lower(p_email))
    ) u
    where u.ts is not null
    order by u.ts desc
    limit greatest(p_limit, 1)
  ) t;

  return v_result;
end;
$$;
grant execute on function admin_contact_timeline(uuid, text, int) to authenticated;
