import { NextResponse, type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";
import {
  EXPERIENCE_HEADER,
  resolveExperienceFromHost,
} from "@/lib/experience/registry";
import {
  CUTOVER_COOKIE,
  cutoverCookieWrite,
  isCutoverEnabled,
  resolveV3Rewrite,
} from "@/lib/v3-cutover";

/**
 * Legacy Vercel host we are migrating away from. Requests hitting this host are
 * 308-redirected to the canonical host once NEXT_PUBLIC_CANONICAL_HOST is set.
 */
const LEGACY_HOST = "fta-dashboard-ruddy.vercel.app";

export async function middleware(request: NextRequest) {
  // Env-gated canonical-host redirect. Inert until NEXT_PUBLIC_CANONICAL_HOST
  // is set in the environment (do NOT set until DNS for the canonical host is
  // live, or auth callbacks break). When set, any request arriving on the
  // legacy Vercel host is permanently (308, method-preserving) redirected to
  // the same path/query on the canonical host so the ruddy URL disappears.
  const canonicalHost = process.env.NEXT_PUBLIC_CANONICAL_HOST?.trim();
  if (canonicalHost) {
    const host = request.headers.get("host");
    if (host === LEGACY_HOST && host !== canonicalHost) {
      const url = request.nextUrl.clone();
      url.host = canonicalHost;
      url.protocol = "https:";
      url.port = "";
      return NextResponse.redirect(url, 308);
    }
  }

  // EXPERIENCE (E1) — the entry host names the door, and it is stamped on the
  // REQUEST so every server component below can read it with headers() without
  // re-deriving it (and without a client component ever guessing from
  // window.location). Logged-out surfaces render this; a logged-in member
  // renders their stored families.door. Rewriting the request headers is the
  // only way to add one, so the incoming set is cloned and passed through.
  // V3 CUTOVER (default off) — see src/lib/v3-cutover.ts. When the harness is
  // on and this path is one of the staged screens, the OLD url is answered by
  // the v3 tree. The target is handed to updateSession rather than applied
  // here, so every auth check below still runs against the path that was
  // REQUESTED: /you stays protected as /you even though /v3/you renders it.
  const rewritePath = isCutoverEnabled(request)
    ? resolveV3Rewrite(request.nextUrl.pathname)
    : null;
  let rewriteTo: URL | undefined;
  if (rewritePath) {
    rewriteTo = request.nextUrl.clone();
    rewriteTo.pathname = rewritePath;
  }

  const response = await updateSession(
    request,
    { [EXPERIENCE_HEADER]: resolveExperienceFromHost(request.headers.get("host")) },
    rewriteTo
  );

  // Persist an explicit ?v3=1 / ?v3=0 so the reviewer's choice survives the
  // next tap. Written on the way out so it rides whatever response the session
  // layer produced — including a redirect.
  const cookieWrite = cutoverCookieWrite(request);
  if (cookieWrite !== null) {
    response.cookies.set(CUTOVER_COOKIE, cookieWrite, {
      path: "/",
      sameSite: "lax",
      httpOnly: false,
    });
  }

  return response;
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public assets
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|mp3|wav|json)$).*)",
  ],
};
