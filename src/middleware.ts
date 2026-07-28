import { NextResponse, type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

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

  return await updateSession(request);
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
