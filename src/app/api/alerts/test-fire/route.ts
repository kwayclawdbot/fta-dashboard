import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * TEST-FIRE — force one rule to fire, for verification/QA only.
 *
 * Guarded by CRON_SECRET (Bearer or ?secret=). Given a rule_id it calls
 * fire_rule_event with a synthetic "test" payload, exercising the full delivery
 * path (event row + instant-vs-digest decision + notification → 028 push
 * dispatch). Never wired to a cron; there is no user-reachable trigger.
 */
export async function POST(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json({ error: "CRON_SECRET not configured" }, { status: 401 });
  }
  const auth = req.headers.get("authorization") || "";
  const qsSecret = req.nextUrl.searchParams.get("secret") || "";
  if (!(auth === `Bearer ${secret}` || qsSecret === secret)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let body: { rule_id?: string; message?: string };
  try {
    body = (await req.json()) as { rule_id?: string; message?: string };
  } catch {
    return NextResponse.json({ error: "bad body" }, { status: 400 });
  }
  if (!body.rule_id) {
    return NextResponse.json({ error: "rule_id required" }, { status: 400 });
  }

  const db = createAdminClient();
  const { data: rule } = await db
    .from("alert_rules")
    .select("id, ticker, label")
    .eq("id", body.rule_id)
    .maybeSingle();
  if (!rule) {
    return NextResponse.json({ error: "rule not found" }, { status: 404 });
  }

  const { data, error } = await db.rpc("fire_rule_event", {
    p_rule_id: body.rule_id,
    p_payload: {
      ticker: rule.ticker,
      message: body.message || `TEST — ${rule.label}`,
      condition: "test-fire",
      snapshot_price: null,
      test: true,
    },
  });
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, delivered: (data as string) || "none" });
}
