import Link from "next/link";
import {
  formatUsd,
  savingsCents,
  savingsPct,
  KIND_LABELS,
  AUDIENCE_LABELS,
  type ShopProduct,
} from "@/lib/shop";

/**
 * Storefront product card. `feature` gives bundles a taller, warmer treatment.
 */
export default function ProductCard({
  product,
  feature = false,
}: {
  product: ShopProduct;
  feature?: boolean;
}) {
  const isBundle = product.kind === "bundle";
  const saving = savingsCents(product);
  const pct = savingsPct(product);

  return (
    <Link
      href={`/shop/${product.slug}`}
      className={`group flex flex-col overflow-hidden rounded-2xl border bg-[var(--card)] shadow-soft transition-all hover:-translate-y-0.5 hover:shadow-lift ${
        feature ? "border-gold-500/40" : "border-sand"
      }`}
    >
      <div className="relative aspect-[3/4] overflow-hidden bg-sand/40">
        {product.cover_image_path ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={product.cover_image_path}
            alt={product.title}
            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
            loading="lazy"
          />
        ) : (
          <div className="flex h-full items-center justify-center text-soft">No cover</div>
        )}
        {saving > 0 && (
          <span className="absolute left-3 top-3 rounded-full bg-accent px-2.5 py-1 text-xs font-bold text-[var(--accent-on)] shadow">
            Save {formatUsd(saving)}
            {pct ? ` · ${pct}%` : ""}
          </span>
        )}
        {isBundle && (
          <span className="absolute right-3 top-3 rounded-full bg-gold-500 px-2.5 py-1 text-xs font-extrabold text-midnight-50 shadow">
            Bundle
          </span>
        )}
      </div>

      <div className="flex flex-1 flex-col p-4">
        <div className="mb-1.5 flex flex-wrap items-center gap-1.5">
          {product.kind && (
            <span className="rounded-full bg-chip-amber px-2 py-0.5 text-[11px] font-semibold text-gold-700">
              {KIND_LABELS[product.kind]}
            </span>
          )}
          {product.audience && (
            <span className="rounded-full border border-sand px-2 py-0.5 text-[11px] font-medium text-soft">
              {AUDIENCE_LABELS[product.audience]}
            </span>
          )}
        </div>
        <h3 className="font-display text-[15px] font-bold leading-snug text-ink">
          {product.title}
        </h3>
        {product.subtitle && (
          <p className="mt-1 line-clamp-2 text-[13px] leading-snug text-soft">{product.subtitle}</p>
        )}
        <div className="mt-3 flex items-end gap-2 pt-1">
          <span className="font-display text-lg font-extrabold text-ink">
            {formatUsd(product.price_cents)}
          </span>
          {product.compare_at_cents && (
            <span className="price-strike text-sm text-soft">
              {formatUsd(product.compare_at_cents)}
            </span>
          )}
        </div>
      </div>
    </Link>
  );
}
