import { NextRequest, NextResponse } from "next/server";
import webpush from "web-push";
import { createAdminClient } from "@/lib/supabase/admin";
import { siteUrl } from "@/lib/site-url";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Web Push dispatcher.
 *
 * Called by a Postgres pg_net trigger on notifications AFTER INSERT
 * (migration 028) with the notification row as the JSON body and the
 * shared secret in x-push-secret. Also supports ?sweep=1 (same secret)
 * to re-send any undispatched notifications from the last 24h — manual
 * recovery if pg_net ever misfires.
 */

interface NotificationRow {
  id: string;
  user_id: string;
  actor_id: string | null;
  type: "reply" | "mention" | "announcement";
  message_id: string | null;
  body: string;
  read_at: string | null;
  dispatched_at: string | null;
  created_at: string;
}

function vapidConfigured(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY
  );
}

function titleFor(n: NotificationRow, actorName: string): string {
  switch (n.type) {
    case "reply":
      return `${actorName} replied to you`;
    case "mention":
      return `${actorName} mentioned you`;
    case "announcement":
      return "New announcement";
  }
}

async function dispatchOne(
  supabase: ReturnType<typeof createAdminClient>,
  n: NotificationRow
): Promise<{ sent: number; pruned: number }> {
  let sent = 0;
  let pruned = 0;

  const { data: subs } = await supabase
    .from("push_subscriptions")
    .select("id, endpoint, p256dh, auth")
    .eq("user_id", n.user_id);

  if (subs && subs.length > 0) {
    let actorName = "Someone";
    if (n.actor_id) {
      const { data: actor } = await supabase
        .from("profiles")
        .select("display_name")
        .eq("id", n.actor_id)
        .single();
      if (actor?.display_name) actorName = actor.display_name;
    }

    const payload = JSON.stringify({
      title: titleFor(n, actorName),
      body: (n.body || "").slice(0, 160),
      url: "/community",
    });

    await Promise.all(
      subs.map(async (sub) => {
        try {
          await webpush.sendNotification(
            {
              endpoint: sub.endpoint,
              keys: { p256dh: sub.p256dh, auth: sub.auth },
            },
            payload,
            { TTL: 60 * 60 * 24 }
          );
          sent++;
        } catch (err) {
          const status = (err as { statusCode?: number }).statusCode;
          if (status === 404 || status === 410) {
            // Subscription gone — prune it
            await supabase.from("push_subscriptions").delete().eq("id", sub.id);
            pruned++;
          } else {
            console.error("[push/dispatch] send failed:", status, sub.endpoint);
          }
        }
      })
    );
  }

  await supabase
    .from("notifications")
    .update({ dispatched_at: new Date().toISOString() })
    .eq("id", n.id);

  return { sent, pruned };
}

export async function POST(req: NextRequest) {
  const secret = process.env.PUSH_DISPATCH_SECRET;
  if (!secret || req.headers.get("x-push-secret") !== secret) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const supabase = createAdminClient();

  if (vapidConfigured()) {
    webpush.setVapidDetails(
      siteUrl(),
      process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!.trim(),
      process.env.VAPID_PRIVATE_KEY!.trim()
    );
  }

  // Sweep mode: process everything undispatched from the last 24h
  if (req.nextUrl.searchParams.get("sweep") === "1") {
    const { data: pending } = await supabase
      .from("notifications")
      .select("*")
      .is("dispatched_at", null)
      .gte("created_at", new Date(Date.now() - 24 * 3600 * 1000).toISOString())
      .order("created_at", { ascending: true })
      .limit(200);

    let sent = 0;
    let pruned = 0;
    for (const n of pending ?? []) {
      if (!vapidConfigured()) break;
      const r = await dispatchOne(supabase, n as NotificationRow);
      sent += r.sent;
      pruned += r.pruned;
    }
    return NextResponse.json({
      ok: true,
      mode: "sweep",
      processed: pending?.length ?? 0,
      sent,
      pruned,
    });
  }

  // Normal mode: pg_net posts the notification row
  let n: NotificationRow;
  try {
    n = (await req.json()) as NotificationRow;
  } catch {
    return NextResponse.json({ error: "bad body" }, { status: 400 });
  }
  if (!n?.id || !n?.user_id) {
    return NextResponse.json({ error: "bad body" }, { status: 400 });
  }

  if (!vapidConfigured()) {
    // Still mark dispatched so a later sweep doesn't double-send after
    // keys are configured; in-app bell is unaffected.
    await supabase
      .from("notifications")
      .update({ dispatched_at: new Date().toISOString() })
      .eq("id", n.id);
    return NextResponse.json({ ok: true, sent: 0, note: "vapid not configured" });
  }

  const { sent, pruned } = await dispatchOne(supabase, n);
  return NextResponse.json({ ok: true, sent, pruned });
}
