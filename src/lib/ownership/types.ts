/**
 * Cheat Code Ownership Cards — shared contract (Phase 0).
 * Owned by the backend lane; the UI lane imports from here. Do not fork these types.
 * Plan: .planning/OWNERSHIP-CARDS-BUILD-PLAN.md
 */

export type AssetType = "stock" | "etf" | "crypto";

export type CardStatus =
  | "draft"
  | "active"
  | "in_transfer"
  | "seal_broken"
  | "retired";

/** Hold-age visual tiers, accumulating and never regressing. */
export type HoldTier = "issued" | "days_100" | "year_1" | "days_1000" | "legacy";

/** Value milestone clubs earned since issue (kept forever once earned). */
export type ValueClub = "gain_25" | "gain_50" | "gain_100";

export type CardEventKind =
  | "activated"
  | "milestone_value"
  | "milestone_age"
  | "dividend"
  | "split"
  | "transfer_out"
  | "transfer_in"
  | "seal_broken"
  | "retired"
  | "snapshot"
  | "gifted"
  | "transfer_declined"
  | "transfer_cancelled"
  | "transfer_expired"
  | "chip_bound"
  | "chip_revoked";

/** Visual era of a card — everything LivingCard needs to render a card exactly as it looked. */
export interface CardDesignState {
  holdTier: HoldTier;
  valueClubs: ValueClub[];
  series: string;
  rarity: string | null;
  /** design-system rev so old snapshots can pin an era's art version */
  designRev: number;
}

export interface OwnershipCard {
  id: string;
  serial: string; // CC-S01-000184
  ownerId: string;
  assetSymbol: string;
  assetName: string | null;
  assetType: AssetType;
  /** Original units. Immutable forever. */
  denomination: number;
  series: string;
  edition: number | null;
  editionSize: number | null;
  rarity: string | null;
  status: CardStatus;
  acquisition: {
    quantity: number;
    averagePrice: number;
    originalValue: number;
    acquiredAt: string; // ISO
  };
  /** null = manual position (self-reported) until brokerage linking lands */
  provider: "manual" | "snaptrade";
  activatedAt: string; // ISO
  /** Live-computed (not stored on the row) */
  market?: {
    price: number;
    currentValue: number;
    gain: number;
    gainPct: number;
    asOf: string; // ISO
  };
  designState: CardDesignState;
  holder: { firstName: string; lastInitial: string } | null;
  ownedDays: number;
  /** Present when this card arrived via a gift transfer (Phase 1). Cached from the newest 'gifted' event. */
  gift?: GiftProvenance;
}

/**
 * Provenance of a gift, persisted forever on the card.
 * `verification`: 'self_reported' with the manual provider (no brokerage proof of
 * the underlying share movement); becomes 'verified' on the future SnapTrade path.
 */
export interface GiftProvenance {
  fromDisplayName: string | null;
  message: string | null;
  giftedAt: string; // ISO
  originalValueAtGift: number;
  verification: "self_reported" | "verified";
}

/** Lifecycle of a card gift (Phase 1 transfer ceremony). */
export type TransferStatus =
  | "pending"
  | "accepted"
  | "declined"
  | "cancelled"
  | "expired"
  | "completed";

export interface CardTransfer {
  id: string;
  cardId: string;
  fromUser: string;
  toUser: string;
  status: TransferStatus;
  message: string | null; // the gift note, e.g. "Gifted by Dad"
  createdAt: string; // ISO
  expiresAt: string; // ISO
  resolvedAt: string | null; // ISO
}

/** Compact card fields for the transfer inbox (no basis/account data). */
export interface TransferCardSummary {
  id: string;
  serial: string;
  assetSymbol: string;
  assetName: string | null;
  denomination: number;
  status: CardStatus;
  designState: CardDesignState;
}

export interface TransferListItem {
  transfer: CardTransfer;
  card: TransferCardSummary | null;
  counterpart: { displayName: string; username: string | null } | null;
}

