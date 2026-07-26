-- ============================================================================
-- 158 — LANE A (Kai Watch): SETUP LIFECYCLE OBJECTS ("Watch this setup").
--
-- Every Kai Daily / broadcast alert (trade_alerts, from the alerts-ingest bridge)
-- becomes a first-class SETUP object with its own lifecycle, so a member can
-- opt in to follow ONE setup's story through to its outcome:
--
--     waiting → confirmed → triggered | invalidated | expired
--
--   alert_setups        — one lifecycle object per broadcast (id, ticker, thesis,
--                         levels, state). Auto-created from each trade_alert.
--   setup_subscriptions — a member's opt-in to follow a setup (own-row RLS).
--   alert_events kind 'setup_update' — lifecycle transitions fanned to SUBSCRIBERS
--                         ONLY, into the same feed storage, cadence-capped.
--   create_setup_from_alert() — idempotent creator called by the ingest bridge.
--   advance_setup_state()      — transition + subscriber fan-out (2/day per sub).
--
-- Backend + API only (Lane B builds the UI). Deterministic lifecycle logic lives
-- in src/lib/alerts/setup-lifecycle.ts; the intraday cron drives it. Fan-out is
-- SECURITY DEFINER (service role); members may only manage their OWN opt-in row.
-- ============================================================================

-- ── widen alert_events.kind to carry setup lifecycle updates ─────────────────
alter table alert_events drop constraint if exists alert_events_kind_check;
alter table alert_events add constraint alert_events_kind_check
  check (kind in ('rule', 'broadcast', 'kai_update', 'setup_update'));

-- ── 1. alert_setups (lifecycle objects) ──────────────────────────────────────
create table if not exists alert_setups (
  id             uuid primary key default gen_random_uuid(),
  alert_id       uuid not null references trade_alerts(id) on delete cascade,
  ticker         text not null,
  direction      text not null default 'watch'
                   check (direction in ('long', 'short', 'watch')),
  thesis         text,                                  -- the plain-language thesis line
  entry          numeric,
  levels         jsonb not null default '{}'::jsonb,    -- {support, resistance, stop, ...}
  snapshot_price numeric,                               -- price at issue
  state          text not null default 'waiting'
                   check (state in ('waiting', 'confirmed', 'triggered', 'invalidated', 'expired')),
  state_entered_at timestamptz not null default now(),
  detail         jsonb not null default '{}'::jsonb,    -- last transition context
  expires_at     timestamptz not null default (now() + interval '10 days'),
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  unique (alert_id)                                     -- one setup per broadcast
);

create index if not exists idx_alert_setups_ticker on alert_setups(ticker);
create index if not exists idx_alert_setups_live on alert_setups(state)
  where state in ('waiting', 'confirmed');
create index if not exists idx_alert_setups_created on alert_setups(created_at desc);

alter table alert_setups enable row level security;

-- All authenticated members may READ live/past setups (the page decides who sees
-- the surface at all — same posture as trade_alerts). Writes are service-role.
drop policy if exists "Read setups" on alert_setups;
create policy "Read setups" on alert_setups
  for select to authenticated using (true);

revoke insert, update, delete on alert_setups from authenticated, anon;

-- ── 2. setup_subscriptions (member opt-in) ───────────────────────────────────
create table if not exists setup_subscriptions (
  id         uuid primary key default gen_random_uuid(),
  setup_id   uuid not null references alert_setups(id) on delete cascade,
  user_id    uuid not null references profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (setup_id, user_id)
);

create index if not exists idx_setup_subs_setup on setup_subscriptions(setup_id);
create index if not exists idx_setup_subs_user on setup_subscriptions(user_id);

alter table setup_subscriptions enable row level security;

-- Members manage their OWN opt-in row (opt in / opt out); nothing else.
drop policy if exists "Own setup subscriptions" on setup_subscriptions;
create policy "Own setup subscriptions" on setup_subscriptions
  for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- ── 3. create_setup_from_alert — idempotent creator (ingest bridge) ──────────
