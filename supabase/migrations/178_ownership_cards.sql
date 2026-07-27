-- ============================================================================
-- 178 — CHEAT CODE OWNERSHIP CARDS (Phase 0: Digital Collection MVP).
--
-- The physical-collectible layer over long-term ownership. A card is a TITLE,
-- not a bearer instrument: the app is the registry, the brokerage is the vault.
-- Phase 0 ships MANUAL-FIRST minting (user self-reports symbol/qty/avg price/
-- date; card values still go live via Polygon) behind a PositionProvider
-- abstraction — SnapTrade slots in when SNAPTRADE_CONSUMER_KEY lands.
--
-- Additive only (additive-build pattern): brand-new tables, zero changes to any
-- existing Kai/Club production path. Contract lives in src/lib/ownership/types.ts.
--
-- Tables
--   ownership_cards  — one card per minted position; acquisition basis frozen at
--                      mint; `design_state` jsonb caches the current visual era
--                      (CardDesignState). serial = CC-S01-<zero-padded seq>.
--   card_events      — APPEND-ONLY provenance log (trigger blocks UPDATE/DELETE).
--   card_snapshots   — value + full design_state at issue / each milestone /
--                      yearly anniversary, for faithful historical re-render.
--   asset_prices     — per-symbol per-day EOD close cache so the collection page
--                      and cron never hammer Polygon.
--
-- Writes go through SECURITY DEFINER RPCs only (no raw table writes from clients):
--   mint_card / report_seal_broken / retire_card   — owner-scoped (authenticated)
--   record_card_milestone                          — cron only (service_role)
--   public_card_view(serial)                       — anon-callable public projection
--
-- RLS: owners read their own cards/events/snapshots; the public scan route reads
-- ONLY through public_card_view (never basis/account data).
-- ============================================================================

-- ── serial sequence: CC-S01-000001, CC-S01-000002, … (custody-agnostic) ──────
create sequence if not exists ownership_card_serial_seq start 1;

-- ── 1. ownership_cards ───────────────────────────────────────────────────────
create table if not exists ownership_cards (
  id                    uuid primary key default gen_random_uuid(),
  serial                text unique not null
                          default ('CC-S01-' || lpad(nextval('ownership_card_serial_seq')::text, 6, '0')),
  owner_id              uuid not null references auth.users(id) on delete cascade,
  asset_symbol          text not null,
  asset_name            text,
  asset_type            text not null check (asset_type in ('stock', 'etf', 'crypto')),
  denomination          numeric not null,                 -- original units, never mutated
  series                text not null default 'digital',
  edition               int,
  edition_size          int,
  rarity                text,
  status                text not null default 'active'
                          check (status in ('draft', 'active', 'in_transfer', 'seal_broken', 'retired')),
  -- provider: 'manual' = self-reported (Phase 0), 'snaptrade' = verified (later)
  provider              text not null default 'manual'
                          check (provider in ('manual', 'snaptrade')),
  -- acquisition (frozen at mint)
  acq_quantity          numeric not null,
  acq_avg_price         numeric not null,
  acq_original_value    numeric not null,
  acq_at                timestamptz not null,
  -- bindings
  snaptrade_account_id  text,
  brokerage_position_ref text,                            -- lot/position identifier where available
  nfc_uid               text unique,                      -- null until physical bind (Phase 2)
  -- visual era cache (shape = CardDesignState in types.ts)
  design_state          jsonb not null
                          default '{"holdTier":"issued","valueClubs":[],"series":"digital","rarity":null,"designRev":1}'::jsonb,
  -- optional public holder label (Phase 1 gifting) — first name + last initial only
  holder_first_name     text,
  holder_last_initial   text,
  activated_at          timestamptz not null default now(),
  created_at            timestamptz not null default now()
);

create index if not exists idx_ownership_cards_owner  on ownership_cards(owner_id);
create index if not exists idx_ownership_cards_symbol on ownership_cards(asset_symbol);
create index if not exists idx_ownership_cards_status on ownership_cards(status);

alter table ownership_cards enable row level security;

-- Owners READ their own cards. All writes go through the SECURITY DEFINER RPCs
-- below (status transitions never happen via a raw UPDATE), so authenticated/anon
-- get no direct write grant.
drop policy if exists "Owner reads own cards" on ownership_cards;
create policy "Owner reads own cards" on ownership_cards
  for select to authenticated using (owner_id = auth.uid());

