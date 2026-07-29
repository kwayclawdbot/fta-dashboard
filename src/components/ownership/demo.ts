/**
 * Standalone demo data — lets the whole Ownership UI be reviewed before the
 * backend API routes exist. Activated with `?demo=1` on the collection and
 * detail pages. Four cards spanning every visual state:
 *   NVDA  10 @ $142  — legacy tier + all three value clubs (verified)
 *   AAPL   5 @ $178  — 1-year holder + the +25% club (self-reported)
 *   VOO   10 @ $498  — freshly issued (self-reported)
 *   BTC 0.01 @ $61k  — seal broken (self-reported)
 */

import type {
  OwnershipCard,
  CardEvent,
  CardSnapshot,
  CardDesignState,
  ChipSummary,
  PublicCardView,
  TransferInbox,
  TransferListItem,
  TransferCardSummary,
} from "@/lib/ownership/types";
import type { OwnershipScore } from "./api";
import type { ScanState } from "./scan";

export interface CardDetailBundle {
  card: OwnershipCard;
  events: CardEvent[];
  snapshots: CardSnapshot[];
  /** Present when the card is IN_TRANSFER — the outgoing gift in flight. */
  transfer?: TransferListItem;
  /** Public-safe descriptor of a bound physical artifact, when one exists. */
  chip?: ChipSummary | null;
}

function daysAgo(n: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - n);
  return d.toISOString();
}

function ds(over: Partial<CardDesignState>): CardDesignState {
  return {
    holdTier: "issued",
    valueClubs: [],
    series: "S01",
    rarity: null,
    designRev: 1,
    ...over,
  };
}

