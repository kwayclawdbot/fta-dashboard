-- Perf: single-round-trip aggregate reads for the watchlist board and missions
-- page. Both SECURITY INVOKER so existing RLS applies unchanged (each caller
-- only ever sees their own family's rows). Replaces 3-6 sequential client
-- round-trips per page with one.

create or replace function public.get_watchlist_board()
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_family uuid;
  v_role text;
  v_age text;
begin
  if v_uid is null then
    return jsonb_build_object('family_id', null);
  end if;

  select family_id, role, age_group
    into v_family, v_role, v_age
  from profiles where id = v_uid;

  if v_family is null then
    return jsonb_build_object(
      'family_id', null, 'role', v_role, 'age_group', v_age,
      'members', '[]'::jsonb, 'items', '[]'::jsonb, 'notes', '[]'::jsonb);
  end if;

  return jsonb_build_object(
    'family_id', v_family,
    'role', v_role,
    'age_group', v_age,
    'members', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', p.id, 'display_name', p.display_name,
        'avatar_url', p.avatar_url, 'role', p.role))
      from profiles p where p.family_id = v_family), '[]'::jsonb),
    'items', coalesce((
      select jsonb_agg(to_jsonb(fw) order by fw.created_at desc)
      from family_watchlist fw where fw.family_id = v_family), '[]'::jsonb),
    'notes', coalesce((
      select jsonb_agg(to_jsonb(n) order by n.created_at asc)
      from watchlist_notes n
      where n.watchlist_id in (
        select id from family_watchlist where family_id = v_family)
    ), '[]'::jsonb)
  );
end;
$$;

create or replace function public.get_missions_state()
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_family uuid;
  v_role text;
  v_age text;
begin
  if v_uid is null then
    return jsonb_build_object('missions', '[]'::jsonb);
  end if;

  select family_id, role, age_group
    into v_family, v_role, v_age
  from profiles where id = v_uid;

  return jsonb_build_object(
    'family_id', v_family,
    'role', v_role,
    'age_group', v_age,
    'xp', coalesce((
      select sum(amount) from xp_events where user_id = v_uid), 0),
    'championed', coalesce((
      select count(*) from family_watchlist where champion_id = v_uid), 0),
    'missions', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', m.id, 'slug', m.slug, 'title', m.title,
        'description', m.description, 'kid_prompt', m.kid_prompt,
        'xp_reward', m.xp_reward, 'sort', m.sort) order by m.sort)
      from fic_missions m), '[]'::jsonb),
    'completions', coalesce((
      select jsonb_agg(jsonb_build_object(
        'mission_id', c.mission_id, 'evidence', c.evidence,
        'completed_at', c.completed_at))
      from mission_completions c where c.user_id = v_uid), '[]'::jsonb)
  );
end;
$$;

grant execute on function public.get_watchlist_board() to authenticated;
grant execute on function public.get_missions_state() to authenticated;
