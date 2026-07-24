-- ============================================================================
-- 125 — LANE C6: Trade Alerts Hub (hybrid — Kai briefing broadcasts +
--                                  personalized watchlist/strategy engine).
--
-- FOUR tables + delivery plumbing, all education-first (compliance floor of the
-- club Kai profile — analysis, never personalized advice):
--
--   trade_alerts     — Kai briefing/broadcast alerts POSTed by the Railway
--                      breakout-alert-system (secret-guarded /api/alerts/ingest).
--   alert_rules      — a member's personalized conditions (price_cross, pct_move,
--                      vol_surge, rsi_cross, ema_cross, w52_break, preset_match).
--                      Capped at 20 ACTIVE per user (BEFORE-INSERT trigger guard).
--   alert_events     — one row per fire (a rule tripped, or a broadcast fanned
--                      out to this user). Carries delivery state (push|digest|none)
--                      + a payload snapshot so the Feed can show perf-since-issue.
--   strategy_profiles— the short strategy-builder answers (timeframe, setups,
--                      risk) that seed suggested rules.
--   alert_prefs      — per-user delivery prefs: briefing on/off (role default),
--                      instant-vs-digest, daily push cap, quiet hours.
--
-- DELIVERY reuses the 028 push pipe: a notification row (type 'alert') triggers
-- pg_net → /api/push/dispatch. We insert notifications ONLY for instant sends
-- (digest + capped fires are held); the daily digest cron sends one summary push.
--
-- RLS: own-row on the member-owned tables; trade_alerts is read-authenticated
-- (page gates who SEES the hub by tier/mode/role — kids never get the nav). All
-- fan-out / fire writes run through SECURITY DEFINER RPCs (service-role crons),
-- so no INSERT policy widens on notifications / alert_events for members.
-- ============================================================================

-- ── notifications: allow the 'alert' type (dispatch route maps it → title) ────
alter table notifications drop constraint if exists notifications_type_check;
alter table notifications add constraint notifications_type_check
  check (type in (
    'reply', 'mention', 'announcement', 'support_reply',
    'mention_everyone', 'new_pick', 'new_lesson', 'recording_posted',
    'broadcast', 'alert'
  ));

-- ── 1. trade_alerts (Kai broadcasts) ─────────────────────────────────────────
create table if not exists trade_alerts (
  id            uuid primary key default gen_random_uuid(),
  ticker        text not null,
  direction     text not null default 'watch'
                  check (direction in ('long', 'short', 'watch')),
  setup_label   text,
  entry         numeric,                 -- suggested study entry (nullable)
  levels        jsonb not null default '{}'::jsonb,   -- {support, resistance, stop, ...}
  targets       jsonb not null default '[]'::jsonb,   -- [{price, label}, ...]
  narrative     text,
  chart_url     text,
  source        text not null default 'kai_morning'
                  check (source in ('kai_morning', 'kai_intraday')),
  snapshot_price numeric,               -- price at issue (perf tracking base)
  issued_at     timestamptz not null default now(),
  created_at    timestamptz not null default now()
);

create index if not exists idx_trade_alerts_issued on trade_alerts(issued_at desc);
create index if not exists idx_trade_alerts_ticker on trade_alerts(ticker);

alter table trade_alerts enable row level security;

-- All authenticated members may READ (the /alerts page decides who is shown the
-- surface at all — tier/mode/role gating lives in the app + nav).
drop policy if exists "Read trade alerts" on trade_alerts;
create policy "Read trade alerts" on trade_alerts
  for select to authenticated using (true);

-- Writes: service role (ingest route) only.
revoke insert, update, delete on trade_alerts from authenticated, anon;

-- ── 2. alert_rules (personalized conditions) ─────────────────────────────────
create table if not exists alert_rules (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references profiles(id) on delete cascade,
  kind        text not null check (kind in (
                'price_cross', 'pct_move', 'vol_surge',
                'rsi_cross', 'ema_cross', 'w52_break', 'preset_match'
              )),
  ticker      text,                      -- nullable (preset_match spans the universe)
  params      jsonb not null default '{}'::jsonb,
  label       text not null default '',  -- human summary computed at create
  active      boolean not null default true,
  digest      boolean not null default false,  -- true = hold for daily digest
  surface     text not null default 'manual'
                  check (surface in ('screener', 'watchlist', 'research', 'strategy', 'manual')),
  state       jsonb not null default '{}'::jsonb,  -- engine bookkeeping (last_entrants, armed side…)
  last_fired_at timestamptz,
  created_at  timestamptz not null default now()
);

create index if not exists idx_alert_rules_user on alert_rules(user_id);
create index if not exists idx_alert_rules_active on alert_rules(kind) where active;
create index if not exists idx_alert_rules_ticker on alert_rules(ticker) where active and ticker is not null;

alter table alert_rules enable row level security;

