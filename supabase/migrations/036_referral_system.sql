-- ============================================================================
-- 036 — Parent referral system (v1: shareable links + attribution + XP credit)
--
-- Scope (per .planning/AFFILIATE-PLAN.md Phase-1 "S" core): shareable referral
-- links, click/signup attribution, and XP credit to the referring parent.
-- Percent revenue-share / commissions / payouts are DEFERRED (Phase 2+).
--
-- Design:
--   * referral_codes  — one permanent, readable code per parent (lazy-created).
--   * referral_events — click + signup funnel log (referred_user_id null=click).
--   * profiles.referred_by — first-touch denormalized pointer to the referrer.
--   * attach_referral() SECURITY DEFINER RPC — writes attribution + signup event
--     + awards the referrer +100 XP (once per referred family) + emits a
--     Clubhouse "referral_welcome" activity card. Forge-proof: the referred user
--     is auth.uid() (the just-verified session), never client input.
--
-- RLS SCARS (018/019): keep policies SIMPLE and non-recursive. referral_events
-- is NOT in the realtime publication, so its SELECT policy may safely subquery
-- referral_codes (a different table, no self-reference). Inserts are server-side
-- only (service role / SECURITY DEFINER), so there is deliberately NO
-- authenticated INSERT policy — clients can never forge clicks/signups.
-- ============================================================================

-- ── 1. profiles.referred_by (first-touch attribution pointer) ────────────────
alter table profiles
  add column if not exists referred_by uuid references profiles(id) on delete set null;

create index if not exists idx_profiles_referred_by on profiles(referred_by);

-- ── 2. referral_codes (one permanent code per parent) ────────────────────────
create table if not exists referral_codes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references profiles(id) on delete cascade,
  code text not null unique,
  created_at timestamptz not null default now()
);
create index if not exists idx_referral_codes_code on referral_codes(code);

alter table referral_codes enable row level security;

-- Owner reads own code (simple, non-recursive).
drop policy if exists "Read own referral code" on referral_codes;
create policy "Read own referral code" on referral_codes
  for select to authenticated using (user_id = auth.uid());
-- No insert/update/delete policy → codes are minted only by the SECURITY
-- DEFINER RPC below (get_or_create_referral_code), never by a raw client write.

-- ── 3. referral_events (click + signup funnel) ───────────────────────────────
create table if not exists referral_events (
  id uuid primary key default gen_random_uuid(),
  code text not null,
  kind text not null check (kind in ('click', 'signup')),
  referred_user_id uuid references profiles(id) on delete set null, -- null for clicks
  created_at timestamptz not null default now()
);
create index if not exists idx_referral_events_code on referral_events(code, kind);
create index if not exists idx_referral_events_referred on referral_events(referred_user_id);

alter table referral_events enable row level security;

-- Owner reads events for their own code (subquery ok — not a realtime table).
drop policy if exists "Read own referral events" on referral_events;
create policy "Read own referral events" on referral_events
  for select to authenticated using (
    code in (select code from referral_codes where user_id = auth.uid())
  );
-- No authenticated INSERT policy → events written server-side only (the /r/[code]
-- click route uses the service-role client; signup events via attach_referral()).

