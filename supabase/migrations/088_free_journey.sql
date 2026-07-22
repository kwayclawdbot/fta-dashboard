-- 088 — Free journey checklist ("Your first week, free")
--
-- A per-user first-week checklist that turns the free tier into a guided path
-- ending at "Unlock everything — join FIC." Most steps are AUTO-DETECTED from
-- data the member already produces; only a pure client event (watched the
-- confirmation video) is stored on the row.
--
-- Steps:
--   class_rsvped   free_class_registrations / session_rsvps (a free class)
--   first_lesson   lesson_progress on a free (is_free) lesson
--   first_game     game_scores for Candle Battle
--   said_hi        a chat_messages post in the Free Lounge
--   watched_video  stored (client marks it after the confirmation video)
--
-- The table holds only the stored steps + updated_at; the RPC merges them with
-- live auto-detection so the UI reads one source. own-row RLS.

create table if not exists free_journey (
  user_id    uuid primary key references profiles(id) on delete cascade,
  steps      jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table free_journey enable row level security;

drop policy if exists "Own free journey row" on free_journey;
create policy "Own free journey row" on free_journey
  for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- ── free_journey_state() — the merged, auto-detected checklist ───────────────
-- SECURITY DEFINER so it can read the admin-scoped free_class_registrations and
-- cross-table signals without widening any RLS. Returns one jsonb blob.
create or replace function public.free_journey_state()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid        uuid := auth.uid();
  v_stored     jsonb;
  v_class_at   timestamptz;
  v_rsvped     boolean;
  v_lesson     boolean;
  v_game       boolean;
  v_hi         boolean;
  v_watched    boolean;
begin
  if v_uid is null then
    return null;
  end if;

  -- Ensure the row exists (idempotent) and read stored client steps.
  insert into free_journey (user_id) values (v_uid) on conflict (user_id) do nothing;
  select steps into v_stored from free_journey where user_id = v_uid;
  v_stored := coalesce(v_stored, '{}'::jsonb);
  v_watched := coalesce((v_stored->>'watched_video')::boolean, false);

  -- class_rsvped: a funnel registration OR an RSVP to a free class.
  v_rsvped :=
    exists (select 1 from free_class_registrations r where r.user_id = v_uid)
    or exists (
      select 1 from session_rsvps sr
      join live_sessions ls on ls.id = sr.session_id
      where sr.user_id = v_uid and ls.class_type = 'free_class'
    );

  -- first_lesson: any progress on a free lesson (in_progress or completed).
  v_lesson := exists (
    select 1 from lesson_progress lp
    join lessons l on l.id = lp.lesson_id
    where lp.user_id = v_uid and l.is_free
  );

  -- first_game: a finished Candle Battle session.
  v_game := exists (
    select 1 from game_scores gs where gs.user_id = v_uid and gs.game = 'candle-battle'
  );

  -- said_hi: a message in the Free Lounge.
  v_hi := exists (
    select 1 from chat_messages m
    where m.user_id = v_uid
      and m.room_id = 'c0000000-0000-4000-a000-000000000003'::uuid
  );

  -- The member's free class time (their registration's session, else the next
  -- upcoming free class) — drives the "how was the class?" band after it passes.
  select ls.scheduled_at into v_class_at
  from free_class_registrations r
  join live_sessions ls on ls.id = r.session_id
  where r.user_id = v_uid and ls.scheduled_at is not null
  order by ls.scheduled_at desc
  limit 1;

  if v_class_at is null then
    select ls.scheduled_at into v_class_at
    from live_sessions ls
    where ls.class_type = 'free_class'
      and ls.status <> 'cancelled'
      and ls.scheduled_at is not null
    order by ls.scheduled_at asc
    limit 1;
  end if;

  return jsonb_build_object(
    'class_rsvped',  v_rsvped,
    'first_lesson',  v_lesson,
    'first_game',    v_game,
    'said_hi',       v_hi,
    'watched_video', v_watched,
    'class_at',      v_class_at,
    'class_passed',  (v_class_at is not null and v_class_at < now())
  );
end;
$$;

grant execute on function public.free_journey_state() to authenticated;

-- ── free_journey_mark(step) — persist a client-only step (watched_video) ─────
create or replace function public.free_journey_mark(p_step text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    return;
  end if;
  -- Only client-driven steps are settable here; auto-detected steps are derived.
  if p_step not in ('watched_video') then
    return;
  end if;
  insert into free_journey (user_id, steps, updated_at)
  values (v_uid, jsonb_build_object(p_step, true), now())
  on conflict (user_id) do update
    set steps = free_journey.steps || jsonb_build_object(p_step, true),
        updated_at = now();
end;
$$;

grant execute on function public.free_journey_mark(text) to authenticated;
