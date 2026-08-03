export const dynamic = "force-dynamic";

import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, BookOpen, Check, Package, Truck, RotateCcw } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import BuyButton from "@/components/shop/BuyButton";
import {
  PRODUCT_SELECT,
  AUDIENCE_LABELS,
  KIND_LABELS,
  formatUsd,
  isListable,
  parseDescription,
  savingsCents,
  type ShopProduct,
} from "@/lib/shop";

export default async function ProductPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const supabase = await createClient();

  const { data: product } = await supabase
    .from("shop_products")
    .select(PRODUCT_SELECT)
    .eq("slug", slug)
    .eq("active", true)
    .maybeSingle();

  if (!product) notFound();
  const p = product as ShopProduct;
  // Hidden from the grid means hidden here too — otherwise /shop/<slug> is
  // still a live product page offering an unfinished record for $0.
  if (!isListable(p)) notFound();

  // Bundle contents
  let included: ShopProduct[] = [];
  if (p.kind === "bundle") {
    const { data: items } = await supabase
      .from("shop_bundle_items")
      .select("sort, product:shop_products!shop_bundle_items_product_id_fkey(" + PRODUCT_SELECT + ")")
      .eq("bundle_id", p.id)
      .order("sort", { ascending: true });
    included = (items || [])
      .map((i) => (i as unknown as { product: ShopProduct }).product)
      .filter(Boolean);
  }

  const { lead, bullets } = parseDescription(p.description);
  const saving = savingsCents(p);

  return (
    <main className="mx-auto max-w-5xl px-5 py-8">
      <Link
        href="/shop"
        className="inline-flex items-center gap-1.5 text-sm font-medium text-soft hover:text-ink"
      >
        <ArrowLeft className="h-4 w-4" /> Back to shop
      </Link>

      <div className="mt-6 grid gap-8 md:grid-cols-2">
        {/* Cover */}
        <div className="md:sticky md:top-24 md:self-start">
          <div className="overflow-hidden rounded-2xl border border-sand bg-sand/40 shadow-soft">
            {p.cover_image_path ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={p.cover_image_path} alt={p.title} className="w-full object-cover" />
            ) : (
              <div className="flex aspect-[3/4] items-center justify-center text-soft">
                <BookOpen className="h-10 w-10" />
              </div>
            )}
          </div>
        </div>

        {/* Details */}
        <div>
          <div className="flex flex-wrap items-center gap-1.5">
            {p.kind && (
              <span className="rounded-full bg-chip-amber px-2.5 py-0.5 text-xs font-semibold text-gold-700">
                {KIND_LABELS[p.kind]}
              </span>
            )}
            {p.audience && (
              <span className="rounded-full border border-sand px-2.5 py-0.5 text-xs font-medium text-soft">
                For {AUDIENCE_LABELS[p.audience]}
              </span>
            )}
          </div>

          <h1 className="mt-3 font-display text-2xl font-black leading-tight text-ink sm:text-3xl">
            {p.title}
          </h1>
          {p.subtitle && <p className="mt-2 text-[15px] italic text-soft">{p.subtitle}</p>}

          <div className="mt-4 flex items-end gap-3">
            <span className="font-display text-3xl font-black text-ink">
              {formatUsd(p.price_cents)}
            </span>
            {p.compare_at_cents && (
              <span className="price-strike text-lg text-soft">
                {formatUsd(p.compare_at_cents)}
              </span>
            )}
            {saving > 0 && (
              <span className="mb-1 rounded-full bg-accent px-2.5 py-1 text-xs font-bold text-[var(--accent-on)]">
                Save {formatUsd(saving)}
              </span>
            )}
          </div>

          {lead && <p className="mt-5 text-[15px] leading-relaxed text-ink/90">{lead}</p>}

          {bullets.length > 0 && (
            <div className="mt-5">
              <h2 className="font-display text-sm font-bold uppercase tracking-wider text-soft">
                What&apos;s inside
              </h2>
              <ul className="mt-2 space-y-2">
                {bullets.map((b, i) => (
                  <li key={i} className="flex items-start gap-2 text-[15px] text-ink/90">
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-gold-600" />
                    <span>{b}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {p.page_count && (
            <p className="mt-4 inline-flex items-center gap-1.5 rounded-full border border-sand px-3 py-1 text-sm text-soft">
              <BookOpen className="h-4 w-4" /> {p.page_count} pages · paperback
            </p>
          )}

          {/* Bundle contents */}
          {included.length > 0 && (
            <div className="mt-6 rounded-2xl border border-sand bg-[var(--card)] p-4">
              <h2 className="flex items-center gap-2 font-display text-sm font-bold text-ink">
                <Package className="h-4 w-4 text-gold-600" /> This set includes {included.length} books
              </h2>
              <ul className="mt-3 divide-y divide-sand">
                {included.map((b) => (
                  <li key={b.id} className="flex items-center justify-between gap-3 py-2.5">
                    <Link href={`/shop/${b.slug}`} className="flex items-center gap-3 hover:opacity-80">
                      {b.cover_image_path && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={b.cover_image_path}
                          alt=""
                          className="h-12 w-9 rounded object-cover shadow-soft"
                        />
                      )}
                      <span className="text-[14px] font-medium text-ink">{b.title}</span>
                    </Link>
                    <span className="shrink-0 text-sm text-soft">{formatUsd(b.price_cents)}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="mt-7">
            <BuyButton slug={p.slug} />
            {/* One-line delivery expectation right at the buy decision. */}
            <p className="mt-2 text-xs text-soft">
              Printed to order · ships in 5–10 business days · US &amp; Canada
            </p>
          </div>

          {/* Shipping & Returns — set expectations before Stripe (UX audit #9) */}
          <div className="mt-6 rounded-2xl border border-sand bg-[var(--card)] p-4">
            <h2 className="font-display text-sm font-bold uppercase tracking-wider text-soft">
              Shipping &amp; returns
            </h2>
            <ul className="mt-3 space-y-3">
              <li className="flex items-start gap-2.5 text-[14px] text-ink/90">
                <Truck className="mt-0.5 h-4 w-4 shrink-0 text-gold-600" />
                <span>
                  Every book is printed to order and shipped from our
                  print-on-demand partner. Most orders arrive within{" "}
                  <span className="font-semibold text-ink">5–10 business days</span>{" "}
                  in the US &amp; Canada. Shipping is calculated at checkout.
                </span>
              </li>
              <li className="flex items-start gap-2.5 text-[14px] text-ink/90">
                <RotateCcw className="mt-0.5 h-4 w-4 shrink-0 text-gold-600" />
                <span>
                  Because each book is made just for you, we can&apos;t take
                  change-of-mind returns. If your order arrives damaged,
                  misprinted, or wrong, email{" "}
                  <a
                    href="mailto:support@cheatcode.com"
                    className="font-semibold text-gold-700 hover:text-gold-800"
                  >
                    support@cheatcode.com
                  </a>{" "}
                  within 30 days and we&apos;ll reprint or refund it — no need to
                  ship anything back.
                </span>
              </li>
            </ul>
          </div>
        </div>
      </div>
    </main>
  );
}
