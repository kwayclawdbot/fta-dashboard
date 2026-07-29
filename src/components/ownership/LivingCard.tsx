"use client";

/**
 * LivingCard — the product. Not a card image with a stats panel; a living
 * collectible object whose FACE renders live ownership state and whose FRAME
 * visually accumulates the holder's history.
 *
 * Six identities on one object: asset (per-asset art) · ownership (immutable
 * denomination) · market (live value) · history (growth since issue) ·
 * collectible (series/edition/serial/rarity) · holder story (owned-since,
 * milestones). Every state is meant to be screenshot-worthy.
 *
 * Renders the same on every surface (shelf / detail / hero) via `size`; can
 * render any historical era via `era` (a CardDesignState) for snapshot playback.
 */

import { useRef } from "react";
import { m, useReducedMotion } from "@/lib/motion";
import { ShieldCheck, CircleDot, Lock } from "lucide-react";
import type { OwnershipCard, CardDesignState } from "@/lib/ownership/types";
import { artFor, CARD_INK, CARD_SUB, CARD_FAINT, CARD_HAIRLINE } from "./art";
import { TIER_VISUALS, orderedClubs, CLUB_VISUALS } from "./tiers";
import CardArtBackdrop from "./CardArtBackdrop";
import {
  formatMoney,
  formatPct,
  formatShares,
  formatHeld,
  formatDate,
  yearOf,
  holderName,
} from "./format";
import { giftedByLine } from "./transfer-format";

export type LivingCardSize = "shelf" | "detail" | "hero";

export interface LivingCardProps {
  card: OwnershipCard;
  size?: LivingCardSize;
  /** Render a historical era (snapshot playback). Falls back to card.designState. */
  era?: CardDesignState;
  /** Value to show for a snapshot era (overrides live market value). */
  eraValue?: number;
  /** Small label chip for a snapshot era ("AT ISSUE", "YEAR 1"). */
  eraLabel?: string;
  /** Pointer tilt + moving foil. Default true. */
  interactive?: boolean;
  className?: string;
  onClick?: () => void;
  /** Priority entrance (hero). */
  priority?: boolean;
}

const MARKET_GREEN = "#22C55E";
const MARKET_RED = "#F1707B";

const SIZES: Record<
  LivingCardSize,
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
  shelf: {
    maxW: "100%",
    pad: "p-4",
    symbol: "text-[26px] leading-none",
    name: "text-[10px]",
    denom: "text-[10px]",
    value: "text-[22px] leading-none",
    growth: "text-[11px]",
    foot: "text-[8.5px]",
    tilt: 7,
    lift: 26,
  },
  detail: {
    maxW: "340px",
    pad: "p-5",
    symbol: "text-4xl leading-none",
    name: "text-[11px]",
    denom: "text-[11px]",
    value: "text-3xl leading-none",
    growth: "text-[13px]",
    foot: "text-[9.5px]",
    tilt: 9,
    lift: 40,
  },
  hero: {
    maxW: "420px",
    pad: "p-6",
    symbol: "text-5xl leading-none",
    name: "text-xs",
    denom: "text-xs",
    value: "text-[2.6rem] leading-none",
    growth: "text-sm",
    foot: "text-[10px]",
    tilt: 10,
    lift: 52,
  },
};

