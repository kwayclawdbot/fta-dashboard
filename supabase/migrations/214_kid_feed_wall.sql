-- ============================================================================
-- 214 — THE KID FEED WALL. Kid-authored feed content is family-only.
--
-- THE BUG (owner-reported, live in production): kid-authored comments and kid
-- activity cards were rendering on the shared Club feed. Kids' content exists
-- ONLY in family surfaces — that is the binding rule, and until this migration
-- it was enforced nowhere on the read path.
--
-- WHAT WAS ACTUALLY OPEN
--
--   1. READ. `feed_posts` and `post_comments` (034) carry no room / register /
--      scope column at all, and both SELECT policies were literally
--      `using (true)`. Every read of either table — the /community feed, the
--      dashboard activity strip, the ticker Club Read, the counts on the
--      masthead — returned every row in the table to every authenticated
--      member. There was nothing to filter BY.
--
--   2. WRITE (the primary hole). 161 walled `feed_posts` INSERT against kids,
--      but `post_comments` INSERT was still the bare 034 policy —
--      `with check (author_id = auth.uid())`. A kid could comment on any adult
--      post in the shared feed, and the comment was then visible to everyone by
--      (1). 192's restrictive `family_chat_scope_ok()` only bites when a
--      `family_guardrails` row with `chat_family_only` exists, which is not the
--      default state of an account. So: no guard.
--
--   3. `_feed_activity()` (034) is SECURITY DEFINER and stamps an activity card
--      into `feed_posts` for six triggers — badge awards, watchlist adds,
--      watchlist verdicts, mission completions, session RSVPs and XP level-ups
--      (which includes FTA lesson XP). It bypasses RLS by construction, and it
--      writes the actor's NAME, AVATAR and AGE GROUP into `activity_payload`.
--      Every kid earning a badge published a card carrying their identity into
--      the adult town square.
--
--   4. `challenge_post_artifact()` (199) is SECURITY DEFINER, granted to
--      `authenticated`, and inserts `kind='post'` directly — a clean bypass of
--      the 161 wall for any kid running the challenge.
--
--   5. THE REVERSE LEAK. Because SELECT was `using (true)`, a kid could read
--      the ENTIRE adult feed, either through the dashboard's activity strip
--      (mounted outside the kid branch) or by hitting
--      /rest/v1/feed_posts directly with their own session.
--
-- THE FIX — a denormalized register column, stamped by the server, filtered in
-- the policy.
--
-- 018/019 RLS SCARS: a policy predicate on these tables must stay a PURE
-- own-column / stable-helper expression. Supabase Realtime evaluates a SELECT
-- policy per row and cannot authorize a subquery, and 034 deliberately kept the
-- feed SELECT policies realtime-compatible so realtime COULD be enabled later.
-- So the register is NOT looked up in the policy — it is written onto the row
-- by a BEFORE INSERT trigger and read back as a plain column. The only function
-- calls in the new predicates are `get_my_family_id()` (039) and `auth.uid()`,
-- both already used this way across the schema.
--
-- CORRECTION TO THE RECORD: migration 196's header (line 11) states
-- "feed_posts SELECT is family-scoped (034/161)". That was FALSE when written —
-- 034 set `using (true)` and 161 touched only INSERT. It is TRUE as of this
-- migration, for kid-authored rows. Adult and teen rows remain club-wide.
--
-- TEENS ARE NOT WALLED. 161 walls kids only (viewer_is_kid → the 'kids' band),
-- the screener wall (137) walls kids only, and the search/people routes filter
-- kids only. This migration keeps that exact posture: `author_register = 'kid'`
-- is the wall, teens stay in the club.
--
-- NO ROWS ARE DELETED. Historical kid-authored rows are scoped to their family
-- by the new policy, not destroyed — a kid's own badge history stays visible to
-- the kid and their household on the family surfaces that already exist.
-- ============================================================================

-- ═══════════════════════════════════════════════════════════════════════════
-- 1. THE REGISTER OF AN ARBITRARY MEMBER
-- ═══════════════════════════════════════════════════════════════════════════
-- viewer_is_kid() (137) answers only for auth.uid(). Stamping a row needs the
-- same verdict for the AUTHOR, so this is the same precedence ladder
-- (age_group → role → legacy track → adult, mirroring src/lib/register.ts
-- deriveRegister) parameterised by user id, and returning the TypeScript
-- vocabulary ('kid' | 'teen' | 'adult') because the client filters compare
-- against these literals.
--
-- A missing profile row returns NULL; every caller coalesces to 'adult', which
-- is deriveRegister's own default for an unknown profile. That also covers the
-- system cards whose author_id is null (110's "the club is warming up to X",
-- the week anchor): they are club-wide announcements, not a member's content.

