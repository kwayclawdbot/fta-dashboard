-- 019 — Make community messages Realtime-friendly under RLS
-- Supabase Realtime evaluates the SELECT policy per row to decide delivery, and
-- it cannot authorize postgres_changes when the SELECT policy uses a subquery to
-- another table (the earlier "exists (select ... from chat_rooms)" policy caused
-- live updates to silently not deliver even though inserts succeeded).
--
-- Replace the subquery-based SELECT policies with a simple, index-friendly
-- column comparison against the single global community room. Chat is only used
-- by the global community today; private (family/cohort) rooms are not yet built.

drop policy if exists "Read general room messages" on chat_messages;
drop policy if exists "Read messages in joined rooms" on chat_messages;
drop policy if exists "Read community messages" on chat_messages;

create policy "Read community messages" on chat_messages
  for select using (room_id = 'c0000000-0000-4000-a000-000000000001'::uuid);
