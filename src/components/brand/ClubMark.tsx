/**
 * Cheat Code Club — brand marks.
 *
 * The mark is a figure-8 / INFINITY built from two interlocking loops, honoring
 * the owner mockup's interlocked orange-C + teal-C DNA: the LEFT loop is a
 * Volt-Orange gradient (#FF5A00→#FFB000), the RIGHT loop a Green-Teal gradient
 * (#00C389→#00B4D8). The loops weave over/under at the centre crossing so the
 * silhouette reads as ∞ — recognizable without the wordmark, optically balanced,
 * symmetric about both axes.
 *
 * Variants:
 *   <ClubMark/>        full two-tone gradient mark (default, ≥40px)
 *   <ClubMark solid/>  single-colour mark for ≤32px chrome (favicon/PWA/mono)
 *   <ClubWordmark/>    mark + "CHEAT CODE CLUB" stacked lockup (no tagline in-app)
 *
 * Geometry note: two rings centred at x=34 and x=66 (r≈22, stroke 12) on a
 * 100×64 box. The crossing is faked with a short "over" arc segment on the
 * orange ring drawn last, giving the interlocked weave without masks (crisp at
 * any size).
 *
 * Gradient ids come from React's useId — NOT a module counter. The counter
 * incremented independently on the server and the client (different render
 * order, different module lifetimes), so every hydration diffed `cm2-o` vs
 * `cm3-o` on the sidebar mark and React logged a mismatch on every dashboard
 * load. useId is hydration-stable by contract; the colons it emits are
 * stripped because these ids are consumed inside url(#…) references.
 */

import { useId } from "react";

export interface ClubMarkProps {
  /** Pixel height (width auto from the 100×64 viewBox). Default 40. */
  size?: number;
  /** Single-colour silhouette for tiny sizes / monochrome contexts. */
  solid?: boolean;
  /** Colour for the solid variant (default currentColor → inherits text colour). */
  solidColor?: string;
  className?: string;
  title?: string;
}

export function ClubMark({
  size = 40,
  solid = false,
  solidColor,
  className,
  title = "Cheat Code Club",
}: ClubMarkProps) {
  const uid = `cm${useId().replace(/[^a-zA-Z0-9_-]/g, "")}`;
  const width = Math.round((size * 100) / 64);
  const stroke = 12;

  if (solid) {
    const c = solidColor ?? "currentColor";
    return (
      <svg
        width={width}
        height={size}
        viewBox="0 0 100 64"
        fill="none"
        role="img"
        aria-label={title}
        className={className}
      >
        <title>{title}</title>
        <circle cx="34" cy="32" r="22" stroke={c} strokeWidth={stroke} />
        <circle cx="66" cy="32" r="22" stroke={c} strokeWidth={stroke} />
      </svg>
    );
  }

  return (
    <svg
      width={width}
      height={size}
      viewBox="0 0 100 64"
      fill="none"
      role="img"
      aria-label={title}
      className={className}
    >
      <title>{title}</title>
      <defs>
        <linearGradient id={`${uid}-o`} x1="8" y1="12" x2="60" y2="54" gradientUnits="userSpaceOnUse">
          <stop stopColor="#FF5A00" />
          <stop offset="1" stopColor="#FFB000" />
        </linearGradient>
        <linearGradient id={`${uid}-t`} x1="44" y1="12" x2="96" y2="54" gradientUnits="userSpaceOnUse">
          <stop stopColor="#00C389" />
          <stop offset="1" stopColor="#00B4D8" />
        </linearGradient>
        {/* Covers only the TOP crossing (rings intersect at ~(50,17) & (50,47)). */}
        <clipPath id={`${uid}-weave`}>
          <rect x="41" y="2" width="18" height="27" />
        </clipPath>
      </defs>

      {/* Teal (right) loop — drawn first so orange sits OVER it at both crossings… */}
      <circle cx="66" cy="32" r="22" stroke={`url(#${uid}-t)`} strokeWidth={stroke} />
      {/* Orange (left) loop — full ring, now over teal. */}
      <circle cx="34" cy="32" r="22" stroke={`url(#${uid}-o)`} strokeWidth={stroke} />
      {/* …then re-draw the teal ring ONLY across the top crossing so teal passes
          OVER orange up top while orange stays over teal at the bottom crossing —
          the alternating weave that makes it read as a true interlocked ∞. */}
      <g clipPath={`url(#${uid}-weave)`}>
        <circle cx="66" cy="32" r="22" stroke={`url(#${uid}-t)`} strokeWidth={stroke} />
      </g>
    </svg>
  );
}

export interface ClubWordmarkProps {
  /** Mark height in px (drives lockup scale). Default 34. */
  size?: number;
  /** Stack the wordmark on 3 lines (CHEAT / CODE / CLUB) like the mock. */
  stacked?: boolean;
  /** Override the wordmark text (mode-aware name, e.g. "Family Investing Club"). */
  label?: string;
  className?: string;
}

/**
 * Mark + wordmark lockup. In-app usage is mark + name ONLY (no tagline — owner
 * directive 07-24; taglines live on the marketing site). R2 drops this into the
 * sidebar header / More-sheet wordmark slot (currently in the off-limits nav
 * files) — the component is ready; wiring is a one-line swap there.
 */
export function ClubWordmark({
  size = 34,
  stacked = false,
  label = "Cheat Code Club",
  className,
}: ClubWordmarkProps) {
  const words = label.toUpperCase().split(" ");
  return (
    <span
      className={className}
      style={{ display: "inline-flex", alignItems: "center", gap: size * 0.32 }}
    >
      <ClubMark size={size} />
      <span
        className="font-display"
        style={{
          fontWeight: 800,
          letterSpacing: "-0.01em",
          lineHeight: stacked ? 0.92 : 1,
          fontSize: stacked ? size * 0.46 : size * 0.52,
          color: "var(--ink)",
          display: stacked ? "flex" : "inline",
          flexDirection: "column",
        }}
      >
        {stacked ? words.map((w) => <span key={w}>{w}</span>) : label.toUpperCase()}
      </span>
    </span>
  );
}

export default ClubMark;
