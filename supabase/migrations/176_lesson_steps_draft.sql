-- 176 — Learning World P5: DRAFT-GATED content conversion plumbing
--
-- The bulk conversion of the FIC Foundations program lessons into native step
-- sequences (migration 177) must NOT go live to members automatically. Authored
-- steps land in a separate `steps_draft` jsonb column; the live `steps` column
-- (read by <LessonEngine> in LessonViewerClient) is untouched until THE OWNER
-- reviews a draft and explicitly publishes it.
--
-- Additive + reversible: a member sees exactly what they saw before until an
-- owner-driven publish copies steps_draft -> steps. Preview happens through the
-- real engine via ?draft=1 on the lesson route (admin/dev only).

-- Staged step sequence, invisible to members. NULL = no draft authored.
alter table lessons add column if not exists steps_draft jsonb;

comment on column lessons.steps_draft is
  'Learning World P5: DRAFT step sequence, invisible to members. Preview via ?draft=1 (admin only). publish_lesson_draft() copies this into steps.';

-- Admin-only publish: copy steps_draft into the live steps column and lift the
-- envelope xp / duration into the columns the engine + legacy viewer read.
-- SECURITY DEFINER (mirrors bump_skill_mastery) with an explicit admin check, so
-- we do not have to widen RLS write access on the lessons table.
create or replace function public.publish_lesson_draft(p_lesson_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_draft jsonb;
begin
  if v_uid is null then
    raise exception 'unauthorized';
  end if;
  if not exists (select 1 from profiles where id = v_uid and role = 'admin') then
    raise exception 'admin only';
  end if;

  select steps_draft into v_draft from lessons where id = p_lesson_id;
  if v_draft is null then
    raise exception 'no draft to publish for lesson %', p_lesson_id;
  end if;

  update lessons set
    steps       = v_draft,
    lesson_xp   = coalesce((v_draft ->> 'xp')::int, lesson_xp),
    est_minutes = coalesce((v_draft ->> 'duration_minutes')::int, est_minutes),
    node_kind   = 'lesson'
  where id = p_lesson_id;
end;
$$;

grant execute on function public.publish_lesson_draft(uuid) to authenticated;

-- Admin-only UNPUBLISH (revert to legacy render) — lets the owner pull a lesson
-- back to the video/iframe viewer without losing the draft. Additive safety.
create or replace function public.unpublish_lesson_draft(p_lesson_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'unauthorized';
  end if;
  if not exists (select 1 from profiles where id = v_uid and role = 'admin') then
    raise exception 'admin only';
  end if;
  update lessons set steps = null where id = p_lesson_id;
end;
$$;

grant execute on function public.unpublish_lesson_draft(uuid) to authenticated;

-- Admin-only listing for the draft review console (/admin/learn-drafts). Returns
-- one row per FIC Foundations lesson with just the flags the console needs, so
-- the client never ships full step JSON. in_sync = published content already
-- equals the current draft.
create or replace function public.list_learn_drafts()
returns table (
  course_slug text,
  course_title text,
  module_id uuid,
  module_title text,
  module_track text,
  module_sort int,
  lesson_id uuid,
  lesson_title text,
  lesson_sort int,
  has_draft boolean,
  is_published boolean,
  in_sync boolean
)
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null
     or not exists (select 1 from profiles where id = auth.uid() and role = 'admin') then
    raise exception 'admin only';
  end if;

  return query
    select c.slug, c.title,
           m.id, m.title, m.track, m.sort_order,
           l.id, l.title, l.sort_order,
           (l.steps_draft is not null),
           (l.steps is not null),
           (l.steps is not null and l.steps_draft is not null and l.steps = l.steps_draft)
    from courses c
    join modules m on m.course_id = c.id
    join lessons l on l.module_id = m.id
    where c.program = 'fic'
    order by c.sort_order, m.sort_order, l.sort_order;
end;
$$;

grant execute on function public.list_learn_drafts() to authenticated;
