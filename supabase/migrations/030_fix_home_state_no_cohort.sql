-- 030 — Fix get_home_state 500 for FTA enrollments without a cohort
--
-- When program = 'fta' but the enrollment has no cohort start date, v_week
-- stays NULL and the execution-rail SELECT INTO never runs, leaving the
-- v_exec_module RECORD unassigned. Referencing an unassigned record in the
-- RETURN raises `55000: record "v_exec_module" is not assigned yet`, so the
-- whole home resolver 500s for cohortless FTA families. Replace the record
-- with scalar variables (always defined, default NULL).
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
  v_exec_module_id uuid := null;
  v_exec_module_title text := null;
  v_exec_module_desc text := null;
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
      into v_exec_module_id, v_exec_module_title, v_exec_module_desc
    from modules m
    join courses c on c.id = m.course_id
    where c.program = 'fta' and c.published
      and m.sort_order = v_week
      and (m.track is null or m.track = v_track)
    order by c.sort_order
    limit 1;

    if v_exec_module_id is not null then
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
      where l.module_id = v_exec_module_id;
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
    'this_week', case when v_exec_module_id is null then null
      else jsonb_build_object(
        'module_id', v_exec_module_id,
        'title', v_exec_module_title,
        'description', v_exec_module_desc,
        'lessons', v_exec_lessons) end
  );
end;
$$;

grant execute on function get_home_state(uuid) to authenticated;