revoke insert, update, delete on ownership_cards from authenticated, anon;

-- ── 2. card_events (append-only provenance) ──────────────────────────────────
create table if not exists card_events (
  id          bigint generated always as identity primary key,
  card_id     uuid not null references ownership_cards(id) on delete cascade,
  kind        text not null check (kind in (
                'activated', 'milestone_value', 'milestone_age', 'dividend',
                'split', 'transfer_out', 'transfer_in', 'seal_broken',
                'retired', 'snapshot', 'gifted')),
  payload     jsonb not null default '{}'::jsonb,
  occurred_at timestamptz not null default now()
);

create index if not exists idx_card_events_card on card_events(card_id, occurred_at desc);

alter table card_events enable row level security;

drop policy if exists "Owner reads own card events" on card_events;
create policy "Owner reads own card events" on card_events
  for select to authenticated using (
    exists (select 1 from ownership_cards c where c.id = card_events.card_id and c.owner_id = auth.uid())
  );

revoke insert, update, delete on card_events from authenticated, anon;

-- ── 3. card_snapshots (value + design era, faithful re-render) ────────────────
create table if not exists card_snapshots (
  id           bigint generated always as identity primary key,
  card_id      uuid not null references ownership_cards(id) on delete cascade,
  label        text not null,                             -- issue | year_1 | milestone_25 | …
  value        numeric not null,
  design_state jsonb not null,                            -- badges/border era for faithful re-render
  taken_at     timestamptz not null default now()
);

create index if not exists idx_card_snapshots_card on card_snapshots(card_id, taken_at desc);

alter table card_snapshots enable row level security;

drop policy if exists "Owner reads own card snapshots" on card_snapshots;
create policy "Owner reads own card snapshots" on card_snapshots
  for select to authenticated using (
    exists (select 1 from ownership_cards c where c.id = card_snapshots.card_id and c.owner_id = auth.uid())
  );

revoke insert, update, delete on card_snapshots from authenticated, anon;

-- ── 4. asset_prices (per-symbol per-day EOD close cache) ─────────────────────
create table if not exists asset_prices (
  symbol     text not null,
  as_of      date not null,
  close      numeric not null,
  asset_type text not null default 'stock' check (asset_type in ('stock', 'etf', 'crypto')),
  source     text not null default 'polygon',
  updated_at timestamptz not null default now(),
  primary key (symbol, as_of)
);

alter table asset_prices enable row level security;

-- Prices are non-sensitive market data: any authenticated member (and the anon
-- public scan route) may read the cache. Writes are service-role only (the cron /
-- pricing layer upserts via the admin client, which bypasses RLS).
drop policy if exists "Anyone reads price cache" on asset_prices;
create policy "Anyone reads price cache" on asset_prices
  for select to authenticated, anon using (true);

revoke insert, update, delete on asset_prices from authenticated, anon;

-- ── 5. append-only guard: block UPDATE/DELETE on the provenance logs ──────────
-- UPDATE is ALWAYS blocked (editing history = tampering). DELETE is blocked too,
-- EXCEPT when an explicit maintenance session opts in via
--   set local ownership.allow_purge = 'on';
-- That escape hatch exists only for total erasure (GDPR account deletion via the
-- auth.users cascade, or demo-seed cleanup) — never rewriting a surviving log.
-- App paths can't reach it: authenticated/anon have no DELETE grant at all, and
-- the GUC defaults off, so even service_role can't accidentally drop provenance.
create or replace function public.ownership_block_mutation()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'DELETE'
     and coalesce(current_setting('ownership.allow_purge', true), 'off') = 'on' then
    return old;
  end if;
  raise exception 'card provenance is append-only: % on % is not allowed', tg_op, tg_table_name;
end;
$$;

drop trigger if exists trg_card_events_append_only on card_events;
create trigger trg_card_events_append_only
  before update or delete on card_events
  for each row execute function public.ownership_block_mutation();

drop trigger if exists trg_card_snapshots_append_only on card_snapshots;
create trigger trg_card_snapshots_append_only
  before update or delete on card_snapshots
  for each row execute function public.ownership_block_mutation();

