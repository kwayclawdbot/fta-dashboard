/**
 * EXPERIENCE REGISTRY — which door a request came in through
 * (EXPERIENCE-ARCHITECTURE.md, Phase E1).
 *
 * One app, two front doors. The entry HOST selects the experience; the stored
 * `families.door` selects it for a logged-in member. Everything else — the
 * `data-mode` skin, the wordmark, the Kai persona — is a function of one of
 * those two, never of a household questionnaire answer.
 *
 * DEPENDENCY-FREE ON PURPOSE. This module is imported by src/middleware.ts and
 * therefore runs on the edge runtime: no next/headers, no Supabase, no React.
 * Phase E3 replaces the constant below with an `experience_configs` table read;
 * keeping the shape of `resolveExperienceFromHost()` stable is what makes that a
 * data change rather than a code change.
 */

/** The stored/served experience. Kid is NEVER a door — see the spec §1. */
export type ExperienceKey = "club" | "family";

/** The value stamped on `data-mode`. `fta` is a route-scoped skin, not a door. */
export type AppMode = "club" | "family" | "fta";

export interface Experience {
  key: ExperienceKey;
  /** Hosts that serve this experience (lowercase, no port). */
  hosts: readonly string[];
  /** Human brand name for wordmarks and titles. */
  brand: string;
  /** The `data-mode` skin this door renders in. */
  appMode: Exclude<AppMode, "fta">;
  /** Where this experience officially lives — used for cross-door links. */
  canonicalHost: string;
}

/**
 * The host of NEXT_PUBLIC_SITE_URL is registered as a family host too, so a
 * preview/alias deployment brands as the current production door instead of
 * falling through to the unknown-host default. Parsed defensively: a malformed
 * env value must never throw inside middleware.
 */
function siteHost(): string | null {
  const raw = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (!raw) return null;
  try {
    return new URL(raw).hostname.toLowerCase();
  } catch {
    return null;
  }
}

export const CLUB_HOST = "app.cheatcode.com";
export const FAMILY_HOST = "app.familyinvestingclub.com";

export const EXPERIENCES: Record<ExperienceKey, Experience> = {
  club: {
    key: "club",
    hosts: [CLUB_HOST],
    brand: "Cheat Code Club",
    appMode: "club",
    canonicalHost: CLUB_HOST,
  },
  family: {
    key: "family",
    hosts: [
      FAMILY_HOST,
      // The Vercel host the app shipped on, still live and still linked to.
      "fta-dashboard-ruddy.vercel.app",
      "localhost",
      "127.0.0.1",
    ],
    brand: "Family Investing Club",
    appMode: "family",
    canonicalHost: FAMILY_HOST,
  },
};

/** The door an unrecognised host serves: the family app, which is what is live. */
export const DEFAULT_EXPERIENCE: ExperienceKey = "family";

/** Narrow an untrusted string (header, DB column, cookie) to an experience. */
export function parseExperience(value: unknown): ExperienceKey | null {
  return value === "club" || value === "family" ? value : null;
}

/**
 * Host → experience. Accepts a raw Host header (may carry a port, may be null).
 * Unknown hosts resolve to `family` — the door that is actually serving today,
 * so a new alias can never render a brand with no home.
 */
export function resolveExperienceFromHost(
  host: string | null | undefined
): ExperienceKey {
  const h = (host || "").trim().toLowerCase().split(":")[0];
  if (!h) return DEFAULT_EXPERIENCE;
  for (const exp of Object.values(EXPERIENCES)) {
    if (hostsFor(exp).includes(h)) return exp.key;
  }
  return DEFAULT_EXPERIENCE;
}

/** Every host serving an experience, including the configured site origin. */
export function hostsFor(exp: Experience): string[] {
  const site = exp.key === DEFAULT_EXPERIENCE ? siteHost() : null;
  return site && !exp.hosts.includes(site) ? [...exp.hosts, site] : [...exp.hosts];
}

export function experience(key: ExperienceKey): Experience {
  return EXPERIENCES[key];
}

/**
 * IS THE SECOND DOOR ACTUALLY SERVING? cheatcode.com is still parked at
 * Bluehost (standing owner blocker), so until DNS points at Vercel there is
 * exactly ONE live host and exactly one public brand. Every two-door behaviour —
 * the wrong-domain interstitial, cross-host links, and host-selected branding on
 * the public/auth surfaces — is gated on this flag so that shipping E1 changes
 * nothing a member can see. Default OFF. Do not set it until the DNS lands.
 */
export function clubHostLive(): boolean {
  return process.env.NEXT_PUBLIC_CLUB_HOST_LIVE === "1";
}

/** Request header the middleware stamps the resolved experience onto. */
export const EXPERIENCE_HEADER = "x-experience";

/**
 * Session cookie set when a FAMILY member accepts "view in Club Mode" on the
 * club host. Session-scoped (no max-age), adults only, and re-checked
 * server-side against register on every render — the cookie is never authority.
 */
export const CLUB_VIEW_COOKIE = "cc-club-view";
