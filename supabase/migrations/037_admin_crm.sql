-- 037 — Admin CRM / user-activity system
--
-- Read-only aggregation layer for the admin CRM (/admin/crm). All functions are
-- SECURITY DEFINER so they can read across every member's data (bypassing the
-- "own rows only" RLS on the activity tables) WITHOUT loosening any table RLS.
-- Each function gates on profiles.role='admin' internally (same pattern as
-- admin_set_family_tier in 029). No base-table RLS is touched.
--
-- last_seen is a proxy: the newest timestamp across a member's activity sources
-- (xp_events, feed_posts, post_comments, chat_messages, lesson_progress,
-- quiz_attempts, mission_completions, session_rsvps, post_likes, badge_awards).
--
-- Referral tables (referral_codes/referral_events) are intentionally NOT
-- referenced here — another agent owns them; their presence/absence never
-- affects these functions.

-- ── helper indexes (idempotent, tiny tables — safe) ─────────────────────────
create index if not exists idx_xp_events_user       on xp_events (user_id, created_at);
create index if not exists idx_feed_posts_author     on feed_posts (author_id, created_at);
create index if not exists idx_post_comments_author  on post_comments (author_id, created_at);
create index if not exists idx_chat_messages_user    on chat_messages (user_id, created_at);
create index if not exists idx_lesson_progress_user  on lesson_progress (user_id);
create index if not exists idx_quiz_attempts_user    on quiz_attempts (user_id);
create index if not exists idx_mission_compl_user    on mission_completions (user_id);
create index if not exists idx_session_rsvps_user    on session_rsvps (user_id);
create index if not exists idx_post_likes_user       on post_likes (user_id);
create index if not exists idx_badge_awards_user     on badge_awards (user_id);

-- ════════════════════════════════════════════════════════════════════════════
-- admin_notes — CRM-style per-member notes (admin only)
-- ════════════════════════════════════════════════════════════════════════════
create table if not exists admin_notes (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references profiles(id) on delete cascade,
  author_id  uuid references profiles(id) on delete set null,
  note       text not null,
  created_at timestamptz not null default now()
);
create index if not exists idx_admin_notes_user on admin_notes (user_id, created_at desc);

alter table admin_notes enable row level security;

drop policy if exists admin_notes_select on admin_notes;
create policy admin_notes_select on admin_notes for select to authenticated
  using ((select role from profiles where id = auth.uid()) = 'admin');

drop policy if exists admin_notes_insert on admin_notes;
create policy admin_notes_insert on admin_notes for insert to authenticated
  with check (
    (select role from profiles where id = auth.uid()) = 'admin'
    and author_id = auth.uid()
  );

drop policy if exists admin_notes_delete on admin_notes;
create policy admin_notes_delete on admin_notes for delete to authenticated
  using ((select role from profiles where id = auth.uid()) = 'admin');

-- ════════════════════════════════════════════════════════════════════════════
-- admin_member_activity() — one row per member with all aggregate counts +
-- last_seen. Drives the CRM member table and the per-member stats grid.
-- ════════════════════════════════════════════════════════════════════════════
create or replace function admin_member_activity()
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

  select coalesce(
    jsonb_agg(row_to_json(t) order by t.last_seen desc nulls last, t.display_name),
    '[]'::jsonb
  )
  into v_result
  from (
    select
      p.id,
      p.display_name,
      p.email,
      p.avatar_url,
      p.role,
      p.age_group,
      p.track,
      p.family_id,
      f.name as family_name,
      case when exists (
        select 1 from enrollments e
        where e.family_id = p.family_id and e.program = 'fta' and e.status = 'active'
      ) then 'fta' else 'fic' end as tier,
      p.onboarding_complete,
      p.created_at as joined_at,
      coalesce(xp.xp_total, 0)          as xp_total,
      coalesce(lp.lessons_completed, 0) as lessons_completed,
      coalesce(qa.quizzes_taken, 0)     as quizzes_taken,
      coalesce(qa.quizzes_passed, 0)    as quizzes_passed,
      coalesce(fp.posts, 0)             as posts,
      coalesce(pc.comments, 0)          as comments,
      coalesce(mc.missions, 0)          as missions,
      coalesce(wl.watchlist_adds, 0)    as watchlist_adds,
      coalesce(rs.rsvps, 0)             as rsvps,
      coalesce(ba.badges, 0)            as badges,
      coalesce(cm.chat_messages, 0)     as chat_messages,
      greatest(
        xp.last_at, lp.last_at, qa.last_at, fp.last_at, pc.last_at,
        mc.last_at, rs.last_at, cm.last_at, pl.last_at, ba.last_at, wl.last_at
      ) as last_seen
    from profiles p
    left join families f on f.id = p.family_id
    left join (select user_id, sum(amount) xp_total, max(created_at) last_at
                 from xp_events group by user_id) xp on xp.user_id = p.id
    left join (select user_id,
                      count(*) filter (where status = 'completed' or completed_at is not null) lessons_completed,
                      max(updated_at) last_at
                 from lesson_progress group by user_id) lp on lp.user_id = p.id
    left join (select user_id, count(*) quizzes_taken,
                      count(*) filter (where passed) quizzes_passed,
                      max(created_at) last_at
                 from quiz_attempts group by user_id) qa on qa.user_id = p.id
    left join (select author_id, count(*) posts, max(created_at) last_at
                 from feed_posts group by author_id) fp on fp.author_id = p.id
    left join (select author_id, count(*) comments, max(created_at) last_at
                 from post_comments group by author_id) pc on pc.author_id = p.id
    left join (select user_id, count(*) missions, max(completed_at) last_at
                 from mission_completions group by user_id) mc on mc.user_id = p.id
    left join (select champion_id, count(*) watchlist_adds, max(created_at) last_at
                 from family_watchlist where champion_id is not null
                 group by champion_id) wl on wl.champion_id = p.id
    left join (select user_id, count(*) rsvps, max(created_at) last_at
                 from session_rsvps group by user_id) rs on rs.user_id = p.id
    left join (select user_id, count(*) badges, max(awarded_at) last_at
                 from badge_awards group by user_id) ba on ba.user_id = p.id
    left join (select user_id, count(*) chat_messages, max(created_at) last_at
                 from chat_messages group by user_id) cm on cm.user_id = p.id
    left join (select user_id, max(created_at) last_at
                 from post_likes group by user_id) pl on pl.user_id = p.id
  ) t;

  return v_result;
