-- ════════════════════════════════════════════════════════════════════════════
-- 217 — BOOT RPCs: one round trip per surface instead of a query storm
--
-- THE PROBLEM THIS SOLVES. Every HTTP round trip to PostgREST costs 50–100ms
-- from the app's vantage point; a join inside Postgres costs microseconds. Three
-- surfaces were paying the first price over and over for data that is one join
-- away from itself:
--
--   • /dashboard  — the (dashboard) layout, resolveHomeRoute and buildTodayLoop
--                   each independently read the profile's family_id and then
--                   fanned out: family_tiers, enrollments (twice, for two
--                   different programs), challenge_vips, family_profiles, a
--                   member count, families.door, get_home_state, xp_for_users,
--                   the streak's xp_events scan, flashcard_reviews,
--                   watch_current_state, and a two-query course-progress read.
--                   ~17 round trips for one page.
--   • /courses    — auth → profiles → family_tiers → (courses+lesson_progress).
--                   FOUR SERIAL hops, and the fourth pulled the ENTIRE
--                   curriculum for both programs (every module, every lesson)
--                   across the wire so the browser could count it.
--   • /community  — auth → profiles → family_tiers → family roster →
--                   chat_messages count → two global counts.
--
-- ADDITIVE ONLY. Nothing here alters a table, a column, a policy or an existing
-- function: three new functions and four `if not exists` indexes.
--
-- WHY SECURITY DEFINER. It is the house pattern for every JSON-returning RPC in
-- this repo (xp_for_users 118, get_changed_minds 190, get_community_board 097,
-- club_debate_state 153, get_home_state 030, viewer_door 216) and it is REQUIRED
-- here: xp_events RLS (020) scopes reads to the caller's own family, and the
-- `family_tiers` view is itself an owner-rights view for the same reason.
--
-- WHY THAT IS SAFE. None of these functions takes a user id. Every one of them
-- derives the subject from `auth.uid()` and returns NULL when there is no
-- session, so there is no argument a caller can pass to ask about somebody else.
-- Each read below is scoped to that member or to their own family, EXCEPT the
-- two deliberately global sidebar counts in get_community_chat_boot (how many
-- families / how many members exist), which are the same two `head:true` counts
-- the surface already ran unscoped under RLS.
--
-- Because a DEFINER function bypasses RLS, every wall the policies were doing
-- silently is restated here as an explicit predicate — `courses.published`,
-- `lessons.retired = false` (202), `alert_rules.user_id` behind
-- watch_current_state, `notifications.user_id`. Those restatements are the
-- load-bearing part of this file; read them as the policies they stand in for.
-- ════════════════════════════════════════════════════════════════════════════


-- ── Indexes the boot reads lean on ──────────────────────────────────────────
-- All four are `if not exists` and additive. They matter because the boot RPCs
-- turn what used to be several selective REST queries into one plan.

create index if not exists idx_xp_events_user_created
  on public.xp_events (user_id, created_at desc);

create index if not exists idx_flashcard_reviews_user_due
  on public.flashcard_reviews (user_id, due_at);

create index if not exists idx_lesson_progress_user_status
  on public.lesson_progress (user_id, status);

create index if not exists idx_notifications_user_unread
  on public.notifications (user_id)
  where read_at is null;


-- ════════════════════════════════════════════════════════════════════════════
-- get_home_boot(p_tz_offset_minutes int) — EVERYTHING /dashboard needs, once
--
-- p_tz_offset_minutes is `new Date().getTimezoneOffset()` from the rendering
-- server, and it exists for ONE reason: the streak is defined in LOCAL calendar
-- days (src/lib/streak.ts), and a member in UTC-8 acting at 6pm must not have it
-- counted as tomorrow. JS reports minutes to ADD to local time to reach UTC, so
-- local = utc - offset, which is exactly the shift applied below. Passing 0
-- degrades to UTC days — the correct answer on Vercel, where the runtime is UTC.
-- ════════════════════════════════════════════════════════════════════════════
create or replace function public.get_home_boot(p_tz_offset_minutes int default 0)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid          uuid := auth.uid();
  v_profile      record;
  v_family_id    uuid;
  v_tier         record;
  v_today        date;
  v_start        date;
  v_streak       int  := 0;
  v_acted        boolean := false;
  v_state        jsonb;
  v_slug         text;
  v_prog         record;
