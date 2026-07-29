import { ImageResponse } from "next/og";
import { artFor, CARD_INK, CARD_SUB, CARD_FAINT } from "@/components/ownership/art";
import { TIER_VISUALS, tierLabel } from "@/components/ownership/tiers";
import { formatMoney, formatPct, formatShares } from "@/components/ownership/format";
import { demoScan } from "@/components/ownership/demo";
import { resolveScan } from "../scan-data";
import type { ScanState } from "@/components/ownership/scan";

export const runtime = "nodejs";
export const alt = "Cheat Code Ownership Card";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

/**
 * PUBLIC OG image for a scanned card — a shared /c/[serial] link unfurls with
 * the card itself. This is a public variant of the owner-authed
 * /api/ownership/og/[id] route (which RLS-gates to the owner): it reads only the
 * public projection (no basis/account data), so it works for any stranger's
 * share. No tap params here (OG requests carry none), so no verification badge.
 */
export default async function OgImage({ params }: { params: Promise<{ serial: string }> }) {
  const { serial } = await params;
  const scan: ScanState = serial.startsWith("demo-")
    ? demoScan(serial)
    : await resolveScan(serial, {});

  const c = scan.card;

  // Fallback (unclaimed / not found) — a clean branded plate.
  if (!c) {
    return new ImageResponse(
      (
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            width: "100%",
            height: "100%",
            background: "#060708",
            alignItems: "center",
            justifyContent: "center",
            gap: 18,
          }}
        >
          <div style={{ display: "flex", width: 40, height: 40, borderRadius: 10, background: "linear-gradient(135deg,#FFF3C4,#E6B84D)" }} />
          <div style={{ display: "flex", fontSize: 30, letterSpacing: 8, color: CARD_SUB }}>
            CHEAT CODE OWNERSHIP CARD
          </div>
          <div style={{ display: "flex", fontSize: 20, letterSpacing: 3, color: CARD_FAINT }}>
            {scan.claimable ? "A genuine artifact, waiting to be activated" : "Registry"}
          </div>
        </div>
      ),
      size
    );
  }

  const assetType = scan.assetType ?? "stock";
  const art = artFor(c.assetSymbol);
  const tier = TIER_VISUALS[c.designState.holdTier];
  const gainPct = c.gainPctSinceIssue;
  const gainUp = (gainPct ?? 0) >= 0;
  const assetLabel = (c.assetName || c.assetSymbol).toUpperCase();

  return new ImageResponse(
    (
      <div style={{ display: "flex", width: "100%", height: "100%", background: "#050608", position: "relative" }}>
        <div style={{ display: "flex", position: "absolute", inset: 0, background: art.field }} />
        <div
          style={{
            display: "flex",
            position: "absolute",
            inset: 0,
            background: "linear-gradient(90deg, rgba(0,0,0,0.55) 0%, transparent 45%, rgba(0,0,0,0.35) 100%)",
          }}
        />

        <div style={{ display: "flex", width: "100%", height: "100%", padding: 64, alignItems: "center", gap: 56 }}>
          {/* Simplified card object */}
          <div
            style={{
              display: "flex",
              width: 320,
              height: 448,
              borderRadius: 24,
              padding: Math.max(2, tier.framePx * 1.5),
              background: tier.frameBg,
              boxShadow: "0 30px 80px -30px rgba(0,0,0,0.9)",
            }}
          >
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                width: "100%",
                height: "100%",
                borderRadius: 20,
                padding: 28,
                background: art.field,
                justifyContent: "space-between",
              }}
            >
              <div style={{ display: "flex", flexDirection: "column" }}>
                <div style={{ display: "flex", fontSize: 15, letterSpacing: 3, color: CARD_SUB }}>
                  {(c.series || "DIGITAL").toUpperCase()}
                  {c.edition != null ? ` · #${c.edition}` : ""}
                </div>
                <div style={{ display: "flex", marginTop: 18, fontSize: 66, fontWeight: 800, color: CARD_INK, lineHeight: 1 }}>
                  {c.assetSymbol}
                </div>
                <div style={{ display: "flex", marginTop: 10, fontSize: 16, letterSpacing: 3, color: CARD_SUB }}>
                  {formatShares(c.denomination, assetType).toUpperCase()}
                </div>
              </div>
              <div style={{ display: "flex", flexDirection: "column" }}>
                <div style={{ display: "flex", fontSize: 40, fontWeight: 700, color: CARD_INK }}>
                  {c.currentValue != null ? formatMoney(c.currentValue) : "—"}
                </div>
                {gainPct != null && (
                  <div
                    style={{
                      display: "flex",
                      marginTop: 6,
                      fontSize: 18,
                      fontWeight: 700,
                      letterSpacing: 1,
                      color: gainUp ? "#22C55E" : "#F1707B",
                    }}
                  >
                    {formatPct(gainPct)} SINCE ISSUE
                  </div>
                )}
                <div style={{ display: "flex", marginTop: 18, fontSize: 13, letterSpacing: 2, color: CARD_FAINT }}>
                  {c.serial}
                </div>
              </div>
            </div>
          </div>

          {/* Framing text */}
          <div style={{ display: "flex", flexDirection: "column", flex: 1, height: "100%", justifyContent: "center" }}>
            <div style={{ display: "flex", fontSize: 20, letterSpacing: 5, color: art.accent, fontWeight: 700 }}>
              {tierLabel(c.designState.holdTier)}
            </div>
            <div style={{ display: "flex", flexDirection: "column", marginTop: 22 }}>
              <div style={{ display: "flex", fontSize: 68, fontWeight: 800, color: CARD_INK, lineHeight: 1.02 }}>
                {assetLabel}
              </div>
              <div style={{ display: "flex", fontSize: 40, fontWeight: 700, color: art.accent, lineHeight: 1.05, marginTop: 8 }}>
                OWNED SINCE {c.ownedSinceYear}
              </div>
            </div>
          </div>
        </div>

        {/* Watermark */}
        <div
          style={{
            display: "flex",
            position: "absolute",
            left: 64,
            bottom: 40,
            alignItems: "center",
            gap: 12,
            fontSize: 18,
            letterSpacing: 3,
            color: CARD_FAINT,
          }}
        >
          <div style={{ display: "flex", width: 26, height: 26, borderRadius: 7, background: art.accent, opacity: 0.9 }} />
          CHEAT CODE OWNERSHIP CARD
        </div>
      </div>
    ),
    size
  );
}
