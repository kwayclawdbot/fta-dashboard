/**
 * Ownership Cards — public-scan + claim UI helpers (Phase 2, UI lane).
 *
 * The canonical physical contract (FormFactor, ChipStatus, NfcChip, ChipSummary,
 * TapReason, TapResult) lives in `@/lib/ownership/types` and is imported from
 * there. This module only holds UI-side pieces the contract doesn't model:
 *   • ClaimInput — the POST /api/ownership/claim body.
 *   • ScanState  — the normalized shape the /c/[serial] page branches on.
 *   • pure display / inference helpers.
 * No type is redefined here and no backend interface is augmented.
 */

import type {
  AssetType,
  ChipSummary,
  FormFactor,
  PublicCardView,
  TapReason,
} from "@/lib/ownership/types";

/** POST /api/ownership/claim body — binds a chip to a digital card forever. */
export interface ClaimInput {
  chipSerial: string;
  cardId: string;
}

/**
 * Normalized state the /c/[serial] page renders from — the tap envelope folded
 * with the guaranteed-present public projection, so the page always has one
 * shape to branch on regardless of which backend routes are live yet.
 */
export interface ScanState {
  serial: string;
  status: "ok" | "not_found" | "error";
  /** Public card projection once a chip is bound; null for unbound/unknown. */
  card: PublicCardView | null;
  /** Carried separately since PublicCardView omits asset class. */
  assetType: AssetType | null;
  tapVerified: boolean;
  /** Chip ships unbound → true; drives the "not yet activated" claim path. */
  claimable: boolean;
  chip: ChipSummary | null;
  reason: TapReason | string;
  message?: string;
  demo?: boolean;
}

/* ── Pure display + inference helpers ─────────────────────────────────── */

const CRYPTO_SYMBOLS = new Set([
  "BTC",
  "ETH",
  "SOL",
  "DOGE",
  "XRP",
  "ADA",
  "LTC",
  "AVAX",
  "LINK",
  "MATIC",
  "SATS",
]);

/** Crypto has no market hours — drives the "live · never closes" treatment. */
export function isCryptoAsset(
  symbol: string | null | undefined,
  assetType?: AssetType | null
): boolean {
  if (assetType) return assetType === "crypto";
  const s = (symbol || "").toUpperCase();
  return CRYPTO_SYMBOLS.has(s);
}

/** Best-effort asset class when the public projection omits it. */
export function inferAssetType(
  symbol: string | null | undefined,
  assetType?: AssetType | null
): AssetType {
  if (assetType) return assetType;
  return isCryptoAsset(symbol) ? "crypto" : "stock";
}

export interface FormFactorMeta {
  /** Title-case noun, e.g. "Pendant". */
  label: string;
  /** Lowercase noun for inline copy, e.g. "pendant". */
  noun: string;
}

const FORM_FACTOR_META: Record<FormFactor, FormFactorMeta> = {
  card: { label: "Card", noun: "card" },
  pendant: { label: "Pendant", noun: "pendant" },
  watch: { label: "Watch", noun: "watch" },
};

export function formFactorMeta(ff: FormFactor | string | null | undefined): FormFactorMeta {
  return FORM_FACTOR_META[ff as FormFactor] ?? { label: "Artifact", noun: "artifact" };
}
