import ScreenerSurface from "@/components/screener/ScreenerSurface";

/**
 * /screener — the standalone Stock Screener route. The screener itself now lives
 * in a shared client component (ScreenerSurface) so the exact same surface can
 * also render as the "Screener" tab on the Discover research hub. This route
 * keeps working as it always did (full-page chrome), so every existing deep link
 * to /screener — sidebar rows, the research breadcrumb, the Discover "Launch
 * Stock Finder" CTA, the app tour — stays live.
 */
export default function ScreenerPage() {
  return <ScreenerSurface />;
}
