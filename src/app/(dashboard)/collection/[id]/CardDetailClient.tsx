"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { m, AnimatePresence } from "@/lib/motion";
import {
  ArrowLeft,
  Sparkles,
  Award,
  CalendarClock,
  Coins,
  Split,
  ArrowLeftRight,
  Camera,
  Gift,
  ShieldAlert,
  Flag,
  Share2,
  Lock,
  X,
  Loader2,
  CreditCard,
  Gem,
  ShieldCheck,
} from "lucide-react";
import { formFactorMeta } from "@/components/ownership/scan";
import type { ChipSummary } from "@/lib/ownership/types";
import type {
  OwnershipCard,
  CardEvent,
  CardSnapshot,
  CardEventKind,
} from "@/lib/ownership/types";
import type { TransferListItem } from "@/lib/ownership/types";
import LivingCard from "@/components/ownership/LivingCard";
import LivingCardSkeleton from "@/components/ownership/LivingCardSkeleton";
import GiftDialog from "@/components/ownership/GiftDialog";
import ShareDialog from "@/components/ownership/ShareDialog";
import GiftProvenanceBlock from "@/components/ownership/GiftProvenanceBlock";
import { getCard, sealCard, cancelTransfer } from "@/components/ownership/api";
import { demoCardById, type CardDetailBundle } from "@/components/ownership/demo";
import {
  formatMoney,
  formatPct,
  formatDelta,
  formatHeld,
  formatDate,
  holderName,
} from "@/components/ownership/format";
import { senderLabel, expiresInLabel } from "@/components/ownership/transfer-format";
import { tierLabel } from "@/components/ownership/tiers";

type Load =
  | { state: "loading" }
  | { state: "ready"; bundle: CardDetailBundle }
  | { state: "error"; message: string };

