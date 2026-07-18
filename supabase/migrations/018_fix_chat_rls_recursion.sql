-- 018 — Fix infinite recursion in chat_room_members RLS
-- The original "Read chat room membership" policy (001) selected from
-- chat_room_members *inside its own USING clause*, which Postgres evaluates
-- recursively -> error 42P17. Because the member-scoped chat_messages/chat_rooms
-- policies subquery chat_room_members, this recursion fired on every community
-- insert/select. Replace it with a non-recursive "see your own rows" policy.

drop policy if exists "Read chat room membership" on chat_room_members;

create policy "Read own chat room membership" on chat_room_members
  for select using (user_id = auth.uid());
