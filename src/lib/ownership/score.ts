/**
 * Ownership Score v1 — pure, deterministic, unit-testable.
 *
 * The Ownership Score rewards the BEHAVIOURS the platform wants to celebrate —
 * owning, holding, diversifying, gifting, and learning — and NEVER performance.
 * There is deliberately NO return/gain component: a card that fell 40% and one that
 * doubled contribute identically. (Robinhood-confetti lesson; plan locked-decision
 * #4 + #6: "Ownership Score never ranks by returns.")
 *
 * ── FORMULA ────────────────────────────────────────────────────────────────────
 * total = Collection + HoldTime + Diversification + Gifting + Learning   (rounded)
 *
 *   Collection      = COLLECTION_PER_CARD (20) × (# non-draft cards)
 *                     One point block per card ever minted/received. Retired cards
 *                     still count — you owned it, the provenance is real.
 *
 *   HoldTime        = Σ over HELD cards of  HOLD_COEFF (3) × sqrt(ownedDays)
 *                     sqrt = diminishing returns: 100d→~30, 365d→~57, 1000d→~95,
 *                     so a long hold matters but never runs away. "Held" excludes
 *                     retired/draft (you're no longer holding those).
 *
 *   Diversification = DISTINCT_SYMBOL (8) × (# distinct symbols among held cards)
 *                   + DISTINCT_TYPE  (15) × (# distinct asset types among held cards)
 *                     Rewards breadth across names and across stock/etf/crypto.
 *
 *   Gifting         = GIFT_EVENT (25) × (giftsSent + giftsReceived)
 *                     Both sides of a completed gift score — generosity and legacy.
 *
 *   Learning        = LEARN_PER (5) × (# completed lesson/quiz XP events)
 *                     Bridges the existing XP system (xp_events kind in lesson|quiz)
 *                     WITHOUT touching it — read-only. Learning literally raises your
 *                     standing as an owner.
 *
 * All coefficients live in SCORE_WEIGHTS below (single source of truth). Every
 * component is clamped at >= 0. Output carries a breakdown[] with UI-ready labels.
 */
import type { AssetType, CardStatus } from "./types";

export const SCORE_WEIGHTS = {
  COLLECTION_PER_CARD: 20,
  HOLD_COEFF: 3,
  DISTINCT_SYMBOL: 8,
  DISTINCT_TYPE: 15,
  GIFT_EVENT: 25,
  LEARN_PER: 5,
} as const;

/** A card projected to only the fields the score needs. */
export interface ScoreCardInput {
  status: CardStatus;
  ownedDays: number;
  assetType: AssetType;
  assetSymbol: string;
}

export interface ScoreInput {
  cards: ScoreCardInput[];
  giftsSent: number;
  giftsReceived: number;
  /** Count of completed lesson + quiz XP events (read from xp_events). */
  lessonsCompleted: number;
}

export interface ScoreComponent {
  key: "collection" | "hold_time" | "diversification" | "gifting" | "learning";
  label: string;
  points: number;
  detail: string;
}

export interface OwnershipScore {
  total: number;
  breakdown: ScoreComponent[];
}

/** A card is "held" (accrues hold-time + diversification) unless retired/draft. */
function isHeld(status: CardStatus): boolean {
  return status === "active" || status === "seal_broken" || status === "in_transfer";
}

export function computeOwnershipScore(input: ScoreInput): OwnershipScore {
  const w = SCORE_WEIGHTS;
  const cards = input.cards.filter((c) => c.status !== "draft");
  const held = cards.filter((c) => isHeld(c.status));

  // Collection
  const collection = cards.length * w.COLLECTION_PER_CARD;

  // Hold time (diminishing returns via sqrt of days)
  const holdTime = Math.round(
    held.reduce((sum, c) => sum + w.HOLD_COEFF * Math.sqrt(Math.max(0, c.ownedDays)), 0)
  );

  // Diversification
  const distinctSymbols = new Set(held.map((c) => c.assetSymbol.toUpperCase())).size;
  const distinctTypes = new Set(held.map((c) => c.assetType)).size;
  const diversification =
    distinctSymbols * w.DISTINCT_SYMBOL + distinctTypes * w.DISTINCT_TYPE;

  // Gifting (both directions)
  const giftEvents = Math.max(0, input.giftsSent) + Math.max(0, input.giftsReceived);
  const gifting = giftEvents * w.GIFT_EVENT;

  // Learning (bridged from XP)
  const learning = Math.max(0, input.lessonsCompleted) * w.LEARN_PER;

  const breakdown: ScoreComponent[] = [
    {
      key: "collection",
      label: "Collection",
      points: collection,
      detail: `${cards.length} card${cards.length === 1 ? "" : "s"} owned`,
    },
    {
      key: "hold_time",
      label: "Hold Time",
      points: holdTime,
      detail: `${held.length} held, longest ${
        held.reduce((m, c) => Math.max(m, c.ownedDays), 0)
      } days`,
    },
    {
      key: "diversification",
      label: "Diversification",
      points: diversification,
      detail: `${distinctSymbols} symbol${distinctSymbols === 1 ? "" : "s"} · ${distinctTypes} asset type${distinctTypes === 1 ? "" : "s"}`,
    },
    {
      key: "gifting",
      label: "Gifting",
      points: gifting,
      detail: `${input.giftsSent} sent · ${input.giftsReceived} received`,
    },
    {
      key: "learning",
      label: "Learning",
      points: learning,
      detail: `${input.lessonsCompleted} lesson${input.lessonsCompleted === 1 ? "" : "s"} completed`,
    },
  ];

  const total = breakdown.reduce((s, b) => s + b.points, 0);
  return { total, breakdown };
}
