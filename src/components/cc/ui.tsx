/**
 * Cheat Code App — shared primitives (both screen lanes import from here; do not fork).
 * Brand law: orange = brand/live only · green/pink = market truth · belts color rank rings.
 */
import type { CSSProperties, ReactNode } from "react";

/* ── text voices ─────────────────────────────────────────────── */

/** IBM Plex Mono kicker — tiny uppercase tracked label. */
export function Kicker({
  children,
  tone = "orange",
  className = "",
}: {
  children: ReactNode;
  tone?: "orange" | "soft" | "up" | "down";
  className?: string;
}) {
  const color =
    tone === "orange"
      ? "var(--cc-orange-ink)"
      : tone === "up"
        ? "var(--cc-up)"
        : tone === "down"
          ? "var(--cc-down)"
          : "var(--cc-soft)";
  return (
    <div className={`cc-mono ${className}`} style={{ color }}>
      {children}
    </div>
  );
}

/** Kaushan script section title — "discover", "club", "watch", "you", "learn". */
export function ScriptTitle({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <h1 className={`cc-script text-[34px] leading-none text-[var(--cc-ink)] ${className}`}>
      {children}
    </h1>
  );
}

/* ── surfaces ────────────────────────────────────────────────── */

export function Card({
  children,
  className = "",
  style,
}: {
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
}) {
  return (
    <div
      className={`rounded-2xl border border-[var(--cc-line)] bg-[var(--cc-card)] ${className}`}
      style={style}
    >
      {children}
    </div>
  );
}

