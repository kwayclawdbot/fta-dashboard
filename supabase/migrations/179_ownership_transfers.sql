-- ============================================================================
-- 179 — CHEAT CODE OWNERSHIP CARDS (Phase 1: Provenance + Transfer ceremony).
--
-- The emotional killer feature: gift a card (and the underlying position) inside
-- the family, correctly. A transfer is a state machine on top of the append-only
-- provenance log from 178:
--
--   active ──initiate_transfer──▶ in_transfer ──accept_transfer──▶ active (new holder)
--                                     │
--                                     ├─ decline_transfer (recipient) ─▶ active (sender)
--                                     ├─ cancel_transfer  (sender)     ─▶ active (sender)
--                                     └─ expire_stale_transfers (cron) ─▶ active (sender)
--
-- HONESTY NOTE (baked into every 'gifted'/'transfer_in' payload):
--   With the MANUAL provider there is NO brokerage verification of the underlying
--   share movement yet. The provenance therefore records verification:'self_reported'.
--   When SnapTrade lands, accept_transfer gains a verified path (the recipient's
--   linked position confirms the move) and stamps verification:'verified'. We never
--   fake verification — a self-reported gift says so, forever.
--
-- Additive only: one new table (card_transfers), one denormalized jsonb column on
-- ownership_cards (gift), an extension of the card_events kind whitelist, and
-- SECURITY DEFINER RPCs. Zero changes to existing production paths.
--
-- SCHEMA NOTE (deviation from build-plan shorthand): the plan says "kid = role
-- 'kid'", but the live profiles.role check is ('parent','child','coach','admin').
-- A "kid recipient" is therefore role='child'; a supervising parent is role='parent'
-- in the SAME family_id. That mapping is used everywhere below.
-- ============================================================================

-- ── 0. extend the card_events kind whitelist for transfer resolutions ────────
-- 178 already allows transfer_out / transfer_in / gifted. Declines, cancels and
-- expiries each write a provenance event too, so widen the check constraint.
alter table card_events drop constraint if exists card_events_kind_check;
alter table card_events add constraint card_events_kind_check check (kind in (
  'activated', 'milestone_value', 'milestone_age', 'dividend',
  'split', 'transfer_out', 'transfer_in', 'seal_broken',
  'retired', 'snapshot', 'gifted',
  'transfer_declined', 'transfer_cancelled', 'transfer_expired'));

-- ── 1. denormalized gift provenance on the card ──────────────────────────────
-- DENORMALIZATION CHOICE: the newest 'gifted' event is also cached here as a
-- single jsonb blob so the collection page ("Gifted by Dad") and share images
-- render provenance without loading the full event log per card. The event log
-- (card_events) remains the append-only source of truth; this column is a cache
-- that accept_transfer writes atomically alongside the 'gifted' event.
-- Shape = GiftProvenance in types.ts (+ an internal fromUserId).
alter table ownership_cards add column if not exists gift jsonb;

