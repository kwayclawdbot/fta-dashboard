export const dynamic = "force-dynamic";

import { createClient } from "@/lib/supabase/server";
import ShopBrowser from "@/components/shop/ShopBrowser";
import { PRODUCT_SELECT, type ShopProduct } from "@/lib/shop";

export default async function ShopPage() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("shop_products")
    .select(PRODUCT_SELECT)
    .eq("active", true)
    .order("sort", { ascending: true });

  const products = (data || []) as ShopProduct[];

  return (
    <main className="mx-auto max-w-6xl px-5 py-10">
      {/* Hero */}
      <section className="mb-12 overflow-hidden rounded-3xl border border-sand bg-[var(--card)] shadow-soft">
        <div className="grid items-center gap-6 p-7 sm:p-10 md:grid-cols-[1.3fr_1fr]">
          <div>
            <span className="inline-block rounded-full bg-chip-amber px-3 py-1 text-xs font-bold uppercase tracking-wider text-gold-700">
              The Cheat Code Guides
            </span>
            <h1 className="mt-4 font-display text-3xl font-black leading-[1.08] text-ink sm:text-4xl">
              Real books that make money make sense.
            </h1>
            <p className="mt-3 max-w-lg text-[15px] leading-relaxed text-soft">
              Textbooks, guidebooks, workbooks, and lesson plans for the whole family — the same
              curriculum your investing club learns from, printed and shipped to your door. No suit
              required. No shame if you&apos;re starting at zero.
            </p>
            <div className="mt-5 flex flex-wrap gap-2 text-[13px] text-soft">
              <span className="rounded-full border border-sand px-3 py-1">Print-on-demand</span>
              <span className="rounded-full border border-sand px-3 py-1">Ships to US &amp; Canada</span>
              <span className="rounded-full border border-sand px-3 py-1">Family bundles</span>
            </div>
          </div>
          <div className="hidden md:block">
            <div className="relative mx-auto h-52 w-full max-w-xs">
              <div className="absolute left-6 top-3 h-44 w-32 rotate-[-8deg] rounded-lg bg-gold-500/20 shadow-lift" />
              <div className="absolute left-20 top-0 h-48 w-32 rotate-[6deg] rounded-lg bg-ink/10 shadow-lift" />
              <div className="absolute left-12 top-6 flex h-44 w-32 items-center justify-center rounded-lg bg-ink text-center font-display text-sm font-black leading-tight text-paper shadow-lift">
                Money
                <br />
                stuff,
                <br />
                minus the
                <br />
                snooze.
              </div>
            </div>
          </div>
        </div>
      </section>

      <ShopBrowser products={products} />
    </main>
  );
}
