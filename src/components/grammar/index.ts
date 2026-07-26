/**
 * The Cheat Code design grammar (PART III of CLUB-CONVERGENCE-PLAN).
 *
 * Every convergence-pass surface is built ONLY from these eight primitives. The
 * pass/fail rules are documented in /GRAMMAR.md and enforced in code review.
 *
 *   1. PageIntro        — the opening composition (headline · context · 0–2 actions)
 *   2. Signal row       — TickerRow (ticker / event / alert / person) [ui/TickerRow]
 *   3. Feature canvas   — the dominant experience of a screen (composed per-surface)
 *   4. EditorialSection — titled content on the open canvas, no card by default
 *   5. ObjectCard       — the ONLY sanctioned container; persistent objects only
 *   6. Action sheet     — universal contextual actions (per-surface / Kai sheet)
 *   7. Kai layer        — consistent Kai-blue wherever Kai speaks (kai components)
 *   8. StatusChip       — tiny semantic indicators
 *
 * The signal-row family (Tabs + TickerRow) is re-exported here so a surface pulls
 * its whole grammar from one import.
 */
export { default as PageIntro } from "./PageIntro";
export { default as EditorialSection } from "./EditorialSection";
export { default as ObjectCard } from "./ObjectCard";
export type { ObjectAccent } from "./ObjectCard";
export { default as StatusChip } from "./StatusChip";
export type { ChipTone } from "./StatusChip";

// The signal-row family (existing, blessed Lane A primitives).
export { default as TickerRow } from "@/components/ui/TickerRow";
export { default as Tabs } from "@/components/ui/Tabs";
export type { TabItem } from "@/components/ui/Tabs";
