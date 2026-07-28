/**
 * EmptyStates — three drawings for three specific absences.
 *
 * An empty state that says only "Nothing here yet" wastes the one screen where
 * the member is most receptive and least busy. These are the three the audit
 * named, drawn as one family (same 2px line, same flat fill, same slightly
 * off-square framing) so they read as coming from the same hand:
 *
 *   PinBoard    — a cork board with ONE pennant hung and the other hooks empty.
 *                 For the watchlist since it landed: the point is that the wall
 *                 is waiting, not that it is broken.
 *   TwoArrows   — two arrows passing without meeting. For MOST DIVISIVE with no
 *                 disagreement in it yet: the picture of a split that hasn't
 *                 happened.
 *   BeltOnPeg   — a belt hung on an empty peg. For "no Black Belts yet": the
 *                 rank exists, the peg is there, nobody has taken it down.
 *
 * Capped at 88px by the brief and drawn to sit AGAINST the surface's existing
 * rule lines rather than inside a card of their own — they carry no background.
 */
import type { ReactNode } from "react";

const LINE = "var(--m400)";
const FILL = "color-mix(in srgb, var(--m400) 12%, transparent)";
const ACCENT = "var(--color-volt-500)";
const ACCENT_FILL = "color-mix(in srgb, var(--color-volt-500) 18%, transparent)";

export interface EmptyArtProps {
  /** Rendered width. Hard-capped at 88px per the brief. */
  size?: number;
  title?: string;
  className?: string;
}

function Frame({
  size = 88,
  title,
  className = "",
  children,
}: EmptyArtProps & { children: ReactNode }) {
  const s = Math.min(88, size);
  return (
    <svg
      width={s}
      height={s}
      viewBox="0 0 88 88"
      fill="none"
      className={className}
      role={title ? "img" : "presentation"}
      aria-label={title}
      aria-hidden={title ? undefined : true}
    >
      {title ? <title>{title}</title> : null}
      <g
        stroke={LINE}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
      >
        {children}
      </g>
    </svg>
  );
}

/** The pin board: one pennant hung, three hooks still empty. */
export function EmptyPinBoard(props: EmptyArtProps) {
  return (
    <Frame {...props}>
      {/* board */}
      <path d="M8 16h72v56H8z" fill={FILL} />
      <path d="M8 26h72" strokeOpacity={0.4} />
      {/* the one pennant that IS hung */}
      <path d="M22 26v20l8-5 8 5V26" fill={ACCENT_FILL} stroke={ACCENT} />
      <circle cx="30" cy="22" r="3" fill={ACCENT_FILL} stroke={ACCENT} />
      {/* empty hooks */}
      <path d="M50 22v5M50 22a3 3 0 0 1 3 3" strokeOpacity={0.55} />
      <path d="M66 22v5M66 22a3 3 0 0 1 3 3" strokeOpacity={0.55} />
      <path d="M46 40h24M46 50h16" strokeOpacity={0.3} />
    </Frame>
  );
}

/** Two arrows passing — a split that hasn't happened yet. */
export function EmptyTwoArrows(props: EmptyArtProps) {
  return (
    <Frame {...props}>
      <path d="M12 30h40" />
      <path d="M46 24l6 6-6 6" />
      <path d="M76 58H36" />
      <path d="M42 52l-6 6 6 6" />
      <path d="M14 58h10" strokeOpacity={0.3} />
      <path d="M64 30h10" strokeOpacity={0.3} />
    </Frame>
  );
}

/** A belt over an empty peg — the rank nobody has taken down. */
export function EmptyBeltOnPeg(props: EmptyArtProps) {
  return (
    <Frame {...props}>
      {/* the rail and its pegs */}
      <path d="M8 22h72" />
      <path d="M24 22v8M64 22v8" />
      <circle cx="24" cy="32" r="3" fill={FILL} />
      <circle cx="64" cy="32" r="3" fill={FILL} />
      {/* the belt, hung and folded over the left peg */}
      <path d="M20 32c-3 12-4 24-2 36l9 2c2-14 2-26 1-36Z" fill={FILL} />
      <path d="M28 34c3 10 4 22 3 34l-9 2" strokeOpacity={0.5} />
      <path d="M20 48h9M20 56h9" strokeOpacity={0.45} />
      {/* the empty peg, waiting */}
      <path d="M58 40h12M58 40a3 3 0 0 0-3 3M70 40a3 3 0 0 1 3 3" strokeOpacity={0.4} strokeDasharray="3 4" />
    </Frame>
  );
}

/**
 * The drawing plus its line, laid out the way the surfaces use it — mark left,
 * one sentence right, sitting on the page's own rule rather than in a card.
 */
export function EmptyStateNote({
  art,
  title,
  children,
  className = "",
}: {
  art: ReactNode;
  title: string;
  children?: ReactNode;
  className?: string;
}) {
  return (
    <div className={`flex items-center gap-4 border-t border-[var(--sand)] py-6 ${className}`}>
      <span className="shrink-0">{art}</span>
      <div className="min-w-0">
        <p className="font-display text-[15px] font-extrabold text-ink">{title}</p>
        {children ? <p className="mt-1 text-[13px] text-soft">{children}</p> : null}
      </div>
    </div>
  );
}

export default EmptyPinBoard;