end;
$$;
grant execute on function admin_member_activity() to authenticated;

-- ════════════════════════════════════════════════════════════════════════════
-- admin_daily_activity(p_days) — daily rollup for the overview charts.
-- Every day in the window is present (0-filled) so bars render evenly.
-- ════════════════════════════════════════════════════════════════════════════
create or replace function admin_daily_activity(p_days int default 30)
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

  with days as (
    select gs::date as day
    from generate_series(current_date - (greatest(p_days,1) - 1), current_date, interval '1 day') gs
  ),
  ev as (
    select user_id, created_at::date as day from xp_events
    union all select author_id, created_at::date from feed_posts
    union all select author_id, created_at::date from post_comments
    union all select user_id,   created_at::date from chat_messages
    union all select user_id,   updated_at::date from lesson_progress
    union all select user_id,   created_at::date from quiz_attempts
    union all select user_id,   completed_at::date from mission_completions
    union all select user_id,   created_at::date from session_rsvps
    union all select user_id,   created_at::date from post_likes
  ),
  active as (select day, count(distinct user_id) active_users from ev group by day),
  signups as (select created_at::date as day, count(*) as signups from profiles group by created_at::date),
  posts as (select created_at::date as day, count(*) as posts from feed_posts group by created_at::date),
  lessons as (select completed_at::date as day, count(*) as lessons_completed
                from lesson_progress where completed_at is not null group by completed_at::date)
  select coalesce(jsonb_agg(row_to_json(t) order by t.day), '[]'::jsonb)
  into v_result
  from (
    select d.day,
           coalesce(a.active_users, 0)      as active_users,
           coalesce(s.signups, 0)           as signups,
           coalesce(po.posts, 0)            as posts,
           coalesce(le.lessons_completed,0) as lessons_completed
    from days d
    left join active  a  on a.day  = d.day
    left join signups s  on s.day  = d.day
    left join posts   po on po.day = d.day
    left join lessons le on le.day = d.day
  ) t;

  return v_result;
end;
$$;
grant execute on function admin_daily_activity(int) to authenticated;

