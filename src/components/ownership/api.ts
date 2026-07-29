/**
 * Thin fetch layer for the Ownership Cards API.
 *
 * The API routes (`/api/ownership/*`) are built by a parallel backend lane and
 * may not exist yet. Every call is defensive: it times out, tolerates a few
 * plausible response envelopes, and surfaces a typed { ok, data|error } result
 * so the UI can always render a graceful state. Shapes follow
 * `@/lib/ownership/types.ts` (the shared contract).
 */

import type {
  AssetType,
  OwnershipCard,
  CardEvent,
  CardSnapshot,
  CardTransfer,
  TransferInbox,
  TransferListItem,
} from "@/lib/ownership/types";
import type { CardDetailBundle } from "./demo";
import type { ClaimInput } from "./scan";
import type { TapResult, ChipSummary } from "@/lib/ownership/types";

/**
 * Ownership Score view shapes. The score is a UI-facing API response the
 * backend contract doesn't model in types.ts, so it lives here.
 */
export interface ScoreComponent {
  key: string;
  label: string;
  points: number;
  detail?: string;
}
export interface OwnershipScore {
  total: number;
  breakdown: ScoreComponent[];
}

export type ApiResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string; fieldErrors?: Record<string, string>; status?: number };

const TIMEOUT_MS = 8000;

async function req<T>(
  path: string,
  init: RequestInit,
  pick: (json: unknown) => T
): Promise<ApiResult<T>> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(path, {
      ...init,
      signal: ctrl.signal,
      headers: { "Content-Type": "application/json", ...(init.headers || {}) },
    });
    let json: unknown = null;
    try {
      json = await res.json();
    } catch {
      /* non-JSON body */
    }
    if (!res.ok) {
      const rec = asRecord(json);
      return {
        ok: false,
        status: res.status,
        error:
          (typeof rec.error === "string" && rec.error) ||
          (typeof rec.message === "string" && rec.message) ||
          `Request failed (${res.status})`,
        fieldErrors: normalizeFieldErrors(rec.errors ?? rec.fieldErrors),
      };
    }
    return { ok: true, data: pick(json) };
  } catch (e) {
    const aborted = e instanceof DOMException && e.name === "AbortError";
    return {
      ok: false,
      error: aborted
        ? "This took too long to load. Check your connection and try again."
        : "We couldn't reach the collection service.",
    };
  } finally {
    clearTimeout(timer);
  }
}

function asRecord(v: unknown): Record<string, unknown> {
  return v && typeof v === "object" ? (v as Record<string, unknown>) : {};
}

function normalizeFieldErrors(v: unknown): Record<string, string> | undefined {
  if (!v || typeof v !== "object") return undefined;
  const out: Record<string, string> = {};
  for (const [k, val] of Object.entries(v as Record<string, unknown>)) {
    out[k] = Array.isArray(val) ? String(val[0]) : String(val);
  }
  return Object.keys(out).length ? out : undefined;
}

/** Unwrap { cards } | { data } | [] into an array. */
function pickCards(json: unknown): OwnershipCard[] {
  const rec = asRecord(json);
  const arr =
    (Array.isArray(json) && json) ||
    (Array.isArray(rec.cards) && rec.cards) ||
    (Array.isArray(rec.data) && rec.data) ||
    [];
  return arr as OwnershipCard[];
}

/** Unwrap a { card, events, snapshots } bundle from a few envelopes. */
function pickDetail(json: unknown): CardDetailBundle {
  const rec = asRecord(json);
  const inner = asRecord(rec.data);
  const card = (rec.card ?? inner.card) as OwnershipCard;
  const events = (rec.events ?? inner.events ?? []) as CardEvent[];
  const snapshots = (rec.snapshots ?? inner.snapshots ?? []) as CardSnapshot[];
  const transfer = (rec.transfer ?? inner.transfer) as
    | TransferListItem
    | undefined;
  const chip = (rec.chip ?? inner.chip ?? null) as CardDetailBundle["chip"];
  return { card, events, snapshots, transfer, chip };
}

function pickCard(json: unknown): OwnershipCard {
  const rec = asRecord(json);
  return (rec.card ?? rec.data ?? json) as OwnershipCard;
}

/* ── Public API ────────────────────────────────────────────────────── */

export function getCollection(): Promise<ApiResult<OwnershipCard[]>> {
  return req("/api/ownership/collection", { method: "GET" }, pickCards);
}

export function getCard(id: string): Promise<ApiResult<CardDetailBundle>> {
  return req(
    `/api/ownership/card/${encodeURIComponent(id)}`,
    { method: "GET" },
    pickDetail
  );
}

export interface MintInput {
  symbol: string;
  assetType: AssetType;
  quantity: number;
  averagePrice: number;
  acquiredAt: string; // ISO or yyyy-mm-dd
}

