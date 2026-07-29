"use client";

/**
 * ShareDialog — previews the two share-image templates for a card and lets the
 * owner download or copy them. Images render from the owner-authed OG route
 * `/api/ownership/og/[id]?t=days|gift`. Demo cards can't hit that route, so the
 * preview falls back to an on-brand placeholder.
 */

import { useMemo, useState } from "react";
import { m, AnimatePresence, useReducedMotion } from "@/lib/motion";
import { Share2, X, Download, Link2, Check, ImageOff } from "lucide-react";
import type { OwnershipCard } from "@/lib/ownership/types";

const EASE = [0.23, 1, 0.32, 1] as const;

type Template = "days" | "gift";

export default function ShareDialog({
  card,
  demo = false,
  onClose,
}: {
  card: OwnershipCard;
  demo?: boolean;
  onClose: () => void;
}) {
  const reduce = useReducedMotion();
  const [tpl, setTpl] = useState<Template>(card.gift ? "gift" : "days");
  const [failed, setFailed] = useState<Record<Template, boolean>>({
    days: false,
    gift: false,
  });
  const [copied, setCopied] = useState(false);

  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const urlFor = useMemo(
    () => (t: Template) =>
      `${origin}/api/ownership/og/${encodeURIComponent(card.id)}?t=${t}`,
    [origin, card.id]
  );

  const canRender = !demo && !failed[tpl];

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(urlFor(tpl));
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      /* clipboard blocked — no-op */
    }
  }

  return (
    <m.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
      onClick={onClose}
      className="bg-scrim fixed inset-0 z-[110] flex items-end justify-center p-0 backdrop-blur-sm sm:items-center sm:p-4"
    >
      <m.div
        initial={reduce ? { opacity: 0 } : { opacity: 0, y: 26, scale: 0.985 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={reduce ? { opacity: 0 } : { opacity: 0, y: 20 }}
        transition={{ duration: 0.34, ease: EASE }}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Share this card"
        className="relative w-full max-w-lg overflow-hidden rounded-t-3xl border border-sand bg-card p-6 shadow-[var(--shadow-lift)] sm:rounded-3xl"
      >
        <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-sand sm:hidden" />

        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gold-400/15 text-gold-700">
              <Share2 className="h-5 w-5" />
            </span>
            <div>
              <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-soft">
                Share
              </div>
              <div className="font-display text-lg font-extrabold leading-tight text-ink">
                {card.assetSymbol} card
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-soft transition-colors hover:text-ink"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Template tabs */}
        <div className="mt-5 inline-flex rounded-xl border border-sand p-1">
          <TabPill active={tpl === "days"} onClick={() => setTpl("days")}>
            Days held
          </TabPill>
          <TabPill active={tpl === "gift"} onClick={() => setTpl("gift")}>
            {card.gift ? "The gift" : "First stock"}
          </TabPill>
        </div>

        {/* Preview */}
        <div
          className="night-island relative mt-4 overflow-hidden rounded-2xl border border-sand"
          style={{ aspectRatio: "1200 / 630" }}
        >
          <AnimatePresence mode="wait">
            {canRender ? (
              <m.img
                key={tpl}
                src={urlFor(tpl)}
                alt={`${card.assetSymbol} share image`}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
                onError={() => setFailed((f) => ({ ...f, [tpl]: true }))}
                className="h-full w-full object-cover"
              />
            ) : (
              <PlaceholderFrame key={`ph-${tpl}`} card={card} tpl={tpl} demo={demo} />
            )}
          </AnimatePresence>
        </div>

        {/* Actions */}
        <div className="mt-4 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button
            onClick={copyLink}
            disabled={!canRender}
            className="club-b-card f0-focus inline-flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium text-ink transition-transform duration-150 hover:text-accent active:scale-[0.97] disabled:opacity-50"
          >
            {copied ? <Check className="h-4 w-4 text-teal-500" /> : <Link2 className="h-4 w-4" />}
            {copied ? "Copied" : "Copy link"}
          </button>
          <a
            href={canRender ? urlFor(tpl) : undefined}
            download={canRender ? `cheatcode-${card.assetSymbol}-${tpl}.png` : undefined}
            aria-disabled={!canRender}
            className={`f0-focus inline-flex items-center justify-center gap-2 rounded-xl bg-accent font-display font-bold tracking-[0.02em] text-[color:var(--accent-on)] px-4 py-2.5 text-sm transition-transform duration-150 active:scale-[0.97] ${
              canRender ? "" : "pointer-events-none opacity-50"
            }`}
          >
            <Download className="h-4 w-4" />
            Download PNG
          </a>
        </div>

        <p className="mt-3 text-[11px] leading-relaxed text-soft">
          Share images show the card, its serial and how far it&apos;s come —
          never your account, basis, or balances.
        </p>
      </m.div>
    </m.div>
  );
}

function TabPill({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`rounded-lg px-3.5 py-1.5 text-sm font-semibold transition-colors ${
        active ? "bg-gold-400/15 text-gold-700" : "text-soft hover:text-ink"
      }`}
    >
      {children}
    </button>
  );
}

/** On-brand fallback when the live OG image can't render (demo, or route down). */
function PlaceholderFrame({
  card,
  tpl,
  demo,
}: {
  card: OwnershipCard;
  tpl: Template;
  demo: boolean;
}) {
  const headline =
    tpl === "gift"
      ? card.gift?.fromDisplayName
        ? `${card.gift.fromDisplayName.toUpperCase()} GAVE ME MY FIRST STOCK`
        : "MY FIRST STOCK"
      : `I'VE OWNED ${(card.assetName || card.assetSymbol).toUpperCase()} FOR ${card.ownedDays.toLocaleString("en-US")} DAYS`;
  return (
    <m.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
      className="flex h-full w-full flex-col items-center justify-center gap-3 px-8 text-center"
      style={{
        background:
          "radial-gradient(120% 120% at 20% 0%, rgba(230,184,77,0.14), transparent 55%), linear-gradient(158deg, #0B0C0F, #050608)",
      }}
    >
      <ImageOff className="h-5 w-5 text-gold-400/70" />
      <div className="font-display text-lg font-extrabold leading-tight text-[#F4F1EA]">
        {headline}
      </div>
      <div className="font-mono text-[10px] uppercase tracking-[0.16em] text-[#F4F1EA]/50">
        {demo
          ? "Live share renders on a real card"
          : "Preview will appear here"}
        {" · "}
        {card.serial}
      </div>
    </m.div>
  );
}
