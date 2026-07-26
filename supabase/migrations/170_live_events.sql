-- ============================================================================
-- 170 — live_event object (CLUB-CONVERGENCE-PLAN PART II, S2.5 minimal slice)
--
-- One first-class object that lives through its whole lifecycle:
--   scheduled → starting_soon → live → ended → replay_ready
-- The Feed renders the CURRENT STATE of the same row; notifications subscribe to
-- state changes. One object, one URL, one engagement history.
--
-- SCOPE (minimal slice — battle-tests the model on the five Sept 2–6 webinars):
--   • live_events           — the object + its evolving state
--   • live_event_interest   — member "Remind Me" opt-ins (own-row RLS)
--   • advance_live_event()  — the ONLY sanctioned state mutation (service-role,
--                             forward-only, enforces the state machine)
--   • notifications 'live_starting' type — push on go-live to interested members
--
-- OUT OF SCOPE (post-challenge, when density exists): audio/screen-share room
-- infrastructure, Feed→Live, Lounge→Feed promotion. kai_summary stays NULL until
-- LLM credits return (zero-LLM primary path — GUARDRAILS).
--
-- Writes are service-role only. Members read (member-visible; class events are
-- fine for every register — no kid-specific wall beyond the existing shell gate).
-- Additive + preserve-don't-delete (GUARDRAILS). Migration range 170–175 (lane).
-- ============================================================================

