import { headers } from "next/headers";
import {
  CLUB_VIEW_COOKIE,
  DEFAULT_EXPERIENCE,
  EXPERIENCE_HEADER,
  clubHostLive,
  experience,
  parseExperience,
  resolveExperienceFromHost,
  type Experience,
  type ExperienceKey,
} from "@/lib/experience/registry";

export type { Experience, ExperienceKey };
export { CLUB_VIEW_COOKIE, clubHostLive };

/**
 * The experience this REQUEST arrived through, read from the header
 * src/middleware.ts stamps. Falls back to resolving the Host directly for the
 * few paths the middleware matcher excludes (static assets), and to the default
 * door if there is no host at all — this must never throw during a render.
 */
export async function requestExperience(): Promise<ExperienceKey> {
  const h = await headers();
  return (
    parseExperience(h.get(EXPERIENCE_HEADER)) ??
    resolveExperienceFromHost(h.get("host")) ??
    DEFAULT_EXPERIENCE
  );
}

/** The full registry entry for this request's door (brand, mode, hosts). */
export async function requestExperienceConfig(): Promise<Experience> {
  return experience(await requestExperience());
}

/**
 * The `data-mode` a PUBLIC surface (landing, auth, checkout, challenge) should
 * render in.
 *
 * WHY THIS IS FLAG-GATED. The spec's host-wins rule says the login page brands
 * as Club on cheatcode.com and as FIC on familyinvestingclub.com. That is a
 * two-door statement, and today there is exactly ONE live host: cheatcode.com is
 * still parked (owner blocker), so the family host is the *only* way anyone
 * reaches the app, and the whole public funnel — landing, auth, checkout, the
 * challenge — is deliberately the Cheat Code Club umbrella brand there. Flipping
 * it to FIC now would repaint every logged-out surface in production for a
 * divergence that has nowhere to diverge to. So until the club host is actually
 * serving, these surfaces keep the umbrella skin they ship with; the moment
 * NEXT_PUBLIC_CLUB_HOST_LIVE is set, both hosts brand as their own door
 * together. The plumbing (the surfaces read the resolved experience instead of a
 * hardcoded literal) is live either way.
 */
export async function publicBrand(): Promise<{
  mode: "club" | "family";
  brand: string;
}> {
  const umbrella = experience("club");
  if (!clubHostLive()) return { mode: umbrella.appMode, brand: umbrella.brand };
  const exp = await requestExperienceConfig();
  return { mode: exp.appMode, brand: exp.brand };
}

/** Just the `data-mode` half of publicBrand(), for surfaces with no wordmark. */
export async function publicMode(): Promise<"club" | "family"> {
  return (await publicBrand()).mode;
}