begin
  if v_uid is null then
    return null;
  end if;

  select p.id, p.role, p.age_group, p.track, p.display_name, p.avatar_url,
         p.onboarding_complete, p.family_id, p.username
    into v_profile
    from profiles p
   where p.id = v_uid;

  if not found then
    return null;
  end if;

  v_family_id := v_profile.family_id;

  -- family_tiers is the owner-rights view (029 → 127): tier + the Club clock.
  select t.tier, t.club_lapsed into v_tier
    from family_tiers t
   where t.family_id = v_family_id;

  -- ── THE STREAK, in local calendar days ────────────────────────────────────
  -- Consecutive days ending today or yesterday on which this member earned XP.
  -- A day that is still young does not break a streak, which is why the walk
  -- starts at yesterday when today is empty. Same definition as computeStreak().
  v_today := ((now() at time zone 'UTC') - make_interval(mins => p_tz_offset_minutes))::date;

  with days as (
    select distinct
      (((x.created_at at time zone 'UTC') - make_interval(mins => p_tz_offset_minutes))::date) as d
    from xp_events x
    where x.user_id = v_uid
      and x.amount > 0
      and x.created_at >= now() - interval '400 days'
  )
  select exists (select 1 from days where d = v_today) into v_acted;

  v_start := case when v_acted then v_today else v_today - 1 end;

  -- Gaps and islands: walking down the distinct days, `d + rank` stays constant
  -- for exactly the unbroken prefix and can only fall after the first gap — so
  -- counting the rows where it still equals the start IS the streak length.
  with days as (
    select distinct
      (((x.created_at at time zone 'UTC') - make_interval(mins => p_tz_offset_minutes))::date) as d
    from xp_events x
    where x.user_id = v_uid
      and x.amount > 0
      and x.created_at >= now() - interval '400 days'
  ),
  walk as (
    select d, row_number() over (order by d desc) as rn
      from days
     where d <= v_start
  )
  select count(*)::int into v_streak
    from walk
   where d = v_start - (rn - 1)::int;

  -- ── The member's next lesson, and how far through its course they are ─────
  v_state := public.get_home_state(v_uid);
  v_slug := v_state -> 'today' ->> 'course_slug';

  if v_slug is not null then
    -- RESTATED POLICIES: `courses.published` (039) and `lessons.retired = false`
    -- (202) are RLS predicates the session-scoped read got for free. A DEFINER
    -- function bypasses them, so a retired lesson would silently inflate the
    -- denominator on Home unless they are spelled out here.
    select count(*)::int as total,
           count(*) filter (where lp.lesson_id is not null)::int as done
      into v_prog
      from lessons l
      join modules m on m.id = l.module_id
      join courses c on c.id = m.course_id
      left join lesson_progress lp
        on lp.lesson_id = l.id
       and lp.user_id = v_uid
       and lp.status = 'completed'
     where c.slug = v_slug
       and c.published = true
       and l.retired = false;
  end if;

  return jsonb_build_object(
    'profile', jsonb_build_object(
      'id', v_profile.id,
      'role', v_profile.role,
      'age_group', v_profile.age_group,
      'track', v_profile.track,
      'display_name', v_profile.display_name,
      'avatar_url', v_profile.avatar_url,
      'username', v_profile.username,
      'onboarding_complete', v_profile.onboarding_complete,
      'family_id', v_profile.family_id
    ),
    'family', jsonb_build_object(
      'id', v_family_id,
      -- THE DOOR (215). Null-safe by construction: no family resolves to
      -- 'club' in the app, and the app keeps that fallback.
      'door', (select f.door from families f where f.id = v_family_id),
      -- No family, or no row, reads as 'fic' — the same default
      -- getFamilyTierState() returns.
      'tier', coalesce(v_tier.tier, 'fic'),
      'club_lapsed', coalesce(v_tier.club_lapsed, false),
      -- The date the Club window closed, for the lapsed banner's copy: the
      -- earliest club_until across active fta enrollments.
      'club_until', (
        select min(e.club_until) from enrollments e
         where e.family_id = v_family_id
           and e.program = 'fta'
           and e.status = 'active'
           and e.club_until is not null
      ),
      -- An active 5-Day Challenge pass window (C7).
      'challenge_expires_at', (
        select max(e.expires_at) from enrollments e
         where e.family_id = v_family_id
           and e.program = 'challenge_pass'
           and e.status = 'active'
           and e.expires_at is not null
           and e.expires_at > now()
      ),
      'is_vip', exists (
        select 1 from challenge_vips v where v.family_id = v_family_id
      ),
      -- The signup questionnaire, which may only BREAK A TIE about solo status…
      'household', (
        select fp.household from family_profiles fp where fp.family_id = v_family_id
      ),
      'household_completed_at', (
        select fp.completed_at from family_profiles fp where fp.family_id = v_family_id
      ),
      -- …because membership is the fact that decides it (isSoloAccount).
      'member_count', (
        select count(*)::int from profiles p2 where p2.family_id = v_family_id
      )
    ),
    'home_state', v_state,
    -- Lifetime XP. The grouped SUM, not a client-side sum over a page of rows:
    -- PostgREST's max-rows cap would silently under-report a long-standing
    -- member's belt (the reason xp_for_users exists at all, migration 118).
    'xp', coalesce((select sum(x.amount) from xp_events x where x.user_id = v_uid), 0),
    'streak', jsonb_build_object('days', v_streak, 'acted_today', v_acted),
    'course_progress', case
      when v_slug is null or coalesce(v_prog.total, 0) = 0 then null
      else jsonb_build_object('slug', v_slug, 'done', v_prog.done, 'total', v_prog.total)
    end,
    -- The real SRS queue, not "5".
    'cards_due', (
      select count(*)::int from flashcard_reviews fr
       where fr.user_id = v_uid and fr.due_at <= v_today
    ),
    -- RESTATED POLICY: watch_current_state is a plain view; what scoped it to
    -- this member was watch_states' RLS joining alert_rules.user_id. A DEFINER
    -- read bypasses that, so the join is explicit.
    'watch_triggered', (
      select count(*)::int
        from watch_current_state w
        join alert_rules r on r.id = w.rule_id
       where w.state = 'triggered' and r.user_id = v_uid
    ),
    -- RESTATED POLICY: notifications is own-rows-only (028).
    'unread_notifications', (
      select count(*)::int from notifications n
       where n.user_id = v_uid and n.read_at is null
    ),
    -- The family's watched names — the input For-You is keyed on.
    'watchlist', coalesce((
      select jsonb_agg(distinct upper(w.ticker))
        from family_watchlist w
       where w.family_id = v_family_id and w.ticker is not null
    ), '[]'::jsonb)
  );
