import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { REF_COOKIE, REF_COOKIE_MAX_AGE } from "@/lib/referral";
import { getProjectJwks } from "@/lib/supabase/jwks";
import { maybeAttachDemoSession, isPreview } from "@/lib/demo/preview-demo";

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!.trim(),
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!.trim(),
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({
            request,
          });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // SPEED: this used to be `auth.getUser()` — a POST to GoTrue (/auth/v1/user)
  // on EVERY matched request, measured at 309–340ms and running at the edge PoP
  // nearest the visitor, i.e. a cross-region round trip before a single byte of
  // the page is even requested. (It is the most likely source of the
  // MIDDLEWARE_INVOCATION_TIMEOUT the audit caught.)
  //
  // `getClaims()` verifies the access token's ES256 signature LOCALLY against
  // the project's published JWKS (cached per instance) — measured 0–1ms warm.
  // It is not a weaker check: a forged or tampered token fails verification the
  // same way. Crucially it still goes through getSession() first, so an expired
  // cookie is refreshed here exactly as before (and the refreshed cookies are
  // written onto supabaseResponse by the setAll adapter above), and it falls
  // back to getUser() by itself if the project is ever on symmetric keys.
  //
  // Middleware only uses this to decide a REDIRECT. Every page and API route
  // still resolves the member from the signed token itself and every read runs
  // under RLS, so nothing downstream trusts this value for authorization.
  // The key set is held at module scope (src/lib/supabase/jwks.ts) so this
  // stays a LOCAL verification: a per-request client would otherwise re-fetch
  // the JWKS every time and we would have swapped one round trip for another.
  const jwksKeys = await getProjectJwks();
  const { data: claimsData } = await supabase.auth.getClaims(
    undefined,
    jwksKeys ? { jwks: { keys: jwksKeys } } : undefined
  );
  const claims = claimsData?.claims ?? null;
  const user = claims?.sub
    ? { id: claims.sub, email: (claims.email as string | undefined) ?? null }
    : null;

  const { pathname } = request.nextUrl;

  // PREVIEW-ONLY auto demo session. On a Vercel preview deploy this signs the
  // visitor in as a dedicated demo member (or switches identity via ?as=) and
  // short-circuits with a redirect carrying the session cookies. On production
  // maybeAttachDemoSession() returns null immediately (VERCEL_ENV guard), so the
  // block below is inert and the normal login flow runs byte-identically.
  const demoResponse = await maybeAttachDemoSession(request, user?.email ?? null);
  if (demoResponse) return demoResponse;

  // Protect dashboard routes — redirect to login if no session.
  // On preview, the demo hook above has already ensured a session for app paths,
  // so this only fires for genuinely un-demo-able cases (never in production).
  const protectedPaths = ["/dashboard", "/courses", "/settings", "/live", "/coach", "/community", "/progress", "/family", "/upgrade", "/admin"];
  const isProtected = protectedPaths.some((p) => pathname === p || pathname.startsWith(p + "/"));
  if (!user && isProtected && !isPreview()) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  // Redirect authenticated users away from auth pages
  if (user && (pathname === "/login" || pathname === "/signup")) {
    const url = request.nextUrl.clone();
    url.pathname = "/dashboard";
    return NextResponse.redirect(url);
  }

  // First-touch referral capture: any URL carrying ?ref=CODE (a direct
  // /signup?ref= link or a marketing-site passthrough) seeds the fta_ref cookie
  // once. Never overwrites an existing cookie, so the original sharer keeps
  // credit. The dedicated /r/[code] route additionally logs the click event.
  // Applied to the final response so it survives Supabase's cookie refresh.
  const ref = request.nextUrl.searchParams.get("ref");
  if (ref && !request.cookies.get(REF_COOKIE)) {
    supabaseResponse.cookies.set(REF_COOKIE, ref.trim().toUpperCase(), {
      maxAge: REF_COOKIE_MAX_AGE,
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      secure: process.env.NODE_ENV === "production",
    });
  }

  return supabaseResponse;
}
