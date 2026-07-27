"use client";

/**
 * COMMUNITY SENTIMENT STRIP — a glanceable read of the club's stance on a ticker,
 * from the precomputed ticker_like_counts (net = likes − unlikes).
 *
 * COLOUR LAW (canvas rebuild): LIME means community sentiment and nothing else.
 * This strip used to render green/red, which collided with price on the same row —
 * a reader could not tell whether the row was up or whether the club liked it.
 * Conviction is now carried by how much of the lime bar is lit; direction is
 * carried by the WORD, never by a second colour ramp.
 *
 * Adult surface only — the kid board doesn't show bull/bear framing.
 */

interface Level {
  fill: number; // 0..5 segments lit
  label: string;
}

function levelFor(net: number, votes: number): Level {
  if (votes === 0) return { fill: 0, label: "No club read yet" };
  if (net >= 6) return { fill: 5, label: "Very bullish" };
  if (net >= 3) return { fill: 4, label: "Bullish" };
  if (net >= 1) return { fill: 3, label: "Leaning bullish" };
  if (net === 0) return { fill: 2, label: "Split" };
  if (net >= -2) return { fill: 2, label: "Leaning bearish" };
  return { fill: 1, label: "Bearish" };
}

export default function SentimentDots({
  net = 0,
  votes = 0,
  showLabel = true,
}: {
  net?: number;
  votes?: number;
  showLabel?: boolean;
}) {
  const lvl = levelFor(net, votes);
  const dim = lvl.fill === 0;
  return (
    <div
      className="flex items-center gap-2"
      title={`Club sentiment: ${lvl.label}${votes ? ` · ${votes} vote${votes === 1 ? "" : "s"}` : ""}`}
    >
      <div className="flex items-center gap-[3px]" aria-hidden>
        {Array.from({ length: 5 }).map((_, i) => (
          <span
            key={i}
            className={`h-[3px] w-3 rounded-full transition-colors ${
              i < lvl.fill ? "bg-lime-500" : "bg-sand"
            }`}
          />
        ))}
      </div>
      {showLabel && (
        <span
          className={`whitespace-nowrap font-mono text-[10px] uppercase tracking-[0.1em] ${
            dim ? "text-soft/55" : "text-lime-700 dark:text-lime-400"
          }`}
        >
          {lvl.label}
        </span>
      )}
    </div>
  );
}