export default function LivingCard({
  card,
  size = "detail",
  era,
  eraValue,
  eraLabel,
  interactive = true,
  className = "",
  onClick,
  priority = false,
}: LivingCardProps) {
  const reduce = useReducedMotion();
  const tiltRef = useRef<HTMLDivElement>(null);
  const raf = useRef<number | null>(null);

  const design = era ?? card.designState;
  const sz = SIZES[size];
  const art = artFor(card.assetSymbol);
  const tier = TIER_VISUALS[design.holdTier];
  const clubs = orderedClubs(design.valueClubs);

  const isBroken = card.status === "seal_broken";
  const isRetired = card.status === "retired";
  const isTransfer = card.status === "in_transfer";
  const distressed = isBroken || isRetired;

  const value = eraValue ?? card.market?.currentValue ?? card.acquisition.originalValue;
  const gainPct = era ? null : card.market?.gainPct ?? null;
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

  const holder = holderName(card.holder);
  const clickable = !!onClick;

  return (
    <m.div
      initial={reduce ? false : { opacity: 0, y: 14, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.55, ease: [0.23, 1, 0.32, 1], delay: priority ? 0.05 : 0 }}
      className={`ownership-living-card group/card relative w-full ${className}`}
      style={{ maxWidth: sz.maxW, perspective: "1100px" }}
    >
      <div
        ref={tiltRef}
        onPointerMove={onMove}
        onPointerLeave={onLeave}
        onClick={onClick}
        role={clickable ? "button" : undefined}
        tabIndex={clickable ? 0 : undefined}
        onKeyDown={
          clickable
            ? (e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  onClick?.();
                }
              }
            : undefined
        }
        className={`relative ${clickable ? "cursor-pointer" : ""} outline-none`}
        style={{
          aspectRatio: "5 / 7",
          transformStyle: "preserve-3d",
          transform:
            "rotateX(var(--rx,0deg)) rotateY(var(--ry,0deg)) translateZ(0)",
          transition: "transform 0.5s cubic-bezier(0.23,1,0.32,1)",
          // @ts-expect-error custom props
          "--mx": "50%",
          "--my": "42%",
          "--act": "0",
        }}
      >
        {/* FRAME — the metallic border that thickens with hold tier. */}
        <div
          className="relative h-full w-full rounded-[18px]"
          style={{
            padding: tier.framePx,
            background: tier.frameBg,
            boxShadow: distressed
              ? "0 24px 60px -30px rgba(0,0,0,0.85)"
              : tier.glow,
            filter: isRetired ? "saturate(0.7)" : undefined,
          }}
        >
          {/* FACE */}
          <div
            className={`relative flex h-full w-full flex-col overflow-hidden rounded-[15px] ${sz.pad}`}
            style={{
              background: art.field,
              color: CARD_INK,
              transformStyle: "preserve-3d",
            }}
          >
            {/* Abstract substrate + ghost monogram */}
            <CardArtBackdrop pattern={art.pattern} accent={art.accent} monogram={card.assetSymbol} />

            {/* Top vignette for legibility */}
            <div
              className="pointer-events-none absolute inset-0"
              style={{
                background:
                  "linear-gradient(180deg, rgba(0,0,0,0.36) 0%, transparent 26%, transparent 62%, rgba(0,0,0,0.5) 100%)",
              }}
            />

            {/* Moving foil sheen — follows the pointer, strength by tier */}
            <div
              className="pointer-events-none absolute inset-0 rounded-[15px] mix-blend-screen"
              style={{
                background: `radial-gradient(circle at var(--mx) var(--my), rgba(255,255,255,${tier.foil}) 0%, rgba(255,255,255,0) 42%)`,
                opacity: canTilt ? "var(--act,0)" : tier.foil * 0.5,
                transition: "opacity 0.4s ease",
              }}
            />
            {/* Legacy engraved diagonal foil band (always-on shimmer) */}
            {tier.engraved && (
              <div
                className="pointer-events-none absolute inset-0 rounded-[15px] mix-blend-overlay"
                style={{
                  background:
                    "linear-gradient(115deg, transparent 38%, rgba(255,243,196,0.22) 50%, transparent 62%)",
                }}
              />
            )}

            {/* ── CONTENT ──────────────────────────────────────────── */}
            <div
              className="relative flex h-full flex-col"
              style={{ transform: `translateZ(${sz.lift}px)`, transformStyle: "preserve-3d" }}
            >
              {/* Top row: series/edition + status/provider marks */}
              <div className="flex items-start justify-between gap-2">
                <div className="flex flex-col gap-1">
                  <SeriesChip
                    series={design.series || card.series}
                    edition={card.edition}
                    editionSize={card.editionSize}
                    rarity={design.rarity ?? card.rarity}
                    footClass={sz.foot}
                  />
                  {eraLabel && (
                    <span
                      className={`w-fit rounded-full px-2 py-0.5 font-mono uppercase tracking-[0.12em] ${sz.foot}`}
                      style={{
                        background: "rgba(0,0,0,0.4)",
                        border: `1px solid ${CARD_HAIRLINE}`,
                        color: CARD_SUB,
                      }}
                    >
                      {eraLabel}
                    </span>
                  )}
                </div>
                <StatusMark
                  status={card.status}
                  provider={card.provider}
                  footClass={sz.foot}
                  accent={art.accent}
                />
              </div>

              {/* Identity */}
              <div className="mt-3">
                <div
                  className={`font-display font-extrabold tracking-tight ${sz.symbol}`}
                  style={{
                    color: CARD_INK,
                    textShadow: `0 1px 20px ${hexA(art.accent, 0.45)}`,
                  }}
                >
                  {card.assetSymbol}
                </div>
                <div
                  className={`mt-1 font-body uppercase tracking-[0.18em] ${sz.name}`}
                  style={{ color: CARD_SUB }}
                >
                  {card.assetName || art.kicker || card.assetType}
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
                {formatShares(card.denomination, card.assetType).toUpperCase()}
              </div>

              {/* push value block down */}
              <div className="flex-1" />

              {/* Value + growth (the live/market layer) */}
              <div className="relative">
                <div
                  className={`font-mono font-bold tabular-nums ${sz.value}`}
                  style={{ color: distressed ? CARD_SUB : CARD_INK }}
                >
                  {formatMoney(value)}
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
                    {eraLabel ? "SNAPSHOT VALUE" : "AWAITING PRICE"}
                  </div>
                )}
              </div>

              {/* Value-club marks */}
              {clubs.length > 0 && (
                <div className="mt-3 flex items-center gap-1.5">
                  {clubs.map((c) => (
                    <ClubMark key={c} label={CLUB_VISUALS[c].label} accent={art.accent} />
                  ))}
                </div>
              )}

              {/* Foot: holder / owned-since, serial, tier wordmark */}
              <div
                className="mt-3 border-t pt-2"
                style={{ borderColor: CARD_HAIRLINE }}
              >
                <div className="flex items-end justify-between gap-2">
                  <div className="min-w-0">
                    {holder && (
                      <div
                        className={`truncate font-body ${sz.foot}`}
                        style={{ color: CARD_SUB }}
                      >
                        Held by {holder}
                      </div>
                    )}
                    <div
                      className={`font-body ${sz.foot}`}
                      style={{ color: CARD_FAINT }}
                    >
                      Owned since {yearOf(card.activatedAt)} · {formatHeld(card.ownedDays)}
                    </div>
                    {card.gift && (
                      <div
                        className={`truncate font-body ${sz.foot}`}
                        style={{ color: hexA(art.accent, 0.9) }}
                        title={`${giftedByLine(card.gift)} · ${formatDate(card.gift.giftedAt)}`}
                      >
                        {giftedByLine(card.gift)} · {formatDate(card.gift.giftedAt)}
                      </div>
                    )}
                  </div>
                  <div className="shrink-0 text-right">
                    <div
                      className={`font-mono tracking-[0.1em] ${sz.foot}`}
                      style={{ color: CARD_SUB }}
                    >
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

            {/* Seal-broken / retired provenance treatment — honest, not ugly */}
            {distressed && (
              <SealBrokenOverlay retired={isRetired} />
            )}
            {isTransfer && <InTransferOverlay accent={art.accent} />}
          </div>
        </div>
      </div>
    </m.div>
  );
}

