"use client";

/**
 * GiftDialog — the sender side of the gift ceremony.
 *
 * A staged, premium flow that happens at a kitchen table on a phone:
 *   1. recipient (username or email) + a personal message ("Gifted by Dad")
 *   2. an honest explainer — the CARD transfers in-app; the SHARES move through
 *      your brokerage/UTMA outside the app for now — one confident paragraph +
 *      an "I understand" checkbox
 *   3. confirm → the card enters IN TRANSFER
 *
 * Mobile-first (bottom sheet on small screens, centered modal on larger).
 * Reduced-motion respected. No return promises anywhere — compliance reads here.
 */

import { useEffect, useRef, useState } from "react";
import { m, AnimatePresence, useReducedMotion } from "@/lib/motion";
import { Gift, X, ArrowLeft, ArrowRight, Loader2, ShieldCheck, Lock } from "lucide-react";
import type {
  OwnershipCard,
  CardTransfer,
  TransferListItem,
} from "@/lib/ownership/types";
import { createTransfer } from "./api";
import { formatMoney } from "./format";

/** Compact summary + counterpart wrapper for a just-created outgoing gift. */
function toListItem(
  card: OwnershipCard,
  transfer: CardTransfer,
  recipientLabel: string
): TransferListItem {
  return {
    transfer,
    card: {
      id: card.id,
      serial: card.serial,
      assetSymbol: card.assetSymbol,
      assetName: card.assetName,
      denomination: card.denomination,
      status: "in_transfer",
      designState: card.designState,
    },
    counterpart: { displayName: recipientLabel, username: null },
  };
}

const EASE = [0.23, 1, 0.32, 1] as const;

type Step = "who" | "explain" | "sending";