-- ════════════════════════════════════════════════════════════════════════════
-- admin_crm_overview() — topline dashboard object (counts, tier split, DAU/WAU/
-- MAU, newest signups, most-active families this week, at-risk members).
-- ════════════════════════════════════════════════════════════════════════════
create or replace function admin_crm_overview()
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

  with ev as (
    select user_id, created_at as ts from xp_events
    union all select author_id, created_at from feed_posts
    union all select author_id, created_at from post_comments
    union all select user_id,   created_at from chat_messages
    union all select user_id,   updated_at from lesson_progress
    union all select user_id,   created_at from quiz_attempts
    union all select user_id,   completed_at from mission_completions
    union all select user_id,   created_at from session_rsvps
    union all select user_id,   created_at from post_likes
  ),
  ls as (select user_id, max(ts) last_at from ev group by user_id),
  ft as (
    select f.id as family_id, f.name,
           case when exists (
             select 1 from enrollments e
             where e.family_id = f.id and e.program = 'fta' and e.status = 'active'
           ) then 'fta' else 'fic' end tier
    from families f
  )
  select jsonb_build_object(
    'total_members',  (select count(*) from profiles),
    'total_families', (select count(*) from families),
    'tier_fic',       (select count(*) from ft where tier = 'fic'),
    'tier_fta',       (select count(*) from ft where tier = 'fta'),
    'members_fic',    (select count(*) from profiles p left join ft on ft.family_id = p.family_id where coalesce(ft.tier,'fic') = 'fic'),
    'members_fta',    (select count(*) from profiles p join ft on ft.family_id = p.family_id where ft.tier = 'fta'),
    'dau', (select count(distinct user_id) from ev where ts >= now() - interval '1 day'),
    'wau', (select count(distinct user_id) from ev where ts >= now() - interval '7 days'),
    'mau', (select count(distinct user_id) from ev where ts >= now() - interval '30 days'),
    'newest_signups', (
      select coalesce(jsonb_agg(row_to_json(n) order by n.joined_at desc), '[]'::jsonb)
      from (
        select p.id, p.display_name, p.avatar_url, p.role,
               ft.name as family_name, coalesce(ft.tier,'fic') tier, p.created_at as joined_at
        from profiles p left join ft on ft.family_id = p.family_id
        order by p.created_at desc limit 8
      ) n
    ),
    'active_families', (
      select coalesce(jsonb_agg(row_to_json(af) order by af.events_7d desc, af.name), '[]'::jsonb)
      from (
        select ft.family_id, ft.name, ft.tier,
               count(distinct e.user_id) as active_members,
               count(*) as events_7d
        from ft
        join profiles p on p.family_id = ft.family_id
        join ev e on e.user_id = p.id and e.ts >= now() - interval '7 days'
        group by ft.family_id, ft.name, ft.tier
        order by events_7d desc limit 6
      ) af
    ),
    'at_risk', (
      select coalesce(jsonb_agg(row_to_json(ar) order by ar.last_seen asc nulls first), '[]'::jsonb)
      from (
        select p.id, p.display_name, p.avatar_url, ft.name as family_name,
               p.role, ls.last_at as last_seen, p.created_at as joined_at
        from profiles p
        left join ft on ft.family_id = p.family_id
        left join ls on ls.user_id = p.id
        where p.role in ('parent','child')
          and (
            (ls.last_at is not null and ls.last_at < now() - interval '14 days')
            or (ls.last_at is null and p.created_at < now() - interval '14 days')
          )
        order by ls.last_at asc nulls first
        limit 25
      ) ar
    )
  ) into v_result;

  return v_result;
end;
$$;
grant execute on function admin_crm_overview() to authenticated;

-- ════════════════════════════════════════════════════════════════════════════
-- admin_member_timeline(p_user_id, p_limit) — merged, typed recent activity
-- across all sources for the member-detail timeline.
-- ════════════════════════════════════════════════════════════════════════════
create or replace function admin_member_timeline(p_user_id uuid, p_limit int default 40)
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

  select coalesce(jsonb_agg(row_to_json(t) order by t.ts desc), '[]'::jsonb)
  into v_result
  from (
    select * from (
      select 'xp' as type, x.created_at as ts,
             ('+' || x.amount || ' XP · ' || x.kind) as title, x.ref_id as meta
        from xp_events x where x.user_id = p_user_id
      union all
      select 'lesson', lp.updated_at,
             coalesce(l.title, 'Lesson') || ' · ' || coalesce(lp.status, 'in progress'),
             lp.status
        from lesson_progress lp left join lessons l on l.id = lp.lesson_id
        where lp.user_id = p_user_id
      union all
      select 'quiz', qa.created_at,
             'Quiz ' || case when qa.passed then 'passed' else 'attempted' end
               || ' · ' || coalesce(qa.score, 0) || '%',
             null
        from quiz_attempts qa where qa.user_id = p_user_id
      union all
      select 'post', fp.created_at,
             'Posted' || case when fp.body is not null and length(fp.body) > 0
                              then ': ' || left(fp.body, 90) else '' end,
             fp.kind
        from feed_posts fp where fp.author_id = p_user_id
      union all
      select 'comment', pc.created_at, 'Commented: ' || left(coalesce(pc.body, ''), 90), null
        from post_comments pc where pc.author_id = p_user_id
      union all
      select 'mission', mc.completed_at,
             'Completed mission' || coalesce(' · ' || m.title, ''), null
        from mission_completions mc left join fic_missions m on m.id = mc.mission_id
        where mc.user_id = p_user_id
      union all
      select 'rsvp', rs.created_at, 'RSVP' || coalesce(' · ' || s.title, ''), null
        from session_rsvps rs left join live_sessions s on s.id = rs.session_id
        where rs.user_id = p_user_id
      union all
      select 'badge', ba.awarded_at, 'Earned badge' || coalesce(' · ' || b.title, ''), b.slug
        from badge_awards ba left join badges b on b.id = ba.badge_id
        where ba.user_id = p_user_id
      union all
      select 'chat', cm.created_at, 'Chat: ' || left(coalesce(cm.content, ''), 90), cm.category
        from chat_messages cm where cm.user_id = p_user_id
    ) u
    where u.ts is not null
    order by u.ts desc
    limit greatest(p_limit, 1)
  ) t;

  return v_result;