/* ── Sub-marks ─────────────────────────────────────────────────────── */

function SeriesChip({
  series,
  edition,
  editionSize,
  rarity,
  footClass,
}: {
  series: string;
  edition: number | null;
  editionSize: number | null;
  rarity: string | null;
  footClass: string;
}) {
  const ed =
    edition != null
      ? editionSize != null
        ? `#${edition} / ${editionSize}`
        : `#${edition}`
      : null;
  return (
    <div className="flex flex-col gap-1">
      <span
        className={`font-mono uppercase tracking-[0.16em] ${footClass}`}
        style={{ color: CARD_SUB }}
      >
        {(series || "DIGITAL").toUpperCase()}
        {ed ? ` · ${ed}` : ""}
      </span>
      {rarity && (
        <span
          className={`w-fit rounded-full px-1.5 py-0.5 font-mono uppercase tracking-[0.14em] ${footClass}`}
          style={{
            background: "rgba(0,0,0,0.4)",
            border: `1px solid ${CARD_HAIRLINE}`,
            color: CARD_SUB,
          }}
        >
          {rarity}
        </span>
      )}
    </div>
  );
}

function StatusMark({
  status,
  provider,
  footClass,
  accent,
}: {
  status: OwnershipCard["status"];
  provider: OwnershipCard["provider"];
  footClass: string;
  accent: string;
}) {
  const verified = provider === "snaptrade";
  return (
    <div className="flex flex-col items-end gap-1">
      {status === "seal_broken" && <StatusPill label="Seal broken" tone="warn" footClass={footClass} />}
      {status === "retired" && <StatusPill label="Retired" tone="muted" footClass={footClass} />}
      <div
        className={`flex items-center gap-1 font-mono uppercase tracking-[0.12em] ${footClass}`}
        style={{ color: verified ? "#4CD3B0" : "#E6B84D" }}
        title={verified ? "Verified via linked brokerage" : "Self-reported position"}
      >
        {verified ? <ShieldCheck className="h-3 w-3" /> : <CircleDot className="h-3 w-3" />}
        {verified ? "Verified" : "Self-reported"}
      </div>
      <span className="sr-only">{status}</span>
      <span className="hidden" style={{ color: accent }} />
    </div>
  );
}

