import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getClubTier } from "@/lib/tier";
import { deriveRegister } from "@/lib/register";
import { parseAlertRequest, AlertParseError } from "@/lib/alerts/parse";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

/**
 * KAI WATCH — natural-language → structured alert rule parsing (LANE R4).
 *
 * A member types plain English ("tell me if NVDA drops below $150 and volume
 * spikes"); Kai (claude-haiku-4-5, cheap + structured-output-capable) parses it
 * into one or more C6 alert_rules conditions. This route ONLY parses + validates
 * — it never writes. The client shows Kai's plain-language confirmation and, on
 * confirm, inserts the rules under its own-row RLS (respecting the 20-active cap).
 *
 * The parse + validate logic itself now lives in src/lib/alerts/parse.ts so this
 * route AND the `propose_alert_rule` Kai-chat tool share ONE implementation.
 *
 * Compliance floor (owner decision 7): Kai promises SIGNALS + interpretation,
 * never advice and never thesis-omniscience. Confirmation copy is NOTIFICATION
 * framing ("I'll tell you when X happens"), never a recommendation. Unsupported
 * asks get an honest "here's what I CAN watch instead" — no faking a capability.
 *
 * Gating mirrors /alerts: adults on a paying tier only; kids/teens/free rejected.
 */
export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, age_group, track, family_id")
    .eq("id", user.id)
    .single();

  // Kids/teens never reach Kai Watch (belt-and-suspenders with the nav + page).
  if (deriveRegister(profile) !== "adult") {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  const tier = await getClubTier(supabase, profile?.family_id);
  if (tier === "free") {
    return NextResponse.json({ error: "members_only" }, { status: 403 });
  }

  const body = (await req.json().catch(() => ({}))) as {
    text?: string;
    ticker?: string;
  };
  const text = (body.text || "").trim();
  if (text.length < 2) {
    return NextResponse.json({ error: "empty" }, { status: 400 });
  }

  try {
    const result = await parseAlertRequest({ text, ticker: body.ticker });
    return NextResponse.json(result);
  } catch (e) {
    if (e instanceof AlertParseError) {
      return NextResponse.json(
        { error: e.code },
        { status: e.code === "unavailable" ? 503 : 502 }
      );
    }
    console.error("[KaiWatch] route exception:", e);
    return NextResponse.json({ error: "parse_failed" }, { status: 502 });
  }
}
