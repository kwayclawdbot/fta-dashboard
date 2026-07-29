import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { ownedDaysSince } from "@/lib/ownership/shape";
import { computeOwnershipScore, type ScoreCardInput } from "@/lib/ownership/score";
import type { AssetType, CardStatus } from "@/lib/ownership/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/ownership/score — the caller's Ownership Score.
 *
 * Aggregates hold-side signals only (collection, hold-age, diversification,
 * gifting, learning) — NEVER returns/performance. Cards + transfers are RLS-scoped
 * to the caller; learning is bridged read-only from the existing XP system
 * (xp_events kind in lesson|quiz). Returns { total, breakdown[] } from the pure
 * scorer in lib/ownership/score.ts.
 */
export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const [cardsRes, sentRes, receivedRes, learnRes] = await Promise.all([
    supabase.from("ownership_cards").select("status, acq_at, asset_type, asset_symbol"),
    supabase
      .from("card_transfers")
      .select("id", { count: "exact", head: true })
      .eq("from_user", user.id)
      .eq("status", "accepted"),
    supabase
      .from("card_transfers")
      .select("id", { count: "exact", head: true })
      .eq("to_user", user.id)
      .eq("status", "accepted"),
    supabase
      .from("xp_events")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id)
      .in("kind", ["lesson", "quiz"]),
  ]);

  if (cardsRes.error) {
    return NextResponse.json({ error: cardsRes.error.message }, { status: 500 });
  }

  const now = new Date();
  const cards: ScoreCardInput[] = (
    (cardsRes.data || []) as {
      status: CardStatus;
      acq_at: string;
      asset_type: AssetType;
      asset_symbol: string;
    }[]
  ).map((r) => ({
    status: r.status,
    ownedDays: ownedDaysSince(r.acq_at, now),
    assetType: r.asset_type,
    assetSymbol: r.asset_symbol,
  }));

  const score = computeOwnershipScore({
    cards,
    giftsSent: sentRes.count || 0,
    giftsReceived: receivedRes.count || 0,
    lessonsCompleted: learnRes.count || 0,
  });

  return NextResponse.json(score);
}
