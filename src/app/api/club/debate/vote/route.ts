import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { deriveRegister } from "@/lib/register";
import { FLOORS, floorMet } from "@/lib/club/score";

/**
 * POST /api/club/debate/vote  { debateId, choice: 'yes'|'no' }
 *   → { ok, yes, no, total, userVote, floorMet }
 *
 * One vote per member (upsert). Kid-walled server-side here AND inside the
 * club_debate_vote() RPC (belt-and-suspenders). Returns the updated tally.
 */
export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, age_group, track")
    .eq("id", user.id)
    .single();
  if (deriveRegister(profile) === "kid") {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  let body: { debateId?: string; choice?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "bad-json" }, { status: 400 });
  }
  if (!body.debateId || (body.choice !== "yes" && body.choice !== "no")) {
    return NextResponse.json({ error: "bad-input" }, { status: 400 });
  }

  const { data, error } = await supabase.rpc("club_debate_vote", {
    p_debate_id: body.debateId,
    p_choice: body.choice,
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const result = data as { ok: boolean; reason?: string; state?: { yes: number; no: number; total: number; userVote: string | null } };
  if (!result?.ok) {
    return NextResponse.json({ ok: false, reason: result?.reason || "failed" }, { status: 400 });
  }
  const st = result.state!;
  return NextResponse.json({
    ok: true,
    yes: st.yes,
    no: st.no,
    total: st.total,
    userVote: st.userVote,
    floorMet: floorMet(st.total, FLOORS.debateVotes),
  });
}