export function demoCards(): OwnershipCard[] {
  const NVDA: OwnershipCard = {
    id: "demo-nvda",
    serial: "CC-S01-000184",
    ownerId: "demo",
    assetSymbol: "NVDA",
    assetName: "NVIDIA Corp.",
    assetType: "stock",
    denomination: 10,
    series: "S01",
    edition: 184,
    editionSize: 500,
    rarity: "Legendary",
    status: "active",
    acquisition: {
      quantity: 10,
      averagePrice: 142,
      originalValue: 1420,
      acquiredAt: daysAgo(1240),
    },
    provider: "snaptrade",
    activatedAt: daysAgo(1240),
    market: {
      price: 194.26,
      currentValue: 1942.6,
      gain: 522.6,
      gainPct: 36.8,
      asOf: daysAgo(0),
    },
    designState: ds({
      holdTier: "legacy",
      valueClubs: ["gain_25", "gain_50", "gain_100"],
      rarity: "Legendary",
    }),
    holder: { firstName: "Kai", lastInitial: "R" },
    ownedDays: 1240,
  };

  const AAPL: OwnershipCard = {
    id: "demo-aapl",
    serial: "CC-S01-000512",
    ownerId: "demo",
    assetSymbol: "AAPL",
    assetName: "Apple Inc.",
    assetType: "stock",
    denomination: 5,
    series: "S01",
    edition: 512,
    editionSize: null,
    rarity: null,
    status: "active",
    acquisition: {
      quantity: 5,
      averagePrice: 178,
      originalValue: 890,
      acquiredAt: daysAgo(560),
    },
    provider: "manual",
    activatedAt: daysAgo(560),
    market: {
      price: 228,
      currentValue: 1140,
      gain: 250,
      gainPct: 28.1,
      asOf: daysAgo(0),
    },
    designState: ds({ holdTier: "year_1", valueClubs: ["gain_25"] }),
    holder: { firstName: "Ava", lastInitial: "M" },
    ownedDays: 560,
  };

  const VOO: OwnershipCard = {
    id: "demo-voo",
    serial: "CC-S01-000933",
    ownerId: "demo",
    assetSymbol: "VOO",
    assetName: "Vanguard S&P 500 ETF",
    assetType: "etf",
    denomination: 10,
    series: "S01",
    edition: 933,
    editionSize: null,
    rarity: null,
    status: "active",
    acquisition: {
      quantity: 10,
      averagePrice: 498,
      originalValue: 4980,
      acquiredAt: daysAgo(12),
    },
    provider: "manual",
    activatedAt: daysAgo(12),
    market: {
      price: 508.4,
      currentValue: 5084,
      gain: 104,
      gainPct: 2.1,
      asOf: daysAgo(0),
    },
    designState: ds({ holdTier: "issued", valueClubs: [] }),
    holder: { firstName: "Sam", lastInitial: "K" },
    ownedDays: 12,
  };

  const BTC: OwnershipCard = {
    id: "demo-btc",
    serial: "CC-S01-001077",
    ownerId: "demo",
    assetSymbol: "BTC",
    assetName: "Bitcoin",
    assetType: "crypto",
    denomination: 0.01,
    series: "S01",
    edition: 1077,
    editionSize: null,
    rarity: null,
    status: "seal_broken",
    acquisition: {
      quantity: 0.01,
      averagePrice: 61000,
      originalValue: 610,
      acquiredAt: daysAgo(150),
    },
    provider: "manual",
    activatedAt: daysAgo(150),
    market: {
      price: 64200,
      currentValue: 642,
      gain: 32,
      gainPct: 5.2,
      asOf: daysAgo(0),
    },
    designState: ds({ holdTier: "days_100", valueClubs: [] }),
    holder: { firstName: "Jordan", lastInitial: "T" },
    ownedDays: 150,
  };

  // The heirloom — a card received as a gift, provenance carried forever.
  const HEIRLOOM: OwnershipCard = {
    id: "demo-heirloom",
    serial: "CC-S01-000206",
    ownerId: "demo",
    assetSymbol: "MSFT",
    assetName: "Microsoft Corp.",
    assetType: "stock",
    denomination: 3,
    series: "S01",
    edition: 206,
    editionSize: 500,
    rarity: null,
    status: "active",
    acquisition: {
      quantity: 3,
      averagePrice: 380,
      originalValue: 1140,
      acquiredAt: daysAgo(430),
    },
    provider: "snaptrade",
    activatedAt: daysAgo(430),
    market: {
      price: 452,
      currentValue: 1356,
      gain: 216,
      gainPct: 18.9,
      asOf: daysAgo(0),
    },
    designState: ds({ holdTier: "year_1", valueClubs: [] }),
    holder: { firstName: "Ava", lastInitial: "M" },
    ownedDays: 430,
    gift: {
      fromDisplayName: "Dad",
      message:
        "Your first stock, kiddo. Don't watch the price — watch the years. Proud of you. — Dad",
      giftedAt: daysAgo(430),
      originalValueAtGift: 1140,
      verification: "verified",
    },
  };

  // A card the owner is currently gifting OUT — locked in transfer.
  const SENDING: OwnershipCard = {
    id: "demo-sending",
    serial: "CC-S01-000771",
    ownerId: "demo",
    assetSymbol: "TSLA",
    assetName: "Tesla, Inc.",
    assetType: "stock",
    denomination: 2,
    series: "S01",
    edition: 771,
    editionSize: null,
    rarity: null,
    status: "in_transfer",
    acquisition: {
      quantity: 2,
      averagePrice: 210,
      originalValue: 420,
      acquiredAt: daysAgo(220),
    },
    provider: "manual",
    activatedAt: daysAgo(220),
    market: {
      price: 331,
      currentValue: 662,
      gain: 242,
      gainPct: 57.6,
      asOf: daysAgo(0),
    },
    designState: ds({ holdTier: "year_1", valueClubs: ["gain_25", "gain_50"] }),
    holder: { firstName: "Sam", lastInitial: "K" },
    ownedDays: 220,
  };

  return [NVDA, HEIRLOOM, AAPL, SENDING, VOO, BTC];
}

/** The compact card summary carried by the incoming demo gift (AAPL, 1 share). */
function incomingGiftSummary(): TransferCardSummary {
  return {
    id: "demo-incoming-aapl",
    serial: "CC-S01-001240",
    assetSymbol: "AAPL",
    assetName: "Apple Inc.",
    denomination: 1,
    status: "in_transfer",
    designState: ds({ holdTier: "year_1", valueClubs: [] }),
  };
}

