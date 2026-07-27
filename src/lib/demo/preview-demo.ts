import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

/**
 * PREVIEW-ONLY AUTO DEMO SESSION  (safety-critical)
 * =================================================
 * Owner directive: "eliminate login for previews — login should be production
 * only." On a Vercel PREVIEW deploy an unauthenticated visitor is auto-signed
 * in as a dedicated, permanent DEMO member instead of being bounced to /login.
 * Production is byte-identical to before: every function here no-ops the instant
 * VERCEL_ENV is anything other than 'preview'.
 *
 * HARD GUARD (read before touching anything below):
 *   - `isPreview()` gates the ENTIRE code path on process.env.VERCEL_ENV, which
 *     is a SERVER/edge-only value (NOT the NEXT_PUBLIC_* mirror). On production
 *     VERCEL_ENV==='production' → isPreview() is false → we return early and the
 *     normal Supabase login flow runs untouched. There is no client input that
 *     can flip this: the branch is decided entirely from the deploy's own env.
 *   - The demo password lives ONLY in a PREVIEW-scoped Vercel env var
 *     (DEMO_PASSWORD). It is never set on production and never committed. If it
 *     is missing (e.g. a stray non-preview build) the helper simply gives up and
 *     the visitor hits /login as normal — fail-closed, never fail-open.
 *
 * The three demo accounts are permanent fixtures seeded once on the shared prod
 * Supabase (previews point at the same DB). `?as=club|family|kid` writes a
 * cookie that switches which of the three is signed in on the next request.
 */

/** Server/edge-only preview detection. NEVER trust NEXT_PUBLIC for this. */
export function isPreview(): boolean {
  return process.env.VERCEL_ENV === "preview";
}

export type DemoRole = "club" | "family" | "kid";

/** Fixed, non-secret demo identities. Passwords are shared and come from env. */
const DEMO_EMAILS: Record<DemoRole, string> = {
  club: "demo-club@cheatcode.internal",
  family: "demo-family@cheatcode.internal",
  kid: "demo-kid@cheatcode.internal",
};

const AS_COOKIE = "demo_as";
/** Marks that we already attempted a sign-in for this identity, so a failed
 *  attempt does not loop forever redirecting to itself. */
const ATTEMPT_COOKIE = "demo_attempt";

function normalizeRole(v: string | null | undefined): DemoRole {
  return v === "family" || v === "kid" ? v : "club";
}

/** Paths that should always render the raw page even on preview (auth callback,
 *  api routes handle their own auth, static/asset-ish). Kept minimal. */
function isBypassPath(pathname: string): boolean {
  return (
    pathname.startsWith("/api/") ||
    pathname.startsWith("/auth/") ||
    pathname.startsWith("/_next/") ||
    pathname === "/favicon.ico"
  );
}

/**
 * Preview auto-demo hook. Runs inside middleware AFTER Supabase has resolved the
 * current user. Returns a NextResponse to short-circuit the request (a redirect
 * that re-enters middleware now carrying the demo session cookies), or null to
 * let the normal flow continue.
 *
 * Guarantees on production: `isPreview()` is false → returns null immediately.
 */
export async function maybeAttachDemoSession(
  request: NextRequest,
  currentUserEmail: string | null
): Promise<NextResponse | null> {
  // ── HARD GUARD ─────────────────────────────────────────────────────────────
  if (!isPreview()) return null;

  const { pathname, searchParams } = request.nextUrl;
  if (isBypassPath(pathname)) return null;

  const password = process.env.DEMO_PASSWORD?.trim();
  if (!password) return null; // fail-closed: no preview creds → normal /login flow

  // Desired demo identity: explicit ?as= wins and is persisted; else the cookie;
  // else default 'club'.
  const asParam = searchParams.get("as");
  const desired = normalizeRole(
    asParam ?? request.cookies.get(AS_COOKIE)?.value
  );
  const desiredEmail = DEMO_EMAILS[desired];

  // If already signed in as the desired demo account, nothing to do — but still
  // persist an explicit ?as= choice and strip it from the URL for a clean view.
  const alreadyRight =
    currentUserEmail?.toLowerCase() === desiredEmail.toLowerCase();

  if (alreadyRight) {
    if (asParam) {
      const url = request.nextUrl.clone();
      url.searchParams.delete("as");
      const res = NextResponse.redirect(url);
      res.cookies.set(AS_COOKIE, desired, { path: "/", sameSite: "lax" });
      res.cookies.delete(ATTEMPT_COOKIE);
      return res;
    }
    return null;
  }

  // We need to (re)sign-in as the desired demo account. Guard against loops: if
  // we just attempted this exact identity and still are not it, give up so the
  // visitor at least reaches /login rather than redirect-looping.
  if (
    !asParam &&
    request.cookies.get(ATTEMPT_COOKIE)?.value === desired &&
    currentUserEmail == null
  ) {
    return null;
  }

  // Build a response we can write auth cookies onto, then sign in with the
  // shared demo password. createServerClient writes the Supabase session cookies
  // onto `res` via setAll below.
  const url = request.nextUrl.clone();
  if (asParam) url.searchParams.delete("as");
  const res = NextResponse.redirect(url);

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!.trim(),
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!.trim(),
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) =>
            res.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // If switching identities, drop the old session first so the new cookies win.
  if (currentUserEmail) {
    await supabase.auth.signOut();
  }

  const { error } = await supabase.auth.signInWithPassword({
    email: desiredEmail,
    password,
  });

  res.cookies.set(AS_COOKIE, desired, { path: "/", sameSite: "lax" });
  res.cookies.set(ATTEMPT_COOKIE, desired, { path: "/", sameSite: "lax" });

  if (error) {
    // Sign-in failed (bad creds / account missing). Fail-closed: let the normal
    // flow run so the visitor sees /login, not a broken redirect loop.
    return null;
  }

  return res;
}
