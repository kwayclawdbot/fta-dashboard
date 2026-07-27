-- 190 — CANVAS V2 · LANE L2 (Community): RESPECT, structured contribution, topic rooms.
--
-- Three things the canvas asks for that the schema could not yet store. Each is a
-- REAL write here — the lane's rule was that a control which does not persist does
-- not ship.
--
--   1. RESPECT. Club Screens 03 puts a RESPECT reaction on a change-of-mind post.
--      The reaction machinery already exists (object_reactions, migration 150) but
--      its vocabulary is closed by CHECK and 'respect' is not in it, and the thing
--      being respected — a stance FLIP (stance_events, migration 151) — is not a
--      legal target_type. Both constraints are widened. Nothing else about 150
--      changes: same table, same RLS (insert/delete as self), same
--      get_object_reactions[_batch] aggregates, so the whole client path is reused.
--
--   2. STRUCTURED CONTRIBUTION. Club Screens 05 requires a post to declare a TYPE:
--      THESIS / RISK / CHART / CHANGED MY MIND. feed_posts.content_type (migration
--      142) only allows thesis | question | news_reaction. The vocabulary is
--      widened rather than replaced — 142's three values stay legal so existing
--      rows survive and the Kai classification pipeline keeps reading a known enum.
--
--   3. ROOMS BY TOPIC. Club Screens 02 splits the Lounge into topic rooms. Three
--      are added as ordinary type='general' chat_rooms, which means migration 016's
--      "Post to general rooms" INSERT policy already covers them. The canvas's
--      fourth room ("Options desk") is deliberately NOT created: Club surfaces are
--      equities-only.
--
--      ⚠️ RLS SCAR (migrations 018/019/033/086): the chat_messages SELECT policy
--      must stay a bare column comparison against CONSTANT room ids — Supabase
--      Realtime evaluates it per row and cannot authorize a policy that subqueries
--      another table. This migration only WIDENS the existing IN-list from three
--      constants to six. The shape is unchanged.
--
-- Also adds two read RPCs: get_changed_minds (the club-wide flip feed behind the
-- Changed My Mind destination, with respect counts folded in so the surface is one
-- round trip) and get_room_activity (REAL per-room talker counts — the canvas draws
-- "418 talking" and the app must never print a number it did not count).
--
-- Re-runnable. No XP anywhere (anti-spam, owner rule).

-- Widening a closed vocabulary means swapping a CHECK, and the constraint's name
-- is whatever Postgres auto-generated when the column was declared inline. Drop
-- by LOOKUP rather than by guessed name, so this cannot half-apply (drop misses →
-- add collides on a duplicate name → the migration fails with the old vocabulary
-- still in force, which is the worst of both outcomes).
create or replace function pg_temp.drop_col_checks(p_table text, p_column text)
returns void
language plpgsql
as $$
declare
  v_name text;
begin
  for v_name in
    select c.conname
    from pg_constraint c
    join pg_attribute a
      on a.attrelid = c.conrelid and a.attnum = any (c.conkey)
    where c.conrelid = p_table::regclass
      and c.contype = 'c'
      and a.attname = p_column
  loop
    execute format('alter table %I drop constraint %I', p_table, v_name);
  end loop;
end;
$$;

-- ── 1. RESPECT ───────────────────────────────────────────────────────────────
select pg_temp.drop_col_checks('object_reactions', 'reaction');
alter table object_reactions add constraint object_reactions_reaction_check
  check (reaction in (
    'strong_point', 'agree', 'needs_evidence', 'missing_risk', 'changed_mind', 'saved',
    'respect'
  ));

select pg_temp.drop_col_checks('object_reactions', 'target_type');
alter table object_reactions add constraint object_reactions_target_type_check
  check (target_type in ('research_object', 'ticker_comment', 'feed_post', 'stance_event'));

comment on constraint object_reactions_reaction_check on object_reactions is
  'Closed reaction vocabulary. `respect` (canvas v2, Club Screens 03) answers a stance flip: it acknowledges the update rather than agreeing with the conclusion.';

-- ── 2. STRUCTURED CONTRIBUTION ───────────────────────────────────────────────
select pg_temp.drop_col_checks('feed_posts', 'content_type');
alter table feed_posts add constraint feed_posts_content_type_check
  check (content_type is null or content_type in (
    'thesis', 'question', 'news_reaction',   -- migration 142, kept legal
    'risk', 'chart', 'changed_mind'          -- canvas v2, Club Screens 05
  ));

comment on column feed_posts.content_type is
  'Member-declared post kind. 142 vocab (thesis|question|news_reaction) plus the canvas v2 structured-contribution types (risk|chart|changed_mind). Null = unclassified.';

