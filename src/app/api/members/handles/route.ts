import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { deriveRegister } from "@/lib/register";

/**
 * POST /api/members/handles  { ids: string[] } → { handles: { [id]: { username, name } } }
 *
 * A tiny, UI-support resolver (NOT under /api/club/** — the DATA lane's territory
 * is untouched). ClubHome's Collective constellation gets member avatars as
 * { id, url } from /api/club/collective; to make each node a link to that
 * member's public profile (/u/[username]) the UI needs id → username. Profiles
 * RLS only exposes own+family rows to the client and there's no id→username RPC,
 * so this authenticated route resolves the mapping server-side.
 *
 * Exposes nothing new: username + display_name are already public to any authed
 * member via /u/[username] and community author links. KID members are never
 * surfaced (same deriveRegister wall as the constellation's consent proxy).
 */
export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  let ids: string[] = [];
  try {
    const body = (await req.json()) as { ids?: unknown };
    if (Array.isArray(body?.ids)) {
      ids = body.ids
        .filter((x): x is string => typeof x === "string" && x.length > 0)
        .slice(0, 60);
    }
  } catch {
    /* empty / bad body → no ids */
  }
  if (ids.length === 0) return NextResponse.json({ handles: {} });

  const admin = createAdminClient();
  const { data: rows } = await admin
    .from("profiles")
    .select("id, username, display_name, role, age_group, track")
    .in("id", ids);

  const handles: Record<string, { username: string | null; name: string | null }> = {};
  for (const p of rows || []) {
    if (deriveRegister(p) === "kid") continue; // kids never surface in the network
    handles[p.id as string] = {
      username: (p.username as string | null) ?? null,
      name: (p.display_name as string | null) ?? null,
    };
  }

  return NextResponse.json({ handles });
}
