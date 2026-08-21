"use client";

/**
 * ClubHome v2 — typed client for the /api/club/* contract. The UI renders
 * against the contract; where an endpoint responds it wires the real data,
 * where it 404s / errors it returns null and the section falls back to a
 * founding-era state (never a fabricated number).
 *
 * There is no fixture path any more. The `?fixtures=1` design-review harness
 * and its data are deleted — every number this client hands a surface came off
 * a real read or is absent.
 */

import { useEffect, useRef, useState } from "react";
import type { ClubData, ClubEndpoint } from "./contract";

/**
 * THE SECTIONS HOME ACTUALLY RENDERS.
 *
 * This list drives the whole fallback path: which keys are read out of the
 * batch/seed envelope, and which endpoints get an individual re-fetch when a
 * section is flagged in `_errors`. It used to name all nine /api/club/* routes
 * — but `pulse` and `invite` are read by nothing on this surface (there is not
 * one `data.pulse` or `data.invite` reference in src/components/clubhome), so
 * a total-batch failure was fanning out two extra requests for objects that
 * would be discarded. The server seed builds the same seven (HOME_KEYS in
 * src/lib/club/home-payload.ts); the two lists are the same statement about
 * the same surface and must stay in step.
 *
 * The endpoints themselves are untouched — /api/club/pulse and
 * /api/club/invite still serve any other caller.
 */
const ENDPOINTS: ClubEndpoint[] = [
  "brief", "trending", "foryou",
  "thinking", "debate", "collective", "people",
];

export type ClubDataState = { [K in ClubEndpoint]: ClubData[K] | null };

const EMPTY_STATE: ClubDataState = {
  pulse: null, collective: null, invite: null, brief: null,
  trending: null, thinking: null, debate: null, foryou: null, people: null,
};

async function fetchEndpoint<K extends ClubEndpoint>(
  key: K,
  signal: AbortSignal
): Promise<ClubData[K] | null> {
  try {
    const res = await fetch(`/api/club/${key}`, {
      signal,
      headers: { accept: "application/json" },
    });
    if (!res.ok) return null;
    return (await res.json()) as ClubData[K];
  } catch {
    return null;
  }
}

/** The batched /api/club/home envelope: every section keyed by endpoint, plus
 *  `_errors` = the sections whose core threw (client re-fetches just those). */
type ClubHomeBatch = { [K in ClubEndpoint]?: ClubData[K] | null } & {
  _errors?: ClubEndpoint[];
};

/**
 * Load every ClubHome section in ONE round trip (GET /api/club/home). Returns the
 * batch envelope, or null when the whole request fails (the caller then falls
 * back to the nine-way individual fan-out — the original behavior).
 */
async function fetchClubHome(signal: AbortSignal): Promise<ClubHomeBatch | null> {
  try {
    const res = await fetch(`/api/club/home`, {
      signal,
      headers: { accept: "application/json" },
    });
    if (!res.ok) return null;
    return (await res.json()) as ClubHomeBatch;
  } catch {
    return null;
  }
}

/**
 * The SERVER SEED: the exact same envelope, built by the /dashboard server
 * component (src/lib/club/home-payload.ts) and handed across the RSC boundary
 * instead of being fetched. Values arrive as `unknown` because they crossed a
 * serialization boundary — they are cast on assignment exactly like the fetched
 * bodies are (`as ClubData[K]`), since both come from the same assembler.
 */
export type ClubHomeSeed = { [K in ClubEndpoint]?: unknown } & {
  _errors?: unknown;
};

export interface UseClubDataOptions {
  /**
   * Server-rendered payload. When present the hook starts ALREADY POPULATED and
   * skips its initial client fetch entirely — that is the whole fix for the
   * "board says empty first, then populates" flash. Absent/null → the original
   * client fetch path runs unchanged (the fallback).
   */
  seed?: ClubHomeSeed | null;
}

export interface UseClubDataResult {
  data: ClubDataState;
  loading: boolean;
}

/**
 * Load every ClubHome section in parallel: all endpoints fetch concurrently and
 * hydrate independently so one slow/absent endpoint never blocks the others.
 */
/** Merge a server seed (or a fetched batch) onto a state, ignoring null sections
 *  so an absent section never overwrites what is already there. */
function applyBatch(
  prev: ClubDataState,
  batch: ClubHomeSeed | ClubHomeBatch
): ClubDataState {
  const next: Record<string, unknown> = { ...prev };
  for (const key of ENDPOINTS) {
    const value = (batch as Record<string, unknown>)[key];
    if (value != null) next[key] = value;
  }
  return next as ClubDataState;
}

/** The `_errors` keys of a batch/seed, defensively filtered to known endpoints. */
function errorKeys(batch: ClubHomeSeed | ClubHomeBatch | null): ClubEndpoint[] {
  const raw = (batch as { _errors?: unknown } | null)?._errors;
  if (!Array.isArray(raw)) return [];
  return raw.filter((k): k is ClubEndpoint =>
    (ENDPOINTS as string[]).includes(k as string)
  );
}

