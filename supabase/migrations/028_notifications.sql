-- ============================================
-- 028 — Notifications: replies + @mentions, in-app bell + Web Push.
--
-- Tables
--   notifications       — one row per event (reply | mention | announcement)
--   push_subscriptions  — Web Push endpoints per user (VAPID)
--
-- Flow
--   chat_messages AFTER INSERT (security definer trigger)
--     ├─ reply_to_id set  → 'reply' notification for the parent author
--     └─ @mention tokens  → 'mention' notifications (deduped vs reply, no self)
--   notifications AFTER INSERT
--     └─ pg_net http_post → https://fta-dashboard-ruddy.vercel.app/api/push/dispatch
--        (secret read from Supabase Vault entry 'push_dispatch_secret' —
--         inserted out-of-band so it never lands in git)
--
-- MENTION FORMAT (the composer MUST insert exactly this):
--   '@' + display_name with all spaces removed, e.g. "Marcus Johnson"
--   → "@MarcusJohnson". Matching is case-insensitive against
--   replace(profiles.display_name, ' ', ''). If two profiles collide on
--   the stripped name, the earliest-created profile wins (deterministic).
--
-- RLS lessons from 018/019 honored: the notifications SELECT policy that
-- Realtime evaluates is a bare column comparison (user_id = auth.uid()),
-- no subqueries, nothing self-referential. Inserts happen only through the
-- security-definer trigger (no INSERT policy for users); recipients may
-- update ONLY read_at (column-level grant).
-- ============================================

-- 0. Async HTTP from Postgres (creates the `net` schema)
create extension if not exists pg_net;

-- 1. notifications
create table if not exists notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  actor_id uuid references profiles(id) on delete set null,
  type text not null check (type in ('reply', 'mention', 'announcement')),
  message_id uuid references chat_messages(id) on delete cascade,
  body text not null default '',
  read_at timestamptz,
  dispatched_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists idx_notifications_user_created
  on notifications(user_id, created_at desc);
create index if not exists idx_notifications_unread
  on notifications(user_id) where read_at is null;
create index if not exists idx_notifications_undispatched
  on notifications(created_at) where dispatched_at is null;

alter table notifications enable row level security;

-- Realtime-safe: bare column comparison, no subquery (019 scar).
drop policy if exists "Read own notifications" on notifications;
create policy "Read own notifications" on notifications
  for select using (user_id = auth.uid());

-- Recipient may update own rows — but only the read_at column (grant below).
drop policy if exists "Update own notifications" on notifications;
create policy "Update own notifications" on notifications
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());

-- No INSERT/DELETE policies: writes come from the definer trigger + service role.
revoke insert, delete on notifications from authenticated, anon;
revoke update on notifications from authenticated, anon;
grant update (read_at) on notifications to authenticated;

-- Realtime publication (idempotent)
do $$
begin
  alter publication supabase_realtime add table notifications;
exception
  when duplicate_object then null;
end $$;

-- 2. push_subscriptions — owner-only
create table if not exists push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  user_agent text,
  created_at timestamptz not null default now()
);

create index if not exists idx_push_subscriptions_user
  on push_subscriptions(user_id);

alter table push_subscriptions enable row level security;

drop policy if exists "Own push subscriptions" on push_subscriptions;
create policy "Own push subscriptions" on push_subscriptions
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- 3. Reply + mention fan-out from chat_messages
create or replace function public.notify_on_chat_message()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_parent_author uuid;
  v_snippet text;
  v_notified uuid[] := '{}';
  v_token text;
  v_mention_user uuid;
begin
  -- Snippet: message text, or a marker for media-only posts (027)
  v_snippet := coalesce(nullif(left(coalesce(new.content, ''), 140), ''), '[media]');

  -- (a) Reply → notify the parent message's author (never self)
  if new.reply_to_id is not null then
    select user_id into v_parent_author
    from chat_messages
    where id = new.reply_to_id;

    if v_parent_author is not null and v_parent_author <> new.user_id then
      insert into notifications (user_id, actor_id, type, message_id, body)
      values (v_parent_author, new.user_id, 'reply', new.id, v_snippet);
      v_notified := array_append(v_notified, v_parent_author);
    end if;
  end if;

  -- (b) @mentions — token rule documented in the header. Dedupe against the
  -- reply notification and against repeated tokens; never notify self.
  for v_token in
    select distinct lower(m[1])
    from regexp_matches(coalesce(new.content, ''), '@([A-Za-z0-9_.''-]+)', 'g') as m
  loop
    v_mention_user := null;

    select id into v_mention_user
    from profiles
    where lower(replace(display_name, ' ', '')) = v_token
    order by created_at asc
    limit 1;

    if v_mention_user is not null
       and v_mention_user <> new.user_id
       and not (v_mention_user = any (v_notified)) then
      insert into notifications (user_id, actor_id, type, message_id, body)
      values (v_mention_user, new.user_id, 'mention', new.id, v_snippet);
      v_notified := array_append(v_notified, v_mention_user);
    end if;
  end loop;

  return new;
end;
$$;

drop trigger if exists trg_chat_message_notify on chat_messages;
create trigger trg_chat_message_notify
  after insert on chat_messages
  for each row execute function public.notify_on_chat_message();

-- 4. Push dispatch — fire-and-forget HTTP to the Vercel route via pg_net.
-- Secret lives in Vault under 'push_dispatch_secret' (inserted out-of-band):
--   select vault.create_secret('<secret>', 'push_dispatch_secret');
-- If the secret is missing or pg_net errors, the notification insert still
-- succeeds — push is best-effort, the in-app bell is the source of truth.
create or replace function public.dispatch_push_notification()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_secret text;
begin
  select decrypted_secret into v_secret
  from vault.decrypted_secrets
  where name = 'push_dispatch_secret'
  limit 1;

  if v_secret is null then
    return new;
  end if;

  perform net.http_post(
    url := 'https://fta-dashboard-ruddy.vercel.app/api/push/dispatch',
    body := to_jsonb(new),
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-push-secret', v_secret
    ),
    timeout_milliseconds := 5000
  );
  return new;
exception
  when others then
    return new;
end;
$$;

drop trigger if exists trg_notification_push_dispatch on notifications;
create trigger trg_notification_push_dispatch
  after insert on notifications
  for each row execute function public.dispatch_push_notification();
