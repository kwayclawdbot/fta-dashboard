/**
 * Server-side scan resolver for /c/[serial]. SERVER-ONLY.
 *
 * Produces one normalized ScanState the page branches on, regardless of which
 * backend routes are live:
 *   • Card projection comes straight from the `public_card_view` RPC (security-
 *     definer, no basis/account data), so the page has SSR content even if no
 *     API route is running — instant paint, works with JS disabled.
 *   • Verification (tapVerified / claimable / chip) comes from the tap endpoint
 *     GET /api/ownership/tap/[serial]?picc=&cmac= when crypto params are present.
 *     If that route isn't up yet, the page degrades to the quiet link view.
 *
 * We only READ from `@/lib/ownership/*` and `@/lib/supabase/admin` here — the
 * backend lane owns those files.
 */

import "server-only";
import { headers } from "next/headers";
import { createAdminClient } from "@/lib/supabase/admin";
import { getEodClose } from "@/lib/ownership/pricing";
import { publicRowToView, type PublicViewRow } from "@/lib/ownership/shape";
import { inferAssetType, type ScanState } from "@/components/ownership/scan";
import type { TapResult, ChipSummary, TapReason, PublicCardView } from "@/lib/ownership/types";

// Card serials are CC-S<nn>-<6>; physical chip serials are CC-P<nn>-<6>. Both are
// valid /c/[serial] targets — a card serial resolves via the public RPC, a chip
// serial resolves through the tap endpoint (which returns the bound card).
const SERIAL_RE = /^CC-[A-Z]\d{2}-\d{6}$/i;

export interface TapParams {
  picc?: string;
  cmac?: string;
}

function empty(serial: string, status: ScanState["status"], reason: string, message?: string): ScanState {
  return {
    serial,
    status,
    card: null,
    assetType: null,
    tapVerified: false,
    claimable: false,
    chip: null,
    reason,
    message,
  };
}

/** Read the public projection directly from the RPC (robust SSR content). */
async function loadPublicCard(serial: string): Promise<ScanState | null> {
  try {
    const db = createAdminClient();
    const { data, error } = await db.rpc("public_card_view", {
      p_serial: serial.toUpperCase(),
    });
    if (error) return null;
    const rows = (data || []) as PublicViewRow[];
    const row = rows[0];
    if (!row) return null;

    const price = await getEodClose(row.asset_symbol, row.asset_type);
    const view = publicRowToView(row, price ? price.close : null);
    const assetType = row.asset_type;
    return {
      serial: view.serial,
      status: "ok",
      card: view,
      assetType,
      tapVerified: false,
      claimable: false,
      chip: null,
      reason: "link_view",
    };
  } catch {
    return null;
  }
}

/**
 * Best-effort call to the backend tap endpoint. Called with or without crypto
 * params: with them the tap can be VERIFIED; without them (printed QR / shared
 * link) it still resolves a bound chip's card as the quiet link view. Returns
 * null when the serial isn't a chip (e.g. a plain card serial → 404).
 */
async function loadTap(serial: string, params: TapParams): Promise<TapResult | null> {
  try {
    const h = await headers();
    const host = h.get("host");
    if (!host) return null;
    const proto =
      h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
    const q = new URLSearchParams();
    if (params.picc) q.set("picc", params.picc);
    if (params.cmac) q.set("cmac", params.cmac);
    const qs = q.toString();
    const url = `${proto}://${host}/api/ownership/tap/${encodeURIComponent(serial)}${
      qs ? `?${qs}` : ""
    }`;
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) return null;
    const ct = res.headers.get("content-type") || "";
    if (!ct.includes("application/json")) return null;
    const json = (await res.json()) as unknown;
    if (!json || typeof json !== "object") return null;
    const r = json as Record<string, unknown>;
    if (typeof r.tapVerified !== "boolean") return null;
    return {
      tapVerified: Boolean(r.tapVerified),
      claimable: Boolean(r.claimable),
      reason: (typeof r.reason === "string" ? r.reason : "no_tap") as TapReason,
      chip: (r.chip as ChipSummary | null) ?? null,
      card: (r.card as PublicCardView | null) ?? null,
    };
  } catch {
    return null;
  }
}

/** Resolve everything the scan page needs for a real serial. */
export async function resolveScan(serialRaw: string, params: TapParams): Promise<ScanState> {
  const serial = serialRaw.trim();
  if (!SERIAL_RE.test(serial)) {
    return empty(serial, "not_found", "invalid_serial");
  }

  const [publicState, tap] = await Promise.all([loadPublicCard(serial), loadTap(serial, params)]);

  // Bound card path — a real projection from either the RPC (card serial) or the
  // tap endpoint (chip serial).
  const card = publicState?.card ?? tap?.card ?? null;
  if (card) {
    return {
      serial: card.serial || serial,
      status: "ok",
      card,
      assetType: publicState?.assetType ?? inferAssetType(card.assetSymbol),
      tapVerified: tap?.tapVerified ?? false,
      claimable: tap?.claimable ?? false,
      chip: tap?.chip ?? null,
      reason: tap?.reason ?? "no_tap",
    };
  }

  // No bound card, but the tap endpoint knows about an unclaimed chip → claimable.
  if (tap && (tap.claimable || tap.chip)) {
    return {
      serial,
      status: "ok",
      card: null,
      assetType: null,
      tapVerified: tap.tapVerified,
      claimable: tap.claimable ?? false,
      chip: tap.chip ?? null,
      reason: tap.reason,
    };
  }

  return empty(serial, "not_found", "unknown_serial");
}
