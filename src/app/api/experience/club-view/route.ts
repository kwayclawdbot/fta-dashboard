import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { deriveRegister } from "@/lib/register";
import { CLUB_VIEW_COOKIE, clubHostLive } from "@/lib/experience/registry";

export const dynamic = "force-dynamic";

/**
 * Accept "view in Club Mode" (EXPERIENCE-ARCHITECTURE §2 rule 3) — a family-door
 * ADULT choosing to render the Club skin while they are on the club host.
 *
 * SESSION-SCOPED: no maxAge, so it dies with the browser session. The stored
 * door is never touched — this is a skin, not a conversion.
 *
 * ADULTS ONLY, enforced here from the member's REAL profile and enforced AGAIN
 * in (dashboard)/layout.tsx before the cookie is honoured. Two independent
 * checks because kids-never-escalate is a safety rule, not a preference.
 */
export async function POST() {
  if (!clubHostLive()) {
    return NextResponse.json({ error: "not available" }, { status: 404 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, age_group, track")
    .eq("id", user.id)
    .maybeSingle();

  if (deriveRegister(profile) !== "adult") {
    return NextResponse.json({ error: "adults only" }, { status: 403 });
  }

  const res = NextResponse.json({ ok: true });
  res.cookies.set(CLUB_VIEW_COOKIE, "1", {
    path: "/",
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
  });
  return res;
}
