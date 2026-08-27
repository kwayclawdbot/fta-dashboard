-- ============================================================================
-- PURGE THE SEEDED SOCIAL CONTENT — 2026-07-31
--
-- REVIEW BEFORE RUNNING. This file is written to be read, then run once, by the
-- owner or the main agent. It has NOT been executed.
--
-- WHY
-- ---
-- Owner, verbatim: "the chat also is a bunch of random stuff like changed my
-- minds and fake live people i want you to restore the original chat area."
-- The chat area is restored in code. This is the other half: the production
-- database contains SEEDED demo social content authored by six invented people
-- that real members (Ken, Eli, Kiera, Malachi, DWELE…) have been reading as if
-- they were fellow members.
--
-- WHO IS BEING CLASSIFIED AS FAKE, AND ON WHAT EVIDENCE
-- -----------------------------------------------------
-- Exactly six profiles, all in one synthetic household:
--
--   family "V2 Demo Club"  id d0000000-0000-4000-8000-00000000d200
--     e47a81f3-a0a5-4d6f-853c-166c74591dee  OptionsOG    optionsog@cheatcode-qa.dev
--     f3b40184-a671-4b53-a533-53db216905ff  Tiffany R.   tiffanyr@cheatcode-qa.dev
--     328ff311-8713-4e66-b52e-f7a2194cdf41  DataDive     datadive@cheatcode-qa.dev
--     ca595e70-9253-4878-b8f8-35409dc80418  DeShawn K.   deshawnk@cheatcode-qa.dev
--     5f377bdd-88e0-44b2-a615-a8f037a5df5d  Maya         mayainvests@cheatcode-qa.dev
--     bd4e0c04-cf19-486f-9e63-ab1de1931e10  JCharts      jcharts@cheatcode-qa.dev
--
-- Four independent signals, all agreeing:
--   1. auth.users.last_sign_in_at IS NULL for all six. Not one has ever logged
--      in. A real member who has never signed in cannot have authored twelve
--      theses, seven circle notes and forty-four reactions.
--   2. All six share the @cheatcode-qa.dev domain and one household created
--      2026-07-28 23:44 — the six profiles and the family were minted in the
--      same minute.
--   3. No real-member footprint anywhere: 0 rows in challenge_members, no
--      stripe_customer_id / stripe_subscription_id on the household, no
--      push_subscriptions, no notifications.
--   4. Every one of the twelve posts still carries the seeder's own marker in
--      its body (`[seed:` …). That marker set is a strict SUBSET of the
--      author set — verified: no marked post has any other author — so the
--      AUTHOR rule below is the superset and the marker is only a cross-check.
--
-- The classification key is the six literal UUIDs, not a name or e-mail LIKE
-- pattern. A destructive script should not be able to widen its own blast
-- radius if someone later renames a household.
--
-- WHAT IS DELIBERATELY LEFT ALONE  (see also the report accompanying this file)
-- ----------------------------------------------------------------------------
--   • The six auth accounts and profiles themselves. Deleting content is
--     reversible from the snapshots below; deleting identities is not, and
--     feed_posts.author_id is ON DELETE SET NULL, so dropping a profile would
--     ORPHAN rows rather than remove them. An OPTIONAL, COMMENTED-OUT block at
--     the foot of this file removes them if the owner wants them gone — read
--     the note there first, it has a consequence for @mention rosters.
--   • demo-club / demo-family / demo-kid @cheatcode.internal. These are the
--     sanctioned permanent preview fixtures created by
--     scripts/seed-preview-demo.mjs; previews still log in as them and all
--     three have signed in within the last 24h. Their 16 `activity` feed rows
--     stay.
--   • cardtest / cardtest2 @cheatcode-qa.dev. Same e-mail domain as the six,
--     but a DIFFERENT thing: owner QA accounts for the NFC card work, no
--     household, and both HAVE signed in. cardtest2's 6 rows are trigger-made
--     `activity` cards, not authored personas. AMBIGUOUS BY DOMAIN, so they
--     stay, and they are already on LEADERBOARD_DENYLIST.
--   • 42 `activity` feed_posts and 1 `anchor` post with author_id IS NULL.
--     System exhaust with no person attached to it. Nothing to impersonate.
--   • Kway's 3 stance_events and 3 ticker_stances (kcoffie90@gmail.com) — the
--     owner's own real rows, and the only stance data that survives.
--   • profiles "Kai" (kai@cheatcode.internal, role coach): a product identity,
--     not a fake member, and it authors nothing in these tables.
--   • ALL 8 chat_messages. Every one is a real member (Kway Jr, Malachi, Kiera,
--     DWELE, Kway). The chat was never seeded — which is precisely why
--     restoring the chat area removes the fake people from view on its own.
--
-- EXPECTED ROW COUNTS  (measured 2026-07-31 against zvkercqohmmeyofycbgr)
-- ----------------------------------------------------------------------
--   feed_posts                     41   (12 authored `post` + 29 `activity`)
--   post_comments                   0
--   post_likes                      0
--   object_reactions               44   (36 on seed feed_posts, 8 on seed
--                                        stance_events; EVERY one is BY a seed
--                                        author — no real member loses a
--                                        reaction they made)
--   stance_events                   4   (of 7; the other 3 are Kway's, kept)
--   ticker_stances                 13   (of 16; the other 3 are Kway's, kept)
--   club_circles                    3   (all three, slugs `%-v2demo`)
--   club_circle_members            14   (all inside those 3 circles)
--   club_circle_notes               7   (all inside those 3 circles)
--   xp_events                      18   (250–3,400 XP each; this is what put
--                                        invented people on the public belt
--                                        board next to real members)
--   chat_messages                   0
--   chat_room_members               0
--
-- The script ASSERTS these counts before it deletes anything. If the database
-- has moved on since it was written, it raises and rolls back rather than
-- guessing.
-- ============================================================================

begin;

-- ── the classification set ─────────────────────────────────────────────────
create temp table _seed_authors (id uuid primary key) on commit drop;
insert into _seed_authors (id) values
  ('e47a81f3-a0a5-4d6f-853c-166c74591dee'),  -- OptionsOG
  ('f3b40184-a671-4b53-a533-53db216905ff'),  -- Tiffany R.
  ('328ff311-8713-4e66-b52e-f7a2194cdf41'),  -- DataDive
  ('ca595e70-9253-4878-b8f8-35409dc80418'),  -- DeShawn K.
  ('5f377bdd-88e0-44b2-a615-a8f037a5df5d'),  -- Maya
  ('bd4e0c04-cf19-486f-9e63-ab1de1931e10');  -- JCharts

create temp table _seed_circles (id uuid primary key) on commit drop;
insert into _seed_circles (id)
  select id from club_circles where slug like '%-v2demo';

create temp table _seed_posts (id uuid primary key) on commit drop;
insert into _seed_posts (id)
  select id from feed_posts
  where author_id in (select id from _seed_authors)
     or body like '%[seed:%';           -- cross-check; a strict subset today

create temp table _seed_stances (id uuid primary key) on commit drop;
insert into _seed_stances (id)
  select id from stance_events where user_id in (select id from _seed_authors);

-- ── GUARD 1: the six are who we think they are ─────────────────────────────
-- Never signed in, and no real-member footprint. If any of this stops being
-- true, someone has started using one of these accounts and the purge must be
-- re-reviewed by a human before it runs.
do $$
declare n int;
begin
  select count(*) into n from auth.users u
    join _seed_authors s on s.id = u.id
   where u.last_sign_in_at is not null;
  if n > 0 then
    raise exception 'ABORT: % of the 6 seed accounts has signed in. Re-review before purging.', n;
  end if;

  select count(*) into n from _seed_authors s
   where exists (select 1 from challenge_members c where c.user_id = s.id);
  if n > 0 then
    raise exception 'ABORT: % seed account(s) are challenge members. Not fixtures.', n;
  end if;

  select count(*) into n from families f
    join profiles p on p.family_id = f.id
   where p.id in (select id from _seed_authors)
     and (f.stripe_customer_id is not null or f.stripe_subscription_id is not null);
  if n > 0 then
    raise exception 'ABORT: seed household carries a Stripe footprint.';
  end if;

  select count(*) into n from _seed_authors;
  if n <> 6 then raise exception 'ABORT: expected 6 seed authors, found %.', n; end if;
end $$;

-- ── GUARD 2: the marker set is inside the author set ───────────────────────
do $$
declare n int;
begin
  select count(*) into n from feed_posts
   where body like '%[seed:%'
     and (author_id is null or author_id not in (select id from _seed_authors));
  if n > 0 then
    raise exception 'ABORT: % seed-marked post(s) have an author outside the 6. Re-classify by hand.', n;
  end if;
end $$;

-- ── GUARD 3: no real member loses a reaction they made ─────────────────────
do $$
declare n int;
begin
  select count(*) into n from object_reactions o
   where (   (o.target_type = 'feed_post'    and o.target_id in (select id from _seed_posts))
          or (o.target_type = 'stance_event' and o.target_id in (select id from _seed_stances)))
     and o.user_id not in (select id from _seed_authors);
  if n > 0 then
    raise exception 'ABORT: % reaction(s) on seed content were made by real members.', n;
  end if;
end $$;

-- ── GUARD 4: the counts are the counts this file was written against ───────
do $$
declare
  c_posts int; c_reactions int; c_stance int; c_ticker int;
  c_circles int; c_members int; c_notes int; c_xp int; c_chat int;
begin
  select count(*) into c_posts     from _seed_posts;
  select count(*) into c_reactions from object_reactions
    where user_id in (select id from _seed_authors)
       or (target_type = 'feed_post'    and target_id in (select id from _seed_posts))
       or (target_type = 'stance_event' and target_id in (select id from _seed_stances));
  select count(*) into c_stance   from _seed_stances;
  select count(*) into c_ticker   from ticker_stances where user_id in (select id from _seed_authors);
  select count(*) into c_circles  from _seed_circles;
  select count(*) into c_members  from club_circle_members where circle_id in (select id from _seed_circles);
  select count(*) into c_notes    from club_circle_notes   where circle_id in (select id from _seed_circles);
  select count(*) into c_xp       from xp_events where user_id in (select id from _seed_authors);
  select count(*) into c_chat     from chat_messages where user_id in (select id from _seed_authors);

  if (c_posts, c_reactions, c_stance, c_ticker, c_circles, c_members, c_notes, c_xp, c_chat)
     is distinct from (41, 44, 4, 13, 3, 14, 7, 18, 0)
  then
    raise exception
      'ABORT: counts moved. posts=% reactions=% stance=% ticker=% circles=% members=% notes=% xp=% chat=% (expected 41/44/4/13/3/14/7/18/0)',
      c_posts, c_reactions, c_stance, c_ticker, c_circles, c_members, c_notes, c_xp, c_chat;
  end if;
end $$;

-- ── SNAPSHOTS ──────────────────────────────────────────────────────────────
-- Every row this transaction removes is copied first. Undo is an INSERT … SELECT
-- back out of these tables; drop them once the owner is satisfied.
create table _purge_20260731_feed_posts          as select * from feed_posts          where id in (select id from _seed_posts);
create table _purge_20260731_post_comments       as select * from post_comments       where post_id in (select id from _seed_posts) or author_id in (select id from _seed_authors);
create table _purge_20260731_post_likes          as select * from post_likes          where post_id in (select id from _seed_posts) or user_id  in (select id from _seed_authors);
create table _purge_20260731_object_reactions    as select * from object_reactions    where user_id in (select id from _seed_authors)
                                                                                          or (target_type = 'feed_post'    and target_id in (select id from _seed_posts))
                                                                                          or (target_type = 'stance_event' and target_id in (select id from _seed_stances));
create table _purge_20260731_stance_events       as select * from stance_events       where id      in (select id from _seed_stances);
create table _purge_20260731_ticker_stances      as select * from ticker_stances      where user_id in (select id from _seed_authors);
create table _purge_20260731_club_circles        as select * from club_circles        where id        in (select id from _seed_circles);
create table _purge_20260731_club_circle_members as select * from club_circle_members where circle_id in (select id from _seed_circles) or member_id in (select id from _seed_authors);
create table _purge_20260731_club_circle_notes   as select * from club_circle_notes   where circle_id in (select id from _seed_circles) or author_id in (select id from _seed_authors);
create table _purge_20260731_xp_events           as select * from xp_events           where user_id in (select id from _seed_authors);
create table _purge_20260731_chat_messages       as select * from chat_messages       where user_id in (select id from _seed_authors);

-- ── DELETES, leaf-first ────────────────────────────────────────────────────
-- object_reactions is polymorphic (target_id has no FK), so it must go BEFORE
-- its targets or it is orphaned rather than removed.
delete from object_reactions
 where user_id in (select id from _seed_authors)
    or (target_type = 'feed_post'    and target_id in (select id from _seed_posts))
    or (target_type = 'stance_event' and target_id in (select id from _seed_stances));

delete from post_comments where post_id in (select id from _seed_posts) or author_id in (select id from _seed_authors);
delete from post_likes    where post_id in (select id from _seed_posts) or user_id  in (select id from _seed_authors);
delete from feed_posts    where id      in (select id from _seed_posts);

delete from stance_events  where id      in (select id from _seed_stances);
delete from ticker_stances where user_id in (select id from _seed_authors);

-- club_circle_members / _notes cascade off club_circles, but they are deleted
-- explicitly so the row counts below are the script's own and not a trigger's.
delete from club_circle_notes   where circle_id in (select id from _seed_circles) or author_id in (select id from _seed_authors);
delete from club_circle_members where circle_id in (select id from _seed_circles) or member_id in (select id from _seed_authors);
delete from club_circles        where id        in (select id from _seed_circles);

-- The fabricated XP that ranked invented people on the public belt board.
delete from xp_events where user_id in (select id from _seed_authors);

-- Zero rows today. Present so that if the chat is ever seeded, this file is
-- the one place that cleans it.
delete from chat_messages where user_id in (select id from _seed_authors);

-- ── VERIFY: nothing authored by the six survives ───────────────────────────
do $$
declare n int;
begin
  select
      (select count(*) from feed_posts          where author_id in (select id from _seed_authors))
    + (select count(*) from feed_posts          where body like '%[seed:%')
    + (select count(*) from object_reactions    where user_id   in (select id from _seed_authors))
    + (select count(*) from stance_events       where user_id   in (select id from _seed_authors))
    + (select count(*) from ticker_stances      where user_id   in (select id from _seed_authors))
    + (select count(*) from club_circles        where slug like '%-v2demo')
    + (select count(*) from club_circle_members where member_id in (select id from _seed_authors))
    + (select count(*) from club_circle_notes   where author_id in (select id from _seed_authors))
    + (select count(*) from xp_events           where user_id   in (select id from _seed_authors))
    + (select count(*) from chat_messages       where user_id   in (select id from _seed_authors))
    into n;
  if n <> 0 then raise exception 'ABORT: % seeded row(s) survived the purge.', n; end if;
end $$;

-- ── VERIFY: the real club is untouched ─────────────────────────────────────
do $$
declare c_chat int; c_stance int; c_ticker int;
begin
  select count(*) into c_chat   from chat_messages;
  select count(*) into c_stance from stance_events;
  select count(*) into c_ticker from ticker_stances;
  if c_chat <> 8 then
    raise exception 'ABORT: chat_messages is % , expected the 8 real member messages.', c_chat;
  end if;
  if c_stance <> 3 or c_ticker <> 3 then
    raise exception 'ABORT: expected Kway''s 3 stance_events / 3 ticker_stances to remain, found %/%.', c_stance, c_ticker;
  end if;
end $$;

commit;

-- ============================================================================
-- WHAT THE MEMBER SEES AFTERWARDS
--
--   /community            the restored chat area. 8 real messages, unaffected.
--   /community/changed-my-mind   empty state ("No flips yet"), since the only
--                                surviving stance_events are Kway's.
--   /circles              empty state; all three circles were fixtures.
--   /leaderboard, /belts  the six are gone twice over — their XP rows are
--                         deleted AND their usernames are on
--                         LEADERBOARD_DENYLIST (src/lib/leaderboardExclusions.ts).
--   /u/[username]         the six profiles still resolve, now with nothing on
--                         them. Use the optional block below to remove them.
-- ============================================================================


-- ============================================================================
-- OPTIONAL — REMOVE THE SIX IDENTITIES TOO.  COMMENTED OUT ON PURPOSE.
--
-- The block above removes what the six SAID. This removes the six. Read first:
--
--   • They are NOT the preview accounts. Previews log in as
--     demo-club/demo-family/demo-kid @cheatcode.internal, which this does not
--     touch. Nothing signs in as the six — that is the whole evidence base.
--   • CONSEQUENCE IF LEFT: "Tiffany R.", "OptionsOG" etc. remain in the
--     composer's @mention roster and in the global "Members" count in the chat
--     sidebar. A member can still type @TiffanyR and be offered a person who
--     does not exist.
--   • CONSEQUENCE IF RUN: irreversible. profiles cascades widely and
--     auth.users deletion cannot be undone from these snapshots.
--
-- Run only on an explicit owner decision.
--
-- begin;
--   delete from profiles where id in (
--     'e47a81f3-a0a5-4d6f-853c-166c74591dee', 'f3b40184-a671-4b53-a533-53db216905ff',
--     '328ff311-8713-4e66-b52e-f7a2194cdf41', 'ca595e70-9253-4878-b8f8-35409dc80418',
--     '5f377bdd-88e0-44b2-a615-a8f037a5df5d', 'bd4e0c04-cf19-486f-9e63-ab1de1931e10');
--   delete from families where id = 'd0000000-0000-4000-8000-00000000d200';
--   -- auth.users rows are removed via the Admin API / dashboard, not SQL.
-- commit;
-- ============================================================================
