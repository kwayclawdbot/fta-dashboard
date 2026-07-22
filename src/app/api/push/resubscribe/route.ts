import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Re-subscribe endpoint for the service worker's `pushsubscriptionchange`
 * handler (public/sw.js). The SW fetch runs same-origin with credentials, so
 * we identify the user from the Supabase auth cookie — no bearer needed and no
 * user id trusted from the body. Then we upsert the new subscription and delete
 * the rotated-away old endpoint for THIS user, keeping push_subscriptions
 * clean of ghost rows.
 *
 * Auth failures return 401 quietly; the client-side once/day heal
 * (useSelfHealPush) re-links on the next authenticated app open regardless.
 */
export async function POST(req: NextRequest) {
  let body: {
    endpoint?: string;
    old_endpoint?: string | null;
    p256dh?: string;
    auth?: string;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "bad body" }, { status: 400 });
  }

  if (!body.endpoint || !body.p256dh || !body.auth) {
    return NextResponse.json({ error: "incomplete subscription" }, { status: 400 });
  }

  // Identify the user from the same-origin auth cookie.
  const authed = await createClient();
  const {
    data: { user },
  } = await authed.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const ua = req.headers.get("user-agent") || null;
  const admin = createAdminClient();

  // Drop the rotated-away endpoint for this user (if the browser gave us one).
  if (body.old_endpoint && body.old_endpoint !== body.endpoint) {
    await admin
      .from("push_subscriptions")
      .delete()
      .eq("user_id", user.id)
      .eq("endpoint", body.old_endpoint);
  }

  const { error } = await admin.from("push_subscriptions").upsert(
    {
      user_id: user.id,
      endpoint: body.endpoint,
      p256dh: body.p256dh,
      auth: body.auth,
      user_agent: ua ? ua.slice(0, 255) : null,
      device_label: labelFromUa(ua),
      last_seen_at: new Date().toISOString(),
    },
    { onConflict: "endpoint" }
  );

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}

/** Server-side UA → device label (mirrors parseDeviceLabel in lib/push.ts). */
function labelFromUa(ua: string | null): string {
  if (!ua) return "This device";
  let os = "Device";
  if (/iphone/i.test(ua)) os = "iPhone";
  else if (/ipad/i.test(ua)) os = "iPad";
  else if (/macintosh|mac os x/i.test(ua)) os = "Mac";
  else if (/android/i.test(ua)) os = "Android";
  else if (/windows/i.test(ua)) os = "Windows";
  else if (/linux/i.test(ua)) os = "Linux";
  let browser = "";
  if (/edg\//i.test(ua)) browser = "Edge";
  else if (/crios|chrome/i.test(ua)) browser = "Chrome";
  else if (/fxios|firefox/i.test(ua)) browser = "Firefox";
  else if (/safari/i.test(ua)) browser = "Safari";
  return browser ? `${os} · ${browser}` : os;
}
