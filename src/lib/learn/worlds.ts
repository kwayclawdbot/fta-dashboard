/**
 * Learning World — the 5-world journey spine (FIC-LEARNING-WORLD §3).
 *
 * "Kill courses in the UI; keep course→unit→lesson internally." The journey is a
 * PRESENTATION grouping over the real courses/modules/lessons + lesson_skills
 * mapping (migration 165) — no new content axis, no schema change. Each of the
 * spec's 15 skills belongs to exactly one of the five worlds, so any lesson lands
 * in a world via its primary (highest-weight) skill.
 *
 * The registers (kid / teen / adult) derive DOWN from the premium adult editorial
 * style (standing rule): the adult path is a restrained editorial journey (no
 * cartoon city), teen is game-like, kid is brighter with larger nodes and less
 * text — one backend, three skins.
 */

import type { Register } from "@/lib/register";

/* ── Worlds ─────────────────────────────────────────────────────────────── */

export interface World {
  /** Stable id. */
  id: string;
  /** Canonical name (adult register). */
  name: string;
  /** Playful codename (kid/teen register). */
  codename: string;
  /** One-line editorial blurb. */
  blurb: string;
  /** A single glyph the kid/teen skin shows on the world marker. */
  glyph: string;
}

/** The five worlds, in journey order (spec §3). */
export const WORLDS: World[] = [
  {
    id: "own",
    name: "Own the Company",
    codename: "Brand Detective",
    blurb: "A share is a slice of a real business. Start seeing companies as things you can own.",
    glyph: "🏢",
  },
  {
    id: "money",
    name: "Follow the Money",
    codename: "Revenue Race",
    blurb: "Revenue, profit, margins. Learn how a business actually makes its money.",
    glyph: "💵",
  },
  {
    id: "moat",
    name: "Find Great Businesses",
    codename: "Spot the Moat",
    blurb: "What makes one company beat the rest and keep winning for years.",
    glyph: "🏰",
  },
  {
    id: "portfolio",
    name: "Build a Portfolio",
    codename: "Portfolio Builder",
    blurb: "Spread the risk, size each position, and build a mix you can actually hold.",
    glyph: "🧺",
  },
  {
    id: "mindset",
    name: "Think Like an Investor",
    codename: "Buy · Watch · Pass",
    blurb: "Read the chart, manage the emotion, and make the honest call.",
    glyph: "🧭",
  },
];

/** skill_id → world index. Covers all 15 seeded skills (migration 164). */
export const SKILL_WORLD: Record<string, number> = {
  stock_ownership: 0,
  market_basics: 0,
  revenue: 1,
  profit: 1,
  margins: 1,
  financial_statements: 1,
  competitive_advantage: 2,
  growth: 2,
  valuation: 2,
  diversification: 3,
  portfolio_construction: 3,
  risk: 3,
  market_psychology: 4,
  technical_analysis: 4,
  thesis_building: 4,
};

/** Which world a lesson belongs to, from its skills. Falls back to world 0. */
export function worldForSkills(skills: string[] | undefined | null): number {
  if (!skills || skills.length === 0) return 0;
  for (const s of skills) {
    const w = SKILL_WORLD[s];
    if (typeof w === "number") return w;
  }
  return 0;
}

/** The name a world shows in a given register (codename for kid/teen). */
export function worldLabel(world: World, register: Register): string {
  return register === "adult" ? world.name : world.codename;
}

/* ── Register skins — one backend, three skins (adult-first derivation) ───── */

export interface RegisterSkin {
  /** Node circle diameter (kid gets the biggest, most tappable node). */
  nodeSize: string;
  /** Icon size inside a node. */
  nodeIcon: string;
  /** Vertical gap between nodes on the spine. */
  nodeGap: string;
  /** Show the playful world glyph marker (kid/teen) vs a numeral (adult). */
  showGlyph: boolean;
  /** Show the per-world blurb under the chapter head. */
  showBlurb: boolean;
  /** Warmer, larger world-chapter headline for kids. */
  chapterSize: string;
  /** Copy tone for the home eyebrow. */
  journeyEyebrow: string;
}

const SKINS: Record<Register, RegisterSkin> = {
  // Adult — editorial journey, restrained node art, no cartoon city.
  adult: {
    nodeSize: "h-12 w-12",
    nodeIcon: "h-5 w-5",
    nodeGap: "gap-3",
    showGlyph: false,
    showBlurb: true,
    chapterSize: "text-[20px] sm:text-[22px]",
    journeyEyebrow: "Your investing journey",
  },
  // Teen — game-like, modern, a touch bigger than adult.
  teen: {
    nodeSize: "h-14 w-14",
    nodeIcon: "h-6 w-6",
    nodeGap: "gap-3.5",
    showGlyph: true,
    showBlurb: true,
    chapterSize: "text-[22px] sm:text-[24px]",
    journeyEyebrow: "Your investing quest",
  },
  // Kid — brightest, biggest nodes, most illustration, least text.
  kid: {
    nodeSize: "h-16 w-16",
    nodeIcon: "h-7 w-7",
    nodeGap: "gap-4",
    showGlyph: true,
    showBlurb: false,
    chapterSize: "text-[24px] sm:text-[26px]",
    journeyEyebrow: "Your money adventure",
  },
};

export function registerSkin(register: Register): RegisterSkin {
  return SKINS[register];
}

/* ── Node model (the vertical path) ──────────────────────────────────────── */

export type NodeKind = "lesson" | "game" | "review" | "boss";
export type NodeState = "done" | "current" | "available" | "locked";

export interface JourneyNode {
  key: string;
  kind: NodeKind;
  title: string;
  state: NodeState;
  /** Deep-link target; null for a locked / teaser node. */
  href: string | null;
  /** Small meta line ("4 min · +50 XP", "Boss Challenge", "3 due"). */
  meta: string;
  worldIndex: number;
}

export interface JourneyWorld {
  index: number;
  world: World;
  nodes: JourneyNode[];
  doneLessons: number;
  totalLessons: number;
  /** World-level state derived from its lesson nodes. */
  state: NodeState;
}

export interface Journey {
  worlds: JourneyWorld[];
  /** The single current node to resume at (first incomplete lesson). */
  current: JourneyNode | null;
  currentWorldIndex: number;
  totalLessons: number;
  doneLessons: number;
  /** Overall completion 0–100. */
  pct: number;
  /** The member's foundations course slug (for deep links / catalog). */
  courseSlug: string | null;
}
