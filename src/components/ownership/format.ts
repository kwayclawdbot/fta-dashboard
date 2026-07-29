/**
 * Ownership Cards — display formatting helpers.
 * Pure functions, no deps. Kept separate so the LivingCard face and the
 * detail panels format value/growth/dates identically.
 */

/** Money, smart precision: cents under $100, whole dollars above $10k. */
export function formatMoney(v: number | null | undefined): string {
  if (v == null || Number.isNaN(v)) return "—";
  const abs = Math.abs(v);
  const digits = abs >= 10_000 ? 0 : abs >= 100 ? 2 : 2;
  return v.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

/** Compact money for tight chips ($1.9K, $12.4K). */
export function formatMoneyCompact(v: number | null | undefined): string {
  if (v == null || Number.isNaN(v)) return "—";
  return v.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    notation: "compact",
    maximumFractionDigits: 1,
  });
}

/** Signed percent with one decimal (+36.8%). */
export function formatPct(v: number | null | undefined): string {
  if (v == null || Number.isNaN(v)) return "—";
  const sign = v > 0 ? "+" : "";
  return `${sign}${v.toFixed(1)}%`;
}

/** Signed money delta (+$522.60). */
export function formatDelta(v: number | null | undefined): string {
  if (v == null || Number.isNaN(v)) return "—";
  const sign = v > 0 ? "+" : v < 0 ? "−" : "";
  return `${sign}${formatMoney(Math.abs(v))}`;
}

/** Share denomination — trims trailing zeros for fractional assets. */
export function formatShares(qty: number, assetType?: string): string {
  const unit = assetType === "crypto" ? "UNITS" : "SHARES";
  const n =
    qty >= 1 || qty === 0
      ? qty.toLocaleString("en-US", { maximumFractionDigits: 4 })
      : qty.toString();
  const label = qty === 1 ? unit.replace(/S$/, "") : unit;
  return `${n} ${label}`;
}

/** "owned for" — human span from a day count. */
export function formatHeld(days: number): string {
  if (days <= 0) return "just issued";
  if (days < 30) return `${days} day${days === 1 ? "" : "s"}`;
  if (days < 365) {
    const m = Math.floor(days / 30.44);
    return `${m} month${m === 1 ? "" : "s"}`;
  }
  const years = days / 365.25;
  const y = Math.floor(years);
  const rem = Math.round((years - y) * 12);
  if (rem === 0) return `${y} year${y === 1 ? "" : "s"}`;
  return `${y}y ${rem}m`;
}

/** Long date — "Aug 6, 2026". */
export function formatDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

/** Year only — public projections + card foot line. */
export function yearOf(iso: string | null | undefined): number | string {
  if (!iso) return "—";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "—" : d.getFullYear();
}

/** Holder line — "Kai R." from the holder object. */
export function holderName(
  holder: { firstName: string; lastInitial: string } | null
): string | null {
  if (!holder) return null;
  const li = holder.lastInitial ? ` ${holder.lastInitial.replace(/\.$/, "")}.` : "";
  return `${holder.firstName}${li}`;
}
