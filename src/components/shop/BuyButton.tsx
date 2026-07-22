"use client";

import { useState } from "react";
import { Loader2, Minus, Plus, ShoppingBag } from "lucide-react";

export default function BuyButton({ slug }: { slug: string }) {
  const [qty, setQty] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function buy() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/shop/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug, quantity: qty }),
      });
      const json = await res.json();
      if (!res.ok || !json.url) throw new Error(json.error || "Checkout failed");
      window.location.href = json.url;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
      setLoading(false);
    }
  }

  return (
    <div>
      <div className="flex items-center gap-3">
        <div className="flex items-center rounded-full border border-sand bg-[var(--card)]">
          <button
            aria-label="Decrease quantity"
            onClick={() => setQty((q) => Math.max(1, q - 1))}
            className="flex h-10 w-10 items-center justify-center text-soft hover:text-ink"
          >
            <Minus className="h-4 w-4" />
          </button>
          <span className="w-8 text-center font-semibold tabular-nums">{qty}</span>
          <button
            aria-label="Increase quantity"
            onClick={() => setQty((q) => Math.min(20, q + 1))}
            className="flex h-10 w-10 items-center justify-center text-soft hover:text-ink"
          >
            <Plus className="h-4 w-4" />
          </button>
        </div>
        <button
          onClick={buy}
          disabled={loading}
          className="flex flex-1 items-center justify-center gap-2 rounded-full bg-gradient-to-r from-gold-400 to-gold-500 px-6 py-3 font-display font-bold text-midnight-50 shadow-soft transition-all hover:shadow-lift disabled:opacity-60"
        >
          {loading ? (
            <Loader2 className="h-5 w-5 animate-spin" />
          ) : (
            <ShoppingBag className="h-5 w-5" />
          )}
          {loading ? "Starting checkout…" : "Buy now"}
        </button>
      </div>
      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
      <p className="mt-2 text-xs text-soft">Secure checkout by Stripe · Ships to US &amp; Canada</p>
    </div>
  );
}
