-- ============================================================================
-- 120 — Welcome email drip (Lane 13B)
--
-- A 5-email welcome sequence (D0/D1/D3/D5/D7) for NEW adult account holders. It
-- is enrolled server-side at wizard completion and sent by a daily Vercel cron
-- (see /api/cron/drip-welcome). Kid accounts NEVER receive drip mail — only the
-- parent / solo-adult owner (role = 'parent') is enrolled.
--
-- Pieces:
--   1. email_drips   — one row per (user, step). status/sent_at/resend_id make
--                      the whole pipeline idempotent (a step is sent at most
--                      once; re-running the cron is safe).
--   2. drip_optouts  — unsubscribing (HMAC link in the footer) records the user
--                      here, which suppresses remaining steps AND blocks any
--                      future re-enrollment.
--   3. app_settings 'drip_enabled' (DEFAULT false) — a HARD gate. While false
--      the cron sends nothing. The owner flips it to true after approving the
--      look. This is the "zero real-member sends until approved" guarantee.
--   4. enroll_welcome_drip() — security-definer, idempotent. Stamps the variant
--      (parent | solo | fta) from live tier + household at completion time and
--      schedules the 5 rows. One welcome sequence per user, ever.
--
-- RLS: simple own-or-admin SELECT; all writes happen via the definer function
-- (enrollment) or the service role (cron / unsubscribe route) — matching the
-- project's "simple SELECT + app gating + definer RPCs" posture.
-- ============================================================================

-- ── 1. email_drips ──────────────────────────────────────────────────────────
create table if not exists email_drips (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references profiles(id) on delete cascade,
  sequence     text not null default 'welcome',
  step         int  not null,                     -- D-day: 0, 1, 3, 5, 7
  variant      text not null check (variant in ('parent', 'solo', 'fta')),
  scheduled_at timestamptz not null,
  sent_at      timestamptz,
  resend_id    text,
  status       text not null default 'pending'
                 check (status in ('pending', 'sent', 'failed', 'skipped', 'suppressed')),
  error        text,
  created_at   timestamptz not null default now(),
  unique (user_id, sequence, step)               -- idempotent enrollment
);

create index if not exists idx_email_drips_due
  on email_drips (scheduled_at)
  where status = 'pending' and sent_at is null;
create index if not exists idx_email_drips_user on email_drips (user_id);

alter table email_drips enable row level security;
grant select on email_drips to authenticated;

drop policy if exists "email_drips own or admin read" on email_drips;
create policy "email_drips own or admin read" on email_drips
  for select using (
    user_id = auth.uid()
    or exists (select 1 from profiles where id = auth.uid() and role = 'admin')
  );

-- ── 2. drip_optouts ─────────────────────────────────────────────────────────
create table if not exists drip_optouts (
  user_id      uuid primary key references profiles(id) on delete cascade,
  opted_out_at timestamptz not null default now()
);

alter table drip_optouts enable row level security;
grant select on drip_optouts to authenticated;

drop policy if exists "drip_optouts own or admin read" on drip_optouts;
create policy "drip_optouts own or admin read" on drip_optouts
  for select using (
    user_id = auth.uid()
    or exists (select 1 from profiles where id = auth.uid() and role = 'admin')
  );

-- ── 3. feature flag (hard gate; cron sends nothing while false) ──────────────
insert into app_settings (key, value)
values ('drip_enabled', 'false'::jsonb)
on conflict (key) do nothing;

-- ── 4. enrollment (server-side, idempotent, one sequence per user ever) ─────
create or replace function enroll_welcome_drip()
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid     uuid := auth.uid();
  v_role    text;
  v_email   text;
  v_family  uuid;
  v_tier    text;
  v_house   jsonb;
  v_adults  int;
  v_kids    int;
  v_ranges  int;
  v_variant text;
  v_now     timestamptz := now();
  v_offsets int[] := array[0, 1, 3, 5, 7];
  v_step    int;
begin
  if v_uid is null then
    return 0;
  end if;

  -- Opted out earlier → never re-enroll.
  if exists (select 1 from drip_optouts where user_id = v_uid) then
    return 0;
  end if;

  -- Already enrolled → idempotent no-op (one welcome sequence per user ever).
  if exists (
    select 1 from email_drips where user_id = v_uid and sequence = 'welcome'
  ) then
    return 0;
  end if;

  select role, email, family_id
    into v_role, v_email, v_family
    from profiles where id = v_uid;

  -- Adults only. Solo adults and parents are BOTH role 'parent'; kids are
  -- role 'child' and are intentionally never enrolled.
  if v_role is distinct from 'parent' then
    return 0;
  end if;
  if v_email is null or position('@' in v_email) = 0 then
    return 0;
  end if;

  -- Live tier (fta > fic > free) and household shape at completion time.
  select tier into v_tier from family_tiers where family_id = v_family;
  select household into v_house from family_profiles where family_id = v_family;

  v_adults := coalesce((v_house->>'adults')::int, 1);
  v_kids   := coalesce((v_house->>'kids')::int, 0);
  v_ranges := coalesce(jsonb_array_length(v_house->'kid_age_ranges'), 0);

  -- Variant: FTA tier wins; a KNOWN one-adult/no-kids household is solo;
  -- everything else (incl. an unknown/empty household) keeps family framing.
  if v_tier = 'fta' then
    v_variant := 'fta';
  elsif (v_house ? 'adults') and v_adults <= 1 and v_kids = 0 and v_ranges = 0 then
    v_variant := 'solo';
  else
    v_variant := 'parent';
  end if;

  foreach v_step in array v_offsets loop
    insert into email_drips (user_id, sequence, step, variant, scheduled_at)
    values (
      v_uid, 'welcome', v_step, v_variant,
      v_now + (v_step || ' days')::interval
    )
    on conflict (user_id, sequence, step) do nothing;
  end loop;

  return array_length(v_offsets, 1);
end;
$$;

grant execute on function enroll_welcome_drip() to authenticated;
