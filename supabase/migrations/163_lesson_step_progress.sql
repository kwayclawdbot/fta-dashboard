-- 163 — Learning World P2: per-lesson resume state
--
-- Additive resume DETAIL, distinct from lesson_progress (which stays the coarse
-- completion truth the rest of the app + get_home_state already read). One row
-- per (user, lesson): where they are in the step sequence and any per-step
-- resume payload. Monotonic — the engine only advances step_index forward.
--
-- A member who completed a lesson pre-migration has lesson_progress.completed and
-- NO step row → the engine treats the lesson as done (allows replay). A member
-- mid-way through a legacy lesson has progress_pct but no step row → the engine
-- starts them at step 0. No user loses completion, XP, belts, or badges.

create table if not exists lesson_step_progress (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references profiles(id) on delete cascade,
  lesson_id uuid not null references lessons(id) on delete cascade,
  step_index int not null default 0 check (step_index >= 0),
  -- per-step engine state (resolved step ids, mastery-loop flags, etc.)
  step_state jsonb not null default '{}',
  updated_at timestamptz not null default now(),
  unique (user_id, lesson_id)
);

create index if not exists idx_lesson_step_progress_user
  on lesson_step_progress (user_id);
create index if not exists idx_lesson_step_progress_lesson
  on lesson_step_progress (lesson_id);

alter table lesson_step_progress enable row level security;

-- Own-row: mirrors "Users manage own progress" on lesson_progress.
drop policy if exists "Users manage own step progress" on lesson_step_progress;
create policy "Users manage own step progress"
  on lesson_step_progress for all using (auth.uid() = user_id);

-- Parents read children's resume state — mirrors "Parents read family progress".
drop policy if exists "Parents read family step progress" on lesson_step_progress;
create policy "Parents read family step progress"
  on lesson_step_progress for select using (
    user_id in (
      select id from profiles
      where family_id = (select family_id from profiles where id = auth.uid())
    )
    and exists (select 1 from profiles where id = auth.uid() and role = 'parent')
  );

-- keep updated_at fresh
create or replace function public.touch_lesson_step_progress()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_lesson_step_progress_touch on lesson_step_progress;
create trigger trg_lesson_step_progress_touch
  before update on lesson_step_progress
  for each row execute function public.touch_lesson_step_progress();
