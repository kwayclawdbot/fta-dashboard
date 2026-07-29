/**
 * Cheat Code Club — brand marks.
 *
 * One signal button, one opinion. The circular orange field and centered
 * diamond are the canonical product mark; clusters of this same object become
 * the visual language for people, Circles, and the Collective.
 *
 * Variants:
 *   <ClubMark/>        full two-tone gradient mark (default, ≥40px)
 *   <ClubMark solid/>  single-colour mark for ≤32px chrome (favicon/PWA/mono)
 *   <ClubWordmark/>    mark + "CHEAT CODE CLUB" stacked lockup (no tagline in-app)
 *
 * Geometry note: two rings centred at x=34 and x=66 (r≈22, stroke 12) on a
 * 100×64 box. The crossing is faked with a short "over" arc segment on the
 * orange ring drawn last, giving the interlocked weave without masks (crisp at
 * any size). idPrefix keeps gradient ids unique when several marks render.
 */

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
  const width = size;

  if (solid) {
    const c = solidColor ?? "currentColor";
    return (
      <svg
        width={width}
        height={size}
        viewBox="0 0 64 64"
        fill="none"
        role="img"
        aria-label={title}
        className={className}
      >
        <title>{title}</title>
        <circle cx="32" cy="32" r="29" fill={c} />
        <path d="M32 18 46 32 32 46 18 32Z" fill="var(--paper)" />
      </svg>
    );
  }

  return (
    <svg
      width={width}
      height={size}
      viewBox="0 0 64 64"
      fill="none"
      role="img"
      aria-label={title}
      className={className}
    >
      <title>{title}</title>
      <circle cx="32" cy="32" r="29" fill="#F05A28" />
      <path d="M32 18 46 32 32 46 18 32Z" fill="#FFF8EF" />
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
