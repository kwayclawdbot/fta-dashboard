import type { Metadata } from "next";
import Link from "next/link";
import { BookOpen } from "lucide-react";

export const metadata: Metadata = {
  title: "Shop | The Cheat Code Guides",
  description:
    "Physical books, workbooks, and lesson plans from the Cheat Code Club — money stuff, minus the snooze.",
};

export default function ShopLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-paper text-ink">
      <header className="sticky top-0 z-30 border-b border-sand bg-paper/85 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-3.5">
          <Link href="/shop" className="flex items-center gap-2.5">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-gold-500/15 text-gold-700">
              <BookOpen className="h-[18px] w-[18px]" />
            </span>
            <span className="font-display text-[15px] font-extrabold leading-none tracking-tight">
              The Cheat Code Guides
              <span className="block text-[11px] font-medium text-soft">Cheat Code Club</span>
            </span>
          </Link>
          <nav className="flex items-center gap-1.5 text-sm">
            <Link
              href="/shop"
              className="rounded-full px-3.5 py-1.5 font-semibold text-ink hover:bg-sand/60"
            >
              Shop
            </Link>
            <Link
              href="/dashboard"
              className="rounded-full bg-ink px-3.5 py-1.5 font-semibold text-paper hover:opacity-90"
            >
              Member login
            </Link>
          </nav>
        </div>
      </header>

      {children}

      <footer className="mt-16 border-t border-sand">
        <div className="mx-auto max-w-6xl px-5 py-8 text-sm text-soft">
          <p className="font-display font-semibold text-ink">Money stuff, minus the snooze.</p>
          <p className="mt-1 max-w-xl">
            Printed on demand and shipped to your door. Every title traces back to the Cheat Code
            Club curriculum your family already learns from.
          </p>
          <p className="mt-4 text-xs text-soft/80">
            © {new Date().getFullYear()} Cheat Code Club · The Cheat Code Guides
          </p>
        </div>
      </footer>
    </div>
  );
}
