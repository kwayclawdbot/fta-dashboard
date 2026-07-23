/**
 * Small async guards for client load chains.
 *
 * The dashboard/watchlist/start-here pages fan out several Supabase calls on
 * first paint. A single slow or hung RPC used to leave the whole page on an
 * unbounded skeleton (audit: watchlist/start-here spinning >18s on mobile).
 * `withTimeout` caps any promise so a stalled call degrades to a fallback
 * value instead of freezing the page — never an infinite spinner.
 */

/** Resolve to `fallback` if `p` hasn't settled within `ms`. Rejections also
 *  fall back, so a caller can treat "slow" and "failed" identically.
 *  Accepts any thenable — Supabase query builders are PromiseLike, not real
 *  Promises (no catch/finally), so `Promise<T>` would reject them at compile. */
export function withTimeout<T>(
  p: PromiseLike<T>,
  ms: number,
  fallback: T
): Promise<T> {
  return new Promise<T>((resolve) => {
    let settled = false;
    const done = (v: T) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve(v);
    };
    const timer = setTimeout(() => done(fallback), ms);
    p.then(done, () => done(fallback));
  });
}

/** Default first-paint budget for a single dependency (ms). */
export const LOAD_TIMEOUT_MS = 8000;