drop policy if exists "Own alert rules" on alert_rules;
create policy "Own alert rules" on alert_rules
  for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- Cap: 20 ACTIVE rules per user. Trigger guard fires for EVERY writer (member
-- inserts AND a service-role seed), so the ceiling can never be bypassed.
create or replace function public.enforce_alert_rule_cap()
returns trigger
language plpgsql
as $$
declare
  v_active int;
begin
  -- Only count toward the cap when the row is (becoming) active.
  if new.active is not true then
    return new;
  end if;
  select count(*) into v_active
  from public.alert_rules
  where user_id = new.user_id
    and active
    and id <> new.id;
  if v_active >= 20 then
    raise exception 'alert rule cap reached (20 active)'
      using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_alert_rule_cap on alert_rules;
create trigger trg_alert_rule_cap
  before insert or update on alert_rules
  for each row execute function public.enforce_alert_rule_cap();

-- ── 3. alert_events (fires + broadcast fan-out) ──────────────────────────────
create table if not exists alert_events (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references profiles(id) on delete cascade,
  rule_id      uuid references alert_rules(id) on delete set null,
  alert_id     uuid references trade_alerts(id) on delete cascade,
  kind         text not null check (kind in ('rule', 'broadcast')),
  ticker       text not null,
  payload      jsonb not null default '{}'::jsonb,   -- {message, direction, snapshot_price, condition, delayed}
  delivered    text not null default 'none'
                  check (delivered in ('push', 'digest', 'none')),
  digest_sent_at timestamptz,
  notification_id uuid,
  fired_at     timestamptz not null default now(),
  created_at   timestamptz not null default now()
);

create index if not exists idx_alert_events_user_fired on alert_events(user_id, fired_at desc);
create index if not exists idx_alert_events_digest on alert_events(user_id)
  where delivered = 'digest' and digest_sent_at is null;
create index if not exists idx_alert_events_cap on alert_events(user_id, fired_at)
  where delivered = 'push';

alter table alert_events enable row level security;

drop policy if exists "Read own alert events" on alert_events;
create policy "Read own alert events" on alert_events
  for select to authenticated using (user_id = auth.uid());

-- Writes: service role (crons / ingest / fire RPCs) only.
revoke insert, update, delete on alert_events from authenticated, anon;

-- ── 4. strategy_profiles ─────────────────────────────────────────────────────
create table if not exists strategy_profiles (
  user_id      uuid primary key references profiles(id) on delete cascade,
  timeframe    text not null default 'swing'
                  check (timeframe in ('day', 'swing', 'position', 'longterm')),
  setup_prefs  text[] not null default '{}',
  risk_posture text not null default 'balanced'
                  check (risk_posture in ('conservative', 'balanced', 'aggressive')),
  updated_at   timestamptz not null default now()
);

alter table strategy_profiles enable row level security;

drop policy if exists "Own strategy profile" on strategy_profiles;
create policy "Own strategy profile" on strategy_profiles
  for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- ── 5. alert_prefs (per-user delivery prefs) ─────────────────────────────────