export default function GiftDialog({
  card,
  demo = false,
  onClose,
  onGifted,
}: {
  card: OwnershipCard;
  demo?: boolean;
  onClose: () => void;
  onGifted: (item: TransferListItem) => void;
}) {
  const reduce = useReducedMotion();
  const [step, setStep] = useState<Step>("who");
  const [recipient, setRecipient] = useState("");
  const [message, setMessage] = useState("");
  const [understood, setUnderstood] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [fieldErr, setFieldErr] = useState<string | null>(null);
  const recipientRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const t = setTimeout(() => recipientRef.current?.focus(), 60);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && !busy && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [busy, onClose]);

  const currentValue = card.market?.currentValue ?? card.acquisition.originalValue;

  function goExplain() {
    const r = recipient.trim();
    if (!r) {
      setFieldErr("Add who this is going to.");
      recipientRef.current?.focus();
      return;
    }
    setFieldErr(null);
    setStep("explain");
  }

  async function confirm() {
    setBusy(true);
    setErr(null);
    const label = recipient.trim();
    if (demo) {
      // Local ceremony: fabricate the pending transfer so the flow is reviewable.
      await wait(reduce ? 200 : 650);
      const transfer: CardTransfer = {
        id: `demo-tr-${Date.now()}`,
        cardId: card.id,
        fromUser: "me",
        toUser: label,
        status: "pending",
        message: message.trim() || null,
        createdAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 7 * 864e5).toISOString(),
        resolvedAt: null,
      };
      setStep("sending");
      await wait(reduce ? 150 : 500);
      onGifted(toListItem(card, transfer, label));
      return;
    }
    const res = await createTransfer({
      cardId: card.id,
      recipient: label,
      message: message.trim() || undefined,
    });
    if (res.ok) {
      setStep("sending");
      await wait(reduce ? 150 : 500);
      onGifted(toListItem(card, res.data, label));
    } else {
      setErr(res.error);
      setBusy(false);
      setStep("explain");
    }
  }

  return (
    <m.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
      onClick={() => !busy && onClose()}
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
        aria-label={`Gift your ${card.assetSymbol} card`}
        className="relative w-full max-w-md overflow-hidden rounded-t-3xl border border-sand bg-card p-6 shadow-[var(--shadow-lift)] sm:rounded-3xl"
      >
        {/* Grab handle on mobile */}
        <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-sand sm:hidden" />

        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gold-400/15 text-gold-700">
              <Gift className="h-5 w-5" />
            </div>
            <div>
              <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-soft">
                Gift a card
              </div>
              <div className="font-display text-lg font-extrabold leading-tight text-ink">
                {card.assetSymbol} · {card.denomination}{" "}
                {card.assetType === "crypto" ? "units" : "shares"}
              </div>
            </div>
          </div>
          <button
            onClick={() => !busy && onClose()}
            className="text-soft transition-colors hover:text-ink"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Step dots */}
        <div className="mt-4 flex items-center gap-1.5">
          {(["who", "explain", "sending"] as Step[]).map((s) => (
            <span
              key={s}
              className="h-1 flex-1 rounded-full transition-colors duration-300"
              style={{
                background:
                  stepIndex(s) <= stepIndex(step)
                    ? "var(--color-gold-500, #E6B84D)"
                    : "var(--sand)",
              }}
            />
          ))}
        </div>

        <AnimatePresence mode="wait" initial={false}>
          {step === "who" && (
            <StepShell key="who" reduce={reduce}>
              <p className="mt-4 text-sm text-soft">
                Send this ownership card to someone in your family or your Club.
                They&apos;ll get to unwrap it.
              </p>

              <label className="mt-4 block">
                <span className="font-mono text-[11px] uppercase tracking-[0.14em] text-soft">
                  Recipient
                </span>
                <input
                  ref={recipientRef}
                  value={recipient}
                  onChange={(e) => {
                    setRecipient(e.target.value);
                    if (fieldErr) setFieldErr(null);
                  }}
                  onKeyDown={(e) => e.key === "Enter" && goExplain()}
                  placeholder="username or email"
                  autoCapitalize="none"
                  autoCorrect="off"
                  spellCheck={false}
                  className="mt-1.5 w-full rounded-xl border border-sand bg-paper px-3.5 py-3 text-base text-ink outline-none transition-colors focus:border-gold-500"
                />
                {fieldErr && (
                  <span role="alert" className="mt-1.5 block text-xs font-semibold text-ink">{fieldErr}</span>
                )}
              </label>

              <label className="mt-3 block">
                <span className="font-mono text-[11px] uppercase tracking-[0.14em] text-soft">
                  A note{" "}
                  <span className="normal-case tracking-normal text-soft/70">
                    (they&apos;ll keep this forever)
                  </span>
                </span>
                <textarea
                  value={message}
                  onChange={(e) => setMessage(e.target.value.slice(0, 240))}
                  rows={3}
                  placeholder="Your first stock, kiddo. Watch the years, not the price. — Dad"
                  className="mt-1.5 w-full resize-none rounded-xl border border-sand bg-paper px-3.5 py-3 text-sm text-ink outline-none transition-colors focus:border-gold-500"
                />
                <span className="mt-1 block text-right font-mono text-[10px] text-soft">
                  {message.length}/240
                </span>
              </label>

              <div className="mt-5 flex justify-end">
                <PressButton onClick={goExplain} tone="gold">
                  Continue
                  <ArrowRight className="h-4 w-4" />
                </PressButton>
              </div>
            </StepShell>
          )}

          {step === "explain" && (
            <StepShell key="explain" reduce={reduce}>
              <h3 className="mt-4 font-display text-base font-extrabold text-ink">
                How this gift moves
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-soft">
                The <span className="font-semibold text-ink">card</span> — the
                collectible title, its history and provenance — transfers to{" "}
                <span className="font-semibold text-ink">{recipient.trim()}</span>{" "}
                right here in the app. The{" "}
                <span className="font-semibold text-ink">shares themselves</span>{" "}
                still move the way they always have: through your brokerage or
                UTMA account, outside the app. For now you confirm that transfer
                on your own; brokerage linking will automate it later. Nothing
                here buys, sells, or promises anything.
              </p>

              <div className="mt-4 rounded-xl border border-sand bg-paper/60 p-3.5">
                <div className="flex items-center justify-between">
                  <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-soft">
                    Card value today
                  </span>
                  <span className="font-mono text-sm font-bold tabular-nums text-ink">
                    {formatMoney(currentValue)}
                  </span>
                </div>
              </div>

              <label className="mt-4 flex items-start gap-3 rounded-xl border border-sand p-3.5">
                <input
                  type="checkbox"
                  checked={understood}
                  onChange={(e) => setUnderstood(e.target.checked)}
                  className="mt-0.5 h-4 w-4 shrink-0 accent-gold-600"
                />
                <span className="text-sm text-ink">
                  I understand the shares move separately, through my brokerage.
                </span>
              </label>

              {err && (
                <p role="alert" className="mt-3 border-l-2 pl-3 text-sm font-semibold text-ink" style={{ borderLeftColor: "var(--accent-solid)" }}>
                  {err}
                </p>
              )}

              <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-between">
                <PressButton onClick={() => setStep("who")} tone="ghost" disabled={busy}>
                  <ArrowLeft className="h-4 w-4" />
                  Back
                </PressButton>
                <PressButton
                  onClick={confirm}
                  tone="gold"
                  disabled={!understood || busy}
                >
                  {busy ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Gift className="h-4 w-4" />
                  )}
                  Send the gift
                </PressButton>
              </div>
            </StepShell>
          )}

          {step === "sending" && (
            <StepShell key="sending" reduce={reduce}>
              <div className="flex flex-col items-center py-6 text-center">
                <m.div
                  initial={reduce ? { opacity: 0 } : { scale: 0.8, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ duration: 0.4, ease: EASE }}
                  className="flex h-16 w-16 items-center justify-center rounded-3xl bg-gold-400/15 text-gold-700"
                >
                  <Lock className="h-7 w-7" />
                </m.div>
                <h3 className="mt-4 font-display text-lg font-extrabold text-ink">
                  On its way to {recipient.trim()}
                </h3>
                <p className="mt-1.5 max-w-xs text-sm text-soft">
                  The card is now locked in transfer. It&apos;ll land in their
                  collection the moment they accept.
                </p>
                <div className="mt-3 flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-[0.12em] text-gold-700">
                  <ShieldCheck className="h-3.5 w-3.5" /> Provenance recorded
                </div>
              </div>
            </StepShell>
          )}
        </AnimatePresence>
      </m.div>
    </m.div>
  );
}