-- ── 1. live_events ──────────────────────────────────────────────────────────
create table if not exists live_events (
  id               uuid primary key default gen_random_uuid(),

  -- The lifecycle. Ordering is meaningful: advance_live_event() only moves
  -- FORWARD along this list (see the RPC). A backward move is rejected.
  status           text not null default 'scheduled'
                     check (status in ('scheduled','starting_soon','live','ended','replay_ready')),

  -- One Live infrastructure, multiple room types (PART I). Minimal slice ships
  -- 'class' (the webinars); 'audio' + 'market' are enumerated now so the object
  -- is stable when their infra lands post-challenge.
  room_type        text not null default 'class'
                     check (room_type in ('audio','market','class')),

  title            text not null,
  description      text,
  tickers          text[] not null default '{}',
  thumbnail_url    text,

  -- Host + cohosts. host_id is the canonical profile link; host_name /
  -- host_avatar_url are a denormalized display fallback so a SEEDED event (whose
  -- instructor may not map to a member profile yet) still renders a host without
  -- a join. The API prefers the profile when host_id is set.
  host_id          uuid references profiles(id) on delete set null,
  host_name        text,
  host_avatar_url  text,
  cohosts          uuid[] not null default '{}',

  -- Live/interest counters. Maintained honestly: interested_count is kept in
  -- sync by a trigger on live_event_interest (never fabricated); viewer_count is
  -- written by the (future) live room infra and defaults to 0. Scale-floor copy
  -- lives in the card, not here.
  viewer_count     int not null default 0 check (viewer_count >= 0),
  interested_count int not null default 0 check (interested_count >= 0),

  starts_at        timestamptz not null,     -- scheduled start (drives T-30 flip)
  started_at       timestamptz,              -- actual go-live moment (set on → live)
  ended_at         timestamptz,              -- set on → ended
  duration_min     int check (duration_min is null or duration_min > 0),

  -- Nullable by design: the owner has not created the webinar links yet. The
  -- card shows a graceful "Link coming" state while join_url is null.
  join_url         text,
  replay_url       text,

  -- LLM enrichment, queued until credits return (GUARDRAILS zero-LLM path).
  kai_summary      text,
  top_questions    jsonb not null default '[]'::jsonb,

  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create index if not exists idx_live_events_status_starts
  on live_events(status, starts_at);
create index if not exists idx_live_events_starts
  on live_events(starts_at desc);

drop trigger if exists live_events_updated_at on live_events;
create trigger live_events_updated_at before update on live_events
  for each row execute function public.update_updated_at();

-- Member-visible: any authenticated member may read. Writes come ONLY from the
-- service role / the definer RPC — no INSERT/UPDATE/DELETE policy is created, so
-- authenticated + anon cannot mutate. (Realtime-safe: bare, non-recursive read.)
alter table live_events enable row level security;

drop policy if exists "Members read live events" on live_events;
create policy "Members read live events" on live_events
  for select to authenticated using (true);

revoke insert, update, delete on live_events from authenticated, anon;

do $$
begin
  alter publication supabase_realtime add table live_events;
exception when duplicate_object then null;
end $$;

-- ── 2. live_event_interest — member "Remind Me" opt-ins (own-row RLS) ────────
create table if not exists live_event_interest (
  event_id   uuid not null references live_events(id) on delete cascade,
  user_id    uuid not null references profiles(id)   on delete cascade,
  created_at timestamptz not null default now(),
  primary key (event_id, user_id)
);

create index if not exists idx_live_event_interest_user
  on live_event_interest(user_id);
create index if not exists idx_live_event_interest_event
  on live_event_interest(event_id);

alter table live_event_interest enable row level security;

-- Own-row: a member sees + toggles only their own interest. (Bare comparison,
-- no subquery — the 019 realtime scar.)
drop policy if exists "Own live event interest" on live_event_interest;
create policy "Own live event interest" on live_event_interest
  for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- Keep live_events.interested_count exact as opt-ins toggle (definer so it can
-- write the counter the member cannot touch directly).
create or replace function public.sync_live_event_interest_count()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    update live_events set interested_count = interested_count + 1
      where id = new.event_id;
    return new;
  elsif tg_op = 'DELETE' then
    update live_events set interested_count = greatest(0, interested_count - 1)
      where id = old.event_id;
    return old;
  end if;
  return null;
end;
$$;

drop trigger if exists trg_live_event_interest_count on live_event_interest;
create trigger trg_live_event_interest_count
  after insert or delete on live_event_interest
  for each row execute function public.sync_live_event_interest_count();

-- ── 3. advance_live_event — the ONLY sanctioned state mutation ───────────────
-- SECURITY DEFINER, forward-only along the lifecycle. Granted to service_role
-- ONLY (the admin/cron route calls it via the service key); NOT to authenticated
-- or anon, so a member can never drive an event's state. Side effects that must
-- be atomic with the transition happen here (started_at / ended_at stamps); the
-- go-live PUSH fan-out is done by the route (contextual copy per room type).
--
-- Returns the updated row as jsonb (or a jsonb error object) so the caller can
-- branch without a second read.
create or replace function public.advance_live_event(
  p_event_id  uuid,
  p_to_status text,
  p_replay_url text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ev       live_events%rowtype;
  v_order    text[] := array['scheduled','starting_soon','live','ended','replay_ready'];
  v_from_idx int;
  v_to_idx   int;
begin
  select * into v_ev from live_events where id = p_event_id for update;
  if not found then
    return jsonb_build_object('ok', false, 'error', 'not_found');
  end if;

  v_from_idx := array_position(v_order, v_ev.status);
  v_to_idx   := array_position(v_order, p_to_status);

  if v_to_idx is null then
    return jsonb_build_object('ok', false, 'error', 'bad_status');
  end if;
  -- Forward-only. Re-issuing the same status (idempotent no-op) is allowed so a
  -- retried cron / double-click doesn't error; a BACKWARD move is rejected.
  if v_to_idx < v_from_idx then
    return jsonb_build_object('ok', false, 'error', 'illegal_transition',
      'from', v_ev.status, 'to', p_to_status);
  end if;
  if v_to_idx = v_from_idx then
    return jsonb_build_object('ok', true, 'noop', true, 'event', to_jsonb(v_ev));
  end if;

  update live_events
     set status     = p_to_status,
         started_at = case when p_to_status = 'live'  and started_at is null
                           then now() else started_at end,
         ended_at   = case when p_to_status in ('ended','replay_ready') and ended_at is null
                           then now() else ended_at end,
         replay_url = coalesce(p_replay_url, replay_url)
   where id = p_event_id
   returning * into v_ev;

  return jsonb_build_object('ok', true, 'event', to_jsonb(v_ev));
end;
$$;

revoke all on function public.advance_live_event(uuid, text, text) from public, authenticated, anon;
grant execute on function public.advance_live_event(uuid, text, text) to service_role;

-- ── 4. notifications: the 'live_starting' type ───────────────────────────────
-- The go-live push reuses the EXISTING dispatch machinery (028 pg_net → the
-- /api/push/dispatch route → web-push + email fallback + prefs gate). We only
-- widen the type CHECK; the route maps the type → title and gates PUSH on the
-- notification_prefs key `push_lives` (opt-out; absent/true = send). The in-app
-- bell row always creates; the pref gates PUSH only (028/090 design).
alter table notifications drop constraint if exists notifications_type_check;
alter table notifications add constraint notifications_type_check
  check (type in (
    'reply', 'mention', 'announcement', 'support_reply',
    'mention_everyone', 'new_pick', 'new_lesson', 'recording_posted',
    'broadcast', 'alert', 'live_starting'
  ));

comment on table live_events is
  'CONVERGENCE PART II live_event object. Lifecycle scheduled→starting_soon→live→ended→replay_ready via advance_live_event() (service-role, forward-only). Member-readable. kai_summary null until LLM credits.';
comment on table live_event_interest is
  'Member Remind-Me opt-ins for a live_event (own-row RLS). Drives interested_count + the go-live push audience.';
