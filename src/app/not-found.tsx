import Link from "next/link";
import { Home, Compass } from "lucide-react";

/**
 * Warm-branded 404 (Lane A). Replaces Next's pure-white system-font default with
 * the app's paper system so a missing route still reads as "us". Renders outside
 * the dashboard shell, so it inherits the family/paper base tokens — warm in
 * every theme. Big editorial numeral, no generic card container.
 */
export default function NotFound() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-paper px-6 text-center text-ink">
      <p className="font-display text-[7rem] font-extrabold leading-none tracking-tight text-gradient-gold sm:text-[9rem]">
        404
      </p>
      <h1 className="mt-2 font-display text-2xl font-bold text-ink sm:text-3xl">
        This page wandered off
      </h1>
      <p className="mx-auto mt-3 max-w-sm text-[15px] leading-relaxed text-soft">
        The link may be old or the page moved. Let&apos;s get you back to something useful.
      </p>
      <div className="mt-8 flex flex-col items-center gap-3 sm:flex-row">
        <Link
          href="/dashboard"
          className="cta-button inline-flex items-center gap-2 rounded-xl px-5 py-3 text-sm"
        >
          <Home className="h-4 w-4" />
          Back to Home
        </Link>
        <Link
          href="/discover"
          className="inline-flex items-center gap-2 rounded-xl border border-sand bg-card px-5 py-3 text-sm font-semibold text-ink shadow-soft transition-colors hover:border-gold-400 hover:text-gold-700"
        >
          <Compass className="h-4 w-4" />
          Explore stocks
        </Link>
      </div>
    </main>
  );
}
