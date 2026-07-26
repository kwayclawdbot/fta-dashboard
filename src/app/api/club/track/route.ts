import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { deriveRegister } from "@/lib/register";
import { logClubEvent, type ClubEventKind } from "@/lib/club/track";

/**
 * POST /api/club/track — client-side instrumentation ingress for club_events.
 *
 * Surfaces that act purely in the browser (universal search commit, a "save"
 * tap, etc.) call this to log a Club attention event. Server routes that already
 * exist (research API, Kai chat API, market search API) log directly via
 * logClubEvent — this endpoint is for the UI-only actions the DATA lane can't
 * reach from a server route.
 *
 * Body: { kind: 'search'|'research_view'|'kai_question'|'save', ticker?, meta? }
 * Insert-own RLS enforces member_id = auth.uid(). kai_question is Kai-surface
 * only, so it is rejected for kids here (belt-and-suspenders with the Kai gate).
 */
export const runtime = "nodejs";

const ALLOWED: ClubEventKind[] = ["search", "research_view", "kai_question", "save"];

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  let body: { kind?: string; ticker?: string; meta?: Record<string, unknown> };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "bad-json" }, { status: 400 });
  }

  const kind = body.kind as ClubEventKind;
  if (!ALLOWED.includes(kind)) {
    return NextResponse.json({ error: "bad-kind" }, { status: 400 });
  }

  if (kind === "kai_question") {
    const { data: profile } = await supabase
      .from("profiles")
      .select("role, age_group, track")
      .eq("id", user.id)
      .single();
    if (deriveRegister(profile) === "kid") {
      return NextResponse.json({ error: "forbidden" }, { status: 403 });
    }
  }

  await logClubEvent(supabase, user.id, kind, body.ticker ?? null, body.meta ?? null);
  return NextResponse.json({ ok: true });
}
