"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { m } from "@/lib/motion";
import { Plus, Sparkles, RefreshCw, Layers } from "lucide-react";
import type { OwnershipCard, TransferListItem } from "@/lib/ownership/types";
import LivingCard from "@/components/ownership/LivingCard";
import LivingCardSkeleton from "@/components/ownership/LivingCardSkeleton";
import GiftsWaiting from "@/components/ownership/GiftsWaiting";
import OwnershipScore from "@/components/ownership/OwnershipScore";
import { getCollection, getTransfers } from "@/components/ownership/api";
import { demoCards, demoTransfers } from "@/components/ownership/demo";
import { formatMoney } from "@/components/ownership/format";

type Load =
  | { state: "loading" }
  | { state: "ready"; cards: OwnershipCard[] }
  | { state: "error"; message: string };

export default function CollectionClient({ demo = false }: { demo?: boolean }) {
  const router = useRouter();
  const [load, setLoad] = useState<Load>(
    demo ? { state: "ready", cards: demoCards() } : { state: "loading" }
  );
  const [incoming, setIncoming] = useState<TransferListItem[]>(
    demo ? demoTransfers().incoming : []
  );
  // Cards just accepted from a gift, surfaced immediately at the top of the shelf.
  const [accepted, setAccepted] = useState<OwnershipCard[]>([]);

  useEffect(() => {
    if (demo) {
      setLoad({ state: "ready", cards: demoCards() });
      setIncoming(demoTransfers().incoming);
      setAccepted([]);
      return;
    }
    let alive = true;
    setLoad({ state: "loading" });
    getCollection().then((res) => {
      if (!alive) return;
      if (res.ok) setLoad({ state: "ready", cards: res.data });
      else setLoad({ state: "error", message: res.error });
    });
    getTransfers().then((res) => {
      if (alive && res.ok) setIncoming(res.data.incoming);
    });
    return () => {
      alive = false;
    };
  }, [demo]);

  const cards = useMemo(() => {
    const base = load.state === "ready" ? load.cards : [];
    const seen = new Set(accepted.map((c) => c.id));
    return [...accepted, ...base.filter((c) => !seen.has(c.id))];
  }, [load, accepted]);
  const total = useMemo(
    () =>
      cards.reduce(
        (sum, c) => sum + (c.market?.currentValue ?? c.acquisition.originalValue),
        0
      ),
    [cards]
  );

  const mintHref = demo ? "/collection/mint?demo=1" : "/collection/mint";

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-8">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="flex items-center gap-2 text-soft">
            <Layers className="h-4 w-4 text-gold-600" />
            <span className="font-mono text-[11px] uppercase tracking-[0.2em]">
              Ownership Cards
            </span>
            {demo && (
              <span className="rounded-full bg-gold-400/15 px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.14em] text-gold-700">
                Demo
              </span>
            )}
          </div>
          <h1 className="mt-1 font-display text-2xl font-extrabold text-ink sm:text-3xl">
            Your Collection
          </h1>
          <p className="mt-1 text-sm text-soft">
            {load.state === "ready" && cards.length > 0
              ? `${cards.length} card${cards.length === 1 ? "" : "s"} · every one a living record of what you own and how long you've held it.`
              : "Turn the things you own into collectible titles you keep for life."}
          </p>
        </div>

        <div className="flex items-center gap-4">
          {load.state === "ready" && cards.length > 0 && (
            <div className="club-b-card px-4 py-2 text-right">
              <div className="font-mono text-[10px] uppercase tracking-[0.16em] text-soft">
                Collection value
              </div>
              <div className="font-mono text-xl font-bold tabular-nums text-ink">
                {formatMoney(total)}
              </div>
            </div>
          )}
          <Link
            href={mintHref}
            className="f0-press f0-focus inline-flex items-center gap-2 rounded-xl bg-accent px-4 py-3 font-display text-sm font-bold tracking-[0.02em] text-[color:var(--accent-on)]"
          >
            <Plus className="h-4 w-4" />
            Mint a card
          </Link>
        </div>
      </div>

      {/* Ownership Score */}
      {load.state === "ready" && (
        <div className="mt-6 sm:max-w-sm">
          <OwnershipScore demo={demo} />
        </div>
      )}

      {/* Body */}
      <div className="mt-8">
        {/* Gifts waiting for the recipient */}
        <GiftsWaiting
          key={incoming.map((t) => t.transfer.id).join(",") || "none"}
          incoming={incoming}
          demo={demo}
          onAcceptedCard={(card) => setAccepted((prev) => [card, ...prev])}
        />

        {load.state === "loading" && <ShelfSkeleton />}

        {load.state === "error" && (
          <ErrorState message={load.message} onRetry={() => router.refresh()} demoHref="/collection?demo=1" />
        )}

        {load.state === "ready" && cards.length === 0 && <EmptyState mintHref={mintHref} />}

        {load.state === "ready" && cards.length > 0 && (
          <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3 sm:gap-5 lg:grid-cols-4">
            {cards.map((card, i) => (
              <m.li
                key={card.id}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.45, delay: Math.min(i * 0.05, 0.4), ease: [0.23, 1, 0.32, 1] }}
              >
                <LivingCard
                  card={card}
                  size="shelf"
                  onClick={() =>
                    router.push(`/collection/${card.id}${demo ? "?demo=1" : ""}`)
                  }
                />
              </m.li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function ShelfSkeleton() {
  return (
    <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3 sm:gap-5 lg:grid-cols-4">
      {Array.from({ length: 8 }).map((_, i) => (
        <li key={i}>
          <LivingCardSkeleton size="shelf" />
        </li>
      ))}
    </ul>
  );
}

function EmptyState({ mintHref }: { mintHref: string }) {
  return (
    <div className="club-b-card relative overflow-hidden p-8 text-center sm:p-12">
      <div className="mx-auto max-w-xl">
        <div className="mx-auto mb-5 flex h-12 w-12 items-center justify-center rounded-2xl bg-gold-400/15 text-gold-700">
          <Sparkles className="h-6 w-6" />
        </div>
        <h2 className="font-display text-xl font-extrabold text-ink sm:text-2xl">
          Own it. Then keep the proof.
        </h2>
        <p className="mx-auto mt-2 max-w-md text-sm text-soft">
          An Ownership Card is a living collectible for a position you hold. Its
          face shows what it&apos;s worth today and how far it&apos;s come since
          you bought in — and its frame gets richer the longer you hold. Mint
          your first and start the story.
        </p>
        <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
          <Link
            href={mintHref}
            className="f0-press f0-focus inline-flex items-center gap-2 rounded-xl bg-accent px-5 py-3 font-display text-sm font-bold tracking-[0.02em] text-[color:var(--accent-on)]"
          >
            <Plus className="h-4 w-4" />
            Mint your first card
          </Link>
          <Link
            href="/collection?demo=1"
            className="club-b-card f0-press f0-focus inline-flex items-center gap-2 px-5 py-3 text-sm font-medium text-ink transition-colors hover:text-accent"
          >
            See an example collection
          </Link>
        </div>
      </div>
    </div>
  );
}

function ErrorState({
  message,
  onRetry,
  demoHref,
}: {
  message: string;
  onRetry: () => void;
  demoHref: string;
}) {
  return (
    <div className="club-b-card p-8 text-center">
      <h2 className="font-display text-lg font-bold text-ink">
        Your collection didn&apos;t load
      </h2>
      <p className="mx-auto mt-1 max-w-sm text-sm text-soft">{message}</p>
      <div className="mt-5 flex flex-wrap items-center justify-center gap-3">
        <button
          onClick={onRetry}
          className="club-b-card f0-press f0-focus inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-ink transition-colors hover:text-accent"
        >
          <RefreshCw className="h-4 w-4" />
          Try again
        </button>
        <Link
          href={demoHref}
          className="club-b-card f0-press f0-focus inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-ink transition-colors hover:text-accent"
        >
          View demo collection
        </Link>
      </div>
    </div>
  );
}
