-- ============================================================================
-- 180 — CHEAT CODE OWNERSHIP CARDS (Phase 2: Physical NFC pilot — Bitcoin-first).
--
-- "The tap is the truth." A physical artifact (card / pendant / watch) carries an
-- NTAG 424 DNA chip. Each tap emits a Secure Unique NFC (SUN/SDM) message: an
-- AES-encrypted PICCData blob (UID + read counter) plus a truncated AES-CMAC. The
-- server verifies the CMAC with the chip's per-chip key (AN12196) and enforces a
-- monotonic replay floor, so a scan page can render TAP-VERIFIED vs an unverified
-- link view (printed-QR fallback).
--
-- Additive only (additive-build pattern): one new table (nfc_chips), an extension
-- of the card_events kind whitelist ('chip_bound','chip_revoked'), and SECURITY
-- DEFINER RPCs. Zero changes to any existing card/transfer/production path.
--
-- KEY-AT-REST: each chip's AES-128 SDM key is stored ENCRYPTED (sdm_key_enc) —
-- AES-256-GCM wrapped with the server-side master key NFC_MASTER_KEY (env). Plain
-- keys never touch the DB. The tap verifier runs server-side with the service-role
-- client (admin), decrypts the key in memory, verifies, then advances the counter.
-- RLS never exposes sdm_key_enc to authenticated/anon.
--
-- SERIALS: physical artifacts use the P-series (CC-P01-000001…), distinct from the
-- digital S-series (CC-S01-…) so a serial's namespace tells you if it's a chip or a
-- digital-only card.
-- ============================================================================

-- ── 0. extend the card_events kind whitelist for chip lifecycle ──────────────
alter table card_events drop constraint if exists card_events_kind_check;
alter table card_events add constraint card_events_kind_check check (kind in (
  'activated', 'milestone_value', 'milestone_age', 'dividend',
  'split', 'transfer_out', 'transfer_in', 'seal_broken',
  'retired', 'snapshot', 'gifted',
  'transfer_declined', 'transfer_cancelled', 'transfer_expired',
  'chip_bound', 'chip_revoked'));

-- ── 1. P-series serial sequence: CC-P01-000001, CC-P01-000002, … ─────────────
create sequence if not exists nfc_chip_serial_seq start 1;

-- ── 2. nfc_chips ─────────────────────────────────────────────────────────────
create table if not exists nfc_chips (
  id           uuid primary key default gen_random_uuid(),
  chip_uid     text unique not null,                       -- 7-byte NXP UID, hex (14 chars)
  serial       text unique not null                        -- printed on the artifact
                 default ('CC-P01-' || lpad(nextval('nfc_chip_serial_seq')::text, 6, '0')),
  -- per-chip AES-128 SDM key, ENCRYPTED at rest (AES-256-GCM under NFC_MASTER_KEY).
  sdm_key_enc  text not null,
  -- last seen SDM read counter (replay floor). A tap is accepted only if its
  -- decrypted counter is strictly greater than this; the verifier advances it.
  sdm_counter  bigint not null default 0,
  status       text not null default 'provisioned'
                 check (status in ('provisioned', 'claimed', 'revoked')),
  -- the digital card this chip is married to (permanent once claimed). null until claim.
  card_id      uuid references ownership_cards(id) on delete set null,
  form_factor  text not null default 'card'
                 check (form_factor in ('card', 'pendant', 'watch')),
  claimed_at   timestamptz,
  created_at   timestamptz not null default now()
);

create index if not exists idx_nfc_chips_card   on nfc_chips(card_id);
create index if not exists idx_nfc_chips_status on nfc_chips(status);

alter table nfc_chips enable row level security;

