"use client";

/**
 * PublicLivingCard — the Living Card as a stranger sees it on a scan.
 *
 * Built for the public /c/[serial] page, it differs from <LivingCard> in three
 * ways that matter for that surface:
 *   1. It renders from the PUBLIC projection (PublicCardView) — never basis,
 *      holder account, or owner identity beyond firstName + lastInitial.
 *   2. It is JS-OPTIONAL: no framer-motion, no opacity-gated entrance. The full
 *      card paints from server HTML and is legible with JavaScript disabled
 *      (sunlight-outdoors requirement). Pointer tilt + moving foil are pure
 *      progressive enhancement, and respect prefers-reduced-motion.
 *   3. It always renders dark-premium (a physical object doesn't change colour
 *      with the viewer's theme).
 *
 * The visual language (frame tiers, art field, foil, clubs, wordmark) mirrors
 * <LivingCard> so a card looks identical in the app and on a scan.
 */

import { useEffect, useRef, useState } from "react";
import { ShieldCheck } from "lucide-react";
import type { PublicCardView, AssetType } from "@/lib/ownership/types";
import { artFor, CARD_INK, CARD_SUB, CARD_FAINT, CARD_HAIRLINE } from "./art";
import { TIER_VISUALS, orderedClubs, CLUB_VISUALS } from "./tiers";
import CardArtBackdrop from "./CardArtBackdrop";
import { formatMoney, formatPct, formatShares, holderName } from "./format";
import { isCryptoAsset } from "./scan";

const MARKET_GREEN = "#22C55E";
const MARKET_RED = "#F1707B";

export type PublicCardSize = "hero" | "shelf";

export interface PublicLivingCardProps {
  card: PublicCardView;
  assetType: AssetType;
  size?: PublicCardSize;
  /** Pointer tilt + moving foil. Default true (disabled under reduced-motion). */
  interactive?: boolean;
  /** Small genuine mark in the corner when the tap was crypto-verified. */
  tapVerified?: boolean;
  className?: string;
}

const SIZES: Record<
  PublicCardSize,
  {
    maxW: string;
    pad: string;
    symbol: string;
    name: string;
    denom: string;
    value: string;
    growth: string;
    foot: string;
    tilt: number;
    lift: number;
  }
> = {
  hero: {
    maxW: "min(88vw, 380px)",
    pad: "p-6",
    symbol: "text-5xl leading-none",
    name: "text-xs",
    denom: "text-xs",
    value: "text-[2.6rem] leading-none",
    growth: "text-sm",
    foot: "text-[10px]",
    tilt: 8,
    lift: 46,
  },
  shelf: {
    maxW: "260px",
    pad: "p-4",
    symbol: "text-[26px] leading-none",
    name: "text-[10px]",
    denom: "text-[10px]",
    value: "text-[22px] leading-none",
    growth: "text-[11px]",
    foot: "text-[8.5px]",
    tilt: 6,
    lift: 26,
  },
};

/** Minimal reduced-motion hook — avoids pulling framer onto the public page. */
function useReducedMotionLite(): boolean {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(mq.matches);
    const on = () => setReduced(mq.matches);
    mq.addEventListener?.("change", on);
    return () => mq.removeEventListener?.("change", on);
  }, []);
  return reduced;
}

