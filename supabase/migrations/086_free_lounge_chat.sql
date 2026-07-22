-- 086 — Free Lounge: a third community room open to free-tier families
--
-- The free journey gives newcomers a real place to say hi. A third general room
-- "Free Lounge" joins FIC Club + FTA Traders. Free families chat here (their
-- one open room); members (fic/fta) also SEE it listed after their rooms so they
-- can welcome newcomers. Which rooms a member may OPEN stays an app-layer concern
-- (community page / LiveRooms) — the same posture migrations 016/033 already use.
--
-- ⚠️ RLS SCAR (migrations 018/019/033): Supabase Realtime evaluates the SELECT
-- policy PER ROW and CANNOT authorize a policy that subqueries another table, and
-- self-referential policies caused 42P17 recursion. The chat_messages SELECT
-- policy therefore stays a bare column comparison — now an IN against THREE
-- constant room UUIDs (still no subquery, still realtime-safe). This only WIDENS
-- the existing 033 policy by one constant; the shape is unchanged.

-- Fixed id (idempotent), matching the 016/033 room-id scheme.
--   FIC Club     c0000000-0000-4000-a000-000000000001
--   FTA Traders  c0000000-0000-4000-a000-000000000002
--   Free Lounge  c0000000-0000-4000-a000-000000000003  (new)
insert into chat_rooms (id, type, name)
values ('c0000000-0000-4000-a000-000000000003'::uuid, 'general', 'Free Lounge')
on conflict (id) do nothing;

-- Realtime-safe SELECT: bare column comparison against the THREE known community
-- rooms (constants only, no subquery — honors the 019/033 scar).
drop policy if exists "Read community messages" on chat_messages;
create policy "Read community messages" on chat_messages
  for select using (
    room_id in (
      'c0000000-0000-4000-a000-000000000001'::uuid,
      'c0000000-0000-4000-a000-000000000002'::uuid,
      'c0000000-0000-4000-a000-000000000003'::uuid
    )
  );

-- INSERT into the Free Lounge for any authenticated member (posting as self).
-- The 016 "Post to general rooms" policy already covers this room (it is type
-- 'general'); this explicit, room-scoped policy states the intent plainly and is
-- additive (policies are OR'd) — free families can post here even if the general
-- policy is ever narrowed.
drop policy if exists "Post to free lounge" on chat_messages;
create policy "Post to free lounge" on chat_messages
  for insert with check (
    auth.uid() = user_id
    and room_id = 'c0000000-0000-4000-a000-000000000003'::uuid
  );
