-- 144 — Watchlist "active N" preserve-don't-delete cap (MONETIZATION-GATES.md).
--
-- Free tier ACTIVELY MONITORS 5 tickers; above that, rows are PRESERVED (never
-- deleted) with monitoring PAUSED. Club/FTA monitor everything. This is a FLAG /
-- ORDERING mechanism — no row is ever removed on downgrade — so a returning
-- member's whole watchlist is intact ("26 stocks saved · monitors 5 · upgrade to
-- reactivate all 26").
--
-- family_watchlist.wl_active is the authoritative "is this ticker monitored"
-- flag that the Kai Watch / alert-evaluation crons can honour (skip paused rows).
-- Default TRUE so nothing changes for existing/Club families; reconcile_watchlist
-- pauses the newest-over-cap rows for free/lapsed families and re-activates all
-- of them the moment Club is restored.

alter table family_watchlist
  add column if not exists wl_active boolean not null default true;

-- Reconcile the active flags for ONE family against its effective Club tier.
-- Idempotent; safe to call from the challenge-expiry / club-clock crons on
-- downgrade AND on re-activation. Free/lapsed → oldest 5 active, rest paused.
-- Club/FTA (not lapsed) → all active. Never deletes.
create or replace function public.reconcile_watchlist_active(p_family_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_cap int := 5;                -- WATCHLIST_FREE_ACTIVE
  v_tier text;
  v_lapsed boolean;
  v_free boolean;
begin
  if p_family_id is null then return; end if;

  select ft.tier, coalesce(ft.club_lapsed, false)
    into v_tier, v_lapsed
    from family_tiers ft where ft.family_id = p_family_id;

  -- Effective free: explicit free tier, or a lapsed FTA Club window.
  v_free := (v_tier = 'free') or coalesce(v_lapsed, false);

  if not v_free then
    -- Club/FTA — everything is monitored.
    update family_watchlist set wl_active = true
     where family_id = p_family_id and wl_active is distinct from true;
    return;
  end if;

  -- Free/lapsed — the oldest v_cap stay active, the rest are paused (preserved).
  with ranked as (
    select id,
           row_number() over (order by created_at asc, id asc) as rn
      from family_watchlist
     where family_id = p_family_id
  )
  update family_watchlist w
     set wl_active = (r.rn <= v_cap)
    from ranked r
   where w.id = r.id
     and w.wl_active is distinct from (r.rn <= v_cap);
end;
$$;

grant execute on function public.reconcile_watchlist_active(uuid) to authenticated;
