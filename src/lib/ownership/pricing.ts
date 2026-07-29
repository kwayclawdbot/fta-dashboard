/**
 * Ownership Cards — EOD pricing (Polygon) with a per-symbol per-day DB cache.
 *
 * Card values in Phase 0 use the previous daily close (POLYGON_API_KEY, the same
 * licensed feed as the rest of the app). Every close is cached in `asset_prices`
 * keyed (symbol, as_of=today) so a collection page load — or a classroom of them —
 * costs at most ONE Polygon call per symbol per calendar day. The nightly cron
 * force-refreshes the same rows.
 *
 * Stocks/ETFs → /v2/aggs/ticker/{SYM}/prev
 * Crypto      → /v2/aggs/ticker/X:{SYM}USD/prev  (e.g. BTC → X:BTCUSD)
 */
import { createAdminClient } from "@/lib/supabase/admin";
import type { AssetType } from "./types";

const BASE = "https://api.polygon.io";

function apiKey(): string | null {
  return process.env.POLYGON_API_KEY?.trim() || null;
}

function todayUTC(): string {
  return new Date().toISOString().slice(0, 10);
}

/** Normalize a user-entered symbol to the canonical uppercase base ticker. */
export function normalizeSymbol(raw: string): string | null {
  if (!raw) return null;
  const s = raw.trim().toUpperCase();
  if (!/^[A-Z]{1,6}(\.[A-Z]{1,2})?$/.test(s)) return null;
  return s;
}

/** Map a base symbol + asset type to the Polygon ticker used for aggregates. */
export function toPolygonTicker(symbol: string, assetType: AssetType): string {
  const s = symbol.trim().toUpperCase();
  return assetType === "crypto" ? `X:${s}USD` : s;
}

export interface EodPrice {
  close: number;
  asOf: string; // ISO date the value was cached under (today, UTC)
}

interface PrevResp {
  results?: { c?: number; t?: number }[];
  resultsCount?: number;
  status?: string;
}

