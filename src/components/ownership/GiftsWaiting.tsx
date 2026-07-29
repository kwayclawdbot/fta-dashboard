"use client";

/**
 * GiftsWaiting — the recipient's inbox strip at the top of /collection.
 * One row per incoming pending gift: the card (shelf size), who sent it, their
 * message, and how long they have to open it. Accept → the reveal ceremony;
 * Decline → a quiet confirm.
 */

import { useMemo, useState } from "react";
import { m, AnimatePresence, useReducedMotion } from "@/lib/motion";
import { Gift, X } from "lucide-react";
import type { OwnershipCard, TransferListItem } from "@/lib/ownership/types";
import LivingCard from "./LivingCard";
import GiftRevealDialog from "./GiftRevealDialog";
import { declineTransfer } from "./api";
import {
  senderLabel,
  expiresInLabel,
  isExpired,
  summaryToDisplayCard,
} from "./transfer-format";

const EASE = [0.23, 1, 0.32, 1] as const;

export default function GiftsWaiting({
  incoming,
  demo = false,
  onAcceptedCard,
}: {
  incoming: TransferListItem[];
  demo?: boolean;
  onAcceptedCard?: (card: OwnershipCard) => void;
}) {
  const reduce = useReducedMotion();
  const [list, setList] = useState<TransferListItem[]>(incoming);
  const [opening, setOpening] = useState<TransferListItem | null>(null);
  const [decliningId, setDecliningId] = useState<string | null>(null);

  if (list.length === 0) return null;

  function remove(id: string) {
    setList((prev) => prev.filter((t) => t.transfer.id !== id));
  }

  return (
    <section
      aria-label="Gifts waiting for you"
      className="club-b-warm mb-8 p-5 sm:p-6"
    >
      <div className="flex items-center gap-2">
        <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-gold-400/15 text-gold-700">
          <Gift className="h-4 w-4" />
        </span>
        <div>
          <h2 className="font-display text-base font-extrabold text-ink">
            {list.length === 1 ? "A gift is waiting" : `${list.length} gifts waiting`}
          </h2>
          <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-soft">
            Someone sent you a card
          </p>
        </div>
      </div>

      <ul className="mt-5 space-y-4">
        <AnimatePresence initial={false}>
          {list.map((item, i) => (
            <GiftRow
              key={item.transfer.id}
              item={item}
              index={i}
              reduce={!!reduce}
              declining={decliningId === item.transfer.id}
              onOpen={() => setOpening(item)}
              onStartDecline={() => setDecliningId(item.transfer.id)}
              onCancelDecline={() => setDecliningId(null)}
              onConfirmDecline={async () => {
                if (!demo) await declineTransfer(item.transfer.id);
                setDecliningId(null);
                remove(item.transfer.id);
              }}
              onDismiss={() => remove(item.transfer.id)}
            />
          ))}
        </AnimatePresence>
      </ul>

      <AnimatePresence>
        {opening && (
          <GiftRevealDialog
            item={opening}
            demo={demo}
            onClose={() => setOpening(null)}
            onAccepted={(card) => {
              const id = opening.transfer.id;
              setOpening(null);
              remove(id);
              onAcceptedCard?.(card);
            }}
          />
        )}
      </AnimatePresence>
    </section>
  );
}

function GiftRow({
  item,
  index,
  reduce,
  declining,
  onOpen,
  onStartDecline,
  onCancelDecline,
  onConfirmDecline,
  onDismiss,
}: {
  item: TransferListItem;
  index: number;
  reduce: boolean;
  declining: boolean;
  onOpen: () => void;
  onStartDecline: () => void;
  onCancelDecline: () => void;
  onConfirmDecline: () => void;
  onDismiss: () => void;
}) {
  const from = senderLabel(item.counterpart);
  const expired = isExpired(item.transfer.expiresAt);
  const displayCard = useMemo(
    () => (item.card ? summaryToDisplayCard(item.card) : null),
    [item.card]
  );
  const sym = item.card?.assetSymbol ?? "Card";
  const denom = item.card?.denomination ?? 0;

  return (
    <m.li
      initial={reduce ? { opacity: 0 } : { opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={reduce ? { opacity: 0 } : { opacity: 0, height: 0, marginTop: 0 }}
      transition={{ duration: 0.35, ease: EASE, delay: Math.min(index * 0.05, 0.2) }}
      className="flex gap-4 rounded-2xl border border-sand bg-card p-4"
    >
      {displayCard && (
        <div className="w-20 shrink-0 sm:w-24">
          <LivingCard card={displayCard} size="shelf" interactive={false} />
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="font-display text-sm font-bold text-ink">
              {sym} · {denom} {denom === 1 ? "share" : "shares"}
            </div>
            <div className="font-mono text-[11px] text-soft">From {from}</div>
          </div>
          <span
            className={`shrink-0 rounded-full px-2 py-0.5 font-mono text-[9px] uppercase tracking-[0.12em] ${
              expired ? "bg-sand text-soft" : "bg-gold-400/12 text-gold-700"
            }`}
          >
            {expiresInLabel(item.transfer.expiresAt) ?? "Pending"}
          </span>
        </div>

        {item.transfer.message && (
          <p className="mt-1.5 line-clamp-2 text-xs italic text-soft">
            &ldquo;{item.transfer.message}&rdquo;
          </p>
        )}

        {declining ? (
          <m.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="mt-auto flex flex-col gap-2 pt-3 sm:flex-row sm:items-center"
          >
            <span className="text-xs text-soft">
              Decline this gift? It goes back to the sender.
            </span>
            <div className="flex gap-2">
              <button
                onClick={onConfirmDecline}
                className="club-b-card f0-press f0-focus inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-soft transition-colors hover:text-ink"
              >
                <X className="h-3.5 w-3.5" />
                Decline
              </button>
              <button
                onClick={onCancelDecline}
                className="rounded-lg px-3 py-1.5 text-xs font-medium text-soft hover:text-ink"
              >
                Keep
              </button>
            </div>
          </m.div>
        ) : (
          <div className="mt-auto flex items-center gap-2 pt-3">
            {expired ? (
              <button
                onClick={onDismiss}
                className="rounded-lg border border-sand px-3 py-2 text-xs font-medium text-soft transition-colors hover:text-ink"
              >
                Dismiss
              </button>
            ) : (
              <>
                <button
                  onClick={onOpen}
                  className="f0-focus inline-flex items-center gap-1.5 rounded-lg bg-accent font-display font-bold tracking-[0.02em] text-[color:var(--accent-on)] px-3.5 py-2 text-xs transition-transform duration-150 active:scale-[0.97]"
                >
                  <Gift className="h-3.5 w-3.5" />
                  Open
                </button>
                <button
                  onClick={onStartDecline}
                  className="rounded-lg border border-sand px-3 py-2 text-xs font-medium text-soft transition-colors hover:text-ink"
                >
                  Decline
                </button>
              </>
            )}
          </div>
        )}
      </div>
    </m.li>
  );
}
