"use client";

/**
 * Community sentiment dot-strip (R4) — a glanceable read of the club's stance on
 * a ticker, from the precomputed ticker_like_counts (net = likes − unlikes). Five
 * dots fill by conviction; colour is green (bullish) / neutral / red (bearish).
 * Never teal on this data (owner decision 3). Adult surface only — the kid board
 * doesn't show bull/bear framing.
 */

interface Level {
  fill: number; // 0..5 dots lit
  label: string;
  tone: "bull" | "neutral" | "bear";
}

function levelFor(net: number, votes: number): Level {
  if (votes === 0) return { fill: 0, label: "No votes yet", tone: "neutral" };
  if (net >= 6) return { fill: 5, label: "Very bullish", tone: "bull" };
  if (net >= 3) return { fill: 4, label: "Bullish", tone: "bull" };
  if (net >= 1) return { fill: 3, label: "Leaning bullish", tone: "bull" };
  if (net === 0) return { fill: 2, label: "Split", tone: "neutral" };
  if (net >= -2) return { fill: 2, label: "Leaning bearish", tone: "bear" };
  return { fill: 1, label: "Bearish", tone: "bear" };
}

const TONE: Record<Level["tone"], { on: string; text: string }> = {
  bull: { on: "bg-emerald-500", text: "text-emerald-600" },
  neutral: { on: "bg-midnight-400", text: "text-soft" },
  bear: { on: "bg-red-500", text: "text-red-600" },
};

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
  const tone = TONE[lvl.tone];
  return (
    <div className="flex items-center gap-1.5" title={`Community: ${lvl.label}`}>
      <div className="flex items-center gap-0.5">
        {Array.from({ length: 5 }).map((_, i) => (
          <span
            key={i}
            className={`h-1.5 w-1.5 rounded-full ${
              i < lvl.fill ? tone.on : "bg-sand"
            }`}
          />
        ))}
      </div>
      {showLabel && (
        <span className={`text-[11px] font-semibold ${tone.text}`}>
          {lvl.label}
        </span>
      )}
    </div>
  );
}
