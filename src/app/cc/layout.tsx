import type { Metadata, Viewport } from "next";
import "./cc.css";

export const metadata: Metadata = {
  title: "Cheat Code Club",
  description: "Trade with your people.",
};

export const viewport: Viewport = {
  themeColor: "#141216",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

/**
 * Cheat Code App shell — standalone dark mobile app (design-project-v2).
 * Phone-width column on desktop, edge-to-edge on mobile. Screens render inside;
 * the tab bar is per-screen (screens with back-nav or full-bleed states omit it).
 *
 * v2 opt-in: `data-design="v2"` activates the token layer (single source of
 * truth in globals.css). No `data-theme` here → the standalone app renders the
 * DARK primary canvas regardless of the user's app-wide theme. All four type
 * faces (--font-cc-display, --font-cc-body, --font-kaushan, --font-plex-mono)
 * are loaded once by the root layout, so this shell no longer loads its own.
 */
export default function CcLayout({ children }: { children: React.ReactNode }) {
  return (
    <div data-design="v2" className="cc-app min-h-dvh">
      <div className="mx-auto flex min-h-dvh w-full max-w-[430px] flex-col sm:border-x sm:border-[var(--cc-line)]">
        {children}
      </div>
    </div>
  );
}