/** Summary of the card the demo owner is gifting out (TSLA, 2 shares). */
function sendingSummary(): TransferCardSummary {
  const c = demoCards().find((x) => x.id === "demo-sending")!;
  return {
    id: c.id,
    serial: c.serial,
    assetSymbol: c.assetSymbol,
    assetName: c.assetName,
    denomination: c.denomination,
    status: "in_transfer",
    designState: c.designState,
  };
}

/** Hours-from-now ISO (for transfer expiry). */
function hoursFromNow(h: number): string {
  const d = new Date();
  d.setUTCHours(d.getUTCHours() + h);
  return d.toISOString();
}

/** Demo inbox — one incoming pending gift, one outgoing pending. */
export function demoTransfers(): TransferInbox {
  const incoming: TransferListItem = {
    transfer: {
      id: "demo-tr-in",
      cardId: "demo-incoming-aapl",
      fromUser: "demo-dad",
      toUser: "demo",
      status: "pending",
      message:
        "Happy birthday. Your very first share — this is where it starts. Love, Dad.",
      createdAt: daysAgo(1),
      expiresAt: hoursFromNow(70),
      resolvedAt: null,
    },
    card: incomingGiftSummary(),
    counterpart: { displayName: "Dad", username: "dad" },
  };

  const outgoing: TransferListItem = {
    transfer: {
      id: "demo-tr-out",
      cardId: "demo-sending",
      fromUser: "demo",
      toUser: "demo-sam",
      status: "pending",
      message: "For your graduation. Start your own collection. — proud of you.",
      createdAt: daysAgo(0),
      expiresAt: hoursFromNow(166),
      resolvedAt: null,
    },
    card: sendingSummary(),
    counterpart: { displayName: "Sam K.", username: "sam" },
  };

  return { incoming: [incoming], outgoing: [outgoing] };
}

/** Hardcoded Ownership Score for demo review. Never return-based. */
export function demoScore(): OwnershipScore {
  return {
    total: 742,
    breakdown: [
      {
        key: "cards",
        label: "Unique cards",
        points: 120,
        detail: "6 living cards minted",
      },
      {
        key: "hold_age",
        label: "Weighted hold-age",
        points: 305,
        detail: "Longer holds count for more — patience compounds",
      },
      {
        key: "diversification",
        label: "Diversification",
        points: 95,
        detail: "5 distinct assets held",
      },
      {
        key: "gifting",
        label: "Gifting",
        points: 140,
        detail: "1 card gifted, 1 received — legacy in motion",
      },
      {
        key: "learning",
        label: "Learning",
        points: 82,
        detail: "11 Cheat Code lessons completed",
      },
    ],
  };
}

/* ── Public scan demo states (Phase 2) ─────────────────────────────────
   Three serials the /c/[serial] page recognizes with ?demo=1:
     demo-pendant → tap-verified Bitcoin pendant, live value
     demo-card    → unverified link view, stock card
     demo-claim   → an unclaimed chip, ready for the binding ceremony */

function pv(over: Partial<PublicCardView>): PublicCardView {
  return {
    serial: "CC-S02-000001",
    assetSymbol: "BTC",
    assetName: "Bitcoin",
    denomination: 0.001,
    series: "S02",
    edition: null,
    editionSize: null,
    status: "active",
    currentValue: null,
    gainPctSinceIssue: null,
    ownedSinceYear: new Date().getUTCFullYear() - 1,
    designState: ds({ series: "S02" }),
    holder: null,
    ...over,
  };
}

