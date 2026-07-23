import { LEVELS, levelForXp, levelProgress, nextLevel, type Level } from "@/lib/xp";

/**
 * Belt layer — a PRESENTATION skin over the earned XP level ladder (src/lib/xp.ts).
 *
 * The owner-set ladder (2026-07-23) is five belts: White → Yellow → Blue →
 * Purple → Black. The XP thresholds and award amounts in xp.ts are the single
 * source of truth and are NOT changed here; belts are purely a way to display
 * the same levels. Because there are more levels (7) than belts (5), belts carry
 * DEGREES within them (e.g. "Blue Belt II"). Black is deliberately the apex — a
 * single top level at the hardest threshold.
 *
 * Colors are INTRINSIC to the belt (a blue belt is blue in every theme), so the
 * swatch/dot/bar render from fixed hex values via inline styles rather than
 * theme tokens. White and Black need extra contrast handling: white gets a
 * border so it reads on a light page, black gets a light ring so it reads on a
 * dark avatar. The BeltBadge / Avatar helpers below encapsulate that.
 */

export type BeltKey = "white" | "yellow" | "blue" | "purple" | "black";

export interface Belt {
  key: BeltKey;
  name: string; // "Blue"
  order: number; // 0..4, White lowest
  /** Core belt color — intrinsic, theme-independent. */
  hex: string;
  /** Readable text color to sit ON the belt hex (for filled pills). */
  onHex: string;
  /** A subtle border color, used for the white belt (and dot outlines). */
  borderHex: string;
}

// Five belts, lowest → highest. Colors chosen to read in BOTH themes; White and
// Black rely on the border/ring handling in the components below.
export const BELTS: Record<BeltKey, Belt> = {
  white: { key: "white", name: "White", order: 0, hex: "#E8EAF0", onHex: "#1F2937", borderHex: "#B9BFCC" },
  yellow: { key: "yellow", name: "Yellow", order: 1, hex: "#EAB308", onHex: "#3B2E05", borderHex: "#B98900" },
  blue: { key: "blue", name: "Blue", order: 2, hex: "#3B82F6", onHex: "#FFFFFF", borderHex: "#2563EB" },
  purple: { key: "purple", name: "Purple", order: 3, hex: "#8B5CF6", onHex: "#FFFFFF", borderHex: "#7C3AED" },
  black: { key: "black", name: "Black", order: 4, hex: "#1F2430", onHex: "#FFFFFF", borderHex: "#6B7280" },
};

export const BELT_ORDER: BeltKey[] = ["white", "yellow", "blue", "purple", "black"];

/**
 * Level → belt + degree mapping (OWNER-SET 2026-07-23). Each of the 7 XP levels
 * maps to exactly one belt degree; belts with a single level render no degree
 * numeral. Black = level 7 only (top threshold, 3200 XP) so it stays hard.
 *
 *   L1 Explorer      → White
 *   L2 Money Mapper  → Yellow
 *   L3 Chart Reader  → Blue I
 *   L4 Zone Hunter   → Blue II
 *   L5 Sweep Spotter → Purple I
 *   L6 Trade Ready   → Purple II
 *   L7 Playbook Pro  → Black
 */
const LEVEL_BELT: Record<number, BeltKey> = {
  1: "white",
  2: "yellow",
  3: "blue",
  4: "blue",
  5: "purple",
  6: "purple",
  7: "black",
};

// How many levels sit in each belt, and the sorted level list per belt — used to
// compute the degree (1-based) and whether a numeral is shown at all.
const LEVELS_IN_BELT: Record<BeltKey, number[]> = (() => {
  const map: Record<BeltKey, number[]> = { white: [], yellow: [], blue: [], purple: [], black: [] };
  for (const l of LEVELS) {
    const key = LEVEL_BELT[l.level];
    if (key) map[key].push(l.level);
  }
  for (const k of BELT_ORDER) map[k].sort((a, b) => a - b);
  return map;
})();

const ROMAN = ["", "I", "II", "III", "IV", "V"];

export interface BeltRank {
  belt: Belt;
  /** 1-based degree within the belt. */
  degree: number;
  /** Total degrees available in this belt (1 → no numeral shown). */
  degreesInBelt: number;
  /** The underlying XP level. */
  level: Level;
  /** Full name, e.g. "Blue Belt II" or "White Belt". */
  label: string;
  /** Compact name for chips, e.g. "Blue II" or "White". */
  short: string;
}

function rankForLevel(levelNumber: number): BeltRank {
  const key = LEVEL_BELT[levelNumber] ?? "white";
  const belt = BELTS[key];
  const levelsHere = LEVELS_IN_BELT[key];
  const degree = Math.max(1, levelsHere.indexOf(levelNumber) + 1);
  const degreesInBelt = levelsHere.length || 1;
  const level = LEVELS.find((l) => l.level === levelNumber) ?? LEVELS[0];
  const numeral = degreesInBelt > 1 ? ` ${ROMAN[degree] ?? degree}` : "";
  return {
    belt,
    degree,
    degreesInBelt,
    level,
    label: `${belt.name} Belt${numeral}`,
    short: `${belt.name}${numeral}`,
  };
}

/** Belt rank for a level object. */
export function beltForLevel(level: Level): BeltRank {
  return rankForLevel(level.level);
}

/** Belt rank for a lifetime-XP total (mirrors levelForXp). */
export function beltForXp(xp: number): BeltRank {
  return rankForLevel(levelForXp(xp).level);
}

export interface BeltProgress {
  current: BeltRank;
  /** Next degree/belt to reach, or null when maxed (Black). */
  next: BeltRank | null;
  /** 0-100 toward the next degree/belt (100 when maxed). */
  pct: number;
  /** XP remaining to the next degree/belt (0 when maxed). */
  toNext: number;
  /** True when `next` sits in a DIFFERENT belt than `current`. */
  nextIsNewBelt: boolean;
}

/**
 * Belt-flavored progress for the TopBar chip and profiles. Reuses the level-band
 * math in xp.ts so the bar and the "to next" copy never drift from the ladder.
 */
export function beltProgress(xp: number): BeltProgress {
  const lp = levelProgress(xp);
  const current = rankForLevel(lp.current.level);
  const nextLvl = nextLevel(xp);
  const next = nextLvl ? rankForLevel(nextLvl.level) : null;
  return {
    current,
    next,
    pct: lp.pct,
    toNext: lp.toNext,
    nextIsNewBelt: !!next && next.belt.key !== current.belt.key,
  };
}

/**
 * Belt crossing on a level-up, for the belt-ceremony celebration. Returns the
 * new rank plus whether a brand-new BELT (not just a degree) was earned, or null
 * when no level was crossed.
 */
export function beltCrossing(
  prevXp: number,
  newXp: number
): { rank: BeltRank; newBelt: boolean } | null {
  const before = levelForXp(prevXp);
  const after = levelForXp(newXp);
  if (after.level <= before.level) return null;
  const beforeRank = rankForLevel(before.level);
  const afterRank = rankForLevel(after.level);
  return { rank: afterRank, newBelt: afterRank.belt.key !== beforeRank.belt.key };
}
