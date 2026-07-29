"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { m, AnimatePresence } from "@/lib/motion";
import { ArrowLeft, Search, Check, Loader2, AlertCircle } from "lucide-react";
import type { OwnershipCard, AssetType } from "@/lib/ownership/types";
import LivingCard from "@/components/ownership/LivingCard";
import { mintCard } from "@/components/ownership/api";
import { searchTickers, fetchQuote, type TickerHit } from "@/lib/market/client";
import { artFor } from "@/components/ownership/art";
import { formatMoney } from "@/components/ownership/format";

const DEMO_HITS: TickerHit[] = [
  { ticker: "NVDA", name: "NVIDIA Corp.", type: "common" },
  { ticker: "AAPL", name: "Apple Inc.", type: "common" },
  { ticker: "MSFT", name: "Microsoft Corp.", type: "common" },
  { ticker: "VOO", name: "Vanguard S&P 500 ETF", type: "etf" },
  { ticker: "BTC", name: "Bitcoin", type: "crypto" },
];

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

function daysBetween(iso: string): number {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return 0;
  return Math.max(0, Math.floor((Date.now() - d.getTime()) / 86_400_000));
}

export default function MintClient({
  demo = false,
  initialSymbol = "",
}: {
  demo?: boolean;
  initialSymbol?: string;
}) {
  const router = useRouter();

  const [symbol, setSymbol] = useState(initialSymbol.toUpperCase());
  const [assetName, setAssetName] = useState<string | null>(null);
  const [assetType, setAssetType] = useState<AssetType>("stock");
  const [quantity, setQuantity] = useState("");
  const [avgPrice, setAvgPrice] = useState("");
  const [acquiredAt, setAcquiredAt] = useState(todayISO());

  const [hits, setHits] = useState<TickerHit[]>([]);
  const [showHits, setShowHits] = useState(false);
  const [livePrice, setLivePrice] = useState<number | null>(null);

  const [submitting, setSubmitting] = useState(false);
  const [minted, setMinted] = useState<OwnershipCard | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const qty = parseFloat(quantity);
  const price = parseFloat(avgPrice);
  const hasIdentity = symbol.trim().length > 0;
  const hasCore = hasIdentity && qty > 0 && price > 0;

  // Ticker suggestions (debounced). Free-typed symbols still work.
  useEffect(() => {
    const q = symbol.trim();
    if (q.length < 1) {
      setHits([]);
      return;
    }
    if (demo) {
      setHits(DEMO_HITS.filter((h) => h.ticker.startsWith(q.toUpperCase())));
      return;
    }
    const ctrl = new AbortController();
    const t = setTimeout(() => {
      searchTickers(q, ctrl.signal)
        .then((r) => setHits(r.slice(0, 6)))
        .catch(() => setHits([]));
    }, 220);
    return () => {
      clearTimeout(t);
      ctrl.abort();
    };
  }, [symbol, demo]);

  // Live price for the growth line on the preview.
  useEffect(() => {
    const s = symbol.trim().toUpperCase();
    if (!s) {
      setLivePrice(null);
      return;
    }
    if (demo) {
      setLivePrice(price > 0 ? price * 1.1 : null);
      return;
    }
    const ctrl = new AbortController();
    const t = setTimeout(() => {
      fetchQuote(s, ctrl.signal)
        .then((q) => setLivePrice(q?.price ?? null))
        .catch(() => setLivePrice(null));
    }, 300);
    return () => {
      clearTimeout(t);
      ctrl.abort();
    };
  }, [symbol, demo, price]);

  // The live preview card — the magic moment. Built from what's typed so far.
  const preview: OwnershipCard | null = useMemo(() => {
    if (!hasIdentity) return null;
    const q = qty > 0 ? qty : 0;
    const p = price > 0 ? price : 0;
    const original = q * p;
    const current = livePrice != null && q > 0 ? livePrice * q : original;
    const gain = current - original;
    const gainPct = original > 0 ? (gain / original) * 100 : 0;
    return {
      id: "preview",
      serial: "CC-S01-••••••",
      ownerId: "preview",
      assetSymbol: symbol.trim().toUpperCase(),
      assetName: assetName,
      assetType,
      denomination: q,
      series: "S01",
      edition: null,
      editionSize: null,
      rarity: null,
      status: "active",
      acquisition: {
        quantity: q,
        averagePrice: p,
        originalValue: original,
        acquiredAt: new Date(acquiredAt).toISOString(),
      },
      provider: "manual",
      activatedAt: new Date(acquiredAt).toISOString(),
      market:
        original > 0
          ? { price: livePrice ?? p, currentValue: current, gain, gainPct, asOf: new Date().toISOString() }
          : undefined,
      designState: { holdTier: "issued", valueClubs: [], series: "S01", rarity: null, designRev: 1 },
      holder: null,
      ownedDays: daysBetween(acquiredAt),
    };
  }, [hasIdentity, qty, price, livePrice, symbol, assetName, assetType, acquiredAt]);

  function selectHit(h: TickerHit) {
    setSymbol(h.ticker.toUpperCase());
    setAssetName(h.name || null);
    setAssetType(h.type === "etf" ? "etf" : h.type === "crypto" ? "crypto" : "stock");
    setShowHits(false);
  }

  function validate(): boolean {
    const fe: Record<string, string> = {};
    if (!symbol.trim()) fe.symbol = "Pick or type a ticker.";
    if (!(qty > 0)) fe.quantity = "Enter how many you own.";
    if (!(price > 0)) fe.averagePrice = "Enter your average cost.";
    if (new Date(acquiredAt).getTime() > Date.now() + 86_400_000)
      fe.acquiredAt = "That date is in the future.";
    setFieldErrors(fe);
    return Object.keys(fe).length === 0;
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);
    if (!validate()) return;
    setSubmitting(true);

    if (demo) {
      // No persistence in demo — celebrate, then land on the sample collection.
      window.setTimeout(() => {
        setMinted(preview);
      }, 350);
      return;
    }

    const res = await mintCard({
      symbol: symbol.trim().toUpperCase(),
      assetType,
      quantity: qty,
      averagePrice: price,
      acquiredAt: new Date(acquiredAt).toISOString(),
    });
    setSubmitting(false);
    if (res.ok) {
      setMinted(res.data);
    } else {
      setFormError(res.error);
      if (res.fieldErrors) setFieldErrors(res.fieldErrors);
    }
  }

  // After the reveal, land on the new card.
  function finishReveal() {
    if (demo) {
      router.push("/collection?demo=1");
      return;
    }
    if (minted) router.push(`/collection/${minted.id}`);
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6 sm:py-8">
      <Link
        href={demo ? "/collection?demo=1" : "/collection"}
        className="inline-flex items-center gap-1.5 text-sm text-soft transition-colors hover:text-ink"
      >
        <ArrowLeft className="h-4 w-4" />
        Collection
      </Link>

      <div className="mt-3">
        <h1 className="font-display text-2xl font-extrabold text-ink sm:text-3xl">
          Mint an Ownership Card
        </h1>
        <p className="mt-1 max-w-xl text-sm text-soft">
          Tell us what you own. We freeze your cost basis at mint, then the card
          lives — tracking value and growth, and getting richer the longer you
          hold.{" "}
          {!demo && (
            <span className="text-soft">
              Self-reported for now; it becomes verified once you link a
              brokerage.
            </span>
          )}
        </p>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr,minmax(280px,360px)]">
        {/* Form */}
        <form onSubmit={onSubmit} className="order-2 space-y-5 lg:order-1">
          {/* Symbol */}
          <Field label="Asset" error={fieldErrors.symbol}>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-soft" />
              <input
                value={symbol}
                onChange={(e) => {
                  setSymbol(e.target.value.toUpperCase());
                  setAssetName(null);
                  setShowHits(true);
                }}
                onFocus={() => setShowHits(true)}
                onBlur={() => window.setTimeout(() => setShowHits(false), 150)}
                placeholder="Search a ticker — NVDA, VOO, BTC…"
                className="w-full rounded-xl border border-sand bg-card py-3 pl-9 pr-3 font-mono text-sm uppercase tracking-wide text-ink outline-none transition-colors focus:border-gold-500"
                autoComplete="off"
                aria-label="Ticker symbol"
              />
              <AnimatePresence>
                {showHits && hits.length > 0 && (
                  <m.ul
                    initial={{ opacity: 0, y: -4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -4 }}
                    className="absolute z-20 mt-1 w-full overflow-hidden rounded-xl border border-sand bg-card shadow-[var(--shadow-lift)]"
                  >
                    {hits.map((h) => (
                      <li key={h.ticker}>
                        <button
                          type="button"
                          onMouseDown={(e) => e.preventDefault()}
                          onClick={() => selectHit(h)}
                          className="f0-focus flex w-full items-center justify-between gap-3 px-3 py-2.5 text-left transition-colors hover:bg-paper"
                        >
                          <span className="flex items-center gap-2.5 min-w-0">
                            <span
                              className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md font-display text-[10px] font-bold text-white"
                              style={{ background: artFor(h.ticker).accent }}
                            >
                              {h.ticker.slice(0, 2)}
                            </span>
                            <span className="min-w-0">
                              <span className="block font-mono text-sm font-semibold text-ink">
                                {h.ticker}
                              </span>
                              <span className="block truncate text-xs text-soft">
                                {h.name}
                              </span>
                            </span>
                          </span>
                          {h.type === "etf" && (
                            <span className="shrink-0 rounded-full bg-sand px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.12em] text-soft">
                              ETF
                            </span>
                          )}
                        </button>
                      </li>
                    ))}
                  </m.ul>
                )}
              </AnimatePresence>
            </div>
          </Field>

          <div className="grid grid-cols-2 gap-4">
            <Field label="Shares / units you own" error={fieldErrors.quantity}>
              <input
                value={quantity}
                onChange={(e) => setQuantity(e.target.value.replace(/[^0-9.]/g, ""))}
                inputMode="decimal"
                placeholder="10"
                className="w-full rounded-xl border border-sand bg-card px-3 py-3 font-mono text-sm text-ink outline-none transition-colors focus:border-gold-500"
              />
            </Field>
            <Field label="Average cost / share" error={fieldErrors.averagePrice}>
              <div className="relative">
                <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 font-mono text-sm text-soft">
                  $
                </span>
                <input
                  value={avgPrice}
                  onChange={(e) => setAvgPrice(e.target.value.replace(/[^0-9.]/g, ""))}
                  inputMode="decimal"
                  placeholder="142.00"
                  className="w-full rounded-xl border border-sand bg-card py-3 pl-7 pr-3 font-mono text-sm text-ink outline-none transition-colors focus:border-gold-500"
                />
              </div>
            </Field>
          </div>

          <Field label="Acquired on" error={fieldErrors.acquiredAt}>
            <input
              type="date"
              value={acquiredAt}
              max={todayISO()}
              onChange={(e) => setAcquiredAt(e.target.value)}
              className="w-full rounded-xl border border-sand bg-card px-3 py-3 font-mono text-sm text-ink outline-none transition-colors focus:border-gold-500"
            />
          </Field>

          {formError && (
            <div className="flex items-start gap-2 border-l-2 py-1 pl-3 text-sm font-semibold text-ink" role="alert" style={{ borderLeftColor: "var(--accent-solid)" }}>
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{formError}</span>
            </div>
          )}

          <div className="flex items-center gap-3 pt-1">
            <button
              type="submit"
              disabled={!hasCore || submitting}
              className="f0-press f0-focus inline-flex items-center gap-2 rounded-xl bg-accent px-6 py-3 font-display text-sm font-bold tracking-[0.02em] text-[color:var(--accent-on)] disabled:cursor-not-allowed disabled:opacity-50"
            >
              {submitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" /> Minting…
                </>
              ) : (
                <>Mint this card</>
              )}
            </button>
            {!hasCore && (
              <span className="text-xs text-soft">
                Fill in ticker, quantity and cost to mint.
              </span>
            )}
          </div>
          <p className="pt-1 text-xs text-soft">
            A card is a record of ownership, not a security or a promise of
            return. Minting never buys or sells anything.
          </p>
        </form>

        {/* Live preview — staged magic moment */}
        <div className="order-1 lg:order-2">
          <div className="lg:sticky lg:top-6">
            <div className="mb-3 flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.16em] text-soft">
              <span className="h-1.5 w-1.5 rounded-full bg-gold-500" />
              Live preview
            </div>
            <div className="flex min-h-[380px] items-center justify-center rounded-3xl border border-dashed border-sand bg-paper p-5">
              <AnimatePresence mode="wait">
                {preview ? (
                  <m.div
                    key="card"
                    initial={{ opacity: 0, scale: 0.9, y: 12 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    transition={{ duration: 0.5, ease: [0.23, 1, 0.32, 1] }}
                    className="w-full max-w-[280px]"
                  >
                    <LivingCard card={preview} size="detail" interactive />
                  </m.div>
                ) : (
                  <m.div
                    key="prompt"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="px-6 text-center"
                  >
                    <p className="font-display text-sm font-semibold text-ink">
                      Your card appears here
                    </p>
                    <p className="mt-1 text-xs text-soft">
                      Start with a ticker and watch it come to life.
                    </p>
                  </m.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </div>
      </div>

      {/* Celebration — a single tasteful reveal */}
      <AnimatePresence>
        {minted && (
          <MintReveal card={minted} onDone={finishReveal} />
        )}
      </AnimatePresence>
    </div>
  );
}

function Field({
  label,
  error,
  children,
}: {
  label: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-soft">
        {label}
      </span>
      {children}
      {error && <span role="alert" className="mt-1 block text-xs font-semibold text-ink">{error}</span>}
    </label>
  );
}

function MintReveal({ card, onDone }: { card: OwnershipCard; onDone: () => void }) {
  const ranRef = useRef(false);
  useEffect(() => {
    if (ranRef.current) return;
    ranRef.current = true;
    const t = window.setTimeout(onDone, 2100);
    return () => window.clearTimeout(t);
  }, [onDone]);

  return (
    <m.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="bg-scrim fixed inset-0 z-[100] flex flex-col items-center justify-center backdrop-blur-sm"
      onClick={onDone}
      role="dialog"
      aria-label="Card minted"
    >
      <m.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.35 }}
        className="mb-5 text-center"
      >
        <div className="font-mono text-[11px] uppercase tracking-[0.28em] text-gold-400">
          Minted
        </div>
        <div className="mt-1 font-display text-2xl font-extrabold text-white">
          {card.assetSymbol} · {formatMoney(card.acquisition.originalValue)}
        </div>
        <p className="mt-1 text-sm text-white/60">Card #{card.serial}</p>
      </m.div>
      <m.div
        initial={{ opacity: 0, scale: 0.7, rotateY: -18 }}
        animate={{ opacity: 1, scale: 1, rotateY: 0 }}
        transition={{ duration: 0.7, ease: [0.23, 1, 0.32, 1] }}
        className="w-[240px]"
      >
        <LivingCard card={card} size="detail" interactive priority />
      </m.div>
      <m.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1.1 }}
        className="mt-6 text-xs text-white/50"
      >
        Tap to open your card
      </m.p>
    </m.div>
  );
}