export function demoScan(serial: string): ScanState {
  if (serial === "demo-card") {
    return {
      serial: "CC-S01-000184",
      status: "ok",
      tapVerified: false,
      claimable: false,
      chip: null,
      reason: "link_view",
      assetType: "stock",
      demo: true,
      card: pv({
        serial: "CC-S01-000184",
        assetSymbol: "NVDA",
        assetName: "NVIDIA Corp.",
        denomination: 10,
        series: "S01",
        edition: 184,
        editionSize: 500,
        currentValue: 1942.6,
        gainPctSinceIssue: 36.8,
        ownedSinceYear: new Date().getUTCFullYear() - 3,
        designState: ds({
          holdTier: "legacy",
          valueClubs: ["gain_25", "gain_50", "gain_100"],
          rarity: "Legendary",
        }),
        holder: { firstName: "Kai", lastInitial: "R" },
      }),
    };
  }

  if (serial === "demo-claim") {
    return {
      serial: "CC-P01-000777",
      status: "ok",
      tapVerified: true,
      claimable: true,
      reason: "verified",
      assetType: "crypto",
      chip: { serial: "CC-P01-000777", formFactor: "pendant", status: "provisioned" },
      card: null,
      demo: true,
    };
  }

  // demo-pendant (default): tap-verified Bitcoin pendant, live value.
  return {
    serial: "CC-S02-000042",
    status: "ok",
    tapVerified: true,
    claimable: false,
    reason: "verified",
    assetType: "crypto",
    chip: { serial: "CC-P01-000042", formFactor: "pendant", status: "claimed" },
    demo: true,
    card: pv({
      serial: "CC-S02-000042",
      assetSymbol: "BTC",
      assetName: "Bitcoin",
      denomination: 0.001,
      series: "S02",
      edition: 42,
      editionSize: 250,
      status: "active",
      currentValue: 68.42,
      gainPctSinceIssue: 12.4,
      ownedSinceYear: new Date().getUTCFullYear() - 1,
      designState: ds({ holdTier: "days_100", series: "S02", rarity: "Founder" }),
      holder: { firstName: "Ada", lastInitial: "M" },
    }),
  };
}

export function demoCardById(id: string): CardDetailBundle | null {
  const card = demoCards().find((c) => c.id === id);
  if (!card) return null;
  const bundle: CardDetailBundle = {
    card,
    events: demoEvents(card),
    snapshots: demoSnapshots(card),
  };
  // The NVDA demo card carries a bound physical artifact so the "tap-verified
  // artifact" row on the detail page is reviewable at /collection/demo-nvda?demo=1.
  if (card.id === "demo-nvda") {
    bundle.chip = { serial: "CC-P01-000007", formFactor: "card", status: "claimed" };
  }
  if (card.status === "in_transfer") {
    bundle.transfer = demoTransfers().outgoing.find(
      (t) => t.transfer.cardId === id
    );
  }
  return bundle;
}

function ev(
  cardId: string,
  kind: CardEvent["kind"],
  payload: Record<string, unknown>,
  daysBack: number,
  id: number
): CardEvent {
  return { id, cardId, kind, payload, occurredAt: daysAgo(daysBack) };
}

function demoEvents(card: OwnershipCard): CardEvent[] {
  const id = card.id;
  if (id === "demo-nvda") {
    return [
      ev(id, "activated", { originalValue: 1420, price: 142 }, 1240, 1),
      ev(id, "milestone_age", { tier: "days_100", label: "100 Days Held" }, 1140, 2),
      ev(id, "milestone_value", { club: "gain_25", value: 1775 }, 980, 3),
      ev(id, "dividend", { amount: 0.4, perShare: 0.04 }, 900, 4),
      ev(id, "milestone_age", { tier: "year_1", label: "1 Year Holder" }, 875, 5),
      ev(id, "milestone_value", { club: "gain_50", value: 2130 }, 700, 6),
      ev(id, "milestone_value", { club: "gain_100", value: 2900 }, 420, 7),
      ev(id, "milestone_age", { tier: "days_1000", label: "1000 Days Held" }, 240, 8),
      ev(id, "snapshot", { label: "Legacy Holder" }, 200, 9),
      ev(id, "dividend", { amount: 0.44, perShare: 0.044 }, 90, 10),
    ].reverse();
  }
  if (id === "demo-aapl") {
    return [
      ev(id, "activated", { originalValue: 890, price: 178 }, 560, 1),
      ev(id, "milestone_age", { tier: "days_100", label: "100 Days Held" }, 460, 2),
      ev(id, "dividend", { amount: 1.2, perShare: 0.24 }, 300, 3),
      ev(id, "milestone_age", { tier: "year_1", label: "1 Year Holder" }, 195, 4),
      ev(id, "milestone_value", { club: "gain_25", value: 1112 }, 60, 5),
    ].reverse();
  }
  if (id === "demo-voo") {
    return [ev(id, "activated", { originalValue: 4980, price: 498 }, 12, 1)];
  }
  if (id === "demo-heirloom") {
    return [
      ev(id, "activated", { originalValue: 1140, price: 380 }, 430, 1),
      ev(
        id,
        "gifted",
        { from: "Dad", to: "Ava", originalValue: 1140, direction: "in" },
        430,
        2
      ),
      ev(id, "milestone_age", { tier: "days_100", label: "100 Days Held" }, 330, 3),
      ev(id, "dividend", { amount: 2.25, perShare: 0.75 }, 200, 4),
      ev(id, "milestone_age", { tier: "year_1", label: "1 Year Holder" }, 65, 5),
    ].reverse();
  }
  if (id === "demo-sending") {
    return [
      ev(id, "activated", { originalValue: 420, price: 210 }, 220, 1),
      ev(id, "milestone_age", { tier: "days_100", label: "100 Days Held" }, 120, 2),
      ev(id, "milestone_value", { club: "gain_25", value: 525 }, 90, 3),
      ev(id, "milestone_value", { club: "gain_50", value: 630 }, 20, 4),
      ev(id, "transfer_out", { to: "Sam K.", pending: true }, 0, 5),
    ].reverse();
  }
  // BTC — seal broken story
  return [
    ev(id, "activated", { originalValue: 610, price: 61000 }, 150, 1),
    ev(id, "milestone_age", { tier: "days_100", label: "100 Days Held" }, 50, 2),
    ev(id, "seal_broken", { reason: "Reported a partial sale", quantitySold: 0.01 }, 6, 3),
  ].reverse();
}

