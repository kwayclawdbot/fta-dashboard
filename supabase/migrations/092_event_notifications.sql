-- ============================================================================
-- 092 — Event-coverage notifications (the "full coverage" ask).
--
-- Four SECURITY DEFINER triggers, each matching the 028/034 style (self-skip,
-- deduped, exception-safe so they never block the underlying write, batch
-- INSERT-SELECT fan-outs). notification_prefs gate PUSH at dispatch time
-- (/api/push/dispatch) — in-app rows always create, so these triggers do not
-- join prefs (keeps the batch inserts clean; documented in 090 + 093).
--
-- Trigger inventory (event → audience → dedupe rule):
--   (a) pick_comments INSERT   → the pick's earlier distinct commenters (capped
--                                20) + the pick's admin author; self-skipped,
--                                deduped; type 'reply', link /picks/{id}.
--   (b) fic_picks → 'active'    → paying members (fic+fta), OR everyone when the
--                                pick is_free; deduped via ref_id (one per pick);
--                                type 'new_pick', link /picks/{id}.
--   (c) lessons INSERT on a     → tier audience by course.min_tier (challenge →
--       PUBLISHED course         fic+fta, academy → fta); deduped per-course per
--                                6h so bulk uploads don't spam; type 'new_lesson',
--                                link /courses/{slug}.
--   (d) live_sessions recording → the session's RSVP'd members; fires only on
--       becomes-available        the null→set transition; deduped via ref_id;
--                                type 'recording_posted', link /live-sessions.
--
-- is_free (b): feature-detected via to_jsonb(new)->>'is_free' so the trigger
-- works whether or not a concurrent agent's column is present at apply time.
-- ============================================================================

-- ── (a) pick_comments reply ──────────────────────────────────────────────────
create or replace function public.notify_on_pick_comment()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_snippet   text;
  v_link      text;
  v_pick_owner uuid;
  v_notified  uuid[] := '{}';
begin
  v_snippet := coalesce(nullif(left(coalesce(new.body, ''), 140), ''), '[comment]');
  v_link := '/picks/' || new.pick_id::text;

  -- Pick's admin author gets pinged (unless they wrote this comment).
  select created_by into v_pick_owner from fic_picks where id = new.pick_id;
  if v_pick_owner is not null and v_pick_owner <> new.user_id then
    insert into notifications (user_id, actor_id, type, body, link, ref_id)
    values (v_pick_owner, new.user_id, 'reply', v_snippet, v_link, new.pick_id);
    v_notified := array_append(v_notified, v_pick_owner);
  end if;

  -- Earlier distinct commenters on this pick (capped, deduped, self-skipped).
  insert into notifications (user_id, actor_id, type, body, link, ref_id)
  select c.user_id, new.user_id, 'reply', v_snippet, v_link, new.pick_id
  from (
    select distinct pc.user_id
    from pick_comments pc
    where pc.pick_id = new.pick_id
      and pc.id <> new.id
      and pc.user_id is not null
      and pc.user_id <> new.user_id
      and not (pc.user_id = any (v_notified))
    limit 20
  ) c;

  return new;
exception when others then
  return new;
end;
$$;

drop trigger if exists trg_pick_comment_notify on pick_comments;
create trigger trg_pick_comment_notify
  after insert on pick_comments
  for each row execute function public.notify_on_pick_comment();

-- ── (b) New Team Pick goes active ────────────────────────────────────────────
create or replace function public.notify_on_pick_active()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_became_active boolean;
  v_is_free boolean;
  v_audience text;
  v_body text;
  v_link text;
