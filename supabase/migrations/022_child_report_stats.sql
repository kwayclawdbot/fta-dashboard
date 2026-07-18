-- ============================================
-- 022: child_report_stats(child) — one-call report-card data for parents.
-- SECURITY DEFINER so it can read a child's cross-table stats, but it first
-- verifies the caller is a PARENT in the same family. Cohort week is derived
-- from the family's active FTA enrollment start_date (same rule as
-- get_home_state), and foundation counts are scoped to the child's track.
-- ============================================
create or replace function child_report_stats(p_child uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_family uuid;
  v_track text;
  v_start date;
  v_weeks int := 6;
  v_week int := null;
  v_total int; v_done int;
  v_weeks_json jsonb;
  v_behind int := 0;
  v_quiz_count int; v_quiz_avg numeric; v_quiz_low int;
  v_prac_count int; v_prac_best int; v_prac_avg numeric; v_last_prac timestamptz;
  v_game_count int; v_game_best int; v_game_avg numeric; v_last_game timestamptz;
  v_xp int; v_badges int; v_last_flash timestamptz;
begin
  select p.family_id, coalesce(p.age_group, p.track, 'adults')
    into v_family, v_track
  from profiles p where p.id = p_child;
  if v_family is null then
    return jsonb_build_object('error', 'not_found');
  end if;
  if not exists (
    select 1 from profiles pp
    where pp.id = auth.uid() and pp.role = 'parent' and pp.family_id = v_family
  ) then
    return jsonb_build_object('error', 'forbidden');
  end if;

  -- cohort week from active FTA enrollment
  select c.start_date, coalesce(c.weeks, 6) into v_start, v_weeks
  from enrollments e join cohorts c on c.id = e.cohort_id
  where e.family_id = v_family and e.program = 'fta' and e.status = 'active'
  order by e.started_at desc limit 1;
  if v_start is not null then
    v_week := greatest(1, least(v_weeks, ((current_date - v_start) / 7) + 1));
  end if;

  -- foundations totals (fic, child's track)
  select count(*), count(*) filter (where done)
    into v_total, v_done
  from (
    select l.id,
      exists (select 1 from lesson_progress lp
              where lp.user_id = p_child and lp.lesson_id = l.id
                and lp.status = 'completed') as done
    from lessons l
    join modules m on m.id = l.module_id
    join courses co on co.id = m.course_id
    where co.program = 'fic' and co.published
      and (m.track is null or m.track = v_track)
  ) s;

  -- week-by-week ticks
  select coalesce(jsonb_agg(jsonb_build_object(
           'week', w, 'total', t, 'done', d,
           'unlocked', (v_week is null or w <= v_week)) order by w), '[]'::jsonb)
    into v_weeks_json
  from (
    select l.drip_week as w, count(*) t,
      count(*) filter (where exists (
        select 1 from lesson_progress lp
        where lp.user_id = p_child and lp.lesson_id = l.id
          and lp.status = 'completed')) d
    from lessons l
    join modules m on m.id = l.module_id
    join courses co on co.id = m.course_id
    where co.program = 'fic' and co.published
      and (m.track is null or m.track = v_track)
    group by l.drip_week
  ) wk;

  -- behind pace: incomplete lessons in already-unlocked weeks
  if v_week is not null then
    select count(*) into v_behind
    from lessons l
    join modules m on m.id = l.module_id
    join courses co on co.id = m.course_id
    where co.program = 'fic' and co.published
      and (m.track is null or m.track = v_track)
      and l.drip_week < v_week
      and not exists (select 1 from lesson_progress lp
                      where lp.user_id = p_child and lp.lesson_id = l.id
                        and lp.status = 'completed');
  end if;

  -- quizzes: latest attempt per quiz
  with latest as (
    select distinct on (quiz_id) quiz_id, score
    from quiz_attempts where user_id = p_child
    order by quiz_id, created_at desc
  )
  select count(*), round(avg(score)), count(*) filter (where score < 70)
    into v_quiz_count, v_quiz_avg, v_quiz_low from latest;

  select count(*), coalesce(max(total_score), 0), coalesce(round(avg(total_score)), 0), max(created_at)
    into v_prac_count, v_prac_best, v_prac_avg, v_last_prac
  from sim_scenario_scores where user_id = p_child;

  select count(*), coalesce(max(score), 0), coalesce(round(avg(score)), 0), max(created_at)
    into v_game_count, v_game_best, v_game_avg, v_last_game
  from game_scores where user_id = p_child;

  select max(updated_at) into v_last_flash from flashcard_reviews where user_id = p_child;
  select coalesce(sum(amount), 0) into v_xp from xp_events where user_id = p_child;
  select count(*) into v_badges from user_badges where user_id = p_child;

  return jsonb_build_object(
    'track', v_track,
    'cohort_week', v_week,
    'foundations_total', v_total,
    'foundations_done', v_done,
    'weeks', v_weeks_json,
    'behind_count', v_behind,
    'quiz_count', coalesce(v_quiz_count, 0),
    'quiz_avg', v_quiz_avg,
    'quiz_low', coalesce(v_quiz_low, 0),
    'practice_count', coalesce(v_prac_count, 0),
    'practice_best', coalesce(v_prac_best, 0),
    'practice_avg', coalesce(v_prac_avg, 0),
    'game_count', coalesce(v_game_count, 0),
    'game_best', coalesce(v_game_best, 0),
    'game_avg', coalesce(v_game_avg, 0),
    'last_practice_at', greatest(v_last_prac, v_last_game),
    'last_flashcard_at', v_last_flash,
    'xp', v_xp,
    'badges_count', v_badges
  );
end;
$$;
grant execute on function child_report_stats(uuid) to authenticated;
