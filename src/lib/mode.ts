/**
 * Member MODE — the umbrella brand switch (Cheat Code Club architecture,
 * owner-approved 2026-07-24). ONE app, one membership umbrella:
 *
 *   • Cheat Code Club  = the umbrella membership/community (individual door).
 *   • Family Investing Club = Family Mode WITHIN the Club (the family door).
 *
 * Mode is a DISPLAY axis, not a data axis — the enrollment programs
 * (free | fic | fta) never change. It simply decides which brand identity a
 * member sees: a solo/individual member lives in "Cheat Code Club"; a household
 * (2+ members or kids) lives in "Family Investing Club — part of Cheat Code
 * Club". Kids in a family always see the FIC identity.
 *
 * Foundation: 13A's solo derivation (src/lib/register.ts isSolo*). We never
 * re-implement the household check here — mode is a thin relabel on top of it.
 *   family  → household has 2+ members or kids (the default, family-first)
 *   individual → solo household (one adult, no kids)
 */

import { isSoloProfile, isSoloHousehold, type SoloHousehold } from "@/lib/register";

export type MemberMode = "family" | "individual";

/**
 * Mode from the already-derived solo flag. The dashboard layout computes isSolo
 * ONCE (from a completed family_profiles household) and threads it through the
 * shell — every client surface should prefer this over re-fetching.
 */
export function modeFromSolo(isSolo: boolean | null | undefined): MemberMode {
  return isSolo ? "individual" : "family";
}

/**
 * Mode from a completed family_profiles row. Delegates the "is this solo"
 * verdict to isSoloProfile (requires completed_at), so an unfinished/default
 * household is never mistaken for individual — it keeps the family framing.
 */
export function memberMode(
  profile:
    | { household?: SoloHousehold | null; completed_at?: string | null }
    | null
    | undefined
): MemberMode {
  return isSoloProfile(profile) ? "individual" : "family";
}

/**
 * Mode from a raw household block (already known to come from a finished
 * profile). Use when completed_at isn't in scope but the household is trusted.
 */
export function modeFromHousehold(
  household: SoloHousehold | null | undefined
): MemberMode {
  return isSoloHousehold(household) ? "individual" : "family";
}

// ── Brand context ────────────────────────────────────────────────────────────

export interface ModeBrand {
  /** Full wordmark for the shell header / titles. */
  wordmark: string;
  /** Compact wordmark for collapsed rails / tight chrome. */
  wordmarkShort: string;
  /** Small "part of Cheat Code Club" attribution line, or null (individual mode
   *  IS the Club, so no attribution). */
  tagline: string | null;
  /** The fic-tier chip label in this mode ("Club" vs "FIC"). */
  ficChipLabel: string;
  /** The fic-tier long-form membership name in this mode. */
  ficName: string;
}

export const MODE_BRAND: Record<MemberMode, ModeBrand> = {
  individual: {
    wordmark: "Cheat Code Club",
    wordmarkShort: "Club",
    tagline: null,
    ficChipLabel: "Club",
    ficName: "Cheat Code Club",
  },
  family: {
    wordmark: "Family Investing Club",
    wordmarkShort: "FIC",
    tagline: "part of Cheat Code Club",
    ficChipLabel: "FIC",
    ficName: "Family Investing Club",
  },
};

export function modeBrand(mode: MemberMode): ModeBrand {
  return MODE_BRAND[mode];
}