begin
  v_became_active :=
        (tg_op = 'INSERT' and new.status = 'active')
     or (tg_op = 'UPDATE' and new.status = 'active'
         and coalesce(old.status, '') is distinct from 'active');

  if not v_became_active then
    return new;
  end if;

  -- Dedupe: never announce the same pick twice (e.g. active→draft→active).
  if exists (select 1 from notifications where ref_id = new.id and type = 'new_pick') then
    return new;
  end if;

  -- Feature-detect is_free (concurrent-agent column) without hard-referencing it.
  v_is_free := coalesce((to_jsonb(new)->>'is_free')::boolean, false);
  v_audience := case when v_is_free then 'all' else 'fic' end;

  v_body := 'New Team Pick: ' || new.ticker || ' — see why';
  v_link := '/picks/' || new.id::text;

  insert into notifications (user_id, actor_id, type, body, link, ref_id)
  select a.user_id, new.created_by, 'new_pick', v_body, v_link, new.id
  from public.notif_audience_ids(v_audience) a
  where new.created_by is null or a.user_id <> new.created_by;

  return new;
exception when others then
  return new;
end;
$$;

drop trigger if exists trg_pick_active_notify on fic_picks;
create trigger trg_pick_active_notify
  after insert or update of status on fic_picks
  for each row execute function public.notify_on_pick_active();

-- ── (c) New lesson on a published course ─────────────────────────────────────
create or replace function public.notify_on_new_lesson()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_course_id uuid;
  v_slug text;
  v_min_tier text;
  v_published boolean;
  v_audience text;
  v_body text;
  v_link text;
begin
  select c.id, c.slug, c.min_tier, c.published
    into v_course_id, v_slug, v_min_tier, v_published
  from modules m
  join courses c on c.id = m.course_id
  where m.id = new.module_id;

  -- Only announce lessons added to an already-published course (a course being
  -- built stays unpublished → silent; publishing it does not per-lesson spam).
  if not coalesce(v_published, false) then
    return new;
  end if;

  -- Dedupe: at most one new_lesson fan-out per course per 6h (bulk uploads).
  if exists (
    select 1 from notifications
    where ref_id = v_course_id and type = 'new_lesson'
      and created_at > now() - interval '6 hours'
  ) then
    return new;
  end if;

  -- Tier audience by course.min_tier (mirrors src/lib/tier.ts sessionTiers):
  --   challenge → fic + fta   |   academy → fta only.
  v_audience := case when v_min_tier = 'academy' then 'fta' else 'fic' end;
  v_body := 'New lesson: ' || coalesce(new.title, 'a new lesson is live');
  v_link := '/courses/' || coalesce(v_slug, '');

  insert into notifications (user_id, actor_id, type, body, link, ref_id)
  select a.user_id, null, 'new_lesson', v_body, v_link, v_course_id
  from public.notif_audience_ids(v_audience) a;

  return new;
exception when others then
  return new;
end;
$$;

drop trigger if exists trg_new_lesson_notify on lessons;
create trigger trg_new_lesson_notify
  after insert on lessons
  for each row execute function public.notify_on_new_lesson();

-- ── (d) Class recording posted → RSVP'd members ──────────────────────────────
-- Wires the "extensible" recording hook flagged in migration 026. Fires only on
-- the null → available transition of recording_path/recording_url.
create or replace function public.notify_on_recording_posted()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_body text;
begin
  if coalesce(old.recording_path, old.recording_url) is not null
     or coalesce(new.recording_path, new.recording_url) is null then
    return new;
  end if;

  if exists (select 1 from notifications where ref_id = new.id and type = 'recording_posted') then
    return new;
  end if;

  v_body := 'Recording posted: ' || coalesce(new.title, 'a class you attended');

  insert into notifications (user_id, actor_id, type, body, link, ref_id)
  select distinct r.user_id, null, 'recording_posted', v_body, '/live-sessions', new.id
  from session_rsvps r
  where r.session_id = new.id
    and r.user_id is not null;

  return new;
exception when others then
  return new;
end;
$$;

drop trigger if exists trg_recording_posted_notify on live_sessions;
create trigger trg_recording_posted_notify
  after update of recording_path, recording_url on live_sessions
  for each row execute function public.notify_on_recording_posted();
