-- ============================================
-- 050 — Help Desk / Customer Support
--
-- Member-facing support: an AI help bot (client-only, not persisted) plus a
-- "Speak to the team" ticket system, managed from the admin CRM.
--
-- Tables
--   help_tickets   — one support request per member (family-scoped)
--   help_messages  — the thread on a ticket (sender = user | team | ai)
--
-- Security model (mirrors 037 + 028):
--   • Members: own-row SELECT/INSERT on tickets + messages on own tickets.
--     Members NEVER update tickets directly — status transitions happen in the
--     AFTER-INSERT trigger (a user reply reopens a resolved/closed ticket).
--   • Admin side: SECURITY DEFINER RPCs for reads (bypass member RLS, gate on
--     profiles.role='admin' internally — 037 pattern) and the service role for
--     writes (team replies + status changes via /api/admin/support). Member RLS
--     is never loosened for admin reads.
--   • Team replies notify the member through the EXISTING notifications pipe
--     (028): the message trigger inserts a notifications row (type
--     'support_reply'), which fans out to Web Push via the 028 dispatch trigger.
-- ============================================

-- ── help_tickets ────────────────────────────────────────────────────────────
create table if not exists help_tickets (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references profiles(id) on delete cascade,
  family_id       uuid references families(id) on delete set null,
  subject         text not null,
  category        text not null default 'other'
                    check (category in ('billing', 'account', 'classes', 'technical', 'other')),
  status          text not null default 'open'
                    check (status in ('open', 'pending', 'resolved', 'closed')),
  priority        text not null default 'normal',
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  last_message_at timestamptz not null default now()
);

create index if not exists idx_help_tickets_user      on help_tickets (user_id, created_at desc);
create index if not exists idx_help_tickets_status    on help_tickets (status, last_message_at desc);
create index if not exists idx_help_tickets_activity  on help_tickets (last_message_at desc);

