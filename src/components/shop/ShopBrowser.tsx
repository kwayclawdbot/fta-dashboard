"use client";

import { useMemo, useState } from "react";
import ProductCard from "@/components/shop/ProductCard";
import {
  AUDIENCE_LABELS,
  KIND_LABELS,
  type ShopAudience,
  type ShopKind,
  type ShopProduct,
} from "@/lib/shop";

const AUDIENCES: ShopAudience[] = ["kids", "teens", "adults", "family"];
const KINDS: ShopKind[] = [
  "textbook",
  "guidebook",
  "workbook",
  "lesson_plans",
  "teacher_guide",
];

export default function ShopBrowser({ products }: { products: ShopProduct[] }) {
  const [audience, setAudience] = useState<ShopAudience | "all">("all");
  const [kind, setKind] = useState<ShopKind | "all">("all");

  const bundles = useMemo(() => products.filter((p) => p.kind === "bundle"), [products]);
  const singles = useMemo(() => products.filter((p) => p.kind !== "bundle"), [products]);

  const visibleBundles = useMemo(
    () => (audience === "all" ? bundles : bundles.filter((p) => p.audience === audience)),
    [bundles, audience]
  );
  const visibleSingles = useMemo(
    () =>
      singles.filter(
        (p) =>
          (audience === "all" || p.audience === audience) &&
          (kind === "all" || p.kind === kind)
      ),
    [singles, audience, kind]
  );

  const chip = (active: boolean) =>
    `rounded-full px-3.5 py-1.5 text-sm font-semibold transition-colors ${
      active
        ? "bg-ink text-paper"
        : "border border-sand bg-[var(--card)] text-soft hover:text-ink"
    }`;

  return (
    <div>
      {/* Bundles — prominent, savings-forward */}
      {visibleBundles.length > 0 && (
        <section className="mb-12">
          <div className="mb-4 flex items-baseline justify-between">
            <h2 className="font-display text-xl font-extrabold text-ink">Bundles &amp; Sets</h2>
            <span className="text-sm text-soft">Buy the shelf, save the most</span>
          </div>
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {visibleBundles.map((p) => (
              <ProductCard key={p.id} product={p} feature />
            ))}
          </div>
        </section>
      )}

      {/* Filters */}
      <div className="mb-5 space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="mr-1 text-xs font-semibold uppercase tracking-wider text-soft">
            Who it&apos;s for
          </span>
          <button className={chip(audience === "all")} onClick={() => setAudience("all")}>
            Everyone
          </button>
          {AUDIENCES.map((a) => (
            <button key={a} className={chip(audience === a)} onClick={() => setAudience(a)}>
              {AUDIENCE_LABELS[a]}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="mr-1 text-xs font-semibold uppercase tracking-wider text-soft">
            Type
          </span>
          <button className={chip(kind === "all")} onClick={() => setKind("all")}>
            All types
          </button>
          {KINDS.map((k) => (
            <button key={k} className={chip(kind === k)} onClick={() => setKind(k)}>
              {KIND_LABELS[k]}
            </button>
          ))}
        </div>
      </div>

      {/* Singles grid */}
      <section>
        <h2 className="mb-4 font-display text-xl font-extrabold text-ink">All Books</h2>
        {visibleSingles.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-sand p-8 text-center text-soft">
            No titles match that filter yet.
          </p>
        ) : (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            {visibleSingles.map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