export function Chip({
  children,
  active = false,
  className = "",
}: {
  children: ReactNode;
  active?: boolean;
  className?: string;
}) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-[11px] font-semibold ${className}`}
      style={
        active
          ? { background: "var(--cc-orange)", color: "var(--cc-orange-deep)" }
          : {
              background: "var(--cc-card2)",
              color: "var(--cc-soft)",
              border: "1px solid var(--cc-line)",
            }
      }
    >
      {children}
    </span>
  );
}

/* ── brand marks ─────────────────────────────────────────────── */

/** Orange coin with rotated dark square — the Cheat Code mark. */
export function CcMark({ size = 28 }: { size?: number }) {
  return (
    <div
      className="cc-halo grid place-items-center rounded-full"
      style={{ width: size, height: size, background: "var(--cc-orange)" }}
    >
      <div
        style={{
          width: size * 0.3,
          height: size * 0.3,
          background: "var(--cc-orange-deep)",
          transform: "rotate(45deg)",
          borderRadius: size * 0.06,
        }}
      />
    </div>
  );
}

const TICKER_COLORS: Record<string, string> = {
  NVDA: "#4ade80",
  TSLA: "#f87171",
  AAPL: "#e5e7eb",
  AMD: "#f87171",
  MSFT: "#38bdf8",
  CRWD: "#f87171",
  AMZN: "#facc15",
  PLTR: "#38bdf8",
  SOFI: "#a78bfa",
  SMCI: "#4ade80",
  RIVN: "#f472b6",
  BTC: "#ff9f43",
};

/** Small rounded-square ticker avatar with the symbol's first letter. */
export function TickerBadge({
  symbol,
  size = 28,
}: {
  symbol: string;
  size?: number;
}) {
  const c = TICKER_COLORS[symbol.toUpperCase()] ?? "var(--cc-soft)";
  return (
    <div
      className="grid shrink-0 place-items-center rounded-lg font-bold"
      style={{
        width: size,
        height: size,
        background: `color-mix(in srgb, ${c} 16%, transparent)`,
        color: c,
        fontSize: size * 0.5,
      }}
    >
      {symbol[0]}
    </div>
  );
}

export const BELT_COLORS: Record<string, string> = {
  white: "#e5e7eb",
  yellow: "#facc15",
  green: "#4ade80",
  blue: "#38bdf8",
  purple: "#a78bfa",
  black: "#f4f0ec",
};

/** Avatar circle ringed in belt color (belt = rank, shows up everywhere). */
export function BeltAvatar({
  initials,
  belt = "white",
  size = 34,
  live = false,
}: {
  initials: string;
  belt?: keyof typeof BELT_COLORS | string;
  size?: number;
  live?: boolean;
}) {
  const ring = BELT_COLORS[belt] ?? BELT_COLORS.white;
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <div
        className="grid h-full w-full place-items-center rounded-full font-semibold"
        style={{
          background: "var(--cc-card2)",
          color: "var(--cc-ink)",
          border: `2px solid ${ring}`,
          fontSize: size * 0.34,
        }}
      >
        {initials}
      </div>
      {live && (
        <span
          className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full"
          style={{ background: "var(--cc-orange)", border: "2px solid var(--cc-bg)" }}
        />
      )}
    </div>
  );
}

/* ── data viz ────────────────────────────────────────────────── */

/** SVG progress ring. Value 0-100; color defaults to signal orange. */
export function Ring({
  value,
  size = 56,
  stroke = 4,
  color = "var(--cc-orange)",
  halo = false,
  children,
}: {
  value: number;
  size?: number;
  stroke?: number;
  color?: string;
  halo?: boolean;
  children?: ReactNode;
}) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  return (
    <div
      className={`relative grid shrink-0 place-items-center ${halo ? "cc-halo rounded-full" : ""}`}
      style={{ width: size, height: size }}
    >
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="var(--cc-line)"
          strokeWidth={stroke}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - Math.min(100, Math.max(0, value)) / 100)}
        />
      </svg>
      <div className="absolute inset-0 grid place-items-center">{children}</div>
    </div>
  );
}

/** Tiny inline SVG sparkline. Pass ~8-30 points; up=green / down=pink / flat=soft. */
export function Sparkline({
  points,
  width = 72,
  height = 24,
  tone,
}: {
  points: number[];
  width?: number;
  height?: number;
  tone?: "up" | "down" | "soft" | "orange";
}) {
  if (points.length < 2) return null;
  const min = Math.min(...points);
  const max = Math.max(...points);
  const span = max - min || 1;
  const step = width / (points.length - 1);
  const d = points
    .map(
      (p, i) =>
        `${i === 0 ? "M" : "L"}${(i * step).toFixed(1)},${(height - 2 - ((p - min) / span) * (height - 4)).toFixed(1)}`
    )
    .join(" ");
  const auto = points[points.length - 1] >= points[0] ? "up" : "down";
  const t = tone ?? auto;
  const color =
    t === "up"
      ? "var(--cc-up)"
      : t === "down"
        ? "var(--cc-down)"
        : t === "orange"
          ? "var(--cc-orange)"
          : "var(--cc-soft)";
  return (
    <svg width={width} height={height} className="shrink-0">
      <path d={d} fill="none" stroke={color} strokeWidth={1.6} strokeLinecap="round" />
    </svg>
  );
}

/** Green/pink % change text, mono. */
export function Delta({ pct, className = "" }: { pct: number; className?: string }) {
  const up = pct >= 0;
  return (
    <span
      className={`font-[family-name:var(--font-plex-mono)] text-[12px] font-semibold ${className}`}
      style={{ color: up ? "var(--cc-up)" : "var(--cc-down)" }}
    >
      {up ? "▲" : "▼"}
      {Math.abs(pct).toFixed(1)}%
    </span>
  );
}

/* ── CTAs ────────────────────────────────────────────────────── */

export function OrangeButton({
  children,
  className = "",
  halo = true,
}: {
  children: ReactNode;
  className?: string;
  halo?: boolean;
}) {
  return (
    <button
      className={`${halo ? "cc-halo" : ""} rounded-full px-5 py-2.5 text-[14px] font-bold ${className}`}
      style={{ background: "var(--cc-orange)", color: "var(--cc-orange-deep)" }}
    >
      {children}
    </button>
  );
}

export function GhostButton({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <button
      className={`rounded-full border border-[var(--cc-line)] bg-[var(--cc-card2)] px-5 py-2.5 text-[14px] font-semibold text-[var(--cc-ink)] ${className}`}
    >
      {children}
    </button>
  );
}

/* ── evidence + verdicts (DESIGN-UX-SPEC §4) ─────────────────────────────── */

/**
 * Evidence chip — small mono pill proving a claim. Three states:
 *   • "pass"  → green ✓  (RSI reset ✓)
 *   • "fail"  → pink ✗   (Above 8-EMA ✗)
 *   • "value" → dim glyph + measured value tint (Call flow 3.1x)
 * Alerts and verdicts are built from stacks of these.
 */
export function EvidenceChip({
  label,
  state = "pass",
  value,
  className = "",
}: {
  label: string;
  state?: "pass" | "fail" | "value";
  value?: string;
  className?: string;
}) {
  const tone =
    state === "pass"
      ? "var(--cc-up)"
      : state === "fail"
        ? "var(--cc-down)"
        : "var(--cc-soft)";
  const glyph = state === "pass" ? "✓" : state === "fail" ? "✗" : "•";
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-lg px-2 py-1 ${className}`}
      style={{
        background: "var(--cc-card2)",
        border: "1px solid var(--cc-line)",
      }}
    >
      <span
        className="grid h-3.5 w-3.5 place-items-center rounded-full text-[9px] font-bold"
        style={{
          color: state === "value" ? "var(--cc-soft)" : "var(--cc-orange-deep)",
          background: state === "value" ? "transparent" : tone,
        }}
      >
        {glyph}
      </span>
      <span
        className="font-[family-name:var(--font-plex-mono)] text-[11px] font-medium"
        style={{ color: "var(--cc-ink)" }}
      >
        {label}
      </span>
      {value && (
        <span
          className="font-[family-name:var(--font-plex-mono)] text-[11px] font-semibold"
          style={{ color: tone }}
        >
          {value}
        </span>
      )}
    </span>
  );
}

