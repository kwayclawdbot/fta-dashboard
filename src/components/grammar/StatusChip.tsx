import type { ReactNode } from "react";

/**
 * StatusChip — grammar primitive #8 (tiny semantic indicators).
 *
 * The ONLY sanctioned way to render a small state label. Tones are semantic, not
 * decorative — pick the one that matches the meaning, never the one that "looks
 * nice." Accent discipline (PART III): a screen gets ONE dominant + ONE
 * supporting accent, so `accent`/`support` map to the register accent (volt in
 * Club, gold in Family, metallic on FTA) and teal respectively. `kai` is
 * reserved for when Kai speaks — never use it for a non-AI status.
 *
 * Metadata-tiny by rule: 10–11px, tracked, never a heading. Not a container for
 * hierarchy — it is a label.
 */
export type ChipTone =
  | "neutral"
  | "accent" // dominant register accent (volt / gold / metallic)
  | "support" // teal — network / collective / secondary signal
  | "kai" // Kai-blue — ONLY when Kai speaks
  | "live" // synchronous / happening now
  | "bull"
  | "bear"
  | "new";

const TONES: Record<ChipTone, string> = {
  neutral: "bg-sand/60 text-soft",
  accent:
    "bg-[color-mix(in_srgb,var(--accent-solid)_16%,transparent)] text-[var(--accent-strong)]",
  support: "bg-teal-400/15 text-teal-700",
  kai: "bg-kai-blue-soft text-kai-blue",
  live: "bg-volt-500/15 text-volt-700",
  bull: "bg-chip-green text-emerald-700",
  bear: "bg-red-500/12 text-red-600",
  new: "bg-chip-amber text-gold-700",
};

export default function StatusChip({
  children,
  tone = "neutral",
  icon: Icon,
  pulse = false,
  className = "",
}: {
  children: ReactNode;
  tone?: ChipTone;
  icon?: React.ElementType;
  /** A soft pulse dot — only for genuinely live/synchronous states. */
  pulse?: boolean;
  className?: string;
}) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${TONES[tone]} ${className}`}
    >
      {pulse && (
        <span className="relative flex h-1.5 w-1.5">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-current opacity-60 motion-reduce:hidden" />
          <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-current" />
        </span>
      )}
      {Icon && <Icon className="h-3 w-3" />}
      {children}
    </span>
  );
}
