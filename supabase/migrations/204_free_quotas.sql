-- 204 — FREE-TIER QUOTAS, MADE SERVER-AUTHORITATIVE.
--
-- WHY. Every free meter in the app has, until now, been computed in the client:
-- the watchlist counted its own rows before showing the add sheet, Ask Kai
-- counted its own messages before sending, the screener decided for itself
-- whether "Save screen" was allowed. That is a UI courtesy, not a limit — a
-- member (or anything holding their anon key) can hit PostgREST directly and
-- walk straight past all three. The surfaces stay exactly as they are; this
-- migration puts the SAME numbers behind them in the database, so the client
-- meter is now a rendering of a rule rather than the rule itself.
--
-- IT ONLY EVER TIGHTENS. Nothing here deletes, pauses, or rewrites an existing
-- row — the watchlist cap is a BEFORE INSERT trigger, so an over-cap free family
-- (a challenge-pass holder past expiry) keeps every ticker they saved and simply
-- cannot add a sixth. PRESERVE-DON'T-DELETE (MONETIZATION-GATES.md) is intact.
-- Club/FTA families are untouched by every statement below.
--
-- Idempotent: create-or-replace throughout, `drop trigger if exists` before each
-- create, `drop policy if exists` before each policy.

-- ── 1. The one tier question all three quotas ask ────────────────────────────
-- Effective free = an explicit 'free' tier OR a lapsed FTA Club window, exactly
-- as reconcile_watchlist_active() (migration 144) computes it. A family with NO
-- family_tiers row is treated as FREE: this is a limit, so it fails CLOSED.
create or replace function public.family_is_free(p_family_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (
      select (ft.tier = 'free') or coalesce(ft.club_lapsed, false)
        from family_tiers ft
       where ft.family_id = p_family_id
    ),
    true  -- no row, or a null family_id → fail closed.
  );
$$;

grant execute on function public.family_is_free(uuid) to authenticated;

-- ── 2. The watchlist cap ─────────────────────────────────────────────────────
-- Free families actively monitor 5 tickers and may not save a 6th. Club/FTA are
-- unlimited, so the trigger returns immediately for them.
create or replace function public.enforce_free_watchlist_cap()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  -- Keep in lockstep with WATCHLIST_FREE_ACTIVE in
  -- src/lib/entitlements/features.ts (and v_cap in migration 144's
  -- reconcile_watchlist_active). Three places, one number: 5.
  v_cap int := 5;
  v_count int;
begin
  if new.family_id is null then
    return new;
  end if;

  if not public.family_is_free(new.family_id) then
    return new;  -- Club / FTA: no cap, nothing to check.
  end if;

  select count(*) into v_count
    from family_watchlist
   where family_id = new.family_id;

  if v_count >= v_cap then
    raise exception 'WATCHLIST_FREE_CAP'
      using errcode = 'check_violation',
            hint = 'The free plan holds 5 tickers. Remove one, or join the Club for an unlimited watchlist.';
  end if;

  return new;
end;
$$;

-- BEFORE INSERT only. There is deliberately no UPDATE or DELETE path here: a
-- free member must always be able to edit and remove what they already saved.
drop trigger if exists trg_enforce_free_watchlist_cap on family_watchlist;
create trigger trg_enforce_free_watchlist_cap
  before insert on family_watchlist
  for each row execute function public.enforce_free_watchlist_cap();

-- ── 3. The Ask Kai daily meter ───────────────────────────────────────────────
-- Returns the caller's own usage for TODAY as {"used": int, "cap": int,
-- "tier": text}. The day boundary is the UTC calendar day, matching the
-- created_at stamps on kai_chat_messages (migration 100) — one definition of
-- "today" for the counter and the rows it counts.
--
-- The caps mirror KAI_CHAT_DAILY_CAP in src/lib/kai/persona.ts exactly:
--   free 3 · fic 15 · fta 60
-- If that constant moves, this function moves with it.
create or replace function public.kai_quota_today()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_family uuid;
  v_tier text;
  v_cap int;
  v_used int;
begin
  if v_uid is null then
    return jsonb_build_object('used', 0, 'cap', 0, 'tier', 'free');
  end if;

  select p.family_id into v_family from profiles p where p.id = v_uid;

  select ft.tier into v_tier
    from family_tiers ft
   where ft.family_id = v_family;

  -- A lapsed Club window meters as free, same as everywhere else.
  if v_family is null or public.family_is_free(v_family) then
    v_tier := 'free';
  else
    v_tier := coalesce(v_tier, 'fic');
  end if;

  v_cap := case v_tier
             when 'fta' then 60   -- KAI_CHAT_DAILY_CAP.fta
             when 'fic' then 15   -- KAI_CHAT_DAILY_CAP.fic
             else 3               -- KAI_CHAT_DAILY_CAP.free
           end;

  select count(*) into v_used
    from kai_chat_messages
   where user_id = v_uid
     and role = 'user'
     and created_at >= date_trunc('day', now() at time zone 'utc')
     and created_at <  date_trunc('day', now() at time zone 'utc') + interval '1 day';

  return jsonb_build_object('used', coalesce(v_used, 0), 'cap', v_cap, 'tier', v_tier);
end;
$$;

grant execute on function public.kai_quota_today() to authenticated;

-- ── 4. Saved screens are a Club feature ──────────────────────────────────────
-- PRICING_MATRIX (src/lib/entitlements/features.ts) sells the screener to free
-- members as "Basic filters"; the full screener, AI search and SAVED SCANS are
-- Club. Migration 194 gave saved screens own-row + not-a-kid insert semantics
-- and both of those still hold — this only ADDS the tier clause. Select, update
-- and delete are untouched: a family that lapses keeps and can still remove the
-- screens it already saved (preserve-don't-delete), it just cannot save more.
drop policy if exists screener_saved_screens_insert on screener_saved_screens;
create policy screener_saved_screens_insert on screener_saved_screens
  for insert to authenticated
  with check (
    user_id = auth.uid()
    and not coalesce(public.viewer_is_kid(), false)
    and not coalesce(
      public.family_is_free((select p.family_id from profiles p where p.id = auth.uid())),
      true
    )
  );

-- ─────────────────────────────────────────────────────────────────────────────
-- NOT APPLIED. This file has been written and reviewed but has NOT been run
-- against any database — local, staging or production. Nothing in the app
-- depends on it yet, so applying it is a deliberate, separate step.
--
-- To apply, the owner runs ONE of:
--
--   1. CLI (preferred — records the migration in supabase_migrations):
--        cd fta-dashboard
--        npx supabase db push
--      (or `npx supabase db push --linked` if the project is linked but the
--       local stack is not running)
--
--   2. Dashboard, if the CLI is not set up:
--        Supabase → SQL Editor → New query → paste this entire file → Run.
--
-- AFTER APPLYING, verify:
--        select public.family_is_free('<a-known-free-family-uuid>');   -- t
--        select public.family_is_free('<a-known-club-family-uuid>');   -- f
--        select public.kai_quota_today();                              -- as the member
--      then, as a free family that already holds 5 tickers, an insert into
--      family_watchlist must fail with 'WATCHLIST_FREE_CAP' while the existing
--      5 rows remain exactly as they were.
-- ─────────────────────────────────────────────────────────────────────────────