-- ── help_messages ───────────────────────────────────────────────────────────
create table if not exists help_messages (
  id         uuid primary key default gen_random_uuid(),
  ticket_id  uuid not null references help_tickets(id) on delete cascade,
  sender     text not null check (sender in ('user', 'team', 'ai')),
  body       text not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_help_messages_ticket on help_messages (ticket_id, created_at);

-- ── RLS ─────────────────────────────────────────────────────────────────────
alter table help_tickets  enable row level security;
alter table help_messages enable row level security;

-- Tickets: members read + create their own; no member UPDATE/DELETE (status is
-- trigger-driven, admin writes use the service role which bypasses RLS).
drop policy if exists help_tickets_select_own on help_tickets;
create policy help_tickets_select_own on help_tickets for select to authenticated
  using (user_id = auth.uid());

drop policy if exists help_tickets_insert_own on help_tickets;
create policy help_tickets_insert_own on help_tickets for insert to authenticated
  with check (user_id = auth.uid());

-- Messages: members read/insert only on their own tickets, and only as 'user'.
drop policy if exists help_messages_select_own on help_messages;
create policy help_messages_select_own on help_messages for select to authenticated
  using (
    exists (
      select 1 from help_tickets t
      where t.id = help_messages.ticket_id and t.user_id = auth.uid()
    )
  );

drop policy if exists help_messages_insert_own on help_messages;
create policy help_messages_insert_own on help_messages for insert to authenticated
  with check (
    sender = 'user'
    and exists (
      select 1 from help_tickets t
      where t.id = help_messages.ticket_id and t.user_id = auth.uid()
    )
  );

revoke update, delete on help_tickets  from authenticated, anon;
revoke update, delete on help_messages from authenticated, anon;

-- ── Stamp user_id + family_id on ticket insert ──────────────────────────────
create or replace function public.help_ticket_before_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.user_id is null then
    new.user_id := auth.uid();
  end if;
  if new.family_id is null and new.user_id is not null then
    select family_id into new.family_id from profiles where id = new.user_id;
  end if;
  new.last_message_at := coalesce(new.last_message_at, now());
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trg_help_ticket_before_insert on help_tickets;
create trigger trg_help_ticket_before_insert
  before insert on help_tickets
  for each row execute function public.help_ticket_before_insert();

-- ── Notifications: extend the 028 type CHECK to allow 'support_reply' ────────
alter table notifications drop constraint if exists notifications_type_check;
alter table notifications add constraint notifications_type_check
  check (type in ('reply', 'mention', 'announcement', 'support_reply'));

-- ── Bump activity + reopen-on-user-reply + notify-on-team-reply ─────────────
create or replace function public.help_message_after_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_owner   uuid;
  v_subject text;
  v_status  text;
begin
  select user_id, subject, status
    into v_owner, v_subject, v_status
  from help_tickets where id = new.ticket_id;

  -- Refresh activity; a user reply reopens a resolved/closed ticket.
  update help_tickets
     set last_message_at = new.created_at,
         updated_at = now(),
         status = case
           when new.sender = 'user' and status in ('resolved', 'closed') then 'open'
           else status
         end
   where id = new.ticket_id;

  -- Team reply → in-app + push notification for the member (028 pipe).
  if new.sender = 'team' and v_owner is not null then
    insert into notifications (user_id, actor_id, type, body)
    values (
      v_owner,
      null,
      'support_reply',
      'New reply on your ticket: ' || left(coalesce(v_subject, 'Support'), 80)
    );
  end if;

  return new;
end;
$$;

drop trigger if exists trg_help_message_after_insert on help_messages;
create trigger trg_help_message_after_insert
  after insert on help_messages
  for each row execute function public.help_message_after_insert();

-- ════════════════════════════════════════════════════════════════════════════
-- admin_help_tickets(p_status, p_category) — support queue for the admin CRM.
-- Both filters are optional ('all' / null = no filter). Ordered by last
-- activity. awaiting_team = the last message is from the member and the ticket
-- is still open/pending (drives the "needs a reply" highlight).
-- ════════════════════════════════════════════════════════════════════════════
create or replace function admin_help_tickets(
  p_status   text default 'all',
  p_category text default 'all'
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare v_result jsonb;
begin
  if not exists (select 1 from profiles where id = auth.uid() and role = 'admin') then
    raise exception 'admin only';
  end if;

  select coalesce(jsonb_agg(row_to_json(t) order by t.last_message_at desc), '[]'::jsonb)
  into v_result
  from (
    select
      h.id,
      h.subject,
      h.category,
      h.status,
      h.priority,
      h.created_at,
      h.updated_at,
      h.last_message_at,
      h.user_id,
      p.display_name,
      p.email,
      p.avatar_url,
      p.role,
      h.family_id,
      f.name as family_name,
      (select count(*) from help_messages m where m.ticket_id = h.id) as message_count,
      (select m.sender from help_messages m where m.ticket_id = h.id
         order by m.created_at desc limit 1) as last_sender,
      (
        h.status in ('open', 'pending')
        and coalesce(
          (select m.sender from help_messages m where m.ticket_id = h.id
             order by m.created_at desc limit 1), 'user'
        ) = 'user'
      ) as awaiting_team
    from help_tickets h
    join profiles p on p.id = h.user_id
    left join families f on f.id = h.family_id
    where (p_status is null or p_status = 'all' or h.status = p_status)
      and (p_category is null or p_category = 'all' or h.category = p_category)
  ) t;

  return v_result;
end;
$$;
grant execute on function admin_help_tickets(text, text) to authenticated;

-- ════════════════════════════════════════════════════════════════════════════
-- admin_help_ticket_detail(p_ticket_id) — full ticket + owner + thread.
-- ════════════════════════════════════════════════════════════════════════════
create or replace function admin_help_ticket_detail(p_ticket_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare v_result jsonb;
begin
  if not exists (select 1 from profiles where id = auth.uid() and role = 'admin') then
    raise exception 'admin only';
  end if;

  select jsonb_build_object(
    'ticket', (
      select jsonb_build_object(
        'id', h.id, 'subject', h.subject, 'category', h.category,
        'status', h.status, 'priority', h.priority,
        'created_at', h.created_at, 'updated_at', h.updated_at,
        'last_message_at', h.last_message_at,
        'user_id', h.user_id, 'display_name', p.display_name,
        'email', p.email, 'avatar_url', p.avatar_url, 'role', p.role,
        'family_id', h.family_id, 'family_name', f.name
      )
      from help_tickets h
      join profiles p on p.id = h.user_id
      left join families f on f.id = h.family_id
      where h.id = p_ticket_id
    ),
    'messages', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'id', m.id, 'sender', m.sender, 'body', m.body, 'created_at', m.created_at
      ) order by m.created_at), '[]'::jsonb)
      from help_messages m where m.ticket_id = p_ticket_id
    )
  ) into v_result;

  return v_result;
end;
$$;
grant execute on function admin_help_ticket_detail(uuid) to authenticated;