/**
 * Load every ClubHome section in parallel. Two modes, in priority order:
 *
 *   1. SEEDED    — the server already built the payload (src/lib/club/home-payload.ts)
 *                  and handed it across the RSC boundary. First paint carries
 *                  real data; the initial client fetch is SKIPPED entirely. Only
 *                  the sections the server flagged in `_errors` are re-fetched
 *                  individually, preserving per-section degradation.
 *   2. LIVE      — the original path: ONE batched GET /api/club/home, with the
 *                  nine-way fan-out as its own fallback. Still used whenever the
 *                  seed is absent (client navigation, persona fell through, or
 *                  an RSC failure), so nothing regresses.
 *
 * `loading` is deliberately NOT "data is empty". It means "still arriving", and
 * a seeded mount with no errored sections is not loading at all — that
 * distinction is what stops the founding state from flashing.
 */
export function useClubData(opts: UseClubDataOptions = {}): UseClubDataResult {
  // The seed is read ONCE, at mount. It arrives from a server component and is
  // referentially stable for the life of the mount; pinning it in a ref keeps it
  // out of the effect's dependency list so a re-render can never restart the
  // load.
  const seedRef = useRef<ClubHomeSeed | null | undefined>(undefined);
  if (seedRef.current === undefined) seedRef.current = opts.seed ?? null;
  const seed = seedRef.current;

  const [data, setData] = useState<ClubDataState>(() =>
    seed ? applyBatch(EMPTY_STATE, seed) : EMPTY_STATE
  );
  // Seeded AND complete → nothing is in flight, so we are not loading. Seeded
  // with errored sections → those are still arriving, so we are.
  const [loading, setLoading] = useState(() =>
    seed ? errorKeys(seed).length > 0 : true
  );
  const startedRef = useRef(false);

  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;

    const ctrl = new AbortController();
    let mounted = true;

    // Per-section individual fallback (original behavior) — used when the whole
    // batch request fails, or for the specific sections the batch/seed flags in
    // `_errors`. A null value means "absent" and never overwrites founding state.
    const hydrateOne = (key: ClubEndpoint) => {
      void fetchEndpoint(key, ctrl.signal).then((value) => {
        if (!mounted || value == null) return;
        setData((prev) => ({ ...prev, [key]: value }));
      });
    };

    const seeded = seedRef.current;
    if (seeded) {
      // SEEDED: the payload is already on screen. No batch fetch — only the
      // sections whose core threw on the server get an individual retry.
      const errors = errorKeys(seeded);
      if (errors.length === 0) {
        setLoading(false);
        return () => {
          mounted = false;
          ctrl.abort();
        };
      }
      let pending = errors.length;
      const settleOne = () => {
        if (--pending <= 0 && mounted) setLoading(false);
      };
      for (const key of errors) {
        void fetchEndpoint(key, ctrl.signal).then((value) => {
          if (mounted && value != null) {
            setData((prev) => ({ ...prev, [key]: value }));
          }
          settleOne();
        });
      }
      const tSeed = setTimeout(() => mounted && setLoading(false), 1200);
      return () => {
        mounted = false;
        ctrl.abort();
        clearTimeout(tSeed);
      };
    }

    setLoading(true);

    // ONE round trip: GET /api/club/home. Sections resolve together; a section
    // the server couldn't produce (`_errors`) degrades to its individual
    // endpoint, and a total batch failure falls back to the nine-way fan-out.
    void fetchClubHome(ctrl.signal).then((batch) => {
      if (!mounted) return;
      if (!batch) {
        ENDPOINTS.forEach(hydrateOne);
        return;
      }
      setData((prev) => applyBatch(prev, batch));
      for (const key of errorKeys(batch)) hydrateOne(key);
      setLoading(false);
    });

    // Safety floor: clear the loading gate even if the batch never lands;
    // sections render their own founding fallbacks so the page is never held.
    const t = setTimeout(() => mounted && setLoading(false), 1200);

    return () => {
      mounted = false;
      ctrl.abort();
      clearTimeout(t);
    };
  }, []);

  return { data, loading };
}

/**
 * POST a debate vote. Returns the updated counts, or null on failure.
 *
 * THIS HAD NEVER BEEN CALLED. It shipped with zero importers alongside a Home
 * that computed the debate section and then discarded it — and because nothing
 * exercised it, it did not match its own endpoint: it sent `{ id, vote }` where
 * POST /api/club/debate/vote reads `{ debateId, choice }`, and it read a
 * `counts` object off a response that returns `{ ok, yes, no, total, userVote }`
 * flat. Both are corrected here; the wire contract is the route's.
 */
export async function postDebateVote(
  debateId: string,
  choice: "yes" | "no"
): Promise<{ yes: number; no: number } | null> {
  try {
    const res = await fetch(`/api/club/debate/vote`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ debateId, choice }),
    });
    if (!res.ok) return null;
    const json = (await res.json()) as {
      ok?: boolean;
      yes?: number;
      no?: number;
    };
    if (!json?.ok || typeof json.yes !== "number" || typeof json.no !== "number") {
      return null;
    }
    return { yes: json.yes, no: json.no };
  } catch {
    return null;
  }
}