function StepShell({
  children,
  reduce,
}: {
  children: React.ReactNode;
  reduce: boolean | null;
}) {
  return (
    <m.div
      initial={reduce ? { opacity: 0 } : { opacity: 0, x: 12 }}
      animate={{ opacity: 1, x: 0 }}
      exit={reduce ? { opacity: 0 } : { opacity: 0, x: -12 }}
      transition={{ duration: 0.24, ease: EASE }}
    >
      {children}
    </m.div>
  );
}

function PressButton({
  children,
  onClick,
  tone,
  disabled,
}: {
  children: React.ReactNode;
  onClick: () => void;
  tone: "gold" | "ghost";
  disabled?: boolean;
}) {
  // Weight lives on the TONE, not the base: the board's primary is a flat
  // orange display-bold fill, the secondary a hairline white card button, and
  // two competing font-weight utilities on one element resolve by CSS source
  // order rather than by class order.
  const base =
    "inline-flex items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm transition-transform duration-150 active:scale-[0.97] disabled:pointer-events-none disabled:opacity-50 f0-focus";
  const styles =
    tone === "gold"
      ? "bg-accent font-display font-bold tracking-[0.02em] text-[color:var(--accent-on)]"
      : "club-b-card font-semibold text-ink transition-colors hover:text-accent";
  return (
    <button onClick={onClick} disabled={disabled} className={`${base} ${styles}`}>
      {children}
    </button>
  );
}

function stepIndex(s: Step): number {
  return s === "who" ? 0 : s === "explain" ? 1 : 2;
}

function wait(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}
