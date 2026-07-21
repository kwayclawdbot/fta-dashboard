/**
 * Canonical site origin for building absolute redirect URLs (email links, OAuth).
 *
 * Order of precedence:
 *   1. NEXT_PUBLIC_SITE_URL — explicit production origin (set this in Vercel to
 *      pin every auth link to the live domain regardless of preview URLs).
 *   2. window.location.origin — correct in the browser for both prod + local dev.
 *   3. Hard fallback to the known production origin (SSR without the env var).
 *
 * Why this exists: the email-verification 404 was rooted in redirect targets not
 * resolving to the live domain. Every signUp / resend / OAuth call routes its
 * redirect through here so the target is always an absolute, allowlistable URL.
 */
const PROD_FALLBACK = "https://fta-dashboard-ruddy.vercel.app";

export function siteUrl(): string {
  const env = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (env) return env.replace(/\/$/, "");
  if (typeof window !== "undefined" && window.location?.origin) {
    return window.location.origin;
  }
  return PROD_FALLBACK;
}

/** Absolute URL for the email/OAuth callback handler. */
export function authCallbackUrl(next = "/dashboard"): string {
  const u = new URL("/auth/callback", siteUrl());
  if (next) u.searchParams.set("next", next);
  return u.toString();
}
