import type { Metadata, Viewport } from "next";
import {
  Sora,
  Inter,
  IBM_Plex_Mono,
  Kaushan_Script,
  Caveat,
} from "next/font/google";
import "./globals.css";
import ThemeManager from "@/components/ThemeManager";
import { MotionProvider } from "@/lib/motion";
import { SpeedInsights } from "@vercel/speed-insights/next";

// Applied before first paint to avoid a light→dark flash on reload.
// Mirrors resolveForPolicy (src/lib/theme.ts): the `cc-appearance` cookie —
// stamped by the shell's ModeManager — carries the member's door policy.
//   family → light, always.   club → stored pref, else DARK (the club default).
//   no cookie → legacy stored-or-light (auth/public/first visit).
const THEME_INIT = `(function(){try{var k=(document.cookie.match(/(?:^|; )cc-appearance=([^;]*)/)||[])[1];var p=localStorage.getItem('fta-theme');var sys=window.matchMedia('(prefers-color-scheme: dark)').matches;var d;if(k==='family'){d=false;}else if(k==='club'){d=p?(p==='dark'||(p==='system'&&sys)):true;}else{d=p==='dark'||(p==='system'&&sys);}var t=d?'dark':'light';document.documentElement.setAttribute('data-theme',t);var c=d?(k==='club'?'#050505':'#17120B'):'#F7F4EF';document.querySelectorAll('meta[name=\\"theme-color\\"]').forEach(function(m){m.setAttribute('content',c);});}catch(e){}})();`;

// Sora — geometric display face (Bold/ExtraBold headlines) for the Club system.
// Mapped to --font-display at the token level so every existing headline flips
// to Sora with no component edits.
const sora = Sora({
  variable: "--font-sora",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
});

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

// IBM Plex Mono — market/price data (font-mono token).
const plexMono = IBM_Plex_Mono({
  variable: "--font-plex-mono",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
});

// Kaushan Script — the SECTION MARK. The reference canvases
// (.planning/design-project-v2) set a handful of surface wordmarks in a script
// face: "discover", "club", "live", "you", "belts", and three family headlines.
// Three lanes were independently substituting a lowercase display face for it,
// which is the drift a shared layer exists to prevent — so the real face is
// loaded once, here, and exposed as --font-script / .font-script.
//
// It is a MARK, never body copy: one word, display sizes only. A single 400
// weight is all the family ships and all the boards use, so the cost is one
// small woff2 that is subset and self-hosted by next/font like the other three.
const kaushan = Kaushan_Script({
  variable: "--font-kaushan",
  subsets: ["latin"],
  weight: ["400"],
  display: "swap",
});

// Caveat — the MARGIN NOTE. A different job from the script wordmark above and
// deliberately a different face: the Community canvases annotate things in a
// felt-tip hand ("2 rules", arrows, callouts) where Kaushan's formal brush
// script would read as a title rather than as someone writing on the page.
// Two weights because the boards mark some notes heavier than others.
const caveat = Caveat({
  variable: "--font-caveat",
  subsets: ["latin"],
  weight: ["500", "700"],
  display: "swap",
});

export const metadata: Metadata = {
  // Umbrella-neutral (Cheat Code Club architecture): static metadata can't be
  // per-member mode-aware, so the base title/PWA name is the umbrella that
  // CONTAINS Family Investing Club. The mode-aware wordmark lives in-app (shell
  // header / More sheet); login + onboarding read neutral-umbrella here.
  title: "Cheat Code Club | Dashboard",
  description: "The investing community with an AI analyst built in — learn, research, and build the habit. Family Mode brings the whole household in.",
  // PWA — required for iOS "Add to Home Screen" (a prerequisite for iOS web push)
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Cheat Code Club",
  },
  icons: {
    icon: "/icons/club-favicon-32.png",
    apple: "/icons/club-apple-touch.png",
  },
};

export const viewport: Viewport = {
  // Baseline follows the OS; the inline script + ThemeManager override to match
  // the user's chosen preference (light / dark / system).
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#F7F4EF" },
    { media: "(prefers-color-scheme: dark)", color: "#17120B" },
  ],
  // Let content + fixed bars extend into the notch/home-indicator areas so
  // env(safe-area-inset-*) is honored for the PWA bottom tab bar on iPhone.
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT }} />
      </head>
      <body className={`${sora.variable} ${inter.variable} ${plexMono.variable} ${kaushan.variable} ${caveat.variable} antialiased`}>
        <ThemeManager />
        <MotionProvider>{children}</MotionProvider>
        <SpeedInsights />
      </body>
    </html>
  );
}
