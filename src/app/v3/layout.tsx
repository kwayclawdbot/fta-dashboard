import type { ReactNode } from "react";
import {
  Barlow_Condensed,
  Instrument_Sans,
  IBM_Plex_Mono,
  Kaushan_Script,
} from "next/font/google";

// ui-v3 owns its own stylesheet chain. tokens.css is GENERATED from the
// mockups (scripts/extract-mockup-tokens.mjs); base.css is the isolation layer
// that stops the old global body styles from being inherited into v3.
import "@/ui-v3/tokens.css";
import "@/ui-v3/base.css";

/*
 * The four faces the mockups declare, self-hosted by next/font and exposed as
 * --font-v3-* (src/ui-v3/base.css binds them to --font-display/body/mono/script).
 * Weights/styles mirror the Google Fonts request in the mockup <helmet>:
 *   Barlow Condensed  italic 600;700;800
 *   Instrument Sans   400;500;600;700
 *   IBM Plex Mono     400;500;600
 *   Kaushan Script    400
 * Declaring them here rather than in the root layout keeps the old app's font
 * payload unchanged.
 */
const display = Barlow_Condensed({
  variable: "--font-v3-display",
  subsets: ["latin"],
  weight: ["600", "700", "800"],
  style: ["italic", "normal"],
  display: "swap",
});

const body = Instrument_Sans({
  variable: "--font-v3-body",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

const mono = IBM_Plex_Mono({
  variable: "--font-v3-mono",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  display: "swap",
});

const script = Kaushan_Script({
  variable: "--font-v3-script",
  subsets: ["latin"],
  weight: ["400"],
  display: "swap",
});

export const metadata = {
  title: "Cheat Code · ui-v3",
};

/**
 * Every /v3 route renders inside this wrapper.
 *
 * `data-ui="v3"` is the isolation hook (see src/ui-v3/base.css) AND the token
 * scope (see src/ui-v3/tokens.css). `data-theme` selects the light twin; dark
 * is the default because the dark mockup is the canonical artboard set.
 *
 * The wrapper deliberately does NOT read the old app's `fta-theme` preference —
 * v3 theming is its own axis and will be wired to member settings when the
 * first real screens land.
 *
 * It also renders no chrome of its own. The theme toggle lives on the token
 * proof sheet (/v3/tokens) rather than here, because a floating control over
 * every screen is not in any artboard.
 */
export default function V3Layout({ children }: { children: ReactNode }) {
  return (
    <div
      data-ui="v3"
      data-theme="dark"
      className={`${display.variable} ${body.variable} ${mono.variable} ${script.variable}`}
    >
      {children}
    </div>
  );
}
