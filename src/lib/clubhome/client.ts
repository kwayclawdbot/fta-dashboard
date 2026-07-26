"use client";

/**
 * ClubHome v2 — typed client for the /api/club/* contract with a fixtures
 * fallback. The UI renders against the contract; where an endpoint responds it
 * wires the real data, where it 404s / errors it returns null and the section
 * falls back to a founding-era state (never a fabricated number).
 *
 * FIXTURES GUARD (safety-critical): `?fixtures=1` renders rich fixture data for
 * design review, but ONLY when `fixturesAllowed()` passes — dev or a vercel
 * PREVIEW deploy. In production it can never activate: the query param is
 * ignored and the live client is always used. See next.config.ts for the
 * NEXT_PUBLIC_VERCEL_ENV passthrough that drives the guard.
 */

import { useEffect, useMemo, useRef, useState } from "react";
import type { ClubData, ClubEndpoint, ClubScale } from "./contract";
import { clubFixtures } from "./fixtures";

/** True only in dev or a vercel preview — NEVER in production. */
export function fixturesAllowed(): boolean {
  const env = process.env.NEXT_PUBLIC_VERCEL_ENV;
  // Vercel: 'production' | 'preview' | 'development'. Undefined locally.
  if (env) return env !== "production";
  // No Vercel env (local `next dev` / `next start`): allow unless NODE_ENV=production
  // AND we can't prove we're a preview — default to blocking in bare production builds.
  return process.env.NODE_ENV !== "production";
}

const ENDPOINTS: ClubEndpoint[] = [
  "pulse", "collective", "invite", "brief",
  "trending", "thinking", "debate", "foryou", "people",
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

export interface UseClubDataOptions {
  /** design-review only — force fixture data (ignored in production) */
  fixtures?: boolean;
  scale?: ClubScale;
}

export interface UseClubDataResult {
  data: ClubDataState;
  loading: boolean;
  usingFixtures: boolean;
}

/**
 * Load every ClubHome section in parallel. Fixtures short-circuit (synchronous,
 * no loading flash). Live mode fetches all endpoints concurrently and hydrates
 * each independently so one slow/absent endpoint never blocks the others.
 */
export function useClubData(opts: UseClubDataOptions = {}): UseClubDataResult {
  const usingFixtures = !!opts.fixtures && fixturesAllowed();
  const scale: ClubScale = opts.scale ?? "scale";

  const fixtureData = useMemo<ClubDataState | null>(() => {
    if (!usingFixtures) return null;
    return clubFixtures(scale) as ClubDataState;
  }, [usingFixtures, scale]);

  const [data, setData] = useState<ClubDataState>(() => fixtureData ?? EMPTY_STATE);
  const [loading, setLoading] = useState(!usingFixtures);
  const startedRef = useRef(false);

  useEffect(() => {
    if (usingFixtures) {
      setData(fixtureData ?? EMPTY_STATE);
      setLoading(false);
      return;
    }
    if (startedRef.current) return;
    startedRef.current = true;

    const ctrl = new AbortController();
    let mounted = true;
    setLoading(true);

    ENDPOINTS.forEach((key) => {
      void fetchEndpoint(key, ctrl.signal).then((value) => {
        if (!mounted || value == null) return;
        setData((prev) => ({ ...prev, [key]: value }));
      });
    });

    // Clear the loading gate once the first tick of requests has been dispatched
    // and given a beat to land; sections render their own founding fallbacks so
    // we never hold the whole page on a hung endpoint.
    const t = setTimeout(() => mounted && setLoading(false), 1200);

    return () => {
      mounted = false;
      ctrl.abort();
      clearTimeout(t);
    };
  }, [usingFixtures, fixtureData]);

  return { data, loading, usingFixtures };
}

/** POST a debate vote. Returns the updated counts, or null on failure. */
export async function postDebateVote(
  debateId: string,
  vote: "yes" | "no"
): Promise<{ yes: number; no: number } | null> {
  try {
    const res = await fetch(`/api/club/debate/vote`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ id: debateId, vote }),
    });
    if (!res.ok) return null;
    const json = (await res.json()) as { counts?: { yes: number; no: number } };
    return json.counts ?? null;
  } catch {
    return null;
  }
}