/** Raw previous-close fetch for one Polygon ticker. Null on any failure. */
async function fetchPrevClose(polygonTicker: string): Promise<number | null> {
  const key = apiKey();
  if (!key) return null;
  const url = `${BASE}/v2/aggs/ticker/${encodeURIComponent(
    polygonTicker
  )}/prev?adjusted=true&apiKey=${key}`;
  try {
    const res = await fetch(url, {
      cache: "no-store",
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as PrevResp;
    const c = data.results?.[0]?.c;
    return typeof c === "number" && c > 0 ? c : null;
  } catch {
    return null;
  }
}

type Db = ReturnType<typeof createAdminClient>;

interface Asset {
  symbol: string;
  assetType: AssetType;
}

/**
 * Batch EOD closes for a set of {symbol, assetType}. Cache-first: any row already
 * cached for TODAY is reused; only cache-misses hit Polygon, and successful
 * fetches are upserted back. `forceRefresh` (the cron) bypasses the read cache but
 * still writes fresh values. Returns a map keyed by the base symbol.
 */
export async function getEodCloses(
  assets: Asset[],
  opts: { forceRefresh?: boolean; db?: Db } = {}
): Promise<Record<string, EodPrice>> {
  const db = opts.db ?? createAdminClient();
  const asOf = todayUTC();
  const out: Record<string, EodPrice> = {};

  // Dedupe by symbol (keep first asset type seen).
  const uniq = new Map<string, AssetType>();
  for (const a of assets) {
    const sym = normalizeSymbol(a.symbol);
    if (sym && !uniq.has(sym)) uniq.set(sym, a.assetType);
  }
  if (uniq.size === 0) return out;

  const symbols = Array.from(uniq.keys());

  // 1. Read today's cache in one shot (unless force-refreshing).
  if (!opts.forceRefresh) {
    const { data } = await db
      .from("asset_prices")
      .select("symbol, close")
      .eq("as_of", asOf)
      .in("symbol", symbols);
    for (const r of (data || []) as { symbol: string; close: number | string }[]) {
      const close = typeof r.close === "number" ? r.close : Number(r.close);
      if (close > 0) out[r.symbol] = { close, asOf };
    }
  }

  // 2. Fetch every miss from Polygon, then upsert.
  const misses = symbols.filter((s) => !out[s]);
  const upserts: {
    symbol: string;
    as_of: string;
    close: number;
    asset_type: AssetType;
    source: string;
    updated_at: string;
  }[] = [];

  await Promise.all(
    misses.map(async (sym) => {
      const type = uniq.get(sym)!;
      const close = await fetchPrevClose(toPolygonTicker(sym, type));
      if (close != null) {
        out[sym] = { close, asOf };
        upserts.push({
          symbol: sym,
          as_of: asOf,
          close,
          asset_type: type,
          source: "polygon",
          updated_at: new Date().toISOString(),
        });
      }
    })
  );

  if (upserts.length) {
    await db.from("asset_prices").upsert(upserts, { onConflict: "symbol,as_of" });
  }

  return out;
}

/** Single-symbol convenience wrapper over getEodCloses. */
export async function getEodClose(
  symbol: string,
  assetType: AssetType,
  opts: { forceRefresh?: boolean; db?: Db } = {}
): Promise<EodPrice | null> {
  const sym = normalizeSymbol(symbol);
  if (!sym) return null;
  const map = await getEodCloses([{ symbol: sym, assetType }], opts);
  return map[sym] ?? null;
}

// ── Live crypto spot (24/7) — for physical-tap value on pendants/cards ───────
// Bitcoin has no market hours: a pendant tapped at 3am must still show a LIVE
// value. Stocks keep EOD (getEodClose) — markets are closed most of the day and
// the licensed feed's intraday tier isn't assumed here. Live spot is cached in
// memory for <=60s so a burst of taps (or a shared scan link going around a family
// group) costs at most one Polygon call per symbol per minute per instance.

interface LiveSpot {
  price: number;
  asOf: string; // ISO timestamp of the fetch
}

const LIVE_TTL_MS = 60_000;
const liveSpotCache = new Map<string, { spot: LiveSpot; at: number }>();

interface LastCryptoResp {
  last?: { price?: number; timestamp?: number };
  status?: string;
}

/**
 * Live crypto spot via Polygon's last-trade endpoint
 * (/v1/last/crypto/{from}/{to}). Falls back to the previous daily close if the
 * live tick is unavailable, so a tap always renders *some* value. Null only if
 * both paths fail. Memory-cached for <=60s per base symbol.
 */
export async function getLiveCryptoSpot(
  symbol: string,
  opts: { db?: Db } = {}
): Promise<LiveSpot | null> {
  const sym = normalizeSymbol(symbol);
  if (!sym) return null;

  const cached = liveSpotCache.get(sym);
  if (cached && Date.now() - cached.at < LIVE_TTL_MS) return cached.spot;

  const key = apiKey();
  if (key) {
    try {
      const url = `${BASE}/v1/last/crypto/${encodeURIComponent(
        sym
      )}/USD?apiKey=${key}`;
      const res = await fetch(url, {
        cache: "no-store",
        signal: AbortSignal.timeout(6000),
      });
      if (res.ok) {
        const data = (await res.json()) as LastCryptoResp;
        const p = data.last?.price;
        if (typeof p === "number" && p > 0) {
          const spot: LiveSpot = { price: p, asOf: new Date().toISOString() };
          liveSpotCache.set(sym, { spot, at: Date.now() });
          return spot;
        }
      }
    } catch {
      // fall through to EOD
    }
  }

  // Fallback: previous close (still fresh enough to render a value).
  const eod = await getEodClose(sym, "crypto", opts);
  if (eod) {
    const spot: LiveSpot = { price: eod.close, asOf: new Date().toISOString() };
    liveSpotCache.set(sym, { spot, at: Date.now() });
    return spot;
  }
  return null;
}

/**
 * Resolve the price to render on a card: crypto uses the LIVE 24/7 spot, stocks/
 * ETFs keep the day-cached EOD close. Returns { price, asOf } or null.
 */
export async function getCardPrice(
  symbol: string,
  assetType: AssetType,
  opts: { db?: Db } = {}
): Promise<{ price: number; asOf: string } | null> {
  if (assetType === "crypto") {
    const spot = await getLiveCryptoSpot(symbol, opts);
    return spot ? { price: spot.price, asOf: spot.asOf } : null;
  }
  const eod = await getEodClose(symbol, assetType, opts);
  return eod ? { price: eod.close, asOf: new Date().toISOString() } : null;
}

interface TickerDetailsResp {
  results?: { name?: string; type?: string; active?: boolean };
  status?: string;
}

/**
 * Validate a symbol exists on the licensed feed and resolve its display name.
 * Stocks/ETFs go through the reference-tickers endpoint; crypto is validated by
 * a successful previous-close (Polygon has no per-pair reference name we need).
 */
export async function validateSymbol(
  symbol: string,
  assetType: AssetType
): Promise<{ valid: boolean; name: string | null }> {
  const sym = normalizeSymbol(symbol);
  if (!sym) return { valid: false, name: null };
  const key = apiKey();
  if (!key) return { valid: false, name: null };

  if (assetType === "crypto") {
    const close = await fetchPrevClose(toPolygonTicker(sym, "crypto"));
    return { valid: close != null, name: close != null ? `${sym} / USD` : null };
  }

  try {
    const res = await fetch(
      `${BASE}/v3/reference/tickers/${sym}?apiKey=${key}`,
      { cache: "no-store", signal: AbortSignal.timeout(8000) }
    );
    if (!res.ok) return { valid: false, name: null };
    const data = (await res.json()) as TickerDetailsResp;
    if (!data.results || data.results.active === false) {
      return { valid: false, name: null };
    }
    return { valid: true, name: data.results.name ?? null };
  } catch {
    return { valid: false, name: null };
  }
}
