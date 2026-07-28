import type { JWK } from "@supabase/supabase-js";

/**
 * PROCESS-LEVEL JWKS CACHE.
 *
 * `auth.getClaims()` verifies an access token's signature locally instead of
 * asking GoTrue — but the public keys it verifies against are cached on the
 * CLIENT INSTANCE, and both the middleware and every server render build a
 * fresh Supabase client per request (they have to: each carries that request's
 * cookies). Left alone, the fast path would simply trade one round trip
 * (POST /auth/v1/user) for another (GET /.well-known/jwks.json) on every hit.
 *
 * So the key set is held HERE, at module scope, where it survives across
 * requests for the life of the lambda / edge isolate. It is public data — the
 * same bytes the JWKS endpoint serves to anyone — so there is nothing
 * per-member about it and nothing to leak.
 *
 * Rotation is safe without any signalling: `getClaims` looks for the token's
 * `kid` in the supplied set and, if it is not there, falls through to fetching
 * the live JWKS itself. A key rotated in mid-flight therefore verifies on the
 * next request rather than failing, and the TTL below bounds the staleness
 * anyway. If the fetch fails for any reason we return null and `getClaims`
 * behaves exactly as it would have without this file.
 */

const JWKS_TTL_MS = 10 * 60 * 1000; // 10 minutes

let cachedKeys: JWK[] | null = null;
let cachedAt = 0;

export async function getProjectJwks(): Promise<JWK[] | null> {
  const now = Date.now();
  if (cachedKeys && now - cachedAt < JWKS_TTL_MS) return cachedKeys;

  try {
    const base = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
    const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();
    if (!base || !anon) return cachedKeys;

    const res = await fetch(`${base}/auth/v1/.well-known/jwks.json`, {
      headers: { apikey: anon },
      cache: "no-store",
      signal: AbortSignal.timeout(3000),
    });
    if (!res.ok) return cachedKeys;

    const data = (await res.json()) as { keys?: JWK[] };
    if (!Array.isArray(data.keys) || data.keys.length === 0) return cachedKeys;

    cachedKeys = data.keys;
    cachedAt = now;
    return cachedKeys;
  } catch {
    // Keep serving the last good set if we have one; otherwise let getClaims
    // resolve the keys itself (or fall back to the auth server).
    return cachedKeys;
  }
}