-- ── 3. ROOMS BY TOPIC ────────────────────────────────────────────────────────
-- Fixed ids continue the 016/033/086 scheme:
--   FIC Club          c0000000-0000-4000-a000-000000000001
--   FTA Traders       c0000000-0000-4000-a000-000000000002
--   Free Lounge       c0000000-0000-4000-a000-000000000003
--   Semis & AI infra  c0000000-0000-4000-a000-000000000004  (new)
--   Macro & rates     c0000000-0000-4000-a000-000000000005  (new)
--   First 100 days    c0000000-0000-4000-a000-000000000006  (new)
insert into chat_rooms (id, type, name) values
  ('c0000000-0000-4000-a000-000000000004'::uuid, 'general', 'Semis & AI infra'),
  ('c0000000-0000-4000-a000-000000000005'::uuid, 'general', 'Macro & rates'),
  ('c0000000-0000-4000-a000-000000000006'::uuid, 'general', 'First 100 days')
on conflict (id) do nothing;

-- Realtime-safe SELECT: constants only, no subquery (019/033/086 scar).
drop policy if exists "Read community messages" on chat_messages;
create policy "Read community messages" on chat_messages
  for select using (
    room_id in (
      'c0000000-0000-4000-a000-000000000001'::uuid,
      'c0000000-0000-4000-a000-000000000002'::uuid,
      'c0000000-0000-4000-a000-000000000003'::uuid,
      'c0000000-0000-4000-a000-000000000004'::uuid,
      'c0000000-0000-4000-a000-000000000005'::uuid,
      'c0000000-0000-4000-a000-000000000006'::uuid
    )
  );

-- ── get_changed_minds — the club-wide flip feed ──────────────────────────────
-- get_ticker_stance_summary (151) answers "who flipped on NVDA". The Changed My
-- Mind DESTINATION asks the club-wide question, so it needs its own read. Respect
-- counts + the caller's own respect ride along per row: the destination renders a
-- respect control on every entry and an N+1 across a feed is the exact thing
-- get_object_reactions_batch exists to prevent.
--
-- SECURITY DEFINER so counts are consistent regardless of the caller's row view.
-- Returns aggregates + public flip content only — never who-respected-what.
create or replace function public.get_changed_minds(p_limit int default 30)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'total_flips', coalesce((select count(*)::int from stance_events where is_flip), 0),
    'members', coalesce((select count(distinct user_id)::int from stance_events where is_flip), 0),
    'tickers', coalesce((select count(distinct ticker)::int from stance_events where is_flip), 0),
    'items', coalesce((
      select jsonb_agg(x order by x.created_at desc)
      from (
        select
          se.id, se.ticker, se.from_stance, se.to_stance, se.reason, se.note, se.created_at,
          p.display_name, p.username, p.avatar_url, p.role, p.age_group,
          coalesce((
            select count(*)::int from object_reactions r
            where r.target_type = 'stance_event' and r.target_id = se.id
              and r.reaction = 'respect'
          ), 0) as respect_count,
          exists (
            select 1 from object_reactions r
            where r.target_type = 'stance_event' and r.target_id = se.id
              and r.reaction = 'respect' and r.user_id = auth.uid()
          ) as my_respect
        from stance_events se
        join profiles p on p.id = se.user_id
        where se.is_flip
        order by se.created_at desc
        limit greatest(1, least(coalesce(p_limit, 30), 100))
      ) x
    ), '[]'::jsonb)
  );
$$;
grant execute on function public.get_changed_minds(int) to authenticated;

-- ── get_room_activity — REAL talker counts per topic room ────────────────────
-- The canvas prints "418 talking" under every room tile. Production will print a
-- number it actually counted: DISTINCT senders in the last 24h. The app floors it
-- (a "1 talking" tile publishes how small the room is) and renders founding copy
-- below the floor — but the number that reaches the app is never invented here.
create or replace function public.get_room_activity(p_room_ids uuid[])
returns table (
  room_id uuid,
  talkers_24h int,
  messages_24h int,
  last_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select
    r.rid as room_id,
    coalesce((
      select count(distinct m.user_id)::int from chat_messages m
      where m.room_id = r.rid and m.created_at > now() - interval '24 hours'
    ), 0) as talkers_24h,
    coalesce((
      select count(*)::int from chat_messages m
      where m.room_id = r.rid and m.created_at > now() - interval '24 hours'
    ), 0) as messages_24h,
    (select max(m.created_at) from chat_messages m where m.room_id = r.rid) as last_at
  from unnest(coalesce(p_room_ids, '{}'::uuid[])) as r(rid);
$$;
grant execute on function public.get_room_activity(uuid[]) to authenticated;