/** GET /api/ownership/transfers response. */
export interface TransferInbox {
  incoming: TransferListItem[]; // gifts sent TO me (pending shown first)
  outgoing: TransferListItem[]; // gifts I've sent
}

export interface CardEvent {
  id: number;
  cardId: string;
  kind: CardEventKind;
  payload: Record<string, unknown>;
  occurredAt: string; // ISO
}

export interface CardSnapshot {
  id: number;
  cardId: string;
  label: string; // issue | year_1 | milestone_25 | ...
  value: number;
  designState: CardDesignState;
  takenAt: string; // ISO
}

/** Public projection for /c/[serial] — NEVER include account/basis data here. */
export interface PublicCardView {
  serial: string;
  assetSymbol: string;
  assetName: string | null;
  denomination: number;
  series: string;
  edition: number | null;
  editionSize: number | null;
  status: CardStatus;
  currentValue: number | null;
  gainPctSinceIssue: number | null;
  ownedSinceYear: number;
  designState: CardDesignState;
  holder: { firstName: string; lastInitial: string } | null;
}

// ── Phase 2: Physical NFC (NTAG 424 DNA) ─────────────────────────────────────

/** Physical artifact form factors carrying a chip. */
export type FormFactor = "card" | "pendant" | "watch";

/** Chip lifecycle: minted → claimed (bound to a card) → revoked. */
export type ChipStatus = "provisioned" | "claimed" | "revoked";

/**
 * An NTAG 424 DNA chip row (owner/server view). NEVER carries the SDM key — that
 * lives encrypted at rest (sdm_key_enc) and only the server verifier ever touches
 * the plaintext. Public surfaces use ChipSummary instead.
 */
export interface NfcChip {
  id: string;
  serial: string; // CC-P01-000001 (P-series = physical)
  chipUid: string; // 7-byte NXP UID, hex
  status: ChipStatus;
  formFactor: FormFactor;
  cardId: string | null;
  sdmCounter: number; // replay floor (last verified tap counter)
  claimedAt: string | null; // ISO
  createdAt: string; // ISO
}

/** Public-safe chip descriptor for the scan page (no UID, no key, no counter). */
export interface ChipSummary {
  serial: string;
  formFactor: FormFactor;
  status: ChipStatus;
}

/**
 * Coarse tap outcome for public surfaces — deliberately low-resolution so the page
 * never leaks WHY a tap failed beyond a safe bucket.
 *   verified   — SDM CMAC checked out and the counter advanced (TAP-VERIFIED).
 *   no_tap     — no picc/cmac params (printed-QR / plain-link view).
 *   invalid    — params present but failed (bad format / decrypt / CMAC mismatch).
 *   replay     — a previously-seen (or older) tap counter was presented.
 *   unknown    — serial not found.
 *   revoked    — chip has been revoked.
 */
export type TapReason =
  | "verified"
  | "no_tap"
  | "invalid"
  | "replay"
  | "unknown"
  | "revoked";

/**
 * GET /api/ownership/tap/[serial] response. The page ALWAYS renders (an unverified
 * link view is still a valid view); `tapVerified` gates the "TAP-VERIFIED" chrome.
 * `claimable` routes an unbound-chip tap to the claim flow. `card` is the public
 * projection of the bound card (null when unclaimed / unknown).
 */
export interface TapResult {
  tapVerified: boolean;
  claimable?: boolean;
  reason: TapReason;
  chip: ChipSummary | null;
  card: PublicCardView | null;
}

/** Provider abstraction — ManualProvider now; SnapTradeProvider when consumer key lands. */
export interface PositionProvider {
  kind: "manual" | "snaptrade";
  /** Verify a claimed position (manual: passthrough; snaptrade: match against live lot). */
  verifyPosition(input: {
    userId: string;
    symbol: string;
    quantity: number;
    averagePrice: number;
    acquiredAt: string;
  }): Promise<{ verified: boolean; positionRef: string | null }>;
  /** Current quantity for seal detection (manual: null = unknown/self-reported). */
  currentQuantity(userId: string, positionRef: string | null, symbol: string): Promise<number | null>;
}