-- RLS: the owner of the BOUND card may read the chip row (so the private owner view
-- can show chip status/form-factor). NOTE: even this policy exposes sdm_key_enc to
-- the owner's PostgREST reads; that is acceptable because the value is a ciphertext
-- useless without NFC_MASTER_KEY (server-only). The public tap route and the
-- verifier NEVER use an owner session — they use the service-role admin client.
-- All writes go through the SECURITY DEFINER RPCs / the service-role provisioner.
drop policy if exists "Owner reads bound chip" on nfc_chips;
create policy "Owner reads bound chip" on nfc_chips
  for select to authenticated using (
    card_id is not null
    and exists (
      select 1 from ownership_cards c
      where c.id = nfc_chips.card_id and c.owner_id = auth.uid()
    )
  );

revoke insert, update, delete on nfc_chips from authenticated, anon;
grant all on nfc_chips to service_role;

-- ── 3. claim_chip — first-tap claim: bind an unclaimed chip to a card you own ──
-- Permanent marriage. Preconditions:
--   • caller is authenticated and OWNS the card,
--   • chip exists, is 'provisioned' and unclaimed (card_id is null),
--   • the card has no chip yet (nfc_uid is null and no chip already references it).
-- Effects (atomic): chip.status→'claimed', chip.card_id→card, chip.claimed_at→now;
-- ownership_cards.nfc_uid→chip.chip_uid; a 'chip_bound' provenance event
-- {chipSerial, formFactor}. Returns the updated card row.
create or replace function public.claim_chip(
  p_chip_serial text,
  p_card_id     uuid
)
returns ownership_cards
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid  uuid := auth.uid();
  v_chip nfc_chips;
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
  if v_card.nfc_uid is not null then
    raise exception 'card already has a chip bound';
  end if;

  select * into v_chip from nfc_chips
    where serial = upper(trim(p_chip_serial))
    for update;
  if not found then
    raise exception 'chip not found';
  end if;
  if v_chip.status <> 'provisioned' or v_chip.card_id is not null then
    raise exception 'chip is not claimable (status: %)', v_chip.status;
  end if;
  -- defensive: no other chip may already reference this card
  if exists (select 1 from nfc_chips where card_id = p_card_id) then
    raise exception 'card already has a chip bound';
  end if;

  update nfc_chips
     set status = 'claimed', card_id = p_card_id, claimed_at = now()
   where id = v_chip.id;

  update ownership_cards
     set nfc_uid = v_chip.chip_uid
   where id = p_card_id
  returning * into v_card;

  insert into card_events (card_id, kind, payload, occurred_at)
  values (p_card_id, 'chip_bound', jsonb_build_object(
    'chipSerial', v_chip.serial,
    'formFactor', v_chip.form_factor
  ), now());

  return v_card;
end;
$$;

revoke all on function public.claim_chip(text, uuid) from public, anon;
grant execute on function public.claim_chip(text, uuid) to authenticated;

-- ── 4. revoke_chip — service_role: kill a chip, unbind its card ──────────────
-- For lost/compromised/RMA artifacts. Sets status→'revoked', unbinds card_id and
-- clears ownership_cards.nfc_uid so the card can be re-bound to a replacement chip.
-- Writes a 'chip_revoked' provenance event. Idempotent-ish: revoking twice is a no-op.
create or replace function public.revoke_chip(p_chip_serial text, p_reason text default null)
returns nfc_chips
language plpgsql
security definer
set search_path = public
as $$
declare
  v_chip nfc_chips;
begin
  select * into v_chip from nfc_chips where serial = upper(trim(p_chip_serial)) for update;
  if not found then
    raise exception 'chip not found';
  end if;
  if v_chip.status = 'revoked' then
    return v_chip;
  end if;

  if v_chip.card_id is not null then
    update ownership_cards set nfc_uid = null where id = v_chip.card_id;
    insert into card_events (card_id, kind, payload, occurred_at)
    values (v_chip.card_id, 'chip_revoked', jsonb_build_object(
      'chipSerial', v_chip.serial,
      'reason', coalesce(p_reason, 'revoked')
    ), now());
  end if;

  update nfc_chips
     set status = 'revoked', card_id = null
   where id = v_chip.id
  returning * into v_chip;

  return v_chip;
end;
$$;

revoke all on function public.revoke_chip(text, text) from public, anon, authenticated;
grant execute on function public.revoke_chip(text, text) to service_role;
