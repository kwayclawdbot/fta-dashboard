"use client";

/**
 * GiftRevealDialog — THE MOMENT. Someone (often a kid, often their first stock)
 * accepts a gifted card. Treated like unwrapping: a wrapped state, a staged
 * reveal, then the card lands with the gift ribbon.
 *
 * Warm and premium — no confetti-casino energy. Reduced-motion collapses the
 * staged reveal into a calm fade (opacity/color only, no movement).
 */

import { useEffect, useMemo, useState } from "react";
import { m, AnimatePresence, useReducedMotion } from "@/lib/motion";
import { Gift, X, Sparkles, Loader2, Check } from "lucide-react";
import type {
  OwnershipCard,
  GiftProvenance,
  TransferListItem,
} from "@/lib/ownership/types";
import LivingCard from "./LivingCard";
import { acceptTransfer } from "./api";
import {
  senderLabel,
  expiresInLabel,
  summaryToDisplayCard,
} from "./transfer-format";

const EASE = [0.23, 1, 0.32, 1] as const;

type Stage = "wrapped" | "opening" | "revealed" | "error";

/** Fold the sender + message into gift provenance on the landed card. */
function withGift(card: OwnershipCard, item: TransferListItem): OwnershipCard {
  const gift: GiftProvenance = {
    fromDisplayName: item.counterpart?.displayName ?? null,
    message: item.transfer.message,
    giftedAt: new Date().toISOString(),
    originalValueAtGift:
      card.market?.currentValue ?? card.acquisition.originalValue,
    verification: card.provider === "snaptrade" ? "verified" : "self_reported",
  };
  return { ...card, status: "active", gift };
}

