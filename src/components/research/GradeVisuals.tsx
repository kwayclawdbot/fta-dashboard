"use client";

/**
 * GRADE COLOUR — the one thing the scorecard's visuals still own.
 *
 * This file used to carry two drawn objects: a `LetterGradeRing` and a
 * `VerdictGauge`, both consumed by `Scorecard.tsx`. The owner's mockup draws
 * those objects INSIDE the boards that need them — board 13's financial-health
 * ring (`Fundamentals`) and board 12's technical dial (`PriceTechnicals`) —
 * built from the shared `Donut` / `HalfGauge` primitives in `board.tsx`. Both
 * the old visuals and `Scorecard.tsx` are gone with the styling they belonged
 * to; what survives is the LETTER→COLOUR mapping, which is semantic rather
 * than presentational and is shared by everything that prints a grade.
 *
 * The letters are SEMANTIC colours (a green A is green in both themes), so
 * they render from fixed hex rather than from a theme token.
 */

import type { Letter } from "@/lib/research/grades";

const LETTER_HEX: Record<Letter, string> = {
  A: "#16a34a",
  B: "#65a30d",
  C: "#d97706",
  D: "#ea580c",
  F: "#dc2626",
};

/** Slate for "we could not grade this" — never one of the letter colours. */
const INSUFFICIENT_HEX = "#94a3b8";

export function letterColor(letter: Letter | null): string {
  return letter ? LETTER_HEX[letter] : INSUFFICIENT_HEX;
}
