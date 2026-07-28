/**
 * <TrendGlyph> — the family's qualitative trend read as a small branded chip
 * with a directional arrow, using the LOCKED market-semantic colors
 * (green-team up / red-team down / soft sideways / amber new-&-bouncy).
 *
 * Maps the exact `trend` values authored in lib/watchlist.ts TREND_OPTIONS:
 *   "Uptrend" ↗  ·  "Sideways" →  ·  "Downtrend" ↘  ·  "New / Volatile" ↕
 * Reused on watchlist cards, Company of the Week, and Progress.
 */

type TrendKey = "Uptrend" | "Sideways" | "Downtrend" | "New / Volatile";

const CONFIG: Record<
  TrendKey,
  { label: string; kidLabel: string; stroke: string; bg: string; text: string; d: string }
> = {
  Uptrend: {
    label: "Uptrend",
    kidLabel: "Going up",
    stroke: "var(--price-up)",
    bg: "bg-price-up/10",
    text: "text-price-up",
    d: "M4 16 L10 10 L13 12 L18 6 M18 6 L13 6 M18 6 L18 11",
  },
  Sideways: {
    label: "Sideways",
    kidLabel: "Flat",
    stroke: "#5B6472",
    bg: "bg-paper",
    text: "text-soft",
    d: "M4 11 L18 11 M18 11 L14 8 M18 11 L14 14",
  },
  Downtrend: {
    label: "Downtrend",
    kidLabel: "Going down",
    stroke: "var(--price-down)",
    bg: "bg-price-down/10",
    text: "text-price-down",
    d: "M4 6 L10 12 L13 10 L18 16 M18 16 L13 16 M18 16 L18 11",
  },
  "New / Volatile": {
    label: "New & bouncy",
    kidLabel: "New & bouncy",
    stroke: "#F59E0B",
    bg: "bg-chip-amber",
    text: "text-gold-700",
    d: "M11 4 L11 18 M11 4 L8 7 M11 4 L14 7 M11 18 L8 15 M11 18 L14 15",
  },
};

function keyOf(trend: string | null | undefined): TrendKey | null {
  if (!trend) return null;
  if (trend in CONFIG) return trend as TrendKey;
  // Tolerate legacy/free-text variants.
  const t = trend.toLowerCase();
  if (t.includes("up")) return "Uptrend";
  if (t.includes("down")) return "Downtrend";
  if (t.includes("side") || t.includes("flat")) return "Sideways";
  if (t.includes("new") || t.includes("volat") || t.includes("bounc")) return "New / Volatile";
  return null;
}

export default function TrendGlyph({
  trend,
  size = 16,
  showLabel = true,
  kid = false,
  className = "",
}: {
  trend: string | null | undefined;
  size?: number;
  showLabel?: boolean;
  kid?: boolean;
  className?: string;
}) {
  const key = keyOf(trend);
  if (!key) return null;
  const c = CONFIG[key];
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ${c.bg} ${c.text} ${className}`}
    >
      <svg width={size} height={size} viewBox="0 0 22 22" fill="none" aria-hidden="true">
        <path
          d={c.d}
          stroke={c.stroke}
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      {showLabel && (kid ? c.kidLabel : c.label)}
    </span>
  );
}
