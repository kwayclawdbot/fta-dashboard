import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCardPrice } from "@/lib/ownership/pricing";
import { publicRowToView, type PublicViewRow } from "@/lib/ownership/shape";
import { verifyTap, decryptChipKey, type VerifyReason } from "@/lib/ownership/sdm";
import type {
  ChipStatus,
  FormFactor,
  TapReason,
  TapResult,
} from "@/lib/ownership/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Chip row shape (server-side only; sdm_key_enc never leaves this route). */
interface ChipRow {
  id: string;
  chip_uid: string;
  serial: string;
  sdm_key_enc: string;
  sdm_counter: number | string;
  status: ChipStatus;
  card_id: string | null;
  form_factor: FormFactor;
}

/** Map the verifier's fine-grained reason to a coarse public bucket. */
function coarse(reason: VerifyReason | undefined): TapReason {
  return reason === "replay" ? "replay" : "invalid";
}

/**
 * GET /api/ownership/tap/[serial]?picc=&cmac= — ANONYMOUS physical scan endpoint.
 *
 * "The tap is the truth." Looks up the chip by its printed serial (P-series), then:
 *   • unknown serial            → { tapVerified:false, reason:'unknown' }
 *   • revoked chip              → { tapVerified:false, reason:'revoked' }
 *   • provisioned (unclaimed)   → { tapVerified:false, claimable:true } so the UI
 *                                 can route to the claim flow (first tap claims it)
 *   • claimed + valid SDM tap   → { tapVerified:true, reason:'verified' } + the
 *                                 bound card's PUBLIC view (never account/basis)
 *   • claimed, params absent/bad → same public view, tapVerified:false, coarse reason
 *
 * The page ALWAYS renders (an unverified link view is still valid — printed-QR
 * fallback). Verification runs server-side with the service-role client so the
 * per-chip key (decrypted from sdm_key_enc via NFC_MASTER_KEY) never reaches a
 * browser. A successful tap advances the replay floor atomically.
 */
export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ serial: string }> }
) {
  const { serial } = await ctx.params;
  if (!serial || !/^CC-P\d{2}-\d{6}$/i.test(serial.trim())) {
    return NextResponse.json({ error: "invalid serial" }, { status: 400 });
  }
  const normSerial = serial.trim().toUpperCase();

  const picc = req.nextUrl.searchParams.get("picc") || "";
  const cmac = req.nextUrl.searchParams.get("cmac") || "";
  const hasParams = picc.length > 0 && cmac.length > 0;

  const db = createAdminClient();

  const { data: chipData, error: chipErr } = await db
    .from("nfc_chips")
    .select("id, chip_uid, serial, sdm_key_enc, sdm_counter, status, card_id, form_factor")
    .eq("serial", normSerial)
    .maybeSingle();
  if (chipErr) {
    return NextResponse.json({ error: chipErr.message }, { status: 500 });
  }

  const chip = chipData as ChipRow | null;
  if (!chip) {
    const body: TapResult = {
      tapVerified: false,
      reason: "unknown",
      chip: null,
      card: null,
    };
    return NextResponse.json(body, { status: 404 });
  }

  const chipSummary = {
    serial: chip.serial,
    formFactor: chip.form_factor,
    status: chip.status,
  };

  if (chip.status === "revoked") {
    const body: TapResult = {
      tapVerified: false,
      reason: "revoked",
      chip: chipSummary,
      card: null,
    };
    return NextResponse.json(body, { status: 200 });
  }

  // Unclaimed chip → route the tap to the claim flow.
  if (chip.status === "provisioned" || !chip.card_id) {
    const body: TapResult = {
      tapVerified: false,
      claimable: true,
      reason: "no_tap",
      chip: chipSummary,
      card: null,
    };
    return NextResponse.json(body, { status: 200 });
  }

  // ── claimed: resolve the bound card's PUBLIC view ──────────────────────────
  const { data: cardData } = await db
    .from("ownership_cards")
    .select("serial")
    .eq("id", chip.card_id)
    .maybeSingle();
  const boundSerial = (cardData as { serial: string } | null)?.serial;

  let card = null as TapResult["card"];
  if (boundSerial) {
    const { data: viewData } = await db.rpc("public_card_view", {
      p_serial: boundSerial,
    });
    const row = ((viewData || []) as PublicViewRow[])[0];
    if (row) {
      const price = await getCardPrice(row.asset_symbol, row.asset_type);
      card = publicRowToView(row, price ? price.price : null);
    }
  }

  // ── verify the tap (if params present) ─────────────────────────────────────
  let tapVerified = false;
  let reason: TapReason = hasParams ? "invalid" : "no_tap";

  if (hasParams) {
    let key: Buffer;
    try {
      key = decryptChipKey(chip.sdm_key_enc);
    } catch {
      const body: TapResult = {
        tapVerified: false,
        reason: "invalid",
        chip: chipSummary,
        card,
      };
      return NextResponse.json(body, { status: 200 });
    }

    const floor = Number(chip.sdm_counter) || 0;
    const result = verifyTap({ piccData: picc, cmac, chip: { key, counter: floor } });

    if (result.valid && result.uid === chip.chip_uid && result.counter != null) {
      // Advance the replay floor atomically (only if this tap is newer).
      await db
        .from("nfc_chips")
        .update({ sdm_counter: result.counter })
        .eq("id", chip.id)
        .lt("sdm_counter", result.counter);
      tapVerified = true;
      reason = "verified";
    } else {
      reason = result.valid ? "invalid" : coarse(result.reason);
    }
  }

  const body: TapResult = { tapVerified, reason, chip: chipSummary, card };
  return NextResponse.json(body, { status: 200 });
}
