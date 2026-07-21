import type { Metadata, Viewport } from "next";
import { Poppins, Inter } from "next/font/google";
import "./globals.css";
import ThemeManager from "@/components/ThemeManager";

// Applied before first paint to avoid a light→dark flash on reload.
const THEME_INIT = `(function(){try{var p=localStorage.getItem('fta-theme')||'light';var d=p==='dark'||(p==='system'&&window.matchMedia('(prefers-color-scheme: dark)').matches);var t=d?'dark':'light';document.documentElement.setAttribute('data-theme',t);var c=d?'#17120B':'#FBF7EF';document.querySelectorAll('meta[name=\\"theme-color\\"]').forEach(function(m){m.setAttribute('content',c);});}catch(e){}})();`;

const poppins = Poppins({
  variable: "--font-poppins",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800", "900"],
});

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: "Family Investing Club | Dashboard",
  description: "Your family's weekly investing club — learn one money concept, study one company, build the habit together.",
  // PWA — required for iOS "Add to Home Screen" (a prerequisite for iOS web push)
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "FTA",
  },
  icons: {
    apple: "/icons/apple-touch-icon.png",
  },
};

export const viewport: Viewport = {
  // Baseline follows the OS; the inline script + ThemeManager override to match
  // the user's chosen preference (light / dark / system).
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#FBF7EF" },
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
      <body className={`${poppins.variable} ${inter.variable} antialiased`}>
        <ThemeManager />
        {children}
      </body>
    </html>
  );
}
