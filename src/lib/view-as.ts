/**
 * VIEW AS — the admin's register preview override.
 *
 * WHAT IT IS: an admin can render the dashboard shell as any member register
 * (Club / Family / FTA / Teen / Kid) without touching a single database row.
 * The override lives in a cookie (`cc_view_as`), is read SERVER-SIDE in
 * src/app/(dashboard)/layout.tsx, and is honoured only after the real session
 * profile has been resolved and found to be `role = 'admin'`
 * (src/lib/server/view-as.ts is the gate — the cookie is never the authority).
 *
 * WHAT IT IS NOT — and this is the whole reason the UI says so out loud:
 * this changes the SHELL (nav, register, brand/palette, tier gating). It does
 * NOT change Row Level Security. RLS keys off auth.uid() and the real profile
 * row, so "Kid view" renders the kid shell while still reading the ADMIN's own
 * data, and the family guardrails (the kid chat wall, the downtime window) do
 * not engage. A surface can look fine in preview and behave differently for a
 * real kid. The switcher states this in one line; do not let that line go.
 *
 * The personas below are deliberately COMPLETE and fixed — each one is a whole,
 * deterministic member shape rather than a partial diff over the admin's real
 * account. A preview whose meaning depends on who is previewing is not a
 * preview. (Teen is included even though the owner listed four registers: it is
 * a genuinely distinct branch in getNavItems with its own primary nav and
 * gating, so leaving it out would make a real register unpreviewable.)
 */

import type { FamilyTier } from "@/lib/tier";

export type ViewAs = "club" | "family" | "fta" | "teen" | "kid";

/** Cookie name. Server-read only (httpOnly) — see src/lib/server/view-as.ts. */
export const VIEW_AS_COOKIE = "cc_view_as";

/**
 * 8 hours. A preview is a session-shaped act, not a setting: an override the
 * admin forgets about self-heals by the next working day instead of quietly
 * mis-teaching them what members see.
 */
export const VIEW_AS_MAX_AGE = 8 * 60 * 60;

export interface ViewAsPersona {
  id: ViewAs;
  /** Control label (the switcher rail). */
  label: string;
  /** One-line "who this is", shown under the rail / in the indicator. */
  blurb: string;
  role: string;
  age_group: string;
  track: string;
  tier: FamilyTier;
  isSolo: boolean;
}

/** Display order in the switcher: the three adult doors, then the young ones. */
export const VIEW_AS_ORDER: readonly ViewAs[] = [
  "club",
  "family",
  "fta",
  "teen",
  "kid",
] as const;

export const VIEW_AS_PERSONAS: Record<ViewAs, ViewAsPersona> = {
  // Solo adult member — the individual five-item Club nav, sand + volt skin.
  club: {
    id: "club",
    label: "Club",
    blurb: "Solo adult member — Cheat Code Club, five-item nav",
    role: "parent",
    age_group: "adults",
    track: "adults",
    tier: "fic",
    isSolo: true,
  },
  // Parent in a household — Family Investing Club, warm gold.
  family: {
    id: "family",
    label: "Family",
    blurb: "Parent in a household — Family Investing Club, warm gold",
    role: "parent",
    age_group: "adults",
    track: "adults",
    tier: "fic",
    isSolo: false,
  },
  // Premium tier — the metallic Academy desk on top of the family shell.
  fta: {
    id: "fta",
    label: "FTA",
    blurb: "Premium tier — the metallic Academy hub unlocked",
    role: "parent",
    age_group: "adults",
    track: "adults",
    tier: "fta",
    isSolo: false,
  },
  teen: {
    id: "teen",
    label: "Teen",
    blurb: "Teen member — teen nav and teen-gated surfaces",
    role: "teen",
    age_group: "teens",
    track: "teens",
    tier: "fic",
    isSolo: false,
  },
  kid: {
    id: "kid",
    label: "Kid",
    blurb: "Young kid member — Kids Corner nav, kid walls on",
    role: "child",
    age_group: "kids",
    track: "kids",
    tier: "fic",
    isSolo: false,
  },
};

/** Narrow an untrusted value (cookie, request body) to a known register. */
export function parseViewAs(value: unknown): ViewAs | null {
  if (typeof value !== "string") return null;
  return (VIEW_AS_ORDER as readonly string[]).includes(value)
    ? (value as ViewAs)
    : null;
}

/**
 * The exact slice of shell context the override replaces. Everything the
 * dashboard shell keys off — nav (role/age_group/tier/isSolo), register
 * (role/age_group), brand + palette (isSolo), tier gating (tier/clubLapsed) —
 * flows from these five fields, which is why the override is applied at one
 * point rather than sprinkled through the tree.
 */
export interface ShellContext {
  role?: string;
  age_group?: string;
  track?: string;
  tier: FamilyTier;
  isSolo: boolean;
  clubLapsed: boolean;
}

/**
 * Apply the override. `view === null` (no cookie, or a non-admin) returns the
 * real context UNCHANGED and by identity — the no-override path costs nothing
 * and cannot accidentally reshape a real member's session.
 *
 * clubLapsed is forced false under a preview: the personas above are defined
 * states, and letting the previewing admin's own lapsed Club window degrade
 * "FTA view" back to free would make the control lie about what it selected.
 */
export function applyViewAs(
  real: ShellContext,
  view: ViewAs | null
): ShellContext {
  if (!view) return real;
  const p = VIEW_AS_PERSONAS[view];
  return {
    role: p.role,
    age_group: p.age_group,
    track: p.track,
    tier: p.tier,
    isSolo: p.isSolo,
    clubLapsed: false,
  };
}
