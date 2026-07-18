-- 016 — Community goes real + notification prefs
-- Adds message categories, a global community room, the Realtime publication
-- entry, notification preferences on profiles, and RLS policies that let any
-- authenticated member read/post in the shared community room.

-- 1. Category on chat_messages (win | question | announcement | discussion)
alter table chat_messages add column if not exists category text
  default 'discussion'
  check (category in ('win', 'question', 'announcement', 'discussion'));

-- 2. Notification preferences on profiles (loaded/saved by Settings)
alter table profiles add column if not exists notification_prefs jsonb not null
  default '{"email_notifs": true, "live_alerts": true, "weekly_digest": false}'::jsonb;

-- 3. The single global community room (fixed id for idempotent seeding)
insert into chat_rooms (id, type, name)
values ('c0000000-0000-4000-a000-000000000001', 'general', 'FTA Community')
on conflict (id) do nothing;

-- 4. RLS — the shared community room is readable/postable by every member,
--    not just chat_room_members (which the global room has none of).
drop policy if exists "Read general rooms" on chat_rooms;
create policy "Read general rooms" on chat_rooms
  for select using (type = 'general');

drop policy if exists "Read general room messages" on chat_messages;
create policy "Read general room messages" on chat_messages
  for select using (
    exists (
      select 1 from chat_rooms r
      where r.id = chat_messages.room_id and r.type = 'general'
    )
  );

drop policy if exists "Post to general rooms" on chat_messages;
create policy "Post to general rooms" on chat_messages
  for insert with check (
    auth.uid() = user_id
    and exists (
      select 1 from chat_rooms r
      where r.id = chat_messages.room_id and r.type = 'general'
    )
  );

-- Community needs author display_name/role/age_group across families.
-- profiles RLS is currently disabled (dev), so this is inert until enabled,
-- but keeps the community feature correct once RLS is turned on.
drop policy if exists "Authenticated can read profiles" on profiles;
create policy "Authenticated can read profiles" on profiles
  for select using (auth.uid() is not null);

-- 5. Realtime — publish chat_messages inserts (idempotent)
do $$
begin
  alter publication supabase_realtime add table chat_messages;
exception
  when duplicate_object then null;
  when others then null;
end $$;