end;
$$;

comment on function public.get_home_boot(int) is
  'Everything /dashboard needs to boot, in ONE round trip: profile, family tier '
  '+ Club clock + door + solo inputs, next lesson and its course progress, '
  'lifetime XP, streak, cards due, triggered watches, unread notifications and '
  'the family watchlist. Subject is always auth.uid() — there is no argument '
  'that can name another member. p_tz_offset_minutes is the caller''s '
  'getTimezoneOffset(), because the streak is defined in LOCAL calendar days.';

revoke all on function public.get_home_boot(int) from public;
grant execute on function public.get_home_boot(int) to authenticated;


-- ════════════════════════════════════════════════════════════════════════════
-- get_courses_boot() — the catalogue, already counted
--
-- /courses was shipping the entire curriculum — every module and every lesson of
-- both programs — to the browser so it could count lessons and find the first
-- incomplete one. The counting is the only thing it wanted; it happens here now,
-- and the wire carries one small row per course instead of the whole tree.
--
-- WHAT STAYS IN TYPESCRIPT, deliberately: register → track (trackForRegister),
-- which courses a register may SEE (canSeeCourse) and the tier gate
-- (canAccessCourse). Those rules are shared by the catalogue, the lesson guard
-- and /progress; re-expressing them in SQL would be a second copy to keep in
-- sync. This function hands back exactly the two facts canSeeCourse turns on —
-- `program` and `tracks` — and leaves the verdict where it already lives.
--
-- TWO AGGREGATE FLAVOURS, because the page genuinely uses two: the FIC cards are
-- counted over TRACKED modules only (the page filters `modules.filter(m =>
-- m.track)` before counting), while the FTA card is counted over ALL of its
-- modules. Returning both keeps the numbers byte-identical to the client's.
-- ════════════════════════════════════════════════════════════════════════════
create or replace function public.get_courses_boot()
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid       uuid := auth.uid();
  v_profile   record;
  v_tier      text;