function snap(
  cardId: string,
  label: string,
  value: number,
  design: CardDesignState,
  daysBack: number,
  id: number
): CardSnapshot {
  return { id, cardId, label, value, designState: design, takenAt: daysAgo(daysBack) };
}

function demoSnapshots(card: OwnershipCard): CardSnapshot[] {
  const id = card.id;
  if (id === "demo-nvda") {
    return [
      snap(id, "At Issue", 1420, ds({ holdTier: "issued" }), 1240, 1),
      snap(id, "100 Days", 1560, ds({ holdTier: "days_100" }), 1140, 2),
      snap(id, "Year 1", 1775, ds({ holdTier: "year_1", valueClubs: ["gain_25"] }), 875, 3),
      snap(
        id,
        "Peak · 1000 Days",
        2900,
        ds({ holdTier: "days_1000", valueClubs: ["gain_25", "gain_50", "gain_100"] }),
        240,
        4
      ),
      snap(
        id,
        "Today",
        1942.6,
        ds({ holdTier: "legacy", valueClubs: ["gain_25", "gain_50", "gain_100"], rarity: "Legendary" }),
        0,
        5
      ),
    ];
  }
  if (id === "demo-aapl") {
    return [
      snap(id, "At Issue", 890, ds({ holdTier: "issued" }), 560, 1),
      snap(id, "Year 1", 1035, ds({ holdTier: "year_1" }), 195, 2),
      snap(id, "Today", 1140, ds({ holdTier: "year_1", valueClubs: ["gain_25"] }), 0, 3),
    ];
  }
  if (id === "demo-voo") {
    return [snap(id, "At Issue", 4980, ds({ holdTier: "issued" }), 12, 1)];
  }
  if (id === "demo-heirloom") {
    return [
      snap(id, "Gifted", 1140, ds({ holdTier: "issued" }), 430, 1),
      snap(id, "Year 1", 1290, ds({ holdTier: "year_1" }), 65, 2),
      snap(id, "Today", 1356, ds({ holdTier: "year_1" }), 0, 3),
    ];
  }
  if (id === "demo-sending") {
    return [
      snap(id, "At Issue", 420, ds({ holdTier: "issued" }), 220, 1),
      snap(
        id,
        "Today",
        662,
        ds({ holdTier: "year_1", valueClubs: ["gain_25", "gain_50"] }),
        0,
        2
      ),
    ];
  }
  return [
    snap(id, "At Issue", 610, ds({ holdTier: "issued" }), 150, 1),
    snap(id, "Seal Broken", 642, ds({ holdTier: "days_100" }), 6, 2),
  ];
}
