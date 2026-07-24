import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * DAILY ALERT DIGEST (once/day; see vercel.json).
 *
 * Every held alert_event (delivered='digest', digest_sent_at null) is a fire the
 * member chose NOT to receive instantly (digest pref, per-rule digest, or a hit
 * that landed over their daily push cap). This cron rolls each user's held events
 * into ONE summary push — "N alerts today" → /alerts — and stamps digest_sent_at
 * so it never re-sends. In-app the events were always visible in the Feed; this
 * is purely the once-a-day nudge.
 *
 * Auth: Bearer CRON_SECRET or ?secret=.
 */
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json({ error: "CRON_SECRET not configured" }, { status: 401 });
  }
  const auth = req.headers.get("authorization") || "";
  const qsSecret = req.nextUrl.searchParams.get("secret") || "";
  if (!(auth === `Bearer ${secret}` || qsSecret === secret)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const db = createAdminClient();

  // Gather held events (bounded window: last 24h) grouped per user.
  const since = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
  const { data: events } = await db
    .from("alert_events")
    .select("id, user_id, ticker")
    .eq("delivered", "digest")
    .is("digest_sent_at", null)
    .gte("fired_at", since);

  const rows = (events || []) as { id: string; user_id: string; ticker: string }[];
  if (rows.length === 0) {
    return NextResponse.json({ ok: true, users: 0, sent: 0 });
  }

  const byUser = new Map<string, { ids: string[]; tickers: Set<string> }>();
  for (const e of rows) {
    let g = byUser.get(e.user_id);
    if (!g) {
      g = { ids: [], tickers: new Set() };
      byUser.set(e.user_id, g);
    }
    g.ids.push(e.id);
    if (e.ticker) g.tickers.add(e.ticker);
  }

  const now = new Date().toISOString();
  let sent = 0;
  for (const [userId, g] of byUser) {
    const n = g.ids.length;
    const tickers = [...g.tickers].slice(0, 4).join(", ");
    const body = `${n} alert${n > 1 ? "s" : ""} today${tickers ? ` — ${tickers}${g.tickers.size > 4 ? "…" : ""}` : ""}`;

    const { data: notif } = await db
      .from("notifications")
      .insert({ user_id: userId, actor_id: null, type: "alert", body, link: "/alerts" })
      .select("id")
      .single();

    await db
      .from("alert_events")
      .update({ digest_sent_at: now, notification_id: notif?.id ?? null })
      .in("id", g.ids);
    sent++;
  }

  return NextResponse.json({ ok: true, users: byUser.size, sent });
}
