import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { isMemberVisibleOnDoor } from "@/lib/register";
import { FLOORS, floorMet } from "@/lib/club/score";
import { resolveClubCtx, type ClubCtx, type CoreResult } from "@/lib/club/home-context";

/**
 * GET /api/club/debate
 *   → { id, question, yes, no, total, userVote, floorMet, kidWalled }
 *
 * The one live debate. Kid-walled: kids get { kidWalled:true } with NO counts and
 * no vote (same wall as the screener, migration 137). Counts come from the
 * SECURITY DEFINER aggregate RPC so no one can enumerate individual votes.
 * floorMet is false below FLOORS.debateVotes → UI renders join-framing, not raw
 * small tallies.
 *
 * The body is `debateCore(ctx)` — shared verbatim with GET /api/club/home.
 */
export const runtime = "nodejs";

export async function debateCore(ctx: ClubCtx): Promise<CoreResult> {
  if ((await ctx.getRegister()) === "kid") {
    return { body: { kidWalled: true } };
  }

  const { data } = await ctx.supabase.rpc("club_debate_state");
  if (!data) {
    return { body: { kidWalled: false, question: null } };
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
  // The faces are door-walled like every other people listing: kids never (214),
  // teens to the family door only (216) — this stack carries NAMES, so it is a
  // people surface, not decoration.
  let participants: { id: string; name: string | null; url: string | null }[] = [];
  if (s.total > 0) {
    const admin = ctx.admin();
    const [{ data: people }, door] = await Promise.all([
      admin
        .from("profiles")
        .select("id, display_name, username, avatar_url, role, age_group, track")
        .not("avatar_url", "is", null)
        .limit(40),
      ctx.getDoor(),
    ]);
    participants = (people || [])
      .filter((p) => isMemberVisibleOnDoor(p, door))
      .slice(0, 8)
      .map((p) => ({
        id: p.id,
        name: p.display_name || p.username || null,
        url: p.avatar_url as string | null,
      }));
  }

  return {
    body: {
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
    },
  };
}

export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const ctx = await resolveClubCtx(supabase, req);
  if (!ctx) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { status, body } = await debateCore(ctx);
  return NextResponse.json(body, status ? { status } : undefined);
}
