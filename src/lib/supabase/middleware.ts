import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { REF_COOKIE, REF_COOKIE_MAX_AGE } from "@/lib/referral";

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

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;

  // Protect dashboard routes — redirect to login if no session
  const protectedPaths = ["/dashboard", "/courses", "/settings", "/live", "/coach", "/community", "/progress", "/family", "/upgrade", "/admin"];
  const isProtected = protectedPaths.some((p) => pathname === p || pathname.startsWith(p + "/"));
  if (!user && isProtected) {
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
