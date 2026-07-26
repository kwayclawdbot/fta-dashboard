-- ============================================================================
-- 157 — LANE A (Kai Watch): the WATCH-STATE MACHINE + honest freshness.
--
-- The evaluate-alerts crons already compute each active rule's underlying
-- condition every cycle and discard anything that didn't fully trigger. This
-- migration lets them KEEP that signal as a state:
--
--     watching → building → near_trigger → triggered | cooled | invalidated
--                                        (+ earnings_wait when derivable)
--
--   watch_states       — one row per STATE TRANSITION (append-only log). The
--                        current state of a watch is simply its latest row.
--   alert_rules.last_checked_at — stamped every evaluation cycle so the UI can
--                        show a REAL "last checked" time, never a faked one.
--   alert_events kind 'kai_update' — a plain-language progress line written into
--                        the SAME feed storage the hub already renders.
--   emit_watch_update() — the cadence-capped writer: max 2 updates/day per watch,
--                        quiet-hours + digest routed through the existing plumbing.
--
-- Deterministic + zero-LLM: state is derived in src/lib/alerts/watch-state.ts
-- (named-constant thresholds); this migration is only the storage + delivery.
-- All writes go through the SECURITY DEFINER emitter (service-role crons); no
-- member INSERT policy widens on watch_states / alert_events / notifications.
-- ============================================================================

-- ── 0. honest freshness: when did the cron last look at this watch? ──────────
alter table alert_rules add column if not exists last_checked_at timestamptz;

-- ── 1. widen alert_events.kind to carry progress updates ─────────────────────
alter table alert_events drop constraint if exists alert_events_kind_check;
alter table alert_events add constraint alert_events_kind_check
  check (kind in ('rule', 'broadcast', 'kai_update'));

-- ── 2. watch_states: append-only transition log ──────────────────────────────
create table if not exists watch_states (
  id         uuid primary key default gen_random_uuid(),
  rule_id    uuid not null references alert_rules(id) on delete cascade,
  state      text not null check (state in (
               'watching', 'building', 'near_trigger', 'triggered',
               'cooled', 'invalidated', 'earnings_wait'
             )),
  entered_at timestamptz not null default now(),
  detail     jsonb not null default '{}'::jsonb,   -- {progress, condition, metric, price…}
  created_at timestamptz not null default now()
);

create index if not exists idx_watch_states_rule on watch_states(rule_id, entered_at desc);

alter table watch_states enable row level security;

-- Owner-read (join the rule); writes are service-role only.
drop policy if exists "Read own watch states" on watch_states;
create policy "Read own watch states" on watch_states
  for select to authenticated
  using (exists (
    select 1 from alert_rules r
    where r.id = watch_states.rule_id and r.user_id = auth.uid()
  ));

revoke insert, update, delete on watch_states from authenticated, anon;

-- Convenience: the CURRENT state per watch (latest transition). security_invoker
-- so the base-table RLS above still applies to the querying member.
create or replace view watch_current_state
  with (security_invoker = true) as
select distinct on (rule_id)
  rule_id, state, entered_at, detail
from watch_states
order by rule_id, entered_at desc;

-- ── 3. emit_watch_update — cadence-capped progress writer ─────────────────────
-- Called by the crons AFTER they have recorded a transition in watch_states, for
-- the feed-worthy states only (building / near_trigger / cooled / invalidated /
-- earnings_wait — never 'watching' baseline, never 'triggered' which the real
-- alert fire already covers). Enforces the BINDING cadence discipline:
--
--   • max 2 kai_update rows per watch per day (any delivery) → 3rd+ suppressed.
--   • push_worthy=false → feed-only ('none'): ambient, never interrupts, so quiet
--     hours are honoured by construction.
--   • push_worthy=true (near_trigger) → routed through the SAME digest / quiet-
--     hours / daily-cap logic as fire_rule_event: digest pref OR quiet_hours OR
--     over the daily push cap ⇒ held as 'digest' (collapses into the daily
--     digest), else an instant push.
--
-- Returns the delivery mode: 'push' | 'digest' | 'none' | 'capped'.
create or replace function public.emit_watch_update(
  p_rule_id     uuid,
  p_state       text,
  p_ticker      text,
  p_message     text,
  p_condition   text,
  p_push_worthy boolean default false
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_rule        record;
  v_today_upd   int;
  v_today_push  int;
  v_cap         int;
  v_digest_pref boolean;
  v_quiet       boolean;
  v_mode        text;
  v_event_id    uuid;
  v_notif_id    uuid;
  v_body        text;
begin
  select id, user_id, ticker, label into v_rule
  from alert_rules where id = p_rule_id;
  if not found then
    return 'none';
  end if;

  -- CADENCE CAP: max 2 progress updates per watch per day (any delivery mode).
  select count(*) into v_today_upd
  from alert_events
  where user_id = v_rule.user_id
    and rule_id = v_rule.id
    and kind = 'kai_update'
    and fired_at >= date_trunc('day', now());
  if v_today_upd >= 2 then
    return 'capped';
  end if;

  select coalesce(daily_cap, 10), coalesce(digest, false), coalesce(quiet_hours, true)
    into v_cap, v_digest_pref, v_quiet
  from alert_prefs where user_id = v_rule.user_id;
  v_cap := coalesce(v_cap, 10);
  v_digest_pref := coalesce(v_digest_pref, false);
  v_quiet := coalesce(v_quiet, true);

  if not coalesce(p_push_worthy, false) then
    v_mode := 'none';                         -- ambient feed item, never notifies
  else
    select count(*) into v_today_push
    from alert_events
    where user_id = v_rule.user_id
      and delivered = 'push'
      and fired_at >= date_trunc('day', now());
    if v_digest_pref or v_quiet or v_today_push >= v_cap then
      v_mode := 'digest';                     -- collapses into the daily digest
    else
      v_mode := 'push';
    end if;
  end if;

  insert into alert_events (user_id, rule_id, kind, ticker, payload, delivered, fired_at)
  values (
    v_rule.user_id, v_rule.id, 'kai_update',
    coalesce(nullif(p_ticker, ''), v_rule.ticker, '—'),
    jsonb_build_object(
      'message', p_message,
      'condition', p_condition,
      'state', p_state,
      'watch_update', true
    ),
    v_mode, now()
  )
  returning id into v_event_id;

  if v_mode = 'push' then
    v_body := left(coalesce(nullif(p_message, ''), v_rule.label), 140);
    insert into notifications (user_id, actor_id, type, body, link, ref_id)
    values (v_rule.user_id, null, 'alert', v_body, '/alerts', v_event_id)
    returning id into v_notif_id;
    update alert_events set notification_id = v_notif_id where id = v_event_id;
  end if;

  return v_mode;
end;
$$;

revoke all on function public.emit_watch_update(uuid, text, text, text, text, boolean)
  from public, authenticated, anon;