export default function CardDetailClient({
  id,
  demo = false,
}: {
  id: string;
  demo?: boolean;
}) {
  const router = useRouter();
  const [load, setLoad] = useState<Load>({ state: "loading" });
  const [tab, setTab] = useState<"timeline" | "snapshots">("timeline");
  const [sealOpen, setSealOpen] = useState(false);
  const [giftOpen, setGiftOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [pending, setPending] = useState<TransferListItem | null>(null);
  const [cancelBusy, setCancelBusy] = useState(false);
  const [cancelErr, setCancelErr] = useState<string | null>(null);

  useEffect(() => {
    if (demo) {
      const bundle = demoCardById(id);
      setPending(bundle?.transfer ?? null);
      setLoad(
        bundle
          ? { state: "ready", bundle }
          : { state: "error", message: "That demo card doesn't exist." }
      );
      return;
    }
    let alive = true;
    setLoad({ state: "loading" });
    getCard(id).then((res) => {
      if (!alive) return;
      if (res.ok && res.data.card) {
        setPending(res.data.transfer ?? null);
        setLoad({ state: "ready", bundle: res.data });
      } else
        setLoad({
          state: "error",
          message: res.ok ? "This card couldn't be found." : res.error,
        });
    });
    return () => {
      alive = false;
    };
  }, [id, demo]);

  const backHref = demo ? "/collection?demo=1" : "/collection";

  async function onSeal(input: { reason: string; soldAll: boolean }) {
    if (load.state !== "ready") return;
    if (demo) {
      // Reflect locally so the seal-broken treatment is reviewable.
      const card = { ...load.bundle.card, status: "seal_broken" as const };
      const newEvent: CardEvent = {
        id: Date.now(),
        cardId: card.id,
        kind: "seal_broken",
        payload: { reason: input.reason || "Reported a sale", soldAll: input.soldAll },
        occurredAt: new Date().toISOString(),
      };
      setLoad({
        state: "ready",
        bundle: { ...load.bundle, card, events: [newEvent, ...load.bundle.events] },
      });
      setSealOpen(false);
      return;
    }
    const res = await sealCard(id, {
      reason: input.reason,
      soldAll: input.soldAll,
    });
    if (res.ok) {
      setLoad({ state: "ready", bundle: { ...load.bundle, card: res.data } });
      setSealOpen(false);
      router.refresh();
    } else {
      throw new Error(res.error);
    }
  }

  function onGifted(item: TransferListItem) {
    if (load.state !== "ready") return;
    setPending(item);
    setGiftOpen(false);
    const card = { ...load.bundle.card, status: "in_transfer" as const };
    const outEvent: CardEvent = {
      id: Date.now(),
      cardId: card.id,
      kind: "transfer_out",
      payload: { to: item.counterpart?.displayName ?? "recipient", pending: true },
      occurredAt: new Date().toISOString(),
    };
    setLoad({
      state: "ready",
      bundle: { ...load.bundle, card, events: [outEvent, ...load.bundle.events] },
    });
    if (!demo) router.refresh();
  }

  async function onCancelTransfer() {
    if (load.state !== "ready") return;
    setCancelBusy(true);
    setCancelErr(null);
    if (!demo && pending?.transfer.id) {
      const res = await cancelTransfer(pending.transfer.id);
      if (!res.ok) {
        setCancelErr(res.error);
        setCancelBusy(false);
        return;
      }
    }
    const card = { ...load.bundle.card, status: "active" as const };
    setLoad({ state: "ready", bundle: { ...load.bundle, card } });
    setPending(null);
    setCancelBusy(false);
    if (!demo) router.refresh();
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6 sm:py-8">
      <Link
        href={backHref}
        className="inline-flex items-center gap-1.5 text-sm text-soft transition-colors hover:text-ink"
      >
        <ArrowLeft className="h-4 w-4" />
        Collection
      </Link>

      {load.state === "loading" && <DetailSkeleton />}

      {load.state === "error" && (
        <div className="club-b-card mt-8 p-8 text-center">
          <h1 className="font-display text-lg font-bold text-ink">
            Card unavailable
          </h1>
          <p className="mx-auto mt-1 max-w-sm text-sm text-soft">{load.message}</p>
          <Link
            href={backHref}
            className="club-b-card f0-press f0-focus mt-5 inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-ink transition-colors hover:text-accent"
          >
            Back to collection
          </Link>
        </div>
      )}

      {load.state === "ready" && (
        <ReadyView
          bundle={load.bundle}
          tab={tab}
          setTab={setTab}
          pending={pending}
          cancelBusy={cancelBusy}
          cancelErr={cancelErr}
          onReportSale={() => setSealOpen(true)}
          onGift={() => setGiftOpen(true)}
          onShare={() => setShareOpen(true)}
          onCancelTransfer={onCancelTransfer}
        />
      )}

      <AnimatePresence>
        {sealOpen && load.state === "ready" && (
          <SealDialog
            card={load.bundle.card}
            onClose={() => setSealOpen(false)}
            onConfirm={onSeal}
          />
        )}
        {giftOpen && load.state === "ready" && (
          <GiftDialog
            card={load.bundle.card}
            demo={demo}
            onClose={() => setGiftOpen(false)}
            onGifted={onGifted}
          />
        )}
        {shareOpen && load.state === "ready" && (
          <ShareDialog
            card={load.bundle.card}
            demo={demo}
            onClose={() => setShareOpen(false)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

function ReadyView({
  bundle,
  tab,
  setTab,
  pending,
  cancelBusy,
  cancelErr,
  onReportSale,
  onGift,
  onShare,
  onCancelTransfer,
}: {
  bundle: CardDetailBundle;
  tab: "timeline" | "snapshots";
  setTab: (t: "timeline" | "snapshots") => void;
  pending: TransferListItem | null;
  cancelBusy: boolean;
  cancelErr: string | null;
  onReportSale: () => void;
  onGift: () => void;
  onShare: () => void;
  onCancelTransfer: () => void;
}) {
  const { card, events, snapshots } = bundle;
  const isActive = card.status === "active";
  const isTransfer = card.status === "in_transfer";
  const canSeal = isActive || isTransfer;

  return (
    <div className="mt-5 grid gap-8 lg:grid-cols-[minmax(0,380px),1fr]">
      {/* Hero */}
      <div className="lg:sticky lg:top-6 lg:self-start">
        <div className="flex justify-center">
          <LivingCard card={card} size="hero" interactive priority />
        </div>

        {isTransfer ? (
          <TransferPendingPanel
            pending={pending}
            busy={cancelBusy}
            err={cancelErr}
            onCancel={onCancelTransfer}
          />
        ) : (
          <div className="mx-auto mt-5 flex max-w-[340px] flex-col gap-2.5">
            {isActive && (
              <div className="flex gap-2.5">
                <button
                  onClick={onGift}
                  className="f0-focus inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-accent px-4 py-3 font-display text-sm font-bold tracking-[0.02em] text-[color:var(--accent-on)] transition-transform duration-150 active:scale-[0.97]"
                >
                  <Gift className="h-4 w-4" />
                  Gift this card
                </button>
                <button
                  onClick={onShare}
                  className="club-b-card f0-focus inline-flex items-center justify-center gap-2 px-4 py-3 text-sm font-medium text-ink transition-transform duration-150 hover:text-accent active:scale-[0.97]"
                >
                  <Share2 className="h-4 w-4" />
                  Share
                </button>
              </div>
            )}
            {!isActive && (
              <button
                onClick={onShare}
                className="club-b-card f0-focus inline-flex items-center justify-center gap-2 px-4 py-3 text-sm font-medium text-ink transition-transform duration-150 hover:text-accent active:scale-[0.97]"
              >
                <Share2 className="h-4 w-4" />
                Share
              </button>
            )}
            {canSeal && (
              <button
                onClick={onReportSale}
                className="f0-focus flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium text-soft transition-colors hover:text-ink"
              >
                <Flag className="h-4 w-4" />
                Report a sale
              </button>
            )}
          </div>
        )}
      </div>

      {/* Panel + tabs */}
      <div className="min-w-0">
        <ValuePanel card={card} />
        <AttributesRow card={card} />
        {bundle.chip && <PhysicalArtifactRow chip={bundle.chip} />}
        {card.gift && <GiftProvenanceBlock gift={card.gift} />}

        {/* Tabs */}
        <div className="mt-8">
          <div className="flex items-center gap-1 border-b border-sand">
            <TabButton active={tab === "timeline"} onClick={() => setTab("timeline")}>
              Timeline
            </TabButton>
            <TabButton active={tab === "snapshots"} onClick={() => setTab("snapshots")}>
              Snapshots
            </TabButton>
          </div>

          <div className="pt-5">
            {tab === "timeline" ? (
              <Timeline events={events} />
            ) : (
              <Snapshots card={card} snapshots={snapshots} />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── Value + attributes ─────────────────────────────────────────────── */

function ValuePanel({ card }: { card: OwnershipCard }) {
  const current = card.market?.currentValue ?? card.acquisition.originalValue;
  const gain = card.market?.gain ?? null;
  const gainPct = card.market?.gainPct ?? null;
  const up = (gainPct ?? 0) >= 0;

  return (
    <div className="club-b-card p-5">
      <div className="grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-3">
        <Stat label="Current value" value={formatMoney(current)} big />
        <Stat label="Original value" value={formatMoney(card.acquisition.originalValue)} />
        <Stat
          label="Growth since issue"
          value={gainPct != null ? formatPct(gainPct) : "—"}
          sub={gain != null ? formatDelta(gain) : undefined}
          tone={gainPct == null ? "neutral" : up ? "up" : "down"}
        />
        <Stat label="Owned for" value={formatHeld(card.ownedDays)} />
        <Stat
          label="Cost basis"
          value={`${formatMoney(card.acquisition.averagePrice)} / ${card.assetType === "crypto" ? "unit" : "sh"}`}
        />
        <Stat label="Denomination" value={`${card.denomination} ${card.assetType === "crypto" ? "units" : "shares"}`} />
      </div>
    </div>
  );
}

function Stat({
  label,
  value,
  sub,
  big,
  tone = "neutral",
}: {
  label: string;
  value: string;
  sub?: string;
  big?: boolean;
  tone?: "up" | "down" | "neutral";
}) {
  const color =
    tone === "up" ? "text-price-up" : tone === "down" ? "text-price-down" : "text-ink";
  return (
    <div>
      <div className="font-mono text-[10px] uppercase tracking-[0.14em] text-soft">
        {label}
      </div>
      <div
        className={`mt-1 font-mono font-bold tabular-nums ${big ? "text-2xl" : "text-base"} ${color}`}
      >
        {value}
      </div>
      {sub && <div className={`font-mono text-xs tabular-nums ${color}`}>{sub}</div>}
    </div>
  );
}

function AttributesRow({ card }: { card: OwnershipCard }) {
  const holder = holderName(card.holder);
  const items: [string, string][] = [
    ["Serial", card.serial],
    [
      "Edition",
      card.edition != null
        ? card.editionSize != null
          ? `#${card.edition} / ${card.editionSize}`
          : `#${card.edition}`
        : "Open",
    ],
    ["Series", (card.series || "Digital").toUpperCase()],
    ["Activated", formatDate(card.activatedAt)],
    ["Holder", holder ?? "You"],
    ["Age", tierLabel(card.designState.holdTier)],
    ["Status", statusLabel(card.status)],
    ["Rarity", card.rarity ?? card.designState.rarity ?? "Standard"],
    ["Provenance", card.provider === "snaptrade" ? "Verified" : "Self-reported"],
  ];
  return (
    <div className="mt-4 grid grid-cols-2 gap-x-6 gap-y-3 rounded-2xl border border-sand bg-card p-5 sm:grid-cols-3">
      {items.map(([k, v]) => (
        <div key={k} className="min-w-0">
          <div className="font-mono text-[10px] uppercase tracking-[0.14em] text-soft">
            {k}
          </div>
          <div className="mt-0.5 truncate font-mono text-sm text-ink" title={v}>
            {v}
          </div>
        </div>
      ))}
    </div>
  );
}

/** A bound physical artifact (NFC card / pendant) — shown only when present. */
function PhysicalArtifactRow({ chip }: { chip: ChipSummary }) {
  const ff = formFactorMeta(chip.formFactor);
  const Icon = chip.formFactor === "pendant" ? Gem : CreditCard;
  return (
    <div className="mt-4 flex items-center gap-4 rounded-2xl border border-gold-500/25 bg-gradient-to-b from-gold-400/[0.06] to-transparent p-5">
      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-gold-400/15 text-gold-700">
        <Icon className="h-5 w-5" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5 font-display text-sm font-bold text-ink">
          <ShieldCheck className="h-3.5 w-3.5 text-gold-600" />
          Tap-verified {ff.noun}
        </div>
        <div className="mt-0.5 truncate font-mono text-xs text-soft" title={chip.serial}>
          Physical artifact · {ff.label} · {chip.serial}
        </div>
      </div>
    </div>
  );
}

function statusLabel(s: OwnershipCard["status"]): string {
  switch (s) {
    case "active":
      return "Active";
    case "in_transfer":
      return "In transfer";
    case "seal_broken":
      return "Seal broken";
    case "retired":
      return "Retired";
    case "draft":
      return "Draft";
  }
}

/* ── Timeline ───────────────────────────────────────────────────────── */

const EVENT_META: Record<
  CardEventKind,
  { icon: React.ElementType; tone: string }
> = {
  activated: { icon: Sparkles, tone: "text-gold-600" },
  milestone_age: { icon: CalendarClock, tone: "text-gold-600" },
  milestone_value: { icon: Award, tone: "text-teal-500" },
  dividend: { icon: Coins, tone: "text-teal-500" },
  split: { icon: Split, tone: "text-soft" },
  transfer_in: { icon: ArrowLeftRight, tone: "text-teal-500" },
  transfer_out: { icon: ArrowLeftRight, tone: "text-soft" },
  gifted: { icon: Gift, tone: "text-gold-600" },
  snapshot: { icon: Camera, tone: "text-soft" },
  seal_broken: { icon: ShieldAlert, tone: "text-ink" },
  retired: { icon: ShieldAlert, tone: "text-soft" },
  transfer_declined: { icon: ArrowLeftRight, tone: "text-soft" },
  transfer_cancelled: { icon: ArrowLeftRight, tone: "text-soft" },
  transfer_expired: { icon: CalendarClock, tone: "text-soft" },
  chip_bound: { icon: ShieldCheck, tone: "text-gold-600" },
  chip_revoked: { icon: ShieldAlert, tone: "text-soft" },
};

function eventCopy(e: CardEvent): { title: string; desc?: string } {
  const p = e.payload || {};
  switch (e.kind) {
    case "activated":
      return {
        title: "Card issued",
        desc:
          p.originalValue != null
            ? `Minted at ${formatMoney(Number(p.originalValue))}`
            : "Ownership recorded",
      };
    case "milestone_age":
      return { title: String(p.label ?? "Hold milestone"), desc: "Hold-age tier reached" };
    case "milestone_value":
      return {
        title: `${clubName(p.club)} reached`,
        desc: p.value != null ? `Value crossed ${formatMoney(Number(p.value))}` : undefined,
      };
    case "dividend":
      return {
        title: "Dividend recorded",
        desc: p.amount != null ? `${formatMoney(Number(p.amount))} paid` : undefined,
      };
    case "split":
      return { title: "Stock split", desc: "Denomination unchanged on the card" };
    case "transfer_in":
      return { title: "Received", desc: "Card entered this collection" };
    case "transfer_out":
      return { title: "Transferred out" };
    case "gifted":
      return {
        title: "Gifted",
        desc: p.from
          ? `From ${String(p.from)}`
          : p.to
            ? `To ${String(p.to)}`
            : undefined,
      };
    case "snapshot":
      return { title: String(p.label ?? "Snapshot captured"), desc: "Era preserved" };
    case "seal_broken":
      return {
        title: "Seal broken",
        desc: String(p.reason ?? "A sale was reported"),
      };
    case "retired":
      return { title: "Retired", desc: "Kept as a collectible record" };
    case "transfer_declined":
      return { title: "Gift declined", desc: "Returned to the sender" };
    case "transfer_cancelled":
      return { title: "Gift cancelled", desc: "The transfer was called back" };
    case "transfer_expired":
      return { title: "Gift expired", desc: "The offer window closed" };
    case "chip_bound":
      return {
        title: "Physical artifact bound",
        desc: p.serial
          ? `Tap-verified artifact ${String(p.serial)}`
          : "This card now lives inside a physical artifact",
      };
    case "chip_revoked":
      return { title: "Artifact unbound", desc: "The physical chip was revoked" };
  }
}

function clubName(club: unknown): string {
  if (club === "gain_25") return "+25% Club";
  if (club === "gain_50") return "+50% Club";
  if (club === "gain_100") return "+100% Club";
  return "Value milestone";
}

function Timeline({ events }: { events: CardEvent[] }) {
  if (events.length === 0) {
    return (
      <p className="rounded-xl border border-dashed border-sand p-6 text-center text-sm text-soft">
        The story starts at mint. New milestones, dividends and snapshots will
        appear here as the card lives.
      </p>
    );
  }
  return (
    <ol className="relative ml-2">
      <span className="absolute bottom-2 left-[11px] top-2 w-px bg-sand" aria-hidden />
      {events.map((e, i) => {
        const meta = EVENT_META[e.kind] ?? EVENT_META.snapshot;
        const Icon = meta.icon;
        const { title, desc } = eventCopy(e);
        return (
          <m.li
            key={e.id}
            initial={{ opacity: 0, x: -8 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.35, delay: Math.min(i * 0.04, 0.3) }}
            className="relative flex gap-4 pb-6 last:pb-0"
          >
            <span
              className={`relative z-10 mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-sand bg-card ${meta.tone}`}
            >
              <Icon className="h-3.5 w-3.5" />
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-baseline justify-between gap-x-3">
                <span className="font-display text-sm font-bold text-ink">{title}</span>
                <span className="font-mono text-[11px] text-soft">
                  {formatDate(e.occurredAt)}
                </span>
              </div>
              {desc && <p className="mt-0.5 text-xs text-soft">{desc}</p>}
            </div>
          </m.li>
        );
      })}
    </ol>
  );
}

/* ── Snapshots ──────────────────────────────────────────────────────── */

function Snapshots({
  card,
  snapshots,
}: {
  card: OwnershipCard;
  snapshots: CardSnapshot[];
}) {
  if (snapshots.length === 0) {
    return (
      <p className="rounded-xl border border-dashed border-sand p-6 text-center text-sm text-soft">
        Snapshots capture the card exactly as it looked at each milestone. The
        first is taken at mint — check back as the card evolves.
      </p>
    );
  }
  return (
    <div>
      <p className="mb-4 text-sm text-soft">
        Each snapshot re-renders the card in its own era — the same object,
        earlier in its life.
      </p>
      <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        {snapshots.map((s, i) => (
          <m.li
            key={s.id}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: Math.min(i * 0.05, 0.3) }}
          >
            <LivingCard
              card={card}
              size="shelf"
              era={s.designState}
              eraValue={s.value}
              eraLabel={s.label}
              interactive={false}
            />
            <div className="mt-2 text-center">
              <div className="font-display text-sm font-bold text-ink">{s.label}</div>
              <div className="font-mono text-xs text-soft">
                {formatMoney(s.value)} · {formatDate(s.takenAt)}
              </div>
            </div>
          </m.li>
        ))}
      </ul>
    </div>
  );
}

/* ── Seal dialog ────────────────────────────────────────────────────── */

function SealDialog({
  card,
  onClose,
  onConfirm,
}: {
  card: OwnershipCard;
  onClose: () => void;
  onConfirm: (input: { reason: string; soldAll: boolean }) => Promise<void>;
}) {
  const [soldAll, setSoldAll] = useState(false);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function confirm() {
    setBusy(true);
    setErr(null);
    try {
      await onConfirm({ reason: reason.trim(), soldAll });
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Couldn't record that. Try again.");
      setBusy(false);
    }
  }

  return (
    <m.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="bg-scrim fixed inset-0 z-[100] flex items-end justify-center p-4 backdrop-blur-sm sm:items-center"
      onClick={onClose}
    >
      <m.div
        initial={{ opacity: 0, y: 20, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 20 }}
        transition={{ duration: 0.3, ease: [0.23, 1, 0.32, 1] }}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md rounded-3xl border border-sand bg-card p-6 shadow-[var(--shadow-lift)]"
        role="dialog"
        aria-modal="true"
      >
        <div className="flex items-start justify-between">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-sand text-ink">
            <ShieldAlert className="h-5 w-5" />
          </div>
          <button
            onClick={onClose}
            className="text-soft hover:text-ink"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <h2 className="mt-4 font-display text-xl font-extrabold text-ink">
          Report a sale on {card.assetSymbol}?
        </h2>
        <p className="mt-2 text-sm text-soft">
          Selling breaks this card&apos;s seal. That&apos;s not a punishment —
          it&apos;s the truth of ownership. The card{" "}
          <span className="font-semibold text-ink">stays yours forever</span> as
          a record, but its face is marked{" "}
          <span className="font-semibold text-ink">Seal Broken</span> and its
          provenance will always show the break. The denomination and history
          you earned are kept. This can&apos;t be undone.
        </p>

        <label className="mt-4 flex items-center gap-3 rounded-xl border border-sand p-3">
          <input
            type="checkbox"
            checked={soldAll}
            onChange={(e) => setSoldAll(e.target.checked)}
            className="h-4 w-4 accent-[color:var(--accent-solid)]"
          />
          <span className="text-sm text-ink">I sold my entire position</span>
        </label>

        <textarea
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          rows={2}
          placeholder="Add a note for the record (optional)"
          className="mt-3 w-full resize-none rounded-xl border border-sand bg-paper px-3 py-2.5 text-sm text-ink outline-none focus:border-gold-500"
        />

        {err && (
          // COLOUR LAW: red is PRICE. A failed mutation is not a price, so the
          // failure is carried by weight and the brand rule instead of a tint.
          <p role="alert" className="mt-3 border-l-2 pl-3 text-sm font-semibold text-ink" style={{ borderLeftColor: "var(--accent-solid)" }}>
            {err}
          </p>
        )}

        <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button
            onClick={onClose}
            disabled={busy}
            className="club-b-card f0-press f0-focus px-4 py-2.5 text-sm font-medium text-ink transition-colors hover:text-accent disabled:opacity-50"
          >
            Keep it sealed
          </button>
          <button
            onClick={confirm}
            disabled={busy}
            className="f0-press f0-focus inline-flex items-center justify-center gap-2 rounded-xl bg-ink px-4 py-2.5 font-display text-sm font-bold tracking-[0.02em] text-paper transition-colors disabled:opacity-60"
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Flag className="h-4 w-4" />}
            Break the seal
          </button>
        </div>
      </m.div>
    </m.div>
  );
}

function TabButton({
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
      className={`relative px-4 py-2.5 text-sm font-semibold transition-colors ${
        active ? "text-ink" : "text-soft hover:text-ink"
      }`}
    >
      {children}
      {active && (
        <span className="absolute inset-x-2 -bottom-px h-0.5 rounded-full bg-gold-500" />
      )}
    </button>
  );
}

function TransferPendingPanel({
  pending,
  busy,
  err,
  onCancel,
}: {
  pending: TransferListItem | null;
  busy: boolean;
  err: string | null;
  onCancel: () => void;
}) {
  const to = pending ? senderLabel(pending.counterpart) : "the recipient";
  const expires = pending ? expiresInLabel(pending.transfer.expiresAt) : null;
  return (
    <div className="mx-auto mt-5 max-w-[340px] rounded-2xl border border-gold-500/30 bg-gradient-to-b from-gold-400/[0.06] to-transparent p-4 text-center">
      <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-xl bg-gold-400/15 text-gold-700">
        <Lock className="h-5 w-5" />
      </div>
      <div className="mt-3 font-display text-sm font-extrabold text-ink">
        Locked in transfer{pending?.counterpart ? ` to ${to}` : ""}
      </div>
      <p className="mx-auto mt-1 max-w-[16rem] text-xs text-soft">
        This card is on its way. It&apos;ll land in their collection the moment
        they accept.
        {expires ? ` ${expires}.` : ""}
      </p>
      {err && <p role="alert" className="mt-2 text-xs font-semibold text-ink">{err}</p>}
      <button
        onClick={onCancel}
        disabled={busy}
        className="club-b-card f0-focus mt-3 inline-flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium text-soft transition-transform duration-150 hover:text-ink active:scale-[0.97] disabled:opacity-50"
      >
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <X className="h-4 w-4" />}
        Cancel the gift
      </button>
    </div>
  );
}

function DetailSkeleton() {
  return (
    <div className="mt-5 grid gap-8 lg:grid-cols-[minmax(0,380px),1fr]">
      <div className="flex justify-center">
        <LivingCardSkeleton size="hero" />
      </div>
      <div className="space-y-4">
        <div className="h-32 animate-pulse rounded-2xl bg-sand/70" />
        <div className="h-40 animate-pulse rounded-2xl bg-sand/55" />
        <div className="h-64 animate-pulse rounded-2xl bg-sand/40" />
      </div>
    </div>
  );
}
