/**
 * Ownership Cards — DB row shapes + mappers to the shared contract (types.ts).
 * Server-only helper; both the API routes and the cron use these to turn snake_case
 * Postgres rows into the camelCase OwnershipCard / CardEvent / CardSnapshot shapes.
 */
import type {
  AssetType,
  CardStatus,
  CardDesignState,
  CardEvent,
  CardEventKind,
  CardSnapshot,
  CardTransfer,
  GiftProvenance,
  HoldTier,
  OwnershipCard,
  PublicCardView,
  TransferStatus,
  ValueClub,
} from "./types";

/** Raw ownership_cards row as returned by PostgREST / RPC. */
export interface CardRow {
  id: string;
  serial: string;
  owner_id: string;
  asset_symbol: string;
  asset_name: string | null;
  asset_type: AssetType;
  denomination: number | string;
  series: string;
  edition: number | null;
  edition_size: number | null;
  rarity: string | null;
  status: CardStatus;
  provider: "manual" | "snaptrade";
  acq_quantity: number | string;
  acq_avg_price: number | string;
  acq_original_value: number | string;
  acq_at: string;
  snaptrade_account_id: string | null;
  brokerage_position_ref: string | null;
  nfc_uid: string | null;
  design_state: unknown;
  holder_first_name: string | null;
  holder_last_initial: string | null;
  gift: unknown; // denormalized GiftProvenance cache (jsonb), null until gifted
  activated_at: string;
  created_at: string;
}

export interface EventRow {
  id: number;
  card_id: string;
  kind: CardEventKind;
  payload: Record<string, unknown> | null;
  occurred_at: string;
}

export interface SnapshotRow {
  id: number;
  card_id: string;
  label: string;
  value: number | string;
  design_state: unknown;
  taken_at: string;
}

const HOLD_TIERS: HoldTier[] = ["issued", "days_100", "year_1", "days_1000", "legacy"];
const VALUE_CLUBS: ValueClub[] = ["gain_25", "gain_50", "gain_100"];

const n = (v: number | string | null | undefined): number =>
  v == null ? 0 : typeof v === "number" ? v : Number(v);

/** Coerce a jsonb design_state blob into a well-formed CardDesignState. */
export function normalizeDesignState(
  raw: unknown,
  fallbackSeries = "digital"
): CardDesignState {
  const o = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const holdTier = HOLD_TIERS.includes(o.holdTier as HoldTier)
    ? (o.holdTier as HoldTier)
    : "issued";
  const clubs = Array.isArray(o.valueClubs)
    ? (o.valueClubs as unknown[]).filter((c): c is ValueClub =>
        VALUE_CLUBS.includes(c as ValueClub)
      )
    : [];
  return {
    holdTier,
    valueClubs: clubs,
    series: typeof o.series === "string" ? o.series : fallbackSeries,
    rarity: typeof o.rarity === "string" ? o.rarity : null,
    designRev: typeof o.designRev === "number" ? o.designRev : 1,
  };
}

/** Coerce the denormalized `gift` jsonb into a GiftProvenance, or null. */
export function normalizeGift(raw: unknown): GiftProvenance | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  if (typeof o.giftedAt !== "string") return null;
  return {
    fromDisplayName:
      typeof o.fromDisplayName === "string" ? o.fromDisplayName : null,
    message: typeof o.message === "string" ? o.message : null,
    giftedAt: o.giftedAt,
    originalValueAtGift: n(o.originalValueAtGift as number | string | null),
    verification: o.verification === "verified" ? "verified" : "self_reported",
  };
}

/** Whole days a card has been owned, from acquisition to `asOf` (default now). */
export function ownedDaysSince(acqAt: string, asOf: Date = new Date()): number {
  const start = new Date(acqAt).getTime();
  if (!Number.isFinite(start)) return 0;
  return Math.max(0, Math.floor((asOf.getTime() - start) / 86_400_000));
}

export interface MarketInput {
  price: number;
  asOf: string; // ISO
}

