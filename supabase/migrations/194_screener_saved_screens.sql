-- 194 — SAVED SCREENS: the canvas's "Save screen" control, given a real table.
--
-- WHY THIS EXISTS. Canvas v2 board 15 (Discover · Screener) draws "Save screen"
-- on the results header, next to "14 MATCHES · SORTED BY CLUB SIGNAL". The
-- shipped screener had no persistence of any kind: a member could build a nine-
-- filter screen, navigate away, and lose it. Shipping the control against a
-- no-op — or against localStorage, which is per-device and silently forgets —
-- would be a control that persists nothing, so it gets a table.
--
-- AUDITED FIRST — nothing existing is a saved screen:
--   • screener_metrics / screener_meta (mig ~130) — the UNIVERSE and its refresh
--     stamp. Read-only market data, no per-member rows at all.
--   • family_watchlist / community_watchlist    — a chosen TICKER with a
--     champion and a snapshot price. A screen is a QUERY, not a holding, and
--     the two have no overlapping columns.
--   • alert_rules (preset_match kind)           — closest neighbour: it already
--     stores a PRESET ID so the member can be notified when new names enter a
--     built-in screen. But it can only reference one of the five hardcoded
--     presets; it cannot carry an arbitrary filter set, and an alert is a
--     delivery rule, not a saved view. Deliberately left untouched.
-- So: one new table. Nothing existing is altered.
--
-- WHY jsonb FOR THE FILTERS. The filter set is `CustomFilters` in
-- src/lib/screener.ts — ~20 optional scalar keys that the preset buttons, the
-- plain-English parser (src/lib/screener-nl.ts) and the filter panel ALL write
-- through. Modelling them as columns would mean a migration every time a filter
-- is added and would fork the one shape those three producers share. The screen
-- is re-applied by handing the blob straight back to the same client-side
-- matcher that produced it, so the blob IS the contract. It is bounded by a
-- size check below so the column can never be used as general storage.
--
-- KID WALL. /screener redirects kids server-side and migration 137 closed the
-- data door with viewer_is_kid(). This table uses the SAME definer, so a kid
-- cannot save, list or apply a screen even by hitting PostgREST directly.
--
-- NO SHARING. Screens are private to their author. A shared screen would be a
-- member publishing a stock list to other members, which is a different product
-- decision (and a compliance one) than remembering your own filters.

create table if not exists screener_saved_screens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  -- The member's own label. Short on purpose: it renders as a chip in a rail.
  name text not null check (char_length(btrim(name)) between 1 and 48),
  -- The CustomFilters object, verbatim. Must be an OBJECT (not an array or a
  -- scalar) and is size-capped so this cannot become a document store.
  filters jsonb not null default '{}'::jsonb,
  constraint screener_saved_screens_filters_shape
    check (jsonb_typeof(filters) = 'object' and pg_column_size(filters) <= 4096),
  -- The sort the screen was saved under, so re-applying restores the whole view
  -- and not just the filter set. Validated against the surface's SortKey union.
  sort_key text not null default 'like_count' check (
    sort_key in (
      'ticker', 'price', 'chg_1d', 'chg_5d', 'chg_1m', 'chg_3m',
      'vol_ratio', 'mcap', 'rsi14', 'like_count'
    )
  ),
  sort_dir text not null default 'desc' check (sort_dir in ('asc', 'desc')),
  created_at timestamptz not null default now(),
  -- Bumped every time the screen is applied, so the rail can order by recency
  -- rather than by creation and a screen used daily stays first.
  used_at timestamptz not null default now(),
  -- One name per member: saving under an existing name UPDATES that screen,
  -- which is what "Save screen" means when the name already exists.
  unique (user_id, name)
);

create index if not exists idx_screener_saved_screens_user
  on screener_saved_screens(user_id, used_at desc);

-- ── Per-member cap ──────────────────────────────────────────────────────────
-- A rail of chips stops being navigable well before 20, and an uncapped
-- own-row insert policy is an unbounded write. Enforced in a trigger rather
-- than a check because the rule spans rows.
create or replace function public.screener_saved_screens_cap()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if (select count(*) from screener_saved_screens where user_id = new.user_id) >= 20 then
    raise exception 'screen limit reached'
      using hint = 'Delete a saved screen before adding another.';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_screener_saved_screens_cap on screener_saved_screens;
create trigger trg_screener_saved_screens_cap
  before insert on screener_saved_screens
  for each row execute function public.screener_saved_screens_cap();

-- ── RLS: own rows only, and never a kid ─────────────────────────────────────
alter table screener_saved_screens enable row level security;

drop policy if exists screener_saved_screens_select on screener_saved_screens;
create policy screener_saved_screens_select on screener_saved_screens
  for select to authenticated
  using (user_id = auth.uid() and not coalesce(public.viewer_is_kid(), false));

drop policy if exists screener_saved_screens_insert on screener_saved_screens;
create policy screener_saved_screens_insert on screener_saved_screens
  for insert to authenticated
  with check (user_id = auth.uid() and not coalesce(public.viewer_is_kid(), false));

drop policy if exists screener_saved_screens_update on screener_saved_screens;
create policy screener_saved_screens_update on screener_saved_screens
  for update to authenticated
  using (user_id = auth.uid() and not coalesce(public.viewer_is_kid(), false))
  with check (user_id = auth.uid());

drop policy if exists screener_saved_screens_delete on screener_saved_screens;
create policy screener_saved_screens_delete on screener_saved_screens
  for delete to authenticated
  using (user_id = auth.uid());

grant select, insert, update, delete on screener_saved_screens to authenticated;
