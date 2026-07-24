import { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { deriveRegister } from "@/lib/register";

/**
 * POST /api/kai/deep-mode — the "Deeper analysis mode" opt-in for Family-Mode
 * ADULTS (Lane C2). Persists profiles.kai_deep_mode for the authed member only.
 *
 * Hard guard: only an ADULT register may set this. Kids and teens are refused
 * here AND ignored by resolveKaiProfile() (which returns before deepMode is
 * consulted) — belt and suspenders so a kid can never escalate into the club
 * profile through this surface.
 */
export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, age_group, track")
    .eq("id", user.id)
    .maybeSingle();

  // Only adults may opt into deeper analysis. Minors are refused outright.
  if (deriveRegister(profile) !== "adult") {
    return Response.json({ error: "Not available for this account." }, { status: 403 });
  }

  const body = await req.json().catch(() => null);
  const enabled = body?.enabled === true;

  const { error } = await supabase
    .from("profiles")
    .update({ kai_deep_mode: enabled })
    .eq("id", user.id);
  if (error) return Response.json({ error: "Could not save setting." }, { status: 500 });

  return Response.json({ ok: true, deepMode: enabled });
}
