import { tickerPaint, type TickerPaint } from "@/ui-v3/ticker-palette";

/**
 * Brand pairs the Discover artboards draw that `src/ui-v3/ticker-palette.ts`
 * does not carry yet, read out of the same two mockup files (dark + light are
 * identical for all of them, as with every other tile in that lookup).
 *
 * They live here rather than in the shared palette because the shared file is
 * frozen for the duration of the parallel lane rebuild. They should be folded
 * into `ticker-palette.ts` at integration — this module is a temporary shim,
 * not a second source of truth.
 *
 * Source: "02 Discover" / "15 Discover Screener" in
 * `.planning/design-project-v2/mockups/Cheat Code App.dc.html`.
 */
const DISCOVER_BRAND: Record<string, TickerPaint> = {
  MSFT: { bg: "#0E1216", fg: "#00A4EF" },
  CRWD: { bg: "#1A0E10", fg: "#FF4D3D" },
};

/** Shared palette first-class; the Discover-only pairs fill the gaps. */
export function discoverPaint(ticker: string): TickerPaint {
  return DISCOVER_BRAND[ticker.toUpperCase()] ?? tickerPaint(ticker);
}
