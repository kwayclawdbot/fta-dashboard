import { ImageResponse } from "next/og";
import { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getEodClose } from "@/lib/ownership/pricing";
import { rowToCard, type CardRow } from "@/lib/ownership/shape";
import { artFor, CARD_INK, CARD_SUB, CARD_FAINT } from "@/components/ownership/art";
import { TIER_VISUALS, tierLabel } from "@/components/ownership/tiers";
import {
  formatMoney,
  formatPct,
  formatShares,
} from "@/components/ownership/format";
import { giftedByLine } from "@/components/ownership/transfer-format";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SIZE = { width: 1200, height: 630 };

/**
 * GET /api/ownership/og/[id]?t=days|gift — a static share image of THE owner's
 * card, rendered with next/og. Owner-auth required (RLS returns no row otherwise).
 * No account data: only the card object, framing headline, and a serial +
 * "Cheat Code Ownership Card" watermark.
 */
export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const t = req.nextUrl.searchParams.get("t") === "gift" ? "gift" : "days";

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return new Response("unauthorized", { status: 401 });

  const { data: cardRow, error } = await supabase
    .from("ownership_cards")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) return new Response("error", { status: 500 });
  if (!cardRow) return new Response("not found", { status: 404 });

  const row = cardRow as CardRow;
  const price = await getEodClose(row.asset_symbol, row.asset_type);
  const card = rowToCard(
    row,
    price ? { price: price.close, asOf: new Date().toISOString() } : undefined
  );

  const art = artFor(card.assetSymbol);
  const tier = TIER_VISUALS[card.designState.holdTier];
  const value = card.market?.currentValue ?? card.acquisition.originalValue;
  const gainPct = card.market?.gainPct ?? null;
  const gainUp = (gainPct ?? 0) >= 0;
  const gift = card.gift;

  // Framing headline per template.
  const assetLabel = (card.assetName || card.assetSymbol).toUpperCase();
  const kicker =
    t === "gift"
      ? gift
        ? giftedByLine(gift).toUpperCase()
        : "A FIRST STOCK"
      : `${tierLabel(card.designState.holdTier)}`;
  const headline =
    t === "gift"
      ? "MY FIRST STOCK"
      : `I'VE OWNED ${assetLabel}`;
  const subline =
    t === "gift"
      ? assetLabel
      : `FOR ${card.ownedDays.toLocaleString("en-US")} DAYS`;

  return new ImageResponse(
    (
      <div
        style={{
          display: "flex",
          width: "100%",
          height: "100%",
          background: "#050608",
          position: "relative",
        }}
      >
        {/* Asset field wash */}
        <div
          style={{
            display: "flex",
            position: "absolute",
            inset: 0,
            background: art.field,
          }}
        />
        <div
          style={{
            display: "flex",
            position: "absolute",
            inset: 0,
            background:
              "linear-gradient(90deg, rgba(0,0,0,0.55) 0%, transparent 45%, rgba(0,0,0,0.35) 100%)",
          }}
        />

        {/* Content row */}
        <div
          style={{
            display: "flex",
            width: "100%",
            height: "100%",
            padding: 64,
            alignItems: "center",
            gap: 56,
          }}
        >
          {/* The card object (simplified) */}
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
              {/* top */}
              <div style={{ display: "flex", flexDirection: "column" }}>
                <div
                  style={{
                    display: "flex",
                    fontSize: 15,
                    letterSpacing: 3,
                    color: CARD_SUB,
                  }}
                >
                  {(card.series || "DIGITAL").toUpperCase()}
                  {card.edition != null ? ` · #${card.edition}` : ""}
                </div>
                <div
                  style={{
                    display: "flex",
                    marginTop: 18,
                    fontSize: 66,
                    fontWeight: 800,
                    color: CARD_INK,
                    lineHeight: 1,
                  }}
                >
                  {card.assetSymbol}
                </div>
                <div
                  style={{
                    display: "flex",
                    marginTop: 10,
                    fontSize: 16,
                    letterSpacing: 3,
                    color: CARD_SUB,
                  }}
                >
                  {formatShares(card.denomination, card.assetType).toUpperCase()}
                </div>
              </div>
              {/* value */}
              <div style={{ display: "flex", flexDirection: "column" }}>
                <div
                  style={{
                    display: "flex",
                    fontSize: 40,
                    fontWeight: 700,
                    color: CARD_INK,
                  }}
                >
                  {formatMoney(value)}
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
                <div
                  style={{
                    display: "flex",
                    marginTop: 18,
                    fontSize: 13,
                    letterSpacing: 2,
                    color: CARD_FAINT,
                  }}
                >
                  {card.serial}
                </div>
              </div>
            </div>
          </div>

          {/* Framing text */}
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              flex: 1,
              height: "100%",
              justifyContent: "center",
            }}
          >
            <div
              style={{
                display: "flex",
                fontSize: 20,
                letterSpacing: 5,
                color: art.accent,
                fontWeight: 700,
              }}
            >
              {kicker}
            </div>
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                marginTop: 22,
              }}
            >
              <div
                style={{
                  display: "flex",
                  fontSize: 74,
                  fontWeight: 800,
                  color: CARD_INK,
                  lineHeight: 1.02,
                }}
              >
                {headline}
              </div>
              <div
                style={{
                  display: "flex",
                  fontSize: 74,
                  fontWeight: 800,
                  color: art.accent,
                  lineHeight: 1.02,
                }}
              >
                {subline}
              </div>
            </div>

            {t === "gift" && gift?.message && (
              <div
                style={{
                  display: "flex",
                  marginTop: 26,
                  maxWidth: 620,
                  fontSize: 24,
                  fontStyle: "italic",
                  color: CARD_SUB,
                  lineHeight: 1.35,
                }}
              >
                {`“${truncate(gift.message, 120)}”`}
              </div>
            )}
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
          <div
            style={{
              display: "flex",
              width: 26,
              height: 26,
              borderRadius: 7,
              background: art.accent,
              opacity: 0.9,
            }}
          />
          CHEAT CODE OWNERSHIP CARD
        </div>
      </div>
    ),
    SIZE
  );
}

function truncate(s: string, n: number): string {
  return s.length > n ? `${s.slice(0, n - 1).trimEnd()}…` : s;
}
