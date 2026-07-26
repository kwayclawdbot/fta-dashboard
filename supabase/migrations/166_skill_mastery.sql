-- 166 — Learning World P2: skill mastery (spaced-repetition scheduler)
--
-- Directly mirrors the already-proven flashcard_reviews shape (due_at /
-- interval_days / streak) so the scheduler is a known quantity (FIC-LEARNING-
-- WORLD §7, proposal §5). Deterministic updates only — correct raises mastery and
-- pushes next_review_at out; wrong lowers it and pulls the review in. ZERO LLM.
--
-- One row per (user, skill). mastery_score 0–100. next_review_at drives the
-- future "Today's Review" / weakest-due-skill daily challenge (P6). Own-row RLS
-- plus parent read (mirrors lesson_progress) so report cards can surface the
-- INVESTOR BRAIN bars.

create table if not exists skill_mastery (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references profiles(id) on delete cascade,
  skill_id text not null references skills(id) on delete cascade,
  mastery_score int not null default 0 check (mastery_score between 0 and 100),
  attempts int not null default 0,
  correct int not null default 0,
  streak int not null default 0,
  interval_days int not null default 1,
  last_seen timestamptz,
  next_review_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, skill_id)
);

create index if not exists idx_skill_mastery_user on skill_mastery (user_id);
create index if not exists idx_skill_mastery_due
  on skill_mastery (user_id, next_review_at);

alter table skill_mastery enable row level security;

drop policy if exists "Users manage own mastery" on skill_mastery;
create policy "Users manage own mastery"
  on skill_mastery for all using (auth.uid() = user_id);

drop policy if exists "Parents read family mastery" on skill_mastery;
create policy "Parents read family mastery"
  on skill_mastery for select using (
    user_id in (
      select id from profiles
      where family_id = (select family_id from profiles where id = auth.uid())
    )
    and exists (select 1 from profiles where id = auth.uid() and role = 'parent')
  );

create or replace function public.touch_skill_mastery()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_skill_mastery_touch on skill_mastery;
create trigger trg_skill_mastery_touch
  before update on skill_mastery
  for each row execute function public.touch_skill_mastery();

-- Deterministic mastery bump for one (user, skill) interaction. correct=true
-- raises mastery + lengthens the interval (SM-lite doubling, capped); wrong
-- lowers mastery, resets streak, and schedules the skill back within a day.
-- SECURITY DEFINER + own-row check so the engine can call it with one RPC.
create or replace function public.bump_skill_mastery(
  p_skill_id text,
  p_correct boolean
) returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_interval int;
  v_streak int;
  v_score int;
begin
  if v_uid is null then return; end if;
  -- Skip unknown skills quietly (forward-compat with authored step skill ids).
  if not exists (select 1 from skills where id = p_skill_id) then return; end if;

  insert into skill_mastery (user_id, skill_id, mastery_score, attempts, correct,
                             streak, interval_days, last_seen, next_review_at)
  values (v_uid, p_skill_id,
          case when p_correct then 12 else 0 end,
          1, case when p_correct then 1 else 0 end,
          case when p_correct then 1 else 0 end,
          1, now(),
          now() + (case when p_correct then 1 else 1 end) * interval '1 day')
  on conflict (user_id, skill_id) do update set
    attempts   = skill_mastery.attempts + 1,
    correct    = skill_mastery.correct + (case when p_correct then 1 else 0 end),
    streak     = case when p_correct then skill_mastery.streak + 1 else 0 end,
    mastery_score = greatest(0, least(100,
      skill_mastery.mastery_score + (case when p_correct then 12 else -8 end))),
    interval_days = case
      when p_correct then least(30, greatest(1, skill_mastery.interval_days * 2))
      else 1 end,
    last_seen  = now(),
    next_review_at = now() + (case
      when p_correct then least(30, greatest(1, skill_mastery.interval_days * 2))
      else 1 end) * interval '1 day';
end;
$$;

grant execute on function public.bump_skill_mastery(text, boolean) to authenticated;