/** Map a DB card row → OwnershipCard, optionally with live market math. */
export function rowToCard(row: CardRow, market?: MarketInput): OwnershipCard {
  const denomination = n(row.denomination);
  const originalValue = n(row.acq_original_value);
  const design = normalizeDesignState(row.design_state, row.series);

  const card: OwnershipCard = {
    id: row.id,
    serial: row.serial,
    ownerId: row.owner_id,
    assetSymbol: row.asset_symbol,
    assetName: row.asset_name,
    assetType: row.asset_type,
    denomination,
    series: row.series,
    edition: row.edition,
    editionSize: row.edition_size,
    rarity: row.rarity,
    status: row.status,
    acquisition: {
      quantity: n(row.acq_quantity),
      averagePrice: n(row.acq_avg_price),
      originalValue,
      acquiredAt: row.acq_at,
    },
    provider: row.provider,
    activatedAt: row.activated_at,
    designState: design,
    holder: row.holder_first_name
      ? {
          firstName: row.holder_first_name,
          lastInitial: row.holder_last_initial ?? "",
        }
      : null,
    ownedDays: ownedDaysSince(row.acq_at),
  };

  const gift = normalizeGift(row.gift);
  if (gift) card.gift = gift;

  if (market && market.price > 0) {
    const currentValue = market.price * denomination;
    const gain = currentValue - originalValue;
    card.market = {
      price: market.price,
      currentValue,
      gain,
      gainPct: originalValue > 0 ? (gain / originalValue) * 100 : 0,
      asOf: market.asOf,
    };
  }

  return card;
}

export function rowToEvent(row: EventRow): CardEvent {
  return {
    id: row.id,
    cardId: row.card_id,
    kind: row.kind,
    payload: row.payload ?? {},
    occurredAt: row.occurred_at,
  };
}

/** Raw card_transfers row as returned by PostgREST / RPC. */
export interface TransferRow {
  id: string;
  card_id: string;
  from_user: string;
  to_user: string;
  status: TransferStatus;
  message: string | null;
  created_at: string;
  expires_at: string;
  resolved_at: string | null;
}

export function rowToTransfer(row: TransferRow): CardTransfer {
  return {
    id: row.id,
    cardId: row.card_id,
    fromUser: row.from_user,
    toUser: row.to_user,
    status: row.status,
    message: row.message,
    createdAt: row.created_at,
    expiresAt: row.expires_at,
    resolvedAt: row.resolved_at,
  };
}

export function rowToSnapshot(row: SnapshotRow): CardSnapshot {
  return {
    id: row.id,
    cardId: row.card_id,
    label: row.label,
    value: n(row.value),
    designState: normalizeDesignState(row.design_state),
    takenAt: row.taken_at,
  };
}

/** Row shape returned by the public_card_view RPC (public-safe + basis for math). */
export interface PublicViewRow {
  serial: string;
  asset_symbol: string;
  asset_name: string | null;
  asset_type: AssetType;
  denomination: number | string;
  series: string;
  edition: number | null;
  edition_size: number | null;
  status: CardStatus;
  original_value: number | string;
  acquired_at: string;
  design_state: unknown;
  holder_first_name: string | null;
  holder_last_initial: string | null;
}

/**
 * Shape the public projection. `price` (live EOD close) is folded in here so the
 * PUBLIC output carries only currentValue + gainPctSinceIssue — never the raw
 * basis. original_value stays internal to this computation.
 */
export function publicRowToView(
  row: PublicViewRow,
  price: number | null
): PublicCardView {
  const denomination = n(row.denomination);
  const originalValue = n(row.original_value);
  const currentValue = price && price > 0 ? price * denomination : null;
  const gainPct =
    currentValue != null && originalValue > 0
      ? ((currentValue - originalValue) / originalValue) * 100
      : null;

  return {
    serial: row.serial,
    assetSymbol: row.asset_symbol,
    assetName: row.asset_name,
    denomination,
    series: row.series,
    edition: row.edition,
    editionSize: row.edition_size,
    status: row.status,
    currentValue,
    gainPctSinceIssue: gainPct,
    ownedSinceYear: new Date(row.acquired_at).getUTCFullYear(),
    designState: normalizeDesignState(row.design_state, row.series),
    holder: row.holder_first_name
      ? {
          firstName: row.holder_first_name,
          lastInitial: row.holder_last_initial ?? "",
        }
      : null,
  };
}