begin
  if v_uid is null then
    return null;
  end if;

  select p.role, p.age_group, p.track, p.family_id
    into v_profile
    from profiles p
   where p.id = v_uid;

  select coalesce(t.tier, 'fic') into v_tier
    from family_tiers t
   where t.family_id = v_profile.family_id;

  return jsonb_build_object(
    'profile', jsonb_build_object(
      'role', v_profile.role,
      'age_group', v_profile.age_group,
      'track', v_profile.track,
      'family_id', v_profile.family_id
    ),
    -- getFamilyTier() semantics: no family, or no row, reads as 'fic'.
    'tier', coalesce(v_tier, 'fic'),
    'courses', coalesce((
      select jsonb_agg(card order by card_sort, card_slug)
      from (
        select
          c.sort_order as card_sort,
          c.slug       as card_slug,
          jsonb_build_object(
            'id', c.id,
            'slug', c.slug,
            'title', c.title,
            'description', c.description,
            'program', c.program,
            'sort_order', c.sort_order,
            -- Every module track on the course — the input canSeeCourse reads.
            'tracks', coalesce((
              select jsonb_agg(m.track order by m.sort_order, m.id)
                from modules m
               where m.course_id = c.id and m.track is not null
            ), '[]'::jsonb),
            -- The course's own track label for the free-tier locked card: the
            -- first tracked module, matching the client's `tracked[0].track`.
            'course_track', (
              select m.track from modules m
               where m.course_id = c.id and m.track is not null
               order by m.sort_order, m.id limit 1
            ),
            'has_tracked_modules', exists (
              select 1 from modules m where m.course_id = c.id and m.track is not null
            ),
            -- Counted over ALL modules (the FTA card's flavour).
            'total', (
              select count(*)::int from lessons l
                join modules m on m.id = l.module_id
               where m.course_id = c.id and l.retired = false
            ),
            'done', (
              select count(*)::int from lessons l
                join modules m on m.id = l.module_id
                join lesson_progress lp
                  on lp.lesson_id = l.id and lp.user_id = v_uid and lp.status = 'completed'
               where m.course_id = c.id and l.retired = false
            ),
            'next', (
              select jsonb_build_object('moduleId', m.id, 'lessonId', l.id, 'title', l.title)
                from lessons l
                join modules m on m.id = l.module_id
               where m.course_id = c.id
                 and l.retired = false
                 and not exists (
                   select 1 from lesson_progress lp
                    where lp.lesson_id = l.id and lp.user_id = v_uid and lp.status = 'completed'
                 )
               order by m.sort_order, m.id, l.sort_order, l.id
               limit 1
            ),
            -- Counted over TRACKED modules only (the FIC cards' flavour).
            'tracked_total', (
              select count(*)::int from lessons l
                join modules m on m.id = l.module_id
               where m.course_id = c.id and m.track is not null and l.retired = false
            ),
            'tracked_done', (
              select count(*)::int from lessons l
                join modules m on m.id = l.module_id
                join lesson_progress lp
                  on lp.lesson_id = l.id and lp.user_id = v_uid and lp.status = 'completed'
               where m.course_id = c.id and m.track is not null and l.retired = false
            ),
            'tracked_next', (
              select jsonb_build_object('moduleId', m.id, 'lessonId', l.id, 'title', l.title)
                from lessons l
                join modules m on m.id = l.module_id
               where m.course_id = c.id
                 and m.track is not null
                 and l.retired = false
                 and not exists (
                   select 1 from lesson_progress lp
                    where lp.lesson_id = l.id and lp.user_id = v_uid and lp.status = 'completed'
                 )
               order by m.sort_order, m.id, l.sort_order, l.id
               limit 1
            ),
            -- FREE TIER: the sampler lessons, and how much is behind the wall.
            'free_lessons', coalesce((
              select jsonb_agg(
                       jsonb_build_object(
                         'courseSlug', c.slug, 'moduleId', m.id, 'lessonId', l.id,
                         'title', l.title, 'track', m.track
                       )
                       order by m.sort_order, m.id, l.sort_order, l.id
                     )
                from lessons l
                join modules m on m.id = l.module_id
               where m.course_id = c.id
                 and m.track is not null
                 and l.retired = false
                 and l.is_free = true
            ), '[]'::jsonb),
            'locked_count', (
              select count(*)::int from lessons l
                join modules m on m.id = l.module_id
               where m.course_id = c.id
                 and m.track is not null
                 and l.retired = false
                 and coalesce(l.is_free, false) = false
            )
          ) as card
        from courses c
        -- RESTATED POLICY: `courses.published = true` (039).
        where c.published = true
          and c.program in ('fic', 'fta')
      ) cards
    ), '[]'::jsonb)
  );
end;
$$;

comment on function public.get_courses_boot() is
  'The /courses catalogue in ONE round trip, already counted: per course the '
  'module tracks, lesson totals/completions and the next incomplete lesson — '
  'in two flavours (all modules, and tracked modules only) because the page '
  'counts FTA over all of them and FIC over the tracked ones. Progress is '
  'always auth.uid()''s. Register-visibility (canSeeCourse) and the tier gate '
  'stay in TypeScript so there is one copy of those rules, not two.';

revoke all on function public.get_courses_boot() from public;
grant execute on function public.get_courses_boot() to authenticated;


-- ════════════════════════════════════════════════════════════════════════════
-- get_community_chat_boot() — the chat's opening state, once
--
-- Replaces the surface's serial chain: profile → family_tiers → the family's
-- roster of profile ids → a chat_messages count over that roster → two global
-- sidebar counts. Five to six round trips before the first room could be picked.
-- ════════════════════════════════════════════════════════════════════════════
create or replace function public.get_community_chat_boot()
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid     uuid := auth.uid();
  v_profile record;
  v_tier    text;
begin
  if v_uid is null then
    return null;
  end if;

  select p.display_name, p.role, p.age_group, p.family_id, p.avatar_url, p.username
    into v_profile
    from profiles p
   where p.id = v_uid;

  select coalesce(t.tier, 'fic') into v_tier
    from family_tiers t
   where t.family_id = v_profile.family_id;

  return jsonb_build_object(
    'me', case when v_profile is null then null else jsonb_build_object(
      'id', v_uid,
      'display_name', v_profile.display_name,
      'role', v_profile.role,
      'age_group', v_profile.age_group,
      'family_id', v_profile.family_id,
      'avatar_url', v_profile.avatar_url,
      'username', v_profile.username
    ) end,
    -- getFamilyTier() semantics, unchanged: no family / no row reads as 'fic'.
    'tier', coalesce(v_tier, 'fic'),
    -- First-post welcome: this household has not said anything yet.
    'needs_welcome', (
      v_profile.family_id is not null
      and not exists (
        select 1 from chat_messages cm
          join profiles p2 on p2.id = cm.user_id
         where p2.family_id = v_profile.family_id
      )
    ),
    -- The two DELIBERATELY GLOBAL sidebar counts — the same unscoped
    -- `head:true` counts the surface already ran, and the only reads in this
    -- file that are not scoped to the caller or their family.
    'stats', jsonb_build_object(
      'families', (select count(*)::int from families),
      'members',  (select count(*)::int from profiles)
    )
  );
end;
$$;

comment on function public.get_community_chat_boot() is
  'The /community chat''s opening state in ONE round trip: the viewer, their '
  'family tier (which decides the room rail), whether the household still needs '
  'the first-post welcome, and the two global sidebar counts. Subject is always '
  'auth.uid().';

revoke all on function public.get_community_chat_boot() from public;
grant execute on function public.get_community_chat_boot() to authenticated;