export default function GiftRevealDialog({
  item,
  demo = false,
  onClose,
  onAccepted,
}: {
  item: TransferListItem;
  demo?: boolean;
  onClose: () => void;
  onAccepted: (card: OwnershipCard) => void;
}) {
  const reduce = useReducedMotion();
  const [stage, setStage] = useState<Stage>("wrapped");
  const [err, setErr] = useState<string | null>(null);
  const from = senderLabel(item.counterpart);
  const displayCard = useMemo(
    () => (item.card ? summaryToDisplayCard(item.card) : null),
    [item.card]
  );
  const landed = displayCard ? withGift(displayCard, item) : null;
  const symbol = item.card?.assetSymbol ?? "your card";

  useEffect(() => {
    const onKey = (e: KeyboardEvent) =>
      e.key === "Escape" && stage !== "opening" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [stage, onClose]);

  async function open() {
    setStage("opening");
    setErr(null);
    if (!demo) {
      const res = await acceptTransfer(item.transfer.id);
      if (!res.ok) {
        setErr(res.error);
        setStage("error");
        return;
      }
    }
    await wait(reduce ? 250 : 900);
    setStage("revealed");
  }

  return (
    <m.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
      onClick={() => stage !== "opening" && onClose()}
      className="bg-scrim fixed inset-0 z-[120] flex items-end justify-center p-0 backdrop-blur-md sm:items-center sm:p-4"
    >
      <m.div
        initial={reduce ? { opacity: 0 } : { opacity: 0, y: 26, scale: 0.985 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={reduce ? { opacity: 0 } : { opacity: 0, y: 20 }}
        transition={{ duration: 0.36, ease: EASE }}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Open your gift"
        className="relative w-full max-w-md overflow-hidden rounded-t-3xl border border-sand bg-card p-6 shadow-[var(--shadow-lift)] sm:rounded-3xl"
      >
        <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-sand sm:hidden" />
        {stage !== "opening" && (
          <button
            onClick={onClose}
            className="absolute right-4 top-4 text-soft transition-colors hover:text-ink"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        )}

        <AnimatePresence mode="wait" initial={false}>
          {(stage === "wrapped" || stage === "opening") && (
            <m.div
              key="wrap"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.24 }}
              className="flex flex-col items-center text-center"
            >
              <div className="flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-[0.16em] text-gold-700">
                <Gift className="h-3.5 w-3.5" /> A gift for you
              </div>
              <h2 className="mt-2 font-display text-xl font-extrabold text-ink">
                From {from}
              </h2>

              {/* Wrapped card */}
              <div className="relative mt-6 w-[220px]" style={{ aspectRatio: "5 / 7" }}>
                {displayCard && (
                  <div
                    className="absolute inset-0"
                    style={{
                      filter:
                        stage === "opening" && !reduce ? "blur(2px)" : "blur(6px)",
                      opacity: stage === "opening" ? 0.9 : 0.5,
                      transition: "filter 0.6s ease, opacity 0.6s ease",
                    }}
                  >
                    <LivingCard card={displayCard} size="shelf" interactive={false} />
                  </div>
                )}

                {/* Wrap cover — lifts away on open */}
                <AnimatePresence>
                  {stage === "wrapped" && (
                    <m.div
                      key="cover"
                      initial={false}
                      exit={reduce ? { opacity: 0 } : { opacity: 0, y: -18, scale: 1.03 }}
                      transition={{ duration: 0.5, ease: EASE }}
                      className="absolute inset-0 flex flex-col items-center justify-center rounded-[18px]"
                      style={{
                        background:
                          "linear-gradient(150deg, #14100A 0%, #0C0A06 60%, #060504 100%)",
                        border: "1px solid rgba(230,184,77,0.4)",
                        boxShadow:
                          "0 30px 70px -30px rgba(0,0,0,0.9), inset 0 0 40px rgba(230,184,77,0.06)",
                      }}
                    >
                      <div
                        className="absolute left-1/2 top-0 h-full w-7 -translate-x-1/2"
                        style={{
                          background:
                            "linear-gradient(90deg, rgba(230,184,77,0.25), rgba(255,243,196,0.5), rgba(230,184,77,0.25))",
                        }}
                      />
                      <div
                        className="absolute left-0 top-1/2 h-7 w-full -translate-y-1/2"
                        style={{
                          background:
                            "linear-gradient(0deg, rgba(230,184,77,0.25), rgba(255,243,196,0.5), rgba(230,184,77,0.25))",
                        }}
                      />
                      <Gift className="relative h-9 w-9 text-gold-400" />
                    </m.div>
                  )}
                </AnimatePresence>
              </div>

              {stage === "wrapped" ? (
                <>
                  <p className="mt-6 max-w-xs text-sm text-soft">
                    This is a real ownership card —{" "}
                    <span className="font-semibold text-ink">{symbol}</span>, yours
                    to keep. Take a breath, then open it.
                  </p>
                  <button
                    onClick={open}
                    className="f0-focus mt-5 inline-flex items-center gap-2 rounded-xl bg-accent font-display font-bold tracking-[0.02em] text-[color:var(--accent-on)] px-6 py-3.5 text-sm transition-transform duration-150 active:scale-[0.97]"
                  >
                    <Sparkles className="h-4 w-4" />
                    Open it
                  </button>
                </>
              ) : (
                <div className="mt-6 flex items-center gap-2 font-mono text-[12px] uppercase tracking-[0.14em] text-soft">
                  <Loader2 className="h-4 w-4 animate-spin" /> Unwrapping…
                </div>
              )}
            </m.div>
          )}

          {stage === "revealed" && landed && (
            <m.div
              key="reveal"
              initial={reduce ? { opacity: 0 } : { opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, ease: EASE }}
              className="flex flex-col items-center text-center"
            >
              <div className="flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-[0.16em] text-gold-700">
                <Sparkles className="h-3.5 w-3.5" /> It&apos;s yours
              </div>
              <h2 className="mt-2 font-display text-xl font-extrabold text-ink">
                {landed.assetName || landed.assetSymbol}
              </h2>

              <m.div
                initial={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.94, y: 8 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                transition={{ duration: 0.5, ease: EASE, delay: reduce ? 0 : 0.05 }}
                className="mt-5 w-[230px]"
              >
                <LivingCard card={landed} size="shelf" interactive={!reduce} priority />
              </m.div>

              {item.transfer.message && (
                <p className="mt-5 max-w-xs text-sm italic leading-relaxed text-soft">
                  &ldquo;{item.transfer.message}&rdquo;
                </p>
              )}
              <div className="mt-1.5 font-mono text-[11px] uppercase tracking-[0.12em] text-soft">
                — {from}
              </div>

              <button
                onClick={() => onAccepted(landed)}
                className="f0-focus mt-6 inline-flex items-center gap-2 rounded-xl bg-accent font-display font-bold tracking-[0.02em] text-[color:var(--accent-on)] px-6 py-3.5 text-sm transition-transform duration-150 active:scale-[0.97]"
              >
                <Check className="h-4 w-4" />
                Add to my collection
              </button>
            </m.div>
          )}

          {stage === "error" && (
            <m.div
              key="error"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex flex-col items-center py-6 text-center"
            >
              <h2 className="font-display text-lg font-bold text-ink">
                We couldn&apos;t open this gift
              </h2>
              <p className="mt-1.5 max-w-xs text-sm text-soft">
                {err ?? "Something went wrong."}
              </p>
              <div className="mt-5 flex gap-2">
                <button
                  onClick={onClose}
                  className="club-b-card f0-press f0-focus px-4 py-2.5 text-sm font-medium text-ink transition-colors hover:text-accent"
                >
                  Close
                </button>
                <button
                  onClick={() => setStage("wrapped")}
                  className="f0-press f0-focus rounded-xl bg-accent font-display font-bold tracking-[0.02em] text-[color:var(--accent-on)] px-4 py-2.5 text-sm"
                >
                  Try again
                </button>
              </div>
            </m.div>
          )}
        </AnimatePresence>

        {stage === "wrapped" && (
          <div className="mt-5 border-t border-sand pt-3 text-center">
            <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-soft">
              {expiresInLabel(item.transfer.expiresAt) ?? "Waiting for you"}
            </span>
          </div>
        )}
      </m.div>
    </m.div>
  );
}

function wait(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}