create or replace function public.profile_register(p_user uuid)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select case coalesce(
      case p.age_group
        when 'kids'   then 'kids'
        when 'teens'  then 'teens'
        when 'adults' then 'adults'
        else null
      end,
      case p.role
        when 'child' then 'kids'
        when 'teen'  then 'teens'
        else null
      end,
      case p.track
        when 'kids'  then 'kids'
        when 'teens' then 'teens'
        else null
      end,
      'adults'
    )
    when 'kids'  then 'kid'
    when 'teens' then 'teen'
    else 'adult'
  end
  from profiles p
  where p.id = p_user;
$$;

comment on function public.profile_register(uuid) is
  'Register (kid|teen|adult) of an arbitrary member. Same precedence as viewer_is_kid() (137) and src/lib/register.ts deriveRegister. NULL when the profile row is absent — callers coalesce to adult.';

grant execute on function public.profile_register(uuid) to authenticated;

-- ═══════════════════════════════════════════════════════════════════════════
-- 2. THE DENORMALIZED COLUMNS
-- ═══════════════════════════════════════════════════════════════════════════
-- feed_posts already carries family_id. post_comments does NOT, and the comment
-- policy needs a family predicate that is pure-own-column, so family_id is
-- denormalized onto it too (from the AUTHOR's family, falling back to the
-- parent post's).

alter table feed_posts    add column if not exists author_register text;
alter table post_comments add column if not exists author_register text;
alter table post_comments add column if not exists family_id uuid references families(id) on delete set null;

comment on column feed_posts.author_register is
  'kid|teen|adult — stamped from the author profile by trg_feed_posts_stamp_register. Denormalized on purpose: the SELECT policy must stay a pure own-column predicate (018/019 realtime scar), so it cannot subquery profiles.';
comment on column post_comments.author_register is
  'kid|teen|adult — stamped from the author profile by trg_post_comments_stamp_register. See feed_posts.author_register.';
comment on column post_comments.family_id is
  'The comment AUTHOR''s family (falls back to the parent post''s). Exists only so the kid-wall SELECT policy can scope kid comments to their household without a subquery.';

-- ═══════════════════════════════════════════════════════════════════════════
-- 3. THE STAMP — server authority, not client input
-- ═══════════════════════════════════════════════════════════════════════════
-- BEFORE INSERT so it also runs for the SECURITY DEFINER writers (which bypass
-- RLS but not triggers), and so a client that hand-crafts a POST body with
-- "author_register":"adult" is overwritten rather than believed.
--
-- The stamp is NOT refreshed on update: a row written while its author was a
-- kid stays walled even after that member ages into the teen band. The wall
-- only ever tightens, never loosens, on its own.

create or replace function public.stamp_feed_author_register()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  new.author_register := coalesce(public.profile_register(new.author_id), 'adult');
  return new;
end;
$$;

drop trigger if exists trg_feed_posts_stamp_register on feed_posts;
create trigger trg_feed_posts_stamp_register
  before insert on feed_posts
  for each row execute function public.stamp_feed_author_register();

create or replace function public.stamp_comment_author_register()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  new.author_register := coalesce(public.profile_register(new.author_id), 'adult');
  if new.family_id is null then
    select p.family_id into new.family_id from profiles p where p.id = new.author_id;
  end if;
  if new.family_id is null then
    select f.family_id into new.family_id from feed_posts f where f.id = new.post_id;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_post_comments_stamp_register on post_comments;
create trigger trg_post_comments_stamp_register
  before insert on post_comments
  for each row execute function public.stamp_comment_author_register();

-- ═══════════════════════════════════════════════════════════════════════════
-- 4. BACKFILL — every existing row, before the column is trusted
-- ═══════════════════════════════════════════════════════════════════════════
-- The server-side query filters added alongside this migration use a plain
-- `author_register <> 'kid'`, which in PostgREST/SQL drops NULLs. So the column
-- is backfilled here and then made NOT NULL: after this runs there is no such
-- thing as an unstamped row, and the simple filter is exactly right.

update feed_posts
   set author_register = coalesce(public.profile_register(author_id), 'adult')
 where author_register is null;

update post_comments c
   set author_register = coalesce(public.profile_register(c.author_id), 'adult'),
       family_id = coalesce(
         (select p.family_id from profiles p where p.id = c.author_id),
         (select f.family_id from feed_posts f where f.id = c.post_id)
       )
 where c.author_register is null;

alter table feed_posts    alter column author_register set default 'adult';
alter table post_comments alter column author_register set default 'adult';
alter table feed_posts    alter column author_register set not null;
alter table post_comments alter column author_register set not null;

create index if not exists idx_feed_posts_author_register    on feed_posts(author_register);
create index if not exists idx_post_comments_author_register on post_comments(author_register);

-- ═══════════════════════════════════════════════════════════════════════════
-- 5. THE READ WALL
-- ═══════════════════════════════════════════════════════════════════════════
-- Adult + teen rows: every authenticated member, exactly as before.
-- Kid rows: the author themselves, and their household. Nobody else — not the
-- club, not another family, and (there being no anon SELECT policy on either
-- table) never a logged-out visitor.
--
-- Pure own-column predicate + two stable helpers. No subquery. Realtime-safe.

drop policy if exists "Read feed posts" on feed_posts;
create policy "Read feed posts" on feed_posts
  for select to authenticated
  using (
    author_register <> 'kid'
    or author_id = auth.uid()
    or (family_id is not null and family_id = public.get_my_family_id())
  );

drop policy if exists "Read post comments" on post_comments;
create policy "Read post comments" on post_comments
  for select to authenticated
  using (
    author_register <> 'kid'
    or author_id = auth.uid()
    or (family_id is not null and family_id = public.get_my_family_id())
  );

-- ═══════════════════════════════════════════════════════════════════════════
-- 6. THE COMMENT WRITE WALL — the primary hole
-- ═══════════════════════════════════════════════════════════════════════════
-- Mirrors 161's feed_posts INSERT policy exactly, same single flip point:
-- kid_feed_readonly() → false re-opens kid commenting server-side with no other
-- change. The UI half is src/lib/social/kid-posting.ts KID_FEED_READONLY.

drop policy if exists "Author own comments" on post_comments;
create policy "Author own comments" on post_comments
  for insert to authenticated
  with check (
    author_id = auth.uid()
    and not (public.kid_feed_readonly() and coalesce(public.viewer_is_kid(), false))
  );

-- NOTIFICATIONS. trg_post_comment_notify (034) fires AFTER INSERT on
-- post_comments and notifies the post author + @mentions; _feed_notify_mentions
-- does the same for posts. Neither needs a change: a kid comment can no longer
-- be INSERTed at all, so no notification can originate from one. Verified there
-- is no other write path into either table (090 announcements = admin-only,
-- 110 = author_id null system card, 199 = handled in §8).

-- ═══════════════════════════════════════════════════════════════════════════
-- 7. THE ACTIVITY-CARD ENGINE — kid XP/badges stop publishing to the club
-- ═══════════════════════════════════════════════════════════════════════════
-- One early return covers all six triggers (badge award, watchlist insert,
-- watchlist verdict, mission complete, session RSVP, XP level-up). This is a
-- SECURITY DEFINER function, so reading profiles here is free and correct — the
-- constraint about subqueries applies to POLICIES, not to functions.
--
-- Kid achievement is not deleted, it is RELOCATED: it stays on the family
-- surfaces that already render it (the family board, the kid's own progress and
-- badge pages, the household feed slice). No new surface is built here.
--
-- Only the body changes; the signature and all six triggers are untouched.

create or replace function public._feed_activity(
  p_actor uuid,
  p_family uuid,
  p_type text,
  p_icon text,
  p_target text,
  p_detail text,
  p_extra jsonb default '{}'::jsonb
) returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_name text;
  v_avatar text;
  v_role text;
  v_age text;
  v_family_name text;
  v_payload jsonb;
begin
  -- KID WALL (214). An activity card carries the actor's name, avatar and age
  -- band into the shared club feed. A kid's badge, mission, watchlist pick,
  -- RSVP or level-up never becomes a town-square card.
  if p_actor is not null and public.profile_register(p_actor) = 'kid' then
    return;
  end if;

  select display_name, avatar_url, role, age_group
    into v_name, v_avatar, v_role, v_age
  from profiles where id = p_actor;

  select name into v_family_name from families where id = p_family;

  v_payload := jsonb_build_object(
    'type', p_type,
    'icon', p_icon,
    'actor_name', coalesce(v_name, 'A member'),
    'actor_avatar', v_avatar,
    'actor_role', v_role,
    'actor_age_group', v_age,
    'family_name', v_family_name,
    'target', p_target,
    'detail', p_detail
  ) || coalesce(p_extra, '{}'::jsonb);

  insert into feed_posts (author_id, family_id, kind, body, activity_payload)
  values (p_actor, p_family, 'activity', '', v_payload);
end;
$$;

-- ═══════════════════════════════════════════════════════════════════════════
-- 8. THE CHALLENGE ARTIFACT — definer bypass of the 161 wall
-- ═══════════════════════════════════════════════════════════════════════════
-- Same shape as 153's write RPCs (`if coalesce(viewer_is_kid(), false) then …`).
-- The kid KEEPS the artifact, the Day-0 watchlist row, the step completion and
-- the XP — only the shared-feed publication is skipped. The challenge is not
-- degraded for a kid; it just does not broadcast them into the adult club.

create or replace function public.challenge_post_artifact(
  p_day int,
  p_kind text,
  p_body text,
  p_ticker text default null,
  p_company text default null,
  p_payload jsonb default '{}'::jsonb,
  p_post_to_community boolean default true
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid    uuid := auth.uid();
  v_family uuid;
  v_post   uuid;
  v_art    uuid;
  v_step   jsonb;
  v_share  boolean := p_post_to_community;
begin
  if v_uid is null then raise exception 'auth required'; end if;
  if coalesce(trim(p_body), '') = '' then raise exception 'say something about it'; end if;

  -- KID WALL (214). A kid's artifact never becomes a shared-feed post. This
  -- closes the definer bypass of 161's feed_posts INSERT policy.
  if public.kid_feed_readonly() and coalesce(public.viewer_is_kid(), false) then
    v_share := false;
  end if;

  select family_id into v_family from profiles where id = v_uid;

  select id, feed_post_id into v_art, v_post
    from challenge_artifacts where user_id = v_uid and day_no = p_day;

  if v_share and v_post is null then
    insert into feed_posts (author_id, family_id, kind, body)
    values (v_uid, v_family, 'post', left(p_body, 2000))
    returning id into v_post;
  elsif v_share and v_post is not null then
    update feed_posts set body = left(p_body, 2000) where id = v_post;
  end if;

  insert into challenge_artifacts
    (user_id, family_id, day_no, kind, ticker, company_name, body, payload, feed_post_id)
  values (v_uid, v_family, p_day, p_kind, nullif(upper(trim(coalesce(p_ticker, ''))), ''),
          nullif(trim(coalesce(p_company, '')), ''), left(p_body, 4000),
          coalesce(p_payload, '{}'::jsonb), v_post)
  on conflict (user_id, day_no) do update
    set kind = excluded.kind, ticker = excluded.ticker,
        company_name = excluded.company_name, body = excluded.body,
        payload = excluded.payload,
        feed_post_id = coalesce(challenge_artifacts.feed_post_id, excluded.feed_post_id)
  returning id into v_art;

  -- DAY-0 first win: the pick becomes a REAL watchlist row, not a screenshot of
  -- one. "Pick your first watchlist stock" has to leave a watchlist behind or
  -- the mission was theatre. Guarded so a re-post never duplicates the ticker.
  if p_day = 0 and v_family is not null
     and nullif(upper(trim(coalesce(p_ticker, ''))), '') is not null then
    insert into family_watchlist (family_id, company_name, ticker, champion_id, why_we_picked)
    select v_family,
           coalesce(nullif(trim(coalesce(p_company, '')), ''), upper(trim(p_ticker))),
           upper(trim(p_ticker)),
           v_uid,
           left(p_body, 500)
     where not exists (
       select 1 from family_watchlist w
        where w.family_id = v_family and upper(w.ticker) = upper(trim(p_ticker))
     );
  end if;

  v_step := challenge_complete_step(p_day, 'share',
              jsonb_build_object('artifact_id', v_art));

  return jsonb_build_object('ok', true, 'artifact_id', v_art,
                            'feed_post_id', v_post, 'step', v_step);
end;
$$;
grant execute on function public.challenge_post_artifact(int, text, text, text, text, jsonb, boolean)
  to authenticated;

-- ═══════════════════════════════════════════════════════════════════════════
-- 9. THE PUBLISHED COUNTS
-- ═══════════════════════════════════════════════════════════════════════════
-- member_participation() (196) is SECURITY DEFINER, so RLS does not scope it —
-- it would keep counting a kid's feed posts into a number any member can read
-- off a profile page. Kids cannot author kind='post' since 161, so this is zero
-- rows today; it is corrected anyway so the wall does not depend on a second
-- policy staying in force. Only the 'posts' expression changes.

create or replace function public.member_participation(p_user_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'stances', coalesce((
      select count(*)::int from ticker_stances where user_id = p_user_id
    ), 0),
    'bull_stances', coalesce((
      select count(*)::int from ticker_stances
      where user_id = p_user_id and stance = 'bull'
    ), 0),
    'flips', coalesce((
      select count(*)::int from stance_events
      where user_id = p_user_id and is_flip
    ), 0),
    'respect', coalesce((
      select count(*)::int
      from object_reactions r
      join stance_events se on se.id = r.target_id
      where r.target_type = 'stance_event'
        and r.reaction = 'respect'
        and se.user_id = p_user_id
    ), 0),
    'research', coalesce((
      select count(*)::int from research_objects
      where author_id = p_user_id and status = 'published'
    ), 0),
    -- KID WALL (214): kid-authored rows are family-only and are never counted
    -- into a publicly readable participation total.
    'posts', coalesce((
      select count(*)::int from feed_posts
      where author_id = p_user_id and kind = 'post' and author_register <> 'kid'
    ), 0),
    'weeks_active', coalesce((
      select count(distinct date_trunc('week', created_at))::int
      from xp_events where user_id = p_user_id
    ), 0)
  );
$$;

comment on function public.member_participation(uuid) is
  'Participation counts for a member profile (canvas v2, lane M4). Conviction and participation ONLY — no accuracy, no hit-rate, no opinion score. Kid-authored feed rows excluded (214). See the 196 migration header before adding a field.';

grant execute on function public.member_participation(uuid) to authenticated;

-- get_ticker_community_stats() (132) is SECURITY DEFINER and granted to ANON.
-- It publishes counts only (no name, no body), but a kid's post must not move a
-- number on a page a logged-out visitor can read. Same one-clause correction.

create or replace function public.get_ticker_community_stats(p_ticker text)
returns table (
  watching int,
  discussions_week int,
  bull int,
  neutral int,
  bear int,
  positioned int
)
language sql
stable
security definer
set search_path = public
as $$
  with tk as (select upper(p_ticker) as t)
  select
    coalesce((
      select count(*)::int
      from ticker_sentiment ts, tk
      where upper(ts.ticker) = tk.t and ts.vote = 1
    ), 0) as watching,
    coalesce((
      select count(*)::int
      from feed_posts fp, tk
      where tk.t = any (array(select upper(x) from unnest(fp.ticker_tags) x))
        and fp.created_at >= now() - interval '7 days'
        and fp.author_register <> 'kid'
    ), 0) as discussions_week,
    coalesce((
      select count(*)::int from feed_posts fp, tk
      where fp.position = 'bull'
        and tk.t = any (array(select upper(x) from unnest(fp.ticker_tags) x))
        and fp.author_register <> 'kid'
    ), 0) as bull,
    coalesce((
      select count(*)::int from feed_posts fp, tk
      where fp.position = 'neutral'
        and tk.t = any (array(select upper(x) from unnest(fp.ticker_tags) x))
        and fp.author_register <> 'kid'
    ), 0) as neutral,
    coalesce((
      select count(*)::int from feed_posts fp, tk
      where fp.position = 'bear'
        and tk.t = any (array(select upper(x) from unnest(fp.ticker_tags) x))
        and fp.author_register <> 'kid'
    ), 0) as bear,
    coalesce((
      select count(*)::int from feed_posts fp, tk
      where fp.position is not null
        and tk.t = any (array(select upper(x) from unnest(fp.ticker_tags) x))
        and fp.author_register <> 'kid'
    ), 0) as positioned;
$$;

grant execute on function public.get_ticker_community_stats(text) to authenticated, anon;

comment on table feed_posts is
  'The Club feed. SELECT is kid-scoped as of 214: adult/teen rows are club-wide, author_register=''kid'' rows are visible only to their author and their household. Migration 196''s header claimed this was already true of 034/161 — it was not; 034 shipped `using (true)` and 161 walled INSERT only.';
comment on table post_comments is
  'Flat comment threads on feed posts. Kid INSERT is walled by kid_feed_readonly() and SELECT is family-scoped for kid-authored rows (214). Before 214 the INSERT policy was a bare author_id = auth.uid() and SELECT was `using (true)` — this was the live kid-content leak on the Club feed.';