-- ── 6. mint_card — create a card + 'activated' event + 'issue' snapshot ───────
-- Atomic: one call frms the basis, stamps provenance, and captures the issue
-- snapshot. owner_id is always auth.uid() (never a client-supplied value).
create or replace function public.mint_card(
  p_symbol       text,
  p_asset_name   text,
  p_asset_type   text,
  p_quantity     numeric,
  p_avg_price    numeric,
  p_acquired_at  timestamptz,
  p_provider     text default 'manual',
  p_position_ref text default null,
  p_snaptrade_account_id text default null
)
returns ownership_cards
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid   uuid := auth.uid();
  v_value numeric;
  v_card  ownership_cards;
  v_design jsonb;
begin
  if v_uid is null then
    raise exception 'not authenticated';
  end if;
  if p_quantity is null or p_quantity <= 0 then
    raise exception 'quantity must be positive';
  end if;
  if p_avg_price is null or p_avg_price <= 0 then
    raise exception 'average price must be positive';
  end if;
  if p_acquired_at is null or p_acquired_at > now() then
    raise exception 'acquired_at must not be in the future';
  end if;
  if p_asset_type not in ('stock', 'etf', 'crypto') then
    raise exception 'invalid asset_type';
  end if;
  if coalesce(p_provider, 'manual') not in ('manual', 'snaptrade') then
    raise exception 'invalid provider';
  end if;

  v_value := round(p_quantity * p_avg_price, 2);
  v_design := jsonb_build_object(
    'holdTier', 'issued',
    'valueClubs', '[]'::jsonb,
    'series', 'digital',
    'rarity', null,
    'designRev', 1
  );

  insert into ownership_cards (
    owner_id, asset_symbol, asset_name, asset_type, denomination,
    acq_quantity, acq_avg_price, acq_original_value, acq_at,
    provider, brokerage_position_ref, snaptrade_account_id, design_state
  )
  values (
    v_uid, upper(p_symbol), p_asset_name, p_asset_type, p_quantity,
    p_quantity, p_avg_price, v_value, p_acquired_at,
    coalesce(p_provider, 'manual'), p_position_ref, p_snaptrade_account_id, v_design
  )
  returning * into v_card;

  insert into card_events (card_id, kind, payload, occurred_at)
  values (v_card.id, 'activated', jsonb_build_object(
    'symbol', v_card.asset_symbol,
    'quantity', p_quantity,
    'averagePrice', p_avg_price,
    'originalValue', v_value,
    'provider', v_card.provider,
    'acquiredAt', p_acquired_at
  ), now());

  insert into card_snapshots (card_id, label, value, design_state, taken_at)
  values (v_card.id, 'issue', v_value, v_design, now());

  return v_card;
end;
$$;

revoke all on function public.mint_card(text, text, text, numeric, numeric, timestamptz, text, text, text) from public, anon;
grant execute on function public.mint_card(text, text, text, numeric, numeric, timestamptz, text, text, text) to authenticated;

-- ── 7. report_seal_broken — self-reported partial/full sale ──────────────────
-- p_remaining_quantity: units the holder still holds. <= 0 ⇒ full sale (retired),
-- otherwise partial (seal_broken). Owner-scoped; writes the provenance event.
create or replace function public.report_seal_broken(
  p_card_id            uuid,
  p_remaining_quantity numeric default 0
)
returns ownership_cards
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid    uuid := auth.uid();
  v_card   ownership_cards;
  v_status text;
  v_full   boolean;
begin
  if v_uid is null then
    raise exception 'not authenticated';
  end if;

  select * into v_card from ownership_cards where id = p_card_id;
  if not found then
    raise exception 'card not found';
  end if;
  if v_card.owner_id <> v_uid then
    raise exception 'not the card owner';
  end if;
  if v_card.status in ('retired') then
    raise exception 'card already retired';
  end if;

  v_full := coalesce(p_remaining_quantity, 0) <= 0;
  v_status := case when v_full then 'retired' else 'seal_broken' end;

  update ownership_cards set status = v_status where id = p_card_id
  returning * into v_card;

  insert into card_events (card_id, kind, payload, occurred_at)
  values (
    v_card.id, 'seal_broken',
    jsonb_build_object(
      'reason', 'self_reported',
      'remainingQuantity', greatest(coalesce(p_remaining_quantity, 0), 0),
      'full', v_full
    ),
    now()
  );

  if v_full then
    insert into card_events (card_id, kind, payload, occurred_at)
    values (v_card.id, 'retired', jsonb_build_object('reason', 'self_reported_full_sale'), now());
  end if;

  return v_card;
