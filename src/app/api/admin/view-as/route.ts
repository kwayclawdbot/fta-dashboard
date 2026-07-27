import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/server/require-admin";
import {
  parseViewAs,
  VIEW_AS_COOKIE,
  VIEW_AS_MAX_AGE,
} from "@/lib/view-as";

export const dynamic = "force-dynamic";

/**
 * Set / clear the admin "View as" register preview (src/lib/view-as.ts).
 *
 * WRITE GATE: requireAdmin() verifies the caller's Bearer access token against
 * Supabase auth and then reads profiles.role with the service-role client — a
 * non-admin gets 401/403 and no cookie is ever issued. The READ gate is
 * independent and equally hard (src/lib/server/view-as.ts): even a cookie
 * hand-forged in devtools is ignored unless the real profile is an admin, so
 * this route is a convenience, not the security boundary.
 *
 * Nothing here touches the database. The admin's tier, role and age_group stay
 * exactly as they are — a preview that edits the account is not a preview.
 */
export async function POST(req: NextRequest) {
  const gate = await requireAdmin(req);
  if (!gate.ok) return gate.res;

  const body = (await req.json().catch(() => null)) as { view?: unknown } | null;
  const raw = body?.view;

  // Explicit "off" — clear the cookie and return to the real account.
  if (raw === null || raw === undefined || raw === "" || raw === "off") {
    const res = NextResponse.json({ ok: true, view: null });
    res.cookies.set(VIEW_AS_COOKIE, "", {
      path: "/",
      maxAge: 0,
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
    });
    return res;
  }

  const view = parseViewAs(raw);
  if (!view) {
    return NextResponse.json({ error: "unknown register" }, { status: 400 });
  }

  const res = NextResponse.json({ ok: true, view });
  res.cookies.set(VIEW_AS_COOKIE, view, {
    path: "/",
    maxAge: VIEW_AS_MAX_AGE,
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
  });
  return res;
}