function StatusPill({
  label,
  tone,
  footClass,
}: {
  label: string;
  tone: "warn" | "muted";
  footClass: string;
}) {
  const color = tone === "warn" ? "#F1B24A" : CARD_SUB;
  return (
    <span
      className={`rounded-full px-2 py-0.5 font-mono uppercase tracking-[0.14em] ${footClass}`}
      style={{ background: "rgba(0,0,0,0.5)", border: `1px solid ${hexA(color, 0.5)}`, color }}
    >
      {label}
    </span>
  );
}

function ClubMark({ label, accent }: { label: string; accent: string }) {
  return (
    <span
      className="flex h-6 min-w-6 items-center justify-center rounded-full px-1.5 font-mono text-[10px] font-bold tracking-tight"
      style={{
        background: "rgba(0,0,0,0.45)",
        border: `1px solid ${hexA(accent, 0.55)}`,
        color: hexA(accent, 0.95),
        boxShadow: `inset 0 0 8px ${hexA(accent, 0.18)}`,
      }}
      title={`${label}% Club`}
    >
      {label}
    </span>
  );
}

function SealBrokenOverlay({ retired }: { retired: boolean }) {
  return (
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
        {retired ? "Retired" : "Seal Broken"}
      </div>
    </div>
  );
}

/** IN TRANSFER — a "sealed for transit" lock + gilt corner ribbon. Not distress. */
function InTransferOverlay({ accent }: { accent: string }) {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden rounded-[15px]">
      <div
        className="absolute inset-0"
        style={{ background: "rgba(6,7,9,0.44)", backdropFilter: "saturate(0.9)" }}
      />
      {/* Gilt corner ribbon */}
      <div
        className="absolute right-[-38px] top-[18px] rotate-45 px-10 py-1 text-center font-mono uppercase tracking-[0.16em]"
        style={{
          fontSize: 8.5,
          background: "linear-gradient(90deg,#E6B84D,#FFF3C4,#E6B84D)",
          color: "#1a1408",
          boxShadow: "0 4px 14px rgba(0,0,0,0.5)",
        }}
      >
        In transfer
      </div>
      {/* Centre lock seal */}
      <div className="absolute inset-0 flex items-center justify-center">
        <div
          className="flex items-center justify-center rounded-full"
          style={{
            width: 46,
            height: 46,
            background: "rgba(0,0,0,0.6)",
            border: `1px solid ${hexA(accent, 0.6)}`,
            color: hexA(accent, 0.95),
            boxShadow: `0 0 20px ${hexA(accent, 0.25)}`,
          }}
        >
          <Lock className="h-5 w-5" />
        </div>
      </div>
    </div>
  );
}

/* Hex colour → rgba with alpha. Accepts #RGB / #RRGGBB / rgba() passthrough. */
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