end;
$$;
grant execute on function admin_member_timeline(uuid, int) to authenticated;

-- ════════════════════════════════════════════════════════════════════════════
-- admin_family_detail(p_family_id) — family-as-account view: family + tier,
-- enrollments, members (with per-member xp + last_seen), orientation steps,
-- watchlist, and combined activity totals.
-- ════════════════════════════════════════════════════════════════════════════
create or replace function admin_family_detail(p_family_id uuid)
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
    'family', (
      select jsonb_build_object(
        'id', f.id, 'name', f.name, 'plan_tier', f.plan_tier,
        'tier', case when exists (
                  select 1 from enrollments e
                  where e.family_id = f.id and e.program = 'fta' and e.status = 'active'
                ) then 'fta' else 'fic' end,
        'created_at', f.created_at, 'enrolled_at', f.enrolled_at,
        'expires_at', f.expires_at, 'has_stripe', f.stripe_customer_id is not null
      )
      from families f where f.id = p_family_id
    ),
    'enrollments', (
      select coalesce(jsonb_agg(jsonb_build_object(
               'program', e.program, 'status', e.status,
               'started_at', e.started_at, 'cohort', c.name) order by e.created_at), '[]'::jsonb)
      from enrollments e left join cohorts c on c.id = e.cohort_id
      where e.family_id = p_family_id
    ),
    'members', (
      select coalesce(jsonb_agg(row_to_json(m) order by
               case m.role when 'parent' then 0 when 'child' then 1 else 2 end, m.display_name), '[]'::jsonb)
      from (
        select p.id, p.display_name, p.avatar_url, p.role, p.age_group, p.email,
               coalesce((select sum(amount) from xp_events x where x.user_id = p.id), 0) as xp_total,
               (select max(ts) from (
                   select created_at ts from xp_events where user_id = p.id
                   union all select updated_at from lesson_progress where user_id = p.id
                   union all select created_at from feed_posts where author_id = p.id
                   union all select created_at from post_comments where author_id = p.id
                   union all select created_at from chat_messages where user_id = p.id
                   union all select created_at from session_rsvps where user_id = p.id
                   union all select completed_at from mission_completions where user_id = p.id
               ) e) as last_seen
        from profiles p where p.family_id = p_family_id
      ) m
    ),
    'orientation', (
      select coalesce(jsonb_agg(jsonb_build_object(
               'step_key', step_key, 'completed_at', completed_at) order by completed_at), '[]'::jsonb)
      from orientation_progress where family_id = p_family_id
    ),
    'watchlist', (
      select coalesce(jsonb_agg(jsonb_build_object(
               'ticker', w.ticker, 'company_name', w.company_name,
               'status', w.status, 'champion', ch.display_name) order by w.created_at desc), '[]'::jsonb)
      from family_watchlist w left join profiles ch on ch.id = w.champion_id
      where w.family_id = p_family_id
    ),
    'combined', jsonb_build_object(
      'xp_total', (select coalesce(sum(amount),0) from xp_events x join profiles p on p.id = x.user_id where p.family_id = p_family_id),
      'lessons',  (select count(*) from lesson_progress lp join profiles p on p.id = lp.user_id
                    where p.family_id = p_family_id and (lp.status = 'completed' or lp.completed_at is not null)),
      'quizzes',  (select count(*) from quiz_attempts qa join profiles p on p.id = qa.user_id where p.family_id = p_family_id),
      'posts',    (select count(*) from feed_posts fp where fp.family_id = p_family_id),
      'missions', (select count(*) from mission_completions mc where mc.family_id = p_family_id),
      'rsvps',    (select count(*) from session_rsvps rs where rs.family_id = p_family_id),
      'watchlist_size', (select count(*) from family_watchlist w where w.family_id = p_family_id)
    )
  ) into v_result;

  return v_result;
end;
$$;
grant execute on function admin_family_detail(uuid) to authenticated;