-- ── 4. Readable slug generator ───────────────────────────────────────────────
-- Format: FAMILYWORD-XXXX, uppercase, ambiguous chars (0/O/1/I/L/U) stripped.
create or replace function public._referral_slug(p_user uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_fam text;
  v_base text;
  v_suffix text;
  v_code text;
  v_alpha text := 'ABCDEFGHJKMNPQRSTVWXYZ23456789';  -- no 0 O 1 I L U
  i int;
  attempts int := 0;
begin
  select f.name into v_fam
  from profiles p
  left join families f on f.id = p.family_id
  where p.id = p_user;

  v_base := upper(regexp_replace(coalesce(split_part(v_fam, ' ', 1), ''), '[^A-Za-z0-9]', '', 'g'));
  v_base := left(v_base, 8);
  if v_base = '' then v_base := 'FAMILY'; end if;

  loop
    v_suffix := '';
    for i in 1..4 loop
      v_suffix := v_suffix || substr(v_alpha, 1 + floor(random() * length(v_alpha))::int, 1);
    end loop;
    v_code := v_base || '-' || v_suffix;
    exit when not exists (select 1 from referral_codes where code = v_code);
    attempts := attempts + 1;
    if attempts > 25 then
      v_code := v_base || '-' || v_suffix || substr(md5(random()::text), 1, 3);
      exit;
    end if;
  end loop;

  return v_code;
end;
$$;

-- ── 5. get_or_create_referral_code() — parent/admin only ─────────────────────
create or replace function public.get_or_create_referral_code()
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role text;
  v_code text;
begin
  select role into v_role from profiles where id = auth.uid();
  if v_role is null or v_role not in ('parent', 'admin') then
    return null;  -- minors never get a code (child-safety, plan §5)
  end if;

  select code into v_code from referral_codes where user_id = auth.uid();
  if v_code is not null then
    return v_code;
  end if;

  v_code := public._referral_slug(auth.uid());
  insert into referral_codes (user_id, code)
  values (auth.uid(), v_code)
  on conflict (user_id) do nothing;

  select code into v_code from referral_codes where user_id = auth.uid();
  return v_code;
end;
$$;
grant execute on function public.get_or_create_referral_code() to authenticated;

-- ── 6. attach_referral(code) — attribution + XP + activity card ──────────────
-- Called server-side from the auth confirm/callback handlers with the referral
-- cookie value. The referred user is auth.uid() (the just-verified session), so
-- attribution cannot be forged. Idempotent + self/same-family guarded.
create or replace function public.attach_referral(p_code text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_referred uuid := auth.uid();
  v_code text := upper(nullif(trim(p_code), ''));
  v_referrer uuid;
  v_ref_family uuid;
  v_family uuid;
  v_existing uuid;
begin
  if v_referred is null or v_code is null then
    return jsonb_build_object('ok', false, 'reason', 'no_session_or_code');
  end if;

  select user_id into v_referrer from referral_codes where code = v_code;
  if v_referrer is null then
    return jsonb_build_object('ok', false, 'reason', 'unknown_code');
  end if;

  -- Self-referral guard.
  if v_referrer = v_referred then
    return jsonb_build_object('ok', false, 'reason', 'self_referral');
  end if;

  select family_id into v_family from profiles where id = v_referred;
  select family_id into v_ref_family from profiles where id = v_referrer;

  -- Same-family guard (a kid joining the referrer's own family is not a referral).
  if v_family is not null and v_family = v_ref_family then
    return jsonb_build_object('ok', false, 'reason', 'same_family');
  end if;

  -- Idempotency: attribution is first-touch and locked once set.
  select referred_by into v_existing from profiles where id = v_referred;
  if v_existing is not null then
    return jsonb_build_object('ok', true, 'reason', 'already_attributed');
  end if;

  update profiles set referred_by = v_referrer
  where id = v_referred and referred_by is null;

  -- Signup event + XP award, once per referred user.
  if not exists (
    select 1 from referral_events
    where kind = 'signup' and referred_user_id = v_referred
  ) then
    insert into referral_events (code, kind, referred_user_id)
    values (v_code, 'signup', v_referred);

    -- +100 XP to the referrer (reuse existing 'bonus' kind — no CHECK change,
    -- additive-safe per the project's additive-build rule). Once per referred
    -- family via the ref_id de-dupe key.
    if not exists (
      select 1 from xp_events
      where user_id = v_referrer
        and kind = 'bonus'
        and ref_id = 'referral:signup:' || v_referred::text
    ) then
      insert into xp_events (user_id, amount, kind, ref_id)
      values (v_referrer, 100, 'bonus', 'referral:signup:' || v_referred::text);
    end if;

    -- Clubhouse activity card (cheap — reuses the 034 _feed_activity helper).
    begin
      perform public._feed_activity(
        v_referrer, v_ref_family, 'referral_welcome', 'sparkles',
        'a new family', 'welcomed to the club'
      );
    exception when others then
      null;  -- never block attribution on a feed hiccup
    end;
  end if;

  return jsonb_build_object('ok', true, 'reason', 'attributed');
end;
$$;
grant execute on function public.attach_referral(text) to authenticated;
