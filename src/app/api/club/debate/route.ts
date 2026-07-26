import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
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

  // UI-contract reconcile (§8 DebateResponse.participants): an ambient stack of
  // consented adult member faces for the "join the debate" social proof. These
  // are Club members (avatar set, non-kid) — NOT vote-attributed: the per-member
  // vote direction stays sealed behind the aggregate RPC, so nothing leaks.
  let participants: { id: string; name: string | null; url: string | null }[] = [];
  if (s.total > 0) {
    const admin = createAdminClient();
    const { data: people } = await admin
      .from("profiles")
      .select("id, display_name, username, avatar_url, role, age_group, track")
      .not("avatar_url", "is", null)
      .limit(40);
    participants = (people || [])
      .filter((p) => deriveRegister(p) !== "kid")
      .slice(0, 8)
      .map((p) => ({
        id: p.id,
        name: p.display_name || p.username || null,
        url: p.avatar_url as string | null,
      }));
  }

  return NextResponse.json({
    id: s.id,
    question: s.question,
    status: s.status,
    yes: s.yes,
    no: s.no,
    total: s.total,
    // UI contract (§8): the counts object the card reads (yes/no kept too).
    counts: { yes: s.yes, no: s.no },
    userVote: s.userVote,
    floorMet: floorMet(s.total, FLOORS.debateVotes),
    participants,
    kidWalled: false,
  });
}
