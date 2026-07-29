/**
 * Ownership Cards — transfer/gift display helpers (Phase 1).
 * Pure functions, no deps, so every gift surface reads counterparts, expiries
 * and card summaries identically. Coded against the canonical contract in
 * `@/lib/ownership/types`.
 */

import type {
  GiftProvenance,
  OwnershipCard,
  TransferCardSummary,
  TransferListItem,
} from "@/lib/ownership/types";

/** "Dad" / "Kai R." / "a Club member" from a transfer counterpart. */
export function senderLabel(
  counterpart: TransferListItem["counterpart"]
): string {
  const name = counterpart?.displayName?.trim();
  return name && name.length ? name : "a Club member";
}

/** "Gifted by Dad" line for the gift provenance. */
export function giftedByLine(gift: GiftProvenance): string {
  return `Gifted by ${gift.fromDisplayName?.trim() || "family"}`;
}

/** Whether a gift's underlying shares are brokerage-verified. */
export function giftVerified(gift: GiftProvenance): boolean {
  return gift.verification === "verified";
}

/** "Expires in 3 days" / "Expires in 6 hours" / "Expired" / null if none. */
export function expiresInLabel(expiresAt: string | null): string | null {
  if (!expiresAt) return null;
  const ms = new Date(expiresAt).getTime() - Date.now();
  if (!Number.isFinite(ms)) return null;
  if (ms <= 0) return "Expired";
  const hours = ms / 3.6e6;
  if (hours < 1) {
    const mins = Math.max(1, Math.round(ms / 6e4));
    return `Expires in ${mins} min`;
  }
  if (hours < 24) {
    const h = Math.round(hours);
    return `Expires in ${h} hour${h === 1 ? "" : "s"}`;
  }
  const days = Math.round(hours / 24);
  return `Expires in ${days} day${days === 1 ? "" : "s"}`;
}

/** True once a pending transfer's window has closed. */
export function isExpired(expiresAt: string | null): boolean {
  if (!expiresAt) return false;
  const t = new Date(expiresAt).getTime();
  return Number.isFinite(t) && t <= Date.now();
}

/**
 * Synthesize a renderable OwnershipCard from the compact transfer summary so the
 * gift strip + reveal can use the real <LivingCard>. The summary carries no
 * basis/market data (by design), so value renders as "—" until the card is
 * owned and priced in the recipient's collection.
 */
export function summaryToDisplayCard(
  summary: TransferCardSummary
): OwnershipCard {
  return {
    id: summary.id,
    serial: summary.serial,
    ownerId: "",
    assetSymbol: summary.assetSymbol,
    assetName: summary.assetName,
    assetType: "stock",
    denomination: summary.denomination,
    series: summary.designState.series,
    edition: null,
    editionSize: null,
    rarity: summary.designState.rarity,
    status: summary.status,
    acquisition: {
      quantity: summary.denomination,
      averagePrice: Number.NaN,
      originalValue: Number.NaN, // → "—" in LivingCard until priced
      acquiredAt: new Date().toISOString(),
    },
    provider: "manual",
    activatedAt: new Date().toISOString(),
    designState: summary.designState,
    holder: null,
    ownedDays: 0,
  };
}