-- ── 2. card_transfers ────────────────────────────────────────────────────────
-- One row per gift attempt. 'accepted' is the terminal success state for the
-- manual (self_reported) rails — the card re-binds immediately. 'completed' is
-- reserved for the future SnapTrade verified path (position confirmed in the
-- recipient's brokerage before re-bind); not used yet.
create table if not exists card_transfers (
  id          uuid primary key default gen_random_uuid(),
  card_id     uuid not null references ownership_cards(id) on delete cascade,
  from_user   uuid not null references auth.users(id) on delete cascade,
  to_user     uuid not null references auth.users(id) on delete cascade,
  status      text not null default 'pending'
                check (status in ('pending', 'accepted', 'declined', 'cancelled', 'expired', 'completed')),
  message     text,                                       -- the gift note, e.g. "Gifted by Dad"
  created_at  timestamptz not null default now(),
  expires_at  timestamptz not null default (now() + interval '7 days'),
  resolved_at timestamptz
);

create index if not exists idx_card_transfers_card on card_transfers(card_id);
create index if not exists idx_card_transfers_from on card_transfers(from_user, status);
create index if not exists idx_card_transfers_to   on card_transfers(to_user, status);
-- At most one live (pending) transfer per card.
create unique index if not exists uniq_card_pending_transfer
  on card_transfers(card_id) where status = 'pending';

alter table card_transfers enable row level security;

-- RLS: the sender, the recipient, and — when the recipient is a kid (role='child')
-- — that kid's family parents may READ the transfer row. All writes go through the
-- SECURITY DEFINER RPCs below.
drop policy if exists "Transfer parties read" on card_transfers;
create policy "Transfer parties read" on card_transfers
  for select to authenticated using (
    from_user = auth.uid()
    or to_user = auth.uid()
    or exists (
      select 1
      from profiles kid
      join profiles parent on parent.family_id = kid.family_id
      where kid.id = card_transfers.to_user
        and kid.role = 'child'
        and kid.family_id is not null
        and parent.id = auth.uid()
        and parent.role = 'parent'
    )
  );

revoke insert, update, delete on card_transfers from authenticated, anon;

-- ── 3. permission helper: may caller act on this transfer as the recipient? ──
-- True if auth.uid() IS the recipient, OR the recipient is a kid (role='child')
-- and auth.uid() is a parent (role='parent') in the same family. security definer
-- so it can read profiles regardless of the caller's RLS.
create or replace function public.can_act_as_recipient(p_to_user uuid, p_actor uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select
    p_actor = p_to_user
    or exists (
      select 1
      from profiles kid
      join profiles parent on parent.family_id = kid.family_id
      where kid.id = p_to_user
        and kid.role = 'child'
        and kid.family_id is not null
        and parent.id = p_actor
        and parent.role = 'parent'
    );
$$;

revoke all on function public.can_act_as_recipient(uuid, uuid) from public, anon;
grant execute on function public.can_act_as_recipient(uuid, uuid) to authenticated;

-- ── 4. initiate_transfer — sender opens a gift ───────────────────────────────
-- Recipient resolved by EXACT (case-insensitive) username OR email from profiles.
-- Card must be ACTIVE and caller-owned. Locks the card to 'in_transfer', writes
-- the 'transfer_out' provenance event, returns the new transfer row.
create or replace function public.initiate_transfer(
  p_card_id             uuid,
  p_recipient_identifier text,
  p_message             text default null
)
returns card_transfers
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid       uuid := auth.uid();
  v_card      ownership_cards;
  v_recipient uuid;
  v_transfer  card_transfers;
begin
  if v_uid is null then
    raise exception 'not authenticated';
  end if;
  if p_recipient_identifier is null or length(trim(p_recipient_identifier)) = 0 then
    raise exception 'recipient required';
  end if;

  select * into v_card from ownership_cards where id = p_card_id;
  if not found then
    raise exception 'card not found';
  end if;
  if v_card.owner_id <> v_uid then
    raise exception 'not the card owner';
  end if;
  if v_card.status <> 'active' then
    raise exception 'card must be active to transfer (status: %)', v_card.status;
  end if;

  -- resolve recipient by exact username OR email (case-insensitive)
  select id into v_recipient
  from profiles
  where lower(username) = lower(trim(p_recipient_identifier))
     or lower(email) = lower(trim(p_recipient_identifier))
  limit 1;

  if v_recipient is null then
    raise exception 'recipient not found';
  end if;
  if v_recipient = v_uid then
    raise exception 'cannot transfer a card to yourself';
  end if;

  update ownership_cards set status = 'in_transfer' where id = p_card_id;

  insert into card_transfers (card_id, from_user, to_user, message)
  values (p_card_id, v_uid, v_recipient, nullif(trim(p_message), ''))
  returning * into v_transfer;

  insert into card_events (card_id, kind, payload, occurred_at)
  values (v_card.id, 'transfer_out', jsonb_build_object(
    'transferId', v_transfer.id,
    'to', v_recipient,
    'message', nullif(trim(p_message), '')
  ), now());

  return v_transfer;
end;
$$;

revoke all on function public.initiate_transfer(uuid, text, text) from public, anon;
grant execute on function public.initiate_transfer(uuid, text, text) to authenticated;

-- ── 5. accept_transfer — recipient (or kid's parent) accepts the gift ────────
-- Re-binds the card to the recipient (owner_id → to_user, status → 'active'),
-- writes 'transfer_in' + 'gifted' provenance, and caches gift provenance on the
-- card. verification:'self_reported' — the manual provider does NOT verify the
-- underlying share movement. Denomination + acquisition basis are immutable; only
-- ownership and status change.
create or replace function public.accept_transfer(p_transfer_id uuid)
returns ownership_cards
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid      uuid := auth.uid();
  v_transfer card_transfers;
  v_card     ownership_cards;
  v_from_name text;
  v_gifted_at timestamptz := now();
  v_gift     jsonb;
begin
  if v_uid is null then
    raise exception 'not authenticated';
  end if;

  select * into v_transfer from card_transfers where id = p_transfer_id;
  if not found then
    raise exception 'transfer not found';
  end if;
  if not public.can_act_as_recipient(v_transfer.to_user, v_uid) then
    raise exception 'not authorized to accept this transfer';
  end if;
  if v_transfer.status <> 'pending' then
    raise exception 'transfer is not pending (status: %)', v_transfer.status;
  end if;
  if v_transfer.expires_at <= now() then
    raise exception 'transfer has expired';
  end if;

  select * into v_card from ownership_cards where id = v_transfer.card_id;
  if not found then
    raise exception 'card not found';
  end if;
  if v_card.status <> 'in_transfer' then
    raise exception 'card is not in transfer (status: %)', v_card.status;
  end if;

  select display_name into v_from_name from profiles where id = v_transfer.from_user;

  v_gift := jsonb_build_object(
    'fromUserId', v_transfer.from_user,
    'fromDisplayName', v_from_name,
    'message', v_transfer.message,
    'giftedAt', v_gifted_at,
    'originalValueAtGift', v_card.acq_original_value,
    'verification', 'self_reported'
  );

  -- re-bind the card to the recipient; basis + denomination untouched.
  update ownership_cards
     set owner_id = v_transfer.to_user,
         status   = 'active',
         gift     = v_gift
   where id = v_card.id
  returning * into v_card;

  update card_transfers
     set status = 'accepted', resolved_at = v_gifted_at
   where id = p_transfer_id;

  insert into card_events (card_id, kind, payload, occurred_at) values
    (v_card.id, 'transfer_in', jsonb_build_object(
      'transferId', v_transfer.id,
      'from', v_transfer.from_user,
      'to', v_transfer.to_user
    ), v_gifted_at),
    (v_card.id, 'gifted', jsonb_build_object(
      'transferId', v_transfer.id,
      'from', v_transfer.from_user,
      'fromDisplayName', v_from_name,
      'message', v_transfer.message,
      'originalValue', v_card.acq_original_value,
      'giftedAt', v_gifted_at,
      'verification', 'self_reported'
    ), v_gifted_at);

  return v_card;
end;
$$;

revoke all on function public.accept_transfer(uuid) from public, anon;
grant execute on function public.accept_transfer(uuid) to authenticated;

-- ── 6. decline_transfer — recipient (or kid's parent) declines ───────────────
create or replace function public.decline_transfer(p_transfer_id uuid)
returns card_transfers
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid      uuid := auth.uid();
  v_transfer card_transfers;
begin
  if v_uid is null then
    raise exception 'not authenticated';
  end if;

  select * into v_transfer from card_transfers where id = p_transfer_id;
  if not found then
    raise exception 'transfer not found';
  end if;
  if not public.can_act_as_recipient(v_transfer.to_user, v_uid) then
    raise exception 'not authorized to decline this transfer';
  end if;
  if v_transfer.status <> 'pending' then
    raise exception 'transfer is not pending (status: %)', v_transfer.status;
  end if;

  update card_transfers set status = 'declined', resolved_at = now()
   where id = p_transfer_id
  returning * into v_transfer;

  -- revert the card only if it is still locked to this transfer.
  update ownership_cards set status = 'active'
   where id = v_transfer.card_id and status = 'in_transfer';

  insert into card_events (card_id, kind, payload, occurred_at)
  values (v_transfer.card_id, 'transfer_declined', jsonb_build_object(
    'transferId', v_transfer.id,
    'by', v_uid
  ), now());

  return v_transfer;
end;
$$;

revoke all on function public.decline_transfer(uuid) from public, anon;
grant execute on function public.decline_transfer(uuid) to authenticated;

-- ── 7. cancel_transfer — sender revokes their own pending gift ───────────────
create or replace function public.cancel_transfer(p_transfer_id uuid)
returns card_transfers
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid      uuid := auth.uid();
  v_transfer card_transfers;
begin
  if v_uid is null then
    raise exception 'not authenticated';
  end if;

  select * into v_transfer from card_transfers where id = p_transfer_id;
  if not found then
    raise exception 'transfer not found';
  end if;
  if v_transfer.from_user <> v_uid then
    raise exception 'not the sender of this transfer';
  end if;
  if v_transfer.status <> 'pending' then
    raise exception 'transfer is not pending (status: %)', v_transfer.status;
  end if;

  update card_transfers set status = 'cancelled', resolved_at = now()
   where id = p_transfer_id
  returning * into v_transfer;

  update ownership_cards set status = 'active'
   where id = v_transfer.card_id and status = 'in_transfer';

  insert into card_events (card_id, kind, payload, occurred_at)
  values (v_transfer.card_id, 'transfer_cancelled', jsonb_build_object(
    'transferId', v_transfer.id,
    'by', v_uid
  ), now());

  return v_transfer;
end;
$$;

revoke all on function public.cancel_transfer(uuid) from public, anon;
grant execute on function public.cancel_transfer(uuid) to authenticated;

-- ── 8. expire_stale_transfers — service_role (called from the cron route) ────
-- Reverts every pending transfer past its expires_at: transfer → 'expired', card
-- back to 'active' (if still locked), + a 'transfer_expired' provenance event.
-- Returns the number of transfers expired.
create or replace function public.expire_stale_transfers()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer := 0;
  r       record;
begin
  for r in
    select id, card_id from card_transfers
    where status = 'pending' and expires_at <= now()
    for update
  loop
    update card_transfers set status = 'expired', resolved_at = now()
     where id = r.id;

    update ownership_cards set status = 'active'
     where id = r.card_id and status = 'in_transfer';

    insert into card_events (card_id, kind, payload, occurred_at)
    values (r.card_id, 'transfer_expired', jsonb_build_object('transferId', r.id), now());

    v_count := v_count + 1;
  end loop;

  return v_count;
end;
$$;

revoke all on function public.expire_stale_transfers() from public, anon, authenticated;
grant execute on function public.expire_stale_transfers() to service_role;