create or replace function public.create_setup_from_alert(p_alert_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_alert  record;
  v_setup_id uuid;
  v_thesis text;
begin
  select * into v_alert from trade_alerts where id = p_alert_id;
  if not found then
    return null;
  end if;

  v_thesis := coalesce(
    nullif(v_alert.setup_label, ''),
    left(coalesce(v_alert.narrative, ''), 200),
    v_alert.ticker || ' setup'
  );

  insert into alert_setups (alert_id, ticker, direction, thesis, entry, levels, snapshot_price)
  values (
    v_alert.id, v_alert.ticker, v_alert.direction, v_thesis,
    v_alert.entry, coalesce(v_alert.levels, '{}'::jsonb), v_alert.snapshot_price
  )
  on conflict (alert_id) do nothing
  returning id into v_setup_id;

  if v_setup_id is null then
    select id into v_setup_id from alert_setups where alert_id = p_alert_id;
  end if;
  return v_setup_id;
end;
$$;

revoke all on function public.create_setup_from_alert(uuid) from public, authenticated, anon;

-- ── 4. advance_setup_state — transition + subscriber-only fan-out ─────────────
-- No-op (returns changed:false) when the setup is already in p_new_state, so a
-- steady lifecycle never re-notifies. On a real change it stamps the new state
-- and fans a 'setup_update' event to SUBSCRIBERS ONLY, honouring the same cadence
-- discipline as watch updates: max 2 setup updates per subscriber per setup per
-- day; push_worthy=false ⇒ feed-only 'none'; push_worthy=true ⇒ digest pref OR
-- quiet_hours OR over the daily push cap ⇒ held 'digest', else instant push.
create or replace function public.advance_setup_state(
  p_setup_id    uuid,
  p_new_state   text,
  p_message     text,
  p_push_worthy boolean default false,
  p_detail      jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_setup   record;
  v_pushed  int := 0;
  v_held    int := 0;
  v_skipped int := 0;
  r         record;
  v_today_upd  int;
  v_today_push int;
  v_cap        int;
  v_digest_pref boolean;
  v_quiet      boolean;
  v_mode       text;
  v_event_id   uuid;
  v_notif_id   uuid;
  v_body       text;
begin
  select * into v_setup from alert_setups where id = p_setup_id;
  if not found then
    return jsonb_build_object('error', 'setup not found');
  end if;
  if v_setup.state = p_new_state then
    return jsonb_build_object('changed', false);
  end if;

  update alert_setups
    set state = p_new_state, state_entered_at = now(), updated_at = now(),
        detail = coalesce(p_detail, '{}'::jsonb)
  where id = p_setup_id;

  for r in
    select s.user_id
    from setup_subscriptions s
    where s.setup_id = p_setup_id
  loop
    -- CADENCE CAP: max 2 setup updates per subscriber per setup per day.
    select count(*) into v_today_upd
    from alert_events
    where user_id = r.user_id
      and alert_id = v_setup.alert_id
      and kind = 'setup_update'
      and fired_at >= date_trunc('day', now());
    if v_today_upd >= 2 then
      v_skipped := v_skipped + 1;
      continue;
    end if;

    select coalesce(daily_cap, 10), coalesce(digest, false), coalesce(quiet_hours, true)
      into v_cap, v_digest_pref, v_quiet
    from alert_prefs where user_id = r.user_id;
    v_cap := coalesce(v_cap, 10);
    v_digest_pref := coalesce(v_digest_pref, false);
    v_quiet := coalesce(v_quiet, true);

    if not coalesce(p_push_worthy, false) then
      v_mode := 'none';
    else
      select count(*) into v_today_push
      from alert_events
      where user_id = r.user_id and delivered = 'push'
        and fired_at >= date_trunc('day', now());
      if v_digest_pref or v_quiet or v_today_push >= v_cap then
        v_mode := 'digest';
      else
        v_mode := 'push';
      end if;
    end if;

    insert into alert_events (user_id, alert_id, kind, ticker, payload, delivered, fired_at)
    values (
      r.user_id, v_setup.alert_id, 'setup_update', v_setup.ticker,
      jsonb_build_object(
        'message', p_message,
        'setup_id', p_setup_id,
        'state', p_new_state,
        'setup_update', true
      ),
      v_mode, now()
    )
    returning id into v_event_id;

    if v_mode = 'push' then
      v_body := left(coalesce(nullif(p_message, ''), v_setup.ticker || ' setup update'), 140);
      insert into notifications (user_id, actor_id, type, body, link, ref_id)
      values (r.user_id, null, 'alert', v_body, '/alerts', v_event_id)
      returning id into v_notif_id;
      update alert_events set notification_id = v_notif_id where id = v_event_id;
      v_pushed := v_pushed + 1;
    else
      v_held := v_held + 1;
    end if;
  end loop;

  return jsonb_build_object(
    'changed', true, 'state', p_new_state,
    'pushed', v_pushed, 'held', v_held, 'capped', v_skipped
  );
end;
$$;

revoke all on function public.advance_setup_state(uuid, text, text, boolean, jsonb)
  from public, authenticated, anon;
