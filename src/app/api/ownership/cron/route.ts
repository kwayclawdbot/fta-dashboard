import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getEodCloses } from "@/lib/ownership/pricing";
import {
  normalizeDesignState,
  ownedDaysSince,
  type CardRow,
} from "@/lib/ownership/shape";
import {
  evaluateMilestones,
  anniversaryYear,
  TIER_SNAPSHOT_LABEL,
  CLUB_SNAPSHOT_LABEL,
} from "@/lib/ownership/milestones";
import type { CardDesignState, ValueClub } from "@/lib/ownership/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * GET /api/ownership/cron — nightly Ownership Cards sync + milestone engine.
 *
 * (pg_cron is unavailable on this project — same as track-performance — so this
 * runs from Vercel Cron. It is IDEMPOTENT: milestone snapshots dedupe by label,
 * tiers/clubs never regress, so re-running the same day is a no-op.)
 *
 * For every non-retired card:
 *   1. Refresh the EOD close (force-refresh, one batched Polygon pass, day-cached).
 *   2. Compute hold-age tier + value-club transitions (issued→100d→1y→1000d→legacy;
 *      +25/+50/+100% high-water). Each newly-crossed milestone → record_card_milestone
 *      (event + snapshot with the new design_state) and the design_state cache advances.
 *   3. Yearly-anniversary snapshots: one snapshot per completed year, deduped by label.
 *
 * SnapTrade quantity-diff seal detection is a no-op until SNAPTRADE_CONSUMER_KEY
 * lands (manual cards are self-reported via /card/[id]/seal). Milestones NEVER
 * push to trade — hold-side only.
 *
 * Auth: Bearer CRON_SECRET (Vercel injects Authorization) or ?secret=. Without
 * CRON_SECRET configured the route refuses (fail-safe).
 */
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json({ error: "CRON_SECRET not configured" }, { status: 401 });
  }
  const auth = req.headers.get("authorization") || "";
  const qsSecret = req.nextUrl.searchParams.get("secret") || "";
  if (auth !== `Bearer ${secret}` && qsSecret !== secret) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const db = createAdminClient();

  // Revert any pending gift transfers past their 7-day window (card → active).
  // Runs first so a stale in_transfer card is unlocked before the sync pass.
  let expiredTransfers = 0;
  {
    const { data: exp, error: expErr } = await db.rpc("expire_stale_transfers");
    if (!expErr && typeof exp === "number") expiredTransfers = exp;
  }

  // Active + seal_broken + in_transfer cards accrue history; retired/draft don't.
  const { data, error } = await db
    .from("ownership_cards")
    .select("*")
    .in("status", ["active", "seal_broken", "in_transfer"]);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const cards = (data || []) as CardRow[];
  if (cards.length === 0) {
    return NextResponse.json({
      ok: true,
      cards: 0,
      expiredTransfers,
      note: "nothing to sync",
    });
  }

  // 1. Force-refresh EOD closes for every card symbol (batched + day-cached).
  const prices = await getEodCloses(
    cards.map((c) => ({ symbol: c.asset_symbol, assetType: c.asset_type })),
    { forceRefresh: true, db }
  );

  // Existing yearly-anniversary snapshot labels, one batched read (dedupe).
  const { data: snapRows } = await db
    .from("card_snapshots")
    .select("card_id, label")
    .in(
      "card_id",
      cards.map((c) => c.id)
    )
    .like("label", "year_%");
  const yearSnaps = new Set(
    ((snapRows || []) as { card_id: string; label: string }[]).map(
      (r) => `${r.card_id}:${r.label}`
    )
  );

  const now = new Date();
  let ageMilestones = 0;
  let valueMilestones = 0;
  let anniversaries = 0;

  const record = async (
    cardId: string,
    kind: "milestone_age" | "milestone_value" | "snapshot",
    label: string,
    payload: Record<string, unknown>,
    value: number,
    design: CardDesignState
  ) => {
    await db.rpc("record_card_milestone", {
      p_card_id: cardId,
      p_event_kind: kind,
      p_snapshot_label: label,
      p_payload: payload,
      p_value: value,
      p_design_state: design,
    });
  };

  for (const c of cards) {
    const denomination = Number(c.denomination) || 0;
    const originalValue = Number(c.acq_original_value) || 0;
    const price = prices[c.asset_symbol.toUpperCase()];
    const currentValue = price ? price.close * denomination : originalValue;
    const gainPct =
      price && originalValue > 0
        ? ((currentValue - originalValue) / originalValue) * 100
        : null;

    const ownedDays = ownedDaysSince(c.acq_at, now);
    const current = normalizeDesignState(c.design_state, c.series);
    const result = evaluateMilestones(current, ownedDays, gainPct);

    // Apply milestones incrementally so each snapshot stores its own era, and the
    // design_state cache ends at the final era.
    let design: CardDesignState = current;

    if (result.newTier) {
      design = { ...design, holdTier: result.newTier };
      await record(
        c.id,
        "milestone_age",
        TIER_SNAPSHOT_LABEL[result.newTier],
        { tier: result.newTier, ownedDays },
        currentValue,
        design
      );
      ageMilestones++;
    }

    for (const club of result.newClubs) {
      design = {
        ...design,
        valueClubs: [...design.valueClubs, club] as ValueClub[],
      };
      await record(
        c.id,
        "milestone_value",
        CLUB_SNAPSHOT_LABEL[club],
        { club, gainPct: gainPct == null ? null : Math.round(gainPct * 100) / 100 },
        currentValue,
        design
      );
      valueMilestones++;
    }

    // 3. Yearly-anniversary snapshot (one per completed year, deduped by label).
    const yr = anniversaryYear(ownedDays);
    if (yr >= 1) {
      const label = `year_${yr}`;
      if (!yearSnaps.has(`${c.id}:${label}`)) {
        await record(
          c.id,
          "snapshot",
          label,
          { year: yr, ownedDays },
          currentValue,
          design
        );
        yearSnaps.add(`${c.id}:${label}`);
        anniversaries++;
      }
    }
  }

  return NextResponse.json({
    ok: true,
    cards: cards.length,
    expiredTransfers,
    pricesResolved: Object.keys(prices).length,
    ageMilestones,
    valueMilestones,
    anniversaries,
    at: now.toISOString(),
  });
}
