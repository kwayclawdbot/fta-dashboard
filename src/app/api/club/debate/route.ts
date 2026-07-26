import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { deriveRegister } from "@/lib/register";
import { FLOORS, floorMet } from "@/lib/club/score";

/**
 * GET /api/club/debate
 *   → { id, question, yes, no, total, userVote, floorMet, kidWalled }
 *
 * The one live debate. Kid-walled: kids get { kidWalled:true } with NO counts and
 * no vote (same wall as the screener, migration 137). Counts come from the
 * SECURITY DEFINER aggregate RPC so no one can enumerate individual votes.
 * floorMet is false below FLOORS.debateVotes → UI renders join-framing, not raw
 * small tallies.
 */
export const runtime = "nodejs";

export async function GET() {
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
    return NextResponse.json({ kidWalled: true });
  }

  const { data } = await supabase.rpc("club_debate_state");
  if (!data) {
    return NextResponse.json({ kidWalled: false, question: null });
  }
  const s = data as {
    id: string;
    question: string;
    status: string;
    yes: number;
    no: number;
    total: number;
    userVote: string | null;
  };

  return NextResponse.json({
    id: s.id,
    question: s.question,
    status: s.status,
    yes: s.yes,
    no: s.no,
    total: s.total,
    userVote: s.userVote,
    floorMet: floorMet(s.total, FLOORS.debateVotes),
    kidWalled: false,
  });
}
