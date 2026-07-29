/**
 * Ownership Cards — per-asset art system.
 *
 * The Living Card is a dark-premium collectible object regardless of the app's
 * light/dark theme (a physical card doesn't change colour with the room). Each
 * asset gets a distinct personality — a brand-derived accent, a dark field
 * gradient, and one abstract pattern — built from typographic + abstract marks
 * only (NO logo image assets, so no trademark files). Any unknown symbol falls
 * back to a handsome graphite-gold generic.
 */

export type PatternKind =
  | "circuit"
  | "lattice"
  | "chevron"
  | "panes"
  | "orbit"
  | "rays"
  | "prism"
  | "strata"
  | "waves"
  | "hex"
  | "bloom"
  | "filmstrip"
  | "generic";

export interface AssetArt {
  /** Primary brand-derived accent (glow, chip edges, foil tint). */
  accent: string;
  /** Secondary accent for the far corner wash. */
  accent2: string;
  /** Dark field gradient for the card face. */
  field: string;
  /** Abstract pattern personality. */
  pattern: PatternKind;
  /** Optional short label under the symbol when assetName is missing. */
  kicker?: string;
}

/** Build a consistent dark field: two accent washes over warm near-black. */
function field(a: string, b: string): string {
  return [
    `radial-gradient(135% 120% at 16% 2%, ${a} 0%, transparent 54%)`,
    `radial-gradient(120% 120% at 92% 98%, ${b} 0%, transparent 58%)`,
    `linear-gradient(158deg, #0B0C0F 0%, #0A0B0D 46%, #050608 100%)`,
  ].join(", ");
}

/** Ink/typography colours — constant across assets for legibility. */
export const CARD_INK = "#F4F1EA";
export const CARD_SUB = "rgba(244, 241, 234, 0.60)";
export const CARD_FAINT = "rgba(244, 241, 234, 0.40)";
export const CARD_HAIRLINE = "rgba(244, 241, 234, 0.14)";

const ART: Record<string, AssetArt> = {
  NVDA: {
    accent: "#76B900",
    accent2: "#1f7a3a",
    field: field("rgba(118,185,0,0.20)", "rgba(31,122,58,0.16)"),
    pattern: "circuit",
    kicker: "NVIDIA",
  },
  AAPL: {
    accent: "#D7DCE2",
    accent2: "#5a6270",
    field: field("rgba(215,220,226,0.14)", "rgba(90,98,112,0.20)"),
    pattern: "lattice",
    kicker: "APPLE",
  },
  AMZN: {
    accent: "#FF9900",
    accent2: "#146EB4",
    field: field("rgba(255,153,0,0.18)", "rgba(20,110,180,0.18)"),
    pattern: "chevron",
    kicker: "AMAZON",
  },
  MSFT: {
    accent: "#4CA0E0",
    accent2: "#7FBA00",
    field: field("rgba(76,160,224,0.18)", "rgba(127,186,0,0.14)"),
    pattern: "panes",
    kicker: "MICROSOFT",
  },
  META: {
    accent: "#3A8CFF",
    accent2: "#8A5CFF",
    field: field("rgba(58,140,255,0.20)", "rgba(138,92,255,0.16)"),
    pattern: "orbit",
    kicker: "META",
  },
  TSLA: {
    accent: "#E82127",
    accent2: "#9aa0a6",
    field: field("rgba(232,33,39,0.18)", "rgba(154,160,166,0.14)"),
    pattern: "rays",
    kicker: "TESLA",
  },
  GOOG: {
    accent: "#4285F4",
    accent2: "#EA4335",
    field: field("rgba(66,133,244,0.18)", "rgba(234,67,53,0.14)"),
    pattern: "prism",
    kicker: "ALPHABET",
  },
  COST: {
    accent: "#E32227",
    accent2: "#0060A9",
    field: field("rgba(227,34,39,0.16)", "rgba(0,96,169,0.18)"),
    pattern: "strata",
    kicker: "COSTCO",
  },
  VOO: {
    accent: "#B12A34",
    accent2: "#0A1F44",
    field: field("rgba(177,42,52,0.18)", "rgba(10,31,68,0.34)"),
    pattern: "waves",
    kicker: "VANGUARD S&P 500",
  },
  BTC: {
    accent: "#F7931A",
    accent2: "#8a5a12",
    field: field("rgba(247,147,26,0.22)", "rgba(138,90,18,0.20)"),
    pattern: "hex",
    kicker: "BITCOIN",
  },
  SPY: {
    accent: "#2E77C4",
    accent2: "#1f8a5b",
    field: field("rgba(46,119,196,0.18)", "rgba(31,138,91,0.14)"),
    pattern: "bloom",
    kicker: "S&P 500",
  },
  NFLX: {
    accent: "#E50914",
    accent2: "#3a0407",
    field: field("rgba(229,9,20,0.20)", "rgba(58,4,7,0.44)"),
    pattern: "filmstrip",
    kicker: "NETFLIX",
  },
};

const FALLBACK: AssetArt = {
  accent: "#E6B84D",
  accent2: "#8a6a24",
  field: field("rgba(230,184,77,0.16)", "rgba(138,106,36,0.16)"),
  pattern: "generic",
};

/** Resolve the art tokens for any symbol (handsome generic fallback). */
export function artFor(symbol: string): AssetArt {
  return ART[symbol?.toUpperCase()] ?? FALLBACK;
}

export function hasDedicatedArt(symbol: string): boolean {
  return !!ART[symbol?.toUpperCase()];
}
