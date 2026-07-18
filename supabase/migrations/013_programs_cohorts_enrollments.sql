-- ============================================
-- Programs layer: FIC (foundations) vs FTA (advanced ICT live program)
-- + cohorts, family-level enrollments, and the get_home_state resolver.
--
-- Model:
--   courses.program  'fic' = foundations library (textbook / kids workbook / teens)
--                    'fta' = 6-week ICT execution curriculum (live classes + drills)
--                    NULL  = legacy catalog (hidden from program UIs)
--   FTA enrollment implies FIC-foundations access.
--   Drip anchor: FTA -> cohort.start_date; FIC -> evergreen (no drip gate).
--   lessons.drip_week on FIC content = which FTA cohort week it belongs to
--   (FIC-only members ignore drip_week entirely).
-- ============================================

-- 1. Program tag on courses
alter table courses add column if not exists program text check (program in ('fic', 'fta'));
create index if not exists idx_courses_program on courses(program);

-- 2. Teens become a first-class content track
alter table modules drop constraint if exists modules_track_check;
alter table modules add constraint modules_track_check
  check (track in ('kids', 'teens', 'adults'));

alter table profiles drop constraint if exists profiles_track_check;
alter table profiles add constraint profiles_track_check
  check (track in ('kids', 'teens', 'adults'));

-- 3. Cohorts
create table if not exists cohorts (
  id uuid primary key default uuid_generate_v4(),
  program text not null default 'fta' check (program in ('fic', 'fta')),
  name text not null,
  start_date date not null,
  weeks int not null default 6,
  created_at timestamptz not null default now()
);

-- 4. Family-level enrollments
create table if not exists enrollments (
  id uuid primary key default uuid_generate_v4(),
  family_id uuid not null references families(id) on delete cascade,
  program text not null check (program in ('fic', 'fta')),
  cohort_id uuid references cohorts(id) on delete set null,
  status text not null default 'active' check (status in ('active', 'completed', 'cancelled')),
  started_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (family_id, program)
);
create index if not exists idx_enrollments_family on enrollments(family_id);

alter table cohorts enable row level security;
alter table enrollments enable row level security;

drop policy if exists "Authenticated read cohorts" on cohorts;
create policy "Authenticated read cohorts"
  on cohorts for select to authenticated using (true);

drop policy if exists "Family members read own enrollments" on enrollments;
create policy "Family members read own enrollments"
  on enrollments for select to authenticated
  using (family_id in (select family_id from profiles where id = auth.uid()));

-- 5. Home-state resolver
-- Returns everything the role-gated home needs in one call:
--   program, cohort week, "today's one thing" (next incomplete foundation
--   lesson in unlocked weeks), foundation progress counts, and for FTA the
--   current week's execution module (live class + drill) with per-lesson
--   completion.
create or replace function get_home_state(p_user_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_profile record;
  v_enrollment record;
  v_week int := null;
  v_track text;
  v_today record;
  v_exec_module record;
  v_exec_lessons jsonb := '[]'::jsonb;
  v_total int := 0;
  v_done int := 0;
begin
  select id, family_id, role, age_group, track
    into v_profile from profiles where id = p_user_id;
  if v_profile.id is null then
    return jsonb_build_object('error', 'profile_not_found');
  end if;

  -- content track from age_group (age_group wins; profile.track fallback)
  v_track := coalesce(v_profile.age_group, v_profile.track, 'adults');

  -- highest active enrollment: fta > fic
  select e.id, e.program, c.name as cohort_name, c.start_date as cohort_start,
         coalesce(c.weeks, 6) as cohort_weeks
    into v_enrollment
  from enrollments e
  left join cohorts c on c.id = e.cohort_id
  where e.family_id = v_profile.family_id and e.status = 'active'
  order by case e.program when 'fta' then 0 else 1 end
  limit 1;

  if v_enrollment.id is null then
    return jsonb_build_object(
      'program', null, 'role', v_profile.role, 'track', v_track);
  end if;

  if v_enrollment.program = 'fta' and v_enrollment.cohort_start is not null then
    v_week := greatest(1, least(v_enrollment.cohort_weeks,
      ((current_date - v_enrollment.cohort_start) / 7) + 1));
  end if;

  -- foundations rail: next incomplete FIC lesson within unlocked weeks
  select l.id, l.title, l.description, l.module_id, l.drip_week,
         m.title as module_title, c.slug as course_slug, c.title as course_title
    into v_today
  from lessons l
  join modules m on m.id = l.module_id
  join courses c on c.id = m.course_id
  where c.program = 'fic' and c.published
    and (m.track is null or m.track = v_track)
    and (v_week is null or l.drip_week <= v_week)
    and not exists (
      select 1 from lesson_progress lp
      where lp.user_id = p_user_id and lp.lesson_id = l.id
        and lp.status = 'completed')
  order by l.drip_week, c.sort_order, m.sort_order, l.sort_order
  limit 1;

  select count(*),
         count(*) filter (where exists (
           select 1 from lesson_progress lp
           where lp.user_id = p_user_id and lp.lesson_id = l.id
             and lp.status = 'completed'))
    into v_total, v_done
  from lessons l
  join modules m on m.id = l.module_id
  join courses c on c.id = m.course_id
  where c.program = 'fic' and c.published
    and (m.track is null or m.track = v_track)
    and (v_week is null or l.drip_week <= v_week);

  -- execution rail (FTA only): this week's module = sort_order == week
  if v_enrollment.program = 'fta' and v_week is not null then
    select m.id, m.title, m.description
      into v_exec_module
    from modules m
    join courses c on c.id = m.course_id
    where c.program = 'fta' and c.published
      and m.sort_order = v_week
      and (m.track is null or m.track = v_track)
    order by c.sort_order
    limit 1;

    if v_exec_module.id is not null then
      select coalesce(jsonb_agg(jsonb_build_object(
          'id', l.id,
          'title', l.title,
          'description', l.description,
          'has_quiz', l.has_quiz,
          'completed', exists (
            select 1 from lesson_progress lp
            where lp.user_id = p_user_id and lp.lesson_id = l.id
              and lp.status = 'completed')
        ) order by l.sort_order), '[]'::jsonb)
        into v_exec_lessons
      from lessons l
      where l.module_id = v_exec_module.id;
    end if;
  end if;

  return jsonb_build_object(
    'program', v_enrollment.program,
    'cohort', v_enrollment.cohort_name,
    'week', v_week,
    'role', v_profile.role,
    'track', v_track,
    'today', case when v_today.id is null then null else jsonb_build_object(
      'lesson_id', v_today.id,
      'title', v_today.title,
      'description', v_today.description,
      'module_id', v_today.module_id,
      'module_title', v_today.module_title,
      'course_slug', v_today.course_slug,
      'course_title', v_today.course_title,
      'week', v_today.drip_week) end,
    'caught_up', v_today.id is null,
    'foundations_total', v_total,
    'foundations_done', v_done,
    'this_week', case when v_exec_module.id is null then null
      else jsonb_build_object(
        'module_id', v_exec_module.id,
        'title', v_exec_module.title,
        'description', v_exec_module.description,
        'lessons', v_exec_lessons) end
  );
end;
$$;

grant execute on function get_home_state(uuid) to authenticated;
