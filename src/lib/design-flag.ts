/**
 * DESIGN v2 FLAG — the single opt-in switch for the Cheat Code App conversion
 * (design-project-v2). The whole conversion renders ONLY when this is on, so
 * production (where the env var is absent) is byte-identical to today.
 *
 * Mechanism: `NEXT_PUBLIC_DESIGN_V2="1"` in `.env.local` (local dev only). The
 * `NEXT_PUBLIC_` prefix means Next.js inlines the value at build time in BOTH
 * the server and the client bundle, so this one helper is safe to call from a
 * Server Component (the dashboard layout, the pricing/splash pages) AND from a
 * Client Component (login, upgrade, the shell chrome) with the same answer.
 *
 * When ON, a converted surface stamps `data-design="v2"` on <html> (via
 * <DesignManager/>) alongside the existing `data-theme` that ThemeManager
 * already flips — so the v2 token block in globals.css (and its light twin,
 * keyed on `[data-design="v2"][data-theme="light"]`) resolves for the whole
 * document. When OFF, nothing stamps `data-design`, so no v2 selector ever
 * matches and every surface renders exactly as it does in production.
 */
export function designV2Enabled(): boolean {
  return process.env.NEXT_PUBLIC_DESIGN_V2 === "1";
}