end;
$$;

revoke all on function public.report_seal_broken(uuid, numeric) from public, anon;
grant execute on function public.report_seal_broken(uuid, numeric) to authenticated;

-- ── 8. retire_card — explicit owner retire ───────────────────────────────────
create or replace function public.retire_card(p_card_id uuid)
returns ownership_cards
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid  uuid := auth.uid();
  v_card ownership_cards;
begin
  if v_uid is null then
    raise exception 'not authenticated';
  end if;

  select * into v_card from ownership_cards where id = p_card_id;
  if not found then
    raise exception 'card not found';
  end if;
  if v_card.owner_id <> v_uid then
    raise exception 'not the card owner';
  end if;
  if v_card.status = 'retired' then
    return v_card;
  end if;

  update ownership_cards set status = 'retired' where id = p_card_id
  returning * into v_card;

  insert into card_events (card_id, kind, payload, occurred_at)
  values (v_card.id, 'retired', jsonb_build_object('reason', 'owner_retired'), now());

  return v_card;
end;
$$;

revoke all on function public.retire_card(uuid) from public, anon;
grant execute on function public.retire_card(uuid) to authenticated;

-- ── 9. record_card_milestone — cron-only event + snapshot + design cache ─────
-- The nightly sync calls this (via the service-role admin client) whenever a card
-- crosses a hold-age tier or value club, or on a yearly anniversary. Atomic:
-- appends the provenance event, captures a snapshot (value + full design_state),
-- and refreshes the card's design_state cache to the new era.
create or replace function public.record_card_milestone(
  p_card_id        uuid,
  p_event_kind     text,        -- 'milestone_age' | 'milestone_value' | 'snapshot' | 'dividend' | …
  p_snapshot_label text,        -- 'year_1' | 'milestone_25' | 'days_100' | …
  p_payload        jsonb,
  p_value          numeric,
  p_design_state   jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_exists boolean;
begin
  select exists(select 1 from ownership_cards where id = p_card_id) into v_exists;
  if not v_exists then
    raise exception 'card not found';
  end if;

  insert into card_events (card_id, kind, payload, occurred_at)
  values (p_card_id, p_event_kind, coalesce(p_payload, '{}'::jsonb), now());

  insert into card_snapshots (card_id, label, value, design_state, taken_at)
  values (p_card_id, p_snapshot_label, coalesce(p_value, 0), p_design_state, now());

  if p_design_state is not null then
    update ownership_cards set design_state = p_design_state where id = p_card_id;
  end if;
end;
$$;

revoke all on function public.record_card_milestone(uuid, text, text, jsonb, numeric, jsonb) from public, anon, authenticated;
grant execute on function public.record_card_milestone(uuid, text, text, jsonb, numeric, jsonb) to service_role;

-- ── 10. public_card_view — anon-callable public projection (NO account data) ──
-- Backs the future /c/[serial] scan page. Returns ONLY public-safe fields plus
-- acq_original_value + acq_at so the calling route can compute growth-since-issue
-- and owned-since year against a live Polygon price. NEVER exposes quantity,
-- avg price alone, brokerage account, or any private basis breakdown.
create or replace function public.public_card_view(p_serial text)
returns table (
  serial             text,
  asset_symbol       text,
  asset_name         text,
  asset_type         text,
  denomination       numeric,
  series             text,
  edition            int,
  edition_size       int,
  status             text,
  original_value     numeric,
  acquired_at        timestamptz,
  design_state       jsonb,
  holder_first_name  text,
  holder_last_initial text
)
language sql
security definer
set search_path = public
as $$
  select
    c.serial, c.asset_symbol, c.asset_name, c.asset_type, c.denomination,
    c.series, c.edition, c.edition_size, c.status,
    c.acq_original_value, c.acq_at, c.design_state,
    c.holder_first_name, c.holder_last_initial
  from ownership_cards c
  where c.serial = upper(p_serial)
  limit 1;
$$;

revoke all on function public.public_card_view(text) from public;
grant execute on function public.public_card_view(text) to anon, authenticated;
