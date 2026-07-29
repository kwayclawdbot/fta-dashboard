"use client";

import { useEffect, useState } from "react";
import type { IndexChipVM } from "@/ui-v3/home-data";
import styles from "./IndexChips.module.css";

/**
 * Index chips.
 *
 * These are the one part of the Home artboard with no seed behind it, so they
 * are fetched client-side from /api/market/quote. When `initial` is supplied
 * (the anonymous/fixtures path) that fetch is skipped entirely.
 *
 * The artboard draws SPY / QQQ / VIX. We request IWM in place of VIX because
 * Polygon index snapshots are not entitled on this account — the same
 * substitution the existing app already makes. Flagged for the owner.
 */
const SYMBOLS = ["SPY", "QQQ", "IWM"];

interface QuoteResponse {
  quotes?: Record<string, { changePercent?: number | null } | null>;
}

export default function IndexChips({ initial }: { initial: IndexChipVM[] | null }) {
  const [chips, setChips] = useState<IndexChipVM[]>(initial ?? []);

  useEffect(() => {
    if (initial) return;
    let live = true;
    fetch(`/api/market/quote?symbols=${SYMBOLS.join(",")}`)
      .then((r) => (r.ok ? (r.json() as Promise<QuoteResponse>) : null))
      .then((body) => {
        if (!live || !body?.quotes) return;
        const next = SYMBOLS.map((symbol) => {
          const pct = body.quotes?.[symbol]?.changePercent;
          return typeof pct === "number" ? { symbol, changePct: pct } : null;
        }).filter((c): c is IndexChipVM => c !== null);
        setChips(next);
      })
      // Market data is decoration here: if it is unavailable the chips are
      // simply absent. Never render a fabricated quote.
      .catch(() => {});
    return () => {
      live = false;
    };
  }, [initial]);

  if (chips.length === 0) return null;

  return (
    <div className={styles.row}>
      {chips.map((chip) => (
        <span key={chip.symbol} className={styles.chip}>
          {chip.symbol}{" "}
          <span className={chip.changePct < 0 ? styles.down : styles.up} data-numeric>
            {chip.changePct < 0 ? "▼" : "▲"}
            {Math.abs(chip.changePct).toFixed(2)}%
          </span>
        </span>
      ))}
    </div>
  );
}
