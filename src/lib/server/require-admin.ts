import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Verify the caller is an admin via their Bearer access token (same pattern as
 * /api/admin/invite). Returns the service-role client + user id on success, or
 * a ready-to-return NextResponse on failure.
 */
export async function requireAdmin(
  req: NextRequest
): Promise<
  | { ok: true; db: SupabaseClient; userId: string }
  | { ok: false; res: NextResponse }
> {
  const auth = req.headers.get("authorization") || "";
  const jwt = auth.replace(/^Bearer\s+/i, "");
  if (!jwt)
    return { ok: false, res: NextResponse.json({ error: "unauthorized" }, { status: 401 }) };

  const db = createAdminClient();
  const { data: userRes, error } = await db.auth.getUser(jwt);
  if (error || !userRes?.user)
    return { ok: false, res: NextResponse.json({ error: "unauthorized" }, { status: 401 }) };

  const { data: prof } = await db
    .from("profiles")
    .select("role")
    .eq("id", userRes.user.id)
    .single();
  if (prof?.role !== "admin")
    return { ok: false, res: NextResponse.json({ error: "admin only" }, { status: 403 }) };

  return { ok: true, db, userId: userRes.user.id };
}