export default function PublicLivingCard({
  card,
  assetType,
  size = "hero",
  interactive = true,
  tapVerified = false,
  className = "",
}: PublicLivingCardProps) {
  const reduce = useReducedMotionLite();
  const tiltRef = useRef<HTMLDivElement>(null);
  const raf = useRef<number | null>(null);

  const sz = SIZES[size];
  const design = card.designState;
  const art = artFor(card.assetSymbol);
  const tier = TIER_VISUALS[design.holdTier];
  const clubs = orderedClubs(design.valueClubs);

  const isBroken = card.status === "seal_broken";
  const isRetired = card.status === "retired";
  const distressed = isBroken || isRetired;
  const live = isCryptoAsset(card.assetSymbol, assetType);

  const value = card.currentValue;
  const gainPct = card.gainPctSinceIssue;
  const gainUp = (gainPct ?? 0) >= 0;

  const canTilt = interactive && !reduce;

  function onMove(e: React.PointerEvent<HTMLDivElement>) {
    if (!canTilt) return;
    const el = tiltRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const px = (e.clientX - r.left) / r.width;
    const py = (e.clientY - r.top) / r.height;
    if (raf.current) cancelAnimationFrame(raf.current);
    raf.current = requestAnimationFrame(() => {
      el.style.setProperty("--rx", `${(0.5 - py) * sz.tilt}deg`);
      el.style.setProperty("--ry", `${(px - 0.5) * sz.tilt}deg`);
      el.style.setProperty("--mx", `${(px * 100).toFixed(1)}%`);
      el.style.setProperty("--my", `${(py * 100).toFixed(1)}%`);
      el.style.setProperty("--act", "1");
    });
  }
  function onLeave() {
    const el = tiltRef.current;
    if (!el) return;
    if (raf.current) cancelAnimationFrame(raf.current);
    el.style.setProperty("--rx", "0deg");
    el.style.setProperty("--ry", "0deg");
    el.style.setProperty("--mx", "50%");
    el.style.setProperty("--my", "42%");
    el.style.setProperty("--act", "0");
  }

  const holder = holderName(card.holder ?? null);
  const ed =
    card.edition != null
      ? card.editionSize != null
        ? `#${card.edition} / ${card.editionSize}`
        : `#${card.edition}`
      : null;

  return (
    <div
      className={`ownership-public-card relative w-full ${className}`}
      style={{ maxWidth: sz.maxW, perspective: "1100px" }}
    >
      <div
        ref={tiltRef}
        onPointerMove={onMove}
        onPointerLeave={onLeave}
        className="relative outline-none"
        style={{
          aspectRatio: "5 / 7",
          transformStyle: "preserve-3d",
          transform: "rotateX(var(--rx,0deg)) rotateY(var(--ry,0deg)) translateZ(0)",
          transition: "transform 0.5s cubic-bezier(0.23,1,0.32,1)",
          // @ts-expect-error custom props
          "--mx": "50%",
          "--my": "42%",
          "--act": "0",
        }}
      >
        {/* FRAME */}
        <div
          className="relative h-full w-full rounded-[18px]"
          style={{
            padding: tier.framePx,
            background: tier.frameBg,
            boxShadow: distressed ? "0 24px 60px -30px rgba(0,0,0,0.85)" : tier.glow,
            filter: isRetired ? "saturate(0.7)" : undefined,
          }}
        >
          {/* FACE */}
          <div
            className={`relative flex h-full w-full flex-col overflow-hidden rounded-[15px] ${sz.pad}`}
            style={{ background: art.field, color: CARD_INK, transformStyle: "preserve-3d" }}
          >
            <CardArtBackdrop pattern={art.pattern} accent={art.accent} monogram={card.assetSymbol} />

            {/* Legibility vignette */}
            <div
              className="pointer-events-none absolute inset-0"
              style={{
                background:
                  "linear-gradient(180deg, rgba(0,0,0,0.36) 0%, transparent 26%, transparent 62%, rgba(0,0,0,0.5) 100%)",
              }}
            />

            {/* Moving foil (pointer-driven; a soft static wash without JS) */}
            <div
              className="pointer-events-none absolute inset-0 rounded-[15px] mix-blend-screen"
              style={{
                background: `radial-gradient(circle at var(--mx) var(--my), rgba(255,255,255,${tier.foil}) 0%, rgba(255,255,255,0) 42%)`,
                opacity: canTilt ? "var(--act,0)" : tier.foil * 0.5,
                transition: "opacity 0.4s ease",
              }}
            />
            {tier.engraved && (
              <div
                className="pointer-events-none absolute inset-0 rounded-[15px] mix-blend-overlay"
                style={{
                  background:
                    "linear-gradient(115deg, transparent 38%, rgba(255,243,196,0.22) 50%, transparent 62%)",
                }}
              />
            )}

            {/* CONTENT */}
            <div
              className="relative flex h-full flex-col"
              style={{ transform: `translateZ(${sz.lift}px)`, transformStyle: "preserve-3d" }}
            >
              {/* Top: series/edition + genuine mark */}
              <div className="flex items-start justify-between gap-2">
                <div className="flex flex-col gap-1">
                  <span
                    className={`font-mono uppercase tracking-[0.16em] ${sz.foot}`}
                    style={{ color: CARD_SUB }}
                  >
                    {(card.series || "DIGITAL").toUpperCase()}
                    {ed ? ` · ${ed}` : ""}
                  </span>
                  {design.rarity && (
                    <span
                      className={`w-fit rounded-full px-1.5 py-0.5 font-mono uppercase tracking-[0.14em] ${sz.foot}`}
                      style={{
                        background: "rgba(0,0,0,0.4)",
                        border: `1px solid ${CARD_HAIRLINE}`,
                        color: CARD_SUB,
                      }}
                    >
                      {design.rarity}
                    </span>
                  )}
                </div>
                {tapVerified && !distressed && (
                  <div
                    className={`flex items-center gap-1 font-mono uppercase tracking-[0.12em] ${sz.foot}`}
                    style={{ color: "#E6B84D" }}
                    title="Tap-verified genuine"
                  >
                    <ShieldCheck className="h-3 w-3" />
                    Genuine
                  </div>
                )}
              </div>

              {/* Identity */}
              <div className="mt-3">
                <div
                  className={`font-display font-extrabold tracking-tight ${sz.symbol}`}
                  style={{ color: CARD_INK, textShadow: `0 1px 20px ${hexA(art.accent, 0.45)}` }}
                >
                  {card.assetSymbol}
                </div>
                <div
                  className={`mt-1 font-body uppercase tracking-[0.18em] ${sz.name}`}
                  style={{ color: CARD_SUB }}
                >
                  {card.assetName || art.kicker || assetType}
                </div>
              </div>

              {/* Denomination — immutable */}
              <div
                className={`mt-3 w-fit rounded-md px-2 py-1 font-mono font-semibold tracking-[0.1em] ${sz.denom}`}
                style={{
                  background: hexA(art.accent, 0.14),
                  border: `1px solid ${hexA(art.accent, 0.4)}`,
                  color: CARD_INK,
                }}
              >
                {formatShares(card.denomination, assetType).toUpperCase()}
              </div>

              <div className="flex-1" />

              {/* Value + growth */}
              <div className="relative">
                <div
                  className={`font-mono font-bold tabular-nums ${sz.value}`}
                  style={{ color: distressed ? CARD_SUB : CARD_INK }}
                >
                  {value != null ? formatMoney(value) : "—"}
                </div>
                {gainPct != null ? (
                  <div
                    className={`mt-1.5 flex items-center gap-1.5 font-mono font-semibold uppercase tracking-[0.08em] ${sz.growth}`}
                    style={{ color: distressed ? CARD_FAINT : gainUp ? MARKET_GREEN : MARKET_RED }}
                  >
                    <span>{formatPct(gainPct)}</span>
                    <span style={{ color: CARD_FAINT }} className="tracking-[0.14em]">
                      SINCE ISSUE
                    </span>
                  </div>
                ) : (
                  <div
                    className={`mt-1.5 font-mono uppercase tracking-[0.14em] ${sz.growth}`}
                    style={{ color: CARD_FAINT }}
                  >
                    AWAITING PRICE
                  </div>
                )}
                {live && !distressed && (
                  <div className={`mt-1 flex items-center gap-1.5 font-mono ${sz.foot}`}>
                    <span
                      className="inline-block h-1.5 w-1.5 rounded-full"
                      style={{ background: MARKET_GREEN, boxShadow: `0 0 8px ${MARKET_GREEN}` }}
                    />
                    <span style={{ color: CARD_FAINT }} className="uppercase tracking-[0.14em]">
                      Live · never closes
                    </span>
                  </div>
                )}
              </div>

              {/* Value clubs */}
              {clubs.length > 0 && (
                <div className="mt-3 flex items-center gap-1.5">
                  {clubs.map((c) => (
                    <span
                      key={c}
                      className="flex h-6 min-w-6 items-center justify-center rounded-full px-1.5 font-mono text-[10px] font-bold tracking-tight"
                      style={{
                        background: "rgba(0,0,0,0.45)",
                        border: `1px solid ${hexA(art.accent, 0.55)}`,
                        color: hexA(art.accent, 0.95),
                        boxShadow: `inset 0 0 8px ${hexA(art.accent, 0.18)}`,
                      }}
                      title={`${CLUB_VISUALS[c].full}`}
                    >
                      {CLUB_VISUALS[c].label}
                    </span>
                  ))}
                </div>
              )}

              {/* Foot */}
              <div className="mt-3 border-t pt-2" style={{ borderColor: CARD_HAIRLINE }}>
                <div className="flex items-end justify-between gap-2">
                  <div className="min-w-0">
                    {holder && (
                      <div className={`truncate font-body ${sz.foot}`} style={{ color: CARD_SUB }}>
                        Held by {holder}
                      </div>
                    )}
                    <div className={`font-body ${sz.foot}`} style={{ color: CARD_FAINT }}>
                      Owned since {card.ownedSinceYear}
                    </div>
                  </div>
                  <div className="shrink-0 text-right">
                    <div className={`font-mono tracking-[0.1em] ${sz.foot}`} style={{ color: CARD_SUB }}>
                      {card.serial}
                    </div>
                    {tier.wordmark && (
                      <div
                        className={`mt-0.5 font-mono uppercase tracking-[0.18em] ${sz.foot}`}
                        style={{ color: hexA(art.accent, 0.9) }}
                      >
                        {tier.wordmark}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Distressed honesty treatment */}
            {distressed && (
              <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                <div
                  className="absolute inset-0"
                  style={{ background: "rgba(6,7,9,0.32)", backdropFilter: "saturate(0.85)" }}
                />
                <div
                  className="relative rotate-[-11deg] rounded-md px-4 py-1.5 font-display text-sm font-extrabold uppercase tracking-[0.22em]"
                  style={{
                    color: "#F1F1EA",
                    border: "2px solid rgba(241,178,74,0.75)",
                    background: "rgba(0,0,0,0.4)",
                    boxShadow: "0 6px 24px rgba(0,0,0,0.5)",
                  }}
                >
                  {isRetired ? "Retired" : "Seal Broken"}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/* Hex → rgba. Accepts #RGB / #RRGGBB / passthrough. */
function hexA(hex: string, a: number): string {
  if (!hex.startsWith("#")) return hex;
  let h = hex.slice(1);
  if (h.length === 3) h = h.split("").map((c) => c + c).join("");
  const n = parseInt(h, 16);
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  return `rgba(${r}, ${g}, ${b}, ${a})`;
}
