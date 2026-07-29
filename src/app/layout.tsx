import type { Metadata, Viewport } from "next";
import "./globals.css";
import ThemeManager from "@/components/ThemeManager";
import { MotionProvider } from "@/lib/motion";
import { SpeedInsights } from "@vercel/speed-insights/next";

// Applied before first paint to avoid a light→dark flash on reload.
const THEME_INIT = `(function(){try{var p=localStorage.getItem('fta-theme')||'light';var d=p==='dark'||(p==='system'&&window.matchMedia('(prefers-color-scheme: dark)').matches);var t=d?'dark':'light';document.documentElement.setAttribute('data-theme',t);var c=d?'#17120B':'#F7F4EF';document.querySelectorAll('meta[name=\\"theme-color\\"]').forEach(function(m){m.setAttribute('content',c);});}catch(e){}})();`;

export const metadata: Metadata = {
  // Umbrella-neutral (Cheat Code Club architecture): static metadata can't be
  // per-member mode-aware, so the base title/PWA name is the umbrella that
  // CONTAINS Family Investing Club. The mode-aware wordmark lives in-app (shell
  // header / More sheet); login + onboarding read neutral-umbrella here.
  title: "Cheat Code Club | Dashboard",
  description: "Collective minds become the signal. Learn, research, and invest smarter together with Cheat Code Club.",
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
      <body className="antialiased">
        <ThemeManager />
        <MotionProvider>{children}</MotionProvider>
        <SpeedInsights />
      </body>
    </html>
  );
}
