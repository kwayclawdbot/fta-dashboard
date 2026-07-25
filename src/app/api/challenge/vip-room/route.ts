import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

/**
 * Private VIP room feed (Lane C9) — gated to VIP members only.
 *
 *   GET  → { vip, windowOpen, vipEnabled, posts } — posts only when vip.
 *   POST { body } → create a VIP-room post (vip only).
 *
 * vip_room_posts has RLS on with no client policies, so all access flows through
 * here: authenticate the session, confirm the family holds a VIP ticket, then
 * read/write with the service role. The main community feed can never see these.
 */

async function resolveVip(userId: string) {
  const admin = createAdminClient();
  const { data: prof } = await admin
    .from("profiles")
    .select("family_id, display_name")
    .eq("id", userId)
    .maybeSingle();
  const familyId = prof?.family_id ?? null;
  let vip = false;
  if (familyId) {
    const { data } = await admin
      .from("challenge_vips")
      .select("id")
      .eq("family_id", familyId)
      .maybeSingle();
    vip = !!data;
  }
  return { admin, familyId, vip, displayName: prof?.display_name ?? "" };
}

async function windowState(admin: ReturnType<typeof createAdminClient>) {
  const { data: endRow } = await admin
    .from("app_settings")
    .select("value")
    .eq("key", "challenge_end")
    .maybeSingle();
  const { data: gate } = await admin
    .from("app_settings")
    .select("value")
    .eq("key", "challenge_vip_enabled")
    .maybeSingle();
  const end = typeof endRow?.value === "string" ? new Date(endRow.value) : null;
  const windowOpen = end ? Date.now() <= end.getTime() : true;
  return { windowOpen, vipEnabled: gate?.value === true };
}

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  const { admin, vip } = await resolveVip(user.id);
  const { windowOpen, vipEnabled } = await windowState(admin);

  if (!vip) {
    return NextResponse.json({ vip: false, windowOpen, vipEnabled, posts: [] });
  }

  const { data: posts } = await admin
    .from("vip_room_posts")
    .select("id, body, created_at, author:profiles!vip_room_posts_author_id_fkey(display_name, avatar_url)")
    .order("created_at", { ascending: false })
    .limit(100);

  return NextResponse.json({ vip: true, windowOpen, vipEnabled, posts: posts ?? [] });
}

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  const { admin, familyId, vip } = await resolveVip(user.id);
  if (!vip) return NextResponse.json({ error: "VIP members only." }, { status: 403 });

  const body = await req.json().catch(() => null);
  const text = String(body?.body || "").trim();
  if (!text) return NextResponse.json({ error: "Say something first." }, { status: 400 });
  if (text.length > 4000)
    return NextResponse.json({ error: "That's a bit long — keep it under 4000 characters." }, { status: 400 });

  const { data: post, error } = await admin
    .from("vip_room_posts")
    .insert({ author_id: user.id, family_id: familyId, body: text })
    .select("id, body, created_at, author:profiles!vip_room_posts_author_id_fkey(display_name, avatar_url)")
    .single();
  if (error) return NextResponse.json({ error: "Could not post." }, { status: 500 });

  return NextResponse.json({ ok: true, post });
}
