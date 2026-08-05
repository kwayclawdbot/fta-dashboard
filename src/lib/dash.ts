/**
 * The one honest empty value, in a module BOTH sides may import.
 *
 * This helper used to live in `src/components/you/parts.tsx`. That file carries
 * a `"use client"` directive, which makes every one of its exports a client
 * reference — components render across the boundary fine, but a plain FUNCTION
 * exported from a client module cannot be CALLED during a server render. The
 * server profile at /u/[username] called `dash()` inside its render and every
 * public profile in production threw:
 *
 *   Attempted to call dash() from the server but dash is on the client.
 *
 * Keeping the implementation in a directive-free module fixes that for good:
 * `parts.tsx` re-exports it for the client surfaces that already import it, and
 * server components import it straight from here.
 */

/** A measure with nothing behind it reads "—", never a fabricated zero. */
export function dash(n: number | null | undefined): string {
  return n == null ? "—" : n.toLocaleString();
}
