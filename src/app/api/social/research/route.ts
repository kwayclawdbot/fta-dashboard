import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { deriveRegister } from "@/lib/register";
import { getEntitlements, can } from "@/lib/entitlements";

/**
 * Research Object v1 publish/list endpoint (SOCIAL OBJECTS S1).
 *
 * POST /api/social/research  { ticker, stance, headline, timeHorizon?, thesis?,
 *   catalysts?, risks?, valuation? } → { ok, id }
 *   The SINGLE structured-thesis publish entry point. Basic ticker posts stay on
 *   the free community composer (untouched); THIS path is the paid structured
 *   thesis. price_at_publish + company_name are captured server-side from
 *   screener_metrics inside publish_research_object() (migration 152). Kid-walled
 *   both here and in the RPC (belt-and-suspenders).
 *
 * GET  /api/social/research?ticker=NVDA → ResearchObjectCard[]
 */
export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const ticker = req.nextUrl.searchParams.get("ticker");
  if (!ticker) return NextResponse.json({ error: "ticker-required" }, { status: 400 });

  const { data, error } = await supabase.rpc("get_ticker_research_objects", {
    p_ticker: ticker,
    p_limit: 20,
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ objects: data ?? [] });
}

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

  // Kid-wall: structured thesis publishing is adults+teens only.
  if (deriveRegister(profile) === "kid") {
    return NextResponse.json({ error: "forbidden", reason: "kid_walled" }, { status: 403 });
  }

  // ENTITLEMENT (MONETIZATION-GATES.md): the structured Research Object is a paid
  // (Cheat Code Club / FTA) publish path — the ONE gated entry point. The basic
  // free ticker post lives on the community composer and is untouched. Server-
  // authoritative via the central can() gate (never UI-only); a Challenge-Pass
  // holder reads tier 'fic' and passes. Composes with the kid wall above.
  const ent = await getEntitlements(supabase, { profile });
  if (!can(ent, "publish_thesis")) {
    return NextResponse.json(
      { error: "members_only", reason: "walled", feature: "publish_thesis" },
      { status: 403 }
    );
  }

  let body: {
    ticker?: string;
    stance?: string;
    headline?: string;
    timeHorizon?: string | null;
    thesis?: string;
    catalysts?: string;
    risks?: string;
    valuation?: string;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "bad-json" }, { status: 400 });
  }

  if (!body.ticker || !body.headline || !body.stance) {
    return NextResponse.json({ error: "bad-input" }, { status: 400 });
  }

  const { data, error } = await supabase.rpc("publish_research_object", {
    p_ticker: body.ticker,
    p_stance: body.stance,
    p_headline: body.headline,
    p_time_horizon: body.timeHorizon ?? null,
    p_thesis: body.thesis ?? "",
    p_catalysts: body.catalysts ?? "",
    p_risks: body.risks ?? "",
    p_valuation: body.valuation ?? "",
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const result = data as { ok: boolean; reason?: string; id?: string };
  if (!result?.ok) {
    return NextResponse.json({ ok: false, reason: result?.reason || "failed" }, { status: 400 });
  }
  return NextResponse.json({ ok: true, id: result.id });
}