export type AlertKind = "BUY" | "SELL" | "HEADS_UP";

/** Colour + copy map for typed alerts. BUY=green, SELL=pink, HEADS-UP=yellow. */
export const ALERT_META: Record<
  AlertKind,
  { edge: string; label: string }
> = {
  BUY: { edge: "var(--cc-up)", label: "BUY" },
  SELL: { edge: "var(--cc-down)", label: "SELL" },
  HEADS_UP: { edge: "var(--cc-yellow)", label: "HEADS UP" },
};

/**
 * Typed alert card — edge-coloured by kind (BUY green / SELL pink / HEADS-UP
 * yellow, never a red panic register). Composed of: mono kicker, thesis line,
 * a stack of evidence chips, and an action row. Every field is optional except
 * kind + thesis so the same card renders briefing and detail densities.
 */
export function AlertCard({
  kind,
  symbol,
  kicker,
  thesis,
  evidence = [],
  action,
  meta,
  className = "",
}: {
  kind: AlertKind;
  symbol?: string;
  kicker?: string;
  thesis: ReactNode;
  evidence?: { label: string; state?: "pass" | "fail" | "value"; value?: string }[];
  action?: ReactNode;
  meta?: string;
  className?: string;
}) {
  const { edge, label } = ALERT_META[kind];
  return (
    <div
      className={`overflow-hidden rounded-2xl border border-[var(--cc-line)] bg-[var(--cc-card)] ${className}`}
      style={{ borderLeft: `3px solid ${edge}` }}
    >
      <div className="p-3.5">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            {symbol && <TickerBadge symbol={symbol} size={26} />}
            <span
              className="font-[family-name:var(--font-plex-mono)] text-[11px] font-bold uppercase tracking-[0.14em]"
              style={{ color: edge }}
            >
              {label}
            </span>
            {kicker && (
              <span
                className="font-[family-name:var(--font-plex-mono)] text-[10px] uppercase tracking-[0.16em]"
                style={{ color: "var(--cc-soft)" }}
              >
                {kicker}
              </span>
            )}
          </div>
          {meta && (
            <span
              className="font-[family-name:var(--font-plex-mono)] text-[10px]"
              style={{ color: "var(--cc-dim)" }}
            >
              {meta}
            </span>
          )}
        </div>

        <p
          className="mt-2 text-[13.5px] leading-snug"
          style={{ color: "var(--cc-ink)" }}
        >
          {thesis}
        </p>

        {evidence.length > 0 && (
          <div className="mt-2.5 flex flex-wrap gap-1.5">
            {evidence.map((e, i) => (
              <EvidenceChip key={i} label={e.label} state={e.state} value={e.value} />
            ))}
          </div>
        )}

        {action && <div className="mt-3 flex items-center gap-2">{action}</div>}
      </div>
    </div>
  );
}

/**
 * Stat row — 3-5 mono values with dim labels, hairline-separated. The
 * "receipts" pattern (4,312 opinions · +14 shift · 88% black belts).
 */
export function StatRow({
  stats,
  className = "",
}: {
  stats: { label: string; value: ReactNode; tone?: "ink" | "up" | "down" | "orange" }[];
  className?: string;
}) {
  const toneColor = (t?: string) =>
    t === "up"
      ? "var(--cc-up)"
      : t === "down"
        ? "var(--cc-down)"
        : t === "orange"
          ? "var(--cc-orange-ink)"
          : "var(--cc-ink)";
  return (
    <div className={`flex items-stretch ${className}`}>
      {stats.map((s, i) => (
        <div
          key={i}
          className="flex-1 px-3 first:pl-0"
          style={
            i > 0
              ? { borderLeft: "1px solid var(--cc-line)" }
              : undefined
          }
        >
          <div
            className="font-[family-name:var(--font-plex-mono)] text-[15px] font-semibold"
            style={{ color: toneColor(s.tone) }}
          >
            {s.value}
          </div>
          <div
            className="mt-0.5 font-[family-name:var(--font-plex-mono)] text-[9.5px] uppercase tracking-[0.14em]"
            style={{ color: "var(--cc-dim)" }}
          >
            {s.label}
          </div>
        </div>
      ))}
    </div>
  );
}