create table if not exists alert_prefs (
  user_id          uuid primary key references profiles(id) on delete cascade,
  -- NULL = use the ROLE default (club/individual → ON, family-adult → OFF, kids
  -- never eligible). A non-null value is the member's explicit override.
  briefing_enabled boolean,
  digest           boolean not null default false,   -- global instant(false)/digest(true) default
  daily_cap        int     not null default 10 check (daily_cap between 1 and 50),
  quiet_hours      boolean not null default true,     -- respect market-hours quiet logic
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

alter table alert_prefs enable row level security;

drop policy if exists "Own alert prefs" on alert_prefs;
create policy "Own alert prefs" on alert_prefs
  for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- ── 6. fire_rule_event — one personalized fire → event (+ optional push) ─────
-- Called by the evaluation crons (service role) when a rule's condition is met.
-- Encapsulates the delivery decision so both crons + the test-fire endpoint stay
-- consistent: digest-pref / rule-digest / daily-cap-exceeded ⇒ HOLD (delivered
-- 'digest'); otherwise send an instant push (notification row → 028 pg_net).
-- Idempotency + cooldown are the caller's job (last_fired_at); this records the
-- fire unconditionally. Returns the delivery mode.
create or replace function public.fire_rule_event(
  p_rule_id uuid,
  p_payload jsonb
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_rule       record;
  v_pref       record;
  v_today_push int;
  v_cap        int;
  v_digest_pref boolean;
  v_mode       text;
  v_event_id   uuid;
  v_notif_id   uuid;
  v_body       text;
  v_dir        text;
begin
  select id, user_id, ticker, digest, label into v_rule
  from alert_rules where id = p_rule_id;
  if not found then
    return 'none';
  end if;

  select coalesce(daily_cap, 10) as daily_cap, coalesce(digest, false) as digest
    into v_pref
  from alert_prefs where user_id = v_rule.user_id;
  v_cap := coalesce(v_pref.daily_cap, 10);
  v_digest_pref := coalesce(v_pref.digest, false);

  select count(*) into v_today_push
  from alert_events
  where user_id = v_rule.user_id
    and delivered = 'push'
    and fired_at >= date_trunc('day', now());

  if v_rule.digest or v_digest_pref or v_today_push >= v_cap then
    v_mode := 'digest';
  else
    v_mode := 'push';
  end if;

  insert into alert_events (user_id, rule_id, kind, ticker, payload, delivered, fired_at)
  values (v_rule.user_id, v_rule.id, 'rule',
          coalesce(p_payload->>'ticker', v_rule.ticker, '—'),
          p_payload, v_mode, now())
  returning id into v_event_id;

  if v_mode = 'push' then
    v_dir  := coalesce(p_payload->>'direction', '');
    v_body := left(coalesce(p_payload->>'message',
                v_rule.label), 140);
    insert into notifications (user_id, actor_id, type, body, link, ref_id)
    values (v_rule.user_id, null, 'alert', v_body, '/alerts', v_event_id)
    returning id into v_notif_id;
    update alert_events set notification_id = v_notif_id where id = v_event_id;
  end if;

  update alert_rules set last_fired_at = now() where id = v_rule.id;
  return v_mode;
end;
$$;

revoke all on function public.fire_rule_event(uuid, jsonb) from public, authenticated, anon;

-- ── 7. fanout_trade_alert — broadcast a Kai alert to the opted-in audience ────
-- Audience = PAYING ADULTS only (kids/teens NEVER). Solo/individual (club)
-- members are default-ON (briefing_enabled is null or true); family-mode adults
-- are default-OFF (briefing_enabled must be explicitly true). Per-user daily cap
-- + digest pref decide instant push vs held. Returns delivery counts.
create or replace function public.fanout_trade_alert(p_alert_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_alert   record;
  v_body    text;
  v_pushed  int := 0;
  v_held    int := 0;
  r         record;
  v_mode    text;
  v_event_id uuid;
  v_notif_id uuid;
  v_today_push int;
  v_cap     int;
begin
  select * into v_alert from trade_alerts where id = p_alert_id;
  if not found then
    return jsonb_build_object('error', 'alert not found');
  end if;

  v_body := left(
    v_alert.ticker || ' ' ||
    case v_alert.direction when 'long' then 'long' when 'short' then 'short' else 'watch' end ||
    case when v_alert.setup_label is not null then ' — ' || v_alert.setup_label else '' end,
    140);

  for r in
    select p.id as user_id,
           coalesce(ap.daily_cap, 10) as daily_cap,
           coalesce(ap.digest, false) as digest_pref,
           ap.briefing_enabled,
           -- solo verdict: completed family_profiles with a one-adult, no-kids household
           (fp.completed_at is not null
             and coalesce((fp.household->>'adults')::int, 1) <= 1
             and coalesce((fp.household->>'kids')::int, 0) = 0
             and coalesce(jsonb_array_length(fp.household->'kid_age_ranges'), 0) = 0
           ) as is_solo
    from profiles p
    join family_tiers ft on ft.family_id = p.family_id and ft.tier in ('fic', 'fta')
    left join family_profiles fp on fp.family_id = p.family_id
    left join alert_prefs ap on ap.user_id = p.id
    where
      -- ADULTS only — kids/teens are never eligible for briefing push.
      (p.age_group = 'adults'
        or (p.age_group is null and p.role in ('parent', 'admin', 'coach')))
      and coalesce(p.age_group, '') not in ('kids', 'teens')
      and p.role not in ('child', 'teen')
  loop
    -- Briefing eligibility by mode: club/individual default-ON; family-adult opt-in.
    if r.is_solo then
      if r.briefing_enabled is false then continue; end if;   -- explicit opt-out
    else
      if r.briefing_enabled is not true then continue; end if; -- opt-in required
    end if;

    v_cap := r.daily_cap;
    select count(*) into v_today_push
    from alert_events
    where user_id = r.user_id and delivered = 'push'
      and fired_at >= date_trunc('day', now());

    if r.digest_pref or v_today_push >= v_cap then
      v_mode := 'digest';
    else
      v_mode := 'push';
    end if;

    insert into alert_events (user_id, alert_id, kind, ticker, payload, delivered, fired_at)
    values (r.user_id, v_alert.id, 'broadcast', v_alert.ticker,
            jsonb_build_object(
              'message', v_body,
              'direction', v_alert.direction,
              'setup_label', v_alert.setup_label,
              'snapshot_price', v_alert.snapshot_price,
              'source', v_alert.source
            ),
            v_mode, v_alert.issued_at)
    returning id into v_event_id;

    if v_mode = 'push' then
      insert into notifications (user_id, actor_id, type, body, link, ref_id)
      values (r.user_id, null, 'alert', v_body, '/alerts', v_event_id)
      returning id into v_notif_id;
      update alert_events set notification_id = v_notif_id where id = v_event_id;
      v_pushed := v_pushed + 1;
    else
      v_held := v_held + 1;
    end if;
  end loop;

  return jsonb_build_object('alert_id', p_alert_id, 'pushed', v_pushed, 'held', v_held);
end;
$$;

revoke all on function public.fanout_trade_alert(uuid) from public, authenticated, anon;