export function mintCard(input: MintInput): Promise<ApiResult<OwnershipCard>> {
  return req(
    "/api/ownership/mint",
    { method: "POST", body: JSON.stringify(input) },
    pickCard
  );
}

export interface SealInput {
  reason?: string;
  quantitySold?: number | null;
  soldAll?: boolean;
}

export function sealCard(
  id: string,
  input: SealInput
): Promise<ApiResult<OwnershipCard>> {
  return req(
    `/api/ownership/card/${encodeURIComponent(id)}/seal`,
    { method: "POST", body: JSON.stringify(input) },
    pickCard
  );
}

/* ── Transfers / gifting (Phase 1) ─────────────────────────────────── */

/** Unwrap { incoming, outgoing } (TransferListItem[]) from a few envelopes. */
function pickInbox(json: unknown): TransferInbox {
  const rec = asRecord(json);
  const inner = asRecord(rec.data);
  const incoming = (rec.incoming ?? inner.incoming ?? []) as TransferInbox["incoming"];
  const outgoing = (rec.outgoing ?? inner.outgoing ?? []) as TransferInbox["outgoing"];
  return {
    incoming: Array.isArray(incoming) ? incoming : [],
    outgoing: Array.isArray(outgoing) ? outgoing : [],
  };
}

function pickTransfer(json: unknown): CardTransfer {
  const rec = asRecord(json);
  return (rec.transfer ?? rec.data ?? json) as CardTransfer;
}

function pickScore(json: unknown): OwnershipScore {
  const rec = asRecord(json);
  const inner = asRecord(rec.data);
  const total = Number(rec.total ?? inner.total ?? 0) || 0;
  const breakdown = (rec.breakdown ?? inner.breakdown ?? []) as OwnershipScore["breakdown"];
  return { total, breakdown: Array.isArray(breakdown) ? breakdown : [] };
}

/** Incoming pending + outgoing transfers, each with a card summary. */
export function getTransfers(): Promise<ApiResult<TransferInbox>> {
  return req("/api/ownership/transfers", { method: "GET" }, pickInbox);
}

export interface TransferInput {
  cardId: string;
  /** Username or email of the recipient. */
  recipient: string;
  message?: string;
}

/** Sender initiates a gift → card enters IN_TRANSFER. */
export function createTransfer(
  input: TransferInput
): Promise<ApiResult<CardTransfer>> {
  return req(
    "/api/ownership/transfer",
    { method: "POST", body: JSON.stringify(input) },
    pickTransfer
  );
}

function transferAction(
  id: string,
  action: "accept" | "decline" | "cancel"
): Promise<ApiResult<CardTransfer>> {
  return req(
    `/api/ownership/transfer/${encodeURIComponent(id)}/${action}`,
    { method: "POST", body: "{}" },
    pickTransfer
  );
}

/** Recipient accepts — the card lands in their shelf. */
export function acceptTransfer(id: string) {
  return transferAction(id, "accept");
}

/** Recipient declines — the card reverts to the sender. */
export function declineTransfer(id: string) {
  return transferAction(id, "decline");
}

/** Sender cancels a still-pending gift. */
export function cancelTransfer(id: string) {
  return transferAction(id, "cancel");
}

/** Ownership Score — total + labeled breakdown. Never return-ranked. */
export function getScore(): Promise<ApiResult<OwnershipScore>> {
  return req("/api/ownership/score", { method: "GET" }, pickScore);
}

/* ── Physical / NFC (Phase 2) ──────────────────────────────────────── */

function pickTapResult(json: unknown): TapResult {
  const rec = asRecord(json);
  const inner = asRecord(rec.data);
  const src = Object.keys(inner).length ? inner : rec;
  return {
    tapVerified: Boolean(src.tapVerified),
    claimable: Boolean(src.claimable),
    reason: (typeof src.reason === "string" ? src.reason : "no_tap") as TapResult["reason"],
    chip: (src.chip as ChipSummary | null) ?? null,
    card: (src.card as TapResult["card"]) ?? null,
  };
}

/** Client-side tap read (the scan page resolves server-side; this backs the
 *  claim flow's re-check after sign-in). */
export function getTap(
  serial: string,
  params: { picc?: string; cmac?: string } = {}
): Promise<ApiResult<TapResult>> {
  const q = new URLSearchParams();
  if (params.picc) q.set("picc", params.picc);
  if (params.cmac) q.set("cmac", params.cmac);
  const qs = q.toString();
  return req(
    `/api/ownership/tap/${encodeURIComponent(serial)}${qs ? `?${qs}` : ""}`,
    { method: "GET" },
    pickTapResult
  );
}

/** Bind an unclaimed chip to a digital card — the permanent marriage. */
export function claimChip(input: ClaimInput): Promise<ApiResult<OwnershipCard>> {
  return req(
    "/api/ownership/claim",
    { method: "POST", body: JSON.stringify(input) },
    pickCard
  );
}