/**
 * Ranked tile — ticker-rail card: colour-initial badge, conviction %, and a
 * rank-movement arrow. The arrow is a RANK delta (▲6 = moved up six places),
 * NOT a price move — it is explicitly labelled "rank" to keep that honest.
 */
export function RankedTile({
  rank,
  symbol,
  conviction,
  rankDelta = 0,
  halo = false,
  className = "",
}: {
  rank: number;
  symbol: string;
  conviction: number;
  rankDelta?: number;
  halo?: boolean;
  className?: string;
}) {
  const up = rankDelta > 0;
  const flat = rankDelta === 0;
  return (
    <div
      className={`relative w-[86px] shrink-0 rounded-2xl border bg-[var(--cc-card)] px-2 py-2.5 text-center ${className}`}
      style={{
        borderColor: halo ? "var(--cc-orange)" : "var(--cc-line)",
        boxShadow: halo ? "var(--cc-halo-soft)" : undefined,
      }}
    >
      <span
        className="absolute -top-2 left-2 grid h-4 w-4 place-items-center rounded-full text-[9px] font-extrabold"
        style={{ background: "var(--cc-orange)", color: "var(--cc-orange-deep)" }}
      >
        {rank}
      </span>
      <div className="flex justify-center">
        <TickerBadge symbol={symbol} size={34} />
      </div>
      <div
        className="mt-1.5 font-[family-name:var(--font-plex-mono)] text-[11px] font-semibold"
        style={{ color: "var(--cc-ink)" }}
      >
        {symbol}
      </div>
      <div
        className="font-[family-name:var(--font-plex-mono)] text-[13px] font-bold"
        style={{ color: "var(--cc-orange-ink)" }}
      >
        {conviction}%
      </div>
      <div
        className="mt-0.5 font-[family-name:var(--font-plex-mono)] text-[9px] font-semibold"
        style={{
          color: flat ? "var(--cc-dim)" : up ? "var(--cc-up)" : "var(--cc-down)",
        }}
        title="rank movement (not price)"
      >
        {flat ? "—" : `${up ? "▲" : "▼"}${Math.abs(rankDelta)}`}{" "}
        <span style={{ color: "var(--cc-dim)" }}>rank</span>
      </div>
    </div>
  );
}

export type LadderRung = {
  /** 0-100 vertical position (100 = top of the ladder). */
  at: number;
  label: string;
  /** Right-aligned mono value (a price, an XP number, a belt name). */
  value?: string;
  /** Marks the member's current position — rendered as the orange pill. */
  current?: boolean;
  /** Optional tone for the rung dot/label (belt colour, up/down). */
  tone?: string;
};

/**
 * Level ladder — shared dashed-hairline ladder used for BOTH key-levels
 * (board 12) and the belt ladder (board 22). Rungs sit at `at` (0-100) up the
 * column; the member's current position renders as the orange pill.
 */
export function LevelLadder({
  rungs,
  height = 220,
  className = "",
}: {
  rungs: LadderRung[];
  height?: number;
  className?: string;
}) {
  return (
    <div className={`relative ${className}`} style={{ height }}>
      {rungs.map((r, i) => {
        const top = `${100 - Math.min(100, Math.max(0, r.at))}%`;
        return (
          <div
            key={i}
            className="absolute left-0 right-0 flex items-center gap-2"
            style={{ top, transform: "translateY(-50%)" }}
          >
            <div
              className="h-0 flex-1"
              style={{
                borderTop: r.current
                  ? "1px solid var(--cc-orange)"
                  : "1px dashed var(--cc-line)",
              }}
            />
            {r.current ? (
              <span
                className="cc-halo-soft inline-flex items-center gap-1.5 rounded-full px-2.5 py-1"
                style={{ background: "var(--cc-orange)", color: "var(--cc-orange-deep)" }}
              >
                <span className="font-[family-name:var(--font-plex-mono)] text-[10px] font-bold uppercase tracking-[0.1em]">
                  {r.label}
                </span>
                {r.value && (
                  <span className="font-[family-name:var(--font-plex-mono)] text-[10px] font-bold">
                    {r.value}
                  </span>
                )}
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5">
                <span
                  className="h-1.5 w-1.5 rounded-full"
                  style={{ background: r.tone ?? "var(--cc-dim)" }}
                />
                <span
                  className="font-[family-name:var(--font-plex-mono)] text-[10px] uppercase tracking-[0.1em]"
                  style={{ color: r.tone ?? "var(--cc-soft)" }}
                >
                  {r.label}
                </span>
                {r.value && (
                  <span
                    className="font-[family-name:var(--font-plex-mono)] text-[10px]"
                    style={{ color: "var(--cc-dim)" }}
                  >
                    {r.value}
                  </span>
                )}
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}
